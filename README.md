# GreenCar | site de carros com captação de leads qualificados

Site em greencarsc.com.br com página por carro, formulário de qualificação, painel com etiquetas que voltam para o Meta e notificação imediata no WhatsApp.

## O que tem

- **Site público:** página inicial com filtros por faixa de preço, categoria e ordenação. Página de cada carro com galeria, ficha técnica, procedência, opcionais, preço e formulário.
- **Formulário:** nome, WhatsApp, pagamento (à vista ou financiamento com valor de entrada), troca (modelo, ano, km), prazo de compra e aceite LGPD. Depois do envio, botão "Chamar agora no WhatsApp" com a mensagem já preenchida com o carro e as respostas.
- **Painel (`/painel`):** leads com perfil calculado pelas respostas, etiquetas de um clique (Qualificado, Desqualificado, Visitou, Vendeu), anotações, filtro por carro, exportação CSV. Cadastro de carros com upload de fotos (redimensionadas automaticamente), reordenação por arrastar e status (disponível, reservado, vendido, oculto). Configurações de loja, identidade visual, Meta, WhatsApp e e-mail.
- **Meta:** Pixel no navegador + API de Conversões no servidor, com o mesmo `event_id` para deduplicar.
  - `ViewContent` ao abrir a página do carro
  - `Lead` no envio do formulário (evento de otimização da campanha)
  - `Contact` no clique do botão de WhatsApp
  - `LeadQualificado`, `LeadDesqualificado`, `Visitou` e `Purchase` quando você etiqueta o lead
- **Notificação:** cada lead chega no seu WhatsApp pela Evolution API (número de backup), com todos os dados e link direto para chamar. Se o WhatsApp falhar, vai por e-mail.

## Deploy no Railway

1. Suba esta pasta para um repositório no GitHub e crie um serviço no Railway a partir dele.
2. Crie um **Volume** no serviço, montado em `/data`.
3. Variáveis de ambiente:
   - `DATA_DIR=/data`
   - `ADMIN_PASSWORD=` senha forte do painel
   - `SESSION_SECRET=` texto aleatório longo (ex.: `openssl rand -hex 32`)
4. Em Settings, Networking, adicione o domínio `greencarsc.com.br` (e `www`). O Railway mostra um destino CNAME para cada um.
   - O DNS da HostGator não aceita CNAME no domínio raiz (`greencarsc.com.br` sem www). Por isso, aponte os nameservers do domínio para a **Cloudflare** (plano grátis), que aceita. Na Cloudflare, crie os dois CNAME (`@` e `www`) com o destino do Railway e o proxy desligado (nuvem cinza).
5. Acesse `https://greencarsc.com.br/painel`, entre com a senha e preencha **Configurações**. Em "Endereço do site", coloque `https://greencarsc.com.br`.

O Node fica fixado na versão 20 (`package.json` e `nixpacks.toml`) para o `better-sqlite3` e o `sharp` instalarem sem compilar.

## Notificação no WhatsApp (Evolution API)

1. No mesmo projeto do Railway, adicione a Evolution API pelo template oficial ("Evolution API"). Anote a URL pública e a `AUTHENTICATION_API_KEY`.
2. No painel, em Configurações, preencha URL, chave, nome da instância e o número que vai **receber** os alertas (seu WhatsApp pessoal). Salve.
3. Clique em **Conectar WhatsApp** e escaneie o QR code com o celular do **número de backup** (Aparelhos conectados).
4. Clique em **Enviar mensagem de teste**.

O número de backup só envia mensagem para você, o que reduz o risco de bloqueio, mas não zera. Configure o e-mail de reserva também.

## Configuração no Meta

1. **Verifique o domínio** greencarsc.com.br no Business Manager dono do pixel (Configurações do negócio, Segurança da marca, Domínios).
2. No painel, coloque o **ID do pixel** e gere o **token da API de Conversões** no Gerenciador de Eventos (Configurações do pixel, API de Conversões, Gerar token de acesso).
3. Teste: copie o código de teste da aba "Testar eventos" para o campo "Código de evento de teste", clique em **Enviar evento de teste**, abra uma página de carro e envie um lead. Os eventos devem aparecer como "Navegador e servidor" e deduplicados. **Apague o código de teste depois.**
4. Como o pixel é compartilhado com outro site, crie **conversões personalizadas** filtradas pelo domínio:
   - "Lead site GreenCar": evento `Lead`, URL contém `greencarsc.com.br`
   - "Lead qualificado GreenCar": evento `LeadQualificado`, URL contém `greencarsc.com.br`
   - "Venda GreenCar": evento `Purchase`, URL contém `greencarsc.com.br`
5. Campanha: objetivo **Cadastros**, local de conversão **Site**, otimizando para "Lead site GreenCar". Um anúncio por carro, cada um com o link da página do carro (botão "Copiar link" na lista de carros do painel).
6. Em cada anúncio, cole em **Parâmetros de URL**:
   `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`
   Assim cada lead mostra no painel de qual anúncio veio.
7. Quando um carro vender, marque "Vendido" no painel (a página passa a mostrar outros carros) e **pause o anúncio** dele.

Quando houver volume de leads qualificados (algo como 30 a 50 por semana), dá para testar a otimização por "Lead qualificado GreenCar". Antes disso, o volume não sustenta.

## Critério de etiquetas

- **Qualificado:** respondeu no WhatsApp, quer comprar em até 30 dias e tem como pagar (à vista, entrada de pelo menos 20% do valor do carro, ou troca que cubra isso).
- **Desqualificado:** não respondeu em 48h, está "só pesquisando" sem prazo, ou não tem entrada nem troca para um financiamento viável.
- **Visitou:** foi à loja ver o carro.
- **Vendeu:** fechou negócio.

Etiquete **todos** os leads, inclusive os ruins.

## Rodar localmente

```bash
npm install
ADMIN_PASSWORD=teste npm start      # http://localhost:3000
npm run seed                         # opcional: 4 carros de demonstração (não use em produção)
```

## Observações

- O texto da política de privacidade é um modelo baseado na LGPD. Vale uma revisão do jurídico antes de rodar.
- O site vem com `noindex` (não aparece no Google). Para liberar, marque a opção em Configurações.
- Banco SQLite e fotos ficam em `DATA_DIR`. Sem o volume do Railway, tudo se perde a cada deploy.
