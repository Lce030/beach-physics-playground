import { useCallback, useRef } from 'react';

import { BeachStage } from './components/BeachStage';
import { Palette } from './components/Palette';
import { Toolbar } from './components/Toolbar';
import { TERRAIN } from './config/scene';
import { useBeachScene } from './hooks/useBeachScene';
import type { ObjectKind } from './physics/types';

export default function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useBeachScene(canvasRef);

  const handleQuickSpawn = useCallback(
    (kind: ObjectKind) => {
      const x = 140 + Math.random() * (TERRAIN.rampStartX - 240);
      scene.spawn(kind, x, 90);
    },
    [scene],
  );

  return (
    <div className="app">
      <Toolbar
        count={scene.count}
        capacity={scene.capacity}
        onClear={scene.clear}
        tool={scene.tool}
        onToolChange={scene.setTool}
        carriedRatio={scene.carriedRatio}
        onResetTerrain={scene.resetTerrain}
        wind={scene.windAuto ? 0 : scene.wind}
        onWindChange={scene.setWind}
        windAuto={scene.windAuto}
        onWindAutoChange={scene.setWindAuto}
        soundOn={scene.soundOn}
        onSoundChange={scene.setSoundOn}
      />
      <main className="layout">
        <BeachStage canvasRef={canvasRef} scene={scene} />
        <Palette atCapacity={scene.atCapacity} onQuickSpawn={handleQuickSpawn} />
      </main>
    </div>
  );
}
