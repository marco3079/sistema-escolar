import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { rotuloNivel } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Cartao, Carregando, Grade, Pagina, Selecao, Selo, formatarData } from '../../ui';
import { SeloStatus } from './MatriculaOnline';
import type { MeuPedidoDTO, OpcaoRematriculaDTO, SolicitacaoResumoDTO } from './tipos';
import { nomeDoCurso, ROTULO_STATUS_MATRICULA } from './tipos';
import './solicitacoes.css';

// Rematrícula para o aluno ou para o responsável: pedir a renovação e acompanhar os pedidos.

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

function corDaMatricula(status: string): 'verde' | 'amarelo' | 'cinza' {
  if (status === 'ATIVA') return 'verde';
  if (status === 'TRANCADA') return 'amarelo';
  return 'cinza';
}

// Um cartão por matrícula: dados, o pedido em andamento ou o formulário de pedido.
function CartaoRematricula({ opcao, aoPedir }: { opcao: OpcaoRematriculaDTO; aoPedir(): void }) {
  const [periodoId, setPeriodoId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const nivel = typeof opcao.curso === 'string' ? '' : rotuloNivel(opcao.curso.nivel);
  const podePedir = opcao.pedidoAberto === null && opcao.periodos.length > 0;

  async function pedir(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);
    if (!periodoId) {
      setErro('Escolha o período da rematrícula.');
      return;
    }
    setEnviando(true);
    try {
      const pedido = await api.post<SolicitacaoResumoDTO>('/rematricula', {
        matriculaId: opcao.matriculaId,
        periodoLetivoId: Number(periodoId),
        observacao: observacao.trim() || undefined,
      });
      setSucesso(`Pedido enviado. Protocolo ${pedido.protocolo}.`);
      setObservacao('');
      aoPedir();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Cartao titulo={opcao.alunoNome}>
      <dl className="solic-dados">
        <div>
          <dt>Curso</dt>
          <dd>{nomeDoCurso(opcao.curso)}{nivel ? ` · ${nivel}` : ''}</dd>
        </div>
        <div>
          <dt>Série atual</dt>
          <dd>{opcao.serieAtual}</dd>
        </div>
        <div>
          <dt>Matrícula</dt>
          <dd>
            <Selo cor={corDaMatricula(opcao.status)}>{ROTULO_STATUS_MATRICULA[opcao.status] ?? opcao.status}</Selo>
          </dd>
        </div>
      </dl>

      {opcao.pedidoAberto && (
        <div className="solic-pedido-aberto">
          <p className="solic-ajuda">Pedido em andamento: protocolo {opcao.pedidoAberto.protocolo}.</p>
          <SeloStatus status={opcao.pedidoAberto.status} />
        </div>
      )}

      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}

      {podePedir && (
        <form className="solic-form" onSubmit={(e) => void pedir(e)} noValidate>
          <Selecao
            rotulo="Período"
            valor={periodoId}
            aoMudar={setPeriodoId}
            obrigatorio
            vazio="Escolha o período"
            opcoes={opcao.periodos.map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
          />
          <AreaTexto rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} linhas={2} />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="entrada-botao">
            <Botao tipo="submit" desabilitado={enviando}>
              {enviando ? 'Enviando...' : 'Pedir rematrícula'}
            </Botao>
          </div>
        </form>
      )}

      {!podePedir && !opcao.pedidoAberto && (
        <p className="solic-ajuda">Não há período aberto para rematrícula no momento.</p>
      )}
      {erro && !podePedir && <Aviso tipo="erro">{erro}</Aviso>}
    </Cartao>
  );
}

export function Rematricula() {
  const opcoes = useDados<OpcaoRematriculaDTO[]>('/rematricula/opcoes');
  const pedidos = useDados<MeuPedidoDTO[]>('/rematricula/minhas');

  function atualizarTudo(): void {
    opcoes.recarregar();
    pedidos.recarregar();
  }

  return (
    <Pagina titulo="Rematrícula">
      <p className="solic-ajuda">
        Escolha o período e peça a rematrícula. A secretaria analisa o pedido e avisa por e-mail.
      </p>

      {opcoes.carregando && opcoes.dados === null && <Carregando />}
      {opcoes.erro && <Aviso tipo="erro">{opcoes.erro}</Aviso>}
      {opcoes.dados !== null && opcoes.dados.length === 0 && (
        <Cartao>
          <p>Não há matrícula ativa ou trancada para renovar.</p>
        </Cartao>
      )}
      {opcoes.dados !== null && opcoes.dados.length > 0 && (
        <Grade>
          {opcoes.dados.map((opcao) => (
            <CartaoRematricula key={opcao.matriculaId} opcao={opcao} aoPedir={atualizarTudo} />
          ))}
        </Grade>
      )}

      <Cartao titulo="Meus pedidos">
        {pedidos.carregando && pedidos.dados === null && <Carregando />}
        {pedidos.erro && <Aviso tipo="erro">{pedidos.erro}</Aviso>}
        {pedidos.dados !== null && pedidos.dados.length === 0 && (
          <p className="solic-ajuda">Você ainda não pediu rematrícula.</p>
        )}
        {pedidos.dados !== null && pedidos.dados.length > 0 && (
          <ul className="solic-lista">
            {pedidos.dados.map((pedido) => (
              <li key={pedido.id} className="solic-pedido">
                <div className="solic-linha">
                  <strong className="solic-valor-codigo">{pedido.protocolo}</strong>
                  <SeloStatus status={pedido.status} />
                </div>
                <p className="solic-ajuda">
                  {pedido.nome} · {nomeDoCurso(pedido.curso)} · pedido em {formatarData(pedido.criadoEm)}
                </p>
                {pedido.parecer && (
                  <div className="solic-parecer">
                    <span className="solic-rotulo-destaque">Parecer da secretaria</span>
                    <p className="solic-texto">{pedido.parecer}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </Pagina>
  );
}
