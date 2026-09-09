import { TOOLS, type ToolId } from '../tools';

interface Props {
  count: number;
  capacity: number;
  onClear: () => void;
  tool: ToolId;
  onToolChange: (tool: ToolId) => void;
  carriedRatio: number;
  onResetTerrain: () => void;
  wind: number;
  onWindChange: (value: number) => void;
  windAuto: boolean;
  onWindAutoChange: (enabled: boolean) => void;
  soundOn: boolean;
  onSoundChange: (enabled: boolean) => void;
}

export function Toolbar({
  count,
  capacity,
  onClear,
  tool,
  onToolChange,
  carriedRatio,
  onResetTerrain,
  wind,
  onWindChange,
  windAuto,
  onWindAutoChange,
  soundOn,
  onSoundChange,
}: Props): JSX.Element {
  const ratio = capacity === 0 ? 0 : count / capacity;
  const shovelActive = tool !== 'move';

  return (
    <header className="toolbar">
      <h1 className="toolbar__title">Beach Physics Playground</h1>

      <div className="toolbar__actions">
        <div className="wind">
          <span className="wind__head">
            <span className="wind__label">Wind</span>
            <button
              type="button"
              className={`wind__auto${windAuto ? ' wind__auto--on' : ''}`}
              onClick={() => onWindAutoChange(!windAuto)}
              title="Wind drifts on its own"
            >
              Auto
            </button>
          </span>
          <input
            className="wind__slider"
            type="range"
            min={-1}
            max={1}
            step={0.02}
            value={wind}
            disabled={windAuto}
            onChange={(event) => onWindChange(Number(event.target.value))}
            aria-label="Wind strength"
          />
        </div>
        <div className="tools" role="group" aria-label="Tool">
          {TOOLS.map((definition) => (
            <button
              key={definition.id}
              type="button"
              className={`tools__button${tool === definition.id ? ' tools__button--active' : ''}`}
              onClick={() => onToolChange(definition.id)}
              title={definition.hint}
              aria-pressed={tool === definition.id}
            >
              <span aria-hidden="true">{definition.icon}</span>
              {definition.label}
            </button>
          ))}
        </div>

        <div
          className={`gauge${shovelActive ? ' gauge--live' : ''}`}
          title="Sand the shovel is holding: digging fills it, piling spends it"
        >
          <span className="gauge__label">Shovel</span>
          <span className="gauge__bar">
            <span
              className="gauge__fill gauge__fill--sand"
              style={{ width: `${Math.round(carriedRatio * 100)}%` }}
            />
          </span>
        </div>

        <div className="gauge" title="Active bodies (capped for performance)">
          <span className="gauge__label">
            {count}
            <small>/{capacity}</small>
          </span>
          <span className="gauge__bar">
            <span className="gauge__fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
        </div>

        <button type="button" className="button button--ghost" onClick={onResetTerrain}>
          Level sand
        </button>
        <button
          type="button"
          className={soundOn ? 'iconButton iconButton--on' : 'iconButton'}
          onClick={() => onSoundChange(!soundOn)}
          title={soundOn ? 'Mute' : 'Unmute'}
          aria-pressed={soundOn}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button type="button" className="button" onClick={onClear} disabled={count === 0}>
          Clear beach
        </button>
      </div>
    </header>
  );
}
