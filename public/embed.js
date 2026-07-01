/*!
 * Agents Automated — blog embed (embed.js)
 * Drop-in widget: agents paste two lines on their own site and our blog content
 * renders inline. Critically, when a specific post is open it injects a
 * <link rel="canonical"> back to OUR page so WE keep the SEO ranking.
 *
 *   <div id="aa-blog" data-zip="95816"></div>
 *   <script async src="https://agentsautomated.com/embed.js"></script>
 *
 * Self-contained vanilla JS. No framework, no build step. One file.
 */
(function () {
  'use strict';

  // ---- Config -------------------------------------------------------------
  // STUB: point `base` at the real S3/CloudFront origin once provisioned.
  // posts.json is fetched from `{base}/{zip}/posts.json`.
  // `canonicalBase` is the load-bearing SEO target — always OUR domain.
  var DEFAULTS = {
    base: 'https://cdn.agentsautomated.com/market',
    canonicalBase: 'https://agentsautomated.com/market'
  };
  var cfg = assign(assign({}, DEFAULTS), window.AA_BLOG_CONFIG || {});

  var mount = document.getElementById('aa-blog');
  if (!mount) return;

  var zip = (mount.getAttribute('data-zip') || '').trim();
  // Per-embed base override (handy for staging / local dev).
  var base = stripSlash(mount.getAttribute('data-base') || cfg.base);
  var canonicalBase = stripSlash(cfg.canonicalBase);

  if (!zip) {
    injectStyles();
    renderMessage('Configuration needed', 'This embed is missing its data-zip attribute.');
    return;
  }

  injectStyles();
  renderMessage('Loading market updates…', '');

  var state = { data: null };

  fetchJSON(base + '/' + encodeURIComponent(zip) + '/posts.json')
    .then(function (data) {
      state.data = data;
      route(false);
    })
    .catch(function () {
      // 404 / network / parse → graceful "coming soon" (new signup, no content yet).
      clearCanonical();
      renderComingSoon();
    });

  window.addEventListener('hashchange', function () { route(true); });

  // ---- Routing (hash: #post={slug}) --------------------------------------
  function route(userNavigated) {
    if (!state.data) return;
    var slug = currentSlug();
    if (slug) {
      var post = findPost(state.data, slug);
      if (post) {
        renderPost(state.data, post);
        setCanonical(zip, slug); // <-- the whole point
        if (userNavigated) scrollToTop();
        return;
      }
    }
    clearCanonical();
    renderList(state.data);
    if (userNavigated) scrollToTop();
  }

  function currentSlug() {
    var h = location.hash.charAt(0) === '#' ? location.hash.slice(1) : location.hash;
    try { return new URLSearchParams(h).get('post'); } catch (e) { return null; }
  }

  function findPost(data, slug) {
    var posts = data.posts || [];
    for (var i = 0; i < posts.length; i++) if (posts[i].slug === slug) return posts[i];
    return null;
  }

  // ---- Canonical injection (load-bearing SEO) ----------------------------
  // On a post view we make OUR URL the authoritative canonical: set aside any
  // host canonicals, add ours; restore the host's when leaving the post view.
  var ourLink = null;
  var stashedCanonicals = [];

  function setCanonical(zip, slug) {
    var href = canonicalBase + '/' + encodeURIComponent(zip) + '/' + encodeURIComponent(slug);
    if (!ourLink) {
      var existing = document.head.querySelectorAll('link[rel="canonical"]:not([data-aa-blog])');
      for (var i = 0; i < existing.length; i++) {
        stashedCanonicals.push(existing[i]);
        existing[i].parentNode.removeChild(existing[i]);
      }
      ourLink = document.createElement('link');
      ourLink.setAttribute('rel', 'canonical');
      ourLink.setAttribute('data-aa-blog', '');
      document.head.appendChild(ourLink);
    }
    ourLink.setAttribute('href', href);
  }

  function clearCanonical() {
    if (ourLink) { ourLink.parentNode.removeChild(ourLink); ourLink = null; }
    while (stashedCanonicals.length) document.head.appendChild(stashedCanonicals.pop());
  }

  // ---- Views --------------------------------------------------------------
  function renderList(data) {
    var root = fresh();
    var agent = data.agent || {};
    var tier = agent.tier || 'standard';

    if (tier === 'elite') root.appendChild(agentBlock(agent));

    root.appendChild(el('h2', { class: 'aa-h2', text: 'Market updates' }));

    var posts = sortByDateDesc(data.posts || []);
    if (!posts.length) {
      root.appendChild(el('p', { class: 'aa-muted', text: 'No posts published yet — check back soon.' }));
    } else {
      var grid = el('div', { class: 'aa-grid' });
      posts.forEach(function (post) {
        grid.appendChild(card(post));
      });
      root.appendChild(grid);
    }

    if (tier !== 'elite') root.appendChild(agentBlock(agent));
    root.appendChild(poweredBy());
  }

  function card(post) {
    var cover = coverImage(post);
    var a = el('a', { class: 'aa-card', href: '#post=' + encodeURIComponent(post.slug) });
    if (cover) {
      a.appendChild(el('img', { class: 'aa-card-img', src: cover, alt: post.title || '', loading: 'lazy' }));
    }
    var body = el('div', { class: 'aa-card-body' });
    body.appendChild(el('time', { class: 'aa-muted aa-small', datetime: post.date || '', text: formatDate(post.date) }));
    body.appendChild(el('h3', { class: 'aa-card-title', text: post.title || 'Untitled' }));
    if (post.summary) body.appendChild(el('p', { class: 'aa-muted', text: post.summary }));
    a.appendChild(body);
    return a;
  }

  function renderPost(data, post) {
    var root = fresh();
    var agent = data.agent || {};
    var tier = agent.tier || 'standard';

    root.appendChild(
      el('a', { class: 'aa-back', href: '#', text: '← All market updates' })
    );
    root.appendChild(el('h2', { class: 'aa-h2', text: post.title || 'Untitled' }));

    var meta = el('p', { class: 'aa-muted aa-small aa-meta' });
    meta.appendChild(el('time', { datetime: post.date || '', text: formatDate(post.date) }));
    if (agent.name) meta.appendChild(document.createTextNode('  ·  By ' + agent.name));
    root.appendChild(meta);

    if (tier === 'elite') root.appendChild(agentBlock(agent));

    var cover = coverImage(post);
    if (cover) root.appendChild(el('img', { class: 'aa-cover', src: cover, alt: post.title || '', loading: 'eager' }));

    if (hasText(post.videoUrl)) root.appendChild(video(post));

    var metricsEl = metrics(post.metrics);
    if (metricsEl) root.appendChild(metricsEl);

    // Trusted, pipeline-sanitized HTML (same trust model as the canonical site).
    if (hasText(post.bodyHtml)) {
      root.appendChild(el('div', { class: 'aa-body', html: post.bodyHtml }));
    }

    var slides = (post.slideImages || []).filter(hasText);
    // First image is used as the cover above; show the rest as a gallery.
    var gallery = slides.slice(cover ? 1 : 0);
    if (gallery.length) {
      var g = el('div', { class: 'aa-slides' });
      gallery.forEach(function (src, i) {
        g.appendChild(el('img', { src: src, alt: (post.title || 'Image') + ' — ' + (i + 2), loading: 'lazy' }));
      });
      root.appendChild(g);
    }

    if (tier !== 'elite') root.appendChild(agentBlock(agent));
    root.appendChild(disclaimer(agent));
    root.appendChild(poweredBy());
  }

  function renderComingSoon() {
    var root = fresh();
    var box = el('div', { class: 'aa-empty' });
    box.appendChild(el('h2', { class: 'aa-h2', text: 'Local market updates coming soon' }));
    box.appendChild(el('p', { class: 'aa-muted', text: 'Fresh reports for this area are on the way. Check back shortly.' }));
    root.appendChild(box);
    root.appendChild(poweredBy());
  }

  function renderMessage(title, body) {
    var root = fresh();
    var box = el('div', { class: 'aa-empty' });
    box.appendChild(el('h2', { class: 'aa-h2', text: title }));
    if (body) box.appendChild(el('p', { class: 'aa-muted', text: body }));
    root.appendChild(box);
  }

  // ---- Pieces -------------------------------------------------------------
  function agentBlock(agent) {
    var tier = agent.tier || 'standard';
    var first = (agent.name || '').split(' ')[0] || 'us';
    var creds = [agent.brokerage, agent.license].filter(hasText).join('  ·  ');
    var hasSite = hasText(agent.siteUrl);
    var hasCta = hasText(agent.ctaUrl);
    var hasPhoto = hasText(agent.photoUrl);

    if (tier === 'elite') {
      var hero = el('section', { class: 'aa-agent aa-agent--hero' });
      if (hasPhoto) hero.appendChild(el('img', { class: 'aa-agent-photo', src: agent.photoUrl, alt: 'Portrait of ' + (agent.name || 'agent'), loading: 'eager' }));
      var hbody = el('div', {});
      hbody.appendChild(el('span', { class: 'aa-eyebrow', text: 'Your local expert' }));
      hbody.appendChild(el('h3', { class: 'aa-agent-name', text: agent.name || '' }));
      if (creds) hbody.appendChild(el('p', { class: 'aa-muted aa-small', text: creds }));
      var actions = el('div', { class: 'aa-actions' });
      if (hasCta) actions.appendChild(link(agent.ctaUrl, 'Work with ' + first, 'aa-btn', 'nofollow sponsored'));
      if (hasSite) actions.appendChild(link(agent.siteUrl, "Visit " + first + "'s website", 'aa-btn aa-btn--ghost', 'noopener'));
      hbody.appendChild(actions);
      hero.appendChild(hbody);
      return hero;
    }

    if (tier === 'premium') {
      var cardEl = el('section', { class: 'aa-agent aa-agent--card' });
      if (hasPhoto) cardEl.appendChild(el('img', { class: 'aa-agent-photo aa-agent-photo--sm', src: agent.photoUrl, alt: 'Portrait of ' + (agent.name || 'agent'), loading: 'lazy' }));
      cardEl.appendChild(el('span', { class: 'aa-eyebrow', text: 'Presented by' }));
      cardEl.appendChild(hasSite ? link(agent.siteUrl, agent.name || '', 'aa-agent-name aa-link', 'noopener') : el('span', { class: 'aa-agent-name', text: agent.name || '' }));
      if (creds) cardEl.appendChild(el('p', { class: 'aa-muted aa-small', text: creds }));
      if (hasCta) cardEl.appendChild(link(agent.ctaUrl, 'Work with ' + first, 'aa-btn', 'nofollow sponsored'));
      return cardEl;
    }

    // standard
    var strip = el('section', { class: 'aa-agent aa-agent--strip' });
    if (hasPhoto) strip.appendChild(el('img', { class: 'aa-agent-photo aa-agent-photo--xs', src: agent.photoUrl, alt: 'Portrait of ' + (agent.name || 'agent'), loading: 'lazy' }));
    var sbody = el('div', {});
    sbody.appendChild(el('span', { class: 'aa-eyebrow', text: 'Presented by' }));
    var line = el('div', { class: 'aa-small' });
    line.appendChild(hasSite ? link(agent.siteUrl, agent.name || '', 'aa-link', 'noopener') : el('strong', { text: agent.name || '' }));
    if (hasText(agent.brokerage)) line.appendChild(document.createTextNode('  ·  ' + agent.brokerage));
    if (hasCta) { line.appendChild(document.createTextNode('  —  ')); line.appendChild(link(agent.ctaUrl, 'Work with ' + first, 'aa-link', 'nofollow sponsored')); }
    sbody.appendChild(line);
    strip.appendChild(sbody);
    return strip;
  }

  function video(post) {
    var url = post.videoUrl;
    var wrap = el('div', { class: 'aa-video' });

    // Direct file → native <video> (lazy metadata).
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
      var v = el('video', { controls: '', preload: 'metadata', playsinline: '' });
      v.appendChild(el('source', { src: url }));
      wrap.appendChild(v);
      return wrap;
    }

    // Click-to-load facade → zero third-party requests until the user plays.
    var yt = youtubeId(url);
    var btn = el('button', { class: 'aa-play', type: 'button', 'aria-label': 'Play video: ' + (post.title || '') });
    btn.appendChild(el('span', { class: 'aa-play-icon', 'aria-hidden': 'true' }));
    if (yt) {
      wrap.className += ' aa-video--yt';
      wrap.style.backgroundImage = "url(https://i.ytimg.com/vi/" + yt + "/hqdefault.jpg)";
    }
    btn.addEventListener('click', function () {
      var src = yt
        ? 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&rel=0'
        : addAutoplay(url);
      var iframe = el('iframe', {
        src: src, title: post.title || 'Video',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: '', frameborder: '0'
      });
      wrap.style.backgroundImage = '';
      wrap.innerHTML = '';
      wrap.appendChild(iframe);
    });
    wrap.appendChild(btn);
    return wrap;
  }

  function metrics(m) {
    if (!m) return null;
    var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    var num = new Intl.NumberFormat('en-US');
    var FIELDS = [
      { k: 'medianPrice', label: 'Median Price', fmt: function (v) { return usd.format(v); } },
      { k: 'yoyChange', label: 'YoY Change', keepZero: true, fmt: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }, trend: function (v) { return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; } },
      { k: 'inventory', label: 'Active Inventory', fmt: function (v) { return num.format(v); } },
      { k: 'daysOnMarket', label: 'Median Days on Market', fmt: function (v) { return num.format(v); } },
      { k: 'newListings', label: 'New Listings', fmt: function (v) { return num.format(v); } },
      { k: 'pricePerSqft', label: 'Price / Sq Ft', fmt: function (v) { return usd.format(v); } }
    ];
    var rows = FIELDS.filter(function (f) {
      return typeof m[f.k] === 'number' && (m[f.k] !== 0 || f.keepZero);
    });
    if (!rows.length) return null;
    var dl = el('dl', { class: 'aa-metrics', 'aria-label': 'Market metrics' });
    rows.forEach(function (f) {
      var v = m[f.k];
      var cell = el('div', { class: 'aa-metric' });
      cell.appendChild(el('dt', { class: 'aa-metric-label', text: f.label }));
      var dd = el('dd', {});
      dd.appendChild(el('span', { class: 'aa-metric-value', text: f.fmt(v) }));
      if (f.trend) {
        var t = f.trend(v);
        dd.appendChild(el('span', { class: 'aa-metric-change aa-trend-' + t, text: (t === 'up' ? '▲' : t === 'down' ? '▼' : '■') + ' year over year' }));
      }
      cell.appendChild(dd);
      dl.appendChild(cell);
    });
    return dl;
  }

  function disclaimer(agent) {
    var parts = ['Published on behalf of ' + (agent.name || 'our partner agent')];
    if (hasText(agent.brokerage)) parts.push(agent.brokerage);
    var tail = '. Market data is illustrative and not a guarantee of future results.';
    return el('p', { class: 'aa-disclaimer', text: parts.join(', ') + (hasText(agent.license) ? ' (' + agent.license + ')' : '') + tail });
  }

  function poweredBy() {
    var p = el('p', { class: 'aa-powered' });
    p.appendChild(document.createTextNode('Powered by '));
    p.appendChild(link('https://agentsautomated.com', 'Agents Automated', 'aa-link', 'noopener'));
    return p;
  }

  // ---- Helpers ------------------------------------------------------------
  function fresh() {
    mount.innerHTML = '';
    var root = el('div', { class: 'aa-root' });
    mount.appendChild(root);
    return root;
  }

  function coverImage(post) {
    var imgs = post.slideImages || [];
    for (var i = 0; i < imgs.length; i++) if (hasText(imgs[i])) return imgs[i];
    return null;
  }

  function link(href, text, cls, rel) {
    var a = el('a', { href: href, class: cls, text: text });
    if (rel) a.setAttribute('rel', rel);
    // external links open in a new tab so the host page isn't navigated away.
    a.setAttribute('target', '_blank');
    return a;
  }

  function youtubeId(url) {
    var m = String(url).match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function addAutoplay(url) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1';
  }

  function sortByDateDesc(posts) {
    return posts.slice().sort(function (a, b) { return +new Date(b.date) - +new Date(a.date); });
  }

  function formatDate(d) {
    if (!hasText(d)) return '';
    var dt = new Date(d);
    if (isNaN(+dt)) return d;
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function scrollToTop() {
    if (typeof mount.scrollIntoView !== 'function') return;
    try { mount.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { mount.scrollIntoView(); }
  }

  function fetchJSON(url) {
    return fetch(url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function hasText(s) { return typeof s === 'string' && s.trim() !== ''; }
  function stripSlash(s) { return String(s || '').replace(/\/+$/, ''); }
  function assign(t, s) { for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; return t; }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      var v = attrs[k];
      if (v == null) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v);
    }
    if (kids) [].concat(kids).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  // ---- Styles (scoped under #aa-blog; inherits host font, owns layout) ----
  function injectStyles() {
    if (document.getElementById('aa-blog-styles')) return;
    var css = [
      '#aa-blog{display:block;font-family:inherit;color:inherit;line-height:1.6;--aa-accent:#14532d;--aa-line:#e4e7ec;--aa-muted:#5c6470;--aa-soft:#f7f8fa;--aa-up:#157347;--aa-down:#b42318;--aa-radius:12px}',
      '#aa-blog *{box-sizing:border-box}',
      '#aa-blog img{max-width:100%;height:auto;display:block}',
      '#aa-blog .aa-root{max-width:920px;margin:0 auto}',
      '#aa-blog .aa-h2{font-size:1.6em;line-height:1.2;margin:.2em 0 .6em}',
      '#aa-blog .aa-muted{color:var(--aa-muted)}',
      '#aa-blog .aa-small{font-size:.85em}',
      '#aa-blog .aa-link{color:var(--aa-accent);text-decoration:underline}',
      '#aa-blog .aa-meta{margin:.2em 0 1em}',
      '#aa-blog .aa-back{display:inline-block;margin:0 0 .6em;color:var(--aa-accent);text-decoration:none;font-size:.9em}',
      '#aa-blog .aa-back:hover{text-decoration:underline}',
      // grid + cards
      '#aa-blog .aa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin:16px 0}',
      '#aa-blog .aa-card{display:flex;flex-direction:column;border:1px solid var(--aa-line);border-radius:var(--aa-radius);overflow:hidden;text-decoration:none;color:inherit;background:#fff;transition:box-shadow .15s}',
      '#aa-blog .aa-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.08)}',
      '#aa-blog .aa-card-img{aspect-ratio:1200/630;object-fit:cover;width:100%}',
      '#aa-blog .aa-card-body{padding:14px 16px 18px;display:flex;flex-direction:column;gap:6px}',
      '#aa-blog .aa-card-title{font-size:1.1em;line-height:1.25;margin:0}',
      '#aa-blog .aa-card:hover .aa-card-title{color:var(--aa-accent)}',
      // post
      '#aa-blog .aa-cover{border-radius:var(--aa-radius);margin:14px 0}',
      '#aa-blog .aa-body{margin:8px 0}',
      '#aa-blog .aa-body h2{font-size:1.3em;margin:1.4em 0 .4em}',
      '#aa-blog .aa-body p{margin:0 0 1em}',
      '#aa-blog .aa-slides{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:18px 0}',
      '#aa-blog .aa-slides img{border-radius:10px}',
      '#aa-blog .aa-disclaimer{font-size:.78em;color:var(--aa-muted);margin-top:22px}',
      // video (16:9, click-to-load facade)
      '#aa-blog .aa-video{position:relative;aspect-ratio:16/9;margin:18px 0;border-radius:var(--aa-radius);overflow:hidden;background:#000 center/cover no-repeat}',
      '#aa-blog .aa-video iframe,#aa-blog .aa-video video{position:absolute;inset:0;width:100%;height:100%;border:0}',
      '#aa-blog .aa-play{position:absolute;inset:0;width:100%;height:100%;border:0;cursor:pointer;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}',
      '#aa-blog .aa-play:hover{background:rgba(0,0,0,.18)}',
      '#aa-blog .aa-play-icon{width:68px;height:48px;border-radius:12px;background:rgba(20,20,20,.82);position:relative}',
      '#aa-blog .aa-play:hover .aa-play-icon{background:#c4302b}',
      '#aa-blog .aa-play-icon:after{content:"";position:absolute;top:50%;left:50%;transform:translate(-40%,-50%);border-style:solid;border-width:11px 0 11px 18px;border-color:transparent transparent transparent #fff}',
      // metrics
      '#aa-blog .aa-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0;padding:0}',
      '#aa-blog .aa-metric{border:1px solid var(--aa-line);border-radius:10px;padding:12px 14px;background:var(--aa-soft)}',
      '#aa-blog .aa-metric-label{font-size:.72em;text-transform:uppercase;letter-spacing:.04em;color:var(--aa-muted)}',
      '#aa-blog .aa-metric dd{margin:4px 0 0}',
      '#aa-blog .aa-metric-value{display:block;font-size:1.4em;font-weight:700}',
      '#aa-blog .aa-metric-change{display:block;font-size:.8em;font-weight:600;margin-top:2px}',
      '#aa-blog .aa-trend-up{color:var(--aa-up)}#aa-blog .aa-trend-down{color:var(--aa-down)}#aa-blog .aa-trend-flat{color:var(--aa-muted)}',
      // agent blocks
      '#aa-blog .aa-eyebrow{display:block;font-size:.72em;text-transform:uppercase;letter-spacing:.06em;color:#b8860b;font-weight:700}',
      '#aa-blog .aa-agent-name{font-size:1.25em;font-weight:700;margin:2px 0 4px}',
      '#aa-blog .aa-agent-photo{width:120px;height:120px;border-radius:50%;object-fit:cover}',
      '#aa-blog .aa-agent-photo--sm{width:80px;height:80px}#aa-blog .aa-agent-photo--xs{width:46px;height:46px}',
      '#aa-blog .aa-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}',
      '#aa-blog .aa-btn{display:inline-block;background:var(--aa-accent);color:#fff;padding:10px 18px;border-radius:8px;font-weight:600;text-decoration:none;border:1px solid var(--aa-accent)}',
      '#aa-blog .aa-btn:hover{opacity:.92}',
      '#aa-blog .aa-btn--ghost{background:transparent;color:var(--aa-accent)}',
      '#aa-blog .aa-agent--hero{display:grid;grid-template-columns:1fr;gap:18px;align-items:center;border:1px solid var(--aa-line);border-radius:var(--aa-radius);background:var(--aa-soft);padding:20px;margin:16px 0}',
      '@media(min-width:640px){#aa-blog .aa-agent--hero{grid-template-columns:120px 1fr}}',
      '#aa-blog .aa-agent--card{border:1px solid var(--aa-line);border-radius:var(--aa-radius);background:var(--aa-soft);padding:18px;margin:22px 0;text-align:left}',
      '#aa-blog .aa-agent--card .aa-btn{margin-top:12px}',
      '#aa-blog .aa-agent--strip{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--aa-line);border-radius:var(--aa-radius);background:var(--aa-soft);padding:14px 16px;margin:22px 0}',
      '#aa-blog .aa-agent--strip .aa-agent-name{font-size:1em;margin:0}',
      // empty / powered
      '#aa-blog .aa-empty{border:1px dashed var(--aa-line);border-radius:var(--aa-radius);padding:32px 24px;text-align:center;background:var(--aa-soft)}',
      '#aa-blog .aa-powered{margin-top:22px;padding-top:14px;border-top:1px solid var(--aa-line);font-size:.78em;color:var(--aa-muted)}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'aa-blog-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
