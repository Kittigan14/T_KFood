const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'restaurant-secret-key';

// Database setup
const dbPath = path.join(__dirname, 'database', 'database.db');
const db = new sqlite3.Database(dbPath);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/views', express.static('views'));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Admin Authentication Middleware
const authenticateAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Initialize Database Tables
function initializeDatabase() {
    console.log('Initializing database...');

    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS Users (
            customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            role TEXT CHECK(role IN ('admin','customer')) DEFAULT 'customer',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Categories table
    db.run(`
        CREATE TABLE IF NOT EXISTS Categories (
            category_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Products table
    db.run(`
        CREATE TABLE IF NOT EXISTS Products (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            image_url TEXT,
            status TEXT CHECK(status IN ('available','unavailable')) DEFAULT 'available',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES Categories(category_id)
        )
    `);

    // Carts table
    db.run(`
        CREATE TABLE IF NOT EXISTS Carts (
            cart_id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES Users(customer_id)
        )
    `);

    // Cart_Items table
    db.run(`
        CREATE TABLE IF NOT EXISTS Cart_Items (
            cart_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            cart_id INTEGER,
            product_id INTEGER,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (cart_id) REFERENCES Carts(cart_id),
            FOREIGN KEY (product_id) REFERENCES Products(product_id)
        )
    `);

    // Orders table
    db.run(`
        CREATE TABLE IF NOT EXISTS Orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            total_amount REAL NOT NULL,
            discount_amount REAL DEFAULT 0,
            final_amount REAL NOT NULL,
            promotion_id INTEGER,
            promo_code TEXT,
            payment_status TEXT CHECK(payment_status IN ('pending','paid','failed')) DEFAULT 'pending',
            order_status TEXT CHECK(order_status IN ('pending','accepted','cooking','delivering','completed','cancelled')) DEFAULT 'pending',
            delivery_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES Users(customer_id)
        )
    `);

    // Order_Items table
    db.run(`
        CREATE TABLE IF NOT EXISTS Order_Items (
            order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            product_id INTEGER,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES Orders(order_id),
            FOREIGN KEY (product_id) REFERENCES Products(product_id)
        )
    `);

    // Payments table
    db.run(`
        CREATE TABLE IF NOT EXISTS Payments (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            method TEXT CHECK(method IN ('cash','credit_card','mobile_banking','promptpay')) DEFAULT 'cash',
            amount REAL NOT NULL,
            status TEXT CHECK(status IN ('pending','success','failed')) DEFAULT 'pending',
            transaction_id TEXT,
            paid_at DATETIME,
            FOREIGN KEY (order_id) REFERENCES Orders(order_id)
        )
    `);

    // Reviews table
    db.run(`
        CREATE TABLE IF NOT EXISTS Reviews (
            review_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            customer_id INTEGER,
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES Products(product_id),
            FOREIGN KEY (customer_id) REFERENCES Users(customer_id)
        )
    `);

    // Favorites table
    db.run(`
        CREATE TABLE IF NOT EXISTS Favorites (
            favorite_id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            product_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES Users(customer_id),
            FOREIGN KEY (product_id) REFERENCES Products(product_id)
        )
    `);

    // Addresses table
    db.run(`
        CREATE TABLE IF NOT EXISTS Addresses (
            address_id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            address TEXT NOT NULL,
            is_default INTEGER CHECK(is_default IN (0,1)) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES Users(customer_id)
        )
    `);

    // Notifications table
    db.run(`
        CREATE TABLE IF NOT EXISTS Notifications (
            notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT CHECK(type IN ('order','payment','stock','system','promotion')),
            message TEXT,
            status TEXT CHECK(status IN ('unread','read')) DEFAULT 'unread',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES Users(customer_id)
        )
    `);

    // Promotions table
        db.run(`
            CREATE TABLE IF NOT EXISTS Promotions (
                promotion_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                type TEXT CHECK(type IN ('percentage','fixed_amount','buy_x_get_y','free_shipping','category_discount')) NOT NULL,
                discount_value REAL,
                buy_quantity INTEGER,
                get_quantity INTEGER,
                min_order_amount REAL DEFAULT 0,
                max_discount_amount REAL,
                usage_limit INTEGER,
                usage_per_customer INTEGER DEFAULT 1,
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                status TEXT CHECK(status IN ('active','inactive','expired','draft')) DEFAULT 'draft',
                promo_code TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Promotion_Categories table
        db.run(`
            CREATE TABLE IF NOT EXISTS Promotion_Categories (
                promotion_id INTEGER,
                category_id INTEGER,
                PRIMARY KEY (promotion_id, category_id),
                FOREIGN KEY (promotion_id) REFERENCES Promotions(promotion_id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE CASCADE
            )
        `);
        
        // Promotion_Products table
        db.run(`
            CREATE TABLE IF NOT EXISTS Promotion_Products (
                promotion_id INTEGER,
                product_id INTEGER,
                PRIMARY KEY (promotion_id, product_id),
                FOREIGN KEY (promotion_id) REFERENCES Promotions(promotion_id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
            )
        `);
        
        // Promotion_Usage table
        db.run(`
            CREATE TABLE IF NOT EXISTS Promotion_Usage (
                usage_id INTEGER PRIMARY KEY AUTOINCREMENT,
                promotion_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                order_id INTEGER NOT NULL,
                discount_amount REAL NOT NULL,
                used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (promotion_id) REFERENCES Promotions(promotion_id),
                FOREIGN KEY (customer_id) REFERENCES Users(customer_id),
                FOREIGN KEY (order_id) REFERENCES Orders(order_id)
            )
        `);
        
        // Customer_Coupons table
        db.run(`
            CREATE TABLE IF NOT EXISTS Customer_Coupons (
                coupon_id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                promotion_id INTEGER NOT NULL,
                status TEXT CHECK(status IN ('available','used','expired')) DEFAULT 'available',
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES Users(customer_id),
                FOREIGN KEY (promotion_id) REFERENCES Promotions(promotion_id)
            )
        `);
        
        // Create indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_promotions_status ON Promotions(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_promotions_dates ON Promotions(start_date, end_date)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_promotions_code ON Promotions(promo_code)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_promotion_usage_customer ON Promotion_Usage(customer_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON Promotion_Usage(promotion_id)`);
}

// Register
app.post('/api/auth/register', (req, res) => {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
        `INSERT INTO Users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)`,
        [name, email, hashedPassword, phone, address],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
                }
                return res.status(500).json({ error: err.message });
            }

            res.json({ 
                success: true, 
                message: 'สมัครสมาชิกสำเร็จ',
                customer_id: this.lastID 
            });
        }
    );
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    db.get(
        `SELECT * FROM Users WHERE email = ?`,
        [email],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!user || !bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
            }

            const token = jwt.sign(
                { customer_id: user.customer_id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token: token,
                user: {
                    customer_id: user.customer_id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        }
    );
});

