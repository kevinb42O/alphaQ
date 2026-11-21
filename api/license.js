import {sha,normalize,generateKey,equal,session,validSession,database,rate} from '../lib/licensing.mjs';
const ORIGIN='https://aqxmenu.vercel.app';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Content-Type-Options','nosniff');
 const plain=(req.headers.accept||'').includes('text/plain');
 function send(status,data){res.statusCode=status;if(plain){res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(`AQX1\n${data.ok?'OK':'DENIED'}\n${data.expires_unix||0}\n${String(data.message||data.code||'Request failed').replace(/[\r\n]/g,' ')}\n`);}else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}}
 if(req.method!=='POST')return send(405,{ok:false,code:'method',message:'Use POST.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||JSON.stringify(body).length>4096)throw 0;}catch{return send(400,{ok:false,code:'body',message:'Invalid request.'});}
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const action=body.action||'verify';
 try{
  if(!await rate('ip:'+sha(ip),90,60))return send(429,{ok:false,code:'rate',message:'Too many requests. Wait a minute and retry.'});
  if(action==='verify'){
   const key=normalize(body.key);if(!key||typeof body.device!=='string'||!/^[a-f0-9]{64}$/.test(body.device))return send(400,{ok:false,code:'invalid',message:'Invalid key or device.'});
   if(!await rate('key:'+sha(key),40,60))return send(429,{ok:false,code:'rate',message:'Too many checks for this key. Wait a minute.'});
   const data=await database('rpc/aqx_verify',{body:{p_key_hash:sha(key),p_device_hash:body.device}});return send(data.ok?200:403,data);
  }
  // Admin mutations require same-origin JSON plus a signed, HttpOnly cookie.
  const origin=req.headers.origin;const expected=process.env.APP_ORIGIN||ORIGIN;
  if(origin!==expected||!(req.headers['content-type']||'').startsWith('application/json'))return send(403,{ok:false,message:'Admin requests require the site origin.'});
  const secret=process.env.AQX_ADMIN_SECRET;if(!secret||secret.length<40)throw new Error('Admin not configured');
  if(action==='login'){
   if(!await rate('login:'+sha(ip),8,900))return send(429,{ok:false,message:'Too many login attempts. Wait 15 minutes.'});
   if(!equal(body.secret||'',secret))return send(401,{ok:false,message:'Invalid administrator credential.'});
   res.setHeader('Set-Cookie',`__Host-aqx_admin=${session(secret)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600`);return send(200,{ok:true});
  }
  if(action==='logout'){res.setHeader('Set-Cookie','__Host-aqx_admin=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');return send(200,{ok:true});}
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-aqx_admin='))?.slice('__Host-aqx_admin='.length);
  if(!token||!validSession(token,secret))return send(401,{ok:false,message:'Sign in to manage licenses.'});
  if(action==='list'){
   const licenses=await database('aqx_licenses?select=id,label,duration_days,created_at,activated_at,expires_at,device_hash,revoked,last_seen_at,reset_count&order=created_at.desc&limit=1000',{method:'GET'});
   const audit=await database('aqx_audit?select=id,created_at,license_id,action&order=id.desc&limit=50',{method:'GET'});return send(200,{ok:true,licenses,audit});
  }
  if(action==='create'){
   const days=Number(body.days),count=Number(body.count);if(![0,1,3,7,30].includes(days)||!Number.isInteger(count)||count<1||count>100)return send(400,{ok:false,message:'Select a valid duration and 1–100 keys.'});
   const keys=Array.from({length:count},()=>generateKey());const label=String(body.label||'').slice(0,120);
   await database('aqx_licenses',{headers:{Prefer:'return=minimal'},body:keys.map((key,i)=>({key_hash:sha(normalize(key)),duration_days:days,label:label||`${days||'Forever'} day / ${i+1}`}))});
   await database('aqx_audit',{headers:{Prefer:'return=minimal'},body:{action:'create',detail:count+' keys / '+days+' days'}});
   return send(200,{ok:true,keys,days,message:'Save this list now. Full keys are not stored on the server.'});
  }
  if(['revoke','restore','reset_device'].includes(action)){
   if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return send(400,{ok:false,message:'Invalid license ID.'});
   const result=await database('rpc/aqx_manage',{body:{p_id:body.id,p_action:action}});return send(200,result);
  }
  return send(400,{ok:false,message:'Unknown action.'});
 }catch(error){console.error('License service error:',error.message);return send(503,{ok:false,code:'unavailable',message:'License service unavailable. Please retry. Access has not been granted.'});}
}
