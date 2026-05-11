import axios from 'axios';
import crypto from 'crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

/**
 * Initialize a Paystack transaction
 * @param email Customer email
 * @param amount Amount in KES (will be converted to subunits/cents)
 * @param reference Unique reference
 * @param metadata Optional metadata
 */
export const initializePaystackTransaction = async (
  email: string,
  amount: number,
  reference: string,
  metadata: any = {}
) => {
  try {
    const payload: any = {
      email,
      amount: Math.round(amount * 100), // Paystack expects subunits
      reference,
      metadata,
    };

    if (metadata.callback_url) {
      payload.callback_url = metadata.callback_url;
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      payload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Paystack initialization failed');
    }
    throw error;
  }
};

/**
 * Verify a Paystack transaction by reference
 */
export const verifyPaystackTransaction = async (reference: string) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
        timeout: 10000, // 10 seconds timeout
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Paystack verification error:', error);
    throw error;
  }
};

/**
 * Verify Paystack webhook signature
 */
export const verifyPaystackSignature = (
  payload: string | object,
  signature: string | undefined
): boolean => {
  if (!signature || !PAYSTACK_SECRET_KEY) return false;

  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);

  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(data)
    .digest('hex');

  return hash === signature;
};

export { PAYSTACK_PUBLIC_KEY };
