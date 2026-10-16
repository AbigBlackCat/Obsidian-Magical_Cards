import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { StarterAsset } from '../src/starter-assets';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({ stdin: { contents: "export {decodeStarterAsset} from './src/onboarding';export {STARTER_ASSETS} from './src/starter-assets';", resolveDir: root }, bundle: true, platform: 'browser', format: 'cjs', external: ['obsidian'], write: false });
const module = { exports: {} };
runInNewContext(bundle.outputFiles[0].text, {
  module, exports: module.exports, atob, crypto,
  require: (name: string) => { assert.equal(name, 'obsidian'); return { TFile: class {} }; },
});
const runtime = module.exports as { decodeStarterAsset(asset: StarterAsset): Promise<Uint8Array>; STARTER_ASSETS: StarterAsset[] };

test('six offline starter covers decode byte-exactly without Node, Buffer, network or WebAssembly', async () => {
  for (const asset of runtime.STARTER_ASSETS) {
    const bytes = await runtime.decodeStarterAsset(asset);
    assert.equal(bytes.byteLength, asset.byteLength);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.deepEqual(Buffer.from(bytes), await readFile(new URL(`../examples/vault/示例/附件/${asset.cover}`, import.meta.url)));
  }
});
test('mobile starter decoding rejects corrupted bytes, oversized output and wrong fingerprints before any write', async () => {
  const asset = runtime.STARTER_ASSETS[0];
  for (const broken of [{ ...asset, data: '!' }, { ...asset, byteLength: 1 }, { ...asset, byteLength: 10 * 1024 * 1024 + 1 }, { ...asset, sha256: '0'.repeat(64) }]) {
    await assert.rejects(runtime.decodeStarterAsset(broken), /解压失败|校验失败/);
  }
});
test('the actual install bundle can be evaluated in a mobile host with only the Obsidian API', async () => {
  const builder = await import(new URL('../esbuild.mjs', import.meta.url).href) as { buildCards(options: { write: boolean }): Promise<{ main: Uint8Array }> };
  const { main } = await builder.buildCards({ write: false });
  const entry = { exports: {} };
  runInNewContext(new TextDecoder().decode(main), {
    module: entry, exports: entry.exports, console, setTimeout, clearTimeout,
    require: (name: string) => {
      assert.equal(name, 'obsidian', `Desktop dependency leaked into mobile bundle: ${name}`);
      return new Proxy({}, { get: () => class {} });
    },
  });
  assert.equal(typeof (entry.exports as { default: unknown }).default, 'function');
  assert.equal(JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8')).isDesktopOnly, false);
});
