export const TIPOS = [
  "nossa_senhora",
  "santo",
  "santa",
  "cristo",
  "anjo",
  "cena",
] as const;

export type Tipo = (typeof TIPOS)[number];

export const ROTULO_TIPO: Record<Tipo, string> = {
  nossa_senhora: "Nossa Senhora",
  santo: "Santo",
  santa: "Santa",
  cristo: "Cristo",
  anjo: "Anjo",
  cena: "Cena",
};

export type Certeza = "alta" | "média" | "baixa";
export type Origem = "seed" | "ia" | "comunidade";

export type Santo = {
  id: string;
  slug: string;
  nome: string;
  tipo: Tipo;
  resumo: string | null;
  sinais: string[];
  festa: string | null;
  padroeiro: string | null;
  confusao: string | null;
  origem: Origem;
  foto_capa: string | null;
  atualizado_em: string;
};

export type SantoComContagem = Santo & {
  total_scans: number;
  total_avistamentos: number;
};

export type Categoria = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
};

export type Edicao = {
  id: string;
  santo_id: string;
  autor_id: string | null;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  justificativa: string | null;
  criado_em: string;
};

export type Avistamento = {
  id: string;
  santo_id: string;
  autor_id: string;
  foto_url: string;
  local_nome: string;
  criado_em: string;
};

export type Topico = {
  id: string;
  autor_id: string;
  santo_id: string | null;
  titulo: string;
  corpo: string;
  criado_em: string;
};

export type Resposta = {
  id: string;
  topico_id: string;
  autor_id: string;
  corpo: string;
  criado_em: string;
};

/** O que /api/identificar devolve ao navegador. */
export type Identificacao = {
  eh_imagem_religiosa: boolean;
  nome: string;
  slug: string;
  tipo: Tipo;
  certeza: Certeza;
  descricao: string;
  sinais: string[];
  festa: string;
  padroeiro: string;
  confusao: string;
  alternativas: string[];
  /** Preenchido pelo servidor depois de gravar o scan. */
  santo_id?: string;
  verbete_novo?: boolean;
};

export const CAMPOS_EDITAVEIS = [
  "nome",
  "tipo",
  "resumo",
  "sinais",
  "festa",
  "padroeiro",
  "confusao",
] as const;

export type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number];

export const ROTULO_CAMPO: Record<string, string> = {
  nome: "Nome",
  tipo: "Tipo",
  resumo: "Quem é",
  sinais: "Como reconhecer",
  festa: "Festa",
  padroeiro: "Padroeiro",
  confusao: "Não confunda",
  foto_capa: "Foto de capa",
};
