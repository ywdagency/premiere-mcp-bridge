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
