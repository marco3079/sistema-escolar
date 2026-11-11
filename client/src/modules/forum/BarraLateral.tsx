import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AreaTexto, Aviso, Botao, Campo, Carregando, Modal, Selecao } from '../../ui';
import { classeCor, mensagemErro, podeCriarComunidade, useBase } from './comum';
import type { ComunidadeDTO } from './comum';

const CORES = [
  { valor: 'azul', rotulo: 'Azul' },
  { valor: 'roxo', rotulo: 'Roxo' },
  { valor: 'verde', rotulo: 'Verde' },
  { valor: 'laranja', rotulo: 'Laranja' },
];

// Barra lateral do feed: comunidades, criação de comunidade e regras de convivência.
export function BarraLateral({
  base,
  comunidades,
  carregando,
  erro,
  slugAtual,
  aoCriada,
}: {
  base: string;
  comunidades: ComunidadeDTO[] | null;
  carregando: boolean;
  erro: string | null;
  slugAtual: string | null;
  aoCriada: () => void;
}) {
  return (
    <>
      <section className="cartao forum-cartao-lateral">
        <h2 className="cartao-titulo">Comunidades</h2>
        {carregando && !comunidades && <Carregando />}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {comunidades && (
          <ul className="forum-lista-comunidades">
            <li>
              <Link
                className={slugAtual === null ? 'forum-item-comunidade ativa' : 'forum-item-comunidade'}
                to={`${base}/forum`}
                aria-current={slugAtual === null ? 'page' : undefined}
              >
                <span className="forum-item-nome">Todas</span>
              </Link>
            </li>
            {comunidades.map((c) => (
              <li key={c.id}>
                <Link
                  className={slugAtual === c.slug ? 'forum-item-comunidade ativa' : 'forum-item-comunidade'}
                  to={`${base}/forum/c/${c.slug}`}
                  aria-current={slugAtual === c.slug ? 'page' : undefined}
                >
                  <span className={`forum-bolinha forum-cor-${classeCor(c.cor)}`} aria-hidden="true" />
                  <span className="forum-item-nome">{c.nome}</span>
                  <span className="forum-item-quantidade">{c.publicacoes}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <CriarComunidade aoCriada={aoCriada} />
      </section>

      <section className="cartao forum-cartao-lateral">
        <h2 className="cartao-titulo">Regras de convivência</h2>
        <ol className="forum-regras">
          <li>Trate todas as pessoas com respeito.</li>
          <li>Não publique dados pessoais de terceiros.</li>
          <li>Dúvidas de disciplina vão para a comunidade da disciplina.</li>
        </ol>
      </section>
    </>
  );
}

// Botão "Criar comunidade", só para quem pode criar (ADMIN, SECRETARIA e PROFESSOR).
export function CriarComunidade({ aoCriada }: { aoCriada: () => void }) {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState(false);
  if (!podeCriarComunidade(usuario?.perfil)) return null;
  return (
    <>
      <div className="forum-botao-largo">
        <Botao variante="secundario" aoClicar={() => setAberto(true)}>
          Criar comunidade
        </Botao>
      </div>
      <NovaComunidade aberto={aberto} aoFechar={() => setAberto(false)} aoCriada={aoCriada} />
    </>
  );
}

function NovaComunidade({
  aberto,
  aoFechar,
  aoCriada,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriada: () => void;
}) {
  if (!aberto) return null;
  return (
    <Modal aberto titulo="Criar comunidade" aoFechar={aoFechar}>
      <FormularioComunidade aoFechar={aoFechar} aoCriada={aoCriada} />
    </Modal>
  );
}

function FormularioComunidade({ aoFechar, aoCriada }: { aoFechar: () => void; aoCriada: () => void }) {
  const navigate = useNavigate();
  const base = useBase();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cor, setCor] = useState('azul');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 1) {
      setErro('Informe o nome da comunidade.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const criada = await api.post<ComunidadeDTO>('/forum/comunidades', {
        nome: nome.trim(),
        descricao: descricao.trim() === '' ? null : descricao.trim(),
        cor,
      });
      aoCriada();
      aoFechar();
      navigate(`${base}/forum/c/${criada.slug}`);
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  return (
    <form className="forum-formulario" onSubmit={enviar}>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} obrigatorio />
      <AreaTexto rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} linhas={3} />
      <Selecao rotulo="Cor" valor={cor} aoMudar={setCor} opcoes={CORES} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="forum-formulario-acoes">
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
        <Botao tipo="submit" desabilitado={enviando}>
          {enviando ? 'Criando...' : 'Criar comunidade'}
        </Botao>
      </div>
    </form>
  );
}
