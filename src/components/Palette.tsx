import { useEffect, useRef, type DragEvent } from 'react';

import { BLUEPRINT_LIST, type BodyBlueprint } from '../physics/bodies';
import type { ObjectKind } from '../physics/types';
import { renderThumbnail } from '../render/thumbnail';
import { DRAG_MIME, setDraggingKind } from './dragPayload';

const THUMB_SIZE = 64;

interface Props {
  atCapacity: boolean;
  /** Tap to drop from above, for touch devices where dragging is awkward. */
  onQuickSpawn: (kind: ObjectKind) => void;
}

export function Palette({ atCapacity, onQuickSpawn }: Props): JSX.Element {
  return (
    <aside className="palette">
      <h2 className="palette__title">Palette</h2>
      <ul className="palette__list">
        {BLUEPRINT_LIST.map((blueprint) => (
          <PaletteItem
            key={blueprint.kind}
            blueprint={blueprint}
            disabled={atCapacity}
            onQuickSpawn={onQuickSpawn}
          />
        ))}
      </ul>
      <p className="palette__note">
        {atCapacity
          ? 'Beach is full. Clear it to keep adding.'
          : 'Drag onto the beach, or tap to drop it from above.'}
      </p>
    </aside>
  );
}

function PaletteItem({
  blueprint,
  disabled,
  onQuickSpawn,
}: {
  blueprint: BodyBlueprint;
  disabled: boolean;
  onQuickSpawn: (kind: ObjectKind) => void;
}): JSX.Element {
  const thumbRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (thumbRef.current) renderThumbnail(thumbRef.current, blueprint.kind, THUMB_SIZE);
  }, [blueprint.kind]);

  const handleDragStart = (event: DragEvent<HTMLLIElement>): void => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    setDraggingKind(blueprint.kind);
    event.dataTransfer.setData(DRAG_MIME, blueprint.kind);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <li
      className={`palette__item${disabled ? ' palette__item--disabled' : ''}`}
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={() => setDraggingKind(null)}
      onClick={() => {
        if (!disabled) onQuickSpawn(blueprint.kind);
      }}
      title={blueprint.hint}
    >
      <canvas
        ref={thumbRef}
        className="palette__thumb"
        style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
      />
      <span className="palette__label">
        <strong>{blueprint.label}</strong>
        <small>{blueprint.hint}</small>
      </span>
    </li>
  );
}
