import http from 'http';
import { spawn } from 'child_process';

const TARGET_URL = 'http://localhost:5173';

function checkViteReady() {
  return new Promise((resolve) => {
    http.get(TARGET_URL, (res) => {
      resolve(true);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function main() {
  console.log('[Launcher] Waiting for Vite development server to start on port 5173...');
  let ready = false;
  let attempts = 0;

  while (!ready && attempts < 30) {
    attempts++;
    ready = await checkViteReady();
    if (!ready) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  if (ready) {
    console.log('[Launcher] Vite is online! Launching HiveNet Desktop Window...');
    const electronBin = process.platform === 'win32' ? 'electron.cmd' : 'electron';
    const child = spawn(electronBin, ['.'], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  } else {
    console.error('[Launcher] Timed out waiting for Vite. Launching Electron anyway...');
    const electronBin = process.platform === 'win32' ? 'electron.cmd' : 'electron';
    spawn(electronBin, ['.'], { stdio: 'inherit', shell: true });
  }
}

main();
