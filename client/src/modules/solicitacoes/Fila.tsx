import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePlataforma } from '../../lib/plataforma';
import { useDados } from '../../lib/useDados';
import type { ColunaTabela } from '../../ui';
import { AreaTexto, Aviso, Botao, Campo, Cartao, Carregando, Pagina, Selecao, Selo, Tabela, formatarData } from '../../ui';
import { BotaoCopiar, SeloStatus, SeloTipo } from './MatriculaOnline';
import type { ListaSolicitacoesDTO, MatriculaOnlineDTO, SolicitacaoResumoDTO, StatusSolicitacao, TipoSolicitacao } from './tipos';
import { nomeDoCurso, ROTULO_STATUS, ROTULO_TIPO, STATUS_EM_ORDEM } from './tipos';
import './solicitacoes.css';

// Secretaria: situação da matrícula online e fila de pedidos (matrícula nova e rematrícula).

const ATRASO_BUSCA = 300;
const LIMITE_TEXTO = 2000;

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Cartão com a situação da matrícula online: abrir ou fechar, orientações e endereço público.
function CartaoSituacao() {
  const config = useDados<MatriculaOnlineDTO>('/matricula-online');
  const { recarregar: recarregarPlataforma } = usePlataforma();
  const [textoEditado, setTextoEditado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const cfg = config.dados;
  const texto = textoEditado ?? cfg?.texto ?? '';
  const mudouTexto = cfg !== null && texto !== cfg.texto;
  const endereco = `${window.location.origin}/matricula-online`;

  // Grava a configuração. Ao fechar ou abrir, o texto guardado segue como está e o rascunho continua na tela.
  async function gravar(aberta: boolean, textoGravado: string, mensagem: string, limparRascunho: boolean): Promise<void> {
    setAviso(null);
    setErro(null);
    setOcupado(true);
    try {
      await api.put('/matricula-online/configuracao', { aberta, texto: textoGravado });
      if (limparRascunho) setTextoEditado(null);
      setAviso(mensagem);
      config.recarregar();
      void recarregarPlataforma();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Cartao titulo="Matrícula online">
      {config.carregando && cfg === null && <Carregando />}
      {config.erro && cfg === null && <Aviso tipo="erro">{config.erro}</Aviso>}

      {cfg && (
        <div className="solic-situacao">
          <div className="solic-linha">
            <Selo cor={cfg.aberta ? 'verde' : 'cinza'}>{cfg.aberta ? 'Aberta' : 'Fechada'}</Selo>
            <span className="solic-ajuda">
              {cfg.aberta
                ? 'O formulário público está recebendo pedidos.'
                : 'O formulário público mostra o aviso de matrículas fechadas.'}
            </span>
            <Botao
              variante={cfg.aberta ? 'secundario' : 'primario'}
              desabilitado={ocupado}
              aoClicar={() =>
                void gravar(
                  !cfg.aberta,
                  cfg.texto,
                  cfg.aberta ? 'Matrícula online fechada.' : 'Matrícula online aberta.',
                  false,
                )
              }
            >
              {cfg.aberta ? 'Fechar matrícula online' : 'Abrir matrícula online'}
            </Botao>
          </div>

          <AreaTexto
            rotulo="Orientações (mostradas no formulário público)"
            valor={texto}
            aoMudar={setTextoEditado}
            linhas={6}
          />
          <p className={texto.length > LIMITE_TEXTO ? 'solic-ajuda solic-ajuda-erro' : 'solic-ajuda'}>
            {texto.length} de {LIMITE_TEXTO} caracteres
          </p>
          <div className="solic-linha">
            <Botao
              variante="secundario"
              desabilitado={ocupado || !mudouTexto || texto.length > LIMITE_TEXTO}
              aoClicar={() => void gravar(cfg.aberta, texto, 'Orientações salvas.', true)}
            >
              Salvar orientações
            </Botao>
          </div>

          <div className="solic-endereco">
            <span className="solic-rotulo-destaque">Endereço público</span>
            <code className="solic-valor-codigo">{endereco}</code>
            <BotaoCopiar texto={endereco} rotulo="o endereço" />
          </div>
        </div>
      )}

      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </Cartao>
  );
}

const OPCOES_TIPO: { valor: string; rotulo: string }[] = [
  { valor: 'NOVA', rotulo: ROTULO_TIPO.NOVA },
  { valor: 'REMATRICULA', rotulo: ROTULO_TIPO.REMATRICULA },
];

const COLUNAS: ColunaTabela<SolicitacaoResumoDTO>[] = [
  { titulo: 'Protocolo', celula: (s) => s.protocolo },
  { titulo: 'Nome', celula: (s) => s.nome },
  { titulo: 'Curso', celula: (s) => nomeDoCurso(s.curso) },
  { titulo: 'Tipo', celula: (s) => <SeloTipo tipo={s.tipo} /> },
  { titulo: 'Status', celula: (s) => <SeloStatus status={s.status} /> },
  { titulo: 'Documentos', alinhar: 'direita', celula: (s) => s.documentos },
  { titulo: 'Data', celula: (s) => formatarData(s.criadoEm) },
];

export function Fila() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusSolicitacao | ''>('');
  const [tipo, setTipo] = useState<TipoSolicitacao | ''>('');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [pagina, setPagina] = useState(1);

  // A busca espera a pessoa parar de digitar e volta para a primeira página.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPagina(1);
    }, ATRASO_BUSCA);
    return () => window.clearTimeout(timer);
  }, [busca]);

  function mudarStatus(novo: StatusSolicitacao | ''): void {
    setStatus(novo);
    setPagina(1);
  }

  function mudarTipo(novo: TipoSolicitacao | ''): void {
    setTipo(novo);
    setPagina(1);
  }

  const caminho = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (tipo) params.set('tipo', tipo);
    if (buscaAplicada) params.set('busca', buscaAplicada);
    params.set('pagina', String(pagina));
    return `/solicitacoes?${params.toString()}`;
  }, [status, tipo, buscaAplicada, pagina]);

  const lista = useDados<ListaSolicitacoesDTO>(caminho);
  const dados = lista.dados;
  const contagem = dados?.contagem;
  const totalGeral = contagem ? Object.values(contagem).reduce((soma, n) => soma + n, 0) : 0;
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <Pagina titulo="Matrícula online">
      <CartaoSituacao />

      <Cartao titulo="Pedidos">
        <div className="solic-contagens" role="group" aria-label="Filtrar por situação">
          <button
            type="button"
            className={status === '' ? 'solic-contagem solic-contagem-ativa' : 'solic-contagem'}
            aria-pressed={status === ''}
            onClick={() => mudarStatus('')}
          >
            <span className="solic-contagem-valor">{totalGeral}</span>
            <span className="solic-contagem-rotulo">Todas</span>
          </button>
          {STATUS_EM_ORDEM.map((s) => (
            <button
              key={s}
              type="button"
              className={status === s ? 'solic-contagem solic-contagem-ativa' : 'solic-contagem'}
              aria-pressed={status === s}
              onClick={() => mudarStatus(status === s ? '' : s)}
            >
              <span className="solic-contagem-valor">{contagem?.[s] ?? 0}</span>
              <span className="solic-contagem-rotulo">{ROTULO_STATUS[s]}</span>
            </button>
          ))}
        </div>

        <div className="solic-filtros">
          <Campo rotulo="Buscar" valor={busca} aoMudar={setBusca} />
          <Selecao
            rotulo="Tipo"
            valor={tipo}
            aoMudar={(v) => mudarTipo(v as TipoSolicitacao | '')}
            opcoes={OPCOES_TIPO}
            vazio="Todos os tipos"
          />
        </div>

        {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
        {lista.carregando && dados === null && <Carregando />}

        {dados !== null && (
          <>
            <Tabela
              colunas={COLUNAS}
              dados={dados.itens}
              chave={(s) => s.id}
              vazio="Nenhum pedido encontrado."
              aoClicarLinha={(s) => navigate(`/admin/solicitacoes/${s.id}`)}
            />
            {dados.total > dados.porPagina && (
              <nav className="solic-paginacao" aria-label="Páginas da fila">
                <Botao
                  variante="secundario"
                  desabilitado={pagina <= 1 || lista.carregando}
                  aoClicar={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Botao>
                <span className="solic-ajuda">
                  Página {pagina} de {totalPaginas}
                </span>
                <Botao
                  variante="secundario"
                  desabilitado={pagina >= totalPaginas || lista.carregando}
                  aoClicar={() => setPagina((p) => p + 1)}
                >
                  Próxima
                </Botao>
              </nav>
            )}
          </>
        )}
      </Cartao>
    </Pagina>
  );
}
