var btn = document.getElementById('theme-toggle');
if (btn) {
    btn.addEventListener('click', function () {
        var currentTheme = document.documentElement.getAttribute('data-bs-theme');
        var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme); // Remember choice
    });
}
// Apply saved theme on page load
var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
var savedTheme = localStorage.getItem('theme') || systemTheme;
document.documentElement.setAttribute('data-bs-theme', savedTheme);
