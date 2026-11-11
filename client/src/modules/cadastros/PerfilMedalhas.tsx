import { useState } from 'react';
import { Icone, NOMES_ICONES } from '../../ui/icones';
import type { NomeIcone } from '../../ui/icones';
import { Modal, formatarData } from '../../ui';
import './perfil.css';

// Formato de MedalhaDTO (docs/plano/terceira-leva.md, "Perfil e medalhas").
export interface MedalhaDTO {
  codigo: string;
  titulo: string;
  descricao: string;
  icone: string;
  cor: 'azul' | 'roxo' | 'verde' | 'laranja';
  pontos: number;
  conquistada: boolean;
  conquistadaEm: string | null;
  manual: boolean;
  id: number | null;
  concedidaPor: string | null;
  progresso: { atual: number; meta: number } | null;
}

// Ícone que existe em ui/icones.tsx; desconhecido vira o da medalha padrão.
export function iconeSeguro(nome: string): NomeIcone {
  return (NOMES_ICONES as string[]).includes(nome) ? (nome as NomeIcone) : 'medalha';
}

type Filtro = 'todas' | 'conquistadas' | 'a-conquistar';

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'conquistadas', rotulo: 'Conquistadas' },
  { id: 'a-conquistar', rotulo: 'A conquistar' },
];

function dataDe(iso: string | null): string {
  return iso ? formatarData(iso) : '';
}

// Emblema redondo: colorido quando conquistada; esmaecido com cadeado quando não.
function Emblema({
  medalha,
  grande = false,
}: {
  medalha: MedalhaDTO;
  grande?: boolean;
}) {
  const classes = [
    'perfil-emblema',
    `perfil-cor-${medalha.cor}`,
    grande ? 'perfil-emblema-grande' : '',
    medalha.conquistada ? '' : 'perfil-emblema-bloqueado',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} aria-hidden="true">
      <Icone nome={iconeSeguro(medalha.icone)} tamanho={grande ? 44 : 28} />
      {!medalha.conquistada && (
        <span className="perfil-emblema-cadeado">
          <Icone nome="cadeado" tamanho={grande ? 14 : 11} />
        </span>
      )}
    </span>
  );
}

function Progresso({ atual, meta }: { atual: number; meta: number }) {
  const pct = meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0;
  return (
    <div className="perfil-progresso">
      <div
        className="perfil-progresso-barra"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-valuenow={Math.min(atual, meta)}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="perfil-progresso-texto">
        {atual} de {meta}
      </span>
    </div>
  );
}

function DetalhesMedalha({ medalha }: { medalha: MedalhaDTO }) {
  return (
    <div className="perfil-detalhe">
      <Emblema medalha={medalha} grande />
      <h3 className="perfil-detalhe-titulo">{medalha.titulo}</h3>
      <span className="perfil-pontos">+{medalha.pontos} pts</span>
      <p className="perfil-detalhe-descricao">{medalha.descricao}</p>
      {medalha.conquistada ? (
        <p className="perfil-detalhe-linha">
          {medalha.manual
            ? `Concedida por ${medalha.concedidaPor ?? 'um membro da equipe'}`
            : 'Conquistada'}
          {medalha.conquistadaEm && ` em ${dataDe(medalha.conquistadaEm)}`}
        </p>
      ) : (
        <p className="perfil-detalhe-linha">Ainda não conquistada.</p>
      )}
      {!medalha.conquistada && medalha.progresso && (
        <Progresso atual={medalha.progresso.atual} meta={medalha.progresso.meta} />
      )}
    </div>
  );
}

export function PerfilMedalhas({
  medalhas,
  automaticasDisponiveis,
}: {
  medalhas: MedalhaDTO[];
  automaticasDisponiveis: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [aberta, setAberta] = useState<MedalhaDTO | null>(null);

  const conquistadas = medalhas.filter((m) => m.conquistada).length;
  const visiveis = medalhas.filter((m) => {
    if (filtro === 'conquistadas') return m.conquistada;
    if (filtro === 'a-conquistar') return !m.conquistada;
    return true;
  });

  return (
    <section className="cartao perfil-medalhas">
      <div className="perfil-secao-cabecalho">
        <h2 className="cartao-titulo">Medalhas</h2>
        <span className="perfil-contador">
          {conquistadas} de {medalhas.length}
        </span>
      </div>

      {!automaticasDisponiveis && (
        <p className="perfil-nota">
          As medalhas automáticas são para alunos e professores.
        </p>
      )}

      {medalhas.length > 0 && (
        <div className="perfil-pilulas" role="group" aria-label="Filtrar medalhas">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={f.id === filtro ? 'perfil-pilula perfil-pilula-ativa' : 'perfil-pilula'}
              aria-pressed={f.id === filtro}
              onClick={() => setFiltro(f.id)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      )}

      {medalhas.length === 0 ? (
        <p className="perfil-vazio">Nenhuma medalha ainda.</p>
      ) : visiveis.length === 0 ? (
        <p className="perfil-vazio">Nenhuma medalha neste filtro.</p>
      ) : (
        <ul className="perfil-grade-medalhas">
          {visiveis.map((m) => (
            <li key={m.codigo}>
              <button
                type="button"
                className={m.conquistada ? 'perfil-medalha' : 'perfil-medalha perfil-medalha-bloqueada'}
                onClick={() => setAberta(m)}
              >
                <Emblema medalha={m} />
                <span className="perfil-medalha-titulo">{m.titulo}</span>
                <span className="perfil-pontos">+{m.pontos} pts</span>
                <span className="perfil-medalha-descricao">{m.descricao}</span>
                {m.conquistada && m.manual && (
                  <span className="perfil-medalha-origem">
                    Concedida por {m.concedidaPor ?? 'um membro da equipe'}
                    {m.conquistadaEm && ` · ${dataDe(m.conquistadaEm)}`}
                  </span>
                )}
                {!m.conquistada && m.progresso && (
                  <Progresso atual={m.progresso.atual} meta={m.progresso.meta} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        aberto={aberta !== null}
        titulo={aberta?.titulo ?? 'Medalha'}
        aoFechar={() => setAberta(null)}
      >
        {aberta && <DetalhesMedalha medalha={aberta} />}
      </Modal>
    </section>
  );
}
