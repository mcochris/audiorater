const btn = document.getElementById('theme-toggle');

if (btn) {
	btn.addEventListener('click', () => {
		const currentTheme = document.documentElement.getAttribute('data-bs-theme');
		const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

		document.documentElement.setAttribute('data-bs-theme', newTheme);
		localStorage.setItem('theme', newTheme); // Remember choice
	});
}

// Apply saved theme on page load
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
	? 'dark'
	: 'light';
const savedTheme = localStorage.getItem('theme') || systemTheme;
document.documentElement.setAttribute('data-bs-theme', savedTheme);
