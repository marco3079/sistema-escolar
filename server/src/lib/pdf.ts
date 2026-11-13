import PDFDocument from 'pdfkit';
import { enderecoDoSite, lerConfiguracao } from './email';

// Montagem comum dos documentos em PDF (boletim, histórico, declaração e ficha).
// Cabeçalho com a logo, o nome da plataforma e o título (só na primeira página); rodapé com o código de
// conferência, a data e hora da emissão, "Página X de Y" e o endereço de validação em todas as páginas.
// Não busca nada na rede: a logo só entra se for data URL PNG ou JPEG.

export interface OpcoesPdf {
  titulo: string;
  subtitulo?: string;
  codigo: string; // código de conferência do DocumentoEmitido
  emitidoEm: Date;
}

export interface ColunaTabela {
  titulo: string;
  peso?: number; // largura relativa (padrão 1)
  alinhar?: 'left' | 'right' | 'center';
}

interface RegistroPdf {
  opcoes: OpcoesPdf;
  cor: string;
  endereco: string | null;
}

const MARGEM = 50;
const ALTURA_LOGO = 40;
const PADDING = 4;
const COR_PADRAO = '#2563eb';
const COR_TEXTO = '#0f172a';
const COR_SECUNDARIA = '#475569';
const COR_ZEBRA = '#f8fafc';
const COR_FILETE = '#cbd5e1';
const REGEX_COR = /^#[0-9a-fA-F]{6}$/;
const REGEX_LOGO = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

// Dados de cada documento criado por criarPdf (o rodapé precisa do código e do endereço).
const registros = new WeakMap<PDFKit.PDFDocument, RegistroPdf>();

function larguraUtil(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function limiteInferior(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom;
}

function corDoDocumento(doc: PDFKit.PDFDocument): string {
  return registros.get(doc)?.cor ?? COR_PADRAO;
}

function pad2(valor: number): string {
  return String(valor).padStart(2, '0');
}

// Data sem hora (ex.: nascimento, início da matrícula). Usa as partes UTC, como as datas gravadas.
export function formatarDataCurta(data: Date): string {
  return `${pad2(data.getUTCDate())}/${pad2(data.getUTCMonth() + 1)}/${data.getUTCFullYear()}`;
}

// Data da emissão no relógio do servidor (dia de hoje, para o texto do documento).
export function formatarDataLocal(data: Date): string {
  return `${pad2(data.getDate())}/${pad2(data.getMonth() + 1)}/${data.getFullYear()}`;
}

// Data e hora da emissão, no relógio do servidor.
export function formatarDataHora(data: Date): string {
  return `${formatarDataLocal(data)} às ${pad2(data.getHours())}:${pad2(data.getMinutes())}`;
}

// Cria o documento (A4, margens de 50 pt, páginas em buffer para o rodapé) e desenha o cabeçalho.
export async function criarPdf(opcoes: OpcoesPdf): Promise<PDFKit.PDFDocument> {
  const configuracao = await lerConfiguracao();
  const endereco = ((await enderecoDoSite()) ?? '').trim().replace(/\/+$/, '');
  const cor = REGEX_COR.test(configuracao.corPrimaria) ? configuracao.corPrimaria : COR_PADRAO;
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGEM,
    bufferPages: true,
    info: { Title: opcoes.titulo, Author: configuracao.nome, Creator: configuracao.nome },
  });
  registros.set(doc, { opcoes, cor, endereco: endereco || null });
  desenharCabecalho(doc, configuracao.nome, configuracao.logo ?? null, cor, opcoes);
  return doc;
}

// Logo só em data URL PNG ou JPEG. Qualquer outro caso ou erro ao desenhar: sem imagem (devolve largura 0).
function desenharLogo(doc: PDFKit.PDFDocument, logo: string | null): number {
  const casamento = logo ? REGEX_LOGO.exec(logo.trim()) : null;
  if (!casamento) return 0;
  try {
    const imagem = Buffer.from(casamento[2], 'base64');
    const dimensoes = (doc as unknown as { openImage(src: Buffer): { width: number; height: number } }).openImage(
      imagem
    );
    if (!(dimensoes.height > 0)) return 0;
    const largura = (dimensoes.width * ALTURA_LOGO) / dimensoes.height;
    doc.image(imagem, MARGEM, MARGEM, { height: ALTURA_LOGO });
    return largura;
  } catch {
    return 0;
  }
}

