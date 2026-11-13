const CHAVE_TOKEN = 'escola.token';
const CHAVE_USUARIO = 'escola.usuario';

function cabecalhos(temCorpo: boolean): HeadersInit {
  const cabecalho: Record<string, string> = {};
  if (temCorpo) cabecalho['Content-Type'] = 'application/json';
  const token = localStorage.getItem(CHAVE_TOKEN);
  if (token) cabecalho['Authorization'] = `Bearer ${token}`;
  return cabecalho;
}

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const temCorpo = corpo !== undefined;
  const resposta = await fetch('/api' + caminho, {
    method: metodo,
    headers: cabecalhos(temCorpo),
    body: temCorpo ? JSON.stringify(corpo) : undefined,
  });

  if (resposta.status === 204) return undefined as T;

  let dados: { erro?: string } | null = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && caminho !== '/auth/login') {
      localStorage.clear();
      window.location.assign('/login');
    }
    throw new Error(dados?.erro ?? 'Erro inesperado');
  }

  return dados as T;
}

// Trata resposta de erro das rotas de arquivo: mesma regra do 401 (sessão encerrada) e mesma mensagem `erro`.
async function lancarErro(resposta: Response, caminho: string): Promise<never> {
  let dados: { erro?: string } | null = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (resposta.status === 401 && caminho !== '/auth/login') {
    localStorage.clear();
    window.location.assign('/login');
  }
  throw new Error(dados?.erro ?? 'Erro inesperado');
}

// Baixa um arquivo (GET autenticado) e salva o corpo com o nome dado.
async function baixarArquivo(caminho: string, nomeArquivo: string): Promise<void> {
  const resposta = await fetch('/api' + caminho, {
    method: 'GET',
    headers: cabecalhos(false),
  });
  if (!resposta.ok) await lancarErro(resposta, caminho);

  const blob = await resposta.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Envia o corpo bruto (ex.: um arquivo) com o Content-Type dado.
async function enviarCorpoBruto<T>(caminho: string, arquivo: Blob, tipo: string): Promise<T> {
  const cabecalho: Record<string, string> = { ...(cabecalhos(false) as Record<string, string>) };
  cabecalho['Content-Type'] = tipo;
  const resposta = await fetch('/api' + caminho, {
    method: 'POST',
    headers: cabecalho,
    body: arquivo,
  });

  if (resposta.status === 204) return undefined as T;
  if (!resposta.ok) await lancarErro(resposta, caminho);

  return (await resposta.json()) as T;
}

export const api = {
  get<T>(caminho: string): Promise<T> {
    return requisitar<T>('GET', caminho);
  },
  post<T>(caminho: string, corpo?: unknown): Promise<T> {
    return requisitar<T>('POST', caminho, corpo);
  },
  put<T>(caminho: string, corpo?: unknown): Promise<T> {
    return requisitar<T>('PUT', caminho, corpo);
  },
  async del(caminho: string): Promise<void> {
    await requisitar<void>('DELETE', caminho);
  },
  // Baixa o arquivo da rota (GET autenticado) e salva com o nome dado.
  baixar(caminho: string, nomeArquivo: string): Promise<void> {
    return baixarArquivo(caminho, nomeArquivo);
  },
  // Envia o corpo bruto (POST) com o Content-Type dado e devolve a resposta JSON.
  enviarArquivo<T>(caminho: string, arquivo: Blob, tipo: string): Promise<T> {
    return enviarCorpoBruto<T>(caminho, arquivo, tipo);
  },
};
