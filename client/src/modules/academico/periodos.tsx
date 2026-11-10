import { useState } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import {
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
import type { ColunaTabela } from '../../ui';
import { TIPOS_PERIODO, dataDoIso, mensagemErro, rotuloTipoPeriodo } from './comum';
import type { PeriodoLetivo } from './tipos';

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

  const colunas: ColunaTabela<PeriodoLetivo>[] = [
    { titulo: 'Nome', celula: (p) => p.nome },
    { titulo: 'Ano', celula: (p) => p.ano },
    { titulo: 'Tipo', celula: (p) => rotuloTipoPeriodo(p.tipo) },
    { titulo: 'Início', celula: (p) => formatarData(dataDoIso(p.inicio)) },
    { titulo: 'Fim', celula: (p) => formatarData(dataDoIso(p.fim)) },
    {
      titulo: 'Situação',
      celula: (p) => <Selo cor={p.ativo ? 'verde' : 'cinza'}>{p.ativo ? 'ATIVO' : 'INATIVO'}</Selo>,
    },
    {
      titulo: 'Ações',
      celula: (p) => (
        <>
          <Botao variante="texto" aoClicar={() => setEditando(p)}>
            Editar
          </Botao>
          <Botao variante="texto" aoClicar={() => void alternarAtivo(p)}>
            {p.ativo ? 'Desativar' : 'Ativar'}
          </Botao>
        </>
      ),
    },
  ];

  return (
    <Pagina
      titulo="Períodos letivos"
      acoes={<Botao aoClicar={() => setNovo(true)}>Novo período</Botao>}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {carregando ? (
        <Carregando />
      ) : (
        <Tabela
          colunas={colunas}
          dados={dados ?? []}
          chave={(p) => p.id}
          vazio="Nenhum período letivo cadastrado."
        />
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
