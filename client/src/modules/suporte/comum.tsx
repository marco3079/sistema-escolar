import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Aviso, Botao, Selo, formatarData } from '../../ui';
import { Icone } from '../../ui/icones';

// ---------- Tipos (formato do contrato "Suporte" em docs/plano/terceira-leva.md) ----------

export interface UsuarioResumo {
  id: number;
  nome: string;
  perfil: string;
  foto: string | null;
}

export type Categoria = 'TECNICO' | 'SECRETARIA' | 'FINANCEIRO' | 'ACADEMICO';
export type Prioridade = 'BAIXA' | 'NORMAL' | 'ALTA';
export type StatusChamado =
  | 'ABERTO'
  | 'EM_ATENDIMENTO'
  | 'AGUARDANDO_USUARIO'
  | 'RESOLVIDO'
  | 'FECHADO';

export interface ChamadoDTO {
  id: number;
  categoria: Categoria;
  assunto: string;
  prioridade: Prioridade;
  status: StatusChamado;
  turma: { id: number; codigo: string; disciplina: string } | null;
  autor: UsuarioResumo;
  responsavel: UsuarioResumo | null;
  avaliacao: number | null;
  avaliacaoComentario: string | null;
  criadoEm: string;
  atualizadoEm: string;
  ultimaMensagemEm: string;
  totalMensagens: number;
  naoLido: boolean;
  souEquipe: boolean;
  previa: string;
}

export interface MensagemDTO {
  id: number;
  texto: string;
  anexo: string | null;
  criadoEm: string;
  daEquipe: boolean;
  autor: UsuarioResumo;
}

// Resposta de GET /chamados/:id
export interface ChamadoDetalhe extends ChamadoDTO {
  mensagens: MensagemDTO[];
}

// ---------- Rótulos ----------

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  TECNICO: 'Técnico',
  SECRETARIA: 'Secretaria',
  FINANCEIRO: 'Financeiro',
  ACADEMICO: 'Acadêmico',
};

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
};

export const ROTULO_STATUS: Record<StatusChamado, string> = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_USUARIO: 'Aguardando você',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

export const CATEGORIAS: { valor: Categoria; rotulo: string }[] = [
  { valor: 'TECNICO', rotulo: 'Técnico' },
  { valor: 'SECRETARIA', rotulo: 'Secretaria' },
  { valor: 'FINANCEIRO', rotulo: 'Financeiro' },
  { valor: 'ACADEMICO', rotulo: 'Acadêmico' },
];

export const PRIORIDADES: { valor: Prioridade; rotulo: string }[] = [
  { valor: 'BAIXA', rotulo: 'Baixa' },
  { valor: 'NORMAL', rotulo: 'Normal' },
  { valor: 'ALTA', rotulo: 'Alta' },
];

// Texto do status conforme quem está olhando: "Aguardando você" para o autor,
// "Aguardando o usuário" para a equipe.
export function rotuloStatus(status: StatusChamado, souEquipe: boolean): string {
  if (status === 'AGUARDANDO_USUARIO' && souEquipe) return 'Aguardando o usuário';
  return ROTULO_STATUS[status];
}

// ---------- Selos ----------

export function SeloCategoria({ categoria }: { categoria: Categoria }) {
  return <Selo cor="cinza">{ROTULO_CATEGORIA[categoria]}</Selo>;
}

export function SeloPrioridade({ prioridade }: { prioridade: Prioridade }) {
  const cor = prioridade === 'ALTA' ? 'vermelho' : prioridade === 'NORMAL' ? 'azul' : 'cinza';
  return <Selo cor={cor}>{ROTULO_PRIORIDADE[prioridade]}</Selo>;
}

export function SeloStatus({
  status,
  souEquipe,
}: {
  status: StatusChamado;
  souEquipe: boolean;
}) {
  const texto = rotuloStatus(status, souEquipe);
  if (status === 'AGUARDANDO_USUARIO') {
    // Roxo não existe em Selo: usa a base de .selo com a classe do módulo.
    return <span className="selo suporte-selo-roxo">{texto}</span>;
  }
  const cor =
    status === 'ABERTO'
      ? 'azul'
      : status === 'EM_ATENDIMENTO'
        ? 'amarelo'
        : status === 'RESOLVIDO'
          ? 'verde'
          : 'cinza';
  return <Selo cor={cor}>{texto}</Selo>;
}

// ---------- Datas ----------

