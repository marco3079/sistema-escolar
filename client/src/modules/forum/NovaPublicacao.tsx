import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { AreaTexto, Aviso, Botao, Campo, Modal, Selecao } from '../../ui';
import { useBase, mensagemErro } from './comum';
import type { ComunidadeDTO, PublicacaoDTO } from './comum';

const LIMITE_IMAGEM = 190_000;
const LARGURA_MAXIMA = 1000;
const TITULO_MIN = 3;
const TITULO_MAX = 160;
const CORPO_MAX = 10000;

// Tentativas de reduzir a imagem, da melhor para a menor (sempre JPEG).
const TENTATIVAS: { largura: number; qualidade: number }[] = [
  { largura: LARGURA_MAXIMA, qualidade: 0.8 },
  { largura: LARGURA_MAXIMA, qualidade: 0.6 },
  { largura: 800, qualidade: 0.6 },
  { largura: 600, qualidade: 0.5 },
];

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

function desenhar(img: HTMLImageElement, largura: number, qualidade: number): string {
  const escala = Math.min(1, largura / img.naturalWidth);
  const larguraFinal = Math.max(1, Math.round(img.naturalWidth * escala));
  const alturaFinal = Math.max(1, Math.round(img.naturalHeight * escala));
  const canvas = document.createElement('canvas');
  canvas.width = larguraFinal;
  canvas.height = alturaFinal;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível processar a imagem.');
  }
  // Fundo branco: imagens com transparência continuam legíveis em JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, larguraFinal, alturaFinal);
  ctx.drawImage(img, 0, 0, larguraFinal, alturaFinal);
  return canvas.toDataURL('image/jpeg', qualidade);
}

// Reduz a imagem até caber no limite; devolve null se nada couber.
async function reduzirImagem(arquivo: File): Promise<string | null> {
  const img = await carregarImagem(arquivo);
  for (const t of TENTATIVAS) {
    const dataUrl = desenhar(img, t.largura, t.qualidade);
    if (dataUrl.length <= LIMITE_IMAGEM) return dataUrl;
  }
  return null;
}

// Criar ou editar publicação. Só monta o formulário quando aberto (o estado começa limpo a cada abertura).
export function NovaPublicacao({
  aberto,
  aoFechar,
  comunidades,
  comunidadeInicial,
  edicao,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  comunidades?: ComunidadeDTO[];
  comunidadeInicial?: string;
  edicao?: PublicacaoDTO | null;
  aoSalvar?: (publicacao: PublicacaoDTO) => void;
}) {
  if (!aberto) return null;
  return (
    <Modal aberto titulo={edicao ? 'Editar publicação' : 'Nova publicação'} aoFechar={aoFechar}>
      <FormularioPublicacao
        aoFechar={aoFechar}
        comunidades={comunidades ?? []}
        comunidadeInicial={comunidadeInicial ?? ''}
        edicao={edicao ?? null}
        aoSalvar={aoSalvar}
      />
    </Modal>
  );
}

function FormularioPublicacao({
  aoFechar,
  comunidades,
  comunidadeInicial,
  edicao,
  aoSalvar,
}: {
  aoFechar: () => void;
  comunidades: ComunidadeDTO[];
  comunidadeInicial: string;
  edicao: PublicacaoDTO | null;
  aoSalvar?: (publicacao: PublicacaoDTO) => void;
}) {
  const base = useBase();
  const navigate = useNavigate();
  const [comunidade, setComunidade] = useState(edicao ? edicao.comunidade.slug : comunidadeInicial);
  const [titulo, setTitulo] = useState(edicao?.titulo ?? '');
  const [corpo, setCorpo] = useState(edicao?.corpo ?? '');
  const [imagem, setImagem] = useState<string | null>(edicao?.imagem ?? null);
  const [processandoImagem, setProcessandoImagem] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolherImagem(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    if (!arquivo.type.startsWith('image/')) {
      setErro('Escolha um arquivo de imagem (PNG, JPEG ou WebP).');
      return;
    }
    setProcessandoImagem(true);
    try {
      const dataUrl = await reduzirImagem(arquivo);
      if (dataUrl === null) {
        setErro('Imagem grande demais.');
      } else {
        setImagem(dataUrl);
      }
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setProcessandoImagem(false);
    }
  }

  function validar(): string | null {
    if (!edicao && comunidade === '') return 'Escolha a comunidade.';
    const tituloLimpo = titulo.trim();
    if (tituloLimpo.length < TITULO_MIN || tituloLimpo.length > TITULO_MAX) {
      return `O título deve ter de ${TITULO_MIN} a ${TITULO_MAX} caracteres.`;
    }
    if (corpo.trim().length > CORPO_MAX) {
      return `O texto tem no máximo ${CORPO_MAX.toLocaleString('pt-BR')} caracteres.`;
    }
    return null;
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      if (edicao) {
        const atualizada = await api.put<PublicacaoDTO>(`/forum/publicacoes/${edicao.id}`, {
          titulo: titulo.trim(),
          corpo: corpo.trim(),
          imagem,
        });
        aoSalvar?.(atualizada);
        aoFechar();
      } else {
        const criada = await api.post<PublicacaoDTO>('/forum/publicacoes', {
          comunidade,
          titulo: titulo.trim(),
          corpo: corpo.trim(),
          imagem,
        });
        navigate(`${base}/forum/p/${criada.id}`);
      }
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  return (
    <form className="forum-formulario" onSubmit={enviar}>
      {edicao ? (
        <p className="forum-texto-suave">Comunidade: {edicao.comunidade.nome}</p>
      ) : (
        <Selecao
          rotulo="Comunidade"
          valor={comunidade}
          aoMudar={setComunidade}
          opcoes={comunidades.map((c) => ({ valor: c.slug, rotulo: c.nome }))}
          vazio="Escolha uma comunidade"
          obrigatorio
        />
      )}
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} obrigatorio />
      <AreaTexto rotulo="Texto (opcional)" valor={corpo} aoMudar={setCorpo} linhas={6} />

      <div className="forum-imagem-campo">
        <span className="campo-rotulo">Imagem (opcional)</span>
        {imagem && (
          <img className="forum-previa-imagem" src={imagem} alt="Prévia da imagem da publicação" />
        )}
        <div className="forum-imagem-acoes">
          <label
            className={`botao botao-secundario forum-arquivo${processandoImagem ? ' forum-arquivo-desabilitado' : ''}`}
          >
            {processandoImagem ? 'Preparando imagem...' : imagem ? 'Trocar imagem' : 'Enviar imagem'}
            <input
              className="forum-arquivo-entrada"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={processandoImagem}
              onChange={aoEscolherImagem}
            />
          </label>
          {imagem && (
            <Botao variante="texto" aoClicar={() => setImagem(null)}>
              Remover imagem
            </Botao>
          )}
        </div>
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="forum-formulario-acoes">
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
        <Botao tipo="submit" desabilitado={enviando || processandoImagem}>
          {enviando ? 'Enviando...' : edicao ? 'Salvar' : 'Publicar'}
        </Botao>
      </div>
    </form>
  );
}
