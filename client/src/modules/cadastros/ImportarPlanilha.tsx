import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../../lib/api';
import { baixarTexto, gerarCsv, lerCsv } from '../../lib/csv';
import { Aviso, Botao, Campo, Modal, Selo } from '../../ui';
import { mensagemErro } from './tipos';
import type { ModeloImportacaoDTO, ResultadoImportacaoDTO } from './tipos';

// Importação de alunos ou professores por planilha CSV (rotas /alunos/importar e /professores/importar).

export type TipoImportacao = 'alunos' | 'professores';

const LIMITE_LINHAS = 500;
const SENHA_MINIMA = 8;
const LINHAS_PREVIA = 5;

const TEXTOS: Record<TipoImportacao, { singular: string; plural: string }> = {
  alunos: { singular: 'aluno', plural: 'alunos' },
  professores: { singular: 'professor', plural: 'professores' },
};

type LinhaPlanilha = Record<string, string>;

export function ImportarPlanilha({
  tipo,
  aoFechar,
  aoConcluir,
}: {
  tipo: TipoImportacao;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const [colunas, setColunas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<LinhaPlanilha[] | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [conferido, setConferido] = useState<ResultadoImportacaoDTO | null>(null);
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState<'modelo' | 'conferir' | 'importar' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criadas, setCriadas] = useState<number | null>(null);

  const textos = TEXTOS[tipo];
  const comErro = conferido ? conferido.total - conferido.validas : 0;
  const podeImportar =
    conferido !== null &&
    conferido.total > 0 &&
    comErro === 0 &&
    senha.length >= SENHA_MINIMA &&
    criadas === null &&
    ocupado === null;

  async function baixarModelo() {
    setErro(null);
    setOcupado('modelo');
    try {
      const modelo = await api.get<ModeloImportacaoDTO>(`/${tipo}/importar/modelo`);
      baixarTexto(`modelo-${tipo}.csv`, gerarCsv(modelo.colunas, [modelo.exemplo]), 'text/csv;charset=utf-8');
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(null);
    }
  }

  // Trocar o arquivo zera a conferência, para que só valha o que foi conferido.
  async function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    setErro(null);
    setConferido(null);
    setCriadas(null);
    if (!arquivo) {
      setColunas([]);
      setLinhas(null);
      setNomeArquivo('');
      return;
    }
    try {
      const matriz = lerCsv(await arquivo.text());
      if (matriz.length < 2) {
        throw new Error('A planilha precisa ter o cabeçalho e pelo menos uma linha de dados.');
      }
      if (matriz.length - 1 > LIMITE_LINHAS) {
        throw new Error(
          `A planilha tem ${matriz.length - 1} linhas; o máximo por vez é ${LIMITE_LINHAS}. Divida o arquivo em partes.`,
        );
      }
      const cabecalho = matriz[0].map((c) => c.trim());
      const dados = matriz.slice(1).map((celulas) => {
        const linha: LinhaPlanilha = {};
        cabecalho.forEach((titulo, i) => {
          linha[titulo] = (celulas[i] ?? '').trim();
        });
        return linha;
      });
      setColunas(cabecalho);
      setLinhas(dados);
      setNomeArquivo(arquivo.name);
    } catch (err) {
      setColunas([]);
      setLinhas(null);
      setNomeArquivo('');
      setErro(mensagemErro(err));
    }
  }

  async function conferir() {
    if (!linhas) return;
    setErro(null);
    setCriadas(null);
    setOcupado('conferir');
    try {
      const resultado = await api.post<ResultadoImportacaoDTO>(`/${tipo}/importar`, {
        linhas,
        simular: true,
      });
      setConferido(resultado);
    } catch (err) {
      setConferido(null);
      setErro(mensagemErro(err));
    } finally {
      setOcupado(null);
    }
  }

  async function importar() {
    if (!linhas || !podeImportar) return;
    setErro(null);
    setOcupado('importar');
    try {
      const resultado = await api.post<ResultadoImportacaoDTO>(`/${tipo}/importar`, {
        linhas,
        simular: false,
        senhaInicial: senha,
      });
      setCriadas(resultado.criadas);
      setSenha('');
      aoConcluir();
    } catch (err) {
      // Relatório com erros (400): desabilita Importar e manda refazer a conferência, que lista as linhas.
      setConferido(null);
      setErro(`${mensagemErro(err)} Clique em Conferir para ver as linhas.`);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Modal aberto titulo={`Importar ${textos.plural} por planilha`} aoFechar={aoFechar}>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {criadas !== null && (
        <Aviso tipo="sucesso">
          {criadas === 1
            ? `1 ${textos.singular} criado.`
            : `${criadas} ${textos.plural} criados.`}
        </Aviso>
      )}

      <h3 className="cartao-titulo">1. Modelo</h3>
      <p className="importar-ajuda">
        Baixe o modelo, preencha uma linha por pessoa e salve como CSV (separado por ponto e vírgula).
      </p>
      <Botao
        variante="secundario"
        desabilitado={ocupado !== null}
        aoClicar={baixarModelo}
      >
        {ocupado === 'modelo' ? 'Baixando...' : 'Baixar modelo'}
      </Botao>

      <h3 className="cartao-titulo">2. Planilha</h3>
      <label className="campo">
        <span className="campo-rotulo">Arquivo .csv</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="importar-arquivo"
          disabled={ocupado !== null}
          onChange={escolherArquivo}
        />
      </label>
      {linhas && (
        <>
          <p className="importar-ajuda">
            {nomeArquivo}: {linhas.length} {linhas.length === 1 ? 'linha' : 'linhas'} de dados.
          </p>
          <div className="importar-previa">
            <table className="importar-tabela">
              <thead>
                <tr>
                  {colunas.map((c, i) => (
                    <th key={i} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, LINHAS_PREVIA).map((linha, i) => (
                  <tr key={i}>
                    {colunas.map((c, j) => (
                      <td key={j}>{linha[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {linhas.length > LINHAS_PREVIA && (
            <p className="importar-ajuda">Mostrando as {LINHAS_PREVIA} primeiras linhas.</p>
          )}
        </>
      )}

      <h3 className="cartao-titulo">3. Conferir</h3>
      <Botao
        variante="secundario"
        desabilitado={!linhas || ocupado !== null}
        aoClicar={conferir}
      >
        {ocupado === 'conferir' ? 'Conferindo...' : 'Conferir'}
      </Botao>
      {conferido && (
        <>
          <p className="importar-ajuda">
            {conferido.validas} de {conferido.total} linhas estão certas.
          </p>
          {comErro > 0 && (
            <Aviso tipo="erro">
              Corrija as linhas com erro na planilha, envie o arquivo de novo e confira outra vez.
            </Aviso>
          )}
          <ul className="importar-resultados">
            {conferido.resultados.map((r) => (
              <li key={r.linha} className="importar-resultado">
                <span className="importar-resultado-titulo">
                  <Selo cor={r.situacao === 'ERRO' ? 'vermelho' : 'verde'}>{r.situacao}</Selo>{' '}
                  Linha {r.linha}
                  {r.nome && `: ${r.nome}`}
                  {r.email && ` · ${r.email}`}
                </span>
                {r.erros.length > 0 && (
                  <ul className="importar-erros">
                    {r.erros.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="cartao-titulo">4. Importar</h3>
      <Campo
        rotulo={`Senha inicial (mínimo ${SENHA_MINIMA} caracteres)`}
        tipo="password"
        valor={senha}
        aoMudar={setSenha}
        obrigatorio
      />
      <p className="importar-ajuda">
        Esta senha inicial vale para todas as contas desta planilha. Quando o envio de e-mail estiver
        ligado, cada pessoa recebe um e-mail para criar a própria senha.
      </p>

      <div className="pagina-acoes">
        <Botao desabilitado={!podeImportar} aoClicar={importar}>
          {ocupado === 'importar' ? 'Importando...' : 'Importar'}
        </Botao>
        <Botao variante="secundario" aoClicar={aoFechar}>
          {criadas !== null ? 'Fechar' : 'Cancelar'}
        </Botao>
      </div>
    </Modal>
  );
}
