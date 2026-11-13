import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { rotuloNivel } from '../../lib/tipos';
import {
  Aviso,
  Avatar,
  Botao,
  Campo,
  Carregando,
  Cartao,
  Grade,
  MenuAcoes,
  Modal,
  Pagina,
  Selecao,
  Tabela,
} from '../../ui';
import type { AcaoMenu, ColunaTabela } from '../../ui';
import { Icone } from '../../ui/icones';
import type { NomeIcone } from '../../ui/icones';
import { mensagemErro, rotuloRegime } from './comum';
import type { Curso, Disciplina, PeriodoLetivo, ProfessorDTO, TurmaDTO } from './tipos';
import './academico.css';

// ---------- Visão da lista (tabela ou cartões), guardada no navegador ----------

type VisaoTurmas = 'tabela' | 'cartoes';
const CHAVE_VISAO = 'escola.turmas.visao';

function lerVisao(): VisaoTurmas {
  try {
    const salva = window.localStorage.getItem(CHAVE_VISAO);
    if (salva === 'tabela' || salva === 'cartoes') return salva;
  } catch {
    // Armazenamento indisponível: usa o padrão da tela
  }
  return 'tabela';
}

function gravarVisao(visao: VisaoTurmas) {
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
  visao: VisaoTurmas;
  aoMudar: (v: VisaoTurmas) => void;
}) {
  const opcoes: { valor: VisaoTurmas; rotulo: string; icone: NomeIcone }[] = [
    { valor: 'tabela', rotulo: 'Tabela', icone: 'lista' },
    { valor: 'cartoes', rotulo: 'Cartões', icone: 'grade' },
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

function ItemResumo({
  icone,
  cor,
  valor,
  rotulo,
}: {
  icone: NomeIcone;
  cor: 'azul' | 'roxo' | 'verde' | 'laranja' | 'vermelho';
  valor: string | number;
  rotulo: string;
}) {
  return (
    <div className="resumo-item">
      <span className={`resumo-icone resumo-icone-${cor}`}>
        <Icone nome={icone} tamanho={22} />
      </span>
      <div>
        <span className="resumo-valor">{valor}</span>
        <span className="resumo-rotulo">{rotulo}</span>
      </div>
    </div>
  );
}

// Barra de ocupação: verde até 70%, laranja até 99%, vermelha quando lotada.
function Ocupacao({ inscritos, vagas }: { inscritos: number; vagas: number }) {
  const lotada = inscritos >= vagas;
  const pct = vagas > 0 ? Math.min(100, Math.round((inscritos / vagas) * 100)) : 100;
  const classe = lotada
    ? 'academico-ocupacao-cheia'
    : pct <= 70
      ? 'academico-ocupacao-baixa'
      : 'academico-ocupacao-media';
  return (
    <div className="academico-ocupacao">
      <div
        className="academico-ocupacao-trilho"
        role="progressbar"
        aria-label="Ocupação da turma"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className={`academico-ocupacao-preench ${classe}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="academico-ocupacao-texto">
        {inscritos}/{vagas}
      </span>
    </div>
  );
}

function ProfessorNome({ nome }: { nome: string }) {
  return (
    <span className="academico-professor">
      <Avatar nome={nome} tamanho={28} />
      <span className="academico-professor-nome">{nome}</span>
    </span>
  );
}

// ---------- Turmas (administrativo) ----------

export function Turmas() {
  const [periodoId, setPeriodoId] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [busca, setBusca] = useState('');
  const [visao, setVisao] = useState<VisaoTurmas>(lerVisao);
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<TurmaDTO | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const periodos = useDados<PeriodoLetivo[]>('/periodos-letivos');
  const cursos = useDados<Curso[]>('/cursos');

  const filtros = new URLSearchParams();
  if (periodoId) filtros.set('periodoLetivoId', periodoId);
  if (cursoId) filtros.set('cursoId', cursoId);
  const query = filtros.toString();
  const { dados, carregando, erro, recarregar } = useDados<TurmaDTO[]>(
    `/turmas${query ? `?${query}` : ''}`,
  );

  function fecharForm() {
    setNovo(false);
    setEditando(null);
  }

  function trocarVisao(nova: VisaoTurmas) {
    setVisao(nova);
    gravarVisao(nova);
  }

  async function excluir(t: TurmaDTO) {
    if (!window.confirm(`Excluir a turma ${t.codigo}?`)) return;
    setErroAcao(null);
    try {
      await api.del(`/turmas/${t.id}`);
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  // Ações de cada turma (tabela e cartões).
  function acoesDaTurma(t: TurmaDTO): AcaoMenu[] {
    return [
      { rotulo: 'Editar', icone: 'lapis', aoClicar: () => setEditando(t) },
      { rotulo: 'Excluir', icone: 'fechar', perigo: true, aoClicar: () => void excluir(t) },
    ];
  }

  // Busca por código ou disciplina, só no cliente.
  const termo = busca.trim().toLowerCase();
  const lista = dados ?? [];
  const filtradas = termo
    ? lista.filter(
        (t) =>
          t.codigo.toLowerCase().includes(termo) ||
          t.disciplina.nome.toLowerCase().includes(termo),
      )
    : lista;
  const totalInscritos = filtradas.reduce((soma, t) => soma + t._count.inscricoes, 0);
  const totalVagas = filtradas.reduce((soma, t) => soma + t.vagas, 0);
  const semVagas = filtradas.filter((t) => t._count.inscricoes >= t.vagas).length;
  const ocupacaoMedia = totalVagas > 0 ? `${Math.round((totalInscritos / totalVagas) * 100)}%` : '—';

  const colunas: ColunaTabela<TurmaDTO>[] = [
    { titulo: 'Código', celula: (t) => <span className="academico-codigo">{t.codigo}</span> },
    {
      titulo: 'Disciplina',
      celula: (t) => (
        <span className="academico-celula-dupla">
          <span className="academico-nome-forte">{t.disciplina.nome}</span>
          <span className="academico-texto-suave">{t.disciplina.curso.nome}</span>
        </span>
      ),
    },
    { titulo: 'Professor', celula: (t) => <ProfessorNome nome={t.professor.usuario.nome} /> },
    { titulo: 'Período', celula: (t) => t.periodoLetivo.nome },
    { titulo: 'Grupo', celula: (t) => t.grupo ?? '—' },
    { titulo: 'Sala', celula: (t) => t.sala ?? '—' },
    {
      titulo: 'Ocupação',
      celula: (t) => <Ocupacao inscritos={t._count.inscricoes} vagas={t.vagas} />,
    },
    {
      titulo: 'Ações',
      acoes: true,
      celula: (t) => (
        <MenuAcoes rotulo={`Ações de ${t.disciplina.nome} (${t.codigo})`} acoes={acoesDaTurma(t)} />
      ),
    },
  ];

  return (
    <Pagina titulo="Turmas">
      <div className="barra-ferramentas">
        <div className="filtros">
          <Selecao
            rotulo="Período letivo"
            valor={periodoId}
            aoMudar={setPeriodoId}
            opcoes={(periodos.dados ?? []).map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
            vazio="Todos os períodos"
          />
          <Selecao
            rotulo="Curso"
            valor={cursoId}
            aoMudar={setCursoId}
            opcoes={(cursos.dados ?? []).map((c) => ({ valor: String(c.id), rotulo: c.nome }))}
            vazio="Todos os cursos"
          />
          <Campo rotulo="Buscar por código ou disciplina" valor={busca} aoMudar={setBusca} />
        </div>
        <div className="academico-barra-direita">
          <AlternarVisao visao={visao} aoMudar={trocarVisao} />
          <Botao aoClicar={() => setNovo(true)}>Nova turma</Botao>
        </div>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {carregando ? (
        <Carregando />
      ) : (
        <>
          <div className="resumo">
            <ItemResumo icone="turmas" cor="azul" valor={filtradas.length} rotulo="Turmas" />
            <ItemResumo
              icone="alunos"
              cor="verde"
              valor={totalInscritos}
              rotulo="Alunos inscritos"
            />
            <ItemResumo
              icone="grafico"
              cor="laranja"
              valor={ocupacaoMedia}
              rotulo="Ocupação média"
            />
            <ItemResumo icone="cadeado" cor="vermelho" valor={semVagas} rotulo="Sem vagas" />
          </div>

          {visao === 'tabela' ? (
            <Tabela
              exportar="turmas"
              colunas={colunas}
              dados={filtradas}
              chave={(t) => t.id}
              vazio="Nenhuma turma encontrada."
              aoClicarLinha={(t) => setEditando(t)}
            />
          ) : filtradas.length === 0 ? (
            <p className="tabela-vazia">Nenhuma turma encontrada.</p>
          ) : (
            <ul className="academico-turmas-grade">
              {filtradas.map((t) => (
                <li key={t.id} className="academico-turma-cartao clicavel" onClick={() => setEditando(t)}>
                  <p className="academico-turma-disciplina">{t.disciplina.nome}</p>
                  <span className="academico-codigo">{t.codigo}</span>
                  <dl className="academico-turma-linhas">
                    <div>
                      <dt>Curso</dt>
                      <dd>{t.disciplina.curso.nome}</dd>
                    </div>
                    <div>
                      <dt>Professor</dt>
                      <dd>
                        <ProfessorNome nome={t.professor.usuario.nome} />
                      </dd>
                    </div>
                    <div>
                      <dt>Período</dt>
                      <dd>{t.periodoLetivo.nome}</dd>
                    </div>
                    <div>
                      <dt>Sala</dt>
                      <dd>{t.sala ?? '—'}</dd>
                    </div>
                  </dl>
                  <div className="academico-curso-rodape">
                    <Ocupacao inscritos={t._count.inscricoes} vagas={t.vagas} />
                    <MenuAcoes
                      rotulo={`Ações de ${t.disciplina.nome} (${t.codigo})`}
                      acoes={acoesDaTurma(t)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Modal
        aberto={novo || editando !== null}
        titulo={editando ? 'Editar turma' : 'Nova turma'}
        aoFechar={fecharForm}
      >
        <FormTurma
          turma={editando}
          periodos={periodos.dados ?? []}
          cursos={cursos.dados ?? []}
          aoSalvar={() => {
            fecharForm();
            recarregar();
          }}
          aoCancelar={fecharForm}
        />
      </Modal>
    </Pagina>
  );
}

// ---------- Formulário de turma ----------

function FormTurma({
  turma,
  periodos,
  cursos,
  aoSalvar,
  aoCancelar,
}: {
  turma: TurmaDTO | null;
  periodos: PeriodoLetivo[];
  cursos: Curso[];
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [periodoLetivoId, setPeriodoLetivoId] = useState(turma ? String(turma.periodoLetivoId) : '');
  // O curso só serve para filtrar as disciplinas; não é gravado na turma.
  const [cursoId, setCursoId] = useState(turma ? String(turma.disciplina.cursoId) : '');
  const [disciplinaId, setDisciplinaId] = useState(turma ? String(turma.disciplinaId) : '');
  const [professorId, setProfessorId] = useState(turma ? String(turma.professorId) : '');
  const [codigo, setCodigo] = useState(turma?.codigo ?? '');
  const [grupo, setGrupo] = useState(turma?.grupo ?? '');
  const [vagas, setVagas] = useState(turma ? String(turma.vagas) : '40');
  const [sala, setSala] = useState(turma?.sala ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const disciplinas = useDados<Disciplina[]>(cursoId ? `/disciplinas?cursoId=${cursoId}` : null);
  const professores = useDados<ProfessorDTO[]>('/professores');

  function mudarCurso(valor: string) {
    setCursoId(valor);
    setDisciplinaId('');
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const corpo = {
      codigo: codigo.trim(),
      disciplinaId: Number(disciplinaId),
      periodoLetivoId: Number(periodoLetivoId),
      professorId: Number(professorId),
      grupo: grupo.trim() || null,
      vagas: Number(vagas),
      sala: sala.trim() || null,
    };
    try {
      if (turma) {
        await api.put(`/turmas/${turma.id}`, corpo);
      } else {
        await api.post('/turmas', corpo);
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
      {disciplinas.erro && <Aviso tipo="erro">{disciplinas.erro}</Aviso>}
      {professores.erro && <Aviso tipo="erro">{professores.erro}</Aviso>}
      <Selecao
        rotulo="Período letivo"
        valor={periodoLetivoId}
        aoMudar={setPeriodoLetivoId}
        opcoes={periodos.map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
        obrigatorio
      />
      <Selecao
        rotulo="Curso (filtra as disciplinas)"
        valor={cursoId}
        aoMudar={mudarCurso}
        opcoes={cursos.map((c) => ({ valor: String(c.id), rotulo: `${c.nome} (${rotuloNivel(c.nivel)})` }))}
        vazio="Selecione o curso"
      />
      <Selecao
        rotulo="Disciplina"
        valor={disciplinaId}
        aoMudar={setDisciplinaId}
        opcoes={(disciplinas.dados ?? []).map((d) => ({
          valor: String(d.id),
          rotulo: `${d.codigo} - ${d.nome}`,
        }))}
        vazio={cursoId ? 'Selecione a disciplina' : 'Escolha o curso primeiro'}
        obrigatorio
      />
      <Selecao
        rotulo="Professor"
        valor={professorId}
        aoMudar={setProfessorId}
        opcoes={(professores.dados ?? []).map((p) => ({
          valor: String(p.id),
          rotulo: `${p.usuario.nome} (${p.registro})`,
        }))}
        obrigatorio
      />
      <Campo rotulo="Código" valor={codigo} aoMudar={setCodigo} obrigatorio />
      <Campo rotulo="Grupo" valor={grupo} aoMudar={setGrupo} />
      <Campo rotulo="Vagas" valor={vagas} aoMudar={setVagas} tipo="number" obrigatorio />
      <Campo rotulo="Sala" valor={sala} aoMudar={setSala} />
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

// ---------- Minhas turmas (professor) ----------

export function MinhasTurmas() {
  const { dados, carregando, erro } = useDados<TurmaDTO[]>('/turmas/minhas');

  return (
    <Pagina titulo="Minhas turmas">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando && <Carregando />}
      {!carregando && dados && dados.length === 0 && (
        <p className="tabela-vazia">Você não tem turmas no momento.</p>
      )}
      {dados && dados.length > 0 && (
        <Grade>
          {dados.map((t) => (
            <Cartao key={t.id} titulo={t.disciplina.nome}>
              <p>Código: {t.codigo}</p>
              <p>Curso: {t.disciplina.curso.nome}</p>
              <p>
                Período: {t.periodoLetivo.nome} · {rotuloRegime(t.disciplina.curso.regime)}
              </p>
              <p>Inscritos: {t._count.inscricoes}</p>
              <Link className="botao botao-primario" to={`/professor/diario/${t.id}`}>
                Abrir diário
              </Link>
            </Cartao>
          ))}
        </Grade>
      )}
    </Pagina>
  );
}
