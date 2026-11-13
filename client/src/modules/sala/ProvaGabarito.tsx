import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../lib/api';
import { ROTULO_TIPO_QUESTAO } from './ProvaTipos';
import { VF_FALSO, VF_VERDADEIRO, formatarNumero, mensagemErroProva, rotuloVF } from './ProvaTipos';
import type { ItemGabarito, MinhaProvaResposta } from './ProvaTipos';
import './provas.css';

// Opções exibidas com o valor gravado (índice na objetiva; 1 = verdadeiro, 0 = falso no VF).
export function opcoesDe(item: Pick<ItemGabarito, 'tipo' | 'alternativas'>): { valor: number; texto: string }[] {
  if (item.tipo === 'VERDADEIRO_FALSO') {
    return [
      { valor: VF_VERDADEIRO, texto: rotuloVF(VF_VERDADEIRO) },
      { valor: VF_FALSO, texto: rotuloVF(VF_FALSO) },
    ];
  }
  return item.alternativas.map((texto, valor) => ({ valor, texto }));
}

// Uma questão com o gabarito: enunciado, alternativas (certa e marcada), resposta do aluno e pontos.
// `children` recebe um bloco extra (por exemplo, o formulário de correção do professor).
export function ItemGabaritoView({
  item,
  numero,
  mostrarResposta = true,
  children,
}: {
  item: ItemGabarito;
  numero: number;
  mostrarResposta?: boolean;
  children?: ReactNode;
}) {
  const opcoes = opcoesDe(item);
  return (
    <article className="prova-questao-gabarito">
      <header className="prova-questao-cabecalho">
        <strong>Questão {numero}</strong>
        <span className="prova-questao-tipo">{ROTULO_TIPO_QUESTAO[item.tipo]}</span>
        <span className="prova-questao-pontos">
          {item.pontosObtidos !== null
            ? `${formatarNumero(item.pontosObtidos)} de ${formatarNumero(item.pontos)} pts`
            : `${formatarNumero(item.pontos)} pts`}
        </span>
      </header>
      <p className="prova-texto">{item.enunciado}</p>

      {item.tipo !== 'DISSERTATIVA' && opcoes.length > 0 && (
        <ol className="prova-opcoes-gabarito" aria-label="Alternativas">
          {opcoes.map(({ valor, texto }, i) => {
            const certa = item.correta === valor;
            const marcada = mostrarResposta && item.minhaAlternativa === valor;
            const classes = [
              'prova-opcao-gabarito',
              certa ? 'prova-opcao-certa' : '',
              marcada && !certa ? 'prova-opcao-errada' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <li key={i} className={classes}>
                <span className="prova-opcao-letra">
                  {item.tipo === 'VERDADEIRO_FALSO' ? '' : `${String.fromCharCode(65 + i)})`}
                </span>
                <span className="prova-opcao-texto">{texto}</span>
                {certa && <span className="prova-opcao-marca">Resposta certa</span>}
                {marcada && <span className="prova-opcao-marca">Marcada</span>}
              </li>
            );
          })}
        </ol>
      )}

      {item.tipo === 'DISSERTATIVA' && mostrarResposta && (
        <div className="prova-resposta-texto">
          <span className="prova-rotulo-pequeno">Resposta</span>
          <p className="prova-texto">{item.meuTexto?.trim() ? item.meuTexto : 'Sem resposta.'}</p>
        </div>
      )}

      {item.comentario && item.comentario.trim() !== '' && (
        <div className="prova-comentario">
          <span className="prova-rotulo-pequeno">Comentário do professor</span>
          <p className="prova-texto">{item.comentario}</p>
        </div>
      )}

      {children}
    </article>
  );
}

// Gabarito liberado depois que a prova fecha (GET /provas/:id/minha). Sem gabarito, não mostra nada.
export function GabaritoAluno({ provaId }: { provaId: number }) {
  const [itens, setItens] = useState<ItemGabarito[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<MinhaProvaResposta>(`/provas/${provaId}/minha`)
      .then((d) => {
        if (vivo) setItens(d.gabarito);
      })
      .catch((e) => {
        if (vivo) setErro(mensagemErroProva(e));
      });
    return () => {
      vivo = false;
    };
  }, [provaId]);

  if (erro || !itens || itens.length === 0) return null;
  return (
    <section className="prova-gabarito-final" aria-label="Gabarito">
      <h3>Gabarito</h3>
      {itens.map((item, i) => (
        <ItemGabaritoView key={item.questaoId} item={item} numero={i + 1} />
      ))}
    </section>
  );
}
