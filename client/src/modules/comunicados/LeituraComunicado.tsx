import { Botao, Selo, formatarDataHora } from '../../ui';
import { corDoPublico, iniciais } from './formatosComunicado';
import type { CorAvatar } from './formatosComunicado';
import { rotuloPublico } from './tipos';
import type { ComunicadoDTO } from './tipos';

// Leitura de um comunicado (coluna da direita em telas largas, Modal abaixo de 1000 px).
// A exclusão aparece só quando o pai passa aoExcluir (quem pode excluir).
export function LeituraComunicado({
  comunicado,
  corAvatar,
  aoExcluir,
}: {
  comunicado: ComunicadoDTO;
  corAvatar: CorAvatar;
  aoExcluir?: () => void;
}) {
  return (
    <article className="comunicado-leitura">
      <header className="comunicado-leitura-cabecalho">
        <span className={`comunicado-avatar comunicado-avatar-${corAvatar}`} aria-hidden="true">
          {iniciais(comunicado.autor.nome)}
        </span>
        <div className="comunicado-leitura-quem">
          <strong>{comunicado.autor.nome}</strong>
          <span className="comunicado-leitura-data">{formatarDataHora(comunicado.publicadoEm)}</span>
        </div>
        <Selo cor={corDoPublico(comunicado.publico)}>{rotuloPublico(comunicado)}</Selo>
      </header>

      <h2 className="comunicado-leitura-titulo">{comunicado.titulo}</h2>
      <div className="comunicado-leitura-corpo">{comunicado.corpo}</div>

      {aoExcluir && (
        <footer className="comunicado-leitura-acoes">
          <Botao variante="texto" aoClicar={aoExcluir}>
            Excluir
          </Botao>
        </footer>
      )}
    </article>
  );
}
