import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useDados } from '../../lib/useDados';
import type { RotaModulo } from '../../lib/rotas';
import {
  Abas,
  Aviso,
  Botao,
  Campo,
  Carregando,
  MenuAcoes,
  Modal,
  Pagina,
  Selecao,
  Selo,
  Tabela,
  formatarData,
} from '../../ui';
import type { AcaoMenu } from '../../ui';
import { Icone } from '../../ui/icones';
import { CapaLivro } from './CapaLivro';
import { CampoCapa } from './CampoCapa';
import './biblioteca.css';

// ---------- Tipos (formato do CONTRATOS 5.8) ----------

interface LivroDTO {
  id: number;
  titulo: string;
  autor: string;
  isbn: string | null;
  editora: string | null;
  ano: number | null;
  categoria: string | null;
  exemplares: number;
  disponiveis: number;
  capa: string | null;
}

interface EmprestimoDTO {
  id: number;
  livroId: number;
  usuarioId: number;
  retiradoEm: string;
  devolucaoPrevista: string;
  devolvidoEm: string | null;
  status: 'ATIVO' | 'DEVOLVIDO';
  livro: { id: number; titulo: string; autor: string; capa: string | null };
  usuario: { id: number; nome: string; perfil: string };
  atrasado: boolean;
}

interface UsuarioLista {
  id: number;
  nome: string;
  perfil: string;
}

interface AlunoLista {
  id: number;
  ra: string;
  usuario: { id: number; nome: string };
}

// ---------- Auxiliares ----------

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Campo de texto opcional: vazio vira null
function opcionalTexto(valor: string): string | null {
  const limpo = valor.trim();
  return limpo === '' ? null : limpo;
}

const ROTULO_PERFIL: Record<string, string> = {
  ADMIN: 'Administrador',
  TI: 'TI',
  SECRETARIA: 'Secretaria',
  PROFESSOR: 'Professor',
  ALUNO: 'Aluno',
};

function situacaoEmprestimo(e: EmprestimoDTO): {
  rotulo: string;
  cor: 'azul' | 'verde' | 'vermelho';
} {
  if (e.status === 'DEVOLVIDO') return { rotulo: 'Devolvido', cor: 'azul' };
  if (e.atrasado) return { rotulo: 'Atrasado', cor: 'vermelho' };
  return { rotulo: 'No prazo', cor: 'verde' };
}

function SeloSituacao({ emprestimo }: { emprestimo: EmprestimoDTO }) {
  const info = situacaoEmprestimo(emprestimo);
  return <Selo cor={info.cor}>{info.rotulo}</Selo>;
}

// ---------- Visão do acervo (tabela ou cartões), guardada no navegador ----------

type Visao = 'tabela' | 'cartoes';
const CHAVE_VISAO = 'escola.biblioteca.visao';

// Padrão sem escolha salva: cartões
const VISAO_PADRAO: Visao = 'cartoes';

function lerVisao(): Visao {
  try {
    const salva = window.localStorage.getItem(CHAVE_VISAO);
    if (salva === 'tabela' || salva === 'cartoes') return salva;
  } catch {
    // Armazenamento indisponível: usa o padrão
  }
  return VISAO_PADRAO;
}

function gravarVisao(visao: Visao) {
  try {
    window.localStorage.setItem(CHAVE_VISAO, visao);
  } catch {
    // Sem armazenamento: a escolha vale só nesta página
  }
}

function AlternarVisao({ visao, aoMudar }: { visao: Visao; aoMudar: (v: Visao) => void }) {
  return (
    <div className="biblioteca-alternar" role="group" aria-label="Modo de exibição">
      <button
        type="button"
        className="biblioteca-alternar-botao"
        aria-label="Tabela"
        title="Tabela"
        aria-pressed={visao === 'tabela'}
        onClick={() => aoMudar('tabela')}
      >
        <Icone nome="lista" />
      </button>
      <button
        type="button"
        className="biblioteca-alternar-botao"
        aria-label="Cartões"
        title="Cartões"
        aria-pressed={visao === 'cartoes'}
        onClick={() => aoMudar('cartoes')}
      >
        <Icone nome="grade" />
      </button>
    </div>
  );
}

