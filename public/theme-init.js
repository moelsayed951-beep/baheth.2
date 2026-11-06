// تطبيق الوضع الليلي قبل التحميل لمنع الوميض (ملف خارجي ليعمل مع CSP بلا unsafe-inline)
try {
  var t = localStorage.getItem('baheth-theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
