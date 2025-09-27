const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require("cors");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'restaurant-secret-key';

// Database setup
const dbPath = path.join(__dirname, 'database', 'database.db');
const db = new sqlite3.Database(dbPath);

// view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(express.static('public'));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'restaurant-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use((req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        res.locals.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.locals.user = null;
            return next();
        }

        db.get(`SELECT customer_id, name, email, role FROM Users WHERE customer_id = ?`,
            [user.customer_id],
            (dbErr, dbUser) => {
                if (dbErr || !dbUser) {
                    res.locals.user = null;
                    res.clearCookie('token');
                    return next();
                }

                res.locals.user = dbUser;
                next();
            });
    });
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({
        error: 'Access token required'
    });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid or expired token'
        });
        req.user = user;
        next();
    });
};

const authenticateAdmin = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(401).json({
                error: 'Access token required'
            });
        }
        return res.redirect('/login');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(403).json({
                    error: 'Invalid token'
                });
            }
            return res.redirect('/login');
        }

        if (user.role !== 'admin') {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(403).json({
                    error: 'Admin access required'
                });
            }
            return res.redirect('/');
        }

        req.user = user;
        next();
    });
};

function authenticateAdminApi(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            success: false,
            error: "Access token required"
        });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            success: false,
            error: "Invalid token"
        });
        if (user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: "Admin access required"
            });
        }
        req.user = user;
        next();
    });
}

function authenticateAdminPage(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.redirect('/login');
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err || user.role !== 'admin') return res.redirect('/login');
        req.user = user;
        next();
    });
}

