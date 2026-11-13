import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { ArquivoDTO } from '../lib/arquivos';
import {
  TAMANHO_MAXIMO_ARQUIVO,
  EXTENSOES_ACEITAS,
  baixarArquivo,
  enviarArquivo,
  erroDoArquivo,
  removerArquivoSolto,
  tamanhoLegivel,
} from '../lib/arquivos';
import { Aviso, Botao } from './index';
import { Icone } from './icones';
import type { NomeIcone } from './icones';
import './arquivos.css';

// Campo de anexos e lista de anexos (sala de aula).

const ACEITOS = EXTENSOES_ACEITAS.map((e) => `.${e}`).join(',');

interface EnvioEmCurso {
  chave: number;
  nome: string;
  tamanho: number;
  fracao: number;
}

interface ErroArquivo {
  chave: number;
  nome: string;
  mensagem: string;
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Ícone pelo tipo MIME gravado.
function iconeDoTipo(tipo: string): NomeIcone {
  if (tipo.startsWith('image/')) return 'imagem';
  if (/sheet|excel|csv|spreadsheet/.test(tipo)) return 'grade';
  if (tipo === 'application/zip') return 'pasta';
  if (/pdf|word|text|presentation|powerpoint|opendocument/.test(tipo)) return 'documento';
  return 'arquivo';
}

export function CampoArquivos({
  valor,
  aoMudar,
  maximo = 10,
  desabilitado,
}: {
  valor: ArquivoDTO[];
  aoMudar: (arquivos: ArquivoDTO[]) => void;
  maximo?: number;
  desabilitado?: boolean;
}) {
  const [enviando, setEnviando] = useState<EnvioEmCurso[]>([]);
  const [erros, setErros] = useState<ErroArquivo[]>([]);
  const [erroRemover, setErroRemover] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const entradaRef = useRef<HTMLInputElement>(null);
  // Lista mais recente (o envio é sequencial e atualiza a lista a cada arquivo recebido).
  const valorRef = useRef<ArquivoDTO[]>(valor);
  // Ids enviados nesta sessão do campo (podem ser apagados ao tirar da lista).
  const enviadosAgora = useRef<Set<number>>(new Set());
  const contadorRef = useRef(0);
  // Falso depois que o campo sai da tela (ex.: o Modal fecha no meio de um envio).
  const vivoRef = useRef(true);

  useEffect(() => {
    valorRef.current = valor;
  }, [valor]);

  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
    };
  }, []);

  const ocupado = enviando.length > 0;
  const bloqueado = desabilitado || ocupado;

  async function receber(lista: File[]): Promise<void> {
    if (lista.length === 0) return;
    setErros([]);
    setErroRemover(null);

    let atual = valorRef.current;
    const novosErros: ErroArquivo[] = [];

    for (const arquivo of lista) {
      contadorRef.current += 1;
      const chave = contadorRef.current;

      if (atual.length >= maximo) {
        novosErros.push({ chave, nome: arquivo.name, mensagem: `Limite de ${maximo} arquivos atingido.` });
        continue;
      }

      const motivo = erroDoArquivo(arquivo);
      if (motivo) {
        novosErros.push({ chave, nome: arquivo.name, mensagem: motivo });
        continue;
      }

      setEnviando((atuais) => [
        ...atuais,
        { chave, nome: arquivo.name, tamanho: arquivo.size, fracao: 0 },
      ]);

      let enviado: ArquivoDTO | null = null;
      let falha: string | null = null;
      try {
        enviado = await enviarArquivo(arquivo, (fracao) => {
          if (!vivoRef.current) return;
          setEnviando((atuais) =>
            atuais.map((item) => (item.chave === chave ? { ...item, fracao } : item)),
          );
        });
      } catch (e) {
        falha = mensagemDe(e);
      }

      // Campo desmontado durante o envio: não mexe em estado nem na lista do pai.
      if (!vivoRef.current) return;

      setEnviando((atuais) => atuais.filter((item) => item.chave !== chave));
      if (enviado) {
        enviadosAgora.current.add(enviado.id);
        atual = [...atual, enviado];
        valorRef.current = atual;
        aoMudar(atual);
      } else {
        novosErros.push({ chave, nome: arquivo.name, mensagem: falha ?? 'Erro inesperado' });
      }
    }

    if (!vivoRef.current) return;
    setErros(novosErros);
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

  async function remover(arquivo: ArquivoDTO): Promise<void> {
    setErroRemover(null);
    const nova = valorRef.current.filter((a) => a.id !== arquivo.id);
    valorRef.current = nova;
    aoMudar(nova);

    if (enviadosAgora.current.has(arquivo.id)) {
      enviadosAgora.current.delete(arquivo.id);
      let falha: string | null = null;
      try {
        await removerArquivoSolto(arquivo.id);
      } catch (e) {
        falha = mensagemDe(e);
      }
      if (!vivoRef.current) return;
      if (falha) setErroRemover(`Não foi possível apagar ${arquivo.nome}: ${falha}`);
    }
  }

  return (
    <div className="arquivos-campo">
      <div
        className={arrastando ? 'arquivos-soltar arquivos-soltar-ativa' : 'arquivos-soltar'}
        onDragOver={aoArrastarSobre}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
      >
        <p className="arquivos-dica">Arraste os arquivos para cá ou</p>
        <Botao
          variante="secundario"
          desabilitado={bloqueado || valor.length >= maximo}
          aoClicar={() => entradaRef.current?.click()}
        >
          <Icone nome="anexo" tamanho={18} /> Anexar arquivos
        </Botao>
        <input
          ref={entradaRef}
          type="file"
          multiple
          accept={ACEITOS}
          hidden
          onChange={aoEscolher}
        />
        <p className="arquivos-ajuda">
          {valor.length} de {maximo} arquivos. Cada um até {tamanhoLegivel(TAMANHO_MAXIMO_ARQUIVO)}.
          Tipos: {EXTENSOES_ACEITAS.join(', ')}.
        </p>
      </div>

      {(valor.length > 0 || enviando.length > 0) && (
        <ul className="arquivos-lista">
          {valor.map((arquivo) => (
            <li key={arquivo.id} className="arquivos-item">
              <Icone nome={iconeDoTipo(arquivo.tipo)} tamanho={20} className="arquivos-icone" />
              <span className="arquivos-nome">{arquivo.nome}</span>
              <span className="arquivos-tamanho">{tamanhoLegivel(arquivo.tamanho)}</span>
              <button
                type="button"
                className="arquivos-remover"
                aria-label={`Remover ${arquivo.nome}`}
                title="Remover"
                disabled={desabilitado}
                onClick={() => void remover(arquivo)}
              >
                <Icone nome="fechar" tamanho={16} />
              </button>
            </li>
          ))}
          {enviando.map((item) => {
            const percentual = Math.round(item.fracao * 100);
            return (
              <li key={item.chave} className="arquivos-item arquivos-enviando">
                <Icone nome="anexo" tamanho={20} className="arquivos-icone" />
                <span className="arquivos-nome">{item.nome}</span>
                <span className="arquivos-tamanho">{percentual}%</span>
                <div
                  className="arquivos-progresso"
                  role="progressbar"
                  aria-label={`Enviando ${item.nome}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentual}
                >
                  <span style={{ width: `${percentual}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {erros.map((erro) => (
        <Aviso key={erro.chave} tipo="erro">
          {erro.nome}: {erro.mensagem}
        </Aviso>
      ))}
      {erroRemover && <Aviso tipo="erro">{erroRemover}</Aviso>}
    </div>
  );
}

// Lista compacta de anexos; clicar em um baixa o arquivo.
export function ListaArquivos({ arquivos }: { arquivos: ArquivoDTO[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<number | null>(null);

  if (arquivos.length === 0) return null;

  async function baixar(arquivo: ArquivoDTO): Promise<void> {
    setErro(null);
    setBaixando(arquivo.id);
    try {
      await baixarArquivo(arquivo);
    } catch (e) {
      setErro(`Não foi possível baixar ${arquivo.nome}: ${mensagemDe(e)}`);
    } finally {
      setBaixando(null);
    }
  }

  return (
    <div className="arquivos-leitura">
      <ul className="arquivos-lista">
        {arquivos.map((arquivo) => (
          <li key={arquivo.id}>
            <button
              type="button"
              className="arquivos-item arquivos-link"
              title={`Baixar ${arquivo.nome}`}
              disabled={baixando === arquivo.id}
              onClick={() => void baixar(arquivo)}
            >
              <Icone nome={iconeDoTipo(arquivo.tipo)} tamanho={20} className="arquivos-icone" />
              <span className="arquivos-nome">{arquivo.nome}</span>
              <span className="arquivos-tamanho">{tamanhoLegivel(arquivo.tamanho)}</span>
            </button>
          </li>
        ))}
      </ul>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  );
}
