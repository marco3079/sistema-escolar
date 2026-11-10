import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { RotaModulo } from '../lib/rotas';
import type { Perfil } from '../lib/tipos';

export function nomePortal(perfil: Perfil): string {
  if (perfil === 'PROFESSOR') return 'Professor';
  if (perfil === 'ALUNO') return 'Aluno';
  return 'Administrativo';
}

export function caminhoDoPerfil(perfil: Perfil): string {
  if (perfil === 'PROFESSOR') return '/professor';
  if (perfil === 'ALUNO') return '/aluno';
  return '/admin';
}

export function Layout({ menu }: { menu: RotaModulo[] }) {
  const { usuario, sair } = useAuth();
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const local = useLocation();

  useEffect(() => {
    setGavetaAberta(false);
  }, [local.pathname]);

  if (!usuario) return null;

  const raizPortal = caminhoDoPerfil(usuario.perfil);
  const portal = nomePortal(usuario.perfil);
  const principais = menu.slice(0, 4);

  const classeItem = (ativo: boolean, base: string) => (ativo ? `${base} ativo` : base);

  return (
    <div className="layout">
      <aside className="barra-lateral">
        <div className="marca">Sistema Escolar</div>
        <div className="portal-nome">{portal}</div>
        <nav className="menu-lateral" aria-label="Menu principal">
          {menu.map((r) => (
            <NavLink
              key={r.caminho}
              to={r.caminho}
              end={r.caminho === raizPortal}
              className={({ isActive }) => classeItem(isActive, 'item-menu')}
            >
              <span className="icone-menu" aria-hidden="true">
                {r.icone}
              </span>
              <span>{r.rotulo}</span>
            </NavLink>
          ))}
        </nav>
        <div className="lateral-rodape">
          <div className="usuario-nome">{usuario.nome}</div>
          <button type="button" className="botao botao-secundario" onClick={sair}>
            Sair
          </button>
        </div>
      </aside>

      <header className="barra-superior">
        <h1 className="barra-titulo">{portal}</h1>
        <button
          type="button"
          className="botao-menu-topo"
          aria-label="Abrir menu"
          onClick={() => setGavetaAberta(true)}
        >
          ☰
        </button>
      </header>

      <main className="conteudo">
        <Outlet />
      </main>

      <nav className="barra-inferior" aria-label="Menu rápido">
        {principais.map((r) => (
          <NavLink
            key={r.caminho}
            to={r.caminho}
            end={r.caminho === raizPortal}
            className={({ isActive }) => classeItem(isActive, 'item-inferior')}
          >
            <span className="icone-menu" aria-hidden="true">
              {r.icone}
            </span>
            <span>{r.rotulo}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="item-inferior botao-mais"
          onClick={() => setGavetaAberta(true)}
        >
          <span className="icone-menu" aria-hidden="true">
            ⋯
          </span>
          <span>Mais</span>
        </button>
      </nav>

      {gavetaAberta && (
        <div className="gaveta-fundo" onClick={() => setGavetaAberta(false)}>
          <div
            className="gaveta"
            role="dialog"
            aria-modal="true"
            aria-label="Menu completo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gaveta-cabecalho">
              <strong>{portal}</strong>
              <button
                type="button"
                className="modal-fechar"
                aria-label="Fechar menu"
                onClick={() => setGavetaAberta(false)}
              >
                ×
              </button>
            </div>
            <ul className="gaveta-lista">
              {menu.map((r) => (
                <li key={r.caminho}>
                  <NavLink
                    to={r.caminho}
                    end={r.caminho === raizPortal}
                    className={({ isActive }) => classeItem(isActive, 'item-gaveta')}
                  >
                    <span className="icone-menu" aria-hidden="true">
                      {r.icone}
                    </span>
                    <span>{r.rotulo}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="gaveta-rodape">
              <div className="usuario-nome">{usuario.nome}</div>
              <button type="button" className="botao botao-perigo" onClick={sair}>
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
