import { useEffect, useRef, useState } from 'react';

// True while the reader is moving further down the page, so the things
// floating over it can get out of the way.
//
// The dashboard is a long column of charts and the bar sits on top of the
// last inch of it. Reading downwards is exactly when that inch matters, and
// exactly when nobody is reaching for a section toggle — so the chrome leaves
// on the way down and comes back the moment the scroll reverses.
//
// Scroll fires far more often than paint, so the handler does nothing but
// note the position and let a frame do the comparing.

// Ignore the small trembles a thumb makes while reading; only a deliberate
// push either way should move anything.
const THRESHOLD = 8;

// The top of the page always shows the chrome. Hiding it there would make the
// bar flicker on every short scroll of a page barely taller than the screen.
const ALWAYS_SHOWN_ABOVE = 96;

export default function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    function settle() {
      ticking.current = false;
      const y = window.scrollY;
      const delta = y - lastY.current;

      if (y <= ALWAYS_SHOWN_ABOVE) {
        setHidden(false);
      } else if (Math.abs(delta) > THRESHOLD) {
        setHidden(delta > 0);
      } else {
        return; // Not enough movement to mean anything; keep lastY as it was.
      }
      lastY.current = y;
    }

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(settle);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return hidden;
}
