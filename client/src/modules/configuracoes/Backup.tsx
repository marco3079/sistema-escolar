import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  Aviso,
  Botao,
  Caixa,
  Campo,
  Cartao,
  Carregando,
  MenuAcoes,
  Modal,
  Selo,
  Tabela,
  formatarDataHora,
} from '../../ui';
import type { AcaoMenu, ColunaTabela } from '../../ui';
import { mensagemErro } from '../cadastros/tipos';
import type { BackupDTO, ConfigBackupDTO } from './tipos';

// Resposta de GET /backups (contrato C).
interface ListaBackups {
  config: ConfigBackupDTO;
  itens: BackupDTO[];
  emAndamento: string | null;
}

interface FormBackup {
  backupAutomatico: boolean;
  backupHora: string;
  backupManter: string;
}

interface AvisoBackup {
  tipo: 'erro' | 'sucesso';
  texto: string;
}

// Envio: até 200 MB (contrato C).
const LIMITE_ENVIO_BYTES = 200 * 1024 * 1024;
const PALAVRA_RESTAURAR = 'RESTAURAR';
// Enquanto uma cópia ou restauração roda (inclusive iniciada por outra pessoa), relê o estado.
const INTERVALO_OCUPADO_MS = 3000;

const HORAS = Array.from({ length: 24 }, (_, h) => ({
  valor: String(h),
  rotulo: `${String(h).padStart(2, '0')}:00`,
}));

const ROTULO_ORIGEM: Record<
  BackupDTO['origem'],
  { rotulo: string; cor: 'verde' | 'amarelo' | 'azul' | 'cinza' }
> = {
  auto: { rotulo: 'Automática', cor: 'azul' },
  manual: { rotulo: 'Manual', cor: 'verde' },
  enviado: { rotulo: 'Enviada', cor: 'amarelo' },
  'pre-restauracao': { rotulo: 'Antes de restaurar', cor: 'cinza' },
};

function formDe(c: ConfigBackupDTO): FormBackup {
  return {
    backupAutomatico: c.backupAutomatico,
    backupHora: String(c.backupHora),
    backupManter: String(c.backupManter),
  };
}

