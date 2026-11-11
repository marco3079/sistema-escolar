import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import type { RotaModulo } from '../../lib/rotas';
import { useDados } from '../../lib/useDados';
import { rotuloNivel } from '../../lib/tipos';
import { Aviso, Botao, Cartao, Carregando, Grade, Modal, Pagina, Selecao, Selo, Tabela } from '../../ui';
import type { ColunaTabela } from '../../ui';
import { DetalheProjeto } from './DetalheProjeto';
import { FormNovoProjeto } from './formularios';
import { STATUS_PROJETO, corStatus, rotuloStatus } from './apoio';
import type { ProjetoDTO } from './tipos';

const OPCOES_STATUS = STATUS_PROJETO.map((s) => ({ valor: s.valor, rotulo: s.rotulo }));

// ---------- Administrativo: /admin/pos ----------

const COLUNAS_ADMIN: ColunaTabela<ProjetoDTO>[] = [
  { titulo: 'Aluno', celula: (p) => p.matricula.aluno.usuario.nome },
  { titulo: 'Curso', celula: (p) => p.matricula.curso.nome },
  { titulo: 'Nível', celula: (p) => rotuloNivel(p.matricula.curso.nivel) },
  { titulo: 'Título', celula: (p) => p.titulo },
  { titulo: 'Orientador', celula: (p) => p.orientador.usuario.nome },
  {
    titulo: 'Status',
    celula: (p) => <Selo cor={corStatus(p.status)}>{rotuloStatus(p.status)}</Selo>,
  },
];

function PosAdmin() {
  const [status, setStatus] = useState('');
  const [novo, setNovo] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const lista = useDados<ProjetoDTO[]>(`/pos/projetos${status ? `?status=${status}` : ''}`);
  const detalhe = useDados<ProjetoDTO>(
    selecionadoId === null ? null : `/pos/projetos/${selecionadoId}`
  );

  function atualizarTudo() {
    lista.recarregar();
    detalhe.recarregar();
  }

  const acoes = selecionadoId === null ? (
    <Botao aoClicar={() => setNovo(true)}>Novo projeto</Botao>
  ) : undefined;

  return (
    <Pagina titulo="Pós-graduação" acoes={acoes}>
      {selecionadoId === null ? (
        <>
          <Selecao
            rotulo="Status"
            valor={status}
            aoMudar={setStatus}
            opcoes={OPCOES_STATUS}
            vazio="Todos os status"
          />
          {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
          {lista.carregando ? (
            <Carregando />
          ) : (
            <Tabela
              colunas={COLUNAS_ADMIN}
              dados={lista.dados ?? []}
              chave={(p) => p.id}
              vazio="Nenhum projeto de pesquisa encontrado."
              aoClicarLinha={(p) => setSelecionadoId(p.id)}
            />
          )}
        </>
      ) : (
        <>
          <Botao variante="texto" aoClicar={() => setSelecionadoId(null)}>
            Voltar à lista
          </Botao>
          {detalhe.carregando && <Carregando />}
          {detalhe.erro && <Aviso tipo="erro">{detalhe.erro}</Aviso>}
          {detalhe.dados && detalhe.dados.id === selecionadoId && (
            <DetalheProjeto projeto={detalhe.dados} modo="admin" aoAtualizar={atualizarTudo} />
          )}
        </>
      )}

      {novo && (
        <Modal aberto titulo="Novo projeto de pesquisa" aoFechar={() => setNovo(false)}>
          <FormNovoProjeto
            aoSalvo={() => {
              setNovo(false);
              lista.recarregar();
            }}
            aoCancelar={() => setNovo(false)}
          />
        </Modal>
      )}
    </Pagina>
  );
}

// ---------- Professor: /professor/orientacoes ----------

function OrientacoesProfessor() {
  const { usuario } = useAuth();
  const { dados, carregando, erro, recarregar } = useDados<ProjetoDTO[]>('/pos/projetos');
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const professorId = usuario?.professorId ?? null;

  const selecionado = dados?.find((p) => p.id === selecionadoId) ?? null;

  return (
    <Pagina titulo="Orientações">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando && <Carregando />}

      {!carregando && dados && selecionado === null && dados.length === 0 && (
        <Aviso tipo="info">Você não orienta nem coorienta projetos de pesquisa.</Aviso>
      )}

      {!carregando && selecionado === null && dados && dados.length > 0 && (
        <Grade>
          {dados.map((p) => (
            <Cartao key={p.id} titulo={p.titulo}>
              <p>
                <Selo cor={corStatus(p.status)}>{rotuloStatus(p.status)}</Selo>
              </p>
              <p>
                Aluno: {p.matricula.aluno.usuario.nome} · {p.matricula.curso.nome}
              </p>
              <p>
                Seu papel: {p.orientadorId === professorId ? 'Orientador' : 'Coorientador'}
              </p>
              <Botao variante="secundario" aoClicar={() => setSelecionadoId(p.id)}>
                Ver detalhes
              </Botao>
            </Cartao>
          ))}
        </Grade>
      )}

      {selecionado !== null && (
        <>
          <Botao variante="texto" aoClicar={() => setSelecionadoId(null)}>
            Voltar à lista
          </Botao>
          <DetalheProjeto projeto={selecionado} modo="leitura" aoAtualizar={recarregar} />
        </>
      )}
    </Pagina>
  );
}

// ---------- Aluno: /aluno/pesquisa ----------

function PesquisaAluno() {
  const { dados, carregando, erro, recarregar } = useDados<ProjetoDTO[]>('/pos/projetos');

  return (
    <Pagina titulo="Pesquisa">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando && <Carregando />}

      {!carregando && dados && dados.length === 0 && (
        <Aviso tipo="info">
          O projeto de pesquisa é cadastrado pela secretaria para cursos de pós-graduação. Quando
          ele for criado, aparecerá aqui.
        </Aviso>
      )}

      {!carregando &&
        dados?.map((p) => (
          <DetalheProjeto key={p.id} projeto={p} modo="aluno" aoAtualizar={recarregar} />
        ))}
    </Pagina>
  );
}

// ---------- Rotas do módulo ----------

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/pos',
    rotulo: 'Pós-graduação',
    icone: 'pos',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <PosAdmin />,
    ordem: 50,
  },
  {
    caminho: '/professor/orientacoes',
    rotulo: 'Orientações',
    icone: 'pos',
    perfis: ['PROFESSOR'],
    elemento: <OrientacoesProfessor />,
    ordem: 50,
  },
  {
    caminho: '/aluno/pesquisa',
    rotulo: 'Pesquisa',
    icone: 'pos',
    perfis: ['ALUNO'],
    elemento: <PesquisaAluno />,
    ordem: 50,
  },
];
