import { formatarData } from '../../ui';
import type { PublicoComunicado } from './tipos';

// Auxiliares visuais da caixa de avisos (sem chamadas à API).

export type CorAvatar = 'azul' | 'roxo' | 'verde' | 'laranja';
export type CorSelo = 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza';

const CORES_AVATAR: CorAvatar[] = ['azul', 'roxo', 'verde', 'laranja'];

// Cores alternam pela posição na lista (as quatro do tema).
export function corDoAvatar(posicao: number): CorAvatar {
  return CORES_AVATAR[posicao % CORES_AVATAR.length];
}

// Iniciais: primeira letra do primeiro e do último nome.
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (primeira + ultima).toUpperCase();
}

// Tempo relativo: "agora", "há 5 min", "há 2 h", "há 3 dias"; acima de 30 dias, a data.
export function tempoRelativo(iso: string, agora: number = Date.now()): string {
  const quando = new Date(iso).getTime();
  if (Number.isNaN(quando)) return '';

  const minutos = Math.floor((agora - quando) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias <= 30) return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;

  return formatarData(iso);
}

// Prévia de uma linha: quebras e espaços viram um único espaço.
export function previa(corpo: string): string {
  return corpo.replace(/\s+/g, ' ').trim();
}

export function corDoPublico(publico: PublicoComunicado): CorSelo {
  switch (publico) {
    case 'TODOS':
      return 'azul';
    case 'ALUNOS':
      return 'verde';
    case 'PROFESSORES':
      return 'amarelo';
    default:
      return 'cinza';
  }
}
