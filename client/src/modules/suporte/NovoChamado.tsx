import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Aviso, AreaTexto, Botao, Campo, Modal, Selecao } from '../../ui';
import { CATEGORIAS, CampoAnexo, PRIORIDADES, mensagemErro } from './comum';
import type { Categoria, ChamadoDTO, Prioridade } from './comum';

// Quem responde a cada categoria, dito em uma frase logo abaixo do campo.
const QUEM_RESPONDE: Record<Categoria, string> = {
  TECNICO: 'Quem responde: a equipe de TI.',
  SECRETARIA: 'Quem responde: a secretaria.',
  FINANCEIRO: 'Quem responde: a secretaria.',
  ACADEMICO: 'Quem responde: o professor da turma.',
};

// Resposta de GET /chamados/turmas
interface TurmaOpcao {
  id: number;
  codigo: string;
  disciplina: string;
  professor: string;
}

const TEXTO_MAXIMO = 4000;

// Só o formulário fica montado enquanto o popup estiver aberto: ao fechar, os campos começam vazios.
export function NovoChamado({
  aberto,
  aoFechar,
  aoCriado,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriado: (chamado: ChamadoDTO) => void;
}) {
  if (!aberto) return null;
  return (
    <Modal aberto titulo="Novo chamado" aoFechar={aoFechar}>
      <Formulario aoFechar={aoFechar} aoCriado={aoCriado} />
    </Modal>
  );
}

function Formulario({
  aoFechar,
  aoCriado,
}: {
  aoFechar: () => void;
  aoCriado: (chamado: ChamadoDTO) => void;
}) {
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [turmaId, setTurmaId] = useState('');
  const [assunto, setAssunto] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('NORMAL');
  const [descricao, setDescricao] = useState('');
  const [anexo, setAnexo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Só Acadêmico precisa de turma; a lista vem do servidor apenas nesse caso.
  const { dados: turmas, carregando: carregandoTurmas, erro: erroTurmas } = useDados<TurmaOpcao[]>(
    categoria === 'ACADEMICO' ? '/chamados/turmas' : null,
  );

  // Escape fecha o formulário (o popup de Suporte ignora Escape enquanto este estiver aberto).
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFechar();
    }
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const assuntoLimpo = assunto.trim();
    const textoLimpo = descricao.trim();
    if (categoria === '') {
      setErro('Escolha a categoria.');
      return;
    }
    if (categoria === 'ACADEMICO' && turmaId === '') {
      setErro('Escolha a turma.');
      return;
    }
    if (assuntoLimpo.length < 3 || assuntoLimpo.length > 120) {
      setErro('O assunto deve ter de 3 a 120 caracteres.');
      return;
    }
    if (textoLimpo === '' || textoLimpo.length > TEXTO_MAXIMO) {
      setErro('Descreva o problema (até 4.000 caracteres).');
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const criado = await api.post<ChamadoDTO>('/chamados', {
        categoria,
        assunto: assuntoLimpo,
        prioridade,
        texto: textoLimpo,
        turmaId: categoria === 'ACADEMICO' ? Number(turmaId) : undefined,
        anexo: anexo ?? undefined,
      });
      aoCriado(criado);
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  const opcoesTurma = (turmas ?? []).map((t) => ({
    valor: String(t.id),
    rotulo: `${t.codigo} · ${t.disciplina}`,
  }));

  return (
    <form className="suporte-novo" onSubmit={enviar}>
      <Selecao
        rotulo="Categoria"
        obrigatorio
        valor={categoria}
        vazio="Selecione a categoria"
        opcoes={CATEGORIAS}
        aoMudar={(valor) => {
          setCategoria(valor as Categoria | '');
          setTurmaId('');
        }}
      />
      {categoria !== '' && <p className="suporte-ajuda">{QUEM_RESPONDE[categoria]}</p>}

      {categoria === 'ACADEMICO' && (
        <>
          {erroTurmas && <Aviso tipo="erro">{erroTurmas}</Aviso>}
          {!carregandoTurmas && !erroTurmas && opcoesTurma.length === 0 && (
            <Aviso tipo="info">Você não tem turmas disponíveis para este tipo de chamado.</Aviso>
          )}
          <Selecao
            rotulo="Turma"
            obrigatorio
            valor={turmaId}
            vazio={carregandoTurmas ? 'Carregando turmas...' : 'Selecione a turma'}
            opcoes={opcoesTurma}
            aoMudar={setTurmaId}
          />
        </>
      )}

      <Campo rotulo="Assunto" obrigatorio valor={assunto} aoMudar={setAssunto} />
      <Selecao
        rotulo="Prioridade"
        valor={prioridade}
        opcoes={PRIORIDADES}
        aoMudar={(valor) => setPrioridade(valor as Prioridade)}
      />
      <AreaTexto
        rotulo="Descreva o problema"
        valor={descricao}
        aoMudar={setDescricao}
        linhas={5}
      />
      <CampoAnexo valor={anexo} aoMudar={setAnexo} ocupado={enviando} />

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="suporte-encerrar-acoes">
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
        <Botao tipo="submit" desabilitado={enviando}>
          {enviando ? 'Enviando...' : 'Abrir chamado'}
        </Botao>
      </div>
    </form>
  );
}
