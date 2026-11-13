import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDados } from '../../lib/useDados';
import { rotuloNivel } from '../../lib/tipos';
import { Abas, Avatar, Aviso, Carregando, Pagina, Selecao, Selo } from '../../ui';
import { ListaOcorrencias } from '../ocorrencias/ListaOcorrencias';
import { Boletim } from './Boletim';
import { Documentos } from './Documentos';
import { Financeiro } from './Financeiro';
import { Frequencia } from './Frequencia';
import type { AlunoFamilia } from './tipos';
import './responsavel.css';

const ABAS_FIXAS = [
  { id: 'boletim', rotulo: 'Boletim' },
  { id: 'frequencia', rotulo: 'Frequência' },
  { id: 'financeiro', rotulo: 'Financeiro' },
  { id: 'ocorrencias', rotulo: 'Ocorrências' },
  { id: 'documentos', rotulo: 'Documentos' },
];

function NaoEncontrado() {
  return (
    <Pagina titulo="Aluno" acoes={<Link className="botao botao-secundario" to="/responsavel">Voltar</Link>}>
      <Aviso tipo="erro">Aluno não encontrado.</Aviso>
    </Pagina>
  );
}

// Tela de um aluno ligado ao responsável: cabeçalho, seletor de matrícula e abas (?aba=).
export function AlunoDetalhe() {
  const { alunoId: alunoParam = '' } = useParams<{ alunoId: string }>();
  const alunoId = Number(alunoParam);
  const valido = Number.isInteger(alunoId) && alunoId > 0;
  // A lista traz só os alunos ligados ao responsável: aluno fora dela é "não encontrado" (403/404).
  const lista = useDados<AlunoFamilia[]>(valido ? '/familia/alunos' : null);
  const [params, setParams] = useSearchParams();
  const [matriculaEscolhida, setMatriculaEscolhida] = useState('');

  if (!valido) return <NaoEncontrado />;
  if (!lista.dados) {
    if (lista.erro) {
      return (
        <Pagina titulo="Aluno" acoes={<Link className="botao botao-secundario" to="/responsavel">Voltar</Link>}>
          <Aviso tipo="erro">{lista.erro}</Aviso>
        </Pagina>
      );
    }
    return (
      <Pagina titulo="Aluno">
        <Carregando />
      </Pagina>
    );
  }

  const aluno = lista.dados.find((a) => a.alunoId === alunoId) ?? null;
  if (!aluno) return <NaoEncontrado />;

  const matriculas = aluno.matriculas;
  const padrao = matriculas.find((m) => m.status === 'ATIVA') ?? matriculas[0] ?? null;
  const matriculaAtual = matriculas.find((m) => String(m.id) === matriculaEscolhida) ?? padrao;

  const abas = ABAS_FIXAS.filter((a) => a.id !== 'financeiro' || aluno.financeiro);
  const pedida = params.get('aba') ?? '';
  const ativa = abas.some((a) => a.id === pedida) ? pedida : 'boletim';

  const seletorMatricula: ReactNode =
    matriculas.length > 1 ? (
      <div className="resp-seletor">
        <Selecao
          rotulo="Matrícula"
          valor={matriculaAtual ? String(matriculaAtual.id) : ''}
          aoMudar={setMatriculaEscolhida}
          opcoes={matriculas.map((m) => ({ valor: String(m.id), rotulo: `${m.curso} (${m.status.toLowerCase()})` }))}
        />
      </div>
    ) : null;

  return (
    <Pagina
      titulo={aluno.nome}
      acoes={<Link className="botao botao-secundario" to="/responsavel">Voltar</Link>}
    >
      <section className="resp-cabecalho-aluno">
        <Avatar nome={aluno.nome} foto={aluno.foto} tamanho={56} />
        <div className="resp-cabecalho-texto">
          <h2 className="resp-nome">{aluno.nome}</h2>
          <p className="resp-suave">RA {aluno.ra}</p>
          {matriculaAtual && (
            <p className="resp-cartao-titulo">
              {matriculaAtual.curso}
            </p>
          )}
          <div className="resp-selos">
            <Selo cor="azul">{aluno.parentesco}</Selo>
            {matriculaAtual && <Selo cor="cinza">{rotuloNivel(matriculaAtual.nivel)}</Selo>}
            {aluno.financeiro && <Selo cor="verde">Vê o financeiro</Selo>}
          </div>
        </div>
      </section>

      <div className="resp-abas-area">
        <Abas abas={abas} ativa={ativa} aoMudar={(id) => setParams({ aba: id })} />
      </div>

      {ativa === 'boletim' && (
        <>
          {seletorMatricula}
          <Boletim alunoId={aluno.alunoId} matriculaId={matriculaAtual ? matriculaAtual.id : null} />
        </>
      )}
      {ativa === 'frequencia' && <Frequencia alunoId={aluno.alunoId} />}
      {ativa === 'financeiro' && aluno.financeiro && <Financeiro alunoId={aluno.alunoId} />}
      {ativa === 'ocorrencias' && <ListaOcorrencias alunoId={aluno.alunoId} modo="familia" />}
      {ativa === 'documentos' && (
        <>
          {seletorMatricula}
          <Documentos ra={aluno.ra} matriculaId={matriculaAtual ? matriculaAtual.id : null} />
        </>
      )}
    </Pagina>
  );
}
