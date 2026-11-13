import { useState } from 'react';
import { api } from '../../lib/api';
import type { ArquivoDTO } from '../../lib/arquivos';
import { useDados } from '../../lib/useDados';
import { AreaTexto, Aviso, Botao, Campo, Carregando, formatarData, MenuAcoes, Modal } from '../../ui';
import type { AcaoMenu } from '../../ui';
import { CampoArquivos, ListaArquivos } from '../../ui/Arquivos';
import type { PropsAba } from './comum';
import './sala.css';

export interface MaterialDTO {
  id: number;
  titulo: string;
  descricao: string;
  topico: string;
  link: string | null;
  criadoEm: string;
  autor: { nome: string };
  arquivos: ArquivoDTO[];
}

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

// Só http ou https vira link clicável; qualquer outro valor fica como texto.
function linkSeguro(l: string | null): string | null {
  return l !== null && /^https?:\/\//i.test(l.trim()) ? l.trim() : null;
}

// Agrupa por tópico mantendo a ordem que a API já trouxe (por tópico e depois por data).
function agruparPorTopico(lista: MaterialDTO[]): { topico: string; itens: MaterialDTO[] }[] {
  const mapa = new Map<string, MaterialDTO[]>();
  for (const m of lista) {
    const topico = m.topico.trim();
    const grupo = mapa.get(topico);
    if (grupo) grupo.push(m);
    else mapa.set(topico, [m]);
  }
  return Array.from(mapa.entries()).map(([topico, itens]) => ({ topico, itens }));
}

export function Materiais({ turmaId, podeEditar }: PropsAba) {
  const { dados, carregando, erro, recarregar } = useDados<MaterialDTO[]>(
    `/salas/${turmaId}/materiais`,
  );
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<MaterialDTO | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  function fecharForm() {
    setNovo(false);
    setEditando(null);
  }

  async function excluir(m: MaterialDTO) {
    if (!window.confirm(`Excluir o material "${m.titulo}"? Os arquivos anexados também serão apagados.`)) {
      return;
    }
    setErroAcao(null);
    try {
      await api.del(`/materiais/${m.id}`);
      recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  function acoesDoMaterial(m: MaterialDTO): AcaoMenu[] {
    return [
      { rotulo: 'Editar', icone: 'lapis', aoClicar: () => setEditando(m) },
      { rotulo: 'Excluir', icone: 'lixeira', perigo: true, aoClicar: () => void excluir(m) },
    ];
  }

  if (carregando) return <Carregando />;

  const grupos = agruparPorTopico(dados ?? []);

  return (
    <section className="sala-secao">
      {podeEditar && (
        <div className="sala-barra">
          <Botao aoClicar={() => setNovo(true)}>Novo material</Botao>
        </div>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {erroAcao && <Aviso tipo="erro">{erroAcao}</Aviso>}

      {grupos.length === 0 ? (
        <p className="tabela-vazia">Nenhum material publicado ainda.</p>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.topico || '__sem_topico'} className="sala-grupo">
            <h2 className="sala-grupo-titulo">{grupo.topico || 'Sem tópico'}</h2>
            <ul className="sala-lista">
              {grupo.itens.map((m) => (
                <li key={m.id} className="sala-material">
                  <div className="sala-material-topo">
                    <div className="sala-material-texto">
                      <h3 className="sala-material-titulo">{m.titulo}</h3>
                      <p className="sala-texto-suave">
                        {m.autor.nome} · {formatarData(m.criadoEm)}
                      </p>
                    </div>
                    {podeEditar && (
                      <MenuAcoes
                        rotulo={`Ações do material ${m.titulo}`}
                        acoes={acoesDoMaterial(m)}
                      />
                    )}
                  </div>
                  {m.descricao && <p className="sala-quebra">{m.descricao}</p>}
                  {m.link && linkSeguro(m.link) !== null && (
                    <a
                      className="sala-link"
                      href={linkSeguro(m.link) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {m.link}
                    </a>
                  )}
                  {m.link && linkSeguro(m.link) === null && (
                    <span className="sala-link">{m.link}</span>
                  )}
                  {m.arquivos.length > 0 && <ListaArquivos arquivos={m.arquivos} />}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Modal
        aberto={novo || editando !== null}
        titulo={editando ? 'Editar material' : 'Novo material'}
        aoFechar={fecharForm}
      >
        <FormMaterial
          turmaId={turmaId}
          material={editando}
          aoSalvar={() => {
            fecharForm();
            recarregar();
          }}
          aoCancelar={fecharForm}
        />
      </Modal>
    </section>
  );
}

// ---------- Formulário de material ----------

function FormMaterial({
  turmaId,
  material,
  aoSalvar,
  aoCancelar,
}: {
  turmaId: number;
  material: MaterialDTO | null;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(material?.titulo ?? '');
  const [descricao, setDescricao] = useState(material?.descricao ?? '');
  const [topico, setTopico] = useState(material?.topico ?? '');
  const [link, setLink] = useState(material?.link ?? '');
  const [arquivos, setArquivos] = useState<ArquivoDTO[]>(material?.arquivos ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    const tituloLimpo = titulo.trim();
    const linkLimpo = link.trim();
    if (tituloLimpo.length < 2) {
      setErro('O título precisa ter pelo menos 2 caracteres.');
      return;
    }
    if (!linkLimpo && arquivos.length === 0 && !descricao.trim()) {
      setErro('Informe um link, um arquivo ou uma descrição.');
      return;
    }
    const corpo = {
      titulo: tituloLimpo,
      descricao: descricao.trim(),
      topico: topico.trim(),
      link: linkLimpo || null,
      arquivoIds: arquivos.map((a) => a.id),
    };
    setSalvando(true);
    try {
      if (material) {
        await api.put(`/materiais/${material.id}`, corpo);
      } else {
        await api.post(`/salas/${turmaId}/materiais`, corpo);
      }
      aoSalvar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} obrigatorio />
      <Campo rotulo="Tópico (agrupa os materiais)" valor={topico} aoMudar={setTopico} />
      <AreaTexto rotulo="Descrição" valor={descricao} aoMudar={setDescricao} linhas={4} />
      <Campo rotulo="Link (opcional, http ou https)" valor={link} aoMudar={setLink} tipo="text" />
      <div className="campo">
        <span className="campo-rotulo">Arquivos (até 10)</span>
        <CampoArquivos valor={arquivos} aoMudar={setArquivos} maximo={10} desabilitado={salvando} />
      </div>
      <div className="sala-acoes-form">
        <Botao tipo="submit" desabilitado={salvando}>
          Salvar
        </Botao>
        <Botao variante="secundario" aoClicar={aoCancelar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
