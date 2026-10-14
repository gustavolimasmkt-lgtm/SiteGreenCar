const { esc, brl, kmFmt, carTitle, carLabel } = require('../util');

const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z"/></svg>';

function brandBlock(s) {
  const name = s.store_name || 'GreenCar';
  return `<img src="${esc(s.logo || '/static/img/logo.png')}" alt="${esc(name)}" width="107" height="56">`;
}

function themeVars(s) {
  const vars = [];
  if (/^#[0-9a-f]{6}$/i.test(s.color_primary || '')) vars.push(`--green:${s.color_primary}`, `--green-2:${s.color_primary}`);
  if (/^#[0-9a-f]{6}$/i.test(s.color_soft || '')) vars.push(`--green-soft:${s.color_soft}`);
  return vars.length ? `<style>:root{${vars.join(';')}}</style>` : '';
}

const STORE_DEFAULT_ADDRESS = 'R. Quinze de Novembro, 88, Centro, Criciúma, SC';
const storeAddress = (s) => s.store_address || STORE_DEFAULT_ADDRESS;
const mapsUrl = (s) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('GreenCar ' + storeAddress(s));

const BENEFITS = [
  ['Financiamento', 'com as melhores taxas'],
  ['Avaliação justa', 'do seu carro na troca'],
  ['Consultoria', 'para achar o carro ideal'],
  ['Suporte completo', 'depois da venda']
];

function benefitsBlock() {
  return `<div class="benefits">
    <h2 class="xp">Muito além de vender carros.</h2>
    <ul>${BENEFITS.map(([b, t]) => `<li><strong>${b}</strong> ${t}</li>`).join('')}</ul>
    <p class="mission">Nossa missão é facilitar a sua vida e garantir que você saia daqui com a melhor decisão possível.</p>
  </div>`;
}

function storeBlock(s, compact) {
  return `<div class="store${compact ? ' compact' : ''}">
    <img src="/static/img/loja.jpg" alt="Fachada da loja GreenCar no Centro de Criciúma" loading="lazy" width="870" height="541">
    <div class="store-text">
      <h2 class="xp">${compact ? 'Veja o carro na loja' : 'É fácil chegar na GreenCar.'}</h2>
      <p>${esc(storeAddress(s))}${s.store_hours ? `<br>${esc(s.store_hours)}` : ''}</p>
      <a href="${esc(mapsUrl(s))}" target="_blank" rel="noopener">Abrir no mapa</a>
    </div>
  </div>`;
}

function pixelHead(s) {
  if (!s.pixel_id) return '';
  const id = esc(s.pixel_id.replace(/\D/g, ''));
  return `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${id}');fbq('track','PageView');
</script><noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1" alt=""></noscript>`;
}

function layout({ title, description = '', ogImage = '', canonical = '', body, s, bodyClass = '' }) {
  const store = s.store_name || 'GreenCar';
  const noindex = s.indexar === '1' ? '' : '<meta name="robots" content="noindex, nofollow">';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(store)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta name="theme-color" content="#ffffff">
<link rel="preload" href="/static/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/static/css/site.css?v=4">
${themeVars(s)}
${pixelHead(s)}
</head>
<body class="${bodyClass}">
<header class="top">
  <div class="wrap">
    <a class="brand" href="/" aria-label="${esc(store)}, página inicial">${brandBlock(s)}</a>
    <div class="top-info">${esc(s.store_city || 'Criciúma, SC')}${s.store_hours ? `<br>${esc(s.store_hours)}` : ''}</div>
  </div>
</header>
${body}
<footer class="foot">
  <div class="wrap">
    <p class="slogan xp">GreenCar, <span>só fica a pé quem quer.</span></p>
    <div>
      <p><strong>${esc(s.company_name || 'Greencar Multimarcas LTDA')}</strong></p>
      <p>CNPJ ${esc(s.company_cnpj || '62.645.418/0001-03')}</p>
      <p>${esc(storeAddress(s))}</p>
    </div>
    <div>
      ${s.store_instagram ? `<p><a href="https://instagram.com/${esc(s.store_instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">@${esc(s.store_instagram.replace(/^@/, ''))}</a></p>` : ''}
      <p><a href="/politica-de-privacidade">Política de privacidade</a></p>
    </div>
  </div>
</footer>
<script src="/static/js/site.js?v=3" defer></script>
</body>
</html>`;
}

function flags(c) {
  const f = [];
  if (c.status === 'reservado') f.push('<span class="flag reserved">Reservado</span>');
  if (c.unico_dono) f.push('<span class="flag">Único dono</span>');
  if (c.laudo_aprovado) f.push('<span class="flag">Laudo aprovado</span>');
  return f.join('');
}

function priceBand(p) {
  if (p <= 50000) return 'ate50';
  if (p <= 100000) return '50a100';
  return 'acima100';
}

function carCard(c) {
  return `<a class="card" href="/carro/${esc(c.slug)}"
    data-price="${c.preco}" data-band="${priceBand(c.preco)}" data-cat="${esc(c.categoria || '')}"
    data-year="${c.ano_modelo || 0}" data-km="${c.km || 0}" data-created="${esc(c.created_at)}">
    <div class="card-photo">
      ${c.cover ? `<img src="${esc(c.cover)}" alt="${esc(carLabel(c))}" loading="lazy" width="600" height="450">` : ''}
      <div class="card-flags">${flags(c)}</div>
    </div>
    <div class="card-body">
      <div>
        <h2 class="card-name xp">${esc(carTitle(c))}</h2>
        ${c.versao ? `<p class="card-version">${esc(c.versao)}</p>` : ''}
      </div>
      <div class="card-facts">
        <div>Ano<strong>${esc(c.ano_fab || '')}/${esc(c.ano_modelo || '')}</strong></div>
        <div>Quilometragem<strong>${esc(kmFmt(c.km))}</strong></div>
      </div>
      <div class="card-price xp">${esc(brl(c.preco))}</div>
    </div>
  </a>`;
}

function homePage({ cars, s, siteUrl }) {
  const cats = [...new Set(cars.map(c => c.categoria).filter(Boolean))].sort();
  const body = `
<main class="wrap">
  <section class="intro">
    <h1 class="xp">${esc(s.home_title || 'Vem que a gente dá um jeito.')}</h1>
    <p>${esc(s.home_subtitle || 'A gente acha a melhor opção pra você, financiado ou à vista. Escolha o seu carro, conte como quer pagar e a gente te chama no WhatsApp.')}</p>
  </section>
  <div class="filters" role="group" aria-label="Filtrar carros">
    <button class="chip" type="button" data-band="all" aria-pressed="true">Todos</button>
    <button class="chip" type="button" data-band="ate50" aria-pressed="false">Até R$ 50 mil</button>
    <button class="chip" type="button" data-band="50a100" aria-pressed="false">R$ 50 a 100 mil</button>
    <button class="chip" type="button" data-band="acima100" aria-pressed="false">Acima de R$ 100 mil</button>
    ${cats.length > 1 ? `<label class="sr-only" for="f-cat">Categoria</label><select id="f-cat"><option value="">Todas as categorias</option>${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select>` : ''}
    <label class="sr-only" for="f-sort">Ordenar</label>
    <select id="f-sort">
      <option value="recent">Mais recentes</option>
      <option value="price-asc">Menor preço</option>
      <option value="price-desc">Maior preço</option>
      <option value="year-desc">Mais novos</option>
      <option value="km-asc">Menor km</option>
    </select>
    <span class="count" id="f-count">${cars.length} ${cars.length === 1 ? 'carro' : 'carros'}</span>
  </div>
  <div class="grid" id="grid">
    ${cars.length ? cars.map(carCard).join('') : '<p class="empty">Nenhum carro disponível no momento. Volte em breve.</p>'}
    <p class="empty" id="f-empty" hidden>Nenhum carro nessa faixa. Tente outro filtro.</p>
  </div>
  <section class="about">
    ${benefitsBlock()}
    ${storeBlock(s, false)}
  </section>
</main>`;
  return layout({
    title: `${s.store_name || 'GreenCar'} | Carros à venda em ${s.store_city || 'Criciúma, SC'}`,
    description: 'Carros seminovos com preço, fotos e procedência. Fale com a gente pelo WhatsApp.',
    ogImage: cars[0] && cars[0].cover ? siteUrl + cars[0].cover : '',
    canonical: siteUrl + '/',
    body, s
  });
}

function leadForm(c) {
  const anoAtual = new Date().getFullYear();
  const anos = [];
  for (let y = anoAtual + 1; y >= anoAtual - 30; y--) anos.push(y);
  return `
<form class="lead" id="lead" novalidate data-car="${c.id}" data-price="${c.preco}">
  <h2>Tenho interesse neste carro</h2>
  <p>Leva menos de um minuto. Com essas respostas a gente já te chama com a proposta certa.</p>
  <div class="form-err" id="lead-err" role="alert" hidden></div>

  <div class="field">
    <label for="l-nome">Seu nome</label>
    <input type="text" id="l-nome" name="nome" autocomplete="name" required maxlength="80">
  </div>
  <div class="field">
    <label for="l-wa">WhatsApp com DDD</label>
    <input type="tel" id="l-wa" name="whatsapp" autocomplete="tel-national" inputmode="tel" placeholder="(48) 99999-9999" required maxlength="16">
  </div>

  <fieldset class="field">
    <legend>Como pretende pagar?</legend>
    <div class="opts">
      <label class="opt"><input type="radio" name="pagamento" value="avista" required><span>À vista</span></label>
      <label class="opt"><input type="radio" name="pagamento" value="financiamento"><span>Financiamento</span></label>
    </div>
  </fieldset>
  <div class="sub" id="sub-fin" hidden>
    <div class="field">
      <label for="l-entrada">Quanto tem de entrada?</label>
      <input type="text" id="l-entrada" name="entrada" inputmode="numeric" placeholder="R$ 0">
      <div class="hint">Se for dar um carro na troca como entrada, coloque 0 aqui e preencha abaixo.</div>
    </div>
  </div>

  <fieldset class="field">
    <legend>Tem carro para dar na troca?</legend>
    <div class="opts">
      <label class="opt"><input type="radio" name="tem_troca" value="1" required><span>Sim</span></label>
      <label class="opt"><input type="radio" name="tem_troca" value="0"><span>Não</span></label>
    </div>
  </fieldset>
  <div class="sub" id="sub-troca" hidden>
    <div class="field">
      <label for="l-tm">Qual carro?</label>
      <input type="text" id="l-tm" name="troca_modelo" placeholder="Ex.: Onix LT 1.0" maxlength="80">
    </div>
    <div class="row">
      <div class="field">
        <label for="l-ta">Ano</label>
        <select id="l-ta" name="troca_ano"><option value="">Selecione</option>${anos.map(y => `<option>${y}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="l-tk">Km aproximado</label>
        <input type="text" id="l-tk" name="troca_km" inputmode="numeric" placeholder="Ex.: 80.000" maxlength="9">
      </div>
    </div>
  </div>

  <fieldset class="field">
    <legend>Quando pretende comprar?</legend>
    <div class="opts">
      <label class="opt"><input type="radio" name="prazo" value="semana" required><span>Esta semana</span></label>
      <label class="opt"><input type="radio" name="prazo" value="mes"><span>Este mês</span></label>
      <label class="opt"><input type="radio" name="prazo" value="pesquisando"><span>Só pesquisando</span></label>
    </div>
  </fieldset>

  <div class="hp" aria-hidden="true"><label>Não preencha <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>

  <label class="consent">
    <input type="checkbox" name="consent" value="1" required>
    <span>Autorizo o contato pelo WhatsApp sobre este carro e concordo com a <a href="/politica-de-privacidade" target="_blank">política de privacidade</a>.</span>
  </label>

  <button class="btn" type="submit" id="lead-btn">Enviar e receber contato</button>
</form>`;
}

function carPage({ car: c, photos, others, s, siteUrl, waNumber }) {
  const opcionais = (() => { try { return JSON.parse(c.opcionais || '[]'); } catch (_) { return []; } })();
  const sold = c.status === 'vendido';
  const label = carLabel(c);
  const specs = [
    ['Ano', `${c.ano_fab || '-'}/${c.ano_modelo || '-'}`],
    ['Quilometragem', kmFmt(c.km)],
    ['Câmbio', c.cambio],
    ['Combustível', c.combustivel],
    ['Cor', c.cor],
    ['Portas', c.portas],
    ['Motor', c.motor],
    ['Final da placa', c.final_placa]
  ].filter(([, v]) => v !== '' && v != null);

  const gallery = photos.length ? `
<div class="gallery-wrap">
  <div class="gallery" id="gallery">
    <div class="gallery-track" id="g-track">
      ${photos.map((p, i) => `<button type="button" data-i="${i}" aria-label="Ampliar foto ${i + 1}"><img src="${esc(p.file)}" alt="${esc(label)}, foto ${i + 1}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} width="1600" height="1200"></button>`).join('')}
    </div>
    ${photos.length > 1 ? `<button class="gallery-nav prev" type="button" aria-label="Foto anterior">‹</button><button class="gallery-nav next" type="button" aria-label="Próxima foto">›</button>` : ''}
    <span class="gallery-counter" id="g-count">1 / ${photos.length}</span>
  </div>
  ${photos.length > 1 ? `<div class="thumbs" id="g-thumbs">${photos.map((p, i) => `<button type="button" data-i="${i}" aria-label="Ver foto ${i + 1}" ${i ? '' : 'aria-current="true"'}><img src="${esc(p.thumb)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
</div>` : '<div class="gallery-wrap"><div class="gallery" style="aspect-ratio:4/3"></div></div>';

  const proofItems = [
    c.unico_dono ? `<div class="proof-item"><span class="ic">✓</span><div><strong>Único dono</strong></div></div>` : '',
    (c.laudo_aprovado || c.laudo_texto) ? `<div class="proof-item"><span class="ic">✓</span><div><strong>${c.laudo_aprovado ? 'Laudo cautelar aprovado' : 'Laudo cautelar'}</strong>${c.laudo_texto ? `<p>${esc(c.laudo_texto)}</p>` : ''}</div></div>` : '',
    c.revisoes ? `<div class="proof-item"><span class="ic">✓</span><div><strong>Revisões</strong><p>${esc(c.revisoes)}</p></div></div>` : ''
  ].filter(Boolean);
  const proof = proofItems.length ? `
<section class="section">
  <h2>Procedência</h2>
  <div class="proof">${proofItems.join('')}</div>
</section>` : '';

  const badges = [
    c.status === 'reservado' ? '<span class="reserved">Reservado</span>' : '',
    c.unico_dono ? '<span>Único dono</span>' : '',
    c.laudo_aprovado ? '<span>Laudo aprovado</span>' : '',
    c.cambio ? `<span>${esc(c.cambio)}</span>` : ''
  ].filter(Boolean).join('');

  const sticker = `
<div class="sticker">
  <div class="sticker-head">
    <h1 class="xp">${esc(carTitle(c))}</h1>
    ${c.versao ? `<p>${esc(c.versao)}</p>` : ''}
  </div>
  <div class="sticker-facts">
    <div><small>Ano</small><strong class="xp">${esc(c.ano_fab || '-')}/${esc(c.ano_modelo || '-')}</strong></div>
    <div><small>Quilometragem</small><strong class="xp">${esc(Number(c.km || 0).toLocaleString('pt-BR'))}</strong></div>
  </div>
  <div class="sticker-price"><small>${sold ? 'Vendido por' : 'Preço'}</small><strong class="xp">${esc(brl(c.preco))}</strong></div>
  ${badges ? `<div class="sticker-badges">${badges}</div>` : ''}
</div>`;

  const action = sold ? `
<div class="sold">
  <h2>Este carro já foi vendido</h2>
  <p>Separamos outros carros disponíveis logo abaixo.</p>
  <a class="btn" href="/">Ver carros disponíveis</a>
</div>` : leadForm(c);

  const othersBlock = others.length ? `
<section class="wrap others" style="padding-bottom:56px">
  <h2 class="xp">${sold ? 'Carros disponíveis' : 'Veja também'}</h2>
  <div class="grid" style="padding-bottom:0">${others.map(carCard).join('')}</div>
</section>` : '';

  const waMsgBase = `Olá! Tenho interesse no ${label} (${brl(c.preco)}) que vi no site.`;

  const body = `
<div class="wrap">
  <nav class="crumbs" aria-label="Você está em"><a href="/">Carros à venda</a> / ${esc(carTitle(c))}</nav>
  <main class="car" id="car" data-car-id="${c.id}" data-car-label="${esc(label)}" data-price="${c.preco}" data-wa="${esc(waNumber)}" data-wa-msg="${esc(waMsgBase)}" data-sold="${sold ? 1 : 0}">
    <div class="car-main">
      ${gallery}
      ${specs.length ? `<section class="section"><h2>Ficha técnica</h2><dl class="specs">${specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}
      ${proof}
      ${opcionais.length ? `<section class="section"><h2>Opcionais</h2><ul class="optionals">${opcionais.map(o => `<li>${esc(o)}</li>`).join('')}</ul></section>` : ''}
      ${c.descricao ? `<section class="section"><h2>Sobre o carro</h2><p class="desc">${esc(c.descricao)}</p></section>` : ''}
      <section class="section">${storeBlock(s, true)}</section>
    </div>
    <aside class="car-side">
      ${sticker}
      ${action}
    </aside>
  </main>
</div>
${othersBlock}
${sold ? '' : `<div class="mbar" id="mbar"><div class="p"><small>${esc(carTitle(c))} ${esc(c.ano_modelo || '')}</small><strong class="xp">${esc(brl(c.preco))}</strong></div><a class="btn" href="#lead">Tenho interesse</a></div>`}
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Fotos do carro">
  <img alt="">
  <button class="lb-close" type="button" aria-label="Fechar">×</button>
  <button class="lb-prev" type="button" aria-label="Foto anterior">‹</button>
  <button class="lb-next" type="button" aria-label="Próxima foto">›</button>
  <span class="lb-count"></span>
</div>
<template id="tpl-done">
  <div class="lead done" id="lead">
    <div class="check" aria-hidden="true">✓</div>
    <h2>Recebemos seu interesse</h2>
    <p>Vamos te chamar no WhatsApp em instantes. Se preferir, chame agora e já começamos a conversa.</p>
    <a class="btn wa" id="wa-btn" href="#" target="_blank" rel="noopener">${WA_ICON}Chamar agora no WhatsApp</a>
    <small>Sua mensagem já vai com o carro e as respostas do formulário.</small>
  </div>
</template>`;

  return layout({
    title: `${label} | ${brl(c.preco)} | ${s.store_name || 'GreenCar'}`,
    description: `${label}, ${kmFmt(c.km)}${c.cambio ? ', ' + c.cambio : ''}. ${brl(c.preco)}. Fotos, ficha técnica e procedência.`,
    ogImage: photos[0] ? siteUrl + photos[0].file : '',
    canonical: `${siteUrl}/carro/${c.slug}`,
    body, s, bodyClass: 'is-car'
  });
}

function privacyPage({ s }) {
  const empresa = esc(s.company_name || 'Greencar Multimarcas LTDA');
  const cnpj = esc(s.company_cnpj || '62.645.418/0001-03');
  const body = `
<main class="wrap">
  <article class="legal">
    <h1>Política de privacidade</h1>
    <p>Esta política explica como a ${empresa}, CNPJ ${cnpj}, trata os dados pessoais coletados neste site, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
    <h2>Quais dados coletamos</h2>
    <ul>
      <li>Dados que você informa no formulário: nome, WhatsApp, forma de pagamento, valor de entrada, dados do carro de troca e prazo de compra.</li>
      <li>Dados de navegação: endereço IP, tipo de navegador, páginas visitadas e identificadores de cookies, coletados por ferramentas como o Pixel da Meta.</li>
    </ul>
    <h2>Para que usamos</h2>
    <ul>
      <li>Entrar em contato com você sobre o carro de interesse e montar uma proposta.</li>
      <li>Medir e melhorar nossos anúncios, inclusive compartilhando dados de forma criptografada com a Meta (Facebook e Instagram) para mensuração de resultados.</li>
    </ul>
    <h2>Base legal</h2>
    <p>Tratamos seus dados com base no seu consentimento, dado ao enviar o formulário, e no nosso legítimo interesse em atender e medir nossas campanhas.</p>
    <h2>Compartilhamento</h2>
    <p>Não vendemos seus dados. Eles podem ser compartilhados com prestadores de serviço necessários à operação (hospedagem, mensageria e plataformas de anúncio) e com instituições financeiras, somente se você pedir uma simulação de financiamento.</p>
    <h2>Por quanto tempo guardamos</h2>
    <p>Mantemos os dados enquanto forem necessários para o atendimento e por até 2 anos depois do último contato, salvo obrigação legal de guarda por mais tempo.</p>
    <h2>Seus direitos</h2>
    <p>Você pode pedir a qualquer momento acesso, correção ou exclusão dos seus dados, ou revogar o consentimento${s.privacy_contact ? `, pelo contato ${esc(s.privacy_contact)}` : ', pelo nosso WhatsApp'}.</p>
    <h2>Cookies</h2>
    <p>Usamos cookies próprios e de terceiros para medir visitas e anúncios. Você pode bloqueá-los nas configurações do seu navegador.</p>
    <p style="color:var(--muted);font-size:.9rem;margin-top:28px">Última atualização: ${new Date().toLocaleDateString('pt-BR')}</p>
  </article>
</main>`;
  return layout({ title: `Política de privacidade | ${s.store_name || 'GreenCar'}`, body, s });
}

function notFoundPage({ s }) {
  const body = `<main class="wrap"><article class="legal"><h1>Página não encontrada</h1><p>O endereço pode ter mudado ou o carro saiu do site.</p><p><a class="btn" style="width:auto" href="/">Ver carros disponíveis</a></p></article></main>`;
  return layout({ title: 'Página não encontrada', body, s });
}

module.exports = { homePage, carPage, privacyPage, notFoundPage };
