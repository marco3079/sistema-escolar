import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { AreaTexto, Aviso, Botao, Campo, Carregando, Selecao } from '../../ui';
import {
  NIVEIS_POS,
  PAPEIS_BANCA,
  RESULTADOS_BANCA,
  STATUS_PROJETO,
  TIPOS_BANCA,
  mensagemErro,
  opcoesProfessores,
} from './apoio';
import type {
  BancaDTO,
  MatriculaDTO,
  PapelBanca,
  ProfessorDTO,
  ProjetoDTO,
  ResultadoBanca,
  StatusProjeto,
  TipoBanca,
} from './tipos';

// ---------- Peças comuns ----------

interface TextoProjeto {
  titulo: string;
  resumo: string;
  linhaPesquisa: string;
}

function CamposTexto({
  valores,
  aoMudar,
}: {
  valores: TextoProjeto;
  aoMudar: (valores: TextoProjeto) => void;
}) {
  return (
    <>
      <Campo
        rotulo="Título"
        valor={valores.titulo}
        aoMudar={(titulo) => aoMudar({ ...valores, titulo })}
        obrigatorio
      />
      <AreaTexto
        rotulo="Resumo"
        valor={valores.resumo}
        aoMudar={(resumo) => aoMudar({ ...valores, resumo })}
        linhas={5}
      />
      <Campo
        rotulo="Linha de pesquisa"
        valor={valores.linhaPesquisa}
        aoMudar={(linhaPesquisa) => aoMudar({ ...valores, linhaPesquisa })}
      />
    </>
  );
}

function BotoesForm({ salvando, aoCancelar }: { salvando: boolean; aoCancelar: () => void }) {
  return (
    <>
      <Botao tipo="submit" desabilitado={salvando}>
        {salvando ? 'Salvando...' : 'Salvar'}
      </Botao>
      <Botao variante="texto" aoClicar={aoCancelar}>
        Cancelar
      </Botao>
    </>
  );
}

const OPCOES_STATUS = STATUS_PROJETO.map((s) => ({ valor: s.valor, rotulo: s.rotulo }));

// ---------- Novo projeto (admin) ----------

