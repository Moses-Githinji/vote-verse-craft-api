# Paystack Payment Integration Guide (Frontend)

This guide explains how to integrate the Paystack payment flow in the VoteVerse/KuraPap frontend applications.

## 1. Flow Overview
The payment flow follows these steps:
1.  **Initiate**: Call the backend to get a Paystack `authorization_url` and `reference`.
2.  **Redirect/Popup**: Send the user to the `authorization_url` or use the Paystack Inline Popup.
3.  **Webhook/Verification**: The backend listens for the success event and automatically updates the Booking/Order status.

---

## 2. API Endpoints

### 🟢 Initiate Payment
**Endpoint**: `POST /api/v1/payments/initiate`
**Auth**: Required (Bearer Token)

**Request Body**:
```json
{
  "targetType": "booking" | "eshop_order",
  "targetId": "MONGODB_ID_OF_THE_BOOKING_OR_ORDER"
}
```

**Success Response**:
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "xxxxxxxx",
    "reference": "VV-B-1714382583279-123",
    "publicKey": "pk_test_xxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

### 🟡 Verify Payment (Manual Fallback)
**Endpoint**: `GET /api/v1/payments/verify/:reference`
**Auth**: Required (Bearer Token)

Use this if you need to manually check the status after a user returns from the redirect before the webhook has processed.

---

## 3. Implementation Example (React)

### Option A: Standard Redirect
```javascript
const handlePayment = async (bookingId) => {
  const res = await api.post('/payments/initiate', {
    targetType: 'booking',
    targetId: bookingId
  });

  if (res.data.success) {
    // Redirect the user to Paystack
    window.location.href = res.data.data.authorization_url;
  }
};
```

### Option B: Paystack Inline (Recommended for Dashboard)
1. Install: `npm install react-paystack`
2. Usage:
```javascript
import { usePaystackPayment } from 'react-paystack';

const config = {
  reference: initData.reference, // From /payments/initiate
  email: user.email,
  amount: amount * 100, // Amount in cents/subunits
  publicKey: initData.publicKey,
};

const initializePayment = usePaystackPayment(config);

initializePayment(onSuccess, onClose);
```

---

## 4. Testing
Use [Paystack Test Cards](https://paystack.com/docs/payments/test-payments/#test-cards) to simulate successful transactions:
- **Success Card**: Any valid card with PIN `1234`.
- **Declined Card**: Use specific test cards provided in the documentation.

## 5. Webhook URL (For Admin)
Ensure the following URL is registered in the Paystack Dashboard Settings:
`https://<your-api-domain>/api/v1/payments/webhook`
