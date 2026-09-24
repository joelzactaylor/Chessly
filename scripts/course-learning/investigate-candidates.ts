import { spawn } from 'node:child_process';
import { comet } from './comet';
const ids = process.argv.slice(2);
for (const id of ids) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid course id');
  console.log(`Inspecting candidate ${id}`);
  comet(`window.next.router.push('/courses/${id}');return true;`);
  await new Promise(r => setTimeout(r, 1500));
  const code = await new Promise<number | null>(resolve => {
    const child = spawn('node_modules/.bin/tsx', ['scripts/course-learning/learn-comet.ts', id], { stdio: 'inherit' });
    child.on('exit', resolve);
  });
  if (code !== 0) throw new Error(`Candidate import failed: ${id}`);
}
