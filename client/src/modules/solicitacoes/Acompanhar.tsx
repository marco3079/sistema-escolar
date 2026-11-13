import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { tamanhoLegivel } from '../../lib/arquivos';
import { Aviso, Botao, Campo, formatarDataHora } from '../../ui';
import '../../layout/login.css';
import { EnvioDocumentos } from './EnvioDocumentos';
import { SeloStatus, SeloTipo, TelaPublica } from './MatriculaOnline';
import type { AcompanhamentoDTO } from './tipos';
import { nomeDoCurso } from './tipos';
import './solicitacoes.css';

// Acompanhamento público do pedido: protocolo e chave vão no corpo do POST, nunca na URL nem no armazenamento.

interface Consulta {
  protocolo: string;
  chave: string;
  dados: AcompanhamentoDTO;
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

export function Acompanhar() {
  const [protocolo, setProtocolo] = useState('');
  const [chave, setChave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<Consulta | null>(null);

  async function consultar(protocoloPedido: string, chavePedido: string): Promise<void> {
    setErro(null);
    setEnviando(true);
    try {
      const dados = await api.post<AcompanhamentoDTO>('/matricula-online/acompanhar', {
        protocolo: protocoloPedido,
        chave: chavePedido,
      });
      setConsulta({ protocolo: protocoloPedido, chave: chavePedido, dados });
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const protocoloLimpo = protocolo.trim();
    const chaveLimpa = chave.trim();
    if (!protocoloLimpo || !chaveLimpa) {
      setErro('Informe o protocolo e a chave.');
      return;
    }
    void consultar(protocoloLimpo, chaveLimpa);
  }

  const dados = consulta?.dados ?? null;

  return (
    <TelaPublica
      titulo="Acompanhar pedido"
      apoio="Informe o protocolo e a chave de acompanhamento recebidos ao enviar o pedido de matrícula."
      rodape={
        <>
          <Link to="/matricula-online" className="solic-link">
            Fazer um pedido de matrícula
          </Link>
          <Link to="/login" className="solic-link">
            Voltar para o login
          </Link>
        </>
      }
    >
      <form className="solic-form" onSubmit={enviar} noValidate>
        <Campo rotulo="Protocolo" valor={protocolo} aoMudar={setProtocolo} obrigatorio />
        <Campo rotulo="Chave de acompanhamento" valor={chave} aoMudar={setChave} obrigatorio />
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="entrada-botao">
          <Botao tipo="submit" desabilitado={enviando}>
            {enviando ? 'Consultando...' : 'Consultar pedido'}
          </Botao>
        </div>
      </form>

      {dados && consulta && (
        <section className="solic-resultado" aria-live="polite" aria-label="Situação do pedido">
          <div className="solic-linha">
            <SeloStatus status={dados.status} />
            <SeloTipo tipo={dados.tipo} />
          </div>
          <dl className="solic-dados">
            <div>
              <dt>Protocolo</dt>
              <dd>{dados.protocolo}</dd>
            </div>
            <div>
              <dt>Aluno</dt>
              <dd>{dados.nome}</dd>
            </div>
            <div>
              <dt>Curso</dt>
              <dd>{nomeDoCurso(dados.curso)}</dd>
            </div>
            <div>
              <dt>Pedido em</dt>
              <dd>{formatarDataHora(dados.criadoEm)}</dd>
            </div>
          </dl>

          {dados.parecer && (
            <div className="solic-parecer">
              <h2 className="solic-subtitulo">Parecer da secretaria</h2>
              <p className="solic-texto">{dados.parecer}</p>
            </div>
          )}

          {dados.podeEnviarDocumentos ? (
            <EnvioDocumentos
              key={consulta.protocolo}
              protocolo={consulta.protocolo}
              chave={consulta.chave}
              enviados={dados.documentos}
              aoEnviar={() => void consultar(consulta.protocolo, consulta.chave)}
            />
          ) : (
            dados.documentos.length > 0 && (
              <div className="solic-documentos">
                <h2 className="solic-subtitulo">Documentos recebidos</h2>
                <ul className="solic-arquivos">
                  {dados.documentos.map((documento, indice) => (
                    <li key={`${documento.nome}-${indice}`} className="solic-arquivo">
                      <span className="solic-arquivo-nome">{documento.nome}</span>
                      <span className="solic-arquivo-tamanho">{tamanhoLegivel(documento.tamanho)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </section>
      )}
    </TelaPublica>
  );
}
