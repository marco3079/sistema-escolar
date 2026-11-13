import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { AreaTexto, Aviso, Botao, Caixa, Campo, Modal, Selecao, paraInputData } from '../../ui';
import {
  AlunoBusca,
  DESCRICAO_MAX,
  GRAVIDADES_OCORRENCIA,
  GravidadeOcorrencia,
  MEDIDAS_MAX,
  OcorrenciaDTO,
  ROTULO_GRAVIDADE,
  ROTULO_TIPO,
  TIPOS_OCORRENCIA,
  TITULO_MAX,
  TITULO_MIN,
  TipoOcorrencia,
  hojeIso,
} from './tipos';

const ESPERA_BUSCA_MS = 300;
const MINIMO_BUSCA = 2;
const LIMITE_RESULTADOS = 10;

// Modal de registro e edição de ocorrência. Sem `alunoId` (tela geral), mostra a busca de aluno ao criar.
export function FormularioOcorrencia({
  aberto,
  ocorrencia,
  alunoId,
  aoFechar,
  aoSalvo,
}: {
  aberto: boolean;
  ocorrencia: OcorrenciaDTO | null; // null = nova ocorrência
  alunoId?: number; // aluno fixo (ficha do aluno)
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  if (!aberto) return null;
  return (
    <Modal aberto titulo={ocorrencia ? 'Editar ocorrência' : 'Registrar ocorrência'} aoFechar={aoFechar}>
      <Formulario
        key={ocorrencia?.id ?? 'nova'}
        ocorrencia={ocorrencia}
        alunoId={alunoId}
        aoFechar={aoFechar}
        aoSalvo={aoSalvo}
      />
    </Modal>
  );
}

function Formulario({
  ocorrencia,
  alunoId,
  aoFechar,
  aoSalvo,
}: {
  ocorrencia: OcorrenciaDTO | null;
  alunoId?: number;
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  const editando = ocorrencia !== null;
  const [tipo, setTipo] = useState<string>(ocorrencia?.tipo ?? '');
  const [gravidade, setGravidade] = useState<GravidadeOcorrencia>(ocorrencia?.gravidade ?? 'LEVE');
  const [data, setData] = useState<string>(ocorrencia ? paraInputData(ocorrencia.data) : hojeIso());
  const [titulo, setTitulo] = useState(ocorrencia?.titulo ?? '');
  const [descricao, setDescricao] = useState(ocorrencia?.descricao ?? '');
  const [medidas, setMedidas] = useState(ocorrencia?.medidas ?? '');
  const [visivelFamilia, setVisivelFamilia] = useState(ocorrencia?.visivelFamilia ?? true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Escolha de aluno (só ao criar sem aluno fixo). Na edição o aluno é o da ocorrência.
  const [alunoEscolhido, setAlunoEscolhido] = useState<AlunoBusca | null>(null);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<AlunoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);

  const escolheAluno = !editando && alunoId === undefined;
  const alunoFinal: number | null = ocorrencia
    ? ocorrencia.aluno.id
    : alunoId ?? alunoEscolhido?.id ?? null;

  // Busca de aluno em GET /alunos?busca= (mesma rota da tela de matrícula), com espera de 300 ms.
  useEffect(() => {
    const t = termo.trim();
    if (!escolheAluno || alunoEscolhido !== null || t.length < MINIMO_BUSCA) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const timer = window.setTimeout(() => {
      api
        .get<AlunoBusca[]>('/alunos?busca=' + encodeURIComponent(t))
        .then((lista) => {
          if (!cancelado) setResultados(lista.slice(0, LIMITE_RESULTADOS));
        })
        .catch(() => {
          if (!cancelado) setResultados([]);
        })
        .finally(() => {
          if (!cancelado) setBuscando(false);
        });
    }, ESPERA_BUSCA_MS);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [termo, escolheAluno, alunoEscolhido]);

  function validar(): string | null {
    if (alunoFinal === null) return 'Escolha o aluno.';
    if (!tipo) return 'Escolha o tipo.';
    const t = titulo.trim();
    if (t.length < TITULO_MIN || t.length > TITULO_MAX) {
      return `O título deve ter de ${TITULO_MIN} a ${TITULO_MAX} caracteres.`;
    }
    const d = descricao.trim();
    if (d.length < 1 || d.length > DESCRICAO_MAX) {
      return `A descrição é obrigatória e pode ter até ${DESCRICAO_MAX} caracteres.`;
    }
    if (medidas.length > MEDIDAS_MAX) {
      return `As providências podem ter até ${MEDIDAS_MAX} caracteres.`;
    }
    if (!data) return 'Informe a data do fato.';
    if (data > hojeIso()) return 'A data não pode ser futura.';
    return null;
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }
    setEnviando(true);
    setErro(null);
    const corpo = {
      tipo: tipo as TipoOcorrencia,
      gravidade,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      medidas: medidas.trim(),
      data,
      visivelFamilia,
    };
    try {
      if (ocorrencia) {
        await api.put(`/ocorrencias/${ocorrencia.id}`, corpo);
      } else {
        await api.post('/ocorrencias', { alunoId: alunoFinal, ...corpo });
      }
      aoSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
      setEnviando(false);
    }
  }

  return (
    <form className="ocor-formulario" onSubmit={enviar} noValidate>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {escolheAluno && (
        <div className="ocor-campo-aluno">
          {alunoEscolhido ? (
            <div className="ocor-aluno-escolhido">
              <span>
                Aluno: <strong>{alunoEscolhido.usuario.nome}</strong> (RA {alunoEscolhido.ra})
              </span>
              <Botao variante="texto" aoClicar={() => setAlunoEscolhido(null)}>
                Trocar
              </Botao>
            </div>
          ) : (
            <>
              <Campo
                rotulo="Buscar aluno (nome, RA ou e-mail)"
                valor={termo}
                aoMudar={setTermo}
              />
              {buscando && <p className="ocor-ajuda">Buscando...</p>}
              {!buscando && termo.trim().length >= MINIMO_BUSCA && resultados.length === 0 && (
                <p className="ocor-ajuda">Nenhum aluno encontrado.</p>
              )}
              {resultados.length > 0 && (
                <ul className="ocor-resultados" aria-label="Alunos encontrados">
                  {resultados.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="ocor-resultado"
                        onClick={() => {
                          setAlunoEscolhido(a);
                          setResultados([]);
                          setTermo('');
                        }}
                      >
                        <span className="ocor-resultado-nome">{a.usuario.nome}</span>
                        <span className="ocor-resultado-ra">RA {a.ra}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div className="ocor-linha">
        <Selecao
          rotulo="Tipo"
          valor={tipo}
          aoMudar={setTipo}
          obrigatorio
          opcoes={TIPOS_OCORRENCIA.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] }))}
        />
        <Selecao
          rotulo="Gravidade"
          valor={gravidade}
          aoMudar={(v) => setGravidade(v as GravidadeOcorrencia)}
          obrigatorio
          vazio="Selecione"
          opcoes={GRAVIDADES_OCORRENCIA.map((g) => ({ valor: g, rotulo: ROTULO_GRAVIDADE[g] }))}
        />
      </div>

      <Campo rotulo="Data do fato" tipo="date" valor={data} aoMudar={setData} obrigatorio />

      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} obrigatorio />

      <AreaTexto rotulo="Descrição *" valor={descricao} aoMudar={setDescricao} linhas={4} />

      <AreaTexto rotulo="Providências" valor={medidas} aoMudar={setMedidas} linhas={3} />

      <Caixa
        rotulo="Mostrar para o aluno e os responsáveis"
        marcado={visivelFamilia}
        aoMudar={setVisivelFamilia}
      />

      <div className="ocor-acoes-modal">
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
        <Botao tipo="submit" desabilitado={enviando}>
          {enviando ? 'Salvando...' : editando ? 'Salvar' : 'Registrar'}
        </Botao>
      </div>
    </form>
  );
}
