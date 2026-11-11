import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useDados } from '../lib/useDados';
import type { ComunicadoDTO } from '../modules/comunicados/tipos';
import { formatarDataHora } from '../ui';
import { Icone } from '../ui/icones';

const MAXIMO_LISTA = 5;

// Sino do topo: contador de comunicados não lidos e painel com os mais recentes.
// `raiz` é o caminho do portal (ex.: /admin); a tela de comunicados fica em `${raiz}/comunicados`.
export function Notificacoes({ raiz }: { raiz: string }) {
  const navigate = useNavigate();
  const { dados, erro, recarregar } = useDados<ComunicadoDTO[]>('/comunicados');
  const [aberto, setAberto] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const caminhoComunicados = `${raiz}/comunicados`;

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (area.current && !area.current.contains(e.target as Node)) setAberto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  // Atualiza o contador a cada 60 s e quando a janela volta a ter foco. recarregar é estável.
  useEffect(() => {
    const intervalo = window.setInterval(() => recarregar(), 60000);
    const aoFocar = () => recarregar();
    window.addEventListener('focus', aoFocar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', aoFocar);
    };
  }, [recarregar]);

  const lista = dados ?? [];
  const naoLidos = lista.filter((c) => c.lido === false).length;
  const recentes = [...lista]
    .sort((a, b) => new Date(b.publicadoEm).getTime() - new Date(a.publicadoEm).getTime())
    .slice(0, MAXIMO_LISTA);

  // Marca como lido (se preciso), recarrega o contador e abre a tela de comunicados.
  async function abrirAviso(c: ComunicadoDTO) {
    setAberto(false);
    if (!c.lido) {
      try {
        await api.post(`/comunicados/${c.id}/ler`);
      } catch {
        // Se não marcar como lido, a tela de comunicados mostra o erro.
      }
      recarregar();
    }
    navigate(caminhoComunicados);
  }

  return (
    <div className="casca-sino-area" ref={area}>
      <button
        type="button"
        className="casca-botao-redondo"
        aria-label="Avisos"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <Icone nome="sino" tamanho={22} />
        {naoLidos > 0 && (
          <span className="casca-contador" aria-hidden="true">
            {naoLidos > 9 ? '9+' : naoLidos}
          </span>
        )}
      </button>

      {aberto && (
        <div className="casca-painel-avisos" role="dialog" aria-label="Avisos recentes">
          <div className="casca-painel-cabecalho">
            <strong>Avisos</strong>
            <Link to={caminhoComunicados} className="casca-link" onClick={() => setAberto(false)}>
              Ver todos
            </Link>
          </div>

          {erro && <p className="casca-painel-vazio">Não foi possível carregar os avisos.</p>}
          {!erro && recentes.length === 0 && <p className="casca-painel-vazio">Nenhum aviso.</p>}

          <ul className="casca-avisos-lista">
            {recentes.map((c) => (
              <li key={c.id}>
                <button type="button" className="casca-aviso" onClick={() => abrirAviso(c)}>
                  <span
                    className={c.lido ? 'casca-aviso-ponto casca-aviso-ponto-lido' : 'casca-aviso-ponto'}
                    aria-hidden="true"
                  />
                  <span className="casca-aviso-texto">
                    <span className="casca-aviso-titulo">{c.titulo}</span>
                    <span className="casca-aviso-meta">
                      {c.autor.nome} · {formatarDataHora(c.publicadoEm)}
                    </span>
                  </span>
                  {!c.lido && <span className="casca-aviso-novo">Novo</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
