import { useState } from 'react';

export interface LivroCapa {
  titulo: string;
  categoria?: string | null;
  capa?: string | null;
}

type CorCapa = 'azul' | 'roxo' | 'verde' | 'laranja';
const CORES: CorCapa[] = ['azul', 'roxo', 'verde', 'laranja'];

// Hash simples e estável: o mesmo texto sempre cai na mesma cor
function codigoEstavel(texto: string): number {
  let h = 0;
  for (const c of texto) {
    h = (h * 31 + c.charCodeAt(0)) >>> 0;
  }
  return h;
}

// Até duas iniciais do título (primeira letra das duas primeiras palavras)
export function iniciaisDoTitulo(titulo: string): string {
  const palavras = titulo.trim().split(/\s+/).filter((p) => p !== '');
  const letras = palavras
    .slice(0, 2)
    .map((p) => Array.from(p)[0]?.toUpperCase() ?? '');
  return letras.join('') || '?';
}

export function CapaLivro({
  livro,
  tamanho,
}: {
  livro: LivroCapa;
  tamanho: 'mini' | 'media' | 'grande';
}) {
  // Guarda o endereço que falhou; se o livro trocar de capa, a imagem nova é tentada
  const [falhou, setFalhou] = useState<string | null>(null);

  const classeTamanho = `biblioteca-capa biblioteca-capa-${tamanho}`;

  if (livro.capa && livro.capa !== falhou) {
    return (
      <div className={classeTamanho}>
        <img
          className="biblioteca-capa-imagem"
          src={livro.capa}
          alt=""
          loading="lazy"
          onError={() => setFalhou(livro.capa ?? null)}
        />
      </div>
    );
  }

  const base = (livro.categoria ?? '').trim() || livro.titulo;
  const cor = CORES[codigoEstavel(base) % CORES.length];

  return (
    <div
      className={`${classeTamanho} biblioteca-capa-${cor}`}
      role="img"
      aria-label={`Capa de ${livro.titulo}`}
    >
      <span className="biblioteca-capa-lombada" aria-hidden="true" />
      <span className="biblioteca-capa-iniciais" aria-hidden="true">
        {iniciaisDoTitulo(livro.titulo)}
      </span>
      {tamanho !== 'mini' && (
        <span className="biblioteca-capa-titulo" aria-hidden="true">
          {livro.titulo}
        </span>
      )}
    </div>
  );
}
