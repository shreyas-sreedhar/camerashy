'use client';

import {
  useState, useEffect, useRef,
  type ReactNode, type CSSProperties, type MouseEvent, type DragEvent,
} from 'react';
import { subscribe, mountPrintStyle, unmountPrintStyle, SIGNALS_FOR } from './core';
import type { Sensitivity, ShieldSignal } from './core';

// ---------------------------------------------------------------------------
// useScreenshotDetection
// ---------------------------------------------------------------------------

export interface UseScreenshotDetectionOptions {
  sensitivity?:  Sensitivity;
  onDetection?:  () => void;
}

export function useScreenshotDetection(opts: UseScreenshotDetectionOptions = {}): boolean {
  const { sensitivity = 'balanced', onDetection } = opts;
  const [shielded, setShielded]   = useState(false);
  const onDetectionRef            = useRef(onDetection);
  onDetectionRef.current          = onDetection;

  useEffect(() => {
    const allowed = SIGNALS_FOR[sensitivity] ?? SIGNALS_FOR['balanced'];
    return subscribe(
      (signal: ShieldSignal) => {
        if (!allowed.includes(signal)) return;
        setShielded(true);
        onDetectionRef.current?.();
      },
      () => setShielded(false),
    );
  }, [sensitivity]);

  return shielded;
}

// ---------------------------------------------------------------------------
// CameraShy component
// ---------------------------------------------------------------------------

interface BaseProps {
  children:             ReactNode;
  sensitivity?:         Sensitivity;
  onDetection?:         () => void;
  blockContextMenu?:    boolean;
  blockDrag?:           boolean;
  transitionDuration?:  string;
  className?:           string;
  style?:               CSSProperties;
}

interface HideProps    extends BaseProps { mode?: 'hide';    blur?: never; replacement?: never; }
interface BlurProps    extends BaseProps { mode:  'blur';    blur?: string; replacement?: never; }
interface ReplaceProps extends BaseProps { mode:  'replace'; replacement: ReactNode; blur?: never; }

export type CameraShyProps = HideProps | BlurProps | ReplaceProps;

export function CameraShy({
  children,
  mode                = 'hide',
  blur                = '12px',
  replacement,
  sensitivity         = 'balanced',
  onDetection,
  blockContextMenu    = true,
  blockDrag           = true,
  transitionDuration  = '0.15s',
  className,
  style,
}: CameraShyProps & { blur?: string; replacement?: ReactNode }) {
  const shielded = useScreenshotDetection({ sensitivity, onDetection });

  useEffect(() => { mountPrintStyle(); return unmountPrintStyle; }, []);

  const onContext = (e: MouseEvent)  => { if (blockContextMenu) e.preventDefault(); };
  const onDrag    = (e: DragEvent)   => { if (blockDrag)        e.preventDefault(); };
  const base      = `cs-content${className ? ` ${className}` : ''}`;

  // --- hide ---
  if (mode === 'hide') {
    return (
      <span
        className={base}
        style={{ visibility: shielded ? 'hidden' : 'visible', display: 'inline-block', ...style }}
        onContextMenu={onContext}
        onDragStart={onDrag}
        aria-hidden={shielded}
      >
        {children}
      </span>
    );
  }

  // --- blur ---
  if (mode === 'blur') {
    return (
      <span
        className={base}
        style={{
          filter:          shielded ? `blur(${blur})` : 'none',
          transition:      shielded ? 'none' : `filter ${transitionDuration} ease-in-out`,
          display:         'inline-block',
          userSelect:      shielded ? 'none' : undefined,
          WebkitUserSelect: shielded ? 'none' : undefined,
          ...style,
        }}
        onContextMenu={onContext}
        onDragStart={onDrag}
        aria-hidden={shielded}
      >
        {children}
      </span>
    );
  }

  // --- replace ---
  return (
    <span
      className={base}
      style={{ position: 'relative', display: 'inline-block', ...style }}
      onContextMenu={onContext}
      onDragStart={onDrag}
      aria-hidden={shielded}
    >
      <span style={{ visibility: shielded ? 'hidden' : 'visible' }}>
        {children}
      </span>
      {shielded && (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {replacement}
        </span>
      )}
    </span>
  );
}

export default CameraShy;