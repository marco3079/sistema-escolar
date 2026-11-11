import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Aviso, MenuAcoes } from '../../ui';
import type { AcaoMenu } from '../../ui';
import { Icone } from '../../ui/icones';
import { NovaPublicacao } from './NovaPublicacao';
import { Votos, useVotacao } from './Votos';
import {
  SeloPapel,
  classeCor,
  contarComentarios,
  mensagemErro,
  tempoRelativo,
  useBase,
} from './comum';
import type { PublicacaoDTO } from './comum';

// Linha de contexto: comunidade, autor, papel, tempo e marcas de fixada e fechada.
export function LinhaContexto({ publicacao: p }: { publicacao: PublicacaoDTO }) {
  const base = useBase();
  return (
    <div className="forum-contexto">
      <span className={`forum-bolinha forum-cor-${classeCor(p.comunidade.cor)}`} aria-hidden="true" />
      <Link className="forum-link-comunidade" to={`${base}/forum/c/${p.comunidade.slug}`}>
        {p.comunidade.nome}
      </Link>
      <span>publicado por {p.autor.nome}</span>
      <SeloPapel perfil={p.autor.perfil} />
      <span>{tempoRelativo(p.criadoEm)}</span>
      {p.fixada && (
        <span className="forum-marca">
          <Icone nome="fixar" tamanho={14} /> Fixada
        </span>
      )}
      {p.fechada && (
        <span className="forum-marca">
          <Icone nome="cadeado" tamanho={14} /> Fechada
        </span>
      )}
    </div>
  );
}

// Ações da publicação (menu de três pontos). Editar, excluir e moderação conforme `posso`.
// Recebe a publicação nova (ou null, se foi excluída) por aoMudar.
export function AcoesPublicacao({
  publicacao: p,
  aoMudar,
}: {
  publicacao: PublicacaoDTO;
  aoMudar: (publicacao: PublicacaoDTO | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alterar(corpo: { fixada?: boolean; fechada?: boolean }) {
    setErro(null);
    try {
      const atualizada = await api.put<PublicacaoDTO>(`/forum/publicacoes/${p.id}`, corpo);
      aoMudar(atualizada);
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  async function excluir() {
    if (!window.confirm('Excluir esta publicação?')) return;
    setErro(null);
    try {
      await api.del(`/forum/publicacoes/${p.id}`);
      aoMudar(null);
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  const acoes: AcaoMenu[] = [];
  if (p.posso.editar) {
    acoes.push({ rotulo: 'Editar', icone: 'lapis', aoClicar: () => setEditando(true) });
  }
  if (p.posso.moderar) {
    acoes.push({
      rotulo: p.fixada ? 'Desafixar' : 'Fixar',
      icone: 'fixar',
      aoClicar: () => void alterar({ fixada: !p.fixada }),
    });
    acoes.push({
      rotulo: p.fechada ? 'Reabrir comentários' : 'Fechar comentários',
      icone: 'cadeado',
      aoClicar: () => void alterar({ fechada: !p.fechada }),
    });
  }
  if (p.posso.excluir) {
    acoes.push({ rotulo: 'Excluir', icone: 'fechar', perigo: true, aoClicar: () => void excluir() });
  }

  return (
    <>
      {acoes.length > 0 && <MenuAcoes acoes={acoes} rotulo={`Ações da publicação ${p.titulo}`} />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <NovaPublicacao
        aberto={editando}
        aoFechar={() => setEditando(false)}
        edicao={p}
        aoSalvar={(atualizada) => aoMudar(atualizada)}
      />
    </>
  );
}

// Cartão de uma publicação no feed: votos à esquerda (embaixo, no celular), conteúdo à direita.
export function CartaoPublicacao({
  publicacao: p,
  aoMudar,
}: {
  publicacao: PublicacaoDTO;
  aoMudar: (publicacao: PublicacaoDTO | null) => void;
}) {
  const base = useBase();
  const voto = useVotacao(`/forum/publicacoes/${p.id}/voto`, p.pontos, p.meuVoto);
  const linkPublicacao = `${base}/forum/p/${p.id}`;

  return (
    <article className="forum-cartao">
      <div className="forum-cartao-votos">
        <Votos pontos={voto.pontos} meuVoto={voto.meuVoto} aoVotar={(valor) => void voto.votar(valor)} />
      </div>

      <div className="forum-cartao-corpo">
        <LinhaContexto publicacao={p} />

        <h2 className="forum-titulo">
          <Link to={linkPublicacao}>{p.titulo}</Link>
        </h2>

        {p.corpo && <p className="forum-trecho">{p.corpo}</p>}

        {p.imagem && (
          <img className="forum-miniatura" src={p.imagem} alt="Imagem da publicação" loading="lazy" />
        )}

        <div className="forum-acoes-cartao">
          <Link className="forum-acao" to={linkPublicacao}>
            <Icone nome="comentario" tamanho={18} />
            {contarComentarios(p.comentarios)}
          </Link>
          <AcoesPublicacao publicacao={p} aoMudar={aoMudar} />
        </div>

        {voto.erro && <Aviso tipo="erro">{voto.erro}</Aviso>}
      </div>
    </article>
  );
}
