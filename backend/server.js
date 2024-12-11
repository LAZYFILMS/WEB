require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const securityConfig = require('./config/security');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors(securityConfig.CORS_OPTIONS));
app.use(express.json());

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Initialize Email Transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Create order endpoint
app.post('/api/orders/create', async (req, res) => {
    try {
        const orderData = req.body;
        
        // Validate order data
        securityConfig.validateOrderData(orderData);
        
        // Sanitize inputs
        const sanitizedData = {
            ...orderData,
            customer: {
                ...orderData.customer,
                name: securityConfig.sanitizeInput(orderData.customer.name),
                address: securityConfig.sanitizeInput(orderData.customer.address)
            },
            notes: securityConfig.sanitizeInput(orderData.notes)
        };

        // Create Razorpay order
        const options = {
            amount: sanitizedData.total * 100,
            currency: 'INR',
            receipt: 'order_' + Date.now()
        };

        const order = await razorpay.orders.create(options);
        
        res.json({
            orderId: order.id,
            amount: order.amount,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(400).json({ error: error.message });
    }
});

// Verify payment endpoint
app.post('/api/orders/verify', async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature 
        } = req.body;

        const isValid = securityConfig.verifyPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (isValid) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Invalid payment signature' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// Process order endpoint
app.post('/api/orders/process', async (req, res) => {
    try {
        const { orderId, orderData } = req.body;

        // Verify order exists
        const order = await razorpay.orders.fetch(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Send confirmation emails
        await sendOrderConfirmationEmails(orderData, orderId);

        res.json({ success: true });
    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ error: 'Failed to process order' });
    }
});

async function sendOrderConfirmationEmails(orderData, paymentId) {
    const adminEmailContent = {
        from: process.env.EMAIL_USER,
        to: 'labs@lazyfilms.in',
        subject: `New Film Processing Order - #${paymentId}`,
        html: generateAdminEmailTemplate(orderData, paymentId)
    };

    const customerEmailContent = {
        from: process.env.EMAIL_USER,
        to: orderData.customer.email,
        subject: `Order Confirmation - Lazy Film Lab #${paymentId}`,
        html: generateCustomerEmailTemplate(orderData, paymentId)
    };

    await transporter.sendMail(adminEmailContent);
    await transporter.sendMail(customerEmailContent);
}

function generateAdminEmailTemplate(orderData, orderId) {
    const items = orderData.items.map(item => 
        `<li>${item.quantity}× ${item.filmName || 'Untitled Film'} - ${item.type} 
         ${item.option !== 'none' ? `(${item.option})` : ''} - ₹${item.itemTotal}</li>`
    ).join('');

    return `
        <h2>New Order Received</h2>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Customer Details:</strong></p>
        <ul>
            <li>Name: ${orderData.customer.name}</li>
            <li>Email: ${orderData.customer.email}</li>
            <li>Phone: ${orderData.customer.phone}</li>
            <li>Address: ${orderData.customer.address}, ${orderData.customer.city} - ${orderData.customer.pincode}</li>
        </ul>
        <p><strong>Order Items:</strong></p>
        <ul>${items}</ul>
        <p><strong>Total Amount:</strong> ₹${orderData.total}</p>
        <p><strong>Scan Options:</strong> ${orderData.scans.join(', ') || 'None'}</p>
        <p><strong>Return Negatives:</strong> ${orderData.returnNegatives ? 'Yes (+₹150)' : 'No'}</p>
        <p><strong>Additional Notes:</strong> ${orderData.notes || 'None'}</p>
    `;
}

function generateCustomerEmailTemplate(orderData, paymentId) {
    const items = orderData.items.map(item => 
        `<li>${item.quantity} rolls of ${item.type} (${item.processType}${item.pushPull !== 'none' ? ', ' + item.pushPull : ''})</li>`
    ).join('');

    return `
        <h2>Order Confirmation</h2>
        <p>Thank you for your order with Lazy Film Lab!</p>
        <p><strong>Order ID:</strong> ${paymentId}</p>
        <p><strong>Order Details:</strong></p>
        <ul>${items}</ul>
        <p><strong>Scan Options:</strong> ${orderData.scans.join(', ') || 'None'}</p>
        <p><strong>Return Negatives:</strong> ${orderData.returnNegatives ? 'Yes' : 'No'}</p>
        <p><strong>Shipping Address:</strong><br>
        ${orderData.customer.address}<br>
        ${orderData.customer.city} - ${orderData.customer.pincode}</p>
        <p>Please package your films securely and send them to:</p>
        <p>
        Lazy Film Lab<br>
        C-13, Sahar CHS, sahar road,<br>
        Parsiwada Chakala, Andheri East,<br>
        Mumbai - 400099<br>
        Phone: 9405143371
        </p>
        <p>Don't forget to include your Order ID with the package!</p>
    `;
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 