initializeDatabase();

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

    db.run(`
        CREATE TABLE IF NOT EXISTS Employees (
            employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            position TEXT NOT NULL,
            salary REAL,
            hire_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            quantity INTEGER NOT NULL DEFAULT 1,
            price REAL NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

    db.run(`
        CREATE TABLE IF NOT EXISTS System_Logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES Users(customer_id)
        )
    `);

    console.log("✅ Database initialized.");
}

app.get("/", (req, res) => {
    try {
        db.all("SELECT category_id, name FROM Categories", [], (err, categories) => {
            if (err) return res.status(500).send("DB error: " + err.message);

            db.all(`
        SELECT product_id, name, price, image_url, category_id 
        FROM Products 
        WHERE status = 'available'
        ORDER BY created_at DESC
        
      `, [], (err, products) => {
                if (err) return res.status(500).send("DB error: " + err.message);

                db.all(`
          SELECT r.review_id, r.comment, r.rating, r.created_at, u.name 
          FROM Reviews r
          JOIN Users u ON r.customer_id = u.customer_id
          ORDER BY r.created_at DESC
          LIMIT 5
        `, [], (err, reviews) => {
                    if (err) return res.status(500).send("DB error: " + err.message);

                    res.render("index", {
                        title: "T&KFood",
                        categories,
                        products,
                        reviews,
                        user: res.locals.user
                    });
                });
            });
        });
    } catch (err) {
        console.error("Error on / :", err);
        res.status(500).send("เกิดข้อผิดพลาดในระบบ");
    }
});

app.get('/login', (req, res) => res.render('login', {
    title: "เข้าสู่ระบบ"
}));
app.get('/register', (req, res) => res.render('register', {
    title: "สมัครสมาชิก"
}));
app.get('/cart', (req, res) => res.render('cart', {
    title: "ตะกร้าสินค้า"
}));
app.get('/favorites', (req, res) => res.render('favorites', {
    title: "สินค้าที่ถูกใจ"
}));

// Register
app.post('/api/auth/register', (req, res) => {
    const {
        name,
        email,
        password,
        phone,
        address
    } = req.body;

    if (!name || !email || !password) {
        return res.status(400).send("กรุณากรอกข้อมูลให้ครบถ้วน");
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
        `INSERT INTO Users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)`,
        [name, email, hashedPassword, phone, address],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).send("อีเมลนี้ถูกใช้งานแล้ว");
                }
                return res.status(500).send("เกิดข้อผิดพลาด: " + err.message);
            }

            db.get("SELECT * FROM Users WHERE customer_id = ?", [this.lastID], (err, user) => {
                if (err) return res.status(500).send("DB Error");

                const token = jwt.sign({
                        customer_id: user.customer_id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    },
                    JWT_SECRET, {
                        expiresIn: '24h'
                    }
                );

                res.cookie("token", token, {
                    httpOnly: true,
                    secure: false,
                    maxAge: 24 * 60 * 60 * 1000
                });

                res.redirect("/");
            });
        }
    );
});

// Login
app.post('/api/auth/login', (req, res) => {
    const {
        email,
        password
    } = req.body;

    db.get(`SELECT * FROM Users WHERE email = ?`, [email], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: "Database error"
            });
        }

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({
                success: false,
                error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            });
        }

        const token = jwt.sign({
            customer_id: user.customer_id,
            name: user.name,
            email: user.email,
            role: user.role
        }, JWT_SECRET, {
            expiresIn: '24h'
        });

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            maxAge: 24 * 60 * 60 * 1000
        });

        // Determine redirect URL based on user role
        const redirectTo = user.role === 'admin' ? '/admin' : '/';

        res.json({
            success: true,
            redirectTo: redirectTo,
            user: {
                id: user.customer_id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    });
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

app.get('/api/users', authenticateToken, authenticateAdmin, (req, res) => {
    db.all(`SELECT customer_id, name, email, role, created_at FROM Users`, [], (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            users: rows
        });
    });
});

// Get cart items
app.get('/api/cart', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            error: 'กรุณาเข้าสู่ระบบก่อน'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const customer_id = user.customer_id;
        const query = `
            SELECT ci.cart_item_id, ci.product_id, p.name, p.price, ci.quantity, 
                   (ci.price * ci.quantity) as total, p.image_url
            FROM Cart_Items ci
            JOIN Carts c ON ci.cart_id = c.cart_id
            JOIN Products p ON ci.product_id = p.product_id
            WHERE c.customer_id = ? AND p.status = 'available'
            ORDER BY ci.cart_item_id DESC
        `;

        db.all(query, [customer_id], (err, rows) => {
            if (err) {
                console.error('Cart query error:', err);
                return res.status(500).json({
                    error: err.message
                });
            }
            res.json({
                success: true,
                cart: rows
            });
        });
    });
});

// Add product to cart
app.post('/api/cart/add', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            error: 'กรุณาเข้าสู่ระบบก่อน'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        // console.log("Decoded user from JWT:", user);
        const {
            product_id,
            quantity = 1
        } = req.body;
        const customer_id = user.customer_id;

        if (!product_id) {
            return res.status(400).json({
                error: 'ต้องระบุสินค้า'
            });
        }

        // First check if product exists and is available
        db.get(`SELECT product_id, price FROM Products WHERE product_id = ? AND status = 'available'`,
            [product_id], (err, product) => {
                if (err) return res.status(500).json({
                    error: err.message
                });
                if (!product) return res.status(404).json({
                    error: 'ไม่พบสินค้าหรือสินค้าไม่พร้อมจำหน่าย'
                });

                // Get or create cart
                db.get(`SELECT cart_id FROM Carts WHERE customer_id = ?`, [customer_id], (err, cart) => {
                    if (err) return res.status(500).json({
                        error: err.message
                    });

                    const ensureCart = (cart_id) => {
                        // Check if item already exists in cart
                        db.get(`SELECT cart_item_id, quantity FROM Cart_Items WHERE cart_id = ? AND product_id = ?`,
                            [cart_id, product_id], (err, item) => {
                                if (err) return res.status(500).json({
                                    error: err.message
                                });

                                if (item) {
                                    // Update existing item
                                    db.run(`UPDATE Cart_Items SET quantity = quantity + ?, 
                                    updated_at = CURRENT_TIMESTAMP WHERE cart_item_id = ?`,
                                        [quantity, item.cart_item_id],
                                        function (err) {
                                            if (err) return res.status(500).json({
                                                error: err.message
                                            });
                                            res.json({
                                                success: true,
                                                message: 'อัปเดตจำนวนสินค้าในตะกร้าแล้ว',
                                                updated: true
                                            });
                                        });
                                } else {
                                    // Add new item
                                    db.run(`INSERT INTO Cart_Items (cart_id, product_id, quantity, price)
                                    VALUES (?, ?, ?, ?)`,
                                        [cart_id, product_id, quantity, product.price],
                                        function (err) {
                                            if (err) return res.status(500).json({
                                                error: err.message
                                            });
                                            res.json({
                                                success: true,
                                                message: 'เพิ่มสินค้าลงตะกร้าเรียบร้อย',
                                                added: true
                                            });
                                        });
                                }
                            });
                    };

                    if (!cart) {
                        // Create new cart
                        db.run(`INSERT INTO Carts (customer_id) VALUES (?)`, [customer_id], function (err) {
                            if (err) return res.status(500).json({
                                error: err.message
                            });
                            ensureCart(this.lastID);
                        });
                    } else {
                        ensureCart(cart.cart_id);
                    }
                });
            });
    });
});

// Update product quantity in cart
app.post('/api/cart/update', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            error: 'กรุณาเข้าสู่ระบบก่อน'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const {
            itemId,
            quantity
        } = req.body;
        const customer_id = user.customer_id;

        if (!itemId || quantity === undefined) {
            return res.status(400).json({
                error: 'ข้อมูลไม่ครบถ้วน'
            });
        }

        // Get user's cart
        db.get(`SELECT cart_id FROM Carts WHERE customer_id = ?`, [customer_id], (err, cart) => {
            if (err) return res.status(500).json({
                error: err.message
            });
            if (!cart) return res.status(404).json({
                error: 'ไม่พบตะกร้าสินค้า'
            });

            if (quantity <= 0) {
                // Remove item if quantity is 0 or negative
                db.run(`DELETE FROM Cart_Items WHERE cart_id = ? AND product_id = ?`,
                    [cart.cart_id, itemId],
                    function (err) {
                        if (err) return res.status(500).json({
                            error: err.message
                        });
                        res.json({
                            success: true,
                            message: 'ลบสินค้าออกจากตะกร้าแล้ว',
                            removed: this.changes > 0
                        });
                    });
            } else {
                // Update quantity
                db.run(`UPDATE Cart_Items SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
                        WHERE cart_id = ? AND product_id = ?`,
                    [quantity, cart.cart_id, itemId],
                    function (err) {
                        if (err) return res.status(500).json({
                            error: err.message
                        });
                        res.json({
                            success: true,
                            message: 'อัปเดตจำนวนสินค้าแล้ว',
                            updated: this.changes > 0
                        });
                    });
            }
        });
    });
});

// Remove product from cart
app.delete('/api/cart/remove/:id', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            error: 'กรุณาเข้าสู่ระบบก่อน'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const product_id = parseInt(req.params.id);
        const customer_id = user.customer_id;

        db.get(`SELECT cart_id FROM Carts WHERE customer_id = ?`, [customer_id], (err, cart) => {
            if (err) return res.status(500).json({
                error: err.message
            });
            if (!cart) return res.status(404).json({
                error: 'ไม่พบตะกร้าสินค้า'
            });

            db.run(`DELETE FROM Cart_Items WHERE cart_id = ? AND product_id = ?`,
                [cart.cart_id, product_id],
                function (err) {
                    if (err) return res.status(500).json({
                        error: err.message
                    });
                    res.json({
                        success: true,
                        message: 'ลบสินค้าออกจากตะกร้าเรียบร้อย',
                        removed: this.changes > 0
                    });
                });
        });
    });
});

app.get('/api/cart/count', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.json({
            count: 0
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.json({
            count: 0
        });

        const customer_id = user.customer_id;
        const query = `
            SELECT COALESCE(SUM(ci.quantity), 0) as count
            FROM Cart_Items ci
            JOIN Carts c ON ci.cart_id = c.cart_id
            WHERE c.customer_id = ?
        `;

        db.get(query, [customer_id], (err, row) => {
            if (err) return res.json({
                count: 0
            });
            res.json({
                count: row.count || 0
            });
        });
    });
});

// Get favorites
app.get('/api/favorites', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            error: 'กรุณาเข้าสู่ระบบก่อน'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const customer_id = user.customer_id;
        const query = `
            SELECT f.favorite_id, f.product_id, p.name, p.price, p.image_url, f.created_at
            FROM Favorites f
            JOIN Products p ON f.product_id = p.product_id
            WHERE f.customer_id = ? AND p.status = 'available'
            ORDER BY f.created_at DESC
        `;

        db.all(query, [customer_id], (err, rows) => {
            if (err) {
                console.error('Favorites query error:', err);
                return res.status(500).json({
                    error: err.message
                });
            }
            res.json({
                success: true,
                favorites: rows
            });
        });
    });
});

// Add to favorites
app.post('/api/favorites/add/:id', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            error: 'กรุณาเข้าสู่ระบบก่อน'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const product_id = parseInt(req.params.id);
        const customer_id = user.customer_id;

        if (!product_id || isNaN(product_id)) {
            return res.status(400).json({
                error: 'รหัสสินค้าไม่ถูกต้อง'
            });
        }

        // Check if product exists
        db.get(`SELECT product_id FROM Products WHERE product_id = ? AND status = 'available'`,
            [product_id], (err, product) => {
                if (err) return res.status(500).json({
                    error: err.message
                });
                if (!product) return res.status(404).json({
                    error: 'ไม่พบสินค้า'
                });

                // Check if already in favorites
                db.get(`SELECT favorite_id FROM Favorites WHERE customer_id = ? AND product_id = ?`,
                    [customer_id, product_id], (err, row) => {
                        if (err) return res.status(500).json({
                            error: err.message
                        });

                        if (row) {
                            return res.json({
                                success: true,
                                message: 'สินค้าอยู่ใน Favorites อยู่แล้ว',
                                already_exists: true
                            });
                        }

                        // Add to favorites
                        db.run(`INSERT INTO Favorites (customer_id, product_id) VALUES (?, ?)`,
                            [customer_id, product_id],
                            function (err) {
                                if (err) return res.status(500).json({
                                    error: err.message
                                });
                                res.json({
                                    success: true,
                                    message: 'เพิ่มเป็นสินค้าที่ชอบเรียบร้อย',
                                    favorite_id: this.lastID
                                });
                            });
                    });
            });
    });
});

// Remove from favorites
app.delete('/api/favorites/remove/:id', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            error: 'กรุณาเข้าสู่ระบบก่อน'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const product_id = parseInt(req.params.id);
        const customer_id = user.customer_id;

        db.run(`DELETE FROM Favorites WHERE customer_id = ? AND product_id = ?`,
            [customer_id, product_id],
            function (err) {
                if (err) return res.status(500).json({
                    error: err.message
                });
                res.json({
                    success: true,
                    message: 'ลบออกจากรายการโปรดเรียบร้อย',
                    removed: this.changes > 0
                });
            });
    });
});

// Count favorites
app.get('/api/favorites/count', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.json({
            count: 0
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.json({
            count: 0
        });

        const customer_id = user.customer_id;
        db.get(`SELECT COUNT(*) as count FROM Favorites WHERE customer_id = ?`,
            [customer_id], (err, row) => {
                if (err) return res.json({
                    count: 0
                });
                res.json({
                    count: row.count || 0
                });
            });
    });
});

app.get("/coupons", (req, res) => {
    res.render("coupons");
});

app.get('/api/coupons', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({
        error: 'กรุณาเข้าสู่ระบบก่อน'
    });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const customer_id = user.customer_id;

        const query = `
      SELECT cc.coupon_id, cc.status, cc.expires_at, p.promo_code, p.name, p.description
      FROM Customer_Coupons cc
      JOIN Promotions p ON cc.promotion_id = p.promotion_id
      WHERE cc.customer_id = ? AND cc.status = 'available'
      AND (cc.expires_at IS NULL OR cc.expires_at >= datetime('now'))
    `;

        db.all(query, [customer_id], (err, rows) => {
            if (err) return res.status(500).json({
                error: err.message
            });

            res.json({
                success: true,
                coupons: rows
            });
        });
    });
});

// Claim coupon (insert into Customer_Coupons)
app.post('/api/coupons/claim', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({
        success: false,
        message: 'กรุณาเข้าสู่ระบบก่อน'
    });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            success: false,
            message: 'Token ไม่ถูกต้อง'
        });

        const {
            promotion_id
        } = req.body;
        const customer_id = user.customer_id;

        if (!promotion_id) {
            return res.status(400).json({
                success: false,
                message: 'promotion_id ไม่ถูกต้อง'
            });
        }

        const checkQuery = `SELECT * FROM Customer_Coupons WHERE promotion_id = ? AND customer_id = ?`;
        db.get(checkQuery, [promotion_id, customer_id], (err, row) => {
            if (err) return res.status(500).json({
                success: false,
                message: err.message
            });

            if (row) {
                return res.json({
                    success: false,
                    message: 'คุณรับคูปองนี้ไปแล้ว'
                });
            }

            const promoQuery = `SELECT * FROM Promotions WHERE promotion_id = ?`;
            db.get(promoQuery, [promotion_id], (err, promotion) => {
                if (err || !promotion) {
                    return res.status(404).json({
                        success: false,
                        message: 'ไม่พบโปรโมชั่น'
                    });
                }

                const insertQuery = `
          INSERT INTO Customer_Coupons (customer_id, promotion_id, status, expires_at) 
          VALUES (?, ?, 'available', ?)
        `;
                db.run(insertQuery, [customer_id, promotion_id, promotion.end_date], function (err) {
                    if (err) return res.status(500).json({
                        success: false,
                        message: err.message
                    });

                    res.json({
                        success: true,
                        message: 'รับคูปองสำเร็จแล้ว!'
                    });
                });
            });
        });
    });
});

app.get('/api/coupons/available', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({
        error: 'กรุณาเข้าสู่ระบบก่อน'
    });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const customer_id = user.customer_id;

        const query = `
      SELECT cc.coupon_id, cc.status, cc.expires_at, 
             p.promotion_id, p.promo_code, p.name, p.description, 
             p.type, p.discount_value, p.min_order_amount, p.max_discount_amount
      FROM Customer_Coupons cc
      JOIN Promotions p ON cc.promotion_id = p.promotion_id
      WHERE cc.customer_id = ? 
        AND cc.status = 'available'
        AND p.status = 'active'
        AND p.start_date <= datetime('now') 
        AND p.end_date >= datetime('now')
        AND (cc.expires_at IS NULL OR cc.expires_at >= datetime('now'))
    `;

        db.all(query, [customer_id], (err, rows) => {
            if (err) return res.status(500).json({
                error: err.message
            });

            res.json({
                success: true,
                coupons: rows
            });
        });
    });
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
            return res.status(500).json({
                error: err.message
            });
        }
        res.json({
            success: true,
            promotions: rows
        });
    });
});

// Validate promo code
app.post('/api/promotions/validate', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({
        error: 'กรุณาเข้าสู่ระบบก่อน'
    });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const {
            promo_code,
            order_amount,
            cart_items
        } = req.body;
        const customer_id = user.customer_id;

        if (!promo_code || !order_amount) {
            return res.status(400).json({
                error: 'ข้อมูลไม่ครบถ้วน'
            });
        }

        // Check if customer has this coupon available
        const couponQuery = `
            SELECT cc.coupon_id, cc.status, p.*
            FROM Customer_Coupons cc
            JOIN Promotions p ON cc.promotion_id = p.promotion_id
            WHERE cc.customer_id = ? 
              AND p.promo_code = ?
              AND cc.status = 'available'
              AND p.status = 'active' 
              AND p.start_date <= datetime('now') 
              AND p.end_date >= datetime('now')
              AND (cc.expires_at IS NULL OR cc.expires_at >= datetime('now'))
        `;

        db.get(couponQuery, [customer_id, promo_code], (err, coupon) => {
            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (!coupon) {
                return res.status(400).json({
                    valid: false,
                    message: 'รหัสโปรโมชั่นไม่ถูกต้องหรือหมดอายุแล้ว หรือคุณยังไม่ได้รับคูปองนี้'
                });
            }

            if (order_amount < coupon.min_order_amount) {
                return res.status(400).json({
                    valid: false,
                    message: `ยอดสั่งซื้อขั้นต่ำ ${coupon.min_order_amount} บาท`
                });
            }

            // Check usage limit per customer if applicable
            if (coupon.usage_per_customer) {
                const usageQuery = `
                    SELECT COUNT(*) as usage_count 
                    FROM Promotion_Usage 
                    WHERE promotion_id = ? AND customer_id = ?
                `;

                db.get(usageQuery, [coupon.promotion_id, customer_id], (err, row) => {
                    if (err) {
                        return res.status(500).json({
                            error: err.message
                        });
                    }

                    if (row.usage_count >= coupon.usage_per_customer) {
                        return res.status(400).json({
                            valid: false,
                            message: 'คุณใช้โปรโมชั่นนี้ครบจำนวนที่กำหนดแล้ว'
                        });
                    }

                    const discount = calculateDiscount(coupon, order_amount, cart_items || []);

                    res.json({
                        valid: true,
                        coupon: coupon,
                        discount: discount,
                        message: `ใช้ส่วนลดได้ ${discount.amount} บาท`
                    });
                });
            } else {
                const discount = calculateDiscount(coupon, order_amount, cart_items || []);

                res.json({
                    valid: true,
                    coupon: coupon,
                    discount: discount,
                    message: `ใช้ส่วนลดได้ ${discount.amount} บาท`
                });
            }
        });
    });
});

app.post('/api/coupons/use', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({
        error: 'กรุณาเข้าสู่ระบบก่อน'
    });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({
            error: 'Invalid token'
        });

        const {
            promo_code,
            order_amount
        } = req.body;
        const customer_id = user.customer_id;

        if (!promo_code) {
            return res.status(400).json({
                error: 'กรุณาระบุรหัสคูปอง'
            });
        }

        // Get coupon details first
        const getCouponQuery = `
            SELECT cc.coupon_id, cc.status, p.*
            FROM Customer_Coupons cc
            JOIN Promotions p ON cc.promotion_id = p.promotion_id
            WHERE cc.customer_id = ? 
              AND p.promo_code = ?
              AND cc.status = 'available'
        `;

        db.get(getCouponQuery, [customer_id, promo_code], (err, coupon) => {
            if (err) return res.status(500).json({
                error: err.message
            });
            if (!coupon) return res.status(404).json({
                error: 'ไม่พบคูปองที่ใช้ได้'
            });

            // Mark coupon as used
            const updateQuery = `
                UPDATE Customer_Coupons 
                SET status = 'used' 
                WHERE coupon_id = ? AND customer_id = ?
            `;

            db.run(updateQuery, [coupon.coupon_id, customer_id], function (err) {
                if (err) return res.status(500).json({
                    error: err.message
                });

                const discount = calculateDiscount(coupon, order_amount, []);

                res.json({
                    success: true,
                    message: 'ใช้คูปองเรียบร้อยแล้ว',
                    discount: discount
                });
            });
        });
    });
});

// Temporary endpoint to insert test promotions
app.get('/api/test/insert-promotions', (req, res) => {
    const testPromotions = [
        ['ส่วนลด 20%', 'ลด 20% สำหรับการสั่งซื้อครั้งแรก', 'percentage', 20, null, null, 200, 100, 100, 1, 'NEW20'],
        ['ลด 50 บาท', 'ลดทันที 50 บาท เมื่อสั่งอาหารครบ 300 บาท', 'fixed_amount', 50, null, null, 300, null, null, null, 'SAVE50']
    ];

    const stmt = db.prepare(`
    INSERT OR REPLACE INTO Promotions 
    (name, description, type, discount_value, buy_quantity, get_quantity, min_order_amount, max_discount_amount, usage_limit, usage_per_customer, start_date, end_date, status, promo_code) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+1 year'), 'active', ?)
  `);

    testPromotions.forEach(promo => stmt.run(promo));
    stmt.finalize();

    res.json({
        success: true,
        message: 'Test promotions inserted'
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
    const query = `
        SELECT c.*, COUNT(p.product_id) as product_count
        FROM Categories c
        LEFT JOIN Products p ON c.category_id = p.category_id AND p.status = 'available'
        GROUP BY c.category_id
        ORDER BY c.name
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Database error:", err.message);
            return res.status(500).json({
                success: false,
                error: "เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่"
            });
        }

        res.json({
            success: true,
            categories: rows
        });
    });
});

