// Lógica do Menu Hambúrguer / Sidebar
document.addEventListener('DOMContentLoaded', () => {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('appSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebarClose = document.getElementById('sidebarClose');

  if (!sidebarToggle || !sidebar || !sidebarOverlay || !sidebarClose) return;

  function openMenu() {
    sidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
  }

  function closeMenu() {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  }

  sidebarToggle.addEventListener('click', openMenu);
  sidebarClose.addEventListener('click', closeMenu);
  sidebarOverlay.addEventListener('click', closeMenu);
});
