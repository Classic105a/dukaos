// Integration tests for invite RPCs.
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
// Run with: supabase test functions (or `deno test --allow-net --allow-env`)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const skip = !url || !serviceKey;

function admin() {
  return createClient(url!, serviceKey!, { auth: { persistSession: false } });
}

async function makeUser(email: string) {
  const a = admin();
  const { data, error } = await a.auth.admin.createUser({
    email,
    password: "Password!23",
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

async function userClient(email: string) {
  const c = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({
    email,
    password: "Password!23",
  });
  if (error) throw error;
  return createClient(url!, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey!, {
    global: { headers: { Authorization: `Bearer ${data.session!.access_token}` } },
    auth: { persistSession: false },
  });
}

Deno.test({
  name: "invite flow: owner invites attendant; invitee becomes attendant (not owner)",
  ignore: skip,
  async fn() {
    const a = admin();
    const ownerEmail = `owner+${crypto.randomUUID()}@test.dev`;
    const inviteeEmail = `staff+${crypto.randomUUID()}@test.dev`;
    const owner = await makeUser(ownerEmail);
    // owner trigger should auto-create a business
    const { data: ownerBiz } = await a
      .from("business_users")
      .select("business_id, is_owner, role")
      .eq("user_id", owner.id)
      .single();
    assertExists(ownerBiz);
    assertEquals(ownerBiz!.is_owner, true);

    const ownerClient = await userClient(ownerEmail);
    const { data: invite, error: invErr } = await ownerClient.rpc("create_invite", {
      p_business_id: ownerBiz!.business_id,
      p_email: inviteeEmail,
      p_role: "attendant",
    });
    assertEquals(invErr, null);
    assertExists(invite);
    const token = (invite as any).token ?? (invite as any)[0]?.token;
    assertExists(token);

    const invitee = await makeUser(inviteeEmail);
    assert(invitee);
    const inviteeClient = await userClient(inviteeEmail);
    const { data: accepted, error: accErr } = await inviteeClient.rpc(
      "accept_invite",
      { p_token: token },
    );
    assertEquals(accErr, null);
    assertExists(accepted);

    const { data: membership } = await a
      .from("business_users")
      .select("role, is_owner")
      .eq("user_id", invitee.id)
      .eq("business_id", ownerBiz!.business_id)
      .single();
    assertEquals(membership!.role, "attendant");
    assertEquals(membership!.is_owner, false);

    // Second accept must be a no-op / error (idempotent)
    const { error: secondErr } = await inviteeClient.rpc("accept_invite", {
      p_token: token,
    });
    assert(secondErr !== null, "second accept should fail");

    // Cleanup
    await a.auth.admin.deleteUser(invitee.id);
    await a.auth.admin.deleteUser(owner.id);
  },
});

Deno.test({
  name: "invite flow: expired/invalid token is rejected",
  ignore: skip,
  async fn() {
    const a = admin();
    const email = `lonely+${crypto.randomUUID()}@test.dev`;
    const u = await makeUser(email);
    const c = await userClient(email);
    const { error } = await c.rpc("accept_invite", {
      p_token: "definitely-not-a-real-token",
    });
    assert(error !== null);
    await a.auth.admin.deleteUser(u.id);
  },
});