import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import type { ArquivoDTO } from '../../lib/arquivos';
import { AreaTexto, Aviso, Botao, formatarDataHora } from '../../ui';
import { CampoArquivos, ListaArquivos } from '../../ui/Arquivos';
import {
  MAX_ARQUIVOS,
  SeloSituacao,
  TEXTO_ENTREGA_MAX,
  TarefaDTO,
  descreverPrazo,
  formatarNota,
  formatarPrazo,
  prazoPassou,
} from './TarefaTipos';

// Visão do aluno: cartões das tarefas e, ao abrir, o enunciado, os anexos e a entrega.
export function TarefasAluno({
  tarefas,
  aoMudar,
}: {
  tarefas: TarefaDTO[];
  aoMudar: () => void;
}) {
  const [abertaId, setAbertaId] = useState<number | null>(null);
  const aberta = tarefas.find((t) => t.id === abertaId) ?? null;

  if (aberta) {
    return (
      <div className="tarefa-aluno">
        <button type="button" className="botao botao-texto tarefa-voltar" onClick={() => setAbertaId(null)}>
          ← Todas as tarefas
        </button>
        <DetalheTarefaAluno key={aberta.id} tarefa={aberta} aoMudar={aoMudar} />
      </div>
    );
  }

  if (tarefas.length === 0) {
    return <p className="tabela-vazia">Nenhuma tarefa por enquanto.</p>;
  }

  return (
    <ul className="tarefa-cartoes" aria-label="Tarefas">
      {tarefas.map((t) => (
        <li key={t.id}>
          <button type="button" className="tarefa-cartao" onClick={() => setAbertaId(t.id)}>
            <span className="tarefa-cartao-topo">
              <span className="tarefa-cartao-titulo">{t.titulo}</span>
              {t.situacao && <SeloSituacao situacao={t.situacao} />}
            </span>
            <span className="tarefa-cartao-prazo">
              Prazo: {formatarPrazo(t.prazo)} · {descreverPrazo(t.prazo)}
            </span>
            {t.situacao === 'CORRIGIDA' && t.minhaEntrega && (
              <span className="tarefa-cartao-nota">
                Nota {formatarNota(t.minhaEntrega.nota ?? 0)} de {formatarNota(t.notaMaxima)}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function DetalheTarefaAluno({ tarefa, aoMudar }: { tarefa: TarefaDTO; aoMudar: () => void }) {
  const entrega = tarefa.minhaEntrega ?? null;
  const corrigida = tarefa.situacao === 'CORRIGIDA';
  // Prazo vencido e sem aceitar atraso: o servidor responde 409 a qualquer entrega ou reenvio.
  const prazoFechado = prazoPassou(tarefa.prazo) && !tarefa.aceitaAtraso;
  const travada = corrigida || tarefa.situacao === 'ENCERRADA' || prazoFechado;

  const [texto, setTexto] = useState(entrega?.texto ?? '');
  const [arquivos, setArquivos] = useState<ArquivoDTO[]>(entrega?.arquivos ?? []);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const textoLimpo = texto.trim();
    if (textoLimpo === '' && arquivos.length === 0) {
      setErro('Escreva o texto da entrega ou anexe pelo menos um arquivo.');
      return;
    }
    if (texto.length > TEXTO_ENTREGA_MAX) {
      setErro(`O texto pode ter até ${TEXTO_ENTREGA_MAX.toLocaleString('pt-BR')} caracteres.`);
      return;
    }
    setEnviando(true);
    setErro(null);
    setEnviada(false);
    try {
      await api.put(`/tarefas/${tarefa.id}/entrega`, {
        texto,
        arquivoIds: arquivos.map((a) => a.id),
      });
      setEnviada(true);
      aoMudar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className="tarefa-detalhe">
      <header className="tarefa-detalhe-cabecalho">
        <h2>{tarefa.titulo}</h2>
        {tarefa.situacao && <SeloSituacao situacao={tarefa.situacao} />}
      </header>
      <p className="tarefa-ajuda">
        Prazo: {formatarPrazo(tarefa.prazo)} · {descreverPrazo(tarefa.prazo)} · nota máxima{' '}
        {formatarNota(tarefa.notaMaxima)}
        {tarefa.aceitaAtraso ? ' · aceita entrega atrasada' : ''}
      </p>

      <h3 className="tarefa-subtitulo">Enunciado</h3>
      <p className="tarefa-texto">{tarefa.enunciado || 'Sem enunciado.'}</p>
      {tarefa.arquivos.length > 0 && <ListaArquivos arquivos={tarefa.arquivos} />}

      {corrigida && entrega && (
        <section className="tarefa-correcao-resumo" aria-label="Correção">
          <h3 className="tarefa-subtitulo">Correção</h3>
          <p>
            <strong>
              Nota {formatarNota(entrega.nota ?? 0)} de {formatarNota(tarefa.notaMaxima)}
            </strong>
          </p>
          {entrega.comentario && <p className="tarefa-texto">{entrega.comentario}</p>}
        </section>
      )}

      <h3 className="tarefa-subtitulo">Sua entrega</h3>
      {tarefa.situacao === 'ENCERRADA' && (
        <Aviso tipo="info">O prazo terminou e esta tarefa não aceita entrega atrasada.</Aviso>
      )}
      {prazoFechado && entrega && tarefa.situacao !== 'CORRIGIDA' && (
        <Aviso tipo="info">O prazo terminou; a entrega não pode mais ser alterada.</Aviso>
      )}
      {!travada && tarefa.aceitaAtraso && (
        <p className="tarefa-ajuda">Depois do prazo, a entrega fica marcada como atrasada.</p>
      )}
      {entrega && !travada && (
        <p className="tarefa-ajuda">
          Entregue em {formatarDataHora(entrega.entregueEm)}. Você pode reenviar até a correção.
        </p>
      )}

      {travada ? (
        entrega ? (
          <>
            <p className="tarefa-texto">{entrega.texto || 'Sem texto.'}</p>
            {entrega.arquivos.length > 0 && <ListaArquivos arquivos={entrega.arquivos} />}
          </>
        ) : null
      ) : (
        <form className="tarefa-formulario" onSubmit={enviar}>
          <AreaTexto rotulo="Texto da entrega" valor={texto} aoMudar={setTexto} linhas={6} />
          <div className="tarefa-campo">
            <span className="campo-rotulo">Arquivos da entrega</span>
            <CampoArquivos
              valor={arquivos}
              aoMudar={setArquivos}
              maximo={MAX_ARQUIVOS}
              desabilitado={enviando}
            />
          </div>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          {enviada && <Aviso tipo="sucesso">Entrega enviada.</Aviso>}
          <Botao tipo="submit" desabilitado={enviando}>
            {enviando ? 'Enviando...' : entrega ? 'Reenviar entrega' : 'Enviar entrega'}
          </Botao>
        </form>
      )}
    </article>
  );
}
