import { useState } from 'react';
import { useDados } from '../../lib/useDados';
import { Aviso, Carregando, Selecao, Selo } from '../../ui';
import type { BoletimFamilia, ItemBoletimFamilia } from './tipos';
import {
  FREQUENCIA_MINIMA,
  formatarNumeroFamilia,
  formatarPercentualFamilia,
  limitarPercentual,
  mediaMinimaDoNivel,
} from './tipos';
import './responsavel.css';

function textoNota(avaliacao: { valor: number | null; notaMaxima: number }): string {
  if (avaliacao.valor === null) return '—';
  return formatarNumeroFamilia(avaliacao.valor) + (avaliacao.notaMaxima !== 10 ? `/${avaliacao.notaMaxima}` : '');
}

function mediaDe(valores: (number | null)[]): number | null {
  const validos = valores.filter((v): v is number => v !== null && v !== undefined);
  if (validos.length === 0) return null;
  return validos.reduce((soma, v) => soma + v, 0) / validos.length;
}

const SITUACOES: Record<string, { rotulo: string; cor: 'azul' | 'verde' | 'vermelho' | 'cinza' }> = {
  CURSANDO: { rotulo: 'Cursando', cor: 'azul' },
  APROVADO: { rotulo: 'Aprovado', cor: 'verde' },
  REPROVADO_NOTA: { rotulo: 'Reprovado por nota', cor: 'vermelho' },
  REPROVADO_FALTA: { rotulo: 'Reprovado por falta', cor: 'vermelho' },
  TRANCADO: { rotulo: 'Trancado', cor: 'cinza' },
};

function SeloSituacao({ valor }: { valor: string }) {
  const situacao = SITUACOES[valor];
  return <Selo cor={situacao ? situacao.cor : 'cinza'}>{situacao ? situacao.rotulo : valor}</Selo>;
}

function Medidor({
  rotulo,
  texto,
  proporcao,
  classe,
  marcador,
}: {
  rotulo: string;
  texto: string;
  proporcao: number | null;
  classe: string;
  marcador: number;
}) {
  return (
    <div className="resp-medidor">
      <span className="resp-medidor-rotulo">{rotulo}</span>
      <span className={`resp-medidor-valor ${classe}`}>{texto}</span>
      <div className="resp-barra" role="img" aria-label={proporcao === null ? `${rotulo} ainda não lançada` : `${rotulo} ${texto}`}>
        {proporcao !== null && (
          <span className={`resp-barra-preenchimento ${classe === 'resp-texto-perigo' ? 'resp-barra-baixa' : 'resp-barra-ok'}`} style={{ width: `${limitarPercentual(proporcao)}%` }} />
        )}
        <span className="resp-marcador" style={{ left: `${marcador}%` }} />
      </div>
    </div>
  );
}

