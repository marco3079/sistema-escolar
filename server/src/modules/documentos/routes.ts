import crypto from 'crypto';
import { Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError, idParam, validar } from '../../lib/erros';
import { permitir } from '../../lib/auth';
import { acessoAMatricula } from '../../lib/responsaveis';
import { incluirMatricula, montarBoletim, montarHistorico } from '../../lib/boletim';
import {
  assinatura,
  criarPdf,
  finalizar,
  formatarDataCurta,
  formatarDataLocal,
  linhaDeDados,
  paragrafo,
  secao,
  tabela,
} from '../../lib/pdf';

// Documentos em PDF (Contrato C em docs/plano/setima-leva.md) e validação pública pelo código.
const router = Router();
// Rota pública (montada antes da autenticação): validação de documento.
export const publico = Router();

const NIVEL: Record<string, string> = {
  FUNDAMENTAL_1: 'Ensino Fundamental I',
  FUNDAMENTAL_2: 'Ensino Fundamental II',
  MEDIO: 'Ensino Médio',
  TECNICO: 'Ensino Técnico',
  GRADUACAO: 'Graduação',
  ESPECIALIZACAO: 'Especialização',
  MESTRADO: 'Mestrado',
  DOUTORADO: 'Doutorado',
};

const SITUACAO: Record<string, string> = {
  CURSANDO: 'Cursando',
  APROVADO: 'Aprovado',
  REPROVADO_NOTA: 'Reprovado por nota',
  REPROVADO_FALTA: 'Reprovado por falta',
  TRANCADO: 'Trancado',
};

const STATUS_MATRICULA: Record<string, string> = {
  ATIVA: 'Ativa',
  TRANCADA: 'Trancada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

// ---------- Código de conferência ----------

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0, O, 1 e I
const REGEX_CODIGO = new RegExp(`^[${ALFABETO_CODIGO}]{4}-[${ALFABETO_CODIGO}]{4}-[${ALFABETO_CODIGO}]{4}$`);

function gerarCodigo(): string {
  let bruto = '';
  for (let i = 0; i < 12; i++) {
    bruto += ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)];
  }
  return `${bruto.slice(0, 4)}-${bruto.slice(4, 8)}-${bruto.slice(8, 12)}`;
}

// Aceita o código com ou sem traços, em qualquer caixa, e devolve no formato XXXX-XXXX-XXXX.
function normalizarCodigo(bruto: string): string {
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpo.length !== 12) return limpo;
  return `${limpo.slice(0, 4)}-${limpo.slice(4, 8)}-${limpo.slice(8, 12)}`;
}

interface Emissao {
  codigo: string;
  emitidoEm: Date;
}

// Grava o DocumentoEmitido antes de montar o PDF (o código vai no rodapé). Repete se o código colidir.
async function registrarEmissao(dados: {
  tipo: string;
  alunoId: number;
  matriculaId: number | null;
  alunoNome: string;
  descricao: string;
  emitidoPorId: number;
}): Promise<Emissao> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    try {
      const registro = await prisma.documentoEmitido.create({
        data: { ...dados, codigo: gerarCodigo() },
      });
      return { codigo: registro.codigo, emitidoEm: registro.emitidoEm };
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')) {
        throw erro;
      }
    }
  }
  throw new HttpError(500, 'Não foi possível gerar o código do documento');
}

function enviarPdf(res: Response, pdf: Buffer, nomeArquivo: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
}

function nomeDoArquivo(prefixo: string, ra: string): string {
  return `${prefixo}-${ra.replace(/[^A-Za-z0-9_-]/g, '')}.pdf`;
}

// ---------- Formatação ----------

function numero(valor: number | null, minimo: number, maximo: number): string {
  if (valor === null) return '—';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: minimo, maximumFractionDigits: maximo });
}

function nota(valor: number | null): string {
  return numero(valor, 1, 2);
}

