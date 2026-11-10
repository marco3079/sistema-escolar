import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { AreaTexto, Aviso, Botao, Campo, Selecao } from '../../ui';
import { PUBLICOS } from './tipos';
import type { CursoResumo, PublicoComunicado, TurmaResumo } from './tipos';

interface NovoComunicado {
  titulo: string;
  corpo: string;
  publico: PublicoComunicado;
  turmaId?: number;
  cursoId?: number;
}

// Formulário de "Novo comunicado". Administração escolhe o público; professor só envia para turma dele.
// É montado ao abrir o modal.
export function FormularioComunicado({
  modoProfessor = false,
  aoSalvo,
}: {
  modoProfessor?: boolean;
  aoSalvo(): void;
}) {
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [publico, setPublico] = useState<PublicoComunicado>(modoProfessor ? 'TURMA' : 'TODOS');
  const [turmaId, setTurmaId] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const turmasMinhas = useDados<TurmaResumo[]>(modoProfessor ? '/turmas/minhas' : null);
  const turmasTodas = useDados<TurmaResumo[]>(
    !modoProfessor && publico === 'TURMA' ? '/turmas' : null,
  );
  const cursos = useDados<CursoResumo[]>(!modoProfessor && publico === 'CURSO' ? '/cursos' : null);

  const turmas = modoProfessor ? turmasMinhas : turmasTodas;
  const opcoesTurma = (turmas.dados ?? []).map((t) => ({
    valor: String(t.id),
    rotulo: `${t.codigo} - ${t.disciplina.nome}${t.grupo ? ` (${t.grupo})` : ''}`,
  }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!titulo.trim() || !corpo.trim()) {
      setErro('Preencha o título e o texto do comunicado.');
      return;
    }
    if (publico === 'TURMA' && !turmaId) {
      setErro('Escolha a turma.');
      return;
    }
    if (publico === 'CURSO' && !cursoId) {
      setErro('Escolha o curso.');
      return;
    }

    const dados: NovoComunicado = {
      titulo: titulo.trim(),
      corpo: corpo.trim(),
      publico,
    };
    if (publico === 'TURMA') dados.turmaId = Number(turmaId);
    if (publico === 'CURSO') dados.cursoId = Number(cursoId);

    setEnviando(true);
    try {
      await api.post('/comunicados', dados);
      aoSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} obrigatorio />
      <AreaTexto rotulo="Texto" valor={corpo} aoMudar={setCorpo} linhas={6} />

      {modoProfessor ? (
        <Selecao
          rotulo="Turma"
          valor={turmaId}
          aoMudar={setTurmaId}
          opcoes={opcoesTurma}
          vazio="Selecione a turma"
          obrigatorio
        />
      ) : (
        <>
          <Selecao
            rotulo="Para quem"
            valor={publico}
            aoMudar={(v) => {
              setPublico(v as PublicoComunicado);
              setTurmaId('');
              setCursoId('');
            }}
            opcoes={PUBLICOS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))}
            obrigatorio
          />
          {publico === 'TURMA' && (
            <Selecao
              rotulo="Turma"
              valor={turmaId}
              aoMudar={setTurmaId}
              opcoes={opcoesTurma}
              vazio="Selecione a turma"
              obrigatorio
            />
          )}
          {publico === 'CURSO' && (
            <Selecao
              rotulo="Curso"
              valor={cursoId}
              aoMudar={setCursoId}
              opcoes={(cursos.dados ?? []).map((c) => ({ valor: String(c.id), rotulo: c.nome }))}
              vazio="Selecione o curso"
              obrigatorio
            />
          )}
        </>
      )}
      {turmas.erro && <Aviso tipo="erro">{turmas.erro}</Aviso>}
      {cursos.erro && <Aviso tipo="erro">{cursos.erro}</Aviso>}

      <Botao tipo="submit" desabilitado={enviando}>
        {enviando ? 'Enviando...' : 'Enviar comunicado'}
      </Botao>
    </form>
  );
}
