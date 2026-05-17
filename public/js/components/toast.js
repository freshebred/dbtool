/**
 * toast.js — Lightweight toast notification system
 */
window.Toast = (function() {
  const ICONS = {
    success: '#ic-check',
    error:   '#ic-alert',
    info:    '#ic-alert',
  };

  function show(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <svg width="18" height="18"><use href="${ICONS[type] || ICONS.info}"/></svg>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    const remove = () => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    setTimeout(remove, duration);
    return { remove };
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error', dur || 4000),
    info:    (msg, dur) => show(msg, 'info', dur),
  };
})();
