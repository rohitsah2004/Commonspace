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
