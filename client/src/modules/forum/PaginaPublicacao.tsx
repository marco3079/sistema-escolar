import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDados } from '../../lib/useDados';
import { Aviso, Carregando } from '../../ui';
import { Icone } from '../../ui/icones';
import { AcoesPublicacao, LinhaContexto } from './CartaoPublicacao';
import { CaixaResposta, Comentarios } from './Comentarios';
import { Votos, useVotacao } from './Votos';
import { contarComentarios, useBase } from './comum';
import type { PublicacaoDetalhe, PublicacaoDTO } from './comum';

// Página de uma publicação: conteúdo inteiro, caixa de comentário e árvore de comentários.
export function PaginaPublicacao() {
  const { id } = useParams();
  const base = useBase();
  const navigate = useNavigate();
  const idValido = id !== undefined && /^\d+$/.test(id);
  const { dados, carregando, erro, recarregar } = useDados<PublicacaoDetalhe>(
    idValido ? `/forum/publicacoes/${id}` : null
  );

  // Publicação excluída: volta para o feed da comunidade. Edição: recarrega os dados.
  function aoMudar(publicacao: PublicacaoDTO | null) {
    if (publicacao === null) {
      navigate(dados ? `${base}/forum/c/${dados.comunidade.slug}` : `${base}/forum`);
    } else {
      recarregar();
    }
  }

  const voltar = (
    <Link className="forum-voltar" to={dados ? `${base}/forum/c/${dados.comunidade.slug}` : `${base}/forum`}>
      <span className="forum-voltar-seta" aria-hidden="true">
        <Icone nome="seta-direita" tamanho={16} />
      </span>
      Voltar
    </Link>
  );

  if (!idValido) {
    return (
      <section className="forum-pagina">
        {voltar}
        <Aviso tipo="erro">Publicação não encontrada.</Aviso>
      </section>
    );
  }

  if (carregando && !dados) {
    return (
      <section className="forum-pagina">
        {voltar}
        <Carregando />
      </section>
    );
  }

  if (!dados) {
    return (
      <section className="forum-pagina">
        {voltar}
        <Aviso tipo="erro">{erro ?? 'Não foi possível abrir a publicação.'}</Aviso>
      </section>
    );
  }

  return (
    <section className="forum-pagina">
      {voltar}

      <PublicacaoCompleta publicacao={dados} aoMudar={aoMudar} />

      <section className="forum-comentarios" aria-label="Comentários">
        <h2 className="forum-subtitulo">{contarComentarios(dados.comentarios)}</h2>
        {dados.fechada ? (
          <Aviso tipo="info">Esta publicação está fechada para novos comentários.</Aviso>
        ) : (
          <CaixaResposta publicacaoId={dados.id} aoEnviar={recarregar} />
        )}
        <Comentarios
          publicacaoId={dados.id}
          lista={dados.comentariosLista}
          fechada={dados.fechada}
          aoMudar={recarregar}
        />
      </section>
    </section>
  );
}

function PublicacaoCompleta({
  publicacao: p,
  aoMudar,
}: {
  publicacao: PublicacaoDetalhe;
  aoMudar: (publicacao: PublicacaoDTO | null) => void;
}) {
  const voto = useVotacao(`/forum/publicacoes/${p.id}/voto`, p.pontos, p.meuVoto);

  return (
    <article className="forum-cartao forum-cartao-completo">
      <div className="forum-cartao-votos">
        <Votos pontos={voto.pontos} meuVoto={voto.meuVoto} aoVotar={(valor) => void voto.votar(valor)} />
      </div>

      <div className="forum-cartao-corpo">
        <LinhaContexto publicacao={p} />

        <h1 className="forum-titulo-grande">{p.titulo}</h1>

        {p.corpo && <div className="forum-corpo">{p.corpo}</div>}

        {p.imagem && (
          <img className="forum-imagem-grande" src={p.imagem} alt="Imagem da publicação" />
        )}

        <div className="forum-acoes-cartao">
          <span className="forum-acao">
            <Icone nome="comentario" tamanho={18} />
            {contarComentarios(p.comentarios)}
          </span>
          <AcoesPublicacao publicacao={p} aoMudar={aoMudar} />
        </div>

        {voto.erro && <Aviso tipo="erro">{voto.erro}</Aviso>}
      </div>
    </article>
  );
}
