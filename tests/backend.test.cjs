const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SettingsService, parseSettings } = require('../.test-build/main/SettingsService');
const { PositionService } = require('../.test-build/main/PositionService');
const { characterLayout } = require('../.test-build/main/characterLayout');

test('settings reject corrupt schema, strings, infinity; accept negative coordinates', () => {
  for (const value of [null, [], {version:2,position:{x:1,y:2}}, {version:1,position:{x:'1',y:2}}, {version:1,position:{x:Infinity,y:2}}]) assert.equal(parseSettings(value),null);
  assert.deepEqual(parseSettings({version:1,position:{x:-100.2,y:200}}),{x:-100,y:200});
});
test('position survives a new service instance; corrupt file falls back; failed save preserves prior file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'daic-test-'));
  try {
    const file = path.join(dir,'settings.json'); const store = new SettingsService(file,()=>{});
    assert.equal(store.load(),null); assert.equal(store.save({x:-300,y:200}),true);
    assert.deepEqual(new SettingsService(file).load(),{x:-300,y:200});
    fs.mkdirSync(file+'.tmp'); // rename removed the temporary file; block the next write deliberately
    assert.equal(store.save({x:500,y:400}),false);
    assert.deepEqual(new SettingsService(file).load(),{x:-300,y:200});
    fs.writeFileSync(file,'{broken'); assert.equal(store.load(),null);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('missing monitor, partial offscreen, negative displays, taskbar and tiny work area', () => {
  const service = new PositionService(); const primary={x:0,y:0,width:1920,height:1040}; const second={x:-1280,y:0,width:1280,height:984}; const size={width:96,height:128};
  assert.deepEqual(service.resolve(null,[primary],primary,size),{x:1800,y:888});
  assert.deepEqual(service.resolve({x:-500,y:200},[primary,second],primary,size),{x:-500,y:200});
  assert.deepEqual(service.resolve({x:-500,y:200},[primary],primary,size),{x:1800,y:888});
  assert.deepEqual(service.resolve({x:1900,y:900},[primary],primary,size),{x:1800,y:888});
  assert.deepEqual(service.defaultPosition({x:10,y:20,width:20,height:20},size),{x:10,y:20});
});
test('visible alpha height is 128 DIP despite transparent margins; original pixel data unchanged', () => {
  const data = Buffer.alloc(10*20*4); data[(5*10+3)*4+3]=255; data[(14*10+6)*4+3]=128;
  const original=Buffer.from(data); const result=characterLayout(data,10,20);
  assert.equal(result.height,132); assert.equal(result.imageHeight,256);
  assert.deepEqual(result.alphaBounds,{x:3,y:5,width:4,height:10}); assert.deepEqual(data,original);
  assert.throws(()=>characterLayout(Buffer.alloc(16),2,2),/transparent/);
});