// Get products
app.get('/api/products', (req, res) => {
    const {
        category_id,
        search,
        limit = 50
    } = req.query;

    let query = `
        SELECT p.product_id, p.name, p.price, p.image_url, p.category_id, p.description,
               c.name as category_name
        FROM Products p
        LEFT JOIN Categories c ON p.category_id = c.category_id
        WHERE p.status = 'available'
    `;
    const params = [];

    if (category_id) {
        query += " AND p.category_id = ?";
        params.push(category_id);
    }

    if (search) {
        query += " AND (p.name LIKE ? OR p.description LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY p.created_at DESC LIMIT ?";
    params.push(parseInt(limit));

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error("Database error:", err.message);
            return res.status(500).json({
                success: false,
                error: "เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า"
            });
        }

        res.json({
            success: true,
            products: rows,
            count: rows.length
        });
    });
});


app.post('/api/products', authenticateToken, authenticateAdmin, (req, res) => {
    const {
        category_id,
        name,
        description,
        price,
        image_url,
        status
    } = req.body;
    db.run(
        `INSERT INTO Products (category_id, name, description, price, image_url, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [category_id, name, description, price, image_url, status || 'available'],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                product_id: this.lastID
            });
        }
    );
});

app.get('/admin', authenticateAdminPage, (req, res) => {
    res.render('admin');
});

// Create admin user route (for initial setup)
app.post('/api/admin/create-admin', (req, res) => {
    const {
        email,
        password,
        name
    } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({
            error: 'All fields required'
        });
    }

    // Check if admin already exists
    db.get('SELECT * FROM Users WHERE role = "admin"', [], (err, admin) => {
        if (err) return res.status(500).json({
            error: err.message
        });

        if (admin) {
            return res.status(400).json({
                error: 'Admin user already exists'
            });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        db.run(
            'INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'admin'],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({
                            error: 'Email already exists'
                        });
                    }
                    return res.status(500).json({
                        error: err.message
                    });
                }

                res.json({
                    success: true,
                    message: 'Admin user created successfully',
                    admin_id: this.lastID
                });
            }
        );
    });
});

// Enhanced dashboard statistics with revenue
app.get('/api/admin/stats/revenue', authenticateAdmin, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    const queries = {
        today: `
            SELECT COALESCE(SUM(final_amount), 0) as revenue, COUNT(*) as orders
            FROM Orders 
            WHERE DATE(created_at) = ? AND order_status != 'cancelled'
        `,
        week: `
            SELECT COALESCE(SUM(final_amount), 0) as revenue, COUNT(*) as orders
            FROM Orders 
            WHERE DATE(created_at) >= DATE('now', '-7 days') AND order_status != 'cancelled'
        `,
        month: `
            SELECT COALESCE(SUM(final_amount), 0) as revenue, COUNT(*) as orders
            FROM Orders 
            WHERE DATE(created_at) >= DATE('now', 'start of month') AND order_status != 'cancelled'
        `
    };

    db.get(queries.today, [today], (err, todayData) => {
        if (err) return res.status(500).json({
            error: err.message
        });

        db.get(queries.week, [], (err, weekData) => {
            if (err) return res.status(500).json({
                error: err.message
            });

            db.get(queries.month, [], (err, monthData) => {
                if (err) return res.status(500).json({
                    error: err.message
                });

                res.json({
                    success: true,
                    stats: {
                        today: todayData,
                        week: weekData,
                        month: monthData
                    }
                });
            });
        });
    });
});

app.get('/api/admin/stats/orders', authenticateAdmin, (req, res) => {
    db.get(`SELECT COUNT(*) as total FROM Orders`, [], (err, row) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            total: row.total || 0
        });
    });
});

app.get('/api/admin/stats/products', authenticateAdmin, (req, res) => {
    db.get(`SELECT COUNT(*) as total FROM Products`, [], (err, row) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            total: row.total || 0
        });
    });
});

app.get('/api/admin/stats/members', authenticateAdmin, (req, res) => {
    db.get(`SELECT COUNT(*) as total FROM Users WHERE role = 'customer'`, [], (err, row) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            total: row.total || 0
        });
    });
});

app.get('/api/admin/orders/recent', authenticateAdmin, (req, res) => {
    const query = `
        SELECT o.*, u.name as customer_name 
        FROM Orders o 
        JOIN Users u ON o.customer_id = u.customer_id 
        ORDER BY o.created_at DESC 
        LIMIT 5
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            orders: rows
        });
    });
});

