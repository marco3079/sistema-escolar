import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

// QR code em SVG (correção de erro M). Fundo branco e módulos pretos fixos nos dois temas,
// para a câmera ler com contraste. Não usa HTML do texto: só desenha módulos.

// Margem de silêncio em módulos (padrão do QR).
const MARGEM_MODULOS = 4;

// Caminho SVG com um quadrado por módulo escuro, ou null se o texto não puder ser codificado.
function caminhoDoQr(texto: string): { caminho: string; total: number } | null {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const modulos = qr.getModuleCount();
    let caminho = '';
    for (let linha = 0; linha < modulos; linha += 1) {
      for (let coluna = 0; coluna < modulos; coluna += 1) {
        if (qr.isDark(linha, coluna)) {
          caminho += `M${coluna + MARGEM_MODULOS} ${linha + MARGEM_MODULOS}h1v1h-1z`;
        }
      }
    }
    return { caminho, total: modulos + 2 * MARGEM_MODULOS };
  } catch {
    return null;
  }
}

export function QrCode({ texto, tamanho = 280 }: { texto: string; tamanho?: number }) {
  const desenho = useMemo(() => caminhoDoQr(texto), [texto]);

  if (!desenho) {
    return <p role="alert">Não foi possível gerar o QR code.</p>;
  }

  return (
    <svg
      role="img"
      aria-label="QR code"
      viewBox={`0 0 ${desenho.total} ${desenho.total}`}
      width={tamanho}
      height={tamanho}
      shapeRendering="crispEdges"
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    >
      <rect width={desenho.total} height={desenho.total} fill="#ffffff" />
      <path d={desenho.caminho} fill="#000000" />
    </svg>
  );
}
