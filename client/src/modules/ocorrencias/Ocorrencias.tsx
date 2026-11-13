import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import {
  Aviso,
  Botao,
  Campo,
  Carregando,
  MenuAcoes,
  Modal,
  Pagina,
  Selecao,
  Tabela,
  formatarData,
} from '../../ui';
import { FormularioOcorrencia } from './FormularioOcorrencia';
import { SeloGravidade, SeloTipo } from './ListaOcorrencias';
import {
  GRAVIDADES_OCORRENCIA,
  OcorrenciaDTO,
  PaginaOcorrencias,
  ROTULO_GRAVIDADE,
  ROTULO_TIPO,
  ResumoOcorrencias,
  TIPOS_OCORRENCIA,
} from './tipos';
import './ocorrencias.css';

const ESPERA_BUSCA_MS = 350;

// Tela de ocorrências: gestão (ADMIN e SECRETARIA, com resumo) e professor (só as que ele registrou).
export function Ocorrencias({ gestao }: { gestao: boolean }) {
  const [tipo, setTipo] = useState<string>('');
  const [gravidade, setGravidade] = useState<string>('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [pagina, setPagina] = useState(1);

  const [formulario, setFormulario] = useState<{ aberto: boolean; ocorrencia: OcorrenciaDTO | null }>({
    aberto: false,
    ocorrencia: null,
  });
  const [excluir, setExcluir] = useState<OcorrenciaDTO | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // A busca de texto só vai à API depois de uma pausa de digitação.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPagina(1);
    }, ESPERA_BUSCA_MS);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const parametros = new URLSearchParams();
  parametros.set('pagina', String(pagina));
  if (tipo) parametros.set('tipo', tipo);
  if (gravidade) parametros.set('gravidade', gravidade);
  if (de) parametros.set('de', de);
  if (ate) parametros.set('ate', ate);
  if (buscaAplicada) parametros.set('busca', buscaAplicada);

  const resumo = useDados<ResumoOcorrencias>(gestao ? '/ocorrencias/resumo' : null);
  const lista = useDados<PaginaOcorrencias>(`/ocorrencias?${parametros.toString()}`);

  function mudarFiltro(aplicar: () => void) {
    aplicar();
    setPagina(1);
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    setOcupado(true);
    setErroAcao(null);
    try {
      await api.del(`/ocorrencias/${excluir.id}`);
      setExcluir(null);
      lista.recarregar();
      if (gestao) resumo.recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setOcupado(false);
    }
  }

  function aoSalvo() {
    setFormulario({ aberto: false, ocorrencia: null });
    lista.recarregar();
    if (gestao) resumo.recarregar();
  }

  const dados = lista.dados;
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <Pagina
      titulo="Ocorrências"
      acoes={
        <Botao aoClicar={() => setFormulario({ aberto: true, ocorrencia: null })}>
          Registrar ocorrência
        </Botao>
      }
    >
      {gestao && (
        <section className="ocor-resumo" aria-label="Resumo das ocorrências">
          {resumo.erro && <Aviso tipo="erro">{resumo.erro}</Aviso>}
          {resumo.dados && (
            <>
              <ResumoItem rotulo="Últimos 30 dias" valor={resumo.dados.ultimos30Dias} />
              <ResumoItem rotulo="Sem ciência" valor={resumo.dados.semCiencia} />
              <ResumoItem rotulo="Graves" valor={resumo.dados.porGravidade.GRAVE} />
              <ResumoItem rotulo="Elogios" valor={resumo.dados.porTipo.ELOGIO} />
            </>
          )}
          {!resumo.dados && resumo.carregando && <Carregando />}
        </section>
      )}

      <div className="ocor-filtros">
        <Campo rotulo="Buscar" valor={busca} aoMudar={setBusca} />
        <Selecao
          rotulo="Tipo"
          valor={tipo}
          aoMudar={(v) => mudarFiltro(() => setTipo(v))}
          opcoes={TIPOS_OCORRENCIA.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] }))}
          vazio="Todos"
        />
        <Selecao
          rotulo="Gravidade"
          valor={gravidade}
          aoMudar={(v) => mudarFiltro(() => setGravidade(v))}
          opcoes={GRAVIDADES_OCORRENCIA.map((g) => ({ valor: g, rotulo: ROTULO_GRAVIDADE[g] }))}
          vazio="Todas"
        />
        <Campo rotulo="Data inicial" tipo="date" valor={de} aoMudar={(v) => mudarFiltro(() => setDe(v))} />
        <Campo rotulo="Data final" tipo="date" valor={ate} aoMudar={(v) => mudarFiltro(() => setAte(v))} />
      </div>

      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}

      {!dados && lista.carregando && <Carregando />}

      {dados && (
        <>
          <Tabela<OcorrenciaDTO>
            exportar="ocorrencias"
            colunas={[
              { titulo: 'Data', celula: (o) => formatarData(o.data) },
              {
                titulo: 'Aluno',
                celula: (o) => (
                  <span className="ocor-aluno">
                    <strong>{o.aluno.nome}</strong>
                    <small className="ocor-suave">RA {o.aluno.ra}</small>
                  </span>
                ),
              },
              { titulo: 'Tipo', celula: (o) => <SeloTipo tipo={o.tipo} /> },
              { titulo: 'Gravidade', celula: (o) => <SeloGravidade gravidade={o.gravidade} /> },
              { titulo: 'Título', celula: (o) => o.titulo },
              { titulo: 'Autor', celula: (o) => o.autor.nome },
              { titulo: 'Ciência', celula: (o) => textoCiencia(o) },
              {
                titulo: 'Ações',
                acoes: true,
                celula: (o) =>
                  o.podeEditar ? (
                    <MenuAcoes
                      rotulo={`Ações da ocorrência ${o.titulo} de ${o.aluno.nome}`}
                      acoes={[
                        {
                          rotulo: 'Editar',
                          icone: 'lapis',
                          aoClicar: () => setFormulario({ aberto: true, ocorrencia: o }),
                        },
                        {
                          rotulo: 'Excluir',
                          icone: 'lixeira',
                          perigo: true,
                          aoClicar: () => {
                            setErroAcao(null);
                            setExcluir(o);
                          },
                        },
                      ]}
                    />
                  ) : (
                    '—'
                  ),
              },
            ]}
            dados={dados.itens}
            chave={(o) => o.id}
            vazio="Nenhuma ocorrência encontrada."
          />

          {dados.total > dados.porPagina && (
            <nav className="ocor-paginacao" aria-label="Paginação">
              <Botao
                variante="secundario"
                desabilitado={pagina <= 1 || lista.carregando}
                aoClicar={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Botao>
              <span className="ocor-suave">
                Página {pagina} de {totalPaginas}
              </span>
              <Botao
                variante="secundario"
                desabilitado={pagina >= totalPaginas || lista.carregando}
                aoClicar={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              >
                Próxima
              </Botao>
            </nav>
          )}
        </>
      )}

      <FormularioOcorrencia
        aberto={formulario.aberto}
        ocorrencia={formulario.ocorrencia}
        aoFechar={() => setFormulario({ aberto: false, ocorrencia: null })}
        aoSalvo={aoSalvo}
      />

      <Modal aberto={excluir !== null} titulo="Excluir ocorrência" aoFechar={() => setExcluir(null)}>
        <p>
          Excluir o registro “{excluir?.titulo}” de {excluir?.aluno.nome}? Esta ação não pode ser desfeita.
        </p>
        <div className="ocor-acoes-modal">
          <Botao variante="secundario" aoClicar={() => setExcluir(null)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" desabilitado={ocupado} aoClicar={confirmarExclusao}>
            {ocupado ? 'Excluindo...' : 'Excluir'}
          </Botao>
        </div>
      </Modal>
    </Pagina>
  );
}

function ResumoItem({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="ocor-resumo-item">
      <span className="ocor-resumo-valor">{valor}</span>
      <span className="ocor-resumo-rotulo">{rotulo}</span>
    </div>
  );
}

// Coluna Ciência: data da ciência, pendente (visível à família) ou interna.
function textoCiencia(o: OcorrenciaDTO): string {
  if (o.cienteEm) return `Ciente em ${formatarData(o.cienteEm)}`;
  return o.visivelFamilia ? 'Pendente' : 'Interna';
}
