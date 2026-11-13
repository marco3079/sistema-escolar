import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { registrarTarefaPeriodica } from './agendador';

// Central de notificações (o sino). Contrato em docs/plano/quinta-leva.md, "Contrato B".

export type TipoNotificacao =
  | 'COMUNICADO'
  | 'SUPORTE'
  | 'FORUM'
  | 'NOTA'
  | 'FINANCEIRO'
  | 'MEDALHA'
  | 'BIBLIOTECA'
  | 'SISTEMA';

export interface NovaNotificacao {
  tipo: TipoNotificacao;
  titulo: string; // até 120 caracteres (cortar)
  texto?: string; // até 300 caracteres (cortar)
  link?: string; // caminho dentro do portal, sem prefixo: "/comunicados", "/forum/p/12", "/boletim"...
  chave?: string; // se já existir aviso com a mesma chave para o usuário, não cria outro
}

const TAMANHO_TITULO = 120;
const TAMANHO_TEXTO = 300;
const TAMANHO_LOTE = 500;
const DIAS_RETENCAO = 60;
const MINUTOS_LIMPEZA = 720;
const MS_DIA = 24 * 60 * 60 * 1000;

// Corta por caracteres (sem partir um caractere composto no meio).
function cortar(valor: string, tamanho: number): string {
  return [...valor].slice(0, tamanho).join('');
}

async function gravar(
  usuarioIds: number[],
  base: Omit<Prisma.NotificacaoCreateManyInput, 'usuarioId'>
): Promise<void> {
  for (let inicio = 0; inicio < usuarioIds.length; inicio += TAMANHO_LOTE) {
    const fatia = usuarioIds.slice(inicio, inicio + TAMANHO_LOTE);
    await prisma.notificacao.createMany({
      data: fatia.map((usuarioId) => ({ ...base, usuarioId })),
      skipDuplicates: true,
    });
  }
}

// Cria o aviso para cada usuário (sem repetir ids). Nunca lança e não espera: uso "dispare e siga".
export function notificar(usuarioIds: number[], aviso: NovaNotificacao): void {
  try {
    const ids = [...new Set(usuarioIds)].filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) {
      return;
    }
    const base: Omit<Prisma.NotificacaoCreateManyInput, 'usuarioId'> = {
      tipo: aviso.tipo,
      titulo: cortar(aviso.titulo.trim(), TAMANHO_TITULO),
      texto: cortar((aviso.texto ?? '').trim(), TAMANHO_TEXTO),
      link: aviso.link ? aviso.link : null,
      chave: aviso.chave ? aviso.chave : null,
    };
    gravar(ids, base).catch((erro) => {
      console.error('Falha ao gravar notificações:', erro instanceof Error ? erro.message : erro);
    });
  } catch (erro) {
    console.error('Falha ao montar notificações:', erro instanceof Error ? erro.message : erro);
  }
}

// Limpeza: apaga avisos com mais de 60 dias, a cada 720 minutos.
registrarTarefaPeriodica('limpeza-notificacoes', MINUTOS_LIMPEZA, async () => {
  const limite = new Date(Date.now() - DIAS_RETENCAO * MS_DIA);
  await prisma.notificacao.deleteMany({ where: { criadaEm: { lt: limite } } });
});
