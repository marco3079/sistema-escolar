import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { Perfil } from '../lib/tipos';
import { useDados } from '../lib/useDados';
import type { ComunicadoDTO } from '../modules/comunicados/tipos';
import { Aviso, Carregando, formatarData } from '../ui';
import { Icone } from '../ui/icones';
import type { NomeIcone } from '../ui/icones';
import { GraficoLinha } from './GraficoLinha';
import './painel.css';

// ---------- Contrato de GET /api/painel/resumo ----------

type CorCartao = 'azul' | 'roxo' | 'verde' | 'laranja';

interface CartaoIndicador {
  chave: string;
  rotulo: string;
  valor: string;
  icone: NomeIcone;
  cor: CorCartao;
  variacao: number | null;
}

interface PontoDesempenho {
  mes: string;
  rotulo: string;
  valor: number | null;
}

interface Destaque {
  etiqueta: string;
  titulo: string;
  subtitulo: string;
  caminho: string;
}

interface RespostaResumo {
  primeiroNome: string;
  cartoes: CartaoIndicador[];
  desempenho: PontoDesempenho[];
  destaque: Destaque | null;
}

// ---------- Atalhos por perfil ----------

interface Atalho {
  rotulo: string;
  icone: NomeIcone;
  caminho: string;
}

const ATALHOS_ADMIN: Atalho[] = [
  { rotulo: 'Nova matrícula', icone: 'matriculas', caminho: '/admin/matriculas' },
  { rotulo: 'Consultar alunos', icone: 'alunos', caminho: '/admin/alunos' },
  { rotulo: 'Professores', icone: 'professores', caminho: '/admin/professores' },
  { rotulo: 'Emitir boletins', icone: 'documento', caminho: '/admin/boletins' },
  { rotulo: 'Configurar turmas', icone: 'engrenagem', caminho: '/admin/turmas' },
  { rotulo: 'Cursos', icone: 'cursos', caminho: '/admin/cursos' },
  { rotulo: 'Períodos letivos', icone: 'periodos', caminho: '/admin/periodos' },
  { rotulo: 'Financeiro', icone: 'financeiro', caminho: '/admin/financeiro' },
  { rotulo: 'Biblioteca', icone: 'biblioteca', caminho: '/admin/biblioteca' },
  { rotulo: 'Horários', icone: 'horarios', caminho: '/admin/horarios' },
  { rotulo: 'Calendário', icone: 'calendario', caminho: '/admin/calendario' },
  { rotulo: 'Comunicados', icone: 'comunicados', caminho: '/admin/comunicados' },
];

const ATALHOS_PROFESSOR: Atalho[] = [
  { rotulo: 'Registrar notas', icone: 'lapis', caminho: '/professor/turmas' },
  { rotulo: 'Lançar frequência', icone: 'diario', caminho: '/professor/turmas' },
  { rotulo: 'Meu horário', icone: 'horarios', caminho: '/professor/horario' },
  { rotulo: 'Calendário', icone: 'calendario', caminho: '/professor/calendario' },
  { rotulo: 'Orientações', icone: 'pos', caminho: '/professor/orientacoes' },
  { rotulo: 'Comunicados', icone: 'comunicados', caminho: '/professor/comunicados' },
  { rotulo: 'Biblioteca', icone: 'biblioteca', caminho: '/professor/biblioteca' },
  { rotulo: 'Meu perfil', icone: 'perfil', caminho: '/professor/perfil' },
];

const ATALHOS_ALUNO: Atalho[] = [
  { rotulo: 'Meu boletim', icone: 'boletim', caminho: '/aluno/boletim' },
  { rotulo: 'Histórico', icone: 'historico', caminho: '/aluno/historico' },
  { rotulo: 'Matrícula', icone: 'matriculas', caminho: '/aluno/matricula' },
  { rotulo: 'Meu horário', icone: 'horarios', caminho: '/aluno/horario' },
  { rotulo: 'Calendário', icone: 'calendario', caminho: '/aluno/calendario' },
  { rotulo: 'Financeiro', icone: 'financeiro', caminho: '/aluno/financeiro' },
  { rotulo: 'Biblioteca', icone: 'biblioteca', caminho: '/aluno/biblioteca' },
  { rotulo: 'Comunicados', icone: 'comunicados', caminho: '/aluno/comunicados' },
];

