import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { Aviso, Botao, Campo, paraInputData, AreaTexto, Selecao } from '../../ui';
import { TIPOS_EVENTO } from './tipos';
import type { EventoCalendario, PeriodoResumo } from './tipos';

// Formulário de criar/editar evento (dentro do Modal). Eventos são de dia inteiro:
// início às 00:00 e fim às 23:59 do dia informado, no horário local.
export function FormularioEvento({
  evento,
  periodos,
  aoSalvo,
}: {
  evento: EventoCalendario | null;
  periodos: PeriodoResumo[];
  aoSalvo(): void;
}) {
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [descricao, setDescricao] = useState(evento?.descricao ?? '');
  const [tipo, setTipo] = useState<string>(evento?.tipo ?? 'LETIVO');
  const [inicio, setInicio] = useState(
    evento ? paraInputData(evento.inicio) : paraInputData(new Date().toISOString()),
  );
  const [fim, setFim] = useState(
    evento ? paraInputData(evento.fim) : paraInputData(new Date().toISOString()),
  );
  const [periodoId, setPeriodoId] = useState(evento?.periodoLetivoId ? String(evento.periodoLetivoId) : '');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!titulo.trim() || !inicio || !fim) {
      setErro('Preencha o título e as datas de início e fim.');
      return;
    }
    if (fim < inicio) {
      setErro('A data de fim não pode ser antes da data de início.');
      return;
    }

    const corpo = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      inicio: new Date(`${inicio}T00:00:00`).toISOString(),
      fim: new Date(`${fim}T23:59:59`).toISOString(),
      tipo,
      periodoLetivoId: periodoId ? Number(periodoId) : null,
    };

    setEnviando(true);
    try {
      if (evento) {
        await api.put(`/calendario/${evento.id}`, corpo);
      } else {
        await api.post('/calendario', corpo);
      }
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
      <Selecao
        rotulo="Tipo"
        valor={tipo}
        aoMudar={setTipo}
        opcoes={TIPOS_EVENTO.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
        vazio="Selecione"
        obrigatorio
      />
      <Campo rotulo="Data de início" tipo="date" valor={inicio} aoMudar={setInicio} obrigatorio />
      <Campo rotulo="Data de fim" tipo="date" valor={fim} aoMudar={setFim} obrigatorio />
      <Selecao
        rotulo="Período letivo"
        valor={periodoId}
        aoMudar={setPeriodoId}
        opcoes={periodos.map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
        vazio="Nenhum"
      />
      <AreaTexto rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} linhas={3} />
      <Botao tipo="submit" desabilitado={enviando}>
        {enviando ? 'Salvando...' : 'Salvar evento'}
      </Botao>
    </form>
  );
}
