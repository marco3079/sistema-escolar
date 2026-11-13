import { useState } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Caixa, Carregando, MenuAcoes, Modal, Selo, formatarData } from '../../ui';
import { FormularioOcorrencia } from './FormularioOcorrencia';
import {
  COR_GRAVIDADE,
  COR_TIPO,
  OcorrenciaDTO,
  ROTULO_GRAVIDADE,
  ROTULO_TIPO,
  GravidadeOcorrencia,
  TipoOcorrencia,
} from './tipos';
import './ocorrencias.css';

// Selo do tipo (cor do tipo como texto, fundo suave pelo CSS).
export function SeloTipo({ tipo }: { tipo: TipoOcorrencia }) {
  return (
    <span className="ocor-selo" style={{ color: COR_TIPO[tipo] }}>
      {ROTULO_TIPO[tipo]}
    </span>
  );
}

// Selo da gravidade (leve, média ou grave).
export function SeloGravidade({ gravidade }: { gravidade: GravidadeOcorrencia }) {
  return (
    <span className="ocor-selo" style={{ color: COR_GRAVIDADE[gravidade] }}>
      {ROTULO_GRAVIDADE[gravidade]}
    </span>
  );
}

// Texto da situação da ciência: "Ciência de {nome} em {data}" ou "Aguardando ciência do responsável".
function situacaoCiencia(o: OcorrenciaDTO): string | null {
  if (o.cienteEm) {
    const quem = o.cientePor?.nome ?? 'responsável';
    return `Ciência de ${quem} em ${formatarData(o.cienteEm)}`;
  }
  // Ocorrência interna (não visível para a família) não pede ciência.
  if (o.visivelFamilia) return 'Aguardando ciência do responsável';
  return null;
}

// Lista de ocorrências de um aluno em cartões. 'gestao' registra, edita e exclui; 'familia' só lê e dá ciência.
export function ListaOcorrencias({ alunoId, modo }: { alunoId: number; modo: 'gestao' | 'familia' }) {
  const { dados, carregando, erro, recarregar } = useDados<OcorrenciaDTO[]>(
    `/alunos/${alunoId}/ocorrencias`,
  );

  const [formulario, setFormulario] = useState<{ aberto: boolean; ocorrencia: OcorrenciaDTO | null }>({
    aberto: false,
    ocorrencia: null,
  });
  const [excluir, setExcluir] = useState<OcorrenciaDTO | null>(null);
  const [ciencia, setCiencia] = useState<OcorrenciaDTO | null>(null);
  const [confirmouLeitura, setConfirmouLeitura] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function confirmarExclusao() {
    if (!excluir) return;
    setOcupado(true);
    setErroAcao(null);
    try {
      await api.del(`/ocorrencias/${excluir.id}`);
      setExcluir(null);
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarCiencia() {
    if (!ciencia) return;
    setOcupado(true);
    setErroAcao(null);
    try {
      await api.post(`/ocorrencias/${ciencia.id}/ciencia`);
      setCiencia(null);
      setConfirmouLeitura(false);
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="ocor-lista">
      {modo === 'gestao' && (
        <div className="ocor-topo">
          <Botao aoClicar={() => setFormulario({ aberto: true, ocorrencia: null })}>
            Registrar ocorrência
          </Botao>
        </div>
      )}

      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando && dados === null && <Carregando />}

      {dados !== null && dados.length === 0 && (
        <p className="ocor-vazio">Nenhuma ocorrência registrada.</p>
      )}

      {dados !== null && dados.length > 0 && (
        <ul className="ocor-cartoes">
          {dados.map((o) => {
            const situacao = situacaoCiencia(o);
            return (
              <li key={o.id} className="ocor-cartao">
                <div className="ocor-cartao-topo">
                  <div className="ocor-selos">
                    <SeloTipo tipo={o.tipo} />
                    <SeloGravidade gravidade={o.gravidade} />
                  </div>
                  <span className="ocor-data">{formatarData(o.data)}</span>
                </div>

                <h3 className="ocor-titulo">{o.titulo}</h3>
                <p className="ocor-meta">
                  Registrada por {o.autor.nome}
                  {o.turma ? ` · Turma ${o.turma.codigo} (${o.turma.disciplina})` : ''}
                </p>
                <p className="ocor-texto">{o.descricao}</p>

                {o.medidas && (
                  <div className="ocor-bloco">
                    <span className="ocor-rotulo">Providências</span>
                    <p className="ocor-texto">{o.medidas}</p>
                  </div>
                )}

                <div className="ocor-rodape">
                  <div className="ocor-situacao">
                    {modo === 'gestao' && !o.visivelFamilia && (
                      <Selo cor="cinza">Interna: não aparece para a família</Selo>
                    )}
                    {situacao && <span className="ocor-ciencia">{situacao}</span>}
                  </div>

                  <div className="ocor-acoes">
                    {modo === 'familia' && o.podeDarCiencia && (
                      <Botao
                        variante="secundario"
                        aoClicar={() => {
                          setConfirmouLeitura(false);
                          setErroAcao(null);
                          setCiencia(o);
                        }}
                      >
                        Dar ciência
                      </Botao>
                    )}
                    {modo === 'gestao' && o.podeEditar && (
                      <MenuAcoes
                        rotulo={`Ações da ocorrência ${o.titulo}`}
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
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modo === 'gestao' && (
        <FormularioOcorrencia
          aberto={formulario.aberto}
          ocorrencia={formulario.ocorrencia}
          alunoId={alunoId}
          aoFechar={() => setFormulario({ aberto: false, ocorrencia: null })}
          aoSalvo={() => {
            setFormulario({ aberto: false, ocorrencia: null });
            recarregar();
          }}
        />
      )}

      <Modal aberto={excluir !== null} titulo="Excluir ocorrência" aoFechar={() => setExcluir(null)}>
        <p>Excluir o registro “{excluir?.titulo}”? Esta ação não pode ser desfeita.</p>
        <div className="ocor-acoes-modal">
          <Botao variante="secundario" aoClicar={() => setExcluir(null)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" desabilitado={ocupado} aoClicar={confirmarExclusao}>
            {ocupado ? 'Excluindo...' : 'Excluir'}
          </Botao>
        </div>
      </Modal>

      <Modal aberto={ciencia !== null} titulo="Dar ciência" aoFechar={() => setCiencia(null)}>
        <p>
          Ao dar ciência, fica registrado que você tomou conhecimento deste registro de “{ciencia?.titulo}”.
        </p>
        <Caixa
          rotulo="Confirmo que li este registro"
          marcado={confirmouLeitura}
          aoMudar={setConfirmouLeitura}
        />
        <div className="ocor-acoes-modal">
          <Botao variante="secundario" aoClicar={() => setCiencia(null)}>
            Cancelar
          </Botao>
          <Botao
            desabilitado={!confirmouLeitura || ocupado}
            aoClicar={confirmarCiencia}
          >
            {ocupado ? 'Registrando...' : 'Dar ciência'}
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
