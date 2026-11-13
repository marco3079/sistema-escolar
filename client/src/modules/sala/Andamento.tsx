import { useState } from 'react';
import { useDados } from '../../lib/useDados';
import { Aviso, Carregando, formatarData, Pagina, Selecao, Tabela } from '../../ui';
import { Icone } from '../../ui/icones';
import type { ColunaTabela } from '../../ui';
import type { PeriodoLetivo } from '../academico/tipos';
import './sala.css';

// Uma linha por turma, como vem de GET /salas/andamento (só gestão).
interface LinhaAndamento {
  turmaId: number;
  codigo: string;
  disciplina: { nome: string; codigo: string };
  professor: { nome: string };
  planejadas: number;
  ministradas: number;
  aulas: number;
  ultimaAula: string | null;
}

export function Andamento() {
  const [periodoId, setPeriodoId] = useState('');
  const periodos = useDados<PeriodoLetivo[]>('/periodos-letivos');
  const query = periodoId ? `?periodoLetivoId=${periodoId}` : '';
  const { dados, carregando, erro } = useDados<LinhaAndamento[]>(`/salas/andamento${query}`);
  const linhas = dados ?? [];

  // Média simples do progresso das turmas que têm temas planejados.
  const comPlano = linhas.filter((l) => l.planejadas > 0);
  const progressoMedio =
    comPlano.length > 0
      ? `${Math.round(
          (comPlano.reduce((soma, l) => soma + Math.min(l.ministradas, l.planejadas) / l.planejadas, 0) /
            comPlano.length) *
            100,
        )}%`
      : '—';

  const colunas: ColunaTabela<LinhaAndamento>[] = [
    {
      titulo: 'Turma',
      celula: (l) => (
        <span className="sala-celula-dupla">
          <span className="sala-codigo">{l.codigo}</span>
          <span className="sala-texto-suave">{l.disciplina.nome}</span>
        </span>
      ),
    },
    { titulo: 'Professor', celula: (l) => l.professor.nome },
    {
      titulo: 'Plano de aula',
      celula: (l) => {
        const pct = l.planejadas > 0 ? Math.min(100, Math.round((l.ministradas / l.planejadas) * 100)) : 0;
        return (
          <span className="sala-progresso">
            <span
              className="sala-progresso-trilho"
              role="progressbar"
              aria-label={`Progresso de ${l.codigo}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <span className="sala-progresso-preench" style={{ width: `${pct}%` }} />
            </span>
            <span className="sala-progresso-texto">
              {l.ministradas} de {l.planejadas}
            </span>
          </span>
        );
      },
    },
    { titulo: 'Aulas registradas', alinhar: 'direita', celula: (l) => l.aulas },
    {
      titulo: 'Última aula',
      celula: (l) => (l.ultimaAula ? formatarData(l.ultimaAula) : '—'),
    },
  ];

  return (
    <Pagina titulo="Andamento das aulas">
      <div className="barra-ferramentas">
        <div className="filtros">
          <Selecao
            rotulo="Período letivo"
            valor={periodoId}
            aoMudar={setPeriodoId}
            opcoes={(periodos.dados ?? []).map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
            vazio="Todos os períodos"
          />
        </div>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {periodos.erro && <Aviso tipo="erro">{periodos.erro}</Aviso>}
      {carregando ? (
        <Carregando />
      ) : (
        <>
          <div className="resumo">
            <div className="resumo-item">
              <span className="resumo-icone resumo-icone-azul">
                <Icone nome="turmas" tamanho={22} />
              </span>
              <div>
                <span className="resumo-valor">{linhas.length}</span>
                <span className="resumo-rotulo">Turmas</span>
              </div>
            </div>
            <div className="resumo-item">
              <span className="resumo-icone resumo-icone-laranja">
                <Icone nome="grafico" tamanho={22} />
              </span>
              <div>
                <span className="resumo-valor">{progressoMedio}</span>
                <span className="resumo-rotulo">Progresso médio do plano</span>
              </div>
            </div>
          </div>
          <Tabela
            exportar="andamento"
            colunas={colunas}
            dados={linhas}
            chave={(l) => l.turmaId}
            vazio="Nenhuma turma encontrada."
          />
        </>
      )}
    </Pagina>
  );
}
