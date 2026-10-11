/* Live play: students answer on their own devices while the board shows the question.
   Uses the Life Competencies app's Live Class database functions (live_open / live_control / live_join /
   live_submit / live_state), polled like the LC app does. Shared by the board (here) and play.html. */
(() => {
  "use strict";
  const CFG = window.LIVE_CONFIG || {};
  const POLL_MS = 900;

  async function rpc(fn, args) {
    if (!CFG.url) throw new Error("Live play is not set up");
    const r = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(args || {}),
    });
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) {
      const msg = (data && (data.message || data.hint)) || `Live play error (${r.status})`;
      throw new Error(/teacher key/i.test(msg) ? "That teacher key is not right" : /unknown live session/i.test(msg) ? "That game has ended" : msg);
    }
    return data;
  }

  const Live = {
    open: (o) => rpc("live_open", { p_key: o.key, p_academic_year: o.academicYear || "", p_class_id: o.classId, p_class_label: o.classLabel, p_plan_id: o.planId, p_week: o.week, p_title: o.title, p_stops: o.stops, p_seconds: o.seconds }),
    control: (o) => rpc("live_control", { p_key: o.key, p_code: o.code, p_phase: o.phase, p_stop: o.stop, p_question: o.question ?? null, p_answer: o.answer ?? null, p_target: o.target ?? null, p_seconds: o.seconds ?? null }),
    now: async () => ((await rpc("live_now", {})) || []).map((g) => ({ code: g.code, classId: g.class_id, classLabel: g.class_label, title: g.title, phase: g.phase, players: +g.players })),
    join: (code, student) => rpc("live_join", { p_code: code, p_student: student }),
    submit: (code, student, stop, choice) => rpc("live_submit", { p_code: code, p_student: student, p_stop: stop, p_choice: choice }),
    state: async (code) => {
      const s = await rpc("live_state", { p_code: code });
      if (!s) return null;
      return { ...s, stop: +s.stop, stops: +s.stops, seconds: +s.seconds, players: (s.players || []).map((p) => ({ ...p, score: +p.score, rights: +p.rights })) };
    },
    POLL_MS,
  };
  Live.rpc = rpc; // also used by My activities (online hand-in: mint_lesson / submit_lesson / lesson_submissions_for)
  window.Live = Live;

  /* ---------------- Board (teacher's screen, opened from a lesson) ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CP = () => window.ClassPoints;
  const TILE_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#22c55e", "#a855f7", "#14b8a6"];
  const SHAPES = ["▲", "◆", "●", "■", "★", "♥"];
  const KEY_STORE = "class-points-live-key";
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

  // Match a name typed on a device to a Class Points student (full name, then first name if unique)
  function matchStudent(name, students) {
    const n = norm(name);
    let m = students.find((s) => norm(s.name) === n);
    if (m) return m;
    const first = n.split(" ")[0];
    const hits = students.filter((s) => norm(s.name).split(" ")[0] === first);
    return hits.length === 1 ? hits[0] : null;
  }

  // Typed answer instead of tiles (fill-in gaps without options, written questions)
  const isTyped = (q) => q.kind === "type" || !(q.options || []).length;

  function setupDialog(plan, w, title, questions, onReady, questionsFor) {
    let key = ""; try { key = sessionStorage.getItem(KEY_STORE) || ""; } catch { /* private mode */ }
    // Same class ids as the Life Competencies app ("year1"…), so the game shows under "Live now" for that year group
    // on both apps' student pages, and opening a new game ends that class's older one.
    const lists = (window.LC && window.LC.CLASS_LISTS) || window.CLASS_LISTS || [1, 2, 3, 4, 5, 6].map((y) => ({ id: `year${y}`, label: `Year ${y}`, year: y, students: [] }));
    CP().modal(`<h2>📺 Teacher board</h2>
      <p class="muted">Students join from <b>I'm a student → Play</b> on their devices and answer together. Right answers earn ⭐ for the student and their group jar.</p>
      <div class="lv-running"></div>
      <label class="edit-label">Class <select data-class>${lists.map((c) => `<option value="${esc(c.id)}" ${c.year === plan.year ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select></label>
      <div class="lv-row"><label class="edit-label">Questions <select data-n>${[...new Set([5, 8, 10, 15, questions.length].filter((n) => n <= questions.length || n === 5))].sort((a, b) => a - b).map((n) => `<option value="${n}" ${n === (questions.length <= 15 ? questions.length : 10) ? "selected" : ""}>${n === questions.length && n > 5 ? `All ${n}` : n}</option>`).join("")}</select></label>
      <label class="edit-label">Seconds each <select data-sec>${[10, 15, 20, 30].map((n) => `<option ${n === 20 ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
      <label class="edit-label">Teacher key <input data-key type="password" autocomplete="current-password" value="${esc(key)}" placeholder="The school's teacher key (same as the Life Competencies app)" /></label>
      <p class="lv-err" hidden></p>
      <div class="opts"><button class="btn ghost" data-no>Cancel</button><button class="btn" data-go>🚀 Start a new game</button></div>`, (d) => {
      $("[data-no]", d).onclick = () => d.close();
      // A game already running for this class (students may have joined it): open its board instead of a new game
      const yearOf = (g) => { const m = /year\s*(\d+)/i.exec(`${g.classId || ""} ${g.classLabel || ""}`); return m ? `year${m[1]}` : g.classId; };
      let running = [];
      const showRunning = () => {
        const want = $("[data-class]", d).value, mine = running.filter((g) => g.phase !== "end" && yearOf(g) === want).slice(0, 1), box = $(".lv-running", d);
        box.innerHTML = mine.map((g) => `<div class="lv-run"><span>🔴</span><div><b>Running now · ${esc(g.classLabel)} · code ${esc(g.code)}</b><small>${esc(g.title || "")} · ${g.players} student${g.players === 1 ? "" : "s"} joined</small></div>
          <button class="btn" data-attach="${esc(g.code)}">📺 Open its board</button></div>`).join("");
        $$("[data-attach]", box).forEach((b) => b.onclick = async () => {
          const err = $(".lv-err", d), k = $("[data-key]", d).value.trim();
          if (!k) { err.hidden = false; err.textContent = "Type the teacher key first (below)."; $("[data-key]", d).focus(); return; }
          b.disabled = true; b.textContent = "Opening…";
          try {
            const st = await Live.state(b.dataset.attach);
            if (!st) throw new Error("That game has ended");
            try { sessionStorage.setItem(KEY_STORE, k); } catch { /* private mode */ }
            // ask the game's own lesson questions (it may be another week than the one open here)
            let qs = questions;
            try { const own = questionsFor && st.planId && questionsFor(st.planId, +st.week); if (own && own.length) qs = own; } catch { /* keep this week's */ }
            d.close();
            onReady({ key: k, code: b.dataset.attach, stops: Math.min(st.stops || qs.length, qs.length), seconds: st.seconds || 20, cls: st.classLabel || "", questions: qs });
          } catch (e) { err.hidden = false; err.textContent = "⚠️ " + e.message; b.disabled = false; b.textContent = "📺 Open its board"; }
        });
      };
      $("[data-class]", d).onchange = showRunning;
      Live.now().then((g) => { running = g; showRunning(); }).catch(() => {});
      $("[data-go]", d).onclick = async () => {
        const btn = $("[data-go]", d), err = $(".lv-err", d);
        const k = $("[data-key]", d).value.trim(), cl = lists.find((c) => c.id === $("[data-class]", d).value) || { id: `year${plan.year}`, label: `Year ${plan.year}` }, cls = cl.label;
        if (!k) { err.hidden = false; err.textContent = "Type the teacher key first."; return; }
        btn.disabled = true; btn.textContent = "Opening…"; err.hidden = true;
        try {
          const n = +$("[data-n]", d).value, sec = +$("[data-sec]", d).value;
          const code = await Live.open({ key: k, classId: cl.id, classLabel: cl.label, planId: plan.id, week: w.week, title, stops: Math.min(n, questions.length), seconds: sec });
          try { sessionStorage.setItem(KEY_STORE, k); } catch { /* private mode */ }
          d.close();
          onReady({ key: k, code, stops: Math.min(n, questions.length), seconds: sec, cls });
        } catch (e) { err.hidden = false; err.textContent = "⚠️ " + e.message; btn.disabled = false; btn.textContent = "🚀 Open the game"; }
      };
    });
  }

  function board(stageEl, plan, w, title, questions, questionsFor) {
    const body = $(".lc-stage-body", stageEl);
    setupDialog(plan, w, title, questions, (g) => run(body, g, g.questions || questions), questionsFor);
    body.innerHTML = `<div class="lc-s-center lc-end"><div class="lc-s-emoji">📱</div><h2>Setting up Live play…</h2></div>`;
  }

  function run(body, g, questions) {
    const joinUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}play.html?c=${g.code}`;
    let st = null, i = -1, phase = "lobby", deadline = 0, revealed = false, timer = null, alive = true;
    const players = () => (st?.players || []);
    const awarded = new Set();

    const poll = async () => {
      if (!alive) return;
      try { st = await Live.state(g.code); draw(); } catch { /* keep trying */ }
      if (alive) timer = setTimeout(poll, POLL_MS);
    };
    const stopAll = () => { alive = false; clearTimeout(timer); };
    // stop polling when the stage closes
    const obs = new MutationObserver(() => { if (!body.isConnected) { stopAll(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });

    const lobby = () => {
      body.innerHTML = `<div class="lv-lobby">
        <div class="lv-join"><p>Go to</p><b class="lv-url">${esc(joinUrl.replace(/^https?:\/\//, "").replace(/\?c=.*/, ""))}</b><p>tap <b>${esc(g.cls)}</b> and join — or type the code</p><div class="lv-code">${g.code.split("").map((c) => `<span>${c}</span>`).join("")}</div>
          <div class="lv-qr" title="Scan to join"></div></div>
        <div class="lv-players"><h2><span data-count>0</span> players</h2><div class="lv-bubbles"></div>
          <button class="btn big" data-start disabled>▶ Start the game</button></div></div>`;
      const qr = $(".lv-qr", body);
      if (window.QRCode) new window.QRCode(qr, { text: joinUrl, width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M });
      $("[data-start]", body).onclick = () => ask(0);
    };

    const ask = async (n) => {
      i = n; phase = "asking"; revealed = false;
      const q = questions[i], typed = isTyped(q);
      try { await Live.control({ key: g.key, code: g.code, phase: "asking", stop: i, question: { q: q.q, options: typed ? [] : q.options, kind: typed ? "type" : "choice" }, answer: q.answer ?? null, seconds: g.seconds }); }
      catch (e) { CP().toast("⚠️ " + e.message); return; }
      deadline = Date.now() + g.seconds * 1000;
      body.innerHTML = `<div class="lv-ask"><div class="lc-kicker">Question ${i + 1} of ${g.stops} · code ${g.code}</div>
        <p class="lc-q">${esc(q.q)}</p>
        ${typed ? `<div class="lv-typed">✍️ Type your answer on your device</div><div class="lv-wall"></div>` : `<div class="lc-tiles">${q.options.map((o, k) => `<div class="lc-tile lv-opt" data-o="${esc(o)}" style="--tc:${TILE_COLORS[k % 6]}"><i>${SHAPES[k % 6]}</i><span>${esc(o)}</span><em class="lv-bar"></em><b class="lv-n"></b></div>`).join("")}</div>`}
        <div class="lv-status"><div class="lv-clock"></div><div class="lv-answered"></div><button class="btn" data-reveal>Show answer</button></div>
        <div class="lv-after" hidden></div></div>`;
      $("[data-reveal]", body).onclick = reveal;
      CP().beep("up");
    };

    const reveal = async () => {
      if (revealed) return; revealed = true; phase = "reveal";
      try { await Live.control({ key: g.key, code: g.code, phase: "reveal", stop: i }); } catch { /* the board still shows it */ }
      try { st = await Live.state(g.code); } catch { /* keep last */ }
      const q = questions[i], keyed = q.answer != null && q.answer !== "";
      if (keyed) $$(".lv-opt", body).forEach((t) => { const right = norm(t.dataset.o) === norm(q.answer); t.classList.toggle("right", right); t.classList.toggle("dim", !right); });
      const tally = st?.tally || {}, count = Object.values(tally).reduce((a, b) => a + b, 0), total = count || 1;
      $$(".lv-opt", body).forEach((t) => { const n = tally[t.dataset.o] || 0; $(".lv-n", t).textContent = n; $(".lv-bar", t).style.width = `${(n / total) * 100}%`; });
      if (isTyped(q)) {
        // Word wall of what the class typed; the right answer glows
        const most = Math.max(1, ...Object.values(tally));
        $(".lv-typed", body).innerHTML = keyed ? `✅ The answer: <b>${esc(q.answer)}</b>` : q.model ? `💡 Teacher's answer: <b>${esc(q.model)}</b>` : "💬 Here's what the class wrote";
        $(".lv-wall", body).innerHTML = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t, n]) => `<span class="lv-word ${keyed && norm(t) === norm(q.answer) ? "right" : ""}" style="font-size:${(1 + (n / most) * 1.1).toFixed(2)}rem">${esc(t)}${n > 1 ? ` <small>×${n}</small>` : ""}</span>`).join("") || `<span class="muted">No answers this time</span>`;
      }
      // stars: +1 point for every student who got it right (their group jar fills too)
      const students = CP().students();
      const right = players().filter((p) => p.answered && p.lastCorrect);
      const ids = [], unknown = [];
      right.forEach((p) => { const s = matchStudent(p.student, students); if (s) ids.push(s.id); else unknown.push(p.student); });
      const fresh = ids.filter((id) => !awarded.has(`${i}:${id}`));
      fresh.forEach((id) => awarded.add(`${i}:${id}`));
      if (fresh.length) CP().awardStudents(fresh, 1, "📱 Live play");
      const groupsHit = new Set(students.filter((s) => fresh.includes(s.id)).map((s) => s.groupId).filter(Boolean));
      groupsHit.forEach((gid) => CP().react(gid, "cheer"));
      if (right.length) CP().confetti(80);
      $(".lv-after", body).hidden = false;
      $(".lv-after", body).innerHTML = `<p>${!keyed ? `📊 <b>${count}</b> answer${count === 1 ? "" : "s"} — no single right answer, let's talk about them!` : right.length ? `🎉 <b>${right.length}</b> got it right${fresh.length ? ` · ⭐ ${fresh.length} star${fresh.length > 1 ? "s" : ""} added` : ""}` : "Nobody got that one — let's talk about it!"}
        ${unknown.length ? `<br><small class="muted">Not on the class list (no star): ${unknown.map(esc).join(", ")}</small>` : ""}</p>
        <button class="btn big" data-next>${i + 1 < g.stops ? "Next question ›" : "🏁 See the winners"}</button>`;
      $("[data-reveal]", body).hidden = true;
      $("[data-next]", body).onclick = () => (i + 1 < g.stops ? ask(i + 1) : end());
    };

    const end = async () => {
      phase = "end";
      try { await Live.control({ key: g.key, code: g.code, phase: "end", stop: i }); } catch { /* fine */ }
      const top = [...players()].sort((a, b) => b.score - a.score);
      body.innerHTML = `<div class="lv-end"><h2>🏆 The winners</h2><div class="lv-podium">${[1, 0, 2].filter((k) => top[k]).map((k) => `<div class="lv-pod p${k + 1}"><b>${esc(top[k].student)}</b><span>${top[k].score} pts</span><div>${["🥇", "🥈", "🥉"][k]}</div></div>`).join("")}</div>
        <ol class="lv-rest">${top.slice(3, 12).map((p) => `<li>${esc(p.student)} <b>${p.score}</b></li>`).join("")}</ol></div>`;
      CP().confetti(240); CP().beep("win");
      stopAll();
    };

    const draw = () => {
      if (!st) return;
      if (phase === "lobby") {
        const box = $(".lv-bubbles", body); if (!box) return;
        const have = new Set($$(".lv-bubble", box).map((b) => b.dataset.n));
        players().forEach((p) => { if (!have.has(p.student)) { box.insertAdjacentHTML("beforeend", `<span class="lv-bubble" data-n="${esc(p.student)}">${esc(p.student)}</span>`); CP().beep("tick"); } });
        $("[data-count]", body).textContent = players().length;
        $("[data-start]", body).disabled = !players().length;
      } else if (phase === "asking") {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        const done = players().filter((p) => p.answered).length;
        const c = $(".lv-clock", body); if (c) c.textContent = `⏱️ ${left}s`;
        const a = $(".lv-answered", body); if (a) a.textContent = `✋ ${done} / ${players().length} answered`;
        if (!revealed && (left === 0 || (players().length && done === players().length))) reveal();
      }
    };

    lobby(); poll();
  }

  window.LiveBoard = { board, matchStudent };
})();
