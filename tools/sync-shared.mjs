#!/usr/bin/env node
import { runCli } from './lib/repo.mjs';
import { syncShared } from './lib/shared-sync.mjs';

process.exitCode = runCli({
  tool: 'sync-shared',
  usage: '用法：node tools/sync-shared.mjs [--check] [--skill NAME] [--root DIR] [--json] [--help]',
  options: { check: { type: 'boolean' }, skill: { type: 'string' } },
  empty: ({ check }) => ({ ok: false, mode: check ? 'check' : 'write', changes: [] }),
  run: syncShared,
  print({ changes, mode }) {
    for (const { action, file } of changes) console.log(`${action} ${file}`);
    console.log(`${mode === 'check' ? '同步检查' : '同步完成'}：${changes.length} 项。`);
  },
}, process.argv.slice(2));
