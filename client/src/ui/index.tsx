import { useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { baixarTexto, gerarCsv } from '../lib/csv';
import './estilo.css';
import { Icone } from './icones';

// ---------- Formatação ----------

function partesDaData(iso: string): { ano: number; mes: number; dia: number } | null {
  if (!iso) return null;

  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const meiaNoiteUtc = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(\.000)?Z$/.exec(iso);
  const casamento = soData ?? meiaNoiteUtc;
  if (casamento) {
    return {
      ano: Number(casamento[1]),
      mes: Number(casamento[2]),
      dia: Number(casamento[3]),
    };
  }

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { ano: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

export function paraInputData(iso: string): string {
  const p = partesDaData(iso);
  if (!p) return '';
  const ano = String(p.ano).padStart(4, '0');
  const mes = String(p.mes).padStart(2, '0');
  const dia = String(p.dia).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarData(iso: string): string {
  const p = partesDaData(iso);
  if (!p) return '';
  const ano = String(p.ano).padStart(4, '0');
  const mes = String(p.mes).padStart(2, '0');
  const dia = String(p.dia).padStart(2, '0');
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHora(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatarMoeda(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

// ---------- Estrutura de página ----------

export function Pagina({
  titulo,
  acoes,
  children,
}: {
  titulo: string;
  acoes?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="pagina">
      <header className="pagina-cabecalho">
        <h1>{titulo}</h1>
        {acoes && <div className="pagina-acoes">{acoes}</div>}
      </header>
      {children}
    </section>
  );
}

export function Cartao({ titulo, children }: { titulo?: string; children?: ReactNode }) {
  return (
    <section className="cartao">
      {titulo && <h2 className="cartao-titulo">{titulo}</h2>}
      {children}
    </section>
  );
}

export function Grade({ children }: { children?: ReactNode }) {
  return <div className="grade">{children}</div>;
}

// ---------- Botões e avisos ----------

export function Botao({
  variante = 'primario',
  tipo = 'button',
  desabilitado,
  aoClicar,
  children,
}: {
  variante?: 'primario' | 'secundario' | 'perigo' | 'texto';
  tipo?: 'button' | 'submit';
  desabilitado?: boolean;
  aoClicar?: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type={tipo}
      className={`botao botao-${variante}`}
      disabled={desabilitado}
      onClick={aoClicar}
    >
      {children}
    </button>
  );
}

export function Selo({
  cor = 'cinza',
  children,
}: {
  cor?: 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza';
  children?: ReactNode;
}) {
  return <span className={`selo selo-${cor}`}>{children}</span>;
}

export function Aviso({
  tipo = 'info',
  children,
}: {
  tipo?: 'erro' | 'sucesso' | 'info';
  children?: ReactNode;
}) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Carregando() {
  return (
    <div className="carregando" role="status" aria-live="polite">
      Carregando...
    </div>
  );
}

// ---------- Tabela (cartões no celular) ----------

export interface ColunaTabela<T> {
  titulo: string;
  celula: (item: T) => ReactNode;
  // Alinhamento do cabeçalho e das células. Sem valor, a coluna segue o padrão (esquerda).
  alinhar?: 'esquerda' | 'direita' | 'centro';
  // Coluna de ações (menu de três pontos): alinhada à direita, largura mínima, sem título visível.
  // O clique dentro dela não dispara aoClicarLinha. No cartão do celular fica no fim, sem rótulo.
  acoes?: boolean;
}

// Impede que o clique numa célula de ações chegue à linha (aoClicarLinha).
function naoPropagar(e: ReactMouseEvent) {
  e.stopPropagation();
}

function classeDaCelula<T>(c: ColunaTabela<T>): string | undefined {
  if (c.acoes) return 'tabela-coluna-acoes';
  if (c.alinhar) return `tabela-alinhar-${c.alinhar}`;
  return undefined;
}

// Data de hoje no formato aaaa-mm-dd (horário local), para o nome do arquivo exportado.
function hojeAaaaaMmDd(): string {
  const d = new Date();
  const ano = String(d.getFullYear()).padStart(4, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Texto de uma célula: espaços e quebras colapsados em um espaço só.
function textoDaCelula(celula: Element | undefined): string {
  return (celula?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function Tabela<T>({
  colunas,
  dados,
  chave,
  vazio,
  aoClicarLinha,
  exportar,
}: {
  colunas: ColunaTabela<T>[];
  dados: T[];
  chave: (item: T) => string | number;
  vazio?: string;
  aoClicarLinha?: (item: T) => void;
  // Nome do arquivo (sem extensão) do botão "Exportar" (CSV das linhas exibidas).
  exportar?: string;
}) {
  // Referência à tabela larga: o CSV é montado com o texto das células renderizadas.
  const larga = useRef<HTMLDivElement>(null);

  if (dados.length === 0) {
    return <p className="tabela-vazia">{vazio ?? 'Nenhum registro encontrado.'}</p>;
  }

  // No cartão, a coluna de ações vai para o fim e aparece sem rótulo.
  const colunasCartao = [...colunas.filter((c) => !c.acoes), ...colunas.filter((c) => c.acoes)];

  // Exportação: colunas sem ações, na ordem da tabela; cada linha é lida da tabela larga (sempre no DOM).
  function exportarCsv(): void {
    const corpo = larga.current;
    if (!corpo || !exportar) return;
    // Fica de fora a coluna de ações (marcada com `acoes` ou só intitulada "Ações").
    const ehAcoes = (c: ColunaTabela<T>) => c.acoes === true || c.titulo.trim().toLowerCase() === 'ações';
    const indices = colunas.map((c, i) => (ehAcoes(c) ? -1 : i)).filter((i) => i >= 0);
    const cabecalho = indices.map((i) => colunas[i].titulo);
    const linhas = Array.from(corpo.querySelectorAll('tbody tr')).map((tr) => {
      const celulas = Array.from(tr.children);
      // O travessão que as telas usam para "sem valor" vira célula vazia na planilha.
      return indices.map((i) => {
        const texto = textoDaCelula(celulas[i]);
        return texto === '—' ? '' : texto;
      });
    });
    baixarTexto(
      `${exportar}-${hojeAaaaaMmDd()}.csv`,
      gerarCsv(cabecalho, linhas),
      'text/csv;charset=utf-8',
    );
  }

  return (
    <>
      {exportar && (
        <div className="tabela-barra">
          <button type="button" className="botao botao-texto tabela-exportar" onClick={exportarCsv}>
            <Icone nome="documento" tamanho={18} />
            <span>Exportar</span>
          </button>
        </div>
      )}
      <div className="tabela-desktop" ref={larga}>
        <table className="tabela">
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c.titulo} scope="col" className={classeDaCelula(c)}>
                  {c.acoes ? <span className="tabela-oculto-visual">{c.titulo}</span> : c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map((item) => (
              <tr
                key={chave(item)}
                className={aoClicarLinha ? 'clicavel' : undefined}
                onClick={aoClicarLinha ? () => aoClicarLinha(item) : undefined}
              >
                {colunas.map((c) => (
                  <td
                    key={c.titulo}
                    className={classeDaCelula(c)}
                    onClick={c.acoes ? naoPropagar : undefined}
                  >
                    {c.celula(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="tabela-cartoes">
        {dados.map((item) => (
          <li
            key={chave(item)}
            className={aoClicarLinha ? 'tabela-cartao clicavel' : 'tabela-cartao'}
            onClick={aoClicarLinha ? () => aoClicarLinha(item) : undefined}
          >
            {colunasCartao.map((c) =>
              c.acoes ? (
                <div className="tabela-par tabela-par-acoes" key={c.titulo} onClick={naoPropagar}>
                  <span className="tabela-par-valor">{c.celula(item)}</span>
                </div>
              ) : (
                <div className="tabela-par" key={c.titulo}>
                  <span className="tabela-par-titulo">{c.titulo}</span>
                  <span className="tabela-par-valor">{c.celula(item)}</span>
                </div>
              ),
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------- Avatar ----------

// Iniciais: primeira letra do primeiro e do último nome.
function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

// Círculo com a foto do usuário ou, sem foto (ou se a imagem falhar), as iniciais do nome.
// Decorativo (aria-hidden): o nome deve aparecer em texto ao lado quando for preciso.
export function Avatar({
  nome,
  foto,
  tamanho = 40,
  className,
}: {
  nome: string;
  foto?: string | null;
  tamanho?: number;
  className?: string;
}) {
  // Guarda a foto que falhou: uma foto nova volta a tentar sem precisar de efeito.
  const [fotoFalhou, setFotoFalhou] = useState<string | null>(null);
  const mostrarFoto = Boolean(foto) && fotoFalhou !== foto;

  return (
    <span
      className={className ? `avatar ${className}` : 'avatar'}
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.36) }}
      aria-hidden="true"
    >
      {mostrarFoto ? (
        <img
          src={foto ?? undefined}
          alt=""
          loading="lazy"
          onError={() => setFotoFalhou(foto ?? null)}
        />
      ) : (
        iniciaisDoNome(nome)
      )}
    </span>
  );
}

// ---------- Campos de formulário ----------

export function Campo({
  rotulo,
  valor,
  aoMudar,
  tipo = 'text',
  obrigatorio,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  tipo?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'datetime-local';
  obrigatorio?: boolean;
}) {
  return (
    <label className="campo">
      <span className="campo-rotulo">
        {rotulo}
        {obrigatorio && ' *'}
      </span>
      <input
        className="campo-controle"
        type={tipo}
        value={valor}
        required={obrigatorio}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </label>
  );
}

export function AreaTexto({
  rotulo,
  valor,
  aoMudar,
  linhas = 4,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  linhas?: number;
}) {
  return (
    <label className="campo">
      <span className="campo-rotulo">{rotulo}</span>
      <textarea
        className="campo-controle"
        rows={linhas}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </label>
  );
}

export function Selecao({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  vazio,
  obrigatorio,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: { valor: string; rotulo: string }[];
  vazio?: string;
  obrigatorio?: boolean;
}) {
  return (
    <label className="campo">
      <span className="campo-rotulo">
        {rotulo}
        {obrigatorio && ' *'}
      </span>
      <select
        className="campo-controle"
        value={valor}
        required={obrigatorio}
        onChange={(e) => aoMudar(e.target.value)}
      >
        <option value="">{vazio ?? 'Selecione'}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Caixa({
  rotulo,
  marcado,
  aoMudar,
}: {
  rotulo: string;
  marcado: boolean;
  aoMudar: (marcado: boolean) => void;
}) {
  return (
    <label className="caixa">
      <input type="checkbox" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} />
      <span>{rotulo}</span>
    </label>
  );
}

// ---------- Modal e abas ----------

export function Modal({
  aberto,
  titulo,
  aoFechar,
  children,
}: {
  aberto: boolean;
  titulo: string;
  aoFechar: () => void;
  children?: ReactNode;
}) {
  if (!aberto) return null;
  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-cabecalho">
          <h2>{titulo}</h2>
          <button type="button" className="modal-fechar" aria-label="Fechar" onClick={aoFechar}>
            ×
          </button>
        </header>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}

export function Abas({
  abas,
  ativa,
  aoMudar,
}: {
  abas: { id: string; rotulo: string }[];
  ativa: string;
  aoMudar: (id: string) => void;
}) {
  return (
    <nav className="abas" role="tablist">
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          aria-selected={a.id === ativa}
          className={a.id === ativa ? 'aba aba-ativa' : 'aba'}
          onClick={() => aoMudar(a.id)}
        >
          {a.rotulo}
        </button>
      ))}
    </nav>
  );
}

// ---------- Menu de ações (reexportado para os outros módulos) ----------
// Não há importação circular: MenuAcoes importa só ui/icones, não este arquivo.

export { MenuAcoes } from '../modules/cadastros/MenuAcoes';
export type { AcaoMenu } from '../modules/cadastros/MenuAcoes';
