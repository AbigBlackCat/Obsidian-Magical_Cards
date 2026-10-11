import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {checkRelease} from './check-release.mjs';

const run=promisify(execFile),project=fileURLToPath(new URL('../',import.meta.url));
await run(process.execPath,['esbuild.mjs'],{cwd:project});
const first=await checkRelease();
await run(process.execPath,['esbuild.mjs'],{cwd:project});
const second=await checkRelease();
if(JSON.stringify(first)!==JSON.stringify(second))throw new Error('Independent build processes produced different release bytes.');
process.stdout.write(`Reproducible release: ${JSON.stringify(second)}\n`);
