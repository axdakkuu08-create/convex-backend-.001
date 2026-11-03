import test from "node:test";
import assert from "node:assert/strict";
import {handleSearch,dedupeTracks,normalizeTrack,cacheKey} from "../src/index.js";

const archive=(overrides={})=>normalizeTrack({provider:"archive",providerId:"a1",title:"Same Song",artist:"Same Artist",streamUrl:"https://archive.org/file.mp3",verificationStatus:"VERIFYING",...overrides});

test("Archive URL availability does not imply playback verification or rights clearance",()=>{
 const t=archive({license:"https://creativecommons.org/publicdomain/zero/1.0/"});
 assert.equal(t.verificationStatus,"VERIFYING");
 assert.equal(t.rightsReviewStatus,"REVIEW_REQUIRED");
});
test("iTunes preview and missing preview map to required states",()=>{
 assert.equal(normalizeTrack({provider:"itunes",providerId:1,title:"Preview",previewUrl:"https://x.test/p.m4a"}).verificationStatus,"PREVIEW_ONLY");
 assert.equal(normalizeTrack({provider:"itunes",providerId:2,title:"No preview"}).verificationStatus,"UNAVAILABLE");
});
test("cross-provider duplicates collapse and prefer the Archive stream candidate",()=>{
 const a=archive(), i=normalizeTrack({provider:"itunes",providerId:9,title:"same song",artist:"SAME ARTIST",previewUrl:"https://x.test/p.m4a"});
 assert.equal(dedupeTracks([a,i]).length,1);
 assert.equal(dedupeTracks([a,i])[0].provider,"archive");
});
test("KV cache hit avoids repeat provider requests",async()=>{
 let calls=0; const store=new Map();
 const env={CATALOG_CACHE:{async get(k){return store.get(k)||null;},async put(k,v){store.set(k,JSON.parse(v));}}};
 const fetcher=async()=>{calls++;return new Response(JSON.stringify({results:[]}),{status:200});};
 const req=new Request("https://worker.test/api/search?q=ambient&country=IN");
 const first=await handleSearch(req,env,fetcher), second=await handleSearch(req,env,fetcher);
 assert.equal((await first.json()).cache,"MISS");
 assert.equal((await second.json()).cache,"HIT");
 assert.equal(calls,2);
});
test("provider failure is isolated and partial response survives",async()=>{
 const fetcher=async url=>{
  if(String(url).includes("itunes.apple.com")) throw new Error("iTunes offline");
  return new Response(JSON.stringify({response:{docs:[]}}),{status:200});
 };
 const body=await (await handleSearch(new Request("https://worker.test/api/search?q=jazz"),{},fetcher)).json();
 assert.equal(body.providerStatus.itunes,"unavailable");
 assert.equal(body.providerStatus.archive,"ok");
 assert.equal(body.partial,true);
});
test("short queries are rejected before provider calls",async()=>{
 const r=await handleSearch(new Request("https://worker.test/api/search?q=x"),{},async()=>{throw Error("unexpected");});
 assert.equal(r.status,400);
});
test("cache key varies by provider and region",()=>{
 const base={query:"jazz",country:"IN",genre:"",limit:18};
 assert.notEqual(cacheKey(base),cacheKey({...base,country:"US"}));
 assert.notEqual(cacheKey(base),cacheKey({...base,provider:"archive"}));
});
