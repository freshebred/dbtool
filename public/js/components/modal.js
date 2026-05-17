/**
 * modal.js — Bottom sheet modal controller
 * Handles the add-connection and confirm modals.
 */
window.Modal = (function() {
  function open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    // Trap focus on first input
    const first = el.querySelector('input, button');
    if (first) setTimeout(() => first.focus(), 100);
    // Close on backdrop click
    el._backdropHandler = (e) => {
      if (e.target === el) close(id);
    };
    el.addEventListener('click', el._backdropHandler);
  }

  function close(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    if (el._backdropHandler) {
      el.removeEventListener('click', el._backdropHandler);
      el._backdropHandler = null;
    }
  }

  /**
   * Show a confirmation dialog.
   * Returns a Promise that resolves true (confirmed) or false (cancelled).
   */
  function confirm(title, body, confirmLabel = 'Delete') {
    return new Promise(resolve => {
      document.getElementById('modal-confirm-title').textContent = title;
      document.getElementById('modal-confirm-body').textContent = body;
      document.getElementById('btn-confirm-ok').textContent = confirmLabel;

      const ok = document.getElementById('btn-confirm-ok');
      const cancel = document.getElementById('btn-confirm-cancel');

      function cleanup(result) {
        close('modal-confirm');
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        resolve(result);
      }

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);

      ok.addEventListener('click', onOk, { once: true });
      cancel.addEventListener('click', onCancel, { once: true });

      open('modal-confirm');
    });
  }

  return { open, close, confirm };
})();
