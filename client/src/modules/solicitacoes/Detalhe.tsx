import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useDados } from '../../lib/useDados';
import { rotuloNivel } from '../../lib/tipos';
import { ListaArquivos } from '../../ui/Arquivos';
import {
  AreaTexto,
  Aviso,
  Botao,
  Caixa,
  Cartao,
  Carregando,
  formatarData,
  formatarDataHora,
  Grade,
  Modal,
  Pagina,
} from '../../ui';
import { BotaoCopiar, SeloStatus, SeloTipo } from './MatriculaOnline';
import type { AprovacaoDTO, SolicitacaoDTO } from './tipos';
import { nomeDoCurso } from './tipos';
import './solicitacoes.css';

// Detalhe de um pedido da secretaria: dados, documentos, parecer e as ações de análise.

type AcaoModal = 'APROVAR' | 'RECUSAR' | 'EXCLUIR' | null;

interface ResultadoAprovacao {
  dados: AprovacaoDTO;
  avancou: boolean;
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Linha de dado (rótulo e valor); valor vazio vira travessão.
function Dado({ rotulo, children }: { rotulo: string; children?: ReactNode }) {
  const vazio = children === null || children === undefined || children === '' || children === false;
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{vazio ? '—' : children}</dd>
    </div>
  );
}

// Senha mostrada uma única vez, com botão de copiar.
function SenhaUnica({ rotulo, senha }: { rotulo: string; senha: string }) {
  return (
    <div className="solic-destaque">
      <span className="solic-rotulo-destaque">{rotulo}</span>
      <strong className="solic-valor solic-chave">{senha}</strong>
      <BotaoCopiar texto={senha} rotulo={rotulo.toLowerCase()} />
    </div>
  );
}

// Resumo do que foi criado ou alterado ao aprovar. As senhas iniciais só aparecem aqui.
function ResumoAprovacao({
  resultado,
  avancou,
  ehRematricula,
  pedirResponsavel,
}: {
  resultado: AprovacaoDTO;
  avancou: boolean;
  ehRematricula: boolean;
  pedirResponsavel: boolean;
}) {
  const responsavel = resultado.responsavel;
  return (
    <div className="solic-resultado-aprovacao" aria-live="polite">
      <Aviso tipo="sucesso">
        {ehRematricula
          ? `Rematrícula aprovada${avancou ? ', com avanço de série' : ''}.`
          : 'Matrícula aprovada: aluno e matrícula criados.'}
      </Aviso>
      <p className="solic-ajuda">
        Aluno: {resultado.solicitacao.nome}. <Link to="/admin/alunos">Abrir a lista de alunos</Link> para ver a ficha.
      </p>
      {resultado.senhaInicial && <SenhaUnica rotulo="Senha inicial do aluno" senha={resultado.senhaInicial} />}
      {responsavel && (
        <p className="solic-ajuda">
          Responsável: {responsavel.usuarioCriado ? 'acesso criado' : 'acesso existente vinculado ao aluno'}
          {responsavel.conviteEnviado ? '; convite de senha enviado por e-mail' : ''}.
        </p>
      )}
      {responsavel?.senhaInicial && (
        <SenhaUnica rotulo="Senha inicial do responsável" senha={responsavel.senhaInicial} />
      )}
      {pedirResponsavel && !responsavel && (
        <Aviso tipo="info">O acesso do responsável não foi criado. Faça o vínculo pelo cadastro do aluno.</Aviso>
      )}
      {(resultado.senhaInicial || responsavel?.senhaInicial) && (
        <Aviso tipo="info">As senhas iniciais são mostradas uma única vez: copie antes de sair desta tela.</Aviso>
      )}
    </div>
  );
}

