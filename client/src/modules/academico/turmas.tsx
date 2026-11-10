import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { rotuloNivel } from '../../lib/tipos';
import {
  Aviso,
  Botao,
  Campo,
  Carregando,
  Cartao,
  Grade,
  Modal,
  Pagina,
  Selecao,
  Tabela,
} from '../../ui';
import type { ColunaTabela } from '../../ui';
import { mensagemErro, rotuloRegime } from './comum';
import type { Curso, Disciplina, PeriodoLetivo, ProfessorDTO, TurmaDTO } from './tipos';

// ---------- Turmas (administrativo) ----------

export function Turmas() {
  const [periodoId, setPeriodoId] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<TurmaDTO | null>(null);
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

  const colunas: ColunaTabela<TurmaDTO>[] = [
    { titulo: 'Código', celula: (t) => t.codigo },
    { titulo: 'Disciplina', celula: (t) => t.disciplina.nome },
    { titulo: 'Curso', celula: (t) => t.disciplina.curso.nome },
    { titulo: 'Professor', celula: (t) => t.professor.usuario.nome },
    { titulo: 'Grupo', celula: (t) => t.grupo ?? '—' },
    { titulo: 'Sala', celula: (t) => t.sala ?? '—' },
    { titulo: 'Inscritos/vagas', celula: (t) => `${t._count.inscricoes}/${t.vagas}` },
  ];

  return (
    <Pagina
      titulo="Turmas"
      acoes={<Botao aoClicar={() => setNovo(true)}>Nova turma</Botao>}
    >
      <Cartao>
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
      </Cartao>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando ? (
        <Carregando />
      ) : (
        <Tabela
          colunas={colunas}
          dados={dados ?? []}
          chave={(t) => t.id}
          vazio="Nenhuma turma encontrada."
          aoClicarLinha={(t) => setEditando(t)}
        />
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
