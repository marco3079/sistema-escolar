import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Aviso, Botao, Campo } from '../../ui';
import { CapaLivro } from './CapaLivro';

const LIMITE_DATA_URL = 190_000;

// Tentativas de reduzir a imagem, da melhor para a menor
const TENTATIVAS: { altura: number; qualidade: number }[] = [
  { altura: 360, qualidade: 0.82 },
  { altura: 360, qualidade: 0.7 },
  { altura: 360, qualidade: 0.55 },
  { altura: 240, qualidade: 0.55 },
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

function desenhar(img: HTMLImageElement, altura: number, qualidade: number): string {
  const escala = Math.min(1, altura / img.naturalHeight);
  const largura = Math.max(1, Math.round(img.naturalWidth * escala));
  const alturaFinal = Math.max(1, Math.round(img.naturalHeight * escala));
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = alturaFinal;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível processar a imagem.');
  }
  // Fundo branco: imagens com transparência continuam legíveis em JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, largura, alturaFinal);
  ctx.drawImage(img, 0, 0, largura, alturaFinal);
  return canvas.toDataURL('image/jpeg', qualidade);
}

// Reduz a imagem até caber no limite; devolve null se nada couber
async function reduzirImagem(arquivo: File): Promise<string | null> {
  const img = await carregarImagem(arquivo);
  for (const t of TENTATIVAS) {
    const dataUrl = desenhar(img, t.altura, t.qualidade);
    if (dataUrl.length <= LIMITE_DATA_URL) {
      return dataUrl;
    }
  }
  return null;
}

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

export function CampoCapa({
  valor,
  aoMudar,
  livro,
}: {
  valor: string | null;
  aoMudar: (valor: string | null) => void;
  livro?: { titulo: string; categoria?: string | null };
}) {
  const [endereco, setEndereco] = useState(
    valor && !valor.startsWith('data:') ? valor : ''
  );
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enderecoInvalido =
    endereco.trim() !== '' &&
    !endereco.trim().startsWith('http://') &&
    !endereco.trim().startsWith('https://');

  async function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    if (!arquivo.type.startsWith('image/')) {
      setErro('Escolha um arquivo de imagem (PNG, JPEG ou WebP).');
      return;
    }
    setProcessando(true);
    try {
      const dataUrl = await reduzirImagem(arquivo);
      if (dataUrl === null) {
        setErro('Imagem grande demais.');
      } else {
        setEndereco('');
        aoMudar(dataUrl);
      }
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setProcessando(false);
    }
  }

  function aoMudarEndereco(texto: string) {
    setEndereco(texto);
    setErro(null);
    const limpo = texto.trim();
    if (limpo === '') {
      aoMudar(null);
    } else if (limpo.startsWith('http://') || limpo.startsWith('https://')) {
      aoMudar(limpo);
    }
  }

  function remover() {
    setEndereco('');
    setErro(null);
    aoMudar(null);
  }

  return (
    <div className="biblioteca-campo-capa">
      <span className="campo-rotulo">Capa</span>
      <div className="biblioteca-campo-capa-corpo">
        <CapaLivro
          livro={{
            titulo: livro?.titulo ?? '',
            categoria: livro?.categoria ?? null,
            capa: valor,
          }}
          tamanho="media"
        />
        <div className="biblioteca-campo-capa-acoes">
          <label
            className={`botao botao-secundario biblioteca-arquivo-botao${
              processando ? ' biblioteca-arquivo-desabilitado' : ''
            }`}
          >
            {processando ? 'Preparando imagem...' : 'Enviar imagem'}
            <input
              className="biblioteca-arquivo-entrada"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={processando}
              onChange={aoEscolherArquivo}
            />
          </label>
          <Campo
            rotulo="Ou cole um endereço"
            valor={endereco}
            aoMudar={aoMudarEndereco}
          />
          {enderecoInvalido && (
            <Aviso tipo="info">O endereço deve começar com http:// ou https://.</Aviso>
          )}
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div>
            <Botao variante="texto" desabilitado={!valor} aoClicar={remover}>
              Remover capa
            </Botao>
          </div>
        </div>
      </div>
    </div>
  );
}
