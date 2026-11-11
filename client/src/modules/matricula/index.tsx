import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import type { RotaModulo } from '../../lib/rotas';
import { rotuloNivel } from '../../lib/tipos';
import { Aviso, Botao, Campo, Carregando, Grade, Modal, Pagina, Selecao, Tabela } from '../../ui';
import {
  BlocoInscrever,
  caminhoComFiltros,
  InscricaoDTO,
  MatriculaDetalhe,
  MatriculaDTO,
  mensagemErro,
  OPCOES_STATUS_MATRICULA,
  opcoesPeriodos,
  Periodo,
  SeloInscricao,
  SeloMatricula,
} from './comum';
import { rotasAluno } from './aluno';

interface CursoLista {
  id: number;
  nome: string;
  nivel: string;
  regime: string;
}

interface AlunoLista {
  id: number;
  ra: string;
  usuario: { nome: string };
}

// ---------- Lista de matrículas (portal administrativo) ----------

function Matriculas() {
  const [cursoId, setCursoId] = useState('');
  const [status, setStatus] = useState('');
  const [novaAberta, setNovaAberta] = useState(false);
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);

  const lista = useDados<MatriculaDTO[]>(caminhoComFiltros('/matriculas', { cursoId, status }));
  const cursos = useDados<CursoLista[]>('/cursos');
  const periodos = useDados<Periodo[]>('/periodos-letivos');

  if (lista.carregando && !lista.dados) return <Carregando />;

  return (
    <Pagina titulo="Matrículas" acoes={<Botao aoClicar={() => setNovaAberta(true)}>Nova matrícula</Botao>}>
      {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
      <Grade>
        <Selecao
          rotulo="Curso"
          valor={cursoId}
          aoMudar={setCursoId}
          opcoes={(cursos.dados ?? []).map((c) => ({ valor: String(c.id), rotulo: c.nome }))}
          vazio="Todos os cursos"
        />
        <Selecao
          rotulo="Status"
          valor={status}
          aoMudar={setStatus}
          opcoes={OPCOES_STATUS_MATRICULA}
          vazio="Todos os status"
        />
      </Grade>
      <Tabela<MatriculaDTO>
        dados={lista.dados ?? []}
        chave={(m) => m.id}
        aoClicarLinha={(m) => setSelecionadaId(m.id)}
        colunas={[
          { titulo: 'RA', celula: (m) => m.aluno.ra },
          { titulo: 'Aluno', celula: (m) => m.aluno.usuario.nome },
          { titulo: 'Curso', celula: (m) => m.curso.nome },
          { titulo: 'Nível', celula: (m) => rotuloNivel(m.curso.nivel) },
          { titulo: 'Série', celula: (m) => m.serieAtual },
          { titulo: 'Ingresso', celula: (m) => m.periodoIngresso.nome },
          { titulo: 'Status', celula: (m) => <SeloMatricula status={m.status} /> },
        ]}
      />

      <Modal aberto={novaAberta} titulo="Nova matrícula" aoFechar={() => setNovaAberta(false)}>
        <NovaMatricula
          cursos={cursos.dados ?? []}
          periodos={periodos.dados ?? []}
          aoSalvar={() => {
            setNovaAberta(false);
            lista.recarregar();
          }}
        />
      </Modal>

      <Modal aberto={selecionadaId !== null} titulo="Detalhe da matrícula" aoFechar={() => setSelecionadaId(null)}>
        {selecionadaId !== null && (
          <DetalheMatricula
            id={selecionadaId}
            periodos={periodos.dados ?? []}
            aoAlterar={lista.recarregar}
          />
        )}
      </Modal>
    </Pagina>
  );
}

// ---------- Nova matrícula ----------

function NovaMatricula({
  cursos,
  periodos,
  aoSalvar,
}: {
  cursos: CursoLista[];
  periodos: Periodo[];
  aoSalvar: () => void;
}) {
  const alunos = useDados<AlunoLista[]>('/alunos');
  const [alunoId, setAlunoId] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [serie, setSerie] = useState('1');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      await api.post('/matriculas', {
        alunoId: Number(alunoId),
        cursoId: Number(cursoId),
        periodoIngressoId: Number(periodoId),
        serieAtual: Number(serie),
      });
      aoSalvar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={salvar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {alunos.erro && <Aviso tipo="erro">{alunos.erro}</Aviso>}
      <Selecao
        rotulo="Aluno"
        valor={alunoId}
        aoMudar={setAlunoId}
        opcoes={(alunos.dados ?? []).map((a) => ({
          valor: String(a.id),
          rotulo: `${a.ra} - ${a.usuario.nome}`,
        }))}
        obrigatorio
      />
      <Selecao
        rotulo="Curso"
        valor={cursoId}
        aoMudar={setCursoId}
        opcoes={cursos.map((c) => ({ valor: String(c.id), rotulo: c.nome }))}
        obrigatorio
      />
      <Selecao
        rotulo="Período de ingresso"
        valor={periodoId}
        aoMudar={setPeriodoId}
        opcoes={opcoesPeriodos(periodos)}
        obrigatorio
      />
      <Campo rotulo="Série" valor={serie} aoMudar={setSerie} tipo="number" obrigatorio />
      <Botao tipo="submit" desabilitado={ocupado || !alunoId || !cursoId || !periodoId}>
        Salvar matrícula
      </Botao>
    </form>
  );
}

