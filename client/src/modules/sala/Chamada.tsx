import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import { Aviso, Botao, Caixa, Campo, Carregando, Selecao, Selo, formatarData } from '../../ui';
import { Icone } from '../../ui/icones';
import { QrCode } from '../../ui/QrCode';
import type { PropsAba } from './comum';
import './chamada.css';

// ---------- Tipos (Contrato E) ----------

interface AulaItem {
  id: number;
  data: string;
  conteudo: string | null;
}

interface AlunoChamada {
  inscricaoId: number;
  nome: string;
  ra: string;
  presente: boolean | null;
}

interface ChamadaEstado {
  aberta: boolean;
  fechaEm: string | null;
  token: string | null;
  trocaEmSeg: number;
  presentes: number;
  total: number;
  lista: AlunoChamada[];
}

// Estado guardado no painel: além da resposta, o momento em que chegou (para a contagem) e a aula a que pertence.
interface ChamadaVista extends ChamadaEstado {
  aulaId: number;
  recebidoEm: number;
}

// Consulta periódica da chamada: a cada 2 s, uma por vez, pausada com a aba oculta.
const INTERVALO_CHAMADA_MS = 2000;
const MINUTOS_PADRAO = 10;

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Texto dentro do QR code: o endereço da página de presença com o token.
function textoQr(token: string): string {
  return `${window.location.origin}/aluno/presenca?t=${token}`;
}

// Aceita data só (AAAA-MM-DD) ou ISO com hora, e compara com o dia de hoje no horário local.
function ehHoje(iso: string): boolean {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(data.getTime())) return false;
  return data.toDateString() === new Date().toDateString();
}

function rotuloAula(aula: AulaItem): string {
  const conteudo = aula.conteudo?.trim();
  return conteudo ? `${formatarData(aula.data)} · ${conteudo}` : formatarData(aula.data);
}

function horaCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Consulta a chamada da aula enquanto houver aula escolhida. Nunca há duas consultas ao mesmo tempo.
function useChamadaAoVivo(aulaId: number | null) {
  const [vista, setVista] = useState<ChamadaVista | null>(null);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);

  useEffect(() => {
    setErroConsulta(null);
    if (aulaId === null) {
      setVista(null);
      return;
    }

    const idAula: number = aulaId;
    let cancelado = false;
    let emVoo = false;
    let timer: number | undefined;

    function agendar(): void {
      if (cancelado || document.visibilityState === 'hidden') return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void consultar(), INTERVALO_CHAMADA_MS);
    }

    async function consultar(): Promise<void> {
      if (cancelado || emVoo || document.visibilityState === 'hidden') return;
      emVoo = true;
      try {
        const resposta = await api.get<ChamadaEstado>(`/aulas/${idAula}/chamada-qr`);
        if (cancelado) return;
        setVista({ ...resposta, aulaId: idAula, recebidoEm: Date.now() });
        setErroConsulta(null);
      } catch (e) {
        if (!cancelado) setErroConsulta(mensagem(e));
      } finally {
        emVoo = false;
        agendar();
      }
    }

    function aoMudarVisibilidade(): void {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(timer);
        return;
      }
      void consultar();
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    void consultar();

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [aulaId]);

  // Usado pelas ações (abrir e encerrar) para mostrar a resposta na hora.
  function aplicar(estado: ChamadaEstado): void {
    if (aulaId === null) return;
    setVista({ ...estado, aulaId, recebidoEm: Date.now() });
  }

  return { vista, erroConsulta, aplicar };
}

// ---------- Aba Chamada (painel do professor) ----------

