import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from 'react';
import { getCameraSettings, updateCameraSettings, useCameraSettings } from '../cameraSettings';
import { Canvas } from '@react-three/fiber';
import type { CityWorldProps, WorldInteraction } from './worldTypes';
import { WorldScene, type InputState } from './WorldScene';
import { POIS } from './nyc/layout';
import './cityWorld.css';



interface ErrorBoundaryState {
  failed: boolean;
}

class WorldErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('City world could not initialize', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="cw-fallback" role="alert">
          <strong>THE CITY ISN'T READY</strong>
          <span>
            3D mode could not start on this device. Check WebGL support,
            then reload to try again.
          </span>
        </div>
      );
    }

    return this.props.children;
  }
}

const emptyInput = (): InputState => ({
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
  stickX: 0,
  stickY: 0,
  cameraX: 0,
  cameraY: 0,
  zoom: 0,
});

export function CityWorld(props: CityWorldProps) {
  const {
    location,
    initialPose,
    character,
    placements,
    pendingFurnitureId,
    driving,
    paused,
    onPoseChange,
    onLocationChange,
    onInteract,
    onToggleDrive,
    onPlaceFurniture,
    onInspectFurniture,
  } = props;

  const input = useRef<InputState>(emptyInput());
  const cameraSettings = useCameraSettings();

  const [nearby, setNearby] = useState<WorldInteraction | null>(null);

  const [joystick, setJoystick] = useState({
    x: 0,
    y: 0,
    active: false,
  });

  const [canvasError, setCanvasError] = useState(false);
  const [place, setPlace] = useState({ street: 'E 7th St · 1 Av – Av A', hood: 'EAST VILLAGE' });

  useEffect(() => {
    if (paused) {
      input.current.forward = false;
      input.current.back = false;
      input.current.left = false;
      input.current.right = false;
      input.current.stickX = 0;
      input.current.stickY = 0;

      setJoystick({ x: 0, y: 0, active: false });
    }
  }, [paused]);

  useEffect(() => {
    const keys: Record<string, keyof InputState> = {
      KeyW: 'forward',
      ArrowUp: 'forward',
      KeyS: 'back',
      ArrowDown: 'back',
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
    };

    const down = (event: KeyboardEvent) => {
      if (
        /INPUT|TEXTAREA|SELECT/.test(
          (event.target as HTMLElement)?.tagName ?? '',
        )
      ) {
        return;
      }

      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.current.sprint = true;
      if (keys[event.code]) {
        input.current[
          keys[event.code] as 'forward' | 'back' | 'left' | 'right'
        ] = true;

        event.preventDefault();
      }

      if (event.code === 'KeyV' && !event.repeat) {
        updateCameraSettings({ mode: getCameraSettings().mode === 'first' ? 'third' : 'first' });
      }

      if (event.code === 'KeyE' || event.code === 'Enter') {
        if (nearby && !paused) {
          event.preventDefault();
          activate(nearby);
        }
      }
    };

    const up = (event: KeyboardEvent) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.current.sprint = false;
      if (keys[event.code]) {
        input.current[
          keys[event.code] as 'forward' | 'back' | 'left' | 'right'
        ] = false;
      }
    };

    const blur = () => {
      Object.assign(input.current, emptyInput());
      setJoystick({ x: 0, y: 0, active: false });
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [nearby, paused]);

  const activate = useCallback(
    (target: WorldInteraction) => {
      if (paused) return;

      if (target === 'apartment') {
        onLocationChange('apartment');
      } else if (target === 'apartment-exit') {
        onLocationChange('street');
      } else if (target === 'test-car') {
        onToggleDrive();
      } else {
        onInteract(target);
      }
    },
    [onInteract, onLocationChange, onToggleDrive, paused],
  );

  const joystickStart = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);

    setJoystick({ x: 0, y: 0, active: true });
  };

  const joystickMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!joystick.active) return;

    const rect = event.currentTarget.getBoundingClientRect();

    const dx =
      (event.clientX - rect.left - rect.width / 2) /
      (rect.width * 0.36);

    const dy =
      (event.clientY - rect.top - rect.height / 2) /
      (rect.height * 0.36);

    const length = Math.max(1, Math.hypot(dx, dy));

    const x = Math.max(-1, Math.min(1, dx / length));
    const y = Math.max(-1, Math.min(1, dy / length));

    input.current.stickX = x;
    input.current.stickY = y;

    setJoystick({
      x: x * 25,
      y: y * 25,
      active: true,
    });
  };

  const joystickEnd = () => {
    input.current.stickX = 0;
    input.current.stickY = 0;

    setJoystick({
      x: 0,
      y: 0,
      active: false,
    });
  };

  // Every active pointer is tracked separately so a thumb on the joystick
  // and a thumb swiping the camera never interfere with each other.
  const lookPointers = useRef(new Map<number, { x: number; y: number; touch: boolean }>());

  const pointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    // Joystick, interact prompt and HUD buttons handle their own input.
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const touch = event.pointerType !== 'mouse';
    // Mouse: hold the right button (or drag with the left) anywhere.
    // Touch: swipe anywhere on the right side of the screen.
    const look = touch
      ? event.clientX > rect.left + rect.width * 0.42
      : event.button === 2 || event.button === 0;
    if (!look) return;
    lookPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY, touch });
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const tracked = lookPointers.current.get(event.pointerId);
      if (!tracked) return;
      if (!tracked.touch && event.buttons === 0) {
        lookPointers.current.delete(event.pointerId);
        return;
      }
      const deltaX = event.clientX - tracked.x;
      const deltaY = event.clientY - tracked.y;
      tracked.x = event.clientX;
      tracked.y = event.clientY;
      const { sensitivity, invertY } = getCameraSettings();
      const k = (tracked.touch ? 0.0062 : 0.0042) * sensitivity;
      // Move/swipe right → look right. Move/swipe up → look up.
      input.current.cameraX -= deltaX * k;
      input.current.cameraY -= deltaY * k * (invertY ? -1 : 1);
    };
    const end = (event: PointerEvent) => {
      lookPointers.current.delete(event.pointerId);
    };
    const clear = () => lookPointers.current.clear();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    input.current.zoom += Math.sign(event.deltaY) * 0.8;
  };

  const poi = POIS.find((p) => p.id === nearby);
  const promptText =
    nearby === 'apartment-exit'
      ? 'STEP BACK OUT ONTO E 7TH ST'
      : nearby === 'test-car'
        ? driving
          ? 'PARK & STEP OUT'
          : props.vehicleId
            ? 'GET IN YOUR CAR'
            : 'TAKE THE LOANER FOR A DRIVE'
        : poi?.prompt ?? '';

  const interact = () => {
    if (nearby) activate(nearby);
  };

  return (
    <section
      className="city-world"
      aria-label="Interactive 3D New York neighborhood"
      data-testid="city-world"
    >
      <WorldErrorBoundary>
        {canvasError ? (
          <div className="cw-fallback" role="alert">
            <strong>3D MODE UNAVAILABLE</strong>
            <span>
              This browser could not create a WebGL scene.
              Enable hardware acceleration or return to the city map.
            </span>
          </div>
        ) : (
          <div
            className="cw-canvas-wrap"
            onPointerDown={pointerDown}
            onContextMenu={(event) => event.preventDefault()}
            onWheel={wheel}
            data-testid="world-canvas"
          >
            <Canvas
              shadows
              camera={{ position: [0, 5, 9], fov: 60, near: 0.1, far: 2200 }}
              dpr={[1, 1.35]}
              gl={{
                antialias: true,
                powerPreference: 'high-performance',
                alpha: false,
                failIfMajorPerformanceCaveat: false,
              }}
              onCreated={({ gl }) => {
                gl.setClearColor('#b9d3d0');
                gl.shadowMap.enabled = true;
              }}
              onError={() => setCanvasError(true)}
            >
              <WorldScene
                {...props}
                input={input}
                cameraMode={cameraSettings.mode}
                onNearbyChange={setNearby}
                onPlaceChange={(next) => { setPlace(next); props.onPlaceChange?.(next); }}
              />
            </Canvas>

            <div
              className="cw-world-label"
              aria-live="polite"
            >
              <span className="cw-live-dot" />
              {location === 'street'
                ? `${place.street.toUpperCase()} · ${place.hood}`
                : 'YOUR WALK-UP · APT 3B · E 7TH ST'}
            </div>

            {location === 'street' && (
              <div className="cw-place-tags" aria-hidden="true">
                {POIS.filter((p) => p.mapTag !== 'JOB').slice(0, 6).map((p) => (
                  <span key={p.id} style={{ borderLeft: `3px solid ${p.color}` }}>{p.mapTag} · {p.name.toUpperCase()}</span>
                ))}
              </div>
            )}

            {pendingFurnitureId && location === 'apartment' && (
              <div
                className="cw-placement-hint"
                role="status"
              >
                Tap the floor to place{' '}
                <b>{pendingFurnitureId.replaceAll('-', ' ')}</b>
              </div>
            )}

            {nearby && (
              <button
                className="cw-interact"
                onClick={interact}
                aria-label={promptText}
                data-testid={`interact-${nearby}`}
                disabled={paused}
              >
                <span className="cw-keycap">E</span>
                <span>{promptText}</span>
                <span className="cw-tap-label">INTERACT</span>
              </button>
            )}

            <div
              className="cw-controls-note"
              aria-hidden="true"
            >
              {driving
                ? 'W/S GAS & BRAKE · A/D STEER · SHIFT BOOST'
                : 'WASD TO WALK · SHIFT TO RUN · E TO INTERACT'}
              <span className="cw-note-desktop">HOLD RIGHT MOUSE & MOVE TO LOOK · WHEEL ZOOM · V VIEW</span>
              <span className="cw-note-touch">SWIPE RIGHT SIDE TO LOOK AROUND</span>
            </div>

            <button
              className="cw-view-toggle"
              onClick={() => updateCameraSettings({ mode: cameraSettings.mode === 'first' ? 'third' : 'first' })}
              aria-label={`Switch to ${cameraSettings.mode === 'first' ? 'third' : 'first'}-person view`}
              data-testid="button-camera-mode"
            >
              {cameraSettings.mode === 'first' ? '1ST PERSON' : '3RD PERSON'}
              <small>V · SWITCH VIEW</small>
            </button>

            <button
              className="cw-stick"
              onPointerDown={joystickStart}
              onPointerMove={joystickMove}
              onPointerUp={joystickEnd}
              onPointerCancel={joystickEnd}
              aria-label="Movement joystick"
              data-testid="world-joystick"
            >
              <span
                className="cw-stick-knob"
                style={{
                  transform: `translate(${joystick.x}px, ${joystick.y}px)`,
                }}
              />
            </button>

            <div
              className="cw-look-pad"
              aria-hidden="true"
            >
              <span>LOOK</span>
              <i />
            </div>
          </div>
        )}
      </WorldErrorBoundary>
    </section>
  );
}

export default CityWorld;