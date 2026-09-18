# Deploy notes — Tower/PAGES QA polish (2026-09-17)

Preview: https://79721de0.cognation-3md.pages.dev  
Project: cognation (cognation-3md.pages.dev)

## Changes
1. **PAGES geo** — asks for browser location; haversine filter ≤15 miles; Chicago fallback + status copy.
2. **Tower Backspace** — every selected scrapbook widget (plus friend/badge pins and quote stickers) removable; empty shells auto-pruned.
3. **Translucent stickers** — frosted/see-through widget surfaces.
4. **Frame LX** — center letter bleed masked (`tower-frame-lx-clear` + swatch ::after).
5. **Music** — no autoplay on login/load; Play requires explicit gesture.
6. **Ghost widgets** — empty html/social/music/friends/badges pruned on load.
7. **Add content** — personal public scrapbook Add content / double-click empty canvas → quote or slogan sticker.

## Files
- js/pages.js, js/tower.js, css/styles.css, index.html
- Synced to cognation-site + cognation-pages-deploy
