import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