// Enhanced orders with filtering
app.get('/api/admin/orders/filter', authenticateAdmin, (req, res) => {
    const {
        status,
        date,
        customer
    } = req.query;
    let query = `
        SELECT o.*, u.name as customer_name, u.email as customer_email
        FROM Orders o 
        JOIN Users u ON o.customer_id = u.customer_id 
        WHERE 1=1
    `;
    let params = [];

    if (status) {
        query += ' AND o.order_status = ?';
        params.push(status);
    }

    if (date) {
        query += ' AND DATE(o.created_at) = ?';
        params.push(date);
    }

    if (customer) {
        query += ' AND (u.name LIKE ? OR u.email LIKE ?)';
        params.push(`%${customer}%`, `%${customer}%`);
    }

    query += ' ORDER BY o.created_at DESC LIMIT 100';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            orders: rows
        });
    });
});

// Bulk order status update
app.put('/api/admin/orders/bulk-status', authenticateAdmin, (req, res) => {
    const {
        orderIds,
        status
    } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || !status) {
        return res.status(400).json({
            error: 'Invalid request data'
        });
    }

    const validStatuses = ['pending', 'accepted', 'cooking', 'delivering', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            error: 'Invalid status'
        });
    }

    const placeholders = orderIds.map(() => '?').join(',');
    const query = `
        UPDATE Orders 
        SET order_status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE order_id IN (${placeholders})
    `;

    db.run(query, [status, ...orderIds], function (err) {
        if (err) return res.status(500).json({
            error: err.message
        });

        res.json({
            success: true,
            message: `${this.changes} orders updated successfully`,
            updated_count: this.changes
        });
    });
});

