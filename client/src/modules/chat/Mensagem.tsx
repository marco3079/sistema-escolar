import { Icone } from '../../ui/icones';
import { horaDaMensagem } from './comum';
import type { EstadoMensagem, MensagemTela } from './comum';

// Tiques de entrega e leitura: um tique (enviada), dois tiques (entregue ou lida).
export function Tique({ estado }: { estado: EstadoMensagem }) {
  const rotulo = estado === 'LIDA' ? 'Lida' : estado === 'ENTREGUE' ? 'Entregue' : 'Enviada';
  return (
    <span className={`chat-tique chat-tique-${estado.toLowerCase()}`} role="img" aria-label={rotulo}>
      <Icone nome={estado === 'ENVIADA' ? 'visto' : 'visto-duplo'} tamanho={15} />
    </span>
  );
}

interface PropsMensagem {
  m: MensagemTela;
  // Estado dos tiques (só nas minhas); null nas dos outros.
  estado: EstadoMensagem | null;
  // Em grupo, mostra o nome do autor em cima do balão.
  mostrarNome: boolean;
  destacada: boolean;
  menuAberto: boolean;
  aoAlternarMenu: () => void;
  aoResponder: () => void;
  aoApagar: () => void;
  aoReenviar: () => void;
  aoDescartar: () => void;
  aoIrParaCitacao: (id: number) => void;
  aoAmpliar: (src: string) => void;
  aoCarregarImagem: () => void;
}

// Balão de uma mensagem (ou linha de mensagem de sistema).
export function Mensagem({
  m,
  estado,
  mostrarNome,
  destacada,
  menuAberto,
  aoAlternarMenu,
  aoResponder,
  aoApagar,
  aoReenviar,
  aoDescartar,
  aoIrParaCitacao,
  aoAmpliar,
  aoCarregarImagem,
}: PropsMensagem) {
  if (m.sistema) {
    return (
      <div className="chat-msg-sistema" data-mensagem-id={m.id}>
        <span>{m.texto}</span>
      </div>
    );
  }

  const enviando = m.pendente?.status === 'enviando';
  const falhou = m.pendente?.status === 'falhou';
  const citacao = m.respostaA;

  return (
    <div
      className={[
        'chat-msg',
        m.minha ? 'chat-msg-minha' : 'chat-msg-outra',
        destacada ? 'chat-destaque' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-mensagem-id={m.id}
    >
      <div className={m.minha ? 'chat-balao chat-balao-minha' : 'chat-balao chat-balao-outra'}>
        {mostrarNome && !m.minha && <span className="chat-balao-autor">{m.autor.nome}</span>}

        {citacao && (
          <button
            type="button"
            className="chat-citacao"
            onClick={() => aoIrParaCitacao(citacao.id)}
            aria-label={`Ver mensagem citada de ${citacao.autorNome}`}
          >
            <span className="chat-citacao-autor">{citacao.autorNome}</span>
            <span className="chat-citacao-texto">
              {citacao.apagada
                ? 'Mensagem apagada'
                : citacao.texto || (citacao.temImagem ? 'Foto' : '')}
            </span>
          </button>
        )}

        {m.apagada ? (
          <p className="chat-texto-apagada">Mensagem apagada</p>
        ) : (
          <>
            {m.imagem && (
              <button
                type="button"
                className="chat-imagem-botao"
                aria-label="Ampliar imagem"
                onClick={() => aoAmpliar(m.imagem ?? '')}
              >
                <img
                  src={m.imagem}
                  alt="Imagem enviada na conversa"
                  className="chat-imagem"
                  onLoad={aoCarregarImagem}
                />
              </button>
            )}
            {m.texto && <p className="chat-texto">{m.texto}</p>}
          </>
        )}

        <div className="chat-balao-rodape">
          {enviando && <span className="chat-hora">Enviando...</span>}
          {!enviando && !falhou && <span className="chat-hora">{horaDaMensagem(m.criadaEm)}</span>}
          {m.minha && estado && !m.pendente && <Tique estado={estado} />}
        </div>

        {falhou && (
          <div className="chat-falha">
            <span className="chat-falha-texto">Não enviada.</span>
            <button type="button" className="chat-reenviar" onClick={aoReenviar}>
              Tentar de novo
            </button>
            <button type="button" className="chat-reenviar" onClick={aoDescartar}>
              Descartar
            </button>
          </div>
        )}
      </div>

      {!m.apagada && (!m.pendente || falhou) && (
        <div className="chat-acoes-msg">
          <button
            type="button"
            className="chat-acao-msg"
            aria-label="Opções da mensagem"
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            onClick={aoAlternarMenu}
          >
            <Icone nome="chevron-baixo" tamanho={16} />
          </button>
          {menuAberto && (
            <div className="chat-menu-msg" role="menu">
              {!falhou && (
                <button type="button" role="menuitem" onClick={aoResponder}>
                  <Icone nome="responder" tamanho={16} />
                  <span>Responder</span>
                </button>
              )}
              {(m.minha || falhou) && (
                <button
                  type="button"
                  role="menuitem"
                  className="chat-menu-perigo"
                  onClick={falhou ? aoDescartar : aoApagar}
                >
                  <Icone nome="lixeira" tamanho={16} />
                  <span>Apagar</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
