const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Database Connection Pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'farm_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// JWT Configuration
const JWT_SECRET = 'your_jwt_secret_key_should_be_long_and_complex';
const JWT_EXPIRES_IN = '1h';

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// Authorization Middleware (for farmer-specific routes)
const authorizeFarmer = (req, res, next) => {
    if (req.user.userType !== 'farmer') {
        return res.status(403).json({ error: 'Access denied. Farmer privileges required.' });
    }
    next();
};

// Authorization Middleware (for customer-specific routes)
const authorizeCustomer = (req, res, next) => {
    if (req.user.userType !== 'customer') {
        return res.status(403).json({ error: 'Access denied. Customer privileges required.' });
    }
    next();
};

// Utility function to handle database errors
const handleDbError = (res, error) => {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
};

// Routes

// 1. User Authentication Routes

// Register a new user
app.post('/api/register', async (req, res) => {
    const { name, username, password, email, phone, userType } = req.body;
    
    // Basic validation
    if (!name || !username || !password || !email || !phone || !userType) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (userType !== 'farmer' && userType !== 'customer') {
        return res.status(400).json({ error: 'Invalid user type' });
    }

    try {
        // Check if username or email already exists
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ? OR email = ?', 
            [username, email]
        );
        
        if (users.length > 0) {
            return res.status(400).json({ 
                error: 'Username or email already exists' 
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Insert new user
        const [result] = await pool.query(
            'INSERT INTO users (name, username, password, email, phone, user_type) VALUES (?, ?, ?, ?, ?, ?)',
            [name, username, hashedPassword, email, phone, userType]
        );
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: result.insertId, 
                username, 
                userType 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.status(201).json({ 
            message: 'User registered successfully',
            token,
            user: {
                id: result.insertId,
                name,
                username,
                email,
                phone,
                userType
            }
        });
    } catch (error) {
        handleDbError(res, error);
    }
});

// User login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Find user
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ?', 
            [username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const user = users[0];
        
        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                userType: user.user_type 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({ 
            token,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                phone: user.phone,
                userType: user.user_type
            }
        });
    } catch (error) {
        handleDbError(res, error);
    }
});

// 2. Product Routes

// Get all available products
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await pool.query(`
            SELECT p.*, u.name AS farmer_name 
            FROM products p 
            JOIN users u ON p.farmer_id = u.id
            WHERE p.quantity > 0
            ORDER BY p.created_at DESC
        `);
        
        // Convert image URLs to full paths
        const productsWithImageUrls = products.map(product => ({
            ...product,
            image_url: product.image_url ? ${req.protocol}://${req.get('host')}/uploads/${product.image_url} : null
        }));
        
        res.json(productsWithImageUrls);
    } catch (error) {
        handleDbError(res, error);
    }
});

// Get product details by ID
app.get('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    
    try {
        const [products] = await pool.query(`
            SELECT p.*, u.name AS farmer_name, u.phone AS farmer_phone
            FROM products p 
            JOIN users u ON p.farmer_id = u.id
            WHERE p.id = ?
        `, [productId]);
        
        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = products[0];
        product.image_url = product.image_url ? ${req.protocol}://${req.get('host')}/uploads/${product.image_url} : null;
        
        res.json(product);
    } catch (error) {
        handleDbError(res, error);
    }
});

// Add a new product (Farmer only)
app.post('/api/products', authenticateToken, authorizeFarmer, upload.single('image'), async (req, res) => {
    const { name, price, quantity, description } = req.body;
    
    if (!name || !price || !quantity || !description) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const imagePath = req.file ? req.file.filename : null;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO products (farmer_id, name, price, quantity, description, image_url) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, name, price, quantity, description, imagePath]
        );
        
        res.status(201).json({ 
            message: 'Product added successfully',
            productId: result.insertId
        });
    } catch (error) {
        handleDbError(res, error);
    }
});

