import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/erros';
import { emailHabilitado, enderecoDoSite, enfileirarEmail, lerConfiguracao } from '../../lib/email';
import { criarTokenSenha } from '../../lib/tokens-senha';

// ---------- Utilitários do cadastro (usados pelas rotas e pela importação) ----------

// E-mail de boas-vindas com o botão "Criar minha senha". Roda em segundo plano:
// nunca atrasa nem derruba a resposta do cadastro.
export function avisarBoasVindas(usuario: { id: number; nome: string; email: string }): void {
  void (async () => {
    if (!(await emailHabilitado('BOAS_VINDAS'))) {
      return;
    }
    const endereco = await enderecoDoSite();
    if (!endereco) {
      return;
    }
    const { nome: nomePlataforma } = await lerConfiguracao();
    const token = await criarTokenSenha(usuario.id, 'BOAS_VINDAS');
    enfileirarEmail({
      para: usuario.email,
      assunto: `Bem-vindo ao ${nomePlataforma}`,
      titulo: `Bem-vindo ao ${nomePlataforma}`,
      paragrafos: [
        `Criamos a sua conta no ${nomePlataforma}.`,
        `Seu e-mail de acesso é ${usuario.email}.`,
        'Clique no botão abaixo para criar a sua senha. O link vale por 7 dias.',
      ],
      botao: { rotulo: 'Criar minha senha', endereco: `${endereco}/redefinir-senha/${token}` },
      tipo: 'BOAS_VINDAS',
    });
  })().catch(() => undefined);
}

// Sem diferenciar maiúsculas: "Ana@X.com" e "ana@x.com" são o mesmo e-mail.
export async function garantirEmailLivre(email: string, ignorarUsuarioId?: number): Promise<void> {
  const outro = await prisma.usuario.findFirst({
    where:
      ignorarUsuarioId === undefined
        ? { email: { equals: email, mode: 'insensitive' } }
        : { email: { equals: email, mode: 'insensitive' }, id: { not: ignorarUsuarioId } },
    select: { id: true },
  });
  if (outro) {
    throw new HttpError(409, 'E-mail já cadastrado');
  }
}

// RA: ano atual + sequência de 5 dígitos (ex.: 202600001).
// Lê o último RA uma vez e devolve uma função que gera os seguintes em memória.
export async function geradorRA(tx: Prisma.TransactionClient): Promise<() => string> {
  const ano = String(new Date().getFullYear());
  const ultimo = await tx.aluno.findFirst({
    where: { ra: { startsWith: ano } },
    orderBy: { ra: 'desc' },
    select: { ra: true },
  });
  let sequencia = ultimo ? Number(ultimo.ra.slice(ano.length)) + 1 : 1;
  return () => ano + String(sequencia++).padStart(5, '0');
}

// Registro do professor: 'P' + 4 dígitos (ex.: P0001). Mesma ideia do RA.
async function geradorRegistro(tx: Prisma.TransactionClient): Promise<() => string> {
  const ultimo = await tx.professor.findFirst({
    where: { registro: { startsWith: 'P' } },
    orderBy: { registro: 'desc' },
    select: { registro: true },
  });
  let sequencia = ultimo ? Number(ultimo.registro.slice(1)) + 1 : 1;
  return () => 'P' + String(sequencia++).padStart(4, '0');
}

// ---------- Schemas (zod) ----------

export const senhaSchema = z.string().min(6, 'A senha deve ter pelo menos 6 caracteres');
export const textoOpcional = z.string().nullable().optional();
// Aparado e em minúsculas: é como o e-mail fica gravado.
export const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido');
const dataSchema = z
  .string()
  .refine((valor) => !Number.isNaN(new Date(valor).getTime()), 'Data inválida');
const TITULACOES = ['GRADUADO', 'ESPECIALISTA', 'MESTRE', 'DOUTOR'] as const;
export const titulacaoSchema = z.enum(TITULACOES);

export const alunoCampos = {
  nome: z.string().min(1, 'Nome obrigatório'),
  email: emailSchema,
  cpf: textoOpcional,
  telefone: textoOpcional,
  dataNascimento: dataSchema,
  endereco: textoOpcional,
  responsavelNome: textoOpcional,
  responsavelTelefone: textoOpcional,
  responsavelEmail: textoOpcional,
};

export const alunoCriarSchema = z.object({ ...alunoCampos, senha: senhaSchema });

