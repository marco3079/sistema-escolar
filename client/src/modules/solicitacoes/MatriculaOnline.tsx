import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePlataforma } from '../../lib/plataforma';
import { useDados } from '../../lib/useDados';
import { rotuloNivel } from '../../lib/tipos';
import { AreaTexto, Aviso, Botao, Campo, Carregando, Selecao, Selo, formatarMoeda } from '../../ui';
import { BotaoTema } from '../../layout/Layout';
import '../../layout/login.css';
import { EnvioDocumentos } from './EnvioDocumentos';
import type { ComprovanteDTO, MatriculaOnlineDTO, PeriodoOfertado, StatusSolicitacao } from './tipos';
import {
  COR_STATUS,
  dataValidaNaoFutura,
  idadeEm,
  REGEX_EMAIL,
  ROTULO_STATUS,
  ROTULO_TIPO,
} from './tipos';
import type { TipoSolicitacao } from './tipos';
import './solicitacoes.css';

// Partes compartilhadas pelas telas públicas (matrícula, acompanhamento) e pela secretaria.

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Moldura das telas públicas: o visual do login, com cartão mais largo (até 720 px).
export function TelaPublica({
  titulo,
  apoio,
  rodape,
  children,
}: {
  titulo: string;
  apoio?: string;
  rodape?: ReactNode;
  children?: ReactNode;
}) {
  const { plataforma, logoSrc } = usePlataforma();

  return (
    <main className="entrada solic-publica">
      <div className="entrada-tema">
        <BotaoTema />
      </div>
      <section className="entrada-formulario">
        <div className="entrada-cartao solic-cartao">
          <div className="entrada-cartao-marca">
            <img src={logoSrc} alt="" className="entrada-logo" width={56} height={56} />
            <span>{plataforma.nome}</span>
          </div>
          <h1 className="entrada-titulo">{titulo}</h1>
          {apoio && <p className="entrada-apoio">{apoio}</p>}
          {children}
          {rodape && <div className="solic-rodape">{rodape}</div>}
        </div>
      </section>
    </main>
  );
}

// Botão que copia um texto (protocolo ou chave). Sem permissão de área de transferência, avisa.
export function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [estado, setEstado] = useState<'parado' | 'copiado' | 'falhou'>('parado');

  useEffect(() => {
    if (estado === 'parado') return;
    const timer = window.setTimeout(() => setEstado('parado'), 2500);
    return () => window.clearTimeout(timer);
  }, [estado]);

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado('copiado');
    } catch {
      setEstado('falhou');
    }
  }

  const rotuloBotao = estado === 'copiado' ? 'Copiado' : estado === 'falhou' ? 'Não foi possível copiar' : 'Copiar';

  return (
    <button
      type="button"
      className="botao botao-secundario solic-copiar"
      aria-label={`Copiar ${rotulo}`}
      onClick={() => void copiar()}
    >
      {rotuloBotao}
    </button>
  );
}

export function SeloStatus({ status }: { status: StatusSolicitacao }) {
  return <Selo cor={COR_STATUS[status]}>{ROTULO_STATUS[status]}</Selo>;
}

export function SeloTipo({ tipo }: { tipo: TipoSolicitacao }) {
  return <Selo cor={tipo === 'NOVA' ? 'azul' : 'cinza'}>{ROTULO_TIPO[tipo]}</Selo>;
}

// ---------- Formulário público de matrícula ----------

interface DadosFormulario {
  cursoId: string;
  periodoLetivoId: string;
  nome: string;
  email: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  endereco: string;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelTelefone: string;
  responsavelParentesco: string;
  observacao: string;
  // Armadilha para robôs: fica escondida das pessoas e vai como veio.
  site: string;
}

const FORMULARIO_VAZIO: DadosFormulario = {
  cursoId: '',
  periodoLetivoId: '',
  nome: '',
  email: '',
  cpf: '',
  dataNascimento: '',
  telefone: '',
  endereco: '',
  responsavelNome: '',
  responsavelEmail: '',
  responsavelTelefone: '',
  responsavelParentesco: '',
  observacao: '',
  site: '',
};

// Período enviado: o único disponível, ou o escolhido quando há mais de um.
function periodoEnviado(periodos: PeriodoOfertado[], escolhido: string): number | undefined {
  if (periodos.length === 1) return periodos[0].id;
  if (periodos.length > 1 && escolhido) return Number(escolhido);
  return undefined;
}

function opcional(valor: string): string | undefined {
  const limpo = valor.trim();
  return limpo ? limpo : undefined;
}