// Update a product (Farmer only)
app.put('/api/products/:id', authenticateToken, authorizeFarmer, upload.single('image'), async (req, res) => {
    const productId = req.params.id;
    const { name, price, quantity, description } = req.body;
    
    try {
        // First check if the product belongs to the farmer
        const [products] = await pool.query(
            'SELECT * FROM products WHERE id = ? AND farmer_id = ?',
            [productId, req.user.id]
        );
        
        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found or not owned by you' });
        }
        
        const currentProduct = products[0];
        let imagePath = currentProduct.image_url;
        
        // If a new image was uploaded
        if (req.file) {
            // Delete the old image if it exists
            if (currentProduct.image_url) {
                try {
                    fs.unlinkSync(path.join(__dirname, 'uploads', currentProduct.image_url));
                } catch (err) {
                    console.error('Error deleting old image:', err);
                }
            }
            imagePath = req.file.filename;
        }
        
        // Update the product
        await pool.query(
            'UPDATE products SET name = ?, price = ?, quantity = ?, description = ?, image_url = ? WHERE id = ?',
            [name, price, quantity, description, imagePath, productId]
        );
        
        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        handleDbError(res, error);
    }
});

// Delete a product (Farmer only)
app.delete('/api/products/:id', authenticateToken, authorizeFarmer, async (req, res) => {
    const productId = req.params.id;
    
    try {
        // First check if the product belongs to the farmer
        const [products] = await pool.query(
            'SELECT * FROM products WHERE id = ? AND farmer_id = ?',
            [productId, req.user.id]
        );
        
        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found or not owned by you' });
        }
        
        const product = products[0];
        
        // Delete the associated image if it exists
        if (product.image_url) {
            try {
                fs.unlinkSync(path.join(__dirname, 'uploads', product.image_url));
            } catch (err) {
                console.error('Error deleting product image:', err);
            }
        }
        
        // Delete the product
        await pool.query('DELETE FROM products WHERE id = ?', [productId]);
        
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        handleDbError(res, error);
    }
});

// Get farmer's products
app.get('/api/farmer/products', authenticateToken, authorizeFarmer, async (req, res) => {
    try {
        const [products] = await pool.query(
            'SELECT * FROM products WHERE farmer_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        
        // Convert image URLs to full paths
        const productsWithImageUrls = products.map(product => ({
            ...product,
            image_url: product.image_url ? ${req.protocol}://${req.get('host')}/uploads/${product.image_url} : null
        }));
        
        res.json(productsWithImageUrls);
    } catch (error) {
        handleDbError(res, error);
    }
});

// 3. Order Routes

// Create a new order
app.post('/api/orders', authenticateToken, authorizeCustomer, async (req, res) => {
    const { items, totalAmount, shippingAddress } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0 || !totalAmount || !shippingAddress) {
        return res.status(400).json({ error: 'Invalid order data' });
    }
    
    try {
        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Create the order
            const [orderResult] = await connection.query(
                'INSERT INTO orders (customer_id, total_amount, shipping_address, status) VALUES (?, ?, ?, ?)',
                [req.user.id, totalAmount, shippingAddress, 'pending']
            );
            
            const orderId = orderResult.insertId;
            
            // Add order items
            for (const item of items) {
                // Check product availability
                const [products] = await connection.query(
                    'SELECT quantity FROM products WHERE id = ? FOR UPDATE',
                    [item.productId]
                );
                
                if (products.length === 0) {
                    throw new Error(Product ${item.productId} not found);
                }
                
                const product = products[0];
                
                if (product.quantity < item.quantity) {
                    throw new Error(Insufficient quantity for product ${item.productId});
                }
                
                // Add order item
                await connection.query(
                    'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                    [orderId, item.productId, item.quantity, item.price]
                );
                
                // Update product quantity
                await connection.query(
                    'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                    [item.quantity, item.productId]
                );
            }
            
            // Commit the transaction
            await connection.commit();
            connection.release();
            
            res.status(201).json({ 
                message: 'Order created successfully',
                orderId
            });
        } catch (error) {
            // Rollback the transaction on error
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to create order' 
        });
    }
});

