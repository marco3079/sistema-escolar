import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import { AreaTexto, Aviso, Botao, Campo, Modal, Selecao, Selo } from '../../ui';
import {
  ROTULO_TIPO_QUESTAO,
  VF_FALSO,
  VF_VERDADEIRO,
  formatarNumero,
  mensagemErroProva,
  totalPontosDe,
} from './ProvaTipos';
import type { ProvaDTO, QuestaoEdicao, TipoQuestao } from './ProvaTipos';
import './provas.css';

const MAX_QUESTOES = 60;
const MAX_ALTERNATIVAS = 6;
const MIN_ALTERNATIVAS = 2;

// Item do editor: `chave` é só para o React (a questão nova ainda não tem id).
interface Item {
  chave: number;
  q: QuestaoEdicao;
  // Texto digitado nos pontos: só vira número ao validar/salvar (permite apagar e digitar decimais).
  pontosTexto: string;
}

// Pontos a partir do texto digitado (aceita vírgula ou ponto). Vazio ou inválido: NaN.
function lerPontos(texto: string): number {
  const limpo = texto.trim();
  if (limpo === '') return Number.NaN;
  return Number(limpo.replace(',', '.'));
}

// Valores padrão ao criar ou trocar o tipo da questão.
function questaoNova(tipo: TipoQuestao): QuestaoEdicao {
  if (tipo === 'OBJETIVA') {
    return { tipo, enunciado: '', alternativas: ['', ''], correta: null, pontos: 1 };
  }
  if (tipo === 'VERDADEIRO_FALSO') {
    // Convenção do schema: correta 1 = verdadeiro, 0 = falso.
    return { tipo, enunciado: '', alternativas: [], correta: VF_VERDADEIRO, pontos: 1 };
  }
  return { tipo, enunciado: '', alternativas: [], correta: null, pontos: 1 };
}

// Confere todas as questões e monta o corpo de PUT /provas/:id/questoes. Devolve o erro, se houver.
function montarQuestoes(itens: Item[]): { erro: string } | { questoes: QuestaoEdicao[] } {
  if (itens.length === 0) return { erro: 'Inclua ao menos uma questão.' };
  if (itens.length > MAX_QUESTOES) return { erro: `A prova aceita no máximo ${MAX_QUESTOES} questões.` };

  const questoes: QuestaoEdicao[] = [];
  for (let i = 0; i < itens.length; i++) {
    const q = itens[i].q;
    const n = i + 1;
    const enunciado = q.enunciado.trim();
    if (enunciado === '' || enunciado.length > 5000) {
      return { erro: `Questão ${n}: o enunciado é obrigatório (até 5.000 caracteres).` };
    }
    const pontos = lerPontos(itens[i].pontosTexto);
    if (!Number.isFinite(pontos) || pontos < 0.1 || pontos > 100) {
      return { erro: `Questão ${n}: os pontos têm de ser de 0,1 a 100.` };
    }

    if (q.tipo === 'OBJETIVA') {
      const alternativas = q.alternativas.map((a) => a.trim());
      if (alternativas.length < MIN_ALTERNATIVAS || alternativas.length > MAX_ALTERNATIVAS) {
        return { erro: `Questão ${n}: a objetiva tem de ter de 2 a 6 alternativas.` };
      }
      if (alternativas.some((a) => a === '' || a.length > 500)) {
        return { erro: `Questão ${n}: cada alternativa tem de ter de 1 a 500 caracteres.` };
      }
      if (q.correta === null || q.correta < 0 || q.correta >= alternativas.length) {
        return { erro: `Questão ${n}: marque a alternativa certa.` };
      }
      questoes.push({ id: q.id, tipo: q.tipo, enunciado, alternativas, correta: q.correta, pontos });
    } else if (q.tipo === 'VERDADEIRO_FALSO') {
      if (q.correta !== VF_VERDADEIRO && q.correta !== VF_FALSO) {
        return { erro: `Questão ${n}: marque se a afirmação é verdadeira ou falsa.` };
      }
      questoes.push({ id: q.id, tipo: q.tipo, enunciado, alternativas: [], correta: q.correta, pontos });
    } else {
      questoes.push({ id: q.id, tipo: q.tipo, enunciado, alternativas: [], correta: null, pontos });
    }
  }
  return { questoes };
}

