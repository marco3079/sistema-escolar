import { prisma } from '../../lib/prisma';

function arredondar1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Recalcula notaFinal e frequencia das inscrições dadas. Não altera o status.
// notaFinal = média ponderada (peso da avaliação) de valor / notaMaxima * 10, só com notas lançadas; null sem notas.
// frequencia = presenças true / presenças registradas * 100; null sem presenças registradas.
export async function recalcularInscricoes(inscricaoIds: number[]): Promise<void> {
  if (inscricaoIds.length === 0) return;

  const inscricoes = await prisma.inscricao.findMany({
    where: { id: { in: inscricaoIds } },
    include: {
      turma: { include: { avaliacoes: true } },
      notas: true,
      presencas: true,
    },
  });

  for (const inscricao of inscricoes) {
    const avaliacoesPorId = new Map(inscricao.turma.avaliacoes.map((a) => [a.id, a]));

    let somaPonderada = 0;
    let somaPesos = 0;
    for (const nota of inscricao.notas) {
      const avaliacao = avaliacoesPorId.get(nota.avaliacaoId);
      if (!avaliacao || avaliacao.notaMaxima <= 0) continue;
      const nota10 = (nota.valor / avaliacao.notaMaxima) * 10;
      somaPonderada += avaliacao.peso * nota10;
      somaPesos += avaliacao.peso;
    }
    const notaFinal = somaPesos > 0 ? arredondar1(somaPonderada / somaPesos) : null;

    const totalPresencas = inscricao.presencas.length;
    const presentes = inscricao.presencas.filter((p) => p.presente).length;
    const frequencia = totalPresencas > 0 ? arredondar1((presentes / totalPresencas) * 100) : null;

    await prisma.inscricao.update({
      where: { id: inscricao.id },
      data: { notaFinal, frequencia },
    });
  }
}

// Recalcula todas as inscrições da turma.
export async function recalcularTurma(turmaId: number): Promise<void> {
  const inscricoes = await prisma.inscricao.findMany({
    where: { turmaId },
    select: { id: true },
  });
  await recalcularInscricoes(inscricoes.map((i) => i.id));
}