function percentual(valor: number | null): string {
  return valor === null ? '—' : `${numero(valor, 0, 1)}%`;
}

// Nome para a página pública: primeiro nome e iniciais dos demais ("Marina C. S.").
function mascararNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return [partes[0], ...partes.slice(1).map((parte) => `${parte.charAt(0).toUpperCase()}.`)].join(' ');
}

// ---------- Matrícula (boletim, histórico, declaração) ----------

interface MatriculaDoc {
  alunoId?: number;
  aluno: { ra: string; usuario: { nome: string } };
  curso: { nome: string; nivel: string };
  periodoIngresso: { nome: string };
  status: string;
  serieAtual: number;
}

function subtituloDaMatricula(matricula: MatriculaDoc): string {
  return `${matricula.aluno.usuario.nome} · RA ${matricula.aluno.ra}`;
}

function cabecalhoDaMatricula(doc: PDFKit.PDFDocument, matricula: MatriculaDoc): void {
  linhaDeDados(doc, 'Aluno', matricula.aluno.usuario.nome);
  linhaDeDados(doc, 'RA', matricula.aluno.ra);
  linhaDeDados(doc, 'Curso', `${matricula.curso.nome} (${NIVEL[matricula.curso.nivel] ?? matricula.curso.nivel})`);
  linhaDeDados(doc, 'Ingresso', matricula.periodoIngresso.nome);
  linhaDeDados(doc, 'Situação da matrícula', STATUS_MATRICULA[matricula.status] ?? matricula.status);
  linhaDeDados(doc, 'Série ou período atual', matricula.serieAtual);
}

// ---------- Rotas autenticadas ----------

// Boletim: por período, disciplina, notas, nota final, frequência e situação.
router.get(
  '/documentos/boletim/:matriculaId',
  asyncHandler(async (req, res) => {
    const matriculaId = idParam(req, 'matriculaId');
    await acessoAMatricula(req, matriculaId);
    const boletim = await montarBoletim(matriculaId);
    const matricula = boletim.matricula;
    const emissao = await registrarEmissao({
      tipo: 'BOLETIM',
      alunoId: matricula.alunoId,
      matriculaId,
      alunoNome: matricula.aluno.usuario.nome,
      descricao: `Boletim de ${matricula.curso.nome}`,
      emitidoPorId: req.usuario.id,
    });

    const doc = await criarPdf({
      titulo: 'Boletim',
      subtitulo: subtituloDaMatricula(matricula),
      codigo: emissao.codigo,
      emitidoEm: emissao.emitidoEm,
    });
    cabecalhoDaMatricula(doc, matricula);

    if (boletim.periodos.length === 0) {
      paragrafo(doc, 'Nenhuma disciplina registrada nesta matrícula.', { espacoDepois: 8 });
    }
    for (const periodo of boletim.periodos) {
      secao(doc, `Período ${periodo.periodo.nome}`);
      const linhas = periodo.itens.map((item) => [
        item.disciplina,
        item.avaliacoes.map((a) => `${a.nome} ${a.valor === null ? '—' : nota(a.valor)}`).join(' · ') || '—',
        nota(item.notaFinal),
        percentual(item.frequencia),
        SITUACAO[item.status] ?? item.status,
      ]);
      tabela(
        doc,
        [
          { titulo: 'Disciplina', peso: 3 },
          { titulo: 'Notas', peso: 3.2 },
          { titulo: 'Final', peso: 0.9, alinhar: 'right' },
          { titulo: 'Freq.', peso: 1, alinhar: 'right' },
          { titulo: 'Situação', peso: 1.9 },
        ],
        linhas
      );
    }

    const pdf = await finalizar(doc);
    enviarPdf(res, pdf, nomeDoArquivo('boletim', matricula.aluno.ra));
  })
);