function tamanhoLegivel(bytes: number): string {
  const numero = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${numero(bytes)} B`;
  if (bytes < 1024 * 1024) return `${numero(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${numero(bytes / (1024 * 1024))} MB`;
  return `${numero(bytes / (1024 * 1024 * 1024))} GB`;
}

export function Backup() {
  const { sair } = useAuth();
  const [lista, setLista] = useState<ListaBackups | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [form, setForm] = useState<FormBackup | null>(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [avisoConfig, setAvisoConfig] = useState<AvisoBackup | null>(null);

  const [aviso, setAviso] = useState<AvisoBackup | null>(null);
  const [criando, setCriando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [apagar, setApagar] = useState<BackupDTO | null>(null);
  const [apagando, setApagando] = useState(false);

  const [restaurar, setRestaurar] = useState<BackupDTO | null>(null);
  const [palavra, setPalavra] = useState('');
  const [restaurando, setRestaurando] = useState(false);
  // Nome da cópia de segurança criada antes da restauração (vazio enquanto não concluiu).
  const [copiaAnterior, setCopiaAnterior] = useState<string | null>(null);
  const [erroRestaurar, setErroRestaurar] = useState<string | null>(null);

  const carregar = useCallback(async (): Promise<void> => {
    try {
      const dados = await api.get<ListaBackups>('/backups');
      setLista(dados);
      setErroCarga(null);
      setForm((atual) => atual ?? formDe(dados.config));
    } catch (e) {
      setErroCarga(mensagemErro(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Relê o estado a cada 3 s enquanto houver operação em andamento. Depende da lista (muda a cada leitura).
  useEffect(() => {
    if (!lista || !lista.emAndamento) return;
    const timer = window.setTimeout(() => void carregar(), INTERVALO_OCUPADO_MS);
    return () => window.clearTimeout(timer);
  }, [lista, carregar]);

  const ocupado = criando || enviando || (lista !== null && lista.emAndamento !== null);

  function mudarForm(parcial: Partial<FormBackup>) {
    setForm((atual) => (atual ? { ...atual, ...parcial } : atual));
  }

  async function salvarConfig() {
    if (!form) return;
    setAvisoConfig(null);
    const hora = Number(form.backupHora);
    const manter = Number(form.backupManter);
    if (!Number.isInteger(manter) || manter < 1 || manter > 60) {
      setAvisoConfig({ tipo: 'erro', texto: 'Quantas guardar deve ser um número de 1 a 60.' });
      return;
    }
    setSalvandoConfig(true);
    try {
      const novo = await api.put<ConfigBackupDTO>('/backups/configuracao', {
        backupAutomatico: form.backupAutomatico,
        backupHora: hora,
        backupManter: manter,
      });
      setLista((atual) => (atual ? { ...atual, config: novo } : atual));
      setForm(formDe(novo));
      setAvisoConfig({ tipo: 'sucesso', texto: 'Configuração da cópia automática salva.' });
    } catch (e) {
      setAvisoConfig({ tipo: 'erro', texto: mensagemErro(e) });
    } finally {
      setSalvandoConfig(false);
    }
  }

  async function criarCopia() {
    setAviso(null);
    setCriando(true);
    try {
      const nova = await api.post<BackupDTO>('/backups');
      setAviso({ tipo: 'sucesso', texto: `Cópia criada: ${nova.nome}.` });
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemErro(e) });
    } finally {
      setCriando(false);
      await carregar();
    }
  }

  async function enviarCopia(arquivo: File) {
    setAviso(null);
    setEnviando(true);
    try {
      const nova = await api.enviarArquivo<BackupDTO>('/backups/enviar', arquivo, 'application/gzip');
      setAviso({ tipo: 'sucesso', texto: `Arquivo enviado e guardado como ${nova.nome}.` });
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemErro(e) });
    } finally {
      setEnviando(false);
      await carregar();
    }
  }

  function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    // Limpa a escolha para que o mesmo arquivo possa ser escolhido de novo depois.
    e.target.value = '';
    if (!arquivo) return;
    if (!arquivo.name.toLowerCase().endsWith('.sql.gz')) {
      setAviso({ tipo: 'erro', texto: 'Escolha um arquivo .sql.gz gerado por uma cópia de segurança.' });
      return;
    }
    if (arquivo.size > LIMITE_ENVIO_BYTES) {
      setAviso({ tipo: 'erro', texto: 'O arquivo passa do limite de 200 MB.' });
      return;
    }
    void enviarCopia(arquivo);
  }

  async function baixar(b: BackupDTO) {
    setAviso(null);
    try {
      await api.baixar(`/backups/${encodeURIComponent(b.nome)}`, b.nome);
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemErro(e) });
    }
  }

  async function confirmarApagar() {
    if (!apagar) return;
    setApagando(true);
    try {
      await api.del(`/backups/${encodeURIComponent(apagar.nome)}`);
      setAviso({ tipo: 'sucesso', texto: `Cópia ${apagar.nome} apagada.` });
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemErro(e) });
    } finally {
      setApagando(false);
      setApagar(null);
      await carregar();
    }
  }

  function abrirRestaurar(b: BackupDTO) {
    setPalavra('');
    setErroRestaurar(null);
    setCopiaAnterior(null);
    setRestaurar(b);
  }

  // Enquanto a restauração roda, ou depois de concluída (só sai pelo botão de login), não fecha.
  function fecharRestaurar() {
    if (restaurando || copiaAnterior !== null) return;
    setRestaurar(null);
  }

  async function confirmarRestaurar() {
    if (!restaurar || palavra !== PALAVRA_RESTAURAR) return;
    setRestaurando(true);
    setErroRestaurar(null);
    try {
      const resposta = await api.post<{ restaurado: boolean; copiaAnterior: string }>(
        `/backups/${encodeURIComponent(restaurar.nome)}/restaurar`,
        { confirmacao: PALAVRA_RESTAURAR },
      );
      // Sem recarregar a lista: a sessão pode ter deixado de valer com a restauração.
      setCopiaAnterior(resposta.copiaAnterior);
    } catch (e) {
      setErroRestaurar(mensagemErro(e));
    } finally {
      setRestaurando(false);
    }
  }

  function irParaLogin() {
    sair();
    window.location.assign('/login');
  }

  function acoesDe(b: BackupDTO): AcaoMenu[] {
    return [
      { rotulo: 'Baixar', icone: 'seta-baixo', aoClicar: () => void baixar(b) },
      { rotulo: 'Restaurar', icone: 'responder', aoClicar: () => abrirRestaurar(b) },
      { rotulo: 'Apagar', icone: 'lixeira', perigo: true, aoClicar: () => setApagar(b) },
    ];
  }

  const colunas: ColunaTabela<BackupDTO>[] = [
    {
      titulo: 'Data',
      celula: (b) => (
        <>
          <span>{formatarDataHora(b.criadoEm) || '—'}</span>
          <span className="config-ajuda-campo config-backup-nome">{b.nome}</span>
        </>
      ),
    },
    {
      titulo: 'Origem',
      celula: (b) => (
        <Selo cor={ROTULO_ORIGEM[b.origem].cor}>{ROTULO_ORIGEM[b.origem].rotulo}</Selo>
      ),
    },
    { titulo: 'Tamanho', alinhar: 'direita', celula: (b) => tamanhoLegivel(b.tamanho) },
    {
      titulo: 'Ações',
      acoes: true,
      celula: (b) => <MenuAcoes rotulo={`Ações da cópia ${b.nome}`} acoes={acoesDe(b)} />,
    },
  ];

  if (lista === null || form === null) {
    return erroCarga ? <Aviso tipo="erro">{erroCarga}</Aviso> : <Carregando />;
  }

  return (
    <div className="config-backup">
      <Cartao titulo="Cópia automática">
        {!lista.config.ferramentasOk && (
          <Aviso tipo="erro">
            As ferramentas de cópia (PostgreSQL 16) não estão disponíveis neste servidor. Sem elas
            não é possível criar, enviar nem restaurar cópias.
          </Aviso>
        )}
        <Caixa
          rotulo="Cópia automática diária ligada"
          marcado={form.backupAutomatico}
          aoMudar={(backupAutomatico) => mudarForm({ backupAutomatico })}
        />
        <div className="config-backup-linha">
          <label className="campo">
            <span className="campo-rotulo">Hora</span>
            <select
              className="campo-controle"
              value={form.backupHora}
              onChange={(e) => mudarForm({ backupHora: e.target.value })}
            >
              {HORAS.map((h) => (
                <option key={h.valor} value={h.valor}>
                  {h.rotulo}
                </option>
              ))}
            </select>
          </label>
          <Campo
            rotulo="Quantas guardar (1 a 60)"
            tipo="number"
            valor={form.backupManter}
            aoMudar={(backupManter) => mudarForm({ backupManter })}
          />
          <Botao desabilitado={salvandoConfig} aoClicar={() => void salvarConfig()}>
            {salvandoConfig ? 'Salvando...' : 'Salvar'}
          </Botao>
        </div>
        <p className="config-ajuda-campo">
          {lista.config.ultimoAutomatico
            ? `Última cópia automática: ${formatarDataHora(lista.config.ultimoAutomatico) || '—'}`
            : 'Nenhuma cópia automática ainda.'}
        </p>
        <p className="config-ajuda-campo">
          Depois de cada cópia automática, as mais antigas além de "Quantas guardar" são apagadas.
          Cópias manuais e enviadas não são apagadas sozinhas.
        </p>
        {avisoConfig && <Aviso tipo={avisoConfig.tipo}>{avisoConfig.texto}</Aviso>}
      </Cartao>

      <Cartao titulo="Cópias">
        {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
        {erroCarga && <Aviso tipo="erro">{erroCarga}</Aviso>}
        {lista.emAndamento && (
          <Aviso tipo="info">
            {lista.emAndamento === 'restauracao'
              ? 'Restauração em andamento...'
              : 'Criando uma cópia...'}
          </Aviso>
        )}
        <div className="config-backup-acoes">
          <Botao desabilitado={ocupado} aoClicar={() => void criarCopia()}>
            {criando ? 'Criando...' : 'Criar cópia agora'}
          </Botao>
          <Botao
            variante="secundario"
            desabilitado={ocupado}
            aoClicar={() => arquivoRef.current?.click()}
          >
            {enviando ? 'Enviando...' : 'Enviar arquivo de cópia'}
          </Botao>
          <input
            ref={arquivoRef}
            type="file"
            accept=".gz,.sql.gz,application/gzip"
            hidden
            onChange={escolherArquivo}
          />
        </div>
        <Tabela
          colunas={colunas}
          dados={lista.itens}
          chave={(b) => b.nome}
          vazio="Nenhuma cópia guardada ainda."
        />
        <p className="config-ajuda-campo">
          As cópias contêm todos os dados do sistema. Guarde os arquivos baixados em lugar seguro.
        </p>
      </Cartao>

      <Modal
        aberto={apagar !== null}
        titulo="Apagar cópia?"
        aoFechar={() => {
          if (!apagando) setApagar(null);
        }}
      >
        <p>
          A cópia <strong>{apagar?.nome}</strong> será apagada do servidor. Não dá para desfazer.
        </p>
        <div className="config-backup-acoes-modal">
          <Botao variante="secundario" desabilitado={apagando} aoClicar={() => setApagar(null)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" desabilitado={apagando} aoClicar={() => void confirmarApagar()}>
            {apagando ? 'Apagando...' : 'Apagar'}
          </Botao>
        </div>
      </Modal>

      <Modal aberto={restaurar !== null} titulo="Restaurar o banco?" aoFechar={fecharRestaurar}>
        {copiaAnterior === null ? (
          <>
            <Aviso tipo="erro">
              Isto substitui todos os dados atuais, inclusive usuários e senhas, pelos dados desta
              cópia. Uma cópia do estado atual é feita antes.
            </Aviso>
            <p>
              Cópia escolhida: <strong>{restaurar?.nome}</strong>
            </p>
            <Campo
              rotulo={`Digite ${PALAVRA_RESTAURAR} para confirmar`}
              valor={palavra}
              aoMudar={setPalavra}
            />
            {erroRestaurar && <Aviso tipo="erro">{erroRestaurar}</Aviso>}
            <div className="config-backup-acoes-modal">
              <Botao variante="secundario" desabilitado={restaurando} aoClicar={fecharRestaurar}>
                Cancelar
              </Botao>
              <Botao
                variante="perigo"
                desabilitado={restaurando || palavra !== PALAVRA_RESTAURAR}
                aoClicar={() => void confirmarRestaurar()}
              >
                {restaurando ? 'Restaurando...' : 'Restaurar'}
              </Botao>
            </div>
          </>
        ) : (
          <>
            <Aviso tipo="sucesso">
              Banco restaurado. O estado anterior ficou guardado como {copiaAnterior}.
            </Aviso>
            <p>É preciso entrar de novo no sistema.</p>
            <div className="config-backup-acoes-modal">
              <Botao aoClicar={irParaLogin}>Ir para o login</Botao>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
