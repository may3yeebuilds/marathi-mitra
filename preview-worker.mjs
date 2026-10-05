import http from 'node:http';
import {Readable} from 'node:stream';
import worker from './dist/server/index.js';
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:4173');
    const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-preview-user');
    if(req.method==='POST')headers.set('origin','https://marathi-mitra-learning.mai3yee.chatgpt.site');
    const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
    const result=await worker.fetch(request,{});res.writeHead(result.status,Object.fromEntries(result.headers));
    if(result.body)Readable.fromWeb(result.body).pipe(res);else res.end();
  }catch{res.writeHead(500);res.end('Preview error');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
