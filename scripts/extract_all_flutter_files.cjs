const fs = require('fs');
const path = require('path');

const codeHubPath = path.resolve(__dirname, '../src/components/FlutterCodeHub.tsx');
const flutterAppDir = path.resolve(__dirname, '../flutter_app');

const content = fs.readFileSync(codeHubPath, 'utf-8');

// Match filename and code pairs cleanly
const files = [];
const filenameRegex = /filename:\s*['"]([^'"]+)['"]/g;

let fnMatch;
const positions = [];
while ((fnMatch = filenameRegex.exec(content)) !== null) {
  positions.push({
    filename: fnMatch[1],
    index: fnMatch.index
  });
}

for (let i = 0; i < positions.length; i++) {
  const current = positions[i];
  const nextPos = (i + 1 < positions.length) ? positions[i + 1].index : content.length;
  const chunk = content.substring(current.index, nextPos);

  // find code: `
  const codeStartIdx = chunk.indexOf('code: `');
  if (codeStartIdx === -1) continue;

  const actualCodeStart = codeStartIdx + 7;
  // find the last ` before the next block
  const codeEndIdx = chunk.lastIndexOf('`');
  if (codeEndIdx <= actualCodeStart) continue;

  const code = chunk.substring(actualCodeStart, codeEndIdx);
  const fullPath = path.join(flutterAppDir, current.filename);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(fullPath, code, 'utf-8');
  console.log(`[Extracted] ${current.filename} (${code.length} bytes)`);
  files.push(current.filename);
}

console.log(`\nSuccessfully extracted ${files.length} physical Flutter files to ${flutterAppDir}`);
