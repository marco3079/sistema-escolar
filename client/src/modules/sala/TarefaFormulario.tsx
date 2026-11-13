import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import type { ArquivoDTO } from '../../lib/arquivos';
import { useDados } from '../../lib/useDados';
import { AreaTexto, Aviso, Botao, Campo, Caixa, Modal, Selecao } from '../../ui';
import { CampoArquivos } from '../../ui/Arquivos';
import {
  ENUNCIADO_MAX,
  MAX_ARQUIVOS,
  NOTA_MAXIMA_MAX,
  NOTA_MAXIMA_MIN,
  TITULO_MAX,
  TITULO_MIN,
  AvaliacaoOpcao,
  TarefaDTO,
  deCampoDataHora,
  lerNumero,
  paraCampoDataHora,
} from './TarefaTipos';

// Modal de criação e edição de tarefa. Só o formulário fica montado enquanto o modal está aberto.
export function FormularioTarefa({
  turmaId,
  tarefa,
  aberto,
  aoFechar,
  aoSalvo,
}: {
  turmaId: number;
  tarefa: TarefaDTO | null; // null = nova tarefa
  aberto: boolean;
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  if (!aberto) return null;
  return (
    <Modal aberto titulo={tarefa ? 'Editar tarefa' : 'Nova tarefa'} aoFechar={aoFechar}>
      <Formulario turmaId={turmaId} tarefa={tarefa} aoFechar={aoFechar} aoSalvo={aoSalvo} />
    </Modal>
  );
}

function Formulario({
  turmaId,
  tarefa,
  aoFechar,
  aoSalvo,
}: {
  turmaId: number;
  tarefa: TarefaDTO | null;
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  const [titulo, setTitulo] = useState(tarefa?.titulo ?? '');
  const [enunciado, setEnunciado] = useState(tarefa?.enunciado ?? '');
  const [prazo, setPrazo] = useState(tarefa ? paraCampoDataHora(tarefa.prazo) : '');
  const [notaMaxima, setNotaMaxima] = useState(tarefa ? String(tarefa.notaMaxima) : '10');
  const [aceitaAtraso, setAceitaAtraso] = useState(tarefa?.aceitaAtraso ?? false);
  const [avaliacaoId, setAvaliacaoId] = useState(
    tarefa?.avaliacaoId !== null && tarefa?.avaliacaoId !== undefined ? String(tarefa.avaliacaoId) : '',
  );
  const [arquivos, setArquivos] = useState<ArquivoDTO[]>(tarefa?.arquivos ?? []);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Avaliações do diário: buscadas só quando o formulário está montado (aberto).
  const { dados: avaliacoes, carregando: carregandoAvaliacoes } = useDados<AvaliacaoOpcao[]>(
    `/salas/${turmaId}/avaliacoes`,
  );
  const opcoesAvaliacao = (avaliacoes ?? []).map((a) => ({
    valor: String(a.id),
    rotulo: `${a.nome} (vale ${a.notaMaxima})`,
  }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const tituloLimpo = titulo.trim();
    if (tituloLimpo.length < TITULO_MIN || tituloLimpo.length > TITULO_MAX) {
      setErro(`O título deve ter de ${TITULO_MIN} a ${TITULO_MAX} caracteres.`);
      return;
    }
    if (enunciado.length > ENUNCIADO_MAX) {
      setErro(`O enunciado pode ter até ${ENUNCIADO_MAX.toLocaleString('pt-BR')} caracteres.`);
      return;
    }
    const prazoIso = deCampoDataHora(prazo);
    if (!prazoIso) {
      setErro('Informe o prazo com data e hora.');
      return;
    }
    const nota = lerNumero(notaMaxima);
    if (Number.isNaN(nota) || nota < NOTA_MAXIMA_MIN || nota > NOTA_MAXIMA_MAX) {
      setErro(`A nota máxima deve ser de ${NOTA_MAXIMA_MIN} a ${NOTA_MAXIMA_MAX}.`);
      return;
    }

    const corpo = {
      titulo: tituloLimpo,
      enunciado,
      prazo: prazoIso,
      notaMaxima: nota,
      aceitaAtraso,
      avaliacaoId: avaliacaoId === '' ? null : Number(avaliacaoId),
      arquivoIds: arquivos.map((a) => a.id),
    };

    setEnviando(true);
    setErro(null);
    try {
      if (tarefa) {
        await api.put(`/tarefas/${tarefa.id}`, corpo);
      } else {
        await api.post(`/salas/${turmaId}/tarefas`, corpo);
      }
      aoSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
      setEnviando(false);
    }
  }

  return (
    <form className="tarefa-formulario" onSubmit={enviar}>
      <Campo rotulo="Título" obrigatorio valor={titulo} aoMudar={setTitulo} />
      <AreaTexto rotulo="Enunciado" valor={enunciado} aoMudar={setEnunciado} linhas={6} />
      <div className="tarefa-formulario-linha">
        <Campo rotulo="Prazo" obrigatorio tipo="datetime-local" valor={prazo} aoMudar={setPrazo} />
        <Campo rotulo="Nota máxima" obrigatorio tipo="number" valor={notaMaxima} aoMudar={setNotaMaxima} />
      </div>
      <Caixa rotulo="Aceitar entrega atrasada" marcado={aceitaAtraso} aoMudar={setAceitaAtraso} />
      <Selecao
        rotulo="Avaliação do diário"
        valor={avaliacaoId}
        aoMudar={setAvaliacaoId}
        vazio={carregandoAvaliacoes ? 'Carregando avaliações...' : 'Nenhuma (não lança nota)'}
        opcoes={opcoesAvaliacao}
      />
      <p className="tarefa-ajuda">
        Com avaliação, a nota da correção é convertida para a escala da avaliação.
      </p>
      <div className="tarefa-campo">
        <span className="campo-rotulo">Arquivos do enunciado</span>
        <CampoArquivos valor={arquivos} aoMudar={setArquivos} maximo={MAX_ARQUIVOS} desabilitado={enviando} />
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="tarefa-acoes-formulario">
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
        <Botao tipo="submit" desabilitado={enviando}>
          {enviando ? 'Salvando...' : 'Salvar tarefa'}
        </Botao>
      </div>
    </form>
  );
}