// ---------- Acervo ----------

function CartoesLivros({
  livros,
  editavel,
  acoesDoLivro,
}: {
  livros: LivroDTO[];
  editavel: boolean;
  acoesDoLivro: (livro: LivroDTO) => AcaoMenu[];
}) {
  if (livros.length === 0) {
    return <p className="tabela-vazia">Nenhum livro encontrado.</p>;
  }
  return (
    <ul className="biblioteca-cartoes">
      {livros.map((l) => (
        <li key={l.id} className="biblioteca-cartao">
          {editavel && (
            <div className="biblioteca-cartao-menu">
              <MenuAcoes rotulo={`Ações de ${l.titulo}`} acoes={acoesDoLivro(l)} />
            </div>
          )}
          <CapaLivro livro={l} tamanho="grande" />
          <div className="biblioteca-cartao-corpo">
            <span className="biblioteca-cartao-titulo" title={l.titulo}>
              {l.titulo}
            </span>
            <span className="biblioteca-cartao-texto">{l.autor}</span>
            <span className="biblioteca-cartao-texto">
              {l.categoria ?? '—'} · {l.ano ?? '—'}
            </span>
            <Selo cor={l.disponiveis > 0 ? 'verde' : 'vermelho'}>
              {`${l.disponiveis} de ${l.exemplares} disponíveis`}
            </Selo>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Acervo({ editavel }: { editavel: boolean }) {
  const [busca, setBusca] = useState('');
  const [visao, setVisao] = useState<Visao>(lerVisao);
  const [formulario, setFormulario] = useState<{ livro: LivroDTO | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const termo = busca.trim();
  const qs = termo ? `?${new URLSearchParams({ busca: termo }).toString()}` : '';
  const livros = useDados<LivroDTO[]>('/livros' + qs);

  function trocarVisao(nova: Visao) {
    setVisao(nova);
    gravarVisao(nova);
  }

  async function excluir(livro: LivroDTO) {
    if (!window.confirm(`Excluir o livro "${livro.titulo}"?`)) return;
    setErroAcao(null);
    setAviso(null);
    try {
      await api.del(`/livros/${livro.id}`);
      setAviso('Livro excluído.');
      livros.recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  // Ações de cada livro (tabela e cartões), no menu de três pontos.
  function acoesDoLivro(l: LivroDTO): AcaoMenu[] {
    return [
      { rotulo: 'Editar', icone: 'lapis', aoClicar: () => setFormulario({ livro: l }) },
      { rotulo: 'Excluir', icone: 'fechar', perigo: true, aoClicar: () => void excluir(l) },
    ];
  }

  return (
    <>
      <div className="barra-ferramentas">
        <div className="filtros">
          <input
            type="search"
            className="campo-controle biblioteca-busca"
            placeholder="Buscar por título, autor ou categoria"
            aria-label="Buscar por título, autor ou categoria"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="biblioteca-acoes-barra">
          <AlternarVisao visao={visao} aoMudar={trocarVisao} />
          {editavel && (
            <Botao aoClicar={() => setFormulario({ livro: null })}>Novo livro</Botao>
          )}
        </div>
      </div>

      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {livros.erro && <Aviso tipo="erro">{livros.erro}</Aviso>}
      {livros.carregando && <Carregando />}

      {livros.dados && visao === 'tabela' && (
        <Tabela
          dados={livros.dados}
          chave={(l) => l.id}
          vazio="Nenhum livro encontrado."
          colunas={[
            {
              titulo: 'Título',
              celula: (l) => (
                <div className="biblioteca-titulo-celula">
                  <CapaLivro livro={l} tamanho="mini" />
                  <div>
                    <span className="biblioteca-titulo-livro">{l.titulo}</span>
                    <span className="biblioteca-autor">{l.autor}</span>
                  </div>
                </div>
              ),
            },
            { titulo: 'Categoria', celula: (l) => l.categoria ?? '—' },
            { titulo: 'Ano', celula: (l) => (l.ano ?? '—') },
            { titulo: 'Disponíveis', celula: (l) => `${l.disponiveis}/${l.exemplares}` },
            ...(editavel
              ? [
                  {
                    titulo: 'Ações',
                    acoes: true,
                    celula: (l: LivroDTO) => (
                      <MenuAcoes rotulo={`Ações de ${l.titulo}`} acoes={acoesDoLivro(l)} />
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}

      {livros.dados && visao === 'cartoes' && (
        <CartoesLivros
          livros={livros.dados}
          editavel={editavel}
          acoesDoLivro={acoesDoLivro}
        />
      )}

      {formulario && (
        <FormLivro
          livro={formulario.livro}
          aoFechar={() => setFormulario(null)}
          aoSalvo={(mensagem) => {
            setAviso(mensagem);
            livros.recarregar();
          }}
        />
      )}
    </>
  );
}

function FormLivro({
  livro,
  aoFechar,
  aoSalvo,
}: {
  livro: LivroDTO | null;
  aoFechar: () => void;
  aoSalvo: (mensagem: string) => void;
}) {
  const [titulo, setTitulo] = useState(livro?.titulo ?? '');
  const [autor, setAutor] = useState(livro?.autor ?? '');
  const [isbn, setIsbn] = useState(livro?.isbn ?? '');
  const [editora, setEditora] = useState(livro?.editora ?? '');
  const [ano, setAno] = useState(livro?.ano != null ? String(livro.ano) : '');
  const [categoria, setCategoria] = useState(livro?.categoria ?? '');
  const [exemplares, setExemplares] = useState(livro ? String(livro.exemplares) : '1');
  const [capa, setCapa] = useState<string | null>(livro?.capa ?? null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const qtd = Number(exemplares);
    if (!Number.isInteger(qtd) || qtd < 0) {
      setErro('Informe uma quantidade de exemplares válida (0 ou mais).');
      return;
    }
    const corpo = {
      titulo: titulo.trim(),
      autor: autor.trim(),
      isbn: opcionalTexto(isbn),
      editora: opcionalTexto(editora),
      ano: ano.trim() === '' ? null : Number(ano),
      categoria: opcionalTexto(categoria),
      exemplares: qtd,
      capa,
    };
    setEnviando(true);
    try {
      if (livro) {
        await api.put(`/livros/${livro.id}`, corpo);
        aoSalvo('Livro atualizado.');
      } else {
        await api.post('/livros', corpo);
        aoSalvo('Livro cadastrado.');
      }
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  return (
    <Modal aberto titulo={livro ? 'Editar livro' : 'Novo livro'} aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <CampoCapa
          valor={capa}
          aoMudar={setCapa}
          livro={{ titulo, categoria }}
        />
        <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} obrigatorio />
        <Campo rotulo="Autor" valor={autor} aoMudar={setAutor} obrigatorio />
        <Campo rotulo="ISBN" valor={isbn} aoMudar={setIsbn} />
        <Campo rotulo="Editora" valor={editora} aoMudar={setEditora} />
        <Campo rotulo="Ano" tipo="number" valor={ano} aoMudar={setAno} />
        <Campo rotulo="Categoria" valor={categoria} aoMudar={setCategoria} />
        <Campo
          rotulo="Exemplares"
          tipo="number"
          valor={exemplares}
          aoMudar={setExemplares}
          obrigatorio
        />
        <Botao tipo="submit" desabilitado={enviando}>
          Salvar
        </Botao>{' '}
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
      </form>
    </Modal>
  );
}

// ---------- Meus empréstimos ----------

function MeusEmprestimos() {
  const meus = useDados<EmprestimoDTO[]>('/emprestimos/meus');

  return (
    <>
      {meus.erro && <Aviso tipo="erro">{meus.erro}</Aviso>}
      {meus.carregando && <Carregando />}
      {meus.dados && (
        <Tabela
          dados={meus.dados}
          chave={(e) => e.id}
          vazio="Você não tem empréstimos."
          colunas={[
            {
              titulo: 'Livro',
              celula: (e) => (
                <div className="biblioteca-titulo-celula">
                  <CapaLivro livro={e.livro} tamanho="mini" />
                  <span className="biblioteca-titulo-livro">{e.livro.titulo}</span>
                </div>
              ),
            },
            { titulo: 'Retirada', celula: (e) => formatarData(e.retiradoEm) },
            { titulo: 'Devolução prevista', celula: (e) => formatarData(e.devolucaoPrevista) },
            { titulo: 'Situação', celula: (e) => <SeloSituacao emprestimo={e} /> },
          ]}
        />
      )}
    </>
  );
}

// ---------- Empréstimos (administrativo) ----------

function NovoEmprestimo({
  aoFechar,
  aoSalvo,
}: {
  aoFechar: () => void;
  aoSalvo: (mensagem: string) => void;
}) {
  const { usuario } = useAuth();
  const ehAdmin = usuario?.perfil === 'ADMIN';
  const livros = useDados<LivroDTO[]>('/livros');
  // ADMIN escolhe entre todos os usuários (GET /usuarios); SECRETARIA escolhe entre alunos (GET /alunos)
  const usuarios = useDados<UsuarioLista[]>(ehAdmin ? '/usuarios' : null);
  const alunos = useDados<AlunoLista[]>(ehAdmin ? null : '/alunos');
  const [livroId, setLivroId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [dias, setDias] = useState('14');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoesLivros = (livros.dados ?? [])
    .filter((l) => l.disponiveis > 0)
    .map((l) => ({ valor: String(l.id), rotulo: `${l.titulo} (disponíveis: ${l.disponiveis})` }));

  const opcoesUsuarios: { valor: string; rotulo: string }[] = ehAdmin
    ? (usuarios.dados ?? []).map((u) => ({
        valor: String(u.id),
        rotulo: `${u.nome} (${ROTULO_PERFIL[u.perfil] ?? u.perfil})`,
      }))
    : (alunos.dados ?? []).map((a) => ({
        valor: String(a.usuario.id),
        rotulo: `${a.usuario.nome} (RA ${a.ra})`,
      }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post('/emprestimos', {
        livroId: Number(livroId),
        usuarioId: Number(usuarioId),
        dias: Number(dias),
      });
      aoSalvo('Empréstimo registrado.');
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  return (
    <Modal aberto titulo="Novo empréstimo" aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {livros.erro && <Aviso tipo="erro">{livros.erro}</Aviso>}
        {(usuarios.erro ?? alunos.erro) && <Aviso tipo="erro">{usuarios.erro ?? alunos.erro}</Aviso>}
        <Selecao
          rotulo="Livro"
          valor={livroId}
          aoMudar={setLivroId}
          opcoes={opcoesLivros}
          obrigatorio
        />
        <Selecao
          rotulo={ehAdmin ? 'Usuário' : 'Aluno'}
          valor={usuarioId}
          aoMudar={setUsuarioId}
          opcoes={opcoesUsuarios}
          obrigatorio
        />
        <Campo rotulo="Dias de empréstimo" tipo="number" valor={dias} aoMudar={setDias} obrigatorio />
        <Botao tipo="submit" desabilitado={enviando || livros.carregando}>
          Registrar empréstimo
        </Botao>{' '}
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
      </form>
    </Modal>
  );
}

function Emprestimos() {
  const [status, setStatus] = useState('');
  const [novo, setNovo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const qs = status ? `?${new URLSearchParams({ status }).toString()}` : '';
  const emprestimos = useDados<EmprestimoDTO[]>('/emprestimos' + qs);

  async function devolver(e: EmprestimoDTO) {
    setErroAcao(null);
    setAviso(null);
    try {
      await api.post(`/emprestimos/${e.id}/devolver`);
      setAviso('Devolução registrada.');
      emprestimos.recarregar();
    } catch (err) {
      setErroAcao(mensagemErro(err));
    }
  }

  return (
    <>
      <div className="barra-ferramentas">
        <div className="filtros">
          <Selecao
            rotulo="Situação"
            valor={status}
            aoMudar={setStatus}
            vazio="Todos"
            opcoes={[
              { valor: 'ATIVO', rotulo: 'Ativos' },
              { valor: 'DEVOLVIDO', rotulo: 'Devolvidos' },
            ]}
          />
        </div>
        <div className="biblioteca-acoes-barra">
          <Botao aoClicar={() => setNovo(true)}>Novo empréstimo</Botao>
        </div>
      </div>

      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {emprestimos.erro && <Aviso tipo="erro">{emprestimos.erro}</Aviso>}
      {emprestimos.carregando && <Carregando />}

      {emprestimos.dados && (
        <Tabela
          dados={emprestimos.dados}
          chave={(e) => e.id}
          vazio="Nenhum empréstimo encontrado."
          colunas={[
            {
              titulo: 'Livro',
              celula: (e) => (
                <div className="biblioteca-titulo-celula">
                  <CapaLivro livro={e.livro} tamanho="mini" />
                  <span className="biblioteca-titulo-livro">{e.livro.titulo}</span>
                </div>
              ),
            },
            { titulo: 'Usuário', celula: (e) => e.usuario.nome },
            {
              titulo: 'Perfil',
              celula: (e) => ROTULO_PERFIL[e.usuario.perfil] ?? e.usuario.perfil,
            },
            { titulo: 'Retirada', celula: (e) => formatarData(e.retiradoEm) },
            { titulo: 'Devolução prevista', celula: (e) => formatarData(e.devolucaoPrevista) },
            { titulo: 'Situação', celula: (e) => <SeloSituacao emprestimo={e} /> },
            {
              titulo: 'Ações',
              acoes: true,
              celula: (e) =>
                e.status === 'ATIVO' ? (
                  <MenuAcoes
                    rotulo={`Ações do empréstimo de ${e.livro.titulo}`}
                    acoes={[
                      {
                        rotulo: 'Registrar devolução',
                        aoClicar: () => void devolver(e),
                      },
                    ]}
                  />
                ) : null,
            },
          ]}
        />
      )}

      {novo && (
        <NovoEmprestimo
          aoFechar={() => setNovo(false)}
          aoSalvo={(mensagem) => {
            setAviso(mensagem);
            emprestimos.recarregar();
          }}
        />
      )}
    </>
  );
}

// ---------- Telas ----------

function BibliotecaAdmin() {
  const [aba, setAba] = useState('acervo');
  return (
    <Pagina titulo="Biblioteca">
      <Abas
        abas={[
          { id: 'acervo', rotulo: 'Acervo' },
          { id: 'emprestimos', rotulo: 'Empréstimos' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      {aba === 'acervo' ? <Acervo editavel /> : <Emprestimos />}
    </Pagina>
  );
}

function BibliotecaUsuario() {
  const [aba, setAba] = useState('acervo');
  return (
    <Pagina titulo="Biblioteca">
      <Abas
        abas={[
          { id: 'acervo', rotulo: 'Acervo' },
          { id: 'meus', rotulo: 'Meus empréstimos' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      {aba === 'acervo' ? <Acervo editavel={false} /> : <MeusEmprestimos />}
    </Pagina>
  );
}

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/biblioteca',
    rotulo: 'Biblioteca',
    icone: 'biblioteca',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <BibliotecaAdmin />,
    ordem: 61,
  },
  {
    caminho: '/aluno/biblioteca',
    rotulo: 'Biblioteca',
    icone: 'biblioteca',
    perfis: ['ALUNO'],
    elemento: <BibliotecaUsuario />,
    ordem: 61,
  },
  {
    caminho: '/professor/biblioteca',
    rotulo: 'Biblioteca',
    icone: 'biblioteca',
    perfis: ['PROFESSOR'],
    elemento: <BibliotecaUsuario />,
    ordem: 61,
  },
];
