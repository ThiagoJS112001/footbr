import { spawn } from 'node:child_process';
const common = { stdio: 'inherit', windowsHide: true };
const backend = spawn(process.execPath, ['--env-file-if-exists=.env', '--import', 'tsx', 'server/index.ts'], common);
const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], common);
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; backend.kill(); frontend.kill(); process.exitCode = code; }
for (const child of [backend, frontend]) { child.on('error', () => stop(1)); child.on('exit', (code) => stop(code ?? 0)); }
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
