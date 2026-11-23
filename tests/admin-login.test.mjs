import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/license.js';
import {passwordHash} from '../lib/licensing.mjs';

test('admin login requires email/password, issues a secure cookie and protects key creation',async()=>{
 const previous={...process.env},originalFetch=globalThis.fetch;
 process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 process.env.AQX_ADMIN_SECRET='x'.repeat(64);process.env.AQX_ADMIN_EMAIL='owner@example.com';process.env.AQX_ADMIN_PASSWORD_HASH=await passwordHash('test-password-123');
 let mutations=0;
 const historyRequests=[];
 globalThis.fetch=async(url)=>{
  if(url.includes('aqx_license_checks?')){
   historyRequests.push(url);
   return Response.json([{checked_at:'2026-11-23T12:00:00Z'}]);
  }
  if(!url.includes('aqx_rate'))mutations++;
  return new Response('true',{status:200});
 };
 const call=async(body,headers={})=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(text){this.body=JSON.parse(text);}};await handler({method:'POST',body,headers:{origin:'https://aqxmenu.vercel.app','content-type':'application/json',...headers}},res);return res;};
 try{
  assert.equal((await call({action:'login',secret:process.env.AQX_ADMIN_SECRET})).statusCode,401);
  assert.equal((await call({action:'login',email:'other@example.com',password:'test-password-123'})).statusCode,401);
  assert.equal((await call({action:'login',email:'owner@example.com',password:'wrong'})).statusCode,401);
  assert.equal((await call({action:'create',days:3,count:1})).statusCode,401);
  assert.equal(mutations,0);
  const login=await call({action:'login',email:' OWNER@example.com ',password:'test-password-123'});
  assert.equal(login.statusCode,200);const cookie=login.headers['Set-Cookie'];assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);
  const created=await call({action:'create',days:3,count:2},{cookie:cookie.split(';')[0]});assert.equal(created.statusCode,200);assert.equal(created.body.keys.length,2);assert.equal(mutations,2);
  assert.equal((await call({action:'create',days:3,count:1},{cookie:cookie.split(';')[0],origin:'https://evil.invalid'})).statusCode,403);
  const id='7af4731c-7dd4-4cc6-9dd2-37e207a46f21';
  assert.equal((await call({action:'history',id})).statusCode,401);
  assert.equal((await call({action:'history',id:'-'.repeat(36)},{cookie:cookie.split(';')[0]})).statusCode,400);
  assert.equal(historyRequests.length,0);
  assert.deepEqual((await call({action:'history',id},{cookie:cookie.split(';')[0]})).body,
   {ok:true,checks:['2026-11-23T12:00:00Z']});
  assert.match(historyRequests[0],/order=id.desc&limit=50$/);
 }finally{globalThis.fetch=originalFetch;process.env=previous;}
});
