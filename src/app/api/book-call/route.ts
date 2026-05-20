import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, company, phone } = body;

  if (!name || !email) {
    return NextResponse.json(
      { error: "Name and email are required" },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 }
    );
  }

  const { data, error } = await getSupabase()
    .from("call_bookings")
    .insert({
      name: name.slice(0, 200),
      email: email.slice(0, 255),
      company: company ? company.slice(0, 200) : null,
      phone: phone ? phone.slice(0, 30) : null,
      source: "website",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to save booking" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: data.id });
}
