import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useDados } from '../../lib/useDados';
import { rotuloNivel } from '../../lib/tipos';
import { Avatar, Aviso, Carregando, Pagina, Selo } from '../../ui';
import type { AlunoFamilia } from './tipos';
import { formatarNumeroFamilia, formatarPercentualFamilia } from './tipos';
import './responsavel.css';

// Matrícula mostrada no cartão: a ativa; sem ativa, a primeira da lista.
function matriculaDeDestaque(aluno: AlunoFamilia) {
  return aluno.matriculas.find((m) => m.status === 'ATIVA') ?? aluno.matriculas[0] ?? null;
}

function Indicador({
  valor,
  rotulo,
  alerta,
}: {
  valor: string;
  rotulo: string;
  alerta?: boolean;
}) {
  return (
    <div className={alerta ? 'resp-indicador resp-indicador-alerta' : 'resp-indicador'}>
      <span className="resp-indicador-valor">{valor}</span>
      <span className="resp-indicador-rotulo">{rotulo}</span>
    </div>
  );
}

function CartaoAluno({ aluno }: { aluno: AlunoFamilia }) {
  const destaque = matriculaDeDestaque(aluno);
  const r = aluno.resumo;

  return (
    <article className="resp-cartao">
      <div className="resp-cartao-topo">
        <Avatar nome={aluno.nome} foto={aluno.foto} tamanho={56} />
        <div className="resp-cartao-texto">
          <h2 className="resp-nome">{aluno.nome}</h2>
          <p className="resp-suave">RA {aluno.ra}</p>
          <p className="resp-suave">{aluno.parentesco}</p>
        </div>
      </div>

      {destaque ? (
        <div className="resp-selos">
          <Selo cor="azul">{destaque.curso}</Selo>
          <Selo cor="cinza">{rotuloNivel(destaque.nivel)}</Selo>
          <Selo cor="cinza">Série {destaque.serieAtual}</Selo>
        </div>
      ) : (
        <p className="resp-suave">Sem matrícula.</p>
      )}

      <div className="resp-indicadores">
        <Indicador valor={formatarNumeroFamilia(r.mediaGeral)} rotulo="Média geral" />
        <Indicador valor={formatarPercentualFamilia(r.frequenciaMedia)} rotulo="Frequência média" />
        {aluno.financeiro && (
          <Indicador
            valor={String(r.mensalidadesAtrasadas)}
            rotulo="Mensalidades em atraso"
            alerta={r.mensalidadesAtrasadas > 0}
          />
        )}
        <Indicador
          valor={String(r.ocorrenciasSemCiencia)}
          rotulo="Ocorrências sem ciência"
          alerta={r.ocorrenciasSemCiencia > 0}
        />
      </div>

      <div className="resp-acoes">
        <Link className="botao botao-primario" to={`/responsavel/aluno/${aluno.alunoId}`}>
          Ver detalhes
        </Link>
      </div>
    </article>
  );
}

export function Inicio() {
  const { usuario } = useAuth();
  const { dados, carregando, erro } = useDados<AlunoFamilia[]>('/familia/alunos');
  const primeiroNome = usuario?.nome?.trim().split(/\s+/)[0] ?? '';

  return (
    <Pagina titulo="Início">
      {primeiroNome && <p className="resp-saudacao">Olá, {primeiroNome}! Acompanhe seus alunos abaixo.</p>}

      {carregando && !dados && <Carregando />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {dados && dados.length === 0 && (
        <Aviso tipo="info">Nenhum aluno ligado à sua conta. Procure a secretaria.</Aviso>
      )}

      {dados && dados.length > 0 && (
        <div className="resp-grade">
          {dados.map((a) => (
            <CartaoAluno key={a.alunoId} aluno={a} />
          ))}
        </div>
      )}
    </Pagina>
  );
}
