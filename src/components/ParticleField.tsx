"use client";

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; radius: number; color: string; speed: number };
const COLORS = ["#8052ff", "#ffb829", "#15846e", "#bdbdbd"];

function createParticles(width: number, height: number): Particle[] {
  return Array.from({ length: 42 }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.7 + (index % 3) * 0.45,
    color: COLORS[index % COLORS.length],
    speed: 0.08 + (index % 4) * 0.025,
  }));
}

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animationFrame = 0;
    let particles: Particle[] = [];
    let paused = document.hidden;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = createParticles(window.innerWidth, window.innerHeight);
    };
    const draw = () => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach((particle) => {
        particle.y -= particle.speed;
        if (particle.y < -4) particle.y = window.innerHeight + 4;
        context.globalAlpha = 0.35;
        context.fillStyle = particle.color;
        context.beginPath();
        context.moveTo(particle.x, particle.y - particle.radius);
        context.lineTo(particle.x + particle.radius, particle.y + particle.radius);
        context.lineTo(particle.x - particle.radius, particle.y + particle.radius);
        context.closePath();
        context.fill();
      });
      context.globalAlpha = 1;
      if (!paused) animationFrame = window.requestAnimationFrame(draw);
    };
    const onVisibilityChange = () => {
      paused = document.hidden;
      if (!paused) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(draw);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!paused) animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-full w-full" aria-hidden="true" />;
}