export function Detalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const numeroId = Number(id);
  const caminho = id && Number.isInteger(numeroId) && numeroId > 0 ? `/solicitacoes/${numeroId}` : null;
  const consulta = useDados<SolicitacaoDTO>(caminho);
  const pedido = consulta.dados;

  // Parecer em edição: começa com o que está gravado no pedido.
  const [parecerEditado, setParecerEditado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [modal, setModal] = useState<AcaoModal>(null);
  const [parecerAprovacao, setParecerAprovacao] = useState('');
  const [avancarSerie, setAvancarSerie] = useState(false);
  const [criarResponsavel, setCriarResponsavel] = useState(true);
  const [erroAprovacao, setErroAprovacao] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoAprovacao | null>(null);

  if (consulta.carregando && pedido === null) {
    return (
      <Pagina titulo="Pedido">
        <Carregando />
      </Pagina>
    );
  }

  if (pedido === null) {
    return (
      <Pagina
        titulo="Pedido"
        acoes={
          <Botao variante="secundario" aoClicar={() => navigate('/admin/solicitacoes')}>
            Voltar à fila
          </Botao>
        }
      >
        <Aviso tipo="erro">{consulta.erro ?? 'Pedido não encontrado.'}</Aviso>
      </Pagina>
    );
  }

  const idPedido = pedido.id;
  const parecer = parecerEditado ?? pedido.parecer;
  const emAberto = pedido.status === 'ENVIADA' || pedido.status === 'EM_ANALISE' || pedido.status === 'PENDENTE';
  const ehRematricula = pedido.tipo === 'REMATRICULA';
  const temResponsavel = Boolean(pedido.responsavelNome || pedido.responsavelEmail);
  const podeExcluir = usuario?.perfil === 'ADMIN' && pedido.status === 'RECUSADA';

  function atualizarPedido(): void {
    setParecerEditado(null);
    consulta.recarregar();
  }

  // Muda a situação do pedido (PUT /solicitacoes/:id/status).
  async function mudarStatus(novo: 'EM_ANALISE' | 'PENDENTE' | 'RECUSADA', mensagem: string): Promise<boolean> {
    const texto = parecer.trim();
    if ((novo === 'PENDENTE' || novo === 'RECUSADA') && !texto) {
      setErro('Escreva o parecer: ele é obrigatório para pedir documentos ou recusar o pedido.');
      return false;
    }
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await api.put(`/solicitacoes/${idPedido}/status`, { status: novo, parecer: texto });
      setAviso(mensagem);
      atualizarPedido();
      return true;
    } catch (e) {
      setErro(mensagemDe(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function abrirAprovacao(): void {
    setErroAprovacao(null);
    setParecerAprovacao('');
    setAvancarSerie(false);
    setCriarResponsavel(true);
    setModal('APROVAR');
  }

  // Aprova o pedido (POST /solicitacoes/:id/aprovar). As senhas iniciais aparecem só no resumo.
  async function aprovar(): Promise<void> {
    setErroAprovacao(null);
    setOcupado(true);
    const avancar = ehRematricula && avancarSerie;
    try {
      const resposta = await api.post<AprovacaoDTO>(`/solicitacoes/${idPedido}/aprovar`, {
        parecer: parecerAprovacao.trim() || undefined,
        avancarSerie: avancar,
        criarResponsavel: !ehRematricula && temResponsavel ? criarResponsavel : false,
      });
      setResultado({ dados: resposta, avancou: avancar });
      setModal(null);
      setAviso(null);
      setErro(null);
      atualizarPedido();
    } catch (e) {
      setErroAprovacao(mensagemDe(e));
    } finally {
      setOcupado(false);
    }
  }

  // Recusa: o parecer já é conferido no próprio modal antes da confirmação.
  async function recusar(): Promise<void> {
    if (await mudarStatus('RECUSADA', 'Pedido recusado.')) setModal(null);
  }

  // Exclui pedido recusado (só ADMIN).
  async function excluir(): Promise<void> {
    setErro(null);
    setOcupado(true);
    try {
      await api.del(`/solicitacoes/${idPedido}`);
      navigate('/admin/solicitacoes');
    } catch (e) {
      setErro(mensagemDe(e));
      setModal(null);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pagina
      titulo={`Pedido ${pedido.protocolo}`}
      acoes={
        <Botao variante="secundario" aoClicar={() => navigate('/admin/solicitacoes')}>
          Voltar à fila
        </Botao>
      }
    >
      <Cartao titulo="Situação">
        <div className="solic-linha">
          <SeloTipo tipo={pedido.tipo} />
          <SeloStatus status={pedido.status} />
          <span className="solic-ajuda">
            Pedido em {formatarDataHora(pedido.criadoEm)}. Atualizado em {formatarDataHora(pedido.atualizadoEm)}.
          </span>
        </div>
        {pedido.analisadoPor && (
          <p className="solic-ajuda">
            Analisado por {pedido.analisadoPor.nome}
            {pedido.analisadoEm ? ` em ${formatarDataHora(pedido.analisadoEm)}` : ''}.
          </p>
        )}
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {resultado && (
          <ResumoAprovacao
            resultado={resultado.dados}
            avancou={resultado.avancou}
            ehRematricula={ehRematricula}
            pedirResponsavel={!ehRematricula && temResponsavel && criarResponsavel}
          />
        )}

        <div className="solic-acoes">
          {(pedido.status === 'ENVIADA' || pedido.status === 'PENDENTE') && (
            <Botao
              variante="secundario"
              desabilitado={ocupado}
              aoClicar={() => void mudarStatus('EM_ANALISE', 'Pedido em análise.')}
            >
              Colocar em análise
            </Botao>
          )}
          {(pedido.status === 'ENVIADA' || pedido.status === 'EM_ANALISE') && (
            <Botao
              variante="secundario"
              desabilitado={ocupado}
              aoClicar={() => void mudarStatus('PENDENTE', 'Documentos solicitados ao candidato.')}
            >
              Pedir documentos
            </Botao>
          )}
          {emAberto && (
            <>
              <Botao desabilitado={ocupado} aoClicar={abrirAprovacao}>
                Aprovar
              </Botao>
              <Botao variante="perigo" desabilitado={ocupado} aoClicar={() => setModal('RECUSAR')}>
                Recusar
              </Botao>
            </>
          )}
          {podeExcluir && (
            <Botao variante="perigo" desabilitado={ocupado} aoClicar={() => setModal('EXCLUIR')}>
              Excluir pedido
            </Botao>
          )}
        </div>
      </Cartao>

      <Grade>
        <Cartao titulo="Candidato">
          <dl className="solic-dados">
            <Dado rotulo="Nome">{pedido.nome}</Dado>
            <Dado rotulo="E-mail">{pedido.email}</Dado>
            <Dado rotulo="CPF">{pedido.cpf}</Dado>
            <Dado rotulo="Data de nascimento">{pedido.dataNascimento ? formatarData(pedido.dataNascimento) : ''}</Dado>
            <Dado rotulo="Telefone">{pedido.telefone}</Dado>
            <Dado rotulo="Endereço">{pedido.endereco}</Dado>
          </dl>
        </Cartao>

        <Cartao titulo="Curso">
          <dl className="solic-dados">
            <Dado rotulo="Curso">{nomeDoCurso(pedido.curso)}</Dado>
            <Dado rotulo="Nível">{typeof pedido.curso === 'string' ? '' : rotuloNivel(pedido.curso.nivel)}</Dado>
            <Dado rotulo="Período">{pedido.periodoLetivo?.nome ?? ''}</Dado>
            <Dado rotulo="Aluno no sistema">
              {pedido.alunoId ? <Link to="/admin/alunos">Ver na lista de alunos</Link> : ''}
            </Dado>
          </dl>
        </Cartao>

        <Cartao titulo="Responsável">
          {temResponsavel || pedido.responsavelTelefone || pedido.responsavelParentesco ? (
            <dl className="solic-dados">
              <Dado rotulo="Nome">{pedido.responsavelNome}</Dado>
              <Dado rotulo="E-mail">{pedido.responsavelEmail}</Dado>
              <Dado rotulo="Telefone">{pedido.responsavelTelefone}</Dado>
              <Dado rotulo="Parentesco">{pedido.responsavelParentesco}</Dado>
            </dl>
          ) : (
            <p className="solic-ajuda">Nenhum responsável informado.</p>
          )}
        </Cartao>

        <Cartao titulo="Documentos">
          {pedido.documentos.length === 0 ? (
            <p className="solic-ajuda">Nenhum documento enviado.</p>
          ) : (
            <ListaArquivos arquivos={pedido.documentos} />
          )}
        </Cartao>
      </Grade>

      {pedido.observacao && (
        <Cartao titulo="Observação do candidato">
          <p className="solic-texto">{pedido.observacao}</p>
        </Cartao>
      )}

      <Cartao titulo="Parecer">
        <p className="solic-ajuda">
          O parecer é enviado ao candidato por e-mail. É obrigatório para pedir documentos e para recusar.
        </p>
        <AreaTexto rotulo="Parecer" valor={parecer} aoMudar={setParecerEditado} linhas={4} />
      </Cartao>

      <Modal aberto={modal === 'APROVAR'} titulo="Aprovar pedido" aoFechar={() => setModal(null)}>
        <div className="solic-modal">
          <p>
            {ehRematricula
              ? 'A matrícula volta a ficar ativa.'
              : 'Serão criados o aluno e a matrícula (série 1) a partir dos dados do pedido.'}
          </p>
          {ehRematricula && (
            <Caixa
              rotulo="Avançar de série (soma 1 à série atual, se o curso tiver mais séries)"
              marcado={avancarSerie}
              aoMudar={setAvancarSerie}
            />
          )}
          {!ehRematricula && temResponsavel && (
            <Caixa rotulo="Criar acesso do responsável" marcado={criarResponsavel} aoMudar={setCriarResponsavel} />
          )}
          <AreaTexto rotulo="Parecer (opcional)" valor={parecerAprovacao} aoMudar={setParecerAprovacao} linhas={3} />
          {erroAprovacao && <Aviso tipo="erro">{erroAprovacao}</Aviso>}
          <div className="solic-acoes">
            <Botao variante="texto" desabilitado={ocupado} aoClicar={() => setModal(null)}>
              Cancelar
            </Botao>
            <Botao desabilitado={ocupado} aoClicar={() => void aprovar()}>
              {ocupado ? 'Aprovando...' : 'Aprovar'}
            </Botao>
          </div>
        </div>
      </Modal>

      <Modal aberto={modal === 'RECUSAR'} titulo="Recusar pedido" aoFechar={() => setModal(null)}>
        <div className="solic-modal">
          <p>O candidato será avisado por e-mail com o parecer. Confirma a recusa?</p>
          {!parecer.trim() && <Aviso tipo="info">Escreva o parecer no cartão Parecer antes de recusar.</Aviso>}
          <div className="solic-acoes">
            <Botao variante="texto" desabilitado={ocupado} aoClicar={() => setModal(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" desabilitado={ocupado || !parecer.trim()} aoClicar={() => void recusar()}>
              Recusar pedido
            </Botao>
          </div>
        </div>
      </Modal>

      <Modal aberto={modal === 'EXCLUIR'} titulo="Excluir pedido" aoFechar={() => setModal(null)}>
        <div className="solic-modal">
          <p>O pedido e os documentos enviados serão apagados. Esta ação não pode ser desfeita.</p>
          <div className="solic-acoes">
            <Botao variante="texto" desabilitado={ocupado} aoClicar={() => setModal(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" desabilitado={ocupado} aoClicar={() => void excluir()}>
              Excluir
            </Botao>
          </div>
        </div>
      </Modal>
    </Pagina>
  );
}
