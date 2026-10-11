/* Lessons: the ZERA Life Competencies programme (Year 1–6, 234 weeks) inside Class Points.
   Lesson content comes from assets/lc-data.js (window.LC), bundled from the Life Competencies app by lc/build.mjs.
   Stars earned in lessons go straight into the group jars through window.ClassPoints. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const CP = () => window.ClassPoints;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (t) => String(t ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const KEY = "class-points-lessons";
  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  const TILE_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#22c55e", "#a855f7", "#14b8a6"];

  let LC = null, loading = null;
  let pick = loadPick();
  function loadPick() { try { return { year: 1, term: 1, week: 1, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { year: 1, term: 1, week: 1 }; } }
  function savePick() { try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch { /* private mode */ } }

  // Lessons come from the copy built into Class Points. Only the 🔄 Sync button contacts the Life Competencies app:
  // it downloads the lessons that app publishes on every deploy and keeps them on this device (Cache Storage),
  // so later visits use the synced lessons without downloading again.
  const LIVE_DATA = window.LC_SYNC_URL || "https://zera-life-competencies.vercel.app/class-points/lc-data.js";
  // Live Class runs in the Life Competencies app itself (its /play page for students, its Live Class screen + board for the teacher)
  const LC_APP = "https://zera-life-competencies.vercel.app";
  const LOCAL_DATA = "assets/lc-data.js?v=4a6331";
  const SYNC_CACHE = "class-points-lessons", SYNC_KEY = "/synced-lc-data.js";
  const NEEDS = ["LESSON_PLANS", "noteFor", "deepFor", "visualFor", "quizTen", "optionsForItem", "buildLesson", "expandActivity", "gameFor", "buildGameHtml", "runThemeFor", "buildPlatformerHtml", "runLevels"];
  const usable = (x) => x && NEEDS.every((k) => k in x) && Array.isArray(x.LESSON_PLANS) && x.LESSON_PLANS.length > 0;
  function loadScript(src, ms = 15000) {
    return new Promise((res, rej) => {
      const before = window.LC;
      window.LC = undefined; // the bundle declares a global "var LC", which can't be deleted
      const s = document.createElement("script");
      const t = setTimeout(() => { s.remove(); window.LC = before; rej(new Error("timeout")); }, ms);
      s.src = src;
      s.onload = () => { clearTimeout(t); const x = window.LC; if (usable(x)) res(x); else { window.LC = before; rej(new Error("unexpected lesson data")); } };
      s.onerror = () => { clearTimeout(t); window.LC = before; rej(new Error("offline")); };
      document.head.appendChild(s);
    });
  }
  const fromText = (text) => { const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" })); return loadScript(url).finally(() => URL.revokeObjectURL(url)); };
  async function syncedText() {
    try { const c = await caches.open(SYNC_CACHE); const r = await c.match(SYNC_KEY); return r ? await r.text() : null; } catch { return null; }
  }
  let source = "";
  function loadData() {
    if (LC) return Promise.resolve(LC);
    if (loading) return loading;
    loading = syncedText()
      .then((t) => (t ? fromText(t).then((x) => { source = "synced"; return x; }) : Promise.reject(new Error("none"))))
      .catch(() => loadScript(LOCAL_DATA).then((x) => { source = "copy"; return x; }))
      .then((x) => { LC = x; return x; })
      .catch(() => { loading = null; throw new Error("Could not load the lessons"); });
    return loading;
  }
  // The 🔄 button: download the latest lessons once, check them, keep them on this device
  async function syncNow(btn) {
    btn.disabled = true; btn.textContent = "🔄 Syncing…";
    try {
      const r = await fetch(`${LIVE_DATA}?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) throw new Error("offline");
      const text = await r.text();
      const before = LC?.BUILT?.commit;
      const x = await fromText(text);
      try { const c = await caches.open(SYNC_CACHE); await c.put(SYNC_KEY, new Response(text, { headers: { "Content-Type": "text/javascript" } })); } catch { /* still use it this visit */ }
      LC = x; source = "synced"; loading = Promise.resolve(x);
      CP().toast(before && before === x.BUILT?.commit ? "✅ Already up to date with Life Competencies" : "🎉 Lessons synced with Life Competencies");
      CP().confetti(70);
      renderLessons();
    } catch (e) {
      btn.dataset.why = e?.message || String(e); // kept for troubleshooting
      CP().toast("⚠️ Couldn't reach the Life Competencies app — check the internet and try again");
      btn.disabled = false; btn.textContent = "🔄 Sync with Life Competencies";
    }
  }
  function syncBar() {
    const at = LC?.BUILT?.at ? new Date(LC.BUILT.at) : null;
    const when = at ? at.toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const what = source === "synced" ? `🔄 Synced lessons${when ? ` · from ${when}` : ""}` : `📦 Built-in lessons${when ? ` · from ${when}` : ""}`;
    return `<div class="lc-syncbar"><span class="lc-sync ${source === "synced" ? "ok" : ""}">${what}</span>
      <button class="btn ghost lc-syncbtn" data-sync title="Download the latest lessons from your Life Competencies app">🔄 Sync with Life Competencies</button></div>`;
  }

  const planFor = (year, term) => LC.LESSON_PLANS.find((p) => p.year === year && p.term === term);
  // Pictures drawn for warm-ups that say "Show a picture / photo of …" (assets/pictures/<plan>-<week>.svg)
  const PICTURES = { "y1-t1-3": "A child sitting alone at the edge of the playground", "y1-t2-11": "Litter in a playground", "y5-t2-2": "A photo with no caption" };
  const pictureFor = (planId, week) => (PICTURES[`${planId}-${week}`] ? { src: `assets/pictures/${planId}-${week}.svg`, alt: PICTURES[`${planId}-${week}`] } : null);
  const pictureHtml = (pic) => (pic ? `<button class="lc-pic-btn" data-zoom="${pic.src}" title="Tap to show it full screen"><img src="${pic.src}" alt="${esc(pic.alt)}"><span>⛶ Full screen</span></button>` : "");
  // Tap a picture: it fills the screen for the class; tap again (or Esc) to close
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-zoom]"); if (!b) return;
    const v = document.createElement("div"); v.className = "lc-zoom"; v.innerHTML = `<img src="${b.dataset.zoom}" alt=""><button class="lc-x" aria-label="Close">✕</button>`;
    const close = (ev) => { if (ev.type === "keydown" && ev.key !== "Escape") return; ev.stopImmediatePropagation?.(); v.remove(); document.removeEventListener("keydown", close, true); };
    v.onclick = close; document.addEventListener("keydown", close, true); document.body.appendChild(v);
  });
  // Model answers for each warm-up (assets/warmup-answers.js), behind a "💡 Show answer" button so the class thinks first
  const warmAnswerHtml = (planId, week) => { const a = (window.WARMUP_ANSWERS || {})[`${planId}-${week}`];
    return a?.length ? `<details class="lc-ans"><summary>💡 Show answer</summary><ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""; };
  const weekOf = (plan, week) => plan.weeks.find((w) => w.week === week) || plan.weeks[0];
  // The term as the Life Competencies app schedules it: calendar weeks, the class's real date, holidays that
  // move a lesson to the next time the class meets, and weeks taught together. Older synced data has no
  // schedule, so it falls back to one lesson per calendar week.
  const schedules = new Map();
  function schedule(plan) {
    const k = plan.id + "@" + (LC.BUILT?.at || "");
    if (!schedules.has(k)) {
      let rows = null;
      try { rows = LC.termSchedule ? LC.termSchedule(plan.id) : null; } catch { rows = null; }
      if (rows) rows = rows.filter((r) => r.weeks.length || r.note); // undated terms: no empty weeks at the end
      if (!rows || !rows.some((r) => r.weeks.length)) rows = plan.weeks.map((w) => ({ cal: `Week ${w.week}`, date: "", time: "", note: "", weeks: [w.week] }));
      schedules.set(k, rows);
    }
    return schedules.get(k);
  }
  // The calendar week (and date) a lesson week is taught in, e.g. lesson 6 → "Week 7", "Wed 7.10.2026"
  function calOf(plan, week) {
    const r = schedule(plan).find((x) => x.weeks.includes(week));
    return { label: r?.cal || `Week ${week}`, date: r?.date || "", time: r?.time || "", with: (r?.weeks || [week]).filter((n) => n !== week) };
  }
  const dayOf = (label) => { const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(label || ""); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
  // The class's next lesson (today counts), across the year's three terms
  function nextLesson(year) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const term of [1, 2, 3]) {
      const plan = planFor(year, term); if (!plan) continue;
      const r = schedule(plan).find((x) => x.weeks.length && dayOf(x.date) && dayOf(x.date) >= today);
      if (r) return { term, week: r.weeks[0], planId: plan.id };
    }
    return null;
  }
  // A week's focus may start with its emoji; if not, borrow the emoji from the week's teaching visual
  const focusParts = (focus, plan, week) => {
    const m = String(focus).match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
    if (m) return { emoji: m[1], text: m[2] };
    let emoji = "📘";
    try { if (plan) emoji = LC.visualFor(plan.id, week, LC.noteFor(plan.id, week))?.emoji || emoji; } catch { /* keep the book */ }
    return { emoji, text: focus };
  };

  /* ---------------- Home: one button per year group ---------------- */
  const YEAR_LOOK = {
    1: { emoji: "🌱", from: "#22c55e", to: "#14b8a6" }, 2: { emoji: "🧭", from: "#f97316", to: "#ec4899" },
    3: { emoji: "🔍", from: "#6366f1", to: "#a855f7" }, 4: { emoji: "🌍", from: "#0ea5e9", to: "#22c55e" },
    5: { emoji: "💡", from: "#eab308", to: "#f97316" }, 6: { emoji: "🎓", from: "#d946ef", to: "#6366f1" },
  };
  const theme = (y) => { try { return LC.yearTheme(y) || {}; } catch { return {}; } };
  async function renderHome() {
    const root = $("#homeRoot"); if (!root) return;
    if (!LC) {
      root.innerHTML = `<div class="home-years">${[1, 2, 3, 4, 5, 6].map((y) => `<button class="home-year" style="--a:${YEAR_LOOK[y].from};--b:${YEAR_LOOK[y].to}" data-y="${y}"><span class="e">${YEAR_LOOK[y].emoji}</span><b>Year ${y}</b></button>`).join("")}</div>`;
      wireHome(root);
      try { await loadData(); } catch { return; }
    }
    root.innerHTML = `<div class="home-years">${[1, 2, 3, 4, 5, 6].map((y) => {
      const t = theme(y), L = YEAR_LOOK[y];
      const topics = [1, 2, 3].map((n) => planFor(y, n)).filter(Boolean);
      return `<button class="home-year" style="--a:${L.from};--b:${L.to};animation-delay:${(y - 1) * 0.06}s" data-y="${y}">
        <span class="e">${L.emoji}</span><b>Year ${y}</b>${t.theme ? `<span class="t">${esc(t.theme)}</span>` : ""}
        <small>${topics.map((p) => esc(p.title)).join(" · ")}</small></button>`;
    }).join("")}</div>`;
    wireHome(root);
  }
  function wireHome(root) {
    $$("[data-y]", root).forEach((b) => b.onclick = () => {
      const y = +b.dataset.y;
      const next = LC ? nextLesson(y) : null;
      pick = next ? { year: y, term: next.term, week: next.week } : pick.year !== y ? { year: y, term: 1, week: 1 } : pick;
      savePick();
      document.querySelector('[data-tab="lessons"]').click();
    });
  }
  function yearHeader(y) {
    const t = theme(y), L = YEAR_LOOK[y];
    return `<div class="year-head" style="--a:${L.from};--b:${L.to}">
      <button class="btn ghost" data-home>‹ All years</button>
      <span class="e">${L.emoji}</span><div><h2>Year ${y}</h2>${t.theme ? `<p>${esc(t.theme)}</p>` : ""}</div></div>`;
  }
  const list = (arr, cls = "") => (arr && arr.length ? `<ul class="lc-dl ${cls}">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const chips = (arr, icon, cls = "") => (arr && arr.length ? `<div class="lc-badges">${arr.map((x) => `<span class="lc-badge ${cls}">${icon} ${esc(x)}</span>`).join("")}</div>` : "");
  // About the term: colourful category buttons; tap one and only its information shows (tap again to hide)
  let aboutCat = null, weeksOpen = false;
  function termDetails(plan) {
    const tt = (theme(plan.year).terms || []).find((x) => x.term === plan.term) || {}, L = YEAR_LOOK[plan.year] || {};
    const cards = (arr) => `<div class="ab-cards">${arr.map((x, i) => `<div class="ab-card" style="--i:${i}"><span class="n">${i + 1}</span><p>${esc(x)}</p></div>`).join("")}</div>`;
    const pills = (arr, icon) => `<div class="ab-pills">${arr.map((x, i) => `<span class="ab-pill" style="--i:${i}">${icon} ${esc(x)}</span>`).join("")}</div>`;
    const cats = [
      ["comp", "🧠", "Competencies", "#7c3aed", "#c084fc", plan.competencies?.length && pills(plan.competencies, "🧠")],
      ["values", "💎", "Values", "#f59e0b", "#fcd34d", plan.values?.length && pills(plan.values, "💎")],
      ["themes", "🌐", "Key themes", "#0ea5e9", "#67e8f9", tt.cambridgeKeyThemes?.length && pills(tt.cambridgeKeyThemes, "🌐")],
      ["bigq", "❓", "Big questions", "#e11d48", "#fda4af", plan.essentialQuestions?.length && cards(plan.essentialQuestions)],
      ["obj", "🎯", "Objectives", "#2563eb", "#93c5fd", plan.objectives?.length && cards(plan.objectives)],
      ["success", "✅", "Success criteria", "#16a34a", "#86efac", plan.successCriteria?.length && cards(plan.successCriteria)],
      ["skills", "🔑", "Key skills", "#db2777", "#f9a8d4", plan.keySkills?.length && pills(plan.keySkills, "⭐")],
    ].filter((c) => c[5]);
    const cur = cats.find((c) => c[0] === aboutCat);
    return `<section class="card ab" data-about>
      <div class="ab-head" style="--a:${L.from || "#6b4dff"};--b:${L.to || "#ff6fb5"}">
        <span class="ab-e">${L.emoji || "📋"}</span>
        <div><small>About Term ${plan.term}</small><h3>${esc(plan.title)}</h3>${tt.focus ? `<p>${esc(tt.focus)}</p>` : ""}</div>
        ${plan.duration ? `<span class="ab-time">⏱️ ${esc(plan.duration)} per lesson</span>` : ""}
      </div>
      <div class="ab-btns">${cats.map(([k, e, t, a, b]) => `<button class="ab-btn ${k === aboutCat ? "on" : ""}" data-cat="${k}" style="--a:${a};--b:${b}" aria-pressed="${k === aboutCat}"><span>${e}</span><b>${t}</b></button>`).join("")}</div>
      <div class="ab-panel">${cur ? `<div class="ab-show" style="--a:${cur[3]};--b:${cur[4]}"><h4><span>${cur[1]}</span>${cur[2]}</h4>${cur[5]}</div>`
        : `<p class="ab-hint">👆 Tap a button to see the information</p>`}</div>
    </section>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-about] [data-cat]"); if (!b) return;
    aboutCat = aboutCat === b.dataset.cat ? null : b.dataset.cat;
    const box = b.closest("[data-about]"), plan = planFor(pick.year, pick.term);
    if (plan) box.outerHTML = termDetails(plan);
  });
  function weekDetails(plan, w) {
    let acts = []; try { acts = LC.expandActivity(w.activities || "") || []; } catch { /* free text only */ }
    const doNow = w.doNow || (LC.doNowFor && LC.doNowFor(plan.id, w.week)) || "";
    return `<div class="lc-weekinfo">
      <h3>🧑‍🤝‍🧑 This week's activities</h3>
      ${doNow ? `<p class="lc-donow"><b>⏱️ Do now:</b> ${esc(doNow)}</p>${pictureHtml(pictureFor(plan.id, w.week))}${warmAnswerHtml(plan.id, w.week)}` : ""}
      <div class="lc-actcards">${acts.length ? acts.map((a) => `<details class="lc-actcard"><summary><b>${esc(a.guide?.title || a.label)}</b>${a.guide?.minutes ? `<span class="muted"> · ${a.guide.minutes} min</span>` : ""}</summary>
        ${a.guide?.what ? `<p>${esc(a.guide.what)}</p>` : ""}${a.guide?.steps?.length ? `<ol>${a.guide.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
        ${a.guide?.needs ? `<p class="muted">🧰 ${esc(Array.isArray(a.guide.needs) ? a.guide.needs.join(", ") : a.guide.needs)}</p>` : ""}</details>`).join("") : `<p>${esc(w.activities || "")}</p>`}</div>
      ${w.assessment ? `<p class="lc-donow"><b>📝 Check for learning:</b> ${esc(w.assessment)}</p>` : ""}
      ${w.resources ? `<p class="muted">📎 ${esc(w.resources)}</p>` : ""}
    </div>`;
  }

  /* ---------------- Picker ---------------- */
  async function renderLessons() {
    const root = $("#lessonsRoot");
    if (!LC) {
      root.innerHTML = `<div class="card empty">📚 Loading 234 weeks of Life Competencies lessons…</div>`;
      try { await loadData(); } catch (e) { root.innerHTML = `<div class="card empty">⚠️ ${esc(e.message)}. Check your internet and try again.</div>`; return; }
    }
    const plan = planFor(pick.year, pick.term) || LC.LESSON_PLANS[0];
    pick.year = plan.year; pick.term = plan.term;
    const w = weekOf(plan, pick.week); pick.week = w.week; savePick();
    const fp = focusParts(w.focus, plan, w.week), cal = calOf(plan, w.week), nextUp = nextLesson(plan.year);
    root.innerHTML = `
      ${yearHeader(plan.year)}
      ${syncBar()}
      <div class="lc-terms">${[1, 2, 3].map((t) => { const p = planFor(plan.year, t); return p ? `<button class="lc-term ${t === plan.term ? "on" : ""}" data-term="${t}"><b>Term ${t}</b><span>${esc(p.title)}</span></button>` : ""; }).join("")}</div>
      ${termDetails(plan)}
      <div class="lc-weekbox ${weeksOpen ? "open" : ""}">
      <button class="lc-weektoggle" data-weeks aria-expanded="${weeksOpen}"><span class="e">🗓️</span><span class="t"><b>${plan.weeks.length} weekly lessons</b><small>Now: ${esc(cal.label)} · ${esc(fp.text)}</small></span><i>${weeksOpen ? "Hide ▲" : "Choose a week ▼"}</i></button>
      <div class="lc-weeks">${schedule(plan).map((r) => {
        if (!r.weeks.length) return `<div class="lc-week off"><span class="e">${/break/i.test(r.note) ? "🏖️" : "🚫"}</span><small>${esc(r.cal || "Break")}</small><b>${esc(r.note || "No class")}</b></div>`;
        const parts = r.weeks.map((n) => focusParts(weekOf(plan, n).focus, plan, n));
        const next = nextUp?.planId === plan.id && r.weeks.includes(nextUp.week);
        return `<button class="lc-week ${r.weeks.includes(w.week) ? "on" : ""} ${next ? "next" : ""}" data-week="${r.weeks.includes(w.week) ? w.week : r.weeks[0]}"><span class="e">${parts[0].emoji}</span><small>${esc(r.cal)}${r.date ? ` · ${esc(r.date.replace(/^\w+ /, "").replace(/\.\d{4}$/, ""))}` : ""}</small><b>${parts.map((x) => esc(x.text)).join(" + ")}</b>${next ? `<i class="lc-next">📍 Next lesson</i>` : ""}</button>`;
      }).join("")}</div></div>
      <div class="card lc-home">
        <div class="lc-home-head">
          <div class="lc-big-emoji">${fp.emoji}</div>
          <div>
            <div class="muted small">Year ${plan.year} · Term ${plan.term} · ${esc(cal.label)}${cal.date ? ` · 📅 ${esc(cal.date)}${cal.time ? ` ${esc(cal.time)}` : ""}` : ""} · ${esc(plan.title)}</div>
            ${cal.with.length ? `<div class="lc-also">Taught together with: ${cal.with.map((n) => `<button class="lc-chip" data-week="${n}">${esc(focusParts(weekOf(plan, n).focus, plan, n).text)}</button>`).join(" ")}</div>` : ""}
            <h2 class="lc-title">${esc(fp.text)}</h2>
            <div class="lc-badges">${(plan.competencies || []).map((c) => `<span class="lc-badge">🧠 ${esc(c)}</span>`).join("")}${(plan.values || []).map((v) => `<span class="lc-badge v">💎 ${esc(v)}</span>`).join("")}</div>
          </div>
        </div>
        ${w.objectives ? `<p class="lc-obj"><b>🎯 Today:</b> ${esc(w.objectives)}</p>` : ""}
        <div class="lc-actions">
          <button class="lc-act" data-go="teach"><span>▶️</span><b>Teach the lesson</b><small>Interactive mind map that grows as you teach, with questions inside</small></button>
          <button class="lc-act" data-go="slides"><span>📑</span><b>Slides</b><small>The classic slide deck with games, timers & polls</small></button>
          <a class="lc-act student" href="${LC_APP}/play" target="_blank" rel="noopener"><span>🎮</span><b>I'm a student</b><small>Choose your name and play the game!</small><i class="go">Play ▶</i></a>
          <a class="lc-act teacher" href="${LC_APP}/?go=live" target="_blank" rel="noopener"><span>👩‍🏫</span><b>I'm the teacher</b><small>Set up the game and open the board.</small><i class="go">Teacher 🔒</i></a>
          <button class="lc-act" data-go="quiz"><span>⚔️</span><b>Team Quiz</b><small>Groups answer, stars drop in the jars</small></button>
          <button class="lc-act" data-go="games"><span>🧩</span><b>Puzzle games</b><small>Match, order, sort & true/false</small></button>
          <button class="lc-act" data-go="board"><span>🎲</span><b>${esc(LC.gameFor(plan.id, w.week).name)}</b><small>The week's board game</small></button>
          <button class="lc-act" data-go="run"><span>🏃</span><b>${esc(LC.runThemeFor(plan.id, w.week).name)}</b><small>Platform game with question blocks</small></button>
          <button class="lc-act mine" data-go="mine"><span>📄</span><b>My activities</b><small>Upload your worksheet — it becomes an interactive activity</small></button>
        </div>
        ${weekDetails(plan, w)}
      </div>`;
    $("[data-sync]", root).onclick = (e) => syncNow(e.currentTarget);
    $("[data-home]", root).onclick = () => document.querySelector('[data-tab="home"]').click();
    $$("[data-term]", root).forEach((b) => b.onclick = () => { pick.term = +b.dataset.term; pick.week = 1; renderLessons(); });
    $$("[data-week]", root).forEach((b) => b.onclick = () => { pick.week = +b.dataset.week; weeksOpen = false; renderLessons(); });
    $("[data-weeks]", root).onclick = () => { weeksOpen = !weeksOpen; renderLessons(); }; // the week strip stays hidden until the button is tapped
    $$("[data-go]", root).forEach((b) => b.onclick = () => open(b.dataset.go, plan, w));
    if (weeksOpen) { const on = $(".lc-week.on", root), strip = $(".lc-weeks", root); if (on) strip.scrollLeft = on.offsetLeft - strip.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2; }
  }

  /* ---------------- Full-screen stage with live jars ---------------- */
  function stage(title, { jars = false } = {}) { // no jar bar on lesson screens (teacher asked); stars still go to the jars
    closeStage();
    const el = document.createElement("div");
    el.className = "lc-stage"; el.id = "lcStage";
    el.innerHTML = `<div class="lc-stage-top"><b class="lc-stage-title">${title}</b><span class="lc-stage-extra"></span><button class="lc-x" aria-label="Close">✕</button></div>
      <div class="lc-stage-body"></div>
      ${jars ? `<div class="lc-jarbar"><div class="jars lc-jars"></div><span class="lc-jarhint">Tap a jar to give a star ⭐</span></div>` : ""}`;
    document.body.appendChild(el);
    document.body.classList.add("lc-open");
    $(".lc-x", el).onclick = closeStage;
    if (jars) CP().mountJars($(".lc-jars", el));
    return el;
  }
  let stageCleanup = [];
  function closeStage() {
    const el = $("#lcStage"); if (!el) return;
    stageCleanup.forEach((f) => f()); stageCleanup = [];
    const j = $(".lc-jars", el); if (j) CP().unmountJars(j);
    el.remove(); document.body.classList.remove("lc-open");
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#lcStage") && !$("#modal").open) closeStage(); });

  // Ask which groups got it right, then drop a star in each of their jars
  function starPicker(host, reason, { label = "Which groups got it right?", stars = 1 } = {}) {
    const groups = CP().groups();
    host.innerHTML = groups.length ? `<div class="lc-starpick"><span>${label}</span>${groups.map((g) => `<button class="lc-gchip" data-g="${g.id}" style="--hc:${esc(g.color)}">${esc(g.emoji)} ${esc(g.name)}</button>`).join("")}<button class="btn lc-give" disabled>⭐ Give ${stars} star${stars > 1 ? "s" : ""}</button></div>` : "";
    const chosen = new Set();
    $$(".lc-gchip", host).forEach((b) => b.onclick = () => { chosen.has(b.dataset.g) ? chosen.delete(b.dataset.g) : chosen.add(b.dataset.g); b.classList.toggle("on"); $(".lc-give", host).disabled = !chosen.size; });
    const give = $(".lc-give", host);
    if (give) give.onclick = () => { chosen.forEach((gid) => CP().addStars(gid, stars, reason)); CP().confetti(90); give.disabled = true; give.textContent = "✅ Stars given!"; $$(".lc-gchip", host).forEach((b) => b.disabled = true); };
  }

  /* ---------------- Widgets ---------------- */
  function timerWidget(host, seconds) {
    host.innerHTML = `<div class="lc-timer"><div class="lc-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="bg"/><circle cx="50" cy="50" r="44" class="fg"/></svg><span>0:00</span></div>
      <div class="lc-timer-btns"><button class="btn" data-t="go">▶ Start</button><button class="btn ghost" data-t="reset">↺</button></div></div>`;
    let left = seconds, iv = null;
    const fg = $(".fg", host), txt = $(".lc-ring span", host), go = $("[data-t=go]", host), C = 2 * Math.PI * 44;
    fg.style.strokeDasharray = C;
    const draw = () => { txt.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; fg.style.strokeDashoffset = C * (1 - left / seconds); host.classList.toggle("done", left === 0); };
    const stop = () => { clearInterval(iv); iv = null; go.textContent = "▶ Start"; };
    go.onclick = () => {
      if (iv) return stop();
      if (left === 0) left = seconds;
      go.textContent = "⏸ Pause";
      iv = setInterval(() => { left--; if (left <= 3 && left > 0) CP().beep("tick"); draw(); if (left <= 0) { stop(); CP().beep("win"); CP().confetti(60); } }, 1000);
    };
    $("[data-t=reset]", host).onclick = () => { stop(); left = seconds; draw(); };
    draw(); stageCleanup.push(stop);
    return stop;
  }

  function namePicker(host, year) {
    const all = CP().students();
    const pool = all.filter((s) => !year || s.year === year);
    const names = (pool.length ? pool : all).map((s) => s.name);
    host.innerHTML = `<div class="lc-picker"><div class="lc-pick-name">${names.length ? "🎯 Who will share?" : "Add students in ⚙️ Setup to pick names"}</div>${names.length ? `<button class="btn big" data-spin>🎲 Pick someone</button>` : ""}</div>`;
    const btn = $("[data-spin]", host); if (!btn) return;
    const used = new Set();
    btn.onclick = () => {
      let left = names.filter((n) => !used.has(n)); if (!left.length) { used.clear(); left = names; }
      const el = $(".lc-pick-name", host); let n = 0;
      (function spin() {
        el.textContent = left[Math.floor(Math.random() * left.length)]; CP().beep("tick");
        if (++n < 18) setTimeout(spin, 40 + n * n * 0.8);
        else { const name = left[Math.floor(Math.random() * left.length)]; used.add(name); el.textContent = "🌟 " + name; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); CP().beep("win"); }
      })();
    };
  }

  function facePoll(host, prompt) {
    const faces = LC.FACES || [{ face: "😀", label: "Great" }, { face: "🙂", label: "Good" }, { face: "😐", label: "OK" }, { face: "😟", label: "Not sure" }];
    const votes = faces.map(() => 0);
    host.innerHTML = `<div class="lc-poll"><p>${esc(prompt)}</p><div class="lc-faces">${faces.map((f, i) => `<button data-f="${i}"><span>${f.face}</span><small>${esc(f.label)}</small><b>0</b></button>`).join("")}</div><div class="muted small">Tap a face for each hand that goes up</div></div>`;
    $$("[data-f]", host).forEach((b) => b.onclick = () => {
      const i = +b.dataset.f; votes[i]++; $("b", b).textContent = votes[i];
      b.animate([{ transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 300 }); CP().beep("tick");
      const max = Math.max(...votes); $$("[data-f]", host).forEach((x, k) => x.style.setProperty("--fill", `${(votes[k] / max) * 100}%`));
    });
  }

  /* ---------------- Interactive puzzles (shared by slides and Puzzle games) ---------------- */
  function puzzle(host, q, onSolved) {
    const done = (ok) => { if (ok) { CP().beep("win"); CP().confetti(70); } else CP().beep("down"); onSolved && onSolved(ok); };
    const kind = q.kind || "choice";
    if (kind === "match") {
      const left = shuffle(q.pairs.map((p) => p[0])), right = shuffle(q.pairs.map((p) => p[1]));
      host.innerHTML = `<p class="lc-q">${esc(q.q)}</p><p class="muted small">Tap one on the left, then its partner on the right.</p>
        <div class="lc-match"><div>${left.map((t) => `<button class="lc-card" data-l="${esc(t)}">${esc(t)}</button>`).join("")}</div><div>${right.map((t) => `<button class="lc-card" data-r="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>`;
      let sel = null, solved = 0; const hue = [0, 210, 40, 140, 280, 180];
      $$("[data-l]", host).forEach((b) => b.onclick = () => { if (b.classList.contains("ok")) return; $$("[data-l]", host).forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); sel = b; });
      $$("[data-r]", host).forEach((b) => b.onclick = () => {
        if (!sel || b.classList.contains("ok")) return;
        const pair = q.pairs.find((p) => p[0] === sel.dataset.l);
        if (pair && pair[1] === b.dataset.r) {
          const c = `hsl(${hue[solved % hue.length]} 80% 88%)`;
          [sel, b].forEach((x) => { x.classList.remove("sel"); x.classList.add("ok"); x.style.background = c; });
          sel = null; solved++; CP().beep("up");
          if (solved === q.pairs.length) done(true);
        } else { b.animate([{ translate: "-6px 0" }, { translate: "6px 0" }, { translate: "0 0" }], { duration: 250 }); CP().beep("down"); }
      });
      return;
    }
    if (kind === "order") {
      const items = shuffle(q.order);
      host.innerHTML = `<p class="lc-q">${esc(q.q)}</p><p class="muted small">Tap the steps in the right order.</p>
        <ol class="lc-order-done"></ol><div class="lc-order">${items.map((t) => `<button class="lc-card" data-o="${esc(t)}">${esc(t)}</button>`).join("")}</div>`;
      let n = 0;
      $$("[data-o]", host).forEach((b) => b.onclick = () => {
        if (b.dataset.o === q.order[n]) {
          n++; b.remove(); $(".lc-order-done", host).insertAdjacentHTML("beforeend", `<li>${esc(q.order[n - 1])}</li>`); CP().beep("up");
          if (n === q.order.length) done(true);
        } else { b.animate([{ translate: "-6px 0" }, { translate: "6px 0" }, { translate: "0 0" }], { duration: 250 }); CP().beep("down"); }
      });
      return;
    }
    if (kind === "sort") {
      host.innerHTML = `<p class="lc-q">${esc(q.q)}</p><p class="muted small">Tap a card, then the box it belongs in.</p>
        <div class="lc-sort-cards">${shuffle(q.cards).map((c, i) => `<button class="lc-card" data-c="${q.cards.indexOf(c)}">${esc(c.text)}</button>`).join("")}</div>
        <div class="lc-buckets">${q.groups.map((g, i) => `<div class="lc-bucket" data-b="${i}"><b>${esc(g)}</b><div></div></div>`).join("")}</div>`;
      let sel = null, left = q.cards.length;
      $$("[data-c]", host).forEach((b) => b.onclick = () => { $$("[data-c]", host).forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); sel = b; });
      $$("[data-b]", host).forEach((bk) => bk.onclick = () => {
        if (!sel) return;
        const card = q.cards[+sel.dataset.c];
        if (card.group === +bk.dataset.b) { $("div", bk).appendChild(sel); sel.classList.remove("sel"); sel.classList.add("ok"); sel.disabled = true; sel = null; CP().beep("up"); if (--left === 0) done(true); }
        else { bk.animate([{ translate: "-6px 0" }, { translate: "6px 0" }, { translate: "0 0" }], { duration: 250 }); CP().beep("down"); }
      });
      return;
    }
    // choice / truefalse / gap
    const opts = q.options || [];
    host.innerHTML = `<p class="lc-q">${esc(q.q)}</p><div class="lc-tiles">${opts.map((o, i) => `<button class="lc-tile" data-o="${i}" style="--tc:${TILE_COLORS[i % TILE_COLORS.length]}"><i>${LETTERS[i]}</i>${esc(o)}</button>`).join("")}</div>`;
    $$("[data-o]", host).forEach((b) => b.onclick = () => {
      const ok = LC.isRight ? LC.isRight(opts[+b.dataset.o], q.answer) : opts[+b.dataset.o] === q.answer;
      $$("[data-o]", host).forEach((x) => { const right = LC.isRight ? LC.isRight(opts[+x.dataset.o], q.answer) : opts[+x.dataset.o] === q.answer; x.classList.toggle("right", right); x.classList.toggle("dim", !right); x.disabled = true; });
      if (!ok) b.classList.add("wrong");
      done(ok);
    });
  }

  /* ---------------- Teach deck ---------------- */
  function buildSlides(plan, w) {
    const id = plan.id, wk = w.week, fp = focusParts(w.focus, plan, w.week);
    const note = LC.noteFor(id, wk) || { idea: fp.text, points: [], examples: [] };
    const deep = LC.deepFor(id, wk) || { why: "", words: [], steps: [] };
    const vis = LC.visualFor(id, wk, note) || { emoji: fp.emoji, definition: note.idea, cards: [], partner: [] };
    const lesson = LC.buildLesson(plan, wk);
    const quiz = LC.quizTen(id, wk);
    const doNow = w.doNow || LC.doNowFor(id, wk) || "";
    const acts = LC.expandActivity(w.activities || "") || [];
    const criteria = LC.weekCriteria(w.objectives, deep.steps, 3, w.assessment) || [];
    const S = [];
    S.push({ kicker: `Week ${wk}`, tone: "title", html: `<div class="lc-s-title"><div class="lc-bounce">${fp.emoji}</div><h1>${esc(fp.text)}</h1><p>${esc(plan.title)} · Year ${plan.year} Term ${plan.term}</p>
      <div class="lc-badges center">${(plan.competencies || []).map((c) => `<span class="lc-badge">🧠 ${esc(c)}</span>`).join("")}${(plan.values || []).map((v) => `<span class="lc-badge v">💎 ${esc(v)}</span>`).join("")}</div></div>` });
    if (doNow) S.push({ kicker: "Do now", tone: "warm", html: `<div class="lc-s-split"><div>${pictureFor(id, wk) ? pictureHtml(pictureFor(id, wk)) : `<div class="lc-s-emoji">⏱️</div>`}<h2>Do now</h2><p class="lc-s-lead">${esc(doNow)}</p>${warmAnswerHtml(id, wk)}</div><div data-w="timer" data-sec="180"></div></div>` });
    if (w.objectives || criteria.length) S.push({ kicker: "Our learning", tone: "cool", html: `<h2>🎯 Our learning today</h2>${w.objectives ? `<p class="lc-s-lead">${esc(w.objectives)}</p>` : ""}
      ${criteria.length ? `<h3>I can…</h3><ul class="lc-s-list">${criteria.map((c) => `<li>✅ ${esc(c)}</li>`).join("")}</ul>` : ""}` });
    S.push({ kicker: "Let's learn", tone: "cool", html: `<div class="lc-s-center"><div class="lc-s-emoji lc-bounce">${vis.emoji || fp.emoji}</div><h2>${esc(vis.definition || note.idea)}</h2>
      ${deep.why ? `<div data-w="reveal" data-label="🤔 Why does it matter?"><p class="lc-s-lead">${esc(deep.why)}</p></div>` : ""}</div>` });
    if (deep.words?.length) S.push({ kicker: "Words we need", tone: "fresh", html: `<h2>📖 Words we need</h2><p class="muted">Tap a card to flip it.</p>
      <div class="lc-flips">${deep.words.map((x) => `<button class="lc-flip"><span class="f">${esc(x.word)}</span><span class="b">${esc(x.meaning)}</span></button>`).join("")}</div>
      ${deep.words.length > 1 ? `<div data-w="match-words"></div>` : ""}`, words: deep.words });
    (vis.cards || []).forEach((c, i) => S.push({ kicker: `Idea ${i + 1}`, tone: ["warm", "cool", "fresh"][i % 3], html: `<div class="lc-s-center"><div class="lc-s-emoji lc-bounce">${c.emoji}</div><h2>${esc(c.title)}</h2>${c.line ? `<p class="lc-s-lead">${esc(c.line)}</p>` : ""}
      ${(c.pictures || []).length ? `<div class="lc-pics">${c.pictures.map((p) => `<div class="lc-pic"><span>${p.emoji}</span><small>${esc(p.label)}</small></div>`).join("")}</div>` : ""}
      ${c.question ? `<div class="lc-think"><b>💭 ${esc(c.question)}</b><div data-w="timer" data-sec="30" class="mini"></div></div>` : ""}</div>` }));
    const examples = [...(note.examples || [])];
    if (examples.length || note.watchOut) S.push({ kicker: "What it looks like", tone: "fresh", html: `<h2>👀 What it looks like</h2><div class="lc-ex">${examples.map((e) => `<div data-w="reveal" data-label="👆 Tap to see an example"><p>💡 ${esc(e)}</p></div>`).join("")}</div>
      ${note.watchOut ? `<p class="lc-watch">⚠️ <b>Watch out:</b> ${esc(note.watchOut)}</p>` : ""}` });
    if (deep.steps?.length) S.push({ kicker: "How to do it", tone: "warm", html: `<h2>🪜 How to do it</h2><ol class="lc-s-steps">${deep.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      ${deep.steps.length > 2 ? `<div data-w="order-steps"></div>` : ""}`, steps: deep.steps });
    if (vis.partner?.length) S.push({ kicker: "Talk it over", tone: "cool", html: `<div class="lc-s-split"><div><h2>🗣️ Talk it over</h2><ul class="lc-s-list">${vis.partner.map((p) => `<li>💬 ${esc(p)}</li>`).join("")}</ul></div><div data-w="timer" data-sec="90"></div></div>` });
    acts.forEach((a) => S.push({ kicker: "Activity", tone: "fresh", html: `<div class="lc-s-split"><div><h2>🧑‍🤝‍🧑 ${esc(a.guide?.title || a.label)}</h2>${a.guide?.what ? `<p class="lc-s-lead">${esc(a.guide.what)}</p>` : ""}
      ${a.guide?.steps?.length ? `<ol class="lc-s-steps small">${a.guide.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}${a.guide?.needs ? `<p class="muted">🧰 ${esc(Array.isArray(a.guide.needs) ? a.guide.needs.join(", ") : a.guide.needs)}</p>` : ""}</div>
      <div><div data-w="timer" data-sec="${(a.guide?.minutes || 10) * 60}"></div><div data-w="stars" data-reason="🧑‍🤝‍🧑 ${esc(a.guide?.title || a.label)}" data-label="Which groups worked brilliantly?"></div></div></div>` }));
    S.push({ kicker: "Share back", tone: "warm", html: `<div class="lc-s-center"><h2>🎤 Share back</h2><p class="lc-s-lead">Tell the class one thing your group found out.</p><div data-w="picker"></div></div>` });
    quiz.slice(0, 3).forEach((item, i) => S.push({ kicker: `Quick check ${i + 1}`, tone: "quiz", html: `<div data-w="quiz" data-i="${i}"></div><div data-w="stars" data-reason="✅ Quick check" data-label="Which groups got it right?"></div>`, quiz: { q: item.q, options: LC.optionsForItem(id, item, quiz), answer: item.a } }));
    const lq = lesson.questions.find((q) => q.kind === "match") || lesson.questions.find((q) => q.kind === "sort");
    if (lq) S.push({ kicker: "Puzzle", tone: "quiz", html: `<div data-w="puzzle"></div><div data-w="stars" data-reason="🧩 Puzzle" data-label="Who solved it?"></div>`, puzzle: lq });
    S.push({ kicker: "How did it go?", tone: "cool", html: `<div class="lc-s-center"><h2>🙋 How did today go?</h2><div data-w="poll"></div></div>` });
    S.push({ kicker: "Exit ticket", tone: "warm", html: `<h2>🎟️ Exit ticket</h2><div class="lc-stems"><p>Today I learned… </p><p>One thing I will do is… </p><p>I'm still wondering… </p></div>
      ${criteria.length ? `<h3>Tick what you can do:</h3><div class="lc-checks">${criteria.map((c) => `<button class="lc-check">⬜ ${esc(c)}</button>`).join("")}</div>` : ""}
      <div data-w="stars" data-reason="🎟️ Great lesson" data-label="Star groups of the lesson:" data-n="2"></div>` });
    return S;
  }

  function teach(plan, w) {
    const slides = buildSlides(plan, w);
    const el = stage(`▶️ ${esc(focusParts(w.focus).text)}`);
    const body = $(".lc-stage-body", el);
    body.innerHTML = `<div class="lc-deck"><button class="lc-nav prev" aria-label="Previous">‹</button><div class="lc-slide"></div><button class="lc-nav next" aria-label="Next">›</button></div><div class="lc-dots"></div>`;
    let i = 0, stopTimers = [];
    const show = (n, dir = 1) => {
      stopTimers.forEach((f) => f()); stopTimers = [];
      i = Math.max(0, Math.min(slides.length - 1, n));
      const s = slides[i], box = $(".lc-slide", body);
      box.className = `lc-slide tone-${s.tone}`;
      box.innerHTML = `<div class="lc-kicker">${esc(s.kicker)} <span>${i + 1} / ${slides.length}</span></div><div class="lc-slide-in">${s.html}</div>`;
      box.animate([{ opacity: 0, transform: `translateX(${dir * 40}px)` }, { opacity: 1, transform: "none" }], { duration: 280, easing: "ease-out" });
      wire(box, s, plan, stopTimers);
      $(".lc-dots", body).innerHTML = slides.map((_, k) => `<button class="${k === i ? "on" : ""}" data-k="${k}" aria-label="Slide ${k + 1}"></button>`).join("");
      $$(".lc-dots button", body).forEach((b) => b.onclick = () => show(+b.dataset.k, +b.dataset.k > i ? 1 : -1));
      $(".lc-nav.prev", body).disabled = i === 0; $(".lc-nav.next", body).disabled = i === slides.length - 1;
    };
    $(".lc-nav.prev", body).onclick = () => show(i - 1, -1);
    $(".lc-nav.next", body).onclick = () => show(i + 1, 1);
    const key = (e) => { if ($("#modal").open || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return; if (e.key === "ArrowRight" || e.key === "PageDown") show(i + 1, 1); if (e.key === "ArrowLeft" || e.key === "PageUp") show(i - 1, -1); };
    document.addEventListener("keydown", key);
    stageCleanup.push(() => { document.removeEventListener("keydown", key); stopTimers.forEach((f) => f()); });
    show(0);
  }

  function wire(box, s, plan, stops) {
    $$("[data-w]", box).forEach((h) => {
      const w = h.dataset.w;
      if (w === "timer") stops.push(timerWidget(h, +h.dataset.sec || 60));
      else if (w === "reveal") { const inner = h.innerHTML; h.innerHTML = `<button class="lc-reveal">${esc(h.dataset.label || "Reveal")}</button>`; $("button", h).onclick = () => { h.innerHTML = `<div class="lc-revealed">${inner}</div>`; CP().beep("up"); }; }
      else if (w === "picker") namePicker(h, plan.year);
      else if (w === "poll") facePoll(h, "Hands up! How did you feel about today?");
      else if (w === "stars") starPicker(h, h.dataset.reason, { label: h.dataset.label, stars: +h.dataset.n || 1 });
      else if (w === "quiz") puzzle(h, { ...s.quiz, kind: "choice" });
      else if (w === "puzzle") puzzle(h, s.puzzle);
      else if (w === "match-words") { h.innerHTML = `<button class="btn" data-play>🎯 Play: match the words</button>`; $("[data-play]", h).onclick = () => puzzle(h, { kind: "match", q: "Match each word to what it means.", pairs: s.words.map((x) => [x.word, x.meaning]) }); }
      else if (w === "order-steps") { h.innerHTML = `<button class="btn" data-play>🧩 Play: put the steps in order</button>`; $("[data-play]", h).onclick = () => { box.querySelector(".lc-s-steps").style.display = "none"; puzzle(h, { kind: "order", q: "Put the steps in the right order.", order: s.steps }); }; }
    });
    $$(".lc-flip", box).forEach((b) => b.onclick = () => { b.classList.toggle("flipped"); CP().beep("tick"); });
    $$(".lc-check", box).forEach((b) => b.onclick = () => { b.classList.toggle("on"); b.textContent = (b.classList.contains("on") ? "✅ " : "⬜ ") + b.textContent.slice(2); });
  }

  /* ---------------- Teach as a mind map (graphical notes that grow branch by branch, with questions inside) ---------------- */
  const BRANCH_COLORS = ["#7c3aed", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#f97316", "#14b8a6", "#ef4444", "#8b5cf6", "#0ea5e9", "#84cc16"];
  function mapBranches(plan, w) {
    const id = plan.id, wk = w.week, fp = focusParts(w.focus, plan, w.week);
    const note = LC.noteFor(id, wk) || { idea: fp.text, points: [], examples: [] };
    const deep = LC.deepFor(id, wk) || { why: "", words: [], steps: [] };
    const vis = LC.visualFor(id, wk, note) || { emoji: fp.emoji, definition: note.idea, cards: [], partner: [] };
    const lesson = LC.buildLesson(plan, wk);
    const quiz = LC.quizTen(id, wk);
    const doNow = w.doNow || LC.doNowFor(id, wk) || "";
    const acts = LC.expandActivity(w.activities || "") || [];
    const criteria = LC.weekCriteria(w.objectives, deep.steps, 3, w.assessment) || [];
    const used = new Set();
    const asQuiz = (item) => { used.add(item.q); return { kind: "choice", q: item.q, options: LC.optionsForItem(id, item, quiz), answer: item.a, label: "Quick check" }; };
    const nextQuiz = () => { const item = quiz.find((x) => !used.has(x.q)); return item ? asQuiz(item) : null; };
    const cardQ = (text) => { const item = quiz.find((x) => norm(x.q) === norm(text) && !used.has(x.q)); return item ? asQuiz(item) : { kind: "think", q: text, sec: 30, label: "Think & share" }; };
    const B = [];
    B.push({ emoji: "🎯", title: "Our learning", leaves: [...(w.objectives ? [{ emoji: "🎯", text: w.objectives }] : []), ...criteria.slice(0, 3).map((c) => ({ emoji: "✅", text: c }))],
      q: doNow ? { kind: "think", q: doNow, sec: 180, label: "Warm-up", pic: pictureFor(id, wk), ans: warmAnswerHtml(id, wk) } : nextQuiz() });
    B.push({ emoji: vis.emoji || fp.emoji, title: "The big idea", leaves: [{ emoji: "💡", text: vis.definition || note.idea }, ...(deep.why ? [{ kind: "reveal", emoji: "🤔", label: "Why does it matter?", text: deep.why }] : [])], q: null });
    if (deep.words?.length) B.push({ emoji: "📖", title: "Words we need", leaves: deep.words.slice(0, 5).map((x) => ({ kind: "word", word: x.word, text: x.meaning })),
      q: deep.words.length > 1 ? { kind: "puzzle", puzzle: { kind: "match", q: "Match each word to what it means.", pairs: deep.words.map((x) => [x.word, x.meaning]) }, q: "Match the words", label: "Word match" } : null });
    (vis.cards || []).slice(0, 4).forEach((c) => B.push({ emoji: c.emoji, title: c.title, leaves: [...(c.line ? [{ emoji: "💬", text: c.line }] : []), ...((c.pictures || []).length ? [{ kind: "pics", pics: c.pictures }] : [])],
      q: c.question ? cardQ(c.question) : null }));
    if (note.examples?.length || note.watchOut) B.push({ emoji: "👀", title: "What it looks like", leaves: [...(note.examples || []).slice(0, 3).map((e) => ({ kind: "reveal", emoji: "💡", label: "Tap to see an example", text: e })), ...(note.watchOut ? [{ emoji: "⚠️", text: `Watch out: ${note.watchOut}` }] : [])], q: null });
    if (deep.steps?.length) B.push({ emoji: "🪜", title: "How to do it", leaves: deep.steps.slice(0, 5).map((s, k) => ({ emoji: `${k + 1}️⃣`, text: s })),
      q: deep.steps.length > 2 ? { kind: "puzzle", puzzle: { kind: "order", q: "Put the steps in the right order.", order: deep.steps }, q: "Put the steps in order", label: "Order it" } : null });
    if (vis.partner?.length || acts.length) B.push({ emoji: "🧑‍🤝‍🧑", title: "Talk & do", leaves: [...(vis.partner || []).slice(0, 2).map((p) => ({ kind: "talk", emoji: "🗣️", text: p })), ...acts.slice(0, 3).map((a) => ({ kind: "activity", emoji: "🧩", text: a.guide?.title || a.label, act: a }))], q: null });
    const lq = lesson.questions.find((q) => q.kind === "sort") || lesson.questions.find((q) => q.kind === "match");
    B.push({ emoji: "🎟️", title: "Wrap up", leaves: [{ emoji: "📝", text: "Today I learned…" }, { emoji: "🚀", text: "One thing I will do is…" }, { emoji: "🤔", text: "I'm still wondering…" }, { kind: "poll", emoji: "🙋", text: "How did today go?" }],
      q: lq ? { kind: "puzzle", puzzle: lq, q: lq.q, label: "Final puzzle" } : null });
    B.forEach((b) => { if (!b.q) b.q = nextQuiz(); });
    return { centre: { emoji: fp.emoji, text: fp.text }, branches: B };
  }

  function teachMap(plan, w) {
    const { centre, branches } = mapBranches(plan, w);
    const el = stage(`🧠 ${esc(centre.text)}`);
    const body = $(".lc-stage-body", el);
    body.classList.add("mm-body");
    const nQ = branches.filter((b) => b.q).length;
    $(".lc-stage-extra", el).innerHTML = `<span class="mm-score" title="Questions answered">❓ <b>0</b> / ${nQ}</span><button class="btn ghost mm-slides" title="Show the classic slides instead">📑 Slides</button>`;
    $(".mm-slides", el).onclick = () => teach(plan, w);
    const leafHtml = (l, bi, li) => {
      const k = l.kind || "text", at = `data-b="${bi}" data-l="${li}"`;
      if (k === "word") return `<button class="mm-leaf word" ${at}><b>${esc(l.word)}</b><span class="mm-back">${esc(l.text)}</span><small>tap to flip</small></button>`;
      if (k === "reveal") return `<button class="mm-leaf reveal" ${at}><span class="mm-e">${l.emoji}</span><span class="mm-t"><b class="mm-front">${esc(l.label)}</b><span class="mm-back">${esc(l.text)}</span></span></button>`;
      if (k === "pics") return `<div class="mm-leaf pics" ${at}>${l.pics.map((p) => `<span class="mm-pic"><i>${p.emoji}</i><small>${esc(p.label)}</small></span>`).join("")}</div>`;
      return `<button class="mm-leaf ${k}" ${at}><span class="mm-e">${l.emoji}</span><span class="mm-t">${esc(l.text)}</span>${k === "activity" || k === "talk" || k === "poll" ? `<i class="mm-go">›</i>` : ""}</button>`;
    };
    body.innerHTML = `<div class="mm-view"><div class="mm-world"><svg class="mm-lines"></svg>
        <div class="mm-centre"><span class="mm-e">${centre.emoji}</span><b>${esc(centre.text)}</b><small>Year ${plan.year} · ${esc(calOf(plan, w.week).label)}</small></div>
        ${branches.map((b, bi) => `<div class="mm-branch-set" data-set="${bi}" style="--bc:${BRANCH_COLORS[bi % BRANCH_COLORS.length]}">
          <button class="mm-branch" data-branch="${bi}"><span class="mm-e">${b.emoji}</span><b>${esc(b.title)}</b></button>
          ${b.leaves.map((l, li) => leafHtml(l, bi, li)).join("")}
          ${b.q ? `<button class="mm-leaf mm-q" data-q="${bi}"><span class="mm-e">❓</span><span class="mm-t"><small>${esc(b.q.label || "Question")}</small>${esc(b.q.q)}</span></button>` : ""}
        </div>`).join("")}
      </div>
      <div class="mm-pop" hidden></div></div>
      <div class="mm-bar"><button class="btn ghost" data-mm="prev">‹ Back</button><div class="mm-dots">${branches.map((b, bi) => `<button data-dot="${bi}" style="--bc:${BRANCH_COLORS[bi % BRANCH_COLORS.length]}" title="${esc(b.title)}">${b.emoji}</button>`).join("")}</div>
        <button class="btn ghost" data-mm="all" title="See the whole map (O)">🔭 Whole map</button><button class="btn" data-mm="next">Next branch ›</button></div>`;

    const view = $(".mm-view", body), world = $(".mm-world", body), svg = $(".mm-lines", body), pop = $(".mm-pop", body);
    let shown = 0, focus = -1, pan = { x: 0, y: 0 }, cam = { x: 0, y: 0, s: 1 }, answered = new Set(), stopPop = null;
    const boxes = [];   // world-space box of each branch set, for the camera

    // Classic two-sided mind map: branches stacked down the right, then up the left; leaves fan out beside each branch
    function layout() {
      const C = $(".mm-centre", world), BX = 330, LX = 520, GAP = 18, BLOCK_GAP = 46;
      const sets = $$(".mm-branch-set", world);
      const right = Math.ceil(sets.length / 2);
      const sides = [sets.slice(0, right), sets.slice(right).reverse()];
      let lines = "";
      sides.forEach((list, side) => {
        const dir = side === 0 ? 1 : -1;
        const blocks = list.map((set) => { const leaves = $$(".mm-leaf", set); const h = Math.max($(".mm-branch", set).offsetHeight, leaves.reduce((s, l) => s + l.offsetHeight + GAP, -GAP)); return { set, leaves, h }; });
        const total = blocks.reduce((s, b) => s + b.h + BLOCK_GAP, -BLOCK_GAP);
        let y = -total / 2;
        blocks.forEach(({ set, leaves, h }) => {
          const bi = +set.dataset.set, color = BRANCH_COLORS[bi % BRANCH_COLORS.length];
          const br = $(".mm-branch", set), bw = br.offsetWidth, cy = y + h / 2;
          const bx = dir * BX;
          br.style.left = (bx - bw / 2) + "px"; br.style.top = (cy - br.offsetHeight / 2) + "px";
          const on = bi < shown ? "on" : "";
          lines += `<path class="trunk ${on}" data-p="${bi}" pathLength="1" stroke="${color}" d="M${dir * 60},0 C${dir * 180},0 ${bx - dir * (bw / 2 + 120)},${cy} ${bx - dir * bw / 2},${cy}" />`;
          let ly = cy - leaves.reduce((s, l) => s + l.offsetHeight + GAP, -GAP) / 2, minX = Math.min(bx - bw / 2, dir * LX), maxX = Math.max(bx + bw / 2, dir * LX);
          leaves.forEach((l) => {
            const lw = l.offsetWidth, lh = l.offsetHeight, x = dir > 0 ? LX : -LX - lw;
            l.style.left = x + "px"; l.style.top = ly + "px";
            lines += `<path class="twig ${on}" data-p="${bi}" pathLength="1" stroke="${color}" d="M${bx + dir * bw / 2},${cy} C${bx + dir * (bw / 2 + 60)},${cy} ${dir * LX - dir * 70},${ly + lh / 2} ${dir > 0 ? LX : -LX},${ly + lh / 2}" />`;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x + lw); ly += lh + GAP;
          });
          boxes[bi] = { x1: minX, x2: maxX, y1: y, y2: y + h };
          y += h + BLOCK_GAP;
        });
      });
      C.style.left = -C.offsetWidth / 2 + "px"; C.style.top = -C.offsetHeight / 2 + "px";
      svg.innerHTML = lines;
      camera(false);
    }
    // Zoom the camera onto one branch, or out to the whole map
    function camera(animate = true) {
      const vw = view.clientWidth, vh = view.clientHeight;
      let b;
      if (focus < 0) {
        const vis = boxes.filter((_, i) => i < shown);
        const C = $(".mm-centre", world);
        b = vis.reduce((a, x) => ({ x1: Math.min(a.x1, x.x1), x2: Math.max(a.x2, x.x2), y1: Math.min(a.y1, x.y1), y2: Math.max(a.y2, x.y2) }), { x1: -C.offsetWidth / 2, x2: C.offsetWidth / 2, y1: -C.offsetHeight / 2, y2: C.offsetHeight / 2 });
        if (!vis.length) b = { x1: b.x1 - 200, x2: b.x2 + 200, y1: b.y1 - 120, y2: b.y2 + 120 };
      } else {
        const x = boxes[focus];   // the branch, its notes and a glimpse of the trunk back to the centre
        b = { x1: x.x1 < 0 ? x.x1 : x.x1 - 120, x2: x.x2 > 0 ? x.x2 : x.x2 + 120, y1: x.y1, y2: x.y2 };
      }
      const pad = 40, s = Math.min(1.35, (vw - pad * 2) / (b.x2 - b.x1), (vh - pad * 2) / (b.y2 - b.y1));
      cam = { s, x: vw / 2 - ((b.x1 + b.x2) / 2) * s, y: vh / 2 - ((b.y1 + b.y2) / 2) * s };
      pan = { x: 0, y: 0 };
      world.style.transition = animate ? "transform .75s cubic-bezier(.3,.9,.3,1)" : "none";
      paint();
    }
    const paint = () => (world.style.transform = `translate(${cam.x + pan.x}px, ${cam.y + pan.y}px) scale(${cam.s})`);

    function reveal(n) {
      shown = Math.max(shown, Math.min(branches.length, n));
      $$(".mm-branch-set", world).forEach((s) => s.classList.toggle("on", +s.dataset.set < shown));
      $$("path[data-p]", svg).forEach((p) => p.classList.toggle("on", +p.dataset.p < shown));
    }
    function go(bi) {
      closePop();
      if (bi >= branches.length) { focus = -1; camera(); CP().toast("🎉 The whole map is done — great lesson!"); CP().confetti(90); markDots(); return; }
      bi = Math.max(-1, bi);
      if (bi >= 0) { const fresh = bi >= shown; reveal(bi + 1); if (fresh) { CP().beep("up"); $$(`.mm-branch-set[data-set="${bi}"] > *`, world).forEach((x, k) => x.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 420, delay: 250 + k * 140, easing: "cubic-bezier(.3,1.5,.5,1)", fill: "backwards" })); } }
      focus = bi; camera(); markDots();
    }
    function markDots() {
      $$("[data-dot]", body).forEach((d) => { const i = +d.dataset.dot; d.classList.toggle("on", i === focus); d.classList.toggle("seen", i < shown); d.classList.toggle("done", answered.has(i)); });
      $("[data-mm=next]", body).textContent = focus === -1 && shown === 0 ? "Start ›" : focus >= branches.length - 1 || (focus === -1 && shown >= branches.length) ? "🔭 Finish" : "Next branch ›";
    }

    function closePop() { if (stopPop) { stopPop(); stopPop = null; } pop.hidden = true; pop.innerHTML = ""; }
    function openPop(html, wireFn) {
      closePop();
      pop.innerHTML = `<button class="lc-x mm-x" aria-label="Close">✕</button><div class="mm-pop-in">${html}</div>`;
      pop.hidden = false;
      pop.animate([{ opacity: 0, transform: "translate(-50%,-46%) scale(.9)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }], { duration: 240, easing: "ease-out" });
      $(".mm-x", pop).onclick = closePop;
      const stops = []; wireFn && wireFn($(".mm-pop-in", pop), stops); stopPop = () => stops.forEach((f) => f && f());
    }
    function done(bi) {
      if (answered.has(bi)) return;
      answered.add(bi); $(`[data-q="${bi}"]`, world)?.classList.add("done");
      $(".mm-score b", el).textContent = answered.size; markDots();
      if (answered.size === nQ) { CP().toast("🏆 Every question answered!"); CP().confetti(120); }
    }
    function question(bi) {
      const Q = branches[bi].q;
      const color = BRANCH_COLORS[bi % BRANCH_COLORS.length];
      if (Q.kind === "think") return openPop(`<div class="mm-kick" style="--bc:${color}">${esc(Q.label)}</div>${Q.pic ? pictureHtml(Q.pic) : `<div class="lc-s-emoji">💭</div>`}<h2>${esc(Q.q)}</h2>${Q.ans || ""}<div class="mm-row"><div data-h="timer"></div><div data-h="pick"></div></div><button class="btn" data-h="ok">✅ We talked about it</button>`, (h, stops) => {
        stops.push(timerWidget($("[data-h=timer]", h), Q.sec || 30)); namePicker($("[data-h=pick]", h), plan.year);
        $("[data-h=ok]", h).onclick = () => { done(bi); CP().beep("win"); closePop(); };
      });
      openPop(`<div class="mm-kick" style="--bc:${color}">${esc(Q.label || "Question")}</div><div data-h="q"></div><div data-h="stars"></div>`, (h) => {
        puzzle($("[data-h=q]", h), Q.kind === "choice" ? Q : Q.puzzle, () => { done(bi); starPicker($("[data-h=stars]", h), `🧠 ${branches[bi].title}`); });
      });
    }
    function leaf(bi, li, btn) {
      const l = branches[bi].leaves[li], k = l.kind || "text";
      if (k === "word" || k === "reveal") { btn.classList.toggle("flipped"); CP().beep("tick"); return requestAnimationFrame(layout); }
      if (k === "talk") return openPop(`<div class="lc-s-emoji">🗣️</div><h2>${esc(l.text)}</h2><p class="muted">Talk to your partner</p><div class="mm-row"><div data-h="timer"></div><div data-h="pick"></div></div>`, (h, stops) => { stops.push(timerWidget($("[data-h=timer]", h), 90)); namePicker($("[data-h=pick]", h), plan.year); });
      if (k === "poll") return openPop(`<div data-h="poll"></div><div data-h="stars"></div>`, (h) => { facePoll($("[data-h=poll]", h), "Hands up! How did you feel about today?"); starPicker($("[data-h=stars]", h), "🎟️ Great lesson", { label: "Star groups of the lesson:", stars: 2 }); });
      if (k === "activity") {
        const g = l.act.guide || {};
        return openPop(`<h2>🧩 ${esc(g.title || l.text)}</h2>${g.what ? `<p class="lc-s-lead">${esc(g.what)}</p>` : ""}${g.steps?.length ? `<ol class="lc-s-steps small">${g.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
          ${g.needs ? `<p class="muted">🧰 ${esc(Array.isArray(g.needs) ? g.needs.join(", ") : g.needs)}</p>` : ""}<div data-h="timer"></div><div data-h="stars"></div>`, (h, stops) => { stops.push(timerWidget($("[data-h=timer]", h), (g.minutes || 10) * 60)); starPicker($("[data-h=stars]", h), `🧑‍🤝‍🧑 ${g.title || l.text}`, { label: "Which groups worked brilliantly?" }); });
      }
      btn.classList.toggle("hl"); CP().beep("tick"); // highlighter pen on a note
    }

    body.onclick = (e) => {
      const t = e.target;
      if (t.closest(".mm-pop")) return;
      const q = t.closest("[data-q]"); if (q) return question(+q.dataset.q);
      const lf = t.closest(".mm-leaf[data-l]"); if (lf) return leaf(+lf.dataset.b, +lf.dataset.l, lf);
      const br = t.closest("[data-branch]"); if (br) return go(+br.dataset.branch === focus ? -1 : +br.dataset.branch);
      if (t.closest(".mm-centre")) return go(-1);
      const dot = t.closest("[data-dot]"); if (dot) return go(+dot.dataset.dot);
      const mm = t.closest("[data-mm]")?.dataset.mm;
      if (mm === "next") go(focus === -1 ? (shown > 0 && shown < branches.length ? shown : shown ? branches.length : 0) : focus + 1);
      else if (mm === "prev") go(focus <= 0 ? -1 : focus - 1);
      else if (mm === "all") { closePop(); focus = -1; camera(); markDots(); }
    };
    // Drag the map around; mouse wheel / pinch zooms
    let drag = null;
    view.addEventListener("pointerdown", (e) => { if (e.target.closest("button, .mm-pop, .mm-leaf")) return; drag = { x: e.clientX - pan.x, y: e.clientY - pan.y }; view.setPointerCapture(e.pointerId); world.style.transition = "none"; view.classList.add("grab"); });
    view.addEventListener("pointermove", (e) => { if (!drag) return; pan = { x: e.clientX - drag.x, y: e.clientY - drag.y }; paint(); });
    view.addEventListener("pointerup", () => { drag = null; view.classList.remove("grab"); });
    view.addEventListener("wheel", (e) => {
      if (e.target.closest(".mm-pop")) return;
      e.preventDefault();
      const r = view.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = Math.exp(-e.deltaY * 0.0015);
      const s = Math.max(0.15, Math.min(3, cam.s * k)), f = s / cam.s;
      const ox = cam.x + pan.x, oy = cam.y + pan.y;
      cam = { s, x: mx - (mx - ox) * f, y: my - (my - oy) * f }; pan = { x: 0, y: 0 };
      world.style.transition = "none"; paint();
    }, { passive: false });
    const key = (e) => {
      if ($("#modal").open || $(".lc-zoom") || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
      if (e.key === "Escape" && !pop.hidden) { e.stopImmediatePropagation(); return closePop(); }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); $("[data-mm=next]", body).click(); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); $("[data-mm=prev]", body).click(); }
      if (e.key === "o" || e.key === "O") $("[data-mm=all]", body).click();
    };
    document.addEventListener("keydown", key, true);
    const ro = new ResizeObserver(() => camera(false)); ro.observe(view);
    stageCleanup.push(() => { document.removeEventListener("keydown", key, true); ro.disconnect(); closePop(); });
    layout(); markDots();
    document.fonts?.ready.then(() => $("#lcStage") === el && layout());
  }

  /* ---------------- Team Quiz ---------------- */
  function teamQuiz(plan, w) {
    const quiz = LC.quizTen(plan.id, w.week);
    const items = quiz.map((it) => ({ q: it.q, options: LC.optionsForItem(plan.id, it, quiz), answer: it.a }));
    const el = stage(`⚔️ Team Quiz · ${esc(focusParts(w.focus).text)}`);
    const body = $(".lc-stage-body", el);
    let i = 0;
    const show = () => {
      if (i >= items.length) {
        body.innerHTML = `<div class="lc-s-center lc-end"><div class="lc-s-emoji lc-bounce">🏆</div><h2>Quiz complete!</h2><p class="lc-s-lead">Look at the jars to see who won ⭐</p><button class="btn big" data-again>🔁 Play again</button></div>`;
        CP().confetti(220); CP().beep("win");
        const best = CP().groups().sort((a, b) => b.total - a.total)[0]; if (best) CP().react(best.id, "wow");
        $("[data-again]", body).onclick = () => { i = 0; show(); };
        return;
      }
      body.innerHTML = `<div class="lc-quiz"><div class="lc-kicker">Question ${i + 1} of ${items.length}</div><div class="lc-qbox"></div><div class="lc-qtimer" data-w="timer"></div>
        <div class="lc-after" hidden><div class="lc-sp"></div><button class="btn big" data-next>${i === items.length - 1 ? "🏁 Finish" : "Next question ›"}</button></div></div>`;
      const stop = timerWidget($(".lc-qtimer", body), 20); $("[data-t=go]", body).click();
      puzzle($(".lc-qbox", body), { ...items[i], kind: "choice" }, () => { stop(); $(".lc-after", body).hidden = false; starPicker($(".lc-sp", body), "⚔️ Team Quiz"); });
      $("[data-next]", body).onclick = () => { i++; show(); };
    };
    show();
  }

  /* ---------------- Puzzle games (the lesson's own question types) ---------------- */
  function puzzles(plan, w) {
    const L = LC.buildLesson(plan, w.week);
    const qs = L.questions;
    const el = stage(`🧩 Puzzle games · ${esc(focusParts(w.focus).text)}`);
    const body = $(".lc-stage-body", el);
    const icon = { choice: "🔘", truefalse: "✔️", gap: "✏️", match: "🔗", order: "🔢", sort: "🗂️" };
    const solved = new Set();
    const menu = () => {
      body.innerHTML = `<div class="lc-pz-menu">${qs.map((q, k) => `<button class="lc-pz ${solved.has(k) ? "done" : ""}" data-k="${k}"><span>${solved.has(k) ? "⭐" : icon[q.kind || "choice"] || "❓"}</span><small>${k + 1}</small></button>`).join("")}</div>
        <p class="muted center">${solved.size} of ${qs.length} solved · tap a puzzle to play</p>`;
      $$("[data-k]", body).forEach((b) => b.onclick = () => play(+b.dataset.k));
    };
    const play = (k) => {
      body.innerHTML = `<div class="lc-pz-play"><button class="btn ghost" data-back>‹ All puzzles</button><div class="lc-qbox"></div><div class="lc-after" hidden><div class="lc-sp"></div><button class="btn" data-next>Next puzzle ›</button></div></div>`;
      $("[data-back]", body).onclick = menu;
      puzzle($(".lc-qbox", body), qs[k], (ok) => { if (ok) solved.add(k); $(".lc-after", body).hidden = false; starPicker($(".lc-sp", body), "🧩 Puzzle"); });
      $("[data-next]", body).onclick = () => (k + 1 < qs.length ? play(k + 1) : menu());
    };
    menu();
  }

  /* ---------------- Board game + Block Run (built by the Life Competencies app) ---------------- */
  function gameInput(plan, w) {
    const quiz = LC.quizTen(plan.id, w.week);
    return { year: plan.year, term: plan.term, week: calOf(plan, w.week).label, topic: w.focus, subject: LC.LESSON_SUBJECT, objectives: w.objectives,
      questions: quiz, gameQuestions: quiz, options: quiz.map((it) => LC.optionsForItem(plan.id, it, quiz)) };
  }
  function frameGame(plan, w, html, title) {
    const el = stage(title);
    $(".lc-stage-body", el).innerHTML = `<iframe class="lc-frame" title="${esc(title)}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    $(".lc-frame", el).srcdoc = html;
  }

  function open(go, plan, w) {
    if (go === "teach") teachMap(plan, w);
    else if (go === "slides") teach(plan, w);
    else if (go === "live") {
      const quiz = LC.quizTen(plan.id, w.week);
      const questions = quiz.map((it) => ({ q: it.q, options: LC.optionsForItem(plan.id, it, quiz), answer: it.a }));
      const title = focusParts(w.focus, plan, w.week).text;
      const questionsFor = (planId, week) => { const p = LC.LESSON_PLANS.find((x) => x.id === planId); if (!p) return null; const qz = LC.quizTen(planId, week); return qz.map((it) => ({ q: it.q, options: LC.optionsForItem(planId, it, qz), answer: it.a })); };
      window.LiveBoard.board(stage(`📺 Teacher board · ${esc(title)}`, { jars: false }), plan, w, title, questions, questionsFor); // no jar bar: right answers fill the jars on their own
    }
    else if (go === "quiz") teamQuiz(plan, w);
    else if (go === "games") puzzles(plan, w);
    else if (go === "board") { const g = LC.gameFor(plan.id, w.week); frameGame(plan, w, LC.buildGameHtml(g, gameInput(plan, w)), `🎲 ${esc(g.name)}`); }
    else if (go === "mine") window.ActivityMaker.open({ stage, starPicker, plan, w, where: `Year ${plan.year} · T${plan.term} ${calOf(plan, w.week).label}`, onClose: (f) => stageCleanup.push(f) });
    else if (go === "run") { const t = LC.runThemeFor(plan.id, w.week); frameGame(plan, w, LC.buildPlatformerHtml(gameInput(plan, w), t, LC.runLevels(plan.id, w.week, w.focus)), `🏃 ${esc(t.name)}`); }
  }

  // Load + draw when the Lessons / Home tabs are opened
  document.addEventListener("click", (e) => {
    if (e.target.closest('[data-tab="lessons"]')) renderLessons();
    if (e.target.closest('[data-tab="home"]')) renderHome();
  });
  if ($("#view-home")?.classList.contains("active")) renderHome();
  // Home is a clean page: no top menu bar there (it comes back on every other page)
  const syncHome = () => document.body.classList.toggle("on-home", !!$("#view-home")?.classList.contains("active"));
  document.addEventListener("click", (e) => { if (e.target.closest("[data-tab], [data-home], [data-y]")) setTimeout(syncHome, 0); });
  syncHome();
  if ($("#view-lessons")?.classList.contains("active")) renderLessons();
  window.Lessons = { render: renderLessons };
})();