// "agora", "há 5 min", "há 3 h", "há 2 dias" e, depois de uma semana, a data.
export function tempoRelativo(iso: string, agora: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const minutos = Math.floor((agora - t) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return formatarData(iso);
}

// Hora do dia para a bolha da mensagem, no formato 24 h.
export function formatarHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ---------- Linha do tempo ----------

const ETAPAS: { chave: string; rotulo: string }[] = [
  { chave: 'aberto', rotulo: 'Aberto' },
  { chave: 'em-atendimento', rotulo: 'Em atendimento' },
  { chave: 'resolvido', rotulo: 'Resolvido' },
  { chave: 'fechado', rotulo: 'Fechado' },
];

// Em que etapa (0 a 3) cada status está. "Aguardando você" conta como Em atendimento.
function indiceEtapa(status: StatusChamado): number {
  switch (status) {
    case 'ABERTO':
      return 0;
    case 'EM_ATENDIMENTO':
    case 'AGUARDANDO_USUARIO':
      return 1;
    case 'RESOLVIDO':
      return 2;
    case 'FECHADO':
      return 3;
  }
}

// Linha do tempo em quatro etapas: as anteriores à atual ficam marcadas, a atual destacada.
export function EtapasChamado({ status }: { status: StatusChamado }) {
  const atual = indiceEtapa(status);
  return (
    <ol className="suporte-etapas" aria-label="Etapa do chamado">
      {ETAPAS.map((etapa, i) => {
        const classe =
          i < atual
            ? 'suporte-etapa suporte-etapa-feita'
            : i === atual
              ? 'suporte-etapa suporte-etapa-atual'
              : 'suporte-etapa';
        return (
          <li
            key={etapa.chave}
            className={classe}
            aria-current={i === atual ? 'step' : undefined}
          >
            <span className="suporte-etapa-marca" aria-hidden="true">
              {i < atual ? '✓' : i + 1}
            </span>
            <span className="suporte-etapa-rotulo">{etapa.rotulo}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Anexo de imagem ----------

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Limite do campo anexo no servidor: 200.000 caracteres; aqui fica um pouco abaixo.
const LIMITE_ANEXO = 190_000;

// Tentativas de reduzir o anexo, da melhor para a menor (largura máxima em px, qualidade JPEG)
const TENTATIVAS_ANEXO: { largura: number; qualidade: number }[] = [
  { largura: 1000, qualidade: 0.8 },
  { largura: 800, qualidade: 0.7 },
  { largura: 600, qualidade: 0.6 },
  { largura: 480, qualidade: 0.5 },
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

// Reduz a imagem no canvas até caber no limite do anexo; devolve null se nada couber.
async function reduzirAnexo(arquivo: File): Promise<string | null> {
  const img = await carregarImagem(arquivo);
  for (const t of TENTATIVAS_ANEXO) {
    const escala = Math.min(1, t.largura / img.naturalWidth);
    const largura = Math.max(1, Math.round(img.naturalWidth * escala));
    const altura = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Não foi possível processar a imagem.');
    }
    // Fundo branco: imagens com transparência continuam legíveis em JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(img, 0, 0, largura, altura);
    const dataUrl = canvas.toDataURL('image/jpeg', t.qualidade);
    if (dataUrl.length <= LIMITE_ANEXO) {
      return dataUrl;
    }
  }
  return null;
}

// Botão "Anexar imagem" com prévia e opção de remover. Entrega ao pai uma data URL reduzida (ou null).
export function CampoAnexo({
  valor,
  aoMudar,
  ocupado = false,
}: {
  valor: string | null;
  aoMudar: (valor: string | null) => void;
  ocupado?: boolean;
}) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
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
      const dataUrl = await reduzirAnexo(arquivo);
      if (dataUrl === null) {
        setErro('Imagem grande demais.');
      } else {
        aoMudar(dataUrl);
      }
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="suporte-anexo">
      {valor && (
        <div className="suporte-previa-anexo">
          <img src={valor} alt="Prévia do anexo" />
          <Botao
            variante="texto"
            aoClicar={() => {
              setErro(null);
              aoMudar(null);
            }}
          >
            Remover anexo
          </Botao>
        </div>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Botao
        variante="secundario"
        desabilitado={processando || ocupado}
        aoClicar={() => entrada.current?.click()}
      >
        <Icone nome="anexo" tamanho={18} />
        {processando ? 'Preparando imagem...' : 'Anexar imagem'}
      </Botao>
      <input
        ref={entrada}
        className="suporte-arquivo-oculto"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        tabIndex={-1}
        onChange={escolher}
      />
    </div>
  );
}

// ---------- Atualização periódica ----------

// Chama `atualizar` a cada `intervalo` ms enquanto `ativo`. O intervalo é sempre limpo,
// para com a aba oculta e recomeça (com uma atualização imediata) quando a aba volta.
export function useAtualizacao(atualizar: () => void, intervalo: number, ativo: boolean): void {
  const atualizarAtual = useRef(atualizar);
  useEffect(() => {
    atualizarAtual.current = atualizar;
  });

  useEffect(() => {
    if (!ativo) return;
    let timer: number | undefined;
    function parar() {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    }
    function iniciar() {
      parar();
      timer = window.setInterval(() => atualizarAtual.current(), intervalo);
    }
    function aoMudarVisibilidade() {
      if (document.hidden) {
        parar();
      } else {
        atualizarAtual.current();
        iniciar();
      }
    }
    if (!document.hidden) iniciar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      parar();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [intervalo, ativo]);
}
