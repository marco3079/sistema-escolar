import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useDados } from '../../lib/useDados';
import type { RotaModulo } from '../../lib/rotas';
import { rotuloNivel } from '../../lib/tipos';
import {
  Abas,
  Avatar,
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
import { Icone } from '../../ui/icones';
import type { NomeIcone } from '../../ui/icones';
import './diario.css';
import './boletim.css';

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

const NIVEIS_POS_GRADUACAO: string[] = ['ESPECIALIZACAO', 'MESTRADO', 'DOUTORADO'];
const FREQUENCIA_MINIMA_BOLETIM = 75;
const CHAVE_VISAO_BOLETIM = 'escola.boletim.visao';

type VisaoBoletim = 'cartoes' | 'tabela';

function mediaMinimaDoNivel(nivel: string): number {
  return NIVEIS_POS_GRADUACAO.includes(nivel) ? 7 : 6;
}

function classeNota(nota: number | null, minima: number): string {
  if (nota === null || nota === undefined) return 'boletim-nota-sem';
  return nota >= minima ? 'boletim-nota-ok' : 'boletim-nota-baixa';
}

function classeFrequencia(frequencia: number | null): string {
  if (frequencia === null || frequencia === undefined) return '';
  return frequencia < FREQUENCIA_MINIMA_BOLETIM ? 'boletim-nota-baixa' : '';
}

function mediaDe(valores: (number | null)[]): number | null {
  const validos = valores.filter((v): v is number => v !== null && v !== undefined);
  if (validos.length === 0) return null;
  return validos.reduce((soma, v) => soma + v, 0) / validos.length;
}

function limitarPercentual(valor: number): number {
  return Math.min(100, Math.max(0, valor));
}

function textoNota(avaliacao: { valor: number | null; notaMaxima: number }): string {
  if (avaliacao.valor === null) return '—';
  return formatarNumero(avaliacao.valor) + (avaliacao.notaMaxima !== 10 ? `/${avaliacao.notaMaxima}` : '');
}

function rotuloStatusMatricula(status: string): string {
  return status === 'ATIVA' ? 'Ativa' : status.charAt(0) + status.slice(1).toLowerCase();
}

function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function lerVisaoBoletim(): VisaoBoletim {
  try {
    return window.localStorage.getItem(CHAVE_VISAO_BOLETIM) === 'tabela' ? 'tabela' : 'cartoes';
  } catch {
    return 'cartoes';
  }
}

function guardarVisaoBoletim(visao: VisaoBoletim) {
  try {
    window.localStorage.setItem(CHAVE_VISAO_BOLETIM, visao);
  } catch {
    // Sem armazenamento disponível: a escolha vale só para esta tela.
  }
}

function agruparPorPeriodo(itens: ItemHistorico[]): { periodo: string; itens: ItemHistorico[] }[] {
  const grupos = new Map<string, ItemHistorico[]>();
  for (const item of itens) {
    const lista = grupos.get(item.periodo);
    if (lista) lista.push(item);
    else grupos.set(item.periodo, [item]);
  }
  return Array.from(grupos.entries()).map(([periodo, lista]) => ({ periodo, itens: lista }));
}

function CabecalhoAluno({ matricula }: { matricula: MatriculaResumo }) {
  const ativa = matricula.status === 'ATIVA';
  return (
    <Cartao>
      <div className="boletim-cabecalho">
        <Avatar nome={matricula.aluno.usuario.nome} tamanho={56} />
        <div className="boletim-cabecalho-texto">
          <h2 className="boletim-cabecalho-nome">{matricula.aluno.usuario.nome}</h2>
          <p className="boletim-suave">RA {matricula.aluno.ra}</p>
          <p className="boletim-cabecalho-curso">{matricula.curso.nome}</p>
          <div className="boletim-selos">
            <Selo cor="azul">{rotuloNivel(matricula.curso.nivel)}</Selo>
            <Selo cor={ativa ? 'verde' : 'cinza'}>{rotuloStatusMatricula(matricula.status)}</Selo>
          </div>
        </div>
        <div className="boletim-cabecalho-acoes boletim-nao-imprimir">
          <Botao variante="secundario" aoClicar={() => window.print()}>
            <Icone nome="documento" tamanho={18} />
            Imprimir
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}

// Estrutura comum das três telas: cabeçalho do aluno, abas (quando houver) e o conteúdo.
function Moldura({
  matricula,
  abas,
  children,
}: {
  matricula?: MatriculaResumo;
  abas?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="boletim-visao">
      {matricula && <CabecalhoAluno matricula={matricula} />}
      {abas && <div className="boletim-nao-imprimir">{abas}</div>}
      {children}
    </div>
  );
}

function ItemResumo({
  icone,
  cor,
  valor,
  rotulo,
}: {
  icone: NomeIcone;
  cor: 'azul' | 'roxo' | 'verde' | 'laranja';
  valor: ReactNode;
  rotulo: string;
}) {
  return (
    <div className="resumo-item">
      <span className={`resumo-icone resumo-icone-${cor}`}>
        <Icone nome={icone} tamanho={24} />
      </span>
      <div className="boletim-resumo-texto">
        <span className="resumo-valor">{valor}</span>
        <span className="resumo-rotulo">{rotulo}</span>
      </div>
    </div>
  );
}

function MedidorMedia({ nota, minima }: { nota: number | null; minima: number }) {
  const texto = formatarNumero(nota);
  const classe = classeNota(nota, minima);
  return (
    <div className="boletim-medidor">
      <span className="boletim-medidor-rotulo">Média</span>
      <span className={`boletim-medidor-valor ${classe}`}>{texto}</span>
      <div
        className="boletim-barra"
        role="img"
        aria-label={nota === null ? 'Média ainda não lançada' : `Média ${texto} de 10`}
      >
        {nota !== null && (
          <span
            className={`boletim-barra-preenchimento ${classe}`}
            style={{ width: `${limitarPercentual(nota * 10)}%` }}
          />
        )}
        <span className="boletim-marcador" style={{ left: `${minima * 10}%` }} />
      </div>
    </div>
  );
}

function MedidorFrequencia({ frequencia }: { frequencia: number | null }) {
  const texto = formatarPercentual(frequencia);
  const baixa = frequencia !== null && frequencia < FREQUENCIA_MINIMA_BOLETIM;
  return (
    <div className="boletim-medidor">
      <span className="boletim-medidor-rotulo">Frequência</span>
      <span className={`boletim-medidor-valor ${baixa ? 'boletim-nota-baixa' : ''}`}>{texto}</span>
      <div
        className="boletim-barra"
        role="img"
        aria-label={frequencia === null ? 'Frequência ainda não lançada' : `Frequência ${texto}`}
      >
        {frequencia !== null && (
          <span
            className={`boletim-barra-preenchimento ${baixa ? 'boletim-nota-baixa' : 'boletim-barra-neutra'}`}
            style={{ width: `${limitarPercentual(frequencia)}%` }}
          />
        )}
        <span className="boletim-marcador" style={{ left: `${FREQUENCIA_MINIMA_BOLETIM}%` }} />
      </div>
    </div>
  );
}

function CartaoDisciplina({ item, minima }: { item: ItemBoletim; minima: number }) {
  return (
    <article className="boletim-disciplina">
      <header className="boletim-disciplina-topo">
        <div className="boletim-disciplina-titulo">
          <h3>{item.disciplina}</h3>
          <p className="boletim-suave">
            {item.codigo} · Turma {item.turma}
          </p>
          <p className="boletim-suave">{item.professor}</p>
        </div>
        <SeloSituacao valor={item.status} />
      </header>
      {item.avaliacoes.length === 0 ? (
        <p className="boletim-suave">Sem avaliações lançadas.</p>
      ) : (
        <ul className="boletim-avaliacoes">
          {item.avaliacoes.map((a, k) => (
            <li key={k}>
              <span>
                {a.nome} <small className="boletim-suave">peso {formatarNumero(a.peso)}</small>
              </span>
              <span>{textoNota(a)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="boletim-medidores">
        <MedidorMedia nota={item.notaFinal} minima={minima} />
        <MedidorFrequencia frequencia={item.frequencia} />
      </div>
    </article>
  );
}

function SegmentadoVisao({ visao, aoMudar }: { visao: VisaoBoletim; aoMudar: (v: VisaoBoletim) => void }) {
  const opcoes: { id: VisaoBoletim; rotulo: string }[] = [
    { id: 'cartoes', rotulo: 'Cartões' },
    { id: 'tabela', rotulo: 'Tabela' },
  ];
  return (
    <div className="segmentado" role="group" aria-label="Visão do boletim">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          className="segmentado-item"
          aria-pressed={visao === o.id}
          onClick={() => aoMudar(o.id)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

function BoletimView({ caminho, abas }: { caminho: string | null; abas?: ReactNode }) {
  const { dados, carregando, erro } = useDados<Boletim>(caminho);
  const [periodoEscolhido, setPeriodoEscolhido] = useState('');
  const [visao, setVisao] = useState<VisaoBoletim>(lerVisaoBoletim);
  if (caminho === null) return <Aviso tipo="info">Escolha uma matrícula.</Aviso>;
  if (carregando) return <Moldura abas={abas}><Carregando /></Moldura>;
  if (erro) return <Moldura abas={abas}><Aviso tipo="erro">{erro}</Aviso></Moldura>;
  if (!dados) return null;

  const minima = mediaMinimaDoNivel(dados.matricula.curso.nivel);
  const periodos = dados.periodos;
  // O primeiro da lista é o mais recente (contrato 5.5).
  const periodo = periodos.find((p) => String(p.periodo.id) === periodoEscolhido) ?? periodos[0] ?? null;
  const itens = periodo ? periodo.itens : [];
  const mediaPeriodo = mediaDe(itens.map((i) => i.notaFinal));
  const frequenciaMedia = mediaDe(itens.map((i) => i.frequencia));
  const aprovadas = itens.filter((i) => i.status === 'APROVADO').length;

  return (
    <Moldura matricula={dados.matricula} abas={abas}>
      {periodos.length === 0 && <Aviso tipo="info">Nenhuma disciplina nesta matrícula.</Aviso>}
      {periodo && (
        <>
          <div className="resumo">
            <ItemResumo icone="diario" cor="azul" valor={itens.length} rotulo="Disciplinas" />
            <ItemResumo icone="grafico" cor="roxo" valor={formatarNumero(mediaPeriodo)} rotulo="Média do período" />
            <ItemResumo icone="calendario" cor="verde" valor={formatarPercentual(frequenciaMedia)} rotulo="Frequência média" />
            <ItemResumo icone="medalha" cor="laranja" valor={`${aprovadas} de ${itens.length}`} rotulo="Aprovadas" />
          </div>

          <div className="barra-ferramentas boletim-nao-imprimir">
            {periodos.length > 1 && (
              <div className="filtros">
                <Selecao
                  rotulo="Período"
                  valor={periodoEscolhido}
                  aoMudar={setPeriodoEscolhido}
                  opcoes={periodos.map((p) => ({ valor: String(p.periodo.id), rotulo: p.periodo.nome }))}
                  vazio="Mais recente"
                />
              </div>
            )}
            <SegmentadoVisao
              visao={visao}
              aoMudar={(v) => {
                setVisao(v);
                guardarVisaoBoletim(v);
              }}
            />
          </div>

          {itens.length === 0 ? (
            <Aviso tipo="info">Nenhuma disciplina neste período.</Aviso>
          ) : visao === 'cartoes' ? (
            <div className="boletim-grade-disciplinas">
              {itens.map((i) => (
                <CartaoDisciplina key={i.inscricaoId} item={i} minima={minima} />
              ))}
            </div>
          ) : (
            <Cartao>
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
                  {
                    titulo: 'Avaliações',
                    celula: (i: ItemBoletim) =>
                      i.avaliacoes.length === 0
                        ? '—'
                        : i.avaliacoes.map((a) => `${a.nome} ${textoNota(a)}`).join(' · '),
                  },
                  {
                    titulo: 'Média',
                    alinhar: 'direita',
                    celula: (i: ItemBoletim) => (
                      <span className={classeNota(i.notaFinal, minima)}>{formatarNumero(i.notaFinal)}</span>
                    ),
                  },
                  {
                    titulo: 'Frequência',
                    alinhar: 'direita',
                    celula: (i: ItemBoletim) => (
                      <span className={classeFrequencia(i.frequencia)}>{formatarPercentual(i.frequencia)}</span>
                    ),
                  },
                  { titulo: 'Situação', celula: (i: ItemBoletim) => <SeloSituacao valor={i.status} /> },
                ]}
                dados={itens}
                chave={(i) => i.inscricaoId}
                vazio="Nenhuma disciplina neste período."
              />
            </Cartao>
          )}
        </>
      )}
    </Moldura>
  );
}

function HistoricoView({ caminho, abas }: { caminho: string | null; abas?: ReactNode }) {
  const { dados, carregando, erro } = useDados<Historico>(caminho);
  if (caminho === null) return <Aviso tipo="info">Escolha uma matrícula.</Aviso>;
  if (carregando) return <Moldura abas={abas}><Carregando /></Moldura>;
  if (erro) return <Moldura abas={abas}><Aviso tipo="erro">{erro}</Aviso></Moldura>;
  if (!dados) return null;

  const minima = mediaMinimaDoNivel(dados.matricula.curso.nivel);
  const grupos = agruparPorPeriodo(dados.itens);
  const aprovadas = dados.itens.filter((i) => i.status === 'APROVADO').length;

  return (
    <Moldura matricula={dados.matricula} abas={abas}>
      <div className="resumo">
        <ItemResumo icone="lista" cor="azul" valor={dados.resumo.creditosConcluidos} rotulo="Créditos concluídos" />
        <ItemResumo icone="relogio" cor="roxo" valor={`${dados.resumo.cargaHorariaConcluida} h`} rotulo="Carga horária concluída" />
        <ItemResumo icone="grafico" cor="verde" valor={formatarNumero(dados.resumo.coeficiente, 2)} rotulo="Coeficiente" />
        <ItemResumo icone="medalha" cor="laranja" valor={aprovadas} rotulo="Disciplinas aprovadas" />
      </div>

      {dados.itens.length === 0 && <Aviso tipo="info">Nenhuma disciplina no histórico.</Aviso>}

      {grupos.map((g) => (
        <Cartao key={g.periodo} titulo={g.periodo}>
          <Tabela
            colunas={[
              {
                titulo: 'Código',
                celula: (i: ItemHistorico) => <span className="boletim-codigo">{i.codigo}</span>,
              },
              { titulo: 'Disciplina', celula: (i: ItemHistorico) => i.disciplina },
              { titulo: 'C.H.', alinhar: 'direita', celula: (i: ItemHistorico) => i.cargaHoraria },
              { titulo: 'Créditos', alinhar: 'direita', celula: (i: ItemHistorico) => i.creditos },
              {
                titulo: 'Nota final',
                alinhar: 'direita',
                celula: (i: ItemHistorico) => (
                  <span className={classeNota(i.notaFinal, minima)}>{formatarNumero(i.notaFinal)}</span>
                ),
              },
              {
                titulo: 'Frequência',
                alinhar: 'direita',
                celula: (i: ItemHistorico) => (
                  <span className={classeFrequencia(i.frequencia)}>{formatarPercentual(i.frequencia)}</span>
                ),
              },
              { titulo: 'Situação', celula: (i: ItemHistorico) => <SeloSituacao valor={i.status} /> },
            ]}
            dados={g.itens}
            chave={(i) => `${i.codigo}-${i.disciplina}`}
            vazio="Nenhuma disciplina neste período."
          />
        </Cartao>
      ))}
    </Moldura>
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
        <div className="barra-ferramentas boletim-nao-imprimir">
          <div className="filtros">
            <Selecao
              rotulo="Matrícula"
              valor={escolhida}
              aoMudar={setEscolhida}
              opcoes={lista.map((m) => ({ valor: String(m.id), rotulo: `${m.curso.nome} (${m.periodoIngresso.nome})` }))}
              vazio="Primeira matrícula ativa"
            />
          </div>
        </div>
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
  const [busca, setBusca] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('');

  if (carregando && !matriculas) return <Carregando />;
  if (erro && !matriculas) {
    return (
      <Pagina titulo="Boletins">
        <Aviso tipo="erro">{erro}</Aviso>
      </Pagina>
    );
  }
  const lista = matriculas ?? [];

  const cursos: { id: number; nome: string }[] = [];
  for (const m of lista) {
    if (!cursos.some((c) => c.id === m.curso.id)) cursos.push({ id: m.curso.id, nome: m.curso.nome });
  }
  cursos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const termo = normalizarBusca(busca);
  const casa = (m: MatriculaResumo) =>
    (cursoFiltro === '' || String(m.curso.id) === cursoFiltro) &&
    (termo === '' ||
      normalizarBusca(m.aluno.usuario.nome).includes(termo) ||
      normalizarBusca(m.aluno.ra).includes(termo));
  const visiveis = lista.filter(casa);
  // No celular o seletor mostra os filtrados, mais o aluno já escolhido (para não ficar em branco).
  const opcoesSelecao = lista.filter((m) => casa(m) || String(m.id) === matriculaId);

  const abasEl = (
    <Abas
      abas={[
        { id: 'boletim', rotulo: 'Boletim' },
        { id: 'historico', rotulo: 'Histórico' },
      ]}
      ativa={aba}
      aoMudar={setAba}
    />
  );

  let conteudo: ReactNode;
  if (matriculaId === '') {
    conteudo = (
      <div className="cartao boletim-vazio">
        <Icone nome="boletim" tamanho={48} className="boletim-vazio-icone" />
        <p>Escolha um aluno para ver o boletim e o histórico.</p>
      </div>
    );
  } else if (aba === 'boletim') {
    conteudo = <BoletimView caminho={`/boletim/${matriculaId}`} abas={abasEl} />;
  } else {
    conteudo = <HistoricoView caminho={`/historico/${matriculaId}`} abas={abasEl} />;
  }

  return (
    <Pagina titulo="Boletins">
      <div className="boletim-admin">
        <section className="cartao boletim-lista">
          <div className="barra-ferramentas">
            <div className="filtros">
              <Campo rotulo="Buscar por nome ou RA" valor={busca} aoMudar={setBusca} />
              <Selecao
                rotulo="Curso"
                valor={cursoFiltro}
                aoMudar={setCursoFiltro}
                opcoes={cursos.map((c) => ({ valor: String(c.id), rotulo: c.nome }))}
                vazio="Todos os cursos"
              />
            </div>
          </div>

          <div className="boletim-so-celular">
            <Selecao
              rotulo="Aluno"
              valor={matriculaId}
              aoMudar={setMatriculaId}
              opcoes={opcoesSelecao.map((m) => ({
                valor: String(m.id),
                rotulo: `${m.aluno.usuario.nome} · RA ${m.aluno.ra}`,
              }))}
              vazio="Escolha um aluno"
            />
          </div>

          {visiveis.length === 0 ? (
            <p className="tabela-vazia">Nenhum aluno encontrado.</p>
          ) : (
            <ul className="boletim-alunos">
              {visiveis.map((m) => {
                const ativo = String(m.id) === matriculaId;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={ativo ? 'boletim-aluno boletim-aluno-ativo' : 'boletim-aluno'}
                      aria-pressed={ativo}
                      onClick={() => setMatriculaId(String(m.id))}
                    >
                      <Avatar nome={m.aluno.usuario.nome} tamanho={36} />
                      <span className="boletim-aluno-texto">
                        <strong>{m.aluno.usuario.nome}</strong>
                        <small>
                          RA {m.aluno.ra} · {m.curso.nome}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="boletim-principal">{conteudo}</div>
      </div>
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
