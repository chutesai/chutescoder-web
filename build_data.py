#!/usr/bin/env python3
"""Regenerate web/data/ab_harness.json and web/data/availability.json.

Reads the raw per-trial records the benchmark harness writes, computes the
aggregates the site displays, and writes them out. Run it after any new A/B run:

    cd web && python3 build_data.py

Nothing here invents a number. Every value is either read straight out of a
report file or is the arithmetic mean of the per-trial values in one.
"""
import json
import pathlib
import statistics
import sys

WEB = pathlib.Path(__file__).resolve().parent
ROOT = WEB.parent
REPORTS = ROOT / "reports"
OUT = WEB / "data"

# Display metadata per task id. `file` is the per-trial record, or None when the
# per-trial records were superseded by a later rerun and only the aggregate in
# docs/RESULTS.md survives.
TASKS = [
    {
        "id": "needle",
        "label": "needle",
        "blurb": "240 files, one planted value to find",
        "shape": "single lookup",
        "file": "ab_needle_Kimi-K3-TEE.json",
    },
    {
        "id": "audit",
        "label": "audit",
        "blurb": "120 files, count the 7 genuine eval() calls",
        "shape": "scan + disambiguate",
        "file": "ab_audit_Kimi-K3-TEE.json",
    },
    {
        "id": "join",
        "label": "join",
        "blurb": "180 files, find the pair sharing the most dependencies (16,110 pairs)",
        "shape": "aggregation",
        "file": "ab_join_Kimi-K3-TEE.json",
    },
    {
        "id": "recall-5",
        "label": "recall-5",
        "blurb": "5 facts, forced compaction, corpus deleted, one fact asked for afterwards",
        "shape": "post-compaction recall",
        "file": None,
        "source_note": (
            "Per-trial records were superseded on disk by the recall-40 rerun; "
            "these aggregates are transcribed from docs/RESULTS.md §3."
        ),
        "aggregate": {
            "RLM": {"correct": 3, "trials": 3, "turns": 6.3, "tool_calls": 4.3,
                    "tokens_in": 18910, "wall_clock_s": 67},
            "CLASSIC": {"correct": 3, "trials": 3, "turns": 9.0, "tool_calls": 10.3,
                        "tokens_in": 11828, "wall_clock_s": 72},
        },
    },
    {
        "id": "recall-40",
        "label": "recall-40",
        "blurb": "40 facts — more than a concise summary can hold — same setup",
        "shape": "post-compaction recall, lossy",
        "file": "ab_recall40_Kimi-K3-TEE.json",
    },
]

# Lower is better for everything except accuracy.
METRICS = [
    {"id": "turns", "label": "turns", "lower_is_better": True, "fmt": "1"},
    {"id": "tool_calls", "label": "tool calls", "lower_is_better": True, "fmt": "1"},
    {"id": "tokens_in", "label": "input tokens", "lower_is_better": True, "fmt": "0"},
    {"id": "wall_clock_s", "label": "wall clock (s)", "lower_is_better": True, "fmt": "0"},
    {"id": "accuracy", "label": "accuracy", "lower_is_better": False, "fmt": "pct"},
]


def mean(xs):
    return round(statistics.fmean(xs), 4)


def aggregate(rows, arm):
    r = [x for x in rows if x["arm"] == arm]
    if not r:
        return None
    return {
        "trials": len(r),
        "correct": sum(1 for x in r if x["correct"]),
        "turns": mean([x["turns"] for x in r]),
        "tool_calls": mean([x["tool_calls"] for x in r]),
        "tokens_in": mean([x["tokens_in"] for x in r]),
        "tokens_out": mean([x["tokens_out"] for x in r]),
        "wall_clock_s": mean([x["wall_clock_s"] for x in r]),
    }


def main():
    tasks = []
    missing = []
    for t in TASKS:
        entry = {k: t[k] for k in ("id", "label", "blurb", "shape")}
        if t["file"]:
            path = REPORTS / t["file"]
            if not path.exists():
                missing.append(t["file"])
                continue
            raw = json.loads(path.read_text())
            entry["source_file"] = f"reports/{t['file']}"
            entry["per_trial"] = True
            entry["n_files"] = raw["rows"][0].get("n_files")
            entry["max_turns"] = raw.get("max_turns")
            entry["arms"] = {a: aggregate(raw["rows"], a) for a in ("RLM", "CLASSIC")}
            entry["trials"] = [
                {k: r[k] for k in ("arm", "trial", "correct", "turns", "tool_calls",
                                   "tokens_in", "tokens_out", "wall_clock_s")}
                for r in raw["rows"]
            ]
        else:
            entry["source_file"] = "docs/RESULTS.md §3"
            entry["per_trial"] = False
            entry["source_note"] = t["source_note"]
            entry["n_files"] = 150
            entry["arms"] = {}
            for arm, a in t["aggregate"].items():
                entry["arms"][arm] = dict(a)
            entry["trials"] = []
        for arm, a in entry["arms"].items():
            if a:
                a["accuracy"] = round(a["correct"] / a["trials"], 4)
        tasks.append(entry)

    if missing:
        print("MISSING report files (task omitted):", ", ".join(missing), file=sys.stderr)

    # ---- availability -----------------------------------------------------
    probes = [json.loads(l) for l in (ROOT / "data" / "model_availability.jsonl").read_text().splitlines() if l.strip()]
    by_model = {}
    for p in probes:
        m = by_model.setdefault(p["model"], {"model": p["model"], "probes": 0, "ok": 0, "errors": {}})
        m["probes"] += 1
        if p.get("ok"):
            m["ok"] += 1
        else:
            e = p.get("err", "unknown")
            m["errors"][e] = m["errors"].get(e, 0) + 1
    for m in by_model.values():
        m["availability"] = round(m["ok"] / m["probes"], 4)
    availability = {
        "source_file": "data/model_availability.jsonl",
        "probes_total": len(probes),
        "first": min(p["ts"] for p in probes),
        "last": max(p["ts"] for p in probes),
        "models": sorted(by_model.values(), key=lambda m: m["model"]),
    }

    ab = {
        "$comment": "Generated by web/build_data.py from reports/ab_*.json. Do not hand-edit.",
        "generated_from": "reports/ab_*.json",
        "model": "moonshotai/Kimi-K3-TEE",
        "model_label": "Kimi K3",
        "endpoint": "llm.chutes.ai/v1/chat/completions",
        "temperature": 0.6,
        "date": "2026-08-06",
        "harness_script": "bench/ab_harness.py",
        "arms": {
            "RLM": "one tool, `python`, over the persistent IPython kernel, with the real rlm_mode.md prompt",
            "CLASSIC": "the same capabilities as four conventional tool schemas: list_dir, read_file, grep, shell. Same 8 KiB output cap.",
        },
        "caveat": "n = 1–3 trials per cell. Directional, not publishable. This is NOT chutescoder vs. upstream Codex — it is a controlled measurement of the one variable the RLM design is about.",
        "metrics": METRICS,
        "tasks": tasks,
    }

    (OUT / "ab_harness.json").write_text(json.dumps(ab, indent=2) + "\n")
    (OUT / "availability.json").write_text(json.dumps(availability, indent=2) + "\n")
    print(f"wrote data/ab_harness.json ({len(tasks)} tasks) and data/availability.json "
          f"({len(availability['models'])} models, {len(probes)} probes)")


if __name__ == "__main__":
    main()
