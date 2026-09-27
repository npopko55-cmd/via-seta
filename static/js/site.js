/* VIA SETA — site behaviour. Vanilla JS, no libraries, no external requests. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.add('js');
  var DATA = {};
  try { DATA = JSON.parse((d.getElementById('vs-data') || {}).textContent || '{}'); } catch (err) { DATA = {}; }
  var T = DATA.t || {}, C = DATA.contacts || {};
  var page = d.querySelector('.page');
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

  function $(s, el) { return (el || d).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || d).querySelectorAll(s)); }
  function fmt(s, o) { return String(s || '').replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function visible(el) { return !el.hidden && !el.closest('[hidden]') && (el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function trap(els, e) {
    if (e.key !== 'Tab') return;
    var f = [];
    els.forEach(function (c) { if (c.matches && c.matches(FOCUSABLE)) f.push(c); f = f.concat($$(FOCUSABLE, c)); });
    f = f.filter(visible);
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1], a = d.activeElement, inside = f.indexOf(a) > -1;
    if (e.shiftKey && (a === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !inside)) { e.preventDefault(); first.focus(); }
  }
  function lockPage(on) {
    d.body.classList.toggle('is-locked', on);
    if (!page) return;
    if (on) page.setAttribute('inert', ''); else page.removeAttribute('inert');
  }

  /* ---------- reveal on scroll */
  var rv = $$('.rv');
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !still) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    rv.forEach(function (el) { io.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- mobile menu */
  var burger = $('.hdr__burger'), mnav = $('#mnav'), menuOpen = false;
  function setMenu(open) {
    if (!burger || !mnav) return;
    menuOpen = open;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? T.menu_close : T.menu_open);
    mnav.hidden = !open;
    d.body.classList.toggle('menu-open', open);
    if (open) { var a = $('a', mnav); if (a) a.focus(); }
  }
  function closeMenu() { if (menuOpen) setMenu(false); }
  if (burger) burger.addEventListener('click', function () { setMenu(!menuOpen); });
  if (mnav) mnav.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
  window.addEventListener('resize', function () { if (menuOpen && window.innerWidth > 1024) closeMenu(); });

  /* ---------- clipboard */
  function copyText(text, cb) {
    function fallback() {
      var prev = d.activeElement, ta = d.createElement('textarea'), ok = false;
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      d.body.appendChild(ta); ta.select();
      try { ta.setSelectionRange(0, text.length); ok = d.execCommand('copy'); } catch (err) { ok = false; }
      d.body.removeChild(ta);
      if (prev && prev.focus) prev.focus();
      cb(ok);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { cb(true); }, fallback);
    } else { fallback(); }
  }

  /* ---------- request window */
  var modal = $('#vs-modal'), mBox = modal && $('.modal__box', modal);
  var mTitle = modal && $('#vs-modal-title'), mBody = modal && $('.modal__body', modal);
  var mStatus = modal && $('.modal__status', modal), mReturn = null;
  var hasContacts = !!(C.telegram || C.whatsapp || C.wechat || C.email);
  var KIND = {
    price: ['m_price', 'msg_price'], selection: ['m_selection', 'msg_selection'],
    project: ['m_project', 'msg_project'], trip: ['m_trip', 'msg_trip'],
    curtains: ['m_curtains', 'msg_curtains'], contact: ['m_contact', 'msg_selection'], form: ['m_form', null]
  };
  function messengers(msg) {
    var h = '';
    if (C.telegram) h += '<a class="btn btn--ghost btn--sm" href="https://t.me/' + esc(C.telegram) + '" target="_blank" rel="noopener">Telegram</a>';
    if (C.whatsapp) h += '<a class="btn btn--ghost btn--sm" href="https://wa.me/' + esc(C.whatsapp) + (msg ? '?text=' + esc(encodeURIComponent(msg)) : '') + '" target="_blank" rel="noopener">WhatsApp</a>';
    if (C.email) h += '<a class="btn btn--ghost btn--sm" href="mailto:' + esc(C.email) + '?subject=' + esc(encodeURIComponent(T.email_subject || '')) + (msg ? '&amp;body=' + esc(encodeURIComponent(msg)) : '') + '">E-mail</a>';
    var out = h ? '<div class="modal__links">' + h + '</div>' : '';
    if (C.wechat) {
      out += '<div class="modal__wechat"><span>WeChat · ' + esc(T.m_wechat_id) + ': <strong>' + esc(C.wechat) + '</strong></span>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-copy="' + esc(C.wechat) + '">' + esc(T.m_copy) + '</button></div>';
    }
    return out;
  }
  function lead(text) { return '<p class="' + (hasContacts ? 'modal__lead' : 'modal__none') + '">' + esc(text) + '</p>'; }
  function openModal(o, opener) {
    if (!modal) return;
    var k = KIND[o.kind] || KIND.selection;
    var msg = o.msg || fmt(T[k[1]], { name: o.name || '', ref: o.ref || '' });
    var h = '';
    if (o.ref) {
      h += lead(hasContacts ? T.m_lead_ref : T.m_none_ref);
      h += '<div class="modal__ref"><div><span class="lbl">' + esc(T.m_ref) + '</span><span class="modal__refv">' + esc(o.ref) + '</span>' +
        (o.name ? '<span class="modal__refn">' + esc(o.name) + '</span>' : '') + '</div>' +
        '<button class="btn btn--sm" type="button" data-copy="' + esc(o.ref) + '">' + esc(T.m_copy) + '</button></div>';
    } else if (o.msg) {
      h += lead(hasContacts ? T.m_lead_msg : T.m_none_msg);
      h += '<pre class="modal__msg">' + esc(o.msg) + '</pre>' +
        '<button class="btn btn--block" type="button" data-copy="' + esc(o.msg) + '">' + esc(T.m_copy_request) + '</button>';
    } else {
      h += lead(hasContacts ? T.m_lead : T.m_none);
    }
    h += messengers(msg);
    mTitle.textContent = T[k[0]] || '';
    mBody.innerHTML = h;
    mStatus.textContent = '';
    mReturn = opener || d.activeElement;
    modal.hidden = false;
    lockPage(true);
    mBox.scrollTop = 0;
    mBox.focus();
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    lockPage(false);
    if (mReturn && mReturn.focus) mReturn.focus();
  }

  /* ---------- lightbox */
  var lb = $('#vs-lb'), lbImg = lb && $('.lb__img', lb), lbCap = lb && $('.lb__cap', lb);
  var lbItems = [], lbIdx = 0, lbReturn = null;
  function lbShow(i) {
    if (!lbItems.length) return;
    lbIdx = (i + lbItems.length) % lbItems.length;
    var it = lbItems[lbIdx];
    if (it.w && it.h) { lbImg.width = +it.w; lbImg.height = +it.h; }
    lbImg.src = it.src;
    lbImg.alt = it.cap;
    lbCap.textContent = it.cap + (lbItems.length > 1 ? ' · ' + fmt(T.photo_n, { i: lbIdx + 1, n: lbItems.length }) : '');
  }
  function openLb(group, start, opener) {
    if (!lb) return false;
    var byIdx = {};
    $$('[data-lb]').forEach(function (a) {
      if (a.getAttribute('data-lb') !== group) return;
      var k = +a.getAttribute('data-lb-i') || 0;
      if (!byIdx[k]) {
        byIdx[k] = { src: a.getAttribute('href'), cap: a.getAttribute('data-cap') || '', w: a.getAttribute('data-w'), h: a.getAttribute('data-h') };
      }
    });
    lbItems = Object.keys(byIdx).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return byIdx[k]; });
    if (!lbItems.length) return false;
    lbReturn = opener;
    lb.classList.toggle('is-single', lbItems.length < 2);
    lb.hidden = false;
    lockPage(true);
    lbShow(start);
    var x = $('.lb__x', lb);
    if (x) x.focus();
    return true;
  }
  function closeLb() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    lockPage(false);
    lbImg.removeAttribute('src');
    if (lbReturn && lbReturn.focus) lbReturn.focus();
  }
  if (lb) {
    $('.lb__prev', lb).addEventListener('click', function () { lbShow(lbIdx - 1); });
    $('.lb__next', lb).addEventListener('click', function () { lbShow(lbIdx + 1); });
    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) lbShow(lbIdx + (dx < 0 ? 1 : -1));
      sx = null;
    });
  }

  /* ---------- clicks: request window, copy, close, lightbox */
  d.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var el = t.closest('[data-request]');
    if (el) {
      e.preventDefault();
      closeMenu();
      openModal({ kind: el.getAttribute('data-request'), ref: el.getAttribute('data-ref'), name: el.getAttribute('data-name') }, el);
      return;
    }
    el = t.closest('[data-copy]');
    if (el) {
      e.preventDefault();
      var text = el.getAttribute('data-copy');
      if (el._html == null) el._html = el.innerHTML;
      copyText(text, function (ok) {
        if (!ok) { window.prompt(T.m_copy || '', text); return; }
        el.textContent = T.m_copied;
        if (modal && !modal.hidden && mStatus) {
          mStatus.textContent = T.m_copied + ': ' + (text.length > 48 ? text.slice(0, 48) + '…' : text);
        }
        clearTimeout(el._t);
        el._t = setTimeout(function () { el.innerHTML = el._html; }, 1800);
      });
      return;
    }
    el = t.closest('[data-close]');
    if (el) {
      if (el.closest('#vs-modal')) closeModal();
      else if (el.closest('#vs-lb')) closeLb();
      return;
    }
    el = t.closest('[data-lb]');
    if (el && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      var st = el.getAttribute('data-lb-start');
      if (openLb(el.getAttribute('data-lb'), +(st != null ? st : el.getAttribute('data-lb-i')) || 0, el)) e.preventDefault();
    }
  });

  /* ---------- keyboard: Esc, arrows, focus trap */
  d.addEventListener('keydown', function (e) {
    if (modal && !modal.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); } else trap([mBox], e);
      return;
    }
    if (lb && !lb.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeLb(); }
      else if (e.key === 'ArrowLeft') lbShow(lbIdx - 1);
      else if (e.key === 'ArrowRight') lbShow(lbIdx + 1);
      else trap([lb], e);
      return;
    }
    if (menuOpen) {
      if (e.key === 'Escape') { closeMenu(); burger.focus(); } else trap([burger, mnav], e);
    }
  });

  /* ---------- product gallery thumbnails */
  $$('[data-gallery]').forEach(function (g) {
    var main = $('.prod__main', g), mimg = main && $('img', main), thumbs = $$('.thumb', g);
    thumbs.forEach(function (b) {
      b.addEventListener('click', function () {
        thumbs.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        if (!mimg) return;
        mimg.removeAttribute('srcset');
        mimg.width = +b.getAttribute('data-w');
        mimg.height = +b.getAttribute('data-h');
        mimg.src = b.getAttribute('data-src');
        main.classList.toggle('frame--cover', b.getAttribute('data-cover') === '1');
        main.setAttribute('data-lb-start', b.getAttribute('data-i'));
      });
    });
  });

  /* ---------- catalog: chips, search, "show more" */
  var grid = $('[data-grid]');
  if (grid) {
    var cards = $$('.card', grid), pageSize = +grid.getAttribute('data-page') || 12, limit = pageSize, tag = '', q = '';
    var shownEl = $('[data-shown]'), moreWrap = $('[data-more-wrap]'), moreBtn = $('[data-more]');
    var emptyEl = $('[data-empty]'), search = $('[data-search]'), chips = $$('.chip');
    var norm = function (s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[\s\-–—_.·]+/g, ''); };
    cards.forEach(function (c) { c._q = norm(c.getAttribute('data-q')); c._tags = (c.getAttribute('data-tags') || '').split(/\s+/); });
    var apply = function () {
      var nq = norm(q);
      var matched = cards.filter(function (c) {
        return (!tag || c._tags.indexOf(tag) > -1) && (!nq || c._q.indexOf(nq) > -1);
      });
      cards.forEach(function (c) { c.hidden = true; });
      matched.forEach(function (c, i) { c.hidden = i >= limit; });
      if (shownEl) shownEl.textContent = fmt(T.shown, { shown: Math.min(limit, matched.length), total: matched.length });
      if (moreWrap) moreWrap.hidden = matched.length <= limit;
      if (emptyEl) emptyEl.hidden = matched.length > 0;
      return matched;
    };
    chips.forEach(function (ch) {
      ch.addEventListener('click', function () {
        tag = ch.getAttribute('data-tag') || '';
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === ch ? 'true' : 'false'); });
        limit = pageSize;
        apply();
      });
    });
    if (search) {
      search.addEventListener('input', function () { q = search.value.trim(); limit = pageSize; apply(); });
      search.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); search.blur(); } });
    }
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        var before = limit;
        limit += pageSize;
        var matched = apply(), next = matched[before];
        var link = next && $('.card__name a', next);
        if (link) link.focus({ preventScroll: true });
      });
    }
    apply();
  }

  /* ---------- home form: collect a ready-to-send request */
  var form = $('#rform');
  if (form) {
    var sel = form.querySelector('select');
    if (sel) sel.addEventListener('change', function () { sel.classList.toggle('is-set', !!sel.value); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var el = function (n) { return form.elements.namedItem(n); };
      var name = el('name').value.trim(), company = el('company').value.trim();
      var contact = el('contact').value.trim(), what = el('what') ? el('what').value : '';
      var err = $('.rform__err', form);
      el('name').parentNode.classList.toggle('field--bad', !name);
      el('contact').parentNode.classList.toggle('field--bad', !contact);
      if (!name || !contact) {
        if (err) err.hidden = false;
        (name ? el('contact') : el('name')).focus();
        return;
      }
      if (err) err.hidden = true;
      var lines = [T.msg_form_intro, '', T.form_name + ': ' + name];
      if (company) lines.push(T.form_company + ': ' + company);
      lines.push(T.msg_form_contact + ': ' + contact);
      if (what) lines.push(T.msg_form_what + ': ' + what);
      openModal({ kind: 'form', msg: lines.join('\n') }, form.querySelector('[type="submit"]'));
    });
  }

  /* ---------- section tabs: keep the active tab in view */
  var cur = $('.tabs [aria-current]');
  if (cur) {
    var bar = cur.closest('.tabs');
    var delta = cur.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - cur.offsetWidth) / 2;
    if (delta > 0) bar.scrollLeft += delta;
  }
})();
