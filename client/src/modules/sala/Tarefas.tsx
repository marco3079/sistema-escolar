import { useState } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Carregando, MenuAcoes, Modal, Tabela, formatarDataHora } from '../../ui';
import type { PropsAba } from './comum';
import { FormularioTarefa } from './TarefaFormulario';
import { TarefaEntregas } from './TarefaEntregas';
import { TarefasAluno } from './TarefaAluno';
import { SeloAberta, TarefaDTO, formatarNota, formatarPrazo } from './TarefaTipos';
import './tarefas.css';

// Aba "Tarefas" da sala de aula: professor e gestão veem a lista e as entregas; o aluno vê os cartões.
export function AbaTarefas(props: PropsAba) {
  const { turmaId, papel, podeEditar } = props;
  const { dados, carregando, erro, recarregar } = useDados<TarefaDTO[]>(
    `/salas/${turmaId}/tarefas`,
  );

  const [abertaId, setAbertaId] = useState<number | null>(null);
  const [formulario, setFormulario] = useState<{ aberto: boolean; tarefa: TarefaDTO | null }>({
    aberto: false,
    tarefa: null,
  });
  const [excluir, setExcluir] = useState<TarefaDTO | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (carregando && dados === null) return <Carregando />;
  if (erro && dados === null) return <Aviso tipo="erro">{erro}</Aviso>;
  if (dados === null) return null;

  if (papel === 'ALUNO') {
    return <TarefasAluno tarefas={dados} aoMudar={recarregar} />;
  }

  const aberta = dados.find((t) => t.id === abertaId) ?? null;

  async function confirmarExclusao() {
    if (!excluir) return;
    setOcupado(true);
    setErroAcao(null);
    try {
      await api.del(`/tarefas/${excluir.id}`);
      if (abertaId === excluir.id) setAbertaId(null);
      setExcluir(null);
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setOcupado(false);
    }
  }

  if (aberta) {
    return (
      <div className="tarefa-professor">
        <button type="button" className="botao botao-texto tarefa-voltar" onClick={() => setAbertaId(null)}>
          ← Todas as tarefas
        </button>
        <header className="tarefa-detalhe-cabecalho">
          <h2>{aberta.titulo}</h2>
          <SeloAberta prazo={aberta.prazo} />
        </header>
        <p className="tarefa-ajuda">
          Prazo: {formatarPrazo(aberta.prazo)} · nota máxima {formatarNota(aberta.notaMaxima)}
          {aberta.aceitaAtraso ? ' · aceita entrega atrasada' : ''}
        </p>
        <p className="tarefa-texto">{aberta.enunciado || 'Sem enunciado.'}</p>
        <TarefaEntregas
          key={aberta.id}
          tarefa={aberta}
          podeEditar={podeEditar}
          aoMudar={recarregar}
        />
        <FormularioTarefa
          turmaId={turmaId}
          tarefa={formulario.tarefa}
          aberto={formulario.aberto}
          aoFechar={() => setFormulario({ aberto: false, tarefa: null })}
          aoSalvo={() => {
            setFormulario({ aberto: false, tarefa: null });
            recarregar();
          }}
        />
      </div>
    );
  }

  return (
    <div className="tarefa-professor">
      {podeEditar && (
        <div className="tarefa-topo">
          <Botao aoClicar={() => setFormulario({ aberto: true, tarefa: null })}>Nova tarefa</Botao>
        </div>
      )}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}

      <Tabela<TarefaDTO>
        colunas={[
          { titulo: 'Tarefa', celula: (t) => t.titulo },
          { titulo: 'Prazo', celula: (t) => formatarDataHora(t.prazo) },
          { titulo: 'Situação', celula: (t) => <SeloAberta prazo={t.prazo} /> },
          {
            titulo: 'Entregas',
            celula: (t) =>
              t.resumo
                ? `${t.resumo.entregues} de ${t.resumo.alunos} entregaram, ${t.resumo.corrigidas} corrigidas`
                : '—',
          },
          ...(podeEditar
            ? [
                {
                  titulo: 'Ações',
                  acoes: true,
                  celula: (t: TarefaDTO) => (
                    <MenuAcoes
                      rotulo={`Ações da tarefa ${t.titulo}`}
                      acoes={[
                        {
                          rotulo: 'Editar',
                          icone: 'lapis',
                          aoClicar: () => setFormulario({ aberto: true, tarefa: t }),
                        },
                        {
                          rotulo: 'Excluir',
                          icone: 'lixeira',
                          perigo: true,
                          aoClicar: () => setExcluir(t),
                        },
                      ]}
                    />
                  ),
                },
              ]
            : []),
        ]}
        dados={dados}
        chave={(t) => t.id}
        vazio="Nenhuma tarefa cadastrada."
        aoClicarLinha={(t) => setAbertaId(t.id)}
      />

      {podeEditar && (
        <FormularioTarefa
          turmaId={turmaId}
          tarefa={formulario.tarefa}
          aberto={formulario.aberto}
          aoFechar={() => setFormulario({ aberto: false, tarefa: null })}
          aoSalvo={() => {
            setFormulario({ aberto: false, tarefa: null });
            recarregar();
          }}
        />
      )}

      <Modal
        aberto={excluir !== null}
        titulo="Excluir tarefa"
        aoFechar={() => setExcluir(null)}
      >
        <p>
          Excluir “{excluir?.titulo}”? As entregas dos alunos e os arquivos anexados também serão
          apagados.
        </p>
        <div className="tarefa-acoes-formulario">
          <Botao variante="secundario" aoClicar={() => setExcluir(null)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" desabilitado={ocupado} aoClicar={confirmarExclusao}>
            {ocupado ? 'Excluindo...' : 'Excluir'}
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
