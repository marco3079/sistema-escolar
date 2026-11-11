import { useId } from 'react';

// Gráfico de linha em SVG feito à mão (sem biblioteca). As cores vêm das classes painel-grafico-*,
// que usam só as variáveis do contrato visual (atributos de apresentação não leem var(), por isso classes).

export interface PontoGrafico {
  rotulo: string;
  valor: number | null;
}

const LARGURA = 480;
const ALTURA = 240;
const X_ESQ = 44;
const X_DIR = 468;
const Y_TOPO = 16; // 100%
const Y_BASE = 196; // 0%
const Y_ROTULOS = 224;
const LIMITE_ROTULOS_TODOS = 6; // acima disso, só um rótulo sim e outro não (o último sempre aparece)

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function GraficoLinha({ pontos }: { pontos: PontoGrafico[] }) {
  // Id único por instância; os dois-pontos do useId são trocados para a referência url(#...) ficar válida.
  const id = 'painel-degrade-' + useId().replace(/:/g, '');
  const n = pontos.length;
  const mostrarTodosRotulos = n <= LIMITE_ROTULOS_TODOS;

  const xDe = (i: number): number =>
    n <= 1 ? (X_ESQ + X_DIR) / 2 : X_ESQ + (i * (X_DIR - X_ESQ)) / (n - 1);

  const yDe = (valor: number): number => {
    const limitado = Math.min(100, Math.max(0, valor));
    return Y_BASE - (limitado / 100) * (Y_BASE - Y_TOPO);
  };

  // Só os pontos com valor; buracos (null) são pulados e a linha segue para o próximo valor.
  const marcados = pontos.flatMap((p, i) =>
    p.valor === null ? [] : [{ x: xDe(i), y: yDe(p.valor), valor: p.valor, rotulo: p.rotulo }],
  );

  const caminho = marcados.map((m, k) => `${k === 0 ? 'M' : 'L'}${m.x} ${m.y}`).join(' ');
  const primeiro = marcados[0];
  const ultimo = marcados[marcados.length - 1];
  const caminhoArea =
    primeiro && ultimo ? `${caminho} L${ultimo.x} ${Y_BASE} L${primeiro.x} ${Y_BASE} Z` : '';

  let balao = null;
  if (ultimo) {
    const texto = formatarPercentual(ultimo.valor);
    const largura = Math.max(48, texto.length * 8 + 16);
    const altura = 24;
    // Centralizado sobre o ponto, mas sem sair do viewBox (perto da borda direita, encosta à direita).
    const esquerda = Math.min(Math.max(ultimo.x - largura / 2, 4), LARGURA - 4 - largura);
    // Acima do ponto; se não couber no topo (100%), fica abaixo.
    let topo = ultimo.y - 12 - altura;
    if (topo < 2) topo = ultimo.y + 12;
    balao = (
      <g>
        <rect className="painel-grafico-balao" x={esquerda} y={topo} width={largura} height={altura} rx={8} />
        <text
          className="painel-grafico-balao-texto"
          x={esquerda + largura / 2}
          y={topo + altura / 2}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {texto}
        </text>
      </g>
    );
  }

  const niveis = [0, 25, 50, 75, 100];

  return (
    <svg
      className="painel-grafico"
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Gráfico de desempenho"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="painel-grafico-degrade-topo" />
          <stop offset="1" className="painel-grafico-degrade-base" />
        </linearGradient>
      </defs>

      {niveis.map((nivel) => {
        const y = yDe(nivel);
        return (
          <g key={nivel}>
            <line className="painel-grafico-grade" x1={X_ESQ} x2={X_DIR} y1={y} y2={y} />
            <text className="painel-grafico-eixo" x={X_ESQ - 8} y={y + 4} textAnchor="end">
              {`${nivel}%`}
            </text>
          </g>
        );
      })}

      {pontos.map((p, i) =>
        // Com muitos meses, mostra um sim e outro não contando a partir do último (que sempre aparece).
        mostrarTodosRotulos || (n - 1 - i) % 2 === 0 ? (
          <text
            key={`${p.rotulo}-${i}`}
            className="painel-grafico-eixo"
            x={xDe(i)}
            y={Y_ROTULOS}
            textAnchor="middle"
          >
            {p.rotulo}
          </text>
        ) : null,
      )}

      {caminhoArea && <path className="painel-grafico-area" d={caminhoArea} fill={`url(#${id})`} />}
      {caminho && <path className="painel-grafico-linha" d={caminho} />}

      {marcados.map((m, k) => (
        <circle key={k} className="painel-grafico-ponto" cx={m.x} cy={m.y} r={5} strokeWidth={3}>
          <title>{`${m.rotulo}: ${formatarPercentual(m.valor)}`}</title>
        </circle>
      ))}

      {balao}
    </svg>
  );
}
