import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { AreaTexto, Aviso, Avatar, Botao, MenuAcoes } from '../../ui';
import type { AcaoMenu } from '../../ui';
import { Votos, useVotacao } from './Votos';
import { SeloPapel, mensagemErro, tempoRelativo } from './comum';
import type { ComentarioDTO } from './comum';

// Nível máximo com recuo: a partir do sétimo nível, a árvore segue sem recuo extra.
const NIVEL_MAXIMO_RECUO = 6;

interface No {
  c: ComentarioDTO;
  filhos: No[];
}

interface Contexto {
  publicacaoId: number;
  fechada: boolean;
  aoMudar: () => void;
}

// Monta a árvore a partir da lista plana (paiId). Em cada nível, mais votados primeiro.
export function montarArvore(lista: ComentarioDTO[]): No[] {
  const nos: No[] = lista.map((c) => ({ c, filhos: [] }));
  const porId = new Map<number, No>(nos.map((n) => [n.c.id, n]));
  const raizes: No[] = [];
  for (const no of nos) {
    const pai = no.c.paiId !== null ? porId.get(no.c.paiId) : undefined;
    if (pai) {
      pai.filhos.push(no);
    } else {
      raizes.push(no);
    }
  }
  const ordenar = (lote: No[]) => {
    lote.sort(
      (a, b) =>
        b.c.pontos - a.c.pontos ||
        a.c.criadoEm.localeCompare(b.c.criadoEm) ||
        a.c.id - b.c.id
    );
    lote.forEach((n) => ordenar(n.filhos));
  };
  ordenar(raizes);
  return raizes;
}

