'use client';

import { MapPin, Send, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { CommentWithAuthor } from '@/lib/comments';

export interface PinDraft {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

const DRAG_THRESHOLD_MOUSE = 4;
const DRAG_THRESHOLD_TOUCH = 8;
const PIN_SIZE = 26;

const COMMENT_CURSOR_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="36" viewBox="0 0 32 36" fill="none"><g filter="url(#s)"><path d="M4 6a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-7.172L12 26.828V22H8a4 4 0 0 1-4-4V6z" fill="white"/><path d="M4 6a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-7.172L12 26.828V22H8a4 4 0 0 1-4-4V6z" stroke="black" stroke-opacity="0.08" stroke-width="0.75"/></g><line x1="11" y1="12" x2="21" y2="12" stroke="black" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="7" x2="16" y2="17" stroke="black" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round"/><defs><filter id="s" x="1" y="0" width="30" height="32" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0"/><feOffset dy="1.5"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>`)}`;

export function PinOverlay({
  children,
  comments,
  activeCommentId,
  onPinPlace,
  onPinClick,
  readOnly = false,
}: {
  children: ReactNode;
  comments: CommentWithAuthor[];
  activeCommentId: string | null;
  onPinPlace: (pin: PinDraft) => void;
  onPinClick: (commentId: string) => void;
  readOnly?: boolean;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [dragState, setDragState] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    pointerType: string;
    isDragging: boolean;
  } | null>(null);
  const pinnedComments = useMemo(
    () => comments.filter((c) => c.pin_x != null && c.pin_y != null && !c.parent_id),
    [comments],
  );

  const pinNumbers = useMemo(() => {
    const map = new Map<string, number>();
    pinnedComments
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .forEach((c, i) => map.set(c.id, i + 1));
    return map;
  }, [pinnedComments]);

  const toNormalized = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return null;
      return { x, y };
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (readOnly) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-pin-marker]')) return;

      const norm = toNormalized(e.clientX, e.clientY);
      if (!norm) return;

      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragState({
        startX: norm.x,
        startY: norm.y,
        currentX: norm.x,
        currentY: norm.y,
        pointerType: e.pointerType,
        isDragging: false,
      });
    },
    [readOnly, toNormalized],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (tooltipRef.current && !dragState) {
        tooltipRef.current.style.left = `${e.clientX}px`;
        tooltipRef.current.style.top = `${e.clientY}px`;
      }

      if (!dragState) return;
      const norm = toNormalized(e.clientX, e.clientY);
      if (!norm) return;

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const threshold =
        dragState.pointerType === 'mouse' ? DRAG_THRESHOLD_MOUSE : DRAG_THRESHOLD_TOUCH;
      const dx = Math.abs(norm.x - dragState.startX) * rect.width;
      const dy = Math.abs(norm.y - dragState.startY) * rect.height;
      const isDragging = dragState.isDragging || Math.max(dx, dy) > threshold;

      setDragState((prev) => (prev ? { ...prev, currentX: norm.x, currentY: norm.y, isDragging } : null));
    },
    [dragState, toNormalized],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragState) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

      if (dragState.isDragging) {
        const x = Math.min(dragState.startX, dragState.currentX);
        const y = Math.min(dragState.startY, dragState.currentY);
        const w = Math.abs(dragState.currentX - dragState.startX);
        const h = Math.abs(dragState.currentY - dragState.startY);
        if (w > 0.01 && h > 0.01) {
          onPinPlace({ x, y, w, h });
        }
      } else {
        onPinPlace({ x: dragState.startX, y: dragState.startY });
      }

      setDragState(null);
    },
    [dragState, onPinPlace],
  );


  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && dragState) {
        setDragState(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragState]);

  const selectionRect = dragState?.isDragging
    ? {
        left: `${Math.min(dragState.startX, dragState.currentX) * 100}%`,
        top: `${Math.min(dragState.startY, dragState.currentY) * 100}%`,
        width: `${Math.abs(dragState.currentX - dragState.startX) * 100}%`,
        height: `${Math.abs(dragState.currentY - dragState.startY) * 100}%`,
      }
    : null;

  return (
    <div
      ref={containerRef}
      onPointerEnter={() => { if (!readOnly) setShowTooltip(true); }}
      onPointerLeave={() => setShowTooltip(false)}
      onPointerDown={(e) => { setShowTooltip(false); onPointerDown(e); }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'relative',
        overflow: 'visible',
        cursor: readOnly ? 'default' : `url("${COMMENT_CURSOR_SVG}") 6 3, crosshair`,
      }}
    >
      {children}

      {/* Existing pin markers */}
      {pinnedComments.map((c) => {
        const num = pinNumbers.get(c.id) ?? 0;
        const isActive = c.id === activeCommentId;
        const isResolved = c.resolved_at != null;
        const hasArea = c.pin_w != null && c.pin_h != null && c.pin_w > 0 && c.pin_h > 0;

        return (
          <div key={c.id}>
            {hasArea && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(c.pin_x ?? 0) * 100}%`,
                  top: `${(c.pin_y ?? 0) * 100}%`,
                  width: `${(c.pin_w ?? 0) * 100}%`,
                  height: `${(c.pin_h ?? 0) * 100}%`,
                  border: `2px dashed ${isActive ? 'oklch(0.7 0.18 250)' : 'oklch(0.65 0.16 250 / 0.5)'}`,
                  background: isActive
                    ? 'oklch(0.55 0.18 250 / 0.12)'
                    : 'oklch(0.55 0.18 250 / 0.06)',
                  borderRadius: 4,
                  pointerEvents: 'none',
                  transition: 'all 150ms ease-out',
                  opacity: isResolved ? 0.3 : 1,
                }}
              />
            )}
            <button
              type="button"
              data-pin-marker
              data-comment-id={c.id}
              onClick={(e) => {
                e.stopPropagation();
                onPinClick(c.id);
              }}
              style={{
                position: 'absolute',
                left: `${(c.pin_x ?? 0) * 100}%`,
                top: `${(c.pin_y ?? 0) * 100}%`,
                transform: 'translate(-50%, -100%)',
                width: PIN_SIZE,
                height: PIN_SIZE,
                borderRadius: '50% 50% 50% 0',
                rotate: '-45deg',
                background: isActive ? 'oklch(0.55 0.22 250)' : 'oklch(0.45 0.18 250)',
                border: `2px solid ${isActive ? 'white' : 'oklch(0.85 0.08 250)'}`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                zIndex: isActive ? 20 : 10,
                transition: 'all 150ms ease-out',
                boxShadow: isActive
                  ? '0 4px 16px oklch(0.3 0.15 250 / 0.4)'
                  : '0 2px 8px oklch(0.15 0.1 250 / 0.3)',
                opacity: isResolved ? 0.35 : 1,
                padding: 0,
              }}
            >
              <span style={{ rotate: '45deg', lineHeight: 1 }}>{num}</span>
            </button>
          </div>
        );
      })}

      {/* Drag selection rectangle */}
      {selectionRect && (
        <div
          style={{
            position: 'absolute',
            ...selectionRect,
            border: '2px dashed oklch(0.65 0.2 250)',
            background: 'oklch(0.55 0.2 250 / 0.1)',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Floating tooltip that follows cursor */}
      {showTooltip && !dragState && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            transform: 'translate(20px, 8px)',
            pointerEvents: 'none',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            borderRadius: 8,
            background: 'white',
            border: '1px solid oklch(0.88 0.01 260)',
            boxShadow: '0 2px 12px oklch(0.15 0.02 260 / 0.12)',
            fontSize: 12,
            fontWeight: 500,
            color: 'oklch(0.35 0.02 260)',
            whiteSpace: 'nowrap',
          }}
        >
          Click to comment
        </div>
      )}
    </div>
  );
}

export function PinPopover({
  pin,
  containerRef,
  onSubmit,
  onCancel,
  mentionables,
}: {
  pin: PinDraft;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSubmit: (body: string) => void;
  onCancel: () => void;
  mentionables: { handle: string; name: string | null }[];
}): ReactNode {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = useCallback(() => {
    const text = body.trim();
    if (!text) return;
    onSubmit(text);
    setBody('');
  }, [body, onSubmit]);

  const anchorX = pin.w ? pin.x + pin.w : pin.x;
  const anchorY = pin.y;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        left: `${anchorX * 100}%`,
        top: `${anchorY * 100}%`,
        transform: 'translate(12px, -12px)',
        zIndex: 50,
        width: 260,
        background: 'oklch(0.18 0.008 260)',
        border: '1px solid oklch(0.28 0.01 260)',
        borderRadius: 12,
        boxShadow: '0 8px 32px oklch(0.05 0.02 260 / 0.5)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 8,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Add a comment..."
        rows={2}
        style={{
          width: '100%',
          background: 'oklch(0.14 0.006 260)',
          border: '1px solid oklch(0.3 0.01 260)',
          borderRadius: 8,
          padding: '8px 10px',
          color: 'oklch(0.92 0.01 260)',
          fontSize: 13,
          fontFamily: 'inherit',
          resize: 'none',
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid oklch(0.3 0.01 260)',
            background: 'transparent',
            color: 'oklch(0.65 0.01 260)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!body.trim()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: 6,
            border: 'none',
            background: body.trim() ? 'oklch(0.55 0.22 250)' : 'oklch(0.3 0.01 260)',
            color: body.trim() ? 'white' : 'oklch(0.5 0.01 260)',
            fontSize: 12,
            fontWeight: 500,
            cursor: body.trim() ? 'pointer' : 'default',
          }}
        >
          <Send size={11} />
          Post
        </button>
      </div>
    </div>
  );
}
