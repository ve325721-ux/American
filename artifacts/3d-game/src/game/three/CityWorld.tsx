import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import type { CityWorldProps, WorldInteraction } from './worldTypes';
import { WorldScene } from './WorldScene';
import './cityWorld.css';

interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  stickX: number;
  stickY: number;
  cameraX: number;
}

interface ErrorBoundaryState { failed: boolean }

class WorldErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };
  static getDerivedStateFromError(): ErrorBoundaryState { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn('City world could not initialize', error, info); }
  render() {
    if (this.state.failed) return <div className="cw-fallback" role="alert"><strong>THE CITY ISN'T READY</strong><span>3D mode could not start on this device. Check WebGL support, then reload to try again.</span></div>;
    return this.props.children;
  }
}

const emptyInput = (): InputState => ({ forward: false, back: false, left: false, right: false, stickX: 0, stickY: 0, cameraX: 0 });

export function CityWorld(props: CityWorldProps) {
  const { location, initialPose, character, placements, pendingFurnitureId, driving, paused, onPoseChange, onLocationChange, onInteract, onToggleDrive, onPlaceFurniture, onInspectFurniture } = props;
  const input = useRef<InputState>(emptyInput());
  const [nearby, setNearby] = useState<WorldInteraction | null>(null);
  const [joystick, setJoystick] = useState({ x: 0, y: 0, active: false });
  const [canvasError, setCanvasError] = useState(false);
  const pointer = useRef<{ x: number; y: number; camera: boolean } | null>(null);

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
      KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    };
    const down = (event: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName ?? '')) return;
      if (keys[event.code]) { input.current[keys[event.code] as 'forward' | 'back' | 'left' | 'right'] = true; event.preventDefault(); }
      if (event.code === 'KeyE' || event.code === 'Enter') { if (nearby && !paused) { event.preventDefault(); activate(nearby); } }
    };
    const up = (event: KeyboardEvent) => { if (keys[event.code]) input.current[keys[event.code] as 'forward' | 'back' | 'left' | 'right'] = false; };
    const blur = () => { input.current = emptyInput(); setJoystick({ x: 0, y: 0, active: false }); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [nearby, paused]);

  const activate = useCallback((target: WorldInteraction) => {
    if (paused) return;
    if (target === 'apartment') onLocationChange('apartment');
    else if (target === 'apartment-exit') onLocationChange('street');
    else if (target === 'test-car') onToggleDrive();
    else onInteract(target);
  }, [onInteract, onLocationChange, onToggleDrive, paused]);

  const joystickStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setJoystick({ x: 0, y: 0, active: true });
  };
  const joystickMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!joystick.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - rect.left - rect.width / 2) / (rect.width * .36);
    const dy = (event.clientY - rect.top - rect.height / 2) / (rect.height * .36);
    const length = Math.max(1, Math.hypot(dx, dy));
    const x = Math.max(-1, Math.min(1, dx / length));
    const y = Math.max(-1, Math.min(1, dy / length));
    input.current.stickX = x;
    input.current.stickY = y;
    setJoystick({ x: x * 25, y: y * 25, active: true });
  };
  const joystickEnd = () => { input.current.stickX = 0; input.current.stickY = 0; setJoystick({ x: 0, y: 0, active: false }); };

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = { x: event.clientX, y: event.clientY, camera: event.clientX > rect.left + rect.width * .42 };
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointer.current?.camera || event.buttons === 0) return;
    const delta = event.clientX - pointer.current.x;
    input.current.cameraX += delta * .008;
    pointer.current.x = event.clientX;
  };
  const pointerEnd = () => { pointer.current = null; };

  const promptText = nearby === 'apartment' ? 'ENTER YOUR APARTMENT' : nearby === 'apartment-exit' ? 'STEP BACK OUTSIDE' : nearby === 'furniture-shop' ? 'VISIT FURNITURE SHOP' : nearby === 'dealership' ? 'VISIT VEHICLE DEALERSHIP' : nearby === 'test-car' ? (driving ? 'EXIT TEST DRIVE' : 'TAKE THE TEST CAR') : '';
  const interact = () => { if (nearby) activate(nearby); };

  return <section className="city-world" aria-label="Interactive 3D New York neighborhood" data-testid="city-world">
    <WorldErrorBoundary>
      {canvasError ? <div className="cw-fallback" role="alert"><strong>3D MODE UNAVAILABLE</strong><span>This browser could not create a WebGL scene. Enable hardware acceleration or return to the city map.</span></div> : <div className="cw-canvas-wrap" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} data-testid="world-canvas">
        <Canvas camera={{ position: [0, 5, 9], fov: 48 }} dpr={[1, 1.35]} gl={{ antialias: false, powerPreference: 'low-power', alpha: false, failIfMajorPerformanceCaveat: false }} onCreated={({ gl }) => { gl.setClearColor('#b9d3d0'); gl.shadowMap.enabled = false; }} onError={() => setCanvasError(true)}>
          <WorldScene {...props} input={input} onNearbyChange={setNearby} />
        </Canvas>
        <div className="cw-world-label" aria-live="polite"><span className="cw-live-dot" />{location === 'street' ? 'EAST VILLAGE · NEW YORK' : 'YOUR WALK-UP · APARTMENT 3B'}</div>
        {location === 'street' && <div className="cw-place-tags" aria-hidden="true"><span>HOME</span><span>FURNITURE</span><span>GARAGE</span></div>}
        {pendingFurnitureId && location === 'apartment' && <div className="cw-placement-hint" role="status">Tap the floor to place <b>{pendingFurnitureId.replaceAll('-', ' ')}</b></div>}
        {nearby && <button className="cw-interact" onClick={interact} aria-label={promptText} data-testid={`interact-${nearby}`} disabled={paused}><span className="cw-keycap">E</span><span>{promptText}</span><span className="cw-tap-label">INTERACT</span></button>}
        <div className="cw-controls-note" aria-hidden="true">{driving ? 'DRIVE · WASD / ARROWS' : 'WASD / ARROWS TO WALK'}<span>DRAG RIGHT SIDE TO LOOK</span></div>
        <button className="cw-stick" onPointerDown={joystickStart} onPointerMove={joystickMove} onPointerUp={joystickEnd} onPointerCancel={joystickEnd} aria-label="Movement joystick" data-testid="world-joystick"><span className="cw-stick-knob" style={{ transform: `translate(${joystick.x}px, ${joystick.y}px)` }} /></button>
        <div className="cw-look-pad" aria-hidden="true"><span>LOOK</span><i /></div>
      </div>}
    </WorldErrorBoundary>
  </section>;
}

export default CityWorld;