app.get('/api/admin/products', authenticateAdminApi, (req, res) => {
    const query = `
        SELECT p.*, c.name as category_name 
        FROM Products p 
        LEFT JOIN Categories c ON p.category_id = c.category_id 
        ORDER BY p.created_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            products: rows
        });
    });
});

// Advanced product search and filtering
app.get('/api/admin/products/search', authenticateAdminApi, (req, res) => {
    const {
        q,
        category,
        status,
        min_price,
        max_price
    } = req.query;

    let query = `
    SELECT p.*, c.name as category_name
    FROM Products p
    LEFT JOIN Categories c ON p.category_id = c.category_id
    WHERE 1=1
  `;
    let params = [];

    if (q) {
        query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
    }

    if (category) {
        query += ' AND p.category_id = ?';
        params.push(category);
    }

    if (status) {
        query += ' AND p.status = ?';
        params.push(status);
    }

    if (min_price) {
        query += ' AND p.price >= ?';
        params.push(parseFloat(min_price));
    }

    if (max_price) {
        query += ' AND p.price <= ?';
        params.push(parseFloat(max_price));
    }

    query += ' ORDER BY p.created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({
            success: false,
            error: err.message
        });
        res.json({
            success: true,
            products: rows
        });
    });
});

app.get('/api/admin/products/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    db.get(`SELECT * FROM Products WHERE product_id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        if (!row) return res.status(404).json({
            error: 'Product not found'
        });
        res.json({
            success: true,
            product: row
        });
    });
});

