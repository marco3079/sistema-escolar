import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useDados } from '../../lib/useDados';
import type { RotaModulo } from '../../lib/rotas';
import {
  Abas,
  Aviso,
  Botao,
  Caixa,
  Campo,
  Cartao,
  Carregando,
  Modal,
  Pagina,
  Selecao,
  Selo,
  Tabela,
  formatarData,
  paraInputData,
} from '../../ui';
import './diario.css';

// ---------- Tipos (formatos do contrato 5.5 e 5.3/5.4) ----------

type StatusInscricao = 'CURSANDO' | 'APROVADO' | 'REPROVADO_NOTA' | 'REPROVADO_FALTA' | 'TRANCADO';

interface TurmaDiario {
  id: number;
  codigo: string;
  grupo: string | null;
  disciplina: { id: number; nome: string; codigo: string; creditos: number; curso: { id: number; nome: string; nivel: string; regime: string } };
  professor: { id: number; usuario: { nome: string } };
  periodoLetivo: { id: number; nome: string };
  _count: { inscricoes: number };
}

interface InscricaoDiario {
  id: number;
  status: StatusInscricao;
  notaFinal: number | null;
  frequencia: number | null;
  aluno: { ra: string; nome: string };
}

interface AvaliacaoDiario {
  id: number;
  nome: string;
  peso: number;
  data: string;
  notaMaxima: number;
}

interface NotaDiario {
  avaliacaoId: number;
  inscricaoId: number;
  valor: number;
}

interface AulaDiario {
  id: number;
  data: string;
  conteudo: string | null;
  presentes: number;
  total: number;
}

interface Diario {
  turma: TurmaDiario;
  inscricoes: InscricaoDiario[];
  avaliacoes: AvaliacaoDiario[];
  notas: NotaDiario[];
  aulas: AulaDiario[];
}

interface AulaDetalhe {
  id: number;
  data: string;
  conteudo: string | null;
  presencas: { inscricaoId: number; presente: boolean }[];
}

interface MatriculaResumo {
  id: number;
  status: string;
  aluno: { id: number; ra: string; usuario: { nome: string } };
  curso: { id: number; nome: string; nivel: string; regime: string };
  periodoIngresso: { id: number; nome: string };
}

interface ItemBoletim {
  inscricaoId: number;
  disciplina: string;
  codigo: string;
  turma: string;
  professor: string;
  avaliacoes: { nome: string; peso: number; notaMaxima: number; valor: number | null }[];
  notaFinal: number | null;
  frequencia: number | null;
  status: StatusInscricao;
}

interface Boletim {
  matricula: MatriculaResumo;
  periodos: { periodo: { id: number; nome: string }; itens: ItemBoletim[] }[];
}

interface ItemHistorico {
  periodo: string;
  codigo: string;
  disciplina: string;
  cargaHoraria: number;
  creditos: number;
  notaFinal: number | null;
  frequencia: number | null;
  status: StatusInscricao;
}

interface Historico {
  matricula: MatriculaResumo;
  itens: ItemHistorico[];
  resumo: { creditosConcluidos: number; cargaHorariaConcluida: number; coeficiente: number | null };
}

// ---------- Auxiliares ----------

const SITUACOES: Record<StatusInscricao, { rotulo: string; cor: 'azul' | 'verde' | 'vermelho' | 'cinza' }> = {
  CURSANDO: { rotulo: 'Cursando', cor: 'azul' },
  APROVADO: { rotulo: 'Aprovado', cor: 'verde' },
  REPROVADO_NOTA: { rotulo: 'Reprovado por nota', cor: 'vermelho' },
  REPROVADO_FALTA: { rotulo: 'Reprovado por falta', cor: 'vermelho' },
  TRANCADO: { rotulo: 'Trancado', cor: 'cinza' },
};

function SeloSituacao({ valor }: { valor: StatusInscricao }) {
  const situacao = SITUACOES[valor];
  return <Selo cor={situacao ? situacao.cor : 'cinza'}>{situacao ? situacao.rotulo : valor}</Selo>;
}

function formatarNumero(n: number | null, casas = 1): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(casas).replace('.', ',');
}

