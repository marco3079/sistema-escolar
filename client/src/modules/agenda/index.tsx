import { useState } from 'react';
import { api } from '../../lib/api';
import type { RotaModulo } from '../../lib/rotas';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Campo, Carregando, Modal, Pagina, Selecao, Tabela } from '../../ui';
import { Calendario } from './Calendario';
import { FormularioEvento } from './FormularioEvento';
import { FormularioHorario } from './FormularioHorario';
import { GradeHorario } from './GradeHorario';
import { DIAS_SEMANA } from './tipos';
import type { EventoCalendario, HorarioDTO, PeriodoResumo } from './tipos';

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Erro inesperado';
}

// ---------- Administração: horários ----------

function HorariosAdmin() {
  const [periodoId, setPeriodoId] = useState('');
  const [grupo, setGrupo] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const periodos = useDados<PeriodoResumo[]>('/periodos-letivos');

  const params = new URLSearchParams();
  if (periodoId) params.set('periodoLetivoId', periodoId);
  if (grupo.trim()) params.set('grupo', grupo.trim());
  const qs = params.toString();
  const horarios = useDados<HorarioDTO[]>(`/horarios${qs ? `?${qs}` : ''}`);

  async function excluir(horario: HorarioDTO) {
    if (!window.confirm(`Excluir o horário de ${horario.turma.codigo}?`)) return;
    try {
      await api.del(`/horarios/${horario.id}`);
      setErroAcao(null);
      horarios.recarregar();
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro));
    }
  }

  return (
    <Pagina titulo="Horários">
      <div className="barra-ferramentas">
        <div className="filtros">
          <Selecao
            rotulo="Período letivo"
            valor={periodoId}
            aoMudar={setPeriodoId}
            opcoes={(periodos.dados ?? []).map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
            vazio="Todos os períodos"
          />
          <Campo rotulo="Grupo (ex.: 6A)" valor={grupo} aoMudar={setGrupo} />
        </div>
        <Botao aoClicar={() => setNovoAberto(true)}>Novo horário</Botao>
      </div>

      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {horarios.erro && <Aviso tipo="erro">{horarios.erro}</Aviso>}

      {horarios.carregando ? (
        <Carregando />
      ) : (
        <>
          <GradeHorario horarios={horarios.dados ?? []} />
          <h2>Gerenciar horários</h2>
          <Tabela
            dados={horarios.dados ?? []}
            chave={(h) => h.id}
            vazio="Nenhum horário cadastrado."
            colunas={[
              {
                titulo: 'Dia',
                celula: (h) => DIAS_SEMANA.find((d) => d.valor === h.diaSemana)?.rotulo ?? h.diaSemana,
              },
              { titulo: 'Horário', celula: (h) => `${h.horaInicio} às ${h.horaFim}` },
              { titulo: 'Turma', celula: (h) => `${h.turma.codigo} - ${h.turma.disciplina.nome}` },
              { titulo: 'Sala', celula: (h) => h.sala || h.turma.sala || '-' },
              {
                titulo: 'Ação',
                celula: (h) => (
                  <Botao variante="perigo" aoClicar={() => excluir(h)}>
                    Excluir
                  </Botao>
                ),
              },
            ]}
          />
        </>
      )}

      <Modal aberto={novoAberto} titulo="Novo horário" aoFechar={() => setNovoAberto(false)}>
        <FormularioHorario
          periodos={periodos.dados ?? []}
          periodoInicial={periodoId}
          aoSalvo={() => {
            setNovoAberto(false);
            setErroAcao(null);
            horarios.recarregar();
          }}
        />
      </Modal>
    </Pagina>
  );
}

// ---------- Administração: calendário ----------

function CalendarioAdmin() {
  const eventos = useDados<EventoCalendario[]>('/calendario');
  const periodos = useDados<PeriodoResumo[]>('/periodos-letivos');
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<EventoCalendario | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  function novo() {
    setEditando(null);
    setFormAberto(true);
  }

  function editar(evento: EventoCalendario) {
    setEditando(evento);
    setFormAberto(true);
  }

  // A confirmação fica no detalhe do evento (Calendario), antes de chamar esta função.
  async function excluir(evento: EventoCalendario) {
    try {
      await api.del(`/calendario/${evento.id}`);
      setErroAcao(null);
      eventos.recarregar();
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro));
    }
  }

  return (
    <Pagina titulo="Calendário" acoes={<Botao aoClicar={novo}>Novo evento</Botao>}>
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {eventos.erro && <Aviso tipo="erro">{eventos.erro}</Aviso>}
      {eventos.carregando ? (
        <Carregando />
      ) : (
        <Calendario
          eventos={eventos.dados ?? []}
          editavel
          aoEditar={editar}
          aoExcluir={excluir}
        />
      )}

      <Modal
        aberto={formAberto}
        titulo={editando ? 'Editar evento' : 'Novo evento'}
        aoFechar={() => setFormAberto(false)}
      >
        <FormularioEvento
          evento={editando}
          periodos={periodos.dados ?? []}
          aoSalvo={() => {
            setFormAberto(false);
            setErroAcao(null);
            eventos.recarregar();
          }}
        />
      </Modal>
    </Pagina>
  );
}

// ---------- Portais do professor e do aluno (somente leitura) ----------

function HorarioMeu() {
  const horarios = useDados<HorarioDTO[]>('/horarios/meus');
  return (
    <Pagina titulo="Horário">
      {horarios.erro && <Aviso tipo="erro">{horarios.erro}</Aviso>}
      {horarios.carregando ? (
        <Carregando />
      ) : (
        <GradeHorario horarios={horarios.dados ?? []} />
      )}
    </Pagina>
  );
}

function CalendarioLeitura() {
  const eventos = useDados<EventoCalendario[]>('/calendario');
  return (
    <Pagina titulo="Calendário">
      {eventos.erro && <Aviso tipo="erro">{eventos.erro}</Aviso>}
      {eventos.carregando ? (
        <Carregando />
      ) : (
        <Calendario eventos={eventos.dados ?? []} />
      )}
    </Pagina>
  );
}

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/horarios',
    rotulo: 'Horários',
    icone: 'horarios',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <HorariosAdmin />,
    ordem: 70,
  },
  {
    caminho: '/admin/calendario',
    rotulo: 'Calendário',
    icone: 'calendario',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <CalendarioAdmin />,
    ordem: 71,
  },
  {
    caminho: '/professor/horario',
    rotulo: 'Horário',
    icone: 'horarios',
    perfis: ['PROFESSOR'],
    elemento: <HorarioMeu />,
    ordem: 70,
  },
  {
    caminho: '/professor/calendario',
    rotulo: 'Calendário',
    icone: 'calendario',
    perfis: ['PROFESSOR'],
    elemento: <CalendarioLeitura />,
    ordem: 71,
  },
  {
    caminho: '/aluno/horario',
    rotulo: 'Horário',
    icone: 'horarios',
    perfis: ['ALUNO'],
    elemento: <HorarioMeu />,
    ordem: 70,
  },
  {
    caminho: '/aluno/calendario',
    rotulo: 'Calendário',
    icone: 'calendario',
    perfis: ['ALUNO'],
    elemento: <CalendarioLeitura />,
    ordem: 71,
  },
];
