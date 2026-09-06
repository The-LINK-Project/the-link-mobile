import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Db } from "mongodb";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { profile } from "../src/users.js";

test("database target is fixed even if a web DB name is present", () => {
  assert.equal(readConfig({MOBILE_MONGODB_URI:"mongodb://localhost",CLERK_PUBLISHABLE_KEY:"pk_test_example",CLERK_SECRET_KEY:"sk_test_example",MONGODB_DB:"Users"}).dbName,"link_mobile");
  assert.throws(()=>readConfig({MOBILE_MONGODB_URI:"mongodb://localhost",CLERK_PUBLISHABLE_KEY:"pk_test_example",CLERK_SECRET_KEY:"sk_live_example"}), /same environment/);
});
test("profile selects primary email and never stores passwords or Clerk metadata",()=>{
  const result=profile({id:"user_test",username:null,firstName:null,lastName:null,imageUrl:"",primaryEmailAddressId:"primary",emailAddresses:[{id:"other",emailAddress:"other@example.com"},{id:"primary",emailAddress:"primary@example.com"}]});
  assert.equal(result.email,"primary@example.com");
  assert.deepEqual(Object.keys(result).sort(),["clerkId","email","firstName","lastName","photo","username"]);
});
test("protected routes reject missing/invalid tokens before touching MongoDB",async()=>{
  let reads=0;
  const app=createApp({db:async()=>{reads++;throw new Error("must not connect")},authenticate:async()=>{throw new Error("invalid token")}});
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const url="http://127.0.0.1:"+(server.address() as AddressInfo).port;
  try{
    for(const method of ["GET","DELETE"]){
      assert.equal((await fetch(url+"/v1/me",{method})).status,401);
      assert.equal((await fetch(url+"/v1/me",{method,headers:{Authorization:"Bearer bad"}})).status,401);
    }
    assert.equal(reads,0);
    assert.equal((await fetch(url+"/health")).status,200);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test("webhook rejects unsigned input and does not create mobile profiles for web-only users",async()=>{
  let writes=0;
  const db={collection:()=>({findOne:async()=>null,updateOne:async()=>{writes++;}})} as unknown as Db;
  const app=createApp({db:async()=>db,verifyEvent:(body,headers)=>{if(headers["svix-signature"]!=="valid")throw Error("bad");return JSON.parse(body)}});
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const url="http://127.0.0.1:"+(server.address() as AddressInfo).port;
  try{
    assert.equal((await fetch(url+"/webhooks/clerk",{method:"POST",body:"{}"})).status,400);
    const res=await fetch(url+"/webhooks/clerk",{method:"POST",headers:{"svix-signature":"valid"},body:JSON.stringify({type:"user.created",data:{id:"web_only"}})});
    assert.equal(res.status,200);assert.equal(writes,0);
    const deleted=await fetch(url+"/webhooks/clerk",{method:"POST",headers:{"svix-signature":"valid"},body:JSON.stringify({type:"user.deleted",data:{id:"web_only"}})});
    assert.equal(deleted.status,200);assert.equal(writes,0);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