function formatarPercentual(n: number | null): string {
  return n === null || n === undefined ? '—' : `${formatarNumero(n)}%`;
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

function hojeIso(): string {
  return paraInputData(new Date().toISOString());
}

// ---------- Aba Notas ----------

interface FormAvaliacao {
  nome: string;
  peso: string;
  data: string;
  notaMaxima: string;
}

function AbaNotas({
  diario,
  podeEditar,
  aoAtualizar,
}: {
  diario: Diario;
  podeEditar: boolean;
  aoAtualizar(): void;
}) {
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);
  const [edicao, setEdicao] = useState<Record<number, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormAvaliacao>({ nome: '', peso: '1', data: '', notaMaxima: '10' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const selecionada = diario.avaliacoes.find((a) => a.id === selecionadaId) ?? null;

  function notaSalva(inscricaoId: number): string {
    if (!selecionada) return '';
    const nota = diario.notas.find(
      (n) => n.avaliacaoId === selecionada.id && n.inscricaoId === inscricaoId
    );
    return nota ? String(nota.valor) : '';
  }

  function escolher(avaliacao: AvaliacaoDiario) {
    setSelecionadaId(avaliacao.id);
    setEdicao({});
    setErro(null);
    setSucesso(null);
  }

  function abrirNova() {
    setEditandoId(null);
    setForm({ nome: '', peso: '1', data: hojeIso(), notaMaxima: '10' });
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao() {
    if (!selecionada) return;
    setEditandoId(selecionada.id);
    setForm({
      nome: selecionada.nome,
      peso: String(selecionada.peso),
      data: paraInputData(selecionada.data),
      notaMaxima: String(selecionada.notaMaxima),
    });
    setErro(null);
    setModalAberto(true);
  }

  async function salvarAvaliacao() {
    const nome = form.nome.trim();
    const peso = Number(form.peso.replace(',', '.'));
    const notaMaxima = form.notaMaxima.trim() === '' ? undefined : Number(form.notaMaxima.replace(',', '.'));
    if (!nome) return setErro('Informe o nome da avaliação.');
    if (!(peso > 0)) return setErro('O peso deve ser maior que zero.');
    if (!form.data) return setErro('Informe a data da avaliação.');
    if (notaMaxima !== undefined && !(notaMaxima > 0)) return setErro('A nota máxima deve ser maior que zero.');

    const corpo = { nome, peso, data: form.data, notaMaxima };
    setSalvando(true);
    setErro(null);
    try {
      if (editandoId === null) {
        await api.post(`/turmas/${diario.turma.id}/avaliacoes`, corpo);
      } else {
        await api.put(`/avaliacoes/${editandoId}`, corpo);
      }
      setModalAberto(false);
      setSucesso('Avaliação salva.');
      aoAtualizar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  async function excluirAvaliacao() {
    if (!selecionada) return;
    if (!window.confirm(`Excluir a avaliação "${selecionada.nome}" e as notas lançadas nela?`)) return;
    setErro(null);
    try {
      await api.del(`/avaliacoes/${selecionada.id}`);
      setSelecionadaId(null);
      setEdicao({});
      setSucesso('Avaliação excluída.');
      aoAtualizar();
    } catch (e) {
      setErro(mensagem(e));
    }
  }

  async function salvarNotas() {
    if (!selecionada) return;
    const notas: { inscricaoId: number; valor: number }[] = [];
    for (const i of diario.inscricoes) {
      const texto = (edicao[i.id] ?? notaSalva(i.id)).trim();
      if (texto === '') continue;
      const valor = Number(texto.replace(',', '.'));
      if (Number.isNaN(valor) || valor < 0 || valor > selecionada.notaMaxima) {
        setErro(`A nota de ${i.aluno.nome} deve estar entre 0 e ${selecionada.notaMaxima}.`);
        return;
      }
      notas.push({ inscricaoId: i.id, valor });
    }

    setSalvando(true);
    setErro(null);
    try {
      await api.put(`/avaliacoes/${selecionada.id}/notas`, { notas });
      setEdicao({});
      setSucesso('Notas salvas.');
      aoAtualizar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Cartao titulo="Avaliações">
        {podeEditar && (
          <div className="diario-acoes">
            <Botao aoClicar={abrirNova}>Nova avaliação</Botao>
            <Botao variante="secundario" desabilitado={!selecionada} aoClicar={abrirEdicao}>
              Editar
            </Botao>
            <Botao variante="perigo" desabilitado={!selecionada} aoClicar={excluirAvaliacao}>
              Excluir
            </Botao>
          </div>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
        <Tabela
          colunas={[
            { titulo: 'Avaliação', celula: (a: AvaliacaoDiario) => a.nome },
            { titulo: 'Data', celula: (a: AvaliacaoDiario) => formatarData(a.data) },
            { titulo: 'Peso', celula: (a: AvaliacaoDiario) => a.peso },
            { titulo: 'Nota máxima', celula: (a: AvaliacaoDiario) => a.notaMaxima },
          ]}
          dados={diario.avaliacoes}
          chave={(a) => a.id}
          vazio="Nenhuma avaliação criada. Use “Nova avaliação”."
          aoClicarLinha={escolher}
        />
      </Cartao>

      {selecionada && (
        <Cartao titulo={`Notas: ${selecionada.nome}`}>
          {diario.inscricoes.length === 0 ? (
            <Aviso tipo="info">Nenhum aluno nesta turma.</Aviso>
          ) : (
            <ul className="diario-lista">
              {diario.inscricoes.map((i) => (
                <li key={i.id}>
                  <div className="diario-aluno-topo">
                    <strong>{i.aluno.nome}</strong>
                    <span>
                      RA {i.aluno.ra} · média parcial {formatarNumero(i.notaFinal)}
                    </span>
                  </div>
                  {podeEditar ? (
                    <Campo
                      rotulo={`Nota (0 a ${selecionada.notaMaxima})`}
                      tipo="number"
                      valor={edicao[i.id] ?? notaSalva(i.id)}
                      aoMudar={(v) => setEdicao((atual) => ({ ...atual, [i.id]: v }))}
                    />
                  ) : (
                    <span>Nota: {notaSalva(i.id) === '' ? '—' : formatarNumero(Number(notaSalva(i.id)))}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {podeEditar && (
            <div className="diario-acoes">
              <Botao aoClicar={salvarNotas} desabilitado={salvando}>
                Salvar notas
              </Botao>
            </div>
          )}
        </Cartao>
      )}

      <Modal
        aberto={modalAberto}
        titulo={editandoId === null ? 'Nova avaliação' : 'Editar avaliação'}
        aoFechar={() => setModalAberto(false)}
      >
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Campo
          rotulo="Nome"
          valor={form.nome}
          aoMudar={(v) => setForm({ ...form, nome: v })}
          obrigatorio
        />
        <Campo
          rotulo="Peso"
          tipo="number"
          valor={form.peso}
          aoMudar={(v) => setForm({ ...form, peso: v })}
          obrigatorio
        />
        <Campo
          rotulo="Data"
          tipo="date"
          valor={form.data}
          aoMudar={(v) => setForm({ ...form, data: v })}
          obrigatorio
        />
        <Campo
          rotulo="Nota máxima"
          tipo="number"
          valor={form.notaMaxima}
          aoMudar={(v) => setForm({ ...form, notaMaxima: v })}
        />
        <div className="diario-acoes">
          <Botao aoClicar={salvarAvaliacao} desabilitado={salvando}>
            Salvar
          </Botao>
          <Botao variante="secundario" aoClicar={() => setModalAberto(false)}>
            Cancelar
          </Botao>
        </div>
      </Modal>
    </>
  );
}

// ---------- Aba Frequência ----------

interface FormAula {
  data: string;
  conteudo: string;
  presencas: Record<number, boolean>;
}

function AbaFrequencia({
  diario,
  podeEditar,
  aoAtualizar,
}: {
  diario: Diario;
  podeEditar: boolean;
  aoAtualizar(): void;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormAula>({ data: '', conteudo: '', presencas: {} });
  const [carregandoAula, setCarregandoAula] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  function presencasPadrao(): Record<number, boolean> {
    const presencas: Record<number, boolean> = {};
    for (const i of diario.inscricoes) presencas[i.id] = true;
    return presencas;
  }

  function abrirNova() {
    setEditandoId(null);
    setForm({ data: hojeIso(), conteudo: '', presencas: presencasPadrao() });
    setErro(null);
    setModalAberto(true);
  }

  async function abrirEdicao(aula: AulaDiario) {
    setErro(null);
    setCarregandoAula(true);
    try {
      const detalhe = await api.get<AulaDetalhe>(`/aulas/${aula.id}`);
      const presencas = presencasPadrao();
      // Presenças de alunos fora da lista (ex.: trancados) são preservadas no save
      for (const p of detalhe.presencas) presencas[p.inscricaoId] = p.presente;
      setEditandoId(detalhe.id);
      setForm({ data: paraInputData(detalhe.data), conteudo: detalhe.conteudo ?? '', presencas });
      setModalAberto(true);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setCarregandoAula(false);
    }
  }

  async function salvarAula() {
    if (!form.data) return setErro('Informe a data da aula.');
    const corpo = {
      data: form.data,
      conteudo: form.conteudo.trim() === '' ? null : form.conteudo.trim(),
      presencas: Object.entries(form.presencas).map(([id, presente]) => ({
        inscricaoId: Number(id),
        presente,
      })),
    };
    setSalvando(true);
    setErro(null);
    try {
      if (editandoId === null) {
        await api.post(`/turmas/${diario.turma.id}/aulas`, corpo);
      } else {
        await api.put(`/aulas/${editandoId}`, corpo);
      }
      setModalAberto(false);
      setSucesso('Aula salva.');
      aoAtualizar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  async function excluirAula() {
    if (editandoId === null) return;
    if (!window.confirm('Excluir esta aula e as presenças dela?')) return;
    setErro(null);
    try {
      await api.del(`/aulas/${editandoId}`);
      setModalAberto(false);
      setSucesso('Aula excluída.');
      aoAtualizar();
    } catch (e) {
      setErro(mensagem(e));
    }
  }

  return (
    <>
      <Cartao titulo="Aulas">
        {podeEditar && (
          <div className="diario-acoes">
            <Botao aoClicar={abrirNova}>Nova aula</Botao>
          </div>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
        {carregandoAula && <Carregando />}
        <Tabela
          colunas={[
            { titulo: 'Data', celula: (a: AulaDiario) => formatarData(a.data) },
            { titulo: 'Conteúdo', celula: (a: AulaDiario) => a.conteudo ?? '—' },
            { titulo: 'Presentes', celula: (a: AulaDiario) => `${a.presentes}/${a.total}` },
          ]}
          dados={diario.aulas}
          chave={(a) => a.id}
          vazio="Nenhuma aula registrada."
          aoClicarLinha={podeEditar ? abrirEdicao : undefined}
        />
      </Cartao>

      <Modal
        aberto={modalAberto}
        titulo={editandoId === null ? 'Nova aula' : 'Editar aula'}
        aoFechar={() => setModalAberto(false)}
      >
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Campo
          rotulo="Data"
          tipo="date"
          valor={form.data}
          aoMudar={(v) => setForm({ ...form, data: v })}
          obrigatorio
        />
        <Campo
          rotulo="Conteúdo"
          valor={form.conteudo}
          aoMudar={(v) => setForm({ ...form, conteudo: v })}
        />
        <p className="campo-rotulo">Presença</p>
        {diario.inscricoes.map((i) => (
          <Caixa
            key={i.id}
            rotulo={`${i.aluno.nome} (RA ${i.aluno.ra})`}
            marcado={form.presencas[i.id] ?? true}
            aoMudar={(v) => setForm((f) => ({ ...f, presencas: { ...f.presencas, [i.id]: v } }))}
          />
        ))}
        <div className="diario-acoes">
          <Botao aoClicar={salvarAula} desabilitado={salvando}>
            Salvar
          </Botao>
          {editandoId !== null && (
            <Botao variante="perigo" aoClicar={excluirAula}>
              Excluir aula
            </Botao>
          )}
          <Botao variante="secundario" aoClicar={() => setModalAberto(false)}>
            Cancelar
          </Botao>
        </div>
      </Modal>
    </>
  );
}

// ---------- Aba Fechamento ----------

function AbaFechamento({
  diario,
  podeEditar,
  aoAtualizar,
}: {
  diario: Diario;
  podeEditar: boolean;
  aoAtualizar(): void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function fecharTurma() {
    if (!window.confirm('Fechar a turma? A situação dos alunos cursando será definida pela nota final e pela frequência.')) {
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await api.post(`/turmas/${diario.turma.id}/fechar`);
      setSucesso('Turma fechada.');
      aoAtualizar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao titulo="Fechamento">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      <Tabela
        colunas={[
          { titulo: 'RA', celula: (i: InscricaoDiario) => i.aluno.ra },
          { titulo: 'Aluno', celula: (i: InscricaoDiario) => i.aluno.nome },
          { titulo: 'Nota final', celula: (i: InscricaoDiario) => formatarNumero(i.notaFinal) },
          { titulo: 'Frequência', celula: (i: InscricaoDiario) => formatarPercentual(i.frequencia) },
          { titulo: 'Situação', celula: (i: InscricaoDiario) => <SeloSituacao valor={i.status} /> },
        ]}
        dados={diario.inscricoes}
        chave={(i) => i.id}
        vazio="Nenhum aluno nesta turma."
      />
      {podeEditar && (
        <div className="diario-acoes">
          <Botao aoClicar={fecharTurma} desabilitado={salvando}>
            Fechar turma
          </Botao>
        </div>
      )}
    </Cartao>
  );
}

// ---------- Tela do diário ----------

function DiarioTurma() {
  const { turmaId } = useParams();
  const { usuario } = useAuth();
  const [aba, setAba] = useState('notas');
  const { dados, carregando, erro, recarregar } = useDados<Diario>(
    turmaId ? `/turmas/${turmaId}/diario` : null
  );
  // Secretaria consulta o diário, mas não lança nem fecha
  const podeEditar = usuario?.perfil !== 'SECRETARIA';

  if (!dados && carregando) return <Carregando />;
  if (!dados) {
    return (
      <Pagina titulo="Diário">
        <Aviso tipo="erro">{erro ?? 'Turma não encontrada.'}</Aviso>
      </Pagina>
    );
  }

  const turma = dados.turma;
  return (
    <Pagina titulo={turma.disciplina.nome}>
      <Cartao>
        <p className="diario-info">
          <strong>Turma:</strong> {turma.codigo}
          {turma.grupo ? ` (${turma.grupo})` : ''}
        </p>
        <p className="diario-info">
          <strong>Período:</strong> {turma.periodoLetivo.nome}
        </p>
        <p className="diario-info">
          <strong>Curso:</strong> {turma.disciplina.curso.nome}
        </p>
        {!podeEditar && <Aviso tipo="info">Somente leitura.</Aviso>}
      </Cartao>

      <Abas
        abas={[
          { id: 'notas', rotulo: 'Notas' },
          { id: 'frequencia', rotulo: 'Frequência' },
          { id: 'fechamento', rotulo: 'Fechamento' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      {aba === 'notas' && <AbaNotas diario={dados} podeEditar={podeEditar} aoAtualizar={recarregar} />}
      {aba === 'frequencia' && (
        <AbaFrequencia diario={dados} podeEditar={podeEditar} aoAtualizar={recarregar} />
      )}
      {aba === 'fechamento' && (
        <AbaFechamento diario={dados} podeEditar={podeEditar} aoAtualizar={recarregar} />
      )}
    </Pagina>
  );
}

// ---------- Boletim e histórico (reutilizados por aluno e secretaria) ----------

function BoletimView({ caminho }: { caminho: string | null }) {
  const { dados, carregando, erro } = useDados<Boletim>(caminho);
  if (caminho === null) return <Aviso tipo="info">Escolha uma matrícula.</Aviso>;
  if (carregando) return <Carregando />;
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;

  return (
    <>
      <p className="diario-info">
        {dados.matricula.curso.nome} · RA {dados.matricula.aluno.ra} · {dados.matricula.aluno.usuario.nome}
      </p>
      {dados.periodos.length === 0 && <Aviso tipo="info">Nenhuma disciplina nesta matrícula.</Aviso>}
      {dados.periodos.map((p) => (
        <Cartao key={p.periodo.id} titulo={p.periodo.nome}>
          <Tabela
            colunas={[
              {
                titulo: 'Disciplina',
                celula: (i: ItemBoletim) => (
                  <>
                    <strong>{i.disciplina}</strong>
                    <br />
                    <small>
                      {i.codigo} · Turma {i.turma}
                    </small>
                  </>
                ),
              },
              { titulo: 'Professor', celula: (i: ItemBoletim) => i.professor },
              {
                titulo: 'Avaliações',
                celula: (i: ItemBoletim) =>
                  i.avaliacoes.length === 0 ? (
                    '—'
                  ) : (
                    <ul className="diario-notas">
                      {i.avaliacoes.map((a, k) => (
                        <li key={k}>
                          {a.nome}: {a.valor === null ? '—' : formatarNumero(a.valor)}
                          {a.notaMaxima !== 10 ? `/${a.notaMaxima}` : ''}
                        </li>
                      ))}
                    </ul>
                  ),
              },
              { titulo: 'Média', celula: (i: ItemBoletim) => formatarNumero(i.notaFinal) },
              { titulo: 'Frequência', celula: (i: ItemBoletim) => formatarPercentual(i.frequencia) },
              { titulo: 'Situação', celula: (i: ItemBoletim) => <SeloSituacao valor={i.status} /> },
            ]}
            dados={p.itens}
            chave={(i) => i.inscricaoId}
            vazio="Nenhuma disciplina neste período."
          />
        </Cartao>
      ))}
    </>
  );
}

function HistoricoView({ caminho }: { caminho: string | null }) {
  const { dados, carregando, erro } = useDados<Historico>(caminho);
  if (caminho === null) return <Aviso tipo="info">Escolha uma matrícula.</Aviso>;
  if (carregando) return <Carregando />;
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;

  return (
    <>
      <p className="diario-info">
        {dados.matricula.curso.nome} · RA {dados.matricula.aluno.ra} · {dados.matricula.aluno.usuario.nome}
      </p>
      <Cartao titulo="Resumo">
        <div className="diario-resumo">
          <div>
            <div className="diario-resumo-valor">{dados.resumo.creditosConcluidos}</div>
            <div className="diario-resumo-rotulo">Créditos concluídos</div>
          </div>
          <div>
            <div className="diario-resumo-valor">{dados.resumo.cargaHorariaConcluida}</div>
            <div className="diario-resumo-rotulo">Carga horária concluída</div>
          </div>
          <div>
            <div className="diario-resumo-valor">{formatarNumero(dados.resumo.coeficiente, 2)}</div>
            <div className="diario-resumo-rotulo">Coeficiente</div>
          </div>
        </div>
      </Cartao>
      <Cartao titulo="Disciplinas">
        <Tabela
          colunas={[
            { titulo: 'Período', celula: (i: ItemHistorico) => i.periodo },
            { titulo: 'Código', celula: (i: ItemHistorico) => i.codigo },
            { titulo: 'Disciplina', celula: (i: ItemHistorico) => i.disciplina },
            { titulo: 'C.H.', celula: (i: ItemHistorico) => i.cargaHoraria },
            { titulo: 'Créditos', celula: (i: ItemHistorico) => i.creditos },
            { titulo: 'Nota final', celula: (i: ItemHistorico) => formatarNumero(i.notaFinal) },
            { titulo: 'Frequência', celula: (i: ItemHistorico) => formatarPercentual(i.frequencia) },
            { titulo: 'Situação', celula: (i: ItemHistorico) => <SeloSituacao valor={i.status} /> },
          ]}
          dados={dados.itens}
          chave={(i) => `${i.periodo}-${i.codigo}`}
          vazio="Nenhuma disciplina no histórico."
        />
      </Cartao>
    </>
  );
}

function BoletimAluno() {
  const { dados: matriculas, carregando, erro } = useDados<MatriculaResumo[]>('/matriculas/minhas');
  const [escolhida, setEscolhida] = useState('');

  if (carregando && !matriculas) return <Carregando />;
  if (erro && !matriculas) {
    return (
      <Pagina titulo="Boletim">
        <Aviso tipo="erro">{erro}</Aviso>
      </Pagina>
    );
  }
  const lista = matriculas ?? [];
  const caminho = escolhida ? `/boletim/meu?matriculaId=${escolhida}` : '/boletim/meu';

  return (
    <Pagina titulo="Boletim">
      {lista.length > 1 && (
        <Cartao>
          <Selecao
            rotulo="Matrícula"
            valor={escolhida}
            aoMudar={setEscolhida}
            opcoes={lista.map((m) => ({ valor: String(m.id), rotulo: `${m.curso.nome} (${m.periodoIngresso.nome})` }))}
            vazio="Primeira matrícula ativa"
          />
        </Cartao>
      )}
      {lista.length === 0 ? (
        <Aviso tipo="info">Você ainda não tem matrícula.</Aviso>
      ) : (
        <BoletimView caminho={caminho} />
      )}
    </Pagina>
  );
}

function HistoricoAluno() {
  return (
    <Pagina titulo="Histórico">
      <HistoricoView caminho="/historico/meu" />
    </Pagina>
  );
}

function BoletinsAdmin() {
  const { dados: matriculas, carregando, erro } = useDados<MatriculaResumo[]>('/matriculas');
  const [matriculaId, setMatriculaId] = useState('');
  const [aba, setAba] = useState('boletim');

  if (carregando && !matriculas) return <Carregando />;
  if (erro && !matriculas) {
    return (
      <Pagina titulo="Boletins">
        <Aviso tipo="erro">{erro}</Aviso>
      </Pagina>
    );
  }
  const lista = matriculas ?? [];

  let conteudo: ReactNode;
  if (matriculaId === '') {
    conteudo = <Aviso tipo="info">Escolha uma matrícula para ver o boletim ou o histórico.</Aviso>;
  } else if (aba === 'boletim') {
    conteudo = <BoletimView caminho={`/boletim/${matriculaId}`} />;
  } else {
    conteudo = <HistoricoView caminho={`/historico/${matriculaId}`} />;
  }

  return (
    <Pagina titulo="Boletins">
      <Cartao>
        <Selecao
          rotulo="Matrícula"
          valor={matriculaId}
          aoMudar={setMatriculaId}
          opcoes={lista.map((m) => ({
            valor: String(m.id),
            rotulo: `${m.aluno.ra} - ${m.aluno.usuario.nome} - ${m.curso.nome}`,
          }))}
          vazio="Escolha uma matrícula"
        />
      </Cartao>
      <Abas
        abas={[
          { id: 'boletim', rotulo: 'Boletim' },
          { id: 'historico', rotulo: 'Histórico' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      {conteudo}
    </Pagina>
  );
}

// ---------- Registro das rotas ----------

export const rotas: RotaModulo[] = [
  {
    caminho: '/professor/diario/:turmaId',
    rotulo: 'Diário',
    icone: 'diario',
    perfis: ['PROFESSOR', 'ADMIN', 'SECRETARIA'],
    elemento: <DiarioTurma />,
    menu: false,
  },
  {
    caminho: '/aluno/boletim',
    rotulo: 'Boletim',
    icone: 'boletim',
    perfis: ['ALUNO'],
    elemento: <BoletimAluno />,
    ordem: 40,
  },
  {
    caminho: '/aluno/historico',
    rotulo: 'Histórico',
    icone: 'historico',
    perfis: ['ALUNO'],
    elemento: <HistoricoAluno />,
    ordem: 41,
  },
  {
    caminho: '/admin/boletins',
    rotulo: 'Boletins',
    icone: 'boletim',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <BoletinsAdmin />,
    ordem: 40,
  },
];
