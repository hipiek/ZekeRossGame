# 📱 SNAP SQUAD: Clout Empire

An insanely engaging mobile tap-RPG starring the whole crew. Tap goofy faces to
earn **Clout**, summon your squad, level them up, fire off signature abilities,
catch Golden Snaps, prestige into new eras, and chase achievements. Built as an
installable **PWA** — plays fully offline once loaded.

## ▶️ How to play it

It's a static web app — no build step. Serve the `game/` folder over HTTP:

```bash
cd game
python3 -m http.server 8080
# open http://localhost:8080 on your phone or browser (use device toolbar / portrait)
```

On mobile, use your browser's **"Add to Home Screen"** to install it like a real
app (custom icon, fullscreen, offline play).

## 🎮 Game systems (all the modern hooks)

| System | What it does |
|---|---|
| **Tap to earn** | Tap the featured member for Clout. Crits (12×) + screen shake + particles. |
| **Combo meter** | Rapid taps build up to a 30-step combo multiplier that decays if you stop. |
| **Idle income** | Every recruited member generates Clout/sec, even while you're away (offline earnings, 50% rate, 8h cap). |
| **Squad / collection** | Recruit & level all **40** crew members. Rarity tiers: Common → Rare → Epic → Legendary → Mythic. Common/Rare are buyable with Clout; **Epic+ are summon-only**. |
| **Dual-banner gacha (ZZZ-style)** | Two live campaigns with featured rate-up characters: **Snap Summon** (💎 Snaps, featured Legendary) and **Prestige Summon** (⭐ Star Snaps, featured Mythic). Cinematic charge-up + flip reveals. |
| **Pity + 50/50** | Hard pity guarantees the banner's top rarity within **100 pulls** (live countdown). Lose the 50/50 and your next top pull is a **guaranteed featured**. |
| **Wishlist** | Pick up to 5 roll-only stars; off-featured top pulls are drawn from your wishlist first. |
| **Low-rank refunds** | Rolling a Common/Rare refunds **half its recruit price** as Clout, so pulls are never wasted. |
| **Boosts / abilities** | Owned members unlock active abilities (Tap Frenzy, Overdrive, Gold Rush, Clout Bomb, Blackout) on cooldowns. |
| **Golden Cat** | A golden cat drifts across the screen — tap it for Clout bursts, frenzies, Snaps, or rare Star Snaps. |
| **Custom art & icons** | Fully emoji-free: a hand-built inline-SVG icon set (`js/icons.js`), plus custom mascots — the golden cat collectible and the summoner who bounces around the screen while you pull. |
| **Daily rewards** | Login streak rewards (Snaps, plus a Star Snap every 7th day). |
| **Rebrand (prestige)** | Reset for a permanent **Influence** multiplier (+3 ⭐) once you hit 1B total Clout. |
| **Shop** | Clout Shop screen (under construction — bundles, Star packs, boosts & cosmetics coming). |
| **Achievements** | 17 goals that pay out Snaps 💎. |
| **Saves** | Auto-saves to `localStorage`; offline-capable via service worker. |

## 👥 The roster

All **40** members are drawn from the crew's own photos, each with a rarity, a
title, and a quote riffing on their shot — from **The Closer** (your free starter)
and a deep bench of buyable Commons/Rares (Bedhead, The Skipper, Smug Mode,
Tastemaker, Deckhand, Fresh Face, Perfect Selfie…) up through summon-only
Legendaries like **1 Billion O'Clock**, **Mega Mustache**, **Stormcaller**, and
**The Contractor**, to Mythics **Unhinged**, **Pan Master** (ascended into the
zeke pan), and **The Cursed One**.

## 🛠️ Tech

- Vanilla JS / CSS / HTML — zero dependencies, ~one engine file.
- `js/data.js` — roster, rarities, abilities, achievements (easy to tune/extend).
- `js/game.js` — engine: economy, tapping, gacha, boosts, prestige, save/load, loop.
- Portraits processed from the source photos by `scripts/process_chars.py` and
  `scripts/process_new_chars.py` (Pillow).
- PWA: `manifest.webmanifest` + `service-worker.js`.

## 🔁 Iterating

Add a character: drop a new entry in `ROSTER` (`js/data.js`) and a matching
`{id}.webp` in `assets/chars/`. Balance is data-driven (`baseCps`, `baseCost`,
`tapBonus`, rarity `mult`), so tuning is just numbers. Tell me what to add next.
