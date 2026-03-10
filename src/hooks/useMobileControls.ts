import { useEffect, useRef, useCallback } from 'react';
import { create } from 'zustand';

export interface MobileInputState {
  // Movement joystick (left side) - values from -1 to 1
  moveX: number; // yaw left/right
  moveY: number; // throttle up/down

  // Aim joystick (right side) - values from -1 to 1
  aimX: number; // roll left/right
  aimY: number; // pitch up/down

  // Buttons
  fireBullets: boolean;
  fireHoming: boolean;
  fireGround: boolean;
  shift: boolean; // afterburner
  camera: boolean;
  lock: boolean;
  eject: boolean;
  callRescue: boolean;

  // Gyroscope
  gyroEnabled: boolean;
  gyroPitch: number; // -1 to 1
  gyroRoll: number; // -1 to 1

  // System
  isMobile: boolean;
}

const defaultState: MobileInputState = {
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  fireBullets: false,
  fireHoming: false,
  fireGround: false,
  shift: false,
  camera: false,
  lock: false,
  eject: false,
  callRescue: false,
  gyroEnabled: false,
  gyroPitch: 0,
  gyroRoll: 0,
  isMobile: false,
};

interface MobileControlsStore extends MobileInputState {
  setInput: (partial: Partial<MobileInputState>) => void;
  resetJoysticks: () => void;
}

export const useMobileStore = create<MobileControlsStore>((set) => ({
  ...defaultState,
  setInput: (partial) => set(partial),
  resetJoysticks: () => set({ moveX: 0, moveY: 0, aimX: 0, aimY: 0 }),
}));

export function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
}

export function useGyroscope() {
  const setInput = useMobileStore((s) => s.setInput);
  const gyroEnabled = useMobileStore((s) => s.gyroEnabled);
  const baseOrientation = useRef<{ beta: number; gamma: number } | null>(null);
  const calibrated = useRef(false);

  const handleOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      if (!gyroEnabled) return;
      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;

      // Calibrate on first read
      if (!calibrated.current) {
        baseOrientation.current = { beta, gamma };
        calibrated.current = true;
        return;
      }

      const base = baseOrientation.current!;
      // Map tilt to -1..1 range
      // beta = front/back tilt (-180..180), gamma = left/right tilt (-90..90)
      const pitchDelta = (beta - base.beta) / 30; // 30 degrees = full tilt
      const rollDelta = (gamma - base.gamma) / 30;

      setInput({
        gyroPitch: Math.max(-1, Math.min(1, -pitchDelta)),
        gyroRoll: Math.max(-1, Math.min(1, rollDelta)),
      });
    },
    [gyroEnabled, setInput]
  );

  const requestPermission = useCallback(async () => {
    // iOS 13+ requires permission
    if (
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permission = await (
          DeviceOrientationEvent as any
        ).requestPermission();
        if (permission === 'granted') {
          setInput({ gyroEnabled: true });
          calibrated.current = false;
          baseOrientation.current = null;
        }
      } catch (e) {
        console.warn('Gyroscope permission denied', e);
      }
    } else {
      // Non-iOS, just enable
      setInput({ gyroEnabled: true });
      calibrated.current = false;
      baseOrientation.current = null;
    }
  }, [setInput]);

  const toggleGyro = useCallback(() => {
    if (gyroEnabled) {
      setInput({ gyroEnabled: false, gyroPitch: 0, gyroRoll: 0 });
      calibrated.current = false;
      baseOrientation.current = null;
    } else {
      requestPermission();
    }
  }, [gyroEnabled, setInput, requestPermission]);

  const recalibrate = useCallback(() => {
    calibrated.current = false;
    baseOrientation.current = null;
  }, []);

  useEffect(() => {
    if (!gyroEnabled) return;
    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [gyroEnabled, handleOrientation]);

  return { toggleGyro, recalibrate, gyroEnabled };
}
