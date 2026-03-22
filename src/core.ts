export type ShieldMode = 'hide' | 'blur' | 'replace';
export type Sensitivity = 'relaxed' | 'balanced' | 'paranoid';

// combo      — full confirmed shortcut (PrintScreen, Win+Shift+S). Works on Windows.
//              On mac, the OS swallows the digit key so this rarely fires in a browser.
// preemptive — Cmd+Shift held without a third key yet. The only reliable mac signal.
// blur       — window lost focus shortly after a modifier (screenshare / paranoid use).
export type ShieldSignal = 'combo' | 'preemptive' | 'blur';

export const SIGNALS_FOR: Record<Sensitivity, ShieldSignal[]> = {
  relaxed:  ['combo'],
  balanced: ['combo', 'preemptive'],
  paranoid: ['combo', 'preemptive', 'blur'],
} as const;

export interface CameraShyOptions {
  mode?:               ShieldMode;
  /** Blur radius when mode is 'blur'. Default: '12px' */
  blur?:               string;
  /** Replacement element/image URL when mode is 'replace'. */
  replacement?:        string;
  sensitivity?:        Sensitivity;
  onDetection?:        () => void;
  blockContextMenu?:   boolean;
  blockDrag?:          boolean;
  /** Fade-in duration when unshielding. Default: '0.15s' */
  transitionDuration?: string;
}

// ---------------------------------------------------------------------------
// Global event bus — one set of DOM listeners shared across all instances
// ---------------------------------------------------------------------------

type Subscriber = {
  onShield:   (signal: ShieldSignal) => void;
  onUnshield: () => void;
};

const subscribers  = new Set<Subscriber>();
let lastModifierAt = 0;
let attached       = false;

function emit(signal: ShieldSignal) { subscribers.forEach(s => s.onShield(signal)); }
function emitUnshield()             { subscribers.forEach(s => s.onUnshield()); }

function onKeyDown(e: KeyboardEvent) {
  const isCombo =
    (e.metaKey && e.shiftKey && ['Digit3', 'Digit4', 'Digit5', 'KeyS'].includes(e.code)) ||
    (e.ctrlKey && e.shiftKey && e.code === 'KeyS') ||  // Win+Shift+S
    e.code === 'PrintScreen';

  if (isCombo) { emit('combo'); return; }

  // macOS swallows the digit key before the browser sees it —
  // so Cmd+Shift alone is the only signal we get for mac screenshots.
  if (e.metaKey && e.shiftKey) { emit('preemptive'); return; }

  if (e.metaKey || e.shiftKey || e.code === 'PrintScreen') lastModifierAt = Date.now();
}

let unshieldTimer: ReturnType<typeof setTimeout> | null = null;

function onKeyUp(e: KeyboardEvent) {
  // unshield as soon as both Cmd and Shift are no longer held
  if (!e.metaKey && !e.shiftKey) {
    // delay gives macOS screenshot UI time to capture before content reappears
    if (unshieldTimer) clearTimeout(unshieldTimer);
    unshieldTimer = setTimeout(() => {
      unshieldTimer = null;
      emitUnshield();
    }, 1200);
  }
}
function onBlur()       { if (Date.now() - lastModifierAt < 400) emit('blur'); }
function onFocus()      { emitUnshield(); }
function onVisibility() { if (document.visibilityState !== 'hidden') emitUnshield(); }

function attach() {
  if (attached) return; attached = true;
  window.addEventListener('keydown',            onKeyDown,      true);
  window.addEventListener('keyup',              onKeyUp,        true);
  window.addEventListener('blur',               onBlur);
  window.addEventListener('focus',              onFocus);
  document.addEventListener('visibilitychange', onVisibility);
}

function detach() {
  if (!attached) return; attached = false;
  window.removeEventListener('keydown',            onKeyDown,      true);
  window.removeEventListener('keyup',              onKeyUp,        true);
  window.removeEventListener('blur',               onBlur);
  window.removeEventListener('focus',              onFocus);
  document.removeEventListener('visibilitychange', onVisibility);
}

