// fire-webhook/index.ts
// Supabase Edge Function — receives Fire.com payment webhooks
// Verifies the JWT signature using your Fire webhook secret, then stores confirmed payments in Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── These are set as Supabase Edge Function secrets (see SETUP.md) ──
const FIRE_WEBHOOK_SECRET = Deno.env.get("FIRE_WEBHOOK_SECRET")!; // your Fire secret from Settings > API
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Verify Fire's JWT signature (HS256) ──
async function verifyFireJWT(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const signingInput = `${header}.${payload}`;

    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData,
      { name: "HMAC", hash: "SHA-256" },
      false, ["verify"]
    );

    const sigBytes = base64UrlDecode(signature);
    const valid = await crypto.subtle.verify(
      "HMAC", cryptoKey,
      sigBytes,
      enc.encode(signingInput)
    );

    if (!valid) return null;

    const decodedPayload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload))
    );
    return decodedPayload;

  } catch (e) {
    console.error("JWT verification error:", e);
    return null;
  }
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// ── Main handler ──
serve(async (req) => {
  // Allow CORS for the HTML page to query payment status
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }

  // GET /fire-webhook?check=email@example.com — used by the HTML page to verify payment
  if (req.method === "GET") {
    const url = new URL(req.url);
    const email = url.searchParams.get("check");
    if (!email) {
      return new Response(JSON.stringify({ error: "No email provided" }), { status: 400 });
    }

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("status", "confirmed")
      .single();

    return new Response(
      JSON.stringify({ paid: !!data && !error, payment: data || null }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }

  // POST — incoming webhook from Fire
  if (req.method === "POST") {
    const body = await req.text();

    // Fire sends a JWT as the raw body
    const token = body.trim();
    const payload = await verifyFireJWT(token, FIRE_WEBHOOK_SECRET);

    if (!payload) {
      console.error("Invalid JWT signature from Fire");
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("Fire webhook payload:", JSON.stringify(payload, null, 2));

    // Fire webhook event types — we care about successful payments
    // eventType can be: LODGEMENT, PAYMENT_REQUEST_PAYMENT_AUTHORISED, etc.
    const eventType = payload.eventType || payload.type || "";
    const isPayment = 
      eventType.includes("PAYMENT") || 
      eventType.includes("LODGEMENT") ||
      eventType.includes("AUTHORISED");

    if (isPayment) {
      // Extract payer details from Fire payload
      // Fire's payload structure varies — we handle common fields
      const amount   = payload.amount || payload.paymentAmount || null;
      const currency = payload.currency || "GBP";
      const ref      = payload.myRef || payload.reference || payload.paymentRequestCode || "";
      const name     = payload.destIban?.name || payload.senderName || payload.payerName || "Unknown";
      const email    = payload.destIban?.email || payload.payerEmail || payload.senderEmail || null;
      const fireRef  = payload.paymentUuid || payload.transactionId || ref;

      // Upsert payment record
      const { error } = await supabase.from("payments").upsert({
        fire_ref:   fireRef,
        name:       name,
        email:      email?.toLowerCase().trim() || null,
        amount:     amount,
        currency:   currency,
        status:     "confirmed",
        raw_event:  eventType,
        paid_at:    new Date().toISOString(),
      }, { onConflict: "fire_ref" });

      if (error) {
        console.error("Supabase insert error:", error);
        return new Response("DB Error", { status: 500 });
      }

      console.log(`✅ Payment recorded: ${name} ${email} ${amount} ${currency}`);
    }

    return new Response("OK", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});