export function FormNovoProjeto({
  aoSalvo,
  aoCancelar,
}: {
  aoSalvo: () => void;
  aoCancelar: () => void;
}) {
  const matriculas = useDados<MatriculaDTO[]>('/matriculas');
  const professores = useDados<ProfessorDTO[]>('/professores');
  const [matriculaId, setMatriculaId] = useState('');
  const [orientadorId, setOrientadorId] = useState('');
  const [coorientadorId, setCoorientadorId] = useState('');
  const [texto, setTexto] = useState<TextoProjeto>({ titulo: '', resumo: '', linhaPesquisa: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (matriculas.carregando || professores.carregando) return <Carregando />;

  const erroCarga = matriculas.erro ?? professores.erro;
  const opcoesMatriculas = (matriculas.dados ?? [])
    .filter((m) => NIVEIS_POS.includes(m.curso.nivel))
    .map((m) => ({
      valor: String(m.id),
      rotulo: `${m.aluno.usuario.nome} (RA ${m.aluno.ra}) · ${m.curso.nome}`,
    }));

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api.post('/pos/projetos', {
        matriculaId: Number(matriculaId),
        orientadorId: Number(orientadorId),
        coorientadorId: coorientadorId ? Number(coorientadorId) : undefined,
        titulo: texto.titulo,
        resumo: texto.resumo,
        linhaPesquisa: texto.linhaPesquisa.trim() || undefined,
      });
      aoSalvo();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {erroCarga && <Aviso tipo="erro">{erroCarga}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Selecao
        rotulo="Matrícula (pós-graduação)"
        valor={matriculaId}
        aoMudar={setMatriculaId}
        opcoes={opcoesMatriculas}
        vazio="Selecione a matrícula"
        obrigatorio
      />
      <Selecao
        rotulo="Orientador"
        valor={orientadorId}
        aoMudar={setOrientadorId}
        opcoes={opcoesProfessores(professores.dados)}
        vazio="Selecione o orientador"
        obrigatorio
      />
      <Selecao
        rotulo="Coorientador"
        valor={coorientadorId}
        aoMudar={setCoorientadorId}
        opcoes={opcoesProfessores(professores.dados)}
        vazio="Nenhum"
      />
      <CamposTexto valores={texto} aoMudar={setTexto} />
      <BotoesForm salvando={salvando} aoCancelar={aoCancelar} />
    </form>
  );
}

// ---------- Editar projeto (admin) ----------

export function FormEditarProjeto({
  projeto,
  aoSalvo,
  aoCancelar,
}: {
  projeto: ProjetoDTO;
  aoSalvo: () => void;
  aoCancelar: () => void;
}) {
  const professores = useDados<ProfessorDTO[]>('/professores');
  const [orientadorId, setOrientadorId] = useState(String(projeto.orientadorId));
  const [coorientadorId, setCoorientadorId] = useState(
    projeto.coorientadorId ? String(projeto.coorientadorId) : ''
  );
  const [status, setStatus] = useState<StatusProjeto>(projeto.status);
  const [texto, setTexto] = useState<TextoProjeto>({
    titulo: projeto.titulo,
    resumo: projeto.resumo,
    linhaPesquisa: projeto.linhaPesquisa ?? '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (professores.carregando) return <Carregando />;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api.put(`/pos/projetos/${projeto.id}`, {
        orientadorId: Number(orientadorId),
        coorientadorId: coorientadorId ? Number(coorientadorId) : null,
        status,
        titulo: texto.titulo,
        resumo: texto.resumo,
        linhaPesquisa: texto.linhaPesquisa.trim() || null,
      });
      aoSalvo();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {(professores.erro || erro) && <Aviso tipo="erro">{professores.erro ?? erro}</Aviso>}
      <Selecao
        rotulo="Orientador"
        valor={orientadorId}
        aoMudar={setOrientadorId}
        opcoes={opcoesProfessores(professores.dados)}
        vazio="Selecione o orientador"
        obrigatorio
      />
      <Selecao
        rotulo="Coorientador"
        valor={coorientadorId}
        aoMudar={setCoorientadorId}
        opcoes={opcoesProfessores(professores.dados)}
        vazio="Nenhum"
      />
      <Selecao
        rotulo="Status"
        valor={status}
        aoMudar={(v) => setStatus(v as StatusProjeto)}
        opcoes={OPCOES_STATUS}
        obrigatorio
      />
      <CamposTexto valores={texto} aoMudar={setTexto} />
      <BotoesForm salvando={salvando} aoCancelar={aoCancelar} />
    </form>
  );
}

// ---------- Editar título, resumo e linha (aluno) ----------

export function FormProjetoAluno({
  projeto,
  aoSalvo,
  aoCancelar,
}: {
  projeto: ProjetoDTO;
  aoSalvo: () => void;
  aoCancelar: () => void;
}) {
  const [texto, setTexto] = useState<TextoProjeto>({
    titulo: projeto.titulo,
    resumo: projeto.resumo,
    linhaPesquisa: projeto.linhaPesquisa ?? '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api.put(`/pos/projetos/${projeto.id}`, {
        titulo: texto.titulo,
        resumo: texto.resumo,
        linhaPesquisa: texto.linhaPesquisa.trim() || null,
      });
      aoSalvo();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <CamposTexto valores={texto} aoMudar={setTexto} />
      <BotoesForm salvando={salvando} aoCancelar={aoCancelar} />
    </form>
  );
}

// ---------- Agendar banca (admin) ----------

interface MembroRascunho {
  tipoMembro: 'interno' | 'externo';
  professorId: string;
  nomeExterno: string;
  instituicao: string;
  papel: string;
}

const RASCUNHO_VAZIO: MembroRascunho = {
  tipoMembro: 'interno',
  professorId: '',
  nomeExterno: '',
  instituicao: '',
  papel: '',
};

const OPCOES_TIPO_MEMBRO = [
  { valor: 'interno', rotulo: 'Interno (professor cadastrado)' },
  { valor: 'externo', rotulo: 'Externo (sem cadastro)' },
];

const OPCOES_PAPEL = PAPEIS_BANCA.map((p) => ({ valor: p.valor, rotulo: p.rotulo }));

function paraPayloadMembro(m: MembroRascunho) {
  if (m.tipoMembro === 'interno') {
    return { professorId: Number(m.professorId), papel: m.papel as PapelBanca };
  }
  return {
    nomeExterno: m.nomeExterno.trim(),
    instituicao: m.instituicao.trim() || undefined,
    papel: m.papel as PapelBanca,
  };
}

