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
  Modal,
  Pagina,
  Selecao,
  Selo,
  Tabela,
  formatarData,
} from '../../ui';

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
}

interface EmprestimoDTO {
  id: number;
  livroId: number;
  usuarioId: number;
  retiradoEm: string;
  devolucaoPrevista: string;
  devolvidoEm: string | null;
  status: 'ATIVO' | 'DEVOLVIDO';
  livro: { id: number; titulo: string; autor: string };
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

// ---------- Acervo ----------

function Acervo({ editavel }: { editavel: boolean }) {
  const [busca, setBusca] = useState('');
  const [formulario, setFormulario] = useState<{ livro: LivroDTO | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const termo = busca.trim();
  const qs = termo ? `?${new URLSearchParams({ busca: termo }).toString()}` : '';
  const livros = useDados<LivroDTO[]>('/livros' + qs);

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

  return (
    <>
      {editavel && (
        <div className="pagina-acoes">
          <Botao aoClicar={() => setFormulario({ livro: null })}>Novo livro</Botao>
        </div>
      )}

      <Campo
        rotulo="Buscar por título, autor ou categoria"
        valor={busca}
        aoMudar={setBusca}
      />

      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {livros.erro && <Aviso tipo="erro">{livros.erro}</Aviso>}
      {livros.carregando && <Carregando />}

      {livros.dados && (
        <Tabela
          dados={livros.dados}
          chave={(l) => l.id}
          vazio="Nenhum livro encontrado."
          colunas={[
            { titulo: 'Título', celula: (l) => l.titulo },
            { titulo: 'Autor', celula: (l) => l.autor },
            { titulo: 'Categoria', celula: (l) => l.categoria ?? '—' },
            { titulo: 'Ano', celula: (l) => (l.ano ?? '—') },
            { titulo: 'Disponíveis', celula: (l) => `${l.disponiveis}/${l.exemplares}` },
            ...(editavel
              ? [
                  {
                    titulo: 'Ações',
                    celula: (l: LivroDTO) => (
                      <>
                        <Botao variante="texto" aoClicar={() => setFormulario({ livro: l })}>
                          Editar
                        </Botao>
                        <Botao variante="perigo" aoClicar={() => excluir(l)}>
                          Excluir
                        </Botao>
                      </>
                    ),
                  },
                ]
              : []),
          ]}
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
            { titulo: 'Livro', celula: (e) => e.livro.titulo },
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
      <div className="pagina-acoes">
        <Botao aoClicar={() => setNovo(true)}>Novo empréstimo</Botao>
      </div>

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
            { titulo: 'Livro', celula: (e) => e.livro.titulo },
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
              celula: (e) =>
                e.status === 'ATIVO' ? (
                  <Botao variante="texto" aoClicar={() => devolver(e)}>
                    Registrar devolução
                  </Botao>
                ) : (
                  '—'
                ),
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