function atalhosDoPerfil(perfil: Perfil | undefined): Atalho[] {
  if (perfil === 'ADMIN' || perfil === 'SECRETARIA') return ATALHOS_ADMIN;
  if (perfil === 'PROFESSOR') return ATALHOS_PROFESSOR;
  if (perfil === 'ALUNO') return ATALHOS_ALUNO;
  return [];
}

function prefixoDoPerfil(perfil: Perfil | undefined): string {
  if (perfil === 'PROFESSOR') return '/professor';
  if (perfil === 'ALUNO') return '/aluno';
  return '/admin';
}

// ---------- Formatação ----------

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CORES_AVISOS: CorCartao[] = ['azul', 'roxo', 'verde'];
const PERIODOS: { valor: number; rotulo: string }[] = [
  { valor: 3, rotulo: 'Últimos 3 meses' },
  { valor: 6, rotulo: 'Últimos 6 meses' },
  { valor: 12, rotulo: 'Últimos 12 meses' },
];

function dataPorExtenso(d: Date): string {
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function horaCurta(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function tempoRelativo(iso: string, agora: Date): string {
  const diferenca = agora.getTime() - new Date(iso).getTime();
  if (Number.isNaN(diferenca)) return '';
  const minutos = Math.floor(diferenca / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return formatarData(iso);
}

function formatarVariacao(variacao: number): string {
  const sinal = variacao >= 0 ? '+' : '-';
  const numero = Math.abs(variacao).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sinal}${numero}%`;
}

function primeiroNomeDe(nome: string | undefined): string {
  return nome?.trim().split(/\s+/)[0] ?? '';
}

// ---------- Tela inicial ----------

export function Painel() {
  const { usuario } = useAuth();
  const resumo = useDados<RespostaResumo>('/painel/resumo');
  const comunicados = useDados<ComunicadoDTO[]>('/comunicados');
  const [agora, setAgora] = useState<Date>(() => new Date());
  const [periodo, setPeriodo] = useState<number>(6);

  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const dados = resumo.dados;
  const primeiroNome = dados?.primeiroNome || primeiroNomeDe(usuario?.nome);
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!';
  const prefixo = prefixoDoPerfil(usuario?.perfil);
  const atalhos = atalhosDoPerfil(usuario?.perfil);

  const pontos = dados ? dados.desempenho.slice(-periodo) : [];
  const temNota = pontos.some((p) => p.valor !== null);

  const avisos = [...(comunicados.dados ?? [])]
    .sort((a, b) => Date.parse(b.publicadoEm) - Date.parse(a.publicadoEm))
    .slice(0, 3);

  return (
    <section className="painel">
      <div className="painel-cabecalho">
        <div className="painel-boas-vindas">
          <h1 className="painel-saudacao">{saudacao}</h1>
          <p className="painel-subtitulo">Aqui está um resumo do sistema escolar.</p>
          <span className="painel-traco" aria-hidden="true" />
        </div>
        <div className="painel-relogio">
          <p className="painel-data">
            <Icone nome="calendario" tamanho={18} />
            <span>{dataPorExtenso(agora)}</span>
          </p>
          <p className="painel-hora">{horaCurta(agora)}</p>
        </div>
      </div>

      {resumo.carregando && <Carregando />}
      {resumo.erro && <Aviso tipo="erro">{resumo.erro}</Aviso>}
      {dados && (
        <div className="painel-indicadores">
          {dados.cartoes.map((c) => (
            <article key={c.chave} className="painel-indicador">
              <div className={`painel-indicador-icone painel-cor-${c.cor}`}>
                <Icone nome={c.icone} tamanho={26} />
              </div>
              <div className="painel-indicador-texto">
                <span className="painel-indicador-valor">{c.valor}</span>
                <span className="painel-indicador-rotulo">{c.rotulo}</span>
              </div>
              {c.variacao !== null && (
                <span
                  className={`painel-variacao ${
                    c.variacao >= 0 ? 'painel-variacao-alta' : 'painel-variacao-baixa'
                  }`}
                >
                  <Icone nome={c.variacao >= 0 ? 'seta-cima' : 'seta-baixo'} tamanho={14} />
                  {formatarVariacao(c.variacao)}
                </span>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="painel-linha">
        <section className="painel-cartao painel-desempenho">
          <header className="painel-cartao-cabecalho">
            <Icone nome="boletim" tamanho={20} className="painel-cartao-icone" />
            <h2 className="painel-cartao-titulo">Desempenho Acadêmico</h2>
            <select
              className="painel-seletor"
              aria-label="Período do gráfico"
              value={periodo}
              disabled={!dados}
              onChange={(e) => setPeriodo(Number(e.target.value))}
            >
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </header>
          {resumo.carregando && <Carregando />}
          {resumo.erro && <Aviso tipo="erro">{resumo.erro}</Aviso>}
          {dados &&
            (temNota ? (
              <div className="painel-grafico-corpo">
                <GraficoLinha pontos={pontos} />
              </div>
            ) : (
              <p className="painel-vazio">Ainda não há notas lançadas neste período.</p>
            ))}
        </section>

        <section className="painel-cartao painel-avisos">
          <header className="painel-cartao-cabecalho">
            <Icone nome="comunicados" tamanho={20} className="painel-cartao-icone" />
            <h2 className="painel-cartao-titulo">Avisos Recentes</h2>
            <Link className="painel-ver-todos" to={`${prefixo}/comunicados`}>
              Ver todos
              <Icone nome="seta-direita" tamanho={14} />
            </Link>
          </header>
          {comunicados.carregando && <Carregando />}
          {comunicados.erro && <Aviso tipo="erro">{comunicados.erro}</Aviso>}
          {comunicados.dados && avisos.length === 0 && (
            <p className="painel-vazio">Nenhum aviso por enquanto.</p>
          )}
          {avisos.length > 0 && (
            <ul className="painel-avisos-lista">
              {avisos.map((c, i) => (
                <li key={c.id} className="painel-aviso">
                  <span className={`painel-aviso-marca painel-cor-${CORES_AVISOS[i % 3]}`}>
                    <span className="painel-aviso-bolinha" />
                  </span>
                  <div className="painel-aviso-texto">
                    <span className="painel-aviso-titulo">{c.titulo}</span>
                    <span className="painel-aviso-corpo">{c.corpo}</span>
                  </div>
                  <span className="painel-aviso-tempo">{tempoRelativo(c.publicadoEm, agora)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="painel-coluna">
          {dados?.destaque && (
            <section className="painel-cartao painel-destaque">
              <div className="painel-destaque-texto">
                <span className="painel-destaque-etiqueta">
                  <Icone nome="turmas" tamanho={18} />
                  {dados.destaque.etiqueta}
                </span>
                <h2 className="painel-destaque-titulo">{dados.destaque.titulo}</h2>
                <p className="painel-destaque-subtitulo">{dados.destaque.subtitulo}</p>
                <Link className="painel-pilula" to={dados.destaque.caminho}>
                  Ver detalhes
                  <Icone nome="seta-direita" tamanho={14} />
                </Link>
              </div>
            </section>
          )}

          <section className="painel-cartao painel-atalhos">
            <header className="painel-cartao-cabecalho">
              <Icone nome="raio" tamanho={18} className="painel-cartao-icone" />
              <h2 className="painel-cartao-titulo">Atalhos Rápidos</h2>
            </header>
            <div className="painel-atalhos-grade">
              {atalhos.map((a) => (
                <Link key={a.rotulo} to={a.caminho} className="painel-atalho">
                  <Icone nome={a.icone} tamanho={22} />
                  <span>{a.rotulo}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
