import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { AreaTexto, Aviso, Botao, Campo, Carregando, Tabela, formatarDataHora } from '../../ui';
import { ListaArquivos } from '../../ui/Arquivos';
import {
  COMENTARIO_MAX,
  EntregaAluno,
  EntregaDTO,
  SeloEntrega,
  TarefaDTO,
  formatarNota,
  lerNumero,
} from './TarefaTipos';

// Detalhe de uma tarefa para professor e gestão: tabela dos alunos e, ao clicar, a entrega com a correção.
export function TarefaEntregas({
  tarefa,
  podeEditar,
  aoMudar,
}: {
  tarefa: TarefaDTO;
  podeEditar: boolean;
  aoMudar: () => void; // recarrega a lista de tarefas (contagens)
}) {
  const { dados, carregando, erro, recarregar } = useDados<EntregaAluno[]>(
    `/tarefas/${tarefa.id}/entregas`,
  );
  const [selecionada, setSelecionada] = useState<number | null>(null);

  if (carregando && dados === null) return <Carregando />;
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (dados === null) return null;

  const escolhida = dados.find((r) => r.inscricaoId === selecionada) ?? null;

  function aoCorrigido() {
    recarregar();
    aoMudar();
  }

  return (
    <div className="tarefa-entregas">
      <Tabela<EntregaAluno>
        colunas={[
          { titulo: 'Aluno', celula: (r) => `${r.aluno.nome} (${r.aluno.ra})` },
          { titulo: 'Situação', celula: (r) => <SeloEntrega entrega={r.entrega} /> },
          {
            titulo: 'Entregue em',
            celula: (r) => (r.entrega ? formatarDataHora(r.entrega.entregueEm) : '—'),
          },
          {
            titulo: 'Atrasada',
            celula: (r) => (r.entrega ? (r.entrega.atrasada ? 'Sim' : 'Não') : '—'),
          },
          {
            titulo: 'Nota',
            alinhar: 'direita',
            celula: (r) =>
              r.entrega?.nota !== null && r.entrega?.nota !== undefined
                ? `${formatarNota(r.entrega.nota)} de ${formatarNota(tarefa.notaMaxima)}`
                : '—',
          },
        ]}
        dados={dados}
        chave={(r) => r.inscricaoId}
        vazio="Nenhum aluno nesta turma."
        aoClicarLinha={(r) => setSelecionada(r.inscricaoId)}
      />

      {escolhida && (
        <section className="tarefa-entrega-detalhe" aria-label={`Entrega de ${escolhida.aluno.nome}`}>
          <h3>{escolhida.aluno.nome}</h3>
          {escolhida.entrega ? (
            <>
              <p className="tarefa-texto">{escolhida.entrega.texto || 'Sem texto.'}</p>
              {escolhida.entrega.arquivos.length > 0 && (
                <ListaArquivos arquivos={escolhida.entrega.arquivos} />
              )}
              {podeEditar ? (
                <FormularioCorrecao
                  key={escolhida.entrega.id}
                  entrega={escolhida.entrega}
                  notaMaxima={tarefa.notaMaxima}
                  aoSalvo={aoCorrigido}
                />
              ) : (
                escolhida.entrega.corrigidaEm && (
                  <p className="tarefa-correcao-resumo">
                    Nota {formatarNota(escolhida.entrega.nota ?? 0)} de {formatarNota(tarefa.notaMaxima)}
                    {escolhida.entrega.comentario && (
                      <span className="tarefa-texto"> {escolhida.entrega.comentario}</span>
                    )}
                  </p>
                )
              )}
            </>
          ) : (
            <p className="tarefa-ajuda">Este aluno não entregou.</p>
          )}
        </section>
      )}
    </div>
  );
}

// Correção: nota (0 a notaMaxima) e comentário. PUT /entregas/:id/correcao.
function FormularioCorrecao({
  entrega,
  notaMaxima,
  aoSalvo,
}: {
  entrega: EntregaDTO;
  notaMaxima: number;
  aoSalvo: () => void;
}) {
  const [nota, setNota] = useState(entrega.nota !== null ? String(entrega.nota) : '');
  const [comentario, setComentario] = useState(entrega.comentario ?? '');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const valor = lerNumero(nota);
    if (Number.isNaN(valor) || valor < 0 || valor > notaMaxima) {
      setErro(`A nota deve ser de 0 a ${formatarNota(notaMaxima)}.`);
      return;
    }
    if (comentario.length > COMENTARIO_MAX) {
      setErro(`O comentário pode ter até ${COMENTARIO_MAX.toLocaleString('pt-BR')} caracteres.`);
      return;
    }
    setEnviando(true);
    setErro(null);
    setSalvo(false);
    try {
      await api.put(`/entregas/${entrega.id}/correcao`, { nota: valor, comentario });
      setSalvo(true);
      aoSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarefa-correcao" onSubmit={salvar}>
      <h4>Correção</h4>
      <Campo
        rotulo={`Nota (de 0 a ${formatarNota(notaMaxima)})`}
        obrigatorio
        tipo="number"
        valor={nota}
        aoMudar={setNota}
      />
      <AreaTexto rotulo="Comentário para o aluno" valor={comentario} aoMudar={setComentario} linhas={3} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {salvo && <Aviso tipo="sucesso">Correção salva.</Aviso>}
      <Botao tipo="submit" desabilitado={enviando}>
        {enviando ? 'Salvando...' : entrega.corrigidaEm ? 'Atualizar correção' : 'Salvar correção'}
      </Botao>
    </form>
  );
}
