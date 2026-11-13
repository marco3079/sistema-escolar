import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AreaTexto, Aviso, Botao, Campo, Carregando, Modal, Selo, Tabela, formatarDataHora } from '../../ui';
import type { ColunaTabela } from '../../ui';
import { ItemGabaritoView } from './ProvaGabarito';
import { formatarNumero, mensagemErroProva } from './ProvaTipos';
import type { ProvaDTO, TentativaDetalhe, TentativaLinha } from './ProvaTipos';
import './provas.css';

// Situação de uma linha da lista de tentativas.
function situacaoDe(linha: TentativaLinha): { rotulo: string; cor: 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza' } {
  const t = linha.tentativa;
  if (!t) return { rotulo: 'Não iniciou', cor: 'cinza' };
  if (!t.enviadaEm) return { rotulo: 'Em andamento', cor: 'azul' };
  if (t.corrigida) return { rotulo: 'Corrigida', cor: 'verde' };
  return { rotulo: 'Aguardando correção', cor: 'amarelo' };
}

// Resultados da prova: tentativas dos alunos e a correção das dissertativas.
export function ProvaResultados({
  prova,
  podeCorrigir,
  aoFechar,
  aoMudou,
}: {
  prova: ProvaDTO;
  podeCorrigir: boolean;
  aoFechar: () => void;
  aoMudou: () => void;
}) {
  const [linhas, setLinhas] = useState<TentativaLinha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [tentativaId, setTentativaId] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<TentativaLinha[]>(`/provas/${prova.id}/tentativas`)
      .then((d) => {
        if (vivo) {
          setLinhas(d);
          setErro(null);
        }
      })
      .catch((e) => {
        if (vivo) setErro(mensagemErroProva(e));
      });
    return () => {
      vivo = false;
    };
  }, [prova.id, recarga]);

  const colunas: ColunaTabela<TentativaLinha>[] = [
    { titulo: 'Aluno', celula: (l) => l.aluno.nome },
    { titulo: 'RA', celula: (l) => l.aluno.ra },
    {
      titulo: 'Situação',
      celula: (l) => {
        const s = situacaoDe(l);
        return <Selo cor={s.cor}>{s.rotulo}</Selo>;
      },
    },
    { titulo: 'Enviada em', celula: (l) => (l.tentativa?.enviadaEm ? formatarDataHora(l.tentativa.enviadaEm) : '—') },
    {
      titulo: 'Nota objetiva',
      alinhar: 'direita',
      celula: (l) => formatarNumero(l.tentativa?.notaObjetiva ?? null),
    },
    {
      titulo: 'Nota final',
      alinhar: 'direita',
      celula: (l) => formatarNumero(l.tentativa?.notaFinal ?? null),
    },
    {
      titulo: 'A corrigir',
      alinhar: 'direita',
      celula: (l) => (l.tentativa && l.tentativa.pendentes > 0 ? String(l.tentativa.pendentes) : '—'),
    },
  ];

  const abrivel = (l: TentativaLinha) => Boolean(l.tentativa && l.tentativa.enviadaEm);

  return (
    <Modal aberto titulo={`Resultados: ${prova.titulo}`} aoFechar={aoFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {tentativaId !== null ? (
        <DetalheTentativa
          tentativaId={tentativaId}
          podeCorrigir={podeCorrigir}
          aoVoltar={() => setTentativaId(null)}
          aoCorrigido={() => {
            setRecarga((n) => n + 1);
            aoMudou();
          }}
        />
      ) : linhas === null && erro === null ? (
        <Carregando />
      ) : linhas !== null ? (
        <>
          <p className="prova-nota-pequena">
            Nota máxima: {formatarNumero(prova.notaMaxima)}. Toque em uma tentativa enviada para ver
            {podeCorrigir ? ' e corrigir' : ''} as respostas.
          </p>
          <Tabela
            colunas={colunas}
            dados={linhas}
            chave={(l) => l.inscricaoId}
            vazio="Nenhum aluno na turma."
            aoClicarLinha={(l) => {
              if (abrivel(l) && l.tentativa) setTentativaId(l.tentativa.id);
            }}
          />
        </>
      ) : null}
    </Modal>
  );
}

