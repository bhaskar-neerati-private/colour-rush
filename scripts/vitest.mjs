// Starts Vitest. On Windows, a lowercase drive letter (c:\ instead of C:\) makes Vitest load
// itself twice and every test fails, so this starts it from the same folder with C:\.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const upperDrive = (path) => path.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const cwd = upperDrive(process.cwd());
const vitest = upperDrive(fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)));
const result = spawnSync(process.execPath, [vitest, ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(result.status ?? 1);
