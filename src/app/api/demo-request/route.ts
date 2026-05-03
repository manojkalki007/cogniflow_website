import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { firstName, lastName, email, company, phone, sdrCount } = body;

  if (!firstName || !lastName || !email || !company) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("demo_requests").insert({
    first_name: firstName.slice(0, 100),
    last_name: lastName.slice(0, 100),
    email: email.slice(0, 255),
    company: company.slice(0, 200),
    phone: phone ? phone.slice(0, 30) : null,
    sdr_count: sdrCount || null,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to submit request" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
