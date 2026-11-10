import { useState } from 'react';
import { api } from '../../lib/api';
import { useDados } from '../../lib/useDados';
import type { RotaModulo } from '../../lib/rotas';
import { rotuloNivel } from '../../lib/tipos';
import { Aviso, Botao, Cartao, Carregando, Grade, Pagina, Selecao, Tabela } from '../../ui';
import {
  BlocoInscrever,
  InscricaoDTO,
  MatriculaDetalhe,
  MatriculaDTO,
  mensagemErro,
  opcoesPeriodos,
  Periodo,
  SeloInscricao,
  SeloMatricula,
} from './comum';

// ---------- Minha matrícula (portal do aluno) ----------

function MinhaMatricula() {
  const [periodoId, setPeriodoId] = useState('');
  const lista = useDados<MatriculaDTO[]>('/matriculas/minhas');
  const periodos = useDados<Periodo[]>('/periodos-letivos');

  if (lista.carregando && !lista.dados) return <Carregando />;

  return (
    <Pagina titulo="Minha matrícula">
      {lista.erro && <Aviso tipo="erro">{lista.erro}</Aviso>}
      {lista.dados && lista.dados.length === 0 && <p>Você ainda não tem matrícula.</p>}
      <Selecao
        rotulo="Inscrições do período"
        valor={periodoId}
        aoMudar={setPeriodoId}
        opcoes={opcoesPeriodos(periodos.dados ?? [])}
        vazio="Todos os períodos"
      />
      <Grade>
        {(lista.dados ?? []).map((m) => (
          <CartaoMatricula key={m.id} matricula={m} periodoId={periodoId} periodos={periodos.dados ?? []} />
        ))}
      </Grade>
    </Pagina>
  );
}

function CartaoMatricula({
  matricula,
  periodoId,
  periodos,
}: {
  matricula: MatriculaDTO;
  periodoId: string;
  periodos: Periodo[];
}) {
  const det = useDados<MatriculaDetalhe>(`/matriculas/${matricula.id}`);
  const [erro, setErro] = useState<string | null>(null);

  const creditos = matricula.curso.regime === 'CREDITOS';
  const ativa = matricula.status === 'ATIVA';
  const podeCancelar = creditos && ativa;

  const inscricoes = (det.dados?.inscricoes ?? []).filter(
    (i) => periodoId === '' || String(i.turma.periodoLetivo.id) === periodoId,
  );

  async function cancelar(i: InscricaoDTO): Promise<void> {
    setErro(null);
    try {
      await api.del(`/inscricoes/${i.id}`);
      det.recarregar();
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  const colunas = [
    { titulo: 'Disciplina', celula: (i: InscricaoDTO) => i.turma.disciplina.nome },
    { titulo: 'Turma', celula: (i: InscricaoDTO) => i.turma.codigo },
    { titulo: 'Período', celula: (i: InscricaoDTO) => i.turma.periodoLetivo.nome },
    { titulo: 'Situação', celula: (i: InscricaoDTO) => <SeloInscricao status={i.status} /> },
    { titulo: 'Nota', celula: (i: InscricaoDTO) => (i.notaFinal === null ? '-' : i.notaFinal) },
    {
      titulo: 'Frequência',
      celula: (i: InscricaoDTO) => (i.frequencia === null ? '-' : `${i.frequencia}%`),
    },
    ...(podeCancelar
      ? [
          {
            titulo: 'Ação',
            celula: (i: InscricaoDTO) =>
              i.status === 'CURSANDO' ? (
                <Botao variante="perigo" aoClicar={() => void cancelar(i)}>
                  Cancelar inscrição
                </Botao>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <Cartao titulo={matricula.curso.nome}>
      <p>
        {rotuloNivel(matricula.curso.nivel)} · Série {matricula.serieAtual}
      </p>
      <p>
        Status: <SeloMatricula status={matricula.status} />
      </p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {det.erro && <Aviso tipo="erro">{det.erro}</Aviso>}
      {det.carregando && !det.dados ? (
        <Carregando />
      ) : (
        <Tabela<InscricaoDTO>
          dados={inscricoes}
          chave={(i) => i.id}
          vazio="Nenhuma inscrição neste período."
          colunas={colunas}
        />
      )}
      {creditos && ativa && (
        <BlocoInscrever
          matriculaId={matricula.id}
          periodos={periodos}
          aoInscrever={() => det.recarregar()}
        />
      )}
    </Cartao>
  );
}

export const rotasAluno: RotaModulo[] = [
  {
    caminho: '/aluno/matricula',
    rotulo: 'Matrícula',
    icone: '📝',
    perfis: ['ALUNO'],
    elemento: <MinhaMatricula />,
    ordem: 30,
  },
];
