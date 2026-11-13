import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BotaoTema } from '../../layout/Layout';
import '../../layout/login.css';
import { usePlataforma } from '../../lib/plataforma';
import { Aviso, Botao, Selo, formatarDataHora } from '../../ui';
import { rotuloTipoDocumento } from './Emitidos';

// Página pública de conferência (sem login, fora do layout do portal).
// Usa fetch direto: a resposta 404/429 não traz o campo `erro` que `api` espera.

interface DocumentoValido {
  tipo: string;
  descricao: string;
  alunoNome: string;
  emitidoEm: string;
}

type Situacao =
  | { tipo: 'nada' }
  | { tipo: 'conferindo' }
  | { tipo: 'valido'; documento: DocumentoValido }
  | { tipo: 'naoEncontrado' }
  | { tipo: 'limite' }
  | { tipo: 'falha'; mensagem: string };

const TAMANHO_CODIGO = 12;

// Maiúsculas, só letras e números, com hífen a cada 4 caracteres: XXXX-XXXX-XXXX.
function formatarCodigo(bruto: string): string {
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, TAMANHO_CODIGO);
  return limpo.match(/.{1,4}/g)?.join('-') ?? '';
}

function codigoCompleto(formatado: string): boolean {
  return formatado.replace(/-/g, '').length === TAMANHO_CODIGO;
}

function textoDoCampo(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

async function consultar(codigo: string): Promise<Situacao> {
  if (!codigoCompleto(codigo)) return { tipo: 'naoEncontrado' };

  let resposta: Response;
  try {
    resposta = await fetch(`/api/documentos/validar/${encodeURIComponent(codigo)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { tipo: 'falha', mensagem: 'Sem conexão com o servidor. Tente de novo.' };
  }

  if (resposta.status === 429) return { tipo: 'limite' };
  if (resposta.status === 404) return { tipo: 'naoEncontrado' };

  let dados: Record<string, unknown> | null = null;
  try {
    dados = (await resposta.json()) as Record<string, unknown>;
  } catch {
    dados = null;
  }

  if (resposta.ok && dados && dados.valido === true) {
    return {
      tipo: 'valido',
      documento: {
        tipo: textoDoCampo(dados.tipo),
        descricao: textoDoCampo(dados.descricao),
        alunoNome: textoDoCampo(dados.alunoNome),
        emitidoEm: textoDoCampo(dados.emitidoEm),
      },
    };
  }

  return { tipo: 'falha', mensagem: 'Não foi possível conferir agora. Tente de novo.' };
}

function ResultadoValidacao({ situacao }: { situacao: Situacao }) {
  switch (situacao.tipo) {
    case 'nada':
      return null;
    case 'conferindo':
      return (
        <p className="doc-validar-status" role="status">
          Conferindo...
        </p>
      );
    case 'valido': {
      const doc = situacao.documento;
      return (
        <div className="doc-validar-resultado" role="status">
          <div>
            <Selo cor="verde">Documento autêntico</Selo>
          </div>
          <dl className="doc-validar-dados">
            <dt>Tipo</dt>
            <dd>{rotuloTipoDocumento(doc.tipo)}</dd>
            <dt>Descrição</dt>
            <dd>{doc.descricao}</dd>
            <dt>Aluno</dt>
            <dd>{doc.alunoNome}</dd>
            <dt>Emitido em</dt>
            <dd>{formatarDataHora(doc.emitidoEm) || '—'}</dd>
          </dl>
        </div>
      );
    }
    case 'naoEncontrado':
      return <Aviso tipo="erro">Código não encontrado. Confira se digitou certo.</Aviso>;
    case 'limite':
      return <Aviso tipo="erro">Muitas tentativas. Aguarde um minuto.</Aviso>;
    case 'falha':
      return <Aviso tipo="erro">{situacao.mensagem}</Aviso>;
  }
}

export function Validar() {
  const { codigo: codigoNaUrl } = useParams();
  const { plataforma, logoSrc } = usePlataforma();
  const [codigo, setCodigo] = useState(() => formatarCodigo(codigoNaUrl ?? ''));
  const [situacao, setSituacao] = useState<Situacao>({ tipo: 'nada' });

  // Com código na URL, confere ao abrir (e de novo se a URL mudar).
  useEffect(() => {
    if (!codigoNaUrl) return;
    const formatado = formatarCodigo(codigoNaUrl);
    let cancelado = false;
    setCodigo(formatado);
    setSituacao({ tipo: 'conferindo' });
    void consultar(formatado).then((resultado) => {
      if (!cancelado) setSituacao(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [codigoNaUrl]);

  const conferindo = situacao.tipo === 'conferindo';

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!codigoCompleto(codigo) || conferindo) return;
    setSituacao({ tipo: 'conferindo' });
    setSituacao(await consultar(codigo));
  }

  return (
    <main className="entrada">
      <div className="entrada-tema">
        <BotaoTema />
      </div>
      <aside className="entrada-marca">
        <div className="entrada-marca-topo">
          <img src={logoSrc} alt="" className="entrada-logo" width={56} height={56} />
          <span className="entrada-marca-nome">{plataforma.nome}</span>
        </div>
        <div className="entrada-marca-meio">
          <h2 className="entrada-frase">Confira a autenticidade de um documento</h2>
          <p className="entrada-marca-apoio">
            Todo documento emitido traz um código de conferência no rodapé.
          </p>
        </div>
      </aside>

      <section className="entrada-formulario">
        <section className="entrada-cartao doc-validar" aria-labelledby="doc-validar-titulo">
          <div className="entrada-cartao-marca">
            <img src={logoSrc} alt="" className="entrada-logo" width={56} height={56} />
            <span>{plataforma.nome}</span>
          </div>
          <h1 id="doc-validar-titulo" className="entrada-titulo">
            Conferir documento
          </h1>
          <p className="entrada-apoio">Digite o código de conferência que aparece no rodapé do documento.</p>

          <form className="doc-validar-form" onSubmit={enviar}>
            <label className="campo">
              <span className="campo-rotulo">Código de conferência</span>
              <input
                className="campo-controle doc-validar-codigo"
                type="text"
                value={codigo}
                maxLength={TAMANHO_CODIGO + 3}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="XXXX-XXXX-XXXX"
                onChange={(e) => setCodigo(formatarCodigo(e.target.value))}
              />
            </label>
            <div className="entrada-botao">
              <Botao tipo="submit" desabilitado={!codigoCompleto(codigo) || conferindo}>
                Conferir
              </Botao>
            </div>
          </form>

          <ResultadoValidacao situacao={situacao} />

          <Link to="/login" className="entrada-esqueci">
            Ir para o login
          </Link>
        </section>
      </section>
    </main>
  );
}
