import { BotaoPdf } from '../documentos/BotaoPdf';
import { Aviso } from '../../ui';
import { Icone } from '../../ui/icones';
import type { NomeIcone } from '../../ui/icones';
import './responsavel.css';

function CartaoDocumento({
  icone,
  titulo,
  descricao,
  caminho,
  nomeArquivo,
}: {
  icone: NomeIcone;
  titulo: string;
  descricao: string;
  caminho: string;
  nomeArquivo: string;
}) {
  return (
    <article className="resp-documento">
      <span className="resp-documento-icone">
        <Icone nome={icone} tamanho={22} />
      </span>
      <h3 className="resp-cartao-titulo">{titulo}</h3>
      <p className="resp-suave">{descricao}</p>
      <div className="resp-documento-rodape">
        <BotaoPdf caminho={caminho} nomeArquivo={nomeArquivo} />
      </div>
    </article>
  );
}

// Documentos em PDF da matrícula escolhida. O código de conferência fica no rodapé de cada página.
export function Documentos({ ra, matriculaId }: { ra: string; matriculaId: number | null }) {
  if (matriculaId === null) {
    return <Aviso tipo="info">Este aluno ainda não tem matrícula, então não há documentos para emitir.</Aviso>;
  }

  return (
    <div className="resp-visao">
      <p className="resp-suave">
        Cada PDF traz, no rodapé, um código de conferência. Quem receber o documento pode conferir a
        autenticidade na página de validação do sistema, informando esse código.
      </p>
      <div className="resp-grade">
        <CartaoDocumento
          icone="boletim"
          titulo="Boletim"
          descricao="Notas das avaliações, média, frequência e situação de cada disciplina."
          caminho={`/documentos/boletim/${matriculaId}`}
          nomeArquivo={`boletim-${ra}.pdf`}
        />
        <CartaoDocumento
          icone="historico"
          titulo="Histórico escolar"
          descricao="Disciplinas cursadas, créditos, carga horária e coeficiente."
          caminho={`/documentos/historico/${matriculaId}`}
          nomeArquivo={`historico-${ra}.pdf`}
        />
        <CartaoDocumento
          icone="documento"
          titulo="Declaração de matrícula"
          descricao="Declara o vínculo do aluno com o curso. Disponível enquanto a matrícula estiver ativa."
          caminho={`/documentos/declaracao/${matriculaId}`}
          nomeArquivo={`declaracao-${ra}.pdf`}
        />
      </div>
    </div>
  );
}
