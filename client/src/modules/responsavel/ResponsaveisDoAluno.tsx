import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import {
  Aviso,
  Botao,
  Caixa,
  Campo,
  Carregando,
  MenuAcoes,
  Modal,
  Selecao,
  Selo,
  Tabela,
} from '../../ui';
import type { ResultadoVinculo, VinculoResponsavel } from './tipos';
import { PARENTESCOS, mensagemDeErro } from './tipos';
import './responsavel.css';

// Gestão dos responsáveis de um aluno (usada na ficha do aluno).
export function ResponsaveisDoAluno({ alunoId }: { alunoId: number }) {
  const { dados, carregando, erro, recarregar } = useDados<VinculoResponsavel[]>(`/alunos/${alunoId}/responsaveis`);
  const [incluindo, setIncluindo] = useState(false);
  const [editando, setEditando] = useState<VinculoResponsavel | null>(null);
  const [resultado, setResultado] = useState<ResultadoVinculo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function remover(v: VinculoResponsavel) {
    if (!window.confirm(`Remover ${v.nome} da lista de responsáveis deste aluno? A conta dele continua existindo.`)) {
      return;
    }
    setAviso(null);
    setErroAcao(null);
    try {
      await api.del(`/responsaveis/vinculos/${v.vinculoId}`);
      setAviso('Responsável removido.');
      recarregar();
    } catch (e) {
      setErroAcao(mensagemDeErro(e));
    }
  }

  return (
    <div className="resp-visao">
      <div className="resp-acoes">
        <Botao
          aoClicar={() => {
            setResultado(null);
            setAviso(null);
            setErroAcao(null);
            setIncluindo(true);
          }}
        >
          Incluir responsável
        </Botao>
      </div>

      {resultado && <AvisoInclusao resultado={resultado} aoFechar={() => setResultado(null)} />}
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}
      {carregando && !dados && <Carregando />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {dados && (
        <Tabela
          dados={dados}
          chave={(v) => v.vinculoId}
          vazio="Nenhum responsável ligado a este aluno."
          colunas={[
            { titulo: 'Nome', celula: (v: VinculoResponsavel) => <strong>{v.nome}</strong> },
            { titulo: 'E-mail', celula: (v: VinculoResponsavel) => v.email },
            { titulo: 'Telefone', celula: (v: VinculoResponsavel) => v.telefone ?? '—' },
            { titulo: 'Parentesco', celula: (v: VinculoResponsavel) => v.parentesco },
            {
              titulo: 'Financeiro',
              celula: (v: VinculoResponsavel) =>
                v.financeiro ? <Selo cor="verde">Vê</Selo> : <Selo cor="cinza">Não vê</Selo>,
            },
            {
              titulo: 'Conta',
              celula: (v: VinculoResponsavel) =>
                v.ativo ? <Selo cor="azul">Ativa</Selo> : <Selo cor="cinza">Inativa</Selo>,
            },
            {
              titulo: 'Ações',
              acoes: true,
              celula: (v: VinculoResponsavel) => (
                <MenuAcoes
                  rotulo={`Ações do responsável ${v.nome}`}
                  acoes={[
                    { rotulo: 'Editar parentesco e financeiro', aoClicar: () => setEditando(v) },
                    { rotulo: 'Remover', perigo: true, aoClicar: () => remover(v) },
                  ]}
                />
              ),
            },
          ]}
        />
      )}

      {incluindo && (
        <FormInclusao
          alunoId={alunoId}
          aoFechar={() => setIncluindo(false)}
          aoSalvo={(r) => {
            setIncluindo(false);
            setResultado(r);
            recarregar();
          }}
        />
      )}

      {editando && (
        <FormEdicao
          vinculo={editando}
          aoFechar={() => setEditando(null)}
          aoSalvo={() => {
            setEditando(null);
            setAviso('Responsável atualizado.');
            recarregar();
          }}
        />
      )}
    </div>
  );
}

