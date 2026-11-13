import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Carregando,
  formatarData,
  MenuAcoes,
  Modal,
  paraInputData,
  Selecao,
  Selo,
} from '../../ui';
import type { AcaoMenu } from '../../ui';
import type { PropsAba } from './comum';
import './sala.css';

export interface PlanoDTO {
  id: number;
  ordem: number;
  tema: string;
  objetivos: string;
  dataPrevista: string | null;
  aula: { id: number; data: string; conteudo: string | null } | null;
}

interface PlanoResposta {
  itens: PlanoDTO[];
  resumo: { planejadas: number; ministradas: number; aulasRegistradas: number };
}

interface AulaDTO {
  id: number;
  data: string;
  conteudo: string | null;
}

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Campos que o servidor exige no PUT do item (aulaId nulo desliga a ligação com a aula).
interface CamposItem {
  tema: string;
  objetivos: string;
  dataPrevista: string;
  aulaId: number | null;
}

export function Plano({ turmaId, podeEditar, base }: PropsAba) {
  const { dados, carregando, erro, recarregar } = useDados<PlanoResposta>(
    `/salas/${turmaId}/plano`,
  );
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<PlanoDTO | null>(null);
  const [ministrando, setMinistrando] = useState<PlanoDTO | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  function fecharForm() {
    setNovo(false);
    setEditando(null);
    setMinistrando(null);
  }

  // Grava os campos de um item (o PUT pede todos, inclusive a aula ligada).
  async function gravarItem(item: PlanoDTO, campos: Partial<CamposItem>) {
    const corpo: CamposItem = {
      tema: item.tema,
      objetivos: item.objetivos,
      dataPrevista: paraInputData(item.dataPrevista ?? '') || '',
      aulaId: item.aula?.id ?? null,
      ...campos,
    };
    await api.put(`/plano/${item.id}`, {
      tema: corpo.tema,
      objetivos: corpo.objetivos,
      dataPrevista: corpo.dataPrevista || null,
      aulaId: corpo.aulaId,
    });
  }

  async function desligarAula(item: PlanoDTO) {
    setErroAcao(null);
    try {
      await gravarItem(item, { aulaId: null });
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  async function excluir(item: PlanoDTO) {
    if (!window.confirm(`Excluir o tema "${item.tema}" do plano?`)) return;
    setErroAcao(null);
    try {
      await api.del(`/plano/${item.id}`);
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  // Troca o item de posição com o vizinho e grava a ordem completa.
  async function mover(indice: number, direcao: -1 | 1) {
    const itens = dados?.itens ?? [];
    const destino = indice + direcao;
    if (destino < 0 || destino >= itens.length) return;
    const ids = itens.map((i) => i.id);
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    setErroAcao(null);
    try {
      await api.put(`/salas/${turmaId}/plano/ordem`, { ids });
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  function acoesDoItem(item: PlanoDTO, indice: number, total: number): AcaoMenu[] {
    const acoes: AcaoMenu[] = [{ rotulo: 'Editar', icone: 'lapis', aoClicar: () => setEditando(item) }];
    if (item.aula) {
      acoes.push({
        rotulo: 'Desmarcar como ministrado',
        icone: 'fechar',
        aoClicar: () => void desligarAula(item),
      });
    } else {
      acoes.push({
        rotulo: 'Marcar como ministrado',
        icone: 'visto',
        aoClicar: () => setMinistrando(item),
      });
    }
    if (indice > 0) {
      acoes.push({ rotulo: 'Subir', icone: 'seta-cima', aoClicar: () => void mover(indice, -1) });
    }
    if (indice < total - 1) {
      acoes.push({ rotulo: 'Descer', icone: 'seta-baixo', aoClicar: () => void mover(indice, 1) });
    }
    acoes.push({ rotulo: 'Excluir', icone: 'lixeira', perigo: true, aoClicar: () => void excluir(item) });
    return acoes;
  }

  if (carregando) return <Carregando />;

  const itens = dados?.itens ?? [];
  const resumo = dados?.resumo ?? { planejadas: 0, ministradas: 0, aulasRegistradas: 0 };
  const pct = resumo.planejadas > 0 ? Math.min(100, Math.round((resumo.ministradas / resumo.planejadas) * 100)) : 0;

  return (
    <section className="sala-secao">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}

      <div className="sala-progresso-bloco">
        <div className="sala-progresso">
          <div
            className="sala-progresso-trilho"
            role="progressbar"
            aria-label="Temas ministrados"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span className="sala-progresso-preench" style={{ width: `${pct}%` }} />
          </div>
          <span className="sala-progresso-texto">
            {resumo.ministradas} de {resumo.planejadas}
          </span>
        </div>
        <p className="sala-texto-suave">
          Temas ministrados de {resumo.planejadas} planejados · {resumo.aulasRegistradas} aulas no diário
        </p>
      </div>

      {podeEditar && (
        <div className="sala-barra">
          <Botao aoClicar={() => setNovo(true)}>Novo tema</Botao>
        </div>
      )}

      {itens.length === 0 ? (
        <p className="tabela-vazia">Nenhum tema no plano de aula.</p>
      ) : (
        <ol className="sala-plano">
          {itens.map((item, indice) => (
            <li key={item.id} className="sala-plano-item">
              <span className="sala-plano-numero" aria-hidden="true">
                {indice + 1}
              </span>
              <div className="sala-plano-corpo">
                <div className="sala-material-topo">
                  <div className="sala-material-texto">
                    <h3 className="sala-material-titulo">{item.tema}</h3>
                    {item.dataPrevista && (
                      <p className="sala-texto-suave">Prevista para {formatarData(item.dataPrevista)}</p>
                    )}
                  </div>
                  {podeEditar && (
                    <MenuAcoes
                      rotulo={`Ações do tema ${item.tema}`}
                      acoes={acoesDoItem(item, indice, itens.length)}
                    />
                  )}
                </div>
                {item.objetivos && <p className="sala-quebra">{item.objetivos}</p>}
                {item.aula ? (
                  <Selo cor="verde">Ministrado em {formatarData(item.aula.data)}</Selo>
                ) : (
                  <Selo cor="cinza">Pendente</Selo>
                )}
                {item.aula?.conteudo && (
                  <p className="sala-texto-suave sala-quebra">Conteúdo: {item.aula.conteudo}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal
        aberto={novo || editando !== null}
        titulo={editando ? 'Editar tema' : 'Novo tema'}
        aoFechar={fecharForm}
      >
        <FormItem
          turmaId={turmaId}
          item={editando}
          aoSalvar={() => {
            fecharForm();
            recarregar();
          }}
          aoCancelar={fecharForm}
          gravar={gravarItem}
        />
      </Modal>

      <Modal aberto={ministrando !== null} titulo="Marcar como ministrado" aoFechar={fecharForm}>
        {ministrando && (
          <FormMinistrado
            turmaId={turmaId}
            base={base}
            item={ministrando}
            aoSalvar={() => {
              fecharForm();
              recarregar();
            }}
            aoCancelar={fecharForm}
            gravar={gravarItem}
          />
        )}
      </Modal>
    </section>
  );
}

// ---------- Formulário do tema ----------

function FormItem({
  turmaId,
  item,
  aoSalvar,
  aoCancelar,
  gravar,
}: {
  turmaId: number;
  item: PlanoDTO | null;
  aoSalvar: () => void;
  aoCancelar: () => void;
  gravar: (item: PlanoDTO, campos: Partial<CamposItem>) => Promise<void>;
}) {
  const [tema, setTema] = useState(item?.tema ?? '');
  const [objetivos, setObjetivos] = useState(item?.objetivos ?? '');
  const [dataPrevista, setDataPrevista] = useState(paraInputData(item?.dataPrevista ?? ''));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    const temaLimpo = tema.trim();
    if (temaLimpo.length < 2) {
      setErro('O tema precisa ter pelo menos 2 caracteres.');
      return;
    }
    setSalvando(true);
    try {
      if (item) {
        await gravar(item, { tema: temaLimpo, objetivos: objetivos.trim(), dataPrevista });
      } else {
        const corpo: { tema: string; objetivos: string; dataPrevista?: string } = {
          tema: temaLimpo,
          objetivos: objetivos.trim(),
        };
        if (dataPrevista) corpo.dataPrevista = dataPrevista;
        await api.post(`/salas/${turmaId}/plano`, corpo);
      }
      aoSalvar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Campo rotulo="Tema" valor={tema} aoMudar={setTema} obrigatorio />
      <AreaTexto rotulo="Objetivos" valor={objetivos} aoMudar={setObjetivos} linhas={4} />
      <Campo rotulo="Data prevista" valor={dataPrevista} aoMudar={setDataPrevista} tipo="date" />
      <div className="sala-acoes-form">
        <Botao tipo="submit" desabilitado={salvando}>
          Salvar
        </Botao>
        <Botao variante="secundario" aoClicar={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

// ---------- Ligar o tema a uma aula do diário ----------

function FormMinistrado({
  turmaId,
  base,
  item,
  aoSalvar,
  aoCancelar,
  gravar,
}: {
  turmaId: number;
  base: string;
  item: PlanoDTO;
  aoSalvar: () => void;
  aoCancelar: () => void;
  gravar: (item: PlanoDTO, campos: Partial<CamposItem>) => Promise<void>;
}) {
  const aulas = useDados<AulaDTO[]>(`/salas/${turmaId}/aulas`);
  const [aulaId, setAulaId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!aulaId) {
      setErro('Escolha a aula em que o tema foi ministrado.');
      return;
    }
    setSalvando(true);
    try {
      await gravar(item, { aulaId: Number(aulaId) });
      aoSalvar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const lista = aulas.dados ?? [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {aulas.erro && <Aviso tipo="erro">{aulas.erro}</Aviso>}
      {!aulas.carregando && lista.length === 0 && (
        <Aviso tipo="info">
          Ainda não há aulas registradas no diário desta turma. Registre a aula no diário e volte aqui.
          {base === '/professor' && (
            <>
              {' '}
              <Link to={`/professor/diario/${turmaId}`}>Abrir o diário</Link>
            </>
          )}
        </Aviso>
      )}
      <p className="sala-texto-suave">Tema: {item.tema}</p>
      <Selecao
        rotulo="Aula do diário"
        valor={aulaId}
        aoMudar={setAulaId}
        opcoes={lista.map((a) => ({
          valor: String(a.id),
          rotulo: `${formatarData(a.data)} · ${a.conteudo?.trim() || 'sem conteúdo'}`,
        }))}
        vazio={aulas.carregando ? 'Carregando aulas...' : 'Selecione a aula'}
        obrigatorio
      />
      <div className="sala-acoes-form">
        <Botao tipo="submit" desabilitado={salvando || lista.length === 0}>
          Marcar como ministrado
        </Botao>
        <Botao variante="secundario" aoClicar={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