export function subscribe(
  onShield:   (signal: ShieldSignal) => void,
  onUnshield: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const sub = { onShield, onUnshield };
  subscribers.add(sub);
  if (subscribers.size === 1) attach();
  return () => {
    subscribers.delete(sub);
    if (subscribers.size === 0) detach();
  };
}

// ---------------------------------------------------------------------------
// Print style — blurs content in print/PDF export (ref-counted singleton)
// ---------------------------------------------------------------------------

const PRINT_ID  = 'camerashy-print';
const PRINT_CSS = '@media print { .cs-content { filter: blur(20px) !important; visibility: hidden !important; } }';
let printRefs   = 0;

export function mountPrintStyle() {
  if (typeof document === 'undefined' || ++printRefs > 1) return;
  if (document.getElementById(PRINT_ID)) return;
  const s = document.createElement('style');
  s.id          = PRINT_ID;
  s.textContent = PRINT_CSS;
  document.head.appendChild(s);
}

export function unmountPrintStyle() {
  if (typeof document === 'undefined') return;
  printRefs = Math.max(0, printRefs - 1);
  if (printRefs > 0) return;
  document.getElementById(PRINT_ID)?.remove();
}

// ---------------------------------------------------------------------------
// cameraShy() — vanilla JS API
// ---------------------------------------------------------------------------

export function cameraShy(el: HTMLElement, opts: CameraShyOptions = {}): () => void {
  if (typeof window === 'undefined') return () => {};

  const {
    mode                = 'hide',
    blur                = '12px',
    replacement,
    sensitivity         = 'balanced',
    onDetection,
    blockContextMenu    = true,
    blockDrag           = true,
    transitionDuration  = '0.15s',
  } = opts;

  const allowed = SIGNALS_FOR[sensitivity];
  let shielded  = false;
  let overlay: HTMLDivElement | null = null;

  el.classList.add('cs-content');
  mountPrintStyle();

  function shield() {
    if (shielded) return;
    shielded = true;
    onDetection?.();

    if (mode === 'hide') {
      el.style.visibility = 'hidden';

    } else if (mode === 'blur') {
      el.style.transition = 'none';
      el.style.filter     = `blur(${blur})`;
      el.style.userSelect = 'none';

    } else if (mode === 'replace') {
      if (!overlay) {
        overlay = document.createElement('div');
        Object.assign(overlay.style, {
          position:        'absolute',
          inset:           '0',
          backgroundImage: replacement ? `url(${replacement})` : 'none',
          backgroundColor: replacement ? 'transparent' : '#000',
          backgroundSize:  'cover',
          zIndex:          '9999',
          pointerEvents:   'none',
        });
      }
      el.style.position = el.style.position || 'relative';
      el.appendChild(overlay);
    }
  }

  function unshield() {
    if (!shielded) return;
    shielded = false;

    if (mode === 'hide') {
      el.style.visibility = '';

    } else if (mode === 'blur') {
      el.style.transition = `filter ${transitionDuration} ease-in-out`;
      el.style.filter     = 'none';
      el.style.userSelect = '';

    } else if (mode === 'replace') {
      overlay?.parentNode?.removeChild(overlay);
    }
  }

  const stopContext = (e: Event) => { if (blockContextMenu) e.preventDefault(); };
  const stopDrag    = (e: Event) => { if (blockDrag)        e.preventDefault(); };
  el.addEventListener('contextmenu', stopContext);
  el.addEventListener('dragstart',   stopDrag);

  const unsub = subscribe(
    signal => { if (allowed.includes(signal)) shield(); },
    ()     => unshield(),
  );

  return () => {
    unsub();
    unshield();
    unmountPrintStyle();
    el.classList.remove('cs-content');
    el.removeEventListener('contextmenu', stopContext);
    el.removeEventListener('dragstart',   stopDrag);
    overlay?.parentNode?.removeChild(overlay);
  };
}