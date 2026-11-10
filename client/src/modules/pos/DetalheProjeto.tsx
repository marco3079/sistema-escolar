import { useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../lib/api';
import { rotuloNivel } from '../../lib/tipos';
import { Aviso, Botao, Cartao, Modal, Selo, formatarDataHora } from '../../ui';
import {
  corResultado,
  corStatus,
  mensagemErro,
  nomeMembro,
  rotuloPapel,
  rotuloResultado,
  rotuloStatus,
  rotuloTipoBanca,
} from './apoio';
import { FormBanca, FormEditarProjeto, FormProjetoAluno, FormResultadoBanca } from './formularios';
import type { BancaDTO, ProjetoDTO } from './tipos';

// leitura: orientador/coorientador (só para ver)
// aluno: dono do projeto, edita título, resumo e linha de pesquisa
// admin: secretaria/administrador, edita tudo e gerencia bancas
export type ModoDetalhe = 'leitura' | 'aluno' | 'admin';

type Edicao = 'projeto' | 'projetoAluno' | 'banca' | null;

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <p>
      <strong>{rotulo}: </strong>
      {children}
    </p>
  );
}

export function DetalheProjeto({
  projeto,
  modo,
  aoAtualizar,
}: {
  projeto: ProjetoDTO;
  modo: ModoDetalhe;
  aoAtualizar: () => void;
}) {
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [bancaResultado, setBancaResultado] = useState<BancaDTO | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setEdicao(null);
    setBancaResultado(null);
  }

  function aoSalvar() {
    fechar();
    aoAtualizar();
  }

  async function excluirBanca(banca: BancaDTO) {
    if (!window.confirm('Excluir esta banca? Os membros também serão removidos.')) return;
    setErro(null);
    try {
      await api.del(`/pos/bancas/${banca.id}`);
      aoAtualizar();
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  return (
    <div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Cartao titulo="Projeto de pesquisa">
        <p>
          <Selo cor={corStatus(projeto.status)}>{rotuloStatus(projeto.status)}</Selo>
        </p>
        <Linha rotulo="Título">{projeto.titulo}</Linha>
        <Linha rotulo="Aluno">
          {projeto.matricula.aluno.usuario.nome} (RA {projeto.matricula.aluno.ra})
        </Linha>
        <Linha rotulo="Curso">
          {projeto.matricula.curso.nome} · {rotuloNivel(projeto.matricula.curso.nivel)}
        </Linha>
        <Linha rotulo="Orientador">{projeto.orientador.usuario.nome}</Linha>
        <Linha rotulo="Coorientador">
          {projeto.coorientador ? projeto.coorientador.usuario.nome : 'Nenhum'}
        </Linha>
        <Linha rotulo="Linha de pesquisa">{projeto.linhaPesquisa || 'Não informada'}</Linha>
        <p>
          <strong>Resumo:</strong>
        </p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{projeto.resumo}</p>

        {modo === 'admin' && (
          <div className="pagina-acoes">
            <Botao variante="secundario" aoClicar={() => setEdicao('projeto')}>
              Editar projeto
            </Botao>
            <Botao aoClicar={() => setEdicao('banca')}>Agendar banca</Botao>
          </div>
        )}
        {modo === 'aluno' && (
          <div className="pagina-acoes">
            <Botao variante="secundario" aoClicar={() => setEdicao('projetoAluno')}>
              Editar título, resumo e linha
            </Botao>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Bancas">
        {projeto.bancas.length === 0 && <p>Nenhuma banca agendada.</p>}
        {projeto.bancas.map((banca) => (
          <Cartao
            key={banca.id}
            titulo={`${rotuloTipoBanca(banca.tipo)} · ${formatarDataHora(banca.data)}`}
          >
            <Linha rotulo="Local">{banca.local || 'Não informado'}</Linha>
            <p>
              <strong>Resultado: </strong>
              <Selo cor={corResultado(banca.resultado)}>{rotuloResultado(banca.resultado)}</Selo>
            </p>
            {banca.parecer && (
              <>
                <p>
                  <strong>Parecer:</strong>
                </p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{banca.parecer}</p>
              </>
            )}
            <p>
              <strong>Membros:</strong>
            </p>
            <ul>
              {banca.membros.map((membro) => (
                <li key={membro.id}>
                  {nomeMembro(membro)} · {rotuloPapel(membro.papel)}
                </li>
              ))}
            </ul>
            {modo === 'admin' && (
              <div className="pagina-acoes">
                <Botao variante="secundario" aoClicar={() => setBancaResultado(banca)}>
                  Registrar resultado
                </Botao>
                <Botao variante="perigo" aoClicar={() => excluirBanca(banca)}>
                  Excluir banca
                </Botao>
              </div>
            )}
          </Cartao>
        ))}
      </Cartao>

      {edicao === 'projeto' && (
        <Modal aberto titulo="Editar projeto" aoFechar={fechar}>
          <FormEditarProjeto projeto={projeto} aoSalvo={aoSalvar} aoCancelar={fechar} />
        </Modal>
      )}
      {edicao === 'projetoAluno' && (
        <Modal aberto titulo="Editar projeto" aoFechar={fechar}>
          <FormProjetoAluno projeto={projeto} aoSalvo={aoSalvar} aoCancelar={fechar} />
        </Modal>
      )}
      {edicao === 'banca' && (
        <Modal aberto titulo="Agendar banca" aoFechar={fechar}>
          <FormBanca projeto={projeto} aoSalvo={aoSalvar} aoCancelar={fechar} />
        </Modal>
      )}
      {bancaResultado && (
        <Modal aberto titulo="Registrar resultado da banca" aoFechar={fechar}>
          <FormResultadoBanca banca={bancaResultado} aoSalvo={aoSalvar} aoCancelar={fechar} />
        </Modal>
      )}
    </div>
  );
}
