const crypto = require('crypto');

const securityConfig = {
    CORS_OPTIONS: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'X-CSRF-Token']
    },
    
    validateOrderData: (orderData) => {
        const { total, items, customer } = orderData;
        
        if (!total || !items || !customer) {
            throw new Error('Missing required fields');
        }
        
        if (!customer.email || !customer.phone || !customer.name) {
            throw new Error('Missing customer details');
        }
        
        // Validate total matches items
        const calculatedTotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
        if (calculatedTotal !== total) {
            throw new Error('Order amount mismatch');
        }
        
        return true;
    },

    sanitizeInput: (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/[<>]/g, '');
    },

    validateEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    validatePhone: (phone) => {
        const phoneRegex = /^\d{10}$/;
        return phoneRegex.test(phone);
    },

    verifyPaymentSignature: (orderId, paymentId, signature) => {
        const body = orderId + '|' + paymentId;
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');
        
        return generated_signature === signature;
    }
};

module.exports = securityConfig; 