export const professorCampos = {
  nome: z.string().min(1, 'Nome obrigatório'),
  email: emailSchema,
  cpf: textoOpcional,
  telefone: textoOpcional,
  titulacao: titulacaoSchema,
  area: textoOpcional,
};

export const professorCriarSchema = z.object({ ...professorCampos, senha: senhaSchema });

export type AlunoCriar = z.infer<typeof alunoCriarSchema>;
export type ProfessorCriar = z.infer<typeof professorCriarSchema>;
export type DadosAluno = Omit<AlunoCriar, 'senha'>;
export type DadosProfessor = Omit<ProfessorCriar, 'senha'>;

// ---------- Criação (mesmo conjunto de registros para o cadastro e para a importação) ----------

const incluiAluno = { usuario: true } as const;
const incluiProfessor = { usuario: true } as const;

// Cria usuário + aluno dentro da transação dada, com o RA informado. Não envia e-mail nem
// checa e-mail livre.
export async function criarAlunoNoBanco(
  tx: Prisma.TransactionClient,
  dados: DadosAluno,
  senhaHash: string,
  ra: string
) {
  const usuario = await tx.usuario.create({
    data: {
      nome: dados.nome,
      email: dados.email,
      senhaHash,
      perfil: 'ALUNO',
      cpf: dados.cpf ?? null,
      telefone: dados.telefone ?? null,
    },
  });
  return tx.aluno.create({
    data: {
      usuarioId: usuario.id,
      ra,
      dataNascimento: new Date(dados.dataNascimento),
      endereco: dados.endereco ?? null,
      responsavelNome: dados.responsavelNome ?? null,
      responsavelTelefone: dados.responsavelTelefone ?? null,
      responsavelEmail: dados.responsavelEmail ?? null,
    },
    include: incluiAluno,
  });
}

// Cria usuário + professor dentro da transação dada. Não envia e-mail nem checa e-mail livre.
export async function criarProfessorNoBanco(
  tx: Prisma.TransactionClient,
  dados: DadosProfessor,
  senhaHash: string,
  registro: string
) {
  const usuario = await tx.usuario.create({
    data: {
      nome: dados.nome,
      email: dados.email,
      senhaHash,
      perfil: 'PROFESSOR',
      cpf: dados.cpf ?? null,
      telefone: dados.telefone ?? null,
    },
  });
  return tx.professor.create({
    data: {
      usuarioId: usuario.id,
      registro,
      titulacao: dados.titulacao,
      area: dados.area ?? null,
    },
    include: incluiProfessor,
  });
}

export async function criarAluno(dados: AlunoCriar) {
  await garantirEmailLivre(dados.email);
  const senhaHash = await bcrypt.hash(dados.senha, 10);
  const aluno = await prisma.$transaction(async (tx) => {
    const proximo = await geradorRA(tx);
    return criarAlunoNoBanco(tx, dados, senhaHash, proximo());
  });
  avisarBoasVindas(aluno.usuario);
  return aluno;
}

export async function criarProfessor(dados: ProfessorCriar) {
  await garantirEmailLivre(dados.email);
  const senhaHash = await bcrypt.hash(dados.senha, 10);
  const professor = await prisma.$transaction(async (tx) => {
    const proximo = await geradorRegistro(tx);
    return criarProfessorNoBanco(tx, dados, senhaHash, proximo());
  });
  avisarBoasVindas(professor.usuario);
  return professor;
}

// ---------- Importação por planilha ----------

export type TipoPlanilha = 'alunos' | 'professores';

const MODELOS: Record<TipoPlanilha, { colunas: string[]; exemplo: string[] }> = {
  alunos: {
    colunas: [
      'nome',
      'email',
      'cpf',
      'telefone',
      'nascimento',
      'endereco',
      'responsavel_nome',
      'responsavel_email',
      'responsavel_telefone',
    ],
    exemplo: [
      'Maria da Silva',
      'maria@exemplo.com',
      '',
      '(11) 99999-0000',
      '10/05/2008',
      'Rua A, 100',
      'José da Silva',
      'jose@exemplo.com',
      '(11) 98888-0000',
    ],
  },
  professores: {
    colunas: ['nome', 'email', 'cpf', 'telefone', 'titulacao', 'area'],
    exemplo: ['Carlos Souza', 'carlos@exemplo.com', '', '(11) 97777-0000', 'Mestre', 'Matemática'],
  },
};

export function modeloImportacao(tipo: TipoPlanilha): { colunas: string[]; exemplo: string[] } {
  return MODELOS[tipo];
}

