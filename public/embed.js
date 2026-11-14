/*! Agents Automated: isolated county and single-ZIP report embeds. */
(function () {
  'use strict';
  var script = document.currentScript;
  var origin = new URL(script && script.src || 'https://agentsautomated.com/embed.js', location.href).origin;
  var config = window.AA_BLOG_CONFIG || {};
  document.querySelectorAll('[data-agent]#aa-reports, [data-zip]#aa-blog, [data-aa-embed]').forEach(function (mount, i) {
    if (mount.dataset.aaMounted) return;
    mount.dataset.aaMounted = 'true';
    var agent = mount.dataset.agent || '', zip = mount.dataset.zip || '';
    var key = 'aa-' + (mount.id || String(i));
    var frame = document.createElement('iframe');
    var url = new URL('/embed/', origin);
    if (agent) url.searchParams.set('agent', agent);
    if (zip) url.searchParams.set('zip', zip);
    if (mount.dataset.base || config.base) url.searchParams.set('base', mount.dataset.base || config.base);
    url.searchParams.set('parentOrigin', location.protocol === 'file:' ? 'null' : location.origin);
    function savedHash() {
      var params = new URLSearchParams(location.hash.slice(1));
      return params.get(key) || (zip && params.get('post') ? 'view=report&zip=' + encodeURIComponent(zip) + '&post=' + encodeURIComponent(params.get('post')) : '');
    }
    url.hash = savedHash();
    frame.title = agent ? 'County market reports' : 'ZIP ' + zip + ' market reports';
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('allow', 'fullscreen');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.style.cssText = 'display:block!important;width:100%!important;max-width:100%!important;min-height:0!important;max-height:none!important;border:0!important;padding:0!important;margin:0!important;height:1000px!important;background:#fff;color-scheme:light;';
    frame.src = url.href;
    mount.replaceChildren(frame);
    function viewportOffset() {
      var rect = frame.getBoundingClientRect();
      frame.contentWindow.postMessage({ type: 'aa-viewport-offset', top: Math.max(0, Math.min(-rect.top, rect.height - 220)) }, origin);
    }
    frame.addEventListener('load', viewportOffset);
    window.addEventListener('scroll', viewportOffset, { passive: true });
    window.addEventListener('resize', viewportOffset);

    window.addEventListener('message', function (event) {
      if (event.source !== frame.contentWindow || event.origin !== origin || !event.data) return;
      if (event.data.type === 'aa-height' && Number.isFinite(event.data.height)) frame.style.setProperty('height', Math.max(300, Math.min(100000, event.data.height)) + 'px', 'important');
      if (event.data.type === 'aa-state' && typeof event.data.hash === 'string' && event.data.hash.length < 2000) {
        var params = new URLSearchParams(location.hash.slice(1));
        if (params.get(key) === event.data.hash) return;
        var before = new URLSearchParams(params.get(key) || ''), after = new URLSearchParams(event.data.hash);
        if (['view', 'post', 'page', 'zip'].some(function (k) { return before.get(k) !== after.get(k); })) frame.scrollIntoView({ block: 'start' });
        params.set(key, event.data.hash);
        location.hash = params.toString();
      }
    });
    window.addEventListener('hashchange', function () {
      frame.contentWindow.postMessage({ type: 'aa-navigate', hash: savedHash() }, origin);
    });
  });
})();
