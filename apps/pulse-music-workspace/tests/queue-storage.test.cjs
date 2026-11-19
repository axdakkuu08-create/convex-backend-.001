const test=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs"), path=require("node:path"), vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","queue-storage.js"),"utf8");
function localStore(initial={}){const values=new Map(Object.entries(initial));return{getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),values};}
function fakeIDB(options={}){const records=new Map();const db={objectStoreNames:{contains:()=>true},close(){},transaction(){const tx={};const store={get(key){const req={};queueMicrotask(()=>{req.result=records.get(key);req.onsuccess?.();tx.oncomplete?.();});return req;},put(value,key){const req={};queueMicrotask(()=>{if(options.writeFailure){tx.error=new Error("write failed");tx.onerror?.();tx.onabort?.();return;}records.set(key,JSON.parse(JSON.stringify(value)));req.result=key;req.onsuccess?.();tx.oncomplete?.();});return req;}};tx.objectStore=()=>store;return tx;}};return{records,open(){const req={};queueMicrotask(()=>{if(options.openFailure){req.error=new Error("open failed");req.onerror?.();}else{req.result=db;req.onsuccess?.();}});return req;}};}
function instance(indexedDB,localStorage=localStore()){const window={indexedDB,localStorage};vm.runInNewContext(source,{window,Promise,JSON,Error,TypeError});return{storage:window.PulseQueueStorage,localStorage};}
const snapshot=(prefix,ids=[1,2])=>({schemaVersion:2,tracks:ids.map(id=>({id,title:prefix+id,src:"https://audio.example/"+id+".mp3"})),currentTrackId:ids[0]??null,currentIndex:0,repeatOn:false,shuffleOn:false,updatedAt:123});
test("IndexedDB round-trips ordered queue and mirrors recovery copy",async()=>{const x=instance(fakeIDB()),v=snapshot("idb-");assert.equal(await x.storage.save(v),"indexedDB");assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())),v);assert.equal(JSON.parse(x.localStorage.getItem("pulse.playerQueue.v1")).tracks[1].id,2);});
test("localStorage fallback works without IndexedDB",async()=>{const x=instance(null),v=snapshot("fallback-");assert.equal(await x.storage.save(v),"localStorage");assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())),v);});
test("IndexedDB open failure falls back to localStorage",async()=>{const x=instance(fakeIDB({openFailure:true})),v=snapshot("open-");assert.equal(await x.storage.save(v),"localStorage");assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())),v);});
test("IndexedDB transaction failure falls back to localStorage",async()=>{const x=instance(fakeIDB({writeFailure:true})),v=snapshot("write-");assert.equal(await x.storage.save(v),"localStorage");assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())),v);});
test("localStorage recovery copy migrates into empty IndexedDB",async()=>{const v=snapshot("legacy-"),idb=fakeIDB(),x=instance(idb,localStore({"pulse.playerQueue.v1":JSON.stringify(v)}));assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())),v);assert.deepEqual(JSON.parse(JSON.stringify(idb.records.get("queue"))),v);});
test("overlapping saves serialize and retain latest queue",async()=>{const x=instance(fakeIDB()),a=snapshot("a-",[1]),b=snapshot("b-",[7,8,9]);await Promise.all([x.storage.save(a),x.storage.save(b)]);assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())),b);});
test("corrupt localStorage recovery data is ignored",async()=>{const x=instance(null,localStore({"pulse.playerQueue.v1":"{broken"}));assert.equal(await x.storage.load(),null);});

test("reload restoration removes invalid tracks and preserves current track by ID", () => {
  const x = instance(null);
  const input = { ...snapshot("restore-", [10, 11, 12]), currentTrackId: 12, currentIndex: 2 };
  input.tracks[1].src = "javascript:alert(1)";
  const normalized = x.storage.normalizeSnapshot(input, (track) => /^https?:\/\//i.test(track.src));
  assert.deepEqual(Array.from(normalized.tracks, (track) => track.id), [10, 12]);
  assert.equal(normalized.currentTrackId, 12);
  assert.equal(normalized.currentIndex, 1);
});
