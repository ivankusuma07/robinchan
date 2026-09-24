/**
 * Sign-In with Ethereum (EIP-4361) message, built by hand rather than via
 * the `siwe` package — that package's only supported signature-verification
 * path depends on `ethers`, a second wallet library next to the wagmi v2 +
 * viem stack the brief specifies (§2). The EIP-4361 message is a fixed text
 * template; building and re-parsing it is small enough to own directly, and
 * the actual signature check is one `viem` call (`verifyMessage`) in
 * `apps/api/src/auth/siwe.ts`.
 *
 * Both `apps/web` (to build the message the wallet signs) and `apps/api`
 * (to reconstruct it from the client's answer and compare) import this, so
 * the two can never drift into signing/verifying different text.
 */

export type SiweFields = {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  /** ISO timestamp; the message is invalid after this. */
  expirationTime: string;
  statement?: string;
};

const STATEMENT_DEFAULT = 'Sign in to Robinchan. This request will not trigger a transaction.';

/** The exact EIP-4361 layout — field order and line breaks are part of the spec. */
export function buildSiweMessage(f: SiweFields): string {
  const statement = f.statement ?? STATEMENT_DEFAULT;
  return [
    `${f.domain} wants you to sign in with your Ethereum account:`,
    f.address,
    '',
    statement,
    '',
    `URI: ${f.uri}`,
    `Version: 1`,
    `Chain ID: ${f.chainId}`,
    `Nonce: ${f.nonce}`,
    `Issued At: ${f.issuedAt}`,
    `Expiration Time: ${f.expirationTime}`,
  ].join('\n');
}

/**
 * Re-extracts the fields from a message string, for the server to check
 * against what it actually issued (the nonce it stored, the domain it
 * serves as, a chain id it accepts) before trusting the signature over it.
 * Returns `null` on anything that doesn't match the exact shape
 * `buildSiweMessage` produces — this is a verifier, not a lenient parser.
 */
export function parseSiweMessage(message: string): SiweFields | null {
  const lines = message.split('\n');
  if (lines.length < 11) return null;

  const domainMatch = /^(.+) wants you to sign in with your Ethereum account:$/.exec(lines[0] ?? '');
  const address = lines[1];
  if (!domainMatch || !address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  if (lines[2] !== '') return null;

  // statement (line 3) may itself be empty; line 4 must be the blank separator.
  const statement = lines[3];
  if (lines[4] !== '') return null;

  const field = (label: string, line: string | undefined): string | null => {
    if (!line?.startsWith(`${label}: `)) return null;
    return line.slice(label.length + 2);
  };

  const uri = field('URI', lines[5]);
  const version = field('Version', lines[6]);
  const chainIdRaw = field('Chain ID', lines[7]);
  const nonce = field('Nonce', lines[8]);
  const issuedAt = field('Issued At', lines[9]);
  const expirationTime = field('Expiration Time', lines[10]);

  if (!uri || version !== '1' || !chainIdRaw || !nonce || !issuedAt || !expirationTime) return null;
  const chainId = Number(chainIdRaw);
  if (!Number.isInteger(chainId)) return null;

  return {
    domain: domainMatch[1]!,
    address,
    uri,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
    ...(statement ? { statement } : {}),
  };
}
