import { useState } from 'react';
import { useDados } from '../../lib/useDados';
import { Aviso, Carregando, formatarDataHora, Tabela } from '../../ui';

// Tipos de documento vindos da API (DocumentoEmitido.tipo) e seus nomes por extenso.
const ROTULOS_TIPO: Record<string, string> = {
  BOLETIM: 'Boletim',
  HISTORICO: 'Histórico escolar',
  DECLARACAO: 'Declaração de matrícula',
  FICHA: 'Ficha cadastral',
};

export function rotuloTipoDocumento(tipo: string): string {
  return ROTULOS_TIPO[tipo] ?? tipo;
}

interface DocumentoEmitidoDTO {
  id: number;
  codigo: string;
  tipo: string;
  descricao: string;
  alunoNome: string;
  emitidoEm: string;
  emitidoPor: string | { id?: number; nome?: string } | null;
}

function nomeDeQuemEmitiu(valor: DocumentoEmitidoDTO['emitidoPor']): string {
  if (typeof valor === 'string') return valor;
  if (valor && typeof valor.nome === 'string') return valor.nome;
  return '—';
}

function ListaEmitidos({ alunoId }: { alunoId: number }) {
  const { dados, carregando, erro } = useDados<DocumentoEmitidoDTO[]>(
    `/documentos/emitidos?alunoId=${alunoId}`,
  );

  if (carregando && !dados) return <Carregando />;
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;

  return (
    <Tabela<DocumentoEmitidoDTO>
      dados={dados}
      chave={(d) => d.id}
      vazio="Nenhum documento emitido para este aluno."
      colunas={[
        { titulo: 'Tipo', celula: (d) => rotuloTipoDocumento(d.tipo) },
        { titulo: 'Descrição', celula: (d) => d.descricao },
        { titulo: 'Código', celula: (d) => <span className="doc-codigo">{d.codigo}</span> },
        { titulo: 'Emitido em', celula: (d) => formatarDataHora(d.emitidoEm) },
        { titulo: 'Emitido por', celula: (d) => nomeDeQuemEmitiu(d.emitidoPor) },
      ]}
    />
  );
}

// Só para a gestão. A lista só é buscada quando o bloco é aberto.
export function DocumentosEmitidos(props: { alunoId: number }) {
  const [aberto, setAberto] = useState(false);

  return (
    <details className="doc-emitidos" onToggle={(e) => setAberto(e.currentTarget.open)}>
      <summary>Documentos emitidos</summary>
      {aberto && <ListaEmitidos alunoId={props.alunoId} />}
    </details>
  );
}
