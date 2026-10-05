'use strict';
// Short-lived voice practice: microphone audio stays in browser memory.
window.createMicrophonePractice=function({button,status,playback,container,beforeStart=()=>{},onRecordingStarted=()=>{},onRecordingReady=()=>{}}){
  let stream=null,recorder=null,url=null,timer=null,token=0,disposed=false,pending=false;
  const stopTracks=()=>{stream?.getTracks().forEach(track=>track.stop());stream=null;};
  function setIdle(){button.disabled=false;button.textContent='● Record my voice';button.setAttribute('aria-pressed','false');container.classList.remove('recording');}
  function clearClip(){playback.pause();playback.removeAttribute('src');playback.load();playback.hidden=true;if(url){URL.revokeObjectURL(url);url=null;}}
  function stop(){clearTimeout(timer);timer=null;if(pending){token++;pending=false;setIdle();status.textContent='Tap Record my voice when you are ready.';}if(recorder?.state==='recording'){button.disabled=true;button.textContent='Getting your voice ready…';recorder.stop();}stopTracks();}
  async function start(){
    if(disposed||pending)return;
    if(recorder?.state==='recording'){stop();return;}
    beforeStart();
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status.textContent='This browser cannot record your voice. Open this app in Chrome, Edge, or Safari and allow the microphone.';return;}
    clearClip();onRecordingStarted();pending=true;const request=++token;
    button.disabled=true;button.textContent='Allow microphone…';status.textContent='Ask a grown-up to choose Allow in the microphone prompt.';
    try{
      const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(disposed||request!==token){acquired.getTracks().forEach(track=>track.stop());return;}
      stream=acquired;
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported?.(type));
      const active=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);recorder=active;const chunks=[];
      active.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      active.onerror=()=>{if(disposed||request!==token)return;status.textContent='Recording stopped unexpectedly. Tap Record my voice to try again.';stop();setIdle();};
      active.onstop=()=>{
        stopTracks();if(disposed||request!==token)return;
        const clip=new Blob(chunks,{type:active.mimeType||chunks[0]?.type||'audio/webm'});recorder=null;setIdle();
        if(!clip.size){status.textContent='No audio was captured. Tap Record my voice and try again.';return;}
        url=URL.createObjectURL(clip);playback.src=url;playback.hidden=false;
        status.textContent='Your voice is ready! Press play below, then listen to the Marathi word and try again.';
        onRecordingReady(clip);
      };
      active.start();pending=false;button.disabled=false;button.textContent='■ Stop recording';button.setAttribute('aria-pressed','true');container.classList.add('recording');
      status.textContent='Microphone is on. Say the word, then tap Stop recording. Stops automatically after 10 seconds.';
      timer=setTimeout(stop,10000);
    }catch(error){
      stopTracks();if(disposed||request!==token)return;
      const messages={NotAllowedError:'Microphone access was blocked. Ask a grown-up to allow the microphone in the browser’s site settings, then try again.',PermissionDeniedError:'Please allow microphone access in your browser’s site settings, then try again.',NotFoundError:'No microphone was found. Connect a microphone and try again.',NotReadableError:'Your microphone is busy. Close other apps using it and try again.',SecurityError:'Microphone access is restricted in this browser. Open the app in a regular browser tab.'};
      status.textContent=messages[error.name]||'The microphone could not start. Check your microphone and tap Record my voice again.';setIdle();
    }finally{if(request===token)pending=false;}
  }
  function dispose(){if(disposed)return;disposed=true;token++;pending=false;clearTimeout(timer);timer=null;if(recorder){recorder.onstop=null;recorder.ondataavailable=null;recorder.onerror=null;if(recorder.state!=='inactive')recorder.stop();recorder=null;}stopTracks();clearClip();setIdle();}
  button.onclick=start;
  playback.onplay=()=>{document.getElementById('pronunciation-player')?.pause();};
  return {start,stop,dispose};
};
