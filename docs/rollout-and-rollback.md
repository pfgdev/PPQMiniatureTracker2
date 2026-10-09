# Live Saving Rollout And Rollback

Status: production activation explicitly approved and deployed on October 9.
The real 2.0 workbook is migrated, with exact readback and private backups verified.
Owner-only live version 4 is published. The owner confirmed the live URL loads
612 miniatures / 496 groups without rehearsal UI; final save/reload is pending.
The owner previously confirmed
single saves, Save All, copy addition/removal, group deletion/restore, list
operations and two-tab conflicts in the isolated rehearsal.

## Activation Record

- Real target: `PPQ Miniature Tracker 2.0`, workbook
  `1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY`.
- Main bound script: `1SMCFIDHUrUk3FrPteOSIXqENMK21wmtrsE_8GZ00NzY4poJuHpOwHwB0`.
- Fresh pre-migration backup: [Before Live Saving - October 9](https://docs.google.com/spreadsheets/d/1_KP3hFgIdFspyqc07457XD5yxBe1-h83IrYxGZStOVA/edit).
  Sole-owner permissions verified; all four tables match the source exactly.
- Real source still matches the pre-rehearsal import: 496 groups, 612 copies,
  19 away, 555 assigned stickers, 57 n/a stickers, no missing stickers, four
  blank group fields. Catalog has 900 IDs; next available is F55.
- Prepared migration preserves all record IDs, values, notes, blanks, stickers
  and current locations. No test edits are imported. New live collection UUID:
  `d19c7f12-9faa-420b-a38f-949d4f155d20`, schema 2, starting revision 0.
- Local evidence/configuration is under `.local/live/`, excluded from Git.
- Migration applied in one 27-request batch. Six-table readback parsed with the
  actual persistence parser and matched the full candidate state exactly.
  Frozen headers, text storage and header formatting were also checked.
- Compatible private six-tab backup: [Live Baseline - October 9](https://docs.google.com/spreadsheets/d/1U6kd9o9G7HsH7D0MERRLoj96qxWDMdPDcsBhdAPf7uo/edit).
  Sole-owner access and full state equality verified at revision 0.
- Live app: [PPQ Miniature Tracker](https://script.google.com/macros/s/AKfycbzC3N1pZaLkodNlBfxnkBLquhP5faZSCB4NCN7fD0IFIrgSk5lBBNsl9Nav0eJV18hA/exec),
  version 4, access `MYSELF`, execution `USER_DEPLOYING`. Uploaded and versioned
  sources match the generated 14-file bundle exactly. Prior versioned preview
  deployments were not changed; they are not schema-compatible with live data.
  Use the new live URL rather than those old preview links.
- The legacy workbook's modification time remains September 7. Its data was not
  written. Rehearsal data and deployment were not modified by this rollout.
- Code checkpoint: `b920028`. Verification: 357 automated tests and 16 clean-live
  browser checks passed. Browser checks use simulated Google RPC/storage; they
  do not substitute for the remaining hosted check.
- Owner confirmed the live URL loads 612 miniatures / 496 groups without the
  rehearsal banner. Final save/reload is pending; no live user edit is yet claimed
  verified. Code and deployment records were pushed to `main` at `b83be22`.

**October 9 scope decision:** The owner does not want an extensive backup/recovery
rehearsal. It is not a launch requirement. Keep a fresh private workbook copy at
rollout, preserve the legacy sheet, and use manual recovery (including Google
Sheets version history) if needed. Do not build backup UI, automation, a mandatory
backup schedule or recovery-test infrastructure for this launch. The detailed
recovery notes below are reference material, not required implementation work.

## What Backup Means Here

The rehearsal setup includes a private native copy of the original 2.0 workbook,
verified before migration. It has the older four-tab format. It protects that
starting point; it is not a current backup of the six-tab saving system.

There is no automatic backup schedule or whole-collection restore button.
Restoring a deleted group in the app is a different operation. We will use a
manual recovery procedure, not build another management screen for this rollout.

## Before Enabling Live Saves

1. Finish startup measurement and verify the multiline-notes fix. Checkpoint the
   reviewed code in Git. Record the exact app version, schema version, target
   workbook and collection identity; do not use a routine root `clasp push` to
   activate saving accidentally.
2. Ask the owner to finish or discard drafts, wait for pending saves and close
   other tabs. Keep writers disabled while taking the backup. Freeze direct
   spreadsheet edits too; the app's script lock does not cover them.
3. Make a fresh private native copy of the intended destination before migration.
   Do not import rehearsal edits into the real collection. Migrate only the
   explicitly approved destination using a reviewed plan, then compare every
   record, ID, blank, note, location and sticker with the source.
4. Before the first live save, make and verify a compatible six-tab backup:
   `Metadata`, `Groups`, `Copies`, `Lists`, `Stickers`, `Requests`. Preserve deleted
   records, removed choices, revision and request receipts together. Verify with
   the actual parser and a full state comparison, not just row counts. Record
   backup time, revision, source and app version in the recovery log.
5. With explicit owner approval, enable owner-only saves against the verified
   destination. Test one reversible change, reload, and verify the stored result.
   Retain the legacy workbook, backups and prior code version untouched.

## Recovery Reference, Only If Needed

This is an untested operational reference, not a pre-launch rehearsal. If recovery
is needed, agree the restore point and approach then. Stop writes first and do
not reuse pre-restore browser drafts against restored data. A workbook restore
must keep the related storage tabs consistent, not just restore visible mini rows.

1. Stop every app deployment capable of writing to the affected collection,
   including development endpoints. Confirm an already-open tab cannot commit;
   disabling a button or asking for reload is not sufficient. Wait for in-flight
   executions to finish. If writes cannot be stopped, do not start a restore.
2. Preserve a private copy of the affected workbook and its app configuration for
   investigation. Identify the last verified compatible backup. Confirm the
   restore point with the owner: later saved changes will not be in that backup.
3. Make a new working copy of the backup, leaving both the backup and affected
   workbook untouched. Restore all six storage tables as a unit. Parse and compare
   the copy against the backup, including receipts and deleted records.
4. Give the restored working copy a fresh collection UUID in `Metadata` and in
   its trusted server configuration. Preserve group, copy and choice IDs, the
   saved revision and receipts. This starts a new collection history boundary
   so pre-restore browser requests cannot be accepted against older data. Verify
   this rejection with an actual stale request before enabling the new writer.
5. Use a schema-compatible app version. Load the restored collection with writes
   blocked first; compare IDs, values, active/removed counts and earliest unused
   sticker with the backup. Verify that only the new collection UUID differs.
6. With owner approval, enable the restored writer, save one controlled change
   and reload. Keep all old writers disabled. Record the backup, restored
   destination, identity change, app version and verification result.

This procedure has not yet been executed against Google. Read-only validation,
the maintenance switch and collection-identity change must be prepared and
verified if this recovery approach is needed, not as a launch prerequisite.
The original migration helper is
not a repeatable restore command. A code-only rollback also requires schema
compatibility; switching code versions does not undo saved data.

## Ongoing Backups

Take a fresh verified backup before migrations, bulk corrections and storage
changes. No routine interval, retention policy or automation is required for
launch; revisit only if the owner wants it. Keep backup access private and retain
the previous known-good copy until its replacement is verified. Git protects the
code, not the collection data.
