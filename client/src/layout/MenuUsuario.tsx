import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTema } from '../lib/tema';
import type { PerfilReal } from '../lib/tipos';
import { Avatar } from '../ui';
import { Icone } from '../ui/icones';

// Popup de chamados (suporte). Carregado sob demanda, na primeira abertura.
const PainelSuporte = lazy(() =>
  import('../modules/suporte/PainelSuporte').then((m) => ({ default: m.PainelSuporte })),
);

const PAPEIS: Record<PerfilReal, string> = {
  ADMIN: 'Administrador',
  TI: 'TI',
  SECRETARIA: 'Secretaria',
  PROFESSOR: 'Professor',
  ALUNO: 'Aluno',
  RESPONSAVEL: 'Responsável',
};

// Intervalo do contador de novidades do suporte (só no layout largo).
const INTERVALO_NOVIDADES_MS = 60_000;

// Número de chamados com novidades (campo `meus` de GET /chamados/novidades).
// Busca quando `ativo` vira true (a cada abertura) e, se `intervaloMs` for dado, repete nesse intervalo.
// Falha em silêncio; o intervalo é limpo ao desativar ou desmontar.
export function useNovidadesSuporte(ativo: boolean, intervaloMs?: number): number {
  const { usuario } = useAuth();
  const idUsuario = usuario?.id;
  const [novidades, setNovidades] = useState(0);

  useEffect(() => {
    if (!ativo || idUsuario === undefined) return;
    let vivo = true;
    function buscar() {
      api
        .get<{ meus: number; atendimento: number }>('/chamados/novidades')
        .then((resposta) => {
          if (vivo) setNovidades(resposta?.meus ?? 0);
        })
        .catch(() => undefined);
    }
    buscar();
    const intervalo = intervaloMs !== undefined ? window.setInterval(buscar, intervaloMs) : undefined;
    return () => {
      vivo = false;
      if (intervalo !== undefined) window.clearInterval(intervalo);
    };
  }, [ativo, idUsuario, intervaloMs]);

  return novidades;
}

// Avatar, nome e papel do usuário logado, com menu de "Meu perfil", "Suporte" e "Sair".
export function MenuUsuario() {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [suporteAberto, setSuporteAberto] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const novidades = useNovidadesSuporte(usuario !== null, INTERVALO_NOVIDADES_MS);
  const { temaEfetivo, alternar } = useTema();

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

  if (!usuario) return null;

  const caminhoPerfil =
    usuario.perfil === 'PROFESSOR'
      ? '/professor/perfil'
      : usuario.perfil === 'ALUNO'
        ? '/aluno/perfil'
        : usuario.perfil === 'RESPONSAVEL'
          ? '/responsavel/perfil'
          : '/admin/perfil';
  const primeiroNome = usuario.nome.trim().split(/\s+/)[0] ?? usuario.nome;

  function irParaPerfil() {
    setAberto(false);
    navigate(caminhoPerfil);
  }

  function abrirSuporte() {
    setAberto(false);
    setSuporteAberto(true);
  }

  function sairDaConta() {
    setAberto(false);
    sair();
  }

  return (
    <div className="casca-usuario" ref={area}>
      <button
        type="button"
        className="casca-usuario-botao"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <span className="casca-avatar-wrap">
          <Avatar nome={usuario.nome} foto={usuario.foto} />
          {novidades > 0 && <span className="casca-ponto-novidade" aria-hidden="true" />}
        </span>
        <span className="casca-usuario-texto">
          <span className="casca-usuario-nome">{usuario.nome}</span>
          <span className="casca-usuario-papel">{PAPEIS[usuario.perfilReal]}</span>
        </span>
        <Icone nome="chevron-baixo" tamanho={16} className="casca-seta" />
      </button>

      {aberto && (
        <div className="casca-menu-usuario" role="menu" aria-label={`Conta de ${primeiroNome}`}>
          <button type="button" role="menuitem" className="casca-menu-usuario-item" onClick={irParaPerfil}>
            <Icone nome="perfil" tamanho={18} />
            Meu perfil
          </button>
          <button type="button" role="menuitem" className="casca-menu-usuario-item" onClick={abrirSuporte}>
            <Icone nome="suporte" tamanho={18} />
            <span className="casca-menu-usuario-rotulo">Suporte</span>
            {novidades > 0 && (
              <span className="casca-contador" aria-label={`${novidades} novidades`}>
                {novidades}
              </span>
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            className="casca-menu-usuario-item"
            onClick={() => alternar()}
          >
            <Icone nome={temaEfetivo === 'escuro' ? 'sol' : 'lua'} tamanho={18} />
            {temaEfetivo === 'escuro' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button type="button" role="menuitem" className="casca-menu-usuario-item casca-menu-usuario-sair" onClick={sairDaConta}>
            <Icone nome="sair" tamanho={18} />
            Sair
          </button>
        </div>
      )}

      {suporteAberto && (
        <Suspense fallback={null}>
          <PainelSuporte aberto={suporteAberto} aoFechar={() => setSuporteAberto(false)} />
        </Suspense>
      )}
    </div>
  );
}
