import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Aviso, Botao, Carregando, Modal, MenuAcoes, Selo, Tabela, formatarDataHora } from '../../ui';
import type { AcaoMenu, ColunaTabela } from '../../ui';
import type { PropsAba } from './comum';
import { ItemGabaritoView } from './ProvaGabarito';
import { ProvaEditor } from './ProvaEditor';
import { ProvaFormulario } from './ProvaFormulario';
import { ProvaRealizar } from './ProvaRealizar';
import { ProvaResultados } from './ProvaResultados';
import {
  formatarNumero,
  mensagemErroProva,
  rotuloEstadoAluno,
  rotuloPontos,
} from './ProvaTipos';
import type {
  AvaliacaoOpcao,
  IniciarProvaResposta,
  MinhaProvaResposta,
  ProvaDTO,
} from './ProvaTipos';
import './provas.css';

// Aba "Provas" da sala de aula: professor e gestão editam e acompanham; o aluno faz as provas.
export function AbaProvas(props: PropsAba) {
  if (props.papel === 'ALUNO') {
    return <VisaoAluno turmaId={props.turmaId} />;
  }
  return <VisaoProfessor turmaId={props.turmaId} podeEditar={props.podeEditar} />;
}

// ---------- Professor e gestão ----------

function VisaoProfessor({ turmaId, podeEditar }: { turmaId: number; podeEditar: boolean }) {
  const [provas, setProvas] = useState<ProvaDTO[] | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoOpcao[]>([]);
  const [recarga, setRecarga] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [formulario, setFormulario] = useState<{ prova: ProvaDTO | null } | null>(null);
  const [editor, setEditor] = useState<ProvaDTO | null>(null);
  const [resultados, setResultados] = useState<ProvaDTO | null>(null);
  const [excluir, setExcluir] = useState<ProvaDTO | null>(null);

  function recarregar() {
    setRecarga((n) => n + 1);
  }

  useEffect(() => {
    let vivo = true;
    api
      .get<ProvaDTO[]>(`/salas/${turmaId}/provas`)
      .then((d) => {
        if (!vivo) return;
        setProvas(d);
        setErro(null);
      })
      .catch((e) => {
        if (vivo) setErro(mensagemErroProva(e));
      });
    return () => {
      vivo = false;
    };
  }, [turmaId, recarga]);

  // As avaliações do diário só servem para o formulário (edição).
  useEffect(() => {
    if (!podeEditar) return;
    let vivo = true;
    api
      .get<AvaliacaoOpcao[]>(`/salas/${turmaId}/avaliacoes`)
      .then((d) => {
        if (vivo) setAvaliacoes(d);
      })
      .catch(() => {
        if (vivo) setAvaliacoes([]);
      });
    return () => {
      vivo = false;
    };
  }, [turmaId, podeEditar, recarga]);

  async function publicar(prova: ProvaDTO) {
    setOcupado(true);
    setErro(null);
    try {
      await api.post(`/provas/${prova.id}/publicar`, { publicada: !prova.publicada });
      recarregar();
    } catch (e) {
      setErro(mensagemErroProva(e));
    } finally {
      setOcupado(false);
    }
  }

  async function apagar(prova: ProvaDTO) {
    setExcluir(null);
    setOcupado(true);
    setErro(null);
    try {
      await api.del(`/provas/${prova.id}`);
      recarregar();
    } catch (e) {
      setErro(mensagemErroProva(e));
    } finally {
      setOcupado(false);
    }
  }

  function acoesDe(prova: ProvaDTO): AcaoMenu[] {
    const acoes: AcaoMenu[] = [];
    if (podeEditar) {
      acoes.push({ rotulo: 'Editar dados', icone: 'lapis', aoClicar: () => setFormulario({ prova }) });
      acoes.push({ rotulo: 'Editar questões', icone: 'lista', aoClicar: () => setEditor(prova) });
      acoes.push({
        rotulo: prova.publicada ? 'Despublicar' : 'Publicar',
        icone: 'visto',
        aoClicar: () => void publicar(prova),
      });
    }
    acoes.push({ rotulo: 'Resultados', icone: 'grafico', aoClicar: () => setResultados(prova) });
    if (podeEditar) {
      acoes.push({ rotulo: 'Excluir', icone: 'lixeira', perigo: true, aoClicar: () => setExcluir(prova) });
    }
    return acoes;
  }

  const colunas: ColunaTabela<ProvaDTO>[] = [
    { titulo: 'Prova', celula: (p) => <span className="prova-titulo">{p.titulo}</span> },
    {
      titulo: 'Período',
      celula: (p) => `${formatarDataHora(p.abreEm)} até ${formatarDataHora(p.fechaEm)}`,
    },
    { titulo: 'Duração', celula: (p) => `${p.duracaoMin} min` },
    {
      titulo: 'Questões',
      celula: (p) => `${p.totalQuestoes} · ${formatarNumero(p.totalPontos)} pts`,
    },
    {
      titulo: 'Situação',
      celula: (p) => (p.publicada ? <Selo cor="verde">Publicada</Selo> : <Selo>Rascunho</Selo>),
    },
    {
      titulo: 'Respostas',
      celula: (p) => (p.resumo ? `${p.resumo.enviadas} de ${p.resumo.alunos}` : '—'),
    },
    {
      titulo: 'Ações',
      acoes: true,
      celula: (p) => <MenuAcoes rotulo={`Ações da prova ${p.titulo}`} acoes={acoesDe(p)} />,
    },
  ];

  return (
    <section className="prova-aba">
      <div className="prova-cabecalho-aba">
        <h2>Provas</h2>
        {podeEditar && (
          <Botao desabilitado={ocupado} aoClicar={() => setFormulario({ prova: null })}>
            Nova prova
          </Botao>
        )}
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {provas === null && erro === null && <Carregando />}
      {provas !== null && (
        <Tabela
          colunas={colunas}
          dados={provas}
          chave={(p) => p.id}
          vazio={podeEditar ? 'Nenhuma prova ainda. Use "Nova prova" para criar.' : 'Nenhuma prova nesta turma.'}
          exportar="provas"
        />
      )}

      {formulario && (
        <ProvaFormulario
          turmaId={turmaId}
          prova={formulario.prova}
          avaliacoes={avaliacoes}
          aoFechar={() => setFormulario(null)}
          aoSalvo={() => {
            setFormulario(null);
            recarregar();
          }}
        />
      )}

      {editor && (
        <ProvaEditor
          prova={editor}
          aoFechar={() => setEditor(null)}
          aoSalvo={() => {
            setEditor(null);
            recarregar();
          }}
        />
      )}

      {resultados && (
        <ProvaResultados
          prova={resultados}
          podeCorrigir={podeEditar}
          aoFechar={() => setResultados(null)}
          aoMudou={recarregar}
        />
      )}

      {excluir && (
        <Modal aberto titulo="Excluir prova?" aoFechar={() => setExcluir(null)}>
          <p className="prova-texto">
            A prova &quot;{excluir.titulo}&quot; será apagada junto com as questões e as tentativas dos alunos.
          </p>
          <div className="prova-acoes-modal">
            <Botao variante="secundario" aoClicar={() => setExcluir(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" aoClicar={() => void apagar(excluir)}>
              Excluir prova
            </Botao>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ---------- Aluno ----------

function VisaoAluno({ turmaId }: { turmaId: number }) {
  const [provas, setProvas] = useState<ProvaDTO[] | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<ProvaDTO | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [realizando, setRealizando] = useState<{ prova: ProvaDTO; dados: IniciarProvaResposta } | null>(null);
  const [minha, setMinha] = useState<ProvaDTO | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<ProvaDTO[]>(`/salas/${turmaId}/provas`)
      .then((d) => {
        if (!vivo) return;
        setProvas(d);
        setErro(null);
      })
      .catch((e) => {
        if (vivo) setErro(mensagemErroProva(e));
      });
    return () => {
      vivo = false;
    };
  }, [turmaId, recarga]);

  // Iniciar ou retomar: o servidor devolve a mesma tentativa se ela ainda não foi enviada.
  async function iniciar(prova: ProvaDTO) {
    setConfirmar(null);
    setIniciando(true);
    setErro(null);
    try {
      const dados = await api.post<IniciarProvaResposta>(`/provas/${prova.id}/iniciar`);
      setRealizando({ prova, dados });
    } catch (e) {
      setErro(mensagemErroProva(e));
      setRecarga((n) => n + 1);
    } finally {
      setIniciando(false);
    }
  }

  if (realizando) {
    return (
      <ProvaRealizar
        prova={realizando.prova}
        dados={realizando.dados}
        aoSair={() => {
          setRealizando(null);
          setRecarga((n) => n + 1);
        }}
      />
    );
  }

  return (
    <section className="prova-aba">
      <div className="prova-cabecalho-aba">
        <h2>Provas</h2>
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {provas === null && erro === null && <Carregando />}
      {provas !== null && provas.length === 0 && <p className="tabela-vazia">Nenhuma prova publicada nesta turma.</p>}

      {provas !== null && provas.length > 0 && (
        <ul className="prova-cartoes">
          {provas.map((p) => {
            const estado = rotuloEstadoAluno(p.estado);
            return (
              <li key={p.id} className="cartao prova-cartao">
                <div className="prova-cartao-topo">
                  <h3 className="prova-cartao-titulo">{p.titulo}</h3>
                  <Selo cor={estado.cor}>{estado.rotulo}</Selo>
                </div>
                <div className="prova-cartao-dados">
                  <span>Abre em {formatarDataHora(p.abreEm)}</span>
                  <span>Fecha em {formatarDataHora(p.fechaEm)}</span>
                  <span>Duração: {p.duracaoMin} min</span>
                  <span>
                    {p.totalQuestoes} {p.totalQuestoes === 1 ? 'questão' : 'questões'} · {rotuloPontos(p.totalPontos)}
                  </span>
                </div>
                {p.minhaNota !== undefined && p.minhaNota !== null && (
                  <p className="prova-nota-destaque">
                    Nota: {formatarNumero(p.minhaNota)} de {formatarNumero(p.notaMaxima)}
                  </p>
                )}
                <div className="prova-cartao-acoes">
                  {p.estado === 'ABERTA' && (
                    <Botao desabilitado={iniciando} aoClicar={() => setConfirmar(p)}>
                      Iniciar prova
                    </Botao>
                  )}
                  {p.estado === 'EM_ANDAMENTO' && (
                    <Botao desabilitado={iniciando} aoClicar={() => void iniciar(p)}>
                      Continuar prova
                    </Botao>
                  )}
                  {p.estado === 'ENVIADA' && (
                    <Botao variante="secundario" aoClicar={() => setMinha(p)}>
                      Ver resultado
                    </Botao>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirmar && (
        <Modal aberto titulo="Iniciar prova?" aoFechar={() => setConfirmar(null)}>
          <p className="prova-texto">
            Você terá {confirmar.duracaoMin} minutos para responder {confirmar.totalQuestoes}{' '}
            {confirmar.totalQuestoes === 1 ? 'questão' : 'questões'}. O tempo começa agora e corre no servidor,
            mesmo se você sair da página. Quando o tempo acabar, a prova é enviada sozinha.
          </p>
          {confirmar.instrucoes.trim() !== '' && (
            <>
              <p className="prova-rotulo-pequeno">Instruções</p>
              <p className="prova-texto">{confirmar.instrucoes}</p>
            </>
          )}
          <div className="prova-acoes-modal">
            <Botao variante="secundario" aoClicar={() => setConfirmar(null)}>
              Cancelar
            </Botao>
            <Botao desabilitado={iniciando} aoClicar={() => void iniciar(confirmar)}>
              Iniciar agora
            </Botao>
          </div>
        </Modal>
      )}

      {minha && <ResultadoAluno prova={minha} aoFechar={() => setMinha(null)} />}
    </section>
  );
}

// Nota e gabarito (quando liberado) da prova do aluno.
function ResultadoAluno({ prova, aoFechar }: { prova: ProvaDTO; aoFechar: () => void }) {
  const [dados, setDados] = useState<MinhaProvaResposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<MinhaProvaResposta>(`/provas/${prova.id}/minha`)
      .then((d) => {
        if (vivo) setDados(d);
      })
      .catch((e) => {
        if (vivo) setErro(mensagemErroProva(e));
      });
    return () => {
      vivo = false;
    };
  }, [prova.id]);

  return (
    <Modal aberto titulo={`Resultado: ${prova.titulo}`} aoFechar={aoFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!erro && dados === null && <Carregando />}
      {dados && (
        <>
          {dados.corrigida && dados.notaFinal !== null ? (
            <p className="prova-nota-destaque">
              Nota: {formatarNumero(dados.notaFinal)} de {formatarNumero(prova.notaMaxima)}
            </p>
          ) : (
            <p className="prova-texto">Aguardando a correção das questões dissertativas.</p>
          )}
          {dados.gabarito === null ? (
            <p className="prova-nota-pequena">O gabarito ainda não está disponível.</p>
          ) : (
            dados.gabarito.map((item, i) => (
              <ItemGabaritoView key={item.questaoId} item={item} numero={i + 1} />
            ))
          )}
        </>
      )}
    </Modal>
  );
}