export function MatriculaOnline() {
  const config = useDados<MatriculaOnlineDTO>('/matricula-online');
  const dados = config.dados;
  const [form, setForm] = useState<DadosFormulario>(FORMULARIO_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [comprovante, setComprovante] = useState<ComprovanteDTO | null>(null);

  function atualizar(campo: keyof DadosFormulario, valor: string): void {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  if (comprovante) {
    return (
      <TelaPublica
        titulo="Pedido recebido"
        apoio="Sua solicitação de matrícula foi registrada. Anote os dados abaixo e envie os documentos."
        rodape={<ReferenciasPublicas />}
      >
        <div className="solic-destaque">
          <span className="solic-rotulo-destaque">Protocolo</span>
          <strong className="solic-valor">{comprovante.protocolo}</strong>
          <BotaoCopiar texto={comprovante.protocolo} rotulo="o protocolo" />
        </div>
        <div className="solic-destaque">
          <span className="solic-rotulo-destaque">Chave de acompanhamento</span>
          <strong className="solic-valor solic-chave">{comprovante.chave}</strong>
          <BotaoCopiar texto={comprovante.chave} rotulo="a chave" />
        </div>
        <Aviso tipo="info">
          Guarde a chave: ela não será mostrada de novo e é necessária para acompanhar o pedido e enviar
          documentos.
        </Aviso>
        <EnvioDocumentos
          protocolo={comprovante.protocolo}
          chave={comprovante.chave}
          enviados={[]}
          aoEnviar={() => undefined}
        />
      </TelaPublica>
    );
  }

  if (config.carregando && dados === null) {
    return (
      <TelaPublica titulo="Matrícula online" rodape={<ReferenciasPublicas />}>
        <Carregando />
      </TelaPublica>
    );
  }

  if (dados === null) {
    return (
      <TelaPublica titulo="Matrícula online" rodape={<ReferenciasPublicas />}>
        <Aviso tipo="erro">{`Não foi possível carregar a matrícula online. ${config.erro ?? ''}`.trim()}</Aviso>
      </TelaPublica>
    );
  }

  if (!dados.aberta) {
    return (
      <TelaPublica titulo="Matrícula online" rodape={<ReferenciasPublicas />}>
        <Aviso tipo="info">As matrículas online estão fechadas no momento.</Aviso>
      </TelaPublica>
    );
  }

  const periodos = dados.periodos;
  const idade = idadeEm(form.dataNascimento);
  const menor = idade !== null && idade < 18;

  function validar(): string | null {
    if (!form.cursoId) return 'Escolha o curso.';
    if (periodos.length > 1 && !form.periodoLetivoId) return 'Escolha o período.';
    if (form.nome.trim().length < 3) return 'Informe o nome completo do aluno.';
    if (!REGEX_EMAIL.test(form.email.trim())) return 'Informe um e-mail válido para o aluno.';
    if (form.cpf.trim() && form.cpf.replace(/\D/g, '').length !== 11) return 'O CPF deve ter 11 números.';
    if (!dataValidaNaoFutura(form.dataNascimento)) return 'Informe a data de nascimento do aluno.';
    if (menor) {
      if (form.responsavelNome.trim().length < 3) return 'Como o aluno tem menos de 18 anos, informe o nome do responsável.';
      if (!REGEX_EMAIL.test(form.responsavelEmail.trim())) return 'Informe um e-mail válido para o responsável.';
      if (!form.responsavelTelefone.trim()) return 'Informe o telefone do responsável.';
      if (!form.responsavelParentesco.trim()) return 'Informe o parentesco do responsável com o aluno.';
    }
    return null;
  }

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErro(null);
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }

    const corpo = {
      cursoId: Number(form.cursoId),
      periodoLetivoId: periodoEnviado(periodos, form.periodoLetivoId),
      nome: form.nome.trim(),
      email: form.email.trim(),
      cpf: opcional(form.cpf),
      dataNascimento: form.dataNascimento,
      telefone: opcional(form.telefone),
      endereco: opcional(form.endereco),
      responsavelNome: menor ? form.responsavelNome.trim() : undefined,
      responsavelEmail: menor ? form.responsavelEmail.trim() : undefined,
      responsavelTelefone: menor ? form.responsavelTelefone.trim() : undefined,
      responsavelParentesco: menor ? form.responsavelParentesco.trim() : undefined,
      observacao: opcional(form.observacao),
      site: form.site,
    };

    setEnviando(true);
    try {
      const resposta = await api.post<ComprovanteDTO>('/matricula-online', corpo);
      setComprovante(resposta);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaPublica
      titulo="Matrícula online"
      apoio="Preencha o formulário para pedir a matrícula. A secretaria analisa o pedido e avisa por e-mail."
      rodape={<ReferenciasPublicas />}
    >
      {dados.texto && <div className="solic-texto">{dados.texto}</div>}

      <form className="solic-form" onSubmit={(e) => void enviar(e)} noValidate>
        <fieldset className="solic-secao">
          <legend className="solic-legenda">Curso</legend>
          {dados.cursos.length === 0 ? (
            <Aviso tipo="info">Nenhum curso está aberto para matrícula no momento.</Aviso>
          ) : (
            <Selecao
              rotulo="Curso"
              valor={form.cursoId}
              aoMudar={(v) => atualizar('cursoId', v)}
              obrigatorio
              vazio="Selecione o curso"
              opcoes={dados.cursos.map((c) => ({
                valor: String(c.id),
                rotulo: `${c.nome} · ${rotuloNivel(c.nivel)} · ${formatarMoeda(c.mensalidade)} por mês`,
              }))}
            />
          )}
          {periodos.length > 1 && (
            <Selecao
              rotulo="Período"
              valor={form.periodoLetivoId}
              aoMudar={(v) => atualizar('periodoLetivoId', v)}
              obrigatorio
              vazio="Selecione o período"
              opcoes={periodos.map((p) => ({ valor: String(p.id), rotulo: p.nome }))}
            />
          )}
        </fieldset>

        <fieldset className="solic-secao">
          <legend className="solic-legenda">Dados do aluno</legend>
          <Campo rotulo="Nome completo" valor={form.nome} aoMudar={(v) => atualizar('nome', v)} obrigatorio />
          <Campo rotulo="E-mail" tipo="email" valor={form.email} aoMudar={(v) => atualizar('email', v)} obrigatorio />
          <div className="solic-duas-colunas">
            <Campo rotulo="CPF" valor={form.cpf} aoMudar={(v) => atualizar('cpf', v)} />
            <Campo
              rotulo="Data de nascimento"
              tipo="date"
              valor={form.dataNascimento}
              aoMudar={(v) => atualizar('dataNascimento', v)}
              obrigatorio
            />
          </div>
          <Campo rotulo="Telefone" valor={form.telefone} aoMudar={(v) => atualizar('telefone', v)} />
          <AreaTexto rotulo="Endereço" valor={form.endereco} aoMudar={(v) => atualizar('endereco', v)} linhas={2} />
        </fieldset>

        {menor && (
          <fieldset className="solic-secao">
            <legend className="solic-legenda">Responsável</legend>
            <p className="solic-ajuda">O aluno tem menos de 18 anos: informe os dados do responsável.</p>
            <Campo
              rotulo="Nome do responsável"
              valor={form.responsavelNome}
              aoMudar={(v) => atualizar('responsavelNome', v)}
              obrigatorio
            />
            <Campo
              rotulo="E-mail do responsável"
              tipo="email"
              valor={form.responsavelEmail}
              aoMudar={(v) => atualizar('responsavelEmail', v)}
              obrigatorio
            />
            <div className="solic-duas-colunas">
              <Campo
                rotulo="Telefone do responsável"
                valor={form.responsavelTelefone}
                aoMudar={(v) => atualizar('responsavelTelefone', v)}
                obrigatorio
              />
              <Campo
                rotulo="Parentesco"
                valor={form.responsavelParentesco}
                aoMudar={(v) => atualizar('responsavelParentesco', v)}
                obrigatorio
              />
            </div>
          </fieldset>
        )}

        <fieldset className="solic-secao">
          <legend className="solic-legenda">Observações</legend>
          <AreaTexto
            rotulo="Observações (opcional)"
            valor={form.observacao}
            aoMudar={(v) => atualizar('observacao', v)}
            linhas={3}
          />
        </fieldset>

        {/* Armadilha para robôs: fora da tela, sem foco e sem leitura de tela. */}
        <div className="solic-armadilha" aria-hidden="true">
          <input
            type="text"
            name="site"
            tabIndex={-1}
            autoComplete="off"
            value={form.site}
            onChange={(e) => atualizar('site', e.target.value)}
          />
        </div>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="entrada-botao">
          <Botao tipo="submit" desabilitado={enviando || dados.cursos.length === 0}>
            {enviando ? 'Enviando...' : 'Enviar pedido de matrícula'}
          </Botao>
        </div>
      </form>
    </TelaPublica>
  );
}

// Links entre as telas públicas e o login.
function ReferenciasPublicas() {
  return (
    <>
      <Link to="/matricula-online/acompanhar" className="solic-link">
        Já enviei um pedido: acompanhar
      </Link>
      <Link to="/login" className="solic-link">
        Voltar para o login
      </Link>
    </>
  );
}
