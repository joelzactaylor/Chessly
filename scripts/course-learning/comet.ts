import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let courseTab: { windowId: number; tabId: number } | undefined;

function findCourseTab() {
  if (courseTab) return courseTab;
  const script = `tell application "Comet"
    repeat with w in windows
      repeat with t in tabs of w
        if URL of t starts with "https://chessly.com/" then
          return (id of w as text) & "," & (id of t as text)
        end if
      end repeat
    end repeat
    error "No Chessly tab found. Open Chessly in Comet first."
  end tell`;
  const result = execFileSync('osascript', ['-'], { input: script, encoding: 'utf8' }).trim().split(',').map(Number);
  if (result.length !== 2 || result.some(n => !Number.isSafeInteger(n))) throw new Error('Could not locate the Chessly tab.');
  courseTab = { windowId: result[0], tabId: result[1] };
  return courseTab;
}

/** Execute in the page world; Comet's Apple Events JavaScript runs in an isolated world. */
export function comet(source: string): unknown {
  const { windowId, tabId } = findCourseTab();
  const payload = `(()=>{const s=document.createElement('script');s.textContent=${JSON.stringify(`(()=>{try {const result=(()=>{${source}})();document.documentElement.setAttribute('data-course-result',JSON.stringify({result}));}catch(e){document.documentElement.setAttribute('data-course-result',JSON.stringify({error:String(e)}));}})()`)};document.documentElement.appendChild(s);s.remove();const result=document.documentElement.getAttribute('data-course-result');document.documentElement.removeAttribute('data-course-result');return result;})()`;
  const apple = `tell application "Comet"\nexecute tab id ${tabId} of window id ${windowId} javascript ${JSON.stringify(payload)}\nend tell`;
  const raw = execFileSync('osascript', ['-'], { input: apple, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  const value = JSON.parse(raw);
  if (value.error) throw new Error(value.error);
  return value.result;
}
if (process.argv[1]?.endsWith('/comet.ts')) console.log(JSON.stringify(comet(readFileSync(process.argv[2], 'utf8')), null, 2));
