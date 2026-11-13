import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { tamanhoLegivel } from '../../lib/arquivos';
import { Aviso, Botao } from '../../ui';
import { Icone } from '../../ui/icones';
import type { DocumentoEnviadoDTO } from './tipos';

// Envio de documentos do pedido de matrícula (público: protocolo e chave vão em cabeçalhos, nunca na URL).
// Um arquivo por vez, corpo bruto por XMLHttpRequest para mostrar o progresso.

const LIMITE_DOCUMENTOS = 6;
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const TIPO_POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};
const ACEITOS = '.pdf,.jpg,.jpeg,.png';

interface EnvioEmCurso {
  chave: number;
  nome: string;
  fracao: number;
}

interface PropsEnvioDocumentos {
  protocolo: string;
  chave: string;
  enviados: { nome: string; tamanho: number }[];
  aoEnviar(): void;
}

function extensaoDe(nome: string): string {
  const posicao = nome.lastIndexOf('.');
  return posicao < 0 ? '' : nome.slice(posicao + 1).toLowerCase();
}

// Mensagem para um arquivo que não pode ser enviado, ou null se estiver ok.
function motivoRecusado(arquivo: File): string | null {
  const extensao = extensaoDe(arquivo.name);
  const tipo = TIPO_POR_EXTENSAO[extensao] as string | undefined;
  if (!tipo) return extensao ? `tipo não aceito (.${extensao}).` : 'arquivo sem extensão não é aceito.';
  if (arquivo.size === 0) return 'o arquivo está vazio.';
  if (arquivo.size > TAMANHO_MAXIMO) return `arquivo maior que ${tamanhoLegivel(TAMANHO_MAXIMO)}.`;
  return null;
}

// Resposta de erro sem JSON (ex.: limite do servidor de arquivos) ganha uma mensagem clara.
function mensagemSemJson(status: number): string {
  if (status === 413) return `arquivo maior que ${tamanhoLegivel(TAMANHO_MAXIMO)}.`;
  return 'não foi possível enviar o arquivo.';
}