// Get customer's orders
app.get('/api/customer/orders', authenticateToken, authorizeCustomer, async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT o.*, 
             COUNT(oi.id) AS item_count,
             SUM(oi.quantity * oi.price) AS total_amount
             FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             WHERE o.customer_id = ?
             GROUP BY o.id
             ORDER BY o.order_date DESC`,
            [req.user.id]
        );
        
        res.json(orders);
    } catch (error) {
        handleDbError(res, error);
    }
});

// Get order details
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
    const orderId = req.params.id;
    
    try {
        // Get order info
        const [orders] = await pool.query(
            'SELECT * FROM orders WHERE id = ?',
            [orderId]
        );
        
        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const order = orders[0];
        
        // Check if the user is authorized to view this order
        if (req.user.userType === 'customer' && order.customer_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to view this order' });
        }
        
        // Get order items
        const [items] = await pool.query(`
            SELECT oi.*, p.name AS product_name, p.image_url
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [orderId]);
        
        // Convert image URLs to full paths
        const itemsWithImageUrls = items.map(item => ({
            ...item,
            image_url: item.image_url ? ${req.protocol}://${req.get('host')}/uploads/${item.image_url} : null
        }));
        
        res.json({
            ...order,
            items: itemsWithImageUrls
        });
    } catch (error) {
        handleDbError(res, error);
    }
});

// Get farmer's orders
app.get('/api/farmer/orders', authenticateToken, authorizeFarmer, async (req, res) => {
    try {
        const [orders] = await pool.query(`
            SELECT o.*, u.name AS customer_name,
            COUNT(oi.id) AS item_count,
            SUM(oi.quantity * oi.price) AS total_amount
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            JOIN users u ON o.customer_id = u.id
            WHERE p.farmer_id = ?
            GROUP BY o.id
            ORDER BY o.order_date DESC
        `, [req.user.id]);
        
        res.json(orders);
    } catch (error) {
        handleDbError(res, error);
    }
});

// Update order status (Farmer only)
app.patch('/api/orders/:id/status', authenticateToken, authorizeFarmer, async (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    try {
        // Update the order status
        const [result] = await pool.query(
            'UPDATE orders SET status = ? WHERE id = ?',
            [status, orderId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        handleDbError(res, error);
    }
});const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Database Connection Pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'farm_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// JWT Configuration
const JWT_SECRET = 'your_jwt_secret_key_should_be_long_and_complex';
const JWT_EXPIRES_IN = '1h';

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// Authorization Middleware (for farmer-specific routes)
const authorizeFarmer = (req, res, next) => {
    if (req.user.userType !== 'farmer') {
        return res.status(403).json({ error: 'Access denied. Farmer privileges required.' });
    }
    next();
};

// Authorization Middleware (for customer-specific routes)
const authorizeCustomer = (req, res, next) => {
    if (req.user.userType !== 'customer') {
        return res.status(403).json({ error: 'Access denied. Customer privileges required.' });
    }
    next();
};

// Utility function to handle database errors
const handleDbError = (res, error) => {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
};

// Routes

// 1. User Authentication Routes

// Register a new user
app.post('/api/register', async (req, res) => {
    const { name, username, password, email, phone, userType } = req.body;
    
    // Basic validation
    if (!name || !username || !password || !email || !phone || !userType) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (userType !== 'farmer' && userType !== 'customer') {
        return res.status(400).json({ error: 'Invalid user type' });
    }

    try {
        // Check if username or email already exists
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ? OR email = ?', 
            [username, email]
        );
        
        if (users.length > 0) {
            return res.status(400).json({ 
                error: 'Username or email already exists' 
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Insert new user
        const [result] = await pool.query(
            'INSERT INTO users (name, username, password, email, phone, user_type) VALUES (?, ?, ?, ?, ?, ?)',
            [name, username, hashedPassword, email, phone, userType]
        );
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: result.insertId, 
                username, 
                userType 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.status(201).json({ 
            message: 'User registered successfully',
            token,
            user: {
                id: result.insertId,
                name,
                username,
                email,
                phone,
                userType
            }
        });
    } catch (error) {
        handleDbError(res, error);
    }
});

// User login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Find user
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ?', 
            [username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const user = users[0];
        
        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                userType: user.user_type 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({ 
            token,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                phone: user.phone,
                userType: user.user_type
            }
        });
    } catch (error) {
        handleDbError(res, error);
    }
});

// 2. Product Routes

// Get all available products
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await pool.query(`
            SELECT p.*, u.name AS farmer_name 
            FROM products p 
            JOIN users u ON p.farmer_id = u.id
            WHERE p.quantity > 0
            ORDER BY p.created_at DESC
        `);
        
        // Convert image URLs to full paths
        const productsWithImageUrls = products.map(product => ({
            ...product,
            image_url: product.image_url ? ${req.protocol}://${req.get('host')}/uploads/${product.image_url} : null
        }));
        
        res.json(productsWithImageUrls);
    } catch (error) {
        handleDbError(res, error);
    }
});

