import { useState } from 'react';
import { api } from '../../lib/api';
import { AreaTexto, Aviso, Botao, Caixa, Campo, Modal, Selecao } from '../../ui';
import {
  inputDataHoraParaIso,
  isoParaInputDataHora,
  mensagemErroProva,
} from './ProvaTipos';
import type { AvaliacaoOpcao, ProvaDTO } from './ProvaTipos';
import './provas.css';

// Campos do formulário (texto, como o usuário digita).
interface Campos {
  titulo: string;
  instrucoes: string;
  abreEm: string;
  fechaEm: string;
  duracaoMin: string;
  embaralhar: boolean;
  notaMaxima: string;
  mostrarGabarito: boolean;
  avaliacaoId: string;
}

// Corpo de POST /salas/:turmaId/provas e PUT /provas/:id.
interface CorpoProva {
  titulo: string;
  instrucoes: string;
  abreEm: string;
  fechaEm: string;
  duracaoMin: number;
  embaralhar: boolean;
  notaMaxima: number;
  mostrarGabarito: boolean;
  avaliacaoId: number | null;
}

function camposIniciais(prova: ProvaDTO | null): Campos {
  return {
    titulo: prova?.titulo ?? '',
    instrucoes: prova?.instrucoes ?? '',
    abreEm: prova ? isoParaInputDataHora(prova.abreEm) : '',
    fechaEm: prova ? isoParaInputDataHora(prova.fechaEm) : '',
    duracaoMin: prova ? String(prova.duracaoMin) : '60',
    embaralhar: prova?.embaralhar ?? false,
    notaMaxima: prova ? String(prova.notaMaxima) : '10',
    mostrarGabarito: prova?.mostrarGabarito ?? false,
    avaliacaoId: prova?.avaliacaoId ? String(prova.avaliacaoId) : '',
  };
}

// Valor do datetime-local em ISO. Se não mudou em relação ao original, devolve o ISO original.
function dataDoCampo(valor: string, isoOriginal: string | null): string | null {
  if (isoOriginal && valor === isoParaInputDataHora(isoOriginal)) return isoOriginal;
  return inputDataHoraParaIso(valor);
}

// Converte o texto de um número (aceita vírgula). NaN quando não é número.
function numeroDe(texto: string): number {
  return Number(texto.trim().replace(',', '.'));
}

// Confere os campos (as mesmas faixas do contrato) e monta o corpo. Devolve o erro, se houver.
// Datas que o usuário não mexeu vão como vieram do servidor (ISO original, sem perder segundos).
function montarCorpo(
  c: Campos,
  original: ProvaDTO | null,
): { erro: string } | { corpo: CorpoProva } {
  const titulo = c.titulo.trim();
  if (titulo.length < 2 || titulo.length > 120) return { erro: 'O título tem de ter de 2 a 120 caracteres.' };
  if (c.instrucoes.length > 5000) return { erro: 'As instruções passam de 5.000 caracteres.' };

  const abreEm = dataDoCampo(c.abreEm, original?.abreEm ?? null);
  const fechaEm = dataDoCampo(c.fechaEm, original?.fechaEm ?? null);
  if (!abreEm) return { erro: 'Informe a data e a hora em que a prova abre.' };
  if (!fechaEm) return { erro: 'Informe a data e a hora em que a prova fecha.' };
  if (new Date(fechaEm).getTime() <= new Date(abreEm).getTime()) {
    return { erro: 'A prova tem de fechar depois de abrir.' };
  }

  const duracaoMin = numeroDe(c.duracaoMin);
  if (!Number.isInteger(duracaoMin) || duracaoMin < 5 || duracaoMin > 300) {
    return { erro: 'A duração tem de ser de 5 a 300 minutos.' };
  }

  const notaMaxima = numeroDe(c.notaMaxima);
  if (!Number.isFinite(notaMaxima) || notaMaxima < 0.1 || notaMaxima > 100) {
    return { erro: 'A nota máxima tem de ser de 0,1 a 100.' };
  }

  return {
    corpo: {
      titulo,
      instrucoes: c.instrucoes,
      abreEm,
      fechaEm,
      duracaoMin,
      embaralhar: c.embaralhar,
      notaMaxima,
      mostrarGabarito: c.mostrarGabarito,
      avaliacaoId: c.avaliacaoId === '' ? null : Number(c.avaliacaoId),
    },
  };
}

