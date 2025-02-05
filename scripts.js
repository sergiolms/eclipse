const starsContainer = document.querySelector('.stars');
for (let i = 0; i < 200; i++) {
  const star = document.createElement('div');
  star.classList.add('star');
  star.style.width = `${Math.random() * 3}px`;
  star.style.height = star.style.width;
  star.style.top = `${Math.random() * 100}%`;
  star.style.left = `${Math.random() * 100}%`;
  star.style.animationDuration = `${Math.random() * 2 + 1}s`;
  starsContainer.appendChild(star);
}

const cloudsContainer = document.querySelector('.clouds');
for (let i = 0; i < 5; i++) {
  const cloud = document.createElement('div');
  cloud.classList.add('cloud');
  cloud.style.width = `${Math.random() * 300 + 200}px`;
  cloud.style.height = `${Math.random() * 100 + 50}px`;
  cloud.style.bottom = `${Math.random() * 50}px`;
  cloud.style.animationDuration = `${Math.random() * 30 + 30}s`;
  cloud.style.opacity = Math.random() * 0.3 + 0.2;
  cloudsContainer.appendChild(cloud);
} 