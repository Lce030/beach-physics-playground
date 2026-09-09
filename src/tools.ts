/** Cursor tools. `move` hands control back to Matter's MouseConstraint. */
export type ToolId = 'move' | 'dig' | 'fill';

export interface ToolDefinition {
  readonly id: ToolId;
  readonly label: string;
  readonly icon: string;
  readonly hint: string;
}

export const TOOLS: readonly ToolDefinition[] = [
  { id: 'move', label: 'Move', icon: '🖐️', hint: 'Drag objects around the scene' },
  { id: 'dig', label: 'Dig', icon: '⛏️', hint: 'Scoop sand into the shovel' },
  { id: 'fill', label: 'Pile', icon: '🪣', hint: 'Drop the sand the shovel is carrying' },
];
