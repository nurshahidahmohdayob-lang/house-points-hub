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
  // Presentation clickers: most send PageDown/PageUp or the arrows, some send Space, Enter,
  // N/P or the media keys. A button left focused by a click is let go, so Space/Enter
  // move the lesson on rather than pressing that button again.
  const pointerKey = (e) => {
    const k = e.key, onBtn = /^(BUTTON|A)$/.test(document.activeElement?.tagName || "");
    const dir = ["ArrowRight", "ArrowDown", "PageDown", " ", "n", "N", "MediaTrackNext", "MediaFastForward"].includes(k) || (k === "Enter" && !onBtn) ? 1
      : ["ArrowLeft", "ArrowUp", "PageUp", "p", "P", "MediaTrackPrevious", "MediaRewind"].includes(k) ? -1 : 0;
    if (dir && onBtn) document.activeElement.blur();
    return dir;
  };
  const TILE_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#22c55e", "#a855f7", "#14b8a6"];

  let LC = null, loading = null;
  let pick = loadPick();
  const SHARE = /^\d{1,2}-[1-3]-\d{1,2}$/.test(new URLSearchParams(location.search).get("map") || "") ? new URLSearchParams(location.search).get("map") : "";
  // Study notes for students: ?notes=6-1-10 (one week) · 6-1 (a term) · 6 (the whole year), from /notes/<code>
  const NOTES = /^\d{1,2}(-[1-3](-\d{1,2})?)?$/.test(new URLSearchParams(location.search).get("notes") || "") ? new URLSearchParams(location.search).get("notes") : "";
  function loadPick() { try { return { year: 1, term: 1, week: 1, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { year: 1, term: 1, week: 1 }; } }
  function savePick() { try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch { /* private mode */ } }

  // Lessons come from the copy built into Class Points. Only the 🔄 Sync button contacts the Life Competencies app:
  // it downloads the lessons that app publishes on every deploy and keeps them on this device (Cache Storage),
  // so later visits use the synced lessons without downloading again.
  const LIVE_DATA = window.LC_SYNC_URL || "https://zera-life-competencies.vercel.app/class-points/lc-data.js";
  // Live Class runs in the Life Competencies app itself (its /play page for students, its Live Class screen + board for the teacher)
  const LC_APP = "https://zera-life-competencies.vercel.app";
  const LOCAL_DATA = "assets/lc-data.js?v=426666";
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
    // A synced copy older than the built-in one (the app was updated since the teacher last synced) is dropped, so
    // fixes that came with the app (e.g. reworded questions) show up without another sync.
    const at = (x) => Date.parse(x?.BUILT?.at || "") || 0;
    loading = syncedText()
      .then((t) => (t ? fromText(t).then((x) => { source = "synced"; return x; }) : Promise.reject(new Error("none"))))
      .then((x) => loadScript(LOCAL_DATA).then((y) => {
        if (at(y) <= at(x)) return x;
        caches.open(SYNC_CACHE).then((c) => c.delete(SYNC_KEY)).catch(() => {});
        source = "copy"; return y;
      }, () => x))
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
      renderLessons(); renderFoot();
    } catch (e) {
      btn.dataset.why = e?.message || String(e); // kept for troubleshooting
      CP().toast("⚠️ Couldn't reach the Life Competencies app — check the internet and try again");
      btn.disabled = false; btn.textContent = "🔄 Sync lessons";
    }
  }
  // Sync sits in the teacher footer (beside History / Setup), teacher only: unlocked with the teacher password (only its SHA-256 is kept
  // here) for this browser tab. A simple lock to keep students away, not real security.
  const SYNC_PASS_SHA = "8b42d912a9d46626e3dc9895a15ce1ff70456abc7167d6498c45921336625816";
  const syncOpen = () => { try { return sessionStorage.getItem("lc-sync-ok") === "1"; } catch { return false; } };
  const syncWhat = () => {
    const at = LC?.BUILT?.at ? new Date(LC.BUILT.at) : null;
    const when = at ? ` · from ${at.toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : "";
    return (source === "synced" ? "Synced lessons" : "Built-in lessons") + when;
  };
  async function sha256(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }

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
  // The warm-up as the class reads it ("Look at the two messages…", assets/warmup-student.js); falls back to the LC text
  const warmText = (planId, week, doNow) => (window.WARMUP_STUDENT || {})[`${planId}-${week}`] || doNow;
  // What the class must see for "Show two versions… / Hold up a clock… / Show an advert…" warm-ups (assets/warmup-show.js)
  const warmShowHtml = (planId, week) => { const h = (window.WARMUP_SHOW || {})[`${planId}-${week}`]; return h ? `<div class="ws">${h}</div>` : ""; };
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
  let aboutCat = null, weeksOpen = false, aboutOpen = false, shareOpen = false, termsOpen = false;
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
    const calNo = Number(/Week (\d+)/.exec(cal.label || "")?.[1] || w.week);
    const shareLink = `${location.origin}/map/${plan.year}-${plan.term}-${calNo}`;
    // Proposal B: the page follows the teaching order — 1 pick the week, 2 teach, 3 play, 4 wrap up.
    // Terms + About Term live in the side menu (renderYearNav).
    root.innerHTML = `
      ${aboutOpen ? termDetails(plan) : ""}
      <ol class="lc-steps">
        <li class="lc-step"><span class="lc-n">1</span><div class="lc-sbody">
          <div class="lc-shead"><h3>Pick the week</h3><small>Term ${plan.term} · ${esc(plan.title)} · ${plan.weeks.length} weekly lessons</small></div>
          <div class="lc-weekbox ${weeksOpen ? "open" : ""}">
            <button class="lc-weekpick" data-weeks aria-expanded="${weeksOpen}"><span class="e">${fp.emoji}</span><span class="t"><b>${esc(cal.label)}${cal.date ? ` · ${esc(cal.date.replace(/\.\d{4}$/, ""))}` : ""}</b><small>${esc(fp.text)}${nextUp?.planId === plan.id && nextUp.week === w.week ? " · 📍 next lesson" : ""}</small></span><i>${weeksOpen ? "Close ▲" : "Change ▾"}</i></button>
            <div class="lc-weeks">${schedule(plan).map((r) => {
              if (!r.weeks.length) return `<div class="lc-week off"><span class="e">${/break/i.test(r.note) ? "🏖️" : "🚫"}</span><small>${esc(r.cal || "Break")}</small><b>${esc(r.note || "No class")}</b></div>`;
              const parts = r.weeks.map((n) => focusParts(weekOf(plan, n).focus, plan, n));
              const next = nextUp?.planId === plan.id && r.weeks.includes(nextUp.week);
              return `<button class="lc-week ${r.weeks.includes(w.week) ? "on" : ""} ${next ? "next" : ""}" data-week="${r.weeks.includes(w.week) ? w.week : r.weeks[0]}"><span class="e">${parts[0].emoji}</span><small>${esc(r.cal)}${r.date ? ` · ${esc(r.date.replace(/^\w+ /, "").replace(/\.\d{4}$/, ""))}` : ""}</small><b>${parts.map((x) => esc(x.text)).join(" + ")}</b>${next ? `<i class="lc-next">📍 Next lesson</i>` : ""}</button>`;
            }).join("")}</div>
          </div>
        </div></li>
        <li class="lc-step"><span class="lc-n">2</span><div class="lc-sbody">
          <div class="lc-shead"><h3>Note</h3><small>Mind map · slides · study notes</small></div>
          <div class="lc-note">
            <div class="lc-note-top">
              <span class="lc-note-e">${fp.emoji}</span>
              <div class="lc-note-txt">
                <small>Year ${plan.year} · Term ${plan.term} · ${esc(cal.label)}${cal.date ? ` · ${esc(cal.date)}${cal.time ? ` · ${esc(cal.time)}` : ""}` : ""}</small>
                <h2>${esc(fp.text)}</h2>
                ${cal.with.length ? `<div class="lc-also">Taught together with: ${cal.with.map((n) => `<button class="lc-chip" data-week="${n}">${esc(focusParts(weekOf(plan, n).focus, plan, n).text)}</button>`).join(" ")}</div>` : ""}
                <div class="lc-note-chips">${(plan.competencies || []).map((c) => `<span>🧠 ${esc(c)}</span>`).join("")}${(plan.values || []).map((v) => `<span>💎 ${esc(v)}</span>`).join("")}</div>
              </div>
              <button class="lc-note-btn" data-go="teach" title="Interactive mind map that grows as you teach, with questions inside"><span>▶</span><b>Open the note</b><small>Mind map with questions inside</small></button>
            </div>
            ${w.objectives ? `<div class="lc-note-goal"><span>🎯</span><div><b>Today's goal</b><p>${esc(w.objectives)}</p></div></div>` : ""}
          </div>
          <div class="lc-study">
            <button class="lc-studybtn deck" data-go="deck"><span>🎞️</span><b>Slides</b><small>This week's presentation · PowerPoint &amp; PDF</small></button>
            <button class="lc-studybtn" data-go="study"><span>📘</span><b>Study note</b><small>This week's revision page for students</small></button>
            <button class="lc-studybtn all" data-go="studyall"><span>📚</span><b>All study notes</b><small>Every week in one page · download &amp; share</small></button>
          </div>
        </div></li>
        <li class="lc-step"><span class="lc-n">3</span><div class="lc-sbody">
          <div class="lc-shead"><h3>Play</h3><small>Every game uses this week's questions</small></div>
          <div class="lc-actions">
            <div class="lc-act live"><span>🎮</span><b>Live game</b><small>Everyone plays on their own device</small>
              <div class="lc-live2"><a href="${LC_APP}/play" target="_blank" rel="noopener">Student ▶</a><a href="${LC_APP}/?go=live" target="_blank" rel="noopener">Teacher 🔒</a></div></div>
            <button class="lc-act" data-go="quiz"><span>⚔️</span><b>Team Quiz</b><small>Groups race on 20 multiple-choice questions</small></button>
            <button class="lc-act" data-go="games"><span>🧩</span><b>Jigsaw Puzzles</b><small>Drag answer pieces to build pictures</small></button>
            <button class="lc-act" data-go="board"><span>🎲</span><b>${esc(LC.gameFor(plan.id, w.week).name)}</b><small>This week's board game</small></button>
            <button class="lc-act" data-go="run"><span>🏃</span><b>${esc(LC.runThemeFor(plan.id, w.week).name)}</b><small>Platform game with question blocks</small></button>
            <button class="lc-act" data-go="cards"><span>🃏</span><b>Answer cards</b><small>Everyone holds up a card · one camera reads the room</small></button>
            <button class="lc-act" data-go="mine"><span>📄</span><b>My activities</b><small>Your own worksheets, made interactive</small></button>
          </div>
        </div></li>
        <li class="lc-step"><span class="lc-n">4</span><div class="lc-sbody">
          <div class="lc-shead"><h3>Wrap up</h3><small>Stars, worksheets and sharing</small></div>
          <div class="lc-wrap">
            <button class="lc-wrapbtn" data-wrap="stars"><span>⭐</span><b>Give stars</b><small>Award points to students</small></button>
            <button class="lc-wrapbtn" data-go="mine"><span>🖨️</span><b>Print a worksheet</b><small>Open My activities → Print</small></button>
            <button class="lc-wrapbtn ${shareOpen ? "on" : ""}" data-wrap="share"><span>🔗</span><b>Share with parents</b><small>A link to this lesson's mind map</small></button>
          </div>
          ${shareOpen ? `<div class="mm-sharebox lc-sharebox"><input readonly value="${esc(shareLink)}" aria-label="Share link"><button class="btn" data-copy>📋 Copy</button></div>` : ""}
        </div></li>
      </ol>`;
    renderYearNav();
    $$("[data-week]", root).forEach((b) => b.onclick = () => { pick.week = +b.dataset.week; weeksOpen = false; shareOpen = false; renderLessons(); });
    $("[data-weeks]", root).onclick = () => { weeksOpen = !weeksOpen; renderLessons(); };
    $$("[data-go]", root).forEach((b) => b.onclick = () => open(b.dataset.go, plan, w));
    $("[data-wrap=stars]", root).onclick = () => document.querySelector('[data-ytab="students"]')?.click();
    $("[data-wrap=share]", root).onclick = () => { shareOpen = !shareOpen; renderLessons(); };
    const cp = $("[data-copy]", root);
    if (cp) { const inp = cp.previousElementSibling; inp.onfocus = () => inp.select(); cp.onclick = () => navigator.clipboard?.writeText(shareLink).then(() => { cp.textContent = "✅ Copied!"; }, () => inp.select()); }
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
    if (!names.length) { host.innerHTML = ""; return; } // no students yet: no picker
    host.innerHTML = `<div class="lc-picker"><div class="lc-pick-name">🎯 Who will share?</div><button class="btn big" data-spin>🎲 Pick someone</button></div>`;
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
    if (doNow) S.push({ kicker: "Do now", tone: "warm", html: `<div class="lc-s-split"><div>${pictureFor(id, wk) ? pictureHtml(pictureFor(id, wk)) : `<div class="lc-s-emoji">⏱️</div>`}<h2>Do now</h2><p class="lc-s-lead">${esc(warmText(id, wk, doNow))}</p>${warmShowHtml(id, wk)}${warmAnswerHtml(id, wk)}</div><div data-w="timer" data-sec="180"></div></div>` });
    if (w.objectives || criteria.length) S.push({ kicker: "Our learning", tone: "cool", html: `<h2>🎯 Our learning today</h2>${w.objectives ? `<p class="lc-s-lead">${esc(w.objectives)}</p>` : ""}
      ${criteria.length ? `<h3>I can…</h3><ul class="lc-s-list">${criteria.map((c) => `<li>✅ ${esc(c)}</li>`).join("")}</ul>` : ""}` });
    S.push({ kicker: "Let's learn", tone: "cool", html: `<div class="lc-s-center"><div class="lc-s-emoji lc-bounce">${vis.emoji || fp.emoji}</div><h2>${esc(vis.definition || note.idea)}</h2>
      ${deep.why ? `<div data-w="reveal" data-label="🤔 Why does it matter?"><p class="lc-s-lead">${esc(deep.why)}</p></div>` : ""}</div>` });
    if (deep.words?.length) S.push({ kicker: "Words we need", tone: "fresh", html: `<h2>📖 Words we need</h2><p class="muted">Tap a card to flip it.</p>
      <div class="lc-flips">${deep.words.map((x) => `<button class="lc-flip"><span class="f">${esc(x.word)}</span><span class="b">${esc(x.meaning)}</span></button>`).join("")}</div>
      ${deep.words.length > 1 ? `<div data-w="match-words"></div>` : ""}`, words: deep.words });
    (vis.cards || []).forEach((c, i) => S.push({ kicker: `Idea ${i + 1}`, tone: ["warm", "cool", "fresh"][i % 3], html: `<div class="lc-s-center"><div class="lc-s-emoji lc-bounce">${c.emoji}</div><h2>${esc(c.title)}</h2>${c.line ? `<p class="lc-s-lead"><span class="lc-ex">💡 Example</span> ${esc(c.line)}</p>` : ""}
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
    const key = (e) => { if ($("#modal").open || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return; const d = pointerKey(e); if (d) { e.preventDefault(); show(i + d, d); } };
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
      q: doNow ? { kind: "think", q: warmText(id, wk, doNow), sec: 180, label: "Warm-up", pic: pictureFor(id, wk), show: warmShowHtml(id, wk), ans: warmAnswerHtml(id, wk) } : nextQuiz() });
    B.push({ emoji: vis.emoji || fp.emoji, title: "The big idea", leaves: [{ emoji: "💡", text: vis.definition || note.idea }, ...(deep.why ? [{ kind: "reveal", emoji: "🤔", label: "Why does it matter?", text: deep.why }] : [])], q: null });
    if (deep.words?.length) B.push({ emoji: "📖", title: "Words we need", leaves: deep.words.slice(0, 5).map((x) => ({ kind: "word", word: x.word, text: x.meaning })),
      q: deep.words.length > 1 ? { kind: "puzzle", puzzle: { kind: "match", q: "Match each word to what it means.", pairs: deep.words.map((x) => [x.word, x.meaning]) }, q: "Match the words", label: "Word match" } : null });
    (vis.cards || []).slice(0, 4).forEach((c) => B.push({ emoji: c.emoji, title: c.title, leaves: [...(c.line ? [{ emoji: "💡", text: c.line, tag: "Example" }] : []), ...((c.pictures || []).length ? [{ kind: "pics", pics: c.pictures }] : [])],
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
    $(".lc-stage-extra", el).innerHTML = `<span class="mm-score" title="Questions answered">❓ <b>0</b> / ${nQ}</span><button class="btn ghost mm-full" title="Full screen for the class">⛶ Full screen</button>${SHARE ? "" : `<button class="btn ghost mm-share" title="A link for students and parents">🔗 Share</button>`}`;
    // 🔗 Share: lifecomp.vercel.app/map/<year>-<term>-<calendar week> opens just this mind map (share mode, below)
    const shareBtn = $(".mm-share", el);
    if (shareBtn) shareBtn.onclick = () => {
      const cal = Number(/Week (\d+)/.exec(calOf(plan, w.week).label || "")?.[1] || w.week);
      const link = `${location.origin}/map/${plan.year}-${plan.term}-${cal}`;
      openPop(`<div class="lc-s-emoji">🔗</div><h2>Share this lesson</h2><p class="muted">Students and parents can open the mind map at home — no log-in, no class names.</p>
        <div class="mm-sharebox"><input readonly value="${esc(link)}" aria-label="Share link"><button class="btn" data-h="copy">📋 Copy</button></div>`, (h) => {
        const inp = $("input", h); inp.onfocus = () => inp.select();
        $("[data-h=copy]", h).onclick = () => navigator.clipboard?.writeText(link).then(() => { $("[data-h=copy]", h).textContent = "✅ Copied!"; }, () => inp.select());
      });
    };
    // Full screen for the projector; the label follows the browser (Esc also leaves full screen)
    const fsBtn = $(".mm-full", el), fsLabel = () => { fsBtn.textContent = document.fullscreenElement ? "🗗 Exit full screen" : "⛶ Full screen"; };
    fsBtn.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
    document.addEventListener("fullscreenchange", fsLabel);
    stageCleanup.push(() => { document.removeEventListener("fullscreenchange", fsLabel); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });
    const leafHtml = (l, bi, li) => {
      const k = l.kind || "text", at = `data-b="${bi}" data-l="${li}"`;
      if (k === "word") return `<button class="mm-leaf word" ${at}><b>${esc(l.word)}</b><span class="mm-back">${esc(l.text)}</span><small>tap to flip</small></button>`;
      if (k === "reveal") return `<button class="mm-leaf reveal" ${at}><span class="mm-e">${l.emoji}</span><span class="mm-t"><b class="mm-front">${esc(l.label)}</b><span class="mm-back">${esc(l.text)}</span></span></button>`;
      if (k === "pics") return `<div class="mm-leaf pics" ${at}>${l.pics.map((p) => `<span class="mm-pic"><i>${p.emoji}</i><small>${esc(p.label)}</small></span>`).join("")}</div>`;
      return `<button class="mm-leaf ${k}" ${at}><span class="mm-e">${l.emoji}</span><span class="mm-t">${l.tag ? `<small class="mm-tag">${esc(l.tag)}</small>` : ""}${esc(l.text)}</span>${k === "activity" || k === "talk" || k === "poll" ? `<i class="mm-go">›</i>` : ""}</button>`;
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
      if (Q.kind === "think") return openPop(`<div class="mm-kick" style="--bc:${color}">${esc(Q.label)}</div>${Q.pic ? pictureHtml(Q.pic) : Q.show ? "" : `<div class="lc-s-emoji">💭</div>`}<h2>${esc(Q.q)}</h2>${Q.show || ""}${Q.ans || ""}<div class="mm-row"><div data-h="timer"></div><div data-h="pick"></div></div><button class="btn" data-h="ok">✅ We talked about it</button>`, (h, stops) => {
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
      if (!pop.hidden && /^Arrow(Up|Down)$/.test(e.key)) return; // scrolls a long question
      const d = pointerKey(e);
      if (d) { e.preventDefault(); $(`[data-mm=${d > 0 ? "next" : "prev"}]`, body).click(); }
      if (e.key === "o" || e.key === "O") $("[data-mm=all]", body).click();
    };
    document.addEventListener("keydown", key, true);
    const ro = new ResizeObserver(() => camera(false)); ro.observe(view);
    stageCleanup.push(() => { document.removeEventListener("keydown", key, true); ro.disconnect(); closePop(); });
    layout(); markDots();
    document.fonts?.ready.then(() => $("#lcStage") === el && layout());
  }

  /* ---------------- One question, one game ---------------- */
  // Every question of a term belongs to exactly one game, so Team Quiz, the Jigsaw, the board game and Block Run never
  // ask the same thing, and no game asks anything twice. termPools deals the questions out week by week with one
  // "seen" list for the whole term (a question that turns up in two weeks still goes to one game only):
  //   • the questions the 🎮 Live game asks (the lesson's choice / true-false / gap questions) go to none of them
  //   • the LC quiz ten (those the Live game doesn't ask): long answers → quiz; short ones are dealt
  //     jigsaw → board → run → quiz in turn
  //   • key words: "Which word means …?" → jigsaw, "What does … mean?" → run, in turn (a word that is already the answer
  //     of another game's question is left out, so the same fact isn't asked twice)
  //   • the lesson's gap and match questions, fill-the-gap on its notes → jigsaw
  //   • sort cards ("… is an example of …", true or false) → board
  //   • an example of each idea, first / last step → quiz;  "what comes after …?" and the lesson's main points → run
  // A game that needs more takes 🔁 revision from its own share of the term's other weeks, nearest weeks first.
  const qNorm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const capFirst = (t) => { t = String(t || "").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
  let poolsLC = null; const poolCache = new Map(), farCache = new Map();
  // Examples from the other year groups' lessons, for wrong answers that are clearly wrong.
  // Each keeps the words of its own lesson, so a lesson on a related topic (Year 1's "people at school" for Year 2's
  // community helpers) can be left out as a whole.
  const EX_STOP = new Set("that,this,with,your,when,they,them,what,from,have,there,their,about,some,every,each,other,more,only,than,then,were,will,would,could,does,into,make,made,just,like,also,very,much,many,even,before,after,because,while,where,which,people,someone,something,things,thing,good,better,well,know,need,want,help,same,different".split(","));
  "the,and,you,are,for,not,but,can,all,our,one,two,own,out,get,too,its,who,how,why,use,way,new,day,now,yes,see,say,put,let,any,has,had,was,his,her,may,did,got,off,set,ten,six,big,lot".split(",").forEach((x) => EX_STOP.add(x));
  const exStems = (t) => String(t || "").toLowerCase().split(/[^a-z]+/).filter((x) => x.length > 2 && !EX_STOP.has(x)).map((x) => x.slice(0, 4));
  // A sentence that makes sense on its own, without the sentence before it ("They are not about being clever" does not)
  const standsAlone = (t) => !/^(It|Its|They|Their|Them|These|Those|This|That|Then|There|Here|Each|Both|So|And|But|Or|Also|Even|Without them|Doing it|Check it|Where it|For example|For instance|Some of them|One of them)\b/.test(String(t).trim())
    && !/^(Some|Many|Neither|Either|Others|Most|One|All)\s+(you|are|is|work|change|have|do|does|can|of|has|need)\b/.test(String(t).trim())
    && !/\b(them|these|those|they|their)\b/i.test(t) && !/\bit\b(?! (is|was|takes|can be|helps to|matters))/i.test(t) && String(t).split(/\s+/).length >= 4;
  function farExamples(plan) {
    if (farCache.has(plan.id)) return farCache.get(plan.id);
    const yr = plan.id.slice(0, 2), out = [];
    for (const p of LC.LESSON_PLANS) if (p.id.slice(0, 2) !== yr) for (const w of p.weeks) {
      let note = null; try { note = LC.noteFor(p.id, w.week); } catch { /* none */ }
      if (!note) continue;
      const lesson = new Set([w.focus, note.idea, ...(note.points || []), ...(note.examples || [])].flatMap(exStems));
      (note.examples || []).forEach((x) => { if (x.length <= 80) out.push({ text: x, lesson, gap: Math.abs(p.year - plan.year), kind: "example" }); });
      (note.points || []).forEach((x) => { if (x.length <= 90 && standsAlone(x)) out.push({ text: x, lesson, gap: Math.abs(p.year - plan.year), kind: "point" }); });
    }
    farCache.set(plan.id, out); return out;
  }
  function termPools(plan) {
    if (poolsLC !== LC) { poolCache.clear(); farCache.clear(); poolsLC = LC; }
    if (poolCache.has(plan.id)) return poolCache.get(plan.id);
    const seen = new Set(), byWeek = new Map();
    plan.weeks.forEach((w, wi) => {
      const out = { quiz: [], jigsaw: [], board: [], run: [], cards: [] };
      const put = (game, q, a, options) => {
        // "True or false: a face can …" → "True or false: A face can …"; answers start with a capital letter
        q = String(q || "").trim().replace(/^(True or false:\s*)([a-z])/, (_, t, c) => t + c.toUpperCase());
        a = String(a ?? "").trim(); const k = qNorm(q);
        if (game !== "jigsaw") { a = capFirst(a); options = options && options.map(capFirst); }
        if (!k || !a || seen.has(k) || (game === "jigsaw" && a.length > 32)) return false;
        seen.add(k); out[game].push(game === "jigsaw" ? { q, a } : { q, a, options: options || [a] }); return true;
      };
      const mc = (game, q, a, wrong) => { const o = [capFirst(a), ...wrong.map(capFirst)].filter((x, i, all) => x && all.findIndex((y) => qNorm(y) === qNorm(x)) === i).slice(0, 4); if (o.length >= 3) put(game, q, o[0], o); };
      const tf = (game, q, yes) => put(game, /^true or false/i.test(q) ? q : `True or false: ${q}`, yes ? "True" : "False", ["True", "False"]);
      const topic = focusParts(w.focus, plan, w.week).text;
      let L = null; try { L = LC.buildLesson(plan, w.week); } catch { /* quiz only */ }
      const n = L?.notes || {}, qs = L?.questions || [];
      // 🎮 Live game (in the LC app) asks the lesson's own choice, true-false and gap questions — those are kept for it,
      // so none of these four games asks the same question as the Live game
      qs.filter((q) => q.kind === "choice" || q.kind === "truefalse" || q.kind === "gap").forEach((q) => seen.add(qNorm(q.q)));

      // the week's own questions, dealt out
      const core = [], cseen = new Set();
      const addCore = (q, a, options) => { const k = qNorm(q); if (!k || !a || cseen.has(k)) return; cseen.add(k); core.push({ q, a: String(a), options: [String(a), ...(options || []).map(String).filter((o) => qNorm(o) !== qNorm(a))].slice(0, 4) }); };
      let quiz = []; try { quiz = LC.quizTen(plan.id, w.week); } catch { /* lesson only */ }
      quiz.forEach((it) => { let o = []; try { o = LC.optionsForItem(plan.id, it, quiz) || []; } catch { /* no options */ } addCore(it.q, o.find((x) => qNorm(x) === qNorm(it.a)) || it.a, o); });
      qs.filter((q) => (q.kind === "choice" || q.kind === "truefalse") && q.answer).forEach((q) => addCore(q.q, q.answer, q.options));
      // 🃏 Answer cards get their own share too (long answers alternate quiz / cards)
      const deal = ["cards", "jigsaw", "board", "run", "quiz"]; let d = 0, lg = 0;
      core.filter((x) => !seen.has(qNorm(x.q))).forEach((x) => put(x.a.length > 26 ? (lg++ % 2 ? "cards" : "quiz") : deal[d++ % deal.length], x.q, x.a, x.options)); // only what is still free is dealt, so every game gets its turn

      // key words
      const answered = new Set([...out.quiz, ...out.jigsaw, ...out.board, ...out.run, ...out.cards].map((x) => qNorm(x.a)));
      const keys = [...(n.keywords || []), ...(n.words || []).map((x) => [x.word, x.meaning])].filter(([k, m], i, all) => k && m && all.findIndex((y) => qNorm(y[0]) === qNorm(k)) === i);
      let kn = 0;
      keys.forEach(([k, m], i) => {
        if (answered.has(qNorm(k))) return;
        const turn = kn++ % 3;
        if (turn === 0) put("jigsaw", `Which word means “${clause(m)}”?`, k);
        else if (turn === 2) mc("cards", `Which word means “${clause(m)}”?`, k, keys.filter((_, j) => j !== i).map((x) => x[0]));
        else mc("run", `What does “${k}” mean?`, clause(m), keys.filter((_, j) => j !== i).map((x) => clause(x[1])));
      });

      // jigsaw: the lesson's gap + match questions, then fill-the-gap on the notes
      qs.forEach((q) => {
        if (q.kind === "gap" && q.answer) put("jigsaw", q.q, q.answer);
        if (q.kind === "match") (q.pairs || []).forEach(([l, r]) => { if (/\?$/.test(l)) put("jigsaw", l, r); });
      });
      const keyWords = keys.map(([k]) => String(k).toLowerCase());
      // a sentence another question already asks about (same idea in other words) is not asked again
      const asked = (t) => { const k = qNorm(t), all = [...out.quiz, ...out.jigsaw, ...out.board, ...out.run, ...out.cards].map((x) => qNorm(x.q)); return k.length > 3 && all.some((q) => q.includes(k)); };
      const gap = (sentence) => {
        const sx = String(sentence || "").trim(), words = sx.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [];
        if (words.length < 6 || !standsAlone(sx) || /^['‘"“]/.test(sx)) return;
        // the gap is a word worth knowing: a key word, else the longest word that is not a filler ("completely", "things")
        const weak = (x) => JG_STOP.has(x.toLowerCase()) || JG_WEAK.has(x.toLowerCase()) || /ly$/.test(x);
        const pick = words.find((x) => keyWords.includes(x.toLowerCase())) || [...words].filter((x) => x.length >= 5 && !weak(x)).sort((p, q) => q.length - p.length)[0];
        // a name keeps its capital letter ("August"); any other word is written small
        const ans = pick && (/^[A-Z]/.test(pick) && !sx.startsWith(pick) ? pick : pick?.toLowerCase());
        if (pick && !asked(sx)) put("jigsaw", `Fill the gap: ${sx.replace(pick, "______")}`, ans);
      };
      const sentences = (t) => String(t || "").split(/(?<=[.!?])\s+/).filter(Boolean);
      (n.branches || []).forEach((b) => { gap(b.explain || b.title); sentences(b.detail).forEach(gap); });
      (n.criteria || []).forEach(gap); sentences(n.why).forEach(gap); sentences(n.intro).forEach(gap);

      // board: which cards fit the topic
      const cards = qs.find((q) => q.kind === "sort")?.cards || [];
      cards.forEach((c) => tf("board", exampleTf(c.text, topic), c.group === 0));

      // quiz: an example of each idea, first / last step
      const off = cards.filter((c) => c.group !== 0).map((c) => c.text);
      const br = (n.branches || []).filter((b) => b.example);
      // The right answer is one of this week's examples; the wrong ones come from other year groups' topics that share
      // no key word with this week's, so only one answer can be right (another of this week's examples never is a wrong one)
      const near = new Set([w.focus, L?.idea, n.why, ...(L?.points || []), ...br.flatMap((b) => [b.title, b.explain, b.example]), ...(qs.find((q) => q.kind === "sort")?.cards || []).filter((c) => c.group === 0).map((c) => c.text)].flatMap(exStems));
      const farAll = farExamples(plan).filter((f) => f.kind === "example" && ![...f.lesson].some((x) => near.has(x)) && !exStems(f.text).some((x) => near.has(x)));
      // nearest year groups first, so a Year 1 child is not reading Year 6 wording
      const farNear = farAll.filter((f) => f.gap <= 2), farEx = (farNear.length >= 12 ? farNear : farAll).map((f) => f.text);
      const EX_ASK = [`Which of these is an example of ‘${topic}’?`, `Which one shows ‘${topic}’ in real life?`, `Which of these belongs in the lesson ‘${topic}’?`, `Which one would you talk about in ‘${topic}’?`].map((q) => q.replace(/([?!])’\?$/, "$1’")); // not ‘Who Are Community Helpers?’?
      // wrong answers written the same way as the right one — a quotation among quotations, a "… — …" among its kind —
      // so the odd one out is never a giveaway
      const shape = (t) => (/^['‘"“]/.test(t) ? "quote" : / — | – |: /.test(t) ? "dash" : "plain");
      br.slice(0, EX_ASK.length).forEach((b, i) => {
        const want = shape(b.example), like = farEx.filter((x) => shape(x) === want), wider = farAll.map((f) => f.text).filter((x) => shape(x) === want);
        const from = like.length >= 3 ? like : wider.length >= 3 ? wider : farEx.filter((x) => shape(x) === "plain");
        const at = (wi * 7 + i * 3) % Math.max(1, from.length);
        mc("quiz", EX_ASK[i], b.example, [...from.slice(at), ...from.slice(0, at)].slice(0, 3));
      });
      const order = qs.find((q) => q.kind === "order")?.order || n.steps || [];
      if (order.length >= 3) { mc("quiz", `In ‘${topic}’, which step comes first?`, order[0], order.slice(1)); mc("quiz", `In ‘${topic}’, which step comes last?`, order[order.length - 1], order.slice(0, -1)); }

      // run: what comes after each step, the lesson's main points (and the next week's, which are not)
      if (order.length >= 4) order.slice(0, -1).forEach((s, i) => mc("run", `In ‘${topic}’, what comes after “${s.replace(/\.$/, "")}”?`, order[i + 1], order.filter((_, j) => j !== i + 1 && j !== i)));
      // the lesson's main points: which one did we learn? (the others are points from unrelated lessons, so one answer is right)
      const farPts = farExamples(plan).filter((f) => f.kind === "point" && ![...f.lesson].some((x) => near.has(x)));
      const ptsFrom = (farPts.filter((f) => f.gap <= 2).length >= 12 ? farPts.filter((f) => f.gap <= 2) : farPts).map((f) => f.text);
      const PT_ASK = [`Which of these did we learn in ‘${topic}’?`, `Which of these is a key idea from ‘${topic}’?`, `What did ‘${topic}’ teach us?`];
      (L?.points || []).filter(standsAlone).forEach((p, i) => {
        if (asked(p)) return;
        const at = (wi * 5 + i * 4) % Math.max(1, ptsFrom.length);
        mc(i % 2 ? "cards" : "run", PT_ASK[i % PT_ASK.length].replace(/([?!])’\?$/, "$1’"), p, [...ptsFrom.slice(at), ...ptsFrom.slice(0, at)].slice(0, 3));
      });

      byWeek.set(w.week, out);
    });
    poolCache.set(plan.id, byWeek);
    return byWeek;
  }
  // A game's questions for a week: its own share, then 🔁 its share of the term's other weeks (nearest first)
  function gameItems(plan, w, game, n) {
    const P = termPools(plan), items = [...(P.get(w.week)?.[game] || [])];
    // nor, from another week, a question this week's 🎮 Live game asks (a key word taught in both weeks)
    let live = new Set(); try { live = new Set(LC.buildLesson(plan, w.week).questions.filter((q) => q.kind === "choice" || q.kind === "truefalse" || q.kind === "gap").map((q) => qNorm(q.q))); } catch { /* none */ }
    const others = plan.weeks.map((x) => x.week).filter((k) => k !== w.week).sort((p, q) => Math.abs(p - w.week) - Math.abs(q - w.week) || p - q);
    for (const k of others) {
      if (items.length >= n) break;
      const label = calOf(plan, k).label || `Week ${k}`;
      for (const x of P.get(k)?.[game] || []) { if (items.length >= n) break; if (!live.has(qNorm(x.q))) items.push({ ...x, q: `🔁 ${label}: ${x.q}` }); }
    }
    // still short: the same year's other terms, earlier terms first
    const had = new Set(items.map((x) => qNorm(x.q.replace(/^🔁[^:]*:\s*/, ""))));
    for (const op of LC.LESSON_PLANS.filter((p) => p.year === plan.year && p.id !== plan.id).sort((a, b) => a.term - b.term)) {
      if (items.length >= n) break;
      const OP = termPools(op);
      for (const ow of op.weeks) for (const x of OP.get(ow.week)?.[game] || []) {
        if (items.length >= n) break;
        if (live.has(qNorm(x.q)) || had.has(qNorm(x.q))) continue;
        had.add(qNorm(x.q)); items.push({ ...x, q: `🔁 Term ${op.term} ${calOf(op, ow.week).label || `Week ${ow.week}`}: ${x.q}` });
      }
    }
    return items.slice(0, n);
  }

  /* ---------------- Team Quiz ---------------- */
  const QUIZ_N = 20;
  const quizItems = (plan, w) => gameItems(plan, w, "quiz", QUIZ_N);

  function teamQuiz(plan, w) {
    const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
    const items = quizItems(plan, w).map((it) => ({ q: it.q, options: shuffle(it.options), answer: it.a }));
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

  /* ---------------- Jigsaw puzzles: drag each answer piece onto its question; right pieces build a picture ---------------- */
  // 50 questions a week, 6 per puzzle — the jigsaw's own share from termPools (word ↔ meaning, fill-the-gap, the lesson's
  // gap and match questions), then 🔁 revision from the term's other weeks.
  const JG_STOP = new Set("about above after again against because before being below between could doing during every from have having into just more most much must other over same should some such than that their them then there these they this those through under until very what when where which while with would your yours".split(" "));
  const JG_WEAK = new Set("something someone somewhere everything everyone everybody anything nothing things thing matters really completely exactly always usually actually another others people whatever different important".split(" "));
  const JG_N = 50;
  const jigsawItems = (plan, w) => gameItems(plan, w, "jigsaw", JG_N);
  // A meaning as it reads after "means": no full stop of its own, and a small first letter unless it is "I" or an
  // acronym ("Keeping safe." → "keeping safe"; "AI tools" stays).
  const clause = (t) => { t = String(t || "").trim().replace(/[.!]+$/, ""); return /^[A-Z][a-z]/.test(t) && !/^I\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; };
  // "… is an example of ‘Topic’." as a statement, true or false, worded so it is correct English whatever the card is.
  // A card that is a phrase leads the sentence: "Asking someone who will be honest is an example of ‘Caring for Public
  // Places’." A card that is already a sentence or a quotation stays whole, and the statement follows it:
  // "‘Aiman collects materials by Tuesday.’ This is an example of ‘Plan Our Innovation’."
  const EX_FINITE = /^(is|are|was|were|has|have|had|takes|took|goes|went|leans|does|did|asks|means|makes|made|gets|got|stops|keeps|says|said|shows|needs|helps|works|uses|lives|grows|tells|looks|seems|feels|becomes|changes|can|will|would|should|must|turns|falls|comes|gives|brings|moves|eats|runs|sounds|matters|happens|costs|lasts|saves|wins|loses|sits|stands|spreads|breaks|fails|cannot|can’t|treats|carry|carries|reach|reaches|keep|make|give|need|want|like|use|help)$/i;
  const EX_LINK = /^(that|which|who|whose|where|when|so|because|if|until|even|though|while|before|after|as|than|to|and|or|but)$/i;
  const isPhrase = (c) => {
    if (/^[‘“"]|;| — | – |: |→/.test(c) || /[.!?] [A-Z]/.test(c)) return false;
    const w = c.replace(/[.!?]$/, "").split(/\s+/);
    if (/^(Something|Nothing|Everything|Anything|Thing|Morning|Evening|Spring|King)$/.test(w[0])) return false;
    if (/ing$/.test(w[0]) || (/^(Never|Not|Always|Only|Still)$/.test(w[0]) && /ing$/.test(w[1] || ""))) return !/\b(tells|shows you|makes you|helps you)\b/.test(c);
    if (!/^(A|An)$/.test(w[0]) || /,/.test(c)) return false;
    for (const x of w.slice(1)) { const y = x.replace(/[^A-Za-z’']/g, ""); if (EX_LINK.test(y)) return true; if (EX_FINITE.test(y)) return false; }
    return true;
  };
  const exampleTf = (card, topic) => {
    const c = String(card || "").trim().replace(/(^|[\s(])'/g, "$1‘").replace(/'/g, "’");
    const end = /[?!]$/.test(topic) ? "" : ".", what = `an example of ‘${topic}’${end}`;
    if (isPhrase(c)) { const p = c.replace(/\.$/, ""); return `${p}${/, not [^,]+$/.test(p) ? "," : ""} is ${what}`; } // "by talking, not typing, is …"
    const whole = /[.!?’…]$/.test(c) ? c : c + ".";
    return `${/^‘/.test(whole) ? whole : `“${whole}”`} This is ${what}`;
  };
  /* ---------------- Ready-made worksheets (📄 My activities): four a week, each a different kind ---------------- */
  // Made from the week's LC lesson (its questions, key words, notes, steps and examples) with a fixed shuffle, so the
  // same week always gives the same sheets — a printed copy matches the one on students' devices.
  function worksheetsFor(plan, week) {
    const w = weekOf(plan, week), fp = focusParts(w.focus, plan, week), topic = fp.text;
    const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const cap = (s) => { s = String(s || "").trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
    let seed = [...plan.id + week].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const mix = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let L = null; try { L = LC.buildLesson(plan, week); } catch { /* quiz only */ }
    let quiz = []; try { quiz = LC.quizTen(plan.id, week); } catch { /* lesson only */ }
    const n = L?.notes || {}, qs = L?.questions || [];
    const seen = new Set(), fresh = (q) => { const k = norm(q); if (!k || seen.has(k)) return false; seen.add(k); return true; };
    const info = (text, kind = "p") => ({ type: "info", kind, text });

    // 1 · Quick check: multiple choice (lesson questions, the quiz ten, the order of the steps)
    const mcq = [];
    const addMcq = (q, a, options) => {
      a = cap(a); if (/^(true|false|yes|no)$/i.test(a) || !fresh(q)) return;
      const opts = [a, ...(options || []).map(cap)].filter((o, i, all) => o && all.findIndex((x) => norm(x) === norm(o)) === i).slice(0, 4);
      if (opts.length < 3) return seen.delete(norm(q));
      const o = mix(opts); mcq.push({ type: "mcq", text: q, options: o, answer: o.indexOf(a) });
    };
    qs.filter((q) => q.kind === "choice" && q.answer).forEach((q) => addMcq(q.q, q.answer, q.options));
    quiz.forEach((it) => { let o = []; try { o = LC.optionsForItem(plan.id, it, quiz) || []; } catch { /* no options */ } addMcq(it.q, o.find((x) => norm(x) === norm(it.a)) || it.a, o); });
    const order = qs.find((q) => q.kind === "order")?.order || n.steps || [];
    if (order.length >= 3) { addMcq(`${topic}: which step comes first?`, order[0], order); addMcq(`${topic}: which step comes last?`, order[order.length - 1], order); }

    // 2 · True or false (lesson + quiz statements, key-word meanings right and wrong, examples that fit or not)
    const tf = [];
    const addTf = (text, yes, labels = ["True", "False"]) => { text = cap(String(text).replace(/^true or false:\s*/i, "")); if (!fresh(text)) return; tf.push({ type: "tf", text, options: labels, answer: yes ? 0 : 1 }); };
    qs.filter((q) => q.kind === "truefalse" && q.answer).forEach((q) => addTf(q.q, norm(q.answer) === norm(q.options[0]), q.options));
    quiz.filter((it) => /^(true|false|yes|no)$/i.test(it.a)).forEach((it) => addTf(it.q, /^(true|yes)$/i.test(it.a), /^(yes|no)$/i.test(it.a) ? ["Yes", "No"] : ["True", "False"]));
    const keys = (n.keywords || []).filter(([k, m]) => k && m);
    keys.forEach(([k, m], i) => { const other = keys[(i + 2) % keys.length]; i % 2 && other[1] !== m ? addTf(`“${cap(k)}” means ${clause(other[1])}.`, false) : addTf(`“${cap(k)}” means ${clause(m)}.`, true); });
    (qs.find((q) => q.kind === "sort")?.cards || []).forEach((c) => addTf(exampleTf(c.text, topic), c.group === 0));
    const tfMix = mix(tf).slice(0, 12);

    // 3 · Words & meanings: matching + fill in the blank with a word bank
    const words = keys.slice(0, 6).map(([k, m]) => [cap(k), cap(m)]);
    const blanks = [], used = new Set();
    qs.filter((q) => q.kind === "gap" && q.answer && /_{3,}/.test(q.q)).forEach((q) => {
      const [a, b] = q.q.split(/_{3,}/); blanks.push({ type: "blank", segs: [a, { g: 0, choices: mix([q.answer, ...q.options.filter((o) => o !== q.answer)].slice(0, 4)) }, b].filter((s) => s !== ""), answers: [q.answer] }); used.add(norm(q.answer));
    });
    // a key word in each sentence (new words first, then any key word, then the sentence's longest word)
    const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), done = new Set();
    const gapIn = (sentence, pass) => {
      const s = String(sentence || "").trim(); if (blanks.length >= 7 || done.has(norm(s)) || s.split(/\s+/).length < 5) return;
      let m = null;
      for (const [k] of keys) { if (pass === 0 && used.has(norm(k))) continue; m = s.match(new RegExp(`\\b${reEsc(k)}(s|es)?\\b`, "i")); if (m) break; }
      if (!m && pass === 2) { const word = (s.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).filter((x) => x.length >= 5 && !JG_STOP.has(x.toLowerCase())).sort((p, q) => q.length - p.length)[0]; if (word) m = s.match(new RegExp(`\\b${reEsc(word)}\\b`)); }
      if (!m) return;
      done.add(norm(s)); used.add(norm(m[0]));
      blanks.push({ type: "blank", segs: [s.slice(0, m.index), { g: 0, choices: null }, s.slice(m.index + m[0].length)].filter((x) => x !== ""), answers: [m[0].toLowerCase()] });
    };
    const sentences = (t) => String(t || "").split(/(?<=[.!?])\s+/).filter(Boolean);
    const lines = [...sentences(n.intro), ...(n.branches || []).flatMap((b) => [b.explain, ...sentences(b.detail)]), ...sentences(n.why), L?.idea, ...(L?.points || []), ...(n.steps || []), ...(L?.examples || [])];
    [0, 1, 2].forEach((pass) => lines.forEach((t) => gapIn(t, pass)));
    const bank = blanks.filter((b) => !b.segs.some((s) => s.choices)).map((b) => b.answers[0]);

    // 4 · Think & write: written answers the teacher reads (not marked automatically)
    const open = (text, model) => ({ type: "open", text, model: model || "", mark: false });
    const writes = [open(`In your own words, what is “${topic}” about?`, L?.idea || n.intro)];
    if (n.why) writes.push(open("Why does this matter in real life?", n.why));
    (n.branches || []).slice(0, 2).forEach((b) => writes.push(open(`“${b.title}.” Give your own example.`, b.example)));
    if (order.length >= 2) writes.push(open(`Write the steps for “${topic}” in the right order.`, order.join(" → ")));
    writes.push(open(L?.reflect?.kind === "write" && L.reflect.prompt ? L.reflect.prompt : "What did you learn today, and how will you use it?", ""));

    const where = `Year ${plan.year} · T${plan.term} ${calOf(plan, week).label}`;
    const sheet = (k, emoji, name, items) => ({ id: `ws-${plan.id}-${week}-${k}`, ready: true, created: 0, emoji, title: `${topic} · ${name}`, where, items });
    return [
      sheet(1, "🔤", "Quick check", [info("Choose the best answer for each question."), ...mcq.slice(0, 10)]),
      sheet(2, "✅", "True or false?", [info("Read each sentence. Is it true or false?"), ...tfMix]),
      sheet(3, "🔗", "Words & meanings", [
        ...(words.length >= 3 ? [info("Part A · Match the words", "h"), { type: "match", text: "Match each word with its meaning.", pairs: words }] : []),
        ...(blanks.length ? [info("Part B · Fill in the blanks", "h"), ...(bank.length ? [{ type: "info", kind: "bank", words: mix([...new Set(bank)]) }] : []), ...blanks] : []),
      ]),
      sheet(4, "✍️", "Think & write", [info("Write your answers in full sentences."), ...writes]),
    ].filter((s) => s.items.some((i) => i.type !== "info"));
  }
  const JG_LOOKS = [["#6b4dff", "#ff6fb5"], ["#0ea5e9", "#22c55e"], ["#f97316", "#facc15"], ["#db2777", "#8b5cf6"], ["#0d9488", "#84cc16"], ["#2563eb", "#06b6d4"], ["#ef4444", "#f59e0b"]];
  const JG_EXTRA = ["🌈", "🚀", "🦋", "🐢", "🌻", "🎨", "🐬", "🏆", "🦁", "🌍"];
  function jigsawPicture(emoji, title, cols, rows, look) {
    const W = 300 * cols, H = 220 * rows, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), grad = g.createLinearGradient(0, 0, W, H); grad.addColorStop(0, look[0]); grad.addColorStop(1, look[1]);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,.18)"; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc((k * 173) % W, (k * 97) % H, 30 + (k * 23) % 70, 0, 7); g.fill(); }
    g.fillStyle = "#000"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `${Math.min(W, H) * 0.42}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.fillText(emoji, W / 2, H * 0.44);
    g.fillStyle = "#fff"; g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 8;
    let fs = Math.max(28, W / 16); do { g.font = `900 ${fs}px system-ui, sans-serif`; fs -= 2; } while (g.measureText(title).width > W * 0.92 && fs > 14);
    g.fillText(title, W / 2, H * 0.86);
    return cv.toDataURL("image/png");
  }
  function jigsaw(plan, w) {
    const fp = focusParts(w.focus, plan, w.week);
    // Mix the kinds (questions, word meanings, true/false, fill the gap) so every puzzle has a bit of each
    const kindOf = (q) => (/^(🔁[^:]*: )?Fill the gap/.test(q) ? 3 : /^(🔁[^:]*: )?Which word means/.test(q) ? 1 : /^(🔁[^:]*: )?True or false/i.test(q) ? 2 : 0);
    const byKind = [[], [], [], []]; jigsawItems(plan, w).forEach((x) => byKind[kindOf(x.q)].push(x));
    const all = []; while (byKind.some((b) => b.length)) byKind.forEach((b) => { if (b.length) all.push(b.shift()); });
    const el = stage(`🧩 Jigsaw Puzzles · ${esc(fp.text)}`);
    const body = $(".lc-stage-body", el);
    if (!all.length) { body.innerHTML = `<div class="lc-s-center"><h2>No jigsaw questions for this week</h2></div>`; return; }
    const puzzles = []; for (let k = 0; k < all.length; k += 6) puzzles.push(all.slice(k, k + 6));
    if (puzzles.length > 1 && puzzles[puzzles.length - 1].length < 4) puzzles[puzzles.length - 2].push(...puzzles.pop()); // no tiny last puzzle
    let notes = {}; try { notes = LC.buildLesson(plan, w.week).notes || {}; } catch { /* default pictures */ }
    const emojis = [fp.emoji, ...(notes.branches || []).map((b) => b.emoji), ...JG_EXTRA].filter((e, i, a) => e && a.indexOf(e) === i);
    const solved = new Set();
    const menu = () => {
      body.innerHTML = `<div class="jg-menu"><h2>🧩 ${puzzles.length} jigsaw puzzles · ${all.length} questions</h2>
        <div class="jg-grid">${puzzles.map((pz, k) => `<button class="jg-pick ${solved.has(k) ? "done" : ""}" data-k="${k}" style="--a:${JG_LOOKS[k % JG_LOOKS.length][0]};--b:${JG_LOOKS[k % JG_LOOKS.length][1]}"><span>${solved.has(k) ? "⭐" : emojis[k % emojis.length]}</span><b>Puzzle ${k + 1}</b><small>${pz.length} pieces</small></button>`).join("")}</div>
        <p class="muted center">${solved.size} of ${puzzles.length} done · tap a puzzle to play</p></div>`;
      $$("[data-k]", body).forEach((b) => b.onclick = () => play(+b.dataset.k));
    };
    const play = (k) => {
      const items = puzzles[k], n = items.length, cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
      const pic = jigsawPicture(emojis[k % emojis.length], `Puzzle ${k + 1} · ${fp.text}`, cols, rows, JG_LOOKS[k % JG_LOOKS.length]);
      const order = items.map((_, i) => i).sort(() => Math.random() - 0.5);
      const done = new Set(); let held = null;
      const pos = (i) => `--x:${(i % cols) * 100 / Math.max(1, cols - 1)}%;--y:${Math.floor(i / cols) * 100 / Math.max(1, rows - 1)}%`;
      body.innerHTML = `<div class="jg">
        <div class="jg-top"><button class="btn ghost" data-menu>‹ All puzzles</button><b>Puzzle ${k + 1} of ${puzzles.length}</b></div>
        <p class="jg-help">Drag each 🧩 answer piece onto its question — or tap a piece, then tap the question. Every right piece shows part of the hidden picture!</p>
        <div class="jg-board" style="--cols:${cols};--rows:${rows};--pic:url(${pic});max-width:${cols * 330}px">${items.map((it, i) => `<button class="jg-slot" data-s="${i}" style="${pos(i)}"><span class="jg-n">${i + 1}</span><span class="jg-q">${esc(it.q)}</span></button>`).join("")}${Array.from({ length: cols * rows - n }, (_, i) => `<div class="jg-slot jg-free" style="${pos(n + i)}"></div>`).join("")}</div>
        <div class="jg-tray">${order.map((i) => `<button class="jg-piece" draggable="true" data-p="${i}">🧩 ${esc(items[i].a)}</button>`).join("")}</div>
        <div class="jg-end" hidden></div></div>`;
      $("[data-menu]", body).onclick = menu;
      const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const tryPlace = (p, slot) => {
        const pk = +p.dataset.p, sk = +slot.dataset.s; if (done.has(sk)) return;
        if (norm(items[pk].a) === norm(items[sk].a)) {
          done.add(sk); slot.classList.add("on"); p.remove(); CP().beep("good");
          if (done.size === n) {
            solved.add(k); CP().beep("win"); CP().confetti(200); $(".jg-board", body).classList.add("all");
            const end = $(".jg-end", body); end.hidden = false;
            end.innerHTML = `<h2>🎉 Puzzle ${k + 1} complete!</h2><div class="lc-sp"></div><div class="row-gap wrap center">${k + 1 < puzzles.length ? `<button class="btn" data-nextpz>Next puzzle ›</button>` : ""}<button class="btn ghost" data-menu2>All puzzles</button></div>`;
            starPicker($(".lc-sp", end), "🧩 Jigsaw Puzzle");
            $("[data-nextpz]", end)?.addEventListener("click", () => play(k + 1)); $("[data-menu2]", end).onclick = menu;
          }
        } else { p.classList.add("no"); slot.classList.add("no"); CP().beep("bad"); setTimeout(() => { p.classList.remove("no"); slot.classList.remove("no"); }, 500); }
        held?.classList.remove("held"); held = null;
      };
      const board = $(".jg", body);
      board.addEventListener("click", (e) => {
        const p = e.target.closest(".jg-piece"); if (p) { held?.classList.remove("held"); held = held === p ? null : p; held?.classList.add("held"); return; }
        const slot = e.target.closest(".jg-slot[data-s]"); if (slot && held) tryPlace(held, slot);
      });
      board.addEventListener("dragstart", (e) => { const p = e.target.closest(".jg-piece"); if (p) { held = p; e.dataTransfer.setData("text/plain", p.dataset.p); } });
      board.addEventListener("dragover", (e) => { if (e.target.closest(".jg-slot[data-s]")) e.preventDefault(); });
      board.addEventListener("drop", (e) => { const slot = e.target.closest(".jg-slot[data-s]"); if (!slot) return; e.preventDefault(); const p = $(`.jg-piece[data-p="${e.dataTransfer.getData("text/plain")}"]`, board); if (p) tryPlace(p, slot); });
    };
    menu();
  }

  /* ---------------- Board game + Block Run (built by the Life Competencies app) ---------------- */
  // Board game = its own share + 20 more (on request); Block Run = 50 questions in levels of 10. Both from gameItems.
  const BOARD_EXTRA = 20, RUN_N = 50, RUN_LEVEL = 10;
  const boardItems = (plan, w) => gameItems(plan, w, "board", (termPools(plan).get(w.week)?.board.length || 0) + BOARD_EXTRA);
  function runLevelsFor(plan, w) {
    const items = gameItems(plan, w, "run", RUN_N), levels = [];
    for (let i = 0; i < items.length; i += RUN_LEVEL) levels.push(items.slice(i, i + RUN_LEVEL));
    if (levels.length > 1 && levels[levels.length - 1].length < 4) levels[levels.length - 2].push(...levels.pop());
    return levels.map((l, k) => ({ n: k + 1, from: l.some((x) => /^🔁/.test(x.q)) ? "revision from other weeks" : "this week's questions",
      questions: l.map((x) => ({ q: x.q, a: x.a })), options: l.map((x, j) => { const o = x.options, r = (k + j) % o.length; return [...o.slice(r), ...o.slice(0, r)]; }) }));
  }
  function gameInput(plan, w, set) {
    const qs = set.map((x) => ({ q: x.q, a: x.a }));
    return { year: plan.year, term: plan.term, week: calOf(plan, w.week).label, topic: w.focus, subject: LC.LESSON_SUBJECT, objectives: w.objectives,
      questions: qs, gameQuestions: qs, options: set.map((x) => x.options) };
  }
  /* ---------------- Study notes: a revision page per week for students to read before the exam ---------------- */
  // Built from the same lesson data as the mind map. One week, a term or the whole year can be read here, shared
  // (lifecomp.vercel.app/notes/6-1-10 · /notes/6-1 · /notes/6), printed, or downloaded as one self-contained page.
  // SN_CSS is used both in the app and inside the downloaded file, so the two always look the same.
  const SN_CSS = `
.sn-doc { --sn-ink: #1f1640; --sn-soft: #5b5577; --sn-line: #e7e2f5; font-family: Nunito, system-ui, sans-serif; color: var(--sn-ink); background: #f6f3ff; padding: 18px; display: grid; gap: 22px; justify-items: center; }
.sn-doc * { box-sizing: border-box; }
.sn-cover, .sn-note { width: 100%; max-width: 860px; background: #fff; border-radius: 22px; box-shadow: 0 4px 0 #e2dbf7, 0 10px 26px rgba(91, 33, 182, .1); overflow: hidden; }
.sn-cover { padding: 26px 28px; background: linear-gradient(120deg, #7c3aed, #c026d3 55%, #ec4899); color: #fff; }
.sn-cover h1 { margin: 0; font-family: "Baloo 2", Nunito, sans-serif; font-size: 2.1rem; line-height: 1.1; }
.sn-cover p { margin: 6px 0 0; font-weight: 700; opacity: .95; }
.sn-toc { margin: 14px 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px; }
.sn-toc a { display: block; color: #fff; text-decoration: none; font-weight: 800; font-size: .92rem; padding: 6px 10px; border-radius: 10px; background: rgba(255,255,255,.16); }
.sn-toc a:hover { background: rgba(255,255,255,.28); }
.sn-head { display: flex; gap: 14px; align-items: center; padding: 18px 22px; color: #fff; background: linear-gradient(120deg, #7c3aed, #c026d3 55%, #ec4899); }
.sn-head .e { flex: none; width: 58px; height: 58px; border-radius: 16px; display: grid; place-items: center; font-size: 2rem; background: rgba(255,255,255,.22); }
.sn-head small { display: block; font-weight: 800; opacity: .92; font-size: .85rem; }
.sn-head h2 { margin: 2px 0 0; font-family: "Baloo 2", Nunito, sans-serif; font-size: 1.6rem; line-height: 1.1; }
.sn-body { padding: 18px 22px 22px; display: grid; gap: 14px; }
.sn-box { border-radius: 16px; padding: 12px 16px; background: color-mix(in srgb, var(--c) 9%, #fff); border-left: 6px solid var(--c); break-inside: avoid; }
.sn-box h3 { margin: 0 0 6px; font-size: .82rem; letter-spacing: .06em; text-transform: uppercase; color: var(--c); }
.sn-box p { margin: 0; line-height: 1.5; }
.sn-box p + p { margin-top: 6px; }
.sn-box ul, .sn-box ol { margin: 0; padding-left: 22px; line-height: 1.5; }
.sn-box li + li { margin-top: 4px; }
.sn-big { font-size: 1.12rem; font-weight: 800; }
.sn-words { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.sn-word { background: #fff; border-radius: 12px; padding: 8px 12px; box-shadow: inset 0 0 0 1.5px var(--sn-line); }
.sn-word b { display: block; color: #7c3aed; font-size: 1.02rem; }
.sn-word span { color: var(--sn-soft); font-size: .93rem; }
.sn-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sn-test ol { padding-left: 24px; }
.sn-test li { padding: 3px 0; }
.sn-test details { display: inline; }
.sn-test summary { display: inline; cursor: pointer; color: #7c3aed; font-weight: 800; font-size: .85rem; margin-left: 6px; list-style: none; }
.sn-test summary::-webkit-details-marker { display: none; }
.sn-test details[open] summary { display: none; }
.sn-test details b { color: #059669; margin-left: 6px; }
.sn-keys { margin-top: 10px; font-size: .85rem; color: var(--sn-soft); }
.sn-tip { font-size: .9rem; color: var(--sn-soft); font-weight: 700; text-align: center; }
@media (max-width: 640px) { .sn-two { grid-template-columns: 1fr; } .sn-doc { padding: 10px; } .sn-body { padding: 14px; } }
@media print {
  @page { margin: 12mm; }
  body { background: #fff !important; }
  .sn-doc { background: #fff; padding: 0; gap: 0; display: block; }
  .sn-cover, .sn-note { box-shadow: none; border: 1.5px solid #e2dbf7; max-width: none; margin: 0 0 8mm; }
  .sn-note { break-before: page; }
  .sn-cover, .sn-head, .sn-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sn-test summary, .sn-tip { display: none; }
  .sn-keys { display: block !important; }
}`;
  if (!document.getElementById("snCss")) { const st = document.createElement("style"); st.id = "snCss"; st.textContent = SN_CSS; document.head.appendChild(st); }

  const cap = (t) => { const s = String(t || "").trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const calNum = (plan, week) => Number(/Week (\d+)/.exec(calOf(plan, week).label || "")?.[1] || week);
  // Every lesson week of a term in teaching order (weeks taught together stay next to each other)
  const termWeeks = (plan) => [...new Set(schedule(plan).flatMap((r) => r.weeks))].map((n) => weekOf(plan, n));

  function studyNoteHtml(plan, w) {
    const id = plan.id, wk = w.week, fp = focusParts(w.focus, plan, wk), cal = calOf(plan, wk);
    const note = LC.noteFor(id, wk) || { idea: fp.text, points: [], examples: [] };
    const deep = LC.deepFor(id, wk) || { why: "", words: [], steps: [] };
    const det = (LC.detailFor && LC.detailFor(id, wk)) || {};
    const vis = LC.visualFor(id, wk, note) || {};
    const box = (c, title, inner) => `<section class="sn-box" style="--c:${c}"><h3>${title}</h3>${inner}</section>`;
    const list = (xs, tag = "ul") => `<${tag}>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</${tag}>`;
    // key words: the lesson's word list first, then the longer glossary (no repeats)
    const words = [], seenW = new Set();
    [...(deep.words || []).map((x) => [x.word, x.meaning]), ...(det.keywords || [])].forEach(([k, m]) => { const n = String(k || "").toLowerCase(); if (k && m && !seenW.has(n)) { seenW.add(n); words.push([k, m]); } });
    const explain = det.explain?.length ? det.explain : (note.points || []);
    const quiz = LC.quizTen(id, wk) || [];
    const parts = [];
    if (w.objectives) parts.push(box("#d97706", "🎯 What I need to know", `<p>${esc(w.objectives)}</p>`));
    parts.push(box("#7c3aed", "💡 The big idea", `<p class="sn-big">${esc(vis.definition || note.idea || fp.text)}</p>${det.intro ? `<p>${esc(det.intro)}</p>` : ""}`));
    if (words.length) parts.push(box("#0ea5e9", "📖 Key words", `<div class="sn-words">${words.slice(0, 8).map(([k, m]) => `<div class="sn-word"><b>${esc(k)}</b><span>${esc(cap(m))}</span></div>`).join("")}</div>`));
    if (explain.length) parts.push(box("#10b981", "🧠 Main points", list(explain)));
    const ex = note.examples || [];
    if (ex.length || deep.why) parts.push(`<div class="sn-two">${ex.length ? box("#ec4899", "👀 Examples", list(ex)) : ""}${deep.why ? box("#f97316", "🤔 Why it matters", `<p>${esc(deep.why)}</p>${note.watchOut ? `<p>⚠️ <b>Watch out:</b> ${esc(note.watchOut)}</p>` : ""}`) : ""}</div>`);
    if (deep.steps?.length) parts.push(box("#3b82f6", "🪜 Steps to remember", list(deep.steps, "ol")));
    if (quiz.length) parts.push(box("#8b5cf6", "✏️ Test yourself", `<div class="sn-test"><ol>${quiz.map((q) => `<li>${esc(q.q)} <details><summary>Show answer</summary><b>${esc(cap(q.a))}</b></details></li>`).join("")}</ol>
      <p class="sn-keys" hidden>Answers: ${quiz.map((q, i) => `${i + 1}. ${esc(cap(q.a))}`).join(" · ")}</p></div>`));
    return `<article class="sn-note" id="sn-${plan.year}-${plan.term}-${wk}">
      <header class="sn-head"><span class="e">${fp.emoji}</span><div><small>Year ${plan.year} · Term ${plan.term} · ${esc(cal.label)}${cal.date ? ` · ${esc(cal.date)}` : ""}</small><h2>${esc(fp.text)}</h2></div></header>
      <div class="sn-body">${parts.join("")}</div></article>`;
  }

  // scope: { plan, w } = one week · { plan } = a term · { year } = all three terms
  function studyNotes(scope) {
    const plans = scope.year ? [1, 2, 3].map((t) => planFor(scope.year, t)).filter(Boolean) : [scope.plan];
    const rows = plans.flatMap((p) => (scope.w ? [scope.w] : termWeeks(p)).map((w) => ({ p, w })));
    const title = scope.w ? `Study note · ${focusParts(scope.w.focus, scope.plan, scope.w.week).text}`
      : scope.year ? `Year ${scope.year} study notes · whole year` : `Year ${scope.plan.year} · Term ${scope.plan.term} study notes`;
    const cover = scope.w ? "" : `<header class="sn-cover"><h1>📚 ${esc(title)}</h1><p>Life Competencies · read each note, then test yourself before the exam ✏️</p>
      <ol class="sn-toc">${rows.map(({ p, w }) => `<li><a href="#sn-${p.year}-${p.term}-${w.week}">${focusParts(w.focus, p, w.week).emoji} ${scope.year ? `T${p.term} ` : ""}${esc(calOf(p, w.week).label)} · ${esc(focusParts(w.focus, p, w.week).text)}</a></li>`).join("")}</ol></header>`;
    return { title, html: `<div class="sn-doc">${cover}${rows.map(({ p, w }) => studyNoteHtml(p, w)).join("")}<p class="sn-tip">Tip: cover the answers, try every question, then check ✅</p></div>` };
  }

  // The whole thing as one page that works on its own (download, print, give to students)
  function studyFile({ title, html }) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
<style>body { margin: 0; background: #f6f3ff; }${SN_CSS}</style></head><body>${html}
<script>addEventListener("beforeprint", () => document.querySelectorAll(".sn-test details").forEach((d) => d.open = false));<\/script></body></html>`;
  }
  const fileName = (t) => t.replace(/[·]/g, "-").replace(/[^\w\- ]+/g, "").replace(/\s+/g, " ").trim() + ".html";
  function downloadNotes(doc) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([studyFile(doc)], { type: "text/html" }));
    a.download = fileName(doc.title); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function printNotes(doc) {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(f);
    f.onload = () => setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 600);
    f.srcdoc = studyFile(doc);
  }

  function openStudy(plan, w, which = "week") {
    const el = stage("📘 Study notes");
    const body = $(".lc-stage-body", el); body.classList.add("sn-stage");
    let mode = which;
    const draw = () => {
      const scope = mode === "week" ? { plan, w } : mode === "year" ? { year: plan.year } : { plan };
      const doc = studyNotes(scope);
      const code = mode === "week" ? `${plan.year}-${plan.term}-${calNum(plan, w.week)}` : mode === "year" ? `${plan.year}` : `${plan.year}-${plan.term}`;
      const link = `${location.origin}/notes/${code}`;
      $(".lc-stage-title", el).textContent = `📘 ${doc.title}`;
      body.innerHTML = `<div class="sn-bar">
          ${NOTES ? "" : `<div class="sn-pills">${[["week", "This week"], ["term", `Term ${plan.term}`], ["year", `Whole year`]].map(([k, t]) => `<button class="${k === mode ? "on" : ""}" data-sn="${k}">${t}</button>`).join("")}</div>`}
          <button class="btn" data-sn-do="dl" title="One page with every note — give it to your students">⬇️ Download${mode === "week" ? "" : " all"} (one page)</button>
          <button class="btn ghost" data-sn-do="print">🖨️ Print / PDF</button>
          ${NOTES ? "" : `<button class="btn ghost" data-sn-do="share">🔗 Share link</button>`}
        </div>
        <div class="mm-sharebox sn-share" hidden><input readonly value="${esc(link)}" aria-label="Share link"><button class="btn" data-sn-do="copy">📋 Copy</button></div>
        ${doc.html}`;
      $$("[data-sn]", body).forEach((b) => b.onclick = () => { mode = b.dataset.sn; draw(); body.scrollTop = 0; });
      $("[data-sn-do=dl]", body).onclick = () => downloadNotes(doc);
      $("[data-sn-do=print]", body).onclick = () => printNotes(doc);
      const sh = $("[data-sn-do=share]", body), box = $(".sn-share", body), inp = $("input", box);
      if (sh) sh.onclick = () => { box.hidden = !box.hidden; if (!box.hidden) inp.select(); };
      inp.onfocus = () => inp.select();
      $("[data-sn-do=copy]", body).onclick = (e) => navigator.clipboard?.writeText(link).then(() => { e.target.textContent = "✅ Copied!"; }, () => inp.select());
      $$(".sn-toc a", body).forEach((a) => a.onclick = (e) => { e.preventDefault(); body.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" }); });
    };
    draw();
  }

  /* ---------------- Slides: a presentation for each week's topic ---------------- */
  // Same lesson data as the study note, laid out as 16:9 slides. One model (deckFor) feeds three outputs:
  // the full-screen presenter here, 🖨️ PDF (one slide per page) and ⬇️ PowerPoint (PptxGenJS, loaded on demand).
  const SD_THEMES = { title: ["#7c3aed", "#ec4899"], goal: ["#f59e0b", "#f97316"], warm: ["#0ea5e9", "#6366f1"], idea: ["#7c3aed", "#c026d3"], words: ["#0ea5e9", "#0d9488"],
    point: ["#10b981", "#0d9488"], ex: ["#ec4899", "#f43f5e"], why: ["#f97316", "#ef4444"], steps: ["#3b82f6", "#6366f1"], talk: ["#14b8a6", "#22c55e"], quiz: ["#8b5cf6", "#6366f1"], sum: ["#7c3aed", "#ec4899"], exit: ["#f59e0b", "#ec4899"] };
  function deckFor(plan, w) {
    const id = plan.id, wk = w.week, fp = focusParts(w.focus, plan, wk), cal = calOf(plan, wk);
    const note = LC.noteFor(id, wk) || { idea: fp.text, points: [], examples: [] };
    const deep = LC.deepFor(id, wk) || { why: "", words: [], steps: [] };
    const det = (LC.detailFor && LC.detailFor(id, wk)) || {};
    const vis = LC.visualFor(id, wk, note) || {};
    const quiz = LC.quizTen(id, wk) || [];
    const doNow = w.doNow || LC.doNowFor(id, wk) || "";
    const criteria = LC.weekCriteria(w.objectives, deep.steps, 3, w.assessment) || [];
    const words = [], seenW = new Set();
    [...(deep.words || []).map((x) => [x.word, x.meaning]), ...(det.keywords || [])].forEach(([k, m]) => { const n = String(k || "").toLowerCase(); if (k && m && !seenW.has(n)) { seenW.add(n); words.push([k, cap(m)]); } });
    const explain = det.explain?.length ? det.explain : (note.points || []);
    const big = vis.definition || note.idea || fp.text;
    const S = [];
    S.push({ th: "title", lay: "title", emoji: fp.emoji, title: fp.text, lead: `Year ${plan.year} · Term ${plan.term} · ${cal.label}${cal.date ? ` · ${cal.date}` : ""}`, chips: [...(plan.competencies || []).map((c) => `🧠 ${c}`), ...(plan.values || []).map((v) => `💎 ${v}`)] });
    if (w.objectives) S.push({ th: "goal", lay: "list", kicker: "Today's goal", emoji: "🎯", title: w.objectives, items: criteria.filter((c) => norm(c.replace(/^I can\s*/i, "")) !== norm(w.objectives)).map((c) => `✅ I can ${c.replace(/^I can\s*/i, "")}`) });
    if (doNow) S.push({ th: "warm", lay: "big", kicker: "Warm-up", emoji: "⏱️", title: warmText(id, wk, doNow), lead: "Think on your own, then share with a partner." });
    S.push({ th: "idea", lay: "big", kicker: "The big idea", emoji: vis.emoji || fp.emoji, title: big, lead: det.intro && norm(det.intro) !== norm(big) ? det.intro : "" });
    if (words.length) S.push({ th: "words", lay: "cards", kicker: "Key words", emoji: "📖", title: "Words we need", cards: words.slice(0, 6) });
    const cards = vis.cards || [];
    explain.slice(0, 4).forEach((t, i) => S.push({ th: "point", lay: "big", kicker: `Main point ${i + 1} of ${Math.min(explain.length, 4)}`, emoji: cards[i]?.emoji || "🧠", title: t, lead: cards[i]?.line ? `💡 Example: ${cards[i].line}` : "" }));
    if (note.examples?.length) S.push({ th: "ex", lay: "list", kicker: "What it looks like", emoji: "👀", title: "Examples", items: note.examples.map((e) => `💡 ${e}`), foot: note.watchOut ? `⚠️ Watch out: ${note.watchOut}` : "" });
    if (deep.why) S.push({ th: "why", lay: "big", kicker: "Why it matters", emoji: "🤔", title: deep.why });
    if (deep.steps?.length) S.push({ th: "steps", lay: "list", kicker: "How to do it", emoji: "🪜", title: "Steps to remember", items: deep.steps, ordered: true });
    if (vis.partner?.length) S.push({ th: "talk", lay: "list", kicker: "Talk it over", emoji: "🗣️", title: "Discuss with a partner", items: vis.partner.slice(0, 3).map((p) => `💬 ${p}`) });
    quiz.slice(0, 5).forEach((it, i) => S.push({ th: "quiz", lay: "quiz", kicker: `Quick check ${i + 1} of ${Math.min(quiz.length, 5)}`, emoji: "❓", title: it.q, options: LC.optionsForItem(id, it, quiz) || [], answer: cap(it.a) }));
    S.push({ th: "sum", lay: "list", kicker: "Remember", emoji: "⭐", title: "What we learned", items: [big, ...(explain.length ? explain : note.points || []).slice(0, 3).map((t) => t.split(/(?<=[.!?])\s/)[0])].slice(0, 4).map((t) => `⭐ ${t}`) });
    S.push({ th: "exit", lay: "list", kicker: "Exit ticket", emoji: "🎟️", title: "Before you go…", items: ["📝 Today I learned…", "🚀 One thing I will do is…", "🤔 I'm still wondering…"] });
    return { title: fp.text, file: `Year ${plan.year} T${plan.term} ${cal.label} - ${fp.text}`, slides: S };
  }

  const SD_CSS = `
.sd-s { --a: #7c3aed; --b: #ec4899; width: 1280px; height: 720px; position: relative; overflow: hidden; border-radius: 0; font-family: Nunito, system-ui, sans-serif; color: #1f1640; background: #fff; display: flex; flex-direction: column; box-sizing: border-box; }
.sd-s * { box-sizing: border-box; }
.sd-s::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 14px; background: linear-gradient(90deg, var(--a), var(--b)); }
.sd-s::after { content: ""; position: absolute; right: -120px; bottom: -160px; width: 420px; height: 420px; border-radius: 50%; background: color-mix(in srgb, var(--b) 10%, transparent); }
.sd-kick { margin: 50px 70px 0; display: flex; align-items: center; gap: 14px; font-weight: 800; font-size: 22px; letter-spacing: .08em; text-transform: uppercase; color: var(--a); position: relative; z-index: 1; }
.sd-kick i { font-style: normal; font-size: 38px; width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center; background: color-mix(in srgb, var(--a) 12%, #fff); letter-spacing: 0; }
.sd-in { flex: 1; padding: 22px 70px 56px; display: flex; flex-direction: column; justify-content: center; gap: 22px; position: relative; z-index: 1; }
.sd-s h1, .sd-s h2 { font-family: "Baloo 2", Nunito, sans-serif; margin: 0; line-height: 1.15; text-wrap: balance; }
.sd-s h2 { font-size: 48px; }
.sd-s h2.long { font-size: 38px; }
.sd-lead { font-size: 28px; line-height: 1.45; margin: 0; color: #4a4466; }
.sd-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; }
.sd-list li { font-size: 28px; line-height: 1.35; padding: 14px 22px; border-radius: 18px; background: color-mix(in srgb, var(--a) 8%, #fff); border-left: 8px solid var(--a); }
.sd-list.ol { counter-reset: n; }
.sd-list.ol li { counter-increment: n; display: flex; gap: 16px; align-items: center; }
.sd-list.ol li::before { content: counter(n); flex: none; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 800; background: linear-gradient(135deg, var(--a), var(--b)); }
.sd-foot { font-size: 24px; font-weight: 700; color: #b45309; margin: 0; }
.sd-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.sd-cards div { border-radius: 20px; padding: 18px 22px; background: color-mix(in srgb, var(--a) 8%, #fff); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--a) 22%, #fff); }
.sd-cards b { display: block; font-family: "Baloo 2", Nunito, sans-serif; font-size: 32px; color: var(--a); line-height: 1.1; }
.sd-cards span { font-size: 21px; color: #4a4466; line-height: 1.35; }
.sd-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.sd-opts div { font-size: 28px; font-weight: 700; padding: 18px 24px; border-radius: 18px; background: color-mix(in srgb, var(--a) 8%, #fff); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--a) 20%, #fff); display: flex; gap: 14px; align-items: center; }
.sd-opts div b { flex: none; width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: var(--a); }
.sd-s.shown .sd-opts div.ok { background: #d1fae5; box-shadow: inset 0 0 0 3px #10b981; }
.sd-s.shown .sd-opts div:not(.ok) { opacity: .45; }
.sd-ans { font-size: 28px; font-weight: 800; color: #059669; margin: 0; visibility: hidden; }
.sd-s.shown .sd-ans { visibility: visible; }
.sd-s.title { color: #fff; background: linear-gradient(130deg, var(--a), var(--b)); justify-content: center; align-items: center; text-align: center; gap: 22px; padding: 60px; }
.sd-s.title::before { display: none; }
.sd-s.title::after { background: rgba(255,255,255,.1); }
.sd-s.title .e { font-size: 120px; line-height: 1; position: relative; z-index: 1; }
.sd-s.title h1 { font-size: 84px; position: relative; z-index: 1; text-shadow: 0 4px 10px rgba(0,0,0,.18); }
.sd-s.title p { font-size: 28px; font-weight: 800; margin: 0; opacity: .95; position: relative; z-index: 1; }
.sd-chips { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; position: relative; z-index: 1; }
.sd-chips span { font-size: 22px; font-weight: 800; padding: 6px 18px; border-radius: 999px; background: rgba(255,255,255,.2); box-shadow: inset 0 0 0 2px rgba(255,255,255,.4); }
.sd-num { position: absolute; right: 30px; bottom: 20px; font-size: 18px; font-weight: 800; color: #a29bbd; z-index: 1; }
.sd-s.title .sd-num { color: rgba(255,255,255,.7); }`;
  if (!document.getElementById("sdCss")) { const st = document.createElement("style"); st.id = "sdCss"; st.textContent = SD_CSS; document.head.appendChild(st); }

  function slideHtml(s, i, n) {
    const [a, b] = SD_THEMES[s.th] || SD_THEMES.title, num = `<span class="sd-num">${i + 1} / ${n}</span>`, st = `style="--a:${a};--b:${b}"`;
    if (s.lay === "title") return `<section class="sd-s title" ${st}><div class="e">${s.emoji}</div><h1>${esc(s.title)}</h1><p>${esc(s.lead)}</p>${s.chips.length ? `<div class="sd-chips">${s.chips.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}${num}</section>`;
    const h = `<h2 class="${s.title.length > 90 ? "long" : ""}">${esc(s.title)}</h2>`;
    let inner = "";
    if (s.lay === "big") inner = `${h}${s.lead ? `<p class="sd-lead">${esc(s.lead)}</p>` : ""}`;
    else if (s.lay === "list") inner = `${h}${s.items.length ? `<ul class="sd-list ${s.ordered ? "ol" : ""}">${s.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${s.foot ? `<p class="sd-foot">${esc(s.foot)}</p>` : ""}`;
    else if (s.lay === "cards") inner = `${h}<div class="sd-cards">${s.cards.map(([k, m]) => `<div><b>${esc(k)}</b><span>${esc(m)}</span></div>`).join("")}</div>`;
    else if (s.lay === "quiz") inner = `${h}${s.options.length ? `<div class="sd-opts">${s.options.map((o, k) => `<div class="${norm(o) === norm(s.answer) ? "ok" : ""}"><b>${"ABCD"[k]}</b>${esc(o)}</div>`).join("")}</div>` : ""}<p class="sd-ans">✅ Answer: ${esc(s.answer)}</p>`;
    return `<section class="sd-s ${s.lay}" ${st}><div class="sd-kick"><i>${s.emoji}</i>${esc(s.kicker)}</div><div class="sd-in">${inner}</div>${num}</section>`;
  }

  // 🖨️ PDF: every slide on its own landscape page (quiz answers shown)
  function printDeck(deck) {
    const n = deck.slides.length;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(deck.file)}</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
<style>@page { size: 1280px 720px; margin: 0; } body { margin: 0; } .sd-s { break-after: page; -webkit-print-color-adjust: exact; print-color-adjust: exact; }${SD_CSS}</style></head>
<body>${deck.slides.map((s, i) => slideHtml(s, i, n).replace('class="sd-s quiz"', 'class="sd-s quiz shown"')).join("")}</body></html>`;
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(f);
    f.onload = () => setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 800);
    f.srcdoc = html;
  }

  // ⬇️ PowerPoint (.pptx), drawn with PptxGenJS; quiz answers go on the slide after each question
  let pptxLib = null;
  const loadPptx = () => pptxLib || (pptxLib = new Promise((ok, no) => {
    if (window.PptxGenJS) return ok(window.PptxGenJS);
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
    s.onload = () => ok(window.PptxGenJS); s.onerror = () => { pptxLib = null; no(new Error("Could not load PowerPoint maker")); }; document.head.appendChild(s);
  }));
  async function pptxDeck(deck) {
    const P = await loadPptx(), pp = new P();
    pp.layout = "LAYOUT_WIDE"; pp.title = deck.file;
    const H = (c) => c.replace("#", ""), FONT = "Arial", INK = "1F1640", SOFT = "4A4466";
    const add = (s, shown) => {
      const [a, b] = SD_THEMES[s.th] || SD_THEMES.title, sl = pp.addSlide();
      if (s.lay === "title") {
        sl.background = { color: H(a) };
        sl.addShape(pp.ShapeType.ellipse, { x: 9.6, y: 3.9, w: 5.2, h: 5.2, fill: { color: H(b) } });
        sl.addText(s.emoji, { x: 0, y: 0.9, w: 13.33, h: 1.5, align: "center", fontSize: 80 });
        sl.addText(s.title, { x: 0.8, y: 2.5, w: 11.73, h: 1.5, align: "center", fontSize: 54, bold: true, color: "FFFFFF", fontFace: FONT, fit: "shrink" });
        sl.addText(s.lead, { x: 0.8, y: 4.0, w: 11.73, h: 0.6, align: "center", fontSize: 22, bold: true, color: "FFFFFF", fontFace: FONT });
        if (s.chips.length) sl.addText(s.chips.join("     "), { x: 0.8, y: 4.8, w: 11.73, h: 0.8, align: "center", fontSize: 18, bold: true, color: "FFFFFF", fontFace: FONT, fit: "shrink" });
        return;
      }
      sl.background = { color: "FFFFFF" };
      sl.addShape(pp.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.14, fill: { color: H(a) } });
      sl.addShape(pp.ShapeType.ellipse, { x: 10.6, y: 4.6, w: 4.4, h: 4.4, fill: { color: H(b), transparency: 90 } });
      sl.addText(`${s.emoji}  ${s.kicker.toUpperCase()}`, { x: 0.7, y: 0.45, w: 11, h: 0.6, fontSize: 18, bold: true, color: H(a), fontFace: FONT, charSpacing: 2 });
      const tH = s.lay === "big" ? 2.6 : 1.4;
      sl.addText(s.title, { x: 0.7, y: s.lay === "big" ? 1.6 : 1.2, w: 11.9, h: tH, fontSize: s.title.length > 90 ? 28 : 36, bold: true, color: INK, fontFace: FONT, valign: s.lay === "big" ? "middle" : "top", fit: "shrink" });
      if (s.lay === "big" && s.lead) sl.addText(s.lead, { x: 0.7, y: 4.4, w: 11.9, h: 2.0, fontSize: 22, color: SOFT, fontFace: FONT, valign: "top", fit: "shrink" });
      if (s.lay === "list") {
        sl.addText(s.items.map((t) => ({ text: t, options: { bullet: s.ordered ? { type: "number" } : false, paraSpaceAfter: 12 } })), { x: 0.9, y: 2.75, w: 11.6, h: s.foot ? 3.4 : 4.1, fontSize: 22, color: INK, fontFace: FONT, valign: "top", fit: "shrink" });
        if (s.foot) sl.addText(s.foot, { x: 0.9, y: 6.3, w: 11.6, h: 0.6, fontSize: 18, bold: true, color: "B45309", fontFace: FONT, fit: "shrink" });
      }
      if (s.lay === "cards") s.cards.forEach(([k, m], j) => {
        const x = 0.7 + (j % 3) * 4.05, y = 2.75 + Math.floor(j / 3) * 2.05;
        sl.addShape(pp.ShapeType.roundRect, { x, y, w: 3.85, h: 1.85, rectRadius: 0.15, fill: { color: "F3F0FF" }, line: { color: H(a), width: 1.5 } });
        sl.addText([{ text: k, options: { bold: true, color: H(a), fontSize: 22, breakLine: true } }, { text: m, options: { color: SOFT, fontSize: 15 } }], { x: x + 0.15, y: y + 0.1, w: 3.55, h: 1.65, fontFace: FONT, valign: "top", fit: "shrink" });
      });
      if (s.lay === "quiz") {
        s.options.forEach((o, j) => {
          const ok = shown && norm(o) === norm(s.answer), x = 0.7 + (j % 2) * 6.0, y = 3.0 + Math.floor(j / 2) * 1.3;
          sl.addShape(pp.ShapeType.roundRect, { x, y, w: 5.8, h: 1.1, rectRadius: 0.12, fill: { color: ok ? "D1FAE5" : "F3F0FF" }, line: { color: ok ? "10B981" : "DDD6FE", width: ok ? 3 : 1 } });
          sl.addText(`${"ABCD"[j]}   ${o}`, { x: x + 0.2, y, w: 5.4, h: 1.1, fontSize: 22, bold: true, color: INK, fontFace: FONT, valign: "middle", fit: "shrink" });
        });
        if (shown) sl.addText(`✅ Answer: ${s.answer}`, { x: 0.7, y: 5.75, w: 11.9, h: 0.7, fontSize: 24, bold: true, color: "059669", fontFace: FONT });
        sl.addNotes(`Answer: ${s.answer}`);
      }
    };
    deck.slides.forEach((s) => { add(s, false); if (s.lay === "quiz") add(s, true); });
    await pp.writeFile({ fileName: `${deck.file.replace(/[^\w\- ]+/g, "").replace(/\s+/g, " ").trim()}.pptx` });
  }

  function openSlides(plan, w) {
    const deck = deckFor(plan, w), n = deck.slides.length;
    const el = stage(`🎞️ ${esc(deck.title)}`);
    const body = $(".lc-stage-body", el); body.classList.add("sd-stage");
    $(".lc-stage-extra", el).innerHTML = `<button class="btn ghost" data-sd="pptx" title="Download as a PowerPoint file">⬇️ PowerPoint</button><button class="btn ghost" data-sd="pdf" title="Print or save as PDF, one slide per page">🖨️ PDF</button><button class="btn ghost" data-sd="full">⛶ Full screen</button>`;
    body.innerHTML = `<div class="sd-view"><div class="sd-fit"></div></div>
      <div class="sd-bar"><button class="btn ghost" data-sd="prev">‹ Back</button><div class="sd-dots">${deck.slides.map((s, k) => `<button data-k="${k}" title="${esc(s.kicker || s.title)}">${s.emoji}</button>`).join("")}</div><button class="btn" data-sd="next">Next ›</button></div>`;
    const view = $(".sd-view", body), fit = $(".sd-fit", body);
    let i = 0;
    const scale = () => { const r = view.getBoundingClientRect(), k = Math.min(r.width / 1280, r.height / 720); fit.style.transform = `translate(-50%, -50%) scale(${k})`; };
    const show = (k, dir = 1) => {
      i = Math.max(0, Math.min(n - 1, k));
      fit.innerHTML = slideHtml(deck.slides[i], i, n);
      fit.firstElementChild.animate([{ opacity: 0, transform: `translateX(${dir * 30}px)` }, { opacity: 1, transform: "none" }], { duration: 260, easing: "ease-out" });
      $$(".sd-dots button", body).forEach((b, j) => b.classList.toggle("on", j === i));
      $(".sd-dots button.on", body)?.scrollIntoView({ block: "nearest", inline: "center" });
      $("[data-sd=prev]", body).disabled = i === 0;
      $("[data-sd=next]", body).textContent = deck.slides[i].lay === "quiz" ? "Show answer ›" : i === n - 1 ? "Done ✓" : "Next ›";
    };
    // On a quiz slide, Next first shows the answer, then moves on
    const next = () => { const s = $(".sd-s", fit); if (s?.classList.contains("quiz") && !s.classList.contains("shown")) { s.classList.add("shown"); $("[data-sd=next]", body).textContent = "Next ›"; CP().beep("up"); } else if (i < n - 1) show(i + 1, 1); else closeStage(); };
    $("[data-sd=prev]", body).onclick = () => show(i - 1, -1);
    $("[data-sd=next]", body).onclick = next;
    fit.onclick = (e) => { if (!e.target.closest("button")) next(); };
    $$(".sd-dots button", body).forEach((b) => b.onclick = () => show(+b.dataset.k, +b.dataset.k > i ? 1 : -1));
    $("[data-sd=pdf]", el).onclick = () => printDeck(deck);
    const pb = $("[data-sd=pptx]", el);
    pb.onclick = () => { pb.disabled = true; pb.textContent = "⏳ Making…"; pptxDeck(deck).then(() => { pb.textContent = "✅ Downloaded"; }, (e) => { pb.textContent = "⚠️ Try again"; console.warn(e); }).finally(() => { pb.disabled = false; }); };
    const fb = $("[data-sd=full]", el), fsLabel = () => { fb.textContent = document.fullscreenElement ? "🗗 Exit full screen" : "⛶ Full screen"; setTimeout(scale, 60); };
    fb.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.())?.catch?.(() => {});
    const key = (e) => { if ($("#modal").open || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return; const d = pointerKey(e); if (d) { e.preventDefault(); d > 0 ? next() : show(i - 1, -1); } };
    const ro = new ResizeObserver(scale); ro.observe(view);
    document.addEventListener("keydown", key); document.addEventListener("fullscreenchange", fsLabel);
    stageCleanup.push(() => { ro.disconnect(); document.removeEventListener("keydown", key); document.removeEventListener("fullscreenchange", fsLabel); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });
    scale(); show(0);
  }

  function frameGame(plan, w, html, title) {
    const el = stage(title);
    $(".lc-stage-body", el).innerHTML = `<iframe class="lc-frame" title="${esc(title)}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    $(".lc-frame", el).srcdoc = html;
  }

  function open(go, plan, w) {
    if (go === "teach") teachMap(plan, w);
    else if (go === "deck") openSlides(plan, w);
    else if (go === "study") openStudy(plan, w, "week");
    else if (go === "studyall") openStudy(plan, w, "term");
    else if (go === "slides") teach(plan, w);
    else if (go === "live") {
      const quiz = LC.quizTen(plan.id, w.week);
      const questions = quiz.map((it) => ({ q: it.q, options: LC.optionsForItem(plan.id, it, quiz), answer: it.a }));
      const title = focusParts(w.focus, plan, w.week).text;
      const questionsFor = (planId, week) => { const p = LC.LESSON_PLANS.find((x) => x.id === planId); if (!p) return null; const qz = LC.quizTen(planId, week); return qz.map((it) => ({ q: it.q, options: LC.optionsForItem(planId, it, qz), answer: it.a })); };
      window.LiveBoard.board(stage(`📺 Teacher board · ${esc(title)}`, { jars: false }), plan, w, title, questions, questionsFor); // no jar bar: right answers fill the jars on their own
    }
    else if (go === "quiz") teamQuiz(plan, w);
    else if (go === "games") jigsaw(plan, w);
    else if (go === "board") { const g = LC.gameFor(plan.id, w.week); frameGame(plan, w, LC.buildGameHtml(g, gameInput(plan, w, boardItems(plan, w))), `🎲 ${esc(g.name)}`); }
    else if (go === "mine") window.ActivityMaker.open({ stage, starPicker, plan, w, where: `Year ${plan.year} · T${plan.term} ${calOf(plan, w.week).label}`, ready: { plans: () => LC.LESSON_PLANS, make: worksheetsFor, label: (p, wk) => `${calOf(p, wk).label} · ${focusParts(weekOf(p, wk).focus, p, wk).text}` }, onClose: (f) => stageCleanup.push(f) });
    else if (go === "cards") window.AnswerCards.open({ stage, plan, w, title: focusParts(w.focus, plan, w.week).text, items: gameItems(plan, w, "cards", 10), onClose: (f) => stageCleanup.push(f) });
    else if (go === "run") { const t = LC.runThemeFor(plan.id, w.week); frameGame(plan, w, LC.buildPlatformerHtml(gameInput(plan, w, gameItems(plan, w, "run", RUN_LEVEL)), t, runLevelsFor(plan, w)), `🏃 ${esc(t.name)}`); }
  }

  // Teacher settings at the bottom of every page: History and Setup (no longer in the top bar), behind the same
  // teacher password as Sync (one unlock per browser tab covers both).
  let footAsk = false;
  function renderFoot() {
    const f = $("#teacherFoot"); if (!f) return;
    if (typeof renderYearNav === "function" && $("#yearNav")) setTimeout(renderYearNav, 0);
    f.innerHTML = syncOpen()
      ? `<button class="btn ghost" data-foot="history">📜 History</button><button class="btn ghost" data-foot="settings">⚙️ Setup</button><button class="btn ghost" data-footsync title="${esc(syncWhat())} — download the latest lessons from your Life Competencies app">🔄 Sync lessons</button><button class="btn ghost" data-footlock>🔒 Lock</button>`
      : footAsk
        ? `<form class="lc-syncpass" data-footform><label>🔒 Teacher password <input type="password" inputmode="numeric" autocomplete="off" required data-footpw></label><button class="btn">Unlock</button><button type="button" class="btn ghost" data-footcancel>Cancel</button><span class="lc-syncerr" hidden>❌ Wrong password</span></form>`
        : `<button class="btn ghost" data-footask>🔒 Teacher settings</button><button class="btn ghost" data-footask>🔒 Teacher: sync lessons</button>`;
    $("[data-footpw]", f)?.focus();
  }
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-footask]")) { footAsk = true; renderFoot(); }
    else if (t.closest("[data-footsync]")) syncNow(t.closest("[data-footsync]")).then(() => {}, () => {});
    else if (t.closest("[data-footcancel]")) { footAsk = false; renderFoot(); }
    else if (t.closest("[data-footlock]")) { try { sessionStorage.removeItem("lc-sync-ok"); sessionStorage.removeItem("lc-teacher-pw"); } catch {} footAsk = false; renderFoot(); document.querySelector('[data-tab="home"]').click(); }
    else if (t.closest("[data-foot]")) { document.querySelector(`[data-tab="${t.closest("[data-foot]").dataset.foot}"]`).click(); }
  });
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-footform]"); if (!form) return;
    e.preventDefault();
    if (await sha256($("[data-footpw]", form).value.trim()) === SYNC_PASS_SHA) { try { sessionStorage.setItem("lc-sync-ok", "1"); sessionStorage.setItem("lc-teacher-pw", $("[data-footpw]", form).value.trim()); } catch {} footAsk = false; renderFoot(); }
    else { $(".lc-syncerr", form).hidden = false; $("[data-footpw]", form).value = ""; $("[data-footpw]", form).focus(); }
  });
  renderFoot();

  // Leaderboard, Award and Rewards are teacher-only: same teacher password as Sync/Setup (unlocked per tab).
  const TEACHER_TABS = new Set(["board", "students", "rewards"]);
  function askTeacher(then) {
    $(".tlock")?.remove();
    const box = document.createElement("div");
    box.className = "tlock";
    box.innerHTML = `<form class="tlock-card" data-tlock><div class="tlock-e">🔒</div><h2>Teacher only</h2><p class="muted">Leaderboard, Award and Rewards need the teacher password.</p>
      <input type="password" inputmode="numeric" autocomplete="off" required placeholder="Teacher password" aria-label="Teacher password" data-tlockpw>
      <span class="lc-syncerr" hidden>❌ Wrong password</span>
      <div class="tlock-btns"><button type="button" class="btn ghost" data-tlockno>Cancel</button><button class="btn">Unlock</button></div></form>`;
    document.body.appendChild(box);
    const form = $("[data-tlock]", box), pw = $("[data-tlockpw]", box);
    pw.focus();
    $("[data-tlockno]", box).onclick = () => box.remove();
    box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") box.remove(); });
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (await sha256(pw.value.trim()) === SYNC_PASS_SHA) {
        try { sessionStorage.setItem("lc-sync-ok", "1"); sessionStorage.setItem("lc-teacher-pw", pw.value.trim()); } catch {}
        box.remove(); renderFoot(); then();
      } else { $(".lc-syncerr", box).hidden = false; pw.value = ""; pw.focus(); }
    };
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ytab], [data-tab]"); if (!b) return;
    const k = b.dataset.ytab || b.dataset.tab;
    if (!TEACHER_TABS.has(k) || syncOpen()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    askTeacher(() => b.click());
  }, true);

  // Each year group has its own menu (Lessons, Leaderboard, Award, Activities, Rewards) under its banner, instead of
  // those tabs sitting in the top bar. The other pages open filtered to the year (window.currentYear, read by app.js).
  const YEAR_TABS = [["lessons", "📚", "Lessons"], ["board", "🏆", "Leaderboard"], ["students", "⭐", "Award"], ["activities", "🎲", "Activities"], ["rewards", "🎁", "Rewards"]];
  function renderYearNav() {
    let nav = $("#yearNav");
    if (!nav) { nav = document.createElement("div"); nav.id = "yearNav"; $("#app").prepend(nav); }
    const active = ($(".view.active")?.id || "").replace("view-", "");
    const on = !!pick.year && YEAR_TABS.some(([k]) => k === active);
    window.currentYear = on ? pick.year : null;
    let head = ""; try { head = yearHeader(pick.year); } catch { head = `<div class="year-head"><button class="btn ghost" data-home>‹ All years</button><h2>Year ${pick.year}</h2></div>`; }
    const terms = active === "lessons" && termsOpen && LC ? [1, 2, 3].map((t) => planFor(pick.year, t)).filter(Boolean) : [];
    // Terms + About Term sit as a sub-menu right under "Lessons"
    const sub = terms.length ? `<div class="ynav-terms">${terms.map((p) => `<button data-sterm="${p.term}" class="${p.term === pick.term ? "on" : ""}"><b>Term ${p.term}</b><span>${esc(p.title)}</span></button>`).join("")}</div>` : "";
    nav.innerHTML = on ? `${head}<aside class="ynav-side"><nav class="year-tabs">${YEAR_TABS.map(([k, e, t]) => `<button data-ytab="${k}" class="${k === active ? "on" : ""}"><span>${e}</span>${t}${k === "lessons" && active === "lessons" ? `<i class="ycaret">${termsOpen ? "▴" : "▾"}</i>` : ""}${TEACHER_TABS.has(k) && !syncOpen() ? `<i class="ylock" title="Teacher only">🔒</i>` : ""}</button>${k === "lessons" ? sub : ""}`).join("")}</nav></aside>` : "";
    document.body.classList.toggle("ynav-on", on);
    $$("[data-sterm]", nav).forEach((b) => b.onclick = () => { pick.term = +b.dataset.sterm; const n = nextLesson(pick.year); pick.week = n && n.term === pick.term ? n.week : 1; weeksOpen = false; shareOpen = false; renderLessons(); });
    const home = $("[data-home]", nav); if (home) home.onclick = () => document.querySelector('[data-tab="home"]').click();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ytab]"); if (!b) return;
    const k = b.dataset.ytab, y = String(pick.year), set = (sel, v) => { const el = $(sel); if (el) el.value = v; };
    if (k === "lessons") termsOpen = $("#view-lessons")?.classList.contains("active") ? !termsOpen : true; // the terms show only after tapping Lessons
    window.currentYear = pick.year;
    if (k === "board") { set("#bYear", y); set("#bClass", ""); }
    if (k === "students") { set("#fYear", y); set("#fClass", ""); set("#fGroup", ""); set("#search", ""); }
    document.querySelector(`[data-tab="${k}"]`).click();
    if (k === "board") $("#bYear")?.dispatchEvent(new Event("input"));
    if (k === "students") $("#fYear")?.dispatchEvent(new Event("input"));
  });
  document.addEventListener("click", (e) => { if (e.target.closest("[data-tab], [data-ytab], [data-home], [data-y]")) setTimeout(renderYearNav, 0); });

  // Share mode: lifecomp.vercel.app/map/3-1-8 (→ /?map=3-1-8) opens only that lesson's mind map for students and
  // parents — no close button, no star/group pickers, no teacher settings (CSS: body.share-view).
  if (SHARE) {
    document.body.classList.add("share-view");
    loadData().then(() => {
      const [y, t, cal] = SHARE.split("-").map(Number);
      const plan = LC.LESSON_PLANS.find((p) => p.year === y && p.term === t);
      if (!plan) return;
      const row = (LC.termSchedule ? LC.termSchedule(plan.id) : []).find((r) => r.cal === `Week ${cal}` && r.weeks.length);
      teachMap(plan, weekOf(plan, row ? row.weeks[0] : cal));
    });
  }

  if (NOTES) {
    document.body.classList.add("share-view");
    loadData().then(() => {
      const [y, t, cal] = NOTES.split("-").map(Number);
      const plan = planFor(y, t || 1); if (!plan) return;
      const row = cal ? schedule(plan).find((r) => r.cal === `Week ${cal}` && r.weeks.length) : null;
      openStudy(plan, cal ? weekOf(plan, row ? row.weeks[0] : cal) : plan.weeks[0], cal ? "week" : t ? "term" : "year");
    });
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
