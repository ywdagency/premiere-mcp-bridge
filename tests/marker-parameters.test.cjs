const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),{tmpdir}=require('node:os'),{join}=require('node:path'),{randomUUID}=require('node:crypto');
const {parametersFor,API_CONTRACTS,createDispatcher}=require('../build/lib/runtime.cjs');
test('sparse marker arguments reject before MCP transport or native argument resolution',async t=>{
 const {FileBridge}=await import('../mcp/file-bridge.mjs');const dir=await fs.mkdtemp(join(tmpdir(),'marker-prefix-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const args={projectId:'fixture',operationId:randomUUID(),actions:[{memberId:'Markers#createAddMarkerAction',target:'fixture-marker-owner',parameters:{name:'Fixture',startTime:{$ref:'time'},comments:'Fixture'}}]};
 await assert.rejects(new FileBridge(dir).call('api_apply_actions',args),{code:'INVALID_API_ARGUMENT'});assert.deepEqual(await fs.readdir(dir),[]);
 const dispatch=createDispatcher({name:'premierepro',version:'26.5.0',uxpVersion:'test',getActiveProject(){assert.fail('No native project access');}});
 await assert.rejects(dispatch({command:'api_apply_actions',args}),{code:'INVALID_API_ARGUMENT'});
 const member=API_CONTRACTS.classes.find(x=>x.name==='Markers').members.find(x=>x.id===args.actions[0].memberId);
 const resolver={handle(){assert.fail('Sparse arguments must reject before resolving handles');},constant(){assert.fail('No enum needed');}};
 assert.throws(()=>parametersFor(member,args.actions[0].parameters,resolver),{code:'INVALID_API_ARGUMENT'});
 assert.deepEqual(parametersFor(member,{name:'Trailing defaults'},resolver),['Trailing defaults']);
 const values=parametersFor(member,{name:'Complete',markerType:'Comment',startTime:{$ref:'time'},duration:{$ref:'zero'},comments:'Fixture'},{handle:id=>({native:id,types:['TickTime']}),constant(){}});
 assert.deepEqual(values,['Complete','Comment','time','zero','Fixture']);
});

test('tightened marker validation still replays matching historical receipts without host execution',async t=>{
 const {FileBridge,prepareBridge}=await import('../mcp/file-bridge.mjs');const dir=await fs.mkdtemp(join(tmpdir(),'marker-history-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const {marker}=await prepareBridge(dir),operationId=randomUUID();const args={projectId:'fixture',operationId,actions:[{memberId:'Markers#createAddMarkerAction',target:'old-owner',parameters:{name:'Historical',startTime:{$ref:'old-time'}}}]};
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 const path=join(dir,'operation-'+operationId+'.json');const receipt={version:1,bridgeId:marker.bridgeId,operationId,payload:JSON.stringify({command:'api_apply_actions',args:stable(args)}),state:'completed',outcome:{ok:true,result:{readOnly:false,operationId,applied:1,saved:false}}};
 await fs.writeFile(path,JSON.stringify(receipt),{mode:0o600});const bridge=new FileBridge(dir,{timeoutMs:100});
 assert.equal((await bridge.call('api_apply_actions',args)).operationReplayed,true);
 const {Client,InMemoryTransport}=await import('@modelcontextprotocol/client');
 const {createServer}=await import('../mcp/server.mjs');const server=createServer(bridge),client=new Client({name:'legacy-marker-test',version:'1'});
 const[a,b]=InMemoryTransport.createLinkedPair();await server.connect(b);await client.connect(a);t.after(async()=>{await client.close();await server.close();});
 const replayed=await client.callTool({name:'premiere_api_apply_actions',arguments:args});assert.equal(replayed.isError,undefined);assert.equal(replayed.structuredContent.operationReplayed,true);
 await assert.rejects(bridge.call('api_apply_actions',{...args,actions:[{...args.actions[0],parameters:{...args.actions[0].parameters,name:'Changed'}}]}),{code:'OPERATION_ID_CONFLICT'});
 receipt.outcome={ok:false,error:{code:'OPERATION_OUTCOME_UNKNOWN',message:'Historical uncertain outcome'}};await fs.writeFile(path,JSON.stringify(receipt));
 await assert.rejects(bridge.call('api_apply_actions',args),e=>e.code==='OPERATION_OUTCOME_UNKNOWN'&&e.message==='Historical uncertain outcome');
 receipt.state='started';delete receipt.outcome;await fs.writeFile(path,JSON.stringify(receipt));await assert.rejects(bridge.call('api_apply_actions',args),{code:'OPERATION_OUTCOME_UNKNOWN'});
 assert.equal((await fs.readdir(dir)).some(n=>n.startsWith('request-')),false);
});
