'use client';

import '@rainbow-me/rainbowkit/styles.css';

import { RainbowKitProvider, lightTheme, useConnectModal } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { WagmiProvider, useAccount, useDisconnect, useSignMessage } from 'wagmi';
import type { TierId } from '@robinchan/shared';
import { buildSiweMessage } from '@robinchan/shared';

import { API_BASE } from '@/lib/api';
import { robinhoodChain } from '@/lib/chain';
import { wagmiConfig } from '@/lib/wagmiConfig';

/**
 * Wallet + SIWE state (brief §14), read by `useWallet()` (the topbar
 * button) and `useTier()` (every `<WalletGate>`/`<TierGate>`). One source,
 * so a gate and the topbar can never disagree about whether the user is
 * signed in.
 *
 * `status` distinguishes *wallet connected* from *signed in*: connecting a
 * wallet only proves an address exists in the browser, never who controls
 * it — that's what the SIWE signature is for (brief §14's core rule). Every
 * gate in the app keys off `signed-in`, not `wallet-connected`.
 */
export type SiweStatus =
  | 'disconnected'
  | 'connecting-wallet'
  | 'awaiting-signature'
  | 'verifying'
  | 'signed-in'
  | 'rejected';

export type WalletState = {
  status: SiweStatus;
  address: string | null;
  tier: TierId | null;
  errorMessage: string | null;
  /** Opens RainbowKit's wallet picker; sign-in follows automatically once connected. */
  connect: () => void;
  signOut: () => Promise<void>;
  /** Re-runs the SIWE prompt after a rejection or a failed attempt. */
  retry: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

async function fetchJson<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include', // the session cookie is cross-origin between :3000 and :4000 in dev
    headers: { accept: 'application/json', ...init?.headers },
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as T;
  return { ok: res.ok, status: res.status, body };
}

function useWalletState(): WalletState {
  const { address, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [status, setStatus] = useState<SiweStatus>('disconnected');
  const [tier, setTier] = useState<TierId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Guards against the effect below re-firing mid-flow (e.g. React Strict
  // Mode's double-invoke, or address changing while a sign-in is pending).
  const runningFor = useRef<string | null>(null);

  const fetchTier = useCallback(async () => {
    const res = await fetchJson<{ data?: { tier: TierId } }>('/api/user/tier');
    if (res.ok) setTier(res.body.data?.tier ?? null);
  }, []);

  const signIn = useCallback(
    async (addr: string) => {
      setStatus('awaiting-signature');
      setErrorMessage(null);
      try {
        const nonceRes = await fetchJson<{ data?: { nonce: string } }>(
          `/api/auth/nonce?address=${addr}`,
        );
        const nonce = nonceRes.ok ? nonceRes.body.data?.nonce : undefined;
        if (!nonce) throw new Error('could not reach the server for a sign-in nonce');

        const now = new Date();
        const message = buildSiweMessage({
          domain: window.location.host,
          address: addr,
          uri: window.location.origin,
          chainId: robinhoodChain().id,
          nonce,
          issuedAt: now.toISOString(),
          // Kept short and matched to auth/siwe.ts's own cap — a signature
          // is meant to be used right away, not held for later.
          expirationTime: new Date(now.getTime() + 5 * 60_000).toISOString(),
        });

        const signature = await signMessageAsync({ message });

        setStatus('verifying');
        const verifyRes = await fetchJson<{ data?: { address: string }; error?: { message: string } }>(
          '/api/auth/verify',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ message, signature }),
          },
        );
        if (!verifyRes.ok) {
          throw new Error(verifyRes.body.error?.message ?? 'sign-in was rejected by the server');
        }

        setStatus('signed-in');
        void fetchTier();
      } catch (err) {
        // A rejected signature (closing the wallet's prompt) lands here
        // too — that's an ordinary outcome, not a bug, so it's labelled
        // distinctly from a real failure but handled the same way: offer
        // "retry" rather than getting stuck.
        const message = err instanceof Error ? err.message : 'sign-in failed';
        const wasRejection = /reject|denied|cancel/i.test(message);
        setStatus('rejected');
        // A plain rejection (closed the wallet's prompt) needs no message —
        // "retry" already says everything. A real failure keeps its text.
        setErrorMessage(wasRejection ? null : message);
      }
    },
    [signMessageAsync, fetchTier],
  );

  // Reacts to the wallet connecting/disconnecting, and to `retry()`.
  useEffect(() => {
    if (!isConnected || !address) {
      runningFor.current = null;
      setStatus('disconnected');
      setTier(null);
      return;
    }

    let cancelled = false;
    (async () => {
      // Already have a valid session for this exact address? Just adopt it.
      const sessionRes = await fetchJson<{ data?: { signedIn: boolean; address?: string } }>(
        '/api/auth/session',
      );
      if (cancelled) return;
      if (sessionRes.ok && sessionRes.body.data?.signedIn && sessionRes.body.data.address === address.toLowerCase()) {
        setStatus('signed-in');
        void fetchTier();
        return;
      }

      if (runningFor.current === address) return; // a sign-in for this address is already in flight
      runningFor.current = address;
      await signIn(address);
    })();

    return () => {
      cancelled = true;
    };
    // `retryTick` is a deliberate re-run trigger, not a data dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, retryTick]);

  const { openConnectModal } = useConnectModal();

  const connect = useCallback(() => {
    setErrorMessage(null);
    setStatus('connecting-wallet');
    openConnectModal?.();
  }, [openConnectModal]);

  const signOut = useCallback(async () => {
    await fetchJson('/api/auth/logout', { method: 'POST' });
    await disconnectAsync().catch(() => undefined);
    runningFor.current = null;
    setStatus('disconnected');
    setTier(null);
  }, [disconnectAsync]);

  const retry = useCallback(() => {
    runningFor.current = null;
    setRetryTick((n) => n + 1);
  }, []);

  return {
    status,
    address: address ?? null,
    tier,
    errorMessage,
    connect,
    signOut,
    retry,
  };
}

function WalletBridge({ children }: { children: ReactNode }) {
  const state = useWalletState();
  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>;
}

/** Matches the site's light theme (design.md §11) instead of RainbowKit's default purple. */
const rainbowKitTheme = lightTheme({
  accentColor: '#65A30D', // text-safe deep lime — see tailwind.config.ts textColor.accent
  accentColorForeground: '#FFFFFF',
  borderRadius: 'medium',
  fontStack: 'system',
});

let queryClient: QueryClient | undefined;
function getQueryClient(): QueryClient {
  // One instance per browser tab, created lazily so it's never constructed
  // during SSR.
  queryClient ??= new QueryClient();
  return queryClient;
}

export function Web3Providers({ children }: { children: ReactNode }) {
  const [config] = useState(() => wagmiConfig());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={getQueryClient()}>
        <RainbowKitProvider theme={rainbowKitTheme} modalSize="compact">
          <WalletBridge>{children}</WalletBridge>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet() must be used inside <Web3Providers>');
  return ctx;
}
