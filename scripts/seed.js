// Cria carros de demonstração para testar o site localmente. Não rode em produção.
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { db, UPLOAD_DIR } = require('../src/db');
const { slugify } = require('../src/util');

const demo = [
  { marca: 'Chevrolet', modelo: 'Onix', versao: '1.0 Turbo LTZ Automático', ano_fab: 2021, ano_modelo: 2022, km: 38500, cambio: 'Automático', combustivel: 'Flex', cor: 'Prata', portas: 4, motor: '1.0 Turbo', categoria: 'Hatch', final_placa: '7', preco: 79900, unico_dono: 1, laudo_aprovado: 1, laudo_texto: 'Laudo cautelar aprovado, sem apontamentos estruturais.', revisoes: 'Todas na concessionária Chevrolet.\nÚltima revisão com 30.000 km em 02/2026.', descricao: 'Carro muito conservado, pneus novos, chave reserva e manual.', opcionais: ['Ar-condicionado', 'Direção elétrica', 'Central multimídia', 'Android Auto / Apple CarPlay', 'Câmera de ré', 'Sensor de estacionamento', 'Rodas de liga leve', 'Airbag duplo', 'Freios ABS'], hue: '#5d6b74' },
  { marca: 'Volkswagen', modelo: 'Gol', versao: '1.0 MPI', ano_fab: 2014, ano_modelo: 2015, km: 112000, cambio: 'Manual', combustivel: 'Flex', cor: 'Branco', portas: 4, motor: '1.0', categoria: 'Hatch', final_placa: '2', preco: 32900, unico_dono: 0, laudo_aprovado: 1, revisoes: '', descricao: 'Econômico, ideal para o dia a dia.', opcionais: ['Ar-condicionado', 'Direção hidráulica', 'Vidros elétricos', 'Travas elétricas'], hue: '#c9cfd1' },
  { marca: 'Toyota', modelo: 'Hilux', versao: '2.8 SRX 4x4 Diesel Automático', ano_fab: 2022, ano_modelo: 2023, km: 54000, cambio: 'Automático', combustivel: 'Diesel', cor: 'Preto', portas: 4, motor: '2.8 Turbo Diesel', categoria: 'Picape', final_placa: '4', preco: 159900, unico_dono: 1, laudo_aprovado: 1, laudo_texto: 'Laudo aprovado.', revisoes: 'Revisões em dia na Toyota.', descricao: 'Topo de linha, impecável.', opcionais: ['Ar digital', 'Banco de couro', 'Central multimídia', 'Câmera de ré', 'Piloto automático', 'Chave presencial', 'Partida por botão', 'Rodas de liga leve'], hue: '#2a2f33' },
  { marca: 'Jeep', modelo: 'Renegade', versao: '1.3 Turbo Longitude', ano_fab: 2022, ano_modelo: 2022, km: 47000, cambio: 'Automático', combustivel: 'Flex', cor: 'Vermelho', portas: 4, motor: '1.3 Turbo', categoria: 'SUV', final_placa: '9', preco: 104900, unico_dono: 0, laudo_aprovado: 1, opcionais: ['Ar digital', 'Central multimídia', 'Sensor de estacionamento', 'Volante multifuncional'], hue: '#8a2b2b', status: 'reservado' }
];

(async () => {
  for (const c of demo) {
    const { hue, opcionais, status, ...data } = c;
    const slug = slugify(`${c.marca} ${c.modelo} ${c.versao} ${c.ano_modelo}`);
    if (db.prepare('SELECT 1 FROM cars WHERE slug = ?').get(slug)) continue;
    const r = db.prepare(`INSERT INTO cars (slug, marca, modelo, versao, ano_fab, ano_modelo, km, cambio, combustivel, cor, portas, motor, categoria, final_placa, preco, unico_dono, laudo_aprovado, laudo_texto, revisoes, descricao, opcionais, status)
      VALUES (@slug, @marca, @modelo, @versao, @ano_fab, @ano_modelo, @km, @cambio, @combustivel, @cor, @portas, @motor, @categoria, @final_placa, @preco, @unico_dono, @laudo_aprovado, @laudo_texto, @revisoes, @descricao, @opcionais, @status)`)
      .run({ laudo_texto: '', revisoes: '', descricao: '', ...data, slug, opcionais: JSON.stringify(opcionais), status: status || 'disponivel' });
    for (let i = 0; i < 5; i++) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hue}"/><stop offset="1" stop-color="#e8ebe8"/></linearGradient></defs><rect width="1600" height="1200" fill="url(#g)"/><g fill="rgba(0,0,0,.28)"><rect x="300" y="560" width="1000" height="230" rx="70"/><path d="M500 560 L640 400 L1040 400 L1180 560 Z"/><circle cx="520" cy="800" r="95"/><circle cx="1080" cy="800" r="95"/></g><text x="80" y="1120" font-family="sans-serif" font-size="64" fill="#fff">${c.marca} ${c.modelo}, foto ${i + 1} (demonstração)</text></svg>`;
      const name = crypto.randomBytes(8).toString('hex');
      await sharp(Buffer.from(svg)).webp({ quality: 70 }).toFile(path.join(UPLOAD_DIR, name + '.webp'));
      await sharp(Buffer.from(svg)).resize(640, 480).webp({ quality: 70 }).toFile(path.join(UPLOAD_DIR, name + '-t.webp'));
      db.prepare('INSERT INTO photos (car_id, file, thumb, position) VALUES (?, ?, ?, ?)').run(r.lastInsertRowid, `/uploads/${name}.webp`, `/uploads/${name}-t.webp`, i);
    }
  }
  console.log('Carros de demonstração criados.');
})();
