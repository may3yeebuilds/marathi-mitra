const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function harness(getMedia){
  const tracks=[{stopped:false,stop(){this.stopped=true;}}], stream={getTracks:()=>tracks};
  let active,timeout,revoked=[],paused=0;
  class Recorder {
    static isTypeSupported(type){return type.includes('webm');}
    constructor(s,options){this.stream=s;this.mimeType=options.mimeType;this.state='inactive';active=this;}
    start(){this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['sample audio'],{type:this.mimeType})});this.onstop?.();}
  }
  const button={disabled:false,textContent:'Record',setAttribute(k,v){this[k]=v;}},status={textContent:''};
  const playback={hidden:true,src:'',pause(){paused++;},removeAttribute(){this.src='';},load(){}},container={classList:{add(){},remove(){}}};
  const timers=new Map();let id=0;
  const context=vm.createContext({window:{MediaRecorder:Recorder},MediaRecorder:Recorder,navigator:{mediaDevices:{getUserMedia:async options=>{assert.equal(options.video,false);return getMedia?getMedia(stream):stream;}}},document:{getElementById:()=>({pause(){}})},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:url=>revoked.push(url)},Blob,setTimeout:fn=>{timeout=fn;timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync('dist/microphone.js','utf8'),context);
  const mic=context.window.createMicrophonePractice({button,status,playback,container});
  return {mic,button,status,playback,tracks,revoked,get active(){return active;},get timeout(){return timeout;},timers};
}
(async()=>{
  const h=harness();await h.mic.start();assert.equal(h.active.state,'recording');assert.equal(h.button.textContent,'■ Stop recording');
  h.mic.stop();assert.ok(h.tracks[0].stopped);assert.equal(h.playback.src,'blob:test');assert.equal(h.playback.hidden,false);assert.equal(h.button.textContent,'● Record my voice');
  h.mic.dispose();assert.equal(h.playback.hidden,true);assert.deepEqual(h.revoked,['blob:test']);assert.equal(h.timers.size,0);
  const a=harness();await a.mic.start();a.timeout();assert.equal(a.active.state,'inactive');assert.ok(a.tracks[0].stopped);
  const denied=harness(()=>Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'})));await denied.mic.start();assert.match(denied.status.textContent,/site settings/);assert.equal(denied.button.disabled,false);
  const missing=harness(()=>Promise.reject(Object.assign(new Error(),{name:'NotFoundError'})));await missing.mic.start();assert.match(missing.status.textContent,/No microphone/);
  let resolve;const late=harness(s=>new Promise(r=>resolve=()=>r(s)));const pending=late.mic.start();await Promise.resolve();late.mic.dispose();resolve();await pending;assert.ok(late.tracks[0].stopped);assert.equal(late.active,undefined);
  const during=harness();await during.mic.start();during.mic.dispose();assert.ok(during.tracks[0].stopped);assert.equal(during.playback.src,'');
  const noAPI=harness();noAPI.mic.dispose();
  console.log('Microphone recording, replay clip, auto-stop, permission errors, and cleanup passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
