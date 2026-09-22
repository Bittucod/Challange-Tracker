// Lightweight Canvas Confetti Generator (Zero external dependencies)
export function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '10000';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const colors = ['#22C55E', '#34B27B', '#F59E0B', '#10B981', '#FBBF24', '#171918'];
  const particleCount = 75;
  const particles: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    vx: number;
    vy: number;
    angle: number;
    angularVelocity: number;
    opacity: number;
  }> = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: width * (0.3 + Math.random() * 0.4),
      y: height * 0.4,
      w: Math.random() * 7 + 4,
      h: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      angle: Math.random() * 360,
      angularVelocity: (Math.random() - 0.5) * 8,
      opacity: 1
    });
  }

  let animationFrameId = 0;
  const startTime = Date.now();
  const duration = 2800; // ms

  function render() {
    if (!ctx) return;

    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      cancelAnimationFrame(animationFrameId);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4; // gravity
      p.vx *= 0.98; // air resistance
      p.angle += p.angularVelocity;
      p.opacity = Math.max(0, 1 - elapsed / duration);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    animationFrameId = requestAnimationFrame(render);
  }

  animationFrameId = requestAnimationFrame(render);
}
