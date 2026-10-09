# Isolated Save Rehearsal

These templates are excluded from the root clasp upload. They build the separate,
owner-only test app, not the current production/preview app. Do not repoint the
root `.clasp.json`, upload these templates to its project, or migrate the original
workbook as part of a normal clasp push.

`build.cjs` exports `buildFiles(config)`. It returns Apps Script file objects;
it does not write files, contact Google, or deploy anything. The configuration
requires the separately approved script ID, disposable spreadsheet ID, collection
ID, owner email, and `savesEnabled: true`. `Server.js` is a template: the build
injects that trusted configuration. It must not be uploaded unexpanded.

The builder reuses the current UI and persistence modules, with asserted staging
transformations for the real transport and rehearsal wording. Missing transport
or snapshot fails closed; the generated app does not fall back to simulated saves.
The server checks the active owner and script identity, fixes the destination,
and delegates validation, locking, literal cell writes, and receipts to the
existing adapter/contract. The only public endpoints are `doGet` and
`saveRehearsalChanges`. Missing write consent presents Google's authorization
link before loading the collection; loading the app never writes data.

Deployment tooling, actual IDs, captures, and separate clasp staging are ignored
under `.local/rehearsal/`. See the private rehearsal section of
`docs/design/recalibration-2026-09.md` for the current setup. The initial migration
helper is not a reset tool and must not be replayed after saves.

## Local Checks

```powershell
node --test tests/rehearsal.test.cjs
$env:PLAYWRIGHT_MODULE = "$env:TEMP\ppq-mini-tests\node_modules\playwright"
node tests/rehearsal-browser.cjs
```

Use the external Playwright installation described in `docs/development.md`.
These tests run the actual generated wrapper and browser bridge against a fake
workbook. They test consent/owner gates, reload, Save All, creation, list changes,
restoration, stale edits, and retry idempotency. They do not authorize Google,
write a spreadsheet, or prove that a hosted save succeeds. That last check needs
the owner in the isolated test app. Drafts remain memory-only even there.

## Slow Responses

The real bridge advertises a 90-second confirmation timeout to the UI, which owns
the sole watchdog. At 15 seconds the UI reports Still saving rather than throwing
away a late acknowledgment. Save timeout/retry still uses the same request.
Execution logs and the save response's `timing` object record durations/counts
only, without miniature data; browser developer tools log the returned timing.

`Hash.js` implements SHA-256 in V8 to avoid hundreds of native Utilities calls
per snapshot. It preserves existing canonical fingerprints, record baselines,
and receipt replay. It does not replace caller authorization or change the
schema. Verify compatibility with:

```powershell
node --test tests/rehearsal-hash.test.cjs
```

Passing local timing/compatibility tests does not establish hosted latency.

## Startup Diagnostics

The owner's version 9 report measured 1,925 ms in template evaluation out of
2,603 ms on the server; collection reads took 402 ms and browser initialization
64 ms. Template includes themselves took only 20 ms. A version 10 static-page
experiment failed on Google with `RENDER_FAILED` and was rolled back to the
last owner-confirmed version 9. After isolated hosted diagnosis, the private
app and HEAD are now version 14. Failed version 10 source remains preserved;
do not repeat its processed-HTML marker substitution.

The active path reads build-time assembled `FastIndex` with `getRawContent`,
substitutes the escaped snapshot once, then creates HtmlOutput. It reports
`renderMethod: raw-template`, `pageReadMs` and `pageBuildMs`. Any fast-path
exception falls back to v9's [template evaluation](https://developers.google.com/apps-script/guides/html/templates)
using the unchanged `Index` and include files. Fallback reports only a stage plus
`templateMs`, `includeAuthMs` and `includeReadMs`, never HTML-bearing exception
text. Owner/consent checks precede fresh reads; no cache or schema change is
involved. Timings include nested measurements, not numbers to add together.

The version 10 handler discarded its exception. The subsequent hosted synthetic
probe identifies the failure at snapshot insertion: Google's processed HTML
contains no snapshot comment marker. The fake HtmlService used by local tests
did not reproduce this behavior. Hosted probes established the cause and checked
the replacement before promotion. `deployment-verified.json`, not the latest
created `version.json`, records the active deployment after a rollback.

`render-probe.cjs` builds a diagnostic-only version from published assets, not a
dirty worktree or collection export. `RenderProbe.js` exposes only `doGet`, checks
owner/project identity, never reads or writes collection data, and reports safe
phase/error codes instead of exception text that could contain full HTML. It
compares template evaluation, the failed static path, raw-read/output creation,
a single-print template, and manual expansion of the existing asset slots.
The separate diagnostic URL is recorded in ignored `render-probe-deployment.json`.
Owner reports are recorded in `render-probe-owner-result-v11/v12/v13.json`.
Version 13 proves all output differences are five extra newlines between closed
script/style tags, not code, styles or data. The separate probe remains version
13; the actual app is version 14. Its owner-reported timing is 6 ms page read +
24 ms construction, 1,196 ms server total, 961 ms sheet read, 127 ms browser ready.
Full address-bar load is not measured. Deployment creation can briefly return 404
on readback; inspect recorded state instead of blindly creating another version.

The distinction is documented by Google: [getRawContent](https://developers.google.com/apps-script/reference/html/html-template#getRawContent())
returns the unprocessed template, whereas [HtmlOutput](https://developers.google.com/apps-script/reference/html/html-output)
serves processed HTML. Do not substitute required comment markers after that
processing or assume local string-only HtmlService fakes model it. Probe timings
are synthetic, one pass per method with a repeated baseline, not full app timings.

```powershell
$env:PLAYWRIGHT_MODULE = Join-Path $env:TEMP 'ppq-editor-review/node_modules/playwright'
node --test tests/render-probe.test.cjs
```

`Startup.html` is inlined at build time, avoiding another server file read. It
measures browser initialization and two animation frames, and records available
iframe navigation timings. None measures the entire address-bar navigation,
Google's outer page or server startup before `doGet`. Server `totalMs` ends before
the timing-report append/response handoff. Do not infer end-to-end latency by
adding server time to iframe navigation time.

Open the existing **Rehearsal: saves to test copy** notice and click **Copy load
timing**. Clipboard rejection reveals selectable report text in that same notice.
Reports contain timings only, not collection contents, IDs, email or credentials.
The root preview has no diagnostic control and no new scope or RPC is introduced.

Browser-only timing with a local captured persistence snapshot:

```powershell
node tools/rehearsal/measure-browser.cjs .local/rehearsal/verified-snapshot.json
```

This headless measurement blocks network requests and is not a hosted benchmark.
See [rollout and rollback](../../docs/rollout-and-rollback.md) for the separate,
not-yet-executed manual recovery reference. The owner has removed a full recovery
rehearsal as a launch requirement; retain a fresh private workbook copy at rollout
without building backup UI or automation.

## Compact Reads

`Read.js` uses fresh metadata plus one bounded `Values.batchGet` instead of a
full typed-cell response. It reconstructs the existing adapter input; validation,
physical row/column mapping and atomic writes stay unchanged. This is not a
cache. Formula-looking strings receive targeted typed-cell probes so actual
formulas remain rejected and literal `=` notes are preserved. Probes are bounded
to 100 ranges per request. Read diagnostics split metadata, values and probe time.

```powershell
node --test tests/rehearsal-read.test.cjs
```

Tests include state/layout equivalence against an optional fresh ignored capture,
header/row reordering, wrong/missing ranges, invalid types, actual/literal formulas,
and missing/changed probes. Hosted performance must still be measured separately.
