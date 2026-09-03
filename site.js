/* Noodle Inn — unified content + language engine.
   Loads the editable content (English + Chinese) and applies it to the live
   page. A floating button toggles English / 中文. Matches DOM by the ORIGINAL
   English text, so it survives React re-renders and admin edits alike. */
(function () {
  'use strict';

  var mode = 'en';
  try { mode = localStorage.getItem('ni-lang') || 'en'; } catch (e) {}
  if (/[?&#]lang=zh/.test(location.href)) mode = 'zh';

  var DEFAULTS = null, SAVED = null, btn = null;
  var CONTACT_TO = 'noodle@kqbellc.com';   // contact-form recipient (temp test address)
  var applying = false;
  var orig = new WeakMap();       // text node -> its pristine (original English) value
  var generic = {};               // original English string -> {en, zh}

  function pick(entry) {
    if (!entry) return null;
    if (mode === 'zh') return entry.zh || entry.en || null;
    return entry.en != null ? entry.en : null;
  }

  function buildGeneric() {
    generic = {};
    var text = (SAVED && SAVED.text) || (DEFAULTS && DEFAULTS.text) || {};
    Object.keys(text).forEach(function (k) { generic[k] = text[k]; });
    // category name + description are unique strings -> handle generically
    var dcats = (DEFAULTS && DEFAULTS.menu) || [];
    var scats = (SAVED && SAVED.menu) || dcats;
    dcats.forEach(function (dc, i) {
      var sc = scats[i] || dc;
      if (dc.name) generic[dc.name] = { en: sc.name, zh: sc.name_zh };
      if (dc.description) generic[dc.description] = { en: sc.description, zh: sc.description_zh };
    });
  }

  function walkText(fn) {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        if (p === 'SCRIPT' || p === 'STYLE') return NodeFilter.FILTER_REJECT;
        if (n.parentNode && n.parentNode.id === 'ni-lang-toggle') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = w.nextNode())) fn(n);
  }

  function setNode(node, target) {
    if (target == null) return;
    var t = node.nodeValue, trimmed = t.trim();
    if (!orig.has(node)) orig.set(node, t);
    if (trimmed === target) return;
    node.nodeValue = t.replace(trimmed, target);
  }

  function applyGeneric() {
    walkText(function (node) {
      var key = orig.has(node) ? orig.get(node).trim() : node.nodeValue.trim();
      if (!key) return;
      var entry = generic[key];
      if (entry) setNode(node, pick(entry) || key);
    });
  }

  function findItemNodes(origName) {
    var h4s = document.querySelectorAll('#menu h4'), i;
    for (i = 0; i < h4s.length; i++) {
      var h4 = h4s[i];
      var tn = h4.firstChild && h4.firstChild.nodeType === 3 ? h4.firstChild : null;
      if (!tn) continue;
      var key = orig.has(tn) ? orig.get(tn).trim() : tn.nodeValue.trim();
      if (key === origName) return h4;
    }
    return null;
  }

  function applyMenu() {
    var dcats = (DEFAULTS && DEFAULTS.menu) || [];
    var scats = (SAVED && SAVED.menu) || dcats;
    dcats.forEach(function (dc, i) {
      var sc = scats[i]; if (!sc) return;
      (dc.items || []).forEach(function (di, j) {
        var si = sc.items && sc.items[j]; if (!si) return;
        var h4 = findItemNodes(di.name); if (!h4) return;
        var nameNode = h4.firstChild && h4.firstChild.nodeType === 3 ? h4.firstChild : null;
        if (nameNode) setNode(nameNode, mode === 'zh' ? (si.name_zh || si.name) : si.name);
        var row = h4.closest('.group') || h4.parentNode.parentNode;
        var priceEl = row && row.querySelector('span');
        if (priceEl && priceEl.firstChild && priceEl.firstChild.nodeType === 3 && si.price != null)
          setNode(priceEl.firstChild, si.price);
        var box = h4.parentNode;
        var noteEl = box && box.querySelector('p');
        var noteTarget = mode === 'zh' ? (si.note_zh || si.note) : si.note;
        if (noteTarget) {
          if (noteEl && noteEl.firstChild && noteEl.firstChild.nodeType === 3) setNode(noteEl.firstChild, noteTarget);
          else if (!noteEl) {
            noteEl = document.createElement('p');
            noteEl.className = 'text-text-muted text-xs mt-0.5 italic';
            noteEl.textContent = noteTarget;
            box.appendChild(noteEl);
          }
        } else if (noteEl && noteEl.firstChild) {
          noteEl.firstChild.nodeValue = '';
        }
      });
    });
  }

  function applyLinks() {
    var text = (SAVED && SAVED.text) || {};
    var phone = text['0114 255 4488'];
    if (phone) {
      var tel = document.querySelector('a[href^="tel:"]');
      if (tel) tel.setAttribute('href', 'tel:' + (phone.en || '0114 255 4488').replace(/\s/g, ''));
    }
  }

  function applyAll() {
    if (!DEFAULTS && !SAVED) return;
    applying = true;
    applyGeneric();
    applyMenu();
    applyLinks();
    document.documentElement.lang = mode === 'zh' ? 'zh-HK' : 'en';
    if (btn) btn.textContent = mode === 'zh' ? 'English' : '中文';
    applying = false;
  }

  function ensureIntro() {
    // remove the old standalone "Our Story" video section if present
    var old = document.getElementById('intro');
    if (old) old.remove();
    // full-bleed looping background video in the hero
    var home = document.getElementById('home');
    if (!home) return;
    if (!home.querySelector('video.ni-hero-vid')) {
      var v = document.createElement('video');
      v.className = 'ni-hero-vid';
      v.autoplay = true; v.loop = true; v.muted = true; v.defaultMuted = true;
      v.setAttribute('muted', ''); v.setAttribute('autoplay', '');
      v.setAttribute('loop', ''); v.setAttribute('playsinline', '');
      v.playsInline = true; v.preload = 'auto'; v.poster = '/intro-poster.jpg';
      v.innerHTML = '<source src="/intro-hero.mp4" type="video/mp4" />';
      home.insertBefore(v, home.firstChild);
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
  }

  function relinkMenu() {
    // Menu now lives on its own page — send all "Menu" links there
    var links = document.querySelectorAll('a[href="#menu"]');
    for (var i = 0; i < links.length; i++) links[i].setAttribute('href', '/menu');
  }

  function relinkContact() {
    // "Contact" nav/footer links go to the dedicated contact page (Reserve buttons keep #contact)
    var links = document.querySelectorAll('a[href="#contact"]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].textContent.trim() === 'Contact') links[i].setAttribute('href', '/contact');
    }
  }

  function relinkReserve() {
    // "Reserve" buttons go to the contact page (works on every device; phones can tap-to-call there)
    var links = document.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      var t = (links[i].textContent || '').trim();
      if (t === 'Reserve' || t === 'Reserve a Table') {
        links[i].setAttribute('href', '/contact');
        links[i].removeAttribute('target');
        links[i].removeAttribute('rel');
      }
    }
  }

  function relinkMobileMenu() {
    // in the mobile slide-out menu, "Menu" scrolls to the on-page Menus & Ordering section
    var ov = document.querySelector('[class*="z-[999]"]');
    if (!ov) return;
    var links = ov.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      if ((links[i].textContent || '').trim() === 'Menu') links[i].setAttribute('href', '#ni-order');
    }
  }

  function ensureWhatsNew() {
    var PILL = 'background:#c99a45;color:#1a1a1a;padding:.5rem 1.05rem;border-radius:999px;font-weight:800;font-size:1rem;white-space:nowrap;box-shadow:0 2px 12px rgba(201,154,69,.45);text-transform:none;letter-spacing:0;text-decoration:none';
    var row = document.querySelector('nav .items-center.justify-between');
    var cta = row && row.querySelector(':scope > .ni-cta');
    if (cta && !cta.querySelector('a.ni-whatsnew')) {
      var a = document.createElement('a');
      a.className = 'ni-whatsnew'; a.href = '/whats-new'; a.textContent = "What's New!";
      a.style.cssText = PILL;
      cta.insertBefore(a, cta.firstChild);
    }
    var ov = document.querySelector('[class*="z-[999]"] .gap-5');
    if (ov && !ov.querySelector('a.ni-whatsnew')) {
      var m = document.createElement('a');
      m.className = 'ni-whatsnew'; m.href = '/whats-new'; m.textContent = "What's New!";
      m.style.cssText = PILL + ';font-size:1.25rem;margin-top:.5rem';
      ov.appendChild(m);
    }
  }

  function applyMedia() {
    var m = (SAVED && SAVED.media) || (DEFAULTS && DEFAULTS.media);
    if (!m) return;
    if (m.heroVideo) {
      var v = document.querySelector('#home video.ni-hero-vid');
      if (v) {
        var src = v.querySelector('source');
        if (src && src.getAttribute('src') !== m.heroVideo) { src.setAttribute('src', m.heroVideo); v.load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        if (m.heroPoster && v.poster !== m.heroPoster) v.poster = m.heroPoster;
      }
    }
    if (m.aboutImage) {
      var img = document.querySelector('#about img');
      if (img && img.getAttribute('src') !== m.aboutImage) img.setAttribute('src', m.aboutImage);
    }
    if (m.gallery) {
      var gi = document.querySelectorAll('#gallery img');
      for (var i = 0; i < gi.length; i++) {
        var alt = gi[i].getAttribute('alt');
        if (alt && m.gallery[alt] && gi[i].getAttribute('src') !== m.gallery[alt]) gi[i].setAttribute('src', m.gallery[alt]);
      }
    }
  }

  function hideQuote() {
    // remove the "Every bowl tells a story" quote banner section
    var img = document.querySelector('img[src^="/banner-quote"]');
    var sec = img && img.closest('section');
    if (sec) sec.style.display = 'none';
  }

  function ensureOrder() {
    if (document.getElementById('ni-order')) return;
    var about = document.getElementById('about');
    if (!about || !about.parentNode) return;
    var DELIVEROO = 'https://deliveroo.co.uk/menu/sheffield/london-road/noodle-inn-london-road';
    var UBEREATS = 'https://www.ubereats.com/gb';
    var sec = document.createElement('section');
    sec.id = 'ni-order';
    sec.innerHTML =
      '<p class="ni-order-kick">Menus &amp; Ordering</p>' +
      '<div class="ni-order-in">' +
        '<a class="ni-tile" href="/menu">Menu</a>' +
        '<a class="ni-tile" href="/dimsum">Dim Sum</a>' +
        '<a class="ni-tile" href="' + UBEREATS + '" target="_blank" rel="noopener">Uber Eats</a>' +
        '<a class="ni-tile" href="' + DELIVEROO + '" target="_blank" rel="noopener">Deliveroo</a>' +
      '</div>';
    about.parentNode.insertBefore(sec, about.nextSibling);
  }

  function ensureContactForm() {
    if (document.getElementById('ni-contact')) return;
    var contact = document.getElementById('contact');
    if (!contact || !contact.parentNode) return;
    var sec = document.createElement('section');
    sec.id = 'ni-contact';
    sec.innerHTML =
      '<div class="ni-ct-in">' +
        '<p class="ni-ct-kick">Get in Touch</p>' +
        '<h2 class="ni-ct-h">We\'d love to hear from you</h2>' +
        '<p class="ni-ct-lead">Whether it\'s feedback, a question about our menu, or just to say hello, drop us a message and our team will be in touch.</p>' +
        '<form class="ni-ct-form" novalidate>' +
          '<div class="ni-ct-row">' +
            '<label class="ni-ct-field"><span>First name</span><input name="firstName" autocomplete="given-name"></label>' +
            '<label class="ni-ct-field"><span>Last name</span><input name="lastName" autocomplete="family-name"></label>' +
          '</div>' +
          '<div class="ni-ct-row">' +
            '<label class="ni-ct-field"><span>Email *</span><input name="email" type="email" autocomplete="email"></label>' +
            '<label class="ni-ct-field"><span>Phone</span><input name="phone" type="tel" autocomplete="tel"></label>' +
          '</div>' +
          '<label class="ni-ct-field"><span>Message *</span><textarea name="message" rows="6"></textarea></label>' +
          '<input type="text" name="company" class="ni-ct-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<div class="ni-ct-actions"><button type="submit" class="ni-ct-btn">Send Message</button><span class="ni-ct-status"></span></div>' +
        '</form>' +
      '</div>';
    contact.parentNode.insertBefore(sec, contact.nextSibling);

    var form = sec.querySelector('.ni-ct-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('.ni-ct-status');
      var btn = form.querySelector('.ni-ct-btn');
      var data = {};
      ['firstName', 'lastName', 'email', 'phone', 'message', 'company'].forEach(function (n) {
        var el = form.querySelector('[name="' + n + '"]'); data[n] = el ? el.value.trim() : '';
      });
      if (!data.email || !data.message) {
        status.textContent = 'Please add your email and a message.'; status.className = 'ni-ct-status err'; return;
      }
      if (data.company) { form.reset(); status.textContent = 'Thanks! Your message has been sent.'; status.className = 'ni-ct-status ok'; return; }
      btn.disabled = true; status.textContent = 'Sending…'; status.className = 'ni-ct-status';
      var payload = {
        name: (data.firstName + ' ' + data.lastName).trim() || 'Website visitor',
        email: data.email, phone: data.phone, message: data.message,
        _subject: 'New enquiry from the Noodle Inn website', _template: 'table'
      };
      fetch('https://formsubmit.co/ajax/' + CONTACT_TO, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.ok; })
        .then(function (ok) {
          btn.disabled = false;
          if (ok) { form.reset(); status.textContent = 'Thanks! Your message has been sent.'; status.className = 'ni-ct-status ok'; }
          else { status.textContent = 'Could not send. Please try again, or email us directly.'; status.className = 'ni-ct-status err'; }
        })
        .catch(function () { btn.disabled = false; status.textContent = 'Could not send. Please try again.'; status.className = 'ni-ct-status err'; });
    });
  }

  function enhanceHeader() {
    var row = document.querySelector('nav .items-center.justify-between');
    if (!row) return;
    var navDiv = row.querySelector('.md\\:flex');
    if (!navDiv) return;
    // swap the boxed navy logo for the clean transparent mark
    var logoImg = row.querySelector('a.group img');
    if (logoImg && !/logo-mark/.test(logoImg.getAttribute('src') || '')) logoImg.src = '/logo-mark-gold.png';
    var cta = row.querySelector(':scope > .ni-cta');
    if (!cta) { cta = document.createElement('div'); cta.className = 'ni-cta'; row.appendChild(cta); }
    // move the Order / Reserve buttons out of the links group into the right-hand CTA group
    Array.prototype.slice.call(navDiv.children).forEach(function (el) {
      if (el.tagName !== 'A') return;
      var href = el.getAttribute('href') || '';
      var t = (el.textContent || '').trim();
      var isCta = /deliveroo/.test(href) || /bg-\[#00CCBC\]/.test(el.className) ||
                  /border-gold/.test(el.className) || t === 'Order' || t === 'Reserve';
      if (isCta && el.parentNode !== cta) cta.appendChild(el);
    });
    // header "Order" button jumps to the on-page Menus & Ordering section (not straight to Deliveroo)
    Array.prototype.slice.call(cta.querySelectorAll('a')).forEach(function (el) {
      if ((el.textContent || '').trim() === 'Order') {
        el.setAttribute('href', '#ni-order');
        el.removeAttribute('target');
        el.removeAttribute('rel');
      }
    });
  }

  function makeButton() {
    if (btn && btn.isConnected) return;
    btn = document.createElement('button');
    btn.id = 'ni-lang-toggle';
    btn.type = 'button';
    btn.textContent = mode === 'zh' ? 'English' : '中文';
    btn.setAttribute('aria-label', 'Switch language / 轉換語言');
    btn.style.cssText = ['position:fixed','bottom:22px','left:22px','z-index:400',
      'padding:10px 18px','border-radius:999px','background:rgba(46,29,12,.9)','color:#e8c97a',
      'border:1px solid rgba(212,168,83,.75)','font:600 14px/1 Inter,system-ui,sans-serif',
      'letter-spacing:.12em','cursor:pointer','box-shadow:0 4px 18px rgba(30,18,5,.45)',
      'backdrop-filter:blur(6px)','-webkit-backdrop-filter:blur(6px)'].join(';');
    btn.addEventListener('click', function () {
      mode = mode === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem('ni-lang', mode); } catch (e) {}
      applyAll();
    });
    document.documentElement.appendChild(btn);
  }

  function boot() {
    Promise.all([
      fetch('/content.default.json').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('/api/content').then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      DEFAULTS = res[0];
      SAVED = res[1] && res[1].text ? res[1] : DEFAULTS;
      if (!DEFAULTS && !SAVED) return;
      buildGeneric();
      makeButton();
      ensureIntro();
      enhanceHeader();
      relinkMenu();
      hideQuote(); ensureOrder(); relinkContact(); relinkReserve(); relinkMobileMenu(); ensureWhatsNew(); applyMedia();
      applyAll();
      var scheduled = false;
      new MutationObserver(function () {
        if (applying || scheduled) return;
        scheduled = true;
        requestAnimationFrame(function () { scheduled = false; makeButton(); ensureIntro(); enhanceHeader(); relinkMenu(); hideQuote(); ensureOrder(); relinkContact(); relinkReserve(); relinkMobileMenu(); ensureWhatsNew(); applyMedia(); applyAll(); });
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      [400, 1200, 2500].forEach(function (ms) { setTimeout(function () { makeButton(); ensureIntro(); enhanceHeader(); relinkMenu(); hideQuote(); ensureOrder(); relinkContact(); relinkReserve(); relinkMobileMenu(); ensureWhatsNew(); applyMedia(); applyAll(); }, ms); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