// Formulário de nova prova ou de edição dos dados (não edita as questões; isso é o editor).
export function ProvaFormulario({
  turmaId,
  prova,
  avaliacoes,
  aoFechar,
  aoSalvo,
}: {
  turmaId: number;
  prova: ProvaDTO | null;
  avaliacoes: AvaliacaoOpcao[];
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  const [campos, setCampos] = useState<Campos>(() => camposIniciais(prova));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Com tentativa iniciada, só título, instruções, fim e gabarito podem mudar (o resto fica travado).
  const travado = prova?.resumo?.temTentativa === true;

  function mudar<K extends keyof Campos>(chave: K, valor: Campos[K]) {
    setCampos((atual) => ({ ...atual, [chave]: valor }));
  }

  async function salvar() {
    const resultado = montarCorpo(campos, prova);
    if ('erro' in resultado) {
      setErro(resultado.erro);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      if (prova) {
        await api.put(`/provas/${prova.id}`, resultado.corpo);
      } else {
        await api.post(`/salas/${turmaId}/provas`, resultado.corpo);
      }
      aoSalvo();
    } catch (e) {
      setErro(mensagemErroProva(e));
      setSalvando(false);
    }
  }

  const opcoesAvaliacao = avaliacoes.map((a) => ({
    valor: String(a.id),
    rotulo: `${a.nome} (nota máxima ${a.notaMaxima})`,
  }));

  return (
    <Modal aberto titulo={prova ? 'Editar prova' : 'Nova prova'} aoFechar={aoFechar}>
      <form
        className="prova-formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        {travado && (
          <Aviso tipo="info">
            Esta prova já tem tentativas iniciadas: só o título, as instruções, a data de fim e o
            gabarito podem ser alterados.
          </Aviso>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <Campo
          rotulo="Título"
          valor={campos.titulo}
          aoMudar={(v) => mudar('titulo', v)}
          obrigatorio
        />
        <AreaTexto
          rotulo="Instruções"
          valor={campos.instrucoes}
          aoMudar={(v) => mudar('instrucoes', v)}
          linhas={4}
        />

        <div className="prova-linha-duas">
          <fieldset className="prova-travado" disabled={travado}>
            <Campo
              rotulo="Abre em"
              tipo="datetime-local"
              valor={campos.abreEm}
              aoMudar={(v) => mudar('abreEm', v)}
              obrigatorio
            />
          </fieldset>
          {/* O fim pode mudar mesmo com tentativas (regra do contrato). */}
          <Campo
            rotulo="Fecha em"
            tipo="datetime-local"
            valor={campos.fechaEm}
            aoMudar={(v) => mudar('fechaEm', v)}
            obrigatorio
          />
        </div>

        <fieldset className="prova-travado" disabled={travado}>
          <div className="prova-linha-duas">
            <Campo
              rotulo="Duração (minutos)"
              tipo="number"
              valor={campos.duracaoMin}
              aoMudar={(v) => mudar('duracaoMin', v)}
              obrigatorio
            />
            <Campo
              rotulo="Nota máxima"
              tipo="number"
              valor={campos.notaMaxima}
              aoMudar={(v) => mudar('notaMaxima', v)}
              obrigatorio
            />
          </div>
          <Selecao
            rotulo="Avaliação do diário"
            valor={campos.avaliacaoId}
            aoMudar={(v) => mudar('avaliacaoId', v)}
            opcoes={opcoesAvaliacao}
            vazio="Não ligar ao diário"
          />
          <Caixa
            rotulo="Embaralhar a ordem das questões para cada aluno"
            marcado={campos.embaralhar}
            aoMudar={(v) => mudar('embaralhar', v)}
          />
        </fieldset>

        <Caixa
          rotulo="Mostrar o gabarito aos alunos depois que a prova fechar"
          marcado={campos.mostrarGabarito}
          aoMudar={(v) => mudar('mostrarGabarito', v)}
        />

        <div className="prova-acoes-modal">
          <Botao variante="secundario" aoClicar={aoFechar}>
            Cancelar
          </Botao>
          <Botao tipo="submit" desabilitado={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
