const test = require('node:test');
const assert = require('node:assert/strict');

test('Windows installer resolves fixed Adobe locations and uses /install with separate literal arguments', async () => {
  const {installerCandidates,installReviewedPackage,MAC_UPIA} = await import('../scripts/install-platform.mjs');
  const env = {CommonProgramW6432:'D:\\Program Files\\Common Files',
    CommonProgramFiles:'d:\\program files\\common files', 'CommonProgramFiles(x86)':'D:\\Program Files (x86)\\Common Files'};
  const candidates = installerCandidates({platform:'win32',env});
  assert.equal(candidates.length,2);
  assert.equal(candidates[0], 'D:\\Program Files\\Common Files\\Adobe\\Adobe Desktop Common\\RemoteComponents\\UPI\\UnifiedPluginInstallerAgent\\UnifiedPluginInstallerAgent.exe');
  assert.deepEqual(installerCandidates({platform:'darwin',env:{}}),[MAC_UPIA]);
  const calls = [], snapshot='C:\\Users\\Test User\\Temp\\reviewed & safe.ccx';
  await installReviewedPackage(snapshot, {platform:'win32',env,
    inspect:async p => { if(p===candidates[0]) throw Object.assign(new Error(),{code:'ENOENT'});
      return {isFile:()=>true,isSymbolicLink:()=>false}; },
    accessible:async () => {}, execute:(...args)=>calls.push(args)});
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],candidates[1]);
  assert.deepEqual(calls[0][1],['/install',snapshot]);
  assert.equal(calls[0][2].shell,false);
  assert.equal(calls[0][2].timeout,120000);
});

test('macOS installation retains the documented command and does not consult Windows locations', async () => {
  const {installReviewedPackage,MAC_UPIA}=await import('../scripts/install-platform.mjs');
  const calls=[];
  await installReviewedPackage('/private fixture/reviewed.ccx',{platform:'darwin',env:{},
    inspect:async path=>{assert.equal(path,MAC_UPIA);return {isFile:()=>true,isSymbolicLink:()=>false};},
    accessible:async()=>{},execute:(...args)=>calls.push(args)});
  assert.equal(calls[0][0],MAC_UPIA);
  assert.deepEqual(calls[0][1],['--install','/private fixture/reviewed.ccx']);
  assert.equal(calls[0][2].shell,false);
});

test('missing, linked or failing installers never trigger fallback shell or another installation attempt', async () => {
  const {installerCandidates,installReviewedPackage} = await import('../scripts/install-platform.mjs');
  for (const env of [{},{CommonProgramFiles:'relative/path'},{CommonProgramFiles:'C:relative'}, {CommonProgramFiles:'\\\\.\\pipe\\Adobe'}])
    assert.throws(()=>installerCandidates({platform:'win32',env}),/Installer/);
  assert.throws(()=>installerCandidates({platform:'linux',env:{}}),/macOS and Windows/);
  const env={commonprogramfiles:'C:\\Program Files\\Common Files'};
  let calls=0;
  await assert.rejects(installReviewedPackage('reviewed.ccx',{platform:'win32',env,
    inspect:async()=>({isFile:()=>false,isSymbolicLink:()=>true}),execute:()=>calls++}),/find an executable/);
  assert.equal(calls,0);
  await assert.rejects(installReviewedPackage('reviewed.ccx',{platform:'win32',env,
    inspect:async()=>({isFile:()=>true,isSymbolicLink:()=>false}),accessible:async()=>{},
    execute:()=>{calls++;throw new Error('Adobe rejected installation');}}),/Adobe rejected/);
  assert.equal(calls,1);
});

test('automatic Windows discovery uses qualified per-user APPDATA including spaces/Unicode and refuses guesses', async () => {
  const {defaultStorageRoot} = await import('../mcp/discovery.mjs');
  assert.equal(defaultStorageRoot({platform:'win32',env:{AppData:'C:\\Users\\Zoë User\\AppData\\Roaming'}}),
    'C:\\Users\\Zoë User\\AppData\\Roaming\\Adobe\\UXP\\PluginsStorage\\PPRO');
  assert.equal(defaultStorageRoot({platform:'win32',env:{APPDATA:'\\\\server\\profile\\Roaming'}}),
    '\\\\server\\profile\\Roaming\\Adobe\\UXP\\PluginsStorage\\PPRO');
  for (const env of [{},{APPDATA:'C:relative'},{APPDATA:'\\current-drive'},{APPDATA:'\\\\?\\C:\\device'}])
    assert.throws(()=>defaultStorageRoot({platform:'win32',env}),{code:'AUTO_DISCOVERY_UNSUPPORTED'});
  assert.equal(defaultStorageRoot({platform:'darwin',home:'/test/user',env:{}}),
    '/test/user/Library/Application Support/Adobe/UXP/PluginsStorage/PPRO');
});

test('Windows relative paths reject device names, ADS and normalization aliases without broadening POSIX paths', async () => {
  const {validGrantedRelativePath} = await import('../mcp/platform-paths.mjs');
  const valid=p=>validGrantedRelativePath(p,'write','win32');
  for (const value of ['NUL','con.txt','CON .txt','folder/LPT1.mov','COM¹.txt','CONOUT$','file.txt:stream','a/.. /out.png',
    'a./out.png','a /out.png','bad?.txt','folder\\clip.mov','C:/file.txt','/absolute','../out.png','a\0b'])
    assert.equal(valid(value),false,value);
  for (const value of ['media/Zoë 日本.mov','.hidden/file.txt','COM10.txt']) assert.equal(valid(value),true,value);
  assert.equal(validGrantedRelativePath('.','directory','win32'),true);
  assert.equal(validGrantedRelativePath('NUL','read','darwin'),true);
  assert.equal(validGrantedRelativePath('../file','read','darwin'),false);
});

test('Windows agent configuration round-trips backslashes and spaces as direct executable arguments', async () => {
  const {clientConfig} = await import('../scripts/setup.mjs');
  const options={nodePath:'C:\\Program Files\\nodejs\\node.exe',serverPath:'C:\\Users\\Zoë User\\bridge\\mcp\\server.mjs',directory:'auto',readOnly:true};
  const codex=clientConfig('codex',options);
  assert.equal(JSON.parse(/^command = (.*)$/m.exec(codex)[1]),options.nodePath);
  assert.deepEqual(JSON.parse(/^args = (.*)$/m.exec(codex)[1]),[options.serverPath]);
  for (const client of ['claude','cursor','json','vscode']) {
    const json=JSON.parse(clientConfig(client,options));
    const spec=client==='vscode'?json.servers.premiere:json.mcpServers.premiere;
    assert.equal(spec.command,options.nodePath);
    assert.deepEqual(spec.args,[options.serverPath]);
    assert.equal(spec.env.PREMIERE_MCP_READ_ONLY,'1');
    assert.equal('PREMIERE_MCP_BRIDGE_DIR' in spec.env,false);
  }
});
