const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","playlist-playback.js"),"utf8"),events=[];
class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}}
const window={dispatchEvent:event=>events.push(event)};
vm.runInNewContext(source,{window,CustomEvent,Math:Object.assign(Object.create(Math),{random:()=>0})});
const playback=window.PulsePlaylistPlayback;
test("empty playlists do not start or emit playback events",()=>{assert.equal(playback.start({name:"Empty",tracks:[]}),false);assert.equal(events.length,0);assert.equal(playback.nextIndex(0,0),null);});
test("one-track playlist starts and only repeats when repeat-all is enabled",()=>{assert.equal(playback.start({name:"Single",tracks:[{title:"Only",src:"https://audio.example/only.mp3"}]}),true);assert.equal(events.at(-1).detail.tracks.length,1);assert.equal(playback.nextIndex(0,1),null);assert.equal(playback.nextIndex(0,1,{repeat:true}),0);});
test("multi-track playlist retains saved order and advances through every item",()=>{const items=["A","B","C"].map(title=>({title,src:"https://audio.example/"+title+".mp3"}));assert.equal(playback.start({name:"Ordered",tracks:items}),true);assert.deepEqual(Array.from(events.at(-1).detail.tracks,item=>item.title),["A","B","C"]);assert.deepEqual([playback.nextIndex(0,3),playback.nextIndex(1,3),playback.nextIndex(2,3)],[1,2,null]);});
test("unsafe tracks are excluded without changing playable relative order",()=>{const q=playback.buildQueue({tracks:[{title:"first",src:"https://audio.example/1.mp3"},{title:"unsafe",src:"javascript:alert(1)"},{title:"second",src:"blob:https://pulse.example/local"},{title:"third",src:"https://audio.example/3.mp3"}]});assert.deepEqual(Array.from(q,item=>item.title),["first","second","third"]);});
test("invalid current indices never advance and repeat wraps only at the end",()=>{assert.equal(playback.nextIndex(-1,2,{repeat:true}),null);assert.equal(playback.nextIndex(2,2,{repeat:true}),null);assert.equal(playback.nextIndex(1,2,{repeat:true}),0);});
test("shuffle never selects the current track when more than one track exists",()=>{assert.equal(playback.nextIndex(0,3,{shuffle:true}),1);assert.equal(playback.nextIndex(2,3,{shuffle:true}),0);});