// Aviso depois de incluir: a senha inicial aparece uma única vez.
function AvisoInclusao({ resultado, aoFechar }: { resultado: ResultadoVinculo; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const [falhaCopia, setFalhaCopia] = useState(false);

  async function copiar() {
    if (!resultado.senhaInicial) return;
    try {
      await navigator.clipboard.writeText(resultado.senhaInicial);
      setCopiado(true);
      setFalhaCopia(false);
    } catch {
      setFalhaCopia(true);
    }
  }

  return (
    <div className="aviso aviso-sucesso resp-senha" role="status">
      <p className="resp-senha-aviso">Responsável incluído.</p>

      {resultado.senhaInicial && (
        <>
          <p className="resp-senha-aviso">Senha inicial do responsável:</p>
          <code className="resp-senha-valor">{resultado.senhaInicial}</code>
          <div className="resp-acoes">
            <Botao variante="secundario" aoClicar={copiar}>
              {copiado ? 'Copiada' : 'Copiar senha'}
            </Botao>
          </div>
          {falhaCopia && <Aviso tipo="erro">Não foi possível copiar. Selecione a senha e copie manualmente.</Aviso>}
          <p className="resp-senha-aviso">Anote: ela não será mostrada de novo.</p>
        </>
      )}

      {resultado.conviteEnviado && <p className="resp-senha-aviso">Enviamos um e-mail para o responsável criar a senha.</p>}

      {!resultado.usuarioCriado && !resultado.senhaInicial && (
        <p className="resp-senha-aviso">O e-mail já era de um responsável cadastrado, e ele foi ligado a este aluno.</p>
      )}

      <div className="resp-acoes">
        <Botao variante="texto" aoClicar={aoFechar}>
          Entendi
        </Botao>
      </div>
    </div>
  );
}

// Formulário de inclusão: nome, e-mail, telefone, CPF, parentesco e financeiro.
function FormInclusao({
  alunoId,
  aoFechar,
  aoSalvo,
}: {
  alunoId: number;
  aoFechar: () => void;
  aoSalvo: (resultado: ResultadoVinculo) => void;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [financeiro, setFinanceiro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) return setErro('Informe o nome do responsável.');
    if (!email.trim()) return setErro('Informe o e-mail do responsável.');
    if (!parentesco) return setErro('Escolha o parentesco.');

    setEnviando(true);
    try {
      const resultado = await api.post<ResultadoVinculo>(`/alunos/${alunoId}/responsaveis`, {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim() || null,
        cpf: cpf.trim() || null,
        parentesco,
        financeiro,
      });
      aoSalvo(resultado);
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  return (
    <Modal aberto titulo="Incluir responsável" aoFechar={aoFechar}>
      <form className="resp-formulario" onSubmit={enviar}>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Campo rotulo="Nome" valor={nome} aoMudar={setNome} obrigatorio />
        <Campo rotulo="E-mail" tipo="email" valor={email} aoMudar={setEmail} obrigatorio />
        <Campo rotulo="Telefone" tipo="text" valor={telefone} aoMudar={setTelefone} />
        <Campo rotulo="CPF" valor={cpf} aoMudar={setCpf} />
        <Selecao
          rotulo="Parentesco"
          valor={parentesco}
          aoMudar={setParentesco}
          opcoes={PARENTESCOS.map((p) => ({ valor: p, rotulo: p }))}
          obrigatorio
        />
        <Caixa rotulo="Pode ver o financeiro" marcado={financeiro} aoMudar={setFinanceiro} />
        <div className="resp-acoes">
          <Botao tipo="submit" desabilitado={enviando}>
            Incluir
          </Botao>
          <Botao variante="secundario" aoClicar={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

// Edição do parentesco e da permissão do financeiro.
function FormEdicao({
  vinculo,
  aoFechar,
  aoSalvo,
}: {
  vinculo: VinculoResponsavel;
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  const [parentesco, setParentesco] = useState(PARENTESCOS.includes(vinculo.parentesco) ? vinculo.parentesco : '');
  const [financeiro, setFinanceiro] = useState(vinculo.financeiro);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!parentesco) return setErro('Escolha o parentesco.');
    setEnviando(true);
    try {
      await api.put(`/responsaveis/vinculos/${vinculo.vinculoId}`, { parentesco, financeiro });
      aoSalvo();
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  return (
    <Modal aberto titulo="Editar responsável" aoFechar={aoFechar}>
      <form className="resp-formulario" onSubmit={enviar}>
        <p className="resp-suave">{vinculo.nome}</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Selecao
          rotulo="Parentesco"
          valor={parentesco}
          aoMudar={setParentesco}
          opcoes={PARENTESCOS.map((p) => ({ valor: p, rotulo: p }))}
          obrigatorio
        />
        <Caixa rotulo="Pode ver o financeiro" marcado={financeiro} aoMudar={setFinanceiro} />
        <div className="resp-acoes">
          <Botao tipo="submit" desabilitado={enviando}>
            Salvar
          </Botao>
          <Botao variante="secundario" aoClicar={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
