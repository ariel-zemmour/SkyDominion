import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useMobileStore, useGyroscope, detectMobile } from '../hooks/useMobileControls';
import { useGameStore } from '../store';
import {
  Crosshair,
  Rocket,
  Bomb,
  Zap,
  Camera,
  Target,
  ArrowUpFromLine,
  Smartphone,
  RotateCcw,
} from 'lucide-react';

// ─── Virtual Joystick ───────────────────────────────────────────────────────
interface JoystickProps {
  side: 'left' | 'right';
  onMove: (x: number, y: number) => void;
  onRelease: () => void;
  label: string;
}

function VirtualJoystick({ side, onMove, onRelease, label }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const touchId = useRef<number | null>(null);

  const RADIUS = 50;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.changedTouches[0];
      touchId.current = touch.identifier;
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (touchId.current === null) return;
      const touch = Array.from(e.touches).find(
        (t) => t.identifier === touchId.current
      );
      if (!touch || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > RADIUS) {
        dx = (dx / dist) * RADIUS;
        dy = (dy / dist) * RADIUS;
      }

      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      }

      onMove(dx / RADIUS, dy / RADIUS);
    },
    [onMove]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = Array.from(e.changedTouches).find(
        (t) => t.identifier === touchId.current
      );
      if (!touch) return;
      touchId.current = null;
      if (knobRef.current) {
        knobRef.current.style.transform = 'translate(0px, 0px)';
      }
      onRelease();
    },
    [onRelease]
  );

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center touch-none"
      style={{ width: 120, height: 120 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Outer ring */}
      <div
        className="absolute rounded-full border-2 border-green-500/40"
        style={{
          width: RADIUS * 2 + 20,
          height: RADIUS * 2 + 20,
          background: 'radial-gradient(circle, rgba(0,255,0,0.05) 0%, rgba(0,0,0,0.3) 100%)',
        }}
      />
      {/* Axis lines */}
      <div className="absolute w-full h-[1px] bg-green-500/15" />
      <div className="absolute h-full w-[1px] bg-green-500/15" />
      {/* Knob */}
      <div
        ref={knobRef}
        className="absolute rounded-full border-2 border-green-400/80 shadow-[0_0_12px_rgba(0,255,0,0.3)]"
        style={{
          width: 44,
          height: 44,
          background:
            'radial-gradient(circle, rgba(0,255,0,0.25) 0%, rgba(0,255,0,0.08) 100%)',
          transition: 'none',
        }}
      />
      {/* Label */}
      <span className="absolute -bottom-5 text-[10px] text-green-500/50 font-mono uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

// ─── Action Button ──────────────────────────────────────────────────────────
interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  onRelease?: () => void;
  active?: boolean;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  hold?: boolean; // if true, button state is held while touching
}

