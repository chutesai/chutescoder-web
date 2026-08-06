# chutescoder — public explainer site

A single-page announcement post for the chutescoder project. Plain HTML/CSS/JS,
**no build step**, no external network calls (no CDN scripts, no web fonts, no
analytics). Everything the page displays comes from the JSON files in `data/`.

```
web/
  index.html                  the page (structure + prose)
  styles.css                  light + dark themes, one stylesheet
  app.js                      chart, tables, filters, theme toggle (no deps)
  build_data.py               regenerates availability.json (+ ab_harness.json, opt-in)
  data/
    availability.json     ←   GENERATED. Per-model probe success rate.
    binary_run.json       ←   the real chutescoder binary, RLM mode on (hand-transcribed)
    smoke_run.json        ←   the pre-integration driver run on Kimi K3 (hand-transcribed)
    ab_harness.json       ←   TOMBSTONE ONLY. No measurements. Not rendered.
    results.json          ←   the standard-benchmark grid. Still empty on purpose.
    public_scores.json    ←   the 130 published scores for Kimi K3 / GLM-5.2
    harness_spread.json   ←   the three Terminal-Bench 2.1 runs in the hero chart
    model_availability.jsonl  raw probe log, copied from ../data/
  render.yaml                 Render blueprint (static site, free plan)
```

## The one rule

**Never put a number on this page that is not in one of the `data/*.json` files
with a `source_url`, or that has not actually been measured.** An empty cell is
correct. A plausible-looking placeholder is not — this is public marketing
material and a single invented score poisons the whole page.

`results.json` ships with `"cells": []`, so every (benchmark × model × arm) cell
renders as `pending`. That is the intended state until real runs land.

---

## The A/B is retracted — twice. Read this before restoring it

**2026-08-06.** Three rounds of review. **The experiment supports no performance
claim in either direction**, and the page must not assert one.

**Round one** — headline "the harness wins" — withdrawn for two faults:

1. `bench/ab_harness.py` never cleaned `/tmp` between runs, so the compaction
   task ran with ~480 leftover same-named files from earlier tasks on disk. The
   single failing trial that the whole accuracy result rested on went looking in
   them and said so in its own final message.
2. The arms were not comparable. RLM got a 5,438-byte prompt teaching batching
   and filtering plus a post-compaction notice naming `ctx.grep`; CLASSIC got
   232 bytes and was not told compaction had happened. "The only variable is the
   tool interface" was false.

**Rounds two and three** — the clean re-run, headline "the harness loses" —
also withdrawn, for three more:

3. The compaction result was **false**. The write-up quoted the failing
   baseline trial's own explanation ("the value was not preserved in my
   summary") as evidence. The reviewer regenerated the corpus: that summary
   contains `CACHE_TTL_BUDGET=837` verbatim, in its first bullet list. Across
   all ten trials the baseline's summary retained the target fact **5/5**. The
   mechanism under test never fired, so `recall-40` supports nothing. Same
   error as round one: believing an agent's narration of its own behaviour.
4. **`ctx` was used in 0 of 20 trials.** Every recovery was a plain
   kernel-variable lookup. What is demonstrated is *variable persistence across
   compaction* — real, useful, more portable — not context-as-a-variable.
5. The negative result is **partly an artefact of prompt length**. On `needle`
   both arms did byte-identical work and RLM still used 2.3× the tokens; 100 %
   of that gap is system-prompt length, ~45–52 % on audit and recall.

Consequences for this folder:

- **`data/ab_harness.json` ships as a tombstone only** — retraction text, no
  measurements. `build_data.py` writes the real one only under `--emit-ab`.
- **`app.js` has no A/B renderer.** The removed code is described in a comment
  where it used to live. Do not resurrect it — it drew the invalid comparison.
- **Section 04 of the page is a retraction**, not a placeholder. It names all
  five faults and carries zero measurements — including zero *negative* ones.
- `recall-5` was dropped from `build_data.py` entirely: its per-trial records no
  longer exist and its numbers survived only as hand-typed literals in this
  script.

### Restoring it — what a publishable run would need

Everything round two already had (n = 5 per cell, isolated corpus root per
trial, a CLASSIC prompt written with comparable care, a symmetric
post-compaction notice, a de-contaminated `audit` task), **plus**:

- an RLM system prompt trimmed to the baseline's length, so the token column
  measures the mechanism and not the prompt;
- a compaction task whose summariser demonstrably *loses* the target fact —
  verify that from the summary text before scoring anything;
- a snapshot of `messages` taken **before** `compact()` replaces it, so phase 1
  is auditable;
- transcripts for every cell, checked against every behavioural claim. No claim
  survives on the model's own account of itself.

Then:

```bash
cd web
cp ../data/model_availability.jsonl data/
python3 build_data.py --emit-ab
```

…and write a **new** renderer. Keep the retraction visible above whatever
replaces it — a reader who saw the withdrawn numbers is owed the correction more
than a reader who did not is owed a clean page. **A null result is an acceptable
outcome and must be published as one.**

To add a task, append an entry to `TASKS` in `build_data.py` with its report
filename, a `blurb` and a `shape`.

## Regenerating the availability data

```bash
cd web
cp ../data/model_availability.jsonl data/
python3 build_data.py
```

This one is safe and should be re-run whenever the probe log grows. The
GLM-5.2 `blocked_reason` in `results.json` deliberately contains **no counts** —
the numbers come from `availability.json` at render time, so they cannot go
stale. Keep it that way. Twice in review a hand-typed availability figure had
drifted from the log it cited; that is why the prose contains none.

