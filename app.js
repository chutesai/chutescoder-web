/* ============================================================
   chutescoder announcement page
   Plain ES2019. No dependencies, no network calls off-origin.
   All numbers come from ./data/*.json — never from this file.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  /* ---------------------------------------------------------- theme */
  (function theme() {
    var root = document.documentElement;
    var stored = null;
    try { stored = localStorage.getItem("cc-theme"); } catch (e) {}
    if (stored === "light" || stored === "dark") root.setAttribute("data-theme", stored);
    else root.removeAttribute("data-theme");

    var btn = $("#theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var cur = root.getAttribute("data-theme");
      if (!cur) {
        var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
        cur = prefersLight ? "light" : "dark";
      }
      var next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("cc-theme", next); } catch (e) {}
    });
  })();

  /* ---------------------------------------------- python highlighter */
  var PY = new RegExp([
    "(#[^\\n]*)",                                                        // 1 comment
    "(f?\"(?:[^\"\\\\\\n]|\\\\.)*\"|f?'(?:[^'\\\\\\n]|\\\\.)*')",        // 2 string
    "\\b(await|async|for|in|if|else|elif|not|and|or|return|import|from|def|class|lambda|None|True|False|with|as|while|try|except|pass|yield|del|global)\\b", // 3 keyword
    "\\b(\\d+(?:\\.\\d+)?)\\b",                                          // 4 number
    "\\b(shell|sh|read_file|write_file|apply_patch|list_dir|grep|web_search|web_fetch|mcp_list|mcp_call|llm|ctx|out|inbox|rlm|agent_message|asyncio|print|len|list|dict|Path|json|re|os|sys|time)\\b" // 5 builtin
  ].join("|"), "g");

  function highlight(src) {
    var html = "", last = 0, m;
    PY.lastIndex = 0;
    while ((m = PY.exec(src)) !== null) {
      html += esc(src.slice(last, m.index));
      var cls = m[1] ? "tok-c" : m[2] ? "tok-s" : m[3] ? "tok-k" : m[4] ? "tok-n" : "tok-b";
      html += '<span class="' + cls + '">' + esc(m[0]) + "</span>";
      last = m.index + m[0].length;
    }
    html += esc(src.slice(last));
    return html;
  }

  $$("pre.code > code").forEach(function (el) { el.innerHTML = highlight(el.textContent); });

  /* ------------------------------------------------ source popover */
  var pop = $("#src-pop");
  function showPop(el) {
    if (!pop) return;
    var title = el.getAttribute("data-src-title") || "";
    var note = el.getAttribute("data-src-note") || "";
    var url = el.getAttribute("data-src-url") || "";
    if (!title && !note && !url) return;
    pop.innerHTML = (title ? "<b>" + esc(title) + "</b>" : "") +
      (note ? esc(note) + " " : "") +
      (url ? '<span class="u">' + esc(url) + "</span>" : "");
    pop.hidden = false;
    var r = el.getBoundingClientRect();
    var w = Math.min(340, window.innerWidth - 24);
    var x = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    var ph = pop.offsetHeight;
    var y = r.bottom + 10 + ph > window.innerHeight ? Math.max(12, r.top - ph - 10) : r.bottom + 10;
    pop.style.left = x + "px";
    pop.style.top = y + "px";
    pop.style.maxWidth = w + "px";
  }
  function hidePop() { if (pop) pop.hidden = true; }
  document.addEventListener("mouseover", function (e) {
    var t = e.target.closest ? e.target.closest("[data-src-url],[data-src-note]") : null;
    if (t) showPop(t); else if (!pop.hidden) hidePop();
  });
  document.addEventListener("focusin", function (e) {
    var t = e.target.closest ? e.target.closest("[data-src-url],[data-src-note]") : null;
    if (t) showPop(t);
  });
  document.addEventListener("focusout", hidePop);
  window.addEventListener("scroll", hidePop, { passive: true });

  /* ------------------------------------------------------- fetching */
  function load(path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " → HTTP " + r.status);
      return r.json();
    });
  }
  function fail(node, err, what) {
    if (!node) return;
    node.innerHTML = '<p class="loading">Could not load ' + esc(what) + ": " + esc(err.message) +
      ". If you are opening this file directly from disk, serve it over HTTP instead " +
      "(<code>python3 -m http.server</code>).</p>";
  }

  /* =========================================================
     1. Harness-spread dot plot
     ========================================================= */
  load("data/harness_spread.json").then(renderSpread).catch(function (e) {
    fail($("#spread-chart"), e, "harness_spread.json");
  });

  function renderSpread(d) {
    var host = $("#spread-chart");
    var W = 900, PADL = 250, PADR = 158;
    var rowH = 58, top = 30;
    var rows = d.entries.slice().sort(function (a, b) { return b.score - a.score; });
    var plotL = PADL + 8, plotR = W - PADR;
    var lo = d.axis.min, hi = d.axis.max;
    var x = function (v) { return plotL + (v - lo) / (hi - lo) * (plotR - plotL); };

    var axisY = top + rows.length * rowH + 14;
    var H = axisY + 74;

    var colors = ["var(--violet)", "var(--accent)", "var(--warn)"];
    var svg = [];
    svg.push('<svg viewBox="0 0 ' + W + " " + H + '" role="img" style="width:100%;height:auto;display:block" ' +
      'aria-label="Dot plot: Kimi K3 on Terminal-Bench 2.1 scored 88.3 by Moonshot with KimiCode, 85.02 by Artificial Analysis with Terminus 2, and 80.90 by Vals AI with Terminus 2.">');

    // spread band
    var bandLo = Math.min.apply(null, rows.map(function (r) { return r.score; }));
    var bandHi = Math.max.apply(null, rows.map(function (r) { return r.score; }));
    svg.push('<rect class="ch-band" x="' + x(bandLo).toFixed(1) + '" y="' + (top - 6) + '" width="' +
      (x(bandHi) - x(bandLo)).toFixed(1) + '" height="' + (axisY - top + 2) + '" rx="6"/>');
    svg.push('<line class="ch-bandedge" x1="' + x(bandLo).toFixed(1) + '" y1="' + (top - 6) + '" x2="' + x(bandLo).toFixed(1) + '" y2="' + (axisY + 2) + '"/>');
    svg.push('<line class="ch-bandedge" x1="' + x(bandHi).toFixed(1) + '" y1="' + (top - 6) + '" x2="' + x(bandHi).toFixed(1) + '" y2="' + (axisY + 2) + '"/>');

    rows.forEach(function (r, i) {
      var cy = top + i * rowH + rowH / 2;
      var col = colors[i % colors.length];
      var note = (r.note || "") + (r.in_public_scores ? " Present verbatim in public_scores.json." : " Not in public_scores.json — verified directly against the source.");
      svg.push('<g class="dot-row" tabindex="0" data-src-title="' + esc(r.evaluator + " · " + r.harness) +
        '" data-src-note="' + esc(note) + '" data-src-url="' + esc(r.source_url) + '">');
      svg.push('<rect class="dr-hit" x="0" y="' + (cy - rowH / 2) + '" width="' + W + '" height="' + rowH + '" rx="8"/>');
      svg.push('<text class="ch-label" x="16" y="' + (cy - 2) + '">' + esc(r.evaluator_short) + "</text>");
      svg.push('<text class="ch-sub" x="16" y="' + (cy + 16) + '">' + esc(r.harness + " harness · " + r.source_type) + "</text>");
      svg.push('<line class="ch-connector" x1="' + plotL + '" y1="' + cy + '" x2="' + x(r.score).toFixed(1) + '" y2="' + cy + '"/>');
      svg.push('<circle class="ch-dot" cx="' + x(r.score).toFixed(1) + '" cy="' + cy + '" r="8" fill="' + col + '"/>');
      svg.push('<text class="ch-value" x="' + (plotR + 18) + '" y="' + (cy - 1) + '">' + r.score.toFixed(2) + '<tspan class="ch-src"> %</tspan></text>');
      svg.push('<text class="ch-src" x="' + (plotR + 18) + '" y="' + (cy + 16) + '">source ↗</text>');
      svg.push("</g>");
    });

    // axis
    svg.push('<line class="ch-axis-line" x1="' + plotL + '" y1="' + axisY + '" x2="' + plotR + '" y2="' + axisY + '"/>');
    for (var v = lo; v <= hi + 0.001; v += 2) {
      svg.push('<line class="ch-tick" x1="' + x(v).toFixed(1) + '" y1="' + axisY + '" x2="' + x(v).toFixed(1) + '" y2="' + (axisY + 5) + '"/>');
      svg.push('<text class="ch-ticklabel" text-anchor="middle" x="' + x(v).toFixed(1) + '" y="' + (axisY + 20) + '">' + v + "</text>");
    }
    svg.push('<text class="ch-ticklabel" x="16" y="' + (axisY + 20) + '">% resolved, Terminal-Bench 2.1</text>');

    // spread annotation
    var midX = (x(bandLo) + x(bandHi)) / 2;
    var sy = axisY + 44;
    svg.push('<line class="ch-bandedge" x1="' + x(bandLo).toFixed(1) + '" y1="' + sy + '" x2="' + x(bandHi).toFixed(1) + '" y2="' + sy + '"/>');
    svg.push('<text class="ch-spread" text-anchor="middle" x="' + midX.toFixed(1) + '" y="' + (sy + 20) + '">' +
      esc(d.spread.toFixed(1)) + " points of spread — same model, same benchmark</text>");
    svg.push("</svg>");

    host.innerHTML = svg.join("");

    var foot = $("#spread-foot");
    if (foot) {
      foot.innerHTML =
        "<p style='margin:0 0 10px'>" + esc(d.spread_note) + "</p>" +
        '<div class="chart-legend">' + rows.map(function (r, i) {
          return '<span class="k"><i style="background:' + colors[i % colors.length] + '"></i>' +
            '<a href="' + esc(r.source_url) + '" rel="noopener">' + esc(r.evaluator) + "</a>" +
            (r.in_public_scores ? "" : ' <span class="dim">(source-verified, not in public_scores.json)</span>') +
            "</span>";
        }).join("") + "</div>";
    }
  }

  /* =========================================================
     2. Results — driven entirely by data/results.json
     ========================================================= */
  load("data/results.json").then(renderResults).catch(function (e) {
    fail($("#results-tables"), e, "results.json");
    fail($("#results-status"), e, "results.json");
  });

  function cellKey(b, m, a) { return b + "|" + m + "|" + a; }

  function renderResults(d) {
    var byKey = {};
    (d.cells || []).forEach(function (c) { byKey[cellKey(c.benchmark, c.model, c.arm)] = c; });

    // -------- expected grid
    var expected = [];
    d.benchmarks.forEach(function (b) {
      b.arms.forEach(function (a) {
        d.models.forEach(function (m) { expected.push({ b: b, m: m, a: a }); });
      });
    });
    var measured = expected.filter(function (x) {
      var c = byKey[cellKey(x.b.id, x.m.id, x.a)];
      return c && c.state === "measured" && c.score != null;
    }).length;

    // -------- status hero
    var pct = expected.length ? Math.round(measured / expected.length * 100) : 0;
    var atRisk = d.models.filter(function (m) { return m.at_risk; });
    var st = $("#results-status");
    st.innerHTML =
      '<div class="ph-top">' +
        '<span class="pill ' + (measured ? "pill-third" : "pill-pending") + '">' +
          (measured ? "partial results" : "measurements in progress") + "</span>" +
        '<span class="ph-head">' + esc(d.headline) + "</span>" +
      "</div>" +
      '<p class="ph-sub">This table is rendered from <code>data/results.json</code>. Every ' +
        "(benchmark × model × arm) cell that has not been scored by a real, non-discarded run is " +
        "shown empty and marked pending. When the runs land, only that file changes.</p>" +
      '<div class="ph-meter"><i style="width:' + pct + '%"></i></div>' +
      '<p class="ph-count"><b>' + measured + "</b> of <b>" + expected.length +
        "</b> cells measured &middot; " + esc(d.benchmarks.length) + " benchmarks × " +
        esc(d.models.length) + " models × arms &middot; harness commit: " +
        (d.harness_commit ? "<b>" + esc(d.harness_commit) + "</b>" : "not yet pinned") + "</p>" +
      (atRisk.length
        ? atRisk.map(function (m) {
            return '<p class="ph-count" style="margin-top:10px"><span class="pill pill-risk">at risk</span> ' +
              '<span data-src-title="' + esc(m.label + " capacity risk") + '" data-src-note="' +
              esc(m.at_risk_reason) + '" style="cursor:help;border-bottom:1px dotted var(--border-2)">' +
              esc(m.label) + " — capacity</span></p>";
          }).join("")
        : "");

    // -------- arm legend
    var leg = $("#arm-legend");
    leg.innerHTML = d.arms.map(function (a) {
      return '<div class="arm arm-' + esc(a.id) + '"><h4>' + esc(a.label) + "</h4><p>" + esc(a.desc) + "</p></div>";
    }).join("");

    // -------- per-benchmark tables
    var out = d.benchmarks.map(function (b) {
      var rows = [];
      b.arms.forEach(function (a) {
        d.models.forEach(function (m) {
          var c = byKey[cellKey(b.id, m.id, a)];
          var armLabel = (d.arms.filter(function (x) { return x.id === a; })[0] || {}).short || a;
          var state = c ? c.state : "pending";
          var pill = state === "measured" ? '<span class="pill pill-third">measured</span>'
            : state === "blocked" ? '<span class="pill pill-risk">blocked</span>'
            : '<span class="pill pill-pending">pending</span>' +
              (m.at_risk ? ' <span class="flagged" data-src-title="' + esc(m.label + " capacity risk") +
                '" data-src-note="' + esc(m.at_risk_reason) + '">▲</span>' : "");
          var val = function (k, suffix) {
            return c && c[k] != null ? esc(c[k]) + (suffix || "") : '<span class="empty">—</span>';
          };
          rows.push(
            "<tr>" +
              "<td>" + esc(m.label) + "</td>" +
              "<td><b>" + esc("Arm " + a) + "</b> <span class='dim'>" + esc(armLabel) + "</span></td>" +
              '<td class="num">' + (c && c.score != null ? "<b>" + esc(c.score) + "</b>" : '<span class="empty">—</span>') + "</td>" +
              '<td class="num">' + val("n") + "</td>" +
              '<td class="num">' + val("tokens") + "</td>" +
              '<td class="num">' + val("cost_usd") + "</td>" +
              "<td>" + pill + "</td>" +
            "</tr>");
        });
      });
      return '<div class="bench-block">' +
        '<div class="bench-head"><h4>' + esc(b.label) + "</h4>" +
          '<span class="bench-meta">' + esc(b.measures) + " &middot; metric: " + esc(b.metric) +
          (b.subset ? " &middot; fixed random subset ≥10%, same seed across arms" : "") + "</span></div>" +
        '<div class="bench-ref"><b>Published reference:</b> ' + esc(b.public_reference) + "</div>" +
        '<div class="table-scroll" style="border:none;border-radius:0;margin:0">' +
        '<table class="cells"><thead><tr><th>Model</th><th>Arm</th><th class="num">Score</th>' +
        '<th class="num">n</th><th class="num">tokens</th><th class="num">cost&nbsp;$</th><th>Status</th></tr></thead>' +
        "<tbody>" + rows.join("") + "</tbody></table></div></div>";
    }).join("");

    $("#results-tables").innerHTML = out;
  }

  /* =========================================================
     3. Published scores table
     ========================================================= */
  var SCORES = [], sortKey = "benchmark", sortAsc = true;

  load("data/public_scores.json").then(function (rows) {
    SCORES = rows;
    var cnt = $("#record-count"); if (cnt) cnt.textContent = rows.length;

    var models = [], types = [];
    rows.forEach(function (r) {
      if (models.indexOf(r.model) < 0) models.push(r.model);
      if (types.indexOf(r.source_type) < 0) types.push(r.source_type);
    });
    models.sort(); types.sort();
    var fm = $("#f-model"), ft = $("#f-type");
    models.forEach(function (m) { fm.insertAdjacentHTML("beforeend", '<option value="' + esc(m) + '">' + esc(m) + "</option>"); });
    types.forEach(function (t) { ft.insertAdjacentHTML("beforeend", '<option value="' + esc(t) + '">' + esc(t) + "</option>"); });

    ["#q", "#f-model", "#f-type"].forEach(function (s) {
      $(s).addEventListener("input", drawScores);
      $(s).addEventListener("change", drawScores);
    });
    $("#f-reset").addEventListener("click", function () {
      $("#q").value = ""; $("#f-model").value = ""; $("#f-type").value = ""; drawScores();
    });
    $$("#scores-table th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.getAttribute("data-sort");
        if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = true; }
        drawScores();
      });
    });

    drawScores();
    renderFooterFine(rows);
  }).catch(function (e) {
    var b = $("#scores-body");
    if (b) b.innerHTML = '<tr><td colspan="6"><span class="loading">Could not load public_scores.json: ' +
      esc(e.message) + ". Serve this page over HTTP (<code>python3 -m http.server</code>).</span></td></tr>";
  });

  var PILL = {
    "third-party verified": "pill-third",
    "lab self-reported": "pill-self",
    "competitor-reported": "pill-comp"
  };

  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } }

  function drawScores() {
    var q = ($("#q").value || "").toLowerCase().trim();
    var fm = $("#f-model").value, ft = $("#f-type").value;

    var rows = SCORES.filter(function (r) {
      if (fm && r.model !== fm) return false;
      if (ft && r.source_type !== ft) return false;
      if (q && (r.benchmark + " " + r.variant + " " + r.model).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    rows.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      if (sortKey === "score") { return sortAsc ? x - y : y - x; }
      x = String(x).toLowerCase(); y = String(y).toLowerCase();
      return (x < y ? -1 : x > y ? 1 : 0) * (sortAsc ? 1 : -1);
    });

    $$("#scores-table th.sortable").forEach(function (th) {
      th.classList.toggle("sorted", th.getAttribute("data-sort") === sortKey);
      th.classList.toggle("asc", th.getAttribute("data-sort") === sortKey && sortAsc);
    });

    var flagged = /tau2-bench/i;
    $("#scores-body").innerHTML = rows.map(function (r) {
      var isFlagged = flagged.test(r.benchmark) && r.model.indexOf("GLM") === 0;
      return "<tr>" +
        '<td class="t-bench">' + esc(r.benchmark) +
          (isFlagged ? '<span class="flagged" data-src-title="Flagged: probably not a full run" ' +
            'data-src-note="This value sits far above every peer and is almost certainly a single easy subset rather than a full tau2-bench run. Transcribed verbatim from the source, but do not cite it.">▲</span>' : "") +
        "</td>" +
        "<td>" + esc(r.model) + "</td>" +
        '<td class="num">' + esc(r.score) + '<span class="t-unit">' + esc(r.unit === "%" ? "%" : " " + r.unit) + "</span></td>" +
        '<td class="t-variant">' + esc(r.variant) + "</td>" +
        '<td><span class="pill ' + (PILL[r.source_type] || "pill-pending") + '">' + esc(r.source_type) + "</span></td>" +
        '<td><a class="src-link" href="' + esc(r.source_url) + '" rel="noopener" ' +
          'data-src-title="' + esc(r.benchmark + " — " + r.model) + '" ' +
          'data-src-note="' + esc((r.notes || "") + " Dated " + r.date + ".") + '" ' +
          'data-src-url="' + esc(r.source_url) + '">' + esc(hostOf(r.source_url)) + " ↗</a></td>" +
      "</tr>";
    }).join("");

    $("#filter-count").textContent = rows.length + " / " + SCORES.length + " records";
  }

  function renderFooterFine(rows) {
    var counts = {};
    rows.forEach(function (r) { counts[r.source_type] = (counts[r.source_type] || 0) + 1; });
    var parts = Object.keys(counts).sort().map(function (k) { return counts[k] + " " + k; });
    var f = $("#footer-fine");
    if (f) {
      f.innerHTML = "Published-score dataset: <b>" + rows.length + "</b> records — " + esc(parts.join(", ")) +
        ". Compiled 2026-08-06 from the Artificial Analysis v2 API and the two official model cards; " +
        "no aggregator or comparison site was used as a source. Benchmark results on this page are " +
        "rendered from <code>data/results.json</code> and are empty until measured. " +
        "chutescoder is a fork of openai/codex (Apache-2.0); the RLM design re-implements ideas " +
        "published by Prime Intellect, with no Prime Agent code used.";
    }
  }

  /* =========================================================
     4. Gaps table (transcribed from docs/PUBLIC_BENCHMARK_SCORES.md §7)
        Nothing here is a score — these are absences.
     ========================================================= */
  var GAPS = [
    ["SWE-bench Verified", null, null, "Neither lab publishes it. Moonshot uses DeepSWE / FrontierSWE / SWE-Marathon; Z.ai uses SWE-bench Pro. No entry on swebench.com for either."],
    ["SWE-bench Pro", null, "62.1 % (self-reported)", "Kimi does not report it."],
    ["SWE-bench Multilingual", null, null, ""],
    ["SWE-Lancer", null, null, ""],
    ["Aider Polyglot", null, null, "The Aider leaderboard appears not to have been updated for either model."],
    ["LiveCodeBench", null, null, "AA field present but null for all four variants."],
    ["BigCodeBench", null, null, ""],
    ["Multi-SWE-bench", null, null, ""],
    ["Terminal-Bench 2.0", null, null, "Both report 2.1 only."],
    ["Terminal-Bench Hard", null, "50.76 % (AA)", ""],
    ["MRCR / OpenAI MRCR", null, null, "No MRCR number for either, despite 1M context."],
    ["RULER", null, null, ""],
    ["LongBench v2", null, null, ""],
    ["OOLONG", null, null, "One of our own benchmarks — no published baseline to compare against."],
    ["Fiction.LiveBench", null, null, "Page fetched but rendered no data table."],
    ["NIAH variants", null, null, ""],
    ["tau-bench / tau²-bench", null, "99.12 % (AA, flagged)", "τ³-Banking is available for both instead."],
    ["BrowseComp", "91.2 % (self-reported)", null, ""],
    ["GAIA", null, null, ""],
    ["ARC-AGI-2 / ARC-AGI-3", null, null, "No ARC Prize entry found for either."],
    ["Vending-Bench", null, null, ""],
    ["MMLU-Pro", null, null, "AA field null for all four variants."],
    ["AIME 2025", null, null, "AA aime_25 null; Z.ai reports AIME 2026 only."],
    ["AIME 2026", null, "99.2 % (self-reported)", ""],
    ["LMArena Elo", null, null, "Not confirmed from a primary LMArena source."]
  ];

  (function renderGaps() {
    var body = $("#gaps-body");
    if (!body) return;
    body.innerHTML = GAPS.map(function (g) {
      var cell = function (v) {
        return v ? '<span class="gap-has">' + esc(v) + "</span>" : '<span class="gap-nf">not found</span>';
      };
      return "<tr><td class='t-bench'>" + esc(g[0]) + "</td><td>" + cell(g[1]) + "</td><td>" + cell(g[2]) +
        "</td><td class='t-variant'>" + esc(g[3] || "") + "</td></tr>";
    }).join("");
  })();

})();
