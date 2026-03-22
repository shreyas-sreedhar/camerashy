# camerashy

Lightweight screenshot detection and visual shielding for sensitive UI content. Framework-agnostic core with a first-class React wrapper.

- Zero dependencies in the core — works with vanilla JS, Svelte, Vue, Angular, or anything
- React wrapper with `<CameraShy>` component and `useScreenshotDetection` hook
- Three shield modes: **hide**, **blur**, **replace**
- Three sensitivity levels: **relaxed**, **balanced**, **paranoid**
- SSR-safe — no-op on server, activates on client
- Single global event bus — efficient even with hundreds of shielded elements
- Under 1 KB gzipped (core)
- This feature is intended for visual deterrence only and should not be considered a replacement for true security or encryption. It is primarily for privacy and presentation, and determined attackers may still bypass it.

**Live demo:** [camerashy.xyz](https://camerashy.xyz) — open the site and try a screenshot shortcut to see shielding in action.

## Install

```bash
npm install camerashy
```

## Quick Start (React)

Wrap sensitive content with `<CameraShy>` — that's it.

```tsx
import { CameraShy } from 'camerashy';

function Dashboard() {
  return (
    <p>
      Account balance:{' '}
      <CameraShy>$42,069.00</CameraShy>
    </p>
  );
}
```

The default mode is `'hide'` — content disappears the moment a screenshot shortcut is detected and reappears when the window regains focus.

## Quick Start (Vanilla JS)

No framework needed. Import from `camerashy/core`:

```js
import { cameraShy } from 'camerashy/core';

const el = document.getElementById('secret');
const cleanup = cameraShy(el, {
  mode: 'blur',
  blur: '15px',
  onDetection: () => console.log('screenshot attempt!'),
});

// Later, to remove all listeners and styles:
cleanup();
```

## Shield Modes

### Hide (default)

Instantly sets `visibility: hidden` on the element — the content disappears without a layout shift.

```tsx
<CameraShy mode="hide">$142,000</CameraShy>
```

### Blur

Applies a CSS blur filter over the content.

```tsx
<CameraShy mode="blur" blur="15px">
  $142,000
</CameraShy>
```

### Replace

Swaps content with any React node — an icon, message, placeholder image, anything.

```tsx
<CameraShy mode="replace" replacement={<span>🔒 Hidden</span>}>
  $142,000
</CameraShy>
```

## Next.js Server Components

`CameraShy` uses the `'use client'` directive internally, so you can import it directly in Server Components. Children remain server-rendered.

```tsx
// app/dashboard/page.tsx — Server Component
import { CameraShy } from 'camerashy';

export default async function DashboardPage() {
  const { salary } = await db.query('SELECT salary FROM employees WHERE id = $1', [userId]);

  return (
    <p>
      Annual salary:{' '}
      <CameraShy mode="blur" blur="15px">{salary}</CameraShy>
    </p>
  );
}
```

## `useScreenshotDetection` Hook

For fully custom UI, use the hook directly without the component wrapper:

```tsx
import { useScreenshotDetection } from 'camerashy';

function SecretPanel() {
  const isShielded = useScreenshotDetection({
    sensitivity: 'balanced',
    onDetection: () => analytics.track('screenshot_attempt', { page: 'billing' }),
  });

  return (
    <div style={{ opacity: isShielded ? 0 : 1 }}>
      Top secret content
    </div>
  );
}
```

## Sensitivity Levels

Control how aggressively capture attempts are detected. Default is `"balanced"`.

| Level | Triggers on | Best for |
| --- | --- | --- |
| `paranoid` | Cmd+Shift alone (pre-emptive) + confirmed combos + window blur | Maximum protection; may false-positive on other Cmd+Shift shortcuts |
| `balanced` | Confirmed key combos + pre-emptive Cmd+Shift | Most apps — good protection, minimal false positives |
| `relaxed` | Confirmed key combos only (PrintScreen, Cmd+Shift+3/4/5, Win+Shift+S) | Apps where users frequently use Cmd+Shift for other things |

```tsx
<CameraShy sensitivity="relaxed">$142,000</CameraShy>
```

## Analytics Patterns

The `onDetection` callback fires on every confirmed detection. Use it to track screenshot behaviour as a product signal:

```tsx
<CameraShy
  sensitivity="balanced"
  onDetection={() =>
    analytics.track('screenshot_attempt', {
      page: 'billing',
      component: 'salary_field',
    })
  }
>
  {salary}
</CameraShy>
```

## What It Protects Against

| Threat | Protection |
| --- | --- |
| macOS screenshots (Cmd+Shift+3/4/5) | Shields on key combo + pre-emptive Cmd+Shift detection |
| Windows PrintScreen / Win+Shift+S | Shields on PrintScreen key + window blur heuristic |
| Browser print / Cmd+P | CSS `@media print` hides content |
| Right-click > Save image | Context menu blocked (configurable) |
| Drag-to-desktop | Drag events blocked (configurable) |
| Tab switching after shortcut | `visibilitychange` detection |

> **Honest disclaimer:** This is a *visual* deterrent. A determined user can still inspect the DOM, read network responses, or use OS-level capture tools that bypass browser events. This protects against casual shoulder-surfing and quick screenshots — not forensic extraction.

## API Reference

### `cameraShy(element, options?)` — Vanilla JS

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `'hide' \| 'blur' \| 'replace'` | `'hide'` | Shield mode |
| `blur` | `string` | `"12px"` | Blur radius (blur mode only) |
| `replacement` | `string` | — | Image URL for the overlay (replace mode only) |
| `sensitivity` | `'relaxed' \| 'balanced' \| 'paranoid'` | `'balanced'` | Detection aggressiveness |
| `onDetection` | `() => void` | — | Callback fired on each detection |
| `blockContextMenu` | `boolean` | `true` | Block right-click context menu |
| `blockDrag` | `boolean` | `true` | Block drag events |
| `transitionDuration` | `string` | `"0.15s"` | Unshield fade-in duration |

Returns a cleanup function that removes all listeners and restores the element.

### `<CameraShy>` — React Component

All options from the vanilla API, plus:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | — | Content to protect |
| `replacement` | `ReactNode` | — | Replacement content shown while shielded (replace mode) |
| `className` | `string` | — | Additional CSS class |
| `style` | `CSSProperties` | — | Additional inline styles |

> **Note:** In the React component `replacement` accepts any `ReactNode`. In the vanilla JS `cameraShy()` it accepts an image URL string.

### `useScreenshotDetection(options?)` — React Hook

```tsx
useScreenshotDetection({
  sensitivity?: 'relaxed' | 'balanced' | 'paranoid', // default: 'balanced'
  onDetection?: () => void,
}): boolean
```

Returns `true` when shielded, `false` otherwise.

## Low-level Subscription

For power users who want raw access to shield/unshield events:

```ts
import { subscribe } from 'camerashy/core';

const unsub = subscribe(
  (signal) => console.log('shield triggered:', signal), // 'combo' | 'preemptive' | 'blur'
  ()       => console.log('unshielded'),
);

// Cleanup
unsub();
```

`subscribe()` is a no-op on the server.

## Package Exports

| Import path | What you get | Needs React? |
| --- | --- | --- |
| `camerashy` | Everything (core + React) | Yes |
| `camerashy/core` | `cameraShy()`, `subscribe()`, `mountPrintStyle()`, `unmountPrintStyle()`, types | No |
| `camerashy/react` | `<CameraShy>`, `useScreenshotDetection` | Yes |

## How It Works

1. **Global event bus** — A single set of `keydown`/`blur`/`focus`/`visibilitychange` listeners shared across all instances via a subscribe/unsubscribe pattern. Auto-mounts on first subscriber, auto-cleans on last.

2. **Screenshot key detection** — Uses `e.code` (not `e.key`) to correctly detect Cmd+Shift+3/4/5, PrintScreen, and Win+Shift+S regardless of keyboard layout.

3. **Pre-emptive Cmd+Shift shield** — macOS swallows the digit keydown for system screenshots, so in `balanced` and `paranoid` modes content shields as soon as Cmd+Shift is held. `relaxed` skips this to reduce false positives.

4. **Instant shield, smooth unshield** — Shield applies with no CSS transition (zero delay before the OS captures). Unshield animates smoothly via `transitionDuration`.

5. **Window blur heuristic** — If the window loses focus within 400ms of a modifier key press, it's likely a screenshot tool stealing focus. Only active in `paranoid` mode.

6. **Print protection** — A ref-counted singleton `<style>` tag injects `@media print` rules that hide `.cs-content` elements.

7. **Auto-recovery** — Content unshields when the window regains focus or the tab becomes visible again.

## License

MIT
