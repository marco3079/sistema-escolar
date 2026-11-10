import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Campo, Selecao } from '../../ui';
import { DIAS_SEMANA } from './tipos';
import type { PeriodoResumo, TurmaResumo } from './tipos';

// Formulário de "Novo horário" (dentro do Modal). É montado ao abrir o modal.
export function FormularioHorario({
  periodos,
  periodoInicial,
  aoSalvo,
}: {
  periodos: PeriodoResumo[];
  periodoInicial: string;
  aoSalvo(): void;
}) {
  const [periodoId, setPeriodoId] = useState(periodoInicial);
  const [turmaId, setTurmaId] = useState('');
  const [dia, setDia] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [sala, setSala] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const turmas = useDados<TurmaResumo[]>(periodoId ? `/turmas?periodoLetivoId=${periodoId}` : null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!turmaId || !dia || !horaInicio || !horaFim) {
      setErro('Preencha turma, dia e os horários de início e fim.');
      return;
    }
    if (horaFim <= horaInicio) {
      setErro('A hora de fim deve ser depois da hora de início.');
      return;
    }

    setEnviando(true);
    try {
      await api.post('/horarios', {
        turmaId: Number(turmaId),
        diaSemana: Number(dia),
        horaInicio,
        horaFim,
        sala: sala.trim() || undefined,
      });
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
      <Selecao
        rotulo="Período letivo"
        valor={periodoId}
        aoMudar={(v) => {
          setPeriodoId(v);
          setTurmaId('');
        }}
        opcoes={periodos.map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
        obrigatorio
      />
      <Selecao
        rotulo="Turma"
        valor={turmaId}
        aoMudar={setTurmaId}
        opcoes={(turmas.dados ?? []).map((t) => ({
          valor: String(t.id),
          rotulo: `${t.codigo} - ${t.disciplina.nome}${t.grupo ? ` (${t.grupo})` : ''}`,
        }))}
        vazio={periodoId ? 'Selecione a turma' : 'Escolha um período primeiro'}
        obrigatorio
      />
      {turmas.erro && <Aviso tipo="erro">{turmas.erro}</Aviso>}
      <Selecao
        rotulo="Dia da semana"
        valor={dia}
        aoMudar={setDia}
        opcoes={DIAS_SEMANA.map((d) => ({ valor: String(d.valor), rotulo: d.rotulo }))}
        obrigatorio
      />
      <Campo rotulo="Hora de início" tipo="time" valor={horaInicio} aoMudar={setHoraInicio} obrigatorio />
      <Campo rotulo="Hora de fim" tipo="time" valor={horaFim} aoMudar={setHoraFim} obrigatorio />
      <Campo
        rotulo="Sala (vazio usa a sala da turma)"
        valor={sala}
        aoMudar={setSala}
      />
      <Botao tipo="submit" desabilitado={enviando}>
        {enviando ? 'Salvando...' : 'Salvar horário'}
      </Botao>
    </form>
  );
}
