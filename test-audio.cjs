const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('dist/app.js', 'utf8');
const audioMap = vm.runInNewContext(fs.readFileSync('dist/audio-map.js', 'utf8') + ';pronunciationAudio');
const words = vm.runInNewContext(source.slice(0, source.indexOf('const storageKey')) + ';lessons.flatMap(l=>l.items.map(w=>w[0]))');
assert.equal(words.length, 18);
for (const word of words) {
  assert.ok(audioMap[word], `Missing mapping for ${word}`);
  const bytes = fs.readFileSync('dist/' + audioMap[word]);
  assert.ok(bytes.length > 1000, `Missing audio for ${word}`);
  assert.ok(bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 0xff, 'Expected MP3 data');
}
let rejectPlay = false;
const player = { pause() { this.paused = true; }, play() { this.paused = false; return rejectPlay ? Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })) : Promise.resolve(); }, addEventListener() {} };
const button = { tagName: 'BUTTON', textContent: 'Listen', attributes: {}, setAttribute(k,v) {this.attributes[k]=v;}, removeAttribute(k) {delete this.attributes[k];} };
const messages = [];
const context = vm.createContext({document:{getElementById:()=>player,activeElement:button,baseURI:'https://example.test/'},pronunciationAudio:audioMap,stopRecognition(){},toast:m=>messages.push(m),URL});
vm.runInContext(source.slice(source.indexOf('const pronunciationPlayer='),source.indexOf('function stopRecognition()')),context);
(async()=>{
  await vm.runInContext("say('नमस्कार')",context);
  assert.equal(player.src,'https://example.test/audio/word-13.mp3');
  assert.equal(player.paused,false);
  assert.equal(button.textContent,'♫ Playing…');
  await vm.runInContext("say('ई')",context);
  assert.equal(player.src,'https://example.test/audio/word-4.mp3');
  vm.runInContext('stopPronunciation()',context);
  assert.equal(player.paused,true);
  assert.equal(button.textContent,'Listen');
  rejectPlay=true;
  await vm.runInContext("say('आई')",context);
  assert.equal(button.textContent,'Listen');
  assert.match(messages.pop(),/Tap Listen again/);
  await vm.runInContext("say('unknown')",context);
  assert.match(messages.pop(),/not available/);
  console.log('18 audio assets verified; playback, switching, stop, and error handling passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
