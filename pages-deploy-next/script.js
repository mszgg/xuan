document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', e => {
  const target = document.querySelector(link.getAttribute('href'));
  if (target) { e.preventDefault(); target.scrollIntoView({behavior:'smooth', block:'start'}); }
}));

// A restrained constellation trail: individual stars accumulate briefly as the pointer moves.
let lastSpark = 0;
document.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch' || event.buttons) return;
  const now = performance.now();
  if (now - lastSpark < 42) return;
  lastSpark = now;

  const count = Math.random() > .72 ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const star = document.createElement('span');
    const large = Math.random() > .78;
    star.className = `cursor-spark${large ? ' cursor-spark--large' : ''}`;
    star.style.setProperty('--x', `${event.clientX + (Math.random() - .5) * 25}px`);
    star.style.setProperty('--y', `${event.clientY + (Math.random() - .5) * 25}px`);
    star.style.setProperty('--turn', `${Math.floor(Math.random() * 90)}deg`);
    document.body.append(star);
    star.addEventListener('animationend', () => star.remove());
  }
});

const backToTop = document.querySelector('.back-to-top');
const updateBackToTop = () => {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
  backToTop.classList.toggle('is-visible', progress >= .18);
};

window.addEventListener('scroll', updateBackToTop, { passive: true });
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
updateBackToTop();
