import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Campo, Carregando, Modal, Pagina, Selecao, Selo, Tabela } from '../../ui';
import { TITULACOES, mensagemErro, nulo, queryString, rotuloTitulacao } from './tipos';
import type { ProfessorDTO } from './tipos';

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

  return (
    <Pagina
      titulo="Professores"
      acoes={<Botao aoClicar={() => setEditando('novo')}>Novo professor</Botao>}
    >
      <Campo rotulo="Buscar por nome, e-mail ou registro" valor={busca} aoMudar={setBusca} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando && <Carregando />}
      {dados && (
        <Tabela<ProfessorDTO>
          chave={(p) => p.id}
          dados={dados}
          vazio="Nenhum professor encontrado."
          aoClicarLinha={(p) => setEditando(p)}
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
          ]}
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
