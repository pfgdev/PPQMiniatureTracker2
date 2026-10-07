'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { analyzeImport, toAppState, renderReport } = require('./import-core.cjs');
const repo = path.resolve(__dirname, '..');

function run(args) {
  if (args.includes('--help')) {
    console.log('node tools/import-dry-run.cjs --input .local/import/source-snapshot.json [--out .local/import/dry-run]');
    console.log('Reads a captured snapshot; writes local reports only. No --apply or network capability.');
    return;
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!['--input', '--out'].includes(args[index]) || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Use --input PATH and optional --out PATH. Live writes are not supported.');
    if (options[args[index]]) throw new Error(`Repeated option ${args[index]}`);
    options[args[index]] = args[index + 1];
  }
  if (!options['--input']) throw new Error('Supply --input with a fresh captured snapshot.');
  const output = path.resolve(repo, options['--out'] || '.local/import/dry-run');
  const local = path.resolve(repo, '.local');
  if (!output.startsWith(local + path.sep)) throw new Error('Reports must stay inside the ignored .local directory.');
  const input = path.resolve(repo, options['--input']);
  if (['candidate.json', 'report.json', 'report.md', 'app-state.json'].some(file => path.join(output, file) === input)) throw new Error('Output would overwrite the input snapshot.');
  fs.mkdirSync(output, { recursive: true });
  let result;
  try {
    result = analyzeImport(JSON.parse(fs.readFileSync(input, 'utf8')));
  } catch (error) {
    // A corrupt/unreadable snapshot must not leave a prior candidate looking current.
    const blocked = { blocked: true, error: error.message, remoteWritesPerformed: false };
    for (const file of ['candidate.json', 'app-state.json', 'report.json']) {
      fs.writeFileSync(path.join(output, file), JSON.stringify(blocked, null, 2) + '\n');
    }
    fs.writeFileSync(path.join(output, 'report.md'), '# Import Dry Run Failed\n\nNo spreadsheet writes.\n\n' + error.message + '\n');
    throw error;
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result.report, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'report.md'), renderReport(result.report));
  // A blocked run replaces older usable payloads with explicit unusable markers.
  const payload = result.report.readyForReview ? result.candidate : { blocked: true, snapshotHash: result.report.snapshotHash };
  fs.writeFileSync(path.join(output, 'candidate.json'), JSON.stringify(payload, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'app-state.json'), JSON.stringify(result.report.readyForReview ? toAppState(result.candidate) : payload, null, 2) + '\n');
  console.log(JSON.stringify({ ...result.report.stats, blockers: result.report.blockers, warnings: result.report.warnings, output, remoteWritesPerformed: false }, null, 2));
  if (!result.report.readyForReview) process.exitCode = 1;
}
if (require.main === module) {
  try { run(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { run };
