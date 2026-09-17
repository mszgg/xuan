(() => {
  let widgetId;
  let ready;

  function loadApi() {
    if (window.turnstile) return Promise.resolve();
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('安全验证组件无法加载，请稍后重试。'));
      document.head.append(script);
    });
    return ready;
  }

  async function ensureWidget(form) {
    const sitekey = document.documentElement.dataset.turnstileSitekey;
    if (!sitekey) throw new Error('网站安全验证尚未配置。');
    await loadApi();
    if (widgetId !== undefined) return;
    const host = document.createElement('div');
    host.className = 'turnstile-widget';
    host.setAttribute('aria-label', '安全验证');
    const status = form.querySelector('.form-status');
    (status || form.querySelector('.submit')).before(host);
    widgetId = window.turnstile.render(host, {
      sitekey,
      theme: 'auto',
      language: 'zh-cn'
    });
  }

  window.getTurnstileToken = async form => {
    await ensureWidget(form);
    const token = window.turnstile.getResponse(widgetId);
    if (!token) throw new Error('请先完成安全验证。');
    return token;
  };

  window.resetTurnstile = () => {
    if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
  };
})();