export function AbaChamada({ turmaId, base }: PropsAba) {
  // O link para o diário só existe no portal do professor (a gestão recebe só o texto).
  const linkDiario = base === '/professor';
  const aulas = useDados<AulaItem[]>(`/salas/${turmaId}/aulas`);
  const [aulaEscolhida, setAulaEscolhida] = useState<number | null>(null);
  const [minutos, setMinutos] = useState(String(MINUTOS_PADRAO));
  const [marcarFaltas, setMarcarFaltas] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const listaAulas = aulas.dados ?? [];
  const aulaDeHoje = listaAulas.find((a) => ehHoje(a.data)) ?? null;
  const aulaId = aulaEscolhida ?? aulaDeHoje?.id ?? null;
  const aula = listaAulas.find((a) => a.id === aulaId) ?? null;
  const { vista, erroConsulta, aplicar } = useChamadaAoVivo(aulaId);
  const estado = aula && vista && vista.aulaId === aula.id ? vista : null;
  const aberta = estado !== null && estado.aberta && estado.token !== null;

  // Contagem regressiva da troca do código: atualiza a cada segundo enquanto a chamada está aberta.
  useEffect(() => {
    if (!aberta) return;
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [aberta]);

  // Tela cheia (para projetar o QR). Esc sai pelo próprio navegador.
  const telaRef = useRef<HTMLDivElement>(null);
  const [emTelaCheia, setEmTelaCheia] = useState(false);
  const [avisoTela, setAvisoTela] = useState<string | null>(null);
  const podeTelaCheia = typeof document !== 'undefined' && document.fullscreenEnabled === true;

  useEffect(() => {
    function aoMudarTelaCheia(): void {
      const el = telaRef.current;
      setEmTelaCheia(el !== null && document.fullscreenElement === el);
    }
    document.addEventListener('fullscreenchange', aoMudarTelaCheia);
    return () => {
      document.removeEventListener('fullscreenchange', aoMudarTelaCheia);
      const el = telaRef.current;
      if (el && document.fullscreenElement === el) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  async function alternarTelaCheia(): Promise<void> {
    setAvisoTela(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (telaRef.current) {
        await telaRef.current.requestFullscreen();
      }
    } catch {
      setAvisoTela('O navegador não permitiu a tela cheia. A chamada continua na tela normal.');
    }
  }

  async function abrir(): Promise<void> {
    if (aulaId === null) return;
    const valor = Number(minutos);
    if (!Number.isInteger(valor) || valor < 1 || valor > 60) {
      setErroAcao('Informe a duração em minutos, de 1 a 60.');
      return;
    }
    setOcupado(true);
    setErroAcao(null);
    try {
      const resposta = await api.post<ChamadaEstado>(`/aulas/${aulaId}/chamada-qr`, { minutos: valor });
      aplicar(resposta);
    } catch (e) {
      setErroAcao(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }

  async function encerrar(): Promise<void> {
    if (aulaId === null) return;
    setOcupado(true);
    setErroAcao(null);
    try {
      await api.post(`/aulas/${aulaId}/chamada-qr/fechar`, { marcarFaltas });
      setMarcarFaltas(false);
      const resposta = await api.get<ChamadaEstado>(`/aulas/${aulaId}/chamada-qr`);
      aplicar(resposta);
    } catch (e) {
      setErroAcao(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }

  const restante =
    estado && aberta ? Math.max(0, Math.ceil(estado.trocaEmSeg - (agora - estado.recebidoEm) / 1000)) : 0;

  return (
    <section className="chamada">
      <p className="chamada-intro">
        Os alunos leem o QR code ou digitam o código para registrar presença. O código muda a cada 20 segundos.
      </p>

      {aulas.erro && <Aviso tipo="erro">{aulas.erro}</Aviso>}
      {aulas.carregando && <Carregando />}

      {!aulas.carregando && aulas.dados && listaAulas.length === 0 && (
        <Aviso tipo="info">
          Esta turma ainda não tem aulas no diário.{' '}
          {linkDiario ? (
            <>
              Registre a aula em <Link to={`/professor/diario/${turmaId}`}>Diário da turma</Link> para abrir a
              chamada.
            </>
          ) : (
            'Registre a aula no diário para abrir a chamada.'
          )}
        </Aviso>
      )}

      {listaAulas.length > 0 && (
        <>
          <div className="chamada-escolha">
            <Selecao
              rotulo="Aula"
              valor={aulaId === null ? '' : String(aulaId)}
              aoMudar={(v) => setAulaEscolhida(v === '' ? null : Number(v))}
              opcoes={listaAulas.map((a) => ({ valor: String(a.id), rotulo: rotuloAula(a) }))}
              vazio="Escolha a aula"
            />
            <Botao variante="secundario" aoClicar={() => void aulas.recarregar()}>
              Atualizar aulas
            </Botao>
          </div>

          {aulaDeHoje === null && (
            <Aviso tipo="info">
              Não há aula de hoje no diário.{' '}
              {linkDiario ? (
                <>
                  Para abrir a chamada de hoje, registre a aula em{' '}
                  <Link to={`/professor/diario/${turmaId}`}>Diário da turma</Link>.
                </>
              ) : (
                'Para abrir a chamada de hoje, registre a aula no diário.'
              )}{' '}
              Você também pode abrir a chamada de uma aula anterior escolhendo-a acima.
            </Aviso>
          )}

          {erroConsulta && <Aviso tipo="erro">{erroConsulta}</Aviso>}
          {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}

          {aula && !aberta && (
            <div className="chamada-cartao">
              {estado ? <p>A chamada desta aula está fechada.</p> : <Carregando />}
              <div className="chamada-abrir">
                <Campo tipo="number" rotulo="Duração (minutos)" valor={minutos} aoMudar={setMinutos} obrigatorio />
                <Botao aoClicar={() => void abrir()} desabilitado={ocupado}>
                  Abrir chamada
                </Botao>
              </div>
            </div>
          )}

          {estado && aberta && estado.token !== null && (
            <>
              <div className="chamada-tela" ref={telaRef}>
                <p className="chamada-aula">
                  {aula ? formatarData(aula.data) : ''}
                  {estado.fechaEm && ` · fecha às ${horaCurta(estado.fechaEm)}`}
                </p>
                <div className="chamada-qr">
                  <QrCode texto={textoQr(estado.token)} tamanho={320} />
                </div>
                <p className="chamada-codigo">{estado.token}</p>
                <p className="chamada-troca" role="status" aria-live="polite">
                  {restante > 0 ? `Novo código em ${restante} s` : 'Atualizando o código...'}
                </p>
                <p className="chamada-contagem" role="status" aria-live="polite">
                  {estado.presentes} de {estado.total} presentes
                </p>
              </div>

              {avisoTela && <Aviso tipo="info">{avisoTela}</Aviso>}

              <div className="chamada-acoes">
                {podeTelaCheia && (
                  <Botao variante="secundario" aoClicar={() => void alternarTelaCheia()}>
                    {emTelaCheia ? 'Sair da tela cheia' : 'Tela cheia para projetar'}
                  </Botao>
                )}
                <Caixa
                  rotulo="Marcar falta para quem não respondeu"
                  marcado={marcarFaltas}
                  aoMudar={setMarcarFaltas}
                />
                <Botao variante="perigo" aoClicar={() => void encerrar()} desabilitado={ocupado}>
                  Encerrar chamada
                </Botao>
              </div>

              <h3 className="chamada-subtitulo">
                <Icone nome="qr" /> Alunos da turma
              </h3>
              {estado.lista.length === 0 && <p className="tabela-vazia">Nenhum aluno inscrito.</p>}
              <ul className="chamada-lista" aria-label="Alunos da turma">
                {estado.lista.map((a) => (
                  <li key={a.inscricaoId} className="chamada-item">
                    <span className="chamada-nome">{a.nome}</span>
                    <span className="chamada-ra">RA {a.ra}</span>
                    {a.presente === true && <Selo cor="verde">Presente</Selo>}
                    {a.presente === false && <Selo cor="vermelho">Falta</Selo>}
                    {a.presente === null && <Selo cor="cinza">Sem registro</Selo>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
