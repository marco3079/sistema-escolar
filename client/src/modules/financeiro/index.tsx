import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import type { RotaModulo } from '../../lib/rotas';
import {
  Abas,
  Aviso,
  Botao,
  Campo,
  Carregando,
  Cartao,
  Caixa,
  Grade,
  Modal,
  Pagina,
  Selecao,
  Selo,
  Tabela,
  formatarData,
  formatarMoeda,
  paraInputData,
} from '../../ui';

// ---------- Tipos (formato do CONTRATOS 5.7) ----------

type StatusMensalidade = 'ABERTA' | 'PAGA' | 'ATRASADA' | 'CANCELADA';

interface MatriculaRef {
  id: number;
  aluno: { ra: string; usuario: { nome: string } };
  curso: { nome: string };
}

interface MensalidadeDTO {
  id: number;
  matriculaId: number;
  competencia: string;
  vencimento: string;
  valor: number;
  desconto: number;
  valorFinal: number;
  status: StatusMensalidade;
  pagoEm: string | null;
  formaPagamento: string | null;
  matricula: MatriculaRef;
}

interface BolsaDTO {
  id: number;
  matriculaId: number;
  nome: string;
  percentual: number;
  inicio: string;
  fim: string | null;
  ativa: boolean;
  matricula: MatriculaRef;
}

interface ResumoFinanceiro {
  aberto: number;
  pago: number;
  atrasado: number;
  quantidadeBolsas: number;
}

interface MatriculaLista {
  id: number;
  aluno: { ra: string; usuario: { nome: string } };
  curso: { nome: string };
}

// ---------- Constantes ----------

const ROTULO_STATUS: Record<StatusMensalidade, { rotulo: string; cor: 'azul' | 'verde' | 'vermelho' | 'cinza' }> = {
  ABERTA: { rotulo: 'Em aberto', cor: 'azul' },
  PAGA: { rotulo: 'Paga', cor: 'verde' },
  ATRASADA: { rotulo: 'Atrasada', cor: 'vermelho' },
  CANCELADA: { rotulo: 'Cancelada', cor: 'cinza' },
};

const STATUS_OPCOES: { valor: string; rotulo: string }[] = (
  Object.keys(ROTULO_STATUS) as StatusMensalidade[]
).map((s) => ({ valor: s, rotulo: ROTULO_STATUS[s].rotulo }));

const FORMAS_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão', 'Boleto', 'Transferência'].map((f) => ({
  valor: f,
  rotulo: f,
}));

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
].map((nome, i) => ({ valor: String(i + 1), rotulo: nome }));

// ---------- Auxiliares ----------

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

function SeloStatus({ status }: { status: StatusMensalidade }) {
  const info = ROTULO_STATUS[status];
  return <Selo cor={info.cor}>{info.rotulo}</Selo>;
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Cartao>
      <span className="cartao-indicador-rotulo">{rotulo}</span>
      <span className="cartao-indicador-valor">{valor}</span>
    </Cartao>
  );
}

// ---------- Tela do administrativo ----------

