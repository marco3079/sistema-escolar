import { useState } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Selecao, Selo, Tabela } from '../../ui';

// ---------- Tipos (formatos do contrato 5.3 e 5.4) ----------

export interface Periodo {
  id: number;
  nome: string;
}

export type SituacaoTurma =
  | 'DISPONIVEL'
  | 'JA_INSCRITO'
  | 'JA_APROVADO'
  | 'PRE_REQUISITO_PENDENTE'
  | 'SEM_VAGA';

export interface TurmaDisponivel {
  id: number;
  codigo: string;
  grupo: string | null;
  vagas: number;
  disciplina: {
    id: number;
    nome: string;
    codigo: string;
    creditos: number;
    cursoId: number;
    curso: { id: number; nome: string; nivel: string; regime: string };
  };
  professor: { id: number; usuario: { nome: string } };
  periodoLetivo: { id: number; nome: string };
  _count: { inscricoes: number };
  situacao: SituacaoTurma;
  pendentes: string[];
}

export interface MatriculaDTO {
  id: number;
  alunoId: number;
  cursoId: number;
  periodoIngressoId: number;
  status: string;
  serieAtual: number;
  aluno: { id: number; ra: string; usuario: { nome: string } };
  curso: { id: number; nome: string; nivel: string; regime: string };
  periodoIngresso: { id: number; nome: string };
}

export interface InscricaoDTO {
  id: number;
  matriculaId: number;
  turmaId: number;
  status: string;
  notaFinal: number | null;
  frequencia: number | null;
  turma: {
    id: number;
    codigo: string;
    grupo: string | null;
    disciplina: { id: number; nome: string; codigo: string; creditos: number; cargaHoraria: number };
    periodoLetivo: { id: number; nome: string };
    professor: { usuario: { nome: string } };
  };
}

export interface MatriculaDetalhe extends MatriculaDTO {
  inscricoes: InscricaoDTO[];
}

// ---------- Rótulos e selos ----------

type CorSelo = 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza';

export const OPCOES_STATUS_MATRICULA: { valor: string; rotulo: string }[] = [
  { valor: 'ATIVA', rotulo: 'Ativa' },
  { valor: 'TRANCADA', rotulo: 'Trancada' },
  { valor: 'CONCLUIDA', rotulo: 'Concluída' },
  { valor: 'CANCELADA', rotulo: 'Cancelada' },
];

const ROTULO_STATUS_MATRICULA: Record<string, string> = Object.fromEntries(
  OPCOES_STATUS_MATRICULA.map((o) => [o.valor, o.rotulo]),
);

const COR_STATUS_MATRICULA: Record<string, CorSelo> = {
  ATIVA: 'verde',
  TRANCADA: 'amarelo',
  CONCLUIDA: 'azul',
  CANCELADA: 'vermelho',
};

const ROTULO_STATUS_INSCRICAO: Record<string, string> = {
  CURSANDO: 'Cursando',
  APROVADO: 'Aprovado',
  REPROVADO_NOTA: 'Reprovado (nota)',
  REPROVADO_FALTA: 'Reprovado (falta)',
  TRANCADO: 'Trancado',
};

const COR_STATUS_INSCRICAO: Record<string, CorSelo> = {
  CURSANDO: 'azul',
  APROVADO: 'verde',
  REPROVADO_NOTA: 'vermelho',
  REPROVADO_FALTA: 'vermelho',
  TRANCADO: 'cinza',
};

const ROTULO_SITUACAO: Record<SituacaoTurma, string> = {
  DISPONIVEL: 'Disponível',
  JA_INSCRITO: 'Já inscrito',
  JA_APROVADO: 'Já aprovado',
  PRE_REQUISITO_PENDENTE: 'Falta pré-requisito',
  SEM_VAGA: 'Sem vaga',
};

