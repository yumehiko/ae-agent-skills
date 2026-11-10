// Source is editable code. Every frame is computed from time + the same seeded random stream.
const canvas = document.querySelector('#scene');
const ctx = canvas.getContext('2d');
const star = new Image();
star.src = './star.svg';
window.sceneReady = star.decode();
window.renderFrame = ({ width, height, time, random }) => {
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  for (let i = 0; i < 18; i++) {
    const startX = random() * width;
    const startY = random() * (height + 100);
    const size = 22 + random() * 26;
    const speed = 26 + random() * 45;
    const phase = random() * Math.PI * 2;
    const x = startX + Math.sin(time * 1.6 + phase) * 24;
    const y = ((startY + time * speed) % (height + 100)) - 50;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time + phase) * 0.5);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(phase) ** 2;
    ctx.drawImage(star, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
};
