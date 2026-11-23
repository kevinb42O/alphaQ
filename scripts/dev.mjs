import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {watch} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const port=Number(portIndex>=0?args[portIndex+1]:process.env.PORT||5173);
const hostIndex=args.indexOf('--host');
const host=hostIndex>=0?(args[hostIndex+1]||'0.0.0.0'):'127.0.0.1';
const preview=args.includes('--preview');
const clients=new Set();
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  let pathname,search;
  try{const url=new URL(req.url,'http://localhost');pathname=decodeURIComponent(url.pathname);search=url.search;}catch{res.writeHead(400).end('Bad request');return;}
  if(pathname==='/admin'){res.writeHead(308,{Location:'/admin/'+search}).end();return;}
  if(pathname==='/api/license'){
    res.writeHead(501,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify({
      ok:false,message:'This local preview has no login service. Open aqxmenu.vercel.app/admin/ to sign in.'
    }));
    return;
  }
  if(pathname==='/__dev_events'&&!preview){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
  let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
  try{
    let info=await stat(file);if(info.isDirectory()){file=path.join(file,'index.html');info=await stat(file);}if(!info.isFile())throw new Error('Not a file');
    let bytes=await readFile(file);
    if(!preview&&path.extname(file)==='.html')bytes=Buffer.from(bytes.toString().replace('</body>',`<script>new EventSource('/__dev_events').onmessage=()=>location.reload();</script></body>`));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
});
let timer;
const watcher=preview?null:watch(root,{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(()=>{for(const client of clients)client.write('data: reload\n\n');},100);});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Try npm run dev -- --port ${port+1}`:error.message);process.exitCode=1;watcher?.close();});
server.listen(port,host,()=>console.log(`\n  AQx website\n  Local: http://${host}:${port}/\n  ${preview?'Preview mode':'Auto-refresh enabled. Edit files in dist/.'}\n`));
function shutdown(){watcher?.close();for(const client of clients)client.end();server.close();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
