import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-cal-signature-256") || "";
  const secret = process.env.CAL_WEBHOOK_SECRET || "";

  if (!secret) {
    console.warn("[cal-webhook] CAL_WEBHOOK_SECRET not set — rejecting all webhooks");
    return NextResponse.json({ error: "Webhook misconfigured" }, { status: 503 });
  }

  const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { triggerEvent, payload: data } = payload;

  if (triggerEvent === "BOOKING_CREATED" || triggerEvent === "BOOKING_RESCHEDULED") {
    const email = data?.attendees?.[0]?.email;
    const bookingUid = data?.uid;
    const scheduledAt = data?.startTime;
    const eventType = data?.type;

    if (email && bookingUid) {
      const { data: tenant } = await getSupabase()
        .from("tenants")
        .select("id")
        .eq("email", email)
        .limit(1)
        .single();

      const tenantId = tenant?.id || null;

      const { data: existing } = await getSupabase()
        .from("call_bookings")
        .select("id")
        .eq("email", email)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        await getSupabase()
          .from("call_bookings")
          .update({
            cal_booking_uid: bookingUid,
            cal_event_type: eventType,
            scheduled_at: scheduledAt,
            status: "confirmed",
            updated_at: new Date().toISOString(),
            ...(tenantId && { tenant_id: tenantId }),
          })
          .eq("id", existing.id);
      } else {
        await getSupabase().from("call_bookings").insert({
          name: data?.attendees?.[0]?.name || email,
          email,
          cal_booking_uid: bookingUid,
          cal_event_type: eventType,
          scheduled_at: scheduledAt,
          status: "confirmed",
          source: "cal_webhook",
          ...(tenantId && { tenant_id: tenantId }),
        });
      }
    }
  }

  if (triggerEvent === "BOOKING_CANCELLED") {
    const bookingUid = data?.uid;
    if (bookingUid) {
      await getSupabase()
        .from("call_bookings")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("cal_booking_uid", bookingUid);
    }
  }

  return NextResponse.json({ ok: true });
}
