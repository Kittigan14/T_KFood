const faders = document.querySelectorAll('.fade-slide');
const productFaders = document.querySelectorAll('#productList .fade-slide');

const observer1 = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('show');
    }
  });
}, { threshold: 0.2 });

faders.forEach(el => observer1.observe(el));