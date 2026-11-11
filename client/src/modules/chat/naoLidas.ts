import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

// Intervalo da consulta de não lidas usada pelo botão do chat no cabeçalho e na barra inferior.
const INTERVALO_NAO_LIDAS_MS = 10000;

// Quantidade de mensagens não lidas nas conversas da pessoa (GET /chat/nao-lidas).
// Consulta a cada 10 s enquanto `ativo` for verdadeiro; pausa com a aba oculta e falha em silêncio.
export function useChatNaoLidas(ativo: boolean): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    let id: number | undefined;

    async function consultar(): Promise<void> {
      if (cancelado || document.visibilityState === 'hidden') return;
      try {
        const resposta = await api.get<{ total: number }>('/chat/nao-lidas');
        if (!cancelado) setTotal(resposta.total);
      } catch {
        // Falha silenciosa: mantém o último valor conhecido.
      }
    }

    function iniciar(): void {
      if (id !== undefined) return;
      id = window.setInterval(consultar, INTERVALO_NAO_LIDAS_MS);
    }

    function parar(): void {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    }

    function aoMudarVisibilidade(): void {
      if (document.visibilityState === 'hidden') {
        parar();
      } else {
        void consultar();
        iniciar();
      }
    }

    void consultar();
    if (document.visibilityState !== 'hidden') iniciar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    return () => {
      cancelado = true;
      parar();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [ativo]);

  // Quando o hook é desligado, o contador zera para não mostrar valor velho.
  return ativo ? total : 0;
}
