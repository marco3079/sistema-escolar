import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDados } from '../../lib/useDados';
import { Aviso, Campo, Carregando, Pagina, Selo, Tabela } from '../../ui';
import type { ResponsavelGestao } from './tipos';
import './responsavel.css';

// Limite da API para a lista de responsáveis.
const LIMITE_API = 200;

// Lista de responsáveis da gestão (administrador e secretaria). A busca vai ao servidor depois de uma pausa na digitação.
export function Responsaveis() {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');

  useEffect(() => {
    const pausa = window.setTimeout(() => setTermo(busca.trim()), 300);
    return () => window.clearTimeout(pausa);
  }, [busca]);

  const caminho = '/responsaveis' + (termo ? `?busca=${encodeURIComponent(termo)}` : '');
  const { dados, carregando, erro } = useDados<ResponsavelGestao[]>(caminho);

  return (
    <Pagina titulo="Responsáveis">
      <div className="barra-ferramentas">
        <div className="filtros">
          <Campo rotulo="Buscar por nome ou e-mail" valor={busca} aoMudar={setBusca} />
        </div>
      </div>

      {carregando && !dados && <Carregando />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {dados && (
        <>
          {dados.length >= LIMITE_API && (
            <Aviso tipo="info">Mostrando os primeiros {LIMITE_API} responsáveis. Refine a busca para ver outros.</Aviso>
          )}
          <Tabela
            exportar="responsaveis"
            dados={dados}
            chave={(r) => r.usuarioId}
            vazio="Nenhum responsável encontrado."
            colunas={[
              { titulo: 'Nome', celula: (r: ResponsavelGestao) => <strong>{r.nome}</strong> },
              { titulo: 'E-mail', celula: (r: ResponsavelGestao) => r.email },
              { titulo: 'Telefone', celula: (r: ResponsavelGestao) => r.telefone ?? '—' },
              {
                titulo: 'Alunos',
                celula: (r: ResponsavelGestao) =>
                  r.alunos.length === 0 ? (
                    '—'
                  ) : (
                    <ul className="resp-links">
                      {r.alunos.map((a) => (
                        <li key={a.vinculoId}>
                          <Link className="resp-link" to="/admin/alunos">
                            {a.nome}
                          </Link>{' '}
                          <span className="resp-parentesco">
                            RA {a.ra} · {a.parentesco}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ),
              },
              {
                titulo: 'Situação',
                celula: (r: ResponsavelGestao) =>
                  r.ativo ? <Selo cor="verde">Ativo</Selo> : <Selo cor="cinza">Inativo</Selo>,
              },
            ]}
          />
        </>
      )}
    </Pagina>
  );
}
