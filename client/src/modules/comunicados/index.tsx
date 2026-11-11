import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { RotaModulo } from '../../lib/rotas';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Carregando, Modal, Pagina } from '../../ui';
import { FormularioComunicado } from './FormularioComunicado';
import { ListaComunicados } from './ListaComunicados';
import type { ComunicadoDTO } from './tipos';

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Erro inesperado';
}

// ---------- Administração (ADMIN e SECRETARIA) ----------

function ComunicadosAdmin() {
  const { usuario } = useAuth();
  const lista = useDados<ComunicadoDTO[]>('/comunicados');
  const [novoAberto, setNovoAberto] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function excluir(comunicado: ComunicadoDTO) {
    if (!window.confirm(`Excluir o comunicado "${comunicado.titulo}"?`)) return;
    try {
      await api.del(`/comunicados/${comunicado.id}`);
      setErroAcao(null);
      lista.recarregar();
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro));
    }
  }

  return (
    <Pagina titulo="Comunicados" acoes={<Botao aoClicar={() => setNovoAberto(true)}>Novo comunicado</Botao>}>
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
      {lista.carregando ? (
        <Carregando />
      ) : (
        <ListaComunicados
          comunicados={lista.dados ?? []}
          podeExcluir={(c) => usuario?.perfil === 'ADMIN' || c.autorId === usuario?.id}
          aoExcluir={excluir}
        />
      )}

      <Modal aberto={novoAberto} titulo="Novo comunicado" aoFechar={() => setNovoAberto(false)}>
        <FormularioComunicado
          aoSalvo={() => {
            setNovoAberto(false);
            setErroAcao(null);
            lista.recarregar();
          }}
        />
      </Modal>
    </Pagina>
  );
}

// ---------- Professor ----------

function ComunicadosProfessor() {
  const lista = useDados<ComunicadoDTO[]>('/comunicados');
  const [novoAberto, setNovoAberto] = useState(false);

  return (
    <Pagina
      titulo="Comunicados"
      acoes={
        <Botao aoClicar={() => setNovoAberto(true)}>Novo comunicado para turma</Botao>
      }
    >
      {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
      {lista.carregando ? (
        <Carregando />
      ) : (
        <ListaComunicados comunicados={lista.dados ?? []} />
      )}

      <Modal
        aberto={novoAberto}
        titulo="Novo comunicado para turma"
        aoFechar={() => setNovoAberto(false)}
      >
        <FormularioComunicado
          modoProfessor
          aoSalvo={() => {
            setNovoAberto(false);
            lista.recarregar();
          }}
        />
      </Modal>
    </Pagina>
  );
}

// ---------- Aluno (somente leitura) ----------

function ComunicadosAluno() {
  const lista = useDados<ComunicadoDTO[]>('/comunicados');
  return (
    <Pagina titulo="Comunicados">
      {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
      {lista.carregando ? (
        <Carregando />
      ) : (
        <ListaComunicados comunicados={lista.dados ?? []} />
      )}
    </Pagina>
  );
}

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/comunicados',
    rotulo: 'Comunicados',
    icone: 'comunicados',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <ComunicadosAdmin />,
    ordem: 72,
  },
  {
    caminho: '/professor/comunicados',
    rotulo: 'Comunicados',
    icone: 'comunicados',
    perfis: ['PROFESSOR'],
    elemento: <ComunicadosProfessor />,
    ordem: 72,
  },
  {
    caminho: '/aluno/comunicados',
    rotulo: 'Comunicados',
    icone: 'comunicados',
    perfis: ['ALUNO'],
    elemento: <ComunicadosAluno />,
    ordem: 72,
  },
];