function desenharCabecalho(
  doc: PDFKit.PDFDocument,
  nome: string,
  logo: string | null,
  cor: string,
  opcoes: OpcoesPdf
): void {
  const larguraLogo = desenharLogo(doc, logo);
  const x = MARGEM + (larguraLogo > 0 ? larguraLogo + 12 : 0);
  const largura = doc.page.width - MARGEM - x;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(COR_TEXTO);
  doc.text(nome, x, MARGEM, { width: largura, lineBreak: false, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COR_TEXTO);
  doc.text(opcoes.titulo, x, MARGEM + 18, { width: largura, lineBreak: false, ellipsis: true });
  if (opcoes.subtitulo) {
    doc.font('Helvetica').fontSize(9).fillColor(COR_SECUNDARIA);
    doc.text(opcoes.subtitulo, x, MARGEM + 34, { width: largura, lineBreak: false, ellipsis: true });
  }
  const yFilete = MARGEM + ALTURA_LOGO + 12;
  doc
    .save()
    .moveTo(MARGEM, yFilete)
    .lineTo(doc.page.width - MARGEM, yFilete)
    .lineWidth(2)
    .strokeColor(cor)
    .stroke()
    .restore();
  doc.x = MARGEM;
  doc.y = yFilete + 14;
  doc.fillColor(COR_TEXTO);
}

// Se o próximo bloco de `altura` não couber na página, abre outra.
export function garantirEspaco(doc: PDFKit.PDFDocument, altura: number): void {
  if (doc.y + altura > limiteInferior(doc)) {
    doc.addPage();
  }
  doc.x = MARGEM;
}

// Subtítulo de seção em negrito, na cor primária.
export function secao(doc: PDFKit.PDFDocument, titulo: string): void {
  garantirEspaco(doc, 40);
  doc.y += 8;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(corDoDocumento(doc));
  doc.text(titulo, MARGEM, doc.y, { width: larguraUtil(doc) });
  doc.x = MARGEM;
  doc.y += 6;
  doc.fillColor(COR_TEXTO);
}

// Parágrafo de texto puro (o pdfkit não interpreta marcação).
export function paragrafo(
  doc: PDFKit.PDFDocument,
  texto: string,
  opcoes?: { tamanho?: number; alinhar?: 'left' | 'justify' | 'center'; negrito?: boolean; espacoDepois?: number }
): void {
  garantirEspaco(doc, 20);
  doc.font(opcoes?.negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(opcoes?.tamanho ?? 10).fillColor(COR_TEXTO);
  doc.text(texto, MARGEM, doc.y, {
    width: larguraUtil(doc),
    align: opcoes?.alinhar ?? 'left',
    lineGap: 2,
  });
  doc.x = MARGEM;
  doc.y += opcoes?.espacoDepois ?? 8;
}

// Linha "rótulo: valor" (rótulo em negrito à esquerda). Valor nulo ou vazio vira "—".
export function linhaDeDados(
  doc: PDFKit.PDFDocument,
  rotulo: string,
  valor: string | number | null | undefined
): void {
  const texto = valor === null || valor === undefined || valor === '' ? '—' : String(valor);
  const larguraRotulo = 150;
  const xValor = MARGEM + 160;
  const larguraValor = larguraUtil(doc) - 160;
  garantirEspaco(doc, 18);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155');
  const alturaRotulo = doc.heightOfString(rotulo, { width: larguraRotulo });
  doc.text(rotulo, MARGEM, y, { width: larguraRotulo });
  doc.font('Helvetica').fontSize(10).fillColor(COR_TEXTO);
  const alturaValor = doc.heightOfString(texto, { width: larguraValor });
  doc.text(texto, xValor, y, { width: larguraValor });
  doc.x = MARGEM;
  doc.y = y + Math.max(alturaRotulo, alturaValor) + 4;
}

// Assinatura: uma linha centralizada com o rótulo embaixo (ex.: "Secretaria").
export function assinatura(doc: PDFKit.PDFDocument, rotulo: string): void {
  garantirEspaco(doc, 80);
  doc.y += 40;
  const largura = 240;
  const x = (doc.page.width - largura) / 2;
  const y = doc.y;
  doc.save().moveTo(x, y).lineTo(x + largura, y).lineWidth(0.8).strokeColor(COR_TEXTO).stroke().restore();
  doc.font('Helvetica').fontSize(10).fillColor(COR_TEXTO);
  doc.text(rotulo, x, y + 6, { width: largura, align: 'center' });
  doc.x = MARGEM;
  doc.y = y + 26;
}

// Altura de uma linha de tabela (a maior célula, com as margens internas).
function medirLinha(doc: PDFKit.PDFDocument, textos: string[], larguras: number[], tamanho: number, negrito: boolean): number {
  doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(tamanho);
  let maior = doc.currentLineHeight(true);
  textos.forEach((texto, i) => {
    maior = Math.max(maior, doc.heightOfString(texto, { width: larguras[i] - 2 * PADDING }));
  });
  return Math.ceil(maior) + 2 * PADDING;
}

function desenharLinha(
  doc: PDFKit.PDFDocument,
  textos: string[],
  larguras: number[],
  alinhamentos: ('left' | 'right' | 'center')[],
  y: number,
  altura: number,
  estilo: { tamanho: number; negrito: boolean; texto: string; fundo?: string }
): void {
  const largura = larguras.reduce((soma, valor) => soma + valor, 0);
  if (estilo.fundo) {
    doc.save().rect(MARGEM, y, largura, altura).fill(estilo.fundo).restore();
  }
  let x = MARGEM;
  textos.forEach((texto, i) => {
    doc
      .font(estilo.negrito ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(estilo.tamanho)
      .fillColor(estilo.texto)
      .text(texto, x + PADDING, y + PADDING, { width: larguras[i] - 2 * PADDING, align: alinhamentos[i] });
    x += larguras[i];
  });
  doc
    .save()
    .moveTo(MARGEM, y + altura - 0.5)
    .lineTo(MARGEM + largura, y + altura - 0.5)
    .lineWidth(0.5)
    .strokeColor(COR_FILETE)
    .stroke()
    .restore();
  doc.x = MARGEM;
  doc.y = y + altura;
}

// Tabela com cabeçalho na cor primária. O cabeçalho se repete em cada página nova.
// `linhas` é uma matriz de textos (um por coluna; faltando vira vazio).
export function tabela(
  doc: PDFKit.PDFDocument,
  colunas: ColunaTabela[],
  linhas: string[][],
  opcoes?: { tamanho?: number }
): void {
  const tamanho = opcoes?.tamanho ?? 9;
  const cor = corDoDocumento(doc);
  const pesos = colunas.map((coluna) => coluna.peso ?? 1);
  const somaPesos = pesos.reduce((soma, valor) => soma + valor, 0);
  const larguras = pesos.map((peso) => (peso / somaPesos) * larguraUtil(doc));
  const alinhamentos = colunas.map((coluna) => coluna.alinhar ?? 'left');
  const titulos = colunas.map((coluna) => coluna.titulo);
  const alturaCabecalho = medirLinha(doc, titulos, larguras, tamanho, true);

  const desenharCabecalho = (): void => {
    desenharLinha(doc, titulos, larguras, alinhamentos, doc.y, alturaCabecalho, {
      tamanho,
      negrito: true,
      texto: '#ffffff',
      fundo: cor,
    });
  };

  garantirEspaco(doc, alturaCabecalho + 20);
  desenharCabecalho();

  linhas.forEach((valores, indice) => {
    const textos = colunas.map((_, i) => valores[i] ?? '');
    const altura = medirLinha(doc, textos, larguras, tamanho, false);
    if (doc.y + altura > limiteInferior(doc)) {
      doc.addPage();
      desenharCabecalho();
    }
    desenharLinha(doc, textos, larguras, alinhamentos, doc.y, altura, {
      tamanho,
      negrito: false,
      texto: COR_TEXTO,
      fundo: indice % 2 === 1 ? COR_ZEBRA : undefined,
    });
  });
  doc.y += 10;
}

function desenharRodape(doc: PDFKit.PDFDocument, registro: RegistroPdf, pagina: number, total: number): void {
  const { opcoes, endereco } = registro;
  const margemInferior = doc.page.margins.bottom;
  // Sem margem inferior enquanto escreve o rodapé: o texto não pode abrir página nova.
  doc.page.margins.bottom = 0;
  const largura = larguraUtil(doc);
  const y = doc.page.height - 44;
  doc.font('Helvetica').fontSize(8).fillColor(COR_SECUNDARIA);
  doc.text(`Código de conferência: ${opcoes.codigo}  ·  Emitido em ${formatarDataHora(opcoes.emitidoEm)}`, MARGEM, y, {
    width: largura - 90,
    lineBreak: false,
    ellipsis: true,
  });
  doc.text(`Página ${pagina} de ${total}`, MARGEM, y, { width: largura, align: 'right', lineBreak: false });
  if (endereco) {
    doc.text(`Confira em ${endereco}/validar/${opcoes.codigo}`, MARGEM, y + 12, {
      width: largura,
      lineBreak: false,
      ellipsis: true,
    });
  }
  doc.page.margins.bottom = margemInferior;
}

// Escreve o rodapé em todas as páginas, encerra o documento e devolve o PDF.
export async function finalizar(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const registro = registros.get(doc);
  if (!registro) {
    throw new Error('Documento PDF sem cabeçalho: crie com criarPdf');
  }
  const pronto = new Promise<Buffer>((resolve, reject) => {
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });
  const { start, count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    desenharRodape(doc, registro, i + 1, count);
  }
  doc.flushPages();
  doc.end();
  return pronto;
}
