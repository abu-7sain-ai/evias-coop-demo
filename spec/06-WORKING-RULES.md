# 06 — Working Rules for the Agent ("الإيجنت")

These rules apply to every Claude Code session on this project. They override any default behaviour.

## Phases

1. **Phase 1 — Study.** Read all spec files. Ask every question you have in one message. List the permissions you need (installs, file writes, network). Write `PLAN.md`: what will change, which files, how each part is tested. Stop and wait for approval.
2. **Phase 2 — Execute.** Build exactly what `PLAN.md` says. Nothing beyond it. If something outside the plan is needed, add it to `PLAN.md` first and say why.

## Where you work

- Build only in the test copy (`engine-dev` / this demo folder). Never touch a running system.
- Tests use fake data and cover only what the change touched.
- Only one session works on the system at a time.

## Before touching an existing file

- Copy it to `_backup/<name>.bak-<YYYY-MM-DD>` first.
- Never delete anything permanently. Move to the recycle bin.
- Never change Windows (or OS) settings.

## Secrets

- Never print, log, copy, or commit API keys. The presenter enters the Anthropic key in the app's Settings page; you never see it.

## Honesty

- Never invent numbers, names, or prices. Anything without a source in the spec or the generated data is written as `[TBD]`.
- "Tested" means you opened the page and ran it. Reading code is not testing. The screenshot is the proof.

## Records

- `DEV-NOTES.md`: keep it updated as you go so the next session knows what happened. Every new file gets one line here saying why it exists.
- `DECISIONS.md`: every decision you made without asking, one line each: decision + reason.
- Temporary files go to the recycle bin before you finish.

## Limits

- If a task exceeds 2 hours, or the same error repeats 3 times, stop. Report `⏳ NOT DONE` with the problem. Do not loop.
- If the connection drops or the machine restarts, start from zero except files already pushed/saved successfully.

## Naming

- File and variable names in English. User-facing text in Arabic and English from the single strings files (`src/i18n/ar.json`, `src/i18n/en.json`).

## Browser testing (Playwright MCP)

- Playwright MCP is installed. Use it for every visual check: open the page in the real browser, click through it, read console errors, and screenshot.
- Check with your own eyes, in the screenshot: no overlapping badges, no stretched cards, no empty pages, no clipped Arabic text, layout correct in both RTL and LTR and both themes.
- Reference screenshots: on the first successful build, save one screenshot per view into `_screenshots/reference/` (light/ar, light/en, dark/ar, dark/en). After every later change, re-screenshot into `_screenshots/current/` and compare; any difference on a view you were not asked to change is a bug to fix or to report.

## Finishing

- Before claiming done: open every page you changed in Playwright, test it as the owner would, screenshot each one into `_screenshots/current/`.
- Reports are short and in English.
- The last line of every report is exactly one of:
  - `✅ DONE`
  - `⏳ NOT DONE — <what remains>`
