import type { ObjectKind } from '../physics/types';

/**
 * dataTransfer.getData is unreadable during dragover (only the types are
 * exposed), so the kind is mirrored here to draw the drop preview. The real
 * payload still travels in dataTransfer.
 */
let current: ObjectKind | null = null;

export const DRAG_MIME = 'application/x-beach-kind';

export function setDraggingKind(kind: ObjectKind | null): void {
  current = kind;
}

export function getDraggingKind(): ObjectKind | null {
  return current;
}
