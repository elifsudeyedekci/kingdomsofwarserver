const API='http://localhost:3001';
async function call(p,t){const r=await fetch(API+p,{headers:{authorization:'Bearer '+t}});const x=await r.text();let j;try{j=JSON.parse(x)}catch{j=x}return {s:r.status,j};}
const shape=(v,d=0)=>{if(Array.isArray(v))return `[${v.length}]`+(v[0]&&typeof v[0]==='object'?'{'+Object.keys(v[0]).slice(0,8).join(',')+'}':'');if(v&&typeof v==='object'){return '{'+Object.entries(v).slice(0,10).map(([k,x])=>k+':'+(d<1?shape(x,d+1):typeof x)).join(', ')+'}';}return typeof v;};
(async()=>{
 const l=await (await fetch(API+'/admin-auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})})).json();
 for(const p of process.argv.slice(2)){const r=await call(p,l.accessToken);console.log(String(r.s).padEnd(4),p.padEnd(52),r.s<300?shape(r.j):JSON.stringify(r.j).slice(0,110));}
})();