app.post('/api/admin/products', authenticateAdmin, (req, res) => {
    const {
        name,
        category_id,
        description,
        price,
        image_url,
        status
    } = req.body;

    db.run(
        `INSERT INTO Products (name, category_id, description, price, image_url, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, category_id, description, price, image_url, status || 'available'],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                product_id: this.lastID
            });
        }
    );
});

app.put('/api/admin/products/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    let {
        name,
        category_id,
        description,
        price,
        image_url,
        status
    } = req.body;

    console.log("Updating Product:", {
        id,
        name,
        category_id,
        description,
        price,
        image_url,
        status
    });

    category_id = category_id && category_id !== "" ? parseInt(category_id) : null;
    price = price && !isNaN(price) ? parseFloat(price) : 0;

    db.run(
        `UPDATE Products 
   SET name = ?, 
       category_id = ?, 
       description = ?, 
       price = ?, 
       image_url = ?, 
       status = ?
   WHERE product_id = ?`,
        [name, category_id, description, price, image_url, status, id],
        function (err) {
            if (err) {
                console.error("SQL Update Error:", err.message);
                return res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }
            res.json({
                success: true,
                message: "Product updated successfully"
            });
        }
    );
});

app.delete('/api/admin/products/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    db.run(`DELETE FROM Products WHERE product_id = ?`, [id], function (err) {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            changes: this.changes
        });
    });
});

app.get('/api/admin/categories', authenticateAdminApi, (req, res) => {
    const query = `
        SELECT c.*, COUNT(p.product_id) as product_count 
        FROM Categories c 
        LEFT JOIN Products p ON c.category_id = p.category_id 
        GROUP BY c.category_id 
        ORDER BY c.name
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            categories: rows
        });
    });
});

app.get('/api/admin/categories/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    db.get(`SELECT * FROM Categories WHERE category_id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        if (!row) return res.status(404).json({
            error: 'Category not found'
        });
        res.json({
            success: true,
            category: row
        });
    });
});

app.post('/api/admin/categories', authenticateAdmin, (req, res) => {
    const {
        name
    } = req.body;

    db.run(`INSERT INTO Categories (name) VALUES (?)`, [name], function (err) {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            category_id: this.lastID
        });
    });
});

app.put('/api/admin/categories/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    const {
        name
    } = req.body;

    db.run(`UPDATE Categories SET name = ? WHERE category_id = ?`, [name, id], function (err) {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            changes: this.changes
        });
    });
});

app.delete('/api/admin/categories/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    db.run(`DELETE FROM Categories WHERE category_id = ?`, [id], function (err) {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            changes: this.changes
        });
    });
});

app.get('/api/admin/orders', authenticateAdmin, (req, res) => {
    const query = `
        SELECT o.*, u.name as customer_name, u.email as customer_email 
        FROM Orders o 
        JOIN Users u ON o.customer_id = u.customer_id 
        ORDER BY o.created_at DESC 
        LIMIT 100
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            orders: rows
        });
    });
});

app.put('/api/admin/orders/:id/status', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    const {
        status
    } = req.body;

    const validStatuses = ['pending', 'accepted', 'cooking', 'delivering', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            error: 'Invalid status'
        });
    }

    db.run(
        `UPDATE Orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        [status, id],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                changes: this.changes
            });
        }
    );
});

// Enhanced member search
app.get('/api/admin/members/search', authenticateAdmin, (req, res) => {
    const { q } = req.query;

    let query = `
        SELECT 
            u.customer_id, 
            u.name, 
            u.email, 
            u.phone, 
            u.created_at,
            COUNT(o.order_id) AS order_count, 
            COALESCE(SUM(o.final_amount), 0) AS total_spent
        FROM Users u
        LEFT JOIN Orders o ON u.customer_id = o.customer_id
        WHERE u.role = 'customer'
    `;
    let params = [];

    if (q) {
        query += ` AND (
            u.name LIKE ? OR 
            u.email LIKE ? OR 
            u.phone LIKE ?
        )`;
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    query += ` GROUP BY u.customer_id 
               ORDER BY u.created_at DESC`;

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error("SQL Error (members search):", err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, members: rows });
    });
});

app.get('/api/admin/members', authenticateAdmin, (req, res) => {
    const query = `
        SELECT 
            u.customer_id, 
            u.name, 
            u.email, 
            u.phone, 
            u.created_at,
            COUNT(o.order_id) AS order_count,
            COALESCE(SUM(o.final_amount), 0) AS total_spent
        FROM Users u
        LEFT JOIN Orders o ON u.customer_id = o.customer_id
        WHERE u.role = 'customer'
        GROUP BY u.customer_id
        ORDER BY u.created_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("SQL Error (members list):", err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, members: rows });
    });
});

app.get('/api/admin/employees', authenticateAdmin, (req, res) => {
    db.all(`SELECT * FROM Employees ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            employees: rows
        });
    });
});

app.get('/api/admin/employees/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    db.get(`SELECT * FROM Employees WHERE employee_id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        if (!row) return res.status(404).json({
            error: 'Employee not found'
        });
        res.json({
            success: true,
            employee: row
        });
    });
});

