# Save, Upload, And Test

## The Everyday Commands

Save your open files in the editor first. In the project's PowerShell terminal:

```powershell
git status
git diff
git add .
git commit -m "Describe what changed"
git push origin main
clasp status
clasp push -f
```

- `git status` lists changed files; `git diff` shows edits to tracked files.
- `git add .` stages all changes in this folder. Use it only after checking that all changes belong in the commit. To choose files, use `git add Code.js Scripts.html Styles.html` instead.
- `git commit` records a local checkpoint. Change the quoted message each time.
- `git push origin main` copies committed checkpoints to GitHub.
- `clasp status` lists the files that will be uploaded to Apps Script.
- `clasp push -f` uploads local app files, including the manifest. It replaces the remote project source; do not use it to overwrite uncollected edits made in Google's editor.

Run commands one at a time. Stop if any command fails. Neither kind of push
requires the other: GitHub is code history, Apps Script is the running app source.
Neither command imports miniature records or edits spreadsheet cells.

The repo's `.clasp.json` already identifies the Apps Script project. No new
project setup is needed. If authentication expires, run `clasp login` and sign
in with the account that owns the script. Never commit `.clasprc.json` credentials.

## Open The Current App

Open the [Apps Script project](https://script.google.com/home/projects/1SMCFIDHUrUk3FrPteOSIXqENMK21wmtrsE_8GZ00NzY4poJuHpOwHwB0/edit).
Choose **Deploy > Test deployments**, then open/bookmark the Web app URL ending
in `/dev`, signed in as a script editor. Refresh that page after a clasp push.

The `/dev` test app uses the latest saved source. An existing `/exec` URL is a
versioned deployment and is not updated by a source push. Publishing a new
version is a separate, deliberate step; we are not doing it during this restart.
See Google's [test deployment guide](https://developers.google.com/apps-script/guides/web#test_a_web_app_deployment)
and [clasp guide](https://developers.google.com/apps-script/guides/clasp).

For now, expect nine groups and a **Mock data only** notice. Save Changes affects
only the current browser session. Reloading resets the samples. The real sheet
remains untouched and already holds the inventory; do not paste/import it again
just to run this prototype.

## A Short Feedback Session

1. Open Zhent Soldier. Change A12's location, then use Set All Home. It should return to Spare People with no pending change.
2. Stage a location change and open another miniature. The top Unsaved button should still show it and take you back to pending work. Reset when finished.
3. Open Spirit Folk Fighter and resize the browser. Check the table clipping, scrolling, location controls, and Home/Set text. Tell us the browser width and steps if something feels wrong.

No need to review everything at once. Screenshots plus what you expected and
what actually happened are enough for the next small iteration.

## Optional Automated Checks

The regression suite runs the local Apps Script template in headless Chrome.
It does not connect to a spreadsheet or change any deployment. Node.js and Chrome
must be installed. Install test tooling outside the app repository once:

```powershell
npm install --prefix "$env:TEMP\ppq-mini-tests" playwright
```

Then run from this repository:

```powershell
$env:PLAYWRIGHT_MODULE = "$env:TEMP\ppq-mini-tests\node_modules\playwright"
node tests/regression.cjs
git diff --check
```

The suite checks safe data embedding, location resets/saves, frozen desktop
columns, keyboard focus, pending edits, sort/filter behavior, narrow-screen
table scrolling, reduced-motion marquee behavior, and browser script errors.
It does not test authenticated Apps Script hosting or real spreadsheet writes.
