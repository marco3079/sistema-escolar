import { useState } from 'react';
import { api } from '../../lib/api';
import { Aviso, Botao, Selo, formatarDataHora } from '../../ui';
import { rotuloPublico } from './tipos';
import type { ComunicadoDTO } from './tipos';
import './comunicados.css';

// Lista de comunicados em cartões. Abrir um comunicado não lido marca como lido no servidor.
export function ListaComunicados({
  comunicados,
  podeExcluir,
  aoExcluir,
}: {
  comunicados: ComunicadoDTO[];
  podeExcluir?: (comunicado: ComunicadoDTO) => boolean;
  aoExcluir?: (comunicado: ComunicadoDTO) => void;
}) {
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const [lidosAgora, setLidosAgora] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState<string | null>(null);

  if (comunicados.length === 0) {
    return <p className="comunicados-vazio">Nenhum comunicado.</p>;
  }

  async function alternar(comunicado: ComunicadoDTO) {
    const estaAberto = abertos.has(comunicado.id);
    const proximos = new Set(abertos);
    if (estaAberto) {
      proximos.delete(comunicado.id);
      setAbertos(proximos);
      return;
    }
    proximos.add(comunicado.id);
    setAbertos(proximos);

    if (!comunicado.lido && !lidosAgora.has(comunicado.id)) {
      try {
        await api.post(`/comunicados/${comunicado.id}/ler`);
        setLidosAgora((atuais) => new Set(atuais).add(comunicado.id));
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro inesperado');
      }
    }
  }

  return (
    <>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <ul className="comunicado-lista">
        {comunicados.map((c) => {
          const novo = !c.lido && !lidosAgora.has(c.id);
          const aberto = abertos.has(c.id);
          return (
            <li className="comunicado" key={c.id}>
              <h2 className="comunicado-titulo">
                {c.titulo} {novo && <Selo cor="verde">Novo</Selo>}
              </h2>
              <p className="comunicado-meta">
                {c.autor.nome} · {formatarDataHora(c.publicadoEm)} · {rotuloPublico(c)}
              </p>
              {aberto && <p className="comunicado-corpo">{c.corpo}</p>}
              <div className="comunicado-acoes">
                <Botao variante="secundario" aoClicar={() => alternar(c)}>
                  {aberto ? 'Fechar' : 'Abrir'}
                </Botao>
                {aoExcluir && podeExcluir?.(c) && (
                  <Botao variante="perigo" aoClicar={() => aoExcluir(c)}>
                    Excluir
                  </Botao>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
