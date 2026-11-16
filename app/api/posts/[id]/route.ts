import {database,json,authorizeWrite,snapshot} from '../../../../lib/server';
import {validateContent} from '../../../../lib/content';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const denied=await authorizeWrite(request);if(denied)return denied;
 try{const {id}=await params;const input:any=await request.json();if(!['save','publish','unpublish','delete','restore','schedule','cancelSchedule','restoreRevision'].includes(input.action))return json({error:'Unknown action.'},400);
 if(!Number.isInteger(input.version))return json({error:'Missing draft version.'},400);
 const db=database(),row=await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first<any>();if(!row||row.deleted_at&&input.action!=='restore')return json({error:'Post not found.'},404);
 if(row.version!==input.version)return json({error:'This draft changed in another tab. Reload before editing again.'},409);
 const now=Date.now();let stmt:D1PreparedStatement;let content;
 if(['save','publish','schedule'].includes(input.action)){content=validateContent(input.content);if(input.action!=='save'&&!content.body.length)return json({error:'Write some content before publishing.'},400);if(content.attachments?.length){const ids=content.attachments.map(a=>a.id);const found=await db.prepare(`SELECT id FROM files WHERE id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all();if(found.results.length!==ids.length)return json({error:'An attachment could not be found.'},400)}
 if(input.action==='schedule'){const at=Number(input.scheduledAt);if(!Number.isFinite(at)||at<=now+30000||at>now+366*864e5)return json({error:'Choose a future date within the next year.'},400);stmt=db.prepare('UPDATE posts SET published=CASE WHEN scheduled_at<=? THEN scheduled ELSE published END,published_at=CASE WHEN scheduled_at<=? THEN scheduled_at ELSE published_at END,draft=?,scheduled=?,scheduled_at=?,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(now,now,JSON.stringify(content),JSON.stringify(content),at,now,id,input.version)}
 else if(input.action==='publish')stmt=db.prepare('UPDATE posts SET draft=?,published=?,published_at=COALESCE(published_at,?),scheduled=NULL,scheduled_at=NULL,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(content),JSON.stringify(content),now,now,id,input.version);
 else stmt=db.prepare('UPDATE posts SET draft=?,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(content),now,id,input.version);
 }else if(input.action==='restoreRevision'){const rev=await db.prepare('SELECT content FROM revisions WHERE id=? AND post_id=?').bind(input.revisionId||'',id).first<any>();if(!rev)return json({error:'Revision not found.'},404);content=validateContent(JSON.parse(rev.content));stmt=db.prepare('UPDATE posts SET draft=?,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(content),now,id,input.version)}
 else if(input.action==='restore')stmt=db.prepare('UPDATE posts SET deleted_at=NULL,published=NULL,published_at=NULL,scheduled=NULL,scheduled_at=NULL,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(now,id,input.version);
 else if(input.action==='delete')stmt=db.prepare('UPDATE posts SET deleted_at=?,version=version+1 WHERE id=? AND version=?').bind(now,id,input.version);
 else if(input.action==='cancelSchedule')stmt=db.prepare('UPDATE posts SET published=CASE WHEN scheduled_at<=? THEN scheduled ELSE published END,published_at=CASE WHEN scheduled_at<=? THEN scheduled_at ELSE published_at END,scheduled=NULL,scheduled_at=NULL,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(now,now,now,id,input.version);
 else stmt=db.prepare('UPDATE posts SET published=NULL,published_at=NULL,scheduled=NULL,scheduled_at=NULL,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(now,id,input.version);
 const results=await db.batch([await snapshot(db,id,input.version),stmt]);if(!results[1].meta.changes)return json({error:'Draft changed in another tab. Reload to continue.'},409);
 return json({id,slug:row.slug,version:input.version+1,updatedAt:now,scheduledAt:input.action==='schedule'?input.scheduledAt:null})
 }catch(e){return json({error:e instanceof Error?e.message:'Could not update post.'},400)}
}