// Envia um arquivo do pedido. Resolve com { nome, tamanho } (201).
function enviarDocumento(
  protocolo: string,
  chave: string,
  arquivo: File,
  aoProgresso: (fracao: number) => void,
): Promise<DocumentoEnviadoDTO> {
  return new Promise<DocumentoEnviadoDTO>((resolver, rejeitar) => {
    const requisicao = new XMLHttpRequest();
    requisicao.open('POST', '/api/matricula-online/documentos');
    requisicao.setRequestHeader('Content-Type', TIPO_POR_EXTENSAO[extensaoDe(arquivo.name)] ?? 'application/octet-stream');
    requisicao.setRequestHeader('X-Protocolo', protocolo);
    requisicao.setRequestHeader('X-Chave', chave);
    requisicao.setRequestHeader('X-Nome-Arquivo', encodeURIComponent(arquivo.name));

    requisicao.upload.onprogress = (evento) => {
      if (evento.lengthComputable && evento.total > 0) aoProgresso(evento.loaded / evento.total);
    };

    requisicao.onload = () => {
      let dados: { erro?: string; nome?: string; tamanho?: number } | null = null;
      try {
        dados = JSON.parse(requisicao.responseText) as { erro?: string; nome?: string; tamanho?: number };
      } catch {
        dados = null;
      }

      if (requisicao.status >= 200 && requisicao.status < 300 && dados && typeof dados.nome === 'string') {
        resolver({ nome: dados.nome, tamanho: typeof dados.tamanho === 'number' ? dados.tamanho : arquivo.size });
        return;
      }
      rejeitar(new Error(dados?.erro ?? mensagemSemJson(requisicao.status)));
    };

    requisicao.onerror = () => rejeitar(new Error('Falha de conexão ao enviar o arquivo.'));
    requisicao.onabort = () => rejeitar(new Error('Envio cancelado.'));

    requisicao.send(arquivo);
  });
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

export function EnvioDocumentos({ protocolo, chave, enviados, aoEnviar }: PropsEnvioDocumentos) {
  // Lista da sessão: começa com o que já veio e ganha cada arquivo recebido.
  const [recebidos, setRecebidos] = useState<DocumentoEnviadoDTO[]>(enviados);
  const [emCurso, setEmCurso] = useState<EnvioEmCurso | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [arrastando, setArrastando] = useState(false);

  const entradaRef = useRef<HTMLInputElement>(null);
  const ocupadoRef = useRef(false);
  const contadorRef = useRef(0);
  const vivoRef = useRef(true);

  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
    };
  }, []);

  const cheio = recebidos.length >= LIMITE_DOCUMENTOS;
  const bloqueado = emCurso !== null || cheio;

  async function receber(lista: File[]): Promise<void> {
    if (lista.length === 0 || ocupadoRef.current) return;

    const novosErros: string[] = [];
    const fila: File[] = [];
    for (const arquivo of lista) {
      const motivo = motivoRecusado(arquivo);
      if (motivo) {
        novosErros.push(`${arquivo.name}: ${motivo}`);
        continue;
      }
      if (recebidos.length + fila.length >= LIMITE_DOCUMENTOS) {
        novosErros.push(`${arquivo.name}: limite de ${LIMITE_DOCUMENTOS} documentos atingido.`);
        continue;
      }
      fila.push(arquivo);
    }
    setErros(novosErros);
    if (fila.length === 0) return;

    ocupadoRef.current = true;
    for (const arquivo of fila) {
      contadorRef.current += 1;
      const chaveEnvio = contadorRef.current;
      setEmCurso({ chave: chaveEnvio, nome: arquivo.name, fracao: 0 });

      try {
        const resposta = await enviarDocumento(protocolo, chave, arquivo, (fracao) => {
          if (!vivoRef.current) return;
          setEmCurso((atual) => (atual && atual.chave === chaveEnvio ? { ...atual, fracao } : atual));
        });
        if (!vivoRef.current) return;
        setRecebidos((atuais) => [...atuais, resposta]);
        aoEnviar();
      } catch (e) {
        if (!vivoRef.current) return;
        setErros((atuais) => [...atuais, `${arquivo.name}: ${mensagemDe(e)}`]);
      }
    }

    ocupadoRef.current = false;
    if (vivoRef.current) setEmCurso(null);
  }

  function aoEscolher(evento: ChangeEvent<HTMLInputElement>): void {
    const arquivos = Array.from(evento.target.files ?? []);
    // Limpa o campo para aceitar de novo o mesmo arquivo.
    evento.target.value = '';
    void receber(arquivos);
  }

  function aoSoltar(evento: DragEvent<HTMLDivElement>): void {
    evento.preventDefault();
    setArrastando(false);
    if (bloqueado) return;
    void receber(Array.from(evento.dataTransfer.files));
  }

  function aoArrastarSobre(evento: DragEvent<HTMLDivElement>): void {
    evento.preventDefault();
    if (!bloqueado) setArrastando(true);
  }

  return (
    <section className="solic-documentos" aria-label="Envio de documentos">
      <h2 className="solic-subtitulo">Documentos</h2>
      <p className="solic-ajuda">
        Envie: documento de identidade, CPF, comprovante de endereço e histórico escolar. Aceitos: PDF, JPG,
        JPEG e PNG, até {tamanhoLegivel(TAMANHO_MAXIMO)} cada, no máximo {LIMITE_DOCUMENTOS} arquivos.
      </p>

      <div
        className={arrastando ? 'solic-soltar solic-soltar-ativa' : 'solic-soltar'}
        onDragOver={aoArrastarSobre}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
      >
        <p className="solic-ajuda">{recebidos.length} de {LIMITE_DOCUMENTOS} enviados. Arraste os arquivos para cá ou</p>
        <Botao variante="secundario" desabilitado={bloqueado} aoClicar={() => entradaRef.current?.click()}>
          <Icone nome="anexo" tamanho={18} /> Escolher arquivos
        </Botao>
        <input
          ref={entradaRef}
          type="file"
          multiple
          accept={ACEITOS}
          hidden
          onChange={aoEscolher}
        />
      </div>

      {(recebidos.length > 0 || emCurso !== null) && (
        <ul className="solic-arquivos">
          {recebidos.map((arquivo, indice) => (
            <li key={`${arquivo.nome}-${indice}`} className="solic-arquivo">
              <Icone nome="documento" tamanho={20} className="solic-arquivo-icone" />
              <span className="solic-arquivo-nome">{arquivo.nome}</span>
              <span className="solic-arquivo-tamanho">{tamanhoLegivel(arquivo.tamanho)}</span>
            </li>
          ))}
          {emCurso !== null && (
            <li className="solic-arquivo solic-arquivo-enviando">
              <Icone nome="anexo" tamanho={20} className="solic-arquivo-icone" />
              <span className="solic-arquivo-nome">{emCurso.nome}</span>
              <span className="solic-arquivo-tamanho">{Math.round(emCurso.fracao * 100)}%</span>
              <div
                className="solic-progresso"
                role="progressbar"
                aria-label={`Enviando ${emCurso.nome}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(emCurso.fracao * 100)}
              >
                <span style={{ width: `${Math.round(emCurso.fracao * 100)}%` }} />
              </div>
            </li>
          )}
        </ul>
      )}

      {cheio && <p className="solic-ajuda">Limite de {LIMITE_DOCUMENTOS} documentos atingido.</p>}
      {erros.map((texto, indice) => (
        <Aviso key={`${indice}-${texto}`} tipo="erro">
          {texto}
        </Aviso>
      ))}
    </section>
  );
}
