import { z } from 'zod';

// Esquemas de entrada das provas (Contrato D). Datas chegam como texto ISO e viram Date.

const TIPOS = ['OBJETIVA', 'VERDADEIRO_FALSO', 'DISSERTATIVA'] as const;

const dataSchema = z
  .string()
  .trim()
  .refine((valor) => !Number.isNaN(Date.parse(valor)), 'Data inválida')
  .transform((valor) => new Date(valor));

export const provaSchema = z
  .object({
    titulo: z.string().trim().min(2, 'O título tem de 2 a 120 caracteres').max(120, 'O título tem de 2 a 120 caracteres'),
    instrucoes: z.string().max(5000, 'As instruções têm no máximo 5.000 caracteres').default(''),
    abreEm: dataSchema,
    fechaEm: dataSchema,
    duracaoMin: z.number().int().min(5, 'A duração tem de 5 a 300 minutos').max(300, 'A duração tem de 5 a 300 minutos'),
    embaralhar: z.boolean().default(false),
    notaMaxima: z.number().min(0.1, 'A nota máxima tem de 0,1 a 100').max(100, 'A nota máxima tem de 0,1 a 100'),
    mostrarGabarito: z.boolean().default(false),
    avaliacaoId: z.number().int().positive().nullish(),
  })
  .refine((d) => d.fechaEm.getTime() > d.abreEm.getTime(), {
    message: 'O fechamento tem de ser depois da abertura',
    path: ['fechaEm'],
  });

export interface QuestaoEntrada {
  tipo: (typeof TIPOS)[number];
  enunciado: string;
  alternativas: string[];
  correta: number | null;
  pontos: number;
}

export const questaoSchema = z
  .object({
    id: z.number().int().positive().nullish(),
    tipo: z.enum(TIPOS),
    enunciado: z.string().trim().min(1, 'O enunciado é obrigatório').max(5000, 'O enunciado tem no máximo 5.000 caracteres'),
    alternativas: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Alternativa vazia')
          .max(500, 'Cada alternativa tem no máximo 500 caracteres')
      )
      .max(6, 'Use de 2 a 6 alternativas')
      .default([]),
    correta: z.number().int().nullish(),
    pontos: z.number().min(0.1, 'Os pontos vão de 0,1 a 100').max(100, 'Os pontos vão de 0,1 a 100'),
  })
  .superRefine((q, ctx) => {
    if (q.tipo === 'OBJETIVA') {
      if (q.alternativas.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Use de 2 a 6 alternativas', path: ['alternativas'] });
      }
      if (q.correta === null || q.correta === undefined || q.correta < 0 || q.correta >= q.alternativas.length) {
        ctx.addIssue({ code: 'custom', message: 'Marque a alternativa certa', path: ['correta'] });
      }
    } else if (q.tipo === 'VERDADEIRO_FALSO') {
      if (q.correta !== 0 && q.correta !== 1) {
        ctx.addIssue({ code: 'custom', message: 'Indique se a afirmação é verdadeira (1) ou falsa (0)', path: ['correta'] });
      }
    }
  })
  .transform(
    (q): QuestaoEntrada => ({
      tipo: q.tipo,
      enunciado: q.enunciado,
      alternativas: q.tipo === 'OBJETIVA' ? q.alternativas : [],
      correta: q.tipo === 'DISSERTATIVA' ? null : (q.correta ?? null),
      pontos: q.pontos,
    })
  );

export const questoesSchema = z.object({
  questoes: z.array(questaoSchema).min(1, 'Inclua ao menos uma questão').max(60, 'A prova tem no máximo 60 questões'),
});

export const publicarSchema = z.object({
  publicada: z.boolean(),
});

export interface RespostaEntrada {
  questaoId: number;
  alternativa?: number | null;
  texto?: string;
}

const respostaEntradaSchema = z.object({
  questaoId: z.number().int().positive(),
  alternativa: z.number().int().nullish(),
  texto: z.string().max(10000, 'A resposta tem no máximo 10.000 caracteres').optional(),
});

export const respostasSchema = z.object({
  respostas: z.array(respostaEntradaSchema).max(60, 'Respostas demais'),
});

export const respostasOpcionaisSchema = respostasSchema.partial();

export const correcaoSchema = z.object({
  respostas: z
    .array(
      z.object({
        questaoId: z.number().int().positive(),
        pontos: z.number().min(0, 'Os pontos não podem ser negativos'),
        comentario: z.string().max(1000, 'O comentário tem no máximo 1.000 caracteres').nullish(),
      })
    )
    .max(60, 'Correções demais'),
});
