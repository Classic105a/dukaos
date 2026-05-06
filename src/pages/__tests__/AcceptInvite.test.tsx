import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

const useAuthMock = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => useAuthMock() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AcceptInvite from "@/pages/AcceptInvite";

function renderPage(token: string) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: {
              email: "x@y.com",
              role: "attendant",
              status: "pending",
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              business_id: "biz-1",
              businesses: { name: "Acme" },
            },
            error: null,
          }),
      }),
    }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/accept-invite?token=${token}`]}>
        <Routes>
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  useAuthMock.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

describe("AcceptInvite", () => {
  it("shows sign-in CTA and stores pending token when not authenticated", async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    renderPage("tok-123");
    expect(await screen.findByText(/Sign in or sign up/i)).toBeInTheDocument();
    expect(sessionStorage.getItem("pendingInviteToken")).toBe("tok-123");
  });

  it("calls accept_invite RPC exactly once even on rapid double click", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u1" }, loading: false });
    rpcMock.mockReturnValue(
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ data: { business_id: "biz-1", role: "attendant" }, error: null }),
          50,
        ),
      ),
    );
    renderPage("tok-abc");
    const btn = await screen.findByRole("button", { name: /Accept invite/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect(rpcMock).toHaveBeenCalledWith("accept_invite", { p_token: "tok-abc" });
  });

  it("shows the server error when the invite is invalid or expired", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u1" }, loading: false });
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Invite is invalid or expired" },
    });
    renderPage("bad-token");
    const btn = await screen.findByRole("button", { name: /Accept invite/i });
    fireEvent.click(btn);
    expect(await screen.findByText(/invalid or expired/i)).toBeInTheDocument();
  });
});