export const LADO_MAXIMO = 1600;

/**
 * Reduz a foto para no máximo 1600 px antes de subir. Economiza banda do
 * celular e mantém a chamada do modelo dentro da cota gratuita.
 */
export async function reduzirParaDataUrl(arquivo: File): Promise<string> {
  const bitmap = await criarBitmap(arquivo);

  const maior = Math.max(bitmap.width, bitmap.height);
  const escala = maior > LADO_MAXIMO ? LADO_MAXIMO / maior : 1;
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não consegui preparar a foto neste navegador.");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  if ("close" in bitmap) bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.85);
}

export function dataUrlParaBlob(dataUrl: string): Blob {
  const [cabecalho, base64] = dataUrl.split(",");
  const tipo = /:(.*?);/.exec(cabecalho ?? "")?.[1] ?? "image/jpeg";
  const binario = atob(base64 ?? "");
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

async function criarBitmap(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(arquivo);
    } catch {
      // Safari antigo: cai no <img> abaixo.
    }
  }

  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
