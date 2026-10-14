const { esc, brl, kmFmt, phoneDisplay, carLabel, carTitle, parseMoney, PAGAMENTO, PRAZO, STATUS_LEAD, STATUS_CAR } = require('../util');

// Perfil do lead pelas respostas do formulário (ajuda a priorizar, não substitui a etiqueta)
function perfil(l) {
  const preco = l.car_preco || 0;
  const entrada = parseMoney(l.entrada);
  const pct = preco ? Math.round((entrada / preco) * 100) : 0;
  const paga = l.pagamento === 'avista' || (l.pagamento === 'financiamento' && pct >= 20) || l.tem_troca;
  let nivel = 'medio';
  if (l.prazo !== 'pesquisando' && paga) nivel = 'alto';
  else if (l.prazo === 'pesquisando' && !paga) nivel = 'baixo';
  const label = { alto: 'Perfil forte', medio: 'Perfil médio', baixo: 'Perfil fraco' }[nivel];
  return { nivel, label, pct };
}

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

function shell({ title, active, body, s = {} }) {
  const nav = [
    ['leads', 'Leads', '/painel/leads'],
    ['carros', 'Carros', '/painel/carros'],
    ['config', 'Configurações', '/painel/config'],
    ['eventos', 'Eventos Meta', '/painel/eventos']
  ];
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} | Painel ${esc(s.store_name || 'GreenCar')}</title>
<link rel="stylesheet" href="/static/css/admin.css?v=4">
</head>
<body>
<header class="bar">
  <a class="logo" href="/painel">Green<span>Car</span> <small>painel</small></a>
  <nav>${nav.map(([k, l, h]) => `<a href="${h}" ${k === active ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  <div class="bar-right"><a href="/" target="_blank">Ver site</a><a href="/painel/sair">Sair</a></div>
</header>
<main class="page">${body}</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/static/js/admin.js?v=3" defer></script>
</body>
</html>`;
}

function loginPage({ error, noPassword }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Entrar | Painel GreenCar</title>
<link rel="stylesheet" href="/static/css/admin.css?v=4"></head>
<body class="login-body">
<form class="login" method="post" action="/painel/login">
  <div class="logo big">Green<span>Car</span> <small>painel</small></div>
  ${noPassword ? '<p class="alert">Defina a variável ADMIN_PASSWORD no Railway para liberar o acesso.</p>' : ''}
  ${error ? `<p class="alert">${esc(error)}</p>` : ''}
  <label for="pw">Senha</label>
  <input id="pw" type="password" name="password" autocomplete="current-password" required autofocus>
  <button class="btn" type="submit">Entrar</button>
</form>
</body></html>`;
}

function tagButtons(l) {
  return `<div class="tags" data-lead="${l.id}">${Object.entries(STATUS_LEAD).filter(([k]) => k !== 'novo')
    .map(([k, v]) => `<button type="button" class="tag t-${k}" data-status="${k}" aria-pressed="${l.status === k}">${v}</button>`).join('')}</div>`;
}

function leadsPage({ leads, stats, status, carId, cars, s }) {
  const taxa = stats.avaliados ? Math.round((stats.qualificados / stats.avaliados) * 100) : 0;
  const tabs = [['', 'Todos'], ...Object.entries(STATUS_LEAD)];
  const qs = (st) => { const p = new URLSearchParams(); if (st) p.set('status', st); if (carId) p.set('carro', carId); const q = p.toString(); return '/painel/leads' + (q ? '?' + q : ''); };
  const rows = leads.map(l => {
    const p = perfil(l);
    return `<article class="lead-row st-${l.status}" id="lead-${l.id}">
      <div class="lr-main">
        <div class="lr-top">
          <a class="lr-name" href="/painel/leads/${l.id}">${esc(l.nome)}</a>
          <span class="pill p-${p.nivel}">${p.label}</span>
          <span class="pill status-pill s-${l.status}">${STATUS_LEAD[l.status]}</span>
        </div>
        <div class="lr-car">${esc(l.car_label || 'Carro removido')} <b>${l.car_preco ? brl(l.car_preco) : ''}</b></div>
        <dl class="lr-facts">
          <div><dt>Pagamento</dt><dd>${esc(PAGAMENTO[l.pagamento] || '-')}${l.pagamento === 'financiamento' ? `<br><small>Entrada ${esc(l.entrada || 'R$ 0')} (${p.pct}%)</small>` : ''}</dd></div>
          <div><dt>Troca</dt><dd>${l.tem_troca ? esc([l.troca_modelo, l.troca_ano].filter(Boolean).join(' ')) + (l.troca_km ? `<br><small>${esc(l.troca_km)} km</small>` : '') : 'Não'}</dd></div>
          <div><dt>Prazo</dt><dd>${esc(PRAZO[l.prazo] || '-')}</dd></div>
          <div><dt>Chegou</dt><dd>${fmtDate(l.created_at)}${l.clicou_whatsapp ? '<br><small>Chamou no WhatsApp</small>' : ''}</dd></div>
        </dl>
      </div>
      <div class="lr-side">
        <a class="btn wa" href="https://wa.me/${esc(l.whatsapp)}" target="_blank" rel="noopener">${esc(phoneDisplay(l.whatsapp))}</a>
        ${tagButtons(l)}
      </div>
    </article>`;
  }).join('');

  const body = `
<div class="head">
  <h1>Leads</h1>
  <a class="btn ghost" href="/painel/leads.csv">Exportar planilha</a>
</div>
<section class="stats">
  <div><span>Últimos 7 dias</span><strong>${stats.total7}</strong></div>
  <div><span>Sem etiqueta</span><strong class="${stats.novos ? 'warn' : ''}">${stats.novos}</strong></div>
  <div><span>Qualificados</span><strong>${stats.qualificados}</strong><small>${taxa}% dos avaliados</small></div>
  <div><span>Vendas</span><strong>${stats.vendas}</strong></div>
</section>
${stats.novos ? `<p class="note">Etiquete todos os leads, inclusive os ruins. É disso que o Meta aprende quem é lead bom.</p>` : ''}
<div class="toolbar">
  <nav class="tabs">${tabs.map(([k, v]) => `<a href="${qs(k)}" ${status === k ? 'aria-current="true"' : ''}>${v}</a>`).join('')}</nav>
  <form method="get" class="carfilter">
    ${status ? `<input type="hidden" name="status" value="${esc(status)}">` : ''}
    <label class="sr" for="fc">Carro</label>
    <select id="fc" name="carro" onchange="this.form.submit()">
      <option value="">Todos os carros</option>
      ${cars.map(c => `<option value="${c.id}" ${c.id === carId ? 'selected' : ''}>${esc(`${c.marca} ${c.modelo} ${c.ano_modelo || ''}`)}</option>`).join('')}
    </select>
  </form>
</div>
<div class="leads">${rows || '<p class="empty">Nenhum lead aqui ainda. Quando alguém preencher o formulário, aparece nesta lista e você recebe a notificação na hora.</p>'}</div>`;
  return shell({ title: 'Leads', active: 'leads', body, s });
}

function leadDetailPage({ lead: l, logs, s }) {
  const p = perfil(l);
  const rows = [
    ['WhatsApp', `<a href="https://wa.me/${esc(l.whatsapp)}" target="_blank" rel="noopener">${esc(phoneDisplay(l.whatsapp))}</a>`],
    ['Carro', `${esc(l.car_label || '-')} ${l.car_preco ? '<b>' + brl(l.car_preco) + '</b>' : ''}`],
    ['Pagamento', esc(PAGAMENTO[l.pagamento] || '-')],
    ['Entrada', l.pagamento === 'financiamento' ? `${esc(l.entrada || 'R$ 0')} (${p.pct}% do valor)` : '-'],
    ['Troca', l.tem_troca ? esc([l.troca_modelo, l.troca_ano, l.troca_km ? l.troca_km + ' km' : ''].filter(Boolean).join(' | ')) : 'Não'],
    ['Prazo', esc(PRAZO[l.prazo] || '-')],
    ['Chamou no WhatsApp', l.clicou_whatsapp ? 'Sim, pelo botão do site' : 'Não clicou no botão'],
    ['Chegou em', fmtDate(l.created_at)],
    ['Notificação', esc(l.notificado || 'pendente')],
    ['Campanha', esc(l.utm_campaign || '-')],
    ['Anúncio', esc(l.utm_content || '-')],
    ['Página', l.page_url ? `<a href="${esc(l.page_url)}" target="_blank" rel="noopener">abrir</a>` : '-']
  ];
  const body = `
<div class="head"><div><a class="back" href="/painel/leads">Voltar para leads</a><h1>${esc(l.nome)}</h1></div>
<span class="pill p-${p.nivel}">${p.label}</span></div>
<div class="detail">
  <section class="card">
    <dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  </section>
  <section class="card">
    <h2>Etiqueta</h2>
    <p class="muted">Cada etiqueta envia um evento para o Meta: Qualificado (LeadQualificado), Desqualificado (LeadDesqualificado), Visitou (Visitou) e Vendeu (Purchase).</p>
    ${tagButtons(l)}
    <h2 style="margin-top:22px">Anotações</h2>
    <textarea id="notas" data-lead="${l.id}" rows="5" placeholder="Ex.: quer visitar sábado, troca é um Gol 2015 bem conservado">${esc(l.notas || '')}</textarea>
    <p class="muted small" id="notas-st">Salva sozinho ao sair do campo.</p>
    <h2 style="margin-top:22px">Eventos enviados</h2>
    ${logs.length ? `<ul class="log">${logs.map(g => `<li class="${g.ok ? 'ok' : 'fail'}"><b>${esc(g.event_name)}</b> ${fmtDate(g.created_at)} ${g.ok ? 'enviado' : 'falhou'}${g.ok ? '' : `<br><small>${esc((g.response || '').slice(0, 200))}</small>`}</li>`).join('')}</ul>` : '<p class="muted">Nenhum evento enviado ainda.</p>'}
    <button class="link danger" type="button" data-del-lead="${l.id}">Excluir lead</button>
  </section>
</div>`;
  return shell({ title: l.nome, active: 'leads', body, s });
}

function carsPage({ cars, siteUrl, s }) {
  const rows = cars.map(c => `
<article class="car-row">
  <div class="cr-img">${c.cover ? `<img src="${esc(c.cover)}" alt="" loading="lazy">` : '<span>Sem foto</span>'}</div>
  <div class="cr-info">
    <a class="cr-title" href="/painel/carros/${c.id}">${esc(carTitle(c))} <span>${esc(c.versao || '')}</span></a>
    <div class="muted">${esc(c.ano_fab || '')}/${esc(c.ano_modelo || '')} | ${esc(kmFmt(c.km))} | <b>${esc(brl(c.preco))}</b></div>
    <div class="muted small">${c.n_leads} leads, ${c.n_qual} qualificados${c.n_leads ? ` | <a href="/painel/leads?carro=${c.id}">ver leads</a>` : ''}</div>
  </div>
  <div class="cr-actions">
    <label class="sr" for="st-${c.id}">Status</label>
    <select id="st-${c.id}" class="car-status st-${c.status}" data-car="${c.id}">
      ${Object.entries(STATUS_CAR).map(([k, v]) => `<option value="${k}" ${c.status === k ? 'selected' : ''}>${v}</option>`).join('')}
    </select>
    <button type="button" class="btn ghost sm" data-copy="${esc(siteUrl)}/carro/${esc(c.slug)}">Copiar link</button>
    <a class="btn ghost sm" href="/carro/${esc(c.slug)}" target="_blank">Ver</a>
  </div>
</article>`).join('');
  const body = `
<div class="head"><h1>Carros</h1><a class="btn" href="/painel/carros/novo">Cadastrar carro</a></div>
<p class="note">Marcou como vendido, o anúncio que leva para a página passa a mostrar "carro vendido" com outras opções. Pause o anúncio no Gerenciador também.</p>
<div class="cars">${rows || '<p class="empty">Nenhum carro cadastrado. Comece pelo botão Cadastrar carro.</p>'}</div>`;
  return shell({ title: 'Carros', active: 'carros', body, s });
}

const OPCIONAIS_COMUNS = ['Ar-condicionado', 'Direção elétrica', 'Direção hidráulica', 'Vidros elétricos', 'Travas elétricas', 'Retrovisores elétricos', 'Alarme', 'Airbag duplo', 'Freios ABS', 'Central multimídia', 'Android Auto / Apple CarPlay', 'Câmera de ré', 'Sensor de estacionamento', 'Piloto automático', 'Banco de couro', 'Rodas de liga leve', 'Faróis de neblina', 'Teto solar', 'Chave presencial', 'Partida por botão', 'Ar digital', 'Bancos com ajuste de altura', 'Volante multifuncional', 'Computador de bordo'];

function carFormPage({ car, photos, s, siteUrl, error, saved }) {
  const c = car || {};
  const v = (k) => esc(c[k] == null ? '' : c[k]);
  const opc = (() => { try { return JSON.parse(c.opcionais || '[]'); } catch (_) { return []; } })();
  const sel = (name, opts, cur) => `<select name="${name}" id="f-${name}"><option value="">Selecione</option>${opts.map(o => `<option ${String(cur || '') === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  const anoAtual = new Date().getFullYear() + 1;
  const anos = Array.from({ length: 35 }, (_, i) => String(anoAtual - i));
  const body = `
<div class="head"><div><a class="back" href="/painel/carros">Voltar para carros</a><h1>${car && car.id ? esc(carTitle(c)) : 'Cadastrar carro'}</h1></div>
${car && car.id && car.slug ? `<a class="btn ghost" href="/carro/${esc(c.slug)}" target="_blank">Ver página</a>` : ''}</div>
${error ? `<p class="alert">${esc(error)}</p>` : ''}
${saved ? '<p class="okmsg">Carro salvo.</p>' : ''}
<form class="carform" method="post" action="/painel/carros/salvar" enctype="multipart/form-data">
  <input type="hidden" name="id" value="${v('id')}">
  <section class="card">
    <h2>Dados principais</h2>
    <div class="g4">
      <div class="f"><label for="f-marca">Marca *</label><input id="f-marca" name="marca" value="${v('marca')}" required placeholder="Chevrolet"></div>
      <div class="f"><label for="f-modelo">Modelo *</label><input id="f-modelo" name="modelo" value="${v('modelo')}" required placeholder="Onix"></div>
      <div class="f span2"><label for="f-versao">Versão</label><input id="f-versao" name="versao" value="${v('versao')}" placeholder="1.0 Turbo LTZ Automático"></div>
      <div class="f"><label for="f-ano_fab">Ano fabricação</label>${sel('ano_fab', anos, c.ano_fab)}</div>
      <div class="f"><label for="f-ano_modelo">Ano modelo</label>${sel('ano_modelo', anos, c.ano_modelo)}</div>
      <div class="f"><label for="f-km">Quilometragem</label><input id="f-km" name="km" value="${c.km != null ? Number(c.km).toLocaleString('pt-BR') : ''}" inputmode="numeric" data-mask="int" placeholder="45.000"></div>
      <div class="f"><label for="f-preco">Preço *</label><input id="f-preco" name="preco" value="${c.preco ? brl(c.preco) : ''}" inputmode="numeric" data-mask="money" required placeholder="R$ 89.900"></div>
      <div class="f"><label for="f-cambio">Câmbio</label>${sel('cambio', ['Manual', 'Automático', 'Automatizado', 'CVT'], c.cambio)}</div>
      <div class="f"><label for="f-combustivel">Combustível</label>${sel('combustivel', ['Flex', 'Gasolina', 'Diesel', 'Etanol', 'Híbrido', 'Elétrico'], c.combustivel)}</div>
      <div class="f"><label for="f-categoria">Categoria</label>${sel('categoria', ['Hatch', 'Sedã', 'SUV', 'Picape', 'Utilitário', 'Esportivo', 'Minivan'], c.categoria)}</div>
      <div class="f"><label for="f-cor">Cor</label><input id="f-cor" name="cor" value="${v('cor')}" placeholder="Prata"></div>
      <div class="f"><label for="f-motor">Motor</label><input id="f-motor" name="motor" value="${v('motor')}" placeholder="1.0 Turbo"></div>
      <div class="f"><label for="f-portas">Portas</label>${sel('portas', ['2', '3', '4', '5'], c.portas)}</div>
      <div class="f"><label for="f-final_placa">Final da placa</label><input id="f-final_placa" name="final_placa" value="${v('final_placa')}" maxlength="1" inputmode="numeric"></div>
      <div class="f"><label for="f-status">Status</label><select id="f-status" name="status">${Object.entries(STATUS_CAR).map(([k, l]) => `<option value="${k}" ${(c.status || 'disponivel') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <label class="check"><input type="checkbox" name="destaque" value="1" ${c.destaque ? 'checked' : ''}> Mostrar primeiro na página inicial</label>
  </section>

  <section class="card">
    <h2>Fotos</h2>
    <p class="muted">A primeira foto é a capa. Arraste para reordenar. Fotos grandes são reduzidas automaticamente.</p>
    ${photos.length ? `<ul class="photos" id="photos" data-car="${c.id}">${photos.map(p => `<li draggable="true" data-id="${p.id}"><img src="${esc(p.thumb)}" alt=""><button type="button" class="ph-del" data-photo="${p.id}" aria-label="Excluir foto">×</button></li>`).join('')}</ul>` : ''}
    <label class="drop"><input type="file" name="fotos" accept="image/*" multiple id="f-fotos"><span id="drop-txt">Escolher fotos (pode selecionar várias de uma vez)</span></label>
  </section>

  <section class="card">
    <h2>Procedência</h2>
    <label class="check"><input type="checkbox" name="unico_dono" value="1" ${c.unico_dono ? 'checked' : ''}> Único dono</label>
    <label class="check"><input type="checkbox" name="laudo_aprovado" value="1" ${c.laudo_aprovado ? 'checked' : ''}> Laudo cautelar aprovado</label>
    <div class="f"><label for="f-laudo">Detalhes do laudo</label><textarea id="f-laudo" name="laudo_texto" rows="2" placeholder="Ex.: Laudo cautelar aprovado, sem apontamentos estruturais.">${v('laudo_texto')}</textarea></div>
    <div class="f"><label for="f-rev">Revisões</label><textarea id="f-rev" name="revisoes" rows="3" placeholder="Ex.: Todas na concessionária. Última com 40.000 km em 03/2026.">${v('revisoes')}</textarea></div>
  </section>

  <section class="card">
    <h2>Opcionais</h2>
    <p class="muted">Clique para adicionar ou escreva um por linha.</p>
    <div class="quick" id="quick">${OPCIONAIS_COMUNS.map(o => `<button type="button" aria-pressed="${opc.includes(o)}">${o}</button>`).join('')}</div>
    <textarea name="opcionais" id="f-opc" rows="6">${esc(opc.join('\n'))}</textarea>
  </section>

  <section class="card">
    <h2>Sobre o carro</h2>
    <div class="f"><label for="f-desc">Descrição</label><textarea id="f-desc" name="descricao" rows="5" placeholder="Conte o que torna esse carro uma boa compra: estado, manutenção, pneus, chave reserva, manual.">${v('descricao')}</textarea></div>
  </section>

  <div class="actions">
    <button class="btn" type="submit">Salvar carro</button>
    ${car && car.id ? `<button class="link danger" type="button" data-del-car="${c.id}">Excluir carro</button>` : ''}
  </div>
</form>`;
  return shell({ title: car && car.id ? carTitle(c) : 'Cadastrar carro', active: 'carros', body, s });
}

function configPage({ s, saved, siteUrl }) {
  const v = (k) => esc(s[k] || '');
  const secret = (k) => (s[k] ? '••••••' : '');
  const body = `
<div class="head"><h1>Configurações</h1></div>
${saved ? '<p class="okmsg">Configurações salvas.</p>' : ''}
<form method="post" action="/painel/config" enctype="multipart/form-data" class="carform">
  <section class="card">
    <h2>Loja</h2>
    <div class="g2">
      <div class="f"><label>Nome</label><input name="store_name" value="${v('store_name')}" placeholder="GreenCar"></div>
      <div class="f"><label>Cidade</label><input name="store_city" value="${v('store_city')}" placeholder="Criciúma, SC"></div>
      <div class="f"><label>Endereço</label><input name="store_address" value="${v('store_address')}"></div>
      <div class="f"><label>Horário</label><input name="store_hours" value="${v('store_hours')}" placeholder="Seg a sex 8h às 18h, sáb 8h às 12h"></div>
      <div class="f"><label>Instagram</label><input name="store_instagram" value="${v('store_instagram')}" placeholder="@greencar"></div>
      <div class="f"><label>WhatsApp de atendimento</label><input name="wa_number" value="${v('wa_number')}" placeholder="(48) 99999-9999"><small>Número que o cliente chama pelo botão depois do formulário.</small></div>
      <div class="f"><label>Razão social</label><input name="company_name" value="${v('company_name') || 'Greencar Multimarcas LTDA'}"></div>
      <div class="f"><label>CNPJ</label><input name="company_cnpj" value="${v('company_cnpj') || '62.645.418/0001-03'}"></div>
      <div class="f"><label>Contato para pedidos de privacidade</label><input name="privacy_contact" value="${v('privacy_contact')}" placeholder="e-mail ou WhatsApp"></div>
      <div class="f"><label>Endereço do site</label><input name="site_url" value="${v('site_url')}" placeholder="https://greencarsc.com.br"><small>Usado nos links das notificações.</small></div>
      <div class="f span2"><label>Título da página inicial</label><input name="home_title" value="${v('home_title')}" placeholder="Escolha seu carro. O resto a gente resolve."></div>
      <div class="f span2"><label>Texto de apoio</label><input name="home_subtitle" value="${v('home_subtitle')}"></div>
    </div>
    <label class="check"><input type="checkbox" name="indexar" value="1" ${s.indexar === '1' ? 'checked' : ''}> Deixar o Google indexar o site (desligado: só quem vem pelo anúncio encontra)</label>
  </section>

  <section class="card">
    <h2>Identidade visual</h2>
    <p class="muted">Troque logo e cores aqui sem mexer no código. A cor principal é usada nos botões: mantenha um verde escuro para o texto branco continuar legível.</p>
    <div class="g2">
      <div class="f"><label>Logo (PNG com fundo transparente). Sem envio, usa o logo GreenCar padrão.</label>
        ${s.logo ? `<div class="logo-prev"><img src="${esc(s.logo)}" alt="Logo atual"><label class="check"><input type="checkbox" name="remove_logo" value="1"> Remover logo</label></div>` : ''}
        <input type="file" name="logo" accept="image/*"></div>
      <div class="f"><label>Cor principal</label><input type="color" name="color_primary" value="${v('color_primary') || '#0e7a22'}"></div>
      <div class="f"><label>Cor de fundo dos selos</label><input type="color" name="color_soft" value="${v('color_soft') || '#e3f5e5'}"></div>
    </div>
  </section>

  <section class="card">
    <h2>Meta (Pixel e API de Conversões)</h2>
    <div class="g2">
      <div class="f"><label>ID do Pixel / conjunto de dados</label><input name="pixel_id" value="${v('pixel_id')}" inputmode="numeric"></div>
      <div class="f"><label>Token da API de Conversões</label><input name="capi_token" value="${secret('capi_token')}" type="password" autocomplete="off"><small>Gerado em Gerenciador de Eventos, Configurações, API de Conversões.</small></div>
      <div class="f"><label>Código de evento de teste</label><input name="test_event_code" value="${v('test_event_code')}" placeholder="TEST12345"><small>Use só para testar. Apague antes de rodar a campanha.</small></div>
      <div class="f"><label>Versão da Graph API</label><input name="graph_version" value="${v('graph_version')}" placeholder="v23.0"></div>
    </div>
    <button type="button" class="btn ghost" data-action="meta-test">Enviar evento de teste</button>
    <div class="help">
      <b>Parâmetros de URL para colar nos anúncios</b>
      <code>utm_source=meta&amp;utm_medium=paid&amp;utm_campaign={{campaign.name}}&amp;utm_content={{ad.name}}</code>
      <small>Assim cada lead mostra de qual anúncio veio.</small>
    </div>
  </section>

  <section class="card">
    <h2>Notificação no WhatsApp</h2>
    <p class="muted">Usa a Evolution API com o número de backup. Cada lead chega na hora com todos os dados.</p>
    <div class="g2">
      <div class="f"><label>URL da Evolution API</label><input name="evo_url" value="${v('evo_url')}" placeholder="https://evolution-xxxx.up.railway.app"></div>
      <div class="f"><label>Chave da Evolution API</label><input name="evo_key" value="${secret('evo_key')}" type="password" autocomplete="off"></div>
      <div class="f"><label>Nome da instância</label><input name="evo_instance" value="${v('evo_instance') || 'greencar-leads'}"></div>
      <div class="f"><label>Número que recebe as notificações</label><input name="notify_number" value="${v('notify_number')}" placeholder="Seu WhatsApp pessoal"><small>Não é o número de backup: é onde você quer ler os alertas.</small></div>
    </div>
    <div class="wa-box">
      <div>Estado da conexão: <b id="wa-state">verificando...</b></div>
      <div class="wa-actions">
        <button type="button" class="btn ghost" data-action="wa-connect">Conectar WhatsApp</button>
        <button type="button" class="btn ghost" data-action="wa-test">Enviar mensagem de teste</button>
        <button type="button" class="link danger" data-action="wa-logout">Desconectar</button>
      </div>
      <div id="wa-qr" hidden><p>Abra o WhatsApp do número de backup, toque em Aparelhos conectados e escaneie:</p><img alt="QR code do WhatsApp"><p class="muted small" id="wa-pair"></p></div>
    </div>
    <p class="muted small">Salve as configurações antes de conectar.</p>
  </section>

  <section class="card">
    <h2>E-mail de reserva</h2>
    <p class="muted">Se o WhatsApp falhar, o lead chega por e-mail. Com Gmail, use uma senha de app.</p>
    <div class="g2">
      <div class="f"><label>Servidor SMTP</label><input name="smtp_host" value="${v('smtp_host')}" placeholder="smtp.gmail.com"></div>
      <div class="f"><label>Porta</label><input name="smtp_port" value="${v('smtp_port') || '587'}" inputmode="numeric"></div>
      <div class="f"><label>Usuário</label><input name="smtp_user" value="${v('smtp_user')}"></div>
      <div class="f"><label>Senha</label><input name="smtp_pass" value="${secret('smtp_pass')}" type="password" autocomplete="off"></div>
      <div class="f"><label>Enviar para</label><input name="notify_email" value="${v('notify_email')}" type="email"></div>
    </div>
    <button type="button" class="btn ghost" data-action="email-test">Enviar e-mail de teste</button>
  </section>

  <div class="actions"><button class="btn" type="submit">Salvar configurações</button></div>
</form>`;
  return shell({ title: 'Configurações', active: 'config', body, s });
}

function logsPage({ logs, s }) {
  const body = `
<div class="head"><h1>Eventos enviados ao Meta</h1></div>
<p class="note">Últimos 200 envios pela API de Conversões. Se aparecer falha, confira o Pixel ID e o token em Configurações.</p>
<div class="card"><table class="tbl"><thead><tr><th>Quando</th><th>Evento</th><th>Lead</th><th>Resultado</th></tr></thead><tbody>
${logs.map(g => `<tr><td>${fmtDate(g.created_at)}</td><td>${esc(g.event_name)}</td><td>${g.lead_id ? `<a href="/painel/leads/${g.lead_id}">#${g.lead_id}</a>` : '-'}</td><td class="${g.ok ? 'ok' : 'fail'}">${g.ok ? 'Enviado' : 'Falhou'}<br><small>${esc((g.response || '').slice(0, 160))}</small></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhum evento enviado ainda.</td></tr>'}
</tbody></table></div>`;
  return shell({ title: 'Eventos Meta', active: 'eventos', body, s });
}

module.exports = { loginPage, leadsPage, leadDetailPage, carsPage, carFormPage, configPage, logsPage, perfil };
