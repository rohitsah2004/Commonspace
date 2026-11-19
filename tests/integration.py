"""Runs against the local Sites preview only. Never use a production origin."""
import urllib.request,urllib.error,http.cookiejar,json,time,io,zipfile,pathlib
base='http://127.0.0.1:5173';anon=urllib.request.build_opener();owner=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def req(client,path,payload=None,raw=False):
 headers={'Origin':base};body=None
 if payload is not None:headers['Content-Type']='application/json';body=json.dumps(payload).encode()
 try:
  with client.open(urllib.request.Request(base+path,data=body,headers=headers)) as r:data=r.read();return r.status,data if raw else data.decode()
 except urllib.error.HTTPError as e:return e.code,e.read().decode()
def ok(client,path,payload=None):
 status,body=req(client,path,payload);assert status in [200,201],(path,status,body[:500]);return json.loads(body)
def upload(path,name,content):
 boundary='commonplace-test-boundary';body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+content+(f'\r\n--{boundary}--\r\n').encode();r=owner.open(urllib.request.Request(base+path,data=body,headers={'Origin':base,'Content-Type':'multipart/form-data; boundary='+boundary}));return json.loads(r.read())
assert req(anon,'/api/manage')[0]==403
assert req(anon,'/api/export?format=zip')[0]==403
owner.open(base+'/signin-with-chatgpt?return_to=/studio').read()
content={'title':'Disposable comprehensive check','subtitle':'Only local test content','cover':'','tags':['Testing'],'body':[{'tag':'p','children':[{'text':'A paragraph for testing saved revisions, publishing, and attached files.'}]}]}
p=ok(owner,'/api/posts',content);version=p['version'];path='/api/posts/'+p['id'];slug=p['slug']
def act(action,**extra):
 global version
 r=ok(owner,path,{'action':action,'version':version,**extra});version=r['version'];return r
scheduled_at=int(time.time()*1000)+32000
act('schedule',content=content,scheduledAt=scheduled_at)
assert not any(x['id']==p['id'] for x in ok(anon,'/api/posts')['posts'])
content['title']='Private revision after scheduling';act('save',content=content)
revs=ok(owner,'/api/revisions/'+p['id'])['revisions'];assert len(revs)>=2
assert req(anon,'/api/revisions/'+p['id'])[0]==403
act('restoreRevision',revisionId=revs[-1]['id'])
restored=next(x for x in ok(owner,'/api/posts?studio=1')['posts'] if x['id']==p['id']);assert restored['draft']['title']=='Disposable comprehensive check'
collection=ok(owner,'/api/manage',{'action':'collection','name':'Local test series','description':'A local testing collection'})
file=upload('/api/files','local-note.txt',b'This attachment is a disposable local test.')
assert req(anon,file['url'])[0]==404
image=upload('/api/uploads','cover.png',pathlib.Path('public/social-cover.png').read_bytes())
assert req(anon,image['url'],raw=True)[0]==200
profile={'name':'Rohit','bio':'Ideas, observations, and discoveries worth sharing.','photo':'','linkedin':'','website':''}
ok(owner,'/api/manage',{'action':'profile','profile':profile})
for route in ['/','/about','/collections','/collections/'+collection['slug'],'/privacy','/feed.xml','/studio/manage']:
 assert req(owner,route)[0]==200,route
assert ok(anon,'/api/subscribe')['ready'] is False
assert req(anon,'/api/subscribe',{'email':'disposable@example.com','consent':True})[0]==503
assert req(anon,'/api/files',{})[0]==403
status,archive=req(owner,'/api/export?format=zip',raw=True);assert status==200
z=zipfile.ZipFile(io.BytesIO(archive));assert z.testzip() is None
backup=json.loads(z.read('commonplace.json'));assert backup['format']=='commonplace-backup-v1';assert any(x['id']==p['id'] for x in backup['posts']);assert z.read('assets/attachments/'+file['id']+'.txt')==b'This attachment is a disposable local test.'
wait=max(0,(scheduled_at-int(time.time()*1000))/1000+.2);time.sleep(wait)
public=next(x for x in ok(anon,'/api/posts')['posts'] if x['id']==p['id']);assert public['content']['title']=='Disposable comprehensive check'
assert req(anon,'/post/'+slug)[0]==200
# Rescheduling a story whose previous schedule already went live must keep that version live.
act('schedule',content=content,scheduledAt=int(time.time()*1000)+86400000)
assert next(x for x in ok(anon,'/api/posts')['posts'] if x['id']==p['id'])['content']['title']=='Disposable comprehensive check'
act('cancelSchedule')
content.update(title='Published comprehensive check',cover=image['url'],series=collection['id'],position=1,attachments=[file]);content['body'] += [{'tag':'pre','language':'javascript','children':[{'text':'const result = 42;'}]},{'tag':'figure','children':[{'tag':'img','src':image['url'],'alt':'Test cover','children':[]},{'tag':'figcaption','children':[{'text':'A local image caption.'}]}]},{'tag':'table','children':[{'tag':'tbody','children':[{'tag':'tr','children':[{'tag':'td','children':[{'text':'Table cell'}]}]}]}]}]
act('publish',content=content)
assert req(anon,file['url'])[0]==200
html=req(anon,'/post/'+slug)[1];assert 'syntax-keyword' in html and 'A local image caption.' in html and 'Table cell' in html
assert 'Published comprehensive check' in req(anon,'/collections/'+collection['slug'])[1]
view={'slug':slug,'session':'local-test-session-12345','source':'https://www.linkedin.com/feed/'}
ok(anon,'/api/analytics',view);ok(anon,'/api/analytics',view)
data=ok(owner,'/api/manage');assert next(x for x in data['views'] if x['post_id']==p['id'])['views']==1
assert next(x for x in data['sources'] if x['source']=='linkedin.com')['views']>=1
assert req(owner,path,{'action':'save','version':1,'content':content})[0]==409
act('delete');assert req(anon,'/post/'+slug)[0]==404;assert req(anon,file['url'])[0]==404
act('restore');restored=next(x for x in ok(owner,'/api/posts?studio=1')['posts'] if x['id']==p['id']);assert restored['published'] is None and restored['scheduled_at'] is None
act('delete')
print('PASS: private tools, revision restore, scheduled visibility with separate snapshots, collections, profile, attachments access, image storage, full ZIP integrity and asset contents, syntax highlighting, captions/tables, view deduplication, source counts, version conflicts, trash restoration, and email-disconnected state.')

from hub import check_types
check_types(req, ok, anon, owner)
from hub import check_search
check_search(req, ok, anon, owner)
import subprocess
subprocess.run(['node', 'tests/unit.mjs'], check=True)
subprocess.run(['node', 'tests/digest.mjs'], check=True)

from hub import check_follow
check_follow(req, anon)
from hub import check_extended, check_rate_limit, check_assist, check_clip
check_assist(req, ok, anon, owner, base)
check_clip(req, ok, anon, owner)
check_extended(req, ok, anon, owner, base)
# Run threshold checks last so they cannot interfere with functional search tests.
check_rate_limit(anon, base)