// Get product details by ID
app.get('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    
    try {
        const [products] = await pool.query(`
            SELECT p.*, u.name AS farmer_name, u.phone AS farmer_phone
            FROM products p 
            JOIN users u ON p.farmer_id = u.id
            WHERE p.id = ?
        `, [productId]);
        
        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = products[0];
        product.image_url = product.image_url ? ${req.protocol}://${req.get('host')}/uploads/${product.image_url} : null;
        
        res.json(product);
    } catch (error) {
        handleDbError(res, error);
    }
});

// Add a new product (Farmer only)
app.post('/api/products', authenticateToken, authorizeFarmer, upload.single('image'), async (req, res) => {
    const { name, price, quantity, description } = req.body;
    
    if (!name || !price || !quantity || !description) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const imagePath = req.file ? req.file.filename : null;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO products (farmer_id, name, price, quantity, description, image_url) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, name, price, quantity, description, imagePath]
        );
        
        res.status(201).json({ 
            message: 'Product added successfully',
            productId: result.insertId
        });
    } catch (error) {
        handleDbError(res, error);
    }
});

// Update a product (Farmer only)
app.put('/api/products/:id', authenticateToken, authorizeFarmer, upload.single('image'), async (req, res) => {
    const productId = req.params.id;
    const { name, price, quantity, description } = req.body;
    
    try {
        // First check if the product belongs to the farmer
        const [products] = await pool.query(
            'SELECT * FROM products WHERE id = ? AND farmer_id = ?',
            [productId, req.user.id]
        );
        
        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found or not owned by you' });
        }
        
        const currentProduct = products[0];
        let imagePath = currentProduct.image_url;
        
        // If a new image was uploaded
        if (req.file) {
            // Delete the old image if it exists
            if (currentProduct.image_url) {
                try {
                    fs.unlinkSync(path.join(__dirname, 'uploads', currentProduct.image_url));
                } catch (err) {
                    console.error('Error deleting old image:', err);
                }
            }
            imagePath = req.file.filename;
        }
        
        // Update the product
        await pool.query(
            'UPDATE products SET name = ?, price = ?, quantity = ?, description = ?, image_url = ? WHERE id = ?',
            [name, price, quantity, description, imagePath, productId]
        );
        
        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        handleDbError(res, error);
    }
});

// Delete a product (Farmer only)
app.delete('/api/products/:id', authenticateToken, authorizeFarmer, async (req, res) => {
    const productId = req.params.id;
    
    try {
        // First check if the product belongs to the farmer
        const [products] = await pool.query(
            'SELECT * FROM products WHERE id = ? AND farmer_id = ?',
            [productId, req.user.id]
        );
        
        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found or not owned by you' });
        }
        
        const product = products[0];
        
        // Delete the associated image if it exists
        if (product.image_url) {
            try {
                fs.unlinkSync(path.join(__dirname, 'uploads', product.image_url));
            } catch (err) {
                console.error('Error deleting product image:', err);
            }
        }
        
        // Delete the product
        await pool.query('DELETE FROM products WHERE id = ?', [productId]);
        
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        handleDbError(res, error);
    }
});

