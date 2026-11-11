import { useState } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import {
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
import type { AcaoMenu, ColunaTabela } from '../../ui';
import { Icone } from '../../ui/icones';
import type { NomeIcone } from '../../ui/icones';
import { TIPOS_PERIODO, dataDoIso, mensagemErro, rotuloTipoPeriodo } from './comum';
import type { PeriodoLetivo } from './tipos';
import './academico.css';

// ---------- Datas e andamento (sem fuso: tudo em aaaa-mm-dd) ----------

const DIA_MS = 86400000;

// Data aaaa-mm-dd -> número de dias desde 1970 (comparável sem fuso).
function diasDe(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return Math.round(Date.UTC(ano, mes - 1, dia) / DIA_MS);
}

// Data de hoje no fuso do navegador, em aaaa-mm-dd.
function hojeIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Percentual do período já decorrido: 0 antes do início, 100 depois do fim.
function andamentoDoPeriodo(p: PeriodoLetivo, hoje: string): number {
  const ini = diasDe(dataDoIso(p.inicio));
  const fim = diasDe(dataDoIso(p.fim));
  const agora = diasDe(hoje);
  if (agora < ini) return 0;
  if (agora >= fim) return 100;
  return Math.round(((agora - ini) / (fim - ini)) * 100);
}

function estaEmAndamento(p: PeriodoLetivo, hoje: string): boolean {
  return dataDoIso(p.inicio) <= hoje && hoje <= dataDoIso(p.fim);
}

function jaEncerrou(p: PeriodoLetivo, hoje: string): boolean {
  return dataDoIso(p.fim) < hoje;
}

// ---------- Resumo ----------

function ItemResumo({
  icone,
  cor,
  valor,
  rotulo,
}: {
  icone: NomeIcone;
  cor: 'azul' | 'roxo' | 'verde' | 'laranja' | 'vermelho';
  valor: string | number;
  rotulo: string;
}) {
  return (
    <div className="resumo-item">
      <span className={`resumo-icone resumo-icone-${cor}`}>
        <Icone nome={icone} tamanho={22} />
      </span>
      <div>
        <span className="resumo-valor">{valor}</span>
        <span className="resumo-rotulo">{rotulo}</span>
      </div>
    </div>
  );
}

// ---------- Tela de períodos letivos ----------

export function Periodos() {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<PeriodoLetivo | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const { dados, carregando, erro, recarregar } = useDados<PeriodoLetivo[]>('/periodos-letivos');

  function fecharForm() {
    setNovo(false);
    setEditando(null);
  }

  async function alternarAtivo(p: PeriodoLetivo) {
    setErroAcao(null);
    try {
      await api.put(`/periodos-letivos/${p.id}`, { ativo: !p.ativo });
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  const lista = dados ?? [];
  const hoje = hojeIso();
  const ativos = lista.filter((p) => p.ativo).length;
  const encerrados = lista.filter((p) => jaEncerrou(p, hoje)).length;
  const atual = lista.find((p) => p.ativo && estaEmAndamento(p, hoje));

  const colunas: ColunaTabela<PeriodoLetivo>[] = [
    { titulo: 'Nome', celula: (p) => <span className="academico-nome-forte">{p.nome}</span> },
    { titulo: 'Ano', celula: (p) => p.ano },
    {
      titulo: 'Tipo',
      celula: (p) =>
        p.tipo === 'ANUAL' ? (
          <Selo cor="azul">{rotuloTipoPeriodo(p.tipo)}</Selo>
        ) : (
          <span className="academico-selo-roxo">{rotuloTipoPeriodo(p.tipo)}</span>
        ),
    },
    { titulo: 'Início', celula: (p) => formatarData(dataDoIso(p.inicio)) },
    { titulo: 'Fim', celula: (p) => formatarData(dataDoIso(p.fim)) },
    {
      titulo: 'Andamento',
      celula: (p) => {
        const pct = andamentoDoPeriodo(p, hoje);
        return (
          <div className="academico-andamento">
            <div
              className="academico-andamento-trilho"
              role="progressbar"
              aria-label={`Andamento de ${p.nome}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <span className="academico-andamento-preench" style={{ width: `${pct}%` }} />
            </div>
            <span className="academico-andamento-texto">{pct}%</span>
          </div>
        );
      },
    },
    {
      titulo: 'Situação',
      celula: (p) => <Selo cor={p.ativo ? 'verde' : 'cinza'}>{p.ativo ? 'ATIVO' : 'INATIVO'}</Selo>,
    },
    {
      titulo: 'Ações',
      acoes: true,
      celula: (p) => {
        const acoesDo: AcaoMenu[] = [
          { rotulo: 'Editar', icone: 'lapis', aoClicar: () => setEditando(p) },
          {
            rotulo: p.ativo ? 'Desativar' : 'Ativar',
            icone: p.ativo ? 'pausar' : 'reproduzir',
            aoClicar: () => void alternarAtivo(p),
          },
        ];
        return <MenuAcoes rotulo={`Ações de ${p.nome}`} acoes={acoesDo} />;
      },
    },
  ];

  return (
    <Pagina titulo="Períodos letivos">
      <div className="barra-ferramentas">
        <div className="academico-barra-direita">
          <Botao aoClicar={() => setNovo(true)}>Novo período</Botao>
        </div>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {carregando ? (
        <Carregando />
      ) : (
        <>
          <div className="resumo">
            <ItemResumo icone="periodos" cor="azul" valor={ativos} rotulo="Períodos ativos" />
            <ItemResumo icone="calendario" cor="roxo" valor={encerrados} rotulo="Encerrados" />
            <ItemResumo
              icone="horarios"
              cor="verde"
              valor={atual ? atual.nome : '—'}
              rotulo="Período atual"
            />
          </div>
          <Tabela
            colunas={colunas}
            dados={lista}
            chave={(p) => p.id}
            vazio="Nenhum período letivo cadastrado."
            aoClicarLinha={(p) => setEditando(p)}
          />
        </>
      )}

      <Modal
        aberto={novo || editando !== null}
        titulo={editando ? 'Editar período letivo' : 'Novo período letivo'}
        aoFechar={fecharForm}
      >
        <FormPeriodo
          periodo={editando}
          aoSalvar={() => {
            fecharForm();
            recarregar();
          }}
          aoCancelar={fecharForm}
        />
      </Modal>
    </Pagina>
  );
}

// ---------- Formulário de período ----------

function FormPeriodo({
  periodo,
  aoSalvar,
  aoCancelar,
}: {
  periodo: PeriodoLetivo | null;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(periodo?.nome ?? '');
  const [ano, setAno] = useState(periodo ? String(periodo.ano) : '');
  const [tipo, setTipo] = useState<string>(periodo?.tipo ?? '');
  const [inicio, setInicio] = useState(periodo ? dataDoIso(periodo.inicio) : '');
  const [fim, setFim] = useState(periodo ? dataDoIso(periodo.fim) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const corpo = { nome: nome.trim(), ano: Number(ano), tipo, inicio, fim };
    try {
      if (periodo) {
        await api.put(`/periodos-letivos/${periodo.id}`, corpo);
      } else {
        await api.post('/periodos-letivos', corpo);
      }
      aoSalvar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Campo rotulo="Nome (ex.: 2026.2)" valor={nome} aoMudar={setNome} obrigatorio />
      <Campo rotulo="Ano" valor={ano} aoMudar={setAno} tipo="number" obrigatorio />
      <Selecao rotulo="Tipo" valor={tipo} aoMudar={setTipo} opcoes={TIPOS_PERIODO} obrigatorio />
      <Campo rotulo="Início" valor={inicio} aoMudar={setInicio} tipo="date" obrigatorio />
      <Campo rotulo="Fim" valor={fim} aoMudar={setFim} tipo="date" obrigatorio />
      <div>
        <Botao tipo="submit" desabilitado={salvando}>
          Salvar
        </Botao>{' '}
        <Botao variante="secundario" aoClicar={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
