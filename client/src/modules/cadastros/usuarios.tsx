import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Campo, Carregando, Modal, Pagina, Selecao, Selo, Tabela } from '../../ui';
import { PERFIS, mensagemErro, queryString, rotuloPerfil } from './tipos';
import type { UsuarioDTO } from './tipos';

// Perfis que o ADMIN pode criar por esta tela.
const PERFIS_ADMINISTRATIVOS: { valor: string; rotulo: string }[] = [
  { valor: 'ADMIN', rotulo: 'Administrador' },
  { valor: 'SECRETARIA', rotulo: 'Secretaria' },
];

// ---------- Criar usuário administrativo ----------

function FormNovoUsuario({ aoConcluir }: { aoConcluir: () => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      await api.post('/usuarios', {
        nome: nome.trim(),
        email: email.trim(),
        senha,
        perfil,
      });
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
      <Campo
        rotulo="Senha inicial (mínimo 6 caracteres)"
        tipo="password"
        valor={senha}
        aoMudar={setSenha}
        obrigatorio
      />
      <Selecao
        rotulo="Perfil"
        valor={perfil}
        aoMudar={setPerfil}
        opcoes={PERFIS_ADMINISTRATIVOS}
        obrigatorio
      />
      <div className="pagina-acoes">
        <Botao tipo="submit" desabilitado={ocupado}>
          Criar usuário
        </Botao>
      </div>
    </form>
  );
}

// ---------- Detalhe: ativar/desativar e redefinir senha ----------

function DetalheUsuario({
  usuario,
  aoAtualizado,
}: {
  usuario: UsuarioDTO;
  aoAtualizado: (u: UsuarioDTO) => void;
}) {
  const [novaSenha, setNovaSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function alternarAtivo() {
    const proximo = !usuario.ativo;
    if (!proximo && !window.confirm(`Desativar o usuário ${usuario.nome}?`)) return;
    setErro(null);
    setSucesso(null);
    setOcupado(true);
    try {
      const atualizado = await api.put<UsuarioDTO>(`/usuarios/${usuario.id}`, { ativo: proximo });
      aoAtualizado(atualizado);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  async function redefinir(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setOcupado(true);
    try {
      await api.post(`/usuarios/${usuario.id}/redefinir-senha`, { novaSenha });
      setNovaSenha('');
      setSucesso('Senha redefinida.');
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      <p>
        <strong>Perfil:</strong> {rotuloPerfil(usuario.perfil)}
      </p>
      <p>
        <strong>E-mail:</strong> {usuario.email}
      </p>
      <p>
        <strong>Situação:</strong> {usuario.ativo ? 'Ativo' : 'Inativo'}
      </p>
      <div className="pagina-acoes">
        <Botao
          variante={usuario.ativo ? 'perigo' : 'primario'}
          desabilitado={ocupado}
          aoClicar={alternarAtivo}
        >
          {usuario.ativo ? 'Desativar' : 'Ativar'}
        </Botao>
      </div>

      <form onSubmit={redefinir}>
        <h3 className="cartao-titulo">Redefinir senha</h3>
        <Campo
          rotulo="Nova senha (mínimo 6 caracteres)"
          tipo="password"
          valor={novaSenha}
          aoMudar={setNovaSenha}
          obrigatorio
        />
        <div className="pagina-acoes">
          <Botao tipo="submit" desabilitado={ocupado}>
            Redefinir senha
          </Botao>
        </div>
      </form>
    </div>
  );
}

// ---------- Lista (somente ADMIN) ----------

export function Usuarios() {
  const [perfil, setPerfil] = useState('');
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);
  const [selecionado, setSelecionado] = useState<UsuarioDTO | null>(null);
  const { dados, carregando, erro, recarregar } = useDados<UsuarioDTO[]>(
    `/usuarios${queryString({ perfil, busca: busca.trim() })}`
  );

  return (
    <Pagina titulo="Usuários" acoes={<Botao aoClicar={() => setNovo(true)}>Novo usuário</Botao>}>
      <Selecao
        rotulo="Perfil"
        valor={perfil}
        aoMudar={setPerfil}
        opcoes={PERFIS}
        vazio="Todos os perfis"
      />
      <Campo rotulo="Buscar por nome ou e-mail" valor={busca} aoMudar={setBusca} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando && <Carregando />}
      {dados && (
        <Tabela<UsuarioDTO>
          chave={(u) => u.id}
          dados={dados}
          vazio="Nenhum usuário encontrado."
          aoClicarLinha={(u) => setSelecionado(u)}
          colunas={[
            { titulo: 'Nome', celula: (u) => u.nome },
            { titulo: 'E-mail', celula: (u) => u.email },
            { titulo: 'Perfil', celula: (u) => rotuloPerfil(u.perfil) },
            {
              titulo: 'Situação',
              celula: (u) =>
                u.ativo ? <Selo cor="verde">ATIVO</Selo> : <Selo cor="vermelho">INATIVO</Selo>,
            },
          ]}
        />
      )}

      <Modal aberto={novo} titulo="Novo usuário" aoFechar={() => setNovo(false)}>
        {novo && (
          <FormNovoUsuario
            aoConcluir={() => {
              setNovo(false);
              recarregar();
            }}
          />
        )}
      </Modal>

      <Modal
        aberto={selecionado !== null}
        titulo={selecionado ? selecionado.nome : 'Usuário'}
        aoFechar={() => setSelecionado(null)}
      >
        {selecionado && (
          <DetalheUsuario
            key={selecionado.id}
            usuario={selecionado}
            aoAtualizado={(u) => {
              setSelecionado(u);
              recarregar();
            }}
          />
        )}
      </Modal>
    </Pagina>
  );
}
