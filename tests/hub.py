"""Incremental security hub assertions. Called only by the loopback suite."""
import copy
import urllib.parse


def check_types(req, ok, anon, owner):
    template = {
        'title': 'Hub validation fixture', 'subtitle': 'Disposable local fixture',
        'cover': '', 'tags': ['Cloud Security', 'Testing'],
        'body': [{'tag': 'p', 'children': [{'text': 'A local security knowledge fixture.'}]}],
    }
    for patch in [{'type': 'invalid'}, {'difficulty': None}, {'difficulty': 'expert'},
                  {'type': 'resource', 'resourceUrl': 'http://example.org'},
                  {'type': 'resource', 'resourceUrl': 'javascript:alert(1)'},
                  {'reviewedAt': 1}, {'type': 'resource', 'resourceUrl': 'https://example.org', 'resourceKind': 'invalid'}]:
        assert req(owner, '/api/posts', {**template, **patch})[0] == 400, patch
    fixtures = []
    for kind, path in [('post', '/posts'), ('note', '/notes'), ('cheatsheet', '/cheatsheets'), ('resource', '/resources')]:
        content = copy.deepcopy(template)
        content['title'] = 'Local ' + kind + ' fixture'
        if kind != 'post':
            content['type'] = kind
        if kind == 'resource':
            content.update(resourceUrl='https://example.org/tool', resourceKind='tool', takeaway='A useful local fixture.', body=[])
        item = ok(owner, '/api/posts', content)
        result = ok(owner, '/api/posts/' + item['id'], {'action': 'publish', 'version': item['version'], 'content': content})
        fixtures.append((item, result['version']))
        code, html = req(anon, path + '?tag=cloud-security&difficulty=&sort=title')
        assert code == 200 and content['title'] in html
        assert req(anon, '/tags/cloud-security')[0] == 200
        if kind == 'resource':
            assert 'example.org' in html and 'Visit resource' in html
    tags = ok(anon, '/api/tags')['tags']
    assert any(t['slug'] == 'cloud-security' and t['count'] >= 4 for t in tags)
    rows = ok(owner, '/api/posts?studio=1')['posts']
    old = next(p for p in rows if p['id'] == fixtures[0][0]['id'])
    assert old['draft']['type'] == 'post'
    private = ok(owner, '/api/posts', {**template, 'title': 'Private hub note must stay private', 'type': 'note'})
    assert 'Private hub note must stay private' not in req(anon, '/notes')[1]
    fixtures.append((private, private['version']))
    for item, version in fixtures:
        ok(owner, '/api/posts/' + item['id'], {'action': 'delete', 'version': version})
    print('PASS: strict metadata, legacy post default, resource HTTPS validation, type and tag listings, and private filtering.')


def check_search(req, ok, anon, owner):
    assert ok(anon, '/api/search?q=a')['results'] == []
    assert req(anon, '/api/search?q=needle&type=invalid')[0] == 400
    ids = []
    for i in range(35):
        content = {
            'title': 'Needle title' if i == 0 else 'Search fixture ' + str(i),
            'subtitle': 'needle subtitle' if i == 2 else '', 'cover': '',
            'tags': ['Needle'] if i == 1 else ['Search testing'],
            'type': 'post' if i < 4 else 'note',
            'difficulty': 'beginner' if i == 1 else 'intermediate',
            'body': [{'tag': 'p', 'children': [{'text': ('Needle body. ' if i >= 3 else '') + 'Safe excerpt. ' * 30 + 'BODY_PAYLOAD_SHOULD_NOT_REACH_HOME'}]}],
        }
        item = ok(owner, '/api/posts', content)
        result = ok(owner, '/api/posts/' + item['id'], {'action': 'publish', 'version': item['version'], 'content': content})
        ids.append((item, result['version']))
    hits = ok(anon, '/api/search?q=needle&type=post&limit=30')['results']
    assert [h['id'] for h in hits] == [p['id'] for p, _ in ids[:4]]
    assert all('body' not in h and 'snippet' in h for h in hits)
    assert len(ok(anon, '/api/search?q=needle&limit=999')['results']) == 30
    assert len(ok(anon, '/api/search?q=needle&type=post&tag=needle&difficulty=beginner')['results']) == 1
    assert 'BODY_PAYLOAD_SHOULD_NOT_REACH_HOME' not in req(anon, '/')[1]
    for item, version in ids:
        ok(owner, '/api/posts/' + item['id'], {'action': 'delete', 'version': version})
    print('PASS: search scoring, filters, minimum length, limit cap, snippets, and body-free homepage payload.')