app.get('/api/users', authenticateToken, authenticateAdmin, (req, res) => {
    db.all(`SELECT customer_id, name, email, role, created_at FROM Users`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, users: rows });
    });
});

app.post('/api/cart/add', authenticateToken, (req, res) => {
    const { product_id, quantity } = req.body;
    const customer_id = req.user.customer_id;

    db.get(`SELECT cart_id FROM Carts WHERE customer_id = ?`, [customer_id], (err, cart) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!cart) {
            db.run(`INSERT INTO Carts (customer_id) VALUES (?)`, [customer_id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                addCartItem(this.lastID);
            });
        } else {
            addCartItem(cart.cart_id);
        }
    });

    function addCartItem(cart_id) {
        db.run(
            `INSERT INTO Cart_Items (cart_id, product_id, quantity, price) 
             VALUES (?, ?, ?, (SELECT price FROM Products WHERE product_id = ?))`,
            [cart_id, product_id, quantity, product_id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, cart_item_id: this.lastID });
            }
        );
    }
});

// Get all active promotions
app.get('/api/promotions/active', (req, res) => {
    const query = `
        SELECT * FROM Promotions 
        WHERE status = 'active' 
        AND start_date <= datetime('now') 
        AND end_date >= datetime('now')
        ORDER BY created_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, promotions: rows });
    });
});

// Validate promo code
app.post('/api/promotions/validate', (req, res) => {
    const { promo_code, customer_id, order_amount, cart_items } = req.body;

    if (!promo_code || !customer_id || !order_amount) {
        return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const query = `
        SELECT * FROM Promotions 
        WHERE promo_code = ? 
        AND status = 'active' 
        AND start_date <= datetime('now') 
        AND end_date >= datetime('now')
    `;

    db.get(query, [promo_code], (err, promotion) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!promotion) {
            return res.status(400).json({ 
                valid: false, 
                message: 'รหัสโปรโมชั่นไม่ถูกต้องหรือหมดอายุแล้ว' 
            });
        }

        if (order_amount < promotion.min_order_amount) {
            return res.status(400).json({
                valid: false,
                message: `ยอดสั่งซื้อขั้นต่ำ ${promotion.min_order_amount} บาท`
            });
        }

        if (promotion.usage_per_customer) {
            const usageQuery = `
                SELECT COUNT(*) as usage_count 
                FROM Promotion_Usage 
                WHERE promotion_id = ? AND customer_id = ?
            `;
            
            db.get(usageQuery, [promotion.promotion_id, customer_id], (err, row) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                if (row.usage_count >= promotion.usage_per_customer) {
                    return res.status(400).json({
                        valid: false,
                        message: 'คุณใช้โปรโมชั่นนี้ครบจำนวนที่กำหนดแล้ว'
                    });
                }

                const discount = calculateDiscount(promotion, order_amount, cart_items || []);

                res.json({
                    valid: true,
                    promotion: promotion,
                    discount: discount,
                    message: `ใช้ส่วนลดได้ ${discount.amount} บาท`
                });
            });
        } else {
            const discount = calculateDiscount(promotion, order_amount, cart_items || []);

            res.json({
                valid: true,
                promotion: promotion,
                discount: discount,
                message: `ใช้ส่วนลดได้ ${discount.amount} บาท`
            });
        }
    });
});

// Calculate discount function
function calculateDiscount(promotion, order_amount, cart_items) {
    let discount_amount = 0;

    switch (promotion.type) {
        case 'percentage':
            discount_amount = (order_amount * promotion.discount_value) / 100;
            if (promotion.max_discount_amount && discount_amount > promotion.max_discount_amount) {
                discount_amount = promotion.max_discount_amount;
            }
            break;

        case 'fixed_amount':
            discount_amount = promotion.discount_value;
            break;

        case 'free_shipping':
            discount_amount = 30;
            break;

        case 'category_discount':
            discount_amount = (order_amount * promotion.discount_value) / 100;
            if (promotion.max_discount_amount && discount_amount > promotion.max_discount_amount) {
                discount_amount = promotion.max_discount_amount;
            }
            break;

        case 'buy_x_get_y':
            discount_amount = 0;
            break;
    }

    return {
        amount: Math.round(discount_amount * 100) / 100,
        type: promotion.type,
        description: promotion.description
    };
}

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: 'Connected'
    });
});

// Get categories
app.get('/api/categories', (req, res) => {
    db.all(`SELECT * FROM Categories ORDER BY name`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, categories: rows });
    });
});

// Get products
app.get('/api/products', (req, res) => {
    const { category_id } = req.query;
    let query = `
        SELECT p.*, c.name as category_name 
        FROM Products p 
        LEFT JOIN Categories c ON p.category_id = c.category_id 
        WHERE p.status = 'available'
    `;
    const params = [];

    if (category_id) {
        query += ' AND p.category_id = ?';
        params.push(category_id);
    }

    query += ' ORDER BY p.name';

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, products: rows });
    });
});

app.post('/api/products', authenticateToken, authenticateAdmin, (req, res) => {
    const { category_id, name, description, price, image_url, status } = req.body;
    db.run(
        `INSERT INTO Products (category_id, name, description, price, image_url, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [category_id, name, description, price, image_url, status || 'available'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, product_id: this.lastID });
        }
    );
});

app.post('/api/orders', authenticateToken, (req, res) => {
    const { total_amount, discount_amount, final_amount, delivery_address, promo_code } = req.body;
    const customer_id = req.user.customer_id;

    db.run(
        `INSERT INTO Orders (customer_id, total_amount, discount_amount, final_amount, delivery_address, promo_code) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [customer_id, total_amount, discount_amount || 0, final_amount, delivery_address, promo_code],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, order_id: this.lastID });
        }
    );
});

app.post('/api/reviews', authenticateToken, (req, res) => {
    const { product_id, rating, comment } = req.body;
    const customer_id = req.user.customer_id;

    db.run(
        `INSERT INTO Reviews (product_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)`,
        [product_id, customer_id, rating, comment],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, review_id: this.lastID });
        }
    );
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'ไม่พบหน้าที่ต้องการ' });
});

app.listen(PORT, () => {
    console.log(`🚀 Restaurant Server running on port ${PORT}`);
    console.log(`📊 Database: ${dbPath}`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
    initializeDatabase();
});

module.exports = app;