// Limite do corpo JSON (1 MB globais): por isso no máximo 500 linhas por planilha.
export const corpoImportacaoSchema = z
  .object({
    linhas: z
      .array(z.record(z.string(), z.string()))
      .min(1, 'A planilha não tem linhas')
      .max(500, 'A planilha pode ter até 500 linhas'),
    simular: z.boolean(),
    senhaInicial: z.string().optional(),
  })
  .superRefine((dados, ctx) => {
    const senha = dados.senhaInicial;
    if (senha !== undefined && senha.length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['senhaInicial'],
        message: 'A senha inicial deve ter 8 caracteres ou mais',
      });
    } else if (!dados.simular && senha === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['senhaInicial'],
        message: 'Informe a senha inicial para importar',
      });
    }
  });

export type CorpoImportacao = z.infer<typeof corpoImportacaoSchema>;

export interface ResultadoLinha {
  linha: number;
  situacao: 'OK' | 'ERRO' | 'CRIADA';
  erros: string[];
  nome: string;
  email: string;
}

export interface RelatorioImportacao {
  total: number;
  validas: number;
  criadas: number;
  resultados: ResultadoLinha[];
}

export interface ResultadoImportacao {
  relatorio: RelatorioImportacao;
  // true quando a planilha tinha erros e foi recusada (rota responde 400).
  bloqueada: boolean;
  // true quando os registros foram gravados.
  gravou: boolean;
}

type Mapa = Map<string, string>;

interface Conferencia<T> {
  dados: T | null;
  erros: string[];
}

interface Analise<T> {
  linha: number;
  nome: string;
  email: string;
  erros: string[];
  dados: T | null;
}

