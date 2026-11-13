import { useDados } from '../../lib/useDados';
import { Aviso, Carregando, Selo, Tabela, formatarData, formatarMoeda } from '../../ui';
import type { MensalidadeFamilia, StatusMensalidadeFamilia } from './tipos';
import './responsavel.css';

const SITUACAO_MENSALIDADE: Record<StatusMensalidadeFamilia, { rotulo: string; cor: 'azul' | 'verde' | 'vermelho' | 'cinza' }> = {
  ABERTA: { rotulo: 'Em aberto', cor: 'azul' },
  PAGA: { rotulo: 'Paga', cor: 'verde' },
  ATRASADA: { rotulo: 'Atrasada', cor: 'vermelho' },
  CANCELADA: { rotulo: 'Cancelada', cor: 'cinza' },
};

function SeloMensalidade({ status }: { status: StatusMensalidadeFamilia }) {
  const info = SITUACAO_MENSALIDADE[status] ?? { rotulo: status, cor: 'cinza' as const };
  return (
    <span className="sem-quebra">
      <Selo cor={info.cor}>{info.rotulo}</Selo>
    </span>
  );
}

// Mensalidades do aluno (somente leitura). Só é mostrada quando o responsável vê o financeiro.
export function Financeiro({ alunoId }: { alunoId: number }) {
  const { dados, carregando, erro } = useDados<MensalidadeFamilia[]>(`/familia/alunos/${alunoId}/mensalidades`);

  if (carregando && !dados) return <Carregando />;
  if (erro && !dados) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;

  const atrasadas = dados.filter((m) => m.status === 'ATRASADA');
  const totalAtrasado = atrasadas.reduce((soma, m) => soma + m.valorFinal, 0);

  return (
    <div className="resp-visao">
      {atrasadas.length > 0 ? (
        <div className="resp-destaque" role="status">
          <span className="resp-destaque-rotulo">
            Total em atraso ({atrasadas.length} {atrasadas.length === 1 ? 'mensalidade' : 'mensalidades'})
          </span>
          <span className="resp-destaque-valor">{formatarMoeda(totalAtrasado)}</span>
        </div>
      ) : (
        <Aviso tipo="sucesso">Nenhuma mensalidade em atraso.</Aviso>
      )}

      <Tabela
        dados={dados}
        chave={(m) => m.id}
        vazio="Nenhuma mensalidade encontrada."
        colunas={[
          { titulo: 'Competência', celula: (m: MensalidadeFamilia) => <span className="sem-quebra">{m.competencia}</span> },
          {
            titulo: 'Vencimento',
            celula: (m: MensalidadeFamilia) => <span className="sem-quebra">{formatarData(m.vencimento)}</span>,
          },
          {
            titulo: 'Valor final',
            alinhar: 'direita',
            celula: (m: MensalidadeFamilia) => <span className="sem-quebra resp-tabela-valor">{formatarMoeda(m.valorFinal)}</span>,
          },
          { titulo: 'Situação', celula: (m: MensalidadeFamilia) => <SeloMensalidade status={m.status} /> },
        ]}
      />
    </div>
  );
}
