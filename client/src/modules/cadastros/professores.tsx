import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Campo, Carregando, Modal, Pagina, Selecao, Selo, Tabela } from '../../ui';
import { TITULACOES, mensagemErro, nulo, queryString, rotuloTitulacao } from './tipos';
import type { ProfessorDTO } from './tipos';
import { FichaProfessor } from './FichaProfessor';
import { MenuAcoes } from './MenuAcoes';
import type { AcaoMenu } from './MenuAcoes';

// ---------- Formulário (criar ou editar) ----------

function FormProfessor({
  professor,
  aoConcluir,
}: {
  professor: ProfessorDTO | null;
  aoConcluir: () => void;
}) {
  const edicao = professor !== null;
  const [nome, setNome] = useState(professor?.usuario.nome ?? '');
  const [email, setEmail] = useState(professor?.usuario.email ?? '');
  const [senha, setSenha] = useState('');
  const [cpf, setCpf] = useState(professor?.usuario.cpf ?? '');
  const [telefone, setTelefone] = useState(professor?.usuario.telefone ?? '');
  const [titulacao, setTitulacao] = useState(professor?.titulacao ?? '');
  const [area, setArea] = useState(professor?.area ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const campos = {
      nome: nome.trim(),
      email: email.trim(),
      cpf: nulo(cpf),
      telefone: nulo(telefone),
      titulacao,
      area: nulo(area),
    };
    try {
      if (professor) {
        await api.put(`/professores/${professor.id}`, campos);
      } else {
        await api.post('/professores', { ...campos, senha });
      }
      aoConcluir();
    } catch (err) {
      setErro(mensagemErro(err));
      setOcupado(false);
    }
  }

  async function desativar() {
    if (!professor) return;
    if (!window.confirm(`Desativar o professor ${professor.usuario.nome}?`)) return;
    setErro(null);
    setOcupado(true);
    try {
      await api.del(`/professores/${professor.id}`);
      aoConcluir();
    } catch (err) {
      setErro(mensagemErro(err));
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={salvar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} obrigatorio />
      <Campo rotulo="E-mail" tipo="email" valor={email} aoMudar={setEmail} obrigatorio />
      {!edicao && (
        <Campo
          rotulo="Senha inicial (mínimo 6 caracteres)"
          tipo="password"
          valor={senha}
          aoMudar={setSenha}
          obrigatorio
        />
      )}
      <Campo rotulo="CPF" valor={cpf} aoMudar={setCpf} />
      <Campo rotulo="Telefone" valor={telefone} aoMudar={setTelefone} />
      <Selecao
        rotulo="Titulação"
        valor={titulacao}
        aoMudar={setTitulacao}
        opcoes={TITULACOES}
        obrigatorio
      />
      <Campo rotulo="Área" valor={area} aoMudar={setArea} />

      <div className="pagina-acoes">
        <Botao tipo="submit" desabilitado={ocupado}>
          Salvar
        </Botao>
        <Botao variante="secundario" aoClicar={aoConcluir}>
          Cancelar
        </Botao>
        {edicao && professor.usuario.ativo && (
          <Botao variante="perigo" desabilitado={ocupado} aoClicar={desativar}>
            Desativar
          </Botao>
        )}
      </div>
    </form>
  );
}

// ---------- Lista ----------

export function Professores() {
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<ProfessorDTO | 'novo' | null>(null);
  const [ficha, setFicha] = useState<number | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const { dados, carregando, erro, recarregar } = useDados<ProfessorDTO[]>(
    `/professores${queryString({ busca: busca.trim() })}`
  );

  function fechar() {
    setEditando(null);
  }

  function concluir() {
    setEditando(null);
    recarregar();
  }

  async function desativar(p: ProfessorDTO) {
    if (!window.confirm(`Desativar o professor ${p.usuario.nome}?`)) return;
    setErroAcao(null);
    try {
      await api.del(`/professores/${p.id}`);
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  async function reativar(p: ProfessorDTO) {
    setErroAcao(null);
    try {
      await api.put(`/usuarios/${p.usuarioId}`, { ativo: true });
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  function acoesDo(p: ProfessorDTO): AcaoMenu[] {
    const acoes: AcaoMenu[] = [
      { rotulo: 'Ver ficha', icone: 'perfil', aoClicar: () => setFicha(p.id) },
      { rotulo: 'Editar cadastro', icone: 'lapis', aoClicar: () => setEditando(p) },
      { rotulo: 'Turmas', icone: 'turmas', aoClicar: () => navegar('/admin/turmas') },
      { rotulo: 'Horários', icone: 'horarios', aoClicar: () => navegar('/admin/horarios') },
      { rotulo: 'Pós-graduação', icone: 'pos', aoClicar: () => navegar('/admin/pos') },
    ];
    if (p.usuario.ativo) {
      acoes.push({ rotulo: 'Desativar', icone: 'fechar', perigo: true, aoClicar: () => desativar(p) });
    } else if (usuario?.perfil === 'ADMIN') {
      acoes.push({ rotulo: 'Reativar', icone: 'perfil', aoClicar: () => reativar(p) });
    }
    return acoes;
  }

  return (
    <Pagina
      titulo="Professores"
      acoes={<Botao aoClicar={() => setEditando('novo')}>Novo professor</Botao>}
    >
      <Campo rotulo="Buscar por nome, e-mail ou registro" valor={busca} aoMudar={setBusca} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {carregando && <Carregando />}
      {dados && (
        <Tabela<ProfessorDTO>
          chave={(p) => p.id}
          dados={dados}
          vazio="Nenhum professor encontrado."
          aoClicarLinha={(p) => setFicha(p.id)}
          colunas={[
            { titulo: 'Registro', celula: (p) => p.registro },
            { titulo: 'Nome', celula: (p) => p.usuario.nome },
            { titulo: 'E-mail', celula: (p) => p.usuario.email },
            { titulo: 'Telefone', celula: (p) => p.usuario.telefone ?? '—' },
            { titulo: 'Titulação', celula: (p) => rotuloTitulacao(p.titulacao) },
            {
              titulo: 'Situação',
              celula: (p) =>
                p.usuario.ativo ? <Selo cor="verde">ATIVO</Selo> : <Selo cor="vermelho">INATIVO</Selo>,
            },
            {
              titulo: 'Ações',
              celula: (p) => <MenuAcoes rotulo={'Ações de ' + p.usuario.nome} acoes={acoesDo(p)} />,
            },
          ]}
        />
      )}

      {ficha !== null && (
        <FichaProfessor
          key={ficha}
          professorId={ficha}
          aoFechar={() => setFicha(null)}
          aoEditar={() => {
            const p = dados?.find((x) => x.id === ficha) ?? null;
            setFicha(null);
            if (p) setEditando(p);
          }}
        />
      )}

      <Modal
        aberto={editando !== null}
        titulo={editando === 'novo' || editando === null ? 'Novo professor' : 'Editar professor'}
        aoFechar={fechar}
      >
        {editando !== null && (
          <FormProfessor
            key={editando === 'novo' ? 'novo' : editando.id}
            professor={editando === 'novo' ? null : editando}
            aoConcluir={concluir}
          />
        )}
      </Modal>
    </Pagina>
  );
}