The probe watcher was **stopped** at the last timestamp in the log, so
`availability.json` now carries closing figures rather than a snapshot of a
growing file (`"watcher_stopped": true`). Closing tally: **Kimi K3 34/34,
GLM-5.1 34/34, GLM-5.2 11/34** — the watcher appended one more round after
`docs/RESULTS.md` was written, which is why that document says 33 probes. The
page renders whatever the file says.

## The two run records

`data/binary_run.json` — the **real binary**, `bench/binary_ab.sh parser-bug`,
`rlm.enabled=true`, provider `chutes`, Kimi K3. Transcribed from
`reports/binary_ab/{summary.jsonl,C-chutescoder.jsonl}` and the session rollout
for thread `019fd4dc-…`. It deliberately carries **no timing or token
comparison** between the two arms: n = 1 each, and this page asserts no
performance result in either direction.

`data/smoke_run.json` — the pre-integration driver run, hand-transcribed from
`reports/smoke_kimi_k3/RESULT.md`. There is no machine-readable source for it.
The review checked this one and its figures reproduce; it is n = 1 and the page
says so.

---

## Filling in benchmark results

Editing `data/results.json` is the *only* thing you need to do. No HTML, no JS.

### 1. Add one object to `cells` per scored run

```jsonc
{
  "benchmark": "terminal-bench",   // must match a benchmarks[].id
  "model":     "kimi-k3",          // must match a models[].id
  "arm":       "C",                // must match an arms[].id, and be listed in benchmarks[].arms
  "state":     "measured",         // "measured" | "blocked" | "pending"
  "score":     71.4,               // the benchmark's native metric — no rounding up
  "n":         "12 / 89 (seed 1337)",
  "tokens":    "4.1M in / 220k out",
  "cost_usd":  18.42,
  "run_id":    "br_01J...",        // bench-runner run id (recorded, not yet displayed)
  "notes":     "preliminary — 10% subset"
}
```

Fields other than `benchmark` / `model` / `arm` / `state` are optional; anything
missing renders as an em dash rather than a guess.

The grid itself is generated from `benchmarks` × `models` × `benchmarks[].arms`,
so the "N of M cells measured" meter and the pending list update themselves.

### 2. Mark blocked cells honestly

Two ways, and both render a red `blocked` pill rather than a grey `pending` one:

- **Per model** — set `"blocked": true`, `"blocked_reason": "…"` and optionally
  `"blocked_evidence": "data/…"` on the entry in `models`. Every cell for that
  model becomes blocked, and the reason appears as a callout under the status
  meter. This is what `glm-5.2` currently uses.
- **Per cell** — a `cells` entry with `"state": "blocked"` and a `"notes"`.
  Use this when only some cells are affected. A per-cell entry overrides the
  model-level flag.

Do **not** silently substitute a different model; that is exactly the failure
mode the benchmark plan is designed to avoid. To un-block, delete the flag —
the cells fall back to `pending`.

### 3. Flip the page out of "not run" mode

Once at least one cell is measured, the status pill switches from
*measurements in progress* to *partial results* automatically. Also update, by
hand:

- `"headline"` — one honest sentence about what is now known.
- `"harness_commit"` — the chutescoder sha the runs used. Until this is set the
  page says "not yet pinned".
- `"status"` — `"pending"` → `"partial"` → `"complete"` (informational).

When everything is measured, also soften the amber banner at the top of
`index.html` (`<aside class="banner" id="status-banner">`) — it is the one piece
of pending-state copy that lives in HTML rather than JSON.

### 4. Adding a benchmark or model

Append to `benchmarks` / `models` in the same file. New rows appear
automatically. A model with `"at_risk": true` and an `"at_risk_reason"` gets a
hoverable warning marker on its pending cells.

---

## Updating the published-score data

`data/public_scores.json` is a **copy** of `../data/public_scores.json` (the
research dataset, 130 records, schema
`{model, benchmark, variant, score, unit, source_url, source_type, date, notes}`).
Refresh it with:

```bash
cp ../data/public_scores.json data/public_scores.json
```

The table, the filters, the record count and the footer summary all derive from
it — no other file needs touching.

`data/harness_spread.json` is separate on purpose: it holds the three
Terminal-Bench 2.1 runs behind the hero chart, including the **Vals AI 80.90**
row, which is *not* in `public_scores.json` (that dataset was compiled from the
Artificial Analysis API and the two lab model cards only). It was verified
directly against <https://www.vals.ai/benchmarks/terminal-bench-2-1>, and the
chart legend labels it as such. If you ever add it to `public_scores.json`, flip
`"in_public_scores": true` so the disclaimer disappears.

---

## Local development

There is no build. But the page fetches JSON, so `file://` will not work — serve
it over HTTP:

```bash
cd web
python3 -m http.server 8080
# → http://localhost:8080
```

Check both themes (the ☀/☾ button in the header, or your OS setting) and a
narrow viewport before shipping.

## Deploying

Hosted on Render as a **static site on the free plan**, in the
"Florian S's Workspace" workspace.

| | |
|---|---|
| service | `chutescoder-web` |
| repo | <https://github.com/chutesai/chutescoder-web> |
| branch | `main` |
| publish path | `.` |
| build command | *(none — `echo "static site, no build"`)* |
| auto-deploy | on |

Because auto-deploy is on, **a push to `main` is the deploy**:

```bash
cd web
git add -A && git commit -m "results: terminal-bench arm C, kimi-k3" && git push
```

Render picks it up within a few seconds and redeploys. To force one by hand, use
`trigger_deploy` in the Render MCP or the "Manual Deploy" button in the
dashboard.

Note the site directory is committed to its own repo (`chutescoder-web`), *not*
to `chutesai/chutescode` — the fork stays clean, and the marketing page can be
updated without touching the harness.
