import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Abas, Aviso, Avatar, Botao, Campo, Carregando, Cartao, Pagina, formatarData } from '../../ui';
import { Icone } from '../../ui/icones';
import type { NomeIcone } from '../../ui/icones';
import { dataBr, mensagemErro, nulo, rotuloTitulacao } from './tipos';
import type { PerfilMeu } from './tipos';
import { PerfilFoto } from './PerfilFoto';
import { PerfilMedalhas, iconeSeguro } from './PerfilMedalhas';
import type { MedalhaDTO } from './PerfilMedalhas';
import './perfil.css';

// Formato de GET /perfil/completo (docs/plano/terceira-leva.md, "Perfil e medalhas").
interface IndicadorResumo {
  rotulo: string;
  valor: string;
  icone: string;
  cor: string;
}

interface PerfilCompletoDTO {
  usuario: {
    id: number;
    nome: string;
    email: string;
    perfil: string;
    telefone: string | null;
    foto: string | null;
    criadoEm: string;
    ra: string | null;
    registro: string | null;
    titulacao: string | null;
    area: string | null;
    curso: string | null;
  };
  nivel: {
    pontos: number;
    nivel: number;
    titulo: string;
    pontosDoNivel: number;
    pontosProximoNivel: number | null;
  };
  resumo: IndicadorResumo[];
  medalhas: MedalhaDTO[];
  atividadeRecente: { id: number; criadoEm: string; tipo: string; descricao: string; modulo: string }[];
}

const PAPEIS: Record<string, string> = {
  ADMIN: 'Administrador',
  TI: 'TI',
  SECRETARIA: 'Secretaria',
  PROFESSOR: 'Professor',
  ALUNO: 'Aluno',
};

const ICONE_ATIVIDADE: Record<string, NomeIcone> = {
  CRIACAO: 'mais',
  ALTERACAO: 'lapis',
  EXCLUSAO: 'fechar',
};

function tempoRelativo(iso: string): string {
  const momento = new Date(iso).getTime();
  if (Number.isNaN(momento)) return '';
  const minutos = Math.round((Date.now() - momento) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return formatarData(iso);
}

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

// ---------- Blocos da visão geral ----------

function CabecalhoPerfil({
  dados,
  aoTrocarFoto,
}: {
  dados: PerfilCompletoDTO;
  aoTrocarFoto: () => void;
}) {
  const u = dados.usuario;
  const identificacao =
    u.perfil === 'ALUNO'
      ? [u.ra && `RA ${u.ra}`, u.curso].filter(Boolean).join(' · ')
      : u.perfil === 'PROFESSOR'
        ? [
            u.registro && `Registro ${u.registro}`,
            u.titulacao && rotuloTitulacao(u.titulacao),
            u.area,
          ]
            .filter(Boolean)
            .join(' · ')
        : '';
  const desde = new Date(u.criadoEm).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="cartao perfil-cabecalho">
      <div className="perfil-capa" aria-hidden="true" />
      <div className="perfil-cabecalho-corpo">
        <Avatar nome={u.nome} foto={u.foto} tamanho={96} className="perfil-foto-grande" />
        <div className="perfil-identidade">
          <div className="perfil-nome-linha">
            <h2 className="perfil-nome">{u.nome}</h2>
            <div className="perfil-acao-foto">
              <Botao variante="secundario" aoClicar={aoTrocarFoto}>
                Trocar foto
              </Botao>
            </div>
          </div>
          <span className="perfil-papel">{PAPEIS[u.perfil] ?? u.perfil}</span>
          {identificacao && <p className="perfil-linha-id">{identificacao}</p>}
          <p className="perfil-desde">No sistema desde {desde}</p>
        </div>
      </div>
    </section>
  );
}

// pontosDoNivel é o mínimo do nível atual (início da faixa), não o progresso dentro dele.
// A API não manda percentual: o cálculo é feito aqui, em 0 a 100.
function percentualNivel(nivel: PerfilCompletoDTO['nivel']): number {
  if (nivel.pontosProximoNivel === null) return 100;
  if (nivel.pontos <= 0) return 0;
  const faixa = nivel.pontosProximoNivel - nivel.pontosDoNivel;
  const feito = nivel.pontos - nivel.pontosDoNivel;
  const bruto = faixa > 0 ? (feito / faixa) * 100 : 0;
  // Com pontos, pelo menos 4% aparece para a barra não parecer vazia.
  return Math.min(100, Math.max(4, Math.round(bruto)));
}

function CartaoNivel({ nivel }: { nivel: PerfilCompletoDTO['nivel'] }) {
  const proximo = nivel.pontosProximoNivel;
  const pct = percentualNivel(nivel);
  return (
    <section className="cartao">
      <div className="perfil-nivel-topo">
        <h2 className="perfil-nivel-titulo">
          Nível {nivel.nivel}: {nivel.titulo}
        </h2>
        <span className="perfil-nivel-pontos">{nivel.pontos} pontos</span>
      </div>
      <div
        className="perfil-barra-nivel"
        role="progressbar"
        aria-label="Progresso do nível"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="perfil-nivel-faltam">
        {proximo === null
          ? 'Nível máximo'
          : `faltam ${proximo - nivel.pontos} pontos para o próximo nível`}
      </p>
    </section>
  );
}