// Detalhe de uma tentativa: cada questão com a resposta; dissertativas recebem nota e comentário.
function DetalheTentativa({
  tentativaId,
  podeCorrigir,
  aoVoltar,
  aoCorrigido,
}: {
  tentativaId: number;
  podeCorrigir: boolean;
  aoVoltar: () => void;
  aoCorrigido: () => void;
}) {
  const [detalhe, setDetalhe] = useState<TentativaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<number, { pontos: string; comentario: string }>>({});
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<TentativaDetalhe>(`/tentativas/${tentativaId}`)
      .then((d) => {
        if (!vivo) return;
        setDetalhe(d);
        setErro(null);
        const inicio: Record<number, { pontos: string; comentario: string }> = {};
        for (const q of d.questoes) {
          if (q.tipo === 'DISSERTATIVA') {
            inicio[q.questaoId] = {
              pontos: q.pontosObtidos === null ? '' : String(q.pontosObtidos),
              comentario: q.comentario ?? '',
            };
          }
        }
        setNotas(inicio);
      })
      .catch((e) => {
        if (vivo) setErro(mensagemErroProva(e));
      });
    return () => {
      vivo = false;
    };
  }, [tentativaId]);

  async function salvarCorrecao() {
    if (!detalhe) return;
    const dissertativas = detalhe.questoes.filter((q) => q.tipo === 'DISSERTATIVA');
    const respostas: { questaoId: number; pontos: number; comentario: string }[] = [];
    for (const q of dissertativas) {
      const nota = notas[q.questaoId] ?? { pontos: '', comentario: '' };
      const pontos = Number(nota.pontos.trim().replace(',', '.'));
      if (nota.pontos.trim() === '' || !Number.isFinite(pontos) || pontos < 0 || pontos > q.pontos) {
        setErro(`Informe a nota de 0 a ${formatarNumero(q.pontos)} na questão de dissertativa.`);
        setOk(null);
        return;
      }
      if (nota.comentario.length > 1000) {
        setErro('O comentário passa de 1.000 caracteres.');
        setOk(null);
        return;
      }
      respostas.push({ questaoId: q.questaoId, pontos, comentario: nota.comentario });
    }

    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      await api.put(`/tentativas/${tentativaId}/correcao`, { respostas });
      setOk('Correção salva.');
      aoCorrigido();
      const novo = await api.get<TentativaDetalhe>(`/tentativas/${tentativaId}`);
      setDetalhe(novo);
    } catch (e) {
      setErro(mensagemErroProva(e));
    } finally {
      setSalvando(false);
    }
  }

  if (erro && !detalhe) {
    return (
      <>
        <Aviso tipo="erro">{erro}</Aviso>
        <Botao variante="secundario" aoClicar={aoVoltar}>
          Voltar à lista
        </Botao>
      </>
    );
  }
  if (!detalhe) return <Carregando />;

  const temDissertativa = detalhe.questoes.some((q) => q.tipo === 'DISSERTATIVA');

  return (
    <div className="prova-detalhe-tentativa">
      <div className="prova-detalhe-cabecalho">
        <Botao variante="texto" aoClicar={aoVoltar}>
          ← Voltar à lista
        </Botao>
        <p className="prova-texto">
          <strong>{detalhe.aluno.nome}</strong> · RA {detalhe.aluno.ra}
          {' · '}
          {detalhe.corrigida
            ? `Nota final: ${formatarNumero(detalhe.notaFinal)}`
            : 'Aguardando a correção das dissertativas'}
        </p>
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {ok && <Aviso tipo="sucesso">{ok}</Aviso>}

      {/* Questões na ordem da prova; o número vem de `ordem` (ordem original, já embaralhada se for o caso). */}
      {detalhe.questoes.map((q) => (
        <ItemGabaritoView key={q.questaoId} item={q} numero={q.ordem}>
          {podeCorrigir && q.tipo === 'DISSERTATIVA' && notas[q.questaoId] && (
            <div className="prova-correcao">
              <Campo
                rotulo={`Pontos (de 0 a ${formatarNumero(q.pontos)})`}
                tipo="number"
                valor={notas[q.questaoId].pontos}
                aoMudar={(v) =>
                  setNotas((atual) => ({ ...atual, [q.questaoId]: { ...atual[q.questaoId], pontos: v } }))
                }
                obrigatorio
              />
              <AreaTexto
                rotulo="Comentário (opcional)"
                valor={notas[q.questaoId].comentario}
                aoMudar={(v) =>
                  setNotas((atual) => ({ ...atual, [q.questaoId]: { ...atual[q.questaoId], comentario: v } }))
                }
                linhas={2}
              />
            </div>
          )}
        </ItemGabaritoView>
      ))}

      {podeCorrigir && temDissertativa && (
        <div className="prova-acoes-modal">
          <Botao desabilitado={salvando} aoClicar={() => void salvarCorrecao()}>
            {salvando ? 'Salvando...' : 'Salvar correção'}
          </Botao>
        </div>
      )}
    </div>
  );
}
