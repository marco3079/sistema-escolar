import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Campo, Carregando, Modal, Pagina, Selo, Tabela } from '../../ui';
import { dataParaInput, mensagemErro, nulo, queryString } from './tipos';
import type { AlunoDTO } from './tipos';
import { FichaAluno } from './FichaAluno';
import { MenuAcoes } from './MenuAcoes';
import type { AcaoMenu } from './MenuAcoes';

// ---------- Formulário (criar ou editar) ----------

function FormAluno({ aluno, aoConcluir }: { aluno: AlunoDTO | null; aoConcluir: () => void }) {
  const edicao = aluno !== null;
  const [nome, setNome] = useState(aluno?.usuario.nome ?? '');
  const [email, setEmail] = useState(aluno?.usuario.email ?? '');
  const [senha, setSenha] = useState('');
  const [cpf, setCpf] = useState(aluno?.usuario.cpf ?? '');
  const [telefone, setTelefone] = useState(aluno?.usuario.telefone ?? '');
  const [dataNascimento, setDataNascimento] = useState(
    aluno ? dataParaInput(aluno.dataNascimento) : ''
  );
  const [endereco, setEndereco] = useState(aluno?.endereco ?? '');
  const [responsavelNome, setResponsavelNome] = useState(aluno?.responsavelNome ?? '');
  const [responsavelTelefone, setResponsavelTelefone] = useState(
    aluno?.responsavelTelefone ?? ''
  );
  const [responsavelEmail, setResponsavelEmail] = useState(aluno?.responsavelEmail ?? '');
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
      dataNascimento,
      endereco: nulo(endereco),
      responsavelNome: nulo(responsavelNome),
      responsavelTelefone: nulo(responsavelTelefone),
      responsavelEmail: nulo(responsavelEmail),
    };
    try {
      if (aluno) {
        await api.put(`/alunos/${aluno.id}`, campos);
      } else {
        await api.post('/alunos', { ...campos, senha });
      }
      aoConcluir();
    } catch (err) {
      setErro(mensagemErro(err));
      setOcupado(false);
    }
  }

  async function desativar() {
    if (!aluno) return;
    if (!window.confirm(`Desativar o aluno ${aluno.usuario.nome}?`)) return;
    setErro(null);
    setOcupado(true);
    try {
      await api.del(`/alunos/${aluno.id}`);
      aoConcluir();
    } catch (err) {
      setErro(mensagemErro(err));
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={salvar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <h3 className="cartao-titulo">Dados do aluno</h3>
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
      <Campo rotulo="Telefone" tipo="text" valor={telefone} aoMudar={setTelefone} />
      <Campo rotulo="Data de nascimento" tipo="date" valor={dataNascimento} aoMudar={setDataNascimento} obrigatorio />
      <Campo rotulo="Endereço" valor={endereco} aoMudar={setEndereco} />

      <h3 className="cartao-titulo">Responsável</h3>
      <Campo rotulo="Nome do responsável" valor={responsavelNome} aoMudar={setResponsavelNome} />
      <Campo rotulo="Telefone do responsável" valor={responsavelTelefone} aoMudar={setResponsavelTelefone} />
      <Campo rotulo="E-mail do responsável" tipo="email" valor={responsavelEmail} aoMudar={setResponsavelEmail} />

      <div className="pagina-acoes">
        <Botao tipo="submit" desabilitado={ocupado}>
          Salvar
        </Botao>
        <Botao variante="secundario" aoClicar={aoConcluir}>
          Cancelar
        </Botao>
        {edicao && aluno.usuario.ativo && (
          <Botao variante="perigo" desabilitado={ocupado} aoClicar={desativar}>
            Desativar
          </Botao>
        )}
      </div>
    </form>
  );
}

// ---------- Lista ----------

export function Alunos() {
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<AlunoDTO | 'novo' | null>(null);
  const [ficha, setFicha] = useState<number | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const { dados, carregando, erro, recarregar } = useDados<AlunoDTO[]>(
    `/alunos${queryString({ busca: busca.trim() })}`
  );

  function fechar() {
    setEditando(null);
  }

  function concluir() {
    setEditando(null);
    recarregar();
  }

  async function desativar(a: AlunoDTO) {
    if (!window.confirm(`Desativar o aluno ${a.usuario.nome}?`)) return;
    setErroAcao(null);
    try {
      await api.del(`/alunos/${a.id}`);
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  async function reativar(a: AlunoDTO) {
    setErroAcao(null);
    try {
      await api.put(`/usuarios/${a.usuarioId}`, { ativo: true });
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  function acoesDo(a: AlunoDTO): AcaoMenu[] {
    const acoes: AcaoMenu[] = [
      { rotulo: 'Ver ficha', icone: 'perfil', aoClicar: () => setFicha(a.id) },
      { rotulo: 'Editar cadastro', icone: 'lapis', aoClicar: () => setEditando(a) },
      { rotulo: 'Matrículas', icone: 'matriculas', aoClicar: () => navegar('/admin/matriculas') },
      { rotulo: 'Boletim e histórico', icone: 'boletim', aoClicar: () => navegar('/admin/boletins') },
      { rotulo: 'Financeiro', icone: 'financeiro', aoClicar: () => navegar('/admin/financeiro') },
    ];
    if (a.usuario.ativo) {
      acoes.push({ rotulo: 'Desativar', icone: 'fechar', perigo: true, aoClicar: () => desativar(a) });
    } else if (usuario?.perfil === 'ADMIN') {
      acoes.push({ rotulo: 'Reativar', icone: 'perfil', aoClicar: () => reativar(a) });
    }
    return acoes;
  }

  return (
    <Pagina titulo="Alunos" acoes={<Botao aoClicar={() => setEditando('novo')}>Novo aluno</Botao>}>
      <Campo rotulo="Buscar por nome, e-mail ou RA" valor={busca} aoMudar={setBusca} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {carregando && <Carregando />}
      {dados && (
        <Tabela<AlunoDTO>
          chave={(a) => a.id}
          dados={dados}
          vazio="Nenhum aluno encontrado."
          aoClicarLinha={(a) => setFicha(a.id)}
          colunas={[
            { titulo: 'RA', celula: (a) => a.ra },
            { titulo: 'Nome', celula: (a) => a.usuario.nome },
            { titulo: 'E-mail', celula: (a) => a.usuario.email },
            { titulo: 'Telefone', celula: (a) => a.usuario.telefone ?? '—' },
            {
              titulo: 'Situação',
              celula: (a) =>
                a.usuario.ativo ? <Selo cor="verde">ATIVO</Selo> : <Selo cor="vermelho">INATIVO</Selo>,
            },
            {
              titulo: 'Ações',
              celula: (a) => (
                <MenuAcoes rotulo={'Ações de ' + a.usuario.nome} acoes={acoesDo(a)} />
              ),
            },
          ]}
        />
      )}

      {ficha !== null && (
        <FichaAluno
          key={ficha}
          alunoId={ficha}
          aoFechar={() => setFicha(null)}
          aoEditar={() => {
            const a = dados?.find((x) => x.id === ficha) ?? null;
            setFicha(null);
            if (a) setEditando(a);
          }}
        />
      )}

      <Modal
        aberto={editando !== null}
        titulo={editando === 'novo' || editando === null ? 'Novo aluno' : 'Editar aluno'}
        aoFechar={fechar}
      >
        {editando !== null && (
          <FormAluno
            key={editando === 'novo' ? 'novo' : editando.id}
            aluno={editando === 'novo' ? null : editando}
            aoConcluir={concluir}
          />
        )}
      </Modal>
    </Pagina>
  );
}
