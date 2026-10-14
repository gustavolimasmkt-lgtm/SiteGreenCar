(function () {
  'use strict';
  var toastEl = document.getElementById('toast');
  var tt;
  var toast = function (msg, bad) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(tt); tt = setTimeout(function () { toastEl.className = 'toast'; }, 3800);
  };
  var api = function (url, data, method) {
    return fetch(url, {
      method: method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(data || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { location.href = '/painel/login'; throw new Error('Sessão expirada'); }
        if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
        return j;
      });
    });
  };
  var LABEL = { novo: 'Novo', qualificado: 'Qualificado', desqualificado: 'Desqualificado', visitou: 'Visitou', vendeu: 'Vendeu' };

  // Etiquetas de um clique
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.tag');
    if (!b) return;
    var box = b.closest('.tags');
    var id = box.dataset.lead;
    var st = b.dataset.status;
    box.querySelectorAll('.tag').forEach(function (x) { x.disabled = true; });
    api('/painel/api/leads/' + id + '/status', { status: st }).then(function (j) {
      box.querySelectorAll('.tag').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.status === st ? 'true' : 'false'); });
      var row = document.getElementById('lead-' + id);
      if (row) {
        row.className = row.className.replace(/st-\w+/, 'st-' + st);
        var pill = row.querySelector('.status-pill');
        if (pill) { pill.className = 'pill status-pill s-' + st; pill.textContent = LABEL[st]; }
      }
      var m = j.meta || {};
      if (m.ok && m.duplicate) toast(LABEL[st] + '. Evento já tinha sido enviado ao Meta.');
      else if (m.ok) toast(LABEL[st] + '. Evento enviado ao Meta.');
      else if (m.skipped) toast(LABEL[st] + '. Meta não configurado, evento não enviado.', true);
      else toast(LABEL[st] + '. Falha ao enviar ao Meta, veja Eventos Meta.', true);
    }).catch(function (err) { toast(err.message, true); })
      .finally(function () { box.querySelectorAll('.tag').forEach(function (x) { x.disabled = false; }); });
  });

  // Anotações
  var notas = document.getElementById('notas');
  if (notas) {
    var last = notas.value;
    notas.addEventListener('blur', function () {
      if (notas.value === last) return;
      api('/painel/api/leads/' + notas.dataset.lead + '/notas', { notas: notas.value }).then(function () {
        last = notas.value; document.getElementById('notas-st').textContent = 'Anotação salva.';
      }).catch(function (err) { toast(err.message, true); });
    });
  }

  // Excluir lead / carro
  document.addEventListener('click', function (e) {
    var dl = e.target.closest('[data-del-lead]');
    if (dl && confirm('Excluir este lead? Não dá para desfazer.')) {
      api('/painel/api/leads/' + dl.dataset.delLead + '/excluir').then(function () { location.href = '/painel/leads'; });
    }
    var dc = e.target.closest('[data-del-car]');
    if (dc && confirm('Excluir este carro e todas as fotos? Os leads ficam guardados.')) {
      api('/painel/api/carros/' + dc.dataset.delCar + '/excluir').then(function () { location.href = '/painel/carros'; });
    }
    var cp = e.target.closest('[data-copy]');
    if (cp) {
      var txt = cp.dataset.copy;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Link copiado.'); })
        .catch(function () { prompt('Copie o link:', txt); });
    }
  });

  // Status do carro direto na lista
  document.querySelectorAll('.car-status').forEach(function (sel) {
    sel.addEventListener('change', function () {
      api('/painel/api/carros/' + sel.dataset.car + '/status', { status: sel.value }).then(function () {
        sel.className = 'car-status st-' + sel.value;
        toast(sel.value === 'vendido' ? 'Marcado como vendido. Lembre de pausar o anúncio.' : 'Status atualizado.');
      }).catch(function (err) { toast(err.message, true); });
    });
  });

  // Máscaras do formulário de carro
  document.querySelectorAll('[data-mask]').forEach(function (el) {
    el.addEventListener('input', function () {
      var d = el.value.replace(/\D/g, '').slice(0, 9);
      if (!d) { el.value = ''; return; }
      var n = Number(d).toLocaleString('pt-BR');
      el.value = el.dataset.mask === 'money' ? 'R$ ' + n : n;
    });
  });

  // Fotos: excluir e reordenar arrastando
  var list = document.getElementById('photos');
  if (list) {
    list.addEventListener('click', function (e) {
      var b = e.target.closest('.ph-del');
      if (!b || !confirm('Excluir esta foto?')) return;
      api('/painel/api/fotos/' + b.dataset.photo + '/excluir').then(function () { b.closest('li').remove(); saveOrder(); });
    });
    var dragging = null;
    var saveOrder = function () {
      var ids = Array.prototype.map.call(list.children, function (li) { return li.dataset.id; });
      api('/painel/api/carros/' + list.dataset.car + '/fotos-ordem', { ids: ids }).then(function () { toast('Ordem das fotos salva.'); });
    };
    list.addEventListener('dragstart', function (e) { dragging = e.target.closest('li'); dragging.classList.add('dragging'); });
    list.addEventListener('dragend', function () { if (dragging) dragging.classList.remove('dragging'); dragging = null; saveOrder(); });
    list.addEventListener('dragover', function (e) {
      e.preventDefault();
      var over = e.target.closest('li');
      if (!over || over === dragging) return;
      var r = over.getBoundingClientRect();
      var after = (e.clientX - r.left) > r.width / 2;
      list.insertBefore(dragging, after ? over.nextSibling : over);
    });
  }
  var fotos = document.getElementById('f-fotos');
  if (fotos) fotos.addEventListener('change', function () {
    document.getElementById('drop-txt').textContent = fotos.files.length ? fotos.files.length + ' foto(s) selecionada(s). Salve o carro para enviar.' : 'Escolher fotos';
  });

  // Opcionais rápidos
  var quick = document.getElementById('quick');
  var opc = document.getElementById('f-opc');
  if (quick && opc) {
    var lines = function () { return opc.value.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean); };
    quick.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var arr = lines(); var t = b.textContent; var i = arr.indexOf(t);
      if (i >= 0) arr.splice(i, 1); else arr.push(t);
      opc.value = arr.join('\n');
      b.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true');
    });
    opc.addEventListener('input', function () {
      var arr = lines();
      quick.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', arr.indexOf(b.textContent) >= 0 ? 'true' : 'false'); });
    });
  }

  // Configurações: testes e WhatsApp
  var stateEl = document.getElementById('wa-state');
  var STATES = { open: 'Conectado', connecting: 'Aguardando leitura do QR code', close: 'Desconectado', inexistente: 'Ainda não conectado', erro: 'Evolution API não configurada ou fora do ar' };
  var poll;
  var refreshState = function () {
    if (!stateEl) return Promise.resolve();
    return api('/painel/api/whatsapp/estado', null, 'GET').then(function (j) {
      stateEl.textContent = STATES[j.state] || j.state;
      if (j.state === 'open') { document.getElementById('wa-qr').hidden = true; clearInterval(poll); }
      return j.state;
    }).catch(function () { stateEl.textContent = STATES.erro; });
  };
  refreshState();

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]'); if (!b) return;
    var a = b.dataset.action;
    b.disabled = true;
    var done = function () { b.disabled = false; };
    if (a === 'meta-test') {
      api('/painel/api/meta/teste').then(function (j) {
        toast(j.ok ? 'Evento de teste enviado. Confira no Gerenciador de Eventos.' : 'Falhou: ' + (j.response || '').slice(0, 160), !j.ok);
      }).catch(function (err) { toast(err.message, true); }).finally(done);
    } else if (a === 'wa-connect') {
      api('/painel/api/whatsapp/conectar').then(function (j) {
        if (j.state === 'open') { toast('WhatsApp já está conectado.'); refreshState(); return; }
        var box = document.getElementById('wa-qr');
        if (j.qr) { box.querySelector('img').src = j.qr.indexOf('data:') === 0 ? j.qr : 'data:image/png;base64,' + j.qr; box.hidden = false; }
        document.getElementById('wa-pair').textContent = j.pairingCode ? 'Ou use o código de pareamento: ' + j.pairingCode : '';
        clearInterval(poll); poll = setInterval(refreshState, 4000);
      }).catch(function (err) { toast(err.message, true); }).finally(done);
    } else if (a === 'wa-test') {
      api('/painel/api/whatsapp/teste').then(function () { toast('Mensagem de teste enviada.'); }).catch(function (err) { toast(err.message, true); }).finally(done);
    } else if (a === 'wa-logout') {
      if (!confirm('Desconectar o número de notificação?')) return done();
      api('/painel/api/whatsapp/desconectar').then(function () { toast('Desconectado.'); refreshState(); }).catch(function (err) { toast(err.message, true); }).finally(done);
    } else if (a === 'email-test') {
      api('/painel/api/email/teste').then(function () { toast('E-mail de teste enviado.'); }).catch(function (err) { toast(err.message, true); }).finally(done);
    } else done();
  });
})();