// ---------- Detalhe da matrícula (portal administrativo) ----------

function DetalheMatricula({
  id,
  periodos,
  aoAlterar,
}: {
  id: number;
  periodos: Periodo[];
  aoAlterar: () => void;
}) {
  const det = useDados<MatriculaDetalhe>(`/matriculas/${id}`);
  const [status, setStatus] = useState('');
  const [serie, setSerie] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (det.dados) {
      setStatus(det.dados.status);
      setSerie(String(det.dados.serieAtual));
    }
  }, [det.dados]);

  // Depois de uma escrita bem-sucedida: mensagem, recarrega o detalhe e a lista.
  function aposAlterar(mensagem?: string): void {
    setErro(null);
    setAviso(mensagem ?? null);
    det.recarregar();
    aoAlterar();
  }

  // Executa uma escrita; erro da API vai para o aviso vermelho.
  async function executar(acao: () => Promise<unknown>, mensagemOk?: string): Promise<void> {
    setErro(null);
    setAviso(null);
    try {
      await acao();
      aposAlterar(mensagemOk);
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  if (det.carregando && !det.dados) return <Carregando />;
  if (!det.dados) return <Aviso tipo="erro">{det.erro ?? 'Matrícula não encontrada'}</Aviso>;

  const m = det.dados;

  return (
    <div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {det.erro && <Aviso tipo="erro">{det.erro}</Aviso>}

      <section className="cartao">
        <h3>Dados</h3>
        <p>
          <strong>{m.aluno.usuario.nome}</strong> (RA {m.aluno.ra})
        </p>
        <p>
          {m.curso.nome} · {rotuloNivel(m.curso.nivel)} · ingresso {m.periodoIngresso.nome}
        </p>
        <p>
          Status: <SeloMatricula status={m.status} />
        </p>
        <Selecao rotulo="Status" valor={status} aoMudar={setStatus} opcoes={OPCOES_STATUS_MATRICULA} />
        <Campo rotulo="Série atual" valor={serie} aoMudar={setSerie} tipo="number" obrigatorio />
        <Botao
          aoClicar={() =>
            void executar(
              () => api.put(`/matriculas/${id}`, { status, serieAtual: Number(serie) }),
              'Dados da matrícula salvos.',
            )
          }
        >
          Salvar dados
        </Botao>
      </section>

      <section className="cartao">
        <h3>Inscrições</h3>
        <Tabela<InscricaoDTO>
          dados={m.inscricoes}
          chave={(i) => i.id}
          vazio="Nenhuma inscrição."
          colunas={[
            { titulo: 'Disciplina', celula: (i) => i.turma.disciplina.nome },
            { titulo: 'Turma', celula: (i) => i.turma.codigo },
            { titulo: 'Período', celula: (i) => i.turma.periodoLetivo.nome },
            { titulo: 'Status', celula: (i) => <SeloInscricao status={i.status} /> },
            { titulo: 'Nota', celula: (i) => (i.notaFinal === null ? '-' : i.notaFinal) },
            { titulo: 'Frequência', celula: (i) => (i.frequencia === null ? '-' : `${i.frequencia}%`) },
            {
              titulo: 'Ação',
              celula: (i) => (
                <Botao
                  variante="perigo"
                  desabilitado={i.status !== 'CURSANDO'}
                  aoClicar={() => void executar(() => api.del(`/inscricoes/${i.id}`), 'Inscrição removida.')}
                >
                  Remover
                </Botao>
              ),
            },
          ]}
        />
      </section>

      {m.curso.regime === 'SERIADO' && (
        <BlocoEnturmar
          matriculaId={id}
          periodos={periodos}
          aoConcluir={(mensagem) => aposAlterar(mensagem)}
        />
      )}

      {m.curso.regime === 'CREDITOS' && (
        <section className="cartao">
          <BlocoInscrever matriculaId={id} periodos={periodos} aoInscrever={() => aposAlterar('Inscrição realizada.')} />
        </section>
      )}
    </div>
  );
}

// ---------- Enturmação (regime seriado) ----------

function BlocoEnturmar({
  matriculaId,
  periodos,
  aoConcluir,
}: {
  matriculaId: number;
  periodos: Periodo[];
  aoConcluir: (mensagem: string) => void;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [grupo, setGrupo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enturmar(): Promise<void> {
    setErro(null);
    setOcupado(true);
    try {
      const r = await api.post<{ inscritas: number }>(`/matriculas/${matriculaId}/enturmar`, {
        periodoLetivoId: Number(periodoId),
        grupo: grupo.trim(),
      });
      aoConcluir(`Enturmação concluída: ${r.inscritas} turma(s) inscrita(s).`);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="cartao">
      <h3>Enturmar</h3>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Selecao
        rotulo="Período"
        valor={periodoId}
        aoMudar={setPeriodoId}
        opcoes={opcoesPeriodos(periodos)}
        vazio="Escolha o período"
        obrigatorio
      />
      <Campo rotulo="Grupo (ex.: 6A)" valor={grupo} aoMudar={setGrupo} obrigatorio />
      <Botao desabilitado={ocupado || !periodoId || grupo.trim() === ''} aoClicar={() => void enturmar()}>
        Enturmar
      </Botao>
    </section>
  );
}

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/matriculas',
    rotulo: 'Matrículas',
    icone: 'matriculas',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Matriculas />,
    ordem: 30,
  },
  ...rotasAluno,
];
