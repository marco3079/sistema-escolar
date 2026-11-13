import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Aviso, Botao, Cartao, Pagina, formatarData } from '../../ui';
import './chamada.css';

interface RespostaPresenca {
  ok: boolean;
  disciplina: string;
  data: string;
}

// O envio automático do ?t= vale uma vez por carga da página (não repete em re-renderizações).
let envioAutomaticoFeito = false;

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : 'Erro inesperado';
}

export function MarcarPresenca() {
  const { usuario } = useAuth();
  const [params] = useSearchParams();
  const tokenUrl = (params.get('t') ?? '').trim();
  const ehAluno = usuario?.perfil === 'ALUNO';

  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<RespostaPresenca | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(token: string): Promise<void> {
    const limpo = token.replace(/\s/g, '');
    if (limpo === '') {
      setErro('Digite o código da chamada.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await api.post<RespostaPresenca>('/presenca-qr', { token: limpo });
      setResultado(resposta);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setEnviando(false);
    }
  }

  // Quem chega pelo QR (?t=) registra na hora, só na primeira renderização desta carga da página.
  useEffect(() => {
    if (!ehAluno || tokenUrl === '' || envioAutomaticoFeito) return;
    envioAutomaticoFeito = true;
    void enviar(tokenUrl);
  }, [ehAluno, tokenUrl]);

  function tentarDeNovo(): void {
    setErro(null);
    setResultado(null);
    setCodigo('');
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    void enviar(codigo);
  }

  if (!ehAluno) {
    return (
      <Pagina titulo="Marcar presença">
        <Cartao>
          <p>
            Esta página é usada pelos alunos para registrar presença na aula. Com este perfil o formulário não
            aparece.
          </p>
          <p>A chamada é aberta pelo professor, na aba Chamada da sala de aula da turma.</p>
        </Cartao>
      </Pagina>
    );
  }

  return (
    <Pagina titulo="Marcar presença">
      <Cartao>
        {enviando && (
          <p className="presenca-status" role="status">
            Registrando presença...
          </p>
        )}

        {resultado && (
          <Aviso tipo="sucesso">
            Presença registrada em {resultado.disciplina}
            {resultado.data && ` (${formatarData(resultado.data)})`}.
          </Aviso>
        )}

        {erro && (
          <>
            <Aviso tipo="erro">{erro}</Aviso>
            <Botao variante="secundario" aoClicar={tentarDeNovo}>
              Tentar de novo
            </Botao>
          </>
        )}

        {!enviando && !resultado && !erro && (
          <form className="presenca-form" onSubmit={aoEnviar}>
            <label className="campo">
              <span className="campo-rotulo">Código da chamada</span>
              <input
                className="campo-controle presenca-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="12-345678"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={20}
                required
              />
            </label>
            <Botao tipo="submit">Registrar presença</Botao>
          </form>
        )}
      </Cartao>
    </Pagina>
  );
}
