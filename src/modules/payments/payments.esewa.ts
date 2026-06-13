import crypto from 'crypto';
import { env } from '../../config/env';

export interface EsewaVerifyParams {
  oid: string;
  amt: string;
  refId: string;
}

/**
 * Verifies an eSewa payment callback.
 *
 * eSewa v2 verification: POST to ESEWA_VERIFY_URL with form data.
 * Returns true when eSewa confirms the transaction as complete.
 *
 * Reference: https://developer.esewa.com.np/#/epay
 */
export async function verifyEsewaPayment(params: EsewaVerifyParams): Promise<boolean> {
  const formData = new URLSearchParams({
    amt: params.amt,
    rid: params.refId,
    pid: params.oid,
    scd: env.ESEWA_MERCHANT_CODE,
  });

  try {
    const response = await fetch(env.ESEWA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const text = await response.text();
    // eSewa returns XML: <response><status>SUCCESS</status></response>
    return text.includes('<status>SUCCESS</status>');
  } catch {
    return false;
  }
}

/**
 * Generates an eSewa payment form parameter set for the frontend.
 * The frontend POSTs these to the eSewa payment page.
 */
export function buildEsewaFormParams(params: {
  amount: number;
  pid: string;      // our internal payment reference (esewaPid)
  successUrl: string;
  failureUrl: string;
}) {
  return {
    amt: params.amount,
    psc: 0,          // service charge
    pdc: 0,          // delivery charge
    txAmt: 0,        // tax amount
    tAmt: params.amount,
    pid: params.pid,
    scd: env.ESEWA_MERCHANT_CODE,
    su: params.successUrl,
    fu: params.failureUrl,
  };
}

/** Generates a unique eSewa PID: esewa-{timestamp}-{randomHex} */
export function generateEsewaPid(): string {
  return `esewa-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}
