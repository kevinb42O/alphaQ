import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export const sha=s=>createHash('sha256').update(s).digest('hex');
export function normalize(key){if(typeof key!=='string')return null;const k=key.replace(/[\s-]/g,'').toUpperCase();return /^ALQ1[A-F0-9]{32}$/.test(k)?k:null;}
export function generateKey(){const raw='ALQ1'+randomBytes(16).toString('hex').toUpperCase();return raw.match(/.{1,4}/g).join('-');}
export function equal(a,b){const x=sha(String(a)),y=sha(String(b));return timingSafeEqual(Buffer.from(x),Buffer.from(y));}
export function session(secret,now=Date.now()){const payload=Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+3600,nonce:randomBytes(12).toString('hex')})).toString('base64url');return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');}
export function validSession(token,secret,now=Date.now()){try{const [p,s,...rest]=token.split('.');if(rest.length||!equal(createHmac('sha256',secret).update(p).digest('base64url'),s))return false;return JSON.parse(Buffer.from(p,'base64url')).exp>now/1000;}catch{return false;}}
export async function database(route,{method='POST',body,headers={}}={}){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Database not configured');
 const response=await fetch(url+'/rest/v1/'+route,{method,headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Database request failed ('+response.status+')');
 if(response.status===204)return null;const text=await response.text();return text?JSON.parse(text):null;
}
export async function rate(bucket,limit=60,seconds=60){return database('rpc/aqx_rate',{body:{p_bucket:bucket,p_limit:limit,p_seconds:seconds}});}
