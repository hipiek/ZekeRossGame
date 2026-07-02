/* ============================================================
   SNAP SQUAD — custom inline SVG icon set (no emojis).
   ic(name, extraClass) -> svg string. fillIcons(root) hydrates
   any [data-ic] placeholders. Icons inherit color via currentColor.
   ============================================================ */
const ICON_PATHS = {
  // ---- currencies (filled) ----
  clout: '<path d="M12 1.5 14.6 9.4 23 12l-8.4 2.6L12 22.5 9.4 14.6 1 12l8.4-2.6z" fill="currentColor" stroke="none"/>',
  snap:  '<path d="M5 3.5h14l3 5.5-10 11.5L2 9z" fill="currentColor" stroke="none"/><path d="M2 9h20M9 3.5 6.5 9 12 20.5 17.5 9 15 3.5" stroke="rgba(0,0,0,.28)" stroke-width="1.1" fill="none"/>',
  star:  '<path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 18.6 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z" fill="currentColor" stroke="none"/>',

  // ---- bottom nav (line) ----
  tap:   '<path d="M10 9.5V5.2a1.6 1.6 0 0 1 3.2 0v6"/><path d="M13.2 11.3V9.6a1.6 1.6 0 0 1 3.2 0V16a4.6 4.6 0 0 1-4.6 4.6h-1a4 4 0 0 1-2.8-1.2l-3.4-3.4a1.6 1.6 0 0 1 2.3-2.3L9 15.2"/>',
  squad: '<circle cx="9" cy="8" r="3.1"/><path d="M3.6 20a5.4 5.4 0 0 1 10.8 0"/><path d="M16 5.4a3.1 3.1 0 0 1 0 6.2"/><path d="M16 14.6a5.4 5.4 0 0 1 4.4 5.4"/>',
  summon:'<path d="M12 4v16M4 12h16" stroke-width="1.3"/><path d="M12 6.2l1.7 4.1L18 12l-4.3 1.7L12 18l-1.7-4.3L6 12l4.3-1.7z" fill="currentColor" stroke="none"/>',
  boosts:'<path d="M12 3c3 1.6 5 5 5 9l-2.4 2.5H9.4L7 12c0-4 2-7.4 5-9z"/><circle cx="12" cy="10" r="1.6"/><path d="M9.4 16.6 8 20l2.6-1.1M14.6 16.6 16 20l-2.6-1.1"/>',
  shop:  '<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  more:  '<path d="M5 20v-9M12 20V4M19 20v-6" stroke-width="2.4"/>',

  // ---- abilities ----
  frenzy:   '<path d="M13 2 4 13.5h6L9 22l9-12h-6z" fill="currentColor" stroke="none"/>',
  overdrive:'<circle cx="12" cy="12" r="3.4"/><path d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1"/>',
  goldrush: '<path d="M9 3l1.3 3.7L14 8l-3.7 1.3L9 13l-1.3-3.7L4 8l3.7-1.3z" fill="currentColor" stroke="none"/><path d="M17 12l.9 2.4L20 15.3l-2.1.9L17 18.3l-.9-2.1L14 15.3l2.1-.9z" fill="currentColor" stroke="none"/>',
  cloutbomb:'<circle cx="11" cy="14.5" r="5.8"/><path d="M15 8.5l1.8-1.8M17.4 6.4 18.6 5M19 4l1-1"/>',
  blackout: '<path d="M20.5 12A8.5 8.5 0 1 1 8.6 4.2"/><path d="M8 12a4 4 0 1 0 4-4"/>',
  timer:    '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9M9 2.5h6"/>',

  // ---- misc chrome ----
  trophy:  '<path d="M7 4h10v3.5a5 5 0 0 1-10 0z"/><path d="M7 5H4v1.8a3 3 0 0 0 3 3M17 5h3v1.8a3 3 0 0 1-3 3"/><path d="M12 12.5v3.5M9 20h6l-.7-3.5h-4.6z"/>',
  fire:    '<path d="M12 3s5 3.7 5 9a5 5 0 0 1-10 0c0-1.8.9-3 .9-3s.1 1.8 1.5 2.4C10.2 12 9 9 12 3z" fill="currentColor" stroke="none"/>',
  recycle: '<path d="M5.5 9.5a7 7 0 0 1 11.6-3"/><path d="M17.5 3v4h-4"/><path d="M18.5 14.5a7 7 0 0 1-11.6 3"/><path d="M6.5 21v-4h4"/>',
  heart:   '<path d="M12 20.3S3.8 14.9 3.8 9.4A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 8.2 2.4c0 5.5-8.2 10.9-8.2 10.9z" fill="currentColor" stroke="none"/>',
  lock:    '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  check:   '<path d="M5 12.5l4.5 4.5L19 6" stroke-width="2.6"/>',
  hourglass:'<path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9"/>',
  up:      '<path d="M12 5l6.5 8h-4v6h-5v-6H5.5z" fill="currentColor" stroke="none"/>',
  close:   '<path d="M6 6l12 12M18 6 6 18" stroke-width="2.2"/>',
  skip:    '<path d="M4.5 5l7.5 7-7.5 7zM12.5 5l7.5 7-7.5 7z" fill="currentColor" stroke="none"/>',
  cones:   '<path d="M3 8.5h18v4.5H3z"/><path d="M6 13v7M18 13v7M5 8.5 8 5.5M11 8.5l3-3M17 8.5l3-3"/>',
  hammer:  '<path d="M14.5 4.5 19 9l-2.6 2.6a2 2 0 0 1-2.8 0L10.4 8.4a2 2 0 0 1 0-2.8z" fill="currentColor" stroke="none"/><path d="M11 9.8 4 16.8a1.7 1.7 0 0 0 2.4 2.4l7-7" stroke-width="2.2"/>',
  chicken: '<path d="M16.2 6.1c1-.9 1-2.3.2-3-.5.3-.9.8-1 1.3-.5-.3-1.2-.4-1.8-.2-1.5.4-2.2 1.8-2 3.2l.2 1.1c-2.8.2-5.9 1.6-7.5 4.3-1.2 2 .3 4.6 5.9 5.9l-.7 2.5h1.7l.6-2.2c.5.1.9.1 1.4.1l.6 2.1h1.7l-.7-2.3c3.5-.6 5.6-2.5 5.6-5.3 0-3.2-2.3-5.6-4.9-6.3zM17 4.5c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5z" fill="currentColor" stroke="none"/>',
  flag:    '<path d="M6 21V4"/><path d="M6 5h11l-2.5 3.5L17 12H6"/>',
  bolt:    '<path d="M13 2 4 13.5h6L9 22l9-12h-6z" fill="currentColor" stroke="none"/>',
  paint:   '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-.5-.4-1-.4-1.6 0-.8.6-1.5 1.6-1.5H17a4 4 0 0 0 4-4c0-4.5-4-9-9-9z"/><circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="10.5" r="1" fill="currentColor" stroke="none"/>',
};

function ic(name, extra){
  const p = ICON_PATHS[name];
  if(!p) return "";
  return `<svg class="ic ic-${name}${extra?' '+extra:''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" `
       + `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

function fillIcons(root){
  (root||document).querySelectorAll("[data-ic]").forEach(node=>{
    node.innerHTML = ic(node.dataset.ic);
  });
}
