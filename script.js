/* A Very Random Server (AVRS) — shared script */
(() => {
  "use strict";

  /* ---------- Settings: edit these ---------- */
  const AVRS = {
    ip: "avrs.aternos.me",
    // Paste your Discord invite link (e.g. "https://discord.gg/abc123"). Leave "" to hide Discord links.
    discordUrl: "",
    // Paste a Discord webhook URL to receive appeals in a staff channel. Leave "" and players
    // get a ready-to-copy appeal to send to staff instead. See the note at the bottom of this file.
    appealsWebhook: "",
    statusApi: "https://api.mcsrvstat.us/3/",
  };

  const IDEAS = [
    "Build a house out of only one block type. Everyone votes on the block.",
    "Trade with a villager, then build them a mansion.",
    "Race a friend to the nether roof. Loser carries the gravel.",
    "Dig straight down until something surprising happens.",
    "Build the tallest tower you can and put a single torch at the top.",
    "Start a farm that only grows one thing. Defend it forever.",
    "Make a secret base and give a friend only half the directions.",
    "Collect one of every flower in the world.",
    "Build a bridge to nowhere, then stand at the end and wave.",
    "Swap inventories with a friend for ten minutes. Survive.",
    "Find a village and rename every villager something ridiculous.",
    "Build a statue of the last mob that surprised you.",
    "Cook every food item in the game and rank them. No cheating.",
    "Make a minecart route between two bases and add one terrible shortcut.",
    "Throw a build contest with a theme picked by the next person to log on.",
    "Explore a cave with only torches and a wooden pickaxe.",
  ];

  /* ---------- Helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { /* ignore */ }
      ta.remove();
      return ok;
    }
  }

  function flashLabel(btn, text) {
    const original = btn.dataset.label || btn.textContent;
    btn.dataset.label = original;
    btn.textContent = text;
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = original; }, 1800);
  }

  /* ---------- Mobile nav ---------- */
  function initNav() {
    const toggle = $(".nav-toggle");
    const nav = $("#site-nav");
    if (!toggle || !nav) return;
    const set = (open) => {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", () => set(!nav.classList.contains("open")));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("open")) { set(false); toggle.focus(); }
    });
  }

  /* ---------- Copy IP ---------- */
  function initCopyIp() {
    $$("[data-copy-ip]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await copyText(AVRS.ip);
        flashLabel(btn, ok ? "Copied!" : "Copy failed");
      });
    });
  }

  /* ---------- Discord links ---------- */
  function initDiscord() {
    if (!AVRS.discordUrl) return;
    $$("[data-discord]").forEach((el) => {
      if (el.tagName === "A") {
        el.href = AVRS.discordUrl;
        el.target = "_blank";
        el.rel = "noopener";
      }
      el.hidden = false;
    });
  }

  /* ---------- Live server status ---------- */
  // Two public status APIs are checked. If either says the server is up, it shows as up,
  // because a single API can return stale or blocked results for Aternos servers.
  const clean = (s) => String(s || "").replace(/§./g, "").trim();

  const SOURCES = [
    {
      url: () => `https://api.mcsrvstat.us/3/${encodeURIComponent(AVRS.ip)}`,
      normalize: (d) => ({
        online: d.online === true,
        players: d.players,
        version: clean(d.version),
        motd: ((d.motd && d.motd.clean) || []).join(" "),
      }),
    },
    {
      url: () => `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(AVRS.ip)}`,
      normalize: (d) => ({
        online: d.online === true,
        players: d.players,
        version: clean(d.version && (d.version.name_clean || d.version.name_raw)),
        motd: clean(d.motd && d.motd.clean),
      }),
    },
  ];

  async function fetchSource(src) {
    const res = await fetch(src.url(), { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return src.normalize(await res.json());
  }

  function classify(r) {
    if (!r.online) return "offline";
    // Aternos answers pings with a placeholder status while a server is asleep or booting.
    if (/^\W*offline/i.test(r.version) || /server is offline/i.test(r.motd)) return "offline";
    if (/^\W*(start|load|prepar|queue|waiting|saving|stopping)/i.test(r.version) ||
        /(starting|loading|preparing|in queue|waiting in)/i.test(r.motd)) return "starting";
    return "online";
  }

  async function initStatus() {
    const boxes = $$("[data-status]");
    const versionSpots = $$("[data-version]");
    if (!boxes.length && !versionSpots.length) return;

    const settled = await Promise.allSettled(SOURCES.map(fetchSource));
    const results = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const classified = results.map((r) => ({ r, state: classify(r) }));
    const pick = (st) => classified.find((c) => c.state === st);
    const best = pick("online") || pick("starting") || pick("offline");
    const state = best ? best.state : "unknown";
    const data = best ? best.r : null;
    console.debug("[AVRS status]", settled, state);

    const text = { online: "Online", offline: "Offline", starting: "Starting up", unknown: "Status unavailable" }[state];
    const notes = {
      online: "Copy the address above and join.",
      offline: "Aternos servers shut down when empty and have to be started by someone with access. If you think it's actually up, try joining anyway; this check can lag behind.",
      starting: "The server is waking up. Try joining again in a minute.",
      unknown: "We couldn't check the server. It may still be reachable, so try joining directly.",
    };

    boxes.forEach((box) => {
      const dot = $("[data-status-dot]", box);
      if (dot) dot.dataset.state = state;
      const set = (sel, value) => { const el = $(sel, box); if (el) el.textContent = value; };
      set("[data-status-text]", text);
      set("[data-status-note]", notes[state]);
      if (state === "online" && data.players) {
        set("[data-status-players]", `${data.players.online} / ${data.players.max}`);
        set("[data-status-version]", data.version || "Unknown");
      } else {
        set("[data-status-players]", "–");
        set("[data-status-version]", "–");
      }
    });

    if (state === "online" && data.version) {
      versionSpots.forEach((el) => { el.textContent = `Java Edition ${data.version}`; });
    }
  }

  /* ---------- Random idea generator ---------- */
  function initChaos() {
    const out = $("#chaos-output");
    const btn = $("#chaos-roll");
    if (!out || !btn) return;
    let last = -1;
    btn.addEventListener("click", () => {
      let i;
      do { i = Math.floor(Math.random() * IDEAS.length); } while (i === last && IDEAS.length > 1);
      last = i;
      out.textContent = IDEAS[i];
      btn.textContent = "Roll again";
    });
  }

  /* ---------- Appeals form ---------- */
  const COOLDOWN_MS = 10 * 60 * 1000;
  const COOLDOWN_KEY = "avrs-appeal-last";
  const readCooldown = () => { try { return Number(localStorage.getItem(COOLDOWN_KEY)) || 0; } catch { return 0; } };
  const saveCooldown = () => { try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch { /* ignore */ } };

  function initAppeals() {
    const form = $("#appeal-form");
    const result = $("#appeal-result");
    if (!form || !result) return;
    const submit = $("[type=submit]", form);

    function message(type, text) {
      const p = document.createElement("p");
      p.textContent = text;
      result.className = `notice ${type}`;
      result.replaceChildren(p);
      result.hidden = false;
      return p;
    }

    function showFallback(plain, failed) {
      message(failed ? "error" : "success", failed
        ? "We couldn't send your appeal automatically. Copy it below and send it to a staff member on Discord or in the game."
        : "Your appeal is ready. Copy it below and send it to a staff member on Discord or in the game.");
      const area = document.createElement("textarea");
      area.readOnly = true;
      area.value = plain;
      area.setAttribute("aria-label", "Your appeal text");
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "btn";
      copy.textContent = "Copy appeal";
      copy.addEventListener("click", async () => {
        area.select();
        flashLabel(copy, (await copyText(plain)) ? "Copied!" : "Copy failed");
      });
      result.append(area, copy);
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.elements.website.value) return; // honeypot
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (Date.now() - readCooldown() < COOLDOWN_MS) {
        message("error", "You already sent an appeal a moment ago. Give staff time to review it before sending another.");
        return;
      }

      const d = Object.fromEntries(new FormData(form));
      const fields = [
        ["Minecraft username", d.username.trim()],
        ["Punishment", d.punishment],
        ["Rule", d.rule],
        ["When it happened", (d.when || "").trim() || "Not given"],
        ["What happened", d.what.trim()],
        ["Why it should be lifted", d.why.trim()],
        ["How to reach me", d.contact.trim()],
      ];
      const plain = fields.map(([k, v]) => `${k}: ${v}`).join("\n\n");

      submit.disabled = true;
      try {
        let failed = false;
        if (AVRS.appealsWebhook) {
          try {
            const res = await fetch(AVRS.appealsWebhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: "AVRS appeals",
                allowed_mentions: { parse: [] },
                embeds: [{
                  title: `Appeal from ${fields[0][1]}`,
                  color: 0xf4c430,
                  fields: fields.map(([name, value]) => ({ name, value: value.slice(0, 1000) })),
                  timestamp: new Date().toISOString(),
                }],
              }),
            });
            if (!res.ok) throw new Error(String(res.status));
            saveCooldown();
            form.reset();
            message("success", "Appeal sent. Staff will review it and reach out using the contact you gave.");
            return;
          } catch {
            failed = true; // fall through to manual copy
          }
        }
        saveCooldown();
        showFallback(plain, failed);
      } finally {
        submit.disabled = false;
      }
    });
  }

  /* ---------- Go ---------- */
  initNav();
  initCopyIp();
  initDiscord();
  initStatus();
  initChaos();
  initAppeals();
})();

/*
  Note on appealsWebhook: anything in this file is visible to every visitor, so a webhook URL
  placed here can be copied and used to spam your channel. If that worries you, point
  appealsWebhook at a form service or small relay of your own instead, or leave it empty and
  let players copy their appeal to staff.
*/