// Histórico: tabela com todas as disciplinas (sem trancadas) e resumo.
router.get(
  '/documentos/historico/:matriculaId',
  asyncHandler(async (req, res) => {
    const matriculaId = idParam(req, 'matriculaId');
    await acessoAMatricula(req, matriculaId);
    const historico = await montarHistorico(matriculaId);
    const matricula = historico.matricula;
    const emissao = await registrarEmissao({
      tipo: 'HISTORICO',
      alunoId: matricula.alunoId,
      matriculaId,
      alunoNome: matricula.aluno.usuario.nome,
      descricao: `Histórico de ${matricula.curso.nome}`,
      emitidoPorId: req.usuario.id,
    });

    const doc = await criarPdf({
      titulo: 'Histórico escolar',
      subtitulo: subtituloDaMatricula(matricula),
      codigo: emissao.codigo,
      emitidoEm: emissao.emitidoEm,
    });
    cabecalhoDaMatricula(doc, matricula);

    secao(doc, 'Disciplinas');
    tabela(
      doc,
      [
        { titulo: 'Período', peso: 1.6 },
        { titulo: 'Código', peso: 1 },
        { titulo: 'Disciplina', peso: 2.8 },
        { titulo: 'C.H.', peso: 0.9, alinhar: 'right' },
        { titulo: 'Créd.', peso: 0.8, alinhar: 'right' },
        { titulo: 'Final', peso: 0.9, alinhar: 'right' },
        { titulo: 'Freq.', peso: 1, alinhar: 'right' },
        { titulo: 'Situação', peso: 1.9 },
      ],
      historico.itens.map((item) => [
        item.periodo,
        item.codigo,
        item.disciplina,
        `${item.cargaHoraria} h`,
        String(item.creditos),
        nota(item.notaFinal),
        percentual(item.frequencia),
        SITUACAO[item.status] ?? item.status,
      ]),
      { tamanho: 8 }
    );

    secao(doc, 'Resumo');
    linhaDeDados(doc, 'Créditos concluídos', historico.resumo.creditosConcluidos);
    linhaDeDados(doc, 'Carga horária concluída', `${historico.resumo.cargaHorariaConcluida} h`);
    linhaDeDados(
      doc,
      'Coeficiente',
      historico.resumo.coeficiente === null ? null : numero(historico.resumo.coeficiente, 2, 2)
    );

    const pdf = await finalizar(doc);
    enviarPdf(res, pdf, nomeDoArquivo('historico', matricula.aluno.ra));
  })
);

// Declaração de matrícula: só para matrícula ativa.
router.get(
  '/documentos/declaracao/:matriculaId',
  asyncHandler(async (req, res) => {
    const matriculaId = idParam(req, 'matriculaId');
    const { alunoId } = await acessoAMatricula(req, matriculaId);
    const matricula = await prisma.matricula.findUnique({
      where: { id: matriculaId },
      include: incluirMatricula,
    });
    if (!matricula) throw new HttpError(404, 'Matrícula não encontrada');
    if (matricula.status !== 'ATIVA') {
      throw new HttpError(409, 'A declaração só pode ser emitida para matrícula ativa');
    }

    const emissao = await registrarEmissao({
      tipo: 'DECLARACAO',
      alunoId,
      matriculaId,
      alunoNome: matricula.aluno.usuario.nome,
      descricao: `Declaração de matrícula em ${matricula.curso.nome}`,
      emitidoPorId: req.usuario.id,
    });

    const doc = await criarPdf({
      titulo: 'Declaração de matrícula',
      subtitulo: subtituloDaMatricula(matricula),
      codigo: emissao.codigo,
      emitidoEm: emissao.emitidoEm,
    });

    const complemento =
      matricula.curso.regime === 'SERIADO'
        ? `na ${matricula.serieAtual}ª série`
        : `no ${matricula.serieAtual}º período`;
    const nivel = NIVEL[matricula.curso.nivel] ?? matricula.curso.nivel;
    doc.moveDown(2);
    paragrafo(
      doc,
      `Declaramos, para os devidos fins, que ${matricula.aluno.usuario.nome}, RA ${matricula.aluno.ra}, está regularmente matriculado(a) no curso ${matricula.curso.nome} (${nivel}), ${complemento}, neste estabelecimento de ensino.`,
      { tamanho: 12, alinhar: 'justify', espacoDepois: 18 }
    );
    paragrafo(doc, `Documento emitido em ${formatarDataLocal(emissao.emitidoEm)}.`, {
      tamanho: 10,
      espacoDepois: 10,
    });
    assinatura(doc, 'Secretaria');

    const pdf = await finalizar(doc);
    enviarPdf(res, pdf, nomeDoArquivo('declaracao', matricula.aluno.ra));
  })
);

