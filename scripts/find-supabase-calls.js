#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || process.cwd());

const INCLUDE_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.vue',
  '.svelte',
]);

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.cache', 'coverage']);

function stripComments(source) {
  let result = '';
  let i = 0;
  let state = 'code';

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line-comment';
        i += 2;
        continue;
      }
      if (char === '/' && next === '*') {
        state = 'block-comment';
        i += 2;
        continue;
      }
      if (char === '<' && next === '!' && source.slice(i, i + 4) === '<!--') {
        state = 'html-comment';
        i += 4;
        continue;
      }
      if (char === '"') {
        state = 'double-string';
      } else if (char === "'") {
        state = 'single-string';
      } else if (char === '`') {
        state = 'template-string';
      }
      result += char;
      i += 1;
      continue;
    }

    if (state === 'line-comment') {
      if (char === '\n') {
        state = 'code';
        result += '\n';
      }
      i += 1;
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'code';
        i += 2;
      } else {
        if (char === '\n') result += '\n';
        i += 1;
      }
      continue;
    }

    if (state === 'html-comment') {
      if (char === '-' && next === '-' && source[i + 2] === '>') {
        state = 'code';
        i += 3;
      } else {
        if (char === '\n') result += '\n';
        i += 1;
      }
      continue;
    }

    if (state === 'single-string') {
      result += char;
      if (char === '\\') {
        result += next || '';
        i += 2;
        continue;
      }
      if (char === "'") state = 'code';
      i += 1;
      continue;
    }

    if (state === 'double-string') {
      result += char;
      if (char === '\\') {
        result += next || '';
        i += 2;
        continue;
      }
      if (char === '"') state = 'code';
      i += 1;
      continue;
    }

    if (state === 'template-string') {
      result += char;
      if (char === '\\') {
        result += next || '';
        i += 2;
        continue;
      }
      if (char === '`') state = 'code';
      i += 1;
      continue;
    }
  }

  return result;
}

function normalizePath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        yield* walk(fullPath);
      }
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (INCLUDE_EXTENSIONS.has(ext)) {
      yield fullPath;
    }
  }
}

function collectSupabaseCalls(source) {
  const cleaned = stripComments(source);
  const pattern = /\.\s*(from|rpc)\s*\(\s*(`(?:\\`|[^`])*`|"(?:\\"|[^"])*"|'(?:\\'|[^'])*')/g;
  const found = new Set();

  for (const match of cleaned.matchAll(pattern)) {
    const method = match[1];
    const argLiteral = match[2];
    found.add(`supabase.${method}(${argLiteral})`);
  }

  return [...found].sort();
}

async function main() {
  const output = [];

  for await (const filePath of walk(ROOT)) {
    const content = await fs.readFile(filePath, 'utf8').catch(() => null);
    if (!content) continue;

    const calls = collectSupabaseCalls(content);
    if (calls.length === 0) continue;

    output.push({ file: normalizePath(filePath), calls });
  }

  output.sort((a, b) => a.file.localeCompare(b.file));

  if (output.length === 0) {
    console.log('No Supabase table/view/RPC calls found.');
    return;
  }

  for (const item of output) {
    console.log(`file: ${item.file}`);
    for (const call of item.calls) {
      console.log(call);
    }
    console.log('');
  }
}

main().catch((error) => {
  console.error('Scan failed:', error.message);
  process.exitCode = 1;
});
