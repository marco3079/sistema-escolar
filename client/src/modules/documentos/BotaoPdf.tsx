import { useState } from 'react';
import { api } from '../../lib/api';
import { Icone } from '../../ui/icones';

const ERRO_PADRAO = 'Não foi possível gerar o documento.';

// Botão que baixa um PDF da API (GET autenticado). Enquanto gera fica desabilitado com "Gerando...".
export function BotaoPdf(props: {
  caminho: string;
  nomeArquivo: string;
  rotulo?: string;
  variante?: 'primario' | 'secundario';
}) {
  const { caminho, nomeArquivo, rotulo = 'Baixar PDF', variante = 'primario' } = props;
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar(): Promise<void> {
    setErro(null);
    setGerando(true);
    try {
      await api.baixar(caminho, nomeArquivo);
    } catch (e) {
      // Mensagem do servidor (campo `erro`) quando existe; respostas sem texto caem na mensagem padrão.
      const mensagem = e instanceof Error ? e.message : '';
      setErro(mensagem && mensagem !== 'Erro inesperado' ? mensagem : ERRO_PADRAO);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="doc-botao">
      <button
        type="button"
        className={`botao botao-${variante} doc-botao-acao`}
        disabled={gerando}
        aria-busy={gerando}
        onClick={() => void baixar()}
      >
        <Icone nome="pdf" tamanho={18} />
        <span>{gerando ? 'Gerando...' : rotulo}</span>
      </button>
      {erro && (
        <p className="doc-botao-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