// Ficha cadastral do aluno: só gestão.
router.get(
  '/documentos/ficha/:alunoId',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const alunoId = idParam(req, 'alunoId');
    const aluno = await prisma.aluno.findUnique({
      where: { id: alunoId },
      include: {
        usuario: { select: { nome: true, email: true, cpf: true, telefone: true } },
        responsaveis: {
          orderBy: { id: 'asc' },
          include: { usuario: { select: { nome: true, email: true, telefone: true } } },
        },
        matriculas: {
          orderBy: { id: 'asc' },
          include: {
            curso: { select: { nome: true, nivel: true } },
            periodoIngresso: { select: { nome: true } },
          },
        },
      },
    });
    if (!aluno) throw new HttpError(404, 'Aluno não encontrado');

    const emissao = await registrarEmissao({
      tipo: 'FICHA',
      alunoId,
      matriculaId: null,
      alunoNome: aluno.usuario.nome,
      descricao: 'Ficha cadastral do aluno',
      emitidoPorId: req.usuario.id,
    });

    const doc = await criarPdf({
      titulo: 'Ficha cadastral do aluno',
      subtitulo: `${aluno.usuario.nome} · RA ${aluno.ra}`,
      codigo: emissao.codigo,
      emitidoEm: emissao.emitidoEm,
    });

    secao(doc, 'Dados pessoais');
    linhaDeDados(doc, 'Nome', aluno.usuario.nome);
    linhaDeDados(doc, 'RA', aluno.ra);
    linhaDeDados(doc, 'Data de nascimento', formatarDataCurta(aluno.dataNascimento));
    linhaDeDados(doc, 'E-mail', aluno.usuario.email);
    linhaDeDados(doc, 'CPF', aluno.usuario.cpf);
    linhaDeDados(doc, 'Telefone', aluno.usuario.telefone);
    linhaDeDados(doc, 'Endereço', aluno.endereco);

    secao(doc, 'Responsáveis');
    if (aluno.responsaveis.length === 0) {
      paragrafo(doc, 'Nenhum responsável ligado ao aluno.');
    } else {
      tabela(
        doc,
        [
          { titulo: 'Nome', peso: 2 },
          { titulo: 'Parentesco', peso: 1.4 },
          { titulo: 'Contato', peso: 2.6 },
        ],
        aluno.responsaveis.map((vinculo) => [
          vinculo.usuario.nome,
          vinculo.parentesco,
          [vinculo.usuario.telefone, vinculo.usuario.email].filter((v) => v && v.trim() !== '').join(' · ') || '—',
        ])
      );
    }

    secao(doc, 'Matrículas');
    if (aluno.matriculas.length === 0) {
      paragrafo(doc, 'Nenhuma matrícula registrada.');
    } else {
      tabela(
        doc,
        [
          { titulo: 'Curso', peso: 2.6 },
          { titulo: 'Nível', peso: 1.6 },
          { titulo: 'Ingresso', peso: 1.2 },
          { titulo: 'Situação', peso: 1.3 },
          { titulo: 'Série/período', peso: 1.1, alinhar: 'right' },
        ],
        aluno.matriculas.map((m) => [
          m.curso.nome,
          NIVEL[m.curso.nivel] ?? m.curso.nivel,
          m.periodoIngresso.nome,
          STATUS_MATRICULA[m.status] ?? m.status,
          String(m.serieAtual),
        ])
      );
    }

    const pdf = await finalizar(doc);
    enviarPdf(res, pdf, nomeDoArquivo('ficha', aluno.ra));
  })
);

