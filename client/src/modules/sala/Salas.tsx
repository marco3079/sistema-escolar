import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDados } from '../../lib/useDados';
import { Aviso, Campo, Carregando, Pagina, Selecao, Selo } from '../../ui';
import type { PeriodoLetivo } from '../academico/tipos';
import type { SalaResumo } from './comum';
import './sala.css';

function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

// Lista das turmas no portal (admin, professor ou aluno). Só a gestão filtra por período.
export function Salas({ base }: { base: string }) {
  const gestao = base === '/admin';
  const [periodoId, setPeriodoId] = useState('');
  const [busca, setBusca] = useState('');
  const periodos = useDados<PeriodoLetivo[]>(gestao ? '/periodos-letivos' : null);
  const query = gestao && periodoId ? `?periodoLetivoId=${periodoId}` : '';
  const { dados, carregando, erro } = useDados<SalaResumo[]>(`/salas${query}`);

  // Busca por código, disciplina ou professor, só no cliente.
  const termo = busca.trim().toLowerCase();
  const lista = dados ?? [];
  const filtradas = termo
    ? lista.filter((s) =>
        [s.codigo, s.disciplina.nome, s.disciplina.codigo, s.professor.nome].some((texto) =>
          texto.toLowerCase().includes(termo),
        ),
      )
    : lista;

  return (
    <Pagina titulo="Sala de aula">
      <div className="barra-ferramentas">
        <div className="filtros">
          {gestao && (
            <Selecao
              rotulo="Período letivo"
              valor={periodoId}
              aoMudar={setPeriodoId}
              opcoes={(periodos.dados ?? []).map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
              vazio="Todos os períodos"
            />
          )}
          <Campo rotulo="Buscar por código, disciplina ou professor" valor={busca} aoMudar={setBusca} />
        </div>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {periodos.erro && gestao && <Aviso tipo="erro">{periodos.erro}</Aviso>}
      {carregando ? (
        <Carregando />
      ) : filtradas.length === 0 ? (
        <p className="tabela-vazia">Nenhuma turma encontrada.</p>
      ) : (
        <ul className="sala-cartoes">
          {filtradas.map((s) => (
            <li key={s.id}>
              <Link className="sala-cartao" to={`${base}/sala/${s.id}`}>
                <span className="sala-codigo">{s.codigo}</span>
                <strong className="sala-cartao-titulo">{s.disciplina.nome}</strong>
                <span className="sala-cartao-linha">
                  {s.disciplina.codigo} · {s.periodoLetivo.nome}
                </span>
                <span className="sala-cartao-linha">Professor: {s.professor.nome}</span>
                {s.papel === 'ALUNO' && (
                  <span className="sala-selos">
                    {s.pendencias.tarefas === 0 && s.pendencias.provas === 0 ? (
                      <Selo cor="verde">Em dia</Selo>
                    ) : (
                      <>
                        {s.pendencias.tarefas > 0 && (
                          <Selo cor="amarelo">
                            {contagem(s.pendencias.tarefas, 'tarefa', 'tarefas')}
                          </Selo>
                        )}
                        {s.pendencias.provas > 0 && (
                          <Selo cor="vermelho">{contagem(s.pendencias.provas, 'prova', 'provas')}</Selo>
                        )}
                      </>
                    )}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}