// Editor de questões da prova: adicionar, editar, reordenar e excluir; salva tudo de uma vez.
export function ProvaEditor({
  prova,
  aoFechar,
  aoSalvo,
}: {
  prova: ProvaDTO;
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  const [itens, setItens] = useState<Item[]>(() =>
    (prova.questoes ?? []).map((q, i) => ({
      chave: i + 1,
      q: { ...q, alternativas: [...q.alternativas] },
      pontosTexto: String(q.pontos),
    })),
  );
  const proximaChave = useRef((prova.questoes?.length ?? 0) + 1);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Com tentativa iniciada o servidor não aceita mudanças nas questões (409).
  const bloqueada = prova.resumo?.temTentativa === true;

  function atualizarPontos(chave: number, texto: string) {
    setItens((atuais) => atuais.map((it) => (it.chave === chave ? { ...it, pontosTexto: texto } : it)));
  }

  function atualizar(chave: number, parcial: Partial<QuestaoEdicao>) {
    setItens((atuais) => atuais.map((it) => (it.chave === chave ? { ...it, q: { ...it.q, ...parcial } } : it)));
  }

  function adicionar(tipo: TipoQuestao) {
    const chave = proximaChave.current;
    proximaChave.current += 1;
    setItens((atuais) => [...atuais, { chave, q: questaoNova(tipo), pontosTexto: '1' }]);
  }

  function trocarTipo(chave: number, tipo: TipoQuestao) {
    setItens((atuais) =>
      atuais.map((it) => {
        if (it.chave !== chave) return it;
        const base = questaoNova(tipo);
        // Mantém enunciado ao trocar o tipo (os pontos ficam no texto digitado).
        return { ...it, q: { ...base, enunciado: it.q.enunciado } };
      }),
    );
  }

  function alterarAlternativa(chave: number, indice: number, texto: string) {
    setItens((atuais) =>
      atuais.map((it) => {
        if (it.chave !== chave) return it;
        const alternativas = it.q.alternativas.map((a, i) => (i === indice ? texto : a));
        return { ...it, q: { ...it.q, alternativas } };
      }),
    );
  }

  function adicionarAlternativa(chave: number) {
    setItens((atuais) =>
      atuais.map((it) => {
        if (it.chave !== chave || it.q.alternativas.length >= MAX_ALTERNATIVAS) return it;
        return { ...it, q: { ...it.q, alternativas: [...it.q.alternativas, ''] } };
      }),
    );
  }

  // Remover uma alternativa ajusta a certa: se era a certa, nenhuma fica marcada.
  function removerAlternativa(chave: number, indice: number) {
    setItens((atuais) =>
      atuais.map((it) => {
        if (it.chave !== chave || it.q.alternativas.length <= MIN_ALTERNATIVAS) return it;
        const alternativas = it.q.alternativas.filter((_, i) => i !== indice);
        let correta = it.q.correta;
        if (correta !== null) {
          if (correta === indice) correta = null;
          else if (correta > indice) correta = correta - 1;
        }
        return { ...it, q: { ...it.q, alternativas, correta } };
      }),
    );
  }

  function mover(chave: number, direcao: -1 | 1) {
    setItens((atuais) => {
      const pos = atuais.findIndex((it) => it.chave === chave);
      const alvo = pos + direcao;
      if (pos < 0 || alvo < 0 || alvo >= atuais.length) return atuais;
      const copia = [...atuais];
      [copia[pos], copia[alvo]] = [copia[alvo], copia[pos]];
      return copia;
    });
  }

  function excluir(chave: number) {
    setItens((atuais) => atuais.filter((it) => it.chave !== chave));
  }

  async function salvarTudo() {
    const resultado = montarQuestoes(itens);
    if ('erro' in resultado) {
      setErro(resultado.erro);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await api.put(`/provas/${prova.id}/questoes`, { questoes: resultado.questoes });
      aoSalvo();
    } catch (e) {
      setErro(mensagemErroProva(e));
      setSalvando(false);
    }
  }

  const total = totalPontosDe(itens.map((it) => ({ pontos: lerPontos(it.pontosTexto) || 0 })));

  return (
    <Modal aberto titulo={`Questões: ${prova.titulo}`} aoFechar={aoFechar}>
      <div className="prova-editor">
        <div className="prova-editor-barra">
          <span className="prova-total" aria-live="polite">
            {itens.length} {itens.length === 1 ? 'questão' : 'questões'} · total de{' '}
            {formatarNumero(total)} {total === 1 ? 'ponto' : 'pontos'}
          </span>
          <div className="prova-editor-adicionar" role="group" aria-label="Adicionar questão">
            <Botao variante="secundario" desabilitado={bloqueada} aoClicar={() => adicionar('OBJETIVA')}>
              + Objetiva
            </Botao>
            <Botao variante="secundario" desabilitado={bloqueada} aoClicar={() => adicionar('VERDADEIRO_FALSO')}>
              + Verdadeiro ou falso
            </Botao>
            <Botao variante="secundario" desabilitado={bloqueada} aoClicar={() => adicionar('DISSERTATIVA')}>
              + Dissertativa
            </Botao>
          </div>
        </div>

        {bloqueada && (
          <Aviso tipo="info">
            Esta prova já tem tentativas iniciadas: as questões não podem mais ser alteradas.
          </Aviso>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {itens.length === 0 && <p className="tabela-vazia">Nenhuma questão ainda. Use os botões acima para adicionar.</p>}

        <ol className="prova-editor-lista">
          {itens.map((it, pos) => (
            <li key={it.chave} className="prova-questao-editor">
              <div className="prova-questao-editor-topo">
                <strong>Questão {pos + 1}</strong>
                <div className="prova-questao-editor-acoes">
                  <Botao variante="texto" desabilitado={bloqueada || pos === 0} aoClicar={() => mover(it.chave, -1)}>
                    Subir
                  </Botao>
                  <Botao
                    variante="texto"
                    desabilitado={bloqueada || pos === itens.length - 1}
                    aoClicar={() => mover(it.chave, 1)}
                  >
                    Descer
                  </Botao>
                  <Botao variante="perigo" desabilitado={bloqueada} aoClicar={() => excluir(it.chave)}>
                    Excluir
                  </Botao>
                </div>
              </div>

              <div className="prova-linha-duas">
                <Selecao
                  rotulo="Tipo"
                  valor={it.q.tipo}
                  aoMudar={(v) => trocarTipo(it.chave, v as TipoQuestao)}
                  opcoes={(Object.keys(ROTULO_TIPO_QUESTAO) as TipoQuestao[]).map((t) => ({
                    valor: t,
                    rotulo: ROTULO_TIPO_QUESTAO[t],
                  }))}
                />
                <Campo
                  rotulo="Pontos"
                  tipo="text"
                  valor={it.pontosTexto}
                  aoMudar={(v) => atualizarPontos(it.chave, v)}
                  obrigatorio
                />
              </div>

              <AreaTexto
                rotulo="Enunciado"
                valor={it.q.enunciado}
                aoMudar={(v) => atualizar(it.chave, { enunciado: v })}
                linhas={3}
              />

              {it.q.tipo === 'OBJETIVA' && (
                <fieldset className="prova-alternativas-editor" disabled={bloqueada}>
                  <legend className="prova-rotulo-pequeno">Alternativas (marque a certa)</legend>
                  {it.q.alternativas.map((texto, i) => (
                    <div key={i} className="prova-alternativa-editor">
                      <input
                        type="radio"
                        name={`prova-certa-${it.chave}`}
                        aria-label={`Alternativa ${String.fromCharCode(65 + i)} é a certa`}
                        checked={it.q.correta === i}
                        onChange={() => atualizar(it.chave, { correta: i })}
                      />
                      <span className="prova-opcao-letra">{String.fromCharCode(65 + i)})</span>
                      <input
                        type="text"
                        className="campo-controle"
                        aria-label={`Texto da alternativa ${String.fromCharCode(65 + i)}`}
                        value={texto}
                        onChange={(e) => alterarAlternativa(it.chave, i, e.target.value)}
                      />
                      <Botao
                        variante="texto"
                        desabilitado={it.q.alternativas.length <= MIN_ALTERNATIVAS}
                        aoClicar={() => removerAlternativa(it.chave, i)}
                      >
                        Remover
                      </Botao>
                    </div>
                  ))}
                  {it.q.alternativas.length < MAX_ALTERNATIVAS && (
                    <Botao variante="texto" aoClicar={() => adicionarAlternativa(it.chave)}>
                      + Alternativa
                    </Botao>
                  )}
                </fieldset>
              )}

              {it.q.tipo === 'VERDADEIRO_FALSO' && (
                <fieldset className="prova-alternativas-editor" disabled={bloqueada}>
                  <legend className="prova-rotulo-pequeno">Resposta certa</legend>
                  <label className="caixa">
                    <input
                      type="radio"
                      name={`prova-vf-${it.chave}`}
                      checked={it.q.correta === VF_VERDADEIRO}
                      onChange={() => atualizar(it.chave, { correta: VF_VERDADEIRO })}
                    />
                    <span>Verdadeiro</span>
                  </label>
                  <label className="caixa">
                    <input
                      type="radio"
                      name={`prova-vf-${it.chave}`}
                      checked={it.q.correta === VF_FALSO}
                      onChange={() => atualizar(it.chave, { correta: VF_FALSO })}
                    />
                    <span>Falso</span>
                  </label>
                </fieldset>
              )}

              {it.q.tipo === 'DISSERTATIVA' && (
                <p className="prova-nota-pequena">
                  <Selo>Corrigida pelo professor</Selo> depois do envio, com a nota de cada resposta.
                </p>
              )}
            </li>
          ))}
        </ol>

        <div className="prova-acoes-modal">
          <Botao variante="secundario" aoClicar={aoFechar}>
            Cancelar
          </Botao>
          <Botao desabilitado={salvando || bloqueada} aoClicar={() => void salvarTudo()}>
            {salvando ? 'Salvando...' : 'Salvar questões'}
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