export function FormBanca({
  projeto,
  aoSalvo,
  aoCancelar,
}: {
  projeto: ProjetoDTO;
  aoSalvo: () => void;
  aoCancelar: () => void;
}) {
  const professores = useDados<ProfessorDTO[]>('/professores');
  const [tipo, setTipo] = useState<TipoBanca>('QUALIFICACAO');
  const [data, setData] = useState('');
  const [local, setLocal] = useState('');
  const [membros, setMembros] = useState<MembroRascunho[]>([]);
  const [rascunho, setRascunho] = useState<MembroRascunho>(RASCUNHO_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (professores.carregando) return <Carregando />;

  function nomeDoMembro(m: MembroRascunho): string {
    if (m.tipoMembro === 'externo') return m.nomeExterno.trim();
    const professor = (professores.dados ?? []).find((p) => String(p.id) === m.professorId);
    return professor ? professor.usuario.nome : 'Professor';
  }

  function adicionarMembro() {
    setErro(null);
    if (rascunho.tipoMembro === 'interno' && !rascunho.professorId) {
      setErro('Escolha o professor do membro');
      return;
    }
    if (rascunho.tipoMembro === 'externo' && !rascunho.nomeExterno.trim()) {
      setErro('Informe o nome do membro externo');
      return;
    }
    if (!rascunho.papel) {
      setErro('Escolha o papel do membro');
      return;
    }
    setMembros([...membros, rascunho]);
    setRascunho(RASCUNHO_VAZIO);
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const dataBanca = new Date(data);
    if (Number.isNaN(dataBanca.getTime())) {
      setErro('Data e hora inválidas');
      return;
    }
    setSalvando(true);
    try {
      await api.post(`/pos/projetos/${projeto.id}/bancas`, {
        tipo,
        data: dataBanca.toISOString(),
        local: local.trim() || undefined,
        membros: membros.map(paraPayloadMembro),
      });
      aoSalvo();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {(professores.erro || erro) && <Aviso tipo="erro">{professores.erro ?? erro}</Aviso>}
      <Selecao
        rotulo="Tipo de banca"
        valor={tipo}
        aoMudar={(v) => setTipo(v as TipoBanca)}
        opcoes={TIPOS_BANCA.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
        obrigatorio
      />
      <Campo rotulo="Data e hora" tipo="datetime-local" valor={data} aoMudar={setData} obrigatorio />
      <Campo rotulo="Local" valor={local} aoMudar={setLocal} />

      <section className="cartao">
        <h3 className="cartao-titulo">Membros da banca</h3>
        {membros.length === 0 && <p>Nenhum membro adicionado.</p>}
        <ul>
          {membros.map((m, indice) => (
            <li key={indice}>
              {nomeDoMembro(m)} · {PAPEIS_BANCA.find((p) => p.valor === m.papel)?.rotulo ?? m.papel}{' '}
              <Botao
                variante="texto"
                aoClicar={() => setMembros(membros.filter((_, i) => i !== indice))}
              >
                Remover
              </Botao>
            </li>
          ))}
        </ul>

        <Selecao
          rotulo="Tipo de membro"
          valor={rascunho.tipoMembro}
          aoMudar={(v) =>
            setRascunho({ ...rascunho, tipoMembro: v === 'externo' ? 'externo' : 'interno' })
          }
          opcoes={OPCOES_TIPO_MEMBRO}
        />
        {rascunho.tipoMembro === 'interno' ? (
          <Selecao
            rotulo="Professor"
            valor={rascunho.professorId}
            aoMudar={(v) => setRascunho({ ...rascunho, professorId: v })}
            opcoes={opcoesProfessores(professores.dados)}
            vazio="Selecione o professor"
          />
        ) : (
          <>
            <Campo
              rotulo="Nome do membro"
              valor={rascunho.nomeExterno}
              aoMudar={(v) => setRascunho({ ...rascunho, nomeExterno: v })}
            />
            <Campo
              rotulo="Instituição"
              valor={rascunho.instituicao}
              aoMudar={(v) => setRascunho({ ...rascunho, instituicao: v })}
            />
          </>
        )}
        <Selecao
          rotulo="Papel na banca"
          valor={rascunho.papel}
          aoMudar={(v) => setRascunho({ ...rascunho, papel: v })}
          opcoes={OPCOES_PAPEL}
          vazio="Selecione o papel"
        />
        <Botao variante="secundario" aoClicar={adicionarMembro}>
          Adicionar membro
        </Botao>
      </section>

      <BotoesForm salvando={salvando} aoCancelar={aoCancelar} />
    </form>
  );
}

// ---------- Registrar resultado da banca (admin) ----------

export function FormResultadoBanca({
  banca,
  aoSalvo,
  aoCancelar,
}: {
  banca: BancaDTO;
  aoSalvo: () => void;
  aoCancelar: () => void;
}) {
  const [resultado, setResultado] = useState<ResultadoBanca>(banca.resultado);
  const [parecer, setParecer] = useState(banca.parecer ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api.put(`/pos/bancas/${banca.id}`, {
        resultado,
        parecer: parecer.trim() || null,
      });
      aoSalvo();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Selecao
        rotulo="Resultado"
        valor={resultado}
        aoMudar={(v) => setResultado(v as ResultadoBanca)}
        opcoes={RESULTADOS_BANCA.map((r) => ({ valor: r.valor, rotulo: r.rotulo }))}
        obrigatorio
      />
      <AreaTexto rotulo="Parecer" valor={parecer} aoMudar={setParecer} linhas={5} />
      <BotoesForm salvando={salvando} aoCancelar={aoCancelar} />
    </form>
  );
}