// Lista de documentos emitidos (gestão), com filtro opcional por aluno.
const emitidosSchema = z.object({
  alunoId: z.coerce.number().int().positive().optional(),
});

router.get(
  '/documentos/emitidos',
  permitir('ADMIN', 'SECRETARIA'),
  asyncHandler(async (req, res) => {
    const { alunoId } = validar(emitidosSchema, req.query);
    const documentos = await prisma.documentoEmitido.findMany({
      where: alunoId ? { alunoId } : {},
      orderBy: { emitidoEm: 'desc' },
      take: 200,
    });
    const idsEmitentes = [...new Set(documentos.map((d) => d.emitidoPorId))];
    const emitentes = idsEmitentes.length
      ? await prisma.usuario.findMany({
          where: { id: { in: idsEmitentes } },
          select: { id: true, nome: true },
        })
      : [];
    const nomePorId = new Map(emitentes.map((u) => [u.id, u.nome]));
    res.json(
      documentos.map((d) => ({
        id: d.id,
        codigo: d.codigo,
        tipo: d.tipo,
        descricao: d.descricao,
        alunoNome: d.alunoNome,
        emitidoEm: d.emitidoEm,
        emitidoPor: nomePorId.get(d.emitidoPorId) ?? '—',
      }))
    );
  })
);

// ---------- Rota pública: validação ----------

// Limite de 30 consultas por minuto por IP (em memória).
const JANELA_VALIDACAO_MS = 60 * 1000;
const LIMITE_VALIDACAO = 30;
const consultasPorIp = new Map<string, number[]>();

function dentroDoLimiteValidacao(ip: string): boolean {
  const agora = Date.now();
  const recentes = (consultasPorIp.get(ip) ?? []).filter((instante) => agora - instante < JANELA_VALIDACAO_MS);
  if (recentes.length >= LIMITE_VALIDACAO) {
    consultasPorIp.set(ip, recentes);
    return false;
  }
  recentes.push(agora);
  consultasPorIp.set(ip, recentes);
  return true;
}

setInterval(() => {
  const agora = Date.now();
  for (const [ip, instantes] of consultasPorIp) {
    const recentes = instantes.filter((instante) => agora - instante < JANELA_VALIDACAO_MS);
    if (recentes.length === 0) {
      consultasPorIp.delete(ip);
    } else {
      consultasPorIp.set(ip, recentes);
    }
  }
}, JANELA_VALIDACAO_MS).unref();

publico.get(
  '/documentos/validar/:codigo',
  asyncHandler(async (req, res) => {
    if (!dentroDoLimiteValidacao(req.ip ?? '')) {
      res.status(429).json({ erro: 'Muitas tentativas. Aguarde um minuto.' });
      return;
    }
    const codigo = normalizarCodigo(String(req.params.codigo ?? ''));
    if (!REGEX_CODIGO.test(codigo)) {
      res.status(404).json({ valido: false });
      return;
    }
    const documento = await prisma.documentoEmitido.findUnique({
      where: { codigo },
      select: { tipo: true, descricao: true, alunoNome: true, emitidoEm: true },
    });
    if (!documento) {
      res.status(404).json({ valido: false });
      return;
    }
    res.json({
      valido: true,
      tipo: documento.tipo,
      descricao: documento.descricao,
      alunoNome: mascararNome(documento.alunoNome),
      emitidoEm: documento.emitidoEm,
    });
  })
);

export default router;
