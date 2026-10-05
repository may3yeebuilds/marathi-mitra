'use strict';
window.PRONUNCIATION_PASS_SCORE=5;
window.isPassingPronunciation=score=>Number.isInteger(score)&&score>=window.PRONUNCIATION_PASS_SCORE&&score<=10;
window.createPronunciationAssessment=function({button,result,continueButton,target,onPass=()=>{},onReset=()=>{}}){
  let clip=null,controller=null,disposed=false,version=0,passed=false;
  function reset(){version++;controller?.abort();controller=null;clip=null;passed=false;onReset();button.disabled=true;continueButton.disabled=true;button.textContent='Check my pronunciation';result.className='pronunciation-result';result.textContent='Record yourself, then check your pronunciation. Get 5/10 or higher to continue.';}
  async function pcmWav(blob){
    const API=window.AudioContext||window.webkitAudioContext;if(!API)throw new Error('This browser cannot prepare audio for scoring. Try Chrome, Edge, or Safari.');
    const context=new API();let decoded;
    try{decoded=await context.decodeAudioData(await blob.arrayBuffer());}finally{await context.close();}
    if(decoded.duration<.2||decoded.duration>10.5)throw new Error('Record the word clearly, for up to 10 seconds.');
    const render=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=render.createBufferSource();source.buffer=decoded;source.connect(render.destination);source.start();
    const samples=(await render.startRendering()).getChannelData(0),buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
    const text=(o,s)=>{for(let j=0;j<s.length;j++)view.setUint8(o+j,s.charCodeAt(j));};
    text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
    for(let j=0;j<samples.length;j++){const sample=Math.max(-1,Math.min(1,samples[j]));view.setInt16(44+j*2,sample<0?sample*32768:sample*32767,true);}
    return buffer;
  }
  async function check(){
    if(disposed||!clip||controller)return;
    const current=version;controller=new AbortController();const active=controller;button.disabled=true;continueButton.disabled=true;passed=false;onReset();button.textContent='Listening to your pronunciation…';result.textContent='Your pronunciation coach is listening. Just a moment…';
    const timeout=setTimeout(()=>active.abort(),55000);
    try{
      const wav=await pcmWav(clip);if(disposed||version!==current)return;
      const response=await fetch('/api/assess-pronunciation?target='+encodeURIComponent(target),{method:'POST',headers:{'Content-Type':'audio/wav'},body:wav,signal:active.signal});
      const data=await response.json();if(disposed||version!==current)return;
      if(!response.ok){const error=new Error(data.error||'Scoring is unavailable. Try again.');error.code=data.code;throw error;}
      if(!Number.isInteger(data.score)||data.score<0||data.score>10||typeof data.feedback!=='string'||data.passScore!==window.PRONUNCIATION_PASS_SCORE||data.passed!==window.isPassingPronunciation(data.score))throw new Error('The score could not be verified. Please try again.');
      passed=window.isPassingPronunciation(data.score);
      result.replaceChildren();const number=document.createElement('strong');number.className='pronunciation-number';number.textContent=data.score+' / 10';result.append(number);
      const feedback=document.createElement('p');feedback.textContent=data.feedback;result.append(feedback);
      const instruction=document.createElement('p');instruction.textContent=passed?'Lovely practice! You can continue to the next step.':'Let’s practise again. Listen to the word, then record another try. Your next step stays locked.';result.append(instruction);
      result.className='pronunciation-result '+(passed?'passing':'retry');continueButton.disabled=!passed;if(passed)onPass(data.score);
    }catch(error){if(disposed||version!==current)return;result.className='pronunciation-result retry';result.textContent=error.name==='AbortError'?'Scoring took too long. Please try again. Your next step stays locked.':error.message;if(error.code==='billing_required'){const link=document.createElement('a');link.href='https://platform.openai.com/settings/organization/billing/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open API billing (grown-ups)';result.append(document.createElement('br'),link);}continueButton.disabled=true;}
    finally{clearTimeout(timeout);if(!disposed&&version===current){controller=null;button.disabled=false;button.textContent=passed?'Check again':'Check my pronunciation';}}
  }
  button.onclick=check;reset();
  fetch('/api/scoring-status').then(r=>r.ok?r.json():null).then(data=>{if(!disposed&&!clip&&data?.available===false)result.textContent='A grown-up needs to connect the pronunciation coach. You can listen and record, but the next step stays locked until a score is available.';}).catch(()=>{});
  return {recordingStarted:reset,recordingReady(blob){if(disposed)return;clip=blob;button.disabled=false;result.textContent='Your voice is ready. Tap Check my pronunciation to get your score.';},canContinue:()=>passed,dispose(){disposed=true;version++;controller?.abort();controller=null;clip=null;}};
};
