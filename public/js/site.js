(function () {
  'use strict';

  var uid = function (p) {
    return (p || 'ev') + '-' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
  };
  var fbqSafe = function () { try { if (window.fbq) window.fbq.apply(null, arguments); } catch (e) {} };
  var post = function (url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true });
  };

  // Guarda UTMs e fbclid do primeiro acesso da sessão
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  try {
    var qs = new URLSearchParams(location.search);
    var stored = JSON.parse(sessionStorage.getItem('gc_utm') || '{}');
    var changed = false;
    UTM_KEYS.forEach(function (k) { if (qs.get(k)) { stored[k] = qs.get(k); changed = true; } });
    if (changed) sessionStorage.setItem('gc_utm', JSON.stringify(stored));
  } catch (e) {}
  var getUtm = function () { try { return JSON.parse(sessionStorage.getItem('gc_utm') || '{}'); } catch (e) { return {}; } };

  /* ---------- Listagem: filtros e ordenação ---------- */
  var grid = document.getElementById('grid');
  if (grid && document.querySelector('.filters')) {
    var band = 'all';
    var cat = document.getElementById('f-cat');
    var sort = document.getElementById('f-sort');
    var count = document.getElementById('f-count');
    var empty = document.getElementById('f-empty');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));

    var apply = function () {
      var c = cat ? cat.value : '';
      var visible = 0;
      cards.forEach(function (el) {
        var ok = (band === 'all' || el.dataset.band === band) && (!c || el.dataset.cat === c);
        el.hidden = !ok;
        if (ok) visible++;
      });
      var by = sort.value;
      cards.slice().sort(function (a, b) {
        if (by === 'price-asc') return a.dataset.price - b.dataset.price;
        if (by === 'price-desc') return b.dataset.price - a.dataset.price;
        if (by === 'year-desc') return b.dataset.year - a.dataset.year;
        if (by === 'km-asc') return a.dataset.km - b.dataset.km;
        return a.dataset.created < b.dataset.created ? 1 : -1;
      }).forEach(function (el) { grid.insertBefore(el, empty); });
      if (count) count.textContent = visible + (visible === 1 ? ' carro' : ' carros');
      if (empty) empty.hidden = visible !== 0 || cards.length === 0;
    };
    document.querySelectorAll('.chip[data-band]').forEach(function (b) {
      b.addEventListener('click', function () {
        band = b.dataset.band;
        document.querySelectorAll('.chip[data-band]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        apply();
      });
    });
    if (cat) cat.addEventListener('change', apply);
    sort.addEventListener('change', apply);
  }

  /* ---------- Página do carro ---------- */
  var car = document.getElementById('car');
  if (!car) return;
  var carId = car.dataset.carId;
  var price = Number(car.dataset.price || 0);

  // ViewContent no navegador + servidor, com o mesmo event_id para deduplicar
  var vcId = uid('vc');
  fbqSafe('track', 'ViewContent', { content_ids: [carId], content_type: 'vehicle', content_name: car.dataset.carLabel, value: price, currency: 'BRL' }, { eventID: vcId });
  post('/api/track', { event: 'ViewContent', car_id: carId, event_id: vcId, page_url: location.href, fbclid: getUtm().fbclid || '' }).catch(function () {});

  // Galeria
  var track = document.getElementById('g-track');
  var counter = document.getElementById('g-count');
  var thumbs = document.getElementById('g-thumbs');
  var slides = track ? track.querySelectorAll('button') : [];
  var current = 0;
  var go = function (i) {
    if (!track || !slides.length) return;
    current = (i + slides.length) % slides.length;
    track.scrollTo({ left: track.clientWidth * current, behavior: 'smooth' });
  };
  if (track) {
    var onScroll = function () {
      var i = Math.round(track.scrollLeft / track.clientWidth);
      if (i === current && counter.textContent.indexOf(i + 1 + ' ') === 0) return;
      current = i;
      counter.textContent = (i + 1) + ' / ' + slides.length;
      if (thumbs) thumbs.querySelectorAll('button').forEach(function (t, k) {
        t.setAttribute('aria-current', k === i ? 'true' : 'false');
        if (k === i) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    };
    track.addEventListener('scroll', function () { window.requestAnimationFrame(onScroll); }, { passive: true });
    var prev = car.querySelector('.gallery-nav.prev');
    var next = car.querySelector('.gallery-nav.next');
    if (prev) prev.addEventListener('click', function () { go(current - 1); });
    if (next) next.addEventListener('click', function () { go(current + 1); });
    if (thumbs) thumbs.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (b) go(Number(b.dataset.i));
    });
  }

  // Lightbox
  var lb = document.getElementById('lightbox');
  if (lb && slides.length) {
    var lbImg = lb.querySelector('img');
    var lbCount = lb.querySelector('.lb-count');
    var lbI = 0;
    var show = function (i) {
      lbI = (i + slides.length) % slides.length;
      var img = slides[lbI].querySelector('img');
      lbImg.src = img.src; lbImg.alt = img.alt;
      lbCount.textContent = (lbI + 1) + ' / ' + slides.length;
    };
    var close = function () { lb.classList.remove('open'); document.body.style.overflow = ''; go(lbI); };
    track.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      show(Number(b.dataset.i)); lb.classList.add('open'); document.body.style.overflow = 'hidden';
      lb.querySelector('.lb-close').focus();
    });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function () { show(lbI - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { show(lbI + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(lbI - 1);
      if (e.key === 'ArrowRight') show(lbI + 1);
    });
    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) show(lbI + (dx < 0 ? 1 : -1));
      sx = null;
    });
  }

  // Barra fixa do celular some quando o formulário aparece
  var mbar = document.getElementById('mbar');
  var form = document.getElementById('lead');
  if (mbar && form && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      mbar.style.display = entries[0].isIntersecting ? 'none' : '';
    }).observe(form);
  }
  if (mbar) mbar.querySelector('a').addEventListener('click', function (e) {
    e.preventDefault();
    var f = document.getElementById('lead');
    if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'start' }); var n = document.getElementById('l-nome'); if (n) setTimeout(function () { n.focus({ preventScroll: true }); }, 450); }
  });

  if (!form || form.tagName !== 'FORM') return;

  // Máscaras
  var wa = document.getElementById('l-wa');
  wa.addEventListener('input', function () {
    var d = wa.value.replace(/\D/g, '').slice(0, 11);
    var out = d;
    if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length === 11 ? 7 : 6) + '-' + d.slice(d.length === 11 ? 7 : 6);
    wa.value = out;
  });
  var money = function (el) {
    el.addEventListener('input', function () {
      var d = el.value.replace(/\D/g, '').slice(0, 9);
      el.value = d ? 'R$ ' + Number(d).toLocaleString('pt-BR') : '';
    });
  };
  money(document.getElementById('l-entrada'));
  var tk = document.getElementById('l-tk');
  tk.addEventListener('input', function () {
    var d = tk.value.replace(/\D/g, '').slice(0, 7);
    tk.value = d ? Number(d).toLocaleString('pt-BR') : '';
  });

  // Campos condicionais
  var subFin = document.getElementById('sub-fin');
  var subTroca = document.getElementById('sub-troca');
  form.addEventListener('change', function (e) {
    if (e.target.name === 'pagamento') subFin.hidden = e.target.value !== 'financiamento';
    if (e.target.name === 'tem_troca') subTroca.hidden = e.target.value !== '1';
  });

  var errBox = document.getElementById('lead-err');
  var btn = document.getElementById('lead-btn');
  var fail = function (msg, focusEl) {
    errBox.textContent = msg; errBox.hidden = false;
    if (focusEl) focusEl.focus();
    else errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errBox.hidden = true;
    var fd = new FormData(form);
    var v = function (k) { return (fd.get(k) || '').toString().trim(); };
    var digits = v('whatsapp').replace(/\D/g, '');
    if (v('nome').length < 2) return fail('Informe seu nome.', document.getElementById('l-nome'));
    if (digits.length < 10) return fail('Informe um WhatsApp válido com DDD.', wa);
    if (!v('pagamento')) return fail('Escolha como pretende pagar.', form.querySelector('[name=pagamento]'));
    if (v('pagamento') === 'financiamento' && !v('entrada')) return fail('Informe o valor de entrada. Se não tiver, coloque 0.', document.getElementById('l-entrada'));
    if (!v('tem_troca')) return fail('Diga se tem carro para dar na troca.', form.querySelector('[name=tem_troca]'));
    if (v('tem_troca') === '1' && !v('troca_modelo')) return fail('Informe qual carro vai dar na troca.', document.getElementById('l-tm'));
    if (!v('prazo')) return fail('Diga quando pretende comprar.', form.querySelector('[name=prazo]'));
    if (!fd.get('consent')) return fail('Para continuar, autorize o contato pelo WhatsApp.', form.querySelector('[name=consent]'));

    var eventId = uid('lead');
    var payload = {};
    fd.forEach(function (val, key) { payload[key] = val; });
    payload.car_id = carId;
    payload.event_id = eventId;
    payload.page_url = location.href;
    var utm = getUtm();
    UTM_KEYS.forEach(function (k) { if (utm[k]) payload[k] = utm[k]; });

    btn.disabled = true; btn.textContent = 'Enviando...';
    post('/api/leads', payload).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (!res.ok) throw new Error(res.j && res.j.error || 'Não foi possível enviar.');
      fbqSafe('track', 'Lead', { content_ids: [carId], content_type: 'vehicle', content_name: car.dataset.carLabel, value: price, currency: 'BRL' }, { eventID: eventId });
      var tpl = document.getElementById('tpl-done');
      var node = tpl.content.firstElementChild.cloneNode(true);
      form.replaceWith(node);
      if (mbar) mbar.remove();
      var waBtn = node.querySelector('#wa-btn');
      if (res.j.wa_url) waBtn.href = res.j.wa_url; else waBtn.remove();
      waBtn.addEventListener('click', function () {
        var cid = 'contact-' + res.j.id;
        fbqSafe('track', 'Contact', { content_ids: [carId], content_type: 'vehicle' }, { eventID: cid });
        var data = JSON.stringify({ event: 'Contact', lead_id: res.j.id, token: res.j.token, event_id: cid, page_url: location.href });
        if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([data], { type: 'application/json' }));
        else post('/api/track', JSON.parse(data));
      });
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = 'Enviar e receber contato';
      fail(err.message || 'Não foi possível enviar. Tente de novo.');
    });
  });
})();
