import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store';

interface RadarProps {
  className?: string;
  isRTL?: boolean;
}

export function Radar({ className = '', isRTL = false }: RadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let sweepAngle = 0;

    const render = () => {
      const state = useGameStore.getState();
      if (state.gameState !== 'playing' && state.gameState !== 'paused') {
        animationId = requestAnimationFrame(render);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const radius = cx - 12;
      const maxRange = 3500; // Radar range in meters
      const scale = radius / maxRange;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Radar circular background
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(4, 20, 10, 0.75)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';
      ctx.stroke();
      ctx.clip(); // Clip everything to the circular radar scope

      // Range rings (1000m, 2000m, 3000m)
      [1000, 2000, 3000].forEach((dist) => {
        const r = dist * scale;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Distance label
        ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${dist / 1000}k`, cx, cy - r + 11);
      });

      // Crosshairs
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.lineWidth = 1;
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.stroke();

      // Heading calculation from player quaternion
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(state.playerRot);
      const heading = Math.atan2(forward.x, -forward.z); // Player heading in rad
      const headingDeg = Math.round(((heading * 180) / Math.PI + 360) % 360);

      // Rotating compass cardinal marks (N, E, S, W)
      const cardinals = [
        { label: 'N', angle: 0 },
        { label: 'E', angle: Math.PI / 2 },
        { label: 'S', angle: Math.PI },
        { label: 'W', angle: (3 * Math.PI) / 2 }
      ];

      cardinals.forEach(({ label, angle }) => {
        const relAngle = angle - heading - Math.PI / 2;
        const markX = cx + (radius - 12) * Math.cos(relAngle);
        const markY = cy + (radius - 12) * Math.sin(relAngle);

        ctx.fillStyle = label === 'N' ? '#22c55e' : 'rgba(34, 197, 94, 0.5)';
        ctx.font = label === 'N' ? 'bold 11px monospace' : '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, markX, markY);
      });

      // Radar Sweep line & fading trail
      if (state.gameState === 'playing') {
        sweepAngle = (sweepAngle + 0.04) % (Math.PI * 2);
      }

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, sweepAngle - 0.5, sweepAngle);
      ctx.closePath();
      const sweepGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      sweepGradient.addColorStop(0, 'rgba(34, 197, 94, 0)');
      sweepGradient.addColorStop(1, 'rgba(34, 197, 94, 0.25)');
      ctx.fillStyle = sweepGradient;
      ctx.fill();

      // Sweep line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * Math.cos(sweepAngle), cy + radius * Math.sin(sweepAngle));
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Helper function to project world coords to radar coords (Heading-Up)
      const projectToRadar = (worldPos: THREE.Vector3) => {
        const dx = worldPos.x - state.playerPos.x;
        const dz = worldPos.z - state.playerPos.z;

        // Rotate by -heading so plane forward direction is always UP (-Y on canvas)
        const rotX = dx * Math.cos(-heading) - dz * Math.sin(-heading);
        const rotZ = dx * Math.sin(-heading) + dz * Math.cos(-heading);

        const canvasX = cx + rotX * scale;
        const canvasY = cy + rotZ * scale;
        const dist = Math.hypot(rotX, rotZ);

        return { canvasX, canvasY, dist, inScope: dist <= maxRange };
      };

      // Draw Ground Buildings
      state.buildings.forEach(b => {
        const p = projectToRadar(b.position);
        if (p.inScope) {
          ctx.fillStyle = 'rgba(234, 88, 12, 0.6)';
          ctx.fillRect(p.canvasX - 2, p.canvasY - 2, 4, 4);
        }
      });

      // Draw Enemies
      state.enemies.forEach(enemy => {
        const p = projectToRadar(enemy.position);
        let plotX = p.canvasX;
        let plotY = p.canvasY;

        // If outside scope, clamp to outer rim
        if (!p.inScope) {
          const angle = Math.atan2(plotY - cy, plotX - cx);
          plotX = cx + (radius - 6) * Math.cos(angle);
          plotY = cy + (radius - 6) * Math.sin(angle);
        }

        const isLocked = state.lockedTargetId === enemy.id;

        // Target blip
        ctx.beginPath();
        ctx.arc(plotX, plotY, isLocked ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isLocked ? '#ef4444' : '#f87171';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Locked target diamond indicator
        if (isLocked) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(plotX - 6, plotY - 6, 12, 12);
        }

        // Relative altitude indicator (+ if above, - if below)
        const altDiff = enemy.position.y - state.playerPos.y;
        ctx.fillStyle = isLocked ? '#ef4444' : '#fca5a5';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        if (altDiff > 50) {
          ctx.fillText('▲', plotX, plotY - 6);
        } else if (altDiff < -50) {
          ctx.fillText('▼', plotX, plotY + 11);
        }
      });

      // Draw Missiles
      state.projectiles.filter(p => p.type === 'missile' || p.type === 'ground-missile').forEach(proj => {
        const p = projectToRadar(proj.position);
        if (p.inScope) {
          ctx.beginPath();
          ctx.arc(p.canvasX, p.canvasY, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = proj.owner === 'player' ? '#38bdf8' : '#eab308';
          ctx.shadowColor = proj.owner === 'player' ? '#38bdf8' : '#eab308';
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw Player Aircraft Symbol at Center (Always pointing UP)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;

      // Jet icon: nose pointing UP
      ctx.beginPath();
      ctx.moveTo(0, -8);   // Nose
      ctx.lineTo(2, -2);
      ctx.lineTo(8, 2);    // Right wingtip
      ctx.lineTo(2, 2);
      ctx.lineTo(2, 6);
      ctx.lineTo(5, 8);    // Right stabilizer
      ctx.lineTo(0, 7);    // Tail center
      ctx.lineTo(-5, 8);   // Left stabilizer
      ctx.lineTo(-2, 6);
      ctx.lineTo(-2, 2);
      ctx.lineTo(-8, 2);   // Left wingtip
      ctx.lineTo(-2, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore(); // End clipping

      // Outer Glow & Frame
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Top Header: Heading readout
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`HDG ${headingDeg.toString().padStart(3, '0')}°`, cx, 12);

      // Bottom Info: Range & Active Target count
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';
      ctx.fillText(`RNG 3.5KM`, cx, height - 3);

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div
      className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} pointer-events-none select-none z-30 ${className}`}
      style={{ width: '192px', height: '192px' }}
    >
      <canvas
        ref={canvasRef}
        width={192}
        height={192}
        className="w-full h-full rounded-full shadow-[0_0_15px_rgba(34,197,94,0.2)]"
      />
    </div>
  );
}