const COR_SITUACAO: Record<SituacaoTurma, CorSelo> = {
  DISPONIVEL: 'verde',
  JA_INSCRITO: 'azul',
  JA_APROVADO: 'azul',
  PRE_REQUISITO_PENDENTE: 'amarelo',
  SEM_VAGA: 'vermelho',
};

export function rotuloSituacao(t: { situacao: SituacaoTurma; pendentes: string[] }): string {
  if (t.situacao === 'PRE_REQUISITO_PENDENTE') {
    return `Falta pré-requisito: ${t.pendentes.join(', ')}`;
  }
  return ROTULO_SITUACAO[t.situacao];
}

export function SeloMatricula({ status }: { status: string }) {
  return <Selo cor={COR_STATUS_MATRICULA[status] ?? 'cinza'}>{ROTULO_STATUS_MATRICULA[status] ?? status}</Selo>;
}

export function SeloInscricao({ status }: { status: string }) {
  return <Selo cor={COR_STATUS_INSCRICAO[status] ?? 'cinza'}>{ROTULO_STATUS_INSCRICAO[status] ?? status}</Selo>;
}

export function SeloSituacao({ t }: { t: { situacao: SituacaoTurma; pendentes: string[] } }) {
  return (
    <Selo cor={COR_SITUACAO[t.situacao]}>{rotuloSituacao(t)}</Selo>
  );
}

// ---------- Auxiliares ----------

// Monta o caminho com query string, ignorando filtros vazios.
export function caminhoComFiltros(base: string, filtros: Record<string, string>): string {
  const partes = Object.entries(filtros)
    .filter(([, valor]) => valor !== '')
    .map(([chave, valor]) => `${chave}=${encodeURIComponent(valor)}`);
  return partes.length > 0 ? `${base}?${partes.join('&')}` : base;
}

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

export function opcoesPeriodos(periodos: Periodo[]): { valor: string; rotulo: string }[] {
  return periodos.map((p) => ({ valor: String(p.id), rotulo: p.nome }));
}

// ---------- Bloco de inscrição em disciplinas (regime de créditos) ----------

export function BlocoInscrever({
  matriculaId,
  periodos,
  aoInscrever,
}: {
  matriculaId: number;
  periodos: Periodo[];
  aoInscrever: () => void;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const turmas = useDados<TurmaDisponivel[]>(
    periodoId ? `/matriculas/${matriculaId}/turmas-disponiveis?periodoLetivoId=${periodoId}` : null,
  );

  async function inscrever(turmaId: number): Promise<void> {
    setErro(null);
    setOcupado(true);
    try {
      await api.post('/inscricoes', { matriculaId, turmaId });
      turmas.recarregar();
      aoInscrever();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="bloco-inscrever">
      <h3>Inscrever em disciplina</h3>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Selecao
        rotulo="Período"
        valor={periodoId}
        aoMudar={setPeriodoId}
        opcoes={opcoesPeriodos(periodos)}
        vazio="Escolha o período"
      />
      {periodoId && turmas.erro && <Aviso tipo="erro">{turmas.erro}</Aviso>}
      {periodoId && turmas.dados && (
        <Tabela<TurmaDisponivel>
          dados={turmas.dados}
          chave={(t) => t.id}
          vazio="Nenhuma disciplina deste curso neste período."
          colunas={[
            { titulo: 'Disciplina', celula: (t) => t.disciplina.nome },
            { titulo: 'Turma', celula: (t) => t.codigo },
            { titulo: 'Professor', celula: (t) => t.professor.usuario.nome },
            { titulo: 'Vagas', celula: (t) => t.vagas },
            { titulo: 'Situação', celula: (t) => <SeloSituacao t={t} /> },
            {
              titulo: 'Ação',
              celula: (t) => (
                <Botao
                  variante="secundario"
                  desabilitado={ocupado || t.situacao !== 'DISPONIVEL'}
                  aoClicar={() => void inscrever(t.id)}
                >
                  Inscrever
                </Botao>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
