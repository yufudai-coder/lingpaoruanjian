const enc = new TextEncoder();
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store",
    "access-control-allow-origin":"*", "access-control-allow-methods":"GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers":"content-type,authorization" }
});
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const uuid = () => crypto.randomUUID();
async function sha(s) { return b64u(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
async function adminOk(req, env) {
  const h=req.headers.get("authorization")||"";
  return !!env.ADMIN_KEY && h === `Bearer ${env.ADMIN_KEY}`;
}
async function importPrivate(env) {
  if (!env.SIGNING_KEY) throw new Error("SIGNING_KEY secret is missing");
  return crypto.subtle.importKey("pkcs8", fromB64(env.SIGNING_KEY), {name:"ECDSA",namedCurve:"P-256"}, false, ["sign"]);
}
async function signLicense(payload, env) {
  const header=b64u(enc.encode(JSON.stringify({alg:"ES256",typ:"JWT"})));
  const body=b64u(enc.encode(JSON.stringify(payload)));
  const input=`${header}.${body}`;
  const sig=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"}, await importPrivate(env), enc.encode(input));
  return `${input}.${b64u(sig)}`;
}
function html() {
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>车机授权管理</title>
 <style>
 *{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#172033;font:15px system-ui,-apple-system,"Noto Sans SC",sans-serif}
 header{background:#15243a;color:white;padding:20px}main{max-width:900px;margin:18px auto;padding:0 14px}
 .card{background:white;border-radius:14px;padding:16px;margin:12px 0;box-shadow:0 2px 12px #15243a0c}
 h2{font-size:18px;margin:0 0 12px}input,select,button{font:inherit;padding:11px;border:1px solid #d5dce5;border-radius:9px;width:100%;margin:5px 0}
 button{background:#1769d2;color:white;border:0;font-weight:650}button.secondary{background:#e8eef7;color:#172033}
 .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.muted{color:#69778b;font-size:13px}
 .item{border-top:1px solid #edf0f4;padding:12px 0;overflow-wrap:anywhere}.tag{font-size:12px;background:#edf3ff;padding:3px 7px;border-radius:20px}
 @media(max-width:560px){.grid{grid-template-columns:1fr}}
 </style><header><b>Car License · 车机授权管理</b><div class="muted" style="color:#c8d5e6">两个软件共用后台，授权相互独立</div></header>
 <main><section id="login" class="card"><h2>管理员登录</h2><input id="key" type="password" placeholder="输入 ADMIN_KEY"><button onclick="login()">登录</button><div id="msg" class="muted"></div></section>
 <div id="app" hidden>
 <section class="card"><h2>创建激活码</h2><div class="grid"><select id="product"><option value="APP_A">软件 A（APP_A）</option><option value="APP_B">软件 B（APP_B）</option></select><select id="type"><option value="permanent">永久授权</option><option value="trial">1天体验</option></select></div><input id="qty" type="number" min="1" max="100" value="1" placeholder="生成数量"><button onclick="createCodes()">生成激活码</button><div id="created"></div></section>
 <section class="card"><h2>授权统计</h2><div id="stats" class="muted">加载中…</div></section>
 <section class="card"><h2>激活码列表</h2><button class="secondary" onclick="load()">刷新列表</button><div id="list"></div></section></div></main>
 <script>
 let token=sessionStorage.getItem('adminkey')||'';
 async function api(path,method='GET',body){let r=await fetch(path,{method,headers:{'content-type':'application/json','authorization':'Bearer '+token},body:body?JSON.stringify(body):undefined});let d=await r.json();if(!r.ok)throw Error(d.error||'请求失败');return d}
 async function login(){token=document.getElementById('key').value;try{await api('/api/admin/stats');sessionStorage.setItem('adminkey',token);document.getElementById('login').hidden=true;document.getElementById('app').hidden=false;load()}catch(e){document.getElementById('msg').textContent=e.message}}
 async function load(){try{let s=await api('/api/admin/stats');document.getElementById('stats').textContent='激活码总数：'+s.total+'；已激活：'+s.activated+'；永久：'+s.permanent+'；体验：'+s.trial;
 let d=await api('/api/admin/codes');document.getElementById('list').innerHTML=d.codes.map(c=>'<div class="item"><b>'+c.code_hint+'</b> <span class="tag">'+c.product_id+'</span> <span class="tag">'+(c.license_type==='trial'?'1天体验':'永久')+'</span><div class="muted">状态：'+c.status+'；设备：'+(c.device_id||'未激活')+'；创建：'+new Date(c.created_at*1000).toLocaleString()+'</div><button class="secondary" onclick="toggle(\''+c.id+'\',\''+(c.status==='active'?'disabled':'active')+'\')">'+(c.status==='active'?'禁用':'启用')+'</button></div>').join('')||'暂无卡密'}catch(e){alert(e.message)}}
 async function createCodes(){try{let d=await api('/api/admin/codes','POST',{productId:product.value,type:type.value,quantity:Number(qty.value)});created.innerHTML='<b>请立即保存以下卡密（仅生成时完整显示）：</b><pre>'+d.codes.join('\\n')+'</pre>';load()}catch(e){alert(e.message)}}
 async function toggle(id,status){try{await api('/api/admin/codes/'+id,'PATCH',{status});load()}catch(e){alert(e.message)}}
 if(token){document.getElementById('key').value=token;login()}
 </script></html>`;
}
export default {
 async fetch(req, env) {
  const url=new URL(req.url), path=url.pathname, method=req.method;
  if(method==="OPTIONS") return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PATCH,OPTIONS","access-control-allow-headers":"content-type,authorization"}});
  try {
   if(path==="/") return new Response("Car License API is running",{headers:{"content-type":"text/plain"}});
   if(path==="/admin") return new Response(html(),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
   if(path==="/api/health") return json({ok:true,service:"car-license"});
   if(path==="/api/admin/stats" || path==="/api/admin/codes" || path.startsWith("/api/admin/codes/")) {
    if(!await adminOk(req,env)) return json({error:"Unauthorized"},401);
    if(path==="/api/admin/stats" && method==="GET"){
     const r=await env.DB.prepare(`SELECT COUNT(*) total, SUM(device_id IS NOT NULL) activated, SUM(license_type='permanent') permanent, SUM(license_type='trial') trial FROM license_codes`).first();
     return json({total:r.total||0,activated:r.activated||0,permanent:r.permanent||0,trial:r.trial||0});
    }
    if(path==="/api/admin/codes" && method==="GET"){
     const {results}=await env.DB.prepare("SELECT id,code_hint,product_id,license_type,status,device_id,activated_at,expires_at,created_at FROM license_codes ORDER BY created_at DESC LIMIT 300").all();
     return json({codes:results});
    }
    if(path==="/api/admin/codes" && method==="POST"){
     const b=await req.json(), productId=String(b.productId||""), type=b.type, quantity=Math.max(1,Math.min(100,Number(b.quantity)||1));
     const products=(env.PRODUCTS||"APP_A,APP_B").split(",").map(x=>x.trim());
     if(!products.includes(productId)||!["trial","permanent"].includes(type)) return json({error:"Invalid product or type"},400);
     const codes=[];
     for(let i=0;i<quantity;i++){
      const raw=Array.from(crypto.getRandomValues(new Uint8Array(9)),x=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x%32]).join("");
      const code=raw.match(/.{1,4}/g).join("-");
      const id=uuid(), hash=await sha(code);
      await env.DB.prepare("INSERT INTO license_codes(id,code_hash,code_hint,product_id,license_type,created_at) VALUES(?,?,?,?,?,?)").bind(id,hash,code.slice(-4),productId,type,Math.floor(Date.now()/1000)).run();
      codes.push(code);
     }
     return json({codes});
    }
    if(path.startsWith("/api/admin/codes/") && method==="PATCH"){
     const id=path.split("/").pop(), b=await req.json();
     if(!["active","disabled"].includes(b.status)) return json({error:"Invalid status"},400);
     await env.DB.prepare("UPDATE license_codes SET status=? WHERE id=?").bind(b.status,id).run();
     return json({ok:true});
    }
   }
   if(path==="/api/activate" && method==="POST"){
    const b=await req.json(), productId=String(b.productId||""), code=String(b.code||"").toUpperCase().trim(), deviceId=String(b.deviceId||"");
    if(!productId||!code||!deviceId||deviceId.length>256) return json({error:"Missing productId, code or deviceId"},400);
    const row=await env.DB.prepare("SELECT * FROM license_codes WHERE code_hash=? AND product_id=?").bind(await sha(code),productId).first();
    if(!row||row.status!=="active") return json({error:"激活码无效或已禁用"},403);
    const now=Math.floor(Date.now()/1000);
    if(row.device_id && row.device_id!==deviceId) return json({error:"此激活码已绑定其他设备"},409);
    if(row.license_type==="trial"){
      if(!row.activated_at){
       const expires=now+86400;
       await env.DB.prepare("UPDATE license_codes SET device_id=?,activated_at=?,expires_at=? WHERE id=?").bind(deviceId,now,expires,row.id).run();
       await env.DB.prepare("INSERT INTO activation_events VALUES(?,?,?,?,?,?,?)").bind(uuid(),row.id,productId,deviceId,"trial_activated",now,null).run();
       return json({type:"trial",expiresAt:expires,serverTime:now});
      }
      if(row.expires_at<=now) return json({error:"体验已过期",expired:true},403);
      return json({type:"trial",expiresAt:row.expires_at,serverTime:now});
    }
    if(!row.activated_at){
      await env.DB.prepare("UPDATE license_codes SET device_id=?,activated_at=? WHERE id=?").bind(deviceId,now,row.id).run();
      await env.DB.prepare("INSERT INTO activation_events VALUES(?,?,?,?,?,?,?)").bind(uuid(),row.id,productId,deviceId,"permanent_activated",now,null).run();
    }
    const token=await signLicense({iss:"car-license",productId,deviceId,codeId:row.id,type:"permanent",iat:now},env);
    return json({type:"permanent",licenseToken:token});
   }
   if(path==="/api/restore" && method==="POST"){
    const b=await req.json(), productId=String(b.productId||""), code=String(b.code||"").toUpperCase().trim(), deviceId=String(b.deviceId||"");
    if(!productId||!code||!deviceId) return json({error:"Missing fields"},400);
    const row=await env.DB.prepare("SELECT * FROM license_codes WHERE code_hash=? AND product_id=?").bind(await sha(code),productId).first();
    if(!row||row.license_type!=="permanent"||!row.activated_at||row.device_id!==deviceId) return json({error:"无法恢复：卡密未激活或设备不匹配"},403);
    const token=await signLicense({iss:"car-license",productId,deviceId,codeId:row.id,type:"permanent",iat:row.activated_at},env);
    return json({type:"permanent",licenseToken:token});
   }
   if(path==="/api/trial/check" && method==="POST"){
    const b=await req.json(), productId=String(b.productId||""), code=String(b.code||"").toUpperCase().trim(), deviceId=String(b.deviceId||"");
    const row=await env.DB.prepare("SELECT * FROM license_codes WHERE code_hash=? AND product_id=?").bind(await sha(code),productId).first();
    const now=Math.floor(Date.now()/1000);
    if(!row||row.status!=="active"||row.license_type!=="trial"||row.device_id!==deviceId||!row.expires_at||row.expires_at<=now) return json({error:"体验授权无效或已过期",serverTime:now},403);
    return json({ok:true,expiresAt:row.expires_at,serverTime:now});
   }
   return json({error:"Not found"},404);
  } catch(e) { return json({error:e.message||"Internal error"},500); }
 }
};
