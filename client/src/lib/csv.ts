// Planilhas em CSV: gera (exportação) e lê (importação).
// Padrão: separador ";", UTF-8 com BOM (abre direto no Excel em português), quebra de linha CRLF.

const BOM = '﻿';

// Coloca a célula entre aspas quando ela tem separador, aspas ou quebra de linha; dobra as aspas internas.
// Antes disso, neutraliza fórmulas: valor que começa com = + - @ TAB ou CR (e não é número simples) ganha apóstrofo.
function escapar(valor: string): string {
  const seguro =
    /^[=+\-@\t\r]/.test(valor) && !/^[-+]?\d+([.,]\d+)?$/.test(valor) ? `'${valor}` : valor;
  if (/[";\r\n]/.test(seguro)) {
    return `"${seguro.replace(/"/g, '""')}"`;
  }
  return seguro;
}

// Monta o texto CSV com o cabeçalho e as linhas dadas.
export function gerarCsv(cabecalho: string[], linhas: string[][]): string {
  const todas = [cabecalho, ...linhas];
  return BOM + todas.map((linha) => linha.map(escapar).join(';')).join('\r\n');
}

// Cria um arquivo com o conteúdo e dispara o download no navegador.
export function baixarTexto(nomeArquivo: string, conteudo: string, tipo = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dá tempo para o navegador iniciar o download antes de liberar o endereço.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Descobre o separador olhando a primeira linha (fora das aspas): ";" ou ",". Sem nenhum, usa ";".
function detectarSeparador(texto: string): string {
  let aspas = false;
  let pontoVirgula = 0;
  let virgula = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      aspas = !aspas;
    } else if (!aspas && (c === '\n' || c === '\r')) {
      break;
    } else if (!aspas && c === ';') {
      pontoVirgula++;
    } else if (!aspas && c === ',') {
      virgula++;
    }
  }
  return virgula > pontoVirgula ? ',' : ';';
}

// Lê o texto de um CSV: aspas (inclusive "" dentro de aspas), quebras de linha dentro de aspas e BOM.
// Linhas vazias (sem nenhum valor preenchido) são ignoradas. Os valores não são aparados.
export function lerCsv(texto: string): string[][] {
  const limpo = texto.startsWith(BOM) ? texto.slice(1) : texto;
  const separador = detectarSeparador(limpo);

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;

  function fecharCampo(): void {
    linha.push(campo);
    campo = '';
  }

  function fecharLinha(): void {
    fecharCampo();
    if (linha.some((v) => v.trim() !== '')) linhas.push(linha);
    linha = [];
  }

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          aspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === separador) {
      fecharCampo();
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && limpo[i + 1] === '\n') i++;
      fecharLinha();
    } else {
      campo += c;
    }
  }

  // Última linha sem quebra no fim do texto.
  if (campo !== '' || linha.length > 0) fecharLinha();

  return linhas;
}
