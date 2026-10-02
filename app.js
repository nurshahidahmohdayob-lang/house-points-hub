/* Class Points Hub — all data is stored in this browser (localStorage). */
(() => {
  "use strict";

  const KEY = "class-points-hub-v1";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const YEARS = Array.from({ length: 11 }, (_, i) => i + 1);

  const DEFAULTS = () => ({
    groups: [
      { id: "g1", name: "Tigers", color: "#f97316", emoji: "🐯", bonus: 0 },
      { id: "g2", name: "Eagles", color: "#3b82f6", emoji: "🦅", bonus: 0 },
      { id: "g3", name: "Dolphins", color: "#14b8a6", emoji: "🐬", bonus: 0 },
      { id: "g4", name: "Pandas", color: "#a855f7", emoji: "🐼", bonus: 0 },
    ],
    students: [],
    behaviours: [
      { id: uid(), emoji: "🙋", label: "Great answer", pts: 1 },
      { id: uid(), emoji: "🤝", label: "Teamwork", pts: 1 },
      { id: uid(), emoji: "💖", label: "Kindness", pts: 2 },
      { id: uid(), emoji: "💪", label: "Hard work", pts: 2 },
      { id: uid(), emoji: "📚", label: "Homework done", pts: 1 },
      { id: uid(), emoji: "🌟", label: "Outstanding", pts: 5 },
      { id: uid(), emoji: "🗣️", label: "Off task", pts: -1 },
    ],
    rewards: [
      { id: uid(), emoji: "🪑", name: "Sit anywhere for a day", cost: 10 },
      { id: uid(), emoji: "🎵", name: "Choose the class music", cost: 15 },
      { id: uid(), emoji: "✏️", name: "Special pencil / sticker", cost: 20 },
      { id: uid(), emoji: "👑", name: "Teacher's helper for a day", cost: 25 },
      { id: uid(), emoji: "📝", name: "Homework pass", cost: 40 },
    ],
    log: [],
    sound: true,
    // The subjects a teacher teaches. Their own list: add and remove them in Setup.
    subjects: ["Mathematics", "Science", "English", "Bahasa Melayu"],
  });

  let state = load();
  let selected = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const st = { ...DEFAULTS(), ...saved };
        // Older saves had a free-typed "class" per student and no subject list:
        // keep whatever was typed, as subjects, so nobody's filter goes empty.
        if (!Array.isArray(saved.subjects)) {
          st.subjects = [...new Set([...st.subjects, ...st.students.map((s) => s.cls).filter(Boolean)])];
        }
        return st;
      }
    } catch (e) { /* ignore */ }
    return DEFAULTS();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("⚠️ Could not save in this browser"); }
  }

  const group = (id) => state.groups.find((h) => h.id === id);
  const student = (id) => state.students.find((s) => s.id === id);
  const groupTotal = (h) => h.bonus + state.students.filter((s) => s.groupId === h.id).reduce((a, s) => a + s.points, 0);
  const balance = (s) => s.points - s.spent;
  const initials = (n) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const timeAgo = (ts) => {
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return "just now";
    if (d < 3600) return Math.floor(d / 60) + "m ago";
    if (d < 86400) return Math.floor(d / 3600) + "h ago";
    return new Date(ts).toLocaleDateString();
  };

  /* ---------- Sound ---------- */
  let actx;
  function beep(type = "up") {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = { up: [523, 659, 784], down: [330, 262], tick: [880], win: [523, 659, 784, 1047], buy: [784, 988] }[type];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type === "down" ? "sawtooth" : "triangle";
        o.frequency.value = f;
        const t = actx.currentTime + i * 0.09;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(type === "tick" ? 0.05 : 0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(actx.destination);
        o.start(t); o.stop(t + 0.2);
      });
    } catch (e) { /* audio not available */ }
  }

  function clink(n = 0) {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      [1, 2.76].forEach((m, k) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = "sine"; o.frequency.value = (1320 + (n % 8) * 90) * m;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(k ? 0.03 : 0.09, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.4);
      });
    } catch (e) { /* audio not available */ }
  }

  /* ---------- Star jars ---------- */
  // Jar shapes + their star areas are generated by Blender (blender/build_assets.py -> assets/jars/shapes.js)
  const SHAPES = window.JAR_SHAPES || {};
  const SHAPE_KEYS = Object.keys(SHAPES);
  const shapeOf = (g) => (g && SHAPES[g.shape] ? g.shape : SHAPE_KEYS[0] || "clip");
  const JAR_CAP = 50; // stars that fill one jar
  const STAR = { s: 26, rowH: 13 };
  const geo = (shape) => ({ ...STAR, ...SHAPES[shape].stars });
  const rnd = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  function starPos(i, G) {
    const r = Math.floor(i / G.cols), k = i % G.cols;
    // fill each row in a shuffled order so the pile looks natural
    const order = [...Array(G.cols).keys()].sort((a, b) => rnd(r * 31 + a) - rnd(r * 31 + b));
    const c = order[k];
    const m = r === 0 ? G.m0 : r === 1 ? G.m1 : 0; // rounded jar bottoms
    const span = G.w - G.s - 2 * m;
    const x = Math.min(G.w - G.s, Math.max(0, m + (c / (G.cols - 1)) * span + (rnd(i * 3 + 1) - 0.5) * 6 + (r % 2 ? 3 : -3)));
    return { x, y: r * G.rowH + rnd(i * 7 + 2) * 3, rot: (rnd(i * 5 + 3) - 0.5) * 70 };
  }
  function makeStar(i, G) {
    const p = starPos(i, G), el = document.createElement("div");
    el.className = "jstar";
    el.style.left = p.x + "px"; el.style.bottom = p.y + "px";
    el.style.setProperty("--r", p.rot + "deg");
    el.innerHTML = `<img src="assets/star-${Math.floor(rnd(i * 11 + 5) * 6)}.png" alt="" draggable="false">`;
    el._pos = p;
    return el;
  }
  // The Blender-rendered layers of one jar (also used for previews in the editor)
  function jarArt(shape, withStars = true) {
    const d = `assets/jars/${shape}/`, st = SHAPES[shape].stars;
    return `<img class="jar-glass" src="${d}jar.png" alt="" draggable="false"><div class="jar-tint" style="--jar-mask:url(${d}jar.png)"></div>
        ${withStars ? `<div class="jar-stars" style="left:${st.left}px;bottom:${st.bottom}px;width:${st.w}px;height:${st.h}px"></div>` : ""}
        <img class="jar-front" src="${d}front.png" alt="" draggable="false">
        <div class="jar-eyes">
          <img class="eo" src="${d}eyes-open.png" alt="" draggable="false">
          <img class="ec" src="${d}eyes-closed.png" alt="" draggable="false">
          <img class="eh" src="${d}eyes-happy.png" alt="" draggable="false">
        </div>
        <div class="jar-lid" style="transform-origin:${st.lidX}px ${st.lidY}px"><img src="${d}lid.png" alt="" draggable="false"><div class="lid-tint" style="--lid-mask:url(${d}lid.png)"></div>${SHAPES[shape].extra ? `<img src="${d}extra.png" alt="" draggable="false">` : ""}</div>`;
  }
  function createJar(g) {
    const w = document.createElement("div");
    const shape = shapeOf(g);
    w.className = "jar-wrap"; w.dataset.id = g.id; w.dataset.shape = shape;
    w._geo = geo(shape);
    w.innerHTML = `<div class="jar-rank"></div>
      <div class="jar" role="button" tabindex="0">
        ${jarArt(shape)}
        <div class="jar-over" hidden></div>
      </div>
      <div class="jar-name"></div>
      <div class="jar-count"><b>0</b> ⭐</div>
      <div class="jar-tools">
        <button data-minus title="Take one star away"><b class="minus-sign">−</b> Deduct</button>
        <button data-empty title="Empty this jar">🫙 Empty</button>
      </div>
      <button class="jar-edit" data-edit title="Change name, colour or shape" aria-label="Edit jar">✏️</button>`;
    const jar = $(".jar", w);
    jar.onclick = () => awardGroup(g.id, 1, "⭐ Star jar");
    jar.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jar.click(); } };
    $("[data-minus]", w).onclick = () => {
      if (groupTotal(group(g.id)) <= 0) return toast("This jar is already empty");
      awardGroup(g.id, -1, "➖ Star taken away");
    };
    $("[data-empty]", w).onclick = () => {
      const cur = group(g.id), total = groupTotal(cur);
      if (total <= 0) return toast("This jar is already empty");
      confirmBox(`Empty ${cur.emoji} ${cur.name}'s jar? All ${total} stars (and full-jar badges) go back to 0. Students keep their own points.`,
        () => awardGroup(g.id, -total, "🫙 Emptied jar"));
    };
    $("[data-edit]", w).onclick = () => editJarDialog(g.id);
    jar._nextBlink = Date.now() + 800 + Math.random() * 3000;
    return w;
  }
  // Eye moods: "blink" (closed for a moment) or "happy" (^ ^ squeeze)
  function eyes(jar, mood, ms) {
    jar.classList.remove("blink", "happy");
    jar.classList.add(mood);
    clearTimeout(jar._eyeT);
    jar._eyeT = setTimeout(() => jar.classList.remove(mood), ms);
  }
  setInterval(() => {
    const now = Date.now();
    $$(".jar").forEach((jar) => {
      if (!jar._nextBlink || now < jar._nextBlink || jar.classList.contains("happy")) return;
      eyes(jar, "blink", 140);
      if (Math.random() < 0.25) setTimeout(() => eyes(jar, "blink", 120), 260); // sometimes a double blink
      jar._nextBlink = now + 2200 + Math.random() * 4500;
    });
  }, 120);

  function openLid(jar, ms) {
    jar.classList.add("open");
    clearTimeout(jar._lidT);
    jar._lidT = setTimeout(() => jar.classList.remove("open"), ms);
  }
  // Adds/removes stars until the jar holds `target`. Returns ms until the last star lands.
  function dropTo(w, target, animate) {
    const jar = $(".jar", w), layer = $(".jar-stars", w);
    const live = [...layer.children].filter((el) => !el._leaving);
    const add = target - live.length;
    if (add > 0) {
      const animated = animate ? Math.min(add, 20) : 0;
      const gap = Math.max(70, 170 - animated * 8);
      for (let k = 0; k < add; k++) {
        const el = makeStar(live.length + k, w._geo);
        layer.appendChild(el);
        const idx = k - (add - animated); // only the last `animated` stars fall in
        if (idx < 0) continue;
        const p = el._pos, delay = idx * gap, drop = w._geo.h - p.y + 90;
        el.animate([
          { transform: `translateY(${-drop}px) rotate(${p.rot - 320}deg) scale(1.5)`, opacity: 0, easing: "cubic-bezier(.5,0,.9,.5)" },
          { opacity: 1, offset: 0.15 },
          { transform: `translateY(0) rotate(${p.rot}deg) scale(1)`, offset: 0.72, easing: "ease-out" },
          { transform: `translateY(-9px) rotate(${p.rot}deg) scale(1.05)`, offset: 0.86, easing: "ease-in" },
          { transform: `translateY(0) rotate(${p.rot}deg) scale(1)` },
        ], { duration: 820, delay, fill: "backwards" });
        setTimeout(() => {
          clink(live.length + k);
          eyes(jar, "happy", 700);
          jar.animate([{ rotate: "0deg" }, { rotate: "-3deg" }, { rotate: "2deg" }, { rotate: "0deg" }], { duration: 380 });
        }, delay + 590);
      }
      if (!animated) return 0;
      const ms = (animated - 1) * gap + 750;
      openLid(jar, ms);
      return ms;
    }
    if (add < 0) {
      live.slice(add).forEach((el, k) => {
        if (!animate) return el.remove();
        el._leaving = true;
        const p = el._pos;
        el.animate([
          { transform: `rotate(${p.rot}deg)`, opacity: 1 },
          { transform: `translateY(${-(w._geo.h - p.y + 80)}px) rotate(${p.rot + 240}deg) scale(.5)`, opacity: 0 },
        ], { duration: 650, delay: k * 90, easing: "ease-in", fill: "forwards" }).onfinish = () => el.remove();
      });
      if (animate) openLid($(".jar", w), 650 + -add * 90);
    }
    return 0;
  }
  function emptyJar(w) {
    [...$(".jar-stars", w).children].forEach((el) => {
      el._leaving = true;
      const p = el._pos, dx = (p.x - w._geo.w / 2) * 1.6;
      el.animate([
        { transform: `rotate(${p.rot}deg)`, opacity: 1 },
        { transform: `translate(${dx}px, ${-(w._geo.h - p.y + 110 + rnd(p.x) * 60)}px) rotate(${p.rot + 300}deg) scale(1.3)`, opacity: 0 },
      ], { duration: 700, delay: rnd(p.y + p.x) * 250, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" }).onfinish = () => el.remove();
    });
    openLid($(".jar", w), 1100);
  }
  function setFullBadge(w, fulls, pop) {
    const over = $(".jar-over", w);
    over.hidden = fulls < 1;
    over.textContent = `🫙 ×${fulls}`;
    over.title = `${fulls} full jar${fulls === 1 ? "" : "s"} (${JAR_CAP} stars each)`;
    if (pop) over.animate([{ transform: "scale(2) rotate(-15deg)" }, { transform: "scale(1)" }], { duration: 600, easing: "cubic-bezier(.2,.9,.3,1.5)" });
  }
  function syncStars(w, total, animate) {
    const t = Math.max(0, total), fulls = Math.floor(t / JAR_CAP), inJar = t - fulls * JAR_CAP;
    const prev = w._fulls ?? fulls;
    w._fulls = fulls;
    clearTimeout(w._fillT); clearTimeout(w._fillT2);
    if (animate && fulls > prev) {
      // fill to the top, celebrate, tip the stars out, then drop in the remainder
      const wait = dropTo(w, JAR_CAP, true);
      w._fillT = setTimeout(() => {
        const g = group(w.dataset.id), jar = $(".jar", w);
        jar.animate([{ scale: "1" }, { scale: "1.15" }, { scale: ".95" }, { scale: "1" }], { duration: 600, easing: "ease-out" });
        confetti(160, [g?.color || "#6b4dff", "#ffd23f", "#ffffff"]);
        beep("win");
        toast(`🎉 ${g ? g.emoji + " " + g.name : "A group"} filled a star jar!`);
        setFullBadge(w, fulls, true);
        emptyJar(w);
        w._fillT2 = setTimeout(() => dropTo(w, inJar, true), 900);
      }, wait + 150);
    } else {
      setFullBadge(w, fulls, false);
      const live = [...$(".jar-stars", w).children].filter((el) => !el._leaving).length;
      if (animate && t === 0 && live > 3) {
        emptyJar(w);
        eyes($(".jar", w), "blink", 900);
      } else dropTo(w, inJar, animate);
    }
  }
  function renderJars(container, animate) {
    const existing = new Map($$(".jar-wrap", container).map((w) => [w.dataset.id, w]));
    if (!state.groups.length) { container.innerHTML = `<div class="empty">No groups yet. Create them in ⚙️ Setup or with Team Maker.</div>`; return; }
    $(".empty", container)?.remove();
    const ranked = sortedGroups();
    const medals = ["🥇", "🥈", "🥉"];
    state.groups.forEach((g, idx) => {
      let w = existing.get(g.id);
      if (w && w.dataset.shape !== shapeOf(g)) { w.remove(); w = null; }
      const isNew = !w;
      if (isNew) w = createJar(g);
      if (container.children[idx] !== w) container.insertBefore(w, container.children[idx] || null);
      existing.delete(g.id);
      const total = groupTotal(g), rank = ranked.findIndex((x) => x.h.id === g.id);
      w.style.setProperty("--hc", g.color);
      $(".jar-name", w).textContent = `${g.emoji} ${g.name}`;
      $(".jar-rank", w).textContent = total > 0 ? medals[rank] || "" : "";
      $(".jar", w).setAttribute("aria-label", `${g.name}: ${total} stars. Add a star`);
      const cnt = $(".jar-count b", w);
      if (cnt.textContent !== String(total)) {
        cnt.textContent = total;
        if (!isNew && animate) cnt.animate([{ transform: "scale(1.5)" }, { transform: "scale(1)" }], { duration: 400, easing: "cubic-bezier(.2,.9,.3,1.4)" });
      }
      syncStars(w, total, animate && !isNew);
    });
    existing.forEach((w) => w.remove());
  }

  /* ---------- Confetti ---------- */
  const cv = $("#confetti"), cx = cv.getContext("2d");
  let parts = [], raf;
  function confetti(n = 120, colors) {
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = colors || ["#6b4dff", "#ffb020", "#19b36b", "#e5484d", "#3b82f6", "#ff6fb5"];
    for (let i = 0; i < n; i++) {
      parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight / 3, vx: (Math.random() - .5) * 14, vy: Math.random() * -14 - 4, r: Math.random() * 6 + 4, c: cols[i % cols.length], a: Math.random() * 6, life: 0 });
    }
    cancelAnimationFrame(raf);
    (function tick() {
      cx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.a += 0.2; p.life++; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); });
      parts = parts.filter((p) => p.y < cv.height + 20 && p.life < 300);
      if (parts.length) raf = requestAnimationFrame(tick); else cx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function modal(html, onReady) {
    const d = $("#modal"); $("#modalBody").innerHTML = html; d.showModal(); onReady && onReady(d);
    return d;
  }
  function confirmBox(msg, yes) {
    modal(`<h2>Are you sure?</h2><p>${esc(msg)}</p><div class="opts"><button class="btn ghost" data-no>Cancel</button><button class="btn danger" data-yes>Yes</button></div>`, (d) => {
      $("[data-no]", d).onclick = () => d.close();
      $("[data-yes]", d).onclick = () => { d.close(); yes(); };
    });
  }

  /* ---------- Core actions ---------- */
  function award(ids, pts, reason) {
    if (!ids.length || !pts) return;
    ids.forEach((id) => { const s = student(id); if (s) s.points += pts; });
    state.log.unshift({ id: uid(), ts: Date.now(), type: "student", studentIds: [...ids], pts, reason });
    save();
    beep(pts > 0 ? "up" : "down");
    if (pts > 0 && (pts >= 5 || ids.length > 1)) confetti(pts >= 5 ? 160 : 80);
    const who = ids.length === 1 ? student(ids[0]).name : `${ids.length} students`;
    toast(`${pts > 0 ? "+" : ""}${pts} ${reason ? "· " + reason : ""} → ${who}`);
    render();
    ids.forEach((id) => {
      const card = $(`.stu[data-id="${id}"]`);
      if (card) { const f = document.createElement("div"); f.className = "float " + (pts > 0 ? "plus" : "minus"); f.textContent = (pts > 0 ? "+" : "") + pts; card.appendChild(f); setTimeout(() => f.remove(), 1000); }
    });
  }
  function awardGroup(hid, pts, reason) {
    const h = group(hid); if (!h || !pts) return;
    h.bonus += pts;
    state.log.unshift({ id: uid(), ts: Date.now(), type: "group", groupId: hid, pts, reason });
    save();
    if (pts < 0) beep("down");
    toast(`${pts > 0 ? "+" + pts + " ⭐" : pts} → ${h.emoji} ${h.name}${reason ? " · " + reason : ""}`);
    render();
  }
  function redeem(sid, rid) {
    const s = student(sid), r = state.rewards.find((x) => x.id === rid);
    if (!s || !r) return;
    if (balance(s) < r.cost) { toast(`${s.name} needs ${r.cost - balance(s)} more points`); beep("down"); return; }
    s.spent += r.cost;
    state.log.unshift({ id: uid(), ts: Date.now(), type: "redeem", studentIds: [sid], pts: -r.cost, reason: `${r.emoji} ${r.name}` });
    save(); beep("buy"); confetti(140);
    toast(`🎉 ${s.name} got: ${r.name}`);
    render();
  }
  function undo() {
    const e = state.log[0];
    if (!e) return toast("Nothing to undo");
    if (e.type === "student") e.studentIds.forEach((id) => { const s = student(id); if (s) s.points -= e.pts; });
    else if (e.type === "group") { const h = group(e.groupId); if (h) h.bonus -= e.pts; }
    else if (e.type === "redeem") { const s = student(e.studentIds[0]); if (s) s.spent += e.pts; }
    state.log.shift(); save(); render(); toast("↩️ Undone");
  }

  /* ---------- Rendering ---------- */
  function render() {
    renderBoard(); renderStudents(); renderRewards(); renderHistory(); renderSettings();
    if (!$("#projector").hidden) renderProjector();
  }

  function sortedGroups() {
    return state.groups.map((h) => ({ h, t: groupTotal(h) })).sort((a, b) => b.t - a.t);
  }

  function boardStudents() {
    const y = $("#bYear").value, c = $("#bClass").value;
    return state.students.filter((s) => (!y || String(s.year) === y) && (!c || s.cls === c)).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }

  let jarsReady = false;
  function renderBoard() {
    fillSelect($("#bYear"), [["", "All years"], ...YEARS.map((y) => [y, "Year " + y])]);
    fillSelect($("#bClass"), [["", "All subjects"], ...subjects().map((c) => [c, c])]);
    const ranked = boardStudents();

    // Podium: 2nd, 1st, 3rd
    const top3 = ranked.slice(0, 3);
    const order = [1, 0, 2].filter((i) => top3[i]);
    $("#podium").innerHTML = top3.length ? order.map((i) => {
      const s = top3[i], g = group(s.groupId);
      return `<div class="pod p${i + 1}">
        <div class="avatar" style="background:${esc(g?.color || "#6b4dff")}">${esc(initials(s.name))}</div>
        <div class="pod-name">${esc(s.name)}</div>
        <div class="pod-pts">${s.points} pts</div>
        <div class="pod-step">${["🥇", "🥈", "🥉"][i]}</div>
      </div>`;
    }).join("") : `<div class="empty">No students yet — add them in ⚙️ Setup or load the demo class.</div>`;

    $("#topStudents").innerHTML = ranked.length ? ranked.map((s) => {
      const g = group(s.groupId);
      return `<li><span class="dot" style="background:${esc(g?.color || "#ccc")}"></span>${esc(s.name)} <span class="muted small">Y${s.year}${g ? " · " + esc(g.emoji + " " + g.name) : ""}</span><span class="pts">${s.points}</span></li>`;
    }).join("") : `<div class="empty">Nobody here yet.</div>`;

    const boardOn = $("#view-board").classList.contains("active");
    if (boardOn || !jarsReady) { renderJars($("#jarBoard"), boardOn && jarsReady); jarsReady = true; }

    const recent = state.log.slice(0, 15);
    $("#recentFeed").innerHTML = recent.length ? recent.map(feedItem).join("") : `<div class="empty">No points given yet.</div>`;
  }
  function describe(e) {
    if (e.type === "group") { const h = group(e.groupId); return `${esc(h?.emoji || "")} <b>${esc(h?.name || "Group")}</b> (group bonus)`; }
    const names = e.studentIds.map((id) => student(id)?.name || "(removed)");
    return `<b>${esc(names.length > 3 ? names.slice(0, 3).join(", ") + ` +${names.length - 3}` : names.join(", "))}</b>`;
  }
  function feedItem(e) {
    const p = e.type === "redeem" ? `<span>🎁</span>` : `<span class="${e.pts > 0 ? "plus" : "minus"}">${e.pts > 0 ? "+" : ""}${e.pts}</span>`;
    return `<li>${p} <span>${describe(e)} ${e.reason ? `<span class="muted">· ${esc(e.reason)}</span>` : ""}</span><span class="when">${timeAgo(e.ts)}</span></li>`;
  }

  function fillSelect(sel, opts, keep = true) {
    const v = sel.value;
    sel.innerHTML = opts.map(([val, label]) => `<option value="${esc(val)}">${esc(label)}</option>`).join("");
    if (keep && opts.some(([val]) => String(val) === v)) sel.value = v;
  }
  // The teacher's own subject list, plus any subject still on a student that was since removed.
  const subjects = () => [...new Set([...(state.subjects || []), ...state.students.map((s) => s.cls).filter(Boolean)])];

  function filteredStudents() {
    const q = $("#search").value.trim().toLowerCase();
    const y = $("#fYear").value, c = $("#fClass").value, h = $("#fGroup").value;
    return state.students.filter((s) =>
      (!q || s.name.toLowerCase().includes(q)) && (!y || String(s.year) === y) && (!c || s.cls === c) && (!h || s.groupId === h)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderStudents() {
    fillSelect($("#fYear"), [["", "All years"], ...YEARS.map((y) => [y, "Year " + y])]);
    fillSelect($("#fClass"), [["", "All subjects"], ...subjects().map((c) => [c, c])]);
    fillSelect($("#fGroup"), [["", "All groups"], ...state.groups.map((h) => [h.id, `${h.emoji} ${h.name}`])]);
    const list = filteredStudents();
    $("#studentGrid").innerHTML = list.length ? list.map((s) => {
      const h = group(s.groupId);
      return `<div class="stu ${selected.has(s.id) ? "sel" : ""}" data-id="${s.id}" role="button" tabindex="0">
        <div class="avatar" style="background:${esc(h?.color || "#888")}">${esc(initials(s.name))}</div>
        <div class="nm">${esc(s.name)}</div>
        <div class="sub">${esc(h ? h.emoji + " " + h.name : "No group")} · Y${s.year}${s.cls ? " · " + esc(s.cls) : ""}</div>
        <div class="sp">${s.points}</div>
      </div>`;
    }).join("") : `<div class="empty" style="grid-column:1/-1">No students match. Add students in ⚙️ Setup.</div>`;
    $$("#studentGrid .stu").forEach((el) => {
      const toggle = () => { const id = el.dataset.id; selected.has(id) ? selected.delete(id) : selected.add(id); el.classList.toggle("sel"); updateAwardBar(); };
      el.onclick = toggle;
      el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
    });
    $("#behaviourBtns").innerHTML = state.behaviours.map((b) =>
      `<button class="beh ${b.pts < 0 ? "neg" : ""}" data-id="${b.id}">${esc(b.emoji)} ${esc(b.label)}<span class="p">${b.pts > 0 ? "+" : ""}${b.pts}</span></button>`).join("");
    $$("#behaviourBtns .beh").forEach((el) => el.onclick = () => {
      const b = state.behaviours.find((x) => x.id === el.dataset.id);
      award([...selected], b.pts, `${b.emoji} ${b.label}`);
    });
    // drop selections for students that no longer exist
    selected = new Set([...selected].filter((id) => student(id)));
    updateAwardBar();
  }
  function updateAwardBar() {
    $("#selCount").textContent = `${selected.size} selected`;
    $("#awardBar").classList.toggle("show", selected.size > 0 && $("#view-students").classList.contains("active"));
  }

  function renderRewards() {
    const sel = $("#redeemStudent");
    fillSelect(sel, [["", "— choose a student —"], ...[...state.students].sort((a, b) => a.name.localeCompare(b.name)).map((s) => [s.id, `${s.name} (Y${s.year})`])]);
    const s = student(sel.value);
    $("#redeemBalance").innerHTML = s ? `💰 ${esc(s.name)} can spend <b>${balance(s)}</b> points <span class="muted small">(earned ${s.points}, spent ${s.spent})</span>` : `<span class="muted">Pick a student to see what they can afford.</span>`;
    $("#rewardGrid").innerHTML = [...state.rewards].sort((a, b) => a.cost - b.cost).map((r) => {
      const locked = s && balance(s) < r.cost;
      return `<div class="reward ${locked ? "locked" : ""}">
        <button class="x" data-del="${r.id}" title="Remove reward">✕</button>
        <div class="re">${esc(r.emoji || "🎁")}</div><div class="rn">${esc(r.name)}</div><div class="rc">${r.cost} pts</div>
        <button class="btn" data-buy="${r.id}" ${!s || locked ? "disabled style='opacity:.5;cursor:not-allowed'" : ""}>${locked ? "🔒 Need " + (r.cost - balance(s)) : "Redeem"}</button>
      </div>`;
    }).join("") || `<div class="empty">No rewards yet — add one below.</div>`;
    $$("[data-buy]").forEach((b) => b.onclick = () => redeem(sel.value, b.dataset.buy));
    $$("[data-del]").forEach((b) => b.onclick = () => confirmBox("Remove this reward?", () => { state.rewards = state.rewards.filter((r) => r.id !== b.dataset.del); save(); render(); }));
  }

  function renderHistory() {
    $("#historyTable").innerHTML = state.log.length ? `<tr><th>When</th><th>Who</th><th>Points</th><th>Reason</th></tr>` + state.log.slice(0, 300).map((e) =>
      `<tr><td class="muted small">${new Date(e.ts).toLocaleString()}</td><td>${describe(e)}</td><td class="${e.type === "redeem" ? "" : e.pts > 0 ? "plus" : "minus"}">${e.type === "redeem" ? "🎁 " + e.pts : (e.pts > 0 ? "+" : "") + e.pts}</td><td>${esc(e.reason || "")}</td></tr>`).join("")
      : `<tr><td class="empty">Nothing yet.</td></tr>`;
  }

  function renderSettings() {
    $("#groupEditor").innerHTML = state.groups.map((h) => `<div class="group-row" data-id="${h.id}">
      <input class="emoji-in" value="${esc(h.emoji)}" data-f="emoji" maxlength="4" />
      <input type="text" value="${esc(h.name)}" data-f="name" />
      <input type="color" value="${esc(h.color)}" data-f="color" />
      <select data-f="shape" title="Jar shape">${SHAPE_KEYS.map((k) => `<option value="${k}" ${shapeOf(h) === k ? "selected" : ""}>${SHAPES[k].icon} ${esc(SHAPES[k].label)}</option>`).join("")}</select>
      <button class="icon-btn" data-delgroup title="Delete group">🗑️</button></div>`).join("");
    $$("#groupEditor .group-row").forEach((row) => {
      const h = group(row.dataset.id);
      $$("[data-f]", row).forEach((inp) => inp.onchange = () => { h[inp.dataset.f] = inp.value || h[inp.dataset.f]; save(); render(); });
      $("[data-delgroup]", row).onclick = () => {
        confirmBox(`Delete ${h.name}? Its students will have no group (their own points stay).`, () => {
          state.groups = state.groups.filter((x) => x.id !== h.id);
          state.students.forEach((s) => { if (s.groupId === h.id) s.groupId = ""; });
          save(); render();
        });
      };
    });

    fillSelect($("#bulkYear"), YEARS.map((y) => [y, "Year " + y]));
    fillSelect($("#bulkGroup"), [["", "No group"], ["auto", "⚖️ Share across groups"], ...state.groups.map((h) => [h.id, `${h.emoji} ${h.name}`])]);

    $("#studentCount").textContent = `(${state.students.length})`;
    const groupOpts = (sel) => `<option value="">— none —</option>` + state.groups.map((h) => `<option value="${h.id}" ${h.id === sel ? "selected" : ""}>${esc(h.emoji + " " + h.name)}</option>`).join("");
    const subjectOpts = (sel) => `<option value="">— none —</option>` + subjects().map((c) => `<option ${c === sel ? "selected" : ""}>${esc(c)}</option>`).join("");
    fillSelect($("#bulkClass"), [["", "No subject"], ...subjects().map((c) => [c, c])]);
    $("#subjectEditor").innerHTML = (state.subjects || []).map((c, i) => `<div class="group-row"><span>📚</span><span style="flex:1">${esc(c)}</span><span class="muted small">${(n => n + (n === 1 ? " student" : " students"))(state.students.filter((s) => s.cls === c).length)}</span><button class="icon-btn" data-delsubject="${i}" title="Remove subject">🗑️</button></div>`).join("") || `<div class="empty">No subjects yet — add one below.</div>`;
    $$("[data-delsubject]").forEach((b) => b.onclick = () => {
      const name = state.subjects[Number(b.dataset.delsubject)];
      const n = state.students.filter((s) => s.cls === name).length;
      const remove = () => { state.subjects = state.subjects.filter((x) => x !== name); state.students.forEach((s) => { if (s.cls === name) s.cls = ""; }); save(); render(); };
      n ? confirmBox(`Remove ${name}? ${n} student${n > 1 ? "s" : ""} will have no subject (their points stay).`, remove) : remove();
    });
    const yearOpts = (sel) => YEARS.map((y) => `<option ${y === sel ? "selected" : ""}>${y}</option>`).join("");
    $("#studentTable").innerHTML = state.students.length ? `<tr><th>Name</th><th>Year</th><th>Subject</th><th>Group</th><th>Points</th><th>Spent</th><th></th></tr>` +
      [...state.students].sort((a, b) => a.year - b.year || a.name.localeCompare(b.name)).map((s) => `<tr data-id="${s.id}">
        <td><input data-f="name" value="${esc(s.name)}" /></td>
        <td><select data-f="year">${yearOpts(s.year)}</select></td>
        <td><select data-f="cls">${subjectOpts(s.cls)}</select></td>
        <td><select data-f="groupId">${groupOpts(s.groupId)}</select></td>
        <td>${s.points}</td><td>${s.spent}</td>
        <td><button class="icon-btn" data-delstu title="Remove">🗑️</button></td></tr>`).join("")
      : `<tr><td class="empty">No students yet.</td></tr>`;
    $$("#studentTable tr[data-id]").forEach((row) => {
      const s = student(row.dataset.id);
      $$("[data-f]", row).forEach((inp) => inp.onchange = () => {
        const v = inp.dataset.f === "year" ? Number(inp.value) : inp.value.trim();
        if (inp.dataset.f === "name" && !v) return;
        s[inp.dataset.f] = v; save(); render();
      });
      $("[data-delstu]", row).onclick = () => confirmBox(`Remove ${s.name}? Their points leave their group too.`, () => {
        state.students = state.students.filter((x) => x.id !== s.id); selected.delete(s.id); save(); render();
      });
    });

    $("#behaviourEditor").innerHTML = state.behaviours.map((b) => `<div class="group-row"><span>${esc(b.emoji)}</span><span style="flex:1">${esc(b.label)}</span><b class="${b.pts > 0 ? "plus" : "minus"}">${b.pts > 0 ? "+" : ""}${b.pts}</b><button class="icon-btn" data-delbeh="${b.id}">🗑️</button></div>`).join("");
    $$("[data-delbeh]").forEach((b) => b.onclick = () => { state.behaviours = state.behaviours.filter((x) => x.id !== b.dataset.delbeh); save(); render(); });
    $("#soundToggle").checked = state.sound;
  }

  const PALETTE = ["#f97316", "#ef4444", "#ec4899", "#d946ef", "#a855f7", "#6366f1",
    "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16", "#eab308"];
  function editJarDialog(gid) {
    const g = group(gid); if (!g) return;
    const draft = { name: g.name, emoji: g.emoji, color: g.color, shape: shapeOf(g) };
    const d = modal(`<h2>✏️ Edit jar</h2>
      <div class="edit-jar">
        <div class="edit-preview">
          <div class="jar" data-prev></div>
          <div class="jar-name" data-prevname></div>
        </div>
        <div class="edit-form">
          <label class="edit-label">Group name <input data-name maxlength="24" /></label>
          <label class="edit-label">Emoji <input data-emoji class="emoji-in" maxlength="4" /></label>
          <div class="edit-label">Colour</div>
          <div class="swatches">
            ${PALETTE.map((c) => `<button type="button" class="sw" data-c="${c}" style="--sw:${c}" aria-label="Colour ${c}"></button>`).join("")}
            <label class="sw custom" title="Pick any colour"><input type="color" data-custom /></label>
          </div>
          <div class="edit-label">Jar shape</div>
          <div class="shape-tiles">
            ${SHAPE_KEYS.map((k) => `<button type="button" class="shape-tile" data-shape="${k}"><span class="mini jar">${jarArt(k, false)}</span><small>${SHAPES[k].icon} ${esc(SHAPES[k].label)}</small></button>`).join("")}
          </div>
        </div>
      </div>
      <div class="opts"><button class="btn ghost" data-cancel>Cancel</button><button class="btn" data-save>💾 Save</button></div>`, (d) => {
      d.classList.add("wide");
      const prev = $("[data-prev]", d);
      const draw = (shapeChanged) => {
        d.style.setProperty("--hc", draft.color);
        if (shapeChanged) { prev.innerHTML = jarArt(draft.shape, false); prev._nextBlink = Date.now() + 600; }
        $("[data-prevname]", d).textContent = `${draft.emoji} ${draft.name}`;
        $$(".sw[data-c]", d).forEach((b) => b.classList.toggle("on", b.dataset.c.toLowerCase() === draft.color.toLowerCase()));
        $$(".shape-tile", d).forEach((b) => b.classList.toggle("on", b.dataset.shape === draft.shape));
        $("[data-custom]", d).value = draft.color;
      };
      $("[data-name]", d).value = draft.name;
      $("[data-emoji]", d).value = draft.emoji;
      $("[data-name]", d).oninput = (e) => { draft.name = e.target.value; draw(); };
      $("[data-emoji]", d).oninput = (e) => { draft.emoji = e.target.value; draw(); };
      $$(".sw[data-c]", d).forEach((b) => b.onclick = () => { draft.color = b.dataset.c; draw(); });
      $("[data-custom]", d).oninput = (e) => { draft.color = e.target.value; draw(); };
      $$(".shape-tile", d).forEach((b) => b.onclick = () => { draft.shape = b.dataset.shape; draw(true); });
      $("[data-cancel]", d).onclick = () => d.close();
      $("[data-save]", d).onclick = () => {
        const cur = group(gid); if (!cur) return d.close();
        cur.name = draft.name.trim() || cur.name;
        cur.emoji = draft.emoji.trim() || cur.emoji;
        cur.color = draft.color; cur.shape = draft.shape;
        save(); d.close(); render();
        toast(`✨ ${cur.emoji} ${cur.name} updated`);
      };
      d.addEventListener("close", () => d.classList.remove("wide"), { once: true });
      draw(true);
    });
    return d;
  }

  function groupBonusDialog(hid) {
    const h = group(hid);
    modal(`<h2>${esc(h.emoji)} ${esc(h.name)} — group bonus</h2>
      <p class="muted">Give or take points from the whole group (e.g. for winning a game or a tidy line).</p>
      <input id="hbReason" placeholder="Reason (optional)" style="width:100%" />
      <div class="opts" style="justify-content:center">${[1, 3, 5, 10, -1, -5].map((p) => `<button class="btn ${p < 0 ? "danger" : ""}" data-p="${p}">${p > 0 ? "+" : ""}${p}</button>`).join("")}</div>
      <div class="opts"><button class="btn ghost" data-close>Close</button></div>`, (d) => {
      $$("[data-p]", d).forEach((b) => b.onclick = () => { awardGroup(hid, Number(b.dataset.p), $("#hbReason", d).value.trim()); d.close(); });
      $("[data-close]", d).onclick = () => d.close();
    });
  }

  /* ---------- Projector ---------- */
  let projMode = "students";
  function renderProjector() {
    $$("[data-pmode]").forEach((b) => b.classList.toggle("on", b.dataset.pmode === projMode));
    let list;
    $("#projBars").hidden = projMode === "groups";
    $("#projJars").hidden = projMode !== "groups";
    if (projMode === "groups") return renderJars($("#projJars"), true);
    list = boardStudents().slice(0, 10).map((s) => ({ color: group(s.groupId)?.color || "#8b7bff", label: s.name, t: s.points }));
    const max = Math.max(1, ...list.map((x) => x.t));
    $("#projBars").innerHTML = list.length ? list.map((x) => `<div class="pbar" style="--hc:${esc(x.color)}">
      <div class="pv">${x.t}</div><div class="col" style="height:${Math.max(2, (x.t / max) * 70)}%"></div><div class="pn">${esc(x.label)}</div></div>`).join("") : `<div class="empty" style="color:#fff">Nothing to show yet.</div>`;
  }

  /* ---------- Activities ---------- */
  let actCleanup = null;
  function openActivity(name) {
    if (actCleanup) { actCleanup(); actCleanup = null; }
    $$(".act-tile").forEach((t) => t.classList.toggle("active", t.dataset.act === name));
    const st = $("#activityStage"); st.hidden = false;
    ({ picker: actPicker, quiz: actQuiz, timer: actTimer, teams: actTeams, wheel: actWheel })[name](st);
    st.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function poolControls() {
    return `<div class="opts">
      <select data-pool-year><option value="">All years</option>${YEARS.map((y) => `<option value="${y}">Year ${y}</option>`).join("")}</select>
      <select data-pool-class><option value="">All subjects</option>${subjects().map((c) => `<option>${esc(c)}</option>`).join("")}</select>
      <select data-pool-group><option value="">All groups</option>${state.groups.map((h) => `<option value="${h.id}">${esc(h.emoji + " " + h.name)}</option>`).join("")}</select>
    </div>`;
  }
  function pool(st) {
    const y = $("[data-pool-year]", st).value, c = $("[data-pool-class]", st).value, h = $("[data-pool-group]", st).value;
    return state.students.filter((s) => (!y || String(s.year) === y) && (!c || s.cls === c) && (!h || s.groupId === h));
  }

  function actPicker(st) {
    st.innerHTML = `<div class="stage-center"><h2>🎯 Random Picker</h2>${poolControls()}
      <label class="check" style="justify-content:center"><input type="checkbox" data-norepeat checked /> Don't pick the same student twice</label>
      <div class="picker-name" data-name>?</div><div class="muted" data-sub>&nbsp;</div>
      <div class="opts"><button class="btn big" data-go>🎲 Pick!</button></div>
      <div class="opts" data-after hidden><button class="btn" data-give="1">+1</button><button class="btn" data-give="2">+2</button><button class="btn" data-give="5">+5 🌟</button></div></div>`;
    let picked = new Set(), current = null, timer;
    $("[data-go]", st).onclick = () => {
      let p = pool(st);
      if ($("[data-norepeat]", st).checked) { const left = p.filter((s) => !picked.has(s.id)); if (!left.length && p.length) { picked.clear(); toast("Everyone has had a turn — starting again!"); } else p = left; }
      if (!p.length) return toast("No students to pick from");
      const nameEl = $("[data-name]", st); nameEl.classList.remove("win");
      $("[data-after]", st).hidden = true;
      let n = 0, steps = 22;
      clearTimeout(timer);
      (function spin() {
        const s = p[Math.floor(Math.random() * p.length)];
        nameEl.textContent = s.name; beep("tick");
        if (++n < steps) timer = setTimeout(spin, 40 + n * n * 0.6);
        else {
          current = s; picked.add(s.id);
          nameEl.classList.add("win"); const h = group(s.groupId);
          $("[data-sub]", st).textContent = `${h ? h.emoji + " " + h.name : ""} · Year ${s.year}${s.cls ? " · " + s.cls : ""}`;
          $("[data-after]", st).hidden = false; beep("win"); confetti(60, h ? [h.color, "#fff"] : undefined);
        }
      })();
    };
    $$("[data-give]", st).forEach((b) => b.onclick = () => current && award([current.id], Number(b.dataset.give), "🎯 Random picker"));
    actCleanup = () => clearTimeout(timer);
  }

  function actQuiz(st) {
    const scores = Object.fromEntries(state.groups.map((h) => [h.id, 0]));
    st.innerHTML = `<div class="stage-center"><h2>⚔️ Group Quiz Battle</h2>
      <p class="muted">Type a question to show it big (optional). Tap +1 / +3 when a group gets it right. At the end, add the round scores to the real group totals.</p>
      <input data-q placeholder="Type the question here and press Enter…" style="width:100%;max-width:640px" />
      <div class="quiz-q" data-qshow></div>
      <div class="quiz-groups" data-qh></div>
      <div class="opts" style="margin-top:16px"><button class="btn ghost" data-reset>Reset round</button><button class="btn big" data-bank>🏦 Add round scores to groups</button></div></div>`;
    const draw = () => {
      $("[data-qh]", st).innerHTML = state.groups.map((h) => `<div class="qh" style="--hc:${esc(h.color)}"><div>${esc(h.emoji)} <b>${esc(h.name)}</b></div><div class="s">${scores[h.id]}</div>
        <button data-h="${h.id}" data-d="1">+1</button><button data-h="${h.id}" data-d="3">+3</button><button data-h="${h.id}" data-d="-1">−1</button></div>`).join("");
      $$("[data-h]", st).forEach((b) => b.onclick = () => { scores[b.dataset.h] += Number(b.dataset.d); beep(Number(b.dataset.d) > 0 ? "up" : "down"); draw(); });
    };
    draw();
    $("[data-q]", st).onkeydown = (e) => { if (e.key === "Enter") { $("[data-qshow]", st).textContent = e.target.value; e.target.value = ""; } };
    $("[data-reset]", st).onclick = () => { Object.keys(scores).forEach((k) => scores[k] = 0); draw(); };
    $("[data-bank]", st).onclick = () => {
      const any = Object.values(scores).some((v) => v);
      if (!any) return toast("No round scores yet");
      Object.entries(scores).forEach(([hid, v]) => { if (v) awardGroup(hid, v, "⚔️ Quiz battle"); scores[hid] = 0; });
      confetti(200); draw(); toast("Scores added to group totals! 🏆");
    };
  }

  function actTimer(st) {
    st.innerHTML = `<div class="stage-center"><h2>⏱️ Countdown Timer</h2>
      <div class="opts">${[30, 60, 120, 300, 600].map((s) => `<button class="btn ghost" data-set="${s}">${s < 60 ? s + "s" : s / 60 + " min"}</button>`).join("")}
      <input type="number" min="1" data-custom placeholder="min" style="width:80px" /><button class="btn ghost" data-setc>Set</button></div>
      <div class="timer-face" data-face>01:00</div>
      <div class="opts"><button class="btn big" data-start>▶ Start</button><button class="btn big ghost" data-reset>↺ Reset</button></div></div>`;
    let total = 60, left = 60, iv = null;
    const face = $("[data-face]", st), startBtn = $("[data-start]", st);
    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    const draw = () => { face.textContent = fmt(left); face.classList.toggle("done", left === 0); };
    const stop = () => { clearInterval(iv); iv = null; startBtn.textContent = "▶ Start"; };
    const set = (s) => { stop(); total = left = s; draw(); };
    $$("[data-set]", st).forEach((b) => b.onclick = () => set(Number(b.dataset.set)));
    $("[data-setc]", st).onclick = () => { const m = Number($("[data-custom]", st).value); if (m > 0) set(Math.round(m * 60)); };
    startBtn.onclick = () => {
      if (iv) return stop();
      if (left === 0) left = total;
      startBtn.textContent = "⏸ Pause";
      iv = setInterval(() => {
        left--; if (left <= 5 && left > 0) beep("tick");
        draw();
        if (left <= 0) { stop(); beep("win"); beep("win"); confetti(80); }
      }, 1000);
    };
    $("[data-reset]", st).onclick = () => set(total);
    draw();
    actCleanup = stop;
  }

  function actTeams(st) {
    st.innerHTML = `<div class="stage-center"><h2>👥 Team Maker</h2>${poolControls()}
      <div class="opts"><label>Number of teams <input type="number" min="2" value="4" data-n style="width:80px" /></label>
      <label class="check" style="margin:0"><input type="checkbox" data-mix checked /> Spread current groups</label>
      <button class="btn big" data-make>🔀 Make teams</button></div><div class="teams-out" data-out></div>
      <div class="opts" data-saveopts hidden style="margin-top:14px"><button class="btn" data-save>💾 Save as class groups</button><span class="muted small" style="align-self:center">Replaces the current groups for these students</span></div></div>`;
    let lastTeams = [];
    const colors = ["#6b4dff", "#ff6fb5", "#19b36b", "#ffb020", "#3b82f6", "#e5484d", "#14b8a6", "#a855f7"];
    $("[data-make]", st).onclick = () => {
      let p = pool(st); const n = Math.max(2, Number($("[data-n]", st).value) || 2);
      if (p.length < n) return toast("Not enough students for that many teams");
      p = p.sort(() => Math.random() - .5);
      if ($("[data-mix]", st).checked) p.sort((a, b) => (a.groupId || "").localeCompare(b.groupId || ""));
      const teams = Array.from({ length: n }, () => []);
      p.forEach((s, i) => teams[i % n].push(s));
      lastTeams = teams; $("[data-saveopts]", st).hidden = false;
      $("[data-out]", st).innerHTML = teams.map((t, i) => `<div class="team" style="border-color:${colors[i % colors.length]}"><h3 style="color:${colors[i % colors.length]}">Team ${i + 1}</h3><ul>${t.map((s) => `<li>${esc(s.name)} <span class="dot" style="background:${esc(group(s.groupId)?.color)}"></span></li>`).join("")}</ul></div>`).join("");
      beep("win");
    };
    $("[data-save]", st).onclick = () => {
      if (!lastTeams.length) return;
      const presets = [["🐯", "Tigers", "#f97316"], ["🦅", "Eagles", "#3b82f6"], ["🐬", "Dolphins", "#14b8a6"], ["🐼", "Pandas", "#a855f7"], ["🦊", "Foxes", "#e5484d"], ["🐢", "Turtles", "#16a34a"], ["🦉", "Owls", "#64748b"], ["🐝", "Bees", "#f5a524"]];
      lastTeams.forEach((t, i) => {
        let g = state.groups[i];
        if (!g) { const [emoji, name, color] = presets[i % presets.length]; g = { id: uid(), name: state.groups.some((x) => x.name === name) ? `Team ${i + 1}` : name, color, emoji, bonus: 0 }; state.groups.push(g); }
        t.forEach((s) => { const real = student(s.id); if (real) real.groupId = g.id; });
      });
      save(); render(); confetti(); toast(`💾 Saved ${lastTeams.length} groups`);
      $("[data-out]", st).innerHTML = lastTeams.map((t, i) => { const g = state.groups[i]; return `<div class="team" style="border-color:${esc(g.color)}"><h3 style="color:${esc(g.color)}">${esc(g.emoji + " " + g.name)}</h3><ul>${t.map((s) => `<li>${esc(s.name)}</li>`).join("")}</ul></div>`; }).join("");
    };
  }

  function actWheel(st) {
    const prizes = ["+1 point", "+2 points", "+3 points", "Sticker", "+5 points", "Line leader", "+1 point", "Choose a game"];
    const colors = ["#6b4dff", "#ffb020", "#19b36b", "#e5484d", "#3b82f6", "#ff6fb5", "#14b8a6", "#a855f7"];
    st.innerHTML = `<div class="stage-center"><h2>🎡 Mystery Reward Wheel</h2>
      <p class="muted">Pick a student, then spin! Points prizes are added automatically.</p>
      <div class="opts"><select data-who></select></div>
      <div class="wheel-wrap"><div class="pointer">🔻</div><canvas width="600" height="600"></canvas></div>
      <div class="picker-name" data-res style="font-size:2rem">&nbsp;</div>
      <div class="opts"><button class="btn big" data-spin>🎡 Spin!</button></div></div>`;
    fillSelect($("[data-who]", st), [["", "— choose a student —"], ...[...state.students].sort((a, b) => a.name.localeCompare(b.name)).map((s) => [s.id, s.name])], false);
    const c = $("canvas", st), g = c.getContext("2d"), N = prizes.length, seg = (Math.PI * 2) / N;
    prizes.forEach((p, i) => {
      g.beginPath(); g.moveTo(300, 300); g.arc(300, 300, 290, i * seg - Math.PI / 2, (i + 1) * seg - Math.PI / 2); g.fillStyle = colors[i]; g.fill();
      g.save(); g.translate(300, 300); g.rotate(i * seg + seg / 2 - Math.PI / 2); g.fillStyle = "#fff"; g.font = "bold 30px Nunito, sans-serif"; g.textAlign = "right"; g.fillText(p, 270, 10); g.restore();
    });
    g.beginPath(); g.arc(300, 300, 40, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
    let rot = 0, spinning = false;
    $("[data-spin]", st).onclick = () => {
      if (spinning) return;
      const sid = $("[data-who]", st).value;
      if (!sid) return toast("Choose a student first");
      spinning = true; $("[data-res]", st).innerHTML = "&nbsp;";
      const idx = Math.floor(Math.random() * N);
      // pointer at top: segment idx centre must end at angle 0
      const target = 360 * 5 + (360 - (idx * 360 / N + 180 / N));
      rot = rot - (rot % 360) + target;
      c.style.transform = `rotate(${rot}deg)`;
      setTimeout(() => {
        spinning = false;
        const prize = prizes[idx], m = prize.match(/^\+(\d+)/);
        $("[data-res]", st).textContent = `🎉 ${student(sid)?.name}: ${prize}!`;
        if (m) award([sid], Number(m[1]), "🎡 Reward wheel");
        else { state.log.unshift({ id: uid(), ts: Date.now(), type: "redeem", studentIds: [sid], pts: 0, reason: "🎡 " + prize }); save(); render(); beep("win"); confetti(120); }
      }, 4100);
    };
  }

  /* ---------- Demo data ---------- */
  function loadDemo() {
    const names = ["Aisyah", "Daniel", "Priya", "Hakim", "Mei Ling", "Arjun", "Sofia", "Irfan", "Chloe", "Zara", "Ethan", "Nurul", "Ravi", "Hana", "Jun Hao", "Siti", "Lucas", "Aina", "Kavin", "Emma", "Amir", "Wei Jie", "Laila", "Ryan"];
    const subs = state.subjects && state.subjects.length ? state.subjects : DEFAULTS().subjects;
    names.forEach((n, i) => state.students.push({ id: uid(), name: n, year: (i % 11) + 1, cls: subs[i % subs.length], groupId: state.groups[i % state.groups.length].id, points: Math.floor(Math.random() * 25), spent: 0 }));
    save(); render(); toast("✨ Demo class loaded"); confetti();
  }

  /* ---------- Events ---------- */
  $("#tabs").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#tabs button").forEach((x) => x.classList.toggle("active", x === b));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + b.dataset.tab));
    try { localStorage.setItem(KEY + "-tab", b.dataset.tab); } catch (e) {}
    updateAwardBar(); window.scrollTo({ top: 0 });
    if (b.dataset.tab === "board") renderBoard(); // drop in stars earned while away
  };
  ["#search", "#fYear", "#fClass", "#fGroup"].forEach((s) => $(s).addEventListener("input", renderStudents));
  $("#selectAll").onclick = () => { filteredStudents().forEach((s) => selected.add(s.id)); renderStudents(); };
  $("#clearSel").onclick = () => { selected.clear(); renderStudents(); };
  $("#customGive").onclick = () => {
    const p = Math.round(Number($("#customPts").value)); if (!p) return toast("Enter points");
    award([...selected], p, $("#customReason").value.trim() || "Custom"); $("#customReason").value = "";
  };
  $("#redeemStudent").onchange = renderRewards;
  $("#rewardForm").onsubmit = (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    state.rewards.push({ id: uid(), emoji: f.get("emoji") || "🎁", name: f.get("name").trim(), cost: Math.max(1, Number(f.get("cost"))) });
    e.target.reset(); save(); render(); toast("Reward added");
  };
  $("#behaviourForm").onsubmit = (e) => {
    e.preventDefault(); const f = new FormData(e.target); const pts = Math.round(Number(f.get("pts")));
    if (!pts) return toast("Points can't be 0");
    state.behaviours.push({ id: uid(), emoji: f.get("emoji") || "⭐", label: f.get("label").trim(), pts });
    e.target.reset(); save(); render();
  };
  $("#addGroup").onclick = () => {
    const palette = ["#a855f7", "#14b8a6", "#ff6fb5", "#64748b"];
    state.groups.push({ id: uid(), name: "New Group", color: palette[state.groups.length % palette.length], emoji: "🏰", bonus: 0 });
    save(); render();
  };
  $("#subjectForm").onsubmit = (e) => {
    e.preventDefault();
    const inp = $("#subjectName"), name = inp.value.trim().slice(0, 40);
    if (!name) return;
    state.subjects = state.subjects || [];
    if (state.subjects.some((c) => c.toLowerCase() === name.toLowerCase())) { toast("That subject is already there"); return; }
    state.subjects.push(name); inp.value = ""; save(); render(); toast(`📚 Added ${name}`);
  };

  $("#bulkAdd").onclick = () => {
    const names = $("#bulkNames").value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return toast("Paste some names first");
    const year = Number($("#bulkYear").value), cls = $("#bulkClass").value.trim(), hsel = $("#bulkGroup").value;
    names.forEach((name) => {
      let hid = hsel;
      if (hsel === "auto") {
        if (!state.groups.length) { hid = ""; } else {
        const counts = state.groups.map((h) => [h.id, state.students.filter((s) => s.groupId === h.id).length]).sort((a, b) => a[1] - b[1]);
        hid = counts[0][0]; }
      }
      state.students.push({ id: uid(), name, year, cls, groupId: hid, points: 0, spent: 0 });
    });
    $("#bulkNames").value = ""; save(); render(); toast(`👩‍🎓 Added ${names.length} student${names.length > 1 ? "s" : ""}`);
  };
  $("#undoBtn").onclick = undo;
  $("#csvBtn").onclick = () => {
    const rows = [["Date", "Type", "Who", "Points", "Reason"], ...state.log.map((e) => [new Date(e.ts).toISOString(), e.type,
      e.type === "group" ? group(e.groupId)?.name : e.studentIds.map((id) => student(id)?.name).join("; "), e.pts, e.reason || ""])];
    download("group-points-history.csv", rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };
  function download(name, text, type) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $("#exportJson").onclick = () => download(`group-points-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");
  $("#importJson").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.groups) || !Array.isArray(data.students)) throw new Error();
      state = { ...DEFAULTS(), ...data }; selected.clear(); save(); render(); toast("✅ Backup loaded");
    } catch { toast("⚠️ That file isn't a valid backup"); }
    e.target.value = "";
  };
  $("#loadDemo").onclick = loadDemo;
  $("#resetPoints").onclick = () => confirmBox("Set every student's points and group bonuses back to 0? (Students stay.)", () => {
    state.students.forEach((s) => { s.points = 0; s.spent = 0; }); state.groups.forEach((h) => h.bonus = 0); state.log = []; save(); render(); toast("Points reset");
  });
  $("#resetAll").onclick = () => confirmBox("Delete ALL groups, students, rewards and history?", () => { state = DEFAULTS(); selected.clear(); save(); render(); toast("Everything cleared"); });
  $("#soundToggle").onchange = (e) => { state.sound = e.target.checked; save(); };
  $("#activityPicker").onclick = (e) => { const t = e.target.closest(".act-tile"); if (t) openActivity(t.dataset.act); };
  $("#projectorBtn").onclick = () => { $("#projector").hidden = false; renderProjector(); document.documentElement.requestFullscreen?.().catch(() => {}); };
  $$("[data-pmode]").forEach((b) => b.onclick = () => { projMode = b.dataset.pmode; renderProjector(); });
  ["#bYear", "#bClass"].forEach((sel) => $(sel).addEventListener("input", () => { renderBoard(); if (!$("#projector").hidden) renderProjector(); }));
  $("#closeProjector").onclick = () => { $("#projector").hidden = true; if (document.fullscreenElement) document.exitFullscreen(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#projector").hidden) $("#closeProjector").click(); });
  setInterval(() => { if ($("#view-board").classList.contains("active")) renderBoard(); }, 60000);

  render();
  try { const t = localStorage.getItem(KEY + "-tab"); if (t) $(`#tabs [data-tab="${t}"]`)?.click(); } catch (e) {}
})();