function ActionButton({
  icon,
  label,
  onPress,
  onRelease,
  active,
  color = 'green',
  size = 'md',
  hold = false,
}: ActionButtonProps) {
  const dims = size === 'sm' ? 40 : size === 'lg' ? 56 : 48;
  const borderColor = active
    ? `rgba(${color === 'red' ? '255,80,80' : color === 'yellow' ? '255,200,0' : color === 'cyan' ? '0,200,255' : '0,255,0'},0.9)`
    : `rgba(${color === 'red' ? '255,80,80' : color === 'yellow' ? '255,200,0' : color === 'cyan' ? '0,200,255' : '0,255,0'},0.4)`;
  const bgColor = active
    ? `rgba(${color === 'red' ? '255,80,80' : color === 'yellow' ? '255,200,0' : color === 'cyan' ? '0,200,255' : '0,255,0'},0.25)`
    : `rgba(0,0,0,0.4)`;
  const glowColor = active
    ? `0 0 15px rgba(${color === 'red' ? '255,80,80' : color === 'yellow' ? '255,200,0' : color === 'cyan' ? '0,200,255' : '0,255,0'},0.5)`
    : 'none';

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        className="rounded-full flex items-center justify-center touch-none select-none"
        style={{
          width: dims,
          height: dims,
          border: `2px solid ${borderColor}`,
          background: bgColor,
          boxShadow: glowColor,
          transition: 'all 0.1s ease',
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPress();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRelease?.();
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRelease?.();
        }}
      >
        {icon}
      </button>
      <span
        className="text-[9px] font-mono uppercase tracking-wider opacity-50"
        style={{
          color:
            color === 'red'
              ? '#ff5050'
              : color === 'yellow'
                ? '#ffc800'
                : color === 'cyan'
                  ? '#00c8ff'
                  : '#00ff00',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Main Mobile Controls Overlay ───────────────────────────────────────────
export function MobileControls() {
  const gameState = useGameStore((s) => s.gameState);
  const setInput = useMobileStore((s) => s.setInput);
  const fireBullets = useMobileStore((s) => s.fireBullets);
  const fireHoming = useMobileStore((s) => s.fireHoming);
  const fireGround = useMobileStore((s) => s.fireGround);
  const shift = useMobileStore((s) => s.shift);
  const isMobile = useMobileStore((s) => s.isMobile);

  const { toggleGyro, recalibrate, gyroEnabled } = useGyroscope();

  // Detect mobile on mount
  useEffect(() => {
    setInput({ isMobile: detectMobile() });
  }, [setInput]);

  // Don't render on desktop or outside gameplay
  if (!isMobile || (gameState !== 'playing' && gameState !== 'paused')) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-50 pointer-events-none select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Left Joystick — Throttle & Yaw */}
      <div className="absolute bottom-8 left-6 pointer-events-auto">
        <VirtualJoystick
          side="left"
          label="Throttle / Yaw"
          onMove={(x, y) => setInput({ moveX: x, moveY: -y })}
          onRelease={() => setInput({ moveX: 0, moveY: 0 })}
        />
      </div>

      {/* Right Joystick — Pitch & Roll */}
      <div className="absolute bottom-8 right-6 pointer-events-auto">
        <VirtualJoystick
          side="right"
          label="Pitch / Roll"
          onMove={(x, y) => setInput({ aimX: x, aimY: -y })}
          onRelease={() => setInput({ aimX: 0, aimY: 0 })}
        />
      </div>

      {/* Fire Buttons — Right side, above joystick */}
      <div className="absolute bottom-40 right-4 pointer-events-auto flex flex-col gap-3 items-center">
        <ActionButton
          icon={<Crosshair size={20} className="text-green-400" />}
          label="Fire"
          color="green"
          size="lg"
          active={fireBullets}
          hold
          onPress={() => setInput({ fireBullets: true })}
          onRelease={() => setInput({ fireBullets: false })}
        />
        <ActionButton
          icon={<Rocket size={18} className="text-red-400" />}
          label="Missile"
          color="red"
          size="md"
          active={fireHoming}
          onPress={() => setInput({ fireHoming: true })}
          onRelease={() => setInput({ fireHoming: false })}
        />
        <ActionButton
          icon={<Bomb size={18} className="text-yellow-400" />}
          label="Ground"
          color="yellow"
          size="md"
          active={fireGround}
          onPress={() => setInput({ fireGround: true })}
          onRelease={() => setInput({ fireGround: false })}
        />
      </div>

      {/* Utility Buttons — Left side, above joystick */}
      <div className="absolute bottom-40 left-4 pointer-events-auto flex flex-col gap-3 items-center">
        <ActionButton
          icon={<Zap size={18} className={shift ? 'text-cyan-300' : 'text-cyan-500/60'} />}
          label="Boost"
          color="cyan"
          size="md"
          active={shift}
          hold
          onPress={() => setInput({ shift: true })}
          onRelease={() => setInput({ shift: false })}
        />
        <ActionButton
          icon={<Target size={18} className="text-green-400" />}
          label="Lock"
          color="green"
          size="sm"
          onPress={() => {
            setInput({ lock: true });
            setTimeout(() => setInput({ lock: false }), 200);
          }}
        />
        <ActionButton
          icon={<Camera size={18} className="text-green-400" />}
          label="Cam"
          color="green"
          size="sm"
          onPress={() => {
            setInput({ camera: true });
            setTimeout(() => setInput({ camera: false }), 200);
          }}
        />
      </div>

      {/* Top Bar — Gyro toggle + Eject */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto flex gap-4 items-center">
        <button
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border transition-all touch-none ${
            gyroEnabled
              ? 'border-cyan-400/80 bg-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(0,200,255,0.3)]'
              : 'border-green-500/30 bg-black/40 text-green-500/60'
          }`}
          onTouchStart={(e) => {
            e.preventDefault();
            toggleGyro();
          }}
        >
          <Smartphone size={14} />
          {gyroEnabled ? 'GYRO ON' : 'GYRO OFF'}
        </button>

        {gyroEnabled && (
          <button
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-green-500/30 bg-black/40 text-green-500/60 touch-none"
            onTouchStart={(e) => {
              e.preventDefault();
              recalibrate();
            }}
          >
            <RotateCcw size={14} />
            CAL
          </button>
        )}

        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-red-500/40 bg-black/40 text-red-400 touch-none"
          onTouchStart={(e) => {
            e.preventDefault();
            setInput({ eject: true });
            setTimeout(() => setInput({ eject: false }), 300);
          }}
        >
          <ArrowUpFromLine size={14} />
          EJECT
        </button>
      </div>

      {/* Gyro Indicator */}
      {gyroEnabled && <GyroIndicator />}
    </div>
  );
}

function GyroIndicator() {
  const gyroPitch = useMobileStore((s) => s.gyroPitch);
  const gyroRoll = useMobileStore((s) => s.gyroRoll);

  return (
    <div className="absolute top-32 left-1/2 -translate-x-1/2 pointer-events-none">
      <div
        className="w-16 h-16 rounded-full border border-cyan-500/30 flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(0,200,255,0.05) 0%, transparent 70%)',
        }}
      >
        {/* Cross lines */}
        <div className="absolute w-full h-[1px] bg-cyan-500/20" />
        <div className="absolute h-full w-[1px] bg-cyan-500/20" />
        {/* Dot showing tilt */}
        <div
          className="absolute w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,200,255,0.6)]"
          style={{
            transform: `translate(${gyroRoll * 24}px, ${-gyroPitch * 24}px)`,
            transition: 'transform 0.05s linear',
          }}
        />
      </div>
      <div className="text-center text-[8px] text-cyan-500/40 font-mono mt-1 tracking-wider">
        GYRO
      </div>
    </div>
  );
}