// Caixa de texto para comentar (paiId nulo) ou responder (paiId informado).
export function CaixaResposta({
  publicacaoId,
  paiId = null,
  aoEnviar,
  aoCancelar,
}: {
  publicacaoId: number;
  paiId?: number | null;
  aoEnviar: () => void;
  aoCancelar?: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const corpo = texto.trim();
    if (corpo === '') {
      setErro('Escreva o comentário antes de enviar.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await api.post(`/forum/publicacoes/${publicacaoId}/comentarios`, { corpo, paiId });
      setTexto('');
      setEnviando(false);
      aoEnviar();
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  return (
    <form className="forum-caixa-comentario" onSubmit={enviar}>
      <AreaTexto
        rotulo={paiId === null ? 'Escreva um comentário' : 'Sua resposta'}
        valor={texto}
        aoMudar={setTexto}
        linhas={3}
      />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="forum-formulario-acoes">
        {aoCancelar && (
          <Botao variante="secundario" aoClicar={aoCancelar}>
            Cancelar
          </Botao>
        )}
        <Botao tipo="submit" desabilitado={enviando}>
          {enviando ? 'Enviando...' : 'Comentar'}
        </Botao>
      </div>
    </form>
  );
}

// Lista de comentários: a árvore inteira a partir da lista plana.
export function Comentarios({
  publicacaoId,
  lista,
  fechada,
  aoMudar,
}: {
  publicacaoId: number;
  lista: ComentarioDTO[];
  fechada: boolean;
  aoMudar: () => void;
}) {
  const arvore = useMemo(() => montarArvore(lista), [lista]);
  if (lista.length === 0) {
    return <p className="forum-vazio">Ainda não há comentários.</p>;
  }
  return (
    <NosComentarios
      nos={arvore}
      profundidade={0}
      contexto={{ publicacaoId, fechada, aoMudar }}
    />
  );
}

function NosComentarios({
  nos,
  profundidade,
  contexto,
}: {
  nos: No[];
  profundidade: number;
  contexto: Contexto;
}) {
  let classe = 'forum-arvore';
  if (profundidade > 0) {
    classe = profundidade <= NIVEL_MAXIMO_RECUO ? 'forum-filhos' : 'forum-filhos forum-filhos-plano';
  }
  return (
    <ul className={classe}>
      {nos.map((no) => (
        <NoComentario key={no.c.id} no={no} profundidade={profundidade} contexto={contexto} />
      ))}
    </ul>
  );
}

function NoComentario({
  no,
  profundidade,
  contexto,
}: {
  no: No;
  profundidade: number;
  contexto: Contexto;
}) {
  const c = no.c;
  const temFilhos = no.filhos.length > 0;
  const voto = useVotacao(`/forum/comentarios/${c.id}/voto`, c.pontos, c.meuVoto);
  const [recolhido, setRecolhido] = useState(false);
  const [respondendo, setRespondendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(c.corpo);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    const corpo = rascunho.trim();
    if (corpo === '') {
      setErro('Escreva o comentário antes de salvar.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await api.put(`/forum/comentarios/${c.id}`, { corpo });
      setEditando(false);
      setEnviando(false);
      contexto.aoMudar();
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  async function excluir() {
    if (!window.confirm('Excluir este comentário?')) return;
    setErro(null);
    try {
      await api.del(`/forum/comentarios/${c.id}`);
      contexto.aoMudar();
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  const acoes: AcaoMenu[] = [];
  if (c.posso.editar) {
    acoes.push({
      rotulo: 'Editar',
      icone: 'lapis',
      aoClicar: () => {
        setRascunho(c.corpo);
        setEditando(true);
      },
    });
  }
  if (c.posso.excluir) {
    acoes.push({ rotulo: 'Excluir', icone: 'fechar', perigo: true, aoClicar: () => void excluir() });
  }

  return (
    <li className="forum-comentario">
      {temFilhos && (
        <button
          type="button"
          className="forum-linha-ramo"
          aria-expanded={!recolhido}
          aria-label={recolhido ? 'Expandir respostas' : 'Recolher respostas'}
          onClick={() => setRecolhido((v) => !v)}
        />
      )}

      <div className="forum-comentario-corpo">
        {c.removido ? (
          <p className="forum-texto-suave">[comentário removido]</p>
        ) : (
          <>
            <div className="forum-comentario-cabecalho">
              <Avatar nome={c.autor.nome} foto={c.autor.foto} tamanho={28} />
              <strong>{c.autor.nome}</strong>
              <SeloPapel perfil={c.autor.perfil} />
              <span className="forum-texto-suave">
                {tempoRelativo(c.criadoEm)}
                {c.editadoEm ? ' · editado' : ''}
              </span>
              {acoes.length > 0 && (
                <span className="forum-comentario-acoes">
                  <MenuAcoes acoes={acoes} rotulo={`Ações do comentário de ${c.autor.nome}`} />
                </span>
              )}
            </div>

            {editando ? (
              <form className="forum-caixa-comentario" onSubmit={salvarEdicao}>
                <AreaTexto rotulo="Editar comentário" valor={rascunho} aoMudar={setRascunho} linhas={3} />
                <div className="forum-formulario-acoes">
                  <Botao variante="secundario" aoClicar={() => setEditando(false)}>
                    Cancelar
                  </Botao>
                  <Botao tipo="submit" desabilitado={enviando}>
                    {enviando ? 'Salvando...' : 'Salvar'}
                  </Botao>
                </div>
              </form>
            ) : (
              <p className="forum-comentario-texto">{c.corpo}</p>
            )}

            {!editando && (
              <div className="forum-comentario-rodape">
                <Votos
                  orientacao="linha"
                  pontos={voto.pontos}
                  meuVoto={voto.meuVoto}
                  aoVotar={(valor) => void voto.votar(valor)}
                />
                {!contexto.fechada && (
                  <button
                    type="button"
                    className="forum-acao"
                    aria-expanded={respondendo}
                    onClick={() => setRespondendo((v) => !v)}
                  >
                    Responder
                  </button>
                )}
              </div>
            )}
            {voto.erro && <Aviso tipo="erro">{voto.erro}</Aviso>}
            {erro && <Aviso tipo="erro">{erro}</Aviso>}

            {respondendo && !contexto.fechada && (
              <CaixaResposta
                publicacaoId={contexto.publicacaoId}
                paiId={c.id}
                aoEnviar={() => {
                  setRespondendo(false);
                  contexto.aoMudar();
                }}
                aoCancelar={() => setRespondendo(false)}
              />
            )}
          </>
        )}

        {temFilhos && recolhido && (
          <button type="button" className="forum-acao" onClick={() => setRecolhido(false)}>
            {no.filhos.length === 1 ? 'Mostrar 1 resposta' : `Mostrar ${no.filhos.length} respostas`}
          </button>
        )}
      </div>

      {temFilhos && !recolhido && (
        <NosComentarios nos={no.filhos} profundidade={profundidade + 1} contexto={contexto} />
      )}
    </li>
  );
}