function semAcentos(texto: string): string {
  return texto
    .replace(/﻿/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// Ordem: "e-mail" vira "email" primeiro (o hífen some); depois espaços e hífens restantes viram "_".
// Ex.: "E-mail" -> "email", "Responsável E-mail" -> "responsavel_email", "Responsável Nome" -> "responsavel_nome".
export function normalizarCabecalho(cabecalho: string): string {
  return semAcentos(cabecalho).replace(/e-mail/g, 'email').replace(/[\s-]+/g, '_');
}

// Sinônimos aceitos para a coluna de data de nascimento.
const SINONIMOS = new Map<string, string>([
  ['data_de_nascimento', 'nascimento'],
  ['data_nascimento', 'nascimento'],
]);

// Chaves normalizadas, valores aparados (não texto vira ""). Em chave repetida vale a primeira.
export function normalizarLinha(bruta: Record<string, string>): Mapa {
  const linha: Mapa = new Map();
  for (const [chave, valor] of Object.entries(bruta)) {
    const normalizada = normalizarCabecalho(chave);
    const nome = SINONIMOS.get(normalizada) ?? normalizada;
    if (nome === '' || linha.has(nome)) {
      continue;
    }
    linha.set(nome, typeof valor === 'string' ? valor.trim() : '');
  }
  return linha;
}

// Aceita dd/mm/aaaa ou aaaa-mm-dd. Devolve aaaa-mm-dd ou null se a data não existir.
export function lerDataNascimento(valor: string): string | null {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  const partes = br ? [br[3], br[2], br[1]] : iso ? [iso[1], iso[2], iso[3]] : null;
  if (!partes) {
    return null;
  }
  const ano = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return null;
  }
  return `${partes[0]}-${partes[1]}-${partes[2]}`;
}

// Aceita os valores do enum e os rótulos em português, sem diferenciar maiúsculas e acentos.
function lerTitulacao(valor: string): (typeof TITULACOES)[number] | null {
  const alvo = semAcentos(valor);
  return TITULACOES.find((titulacao) => semAcentos(titulacao) === alvo) ?? null;
}

function campo(linha: Mapa, coluna: string): string {
  return linha.get(coluna) ?? '';
}

function opcional(linha: Mapa, coluna: string): string | undefined {
  const valor = campo(linha, coluna);
  return valor === '' ? undefined : valor;
}

function marcarErro(erros: string[], marcados: Set<string>, coluna: string, mensagem: string): void {
  erros.push(`${coluna}: ${mensagem}`);
  marcados.add(coluna);
}

function pedirObrigatorios(
  linha: Mapa,
  colunas: string[],
  erros: string[],
  marcados: Set<string>
): void {
  for (const coluna of colunas) {
    if (campo(linha, coluna) === '') {
      marcarErro(erros, marcados, coluna, 'obrigatório');
    }
  }
}

// Nome da coluna da planilha para cada campo do schema (só a data muda de nome).
function colunaDoCampo(campoSchema: string): string {
  return campoSchema === 'dataNascimento' ? 'nascimento' : campoSchema;
}

// Valida com o schema do cadastro individual. Erros de campos já marcados à mão são ignorados
// para não repetir a mesma mensagem.
function aplicarSchema<S extends z.ZodType>(
  schema: S,
  entrada: Record<string, unknown>,
  erros: string[],
  marcados: Set<string>
): z.output<S> | null {
  const resultado = schema.safeParse(entrada);
  if (resultado.success) {
    return resultado.data;
  }
  for (const issue of resultado.error.issues) {
    const coluna = colunaDoCampo(String(issue.path[0] ?? ''));
    if (marcados.has(coluna)) {
      continue;
    }
    erros.push(`${coluna}: ${issue.message}`);
  }
  return null;
}

const alunoLinhaSchema = z.object(alunoCampos);
const professorLinhaSchema = z.object(professorCampos);

function prepararAluno(linha: Mapa): Conferencia<DadosAluno> {
  const erros: string[] = [];
  const marcados = new Set<string>();
  pedirObrigatorios(linha, ['nome', 'email', 'nascimento'], erros, marcados);

  let nascimento = '';
  const nascimentoBruto = campo(linha, 'nascimento');
  if (nascimentoBruto !== '') {
    const iso = lerDataNascimento(nascimentoBruto);
    if (iso) {
      nascimento = iso;
    } else {
      marcarErro(erros, marcados, 'nascimento', 'data inválida (use dd/mm/aaaa)');
    }
  }

  const dados = aplicarSchema(
    alunoLinhaSchema,
    {
      nome: campo(linha, 'nome'),
      email: campo(linha, 'email'),
      cpf: opcional(linha, 'cpf'),
      telefone: opcional(linha, 'telefone'),
      dataNascimento: nascimento,
      endereco: opcional(linha, 'endereco'),
      responsavelNome: opcional(linha, 'responsavel_nome'),
      responsavelTelefone: opcional(linha, 'responsavel_telefone'),
      responsavelEmail: opcional(linha, 'responsavel_email'),
    },
    erros,
    marcados
  );
  return { dados: erros.length === 0 ? dados : null, erros };
}

function prepararProfessor(linha: Mapa): Conferencia<DadosProfessor> {
  const erros: string[] = [];
  const marcados = new Set<string>();
  pedirObrigatorios(linha, ['nome', 'email', 'titulacao'], erros, marcados);

  let titulacao = '';
  const titulacaoBruta = campo(linha, 'titulacao');
  if (titulacaoBruta !== '') {
    const lida = lerTitulacao(titulacaoBruta);
    if (lida) {
      titulacao = lida;
    } else {
      marcarErro(erros, marcados, 'titulacao', 'inválida (use graduado, especialista, mestre ou doutor)');
    }
  }

  const dados = aplicarSchema(
    professorLinhaSchema,
    {
      nome: campo(linha, 'nome'),
      email: campo(linha, 'email'),
      cpf: opcional(linha, 'cpf'),
      telefone: opcional(linha, 'telefone'),
      titulacao,
      area: opcional(linha, 'area'),
    },
    erros,
    marcados
  );
  return { dados: erros.length === 0 ? dados : null, erros };
}

function analisar<T>(mapas: Mapa[], preparar: (linha: Mapa) => Conferencia<T>): Analise<T>[] {
  return mapas.map((mapa, indice) => {
    const conferencia = preparar(mapa);
    return {
      // Número da linha na planilha, contando o cabeçalho (a primeira linha de dados é a 2).
      linha: indice + 2,
      nome: campo(mapa, 'nome'),
      email: campo(mapa, 'email').toLowerCase(),
      erros: conferencia.erros,
      dados: conferencia.dados,
    };
  });
}

// E-mail repetido na planilha ou já cadastrado (sem diferenciar maiúsculas).
async function conferirEmails(analises: Analise<unknown>[]): Promise<void> {
  const porEmail = new Map<string, Analise<unknown>[]>();
  for (const analise of analises) {
    if (analise.email === '') {
      continue;
    }
    const grupo = porEmail.get(analise.email) ?? [];
    grupo.push(analise);
    porEmail.set(analise.email, grupo);
  }

  for (const grupo of porEmail.values()) {
    if (grupo.length > 1) {
      for (const analise of grupo) {
        const outras = grupo.filter((outra) => outra !== analise).map((outra) => outra.linha);
        analise.erros.push(`email: repetido na planilha (linhas ${outras.join(', ')})`);
      }
    }
  }

  // Uma consulta a cada 200 e-mails (não uma por linha), sem diferenciar maiúsculas.
  const emails = [...porEmail.keys()];
  const usados = new Set<string>();
  for (let inicio = 0; inicio < emails.length; inicio += 200) {
    const bloco = emails.slice(inicio, inicio + 200);
    const existentes = await prisma.usuario.findMany({
      where: { email: { in: bloco, mode: 'insensitive' } },
      select: { email: true },
    });
    for (const usuario of existentes) {
      usados.add(usuario.email.toLowerCase());
    }
  }
  for (const [email, grupo] of porEmail) {
    if (usados.has(email)) {
      for (const analise of grupo) {
        analise.erros.push('email: já cadastrado');
      }
    }
  }

  for (const analise of analises) {
    if (analise.erros.length > 0) {
      analise.dados = null;
    }
  }
}

function montarRelatorio(analises: Analise<unknown>[], gravou: boolean): RelatorioImportacao {
  const resultados: ResultadoLinha[] = analises.map((analise) => ({
    linha: analise.linha,
    situacao: analise.erros.length > 0 ? 'ERRO' : gravou ? 'CRIADA' : 'OK',
    erros: analise.erros,
    nome: analise.nome,
    email: analise.email,
  }));
  const validas = analises.filter((analise) => analise.erros.length === 0).length;
  return { total: analises.length, validas, criadas: gravou ? validas : 0, resultados };
}

// Grava todos os registros numa única transação e só depois manda os e-mails de boas-vindas.
// RA e registro: o último valor é lido uma vez no início da transação; os seguintes saem da memória.
async function gravarAlunos(dados: DadosAluno[], senhaInicial: string): Promise<void> {
  const senhaHash = await bcrypt.hash(senhaInicial, 10);
  const criados = await prisma.$transaction(
    async (tx) => {
      const proximo = await geradorRA(tx);
      const lista = [];
      for (const aluno of dados) {
        lista.push(await criarAlunoNoBanco(tx, aluno, senhaHash, proximo()));
      }
      return lista;
    },
    { timeout: 120000, maxWait: 10000 }
  );
  for (const aluno of criados) {
    avisarBoasVindas(aluno.usuario);
  }
}

async function gravarProfessores(dados: DadosProfessor[], senhaInicial: string): Promise<void> {
  const senhaHash = await bcrypt.hash(senhaInicial, 10);
  const criados = await prisma.$transaction(
    async (tx) => {
      const proximo = await geradorRegistro(tx);
      const lista = [];
      for (const professor of dados) {
        lista.push(await criarProfessorNoBanco(tx, professor, senhaHash, proximo()));
      }
      return lista;
    },
    { timeout: 120000, maxWait: 10000 }
  );
  for (const professor of criados) {
    avisarBoasVindas(professor.usuario);
  }
}

async function concluir<T>(
  analises: Analise<T>[],
  corpo: CorpoImportacao,
  gravar: (validos: T[]) => Promise<void>
): Promise<ResultadoImportacao> {
  const bloqueada = analises.some((analise) => analise.erros.length > 0);
  if (corpo.simular || bloqueada) {
    return {
      relatorio: montarRelatorio(analises, false),
      bloqueada: !corpo.simular && bloqueada,
      gravou: false,
    };
  }
  const validos = analises.flatMap((analise) => (analise.dados ? [analise.dados] : []));
  await gravar(validos);
  return { relatorio: montarRelatorio(analises, true), bloqueada: false, gravou: true };
}

// Confere a planilha e, se não for simulação e não houver erros, grava tudo.
export async function importarPlanilha(
  tipo: TipoPlanilha,
  corpo: CorpoImportacao
): Promise<ResultadoImportacao> {
  const mapas = corpo.linhas.map((linha) => normalizarLinha(linha));
  const senha = corpo.senhaInicial ?? '';
  if (tipo === 'alunos') {
    const analises = analisar(mapas, prepararAluno);
    await conferirEmails(analises);
    return concluir(analises, corpo, (validos) => gravarAlunos(validos, senha));
  }
  const analises = analisar(mapas, prepararProfessor);
  await conferirEmails(analises);
  return concluir(analises, corpo, (validos) => gravarProfessores(validos, senha));
}
