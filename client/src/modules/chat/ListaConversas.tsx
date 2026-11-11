import { Avatar, Aviso, Botao, Carregando } from '../../ui';
import { Icone } from '../../ui/icones';
import { Tique } from './Mensagem';
import { horaDaLista, previaDaUltima, primeiroNome } from './comum';
import type { ConversaChat } from './comum';

interface PropsLista {
  conversas: ConversaChat[];
  abertaId: number | null;
  carregando: boolean;
  erro: string | null;
  busca: string;
  aoBuscar: (valor: string) => void;
  aoAbrir: (id: number) => void;
  aoNova: () => void;
}

// Texto de "digitando" na lista: em grupo, com o primeiro nome de quem digita.
function textoDigitando(conversa: ConversaChat): string {
  if (conversa.tipo === 'GRUPO' && conversa.digitando.length > 0) {
    return `${primeiroNome(conversa.digitando[0])} digitando...`;
  }
  return 'digitando...';
}

function PreviaUltima({ conversa }: { conversa: ConversaChat }) {
  const ultima = conversa.ultima;
  if (!ultima) return <span className="chat-item-previa-texto">Sem mensagens</span>;

  const apagada = ultima.apagada;
  const prefixoAutor =
    conversa.tipo === 'GRUPO' && !ultima.minha && !apagada ? `${primeiroNome(ultima.autorNome)}: ` : '';
  const texto = previaDaUltima(ultima);

  return (
    <span className={apagada ? 'chat-item-previa-texto chat-italico' : 'chat-item-previa-texto'}>
      {ultima.minha && ultima.estado && !apagada && <Tique estado={ultima.estado} />}
      {prefixoAutor}
      {texto}
    </span>
  );
}

function ItemConversa({
  conversa,
  ativa,
  aoAbrir,
}: {
  conversa: ConversaChat;
  ativa: boolean;
  aoAbrir: (id: number) => void;
}) {
  const digitando = conversa.digitando.length > 0;
  const online = conversa.tipo === 'INDIVIDUAL' && conversa.outro?.online === true;

  return (
    <li>
      <button
        type="button"
        className={ativa ? 'chat-item chat-item-ativo' : 'chat-item'}
        onClick={() => aoAbrir(conversa.id)}
        aria-current={ativa ? 'true' : undefined}
      >
        <span className="chat-avatar">
          <Avatar nome={conversa.nome} foto={conversa.foto} tamanho={46} />
          {online && <span className="chat-bolinha-online" aria-label="online" role="img" />}
        </span>
        <span className="chat-item-corpo">
          <span className="chat-item-linha">
            <span className="chat-item-nome">{conversa.nome}</span>
            {conversa.ultima && (
              <span className="chat-item-hora">{horaDaLista(conversa.ultima.criadaEm)}</span>
            )}
          </span>
          <span className="chat-item-linha">
            {digitando ? (
              <span className="chat-item-previa chat-digitando">{textoDigitando(conversa)}</span>
            ) : (
              <span className="chat-item-previa">
                <PreviaUltima conversa={conversa} />
              </span>
            )}
            {conversa.naoLidas > 0 && (
              <span
                className="chat-contador"
                aria-label={`${conversa.naoLidas} mensagens não lidas`}
              >
                {conversa.naoLidas > 99 ? '99+' : conversa.naoLidas}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

// Coluna da esquerda (ou a tela inteira no celular, enquanto nenhuma conversa está aberta).
export function ListaConversas({
  conversas,
  abertaId,
  carregando,
  erro,
  busca,
  aoBuscar,
  aoAbrir,
  aoNova,
}: PropsLista) {
  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? conversas.filter((c) => c.nome.toLowerCase().includes(termo))
    : conversas;

  return (
    <section className="chat-lista" aria-label="Conversas">
      <header className="chat-lista-topo">
        <h2 className="chat-lista-titulo">Conversas</h2>
        <button
          type="button"
          className="chat-botao-redondo"
          aria-label="Nova conversa"
          title="Nova conversa"
          onClick={aoNova}
        >
          <Icone nome="mais-circulo" tamanho={22} />
        </button>
      </header>

      <div className="chat-busca">
        <Icone nome="busca" tamanho={18} className="chat-busca-icone" />
        <input
          type="search"
          className="chat-busca-campo"
          placeholder="Buscar conversa"
          aria-label="Buscar conversa"
          value={busca}
          onChange={(e) => aoBuscar(e.target.value)}
        />
      </div>

      {erro && conversas.length === 0 && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando && conversas.length === 0 && !erro && <Carregando />}

      {!carregando && !erro && conversas.length === 0 && (
        <div className="chat-vazio">
          <span className="chat-vazio-icone" aria-hidden="true">
            <Icone nome="chat" tamanho={44} />
          </span>
          <p className="chat-vazio-titulo">Comece uma conversa</p>
          <p className="chat-vazio-texto">Fale com qualquer pessoa do sistema ou crie um grupo.</p>
          <Botao aoClicar={aoNova}>Nova conversa</Botao>
        </div>
      )}

      {conversas.length > 0 && filtradas.length === 0 && (
        <p className="chat-vazio-texto">Nenhuma conversa encontrada.</p>
      )}

      {filtradas.length > 0 && (
        <ul className="chat-lista-itens">
          {filtradas.map((c) => (
            <ItemConversa key={c.id} conversa={c} ativa={c.id === abertaId} aoAbrir={aoAbrir} />
          ))}
        </ul>
      )}
    </section>
  );
}
