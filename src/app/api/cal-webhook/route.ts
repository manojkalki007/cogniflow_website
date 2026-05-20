import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const { triggerEvent, payload: data } = payload;

  if (triggerEvent === "BOOKING_CREATED" || triggerEvent === "BOOKING_RESCHEDULED") {
    const email = data?.attendees?.[0]?.email;
    const bookingUid = data?.uid;
    const scheduledAt = data?.startTime;
    const eventType = data?.type;

    if (email && bookingUid) {
      // Update existing booking or insert new one
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
