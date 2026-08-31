'use client';

import { useCallback, useRef } from 'react';

interface Props {
  onDrag: (dx: number) => void;
  onDragEnd?: () => void;
}

/**
 * Precision Instrument — the drag handle between resizable panels.
 * 6px gutter with a 2px center line that illuminates on hover.
 */
export default function ResizeHandle({ onDrag, onDragEnd }: Props) {
  const activeRef = useRef(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      activeRef.current = true;
      startXRef.current = e.clientX;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMove = (ev: MouseEvent) => {
        if (!activeRef.current) return;
        onDrag(ev.clientX - startXRef.current);
      };

      const handleUp = () => {
        activeRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        onDragEnd?.();
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [onDrag, onDragEnd],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="resize-handle"
      style={{
        width: 6,
        minWidth: 6,
        flexShrink: 0,
        cursor: 'col-resize',
        position: 'relative',
        background: 'transparent',
        zIndex: 10,
      }}
    />
  );
}