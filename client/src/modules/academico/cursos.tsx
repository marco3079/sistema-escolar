import { useState } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { NIVEIS, rotuloNivel } from '../../lib/tipos';
import {
  Aviso,
  Botao,
  Caixa,
  Campo,
  Carregando,
  Cartao,
  MenuAcoes,
  Modal,
  Pagina,
  Selecao,
  Selo,
  Tabela,
  formatarMoeda,
} from '../../ui';
import type { AcaoMenu, ColunaTabela } from '../../ui';
import { Icone } from '../../ui/icones';
import type { NomeIcone } from '../../ui/icones';
import { REGIMES, duracaoTexto, mensagemErro, numeroDe, rotuloRegime } from './comum';
import type { Curso, CursoDetalhe, Disciplina } from './tipos';
import './academico.css';

// ---------- Visão da lista (cartões ou tabela), guardada no navegador ----------

type VisaoCursos = 'cartoes' | 'tabela';
const CHAVE_VISAO = 'escola.cursos.visao';

function lerVisao(): VisaoCursos {
  try {
    const salva = window.localStorage.getItem(CHAVE_VISAO);
    if (salva === 'cartoes' || salva === 'tabela') return salva;
  } catch {
    // Armazenamento indisponível: usa o padrão da tela
  }
  return 'cartoes';
}

function gravarVisao(visao: VisaoCursos) {
  try {
    window.localStorage.setItem(CHAVE_VISAO, visao);
  } catch {
    // Sem armazenamento: a escolha vale só nesta página
  }
}

