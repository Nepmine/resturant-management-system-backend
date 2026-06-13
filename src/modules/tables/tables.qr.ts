import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '../../config/env';

/**
 * Generates a 64-char hex QR token with 256-bit entropy.
 * §B2.6: crypto.randomBytes(32).toString('hex') — never sequential, never predictable.
 */
export function generateQrToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Builds the customer-facing URL that the QR code encodes.
 * The URL carries the token as a query param; the customer app
 * POSTs it to /customer/qr/scan.
 */
export function buildQrUrl(qrToken: string): string {
  return `${env.CUSTOMER_APP_URL}/scan?token=${qrToken}`;
}

/**
 * Renders an SVG string for the given QR token.
 * Returns a self-contained SVG (no external dependencies).
 */
export async function renderQrSvg(qrToken: string): Promise<string> {
  const url = buildQrUrl(qrToken);
  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
  return svg;
}