app.post('/api/admin/employees', authenticateAdmin, (req, res) => {
    const {
        name,
        email,
        phone,
        position,
        salary,
        hire_date
    } = req.body;

    db.run(
        `INSERT INTO Employees (name, email, phone, position, salary, hire_date) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, phone, position, salary, hire_date],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                employee_id: this.lastID
            });
        }
    );
});

app.put('/api/admin/employees/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    const {
        name,
        email,
        phone,
        position,
        salary,
        hire_date
    } = req.body;

    db.run(
        `UPDATE Employees SET name = ?, email = ?, phone = ?, position = ?, 
         salary = ?, hire_date = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?`,
        [name, email, phone, position, salary, hire_date, id],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                changes: this.changes
            });
        }
    );
});

app.delete('/api/admin/employees/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    db.run(`DELETE FROM Employees WHERE employee_id = ?`, [id], function (err) {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            changes: this.changes
        });
    });
});

// ============= ADMIN PROMOTIONS ENDPOINTS =============
app.get('/api/admin/promotions', authenticateAdmin, (req, res) => {
    const query = `
        SELECT p.*, 
               GROUP_CONCAT(DISTINCT c.name) as categories,
               GROUP_CONCAT(DISTINCT pr.name) as products
        FROM Promotions p
        LEFT JOIN Promotion_Categories pc ON p.promotion_id = pc.promotion_id
        LEFT JOIN Categories c ON pc.category_id = c.category_id
        LEFT JOIN Promotion_Products pp ON p.promotion_id = pp.promotion_id
        LEFT JOIN Products pr ON pp.product_id = pr.product_id
        GROUP BY p.promotion_id
        ORDER BY p.created_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            promotions: rows
        });
    });
});

app.get('/api/admin/promotions/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    db.get(`SELECT * FROM Promotions WHERE promotion_id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        if (!row) return res.status(404).json({
            error: 'Promotion not found'
        });
        res.json({
            success: true,
            promotion: row
        });
    });
});

app.post('/api/admin/promotions', authenticateAdmin, (req, res) => {
    const {
        name,
        description,
        type,
        discount_value,
        buy_quantity,
        get_quantity,
        min_order_amount,
        max_discount_amount,
        usage_limit,
        usage_per_customer,
        start_date,
        end_date,
        status,
        promo_code
    } = req.body;

    db.run(
        `INSERT INTO Promotions (name, description, type, discount_value, buy_quantity, 
         get_quantity, min_order_amount, max_discount_amount, usage_limit, 
         usage_per_customer, start_date, end_date, status, promo_code) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, description, type, discount_value, buy_quantity, get_quantity,
            min_order_amount, max_discount_amount, usage_limit, usage_per_customer,
            start_date, end_date, status, promo_code
        ],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                promotion_id: this.lastID
            });
        }
    );
});

app.put('/api/admin/promotions/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    const {
        name,
        description,
        type,
        discount_value,
        buy_quantity,
        get_quantity,
        min_order_amount,
        max_discount_amount,
        usage_limit,
        usage_per_customer,
        start_date,
        end_date,
        status,
        promo_code
    } = req.body;

    db.run(
        `UPDATE Promotions SET name = ?, description = ?, type = ?, discount_value = ?, 
         buy_quantity = ?, get_quantity = ?, min_order_amount = ?, max_discount_amount = ?, 
         usage_limit = ?, usage_per_customer = ?, start_date = ?, end_date = ?, 
         status = ?, promo_code = ?, updated_at = CURRENT_TIMESTAMP WHERE promotion_id = ?`,
        [name, description, type, discount_value, buy_quantity, get_quantity,
            min_order_amount, max_discount_amount, usage_limit, usage_per_customer,
            start_date, end_date, status, promo_code, id
        ],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                changes: this.changes
            });
        }
    );
});

app.delete('/api/admin/promotions/:id', authenticateAdmin, (req, res) => {
    const {
        id
    } = req.params;
    db.run(`DELETE FROM Promotions WHERE promotion_id = ?`, [id], function (err) {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            changes: this.changes
        });
    });
});

// ============= CUSTOMER COUPONS MANAGEMENT =============
app.get('/api/admin/customer-coupons', authenticateAdmin, (req, res) => {
    const query = `
        SELECT cc.*, u.name as customer_name, u.email, p.name as promo_name, p.promo_code
        FROM Customer_Coupons cc
        JOIN Users u ON cc.customer_id = u.customer_id
        JOIN Promotions p ON cc.promotion_id = p.promotion_id
        ORDER BY cc.created_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            coupons: rows
        });
    });
});

app.post('/api/admin/assign-coupon', authenticateAdmin, (req, res) => {
    const {
        customer_id,
        promotion_id,
        expires_at
    } = req.body;

    db.run(
        `INSERT INTO Customer_Coupons (customer_id, promotion_id, expires_at) 
         VALUES (?, ?, ?)`,
        [customer_id, promotion_id, expires_at],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                coupon_id: this.lastID
            });
        }
    );
});

// System health and metrics
app.get('/api/admin/system/metrics', authenticateAdmin, (req, res) => {
    const metrics = {
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            version: process.version,
            platform: process.platform
        },
        database: {
            connected: true,
            last_backup: null // You can implement backup tracking
        },
        performance: {
            response_time: Date.now(), // You can implement actual response time tracking
            error_rate: 0 // You can implement error rate tracking
        }
    };

    // Test database connection
    db.get('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"', [], (err, result) => {
        if (err) {
            metrics.database.connected = false;
            metrics.database.error = err.message;
        } else {
            metrics.database.tables_count = result.count;
        }

        res.json({
            success: true,
            metrics
        });
    });
});

