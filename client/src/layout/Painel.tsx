import { useAuth } from '../lib/auth';
import { useDados } from '../lib/useDados';
import { Aviso, Carregando, Cartao, Grade, Pagina } from '../ui';

interface RespostaPainel {
  cartoes: { rotulo: string; valor: string | number }[];
}

export function Painel() {
  const { usuario } = useAuth();
  const { dados, carregando, erro } = useDados<RespostaPainel>('/painel');

  return (
    <Pagina titulo="Início">
      <p className="saudacao">Olá, {usuario?.nome}</p>
      {carregando && <Carregando />}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {dados && (
        <Grade>
          {dados.cartoes.map((c) => (
            <Cartao key={c.rotulo}>
              <div className="cartao-indicador-valor">{c.valor}</div>
              <div className="cartao-indicador-rotulo">{c.rotulo}</div>
            </Cartao>
          ))}
        </Grade>
      )}
    </Pagina>
  );
}
