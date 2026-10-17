import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/enquiry.js';
const base = { TURNSTILE_SECRET_KEY:'test-secret', SUPABASE_SECRET_KEY:'sb_secret_server-secret', SUPABASE_URL:'https://db.example', PUBLIC_SITE_URL:'https://portfolio.example' };
const payload = {name:'Brand person',email:'hello@example.com',company:'Brand',service:'UGC videos',message:'We would love to work together on a launch.',turnstileToken:'token'};
const send = (value, env=base, origin='https://portfolio.example') => onRequestPost({env,request:new Request('https://portfolio.example/api/enquiry',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(value)})});

test('fails closed when server-side secrets are absent', async()=>{
  const r = await send(payload,{}); assert.equal(r.status,503);
});
test('rejects cross-origin request before verification', async()=>{
  const r = await send(payload,base,'https://evil.example'); assert.equal(r.status,403);
});
test('rejects invalid input before verification', async()=>{
  const r = await send({...payload,email:'bad-email'}); assert.equal(r.status,400);
});
test('validates Turnstile server-side before writing any enquiry', async()=>{
  const old = global.fetch;
  let calls = [];
  global.fetch = async (url,options) => {
    calls.push([String(url),options]);
    if (String(url).includes('siteverify')) return new Response(JSON.stringify({success:true,hostname:'portfolio.example'}),{status:200});
    return new Response('',{status:201});
  };
  try {
    const response = await send(payload);
    assert.equal(response.status,201);
    assert.equal(calls.length,2);
    assert.match(calls[0][0],/siteverify/);
    assert.match(calls[1][0],/portfolio_inquiries/);
    assert.equal(calls[1][1].headers.apikey,'sb_secret_server-secret');
    assert.equal(calls[1][1].headers.Authorization,undefined);
    assert.ok(!JSON.stringify(calls[1][1].body).includes('turnstileToken'));
  } finally {global.fetch = old;}
});
test('never stores enquiry if verification fails',async()=>{
  const old=global.fetch; let calls=0;
  global.fetch=async()=>{calls++;return new Response(JSON.stringify({success:false}),{status:200});};
  try{const response=await send(payload);assert.equal(response.status,403);assert.equal(calls,1);}finally{global.fetch=old;}
});
