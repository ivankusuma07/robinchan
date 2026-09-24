import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';

import { robinhoodChain } from './chain';

/**
 * wagmi config (brief §2: wagmi v2 + viem + RainbowKit).
 *
 * Browser-extension wallets (MetaMask, Rabby, and anything else exposing
 * `window.ethereum` / EIP-6963) work through `injectedWallet`, which needs
 * no WalletConnect project id — confirmed from RainbowKit's own source
 * (`injectedWallet` calls `getInjectedConnector({})`, no `projectId`
 * anywhere in that path). `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (free from
 * cloud.reown.com) is only needed to add mobile wallets that connect by
 * scanning a QR code; RainbowKit's own default wallet list requires it and
 * throws without one, so that richer list is added only once it's set,
 * instead of building the app around a value that isn't there yet.
 */
export function wagmiConfig() {
  const chain = robinhoodChain();
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

  const connectors = connectorsForWallets(
    [{ groupName: 'Browser wallet', wallets: [injectedWallet] }],
    {
      appName: 'Robinchan',
      // Required by the type even though `injectedWallet` doesn't use it;
      // real once a project id is set (see note above).
      projectId: projectId || 'unset',
    },
  );

  return createConfig({
    chains: [chain],
    connectors,
    transports: { [chain.id]: http() },
    ssr: true,
  });
}