function AlternarVisao({
  visao,
  aoMudar,
}: {
  visao: VisaoCursos;
  aoMudar: (v: VisaoCursos) => void;
}) {
  const opcoes: { valor: VisaoCursos; rotulo: string; icone: NomeIcone }[] = [
    { valor: 'cartoes', rotulo: 'Cartões', icone: 'grade' },
    { valor: 'tabela', rotulo: 'Tabela', icone: 'lista' },
  ];
  return (
    <div className="segmentado" role="group" aria-label="Modo de exibição">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          className="segmentado-item academico-segmentado-item"
          aria-pressed={visao === o.valor}
          onClick={() => aoMudar(o.valor)}
        >
          <Icone nome={o.icone} tamanho={18} />
          <span>{o.rotulo}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Auxiliares de apresentação ----------

// Cor da faixa do cartão pelo nível: as quatro cores do tema, repetindo.
function corDoNivel(nivel: string): number {
  const posicao = NIVEIS.findIndex((n) => n.valor === nivel);
  return posicao < 0 ? 0 : posicao % 4;
}

// "1ª série" no seriado; "1º semestre" por créditos.
function rotuloPeriodoSugerido(regime: string, numero: number): string {
  return regime === 'SERIADO' ? `${numero}ª série` : `${numero}º semestre`;
}

// ---------- Tela de cursos ----------

export function Cursos() {
  const [nivel, setNivel] = useState('');
  const [busca, setBusca] = useState('');
  const [visao, setVisao] = useState<VisaoCursos>(lerVisao);
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<Curso | null>(null);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const caminho = nivel ? `/cursos?nivel=${encodeURIComponent(nivel)}` : '/cursos';
  const { dados, carregando, erro, recarregar } = useDados<Curso[]>(caminho);

  function fecharForm() {
    setNovo(false);
    setEditando(null);
  }

  function trocarVisao(nova: VisaoCursos) {
    setVisao(nova);
    gravarVisao(nova);
  }

  // Desativa o curso (DELETE marca como inativo no servidor).
  async function desativar(c: Curso) {
    if (!window.confirm(`Desativar o curso ${c.nome}?`)) return;
    setErroAcao(null);
    try {
      await api.del(`/cursos/${c.id}`);
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  async function reativar(c: Curso) {
    setErroAcao(null);
    try {
      await api.put(`/cursos/${c.id}`, { ativo: true });
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  // Ações de cada curso (tabela e cartões).
  function acoesDoCurso(c: Curso): AcaoMenu[] {
    return [
      { rotulo: 'Ver disciplinas', icone: 'documento', aoClicar: () => setDetalheId(c.id) },
      { rotulo: 'Editar', icone: 'lapis', aoClicar: () => setEditando(c) },
      c.ativo
        ? { rotulo: 'Desativar', icone: 'pausar', perigo: true, aoClicar: () => void desativar(c) }
        : { rotulo: 'Reativar', icone: 'reproduzir', aoClicar: () => void reativar(c) },
    ];
  }

  // Busca por nome ou código, só no cliente.
  const termo = busca.trim().toLowerCase();
  const lista = dados ?? [];
  const filtrados = termo
    ? lista.filter(
        (c) => c.nome.toLowerCase().includes(termo) || c.codigo.toLowerCase().includes(termo),
      )
    : lista;

  const colunas: ColunaTabela<Curso>[] = [
    { titulo: 'Código', celula: (c) => <span className="academico-codigo">{c.codigo}</span> },
    { titulo: 'Nome', celula: (c) => <span className="academico-nome-forte">{c.nome}</span> },
    { titulo: 'Nível', celula: (c) => rotuloNivel(c.nivel) },
    { titulo: 'Regime', celula: (c) => rotuloRegime(c.regime) },
    { titulo: 'Duração', celula: (c) => duracaoTexto(c.duracaoPeriodos, c.regime) },
    {
      titulo: 'Mensalidade',
      alinhar: 'direita',
      celula: (c) => formatarMoeda(c.mensalidade),
    },
    {
      titulo: 'Situação',
      celula: (c) => <Selo cor={c.ativo ? 'verde' : 'cinza'}>{c.ativo ? 'ATIVO' : 'INATIVO'}</Selo>,
    },
    {
      titulo: 'Ações',
      acoes: true,
      celula: (c) => <MenuAcoes rotulo={`Ações de ${c.nome}`} acoes={acoesDoCurso(c)} />,
    },
  ];

  return (
    <Pagina titulo="Cursos">
      <div className="barra-ferramentas">
        <div className="filtros">
          <Campo rotulo="Buscar por nome ou código" valor={busca} aoMudar={setBusca} />
          <Selecao
            rotulo="Nível"
            valor={nivel}
            aoMudar={setNivel}
            opcoes={NIVEIS}
            vazio="Todos os níveis"
          />
        </div>
        <div className="academico-barra-direita">
          <AlternarVisao visao={visao} aoMudar={trocarVisao} />
          <Botao aoClicar={() => setNovo(true)}>Novo curso</Botao>
        </div>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {carregando ? (
        <Carregando />
      ) : visao === 'tabela' ? (
        <Tabela
          exportar="cursos"
          colunas={colunas}
          dados={filtrados}
          chave={(c) => c.id}
          vazio="Nenhum curso encontrado."
          aoClicarLinha={(c) => setDetalheId(c.id)}
        />
      ) : filtrados.length === 0 ? (
        <p className="tabela-vazia">Nenhum curso encontrado.</p>
      ) : (
        <ul className="academico-cursos-grade">
          {filtrados.map((c) => (
            <li
              key={c.id}
              className="academico-curso-cartao clicavel"
              onClick={() => setDetalheId(c.id)}
            >
              <span className={`academico-curso-faixa academico-curso-faixa-${corDoNivel(c.nivel)}`} />
              <div className="academico-curso-cabeca">
                <Selo cor="azul">{rotuloNivel(c.nivel)}</Selo>
                <Selo cor={c.ativo ? 'verde' : 'cinza'}>{c.ativo ? 'ATIVO' : 'INATIVO'}</Selo>
              </div>
              <div>
                <h3 className="academico-curso-nome">{c.nome}</h3>
                <span className="academico-codigo">{c.codigo}</span>
              </div>
              <dl className="academico-curso-dados">
                <div className="academico-curso-dado">
                  <dt>Duração</dt>
                  <dd>{duracaoTexto(c.duracaoPeriodos, c.regime)}</dd>
                </div>
                <div className="academico-curso-dado">
                  <dt>Carga horária</dt>
                  <dd>{c.cargaHorariaTotal} h</dd>
                </div>
                <div className="academico-curso-dado">
                  <dt>Mensalidade</dt>
                  <dd>{formatarMoeda(c.mensalidade)}</dd>
                </div>
              </dl>
              <div className="academico-curso-rodape">
                <span className="academico-texto-suave">{rotuloRegime(c.regime)}</span>
                <MenuAcoes rotulo={`Ações de ${c.nome}`} acoes={acoesDoCurso(c)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        aberto={novo || editando !== null}
        titulo={editando ? 'Editar curso' : 'Novo curso'}
        aoFechar={fecharForm}
      >
        <FormCurso
          curso={editando}
          aoSalvar={() => {
            fecharForm();
            recarregar();
          }}
          aoCancelar={fecharForm}
        />
      </Modal>

      {detalheId !== null && (
        <DetalheCurso
          cursoId={detalheId}
          aoFechar={() => setDetalheId(null)}
          aoEditar={(c) => {
            setDetalheId(null);
            setEditando(c);
          }}
        />
      )}
    </Pagina>
  );
}

// ---------- Formulário de curso ----------

function FormCurso({
  curso,
  aoSalvar,
  aoCancelar,
}: {
  curso: Curso | null;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(curso?.nome ?? '');
  const [codigo, setCodigo] = useState(curso?.codigo ?? '');
  const [nivel, setNivel] = useState(curso?.nivel ?? '');
  const [regime, setRegime] = useState<string>(curso?.regime ?? '');
  const [duracao, setDuracao] = useState(curso ? String(curso.duracaoPeriodos) : '');
  const [cargaHoraria, setCargaHoraria] = useState(
    curso ? String(curso.cargaHorariaTotal) : '',
  );
  const [mensalidade, setMensalidade] = useState(
    curso ? String(curso.mensalidade).replace('.', ',') : '',
  );
  const [ativo, setAtivo] = useState(curso?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const corpo = {
      nome: nome.trim(),
      codigo: codigo.trim(),
      nivel,
      regime,
      duracaoPeriodos: Number(duracao),
      cargaHorariaTotal: Number(cargaHoraria),
      mensalidade: numeroDe(mensalidade),
      ...(curso ? { ativo } : {}),
    };
    try {
      if (curso) {
        await api.put(`/cursos/${curso.id}`, corpo);
      } else {
        await api.post('/cursos', corpo);
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
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} obrigatorio />
      <Campo rotulo="Código" valor={codigo} aoMudar={setCodigo} obrigatorio />
      <Selecao
        rotulo="Nível"
        valor={nivel}
        aoMudar={setNivel}
        opcoes={NIVEIS}
        obrigatorio
      />
      <Selecao
        rotulo="Regime"
        valor={regime}
        aoMudar={setRegime}
        opcoes={REGIMES}
        obrigatorio
      />
      <Campo
        rotulo="Duração (séries ou semestres)"
        valor={duracao}
        aoMudar={setDuracao}
        tipo="number"
        obrigatorio
      />
      <Campo
        rotulo="Carga horária total (h)"
        valor={cargaHoraria}
        aoMudar={setCargaHoraria}
        tipo="number"
        obrigatorio
      />
      <Campo rotulo="Mensalidade (R$)" valor={mensalidade} aoMudar={setMensalidade} obrigatorio />
      {curso && <Caixa rotulo="Curso ativo" marcado={ativo} aoMudar={setAtivo} />}
      <div>
        <Botao tipo="submit" desabilitado={salvando}>
          Salvar
        </Botao>{' '}
        <Botao variante="secundario" aoClicar={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

// ---------- Detalhe do curso (disciplinas) ----------

function agruparPorPeriodo(lista: Disciplina[]): [number, Disciplina[]][] {
  const mapa = new Map<number, Disciplina[]>();
  for (const d of lista) {
    const grupo = mapa.get(d.periodoSugerido) ?? [];
    grupo.push(d);
    mapa.set(d.periodoSugerido, grupo);
  }
  return Array.from(mapa.entries()).sort((a, b) => a[0] - b[0]);
}

function DetalheCurso({
  cursoId,
  aoFechar,
  aoEditar,
}: {
  cursoId: number;
  aoFechar: () => void;
  aoEditar: (curso: CursoDetalhe) => void;
}) {
  const { dados, carregando, erro, recarregar } = useDados<CursoDetalhe>(`/cursos/${cursoId}`);
  const [disciplina, setDisciplina] = useState<Disciplina | 'nova' | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function excluir(d: Disciplina) {
    if (!window.confirm(`Excluir a disciplina "${d.nome}"?`)) return;
    setErroAcao(null);
    try {
      await api.del(`/disciplinas/${d.id}`);
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  const grupos = agruparPorPeriodo(dados?.disciplinas ?? []);

  return (
    <Modal
      aberto
      titulo={dados ? `${dados.codigo} - ${dados.nome}` : 'Curso'}
      aoFechar={aoFechar}
    >
      {carregando && <Carregando />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {dados && (
        <>
          <p>
            {rotuloNivel(dados.nivel)} · {rotuloRegime(dados.regime)} ·{' '}
            {duracaoTexto(dados.duracaoPeriodos, dados.regime)} · {dados.cargaHorariaTotal} h
          </p>
          <div>
            <Botao variante="secundario" aoClicar={() => aoEditar(dados)}>
              Editar curso
            </Botao>{' '}
            <Botao aoClicar={() => setDisciplina('nova')}>Nova disciplina</Botao>
          </div>

          {grupos.length === 0 && <p>Nenhuma disciplina cadastrada neste curso.</p>}
          {grupos.map(([periodo, lista]) => (
            <section key={periodo} className="academico-periodo-bloco">
              <h3 className="academico-periodo-titulo">
                <span>{rotuloPeriodoSugerido(dados.regime, periodo)}</span>
                <span className="academico-texto-suave">{lista.length} disciplina(s)</span>
              </h3>
              {lista.length === 0 ? (
                <p className="tabela-vazia">Nenhuma disciplina.</p>
              ) : (
                <ul className="academico-disciplinas">
                  {lista.map((d) => {
                    const acoesDo: AcaoMenu[] = [
                      { rotulo: 'Editar', icone: 'lapis', aoClicar: () => setDisciplina(d) },
                      { rotulo: 'Excluir', icone: 'fechar', perigo: true, aoClicar: () => void excluir(d) },
                    ];
                    return (
                      <li key={d.id} className="academico-disciplina">
                        <div className="academico-disciplina-texto">
                          <span>
                            <span className="academico-codigo">{d.codigo}</span>{' '}
                            <span className="academico-nome-forte">{d.nome}</span>
                          </span>
                          <span className="academico-disciplina-meta">
                            <span>{d.cargaHoraria} h</span>
                            <span>{d.creditos} créditos</span>
                            <span>
                              Obrigatória:{' '}
                              <Selo cor={d.obrigatoria ? 'azul' : 'cinza'}>
                                {d.obrigatoria ? 'SIM' : 'NÃO'}
                              </Selo>
                            </span>
                            <span className="academico-pre-requisitos">
                              <span>Pré-requisitos:</span>
                              {d.preRequisitos.length > 0 ? (
                                d.preRequisitos.map((p) => <Selo key={p.id}>{p.codigo}</Selo>)
                              ) : (
                                <span>Nenhum</span>
                              )}
                            </span>
                          </span>
                        </div>
                        <div className="academico-disciplina-acoes">
                          <MenuAcoes rotulo={`Ações de ${d.nome}`} acoes={acoesDo} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}

          <Modal
            aberto={disciplina !== null}
            titulo={disciplina && disciplina !== 'nova' ? 'Editar disciplina' : 'Nova disciplina'}
            aoFechar={() => setDisciplina(null)}
          >
            <FormDisciplina
              cursoId={dados.id}
              disciplina={disciplina === 'nova' ? null : disciplina}
              disciplinasDoCurso={dados.disciplinas}
              aoSalvar={() => {
                setDisciplina(null);
                recarregar();
              }}
              aoCancelar={() => setDisciplina(null)}
            />
          </Modal>
        </>
      )}
    </Modal>
  );
}

// ---------- Formulário de disciplina ----------

function FormDisciplina({
  cursoId,
  disciplina,
  disciplinasDoCurso,
  aoSalvar,
  aoCancelar,
}: {
  cursoId: number;
  disciplina: Disciplina | null;
  disciplinasDoCurso: Disciplina[];
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(disciplina?.nome ?? '');
  const [codigo, setCodigo] = useState(disciplina?.codigo ?? '');
  const [cargaHoraria, setCargaHoraria] = useState(
    disciplina ? String(disciplina.cargaHoraria) : '',
  );
  const [creditos, setCreditos] = useState(disciplina ? String(disciplina.creditos) : '0');
  const [periodoSugerido, setPeriodoSugerido] = useState(
    disciplina ? String(disciplina.periodoSugerido) : '1',
  );
  const [obrigatoria, setObrigatoria] = useState(disciplina?.obrigatoria ?? true);
  const [preRequisitoIds, setPreRequisitoIds] = useState<number[]>(
    disciplina ? disciplina.preRequisitos.map((p) => p.id) : [],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const outras = disciplinasDoCurso.filter((d) => d.id !== disciplina?.id);

  function alternarPreRequisito(id: number, marcado: boolean) {
    setPreRequisitoIds((atual) =>
      marcado ? [...atual.filter((x) => x !== id), id] : atual.filter((x) => x !== id),
    );
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const corpo = {
      nome: nome.trim(),
      codigo: codigo.trim(),
      cargaHoraria: Number(cargaHoraria),
      creditos: Number(creditos),
      periodoSugerido: Number(periodoSugerido),
      obrigatoria,
      preRequisitoIds,
    };
    try {
      if (disciplina) {
        await api.put(`/disciplinas/${disciplina.id}`, corpo);
      } else {
        await api.post('/disciplinas', { cursoId, ...corpo });
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
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} obrigatorio />
      <Campo rotulo="Código" valor={codigo} aoMudar={setCodigo} obrigatorio />
      <Campo
        rotulo="Carga horária (h)"
        valor={cargaHoraria}
        aoMudar={setCargaHoraria}
        tipo="number"
        obrigatorio
      />
      <Campo
        rotulo="Créditos"
        valor={creditos}
        aoMudar={setCreditos}
        tipo="number"
        obrigatorio
      />
      <Campo
        rotulo="Período sugerido"
        valor={periodoSugerido}
        aoMudar={setPeriodoSugerido}
        tipo="number"
        obrigatorio
      />
      <Caixa rotulo="Obrigatória" marcado={obrigatoria} aoMudar={setObrigatoria} />

      <Cartao titulo="Pré-requisitos">
        {outras.length === 0 && <p>Nenhuma outra disciplina neste curso.</p>}
        {outras.map((d) => (
          <Caixa
            key={d.id}
            rotulo={`${d.codigo} - ${d.nome}`}
            marcado={preRequisitoIds.includes(d.id)}
            aoMudar={(marcado) => alternarPreRequisito(d.id, marcado)}
          />
        ))}
      </Cartao>

      <div>
        <Botao tipo="submit" desabilitado={salvando}>
          Salvar
        </Botao>{' '}
        <Botao variante="secundario" aoClicar={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