export function Financeiro() {
  const resumo = useDados<ResumoFinanceiro>('/financeiro/resumo');
  const [aba, setAba] = useState('mensalidades');

  return (
    <Pagina titulo="Financeiro">
      {resumo.erro && <Aviso tipo="erro">{resumo.erro}</Aviso>}
      {resumo.carregando && <Carregando />}
      {resumo.dados && (
        <Grade>
          <Indicador rotulo="Em aberto" valor={formatarMoeda(resumo.dados.aberto)} />
          <Indicador rotulo="Atrasado" valor={formatarMoeda(resumo.dados.atrasado)} />
          <Indicador rotulo="Recebido" valor={formatarMoeda(resumo.dados.pago)} />
          <Indicador rotulo="Bolsas ativas" valor={String(resumo.dados.quantidadeBolsas)} />
        </Grade>
      )}
      <Abas
        abas={[
          { id: 'mensalidades', rotulo: 'Mensalidades' },
          { id: 'bolsas', rotulo: 'Bolsas' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      {aba === 'mensalidades' ? (
        <AbaMensalidades aoGravar={resumo.recarregar} />
      ) : (
        <AbaBolsas />
      )}
    </Pagina>
  );
}

// ---------- Aba: mensalidades ----------

function AbaMensalidades({ aoGravar }: { aoGravar: () => void }) {
  const [status, setStatus] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [gerarAberto, setGerarAberto] = useState(false);
  const [pagando, setPagando] = useState<MensalidadeDTO | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (competencia) params.set('competencia', competencia);
  const qs = params.toString();
  const lista = useDados<MensalidadeDTO[]>('/mensalidades' + (qs ? `?${qs}` : ''));

  async function cancelar(m: MensalidadeDTO) {
    if (!window.confirm(`Cancelar a mensalidade ${m.competencia} de ${m.matricula.aluno.usuario.nome}?`)) {
      return;
    }
    setErroAcao(null);
    setAviso(null);
    try {
      await api.post(`/mensalidades/${m.id}/cancelar`);
      setAviso('Mensalidade cancelada.');
      lista.recarregar();
      aoGravar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  return (
    <>
      <div className="pagina-acoes">
        <Botao aoClicar={() => setGerarAberto(true)}>Gerar mensalidades</Botao>
      </div>

      <Selecao
        rotulo="Status"
        valor={status}
        aoMudar={setStatus}
        opcoes={STATUS_OPCOES}
        vazio="Todos"
      />
      <Campo
        rotulo="Competência (AAAA-MM)"
        valor={competencia}
        aoMudar={setCompetencia}
      />

      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
      {lista.carregando && <Carregando />}

      {lista.dados && (
        <Tabela
          dados={lista.dados}
          chave={(m) => m.id}
          vazio="Nenhuma mensalidade encontrada."
          colunas={[
            { titulo: 'Aluno', celula: (m) => m.matricula.aluno.usuario.nome },
            { titulo: 'Curso', celula: (m) => m.matricula.curso.nome },
            { titulo: 'Competência', celula: (m) => m.competencia },
            { titulo: 'Vencimento', celula: (m) => formatarData(m.vencimento) },
            { titulo: 'Valor', celula: (m) => formatarMoeda(m.valor) },
            { titulo: 'Desconto', celula: (m) => formatarMoeda(m.desconto) },
            { titulo: 'Valor final', celula: (m) => formatarMoeda(m.valorFinal) },
            { titulo: 'Situação', celula: (m) => <SeloStatus status={m.status} /> },
            {
              titulo: 'Ações',
              celula: (m) =>
                m.status === 'PAGA' || m.status === 'CANCELADA' ? (
                  '—'
                ) : (
                  <>
                    <Botao variante="texto" aoClicar={() => setPagando(m)}>
                      Registrar pagamento
                    </Botao>
                    <Botao variante="perigo" aoClicar={() => cancelar(m)}>
                      Cancelar
                    </Botao>
                  </>
                ),
            },
          ]}
        />
      )}

      {gerarAberto && (
        <GerarMensalidades
          aoFechar={() => setGerarAberto(false)}
          aoSalvo={(criadas) => {
            setAviso(`${criadas} mensalidade(s) criada(s).`);
            lista.recarregar();
            aoGravar();
          }}
        />
      )}

      {pagando && (
        <RegistrarPagamento
          mensalidade={pagando}
          aoFechar={() => setPagando(null)}
          aoSalvo={() => {
            setAviso('Pagamento registrado.');
            lista.recarregar();
            aoGravar();
          }}
        />
      )}
    </>
  );
}

function GerarMensalidades({
  aoFechar,
  aoSalvo,
}: {
  aoFechar: () => void;
  aoSalvo: (criadas: number) => void;
}) {
  const matriculas = useDados<MatriculaLista[]>('/matriculas?status=ATIVA');
  const [matriculaId, setMatriculaId] = useState('');
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [mesInicial, setMesInicial] = useState('1');
  const [mesFinal, setMesFinal] = useState('12');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (Number(mesInicial) > Number(mesFinal)) {
      setErro('O mês inicial não pode ser depois do mês final.');
      return;
    }
    setEnviando(true);
    try {
      const resposta = await api.post<{ criadas: number }>('/mensalidades/gerar', {
        matriculaId: Number(matriculaId),
        ano: Number(ano),
        mesInicial: Number(mesInicial),
        mesFinal: Number(mesFinal),
        diaVencimento: Number(diaVencimento),
      });
      aoSalvo(resposta.criadas);
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  return (
    <Modal aberto titulo="Gerar mensalidades" aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {matriculas.erro && <Aviso tipo="erro">{matriculas.erro}</Aviso>}
        <Selecao
          rotulo="Matrícula"
          valor={matriculaId}
          aoMudar={setMatriculaId}
          obrigatorio
          opcoes={(matriculas.dados ?? []).map((m) => ({
            valor: String(m.id),
            rotulo: `${m.aluno.usuario.nome} (RA ${m.aluno.ra}) - ${m.curso.nome}`,
          }))}
        />
        <Campo rotulo="Ano" tipo="number" valor={ano} aoMudar={setAno} obrigatorio />
        <Selecao
          rotulo="Mês inicial"
          valor={mesInicial}
          aoMudar={setMesInicial}
          opcoes={MESES}
          obrigatorio
        />
        <Selecao
          rotulo="Mês final"
          valor={mesFinal}
          aoMudar={setMesFinal}
          opcoes={MESES}
          obrigatorio
        />
        <Campo
          rotulo="Dia de vencimento (1 a 28)"
          tipo="number"
          valor={diaVencimento}
          aoMudar={setDiaVencimento}
          obrigatorio
        />
        <Botao tipo="submit" desabilitado={enviando || matriculas.carregando}>
          Gerar
        </Botao>{' '}
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
      </form>
    </Modal>
  );
}

function RegistrarPagamento({
  mensalidade,
  aoFechar,
  aoSalvo,
}: {
  mensalidade: MensalidadeDTO;
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  const [forma, setForma] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!forma) {
      setErro('Escolha a forma de pagamento.');
      return;
    }
    setEnviando(true);
    try {
      await api.post(`/mensalidades/${mensalidade.id}/pagar`, { formaPagamento: forma });
      aoSalvo();
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  return (
    <Modal aberto titulo="Registrar pagamento" aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        <p>
          {mensalidade.matricula.aluno.usuario.nome} - {mensalidade.competencia} -{' '}
          {formatarMoeda(mensalidade.valorFinal)}
        </p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Selecao
          rotulo="Forma de pagamento"
          valor={forma}
          aoMudar={setForma}
          opcoes={FORMAS_PAGAMENTO}
          obrigatorio
        />
        <Botao tipo="submit" desabilitado={enviando}>
          Confirmar pagamento
        </Botao>{' '}
        <Botao variante="secundario" aoClicar={aoFechar}>
          Voltar
        </Botao>
      </form>
    </Modal>
  );
}

// ---------- Aba: bolsas ----------

function AbaBolsas() {
  const bolsas = useDados<BolsaDTO[]>('/bolsas');
  // null = fechado; { bolsa: null } = nova; { bolsa } = editar
  const [form, setForm] = useState<{ bolsa: BolsaDTO | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function excluir(b: BolsaDTO) {
    if (!window.confirm(`Excluir a bolsa "${b.nome}" de ${b.matricula.aluno.usuario.nome}?`)) return;
    setErroAcao(null);
    setAviso(null);
    try {
      await api.del(`/bolsas/${b.id}`);
      setAviso('Bolsa excluída.');
      bolsas.recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  return (
    <>
      <div className="pagina-acoes">
        <Botao aoClicar={() => setForm({ bolsa: null })}>Nova bolsa</Botao>
      </div>

      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {bolsas.erro && <Aviso tipo="erro">{bolsas.erro}</Aviso>}
      {bolsas.carregando && <Carregando />}

      {bolsas.dados && (
        <Tabela
          dados={bolsas.dados}
          chave={(b) => b.id}
          vazio="Nenhuma bolsa cadastrada."
          colunas={[
            { titulo: 'Aluno', celula: (b) => b.matricula.aluno.usuario.nome },
            { titulo: 'Curso', celula: (b) => b.matricula.curso.nome },
            { titulo: 'Nome', celula: (b) => b.nome },
            { titulo: 'Percentual', celula: (b) => `${b.percentual}%` },
            { titulo: 'Início', celula: (b) => formatarData(b.inicio) },
            { titulo: 'Fim', celula: (b) => (b.fim ? formatarData(b.fim) : 'Sem fim') },
            {
              titulo: 'Ativa',
              celula: (b) => (b.ativa ? <Selo cor="verde">Sim</Selo> : <Selo cor="cinza">Não</Selo>),
            },
            {
              titulo: 'Ações',
              celula: (b) => (
                <>
                  <Botao variante="texto" aoClicar={() => setForm({ bolsa: b })}>
                    Editar
                  </Botao>
                  <Botao variante="perigo" aoClicar={() => excluir(b)}>
                    Excluir
                  </Botao>
                </>
              ),
            },
          ]}
        />
      )}

      {form && (
        <FormBolsa
          bolsa={form.bolsa}
          aoFechar={() => setForm(null)}
          aoSalvo={(mensagem) => {
            setAviso(mensagem);
            bolsas.recarregar();
          }}
        />
      )}
    </>
  );
}

function FormBolsa({
  bolsa,
  aoFechar,
  aoSalvo,
}: {
  bolsa: BolsaDTO | null;
  aoFechar: () => void;
  aoSalvo: (mensagem: string) => void;
}) {
  const matriculas = useDados<MatriculaLista[]>(bolsa ? null : '/matriculas');
  const [matriculaId, setMatriculaId] = useState('');
  const [nome, setNome] = useState(bolsa?.nome ?? '');
  const [percentual, setPercentual] = useState(bolsa ? String(bolsa.percentual) : '');
  const [inicio, setInicio] = useState(bolsa ? paraInputData(bolsa.inicio) : '');
  const [fim, setFim] = useState(bolsa?.fim ? paraInputData(bolsa.fim) : '');
  const [ativa, setAtiva] = useState(bolsa ? bolsa.ativa : true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const pct = Number(percentual);
    if (!(pct > 0 && pct <= 100)) {
      setErro('O percentual deve ser maior que 0 e até 100.');
      return;
    }
    setEnviando(true);
    try {
      if (bolsa) {
        await api.put(`/bolsas/${bolsa.id}`, {
          nome: nome.trim(),
          percentual: pct,
          inicio,
          fim: fim || null,
          ativa,
        });
        aoSalvo('Bolsa atualizada.');
      } else {
        await api.post('/bolsas', {
          matriculaId: Number(matriculaId),
          nome: nome.trim(),
          percentual: pct,
          inicio,
          fim: fim || null,
        });
        aoSalvo('Bolsa criada.');
      }
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  return (
    <Modal aberto titulo={bolsa ? 'Editar bolsa' : 'Nova bolsa'} aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {bolsa ? (
          <p>
            {bolsa.matricula.aluno.usuario.nome} - {bolsa.matricula.curso.nome}
          </p>
        ) : (
          <>
            {matriculas.erro && <Aviso tipo="erro">{matriculas.erro}</Aviso>}
            <Selecao
              rotulo="Matrícula"
              valor={matriculaId}
              aoMudar={setMatriculaId}
              obrigatorio
              opcoes={(matriculas.dados ?? []).map((m) => ({
                valor: String(m.id),
                rotulo: `${m.aluno.usuario.nome} (RA ${m.aluno.ra}) - ${m.curso.nome}`,
              }))}
            />
          </>
        )}
        <Campo rotulo="Nome da bolsa" valor={nome} aoMudar={setNome} obrigatorio />
        <Campo
          rotulo="Percentual (0 a 100)"
          tipo="number"
          valor={percentual}
          aoMudar={setPercentual}
          obrigatorio
        />
        <Campo rotulo="Início" tipo="date" valor={inicio} aoMudar={setInicio} obrigatorio />
        <Campo rotulo="Fim (opcional)" tipo="date" valor={fim} aoMudar={setFim} />
        {bolsa && <Caixa rotulo="Bolsa ativa" marcado={ativa} aoMudar={setAtiva} />}
        <Botao tipo="submit" desabilitado={enviando || (!bolsa && matriculas.carregando)}>
          Salvar
        </Botao>{' '}
        <Botao variante="secundario" aoClicar={aoFechar}>
          Cancelar
        </Botao>
      </form>
    </Modal>
  );
}

export const rotas: RotaModulo[] = [
  {
    caminho: '/admin/financeiro',
    rotulo: 'Financeiro',
    icone: 'financeiro',
    perfis: ['ADMIN', 'SECRETARIA'],
    elemento: <Financeiro />,
    ordem: 60,
  },
  {
    caminho: '/aluno/financeiro',
    rotulo: 'Financeiro',
    icone: 'financeiro',
    perfis: ['ALUNO'],
    elemento: <FinanceiroAluno />,
    ordem: 60,
  },
];

// ---------- Tela do aluno (somente leitura) ----------

function FinanceiroAluno() {
  const minhas = useDados<MensalidadeDTO[]>('/mensalidades/minhas');
  const emAberto = (minhas.dados ?? [])
    .filter((m) => m.status === 'ABERTA' || m.status === 'ATRASADA')
    .reduce((soma, m) => soma + m.valorFinal, 0);

  return (
    <Pagina titulo="Financeiro">
      <Aviso tipo="info">O pagamento das mensalidades é registrado pela secretaria.</Aviso>
      {minhas.erro && <Aviso tipo="erro">{minhas.erro}</Aviso>}
      {minhas.carregando && <Carregando />}
      {minhas.dados && (
        <>
          <Grade>
            <Indicador rotulo="Total em aberto" valor={formatarMoeda(emAberto)} />
          </Grade>
          <Tabela
            dados={minhas.dados}
            chave={(m) => m.id}
            vazio="Nenhuma mensalidade."
            colunas={[
              { titulo: 'Curso', celula: (m) => m.matricula.curso.nome },
              { titulo: 'Competência', celula: (m) => m.competencia },
              { titulo: 'Vencimento', celula: (m) => formatarData(m.vencimento) },
              { titulo: 'Valor', celula: (m) => formatarMoeda(m.valor) },
              { titulo: 'Desconto', celula: (m) => formatarMoeda(m.desconto) },
              { titulo: 'Valor final', celula: (m) => formatarMoeda(m.valorFinal) },
              { titulo: 'Situação', celula: (m) => <SeloStatus status={m.status} /> },
            ]}
          />
        </>
      )}
    </Pagina>
  );
}
