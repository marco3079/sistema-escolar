import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Campo, Carregando, Cartao, Pagina } from '../../ui';
import { dataBr, mensagemErro, nulo, rotuloPerfil, rotuloTitulacao } from './tipos';
import type { PerfilMeu } from './tipos';

// ---------- Editar telefone (e endereço, se aluno) ----------

function FormDadosPerfil({
  perfil,
  aoSalvo,
}: {
  perfil: PerfilMeu;
  aoSalvo: () => void;
}) {
  const [telefone, setTelefone] = useState(perfil.telefone ?? '');
  const [endereco, setEndereco] = useState(perfil.aluno?.endereco ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setOcupado(true);
    try {
      await api.put('/perfil/meu', {
        telefone: nulo(telefone),
        ...(perfil.aluno ? { endereco: nulo(endereco) } : {}),
      });
      setSucesso('Dados atualizados.');
      aoSalvo();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={salvar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      <Campo rotulo="Telefone" tipo="text" valor={telefone} aoMudar={setTelefone} />
      {perfil.aluno && (
        <Campo rotulo="Endereço" valor={endereco} aoMudar={setEndereco} />
      )}
      <div className="pagina-acoes">
        <Botao tipo="submit" desabilitado={ocupado}>
          Salvar dados
        </Botao>
      </div>
    </form>
  );
}

// ---------- Trocar senha ----------

function FormTrocarSenha() {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function trocar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setOcupado(true);
    try {
      await api.post('/auth/trocar-senha', { senhaAtual, novaSenha });
      setSenhaAtual('');
      setNovaSenha('');
      setSucesso('Senha alterada.');
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={trocar}>
      <h3 className="cartao-titulo">Trocar senha</h3>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      <Campo
        rotulo="Senha atual"
        tipo="password"
        valor={senhaAtual}
        aoMudar={setSenhaAtual}
        obrigatorio
      />
      <Campo
        rotulo="Nova senha (mínimo 6 caracteres)"
        tipo="password"
        valor={novaSenha}
        aoMudar={setNovaSenha}
        obrigatorio
      />
      <div className="pagina-acoes">
        <Botao tipo="submit" desabilitado={ocupado}>
          Trocar senha
        </Botao>
      </div>
    </form>
  );
}

// ---------- Tela "Meu perfil" (aluno e professor) ----------

export function MeuPerfil() {
  const { dados, carregando, erro, recarregar } = useDados<PerfilMeu>('/perfil/meu');

  return (
    <Pagina titulo="Meu perfil">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {carregando && !dados && <Carregando />}
      {dados && (
        <>
          <Cartao titulo="Dados">
            <p>
              <strong>Nome:</strong> {dados.nome}
            </p>
            <p>
              <strong>E-mail:</strong> {dados.email}
            </p>
            <p>
              <strong>Perfil:</strong> {rotuloPerfil(dados.perfil)}
            </p>
            {dados.cpf && (
              <p>
                <strong>CPF:</strong> {dados.cpf}
              </p>
            )}
            {dados.aluno && (
              <>
                <p>
                  <strong>RA:</strong> {dados.aluno.ra}
                </p>
                <p>
                  <strong>Data de nascimento:</strong> {dataBr(dados.aluno.dataNascimento)}
                </p>
              </>
            )}
            {dados.professor && (
              <>
                <p>
                  <strong>Registro:</strong> {dados.professor.registro}
                </p>
                <p>
                  <strong>Titulação:</strong> {rotuloTitulacao(dados.professor.titulacao)}
                </p>
                {dados.professor.area && (
                  <p>
                    <strong>Área:</strong> {dados.professor.area}
                  </p>
                )}
              </>
            )}
          </Cartao>

          <Cartao titulo="Contato">
            <FormDadosPerfil perfil={dados} aoSalvo={recarregar} />
          </Cartao>

          <Cartao>
            <FormTrocarSenha />
          </Cartao>
        </>
      )}
    </Pagina>
  );
}