function CartaoDisciplina({ item, minima }: { item: ItemBoletimFamilia; minima: number }) {
  const mediaBaixa = item.notaFinal !== null && item.notaFinal < minima;
  const freqBaixa = item.frequencia !== null && item.frequencia < FREQUENCIA_MINIMA;
  return (
    <article className="resp-disciplina">
      <header className="resp-disciplina-topo">
        <div className="resp-disciplina-titulo">
          <h3>{item.disciplina}</h3>
          <p className="resp-suave">
            {item.codigo} · Turma {item.turma}
          </p>
          <p className="resp-suave">{item.professor}</p>
        </div>
        <SeloSituacao valor={item.status} />
      </header>

      {item.avaliacoes.length === 0 ? (
        <p className="resp-suave">Sem avaliações lançadas.</p>
      ) : (
        <ul className="resp-avaliacoes">
          {item.avaliacoes.map((a, k) => (
            <li key={k}>
              <span>
                {a.nome} <small className="resp-suave">peso {formatarNumeroFamilia(a.peso)}</small>
              </span>
              <span>{textoNota(a)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="resp-medidores">
        <Medidor
          rotulo="Média"
          texto={formatarNumeroFamilia(item.notaFinal)}
          proporcao={item.notaFinal === null ? null : item.notaFinal * 10}
          classe={mediaBaixa ? 'resp-texto-perigo' : item.notaFinal === null ? '' : 'resp-texto-sucesso'}
          marcador={minima * 10}
        />
        <Medidor
          rotulo="Frequência"
          texto={formatarPercentualFamilia(item.frequencia)}
          proporcao={item.frequencia}
          classe={freqBaixa ? 'resp-texto-perigo' : ''}
          marcador={FREQUENCIA_MINIMA}
        />
      </div>
    </article>
  );
}

// Boletim de uma matrícula do aluno (somente leitura). Sem matrícula, não chama a API.
export function Boletim({ alunoId, matriculaId }: { alunoId: number; matriculaId: number | null }) {
  const caminho = matriculaId === null ? null : `/familia/alunos/${alunoId}/boletim?matriculaId=${matriculaId}`;
  const { dados, carregando, erro } = useDados<BoletimFamilia>(caminho);
  const [periodoEscolhido, setPeriodoEscolhido] = useState('');

  if (caminho === null) return <Aviso tipo="info">Este aluno ainda não tem matrícula.</Aviso>;
  if (carregando && !dados) return <Carregando />;
  if (erro && !dados) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;

  const minima = mediaMinimaDoNivel(dados.matricula.curso.nivel);
  const periodos = dados.periodos;
  // O primeiro da lista é o mais recente.
  const periodo = periodos.find((p) => String(p.periodo.id) === periodoEscolhido) ?? periodos[0] ?? null;
  const itens = periodo ? periodo.itens : [];
  const mediaPeriodo = mediaDe(itens.map((i) => i.notaFinal));
  const frequenciaMedia = mediaDe(itens.map((i) => i.frequencia));
  const aprovadas = itens.filter((i) => i.status === 'APROVADO').length;

  return (
    <div className="resp-visao">
      {periodos.length === 0 &&<Aviso tipo="info">Nenhuma disciplina nesta matrícula.</Aviso>}

      {periodo && (
        <>
          <div className="resp-indicadores">
            <div className="resp-indicador">
              <span className="resp-indicador-valor">{itens.length}</span>
              <span className="resp-indicador-rotulo">Disciplinas</span>
            </div>
            <div className="resp-indicador">
              <span className="resp-indicador-valor">{formatarNumeroFamilia(mediaPeriodo)}</span>
              <span className="resp-indicador-rotulo">Média do período</span>
            </div>
            <div className="resp-indicador">
              <span className="resp-indicador-valor">{formatarPercentualFamilia(frequenciaMedia)}</span>
              <span className="resp-indicador-rotulo">Frequência média</span>
            </div>
            <div className="resp-indicador">
              <span className="resp-indicador-valor">
                {aprovadas} de {itens.length}
              </span>
              <span className="resp-indicador-rotulo">Aprovadas</span>
            </div>
          </div>

          {periodos.length > 1 && (
            <div className="resp-seletor">
              <Selecao
                rotulo="Período"
                valor={periodoEscolhido}
                aoMudar={setPeriodoEscolhido}
                opcoes={periodos.map((p) => ({ valor: String(p.periodo.id), rotulo: p.periodo.nome }))}
                vazio="Mais recente"
              />
            </div>
          )}

          {itens.length === 0 ? (
            <Aviso tipo="info">Nenhuma disciplina neste período.</Aviso>
          ) : (
            <div className="resp-disciplinas">
              {itens.map((i) => (
                <CartaoDisciplina key={i.inscricaoId} item={i} minima={minima} />
              ))}
            </div>
          )}

          <p className="resp-suave">
            Média mínima para aprovação: {formatarNumeroFamilia(minima)}. Frequência mínima: {FREQUENCIA_MINIMA}%.
          </p>
        </>
      )}
    </div>
  );
}