// Get farmer's products
app.get('/api/farmer/products', authenticateToken, authorizeFarmer, async (req, res) => {
    try {
        const [products] = await pool.query(
            'SELECT * FROM products WHERE farmer_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        
        // Convert image URLs to full paths
        const productsWithImageUrls = products.map(product => ({
            ...product,
            image_url: product.image_url ? ${req.protocol}://${req.get('host')}/uploads/${product.image_url} : null
        }));
        
        res.json(productsWithImageUrls);
    } catch (error) {
        handleDbError(res, error);
    }
});

// 3. Order Routes

// Create a new order
app.post('/api/orders', authenticateToken, authorizeCustomer, async (req, res) => {
    const { items, totalAmount, shippingAddress } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0 || !totalAmount || !shippingAddress) {
        return res.status(400).json({ error: 'Invalid order data' });
    }
    
    try {
        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Create the order
            const [orderResult] = await connection.query(
                'INSERT INTO orders (customer_id, total_amount, shipping_address, status) VALUES (?, ?, ?, ?)',
                [req.user.id, totalAmount, shippingAddress, 'pending']
            );
            
            const orderId = orderResult.insertId;
            
            // Add order items
            for (const item of items) {
                // Check product availability
                const [products] = await connection.query(
                    'SELECT quantity FROM products WHERE id = ? FOR UPDATE',
                    [item.productId]
                );
                
                if (products.length === 0) {
                    throw new Error(Product ${item.productId} not found);
                }
                
                const product = products[0];
                
                if (product.quantity < item.quantity) {
                    throw new Error(Insufficient quantity for product ${item.productId});
                }
                
                // Add order item
                await connection.query(
                    'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                    [orderId, item.productId, item.quantity, item.price]
                );
                
                // Update product quantity
                await connection.query(
                    'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                    [item.quantity, item.productId]
                );
            }
            
            // Commit the transaction
            await connection.commit();
            connection.release();
            
            res.status(201).json({ 
                message: 'Order created successfully',
                orderId
            });
        } catch (error) {
            // Rollback the transaction on error
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to create order' 
        });
    }
});

// Get customer's orders
app.get('/api/customer/orders', authenticateToken, authorizeCustomer, async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT o.*, 
             COUNT(oi.id) AS item_count,
             SUM(oi.quantity * oi.price) AS total_amount
             FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             WHERE o.customer_id = ?
             GROUP BY o.id
             ORDER BY o.order_date DESC`,
            [req.user.id]
        );
        
        res.json(orders);
    } catch (error) {
        handleDbError(res, error);
    }
});

// Get order details
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
    const orderId = req.params.id;
    
    try {
        // Get order info
        const [orders] = await pool.query(
            'SELECT * FROM orders WHERE id = ?',
            [orderId]
        );
        
        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const order = orders[0];
        
        // Check if the user is authorized to view this order
        if (req.user.userType === 'customer' && order.customer_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to view this order' });
        }
        
        // Get order items
        const [items] = await pool.query(`
            SELECT oi.*, p.name AS product_name, p.image_url
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [orderId]);
        
        // Convert image URLs to full paths
        const itemsWithImageUrls = items.map(item => ({
            ...item,
            image_url: item.image_url ? ${req.protocol}://${req.get('host')}/uploads/${item.image_url} : null
        }));
        
        res.json({
            ...order,
            items: itemsWithImageUrls
        });
    } catch (error) {
        handleDbError(res, error);
    }
});

// Get farmer's orders
app.get('/api/farmer/orders', authenticateToken, authorizeFarmer, async (req, res) => {
    try {
        const [orders] = await pool.query(`
            SELECT o.*, u.name AS customer_name,
            COUNT(oi.id) AS item_count,
            SUM(oi.quantity * oi.price) AS total_amount
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            JOIN users u ON o.customer_id = u.id
            WHERE p.farmer_id = ?
            GROUP BY o.id
            ORDER BY o.order_date DESC
        `, [req.user.id]);
        
        res.json(orders);
    } catch (error) {
        handleDbError(res, error);
    }
});

// Update order status (Farmer only)
app.patch('/api/orders/:id/status', authenticateToken, authorizeFarmer, async (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    try {
        // Update the order status
        const [result] = await pool.query(
            'UPDATE orders SET status = ? WHERE id = ?',
            [status, orderId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        handleDbError(res, error);
    }
});