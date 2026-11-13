import { api } from './api';

// Arquivos da sala de aula (Contrato F). Envio com XMLHttpRequest para ter progresso.

export interface ArquivoDTO {
  id: number;
  nome: string;
  tipo: string;
  tamanho: number;
  criadoEm: string;
}

export const TAMANHO_MAXIMO_ARQUIVO = 20 * 1024 * 1024;

// Extensão -> tipo MIME usado no envio (quando o navegador não informa o tipo).
// A lista de extensões aceitas é esta tabela (mesma ordem do plano).
const TIPOS_POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  zip: 'application/zip',
};

export const EXTENSOES_ACEITAS: string[] = Object.keys(TIPOS_POR_EXTENSAO);

const CHAVE_TOKEN = 'escola.token';

// Extensão em minúsculas, sem o ponto ('' se não houver).
export function extensaoDo(nome: string): string {
  const posicao = nome.lastIndexOf('.');
  return posicao < 0 ? '' : nome.slice(posicao + 1).toLowerCase();
}

// Mensagem de erro para um arquivo que não pode ser enviado, ou null se estiver ok.
export function erroDoArquivo(arquivo: { name: string; size: number }): string | null {
  const extensao = extensaoDo(arquivo.name);
  if (!EXTENSOES_ACEITAS.includes(extensao)) {
    return extensao ? `Tipo de arquivo não aceito (.${extensao}).` : 'Arquivo sem extensão não é aceito.';
  }
  if (arquivo.size === 0) return 'O arquivo está vazio.';
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
    return `Arquivo maior que ${tamanhoLegivel(TAMANHO_MAXIMO_ARQUIVO)}.`;
  }
  return null;
}

// "1,2 MB", "512 KB", "800 B".
export function tamanhoLegivel(bytes: number): string {
  const numero = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${numero(bytes)} B`;
  if (bytes < 1024 * 1024) return `${numero(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${numero(bytes / (1024 * 1024))} MB`;
  return `${numero(bytes / (1024 * 1024 * 1024))} GB`;
}

// Tipo a enviar: sempre o da tabela pela extensão (um tipo por extensão, igual ao primeiro tipo
// aceito pelo servidor). O tipo do navegador não é usado: pode vir fora da tabela do servidor.
function tipoDoEnvio(arquivo: File): string {
  return TIPOS_POR_EXTENSAO[extensaoDo(arquivo.name)] ?? 'application/octet-stream';
}

// Envia o arquivo solto (POST /api/arquivos, corpo bruto). `aoProgresso` recebe a fração de 0 a 1.
export function enviarArquivo(arquivo: File, aoProgresso?: (fracao: number) => void): Promise<ArquivoDTO> {
  return new Promise<ArquivoDTO>((resolver, rejeitar) => {
    const requisicao = new XMLHttpRequest();
    requisicao.open('POST', '/api/arquivos');

    const token = localStorage.getItem(CHAVE_TOKEN);
    if (token) requisicao.setRequestHeader('Authorization', `Bearer ${token}`);
    requisicao.setRequestHeader('Content-Type', tipoDoEnvio(arquivo));
    requisicao.setRequestHeader('X-Nome-Arquivo', encodeURIComponent(arquivo.name));

    requisicao.upload.onprogress = (evento) => {
      if (aoProgresso && evento.lengthComputable && evento.total > 0) {
        aoProgresso(evento.loaded / evento.total);
      }
    };

    requisicao.onload = () => {
      let dados: { erro?: string } | ArquivoDTO | null = null;
      try {
        dados = JSON.parse(requisicao.responseText) as { erro?: string } | ArquivoDTO;
      } catch {
        dados = null;
      }

      if (requisicao.status >= 200 && requisicao.status < 300 && dados && 'id' in dados) {
        resolver(dados as ArquivoDTO);
        return;
      }

      // Mesma regra do api.ts: sessão encerrada manda para o login.
      if (requisicao.status === 401) {
        localStorage.clear();
        window.location.assign('/login');
      }
      const erro = dados && 'erro' in dados ? dados.erro : undefined;
      rejeitar(new Error(erro ?? 'Erro inesperado'));
    };

    requisicao.onerror = () => rejeitar(new Error('Falha de conexão ao enviar o arquivo.'));
    requisicao.onabort = () => rejeitar(new Error('Envio cancelado.'));

    requisicao.send(arquivo);
  });
}

// Baixa o arquivo (GET autenticado) e salva com o nome original.
export function baixarArquivo(arquivo: ArquivoDTO): Promise<void> {
  return api.baixar(`/arquivos/${arquivo.id}`, arquivo.nome);
}

// Apaga um arquivo solto (ainda não ligado a material, tarefa ou entrega).
// 404 (já não existe) é tratado como sucesso.
export async function removerArquivoSolto(id: number): Promise<void> {
  const token = localStorage.getItem(CHAVE_TOKEN);
  const cabecalhos: Record<string, string> = {};
  if (token) cabecalhos['Authorization'] = `Bearer ${token}`;
  const resposta = await fetch(`/api/arquivos/${id}`, { method: 'DELETE', headers: cabecalhos });
  if (resposta.ok || resposta.status === 404) return;

  let dados: { erro?: string } | null = null;
  try {
    dados = (await resposta.json()) as { erro?: string };
  } catch {
    dados = null;
  }
  if (resposta.status === 401) {
    localStorage.clear();
    window.location.assign('/login');
  }
  throw new Error(dados?.erro ?? 'Erro inesperado');
}
