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
  Modal,
  Pagina,
  Selecao,
  Selo,
  Tabela,
  formatarMoeda,
} from '../../ui';
import type { ColunaTabela } from '../../ui';
import { REGIMES, duracaoTexto, mensagemErro, numeroDe, rotuloRegime, unidadeDoRegime } from './comum';
import type { Curso, CursoDetalhe, Disciplina } from './tipos';

// ---------- Tela de cursos ----------

export function Cursos() {
  const [nivel, setNivel] = useState('');
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<Curso | null>(null);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const caminho = nivel ? `/cursos?nivel=${encodeURIComponent(nivel)}` : '/cursos';
  const { dados, carregando, erro, recarregar } = useDados<Curso[]>(caminho);

  function fecharForm() {
    setNovo(false);
    setEditando(null);
  }

  const colunas: ColunaTabela<Curso>[] = [
    { titulo: 'Código', celula: (c) => c.codigo },
    { titulo: 'Nome', celula: (c) => c.nome },
    { titulo: 'Nível', celula: (c) => rotuloNivel(c.nivel) },
    { titulo: 'Regime', celula: (c) => rotuloRegime(c.regime) },
    { titulo: 'Duração', celula: (c) => duracaoTexto(c.duracaoPeriodos, c.regime) },
    { titulo: 'Mensalidade', celula: (c) => formatarMoeda(c.mensalidade) },
    {
      titulo: 'Situação',
      celula: (c) => <Selo cor={c.ativo ? 'verde' : 'cinza'}>{c.ativo ? 'ATIVO' : 'INATIVO'}</Selo>,
    },
  ];

  return (
    <Pagina
      titulo="Cursos"
      acoes={<Botao aoClicar={() => setNovo(true)}>Novo curso</Botao>}
    >
      <Cartao>
        <Selecao
          rotulo="Nível"
          valor={nivel}
          aoMudar={setNivel}
          opcoes={NIVEIS}
          vazio="Todos os níveis"
        />
      </Cartao>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando ? (
        <Carregando />
      ) : (
        <Tabela
          colunas={colunas}
          dados={dados ?? []}
          chave={(c) => c.id}
          vazio="Nenhum curso encontrado."
          aoClicarLinha={(c) => setDetalheId(c.id)}
        />
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

  const colunas: ColunaTabela<Disciplina>[] = [
    { titulo: 'Código', celula: (d) => d.codigo },
    { titulo: 'Nome', celula: (d) => d.nome },
    { titulo: 'CH (h)', celula: (d) => d.cargaHoraria },
    { titulo: 'Créditos', celula: (d) => d.creditos },
    {
      titulo: 'Obrigatória',
      celula: (d) => <Selo cor={d.obrigatoria ? 'azul' : 'cinza'}>{d.obrigatoria ? 'SIM' : 'NÃO'}</Selo>,
    },
    {
      titulo: 'Pré-requisitos',
      celula: (d) =>
        d.preRequisitos.length > 0 ? d.preRequisitos.map((p) => p.codigo).join(', ') : 'Nenhum',
    },
    {
      titulo: 'Ações',
      celula: (d) => (
        <>
          <Botao variante="texto" aoClicar={() => setDisciplina(d)}>
            Editar
          </Botao>
          <Botao variante="perigo" aoClicar={() => void excluir(d)}>
            Excluir
          </Botao>
        </>
      ),
    },
  ];

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
            <Cartao key={periodo} titulo={`${unidadeDoRegime(dados.regime)} ${periodo}`}>
              <Tabela
                colunas={colunas}
                dados={lista}
                chave={(d) => d.id}
                vazio="Nenhuma disciplina."
              />
            </Cartao>
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