function IndicadoresResumo({ indicadores }: { indicadores: IndicadorResumo[] }) {
  return (
    <div className="perfil-indicadores">
      {indicadores.map((i) => (
        <div className="perfil-indicador" key={i.rotulo}>
          <span className={`perfil-indicador-icone perfil-cor-${i.cor}`}>
            <Icone nome={iconeSeguro(i.icone)} tamanho={22} />
          </span>
          <div className="perfil-indicador-texto">
            <span className="perfil-indicador-valor">{i.valor}</span>
            <span className="perfil-indicador-rotulo">{i.rotulo}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AtividadeRecente({ itens }: { itens: PerfilCompletoDTO['atividadeRecente'] }) {
  return (
    <section className="cartao">
      <h2 className="cartao-titulo">Atividade recente</h2>
      {itens.length === 0 ? (
        <p className="perfil-vazio">Sem atividade recente.</p>
      ) : (
        <ul className="perfil-atividade">
          {itens.map((a) => (
            <li className="perfil-atividade-item" key={a.id}>
              <span className="perfil-atividade-icone perfil-cor-azul">
                <Icone nome={ICONE_ATIVIDADE[a.tipo] ?? 'atividade'} tamanho={18} />
              </span>
              <div className="perfil-atividade-texto">
                <span className="perfil-atividade-descricao">{a.descricao}</span>
                <span className="perfil-atividade-meta">
                  {a.modulo} · {tempoRelativo(a.criadoEm)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Dados e segurança ----------

function DadosESeguranca({
  dados,
  aoSalvo,
}: {
  dados: PerfilMeu;
  aoSalvo: () => void;
}) {
  return (
    <>
      <Cartao titulo="Meus dados">
        <p>
          <strong>Nome:</strong> {dados.nome}
        </p>
        <p>
          <strong>E-mail:</strong> {dados.email}
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
        <FormDadosPerfil perfil={dados} aoSalvo={aoSalvo} />
      </Cartao>

      <Cartao>
        <FormTrocarSenha />
      </Cartao>
    </>
  );
}

// ---------- Tela "Meu perfil" (todos os perfis) ----------

export function MeuPerfil() {
  const completo = useDados<PerfilCompletoDTO>('/perfil/completo');
  const meu = useDados<PerfilMeu>('/perfil/meu');
  const [aba, setAba] = useState<'visao' | 'dados'>('visao');
  const [fotoAberta, setFotoAberta] = useState(false);

  function recarregarTudo() {
    completo.recarregar();
    meu.recarregar();
  }

  // Dados e senha não dependem do /perfil/completo: continuam na tela se ele falhar.
  const parteDados = meu.dados && (
    <DadosESeguranca dados={meu.dados} aoSalvo={recarregarTudo} />
  );

  if (completo.erro) {
    return (
      <Pagina titulo="Meu perfil">
        <Aviso tipo="erro">{completo.erro}</Aviso>
        {meu.erro && <Aviso tipo="erro">{meu.erro}</Aviso>}
        {meu.carregando && !meu.dados && <Carregando />}
        {parteDados}
      </Pagina>
    );
  }

  if (completo.carregando && !completo.dados) {
    return (
      <Pagina titulo="Meu perfil">
        <Carregando />
      </Pagina>
    );
  }

  const dados = completo.dados;
  if (!dados) {
    return <Pagina titulo="Meu perfil">{meu.erro && <Aviso tipo="erro">{meu.erro}</Aviso>}</Pagina>;
  }

  const medalhasAutomaticas = dados.usuario.perfil === 'ALUNO' || dados.usuario.perfil === 'PROFESSOR';

  return (
    <Pagina titulo="Meu perfil">
      <CabecalhoPerfil dados={dados} aoTrocarFoto={() => setFotoAberta(true)} />

      {fotoAberta && (
        <PerfilFoto
          aberto
          aoFechar={() => setFotoAberta(false)}
          nome={dados.usuario.nome}
          fotoAtual={dados.usuario.foto}
          aoSalvo={recarregarTudo}
        />
      )}

      <Abas
        abas={[
          { id: 'visao', rotulo: 'Visão geral' },
          { id: 'dados', rotulo: 'Dados e segurança' },
        ]}
        ativa={aba}
        aoMudar={(id) => setAba(id as 'visao' | 'dados')}
      />

      {aba === 'visao' ? (
        <div className="perfil-visao">
          <CartaoNivel nivel={dados.nivel} />
          <IndicadoresResumo indicadores={dados.resumo} />
          <PerfilMedalhas
            medalhas={dados.medalhas}
            automaticasDisponiveis={medalhasAutomaticas}
          />
          <AtividadeRecente itens={dados.atividadeRecente} />
        </div>
      ) : (
        <div className="perfil-dados">
          {meu.erro && <Aviso tipo="erro">{meu.erro}</Aviso>}
          {meu.carregando && !meu.dados && <Carregando />}
          {parteDados}
        </div>
      )}
    </Pagina>
  );
}
