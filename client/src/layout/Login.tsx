import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Aviso, Botao, Campo } from '../ui';
import { caminhoDoPerfil } from './Layout';

export function Login() {
  const { usuario, entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={caminhoDoPerfil(usuario.perfil)} replace />;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <form className="login-cartao" onSubmit={enviar}>
        <h1>Sistema Escolar</h1>
        <p className="login-apoio">Entre com seu e-mail e senha.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Campo rotulo="E-mail" tipo="email" valor={email} aoMudar={setEmail} obrigatorio />
        <Campo rotulo="Senha" tipo="password" valor={senha} aoMudar={setSenha} obrigatorio />
        <Botao tipo="submit" desabilitado={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </Botao>
      </form>
    </main>
  );
}
