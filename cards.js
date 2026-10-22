/* 🃏 Answer cards — the whole class answers at once, one camera reads the room.
   A port of the Life Competencies app's Answer cards (digital-literacy src/lib/cards.ts, CardGame in page.tsx):
   - One printed card per student: a QR code holding only the card's number, letters A (top) B (left) C (bottom) D (right).
     The letter at the top is the answer; the QR code's rotation tells which one. Same cards as the LC app.
   - Card numbers follow the class list (sorted by name), so one printed set serves every class.
   - The class screen reads with its own camera, or with a phone: the phone opens the LC app's /scan page and both meet
     in the same Supabase broadcast channel `cards:<room>` (events read / hello / round). Nothing is stored anywhere.
   - Right answers give each student +1 ⭐ (window.ClassPoints.awardStudents) when the teacher moves on. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const CP = () => window.ClassPoints;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LETTERS = ["A", "B", "C", "D"];
  const LC_APP = "https://zera-life-competencies.vercel.app";
  const JSQR = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
  const SUPA = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  const loaded = {};
  const script = (src) => (loaded[src] ||= new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error("offline")); }; document.head.appendChild(s); }));

  /* ---------- Reading cards (same rules as the LC app) ---------- */
  const letterForAngle = (deg) => Math.round(((deg % 360) + 360) % 360 / 90) % 4;
  const angleOf = (tl, tr) => ((Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180) / Math.PI + 360) % 360;
  const numberFrom = (s) => { const n = Number(String(s).trim()); return Number.isInteger(n) && n > 0 && n < 1000 ? n : null; };
  // A QR reader finds one code per image and a room holds twenty: read the whole frame, then nine overlapping tiles
  function readFrame(ctx, w, h) {
    const found = {};
    const read = (x, y, ww, hh) => {
      const hit = window.jsQR(ctx.getImageData(x, y, ww, hh).data, ww, hh, { inversionAttempts: "dontInvert" });
      const n = hit && numberFrom(hit.data); if (!n) return;
      found[n] = letterForAngle(angleOf(hit.location.topLeftCorner, hit.location.topRightCorner));
    };
    read(0, 0, w, h);
    const tw = Math.floor(w / 3), th = Math.floor(h / 3), over = 0.25;
    for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) {
      const x = Math.max(0, Math.floor(tx * tw - tw * over)), y = Math.max(0, Math.floor(ty * th - th * over));
      const ww = Math.min(w - x, Math.floor(tw * (1 + over * 2))), hh = Math.min(h - y, Math.floor(th * (1 + over * 2)));
      if (ww >= 40 && hh >= 40) read(x, y, ww, hh);
    }
    return found;
  }

  /* ---------- Printing the cards (one to an A4 sheet, numbers only) ---------- */
  function qrData(text, level = "H", size = 600) {
    const box = document.createElement("div");
    new window.QRCode(box, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel[level] });
    const c = box.querySelector("canvas"); return c ? c.toDataURL("image/png") : box.querySelector("img")?.src || "";
  }
  // The cards are the Life Competencies app's own printed set (assets/answer-cards.html = its "Answer Cards — 1 to 40"
  // download), so the same cards work in both apps. 20 / 30 prints only the first pages.
  const CARDS_FILE = "assets/answer-cards.html";
  function printCards(count) {
    CP().toast("🖨️ Opening the cards…");
    const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0"; document.body.appendChild(f);
    f.onload = () => {
      const d = f.contentDocument;
      [...d.querySelectorAll(".page")].slice(count).forEach((p) => p.remove());
      const h = d.querySelector("header h1"); if (h) h.innerHTML = `Answer Cards &mdash; Student 1 to ${count}`;
      d.title = `Answer Cards — 1 to ${count}`;
      setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { CP().toast("⚠️ Couldn't open the print dialog"); } setTimeout(() => f.remove(), 60000); }, 300);
    };
    f.src = CARDS_FILE;
  }

  /* ---------- The game ---------- */
  const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const newRoom = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHA[b % ALPHA.length]).join("");
  let cardCount = 30;

  // ctx: { stage, onClose, plan, w, title, items: [{ q, a, options }] }
  function open(ctx) {
    const el = ctx.stage(`🃏 Answer cards · ${esc(ctx.title)}`), body = $(".lc-stage-body", el);
    const year = ctx.plan.year;
    const all = CP().students().filter((s) => s.year === year);
    const classes = [...new Set(all.map((s) => s.cls).filter(Boolean))].sort();
    let cls = classes.length ? classes[0] : "";
    const listFor = () => (cls ? all.filter((s) => s.cls === cls) : all).sort((a, b) => a.name.localeCompare(b.name)).map((s, i) => ({ number: i + 1, id: s.id, name: s.name }));
    let students = listFor();

    // ten questions, options in a fixed shuffle so a reprint / replay is the same
    const rounds = ctx.items.map((it, i) => {
      const o = [...it.options].slice(0, 4), r = (i * 3 + 1) % o.length, opts = [...o.slice(r), ...o.slice(0, r)];
      return { q: it.q.replace(/^🔁[^:]*:\s*/, ""), from: (it.q.match(/^🔁([^:]*):/) || [])[1]?.trim() || "", options: opts, correct: opts.findIndex((x) => x.toLowerCase() === String(it.a).toLowerCase()) };
    });

    let phase = "lobby", qi = 0, answers = {}, score = {}, alive = true;
    let camera = "off", stream = null, scanning = false, video = null, canvas = null;
    const room = newRoom(), scanLink = `${LC_APP}/scan?c=${room}`;
    let channel = null, phoneSeen = 0;

    /* the phone: LC's /scan page, same Supabase project, broadcast only */
    (async () => {
      try {
        await script(SUPA);
        const C = window.LIVE_CONFIG; if (!C || !window.supabase || !alive) return;
        const sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: false } });
        channel = sb.channel(`cards:${room}`);
        channel.on("broadcast", { event: "read" }, (m) => {
          phoneSeen = Date.now(); phoneDot();
          if (phase !== "asking") return;
          let grew = false;
          for (const r of m.payload?.reads || []) if (Number.isInteger(r.n) && r.n >= 1 && r.n <= students.length && r.letter >= 0 && r.letter <= 3) { answers[r.n] = r.letter; grew = true; }
          if (grew) drawRoom();
        }).on("broadcast", { event: "hello" }, () => { phoneSeen = Date.now(); phoneDot(); sendRound(); }).subscribe();
        ctx.onClose(() => sb.removeChannel(channel));
      } catch { /* this device's camera still works */ }
    })();
    const sendRound = () => channel?.send({ type: "broadcast", event: "round", payload: { q: qi + 1, of: rounds.length, open: phase === "asking" } });
    const phoneLive = () => Date.now() - phoneSeen < 8000;
    const phoneDot = () => $$(".ac-phone-dot", body).forEach((d) => { d.classList.toggle("on", phoneLive()); d.lastChild.textContent = phoneLive() ? " Phone linked" : ` No phone yet · room ${room}`; });
    const tick = setInterval(phoneDot, 2000);

    /* this device's camera */
    async function startCamera() {
      camera = "starting"; drawRoom();
      try {
        await script(JSQR);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (!alive) return stopCamera();
        camera = "on"; drawRoom();
        video.srcObject = stream; await video.play(); scanning = true; loop();
      } catch { camera = "denied"; drawRoom(); }
    }
    function stopCamera() { scanning = false; stream?.getTracks().forEach((t) => t.stop()); stream = null; }
    function loop() {
      if (!scanning) return;
      if (video?.videoWidth && canvas) {
        const w = 720, h = Math.round((video.videoHeight / video.videoWidth) * w);
        canvas.width = w; canvas.height = h;
        const c = canvas.getContext("2d", { willReadFrequently: true }); c.drawImage(video, 0, 0, w, h);
        let grew = false;
        for (const [k, letter] of Object.entries(readFrame(c, w, h))) if (+k <= students.length && phase === "asking" && answers[k] !== letter) { answers[k] = letter; grew = true; }
        if (grew) drawRoom();
      }
      requestAnimationFrame(loop);
    }
    ctx.onClose(() => { alive = false; stopCamera(); clearInterval(tick); });

    const round = () => rounds[qi];
    const liveRight = (n) => round() && round().correct >= 0 && (phase === "asking" || phase === "revealed") && answers[n] === round().correct;
    const pointsOf = (n) => (score[n] || 0) + (liveRight(n) ? 1 : 0);
    const qrImg = (size) => (window.QRCode ? `<img class="ac-qr" src="${qrData(scanLink, "M", 240)}" width="${size}" height="${size}" alt="Scan to use your phone">` : "");
    const phoneBox = (size) => `<div class="ac-phone">${qrImg(size)}<div><b>📱 Scan the room with your phone</b><p>Point your phone's camera at this code and open the link. The question stays on this screen; the phone only reads the cards.</p>
      <p class="ac-phone-dot ${phoneLive() ? "on" : ""}"><i></i><span>${phoneLive() ? " Phone linked" : ` No phone yet · room ${room}`}</span></p></div></div>`;

    function lobby() {
      body.innerHTML = `<div class="ac ac-lobby">
        <div class="ac-hero"><div class="ac-big">🃏</div><h2>Answer cards</h2>
          <p>Every student holds up their card, turned so their answer is the <b>letter at the top</b>. You sweep the room with your phone's camera, or this device's, and the answers tick in. Nobody can copy: the letters are small and the answers stay hidden until the reveal.</p>
          <p class="ac-small">The cards are numbered, so one printed set serves every class: <b>card 1 goes to the first student</b> on the list below, card 2 to the second — the same order every lesson. These are the same cards as the Life Competencies app.</p></div>
        <div class="ac-row">
          <div class="ac-box"><h3>👥 Class</h3>
            ${classes.length > 1 ? `<div class="ac-pills">${classes.map((c) => `<button class="${c === cls ? "on" : ""}" data-cls="${esc(c)}">${esc(c)} · ${all.filter((s) => s.cls === c).length}</button>`).join("")}<button class="${!cls ? "on" : ""}" data-cls="">All Year ${year} · ${all.length}</button></div>` : ""}
            ${students.length ? `<ol class="ac-list">${students.map((s) => `<li><b>${s.number}</b> ${esc(s.name)}</li>`).join("")}</ol>` : `<p class="ac-small">No Year ${year} students yet — add them in ⚙️ Setup. Cards still work: the board shows “Card 1, Card 2…”.</p>`}</div>
          <div class="ac-box"><h3>🖨️ Print the cards <small>(once, for every class)</small></h3>
            <div class="ac-pills">${[20, 30, 40].map((n) => `<button class="${cardCount === n ? "on" : ""}" data-count="${n}">${n}</button>`).join("")}</div>
            <button class="btn ac-print">🖨️ Print cards 1–${cardCount}</button> <a class="btn ghost" href="${CARDS_FILE}" target="_blank" rel="noopener">👀 See the cards</a>
            <p class="ac-small">One card to a sheet of A4, so a phone can read it from across the room. Card stock lasts the year.</p>
            ${phoneBox(120)}</div>
        </div>
        <div class="ac-go"><button class="btn big ac-start">▶ Start · ${rounds.length} questions</button></div>
      </div>`;
      $$("[data-cls]", body).forEach((b) => b.onclick = () => { cls = b.dataset.cls; students = listFor(); lobby(); });
      $$("[data-count]", body).forEach((b) => b.onclick = () => { cardCount = +b.dataset.count; lobby(); });
      $(".ac-print", body).onclick = () => printCards(cardCount);
      $(".ac-start", body).onclick = () => { if (!students.length) students = Array.from({ length: cardCount }, (_, i) => ({ number: i + 1, id: null, name: `Card ${i + 1}` })); phase = "asking"; qi = 0; answers = {}; score = {}; sendRound(); ask(); };
    }

    function ask() {
      const r = round();
      body.innerHTML = `<div class="ac ac-play">
        <div class="ac-q">
          <div class="ac-kicker">Question ${qi + 1} of ${rounds.length}${r.from ? ` · 🔁 ${esc(r.from)}` : ""}</div>
          <h2>${esc(r.q)}</h2>
          <div class="ac-opts">${r.options.map((o, i) => `<div class="ac-opt" data-i="${i}"><span>${LETTERS[i]}</span><b>${esc(o)}</b><em></em></div>`).join("")}</div>
          <div class="ac-btns"><button class="btn big ac-next"></button><span class="ac-count"></span></div>
        </div>
        <div class="ac-side">
          <div class="ac-cam"><video playsinline muted></video><canvas hidden></canvas><div class="ac-camoff"></div></div>
          <div class="ac-room"></div>
        </div>
      </div>`;
      video = $("video", body); canvas = $("canvas", body);
      if (stream) { video.srcObject = stream; video.play().catch(() => {}); }
      $(".ac-next", body).onclick = () => (phase === "asking" ? reveal() : next());
      drawRoom();
    }
    function reveal() { phase = "revealed"; sendRound(); CP().beep("up"); drawRoom(); }
    function next() {
      const r = round(), right = [];
      if (r.correct >= 0) for (const [n, letter] of Object.entries(answers)) if (letter === r.correct) { score[n] = (score[n] || 0) + 1; const s = students[n - 1]; if (s?.id) right.push(s.id); }
      if (right.length) CP().awardStudents(right, 1, `🃏 Answer cards · ${ctx.title}`);
      answers = {};
      if (qi + 1 >= rounds.length) { phase = "done"; sendRound(); return done(); }
      qi++; phase = "asking"; sendRound(); ask();
    }
    function drawRoom() {
      if (phase === "lobby" || phase === "done" || !$(".ac-play", body)) return;
      const r = round(), shown = phase === "revealed";
      $$(".ac-opt", body).forEach((o, i) => { o.classList.toggle("right", shown && i === r.correct); o.classList.toggle("dim", shown && i !== r.correct); $("em", o).textContent = shown ? Object.values(answers).filter((a) => a === i).length : ""; });
      $(".ac-next", body).textContent = phase === "asking" ? "👀 Show the answer" : qi + 1 >= rounds.length ? "🏆 See the scores" : "Next question ›";
      $(".ac-count", body).textContent = `${Object.keys(answers).length} of ${students.length} answered`;
      const cam = $(".ac-cam", body); cam.classList.toggle("on", camera === "on");
      if (camera !== "on") $(".ac-camoff", cam).innerHTML = `${phoneBox(96)}<button class="btn ghost ac-usecam">${camera === "starting" ? "Starting the camera…" : "📷 Use this device's camera instead"}</button>${camera === "denied" ? `<p class="ac-small">The camera was blocked — allow it in the address bar, then try again.</p>` : ""}`;
      const uc = $(".ac-usecam", cam); if (uc) uc.onclick = startCamera;
      $(".ac-room", body).innerHTML = `${phase === "asking" ? `<p class="ac-small">A brighter name has answered. A right answer scores its point straight away.</p>` : ""}
        ${[...students].sort((a, b) => pointsOf(b.number) - pointsOf(a.number) || a.number - b.number).map((s) => {
          const has = answers[s.number] !== undefined, right = shown && answers[s.number] === r.correct;
          return `<div class="ac-kid ${shown ? (right ? "right" : has ? "wrong" : "none") : has ? "has" : ""}"><span>${s.number}. ${esc(s.name)}</span>${liveRight(s.number) ? `<i>+1</i>` : ""}<b>${pointsOf(s.number)}</b></div>`;
        }).join("")}`;
    }
    function done() {
      const ranked = [...students].map((s) => ({ ...s, points: score[s.number] || 0 })).sort((a, b) => b.points - a.points || a.number - b.number);
      const best = ranked[0]?.points || 0, top = ranked.filter((x) => x.points === best && best > 0);
      body.innerHTML = `<div class="ac ac-done"><div class="ac-big">🏆</div>
        <h2>${!top.length ? "Well played" : top.length === 1 ? `${esc(top[0].name)} wins!` : top.length === 2 ? `${esc(top[0].name)} and ${esc(top[1].name)} tie!` : `${top.length} of you tie at the top!`}</h2>
        <p>${best} out of ${rounds.length} right · every right answer gave a ⭐ to that student's jar</p>
        <ol class="ac-rank">${ranked.slice(0, 15).map((s) => `<li><span>${esc(s.name)}</span><b>${s.points}</b></li>`).join("")}</ol>
        <button class="btn ac-again">🔁 Play again</button></div>`;
      if (best > 0) CP().confetti(160);
      $(".ac-again", body).onclick = () => { score = {}; answers = {}; qi = 0; phase = "asking"; sendRound(); ask(); };
    }
    lobby();
    // the QR library loads with "defer"; draw the phone code once it is there
    if (!window.QRCode) { const t = setInterval(() => { if (window.QRCode || !alive) { clearInterval(t); if (alive && phase === "lobby") lobby(); } }, 300); }
  }

  window.AnswerCards = { open, readFrame, letterForAngle, CARDS_FILE };
})();
