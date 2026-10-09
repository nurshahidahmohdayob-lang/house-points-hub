/* Lessons: the ZERA Life Competencies programme (Year 1–6, 234 weeks) inside Class Points.
   Lesson content comes from assets/lc-data.js (window.LC), bundled from the Life Competencies app by lc/build.mjs.
   Stars earned in lessons go straight into the group jars through window.ClassPoints. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const CP = () => window.ClassPoints;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const KEY = "class-points-lessons";
  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  const TILE_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#22c55e", "#a855f7", "#14b8a6"];

  let LC = null, loading = null;
  let pick = loadPick();
  function loadPick() { try { return { year: 1, term: 1, week: 1, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { year: 1, term: 1, week: 1 }; } }
  function savePick() { try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch { /* private mode */ } }

  // Lessons sync from the Life Competencies app: it republishes this file on every deploy, so edits there show up
  // here straight away. If it can't be reached (or its shape ever changes), fall back to our own bundled copy.
  const LIVE_DATA = "https://zera-life-competencies.vercel.app/class-points/lc-data.js";
  const LOCAL_DATA = "assets/lc-data.js?v=550436";
  const NEEDS = ["LESSON_PLANS", "noteFor", "deepFor", "visualFor", "quizTen", "optionsForItem", "buildLesson", "expandActivity", "gameFor", "buildGameHtml", "runThemeFor", "buildPlatformerHtml", "runLevels"];
  const usable = (x) => x && NEEDS.every((k) => k in x) && Array.isArray(x.LESSON_PLANS) && x.LESSON_PLANS.length > 0;
  function loadScript(src, ms) {
    return new Promise((res, rej) => {
      delete window.LC;
      const s = document.createElement("script");
      const t = setTimeout(() => { s.remove(); rej(new Error("timeout")); }, ms);
      s.src = src;
      s.onload = () => { clearTimeout(t); usable(window.LC) ? res(window.LC) : rej(new Error("unexpected lesson data")); };
      s.onerror = () => { clearTimeout(t); rej(new Error("offline")); };
      document.head.appendChild(s);
    });
  }
  let source = "";
  function loadData() {
    if (LC) return Promise.resolve(LC);
    if (loading) return loading;
    loading = loadScript(`${LIVE_DATA}?t=${Math.floor(Date.now() / 60000)}`, 8000)
      .then((x) => { source = "live"; return x; })
      .catch(() => loadScript(LOCAL_DATA, 15000).then((x) => { source = "copy"; return x; }))
      .then((x) => { LC = x; return x; })
      .catch(() => { loading = null; throw new Error("Could not load the lessons"); });
    return loading;
  }
  function syncNote() {
    const at = LC?.BUILT?.at ? new Date(LC.BUILT.at) : null;
    const when = at ? at.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    return source === "live"
      ? `<span class="lc-sync ok" title="Loaded from the Life Competencies app">🔄 Synced with Life Competencies${when ? ` · updated ${when}` : ""}</span>`
      : `<span class="lc-sync" title="The Life Competencies app couldn't be reached, so a saved copy is showing">📦 Using the saved copy of the lessons (Life Competencies app not reachable)</span>`;
  }

  const planFor = (year, term) => LC.LESSON_PLANS.find((p) => p.year === year && p.term === term);
  const weekOf = (plan, week) => plan.weeks.find((w) => w.week === week) || plan.weeks[0];
  // A week's focus may start with its emoji; if not, borrow the emoji from the week's teaching visual
  const focusParts = (focus, plan, week) => {
    const m = String(focus).match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
    if (m) return { emoji: m[1], text: m[2] };
    let emoji = "📘";
    try { if (plan) emoji = LC.visualFor(plan.id, week, LC.noteFor(plan.id, week))?.emoji || emoji; } catch { /* keep the book */ }
    return { emoji, text: focus };
  };

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
    const fp = focusParts(w.focus, plan, w.week);
    root.innerHTML = `
      ${syncNote()}
      <div class="lc-years">${[1, 2, 3, 4, 5, 6].map((y) => `<button class="lc-chip ${y === plan.year ? "on" : ""}" data-year="${y}">Year ${y}</button>`).join("")}</div>
      <div class="lc-terms">${[1, 2, 3].map((t) => { const p = planFor(plan.year, t); return p ? `<button class="lc-term ${t === plan.term ? "on" : ""}" data-term="${t}"><b>Term ${t}</b><span>${esc(p.title)}</span></button>` : ""; }).join("")}</div>
      <div class="lc-weeks">${plan.weeks.map((x) => { const f = focusParts(x.focus, plan, x.week); return `<button class="lc-week ${x.week === w.week ? "on" : ""}" data-week="${x.week}"><span class="e">${f.emoji}</span><small>Week ${x.week}</small><b>${esc(f.text)}</b></button>`; }).join("")}</div>
      <div class="card lc-home">
        <div class="lc-home-head">
          <div class="lc-big-emoji">${fp.emoji}</div>
          <div>
            <div class="muted small">Year ${plan.year} · Term ${plan.term} · Week ${w.week} · ${esc(plan.title)}</div>
            <h2 class="lc-title">${esc(fp.text)}</h2>
            <div class="lc-badges">${(plan.competencies || []).map((c) => `<span class="lc-badge">🧠 ${esc(c)}</span>`).join("")}${(plan.values || []).map((v) => `<span class="lc-badge v">💎 ${esc(v)}</span>`).join("")}</div>
          </div>
        </div>
        ${w.objectives ? `<p class="lc-obj"><b>🎯 Today:</b> ${esc(w.objectives)}</p>` : ""}
        <div class="lc-actions">
          <button class="lc-act" data-go="teach"><span>▶️</span><b>Teach the lesson</b><small>Interactive slides with games, timers & polls</small></button>
          <button class="lc-act" data-go="mind"><span>🧠</span><b>Mind map</b><small>Tap the bubbles to explore</small></button>
          <button class="lc-act live" data-go="live"><span>📱</span><b>Live play</b><small>Students answer on their own devices</small></button>
          <button class="lc-act" data-go="quiz"><span>⚔️</span><b>Team Quiz</b><small>Groups answer, stars drop in the jars</small></button>
          <button class="lc-act" data-go="games"><span>🧩</span><b>Puzzle games</b><small>Match, order, sort & true/false</small></button>
          <button class="lc-act" data-go="board"><span>🎲</span><b>${esc(LC.gameFor(plan.id, w.week).name)}</b><small>The week's board game</small></button>
          <button class="lc-act" data-go="run"><span>🏃</span><b>${esc(LC.runThemeFor(plan.id, w.week).name)}</b><small>Platform game with question blocks</small></button>
        </div>
      </div>`;
    $$("[data-year]", root).forEach((b) => b.onclick = () => { pick = { year: +b.dataset.year, term: 1, week: 1 }; renderLessons(); });
    $$("[data-term]", root).forEach((b) => b.onclick = () => { pick.term = +b.dataset.term; pick.week = 1; renderLessons(); });
    $$("[data-week]", root).forEach((b) => b.onclick = () => { pick.week = +b.dataset.week; renderLessons(); });
    $$("[data-go]", root).forEach((b) => b.onclick = () => open(b.dataset.go, plan, w));
    $(".lc-week.on", root)?.scrollIntoView({ block: "nearest", inline: "center" });
  }

  /* ---------------- Full-screen stage with live jars ---------------- */
  function stage(title, { jars = true } = {}) {
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
    if (doNow) S.push({ kicker: "Do now", tone: "warm", html: `<div class="lc-s-split"><div><div class="lc-s-emoji">⏱️</div><h2>Do now</h2><p class="lc-s-lead">${esc(doNow)}</p></div><div data-w="timer" data-sec="180"></div></div>` });
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

  /* ---------------- Mind map ---------------- */
  function mindMap(plan, w) {
    const L = LC.buildLesson(plan, w.week), n = L.notes;
    const el = stage(`🧠 Mind map · ${esc(focusParts(w.focus).text)}`, { jars: false });
    const branches = n.branches || [];
    const kw = (n.keywords || []).slice(0, 6);
    const nodes = [...branches.map((b) => ({ type: "branch", emoji: b.emoji, title: b.title, body: b.detail || b.explain })), ...kw.map(([word, meaning]) => ({ type: "word", emoji: "🔤", title: word, body: meaning }))];
    $(".lc-stage-body", el).innerHTML = `<div class="lc-mind"><svg class="lc-mind-lines"></svg>
      <button class="lc-node centre"><span>${n.centre?.emoji || "🧠"}</span><b>${esc(n.centre?.text || focusParts(w.focus).text)}</b></button>
      ${nodes.map((x, k) => `<button class="lc-node ${x.type}" data-k="${k}"><span>${x.emoji}</span><b>${esc(x.title)}</b></button>`).join("")}
      <div class="lc-mind-card" hidden></div></div>
      <p class="muted center">Tap a bubble to open its idea · ${nodes.length} ideas to explore</p>`;
    const box = $(".lc-mind", el), svg = $("svg", box);
    const layout = () => {
      const W = box.clientWidth, H = box.clientHeight, cx = W / 2, cy = H / 2;
      const rx = Math.min(W * 0.38, 520), ry = Math.min(H * 0.36, 260);
      const c = $(".centre", box); c.style.left = cx + "px"; c.style.top = cy + "px";
      let lines = "";
      $$(".lc-node[data-k]", box).forEach((b, k) => {
        const a = -Math.PI / 2 + (k / nodes.length) * Math.PI * 2;
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        b.style.left = x + "px"; b.style.top = y + "px"; b.style.animationDelay = (k * 0.35) + "s";
        lines += `<path d="M${cx},${cy} Q${(cx + x) / 2 + Math.sin(a) * 30},${(cy + y) / 2 - Math.cos(a) * 30} ${x},${y}" />`;
      });
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = lines;
    };
    layout(); const ro = new ResizeObserver(layout); ro.observe(box); stageCleanup.push(() => ro.disconnect());
    const card = $(".lc-mind-card", box);
    $$(".lc-node[data-k]", box).forEach((b) => b.onclick = () => {
      const x = nodes[+b.dataset.k]; b.classList.add("seen");
      card.hidden = false; card.innerHTML = `<button class="lc-x" aria-label="Close">✕</button><div class="lc-s-emoji">${x.emoji}</div><h2>${esc(x.title)}</h2><p class="lc-s-lead">${esc(x.body || "")}</p>`;
      card.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.8)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }], { duration: 220, easing: "ease-out" });
      $(".lc-x", card).onclick = () => card.hidden = true; CP().beep("up");
      if ($$(".lc-node[data-k]:not(.seen)", box).length === 0) { CP().toast("🎉 Every idea explored!"); CP().confetti(100); }
    });
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
    return { year: plan.year, term: plan.term, week: `Week ${w.week}`, topic: w.focus, subject: LC.LESSON_SUBJECT, objectives: w.objectives,
      questions: quiz, gameQuestions: quiz, options: quiz.map((it) => LC.optionsForItem(plan.id, it, quiz)) };
  }
  function frameGame(plan, w, html, title) {
    const el = stage(title);
    $(".lc-stage-body", el).innerHTML = `<iframe class="lc-frame" title="${esc(title)}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    $(".lc-frame", el).srcdoc = html;
  }

  function open(go, plan, w) {
    if (go === "teach") teach(plan, w);
    else if (go === "mind") mindMap(plan, w);
    else if (go === "live") {
      const quiz = LC.quizTen(plan.id, w.week);
      const questions = quiz.map((it) => ({ q: it.q, options: LC.optionsForItem(plan.id, it, quiz), answer: it.a }));
      const title = focusParts(w.focus, plan, w.week).text;
      window.LiveBoard.board(stage(`📱 Live play · ${esc(title)}`), plan, w, title, questions);
    }
    else if (go === "quiz") teamQuiz(plan, w);
    else if (go === "games") puzzles(plan, w);
    else if (go === "board") { const g = LC.gameFor(plan.id, w.week); frameGame(plan, w, LC.buildGameHtml(g, gameInput(plan, w)), `🎲 ${esc(g.name)}`); }
    else if (go === "run") { const t = LC.runThemeFor(plan.id, w.week); frameGame(plan, w, LC.buildPlatformerHtml(gameInput(plan, w), t, LC.runLevels(plan.id, w.week, w.focus)), `🏃 ${esc(t.name)}`); }
  }

  // Load + draw when the Lessons tab is opened
  document.addEventListener("click", (e) => { if (e.target.closest('[data-tab="lessons"]')) renderLessons(); });
  if ($("#view-lessons")?.classList.contains("active")) renderLessons();
  window.Lessons = { render: renderLessons };
})();
