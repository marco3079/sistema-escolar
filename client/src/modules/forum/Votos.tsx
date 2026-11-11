import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Icone } from '../../ui/icones';
import { formatarPontos, mensagemErro } from './comum';
import type { Voto } from './comum';

// Botões de voto com a contagem. O clique no voto já dado envia 0 (remove o voto).
export function Votos({
  pontos,
  meuVoto,
  aoVotar,
  orientacao = 'coluna',
  desabilitado,
  className,
}: {
  pontos: number;
  meuVoto: Voto;
  aoVotar: (valor: Voto) => void;
  orientacao?: 'coluna' | 'linha';
  desabilitado?: boolean;
  className?: string;
}) {
  const classes = [
    'forum-votos',
    orientacao === 'linha' ? 'forum-votos-linha' : 'forum-votos-coluna',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <button
        type="button"
        className={meuVoto === 1 ? 'forum-voto forum-voto-cima ativo' : 'forum-voto forum-voto-cima'}
        aria-label="Votar a favor"
        aria-pressed={meuVoto === 1}
        disabled={desabilitado}
        onClick={() => aoVotar(meuVoto === 1 ? 0 : 1)}
      >
        <Icone nome="voto-cima" tamanho={20} />
      </button>
      <span className="forum-pontos" aria-live="polite">
        {formatarPontos(pontos)}
      </span>
      <button
        type="button"
        className={meuVoto === -1 ? 'forum-voto forum-voto-baixo ativo' : 'forum-voto forum-voto-baixo'}
        aria-label="Votar contra"
        aria-pressed={meuVoto === -1}
        disabled={desabilitado}
        onClick={() => aoVotar(meuVoto === -1 ? 0 : -1)}
      >
        <Icone nome="voto-baixo" tamanho={20} />
      </button>
    </div>
  );
}

// Estado do voto com atualização otimista: muda na hora e volta se a API falhar.
// Só a resposta do clique mais recente vale (cliques rápidos não se atropelam).
export function useVotacao(caminho: string, pontosIniciais: number, votoInicial: Voto) {
  const [estado, setEstado] = useState<{ pontos: number; meuVoto: Voto }>({
    pontos: pontosIniciais,
    meuVoto: votoInicial,
  });
  const [erro, setErro] = useState<string | null>(null);
  const estadoRef = useRef(estado);
  const sequencia = useRef(0);

  function aplicar(novo: { pontos: number; meuVoto: Voto }) {
    estadoRef.current = novo;
    setEstado(novo);
  }

  // Quando a página ou a lista recarrega com outros números, o estado acompanha.
  useEffect(() => {
    aplicar({ pontos: pontosIniciais, meuVoto: votoInicial });
  }, [pontosIniciais, votoInicial]);

  async function votar(valor: Voto): Promise<void> {
    const anterior = estadoRef.current;
    const numero = ++sequencia.current;
    setErro(null);
    aplicar({ pontos: anterior.pontos + (valor - anterior.meuVoto), meuVoto: valor });
    try {
      const resposta = await api.post<{ pontos: number; meuVoto: Voto }>(caminho, { valor });
      if (numero === sequencia.current) {
        aplicar({ pontos: resposta.pontos, meuVoto: resposta.meuVoto });
      }
    } catch (e) {
      if (numero === sequencia.current) {
        aplicar(anterior);
        setErro(mensagemErro(e));
      }
    }
  }

  return { pontos: estado.pontos, meuVoto: estado.meuVoto, votar, erro };
}