// Export data endpoints
app.get('/api/admin/export/orders', authenticateAdmin, (req, res) => {
    const {
        start_date,
        end_date,
        status
    } = req.query;

    let query = `
        SELECT o.*, u.name as customer_name, u.email as customer_email
        FROM Orders o 
        JOIN Users u ON o.customer_id = u.customer_id 
        WHERE 1=1
    `;
    let params = [];

    if (start_date) {
        query += ' AND DATE(o.created_at) >= ?';
        params.push(start_date);
    }

    if (end_date) {
        query += ' AND DATE(o.created_at) <= ?';
        params.push(end_date);
    }

    if (status) {
        query += ' AND o.order_status = ?';
        params.push(status);
    }

    query += ' ORDER BY o.created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });

        // Convert to CSV format
        const csvHeader = 'Order ID,Customer Name,Customer Email,Total Amount,Final Amount,Status,Order Date\n';
        const csvRows = rows.map(row =>
            `${row.order_id},"${row.customer_name}","${row.customer_email}",${row.total_amount},${row.final_amount},"${row.order_status}","${row.created_at}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="orders_export.csv"');
        res.send(csvHeader + csvRows);
    });
});

// Activity log for admin actions
app.post('/api/admin/log', authenticateAdmin, (req, res) => {
    const {
        action,
        entity_type,
        entity_id,
        details
    } = req.body;

    db.run(`
        INSERT INTO System_Logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        req.user.customer_id,
        action,
        entity_type,
        entity_id,
        details,
        req.ip || req.connection.remoteAddress
    ], function (err) {
        if (err) console.error('Error logging admin action:', err);
        res.json({
            success: !err,
            log_id: this.lastID
        });
    });
});

// Get activity logs
app.get('/api/admin/logs', authenticateAdmin, (req, res) => {
    const {
        limit = 50, offset = 0
    } = req.query;

    const query = `
        SELECT sl.*, u.name as user_name
        FROM System_Logs sl
        LEFT JOIN Users u ON sl.user_id = u.customer_id
        ORDER BY sl.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [parseInt(limit), parseInt(offset)], (err, rows) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            success: true,
            logs: rows
        });
    });
});

// Initialize System_Logs table if it doesn't exist
function createSystemLogsTable() {
    db.run(`
        CREATE TABLE IF NOT EXISTS System_Logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES Users(customer_id)
        )
    `);
}

// Call this in your initializeDatabase function
// Add this line to your initializeDatabase() function:
// createSystemLogsTable();

// Update your existing login route to handle admin redirect
app.post('/api/auth/login', (req, res) => {
    const {
        email,
        password
    } = req.body;

    db.get('SELECT * FROM Users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({
            success: false,
            error: "DB Error"
        });
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({
                success: false,
                error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            });
        }

        const token = jwt.sign({
            customer_id: user.customer_id,
            name: user.name,
            email: user.email,
            role: user.role
        }, JWT_SECRET, {
            expiresIn: '24h'
        });

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            maxAge: 24 * 60 * 60 * 1000
        });

        // Redirect admin users to admin panel
        const redirectTo = user.role === 'admin' ? '/admin' : '/';
        res.json({
            success: true,
            redirectTo: redirectTo
        });
    });
});

// Error handling middleware for admin routes
// app.use('/api/admin/*', (err, req, res, next) => {
//     console.error('Admin API Error:', err);
//     res.status(500).json({
//         success: false,
//         error: 'Internal server error',
//         details: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
// });

app.get('/api/search', (req, res) => {
    const {
        q
    } = req.query;

    if (!q || q.trim().length < 2) {
        return res.status(400).json({
            success: false,
            error: "คำค้นหาต้องมีอย่างน้อย 2 ตัวอักษร"
        });
    }

    const query = `
        SELECT p.*, c.name as category_name
        FROM Products p
        LEFT JOIN Categories c ON p.category_id = c.category_id
        WHERE p.status = 'available' 
        AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)
        ORDER BY p.name
        LIMIT 20
    `;

    const searchTerm = `%${q.trim()}%`;

    db.all(query, [searchTerm, searchTerm, searchTerm], (err, rows) => {
        if (err) {
            console.error("Search error:", err.message);
            return res.status(500).json({
                success: false,
                error: "เกิดข้อผิดพลาดในการค้นหา"
            });
        }

        res.json({
            success: true,
            products: rows,
            query: q,
            count: rows.length
        });
    });
});

app.post('/api/orders', authenticateToken, (req, res) => {
    const {
        total_amount,
        discount_amount,
        final_amount,
        delivery_address,
        promo_code
    } = req.body;
    const customer_id = req.user.customer_id;

    db.run(
        `INSERT INTO Orders (customer_id, total_amount, discount_amount, final_amount, delivery_address, promo_code) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [customer_id, total_amount, discount_amount || 0, final_amount, delivery_address, promo_code],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                order_id: this.lastID
            });
        }
    );
});

app.post('/api/reviews', authenticateToken, (req, res) => {
    const {
        product_id,
        rating,
        comment
    } = req.body;
    const customer_id = req.user.customer_id;

    db.run(
        `INSERT INTO Reviews (product_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)`,
        [product_id, customer_id, rating, comment],
        function (err) {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true,
                review_id: this.lastID
            });
        }
    );
});

app.use((err, req, res, next) => {
    console.error(err.stack);

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์'
        });
    } else {
        res.status(500).render('404', {
            title: 'เกิดข้อผิดพลาด',
            message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์'
        });
    }
});

app.use((req, res) => {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.status(404).json({
            success: false,
            error: 'ไม่พบหน้าที่ต้องการ'
        });
    } else {
        res.status(404).render('404', {
            title: 'ไม่พบหน้าที่ต้องการ'
        });
    }
});

function createSystemLogsTable() {
    db.run(`
        CREATE TABLE IF NOT EXISTS System_Logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES Users(customer_id)
        )
    `);
}

// const logAdminAction = (action, entityType, entityId = null, details = null) => {
//     return (req, res, next) => {
//         const originalSend = res.send;
//         res.send = function(data) {
//             if (res.statusCode >= 200 && res.statusCode < 300) {
//                 const logData = {
//                     user_id: req.user.customer_id,
//                     action: action,
//                     entity_type: entityType,
//                     entity_id: entityId,
//                     details: details || JSON.stringify(req.body),
//                     ip_address: req.ip || req.connection.remoteAddress
//                 };

//                 db.run(`
//                     INSERT INTO System_Logs (user_id, action, entity_type, entity_id, details, ip_address)
//                     VALUES (?, ?, ?, ?, ?, ?)
//                 `, [logData.user_id, logData.action, logData.entity_type, 
//                     logData.entity_id, logData.details, logData.ip_address]);
//             }
//             originalSend.call(this, data);
//         };
//         next();
//     };
// };

app.listen(PORT, () => {
    console.log(`🚀 Restaurant Server running on port ${PORT}`);
    console.log(`📊 Database: ${dbPath}`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
});

module.exports = app;