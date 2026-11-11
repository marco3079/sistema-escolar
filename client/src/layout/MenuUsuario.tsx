import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { Perfil } from '../lib/tipos';
import { Icone } from '../ui/icones';

const PAPEIS: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  SECRETARIA: 'Secretaria',
  PROFESSOR: 'Professor',
  ALUNO: 'Aluno',
};

// Iniciais: primeira letra do primeiro e do último nome.
function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

// Avatar, nome e papel do usuário logado, com menu de "Meu perfil" e "Sair".
export function MenuUsuario() {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const area = useRef<HTMLDivElement>(null);

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

  const temPerfil = usuario.perfil === 'PROFESSOR' || usuario.perfil === 'ALUNO';
  const caminhoPerfil = usuario.perfil === 'PROFESSOR' ? '/professor/perfil' : '/aluno/perfil';
  const primeiroNome = usuario.nome.trim().split(/\s+/)[0] ?? usuario.nome;

  function irParaPerfil() {
    setAberto(false);
    navigate(caminhoPerfil);
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
        <span className="casca-avatar" aria-hidden="true">
          {iniciaisDoNome(usuario.nome)}
        </span>
        <span className="casca-usuario-texto">
          <span className="casca-usuario-nome">{usuario.nome}</span>
          <span className="casca-usuario-papel">{PAPEIS[usuario.perfil]}</span>
        </span>
        <Icone nome="chevron-baixo" tamanho={16} className="casca-seta" />
      </button>

      {aberto && (
        <div className="casca-menu-usuario" role="menu" aria-label={`Conta de ${primeiroNome}`}>
          {temPerfil && (
            <button type="button" role="menuitem" className="casca-menu-usuario-item" onClick={irParaPerfil}>
              <Icone nome="perfil" tamanho={18} />
              Meu perfil
            </button>
          )}
          <button type="button" role="menuitem" className="casca-menu-usuario-item casca-menu-usuario-sair" onClick={sairDaConta}>
            <Icone nome="sair" tamanho={18} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
