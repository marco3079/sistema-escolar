import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Aviso, Botao, Campo } from '../ui';
import { Icone } from '../ui/icones';
import { BotaoTema, caminhoDoPerfil } from './Layout';
import './login.css';

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
    <main className="entrada">
      <div className="entrada-tema">
        <BotaoTema />
      </div>
      <aside className="entrada-marca">
        <div className="entrada-marca-topo">
          <img src="/logo-simbolo.png" alt="" className="entrada-logo" width={56} height={56} />
          <span className="entrada-marca-nome">Sistema Escolar</span>
        </div>

        <div className="entrada-marca-meio">
          <h2 className="entrada-frase">Construindo um futuro melhor.</h2>
          <p className="entrada-marca-apoio">
            Do ensino fundamental ao doutorado, em um só lugar.
          </p>
          <ul className="entrada-destaques">
            <li>
              <Icone nome="alunos" tamanho={20} />
              <span>Portais do aluno, do professor e administrativo</span>
            </li>
            <li>
              <Icone nome="boletim" tamanho={20} />
              <span>Notas, frequência e boletim</span>
            </li>
            <li>
              <Icone nome="calendario" tamanho={20} />
              <span>Horários, calendário e comunicados</span>
            </li>
          </ul>
        </div>
      </aside>

      <section className="entrada-formulario">
        <form className="entrada-cartao" onSubmit={enviar}>
          <div className="entrada-cartao-marca">
            <img src="/logo-simbolo.png" alt="" className="entrada-logo" width={56} height={56} />
            <span>Sistema Escolar</span>
          </div>
          <h1 className="entrada-titulo">Entrar</h1>
          <p className="entrada-apoio">Use seu e-mail e sua senha.</p>
          <Campo rotulo="E-mail" tipo="email" valor={email} aoMudar={setEmail} obrigatorio />
          <Campo rotulo="Senha" tipo="password" valor={senha} aoMudar={setSenha} obrigatorio />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="entrada-botao">
            <Botao tipo="submit" desabilitado={enviando}>
              {enviando ? 'Entrando...' : 'Entrar'}
            </Botao>
          </div>
        </form>
      </section>
    </main>
  );
}
