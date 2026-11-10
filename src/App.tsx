/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, GENRE_FILTERS, Book, getBookCoverUrl } from './data/books';
import { BookCoverFace, BookSpineFace, BookLeftFace, renderStars } from './components/BookCoverArt';

// Inline Paper Grain SVG data URI (220x220 fractal noise warm grey)
const GRAIN_DATA_URI = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.45 0 0 0 0 0.42 0 0 0 0 0.38 0 0 0 0.22 0"/></filter><rect width="100%" height="100%" filter="url(%23g)"/></svg>`;

function smoothstep(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return clamped * clamped * (3 - 2 * clamped);
}

export default function App() {
  // Currently Reading book (featured in top-right)
  const currentlyReadingBook: Book = {
    id: 'heart-the-lover',
    number: 0,
    title: 'Heart the Lover',
    author: 'Lily King',
    rating: 5.0,
    review: 'Currently reading this compelling novel by Lily King.',
    genres: ['Literature'],
    coverId: 15143628,
    widthFactor: 1.05,
    heightFactor: 0.95,
    coverAspect: 0.65,
    spineBg: '#1E3A8A',
    spineText: '#FFFFFF',
    spinePattern: 'solid',
  };

  // Active genre filter state
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');

  // Currently opened book for the review modal
  const [openedBook, setOpenedBook] = useState<Book | null>(null);

  // Filtered books based on selected genre
  const filteredBooks = useMemo(() => {
    if (selectedGenre === 'ALL') return BOOKS;
    return BOOKS.filter((b) =>
      b.genres.some(
        (g) =>
          g.toLowerCase().includes(selectedGenre.toLowerCase()) ||
          selectedGenre.toLowerCase().includes(g.toLowerCase())
      )
    );
  }, [selectedGenre]);

  // Shelf items to render:
  // When selectedGenre === 'ALL', render 3 repetitions (78 items: rep -1, 0, 1) for seamless infinite horizontal scroll on all display sizes.
  // When selectedGenre !== 'ALL', render only the filtered books (clamped strictly from 0 to filteredBooks.length - 1).
  const shelfItems = useMemo(() => {
    if (selectedGenre !== 'ALL') {
      return filteredBooks.map((b, i) => ({
        book: b,
        originalIdx: i,
        virtualIdx: i,
        key: `filtered-${b.id}-${i}`,
      }));
    }
    const N = BOOKS.length;
    const items = [];
    for (let rep = -1; rep <= 1; rep++) {
      for (let i = 0; i < N; i++) {
        items.push({
          book: BOOKS[i],
          originalIdx: i,
          virtualIdx: rep * N + i,
          key: `inf-${rep}-${BOOKS[i].id}-${i}`,
        });
      }
    }
    return items;
  }, [selectedGenre, filteredBooks]);

  // Precalculated packed center offsets for standing books.
  // Adjacent standing books touch with an authentic 2px seam — eliminates all gaps!
  const cumOffsets = useMemo(() => {
    const offsets: number[] = [];
    if (shelfItems.length === 0) return offsets;
    offsets.push(0);
    for (let i = 1; i < shelfItems.length; i++) {
      const prevW = shelfItems[i - 1].book.widthFactor * 38;
      const currW = shelfItems[i].book.widthFactor * 38;
      const step = (prevW + currW) / 2 + 2.0; // 2px authentic shelf contact seam
      offsets.push(offsets[i - 1] + step);
    }
    return offsets;
  }, [shelfItems]);

  // Probe container for real rendered --H
  const probeRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Detail dialog & elements
  const detailRef = useRef<HTMLDivElement>(null);
  const detailSheetAnimRef = useRef<Animation | null>(null);

  // Caption line masks
  const captionTitleMaskRef = useRef<HTMLDivElement>(null);
  const captionSubMaskRef = useRef<HTMLDivElement>(null);
  const captionMetaMaskRef = useRef<HTMLDivElement>(null);

  // Detail text masked line spans
  const detailLinesRef = useRef<(HTMLDivElement | null)[]>([]);

  // Genre tab elements & indicator
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabIndicatorRef = useRef<HTMLDivElement>(null);


  // Custom cursor refs
  const cursorRef = useRef<HTMLDivElement>(null);

  // Book elements ref
  const bookItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const coverFaceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const spineFaceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const leftFaceRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Simulation state stored in refs for 60fps rAF loop
  const stateRef = useRef({
    s: 0,
    T: 0,
    hoveredIndex: -1,
    activeBookIndex: 0,
    mx: -1000,
    my: -1000,
    cx: -1000,
    cy: -1000,
    tiltX: 0,
    tiltY: 0,
    isOpen: false,
    isDown: false,
    isDragging: false,
    downX: 0,
    downY: 0,
    downTime: 0,
    dragStartT: 0,
    hasMovedDuringDrag: false,
    wheelTimer: null as ReturnType<typeof setTimeout> | null,
    lifts: new Array(120).fill(0),
    H: 340,
    ws: 38,
    d: 220,
    gap: 8,
    W: 1440,
    cy0: 450,
  });

  // Preload cover images
  useEffect(() => {
    BOOKS.slice(0, 12).forEach((b) => {
      const img = new Image();
      img.src = getBookCoverUrl(b);
    });
  }, []);

  // Compute / update geometric dimensions from real --H
  const updateDimensions = () => {
    const W = window.innerWidth;
    const cy0 = window.innerHeight / 2;
    let H = 340;
    if (probeRef.current) {
      const rectH = probeRef.current.getBoundingClientRect().height;
      if (rectH > 0) H = rectH;
    }
    const ws = (H * 95) / 840; // baseline spine width (~38px)
    const d = H * 0.65;        // natural book cover width (~220px, fixes Issue 1)
    const gap = H * 0.025;

    stateRef.current.H = H;
    stateRef.current.ws = ws;
    stateRef.current.d = d;
    stateRef.current.gap = gap;
    stateRef.current.W = W;
    stateRef.current.cy0 = cy0;

    if (stageRef.current) {
      stageRef.current.style.setProperty('--ws', `${ws}px`);
      stageRef.current.style.setProperty('--d', `${d}px`);
    }
  };

  // Caption text swap animation
  const updateCaption = (book: Book, dir: number) => {
    if (!book) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const swapLine = (container: HTMLDivElement | null, newText: string, className = '') => {
      if (!container) return;
      const oldSpans = Array.from(container.children) as HTMLElement[];

      const newSpan = document.createElement('span');
      newSpan.className = className;
      newSpan.textContent = newText;
      newSpan.style.display = 'block';
      newSpan.style.width = '100%';
      newSpan.style.textAlign = 'center';

      if (reducedMotion) {
        container.innerHTML = '';
        container.appendChild(newSpan);
        return;
      }

      container.appendChild(newSpan);

      // Smart Animate: gentle crossfade with subtle directional drift
      newSpan.animate(
        [
          { opacity: 0, transform: `translateY(${dir * 5}px)` },
          { opacity: 1, transform: 'translateY(0px)' },
        ],
        {
          duration: 320,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          fill: 'both',
        }
      );

      // Fade out and gently drift existing spans
      oldSpans.forEach((oldSpan) => {
        oldSpan.style.position = 'absolute';
        oldSpan.style.top = '0';
        oldSpan.style.left = '0';
        oldSpan.style.width = '100%';
        const anim = oldSpan.animate(
          [
            { opacity: 1, transform: 'translateY(0px)' },
            { opacity: 0, transform: `translateY(${-dir * 5}px)` },
          ],
          {
            duration: 220,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            fill: 'both',
          }
        );
        anim.onfinish = () => {
          if (oldSpan.parentNode === container) {
            container.removeChild(oldSpan);
          }
        };
      });
    };

    swapLine(
      captionTitleMaskRef.current,
      book.title,
      'font-serif text-[32px] max-md:text-[22px] leading-[1.12] tracking-[-0.015em]'
    );
    swapLine(
      captionSubMaskRef.current,
      book.author.toUpperCase(),
      'lbl text-[var(--cobalt)] font-medium text-[10.5px]'
    );
    swapLine(
      captionMetaMaskRef.current,
      `★ ${book.rating.toFixed(1)} / 5.0 STARS`,
      'font-sans font-medium text-[11px] tracking-[0.08em] text-[var(--ink)] opacity-75'
    );
  };

  // Update genre tab indicator position
  const updateGenreIndicator = (genre: string) => {
    if (!tabIndicatorRef.current || !tabsContainerRef.current) return;
    const targetIdx = GENRE_FILTERS.findIndex((g) => g === genre);
    const activeBtn = tabButtonRefs.current[targetIdx >= 0 ? targetIdx : 0];
    if (activeBtn) {
      tabIndicatorRef.current.style.width = `${activeBtn.offsetWidth}px`;
      tabIndicatorRef.current.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }
  };

  // Open book detail view - guarantees the exact book chosen is displayed
  const triggerOpenBook = (targetBook?: Book) => {
    if (stateRef.current.isOpen) return;

    // Use passed book or determine from current center index
    const N = BOOKS.length;
    const centerIdx =
      selectedGenre === 'ALL'
        ? ((Math.round(stateRef.current.s) % N) + N) % N
        : Math.max(0, Math.min(filteredBooks.length - 1, Math.round(stateRef.current.s)));

    const bookToOpen =
      targetBook ||
      (selectedGenre === 'ALL' ? BOOKS[centerIdx] : filteredBooks[centerIdx]) ||
      BOOKS[0];
    if (!bookToOpen || !detailRef.current) return;

    // Set React state so the modal renders THIS EXACT book
    setOpenedBook(bookToOpen);
    stateRef.current.isOpen = true;

    // Get screen rect of the active book cover
    const repOffset = selectedGenre === 'ALL' ? BOOKS.length : 0;
    const shelfItemIdx = repOffset + centerIdx;
    const coverFace = coverFaceRefs.current[shelfItemIdx] || coverFaceRefs.current[centerIdx];
    let coverRect = coverFace?.getBoundingClientRect();
    if (!coverRect || coverRect.width === 0) {
      const W = window.innerWidth;
      const H = stateRef.current.H;
      const d = stateRef.current.d;
      const cy0 = window.innerHeight / 2;
      coverRect = {
        left: W / 2 - d / 2,
        top: cy0 - H / 2,
        right: W / 2 + d / 2,
        bottom: cy0 + H / 2,
        width: d,
        height: H,
        x: W / 2 - d / 2,
        y: cy0 - H / 2,
        toJSON: () => {},
      };
    }

    const W = window.innerWidth;
    const H_win = window.innerHeight;
    const originX = coverRect.left + coverRect.width / 2;
    const originY = coverRect.top + coverRect.height / 2;

    const dialog = detailRef.current;
    dialog.style.visibility = 'visible';
    dialog.style.transformOrigin = `${originX}px ${originY}px`;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      dialog.style.clipPath = 'none';
      dialog.style.transform = 'none';
      detailLinesRef.current.forEach((line) => {
        if (line) line.style.transform = 'translateY(0%)';
      });
      return;
    }

    // 1050ms Web Animations API expansion from the physical book
    const insetTop = Math.max(0, coverRect.top);
    const insetRight = Math.max(0, W - coverRect.right);
    const insetBottom = Math.max(0, H_win - coverRect.bottom);
    const insetLeft = Math.max(0, coverRect.left);

    if (detailSheetAnimRef.current) {
      detailSheetAnimRef.current.cancel();
    }

    const sheetAnim = dialog.animate(
      [
        {
          clipPath: `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px round 3px)`,
          transform: 'rotate(-4.5deg)',
        },
        {
          clipPath: 'inset(0px 0px 0px 0px round 0px)',
          transform: 'rotate(0deg)',
        },
      ],
      {
        duration: 1050,
        easing: 'cubic-bezier(.76,0,.18,1)',
        fill: 'both',
      }
    );
    detailSheetAnimRef.current = sheetAnim;

    // Text rises
    detailLinesRef.current.forEach((line, idx) => {
      if (!line) return;
      line.animate(
        [
          { transform: 'translateY(110%)' },
          { transform: 'translateY(0%)' },
        ],
        {
          duration: 900,
          delay: 550 + idx * 75,
          easing: 'cubic-bezier(.2,.8,.2,1)',
          fill: 'both',
        }
      );
    });
  };

  // Close detail view
  const closeDetail = () => {
    if (!stateRef.current.isOpen || !detailRef.current) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      stateRef.current.isOpen = false;
      detailRef.current.style.visibility = 'hidden';
      setOpenedBook(null);
      return;
    }

    const N = BOOKS.length;
    const centerIdx =
      selectedGenre === 'ALL'
        ? ((Math.round(stateRef.current.s) % N) + N) % N
        : Math.max(0, Math.min(filteredBooks.length - 1, Math.round(stateRef.current.s)));
    const repOffset = selectedGenre === 'ALL' ? BOOKS.length : 0;
    const shelfItemIdx = repOffset + centerIdx;
    const coverFace = coverFaceRefs.current[shelfItemIdx] || coverFaceRefs.current[centerIdx];
    let coverRect = coverFace?.getBoundingClientRect();
    if (!coverRect || coverRect.width === 0) {
      const W = window.innerWidth;
      const H = stateRef.current.H;
      const d = stateRef.current.d;
      const cy0 = window.innerHeight / 2;
      coverRect = {
        left: W / 2 - d / 2,
        top: cy0 - H / 2,
        right: W / 2 + d / 2,
        bottom: cy0 + H / 2,
        width: d,
        height: H,
        x: W / 2 - d / 2,
        y: cy0 - H / 2,
        toJSON: () => {},
      };
    }

    const W = window.innerWidth;
    const H_win = window.innerHeight;
    const insetTop = Math.max(0, coverRect.top);
    const insetRight = Math.max(0, W - coverRect.right);
    const insetBottom = Math.max(0, H_win - coverRect.bottom);
    const insetLeft = Math.max(0, coverRect.left);

    const dialog = detailRef.current;
    if (detailSheetAnimRef.current) {
      detailSheetAnimRef.current.cancel();
    }

    const closeAnim = dialog.animate(
      [
        {
          clipPath: 'inset(0px 0px 0px 0px round 0px)',
          transform: 'rotate(0deg)',
        },
        {
          clipPath: `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px round 3px)`,
          transform: 'rotate(-4.5deg)',
        },
      ],
      {
        duration: 850,
        easing: 'cubic-bezier(.76,0,.18,1)',
        fill: 'both',
      }
    );
    detailSheetAnimRef.current = closeAnim;

    closeAnim.onfinish = () => {
      dialog.style.visibility = 'hidden';
      stateRef.current.isOpen = false;
      setOpenedBook(null);
      closeAnim.cancel();
    };
  };

  // Jump to specific book index
  const jumpToBook = (targetBookIndex: number) => {
    if (selectedGenre === 'ALL') {
      const N = BOOKS.length;
      const currentMod = ((Math.round(stateRef.current.s) % N) + N) % N;
      let diff = targetBookIndex - currentMod;
      if (diff > N / 2) diff -= N;
      if (diff < -N / 2) diff += N;
      stateRef.current.T = Math.round(stateRef.current.s) + diff;
    } else {
      const clamped = Math.max(0, Math.min(filteredBooks.length - 1, targetBookIndex));
      stateRef.current.T = clamped;
    }
  };

  // Genre filter click:
  // "upon filter application, the relevant genre books will rearrange in the centre, to make flip easy.
  // also, the rest books will not flip or anything, the scroll will only last from the first book in the filtered genre to the last book"
  const handleGenreClick = (genre: string) => {
    setSelectedGenre(genre);
    updateGenreIndicator(genre);

    // Reset scroll to 0 (the first book of the filtered genre)
    stateRef.current.T = 0;
    stateRef.current.s = 0;
  };

  // Step left or right: infinite scroll for ALL, clamped for filtered genres
  const stepShelf = (delta: number) => {
    if (selectedGenre === 'ALL') {
      stateRef.current.T = Math.round(stateRef.current.T) + delta;
    } else {
      const nextT = Math.round(stateRef.current.T) + delta;
      stateRef.current.T = Math.max(0, Math.min(filteredBooks.length - 1, nextT));
    }
  };

  // Main 60fps RequestAnimationFrame Animation Loop
  useEffect(() => {
    updateDimensions();
    const handleResize = () => updateDimensions();
    window.addEventListener('resize', handleResize);

    // Set initial caption
    const initialBook = selectedGenre === 'ALL' ? BOOKS[0] : filteredBooks[0] || BOOKS[0];
    if (initialBook) {
      updateCaption(initialBook, 1);
    }
    updateGenreIndicator(selectedGenre);

    let lastTime = performance.now();
    let animId: number;

    const frameLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const st = stateRef.current;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // 1. Scroll bounding & Infinite wrapping
      const N = BOOKS.length;
      if (selectedGenre === 'ALL') {
        // Seamless infinite wrapping: when st.s exceeds N or drops below 0, wrap smoothly
        while (st.s >= N) {
          st.s -= N;
          st.T -= N;
        }
        while (st.s < 0) {
          st.s += N;
          st.T += N;
        }
      } else {
        // Filtered genre: clamp strictly to the books of this genre
        const maxIndex = Math.max(0, filteredBooks.length - 1);
        st.T = Math.max(0, Math.min(maxIndex, st.T));
      }

      // 2. Spring movement for scroll position s
      const k = reducedMotion ? 50 : st.isDragging ? 18 : 6.0;
      st.s += (st.T - st.s) * (1 - Math.exp(-k * dt));
      if (Math.abs(st.T - st.s) < 1e-4) {
        st.s = st.T;
      }

      // 3. Caption sync with gentle Smart Animate transition
      const activeIdx =
        selectedGenre === 'ALL'
          ? ((Math.round(st.s) % N) + N) % N
          : Math.max(0, Math.min(filteredBooks.length - 1, Math.round(st.s)));

      const activeBook = selectedGenre === 'ALL' ? BOOKS[activeIdx] : filteredBooks[activeIdx];
      if (activeIdx !== st.activeBookIndex && activeBook) {
        const dir = Math.sign(st.T - st.s) || 1;
        st.activeBookIndex = activeIdx;
        updateCaption(activeBook, dir);
      }

      // 4. Mouse pointer & Cursor smoothing
      const cursorLerp = 1 - Math.exp(-16 * dt);
      st.cx += (st.mx - st.cx) * cursorLerp;
      st.cy += (st.my - st.cy) * cursorLerp;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${st.cx}px, ${st.cy}px, 0)`;
      }

      // 5. Tilt calculation
      const onCover =
        Math.abs(st.mx - st.W / 2) < 0.55 * st.d &&
        Math.abs(st.my - st.cy0) < 0.55 * st.H &&
        !st.isOpen &&
        Math.abs(st.T - st.s) < 0.3;

      let targetTiltY = 0;
      let targetTiltX = 0;

      if (onCover) {
        targetTiltY = ((st.mx - st.W / 2) / (0.55 * st.d)) * 8;
        targetTiltX = -((st.my - st.cy0) / (st.H / 2)) * 5;
      } else {
        targetTiltY = ((st.mx - st.W / 2) / st.W) * 4;
        targetTiltX = 0;
      }

      const tiltLerp = 1 - Math.exp(-7 * dt);
      st.tiltY += (targetTiltY - st.tiltY) * tiltLerp;
      st.tiltX += (targetTiltX - st.tiltX) * tiltLerp;

      // 6. Update 3D books positioning on the shelf
      const W2 = st.W / 2;
      const cullingBound = W2 + 2.0 * st.d;

      // Scroll position within the rendered shelfItems array
      const repOffset = selectedGenre === 'ALL' ? BOOKS.length : 0;
      const scrollInShelf = repOffset + st.s;
      const sFloor = Math.max(0, Math.min(shelfItems.length - 2, Math.floor(scrollInShelf)));
      const sFrac = scrollInShelf - sFloor;
      const centerCum =
        cumOffsets.length > 0
          ? cumOffsets[sFloor] + (cumOffsets[sFloor + 1] - cumOffsets[sFloor]) * sFrac
          : 0;

      for (let v = 0; v < shelfItems.length; v++) {
        const bookEl = bookItemRefs.current[v];
        if (!bookEl) continue;

        const item = shelfItems[v];
        const book = item.book;
        const hFactor = book.heightFactor;
        const wFactor = book.widthFactor;
        const ws_item = st.ws * wFactor;
        const d_item = st.H * book.coverAspect; // natural uncropped cover width!
        const H_book = st.H * hFactor;

        // Relative index r from current continuous scroll position
        const r = v - scrollInShelf;

        // Smooth continuous expansion step B_r for open book clearance
        let B_r: number;
        if (Math.abs(r) < 1) {
          B_r = (r + Math.sin(Math.PI * r) / Math.PI) / 2;
        } else {
          B_r = Math.sign(r) * 0.5;
        }

        // Standing book packed offset: books sit flush against each other with tight 2px seams!
        // No artificial wide gaps between books on the right or left!
        const standingOffset = (cumOffsets[v] - centerCum) * (st.ws / 38);

        // Clearance for open center book cover
        const openClearance = (d_item - ws_item) / 2 + 14;
        const x = standingOffset + openClearance * B_r * 2;

        // Off-screen culling for high performance
        if (Math.abs(x) > cullingBound) {
          bookEl.style.visibility = 'hidden';
          continue;
        } else {
          bookEl.style.visibility = 'visible';
        }

        // Openness o
        const o = smoothstep(Math.max(0, 1 - Math.abs(r)));

        // Hover lift
        const isHovered = st.hoveredIndex === v && Math.abs(r) > 0.5;
        const targetLift = isHovered ? 1 : 0;
        const liftLerp = 1 - Math.exp(-12 * dt);
        st.lifts[v] = (st.lifts[v] || 0) + (targetLift - (st.lifts[v] || 0)) * liftLerp;
        const lift = st.lifts[v];

        // Bottom baseline alignment: books align flush on bottom shelf surface
        const baselineOffset = (st.H - H_book) / 2;
        const rotY = -90 * o + st.tiltY * o;
        const rotX = st.tiltX * o;
        const rotZ = -4.5 * o;
        const transZ = o * 0.22 * st.H;
        const transY = baselineOffset - o * 0.025 * st.H - lift * 0.045 * st.H;

        bookEl.style.transform = `translate3d(${x}px, ${transY}px, ${transZ}px) rotateZ(${rotZ}deg) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        bookEl.style.zIndex = `${Math.round(100 - Math.abs(r) * 4)}`;

        // Dynamic width & height on faces per book proportions
        const spineFace = spineFaceRefs.current[v];
        if (spineFace) {
          spineFace.style.width = `${ws_item}px`;
          spineFace.style.height = `${H_book}px`;
          spineFace.style.top = `${-H_book / 2}px`;
          spineFace.style.left = `${-ws_item / 2}px`;
          spineFace.style.transform = `translateZ(${d_item / 2}px)`;
          spineFace.style.setProperty('--shade', `${(o * 0.55).toFixed(3)}`);
        }

        // Cover Face (Right side when on shelf, physically turns to front when center)
        const coverFace = coverFaceRefs.current[v];
        if (coverFace) {
          coverFace.style.width = `${d_item}px`;
          coverFace.style.height = `${H_book}px`;
          coverFace.style.top = `${-H_book / 2}px`;
          coverFace.style.left = `${-d_item / 2}px`;
          coverFace.style.transform = `rotateY(90deg) translateZ(${ws_item / 2}px)`;
          coverFace.style.setProperty('--shade', `${((1 - o) * 0.5).toFixed(3)}`);
        }

        // Left Face (Fixes Request 3: Back cover & pages visible for books on the right side of shelf)
        const leftFace = leftFaceRefs.current[v];
        if (leftFace) {
          leftFace.style.width = `${d_item}px`;
          leftFace.style.height = `${H_book}px`;
          leftFace.style.top = `${-H_book / 2}px`;
          leftFace.style.left = `${-d_item / 2}px`;
          leftFace.style.transform = `rotateY(-90deg) translateZ(${ws_item / 2}px)`;
          leftFace.style.setProperty('--shade', `${(o * 0.55).toFixed(3)}`);
        }
      }

      // 7. Custom cursor class state determination
      if (cursorRef.current) {
        cursorRef.current.classList.remove('state-open', 'state-spine', 'state-btn');
        if (st.isOpen) {
          // Default cursor state while detail is open
        } else if (onCover) {
          cursorRef.current.classList.add('state-open');
        } else if (st.hoveredIndex !== -1) {
          cursorRef.current.classList.add('state-spine');
        }
      }

      animId = requestAnimationFrame(frameLoop);
    };

    animId = requestAnimationFrame(frameLoop);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [selectedGenre, filteredBooks, shelfItems, cumOffsets]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stateRef.current.isOpen) {
        closeDetail();
      } else if (e.key === 'ArrowLeft') {
        stepShelf(-1);
      } else if (e.key === 'ArrowRight') {
        stepShelf(1);
      } else if (e.key === 'Enter') {
        if (!stateRef.current.isOpen) {
          triggerOpenBook();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGenre, filteredBooks]);

  // Pointer move tracking for tilt & custom cursor
  const handlePointerMove = (e: React.PointerEvent) => {
    stateRef.current.mx = e.clientX;
    stateRef.current.my = e.clientY;
  };

  // Shelf Drag & Wheel Interaction Handlers with infinite horizontal scroll support
  const handleShelfPointerDown = (e: React.PointerEvent) => {
    if (stateRef.current.isOpen) return;
    stateRef.current.isDown = true;
    stateRef.current.isDragging = false;
    stateRef.current.hasMovedDuringDrag = false;
    stateRef.current.downX = e.clientX;
    stateRef.current.downY = e.clientY;
    stateRef.current.downTime = performance.now();
    stateRef.current.dragStartT = stateRef.current.T;
  };

  const handleShelfPointerMove = (e: React.PointerEvent) => {
    if (!stateRef.current.isDown) return;
    const dx = e.clientX - stateRef.current.downX;
    const dy = e.clientY - stateRef.current.downY;

    // Detect if this is genuinely a drag gesture
    if (!stateRef.current.isDragging && Math.hypot(dx, dy) > 5) {
      stateRef.current.isDragging = true;
      stateRef.current.hasMovedDuringDrag = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (stateRef.current.isDragging) {
      const unitDist = stateRef.current.ws + 2.0;
      const nextT = stateRef.current.dragStartT - dx / unitDist;
      if (selectedGenre === 'ALL') {
        // Infinite horizontal dragging
        stateRef.current.T = nextT;
      } else {
        // Bounded to filtered genre books
        stateRef.current.T = Math.max(0, Math.min(filteredBooks.length - 1, nextT));
      }
    }
  };

  const handleShelfPointerUp = (e: React.PointerEvent) => {
    if (!stateRef.current.isDown) return;
    const dx = e.clientX - stateRef.current.downX;
    const dy = e.clientY - stateRef.current.downY;
    const duration = performance.now() - stateRef.current.downTime;

    if (stateRef.current.isDragging) {
      stateRef.current.isDragging = false;
      if (selectedGenre === 'ALL') {
        stateRef.current.T = Math.round(stateRef.current.T);
      } else {
        stateRef.current.T = Math.max(
          0,
          Math.min(filteredBooks.length - 1, Math.round(stateRef.current.T))
        );
      }
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    } else if (Math.hypot(dx, dy) <= 6 && duration < 500) {
      // Tap / Click occurred! Check whether center active book was clicked
      const st = stateRef.current;
      const isCenterClick =
        Math.abs(e.clientX - st.W / 2) < 0.55 * st.d &&
        Math.abs(e.clientY - st.cy0) < 0.55 * st.H;

      if (isCenterClick) {
        triggerOpenBook();
      }
    }

    stateRef.current.isDown = false;
  };

  const handleShelfWheel = (e: React.WheelEvent) => {
    if (stateRef.current.isOpen) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const unitDist = stateRef.current.ws + 2.0;
    const nextT = stateRef.current.T + (delta / unitDist) * 0.45;
    if (selectedGenre === 'ALL') {
      stateRef.current.T = nextT;
    } else {
      stateRef.current.T = Math.max(0, Math.min(filteredBooks.length - 1, nextT));
    }

    if (stateRef.current.wheelTimer) {
      clearTimeout(stateRef.current.wheelTimer);
    }
    stateRef.current.wheelTimer = setTimeout(() => {
      if (selectedGenre === 'ALL') {
        stateRef.current.T = Math.round(stateRef.current.T);
      } else {
        stateRef.current.T = Math.max(
          0,
          Math.min(filteredBooks.length - 1, Math.round(stateRef.current.T))
        );
      }
    }, 160);
  };

  // Click handler specifically for a book on the shelf
  const handleBookTap = (itemIdx: number) => {
    if (stateRef.current.hasMovedDuringDrag) {
      stateRef.current.hasMovedDuringDrag = false;
      return;
    }
    const item = shelfItems[itemIdx];
    if (!item) return;

    const repOffset = selectedGenre === 'ALL' ? BOOKS.length : 0;
    const scrollInShelf = repOffset + stateRef.current.s;
    const r = itemIdx - scrollInShelf;

    // If it's the center book, open its exact review
    if (Math.abs(r) < 0.5) {
      triggerOpenBook(item.book);
    } else {
      // If clicking a side book, glide it to the center
      if (selectedGenre === 'ALL') {
        stateRef.current.T = Math.round(stateRef.current.T) + Math.round(r);
      } else {
        stateRef.current.T = Math.max(0, Math.min(filteredBooks.length - 1, itemIdx));
      }
    }
  };

  // Button hover for cursor
  const handleBtnEnter = () => {
    cursorRef.current?.classList.add('state-btn');
  };
  const handleBtnLeave = () => {
    cursorRef.current?.classList.remove('state-btn');
  };

  // Active book currently shown in review modal (or current center book)
  const currentCenterBook =
    selectedGenre === 'ALL'
      ? BOOKS[((Math.round(stateRef.current.s) % BOOKS.length) + BOOKS.length) % BOOKS.length] || BOOKS[0]
      : filteredBooks[Math.max(0, Math.min(filteredBooks.length - 1, Math.round(stateRef.current.s)))] ||
        filteredBooks[0] ||
        BOOKS[0];

  const bookInModal = openedBook || currentCenterBook;

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-[var(--paper)] text-[var(--ink)]"
      onPointerMove={handlePointerMove}
    >
      {/* Off-screen probe element to measure real rendered --H */}
      <div
        ref={probeRef}
        style={{ height: 'var(--H)', position: 'absolute', left: -9999, top: -9999, visibility: 'hidden' }}
      />

      {/* 1. Top Bar */}
      <header
        className="fixed top-0 left-0 right-0 h-[88px] max-md:h-[68px] px-[32px] max-md:px-[16px] flex justify-between items-center z-30 pointer-events-auto"
      >
        {/* Left: Title "BHUMZ'S LIBRARY" */}
        <div className="flex flex-col items-start justify-center text-[var(--ink)]">
          <div className="font-serif font-semibold text-[24px] max-md:text-[20px] tracking-tight leading-none text-left">
            bhumz's library
          </div>
        </div>

        {/* Far Right: "currently reading:" and book name + bookcover */}
        <div className="flex justify-end">
          <div
            onClick={() => {
              triggerOpenBook(currentlyReadingBook);
            }}
            onPointerEnter={handleBtnEnter}
            onPointerLeave={handleBtnLeave}
            className="flex items-center gap-2.5 p-1.5 pl-3 max-md:pl-2 rounded border border-[var(--rule)]/30 hover:border-[var(--cobalt)] transition-colors cursor-pointer group bg-white/60 backdrop-blur-xs shadow-2xs"
            title="View currently reading book details"
          >
            <div className="flex flex-col text-right">
              <span className="lbl text-[8px] max-md:text-[7.5px] text-[var(--cobalt)] font-bold tracking-wider">
                CURRENTLY READING:
              </span>
              <span className="font-serif text-[12px] max-md:text-[11px] font-medium line-clamp-1 max-w-[160px] max-md:max-w-[110px] text-[var(--ink)]">
                {currentlyReadingBook.title}
              </span>
            </div>

            {/* Miniature Original Bookcover thumbnail */}
            <div className="w-[28px] max-md:w-[22px] h-[40px] max-md:h-[32px] rounded-[1px] shadow-sm relative overflow-hidden group-hover:scale-105 transition-transform bg-slate-900 border border-black/20 shrink-0">
              <img
                src={getBookCoverUrl(currentlyReadingBook)}
                alt={currentlyReadingBook.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      {/* 2. Genre Filter Tabs:
          On mobile: individual pill buttons wrapped over the shelf (non-scrollable).
          On desktop: clean connected segmented control with sliding cobalt indicator. */}
      <nav
        aria-label="Book Genres"
        ref={tabsContainerRef}
        style={{
          top: 'calc(50% - var(--H) / 2 - 82px)',
        }}
        className="fixed left-1/2 -translate-x-1/2 z-30 pointer-events-auto md:flex md:items-center max-md:top-[calc(50%-var(--H)/2-84px)] max-md:w-[96vw] max-md:flex max-md:flex-wrap max-md:justify-center max-md:gap-1.5 max-md:overflow-visible"
      >
        {/* Sliding Cobalt Indicator Block (desktop segmented bar only) */}
        <div
          ref={tabIndicatorRef}
          className="max-md:hidden absolute left-0 top-0 h-[23px] bg-[var(--cobalt)] transition-all duration-[450ms] pointer-events-none rounded-[1px]"
          style={{
            transitionTimingFunction: 'var(--ease)',
          }}
        />

        {GENRE_FILTERS.map((genre, idx) => {
          const isSelected = selectedGenre === genre;
          return (
            <button
              key={genre}
              ref={(el) => {
                tabButtonRefs.current[idx] = el;
              }}
              onClick={() => handleGenreClick(genre)}
              onPointerEnter={handleBtnEnter}
              onPointerLeave={handleBtnLeave}
              className={`relative z-10 transition-all duration-[250ms] whitespace-nowrap ${
                isSelected
                  ? 'max-md:bg-[#1f32ae] max-md:text-[#dbdbdb] max-md:border-[#1f32ae] max-md:font-semibold'
                  : 'max-md:bg-white/80 max-md:text-[var(--ink)] max-md:border-[var(--rule)]/40 hover:max-md:border-[var(--cobalt)]'
              } max-md:rounded-full max-md:border max-md:px-2.5 max-md:py-1 max-md:h-auto max-md:text-[9.5px] max-md:leading-none max-md:shadow-2xs md:box md:lbl md:text-[10px] md:px-[11px] md:h-[23px] md:-ml-[1px] md:first:ml-0 ${
                isSelected ? 'md:text-white md:font-bold' : 'md:text-[var(--ink)] hover:md:text-[var(--cobalt)]'
              }`}
            >
              {genre}
            </button>
          );
        })}
      </nav>

      {/* 3. The Shelf (3D Stage) */}
      <section
        aria-label="Bookshelf"
        ref={shelfRef}
        onPointerDown={handleShelfPointerDown}
        onPointerMove={handleShelfPointerMove}
        onPointerUp={handleShelfPointerUp}
        onWheel={handleShelfWheel}
        className="shelf-viewport"
      >
        <div ref={stageRef} className="stage-origin">
          {shelfItems.map((item, v) => {
            const book = item.book;
            return (
              <div
                key={item.key}
                ref={(el) => {
                  bookItemRefs.current[v] = el;
                }}
                onClick={() => handleBookTap(v)}
                onPointerEnter={() => {
                  stateRef.current.hoveredIndex = v;
                }}
                onPointerLeave={() => {
                  if (stateRef.current.hoveredIndex === v) {
                    stateRef.current.hoveredIndex = -1;
                  }
                }}
                className="tape-item"
              >
                {/* Spine Face - Authentic book spine with true width and height */}
                <div
                  ref={(el) => {
                    spineFaceRefs.current[v] = el;
                  }}
                  className="tape-face tape-spine cursor-pointer"
                >
                  <BookSpineFace book={book} />
                </div>

                {/* Cover Face - Center book opens to front cover without overlap */}
                <div
                  ref={(el) => {
                    coverFaceRefs.current[v] = el;
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerOpenBook(book);
                  }}
                  className="tape-face tape-cover cursor-pointer"
                >
                  <BookCoverFace book={book} />
                </div>

                {/* Left Face - Back cover & pages (ensures books on the right have identical 3D realism) */}
                <div
                  ref={(el) => {
                    leftFaceRefs.current[v] = el;
                  }}
                  className="tape-face tape-left pointer-events-none"
                >
                  <BookLeftFace book={book} />
                </div>

                {/* Top Face - Top page edges block */}
                <div className="tape-face tape-top pointer-events-none" />
              </div>
            );
          })}
        </div>

        {/* Shelf Base Line / Wooden Shelf Surface */}
        <div
          className="absolute left-0 right-0 h-[9px] bg-gradient-to-b from-[#2D1E18] to-[#1A110E] shadow-[0_5px_15px_rgba(0,0,0,0.4)] pointer-events-none"
          style={{
            top: 'calc(50% + var(--H) / 2)',
          }}
        />
      </section>

      {/* 5. Caption */}
      <div
        aria-live="polite"
        style={{
          top: 'calc(50% + var(--H) / 2 + 30px)',
        }}
        className="fixed left-0 right-0 flex flex-col items-center gap-[6px] pointer-events-none z-20"
      >
        {/* Title masked line */}
        <div
          ref={captionTitleMaskRef}
          className="relative overflow-hidden w-[min(92vw,760px)] h-[40px] max-md:h-[30px] flex items-center justify-center text-center"
        >
          <span className="font-serif text-[32px] max-md:text-[22px] leading-[1.12] tracking-[-0.015em]">
            {currentCenterBook?.title || ''}
          </span>
        </div>

        {/* Subtitle masked line */}
        <div
          ref={captionSubMaskRef}
          className="relative overflow-hidden w-[min(92vw,760px)] h-[18px] flex items-center justify-center text-center"
        >
          <span className="lbl text-[var(--cobalt)] font-medium text-[10.5px]">
            {currentCenterBook ? currentCenterBook.author.toUpperCase() : ''}
          </span>
        </div>

        {/* Meta & Rating masked line */}
        <div
          ref={captionMetaMaskRef}
          className="relative overflow-hidden w-[min(92vw,760px)] h-[18px] flex items-center justify-center text-center"
        >
          <span className="font-sans font-medium text-[11px] tracking-[0.08em] text-[var(--ink)] opacity-75">
            {currentCenterBook
              ? `★ ${currentCenterBook.rating.toFixed(1)} / 5.0 STARS`
              : ''}
          </span>
        </div>
      </div>

      {/* 6. Arrows */}
      <div
        style={{
          top: 'calc(50% + var(--H) / 2 + 40px)',
        }}
        className="fixed left-0 right-0 pointer-events-none z-20"
      >
        <button
          onClick={() => stepShelf(-1)}
          onPointerEnter={handleBtnEnter}
          onPointerLeave={handleBtnLeave}
          aria-label="Previous book"
          className="absolute left-[20px] max-md:left-[6px] -translate-y-1/2 w-[44px] h-[44px] flex items-center justify-center text-[var(--ink)] hover:text-[var(--cobalt)] pointer-events-auto transition-colors"
        >
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M5 1 L1 5 L5 9" />
            <path d="M1 5 L17 5" />
          </svg>
        </button>

        <button
          onClick={() => stepShelf(1)}
          onPointerEnter={handleBtnEnter}
          onPointerLeave={handleBtnLeave}
          aria-label="Next book"
          className="absolute right-[20px] max-md:right-[6px] -translate-y-1/2 w-[44px] h-[44px] flex items-center justify-center text-[var(--ink)] hover:text-[var(--cobalt)] pointer-events-auto transition-colors"
        >
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M13 1 L17 5 L13 9" />
            <path d="M17 5 L1 5" />
          </svg>
        </button>
      </div>

      {/* Paper Grain Overlay */}
      <div
        className="paper-grain"
        style={{
          backgroundImage: `url("${GRAIN_DATA_URI}")`,
        }}
      />

      {/* Custom Cursor */}
      <div ref={cursorRef} className="custom-cursor">
        <div className="cursor-ring" />
        <div className="cursor-dot" />
        <div className="cursor-label">
          <span>OPEN</span>
        </div>
      </div>

      {/* Detail Dialog - Book Opening Paper Sheet */}
      <div
        ref={detailRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${bookInModal.title} Book Review`}
        style={{
          visibility: 'hidden',
          backgroundColor: 'var(--sheet)',
        }}
        className="fixed inset-0 z-[60] overflow-y-auto"
      >
        {/* Detail Top Bar */}
        <div className="sticky top-0 left-0 right-0 h-[84px] max-md:h-[64px] px-[32px] max-md:px-[16px] grid grid-cols-[1fr_auto_1fr] items-center z-20 bg-[var(--sheet)]/90 backdrop-blur-xs">
          <div className="flex justify-start">
            <button
              onClick={closeDetail}
              onPointerEnter={handleBtnEnter}
              onPointerLeave={handleBtnLeave}
              className="box lbl hover:opacity-75 transition-opacity"
              aria-label="Close book details"
            >
              CLOSE
            </button>
          </div>

          <div className="flex flex-col items-center justify-center gap-[4px] text-[var(--ink)]">
            <div className="font-serif font-semibold text-[20px] max-md:text-[16px] tracking-tight leading-none">
              bhumz's library
            </div>
            <div className="font-sans font-semibold text-[8px] tracking-[0.24em] pl-[0.24em] uppercase opacity-65">
              BOOKCLUB REVIEW & RATING
            </div>
          </div>

          <div className="flex justify-end" />
        </div>

        {/* Detail Body Content Grid */}
        <div className="min-h-[calc(100%-84px)] w-full grid grid-cols-1 md:grid-cols-2 gap-[4vw] max-md:gap-[24px] px-[7vw] max-md:px-[22px] pt-[28px] max-md:pt-[16px] pb-[56px] max-md:pb-[40px] items-center">
          {/* Left Column: Masked lines for book info & review */}
          <div className="flex flex-col gap-[20px] max-w-[540px] max-md:order-2 justify-center">
            {/* 0. Title */}
            <div className="overflow-hidden">
              <div
                ref={(el) => {
                  detailLinesRef.current[0] = el;
                }}
                className="font-serif text-[clamp(36px,4.5vw,68px)] max-md:text-[30px] leading-[1.05] tracking-[-0.025em] font-medium"
              >
                {bookInModal.title}
              </div>
            </div>

            {/* 1. Author byline & Star Rating */}
            <div className="overflow-hidden">
              <div
                ref={(el) => {
                  detailLinesRef.current[1] = el;
                }}
                className="flex items-center gap-4 flex-wrap"
              >
                <span className="font-serif italic text-[18px] text-[var(--muted)]">
                  by {bookInModal.author}
                </span>
                <span className="w-[1px] h-[14px] bg-[var(--rule)]/30" />
                <div className="flex items-center gap-2">
                  {renderStars(bookInModal.rating)}
                  <span className="lbl text-[11px] font-bold text-amber-700">
                    {bookInModal.rating.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Bhumz's Review Card */}
            <div className="overflow-hidden">
              <div
                ref={(el) => {
                  detailLinesRef.current[2] = el;
                }}
                className="bg-white/80 border border-[#D9D5CC] rounded p-6 relative shadow-xs"
              >
                <div className="flex items-center justify-between mb-3 border-b border-[#ECE8DF] pb-2">
                  <span className="lbl text-[9.5px] text-[var(--cobalt)] font-bold tracking-widest">
                    BHUMZ'S REVIEW
                  </span>
                  <span className="text-[12px] text-amber-500 font-bold">
                    {'★'.repeat(Math.floor(bookInModal.rating))}
                    {bookInModal.rating % 1 !== 0 && '½'}
                  </span>
                </div>
                <p className="font-serif italic text-[18px] max-md:text-[16px] leading-[1.55] text-[var(--ink)]">
                  "{bookInModal.review}"
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Full Original Book Cover without cropping */}
          <div className="flex items-center justify-center max-md:order-1 h-full">
            <div className="w-full max-w-[430px] max-h-[76vh] max-md:h-[48svh] flex items-center justify-center">
              <div
                className="relative rounded-[3px] overflow-hidden shadow-2xl border border-black/10 bg-stone-900"
                style={{
                  aspectRatio: `${bookInModal.coverAspect} / 1`,
                  maxHeight: '76vh',
                  width: 'auto',
                  height: '100%',
                }}
              >
                <img
                  src={getBookCoverUrl(bookInModal)}
                  alt={bookInModal.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-fill object-center"
                />
                {/* Book Hinge / Left Spine Crease highlight */}
                <div className="absolute left-[14px] top-0 bottom-0 w-[1.5px] bg-black/40 shadow-[1px_0_0_rgba(255,255,255,0.15)] pointer-events-none" />
                {/* Subtle paper finish */}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-white/10 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
