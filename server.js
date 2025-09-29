const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "restaurant-secret-key";

// Database setup
const dbPath = path.join(__dirname, "database", "database.db");
const db = new sqlite3.Database(dbPath);

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use("/images", express.static(path.join(__dirname, "public/images")));
app.use(express.static("public"));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "restaurant-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

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

    db.get(
      `SELECT customer_id, name, email, role FROM Users WHERE customer_id = ?`,
      [user.customer_id],
      (dbErr, dbUser) => {
        if (dbErr || !dbUser) {
          res.locals.user = null;
          res.clearCookie("token");
          return next();
        }

        res.locals.user = dbUser;
        next();
      }
    );
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public/images"));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + path.extname(file.originalname);
    cb(null, unique);
  },
});

const upload = multer({
  storage
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token)
    return res.status(401).json({
      error: "Access token required",
    });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid or expired token",
      });
    req.user = user;
    next();
  });
};

const authenticateAdmin = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(401).json({
        error: "Access token required",
      });
    }
    return res.redirect("/login");
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (
        req.headers.accept &&
        req.headers.accept.includes("application/json")
      ) {
        return res.status(403).json({
          error: "Invalid token",
        });
      }
      return res.redirect("/login");
    }

    if (user.role !== "admin") {
      if (
        req.headers.accept &&
        req.headers.accept.includes("application/json")
      ) {
        return res.status(403).json({
          error: "Admin access required",
        });
      }
      return res.redirect("/");
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
      error: "Access token required",
    });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        success: false,
        error: "Invalid token",
      });
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }
    req.user = user;
    next();
  });
}

function authenticateAdminPage(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || user.role !== "admin") return res.redirect("/login");
    req.user = user;
    next();
  });
}

function authenticateUser(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "กรุณาเข้าสู่ระบบก่อนสั่งซื้อ",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || user.role !== "customer") {
      return res.status(401).json({
        success: false,
        error: "สิทธิ์ไม่ถูกต้อง",
      });
    }

    req.user = user;
    next();
  });
}

initializeDatabase();

function initializeDatabase() {
  console.log("Initializing database...");

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

  db.run(`
    CREATE TABLE IF NOT EXISTS Password_Resets (
      reset_id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("✅ Database initialized.");

  setTimeout(() => {
    db.get("SELECT COUNT(*) as count FROM Categories", (err, row) => {
      if (err) return console.error("❌ Seed check error:", err);

      if (row.count === 0) {
        console.log("🌱 Running seed data...");
        const { runSeed } = require("./seed.js");
        runSeed().then(() => {
          console.log("🌱 Seed completed successfully!");
        });
      } else {
        console.log("⚠️ Seed skipped: data already exists.");
      }
    });
  }, 1000); 
}

app.get("/", (req, res) => {
  try {
    db.all(
      "SELECT category_id, name FROM Categories",
      [],
      (err, categories) => {
        if (err) return res.status(500).send("DB error: " + err.message);

        db.all(
          `
                SELECT product_id, name, price, image_url, category_id 
                FROM Products 
                WHERE status = 'available'
                ORDER BY created_at DESC
        
      `,
          [],
          (err, products) => {
            if (err) return res.status(500).send("DB error: " + err.message);

            db.all(
              `
                    SELECT r.review_id, r.comment, r.rating, r.created_at, u.name 
                    FROM Reviews r
                    JOIN Users u ON r.customer_id = u.customer_id
                    WHERE r.comment IS NOT NULL AND r.comment != ''
                    ORDER BY r.created_at DESC
                    LIMIT 5
        `,
              [],
              (err, reviews) => {
                if (err)
                  return res.status(500).send("DB error: " + err.message);

                res.render("index", {
                  title: "T&KFood",
                  categories,
                  products,
                  reviews,
                  user: res.locals.user,
                });
              }
            );
          }
        );
      }
    );
  } catch (err) {
    console.error("Error on / :", err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
});

app.get("/login", (req, res) =>
  res.render("login", {
    title: "เข้าสู่ระบบ",
  })
);
app.get("/register", (req, res) =>
  res.render("register", {
    title: "สมัครสมาชิก",
  })
);
app.get("/cart", (req, res) =>
  res.render("cart", {
    title: "ตะกร้าสินค้า",
  })
);
app.get("/favorites", (req, res) =>
  res.render("favorites", {
    title: "สินค้าที่ถูกใจ",
  })
);

// Register
app.post("/api/auth/register", (req, res) => {
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
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).send("อีเมลนี้ถูกใช้งานแล้ว");
        }
        return res.status(500).send("เกิดข้อผิดพลาด: " + err.message);
      }

      db.get(
        "SELECT * FROM Users WHERE customer_id = ?",
        [this.lastID],
        (err, user) => {
          if (err) return res.status(500).send("DB Error");

          const token = jwt.sign({
              customer_id: user.customer_id,
              name: user.name,
              email: user.email,
              role: user.role,
            },
            JWT_SECRET, {
              expiresIn: "24h",
            }
          );

          res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            maxAge: 24 * 60 * 60 * 1000,
          });

          res.redirect("/");
        }
      );
    }
  );
});

// Login
app.post("/api/auth/login", (req, res) => {
  const {
    email,
    password
  } = req.body;

  db.get(`SELECT * FROM Users WHERE email = ?`, [email], (err, user) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        success: false,
        error: "Database error",
      });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    const token = jwt.sign({
        customer_id: user.customer_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET, {
        expiresIn: "24h",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    });

    const redirectTo = user.role === "admin" ? "/admin" : "/";

    res.json({
      success: true,
      redirectTo: redirectTo,
      user: {
        id: user.customer_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  });
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

app.get("/api/users", authenticateToken, authenticateAdmin, (req, res) => {
  db.all(
    `SELECT customer_id, name, email, role, created_at FROM Users`,
    [],
    (err, rows) => {
      if (err)
        return res.status(500).json({
          error: err.message,
        });
      res.json({
        success: true,
        users: rows,
      });
    }
  );
});

app.get("/profile", authenticateUser, (req, res) => {
  const customer_id = req.user.customer_id;

  db.get(
    `SELECT customer_id, name, email, phone, address FROM Users WHERE customer_id = ?`,
    [customer_id],
    (err, user) => {
      if (err || !user) {
        console.error("DB error:", err);
        return res.status(500).send("ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
      }
      res.render("edit-profile", {
        customer: user
      });
    }
  );
});

app.put("/api/users/profile", authenticateUser, (req, res) => {
  const userId = req.user.customer_id;
  const fields = ["name", "email", "phone", "address"];
  const updates = [];
  const values = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      message: "ไม่มีข้อมูลสำหรับอัปเดต"
    });
  }

  values.push(userId);

  db.run(`UPDATE Users SET ${updates.join(", ")} WHERE customer_id = ?`,
    values,
    function (err) {
      if (err) return res.status(500).json({
        success: false,
        message: "DB ERROR"
      });
      res.json({
        success: true,
        message: "อัปเดตโปรไฟล์สำเร็จ"
      });
    });
});

app.put("/api/users/change-password", authenticateUser, (req, res) => {
  const customer_id = req.user.customer_id;
  const {
    oldPassword,
    newPassword
  } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่",
    });
  }

  db.get(
    `SELECT password FROM Users WHERE customer_id = ?`,
    [customer_id],
    async (err, user) => {
      if (err || !user) {
        console.error("DB error:", err);
        return res
          .status(500)
          .json({
            success: false,
            error: "ไม่พบข้อมูลผู้ใช้"
          });
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({
            success: false,
            error: "รหัสผ่านเดิมไม่ถูกต้อง"
          });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      db.run(
        `UPDATE Users SET password = ? WHERE customer_id = ?`,
        [hashedPassword, customer_id],
        function (err) {
          if (err) {
            console.error("DB ERROR (change password):", err);
            return res
              .status(500)
              .json({
                success: false,
                error: err.message
              });
          }

          res.json({
            success: true,
            message: "เปลี่ยนรหัสผ่านสำเร็จ"
          });
        }
      );
    }
  );
});

// Get cart items
app.get("/api/cart", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
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
        console.error("Cart query error:", err);
        return res.status(500).json({
          error: err.message,
        });
      }
      res.json({
        success: true,
        cart: rows,
      });
    });
  });
});

// Add product to cart
app.post("/api/cart/add", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
      });

    const {
      product_id,
      quantity = 1
    } = req.body;
    const customer_id = user.customer_id;

    if (!product_id) {
      return res.status(400).json({
        error: "ต้องระบุสินค้า",
      });
    }

    db.get(
      `SELECT product_id, price FROM Products WHERE product_id = ? AND status = 'available'`,
      [product_id],
      (err, product) => {
        if (err)
          return res.status(500).json({
            error: err.message,
          });
        if (!product)
          return res.status(404).json({
            error: "ไม่พบสินค้าหรือสินค้าไม่พร้อมจำหน่าย",
          });

        db.get(
          `SELECT cart_id FROM Carts WHERE customer_id = ?`,
          [customer_id],
          (err, cart) => {
            if (err)
              return res.status(500).json({
                error: err.message,
              });

            const ensureCart = (cart_id) => {
              db.get(
                `SELECT cart_item_id, quantity FROM Cart_Items WHERE cart_id = ? AND product_id = ?`,
                [cart_id, product_id],
                (err, item) => {
                  if (err)
                    return res.status(500).json({
                      error: err.message,
                    });

                  if (item) {
                    db.run(
                      `UPDATE Cart_Items SET quantity = quantity + ?, 
                                    updated_at = CURRENT_TIMESTAMP WHERE cart_item_id = ?`,
                      [quantity, item.cart_item_id],
                      function (err) {
                        if (err)
                          return res.status(500).json({
                            error: err.message,
                          });
                        res.json({
                          success: true,
                          message: "อัปเดตจำนวนสินค้าในตะกร้าแล้ว",
                          updated: true,
                        });
                      }
                    );
                  } else {
                    db.run(
                      `INSERT INTO Cart_Items (cart_id, product_id, quantity, price)
                                    VALUES (?, ?, ?, ?)`,
                      [cart_id, product_id, quantity, product.price],
                      function (err) {
                        if (err)
                          return res.status(500).json({
                            error: err.message,
                          });
                        res.json({
                          success: true,
                          message: "เพิ่มสินค้าลงตะกร้าเรียบร้อย",
                          added: true,
                        });
                      }
                    );
                  }
                }
              );
            };

            if (!cart) {
              db.run(
                `INSERT INTO Carts (customer_id) VALUES (?)`,
                [customer_id],
                function (err) {
                  if (err)
                    return res.status(500).json({
                      error: err.message,
                    });
                  ensureCart(this.lastID);
                }
              );
            } else {
              ensureCart(cart.cart_id);
            }
          }
        );
      }
    );
  });
});

// Update product quantity in cart
app.post("/api/cart/update", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
      });

    const {
      itemId,
      quantity
    } = req.body;
    const customer_id = user.customer_id;

    if (!itemId || quantity === undefined) {
      return res.status(400).json({
        error: "ข้อมูลไม่ครบถ้วน",
      });
    }

    db.get(
      `SELECT cart_id FROM Carts WHERE customer_id = ?`,
      [customer_id],
      (err, cart) => {
        if (err)
          return res.status(500).json({
            error: err.message,
          });
        if (!cart)
          return res.status(404).json({
            error: "ไม่พบตะกร้าสินค้า",
          });

        if (quantity <= 0) {
          db.run(
            `DELETE FROM Cart_Items WHERE cart_id = ? AND product_id = ?`,
            [cart.cart_id, itemId],
            function (err) {
              if (err)
                return res.status(500).json({
                  error: err.message,
                });
              res.json({
                success: true,
                message: "ลบสินค้าออกจากตะกร้าแล้ว",
                removed: this.changes > 0,
              });
            }
          );
        } else {
          db.run(
            `UPDATE Cart_Items SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
                        WHERE cart_id = ? AND product_id = ?`,
            [quantity, cart.cart_id, itemId],
            function (err) {
              if (err)
                return res.status(500).json({
                  error: err.message,
                });
              res.json({
                success: true,
                message: "อัปเดตจำนวนสินค้าแล้ว",
                updated: this.changes > 0,
              });
            }
          );
        }
      }
    );
  });
});

// Remove product from cart
app.delete("/api/cart/remove/:id", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
      });

    const product_id = parseInt(req.params.id);
    const customer_id = user.customer_id;

    db.get(
      `SELECT cart_id FROM Carts WHERE customer_id = ?`,
      [customer_id],
      (err, cart) => {
        if (err)
          return res.status(500).json({
            error: err.message,
          });
        if (!cart)
          return res.status(404).json({
            error: "ไม่พบตะกร้าสินค้า",
          });

        db.run(
          `DELETE FROM Cart_Items WHERE cart_id = ? AND product_id = ?`,
          [cart.cart_id, product_id],
          function (err) {
            if (err)
              return res.status(500).json({
                error: err.message,
              });
            res.json({
              success: true,
              message: "ลบสินค้าออกจากตะกร้าเรียบร้อย",
              removed: this.changes > 0,
            });
          }
        );
      }
    );
  });
});

app.get("/api/cart/count", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json({
      count: 0,
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.json({
        count: 0,
      });

    const customer_id = user.customer_id;
    const query = `
            SELECT COALESCE(SUM(ci.quantity), 0) as count
            FROM Cart_Items ci
            JOIN Carts c ON ci.cart_id = c.cart_id
            WHERE c.customer_id = ?
        `;

    db.get(query, [customer_id], (err, row) => {
      if (err)
        return res.json({
          count: 0,
        });
      res.json({
        count: row.count || 0,
      });
    });
  });
});

// Get favorites
app.get("/api/favorites", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
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
        console.error("Favorites query error:", err);
        return res.status(500).json({
          error: err.message,
        });
      }
      res.json({
        success: true,
        favorites: rows,
      });
    });
  });
});

// Add to favorites
app.post("/api/favorites/add/:id", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
      });

    const product_id = parseInt(req.params.id);
    const customer_id = user.customer_id;

    if (!product_id || isNaN(product_id)) {
      return res.status(400).json({
        error: "รหัสสินค้าไม่ถูกต้อง",
      });
    }

    db.get(
      `SELECT product_id FROM Products WHERE product_id = ? AND status = 'available'`,
      [product_id],
      (err, product) => {
        if (err)
          return res.status(500).json({
            error: err.message,
          });
        if (!product)
          return res.status(404).json({
            error: "ไม่พบสินค้า",
          });

        db.get(
          `SELECT favorite_id FROM Favorites WHERE customer_id = ? AND product_id = ?`,
          [customer_id, product_id],
          (err, row) => {
            if (err)
              return res.status(500).json({
                error: err.message,
              });

            if (row) {
              return res.json({
                success: true,
                message: "สินค้าอยู่ใน Favorites อยู่แล้ว",
                already_exists: true,
              });
            }

            db.run(
              `INSERT INTO Favorites (customer_id, product_id) VALUES (?, ?)`,
              [customer_id, product_id],
              function (err) {
                if (err)
                  return res.status(500).json({
                    error: err.message,
                  });
                res.json({
                  success: true,
                  message: "เพิ่มเป็นสินค้าที่ชอบเรียบร้อย",
                  favorite_id: this.lastID,
                });
              }
            );
          }
        );
      }
    );
  });
});

// Remove from favorites
app.delete("/api/favorites/remove/:id", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
      });

    const product_id = parseInt(req.params.id);
    const customer_id = user.customer_id;

    db.run(
      `DELETE FROM Favorites WHERE customer_id = ? AND product_id = ?`,
      [customer_id, product_id],
      function (err) {
        if (err)
          return res.status(500).json({
            error: err.message,
          });
        res.json({
          success: true,
          message: "ลบออกจากรายการโปรดเรียบร้อย",
          removed: this.changes > 0,
        });
      }
    );
  });
});

// Count favorites
app.get("/api/favorites/count", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json({
      count: 0,
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.json({
        count: 0,
      });

    const customer_id = user.customer_id;
    db.get(
      `SELECT COUNT(*) as count FROM Favorites WHERE customer_id = ?`,
      [customer_id],
      (err, row) => {
        if (err)
          return res.json({
            count: 0,
          });
        res.json({
          count: row.count || 0,
        });
      }
    );
  });
});

app.get("/coupons", (req, res) => {
  res.render("coupons");
});

app.get("/api/coupons", (req, res) => {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
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
      if (err)
        return res.status(500).json({
          error: err.message,
        });

      res.json({
        success: true,
        coupons: rows,
      });
    });
  });
});

// Claim coupon (insert into Customer_Coupons)
app.post("/api/coupons/claim", (req, res) => {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({
      success: false,
      message: "กรุณาเข้าสู่ระบบก่อน",
    });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        success: false,
        message: "Token ไม่ถูกต้อง",
      });

    const {
      promotion_id
    } = req.body;
    const customer_id = user.customer_id;

    if (!promotion_id) {
      return res.status(400).json({
        success: false,
        message: "promotion_id ไม่ถูกต้อง",
      });
    }

    const checkQuery = `SELECT * FROM Customer_Coupons WHERE promotion_id = ? AND customer_id = ?`;
    db.get(checkQuery, [promotion_id, customer_id], (err, row) => {
      if (err)
        return res.status(500).json({
          success: false,
          message: err.message,
        });

      if (row) {
        return res.json({
          success: false,
          message: "คุณรับคูปองนี้ไปแล้ว",
        });
      }

      const promoQuery = `SELECT * FROM Promotions WHERE promotion_id = ?`;
      db.get(promoQuery, [promotion_id], (err, promotion) => {
        if (err || !promotion) {
          return res.status(404).json({
            success: false,
            message: "ไม่พบโปรโมชั่น",
          });
        }

        const insertQuery = `
          INSERT INTO Customer_Coupons (customer_id, promotion_id, status, expires_at) 
          VALUES (?, ?, 'available', ?)
        `;
        db.run(
          insertQuery,
          [customer_id, promotion_id, promotion.end_date],
          function (err) {
            if (err)
              return res.status(500).json({
                success: false,
                message: err.message,
              });

            res.json({
              success: true,
              message: "รับคูปองสำเร็จแล้ว!",
            });
          }
        );
      });
    });
  });
});

app.get("/api/coupons/available", (req, res) => {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
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
      if (err)
        return res.status(500).json({
          error: err.message,
        });

      res.json({
        success: true,
        coupons: rows,
      });
    });
  });
});

// Get all active promotions
app.get("/api/promotions/active", (req, res) => {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
      });

    const customer_id = user.customer_id;

    const query = `
      SELECT p.*
      FROM Promotions p
      WHERE p.status = 'active'
        AND datetime(p.start_date) <= datetime('now')
        AND datetime(p.end_date) >= datetime('now')
        AND NOT EXISTS (
          SELECT 1 
          FROM Customer_Coupons cc 
          WHERE cc.customer_id = ? 
            AND cc.promotion_id = p.promotion_id
        )
      ORDER BY datetime(p.created_at) DESC
    `;

    db.all(query, [customer_id], (err, rows) => {
      if (err)
        return res.status(500).json({
          error: err.message,
        });

      res.json({
        success: true,
        promotions: rows,
      });
    });
  });
});

// Validate promo code
app.post("/api/promotions/validate", (req, res) => {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
      });

    const {
      promo_code,
      order_amount,
      cart_items
    } = req.body;
    const customer_id = user.customer_id;

    if (!promo_code || !order_amount) {
      return res.status(400).json({
        error: "ข้อมูลไม่ครบถ้วน",
      });
    }

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
      if (err)
        return res.status(500).json({
          error: err.message,
        });

      if (!coupon) {
        return res.status(400).json({
          valid: false,
          message: "รหัสโปรโมชั่นไม่ถูกต้อง, หมดอายุแล้ว หรือยังไม่ได้รับคูปองนี้",
        });
      }

      if (order_amount < coupon.min_order_amount) {
        return res.status(400).json({
          valid: false,
          message: `ยอดสั่งซื้อขั้นต่ำ ${coupon.min_order_amount} บาท`,
        });
      }

      if (coupon.usage_per_customer) {
        const usageQuery = `
                    SELECT COUNT(*) as usage_count 
                    FROM Promotion_Usage 
                    WHERE promotion_id = ? AND customer_id = ?
                `;
        db.get(usageQuery, [coupon.promotion_id, customer_id], (err2, row) => {
          if (err2)
            return res.status(500).json({
              error: err2.message,
            });

          if (row.usage_count >= coupon.usage_per_customer) {
            return res.status(400).json({
              valid: false,
              message: "คุณใช้โปรโมชั่นนี้ครบจำนวนที่กำหนดแล้ว",
            });
          }

          const discount = calculateDiscount(
            coupon,
            order_amount,
            cart_items || []
          );
          res.json({
            valid: true,
            coupon,
            discount,
            message: `ใช้ส่วนลดได้ ${discount.amount} บาท`,
          });
        });
      } else {
        const discount = calculateDiscount(
          coupon,
          order_amount,
          cart_items || []
        );
        res.json({
          valid: true,
          coupon,
          discount,
          message: `ใช้ส่วนลดได้ ${discount.amount} บาท`,
        });
      }
    });
  });
});

app.post("/api/coupons/use", (req, res) => {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน",
    });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({
        error: "Invalid token",
      });

    const {
      promo_code,
      order_amount
    } = req.body;
    const customer_id = user.customer_id;

    if (!promo_code) {
      return res.status(400).json({
        error: "กรุณาระบุรหัสคูปอง",
      });
    }

    const getCouponQuery = `
            SELECT cc.coupon_id, cc.status, p.*
            FROM Customer_Coupons cc
            JOIN Promotions p ON cc.promotion_id = p.promotion_id
            WHERE cc.customer_id = ? 
              AND p.promo_code = ?
              AND cc.status = 'available'
        `;

    db.get(getCouponQuery, [customer_id, promo_code], (err, coupon) => {
      if (err)
        return res.status(500).json({
          error: err.message,
        });
      if (!coupon)
        return res.status(404).json({
          error: "ไม่พบคูปองที่ใช้ได้",
        });

      const updateQuery = `
                UPDATE Customer_Coupons 
                SET status = 'used' 
                WHERE coupon_id = ? AND customer_id = ?
            `;

      db.run(updateQuery, [coupon.coupon_id, customer_id], function (err) {
        if (err)
          return res.status(500).json({
            error: err.message,
          });

        const discount = calculateDiscount(coupon, order_amount, []);

        res.json({
          success: true,
          message: "ใช้คูปองเรียบร้อยแล้ว",
          discount: discount,
        });
      });
    });
  });
});

// Temporary endpoint to insert test promotions
app.get("/api/test/insert-promotions", (req, res) => {
  const testPromotions = [
    [
      "ส่วนลด 20%",
      "ลด 20% สำหรับการสั่งซื้อครั้งแรก",
      "percentage",
      20,
      null,
      null,
      200,
      100,
      100,
      1,
      "NEW20",
    ],
    [
      "ลด 50 บาท",
      "ลดทันที 50 บาท เมื่อสั่งอาหารครบ 300 บาท",
      "fixed_amount",
      50,
      null,
      null,
      300,
      null,
      null,
      null,
      "SAVE50",
    ],
  ];

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO Promotions 
    (name, description, type, discount_value, buy_quantity, get_quantity, min_order_amount, max_discount_amount, usage_limit, usage_per_customer, start_date, end_date, status, promo_code) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+1 year'), 'active', ?)
  `);

  testPromotions.forEach((promo) => stmt.run(promo));
  stmt.finalize();

  res.json({
    success: true,
    message: "Test promotions inserted",
  });
});

// Calculate discount function
function calculateDiscount(promotion, order_amount, cart_items) {
  let discount_amount = 0;

  switch (promotion.type) {
    case "percentage":
      discount_amount = (order_amount * promotion.discount_value) / 100;
      if (
        promotion.max_discount_amount &&
        discount_amount > promotion.max_discount_amount
      ) {
        discount_amount = promotion.max_discount_amount;
      }
      break;

    case "fixed_amount":
      discount_amount = promotion.discount_value;
      break;

    case "free_shipping":
      discount_amount = 30;
      break;

    case "category_discount":
      discount_amount = (order_amount * promotion.discount_value) / 100;
      if (
        promotion.max_discount_amount &&
        discount_amount > promotion.max_discount_amount
      ) {
        discount_amount = promotion.max_discount_amount;
      }
      break;

    case "buy_x_get_y":
      discount_amount = 0;
      break;
  }

  return {
    amount: Math.round(discount_amount * 100) / 100,
    type: promotion.type,
    description: promotion.description,
  };
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: "Connected",
  });
});

// Get categories
app.get("/api/categories", (req, res) => {
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
        error: "เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่",
      });
    }

    res.json({
      success: true,
      categories: rows,
    });
  });
});

// Get products
app.get("/api/products", (req, res) => {
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
        error: "เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า",
      });
    }

    res.json({
      success: true,
      products: rows,
      count: rows.length,
    });
  });
});

app.post("/api/products", authenticateToken, authenticateAdmin, (req, res) => {
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
    [category_id, name, description, price, image_url, status || "available"],
    function (err) {
      if (err)
        return res.status(500).json({
          error: err.message,
        });
      res.json({
        success: true,
        product_id: this.lastID,
      });
    }
  );
});

app.get("/admin", authenticateAdminPage, (req, res) => {
  res.render("admin");
});

// Create admin user route (for initial setup)
app.post("/api/admin/create-admin", (req, res) => {
  const {
    email,
    password,
    name
  } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      error: "All fields required",
    });
  }

  db.get('SELECT * FROM Users WHERE role = "admin"', [], (err, admin) => {
    if (err)
      return res.status(500).json({
        error: err.message,
      });

    if (admin) {
      return res.status(400).json({
        error: "Admin user already exists",
      });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
      "INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, "admin"],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({
              error: "Email already exists",
            });
          }
          return res.status(500).json({
            error: err.message,
          });
        }

        res.json({
          success: true,
          message: "Admin user created successfully",
          admin_id: this.lastID,
        });
      }
    );
  });
});

app.get("/api/admin/dashboard/stats", authenticateAdminApi, async (req, res) => {
  try {
    const getOne = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };

    const ordersRow = await getOne(`SELECT COUNT(*) as count FROM Orders`);
    const totalOrders = ordersRow?.count || 0;

    const productsRow = await getOne(`SELECT COUNT(*) as count FROM Products`);
    const totalProducts = productsRow?.count || 0;

    const membersRow = await getOne(
      `SELECT COUNT(*) as count FROM Users WHERE role = 'customer'`
    );
    const totalMembers = membersRow?.count || 0;

    const revenueRow = await getOne(
      `
        SELECT IFNULL(SUM(final_amount), 0) as revenue
        FROM Orders
        WHERE strftime('%Y-%m-%d', created_at) = strftime('%Y-%m-%d', 'now', 'localtime')
          AND order_status = 'completed'
      `
    );
    const revenueToday = revenueRow?.revenue || 0;

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalProducts,
        totalMembers,
        revenueToday,
      },
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/admin/stats", authenticateAdmin, (req, res) => {
  const stats = {};

  db.get(`SELECT COUNT(*) as total_orders FROM Orders`, [], (err, row1) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    stats.total_orders = row1?.total_orders || 0;

    db.get(`SELECT COUNT(*) as total_products FROM Products`, [], (err, row2) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      stats.total_products = row2?.total_products || 0;

      db.get(`SELECT COUNT(*) as total_members FROM Users WHERE role='customer'`, [], (err, row3) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        stats.total_members = row3?.total_members || 0;

        db.get(
          `SELECT IFNULL(SUM(final_amount), 0) as revenue_today
           FROM Orders 
           WHERE strftime('%Y-%m-%d', created_at) = strftime('%Y-%m-%d', 'now', 'localtime')
             AND order_status = 'completed'`,
          [],
          (err, row4) => {
            if (err) {
              console.error("Revenue query error:", err.message);
              stats.revenue_today = 0;
            } else {
              stats.revenue_today = row4?.revenue_today || 0;
              console.log(`Debug Revenue: ${stats.revenue_today}`);
            }
            
            res.json({
              success: true,
              stats
            });
          }
        );
      });
    });
  });
});

app.get("/api/admin/debug/orders", authenticateAdmin, (req, res) => {
  const query = `
    SELECT order_id, customer_id, final_amount, order_status, payment_status, 
           created_at, DATE(created_at) as order_date, DATE('now', 'localtime') as today
    FROM Orders 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ orders: rows });
  });
});

// Enhanced dashboard statistics with revenue
app.get("/api/admin/stats/revenue", authenticateAdmin, (req, res) => {
  const today = new Date().toISOString().split("T")[0];

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
        `,
  };

  db.get(queries.today, [today], (err, todayData) => {
    if (err)
      return res.status(500).json({
        error: err.message,
      });

    db.get(queries.week, [], (err, weekData) => {
      if (err)
        return res.status(500).json({
          error: err.message,
        });

      db.get(queries.month, [], (err, monthData) => {
        if (err)
          return res.status(500).json({
            error: err.message,
          });

        res.json({
          success: true,
          stats: {
            today: todayData,
            week: weekData,
            month: monthData,
          },
        });
      });
    });
  });
});

app.get("/api/admin/stats/orders", authenticateAdmin, (req, res) => {
  db.get("SELECT COUNT(*) as total FROM Orders", (err, row) => {
    if (err) return res.json({
      success: false
    });
    res.json({
      success: true,
      total: row.total
    });
  });
});

app.get("/api/admin/stats/products", authenticateAdmin, (req, res) => {
  db.get("SELECT COUNT(*) as total FROM Products", (err, row) => {
    if (err) return res.json({
      success: false
    });
    res.json({
      success: true,
      total: row.total
    });
  });
});

app.get("/api/admin/stats/members", authenticateAdmin, (req, res) => {
  db.get("SELECT COUNT(*) as total FROM Users WHERE role='customer'", (err, row) => {
    if (err) return res.json({
      success: false
    });
    res.json({
      success: true,
      total: row.total
    });
  });
});

app.get("/api/admin/stats/revenue-today", authenticateAdmin, (req, res) => {
  const query = `
    SELECT IFNULL(SUM(final_amount), 0) as revenue
    FROM Orders
    WHERE DATE(created_at) = DATE('now', 'localtime')
      AND order_status = 'completed'
      AND payment_status = 'paid'
  `;
  
  db.get(query, [], (err, row) => {
    if (err) {
      console.error("Revenue query error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, revenue: row.revenue || 0 });
  });
});

app.get("/api/admin/orders/recent", authenticateAdmin, (req, res) => {
  const query = `
    SELECT o.order_id, o.final_amount, o.order_status, o.created_at,
           u.name AS customer_name
    FROM Orders o
    LEFT JOIN Users u ON o.customer_id = u.customer_id
    ORDER BY o.created_at DESC
    LIMIT 5
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, orders: rows });
  });
});

app.get("/api/admin/orders/filter", authenticateAdmin, (req, res) => {
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
    query += " AND o.order_status = ?";
    params.push(status);
  }

  if (date) {
    query += " AND DATE(o.created_at) = ?";
    params.push(date);
  }

  if (customer) {
    query += " AND (u.name LIKE ? OR u.email LIKE ?)";
    params.push(`%${customer}%`, `%${customer}%`);
  }

  query += " ORDER BY o.created_at DESC LIMIT 100";

  db.all(query, params, (err, rows) => {
    if (err)
      return res.status(500).json({
        error: err.message,
      });
    res.json({
      success: true,
      orders: rows,
    });
  });
});

// Bulk order status update
app.put("/api/admin/orders/bulk-status", authenticateAdmin, (req, res) => {
  const {
    orderIds,
    status
  } = req.body;

  if (!orderIds || !Array.isArray(orderIds) || !status) {
    return res.status(400).json({
      error: "Invalid request data",
    });
  }

  const validStatuses = [
    "pending",
    "accepted",
    "cooking",
    "delivering",
    "completed",
    "cancelled",
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid status",
    });
  }

  const placeholders = orderIds.map(() => "?").join(",");
  const query = `
        UPDATE Orders 
        SET order_status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE order_id IN (${placeholders})
    `;

  db.run(query, [status, ...orderIds], function (err) {
    if (err)
      return res.status(500).json({
        error: err.message,
      });

    res.json({
      success: true,
      message: `${this.changes} orders updated successfully`,
      updated_count: this.changes,
    });
  });
});

app.get("/api/admin/products", authenticateAdmin, (req, res) => {
  db.all(
    `SELECT p.*, c.name as category_name FROM Products p
LEFT JOIN Categories c ON p.category_id=c.category_id`,
    (err, rows) => {
      if (err) return res.json({
        success: false
      });
      res.json({
        success: true,
        products: rows
      });
    }
  );
});

// Advanced product search and filtering
app.get("/api/admin/products/search", authenticateAdminApi, (req, res) => {
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
    query += " AND (p.name LIKE ? OR p.description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }

  if (category) {
    query += " AND p.category_id = ?";
    params.push(category);
  }

  if (status) {
    query += " AND p.status = ?";
    params.push(status);
  }

  if (min_price) {
    query += " AND p.price >= ?";
    params.push(parseFloat(min_price));
  }

  if (max_price) {
    query += " AND p.price <= ?";
    params.push(parseFloat(max_price));
  }

  query += " ORDER BY p.created_at DESC";

  db.all(query, params, (err, rows) => {
    if (err)
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    res.json({
      success: true,
      products: rows,
    });
  });
});

app.get("/api/admin/products/:id", authenticateAdmin, (req, res) => {
  const {
    id
  } = req.params;
  db.get(`SELECT * FROM Products WHERE product_id = ?`, [id], (err, row) => {
    if (err)
      return res.status(500).json({
        error: err.message,
      });
    if (!row)
      return res.status(404).json({
        error: "Product not found",
      });
    res.json({
      success: true,
      product: row,
    });
  });
});

app.post("/api/admin/products", authenticateAdmin, upload.single("image"), (req, res) => {
  const {
    name,
    category_id,
    description,
    price,
    status
  } = req.body;
  const image_url = req.file ? req.file.filename : null;
  db.run(
    `INSERT INTO Products (name, category_id, description, price, image_url, status)
VALUES (?, ?, ?, ?, ?, ?)`,
    [name, category_id || null, description, price, image_url, status],
    function (err) {
      if (err) return res.json({
        success: false
      });
      res.json({
        success: true,
        product_id: this.lastID
      });
    }
  );
});

app.put("/api/admin/products/:id", authenticateAdmin, upload.single("image"), (req, res) => {
  const {
    id
  } = req.params;
  const {
    name,
    category_id,
    description,
    price,
    status
  } = req.body;
  const image_url = req.file ? req.file.filename : req.body.image_url;
  db.run(
    `UPDATE Products SET name=?, category_id=?, description=?, price=?, image_url=?, status=? WHERE product_id=?`,
    [name, category_id || null, description, price, image_url, status, id],
    function (err) {
      if (err) return res.json({
        success: false
      });
      res.json({
        success: true
      });
    }
  );
});

app.delete("/api/admin/products/:id", authenticateAdmin, (req, res) => {
  db.run("DELETE FROM Products WHERE product_id=?", [req.params.id], (err) => {
    if (err) return res.json({
      success: false
    });
    res.json({
      success: true
    });
  });
});

app.get("/api/admin/categories", authenticateAdmin, (req, res) => {
  db.all("SELECT c.*, (SELECT COUNT(*) FROM Products p WHERE p.category_id=c.category_id) as product_count FROM Categories c", (err, rows) => {
    if (err) return res.json({
      success: false
    });
    res.json({
      success: true,
      categories: rows
    });
  });
});

app.get("/api/admin/categories/:id", authenticateAdmin, (req, res) => {
  const {
    id
  } = req.params;
  db.get(`SELECT * FROM Categories WHERE category_id = ?`, [id], (err, row) => {
    if (err)
      return res.status(500).json({
        error: err.message,
      });
    if (!row)
      return res.status(404).json({
        error: "Category not found",
      });
    res.json({
      success: true,
      category: row,
    });
  });
});

app.post("/api/admin/categories", authenticateAdmin, (req, res) => {
  const {
    name
  } = req.body;

  db.run(`INSERT INTO Categories (name) VALUES (?)`, [name], function (err) {
    if (err)
      return res.status(500).json({
        error: err.message,
      });
    res.json({
      success: true,
      category_id: this.lastID,
    });
  });
});

app.put("/api/admin/categories/:id", authenticateAdmin, (req, res) => {
  const {
    id
  } = req.params;
  const {
    name
  } = req.body;

  db.run(
    `UPDATE Categories SET name = ? WHERE category_id = ?`,
    [name, id],
    function (err) {
      if (err)
        return res.status(500).json({
          error: err.message,
        });
      res.json({
        success: true,
        changes: this.changes,
      });
    }
  );
});

app.delete("/api/admin/categories/:id", authenticateAdmin, (req, res) => {
  const {
    id
  } = req.params;
  db.run(`DELETE FROM Categories WHERE category_id = ?`, [id], function (err) {
    if (err)
      return res.status(500).json({
        error: err.message,
      });
    res.json({
      success: true,
      changes: this.changes,
    });
  });
});

app.get("/api/admin/orders", authenticateAdmin, (req, res) => {
  const query = `
    SELECT o.order_id, 
           (o.final_amount) AS final_amount,
           o.order_status, 
           o.created_at,
           u.name AS customer_name,
           e.name AS delivery_person
    FROM Orders o
    JOIN Users u ON o.customer_id = u.customer_id
    LEFT JOIN Employees e ON o.employee_id = e.employee_id
    ORDER BY o.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, orders: rows });
  });
});

app.put("/api/admin/orders/:id/status", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status === 'completed') {
    db.serialize(() => {
      db.run(
        `UPDATE Orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        [status, id]
      );
      
      db.run(
        `UPDATE Payments SET status = 'success' WHERE order_id = ?`,
        [id]
      );
    });
  } else {
    db.run(
      `UPDATE Orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
      [status, id]
    );
  }

  res.json({ success: true });
});

// Enhanced member search
app.get("/api/admin/members/search", authenticateAdmin, (req, res) => {
  const {
    q
  } = req.query;

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
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
    res.json({
      success: true,
      members: rows,
    });
  });
});

app.get("/api/admin/members", authenticateAdmin, (req, res) => {
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
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
    res.json({
      success: true,
      members: rows,
    });
  });
});

app.get("/api/admin/employees", authenticateAdmin, (req, res) => {
  db.all(
    `SELECT * FROM Employees ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err)
        return res.status(500).json({
          error: err.message,
        });
      res.json({
        success: true,
        employees: rows,
      });
    }
  );
});

app.get("/api/admin/employees/:id", authenticateAdmin, (req, res) => {
  const {
    id
  } = req.params;
  db.get(`SELECT * FROM Employees WHERE employee_id = ?`, [id], (err, row) => {
    if (err)
      return res.status(500).json({
        error: err.message,
      });
    if (!row)
      return res.status(404).json({
        error: "Employee not found",
      });
    res.json({
      success: true,
      employee: row,
    });
  });
});

app.post("/api/admin/employees", authenticateAdmin, (req, res) => {
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
      if (err)
        return res.status(500).json({
          error: err.message,
        });
      res.json({
        success: true,
        employee_id: this.lastID,
      });
    }
  );
});

app.put("/api/admin/employees/:id", authenticateAdmin, (req, res) => {
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
      if (err)
        return res.status(500).json({
          error: err.message,
        });
      res.json({
        success: true,
        changes: this.changes,
      });
    }
  );
});

app.delete("/api/admin/employees/:id", authenticateAdmin, (req, res) => {
  const {
    id
  } = req.params;
  db.run(`DELETE FROM Employees WHERE employee_id = ?`, [id], function (err) {
    if (err)
      return res.status(500).json({
        error: err.message,
      });
    res.json({
      success: true,
      changes: this.changes,
    });
  });
});

app.get("/api/admin/promotions", authenticateAdmin, (req, res) => {
  db.all("SELECT * FROM Promotions ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.json({
      success: false
    });
    res.json({
      success: true,
      promotions: rows
    });
  });
});

app.get("/api/admin/promotions/:id", authenticateAdmin, (req, res) => {
  const {
    id
  } = req.params;
  db.get(
    `SELECT * FROM Promotions WHERE promotion_id = ?`,
    [id],
    (err, row) => {
      if (err)
        return res.status(500).json({
          error: err.message,
        });
      if (!row)
        return res.status(404).json({
          error: "Promotion not found",
        });
      res.json({
        success: true,
        promotion: row,
      });
    }
  );
});

app.post("/api/admin/promotions", authenticateAdmin, (req, res) => {
  const {
    name, description, type, discount_value,
    min_order_amount, max_discount_amount,
    start_date, end_date, promo_code
  } = req.body;

  db.run(
    `INSERT INTO Promotions
      (name, description, type, discount_value, min_order_amount, max_discount_amount,
       start_date, end_date, status, promo_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [name, description, type, discount_value, min_order_amount, max_discount_amount, start_date, end_date, promo_code],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, promotion_id: this.lastID });
    }
  );
});

app.put("/api/admin/promotions/:id", authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const {
    name, description, type, discount_value,
    min_order_amount, max_discount_amount,
    start_date, end_date, status, promo_code
  } = req.body;

  db.run(
    `UPDATE Promotions
     SET name=?, description=?, type=?, discount_value=?, min_order_amount=?, max_discount_amount=?,
         start_date=?, end_date=?, status=?, promo_code=?, updated_at=CURRENT_TIMESTAMP
     WHERE promotion_id=?`,
    [name, description, type, discount_value, min_order_amount, max_discount_amount,
     start_date, end_date, status, promo_code, id],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, changes: this.changes });
    }
  );
});

app.delete("/api/admin/promotions/:id", authenticateAdmin, (req, res) => {
  db.run("DELETE FROM Promotions WHERE promotion_id=?", [req.params.id], (err) => {
    if (err) return res.json({
      success: false
    });
    res.json({
      success: true
    });
  });
});

app.get("/api/admin/customer-coupons", authenticateAdmin, (req, res) => {
  const query = `
        SELECT cc.*, u.name as customer_name, u.email, p.name as promo_name, p.promo_code
        FROM Customer_Coupons cc
        JOIN Users u ON cc.customer_id = u.customer_id
        JOIN Promotions p ON cc.promotion_id = p.promotion_id
        ORDER BY cc.created_at DESC
    `;

  db.all(query, [], (err, rows) => {
    if (err)
      return res.status(500).json({
        error: err.message,
      });
    res.json({
      success: true,
      coupons: rows,
    });
  });
});

app.post("/api/admin/assign-coupon", authenticateAdmin, (req, res) => {
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
      if (err)
        return res.status(500).json({
          error: err.message,
        });
      res.json({
        success: true,
        coupon_id: this.lastID,
      });
    }
  );
});

// System health and metrics
app.get("/api/admin/system/metrics", authenticateAdmin, (req, res) => {
  const metrics = {
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform,
    },
    database: {
      connected: true,
      last_backup: null,
    },
    performance: {
      response_time: Date.now(),
      error_rate: 0,
    },
  };

  db.get(
    'SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"',
    [],
    (err, result) => {
      if (err) {
        metrics.database.connected = false;
        metrics.database.error = err.message;
      } else {
        metrics.database.tables_count = result.count;
      }

      res.json({
        success: true,
        metrics,
      });
    }
  );
});

// Export data endpoints
app.get("/api/admin/export/orders", authenticateAdmin, (req, res) => {
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
    query += " AND DATE(o.created_at) >= ?";
    params.push(start_date);
  }

  if (end_date) {
    query += " AND DATE(o.created_at) <= ?";
    params.push(end_date);
  }

  if (status) {
    query += " AND o.order_status = ?";
    params.push(status);
  }

  query += " ORDER BY o.created_at DESC";

  db.all(query, params, (err, rows) => {
    if (err)
      return res.status(500).json({
        error: err.message,
      });

    const csvHeader =
      "Order ID,Customer Name,Customer Email,Total Amount,Final Amount,Status,Order Date\n";
    const csvRows = rows
      .map(
        (row) =>
        `${row.order_id},"${row.customer_name}","${row.customer_email}",${row.total_amount},${row.final_amount},"${row.order_status}","${row.created_at}"`
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="orders_export.csv"'
    );
    res.send(csvHeader + csvRows);
  });
});

app.get("/api/admin/coupons", authenticateAdmin, (req, res) => {
  db.all("SELECT * FROM Promotions ORDER BY promotion_id DESC", [], (err, rows) => {
    if (err) return res.json({
      success: false,
      error: err.message
    });
    res.json({
      success: true,
      coupons: rows
    });
  });
});

app.get("/api/admin/coupons/:id", authenticateAdmin, (req, res) => {
  db.get("SELECT * FROM Promotions WHERE promotion_id = ?", [req.params.id], (err, row) => {
    if (err) {
      return res.json({
        success: false,
        error: err.message
      });
    }

    if (!row) {
      return res.json({
        success: false,
        error: "Coupon not found"
      });
    }

    if (row.type === 'percentage') {
      row.type = 'percent';
    } else if (row.type === 'fixed_amount') {
      row.type = 'fixed';
    }

    res.json({
      success: true,
      coupon: row
    });
  });
});

app.post("/api/admin/coupons", authenticateAdmin, (req, res) => {
  const {
    name,
    code,
    type,
    value,
    min_order,
    expiry_date
  } = req.body;

  let dbType = type;
  if (type === 'percent') {
    dbType = 'percentage';
  } else if (type === 'fixed') {
    dbType = 'fixed_amount';
  }

  const query = `
    INSERT INTO Promotions 
    (name, promo_code, type, discount_value, min_order_amount, end_date, status, start_date) 
    VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'))
  `;

  db.run(
    query,
    [
      name, 
      code, 
      dbType, 
      parseFloat(value), 
      parseFloat(min_order) || 0, 
      expiry_date || null
    ],
    function (err) {
      if (err) {
        console.error("Error adding coupon:", err);
        return res.json({
          success: false,
          error: err.message
        });
      }
      res.json({
        success: true,
        promotion_id: this.lastID
      });
    }
  );
});

app.put("/api/admin/coupons/:id", authenticateAdmin, (req, res) => {
  const {
    name,
    code,
    type,
    value,
    min_order,
    expiry_date
  } = req.body;

  let dbType = type;
  if (type === 'percent') {
    dbType = 'percentage';
  } else if (type === 'fixed') {
    dbType = 'fixed_amount';
  }

  const query = `
    UPDATE Promotions 
    SET name = ?, promo_code = ?, type = ?, discount_value = ?, min_order_amount = ?, end_date = ?
    WHERE promotion_id = ?
  `;

  db.run(
    query,
    [
      name, 
      code, 
      dbType, 
      parseFloat(value), 
      parseFloat(min_order) || 0, 
      expiry_date || null, 
      req.params.id
    ],
    function (err) {
      if (err) {
        console.error("Error updating coupon:", err);
        return res.json({
          success: false,
          error: err.message
        });
      }
      res.json({
        success: true,
        changes: this.changes
      });
    }
  );
});

app.delete("/api/admin/coupons/:id", authenticateAdmin, (req, res) => {
  db.run("DELETE FROM Promotions WHERE promotion_id = ?", [req.params.id], function (err) {
    if (err) return res.json({
      success: false,
      error: err.message
    });
    res.json({
      success: true,
      deleted: this.changes
    });
  });
});

// Activity log for admin actions
app.post("/api/admin/log", authenticateAdmin, (req, res) => {
  const {
    action,
    entity_type,
    entity_id,
    details
  } = req.body;

  db.run(
    `
        INSERT INTO System_Logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      req.user.customer_id,
      action,
      entity_type,
      entity_id,
      details,
      req.ip || req.connection.remoteAddress,
    ],
    function (err) {
      if (err) console.error("Error logging admin action:", err);
      res.json({
        success: !err,
        log_id: this.lastID,
      });
    }
  );
});

// Get activity logs
app.get("/api/admin/logs", authenticateAdmin, (req, res) => {
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
    if (err)
      return res.status(500).json({
        error: err.message,
      });
    res.json({
      success: true,
      logs: rows,
    });
  });
});

app.post("/api/auth/login", (req, res) => {
  const {
    email,
    password
  } = req.body;

  db.get("SELECT * FROM Users WHERE email = ?", [email], (err, user) => {
    if (err)
      return res.status(500).json({
        success: false,
        error: "DB Error",
      });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    const token = jwt.sign({
        customer_id: user.customer_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET, {
        expiresIn: "24h",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    });

    const redirectTo = user.role === "admin" ? "/admin" : "/";
    res.json({
      success: true,
      redirectTo: redirectTo,
    });
  });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: "กรุณากรอกอีเมล"
    });
  }

  db.get("SELECT customer_id, name FROM Users WHERE email = ?", [email], (err, user) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: "เกิดข้อผิดพลาดในระบบ"
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "ไม่พบอีเมลนี้ในระบบ"
      });
    }

    const resetToken = Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    db.run(
      `INSERT INTO Password_Resets (email, token, expires_at) VALUES (?, ?, ?)`,
      [email, resetToken, expiresAt],
      function (err) {
        if (err) {
          return res.status(500).json({
            success: false,
            error: "ไม่สามารถสร้าง reset token ได้"
          });
        }

        res.json({
          success: true,
          message: "ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว",
          resetToken: resetToken
        });
      }
    );
  });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "ข้อมูลไม่ครบถ้วน"
    });
  }

  db.get(
    `SELECT email FROM Password_Resets WHERE token = ? AND expires_at > datetime('now') AND used = 0`,
    [token],
    async (err, reset) => {
      if (err || !reset) {
        return res.status(400).json({
          success: false,
          error: "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว"
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      db.run(
        `UPDATE Users SET password = ? WHERE email = ?`,
        [hashedPassword, reset.email],
        function (err) {
          if (err) {
            return res.status(500).json({
              success: false,
              error: "ไม่สามารถรีเซ็ตรหัสผ่านได้"
            });
          }

          db.run(`UPDATE Password_Resets SET used = 1 WHERE token = ?`, [token]);

          res.json({
            success: true,
            message: "รีเซ็ตรหัสผ่านสำเร็จ"
          });
        }
      );
    }
  );
});

app.get("/api/search", (req, res) => {
  const {
    q
  } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: "คำค้นหาต้องมีอย่างน้อย 2 ตัวอักษร",
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
        error: "เกิดข้อผิดพลาดในการค้นหา",
      });
    }

    res.json({
      success: true,
      products: rows,
      query: q,
      count: rows.length,
    });
  });
});

app.get("/orders", (req, res) => {
  res.render("orders");
});

async function assignFoodDeliveryEmployee(db) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT employee_id, name, phone FROM Employees 
       WHERE LOWER(position) = 'food delivery' 
       ORDER BY RANDOM() 
       LIMIT 1`,
      [],
      (err, employee) => {
        if (err) reject(err);
        else resolve(employee || null);
      }
    );
  });
}

app.post("/api/orders", authenticateUser, async (req, res) => {
  const {
    delivery_address,
    payment_method = "cash",
    promo_code,
    notes,
  } = req.body;
  const customer_id = req.user.customer_id;

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.get(
      `SELECT cart_id FROM Carts WHERE customer_id = ?`,
      [customer_id],
      async (err, cart) => {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({
            success: false,
            error: err.message,
          });
        }

        if (!cart) {
          db.run("ROLLBACK");
          return res.status(400).json({
            success: false,
            error: "ไม่พบตะกร้าสินค้า",
          });
        }

        const query = `
                SELECT ci.*, p.name, p.price, p.status 
                FROM Cart_Items ci
                JOIN Products p ON ci.product_id = p.product_id
                WHERE ci.cart_id = ?
            `;

        db.all(query, [cart.cart_id], async (err, cartItems) => {
          if (err) {
            db.run("ROLLBACK");
            return res.status(500).json({
              success: false,
              error: err.message,
            });
          }

          if (cartItems.length === 0) {
            db.run("ROLLBACK");
            return res.status(400).json({
              success: false,
              error: "ตะกร้าสินค้าว่างเปล่า",
            });
          }

          const unavailableItems = cartItems.filter(
            (item) => item.status !== "available"
          );
          if (unavailableItems.length > 0) {
            db.run("ROLLBACK");
            return res.status(400).json({
              success: false,
              error: `สินค้าบางรายการไม่พร้อมจำหน่าย: ${unavailableItems
                .map((i) => i.name)
                .join(", ")}`,
            });
          }

          const total_amount = cartItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          let discount_amount = 0;
          let final_amount = total_amount;
          let promotion_id = null;
          let assignedEmployee = null;

          try {
            assignedEmployee = await assignFoodDeliveryEmployee(db);
          } catch (empErr) {
            console.error("Error finding food delivery employee:", empErr);
          }

          const processCoupon = (callback) => {
            if (!promo_code) {
              return callback();
            }

            const couponQuery = `
                        SELECT cc.coupon_id, cc.status, p.*
                        FROM Customer_Coupons cc
                        JOIN Promotions p ON cc.promotion_id = p.promotion_id
                        WHERE cc.customer_id = ? AND p.promo_code = ? AND cc.status = 'available'
                        AND p.status = 'active' AND p.start_date <= datetime('now') AND p.end_date >= datetime('now')
                    `;

            db.get(couponQuery, [customer_id, promo_code], (err, coupon) => {
              if (err) return callback(err);

              if (coupon && total_amount >= coupon.min_order_amount) {
                promotion_id = coupon.promotion_id;
                discount_amount = calculateDiscountAmount(coupon, total_amount);
                final_amount = Math.max(0, total_amount - discount_amount);

                db.run(
                  `UPDATE Customer_Coupons SET status = 'used' WHERE coupon_id = ?`,
                  [coupon.coupon_id],
                  callback
                );
              } else {
                callback();
              }
            });
          };

          processCoupon((couponErr) => {
            if (couponErr) {
              db.run("ROLLBACK");
              return res.status(500).json({
                success: false,
                error: "เกิดข้อผิดพลาดในการประมวลผลคูปอง",
              });
            }

            const orderQuery = `
                        INSERT INTO Orders (customer_id, total_amount, discount_amount, final_amount, 
                                           promotion_id, promo_code, delivery_address, order_status, 
                                           payment_status, notes, employee_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)
                    `;

            db.run(
              orderQuery,
              [
                customer_id,
                total_amount,
                discount_amount,
                final_amount,
                promotion_id,
                promo_code,
                delivery_address,
                notes,
                assignedEmployee ? assignedEmployee.employee_id : null
              ],
              function (err) {
                if (err) {
                  db.run("ROLLBACK");
                  return res.status(500).json({
                    success: false,
                    error: err.message,
                  });
                }

                const order_id = this.lastID;

                const moveItemsPromises = cartItems.map((item) => {
                  return new Promise((resolve, reject) => {
                    db.run(
                      `
                                    INSERT INTO Order_Items (order_id, product_id, quantity, price)
                                    VALUES (?, ?, ?, ?)
                                `,
                      [order_id, item.product_id, item.quantity, item.price],
                      (err) => {
                        if (err) reject(err);
                        else resolve();
                      }
                    );
                  });
                });

                Promise.all(moveItemsPromises)
                  .then(() => {
                    db.run(
                      `
                                INSERT INTO Payments (order_id, method, amount, status)
                                VALUES (?, ?, ?, 'pending')
                            `,
                      [order_id, payment_method, final_amount],
                      function (err) {
                        if (err) {
                          db.run("ROLLBACK");
                          return res.status(500).json({
                            success: false,
                            error: err.message,
                          });
                        }

                        const payment_id = this.lastID;

                        db.run(
                          `DELETE FROM Cart_Items WHERE cart_id = ?`,
                          [cart.cart_id],
                          (err) => {
                            if (err) {
                              db.run("ROLLBACK");
                              return res.status(500).json({
                                success: false,
                                error: "ไม่สามารถล้างตะกร้าสินค้าได้",
                              });
                            }

                            if (promotion_id) {
                              db.run(
                                `
                                            INSERT INTO Promotion_Usage (promotion_id, customer_id, order_id, discount_amount)
                                            VALUES (?, ?, ?, ?)
                                        `,
                                [
                                  promotion_id,
                                  customer_id,
                                  order_id,
                                  discount_amount,
                                ],
                                (err) => {
                                  if (err)
                                    console.error(
                                      "Promotion usage recording failed:",
                                      err
                                    );
                                }
                              );
                            }

                            db.run(
                              `
                                        INSERT INTO Notifications (user_id, type, message, status)
                                        VALUES (?, 'order', ?, 'unread')
                                    `,
                              [
                                customer_id,
                                `คำสั่งซื้อ #${order_id} ได้รับการยืนยันแล้ว`,
                              ],
                              (err) => {
                                if (err)
                                  console.error(
                                    "Notification creation failed:",
                                    err
                                  );
                              }
                            );

                            db.run(
                              `
                                        INSERT INTO System_Logs (user_id, action, entity_type, entity_id, details)
                                        VALUES (?, 'create', 'order', ?, ?)
                                    `,
                              [
                                customer_id,
                                order_id,
                                JSON.stringify({
                                  total_amount,
                                  final_amount,
                                  items_count: cartItems.length,
                                  promo_code,
                                  employee_id: assignedEmployee ? assignedEmployee.employee_id : null
                                }),
                              ]
                            );

                            db.run("COMMIT");

                            res.json({
                              success: true,
                              order_id: order_id,
                              payment_id: payment_id,
                              message: "สร้างคำสั่งซื้อสำเร็จ",
                              total_amount,
                              final_amount,
                              discount_amount,
                              redirect: `/orders/${order_id}/pay`,
                            });
                          }
                        );
                      }
                    );
                  })
                  .catch((err) => {
                    db.run("ROLLBACK");
                    res.status(500).json({
                      success: false,
                      error: "ไม่สามารถย้ายสินค้าจากตะกร้าไปยังคำสั่งซื้อได้",
                    });
                  });
              }
            );
          });
        });
      }
    );
  });
});

app.get("/api/orders", authenticateUser, (req, res) => {
  const customer_id = req.user.customer_id;

  const query = `
    SELECT o.*, p.method as payment_method, p.status as payment_status,
           e.name as employee_name
    FROM Orders o
    LEFT JOIN Payments p ON o.order_id = p.order_id
    LEFT JOIN Employees e ON o.employee_id = e.employee_id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `;

  db.all(query, [customer_id], (err, orders) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    if (!orders || orders.length === 0) {
      return res.json({
        success: true,
        orders: [],
      });
    }

    const orderIds = orders.map((o) => o.order_id);
    const itemsQuery = `
      SELECT oi.*, p.name as product_name, p.image_url
      FROM Order_Items oi
      JOIN Products p ON oi.product_id = p.product_id
      WHERE oi.order_id IN (${orderIds.map(() => "?").join(",")})
    `;

    db.all(itemsQuery, orderIds, (err, items) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message,
        });
      }

      const reviewsQuery = `
        SELECT r.*, p.name as product_name
        FROM Reviews r
        JOIN Products p ON r.product_id = p.product_id
        JOIN Order_Items oi ON r.product_id = oi.product_id
        WHERE r.customer_id = ? AND oi.order_id IN (${orderIds
          .map(() => "?")
          .join(",")})
        ORDER BY r.created_at DESC
      `;

      db.all(reviewsQuery, [customer_id, ...orderIds], (err, reviews) => {
        if (err) {
          console.log("Reviews query error:", err);
        }

        const ordersWithItems = orders.map((order) => {
          const orderItems = items.filter(
            (item) => item.order_id === order.order_id
          );
          const orderReviews = reviews ?
            reviews.filter((review) =>
              orderItems.some((item) => item.product_id === review.product_id)
            ) : [];

          return {
            ...order,
            items: orderItems,
            reviews: orderReviews,
          };
        });

        res.json({
          success: true,
          orders: ordersWithItems,
        });
      });
    });
  });
});

app.get("/orders/:id/pay", authenticateUser, (req, res) => {
  res.render("payment", {
    orderId: req.params.id,
  });
});

app.post("/api/payments", authenticateUser, (req, res) => {
  const {
    order_id,
    method,
    amount
  } = req.body;

  db.run(
    `UPDATE Payments SET method = ?, amount = ?, status = ? WHERE order_id = ?`,
    [method, amount, "success", order_id],
    function (err) {
      if (err)
        return res.status(500).json({
          success: false,
          error: err.message,
        });
      db.run(
        `UPDATE Orders SET payment_status = 'paid', order_status = 'confirmed' WHERE order_id = ?`,
        [order_id]
      );
      res.json({
        success: true,
        message: "บันทึกการชำระเงินสำเร็จ",
      });
    }
  );
});

app.get("/api/orders/:id", authenticateUser, (req, res) => {
  const {
    id
  } = req.params;
  const customer_id = req.user.customer_id;

  const query = `
    SELECT o.*, p.method as payment_method, p.status as payment_status, p.amount as payment_amount,
           e.name as employee_name, e.phone as employee_phone
    FROM Orders o
    LEFT JOIN Payments p ON o.order_id = p.order_id
    LEFT JOIN Employees e ON o.employee_id = e.employee_id
    WHERE o.order_id = ? AND o.customer_id = ?
  `;

  db.get(query, [id, customer_id], (err, order) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "ไม่พบคำสั่งซื้อ",
      });
    }

    const itemsQuery = `
      SELECT oi.*, p.name as product_name, p.image_url
      FROM Order_Items oi
      JOIN Products p ON oi.product_id = p.product_id
      WHERE oi.order_id = ?
    `;

    db.all(itemsQuery, [id], (err, items) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message,
        });
      }

      res.json({
        success: true,
        order: {
          ...order,
          items,
        },
      });
    });
  });
});

app.get("/api/notifications", authenticateUser, (req, res) => {
  const customer_id = req.user.customer_id;
  const {
    limit = 10, offset = 0
  } = req.query;

  const query = `
        SELECT * FROM Notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `;

  db.all(
    query,
    [customer_id, parseInt(limit), parseInt(offset)],
    (err, notifications) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message,
        });
      }

      db.get(
        `SELECT COUNT(*) as unread_count FROM Notifications WHERE user_id = ? AND status = 'unread'`,
        [customer_id],
        (err, countResult) => {
          if (err) {
            return res.status(500).json({
              success: false,
              error: err.message,
            });
          }

          res.json({
            success: true,
            notifications,
            unread_count: countResult.unread_count || 0,
          });
        }
      );
    }
  );
});

// Mark notifications as read
app.put("/api/notifications/read", authenticateUser, (req, res) => {
  const customer_id = req.user.customer_id;
  const {
    notification_ids
  } = req.body;

  if (!notification_ids || !Array.isArray(notification_ids)) {
    return res.status(400).json({
      success: false,
      error: "กรุณาระบุรายการแจ้งเตือนที่ต้องการอ่าน",
    });
  }

  const placeholders = notification_ids.map(() => "?").join(",");
  const query = `
        UPDATE Notifications 
        SET status = 'read' 
        WHERE notification_id IN (${placeholders}) AND user_id = ?
    `;

  db.run(query, [...notification_ids, customer_id], function (err) {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    res.json({
      success: true,
      message: "อ่านแจ้งเตือนแล้ว",
      updated_count: this.changes,
    });
  });
});

// Enhanced order status update with notifications
app.put("/api/orders/:id/status", authenticateUser, (req, res) => {
  const {
    id
  } = req.params;
  const {
    status
  } = req.body;
  const customer_id = req.user.customer_id;

  const validStatuses = [
    "pending",
    "accepted",
    "cooking",
    "delivering",
    "completed",
    "cancelled",
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: "สถานะไม่ถูกต้อง",
    });
  }

  db.get(
    `SELECT * FROM Orders WHERE order_id = ? AND customer_id = ?`,
    [id, customer_id],
    (err, order) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message,
        });
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "ไม่พบคำสั่งซื้อ",
        });
      }

      db.run(
        `
            UPDATE Orders 
            SET order_status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE order_id = ?
        `,
        [status, id],
        function (err) {
          if (err) {
            return res.status(500).json({
              success: false,
              error: err.message,
            });
          }

          const statusMessages = {
            accepted: "คำสั่งซื้อของคุณได้รับการยืนยันแล้ว",
            cooking: "กำลังเตรียมอาหารของคุณ",
            delivering: "คำสั่งซื้อของคุณกำลังจัดส่ง",
            completed: "คำสั่งซื้อของคุณเสร็จสิ้นแล้ว",
            cancelled: "คำสั่งซื้อของคุณถูกยกเลิก",
          };

          const notificationMessage =
            statusMessages[status] ||
            `สถานะคำสั่งซื้อ #${id} เปลี่ยนเป็น ${status}`;

          db.run(
            `
                INSERT INTO Notifications (user_id, type, message, status)
                VALUES (?, 'order', ?, 'unread')
            `,
            [customer_id, notificationMessage],
            (notifErr) => {
              if (notifErr)
                console.error("Notification creation failed:", notifErr);
            }
          );

          res.json({
            success: true,
            message: "อัปเดตสถานะสำเร็จ",
            status: status,
          });
        }
      );
    }
  );
});

// Server-Sent Events for real-time notifications
app.get("/api/notifications/stream", authenticateUser, (req, res) => {
  const customer_id = req.user.customer_id;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      message: "Connected to notifications",
    })}\n\n`
  );

  const pollInterval = setInterval(() => {
    db.get(
      `
            SELECT * FROM Notifications 
            WHERE user_id = ? AND status = 'unread'
            ORDER BY created_at DESC 
            LIMIT 1
        `,
      [customer_id],
      (err, notification) => {
        if (!err && notification) {
          res.write(
            `data: ${JSON.stringify({
              type: "notification",
              data: notification,
            })}\n\n`
          );
        }
      }
    );
  }, 5000);

  req.on("close", () => {
    clearInterval(pollInterval);
    res.end();
  });

  req.on("end", () => {
    clearInterval(pollInterval);
    res.end();
  });
});

// Webhook for order status updates (for admin/staff use)
app.post("/api/orders/:id/webhook/status", authenticateAdmin, (req, res) => {
  const {
    id
  } = req.params;
  const {
    status,
    employee_id,
    notes
  } = req.body;

  const validStatuses = [
    "pending",
    "accepted",
    "cooking",
    "delivering",
    "completed",
    "cancelled",
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: "Invalid status",
    });
  }

  db.get(`SELECT * FROM Orders WHERE order_id = ?`, [id], (err, order) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const updateQuery = `
            UPDATE Orders 
            SET order_status = ?, employee_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = ?
        `;

    db.run(updateQuery, [status, employee_id, id], function (err) {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message,
        });
      }

      if (notes) {
        db.run(
          `
                    INSERT INTO System_Logs (user_id, action, entity_type, entity_id, details)
                    VALUES (?, 'update', 'order', ?, ?)
                `,
          [
            req.user.customer_id,
            id,
            JSON.stringify({
              status,
              notes,
              employee_id,
            }),
          ]
        );
      }

      const statusMessages = {
        accepted: "คำสั่งซื้อของคุณได้รับการยืนยันแล้ว เรากำลังเตรียมอาหารให้คุณ",
        cooking: "เชฟกำลังปรุงอาหารของคุณด้วยความพิถีพิถัน",
        delivering: "อาหารของคุณกำลังเดินทางไปหาคุณ",
        completed: "คำสั่งซื้อของคุณเสร็จสิ้นแล้ว ขอบคุณที่ใช้บริการ",
        cancelled: "ขออภัย คำสั่งซื้อของคุณถูกยกเลิก",
      };

      const message =
        statusMessages[status] || `สถานะคำสั่งซื้อ #${id} อัปเดตแล้ว`;

      db.run(
        `
                INSERT INTO Notifications (user_id, type, message, status)
                VALUES (?, 'order', ?, 'unread')
            `,
        [order.customer_id, message]
      );

      res.json({
        success: true,
        message: "Order status updated successfully",
        order: {
          order_id: id,
          status: status,
          updated_at: new Date().toISOString(),
        },
      });
    });
  });
});

app.get("/api/orders/:id/status", authenticateUser, (req, res) => {
  const {
    id
  } = req.params;
  const customer_id = req.user.customer_id;

  const query = `
    SELECT order_status, updated_at, payment_status
    FROM Orders 
    WHERE order_id = ? AND customer_id = ?
  `;

  db.get(query, [id, customer_id], (err, order) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "ไม่พบคำสั่งซื้อ",
      });
    }

    res.json({
      success: true,
      status: order.order_status,
      payment_status: order.payment_status,
      updated_at: order.updated_at,
    });
  });
});

app.get("/api/orders/:id/employee", authenticateUser, (req, res) => {
  const { id } = req.params;
  const customer_id = req.user.customer_id;

  const query = `
    SELECT o.order_id, o.order_status, e.name as employee_name, e.phone as employee_phone
    FROM Orders o
    LEFT JOIN Employees e ON o.employee_id = e.employee_id
    WHERE o.order_id = ? AND o.customer_id = ?
  `;

  db.get(query, [id, customer_id], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    
    if (!result) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    res.json({
      success: true,
      employee: result.employee_name ? {
        name: result.employee_name,
        phone: result.employee_phone
      } : null
    });
  });
});

app.post("/api/payments/:orderId/pay", authenticateUser, (req, res) => {
  const { orderId } = req.params;
  const { method, amount } = req.body;
  const customer_id = req.user.customer_id;

  db.get(
    `SELECT * FROM Orders WHERE order_id = ? AND customer_id = ?`,
    [orderId, customer_id],
    (err, order) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      if (!order) {
        return res.status(404).json({ success: false, error: "ไม่พบคำสั่งซื้อ" });
      }

      if (order.payment_status === "paid") {
        return res.status(400).json({ success: false, error: "ชำระเงินแล้ว" });
      }

      db.serialize(() => {
        db.run(
          `UPDATE Payments 
           SET method = ?, amount = ?, status = 'success', paid_at = CURRENT_TIMESTAMP
           WHERE order_id = ?`,
          [method, amount, orderId]
        );

        db.run(
          `UPDATE Orders 
           SET payment_status = 'paid', order_status = 'accepted', updated_at = CURRENT_TIMESTAMP
           WHERE order_id = ?`,
          [orderId]
        );

        setTimeout(() => {
          db.run(
            `UPDATE Orders SET order_status = 'cooking', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
            [orderId]
          );
          
          setTimeout(() => {
            db.run(
              `UPDATE Orders SET order_status = 'delivering', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
              [orderId]
            );
          }, 35 * 1000);
          
        }, 20 * 1000);

        res.json({
          success: true,
          message: "ชำระเงินสำเร็จ",
          order_id: orderId,
        });
      });
    }
  );
});

function calculateDiscountAmount(coupon, orderAmount) {
  let discountAmount = 0;

  switch (coupon.type) {
    case "percentage":
      discountAmount = (orderAmount * coupon.discount_value) / 100;
      if (
        coupon.max_discount_amount &&
        discountAmount > coupon.max_discount_amount
      ) {
        discountAmount = coupon.max_discount_amount;
      }
      break;
    case "fixed_amount":
      discountAmount = coupon.discount_value;
      break;
    case "free_shipping":
      discountAmount = 30;
      break;
    default:
      discountAmount = 0;
  }

  return Math.round(discountAmount * 100) / 100;
}

// Add missing columns to Orders table if needed
db.run(
  `
  ALTER TABLE Orders ADD COLUMN employee_id INTEGER;
`,
  (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.log("Note: employee_id column may already exist");
    }
  }
);

// Simulate order status progression (for demo purposes)
app.post("/api/orders/:id/simulate-progress", authenticateUser, (req, res) => {
  const {
    id
  } = req.params;
  const customer_id = req.user.customer_id;

  db.get(
    `SELECT * FROM Orders WHERE order_id = ? AND customer_id = ?`,
    [id, customer_id],
    (err, order) => {
      if (err || !order) {
        return res.status(404).json({
          success: false,
          error: "ไม่พบคำสั่งซื้อ",
        });
      }

      const statuses = ["accepted", "cooking", "delivering", "completed"];
      let currentIndex = 0;

      const progressStatus = () => {
        if (currentIndex < statuses.length) {
          const newStatus = statuses[currentIndex];

          db.run(
            `
          UPDATE Orders 
          SET order_status = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE order_id = ?
        `,
            [newStatus, id],
            (err) => {
              if (!err) {
                console.log(`Order ${id} status updated to: ${newStatus}`);
              }
            }
          );

          currentIndex++;
          if (currentIndex < statuses.length) {
            setTimeout(progressStatus, 5000);
          }
        }
      };

      setTimeout(progressStatus, 2000);

      res.json({
        success: true,
        message: "เริ่มจำลองการดำเนินการสั่งซื้อ",
      });
    }
  );
});

// Payment page route
app.get("/orders/:id/pay", authenticateUser, (req, res) => {
  const {
    id
  } = req.params;
  res.render("payment", {
    title: "ชำระเงิน",
    orderId: id,
  });
});

// Database schema updates for better order tracking
function updateDatabaseSchema() {
  db.run(
    `
    ALTER TABLE Orders ADD COLUMN employee_id INTEGER 
    REFERENCES Employees(employee_id);
  `,
    (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.log("Note: employee_id column may already exist");
      }
    }
  );

  db.run(
    `
    ALTER TABLE Orders ADD COLUMN notes TEXT;
  `,
    (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.log("Note: notes column may already exist");
      }
    }
  );

  db.run(
    `
    ALTER TABLE Employees ADD COLUMN phone TEXT;
  `,
    (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.log("Note: phone column may already exist");
      }
    }
  );
}

updateDatabaseSchema();

app.post("/api/reviews", authenticateUser, (req, res) => {
  const {
    product_id,
    rating,
    comment
  } = req.body;
  const customer_id = req.user.customer_id;

  if (!product_id || !rating) {
    return res.status(400).json({
      success: false,
      error: "กรุณาระบุสินค้าและคะแนน",
    });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      error: "คะแนนต้องอยู่ระหว่าง 1-5",
    });
  }

  const purchaseQuery = `
    SELECT DISTINCT oi.product_id 
    FROM Order_Items oi
    JOIN Orders o ON oi.order_id = o.order_id
    WHERE o.customer_id = ? AND oi.product_id = ? AND o.order_status = 'completed'
  `;

  db.get(purchaseQuery, [customer_id, product_id], (err, purchase) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    if (!purchase) {
      return res.status(403).json({
        success: false,
        error: "คุณสามารถรีวิวได้เฉพาะสินค้าที่ซื้อและได้รับแล้วเท่านั้น",
      });
    }

    const existingReviewQuery = `
      SELECT review_id FROM Reviews 
      WHERE customer_id = ? AND product_id = ?
    `;

    db.get(
      existingReviewQuery,
      [customer_id, product_id],
      (err, existingReview) => {
        if (err) {
          return res.status(500).json({
            success: false,
            error: err.message,
          });
        }

        if (existingReview) {
          db.run(
            `UPDATE Reviews SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE review_id = ?`,
            [rating, comment, existingReview.review_id],
            function (err) {
              if (err) {
                return res.status(500).json({
                  success: false,
                  error: err.message,
                });
              }
              res.json({
                success: true,
                message: "อัปเดตรีวิวเรียบร้อยแล้ว",
                review_id: existingReview.review_id,
              });
            }
          );
        } else {
          db.run(
            `INSERT INTO Reviews (product_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)`,
            [product_id, customer_id, rating, comment],
            function (err) {
              if (err) {
                return res.status(500).json({
                  success: false,
                  error: err.message,
                });
              }
              res.json({
                success: true,
                message: "เพิ่มรีวิวเรียบร้อยแล้ว",
                review_id: this.lastID,
              });
            }
          );
        }
      }
    );
  });
});

// Get reviews for a specific order
app.get("/api/orders/:orderId/reviews", authenticateUser, (req, res) => {
  const { orderId } = req.params;
  const customer_id = req.user.customer_id;

  const query = `
    SELECT r.*, p.name as product_name, p.image_url
    FROM Reviews r
    JOIN Products p ON r.product_id = p.product_id
    JOIN Order_Items oi ON r.product_id = oi.product_id
    WHERE r.customer_id = ? AND oi.order_id = ?
    ORDER BY r.created_at DESC
  `;

  db.all(query, [customer_id, orderId], (err, reviews) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    res.json({
      success: true,
      reviews: reviews || [],
    });
  });
});

// Submit multiple reviews for an order
app.post("/api/orders/:orderId/reviews", authenticateUser, (req, res) => {
  const {
    orderId
  } = req.params;
  const {
    reviews
  } = req.body;
  const customer_id = req.user.customer_id;

  if (!reviews || !Array.isArray(reviews)) {
    return res.status(400).json({
      success: false,
      error: "ข้อมูลรีวิวไม่ถูกต้อง",
    });
  }

  const orderQuery = `
    SELECT order_id FROM Orders 
    WHERE order_id = ? AND customer_id = ? AND order_status = 'completed'
  `;

  db.get(orderQuery, [orderId, customer_id], (err, order) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "ไม่พบคำสั่งซื้อหรือคำสั่งซื้อยังไม่เสร็จสิ้น",
      });
    }

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      let completedReviews = 0;
      let hasError = false;

      reviews.forEach((review, index) => {
        const {
          product_id,
          rating,
          comment
        } = review;

        if (!product_id || !rating || rating < 1 || rating > 5) {
          hasError = true;
          return;
        }

        db.get(
          `SELECT review_id FROM Reviews WHERE customer_id = ? AND product_id = ?`,
          [customer_id, product_id],
          (err, existing) => {
            if (err) {
              hasError = true;
              return;
            }

            if (existing) {
              db.run(
                `UPDATE Reviews SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE review_id = ?`,
                [rating, comment || "", existing.review_id],
                (err) => {
                  if (err) hasError = true;
                  completedReviews++;

                  if (completedReviews === reviews.length) {
                    finalizeTransaction();
                  }
                }
              );
            } else {
              db.run(
                `INSERT INTO Reviews (product_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)`,
                [product_id, customer_id, rating, comment || ""],
                (err) => {
                  if (err) hasError = true;
                  completedReviews++;

                  if (completedReviews === reviews.length) {
                    finalizeTransaction();
                  }
                }
              );
            }
          }
        );
      });

      function finalizeTransaction() {
        if (hasError) {
          db.run("ROLLBACK");
          res.status(500).json({
            success: false,
            error: "เกิดข้อผิดพลาดในการบันทึกรีวิว",
          });
        } else {
          db.run("COMMIT");
          res.json({
            success: true,
            message: "บันทึกรีวิวทั้งหมดเรียบร้อยแล้ว",
            count: reviews.length,
          });
        }
      }
    });
  });
});

app.get("/history", authenticateUser, (req, res) => {
  res.render("history");
});

app.get("/api/history", authenticateUser, (req, res) => {
  const customer_id = req.user.customer_id;

  const query = `
    SELECT o.*, p.method as payment_method, p.status as payment_status,
           e.name as employee_name
    FROM Orders o
    LEFT JOIN Payments p ON o.order_id = p.order_id
    LEFT JOIN Employees e ON o.employee_id = e.employee_id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `;

  db.all(query, [customer_id], (err, orders) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }

    if (!orders || orders.length === 0) {
      return res.json({
        success: true,
        orders: [],
      });
    }

    const orderIds = orders.map((o) => o.order_id);
    const itemsQuery = `
      SELECT oi.*, p.name as product_name, p.image_url
      FROM Order_Items oi
      JOIN Products p ON oi.product_id = p.product_id
      WHERE oi.order_id IN (${orderIds.map(() => "?").join(",")})
    `;

    db.all(itemsQuery, orderIds, (err, items) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message,
        });
      }

      const reviewsQuery = `
        SELECT r.*, p.name as product_name
        FROM Reviews r
        JOIN Products p ON r.product_id = p.product_id
        JOIN Order_Items oi ON r.product_id = oi.product_id
        WHERE r.customer_id = ? AND oi.order_id IN (${orderIds
          .map(() => "?")
          .join(",")})
        ORDER BY r.created_at DESC
      `;

      db.all(reviewsQuery, [customer_id, ...orderIds], (err, reviews) => {
        if (err) {
          console.log("Reviews query error:", err);
        }

        const ordersWithItems = orders.map((order) => {
          const orderItems = items.filter(
            (item) => item.order_id === order.order_id
          );
          const orderReviews = reviews ?
            reviews.filter((review) =>
              orderItems.some((item) => item.product_id === review.product_id)
            ) : [];

          return {
            ...order,
            items: orderItems,
            reviews: orderReviews,
          };
        });

        res.json({
          success: true,
          orders: ordersWithItems,
        });
      });
    });
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);

  if (req.headers.accept && req.headers.accept.includes("application/json")) {
    res.status(500).json({
      success: false,
      error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
    });
  } else {
    res.status(500).render("404", {
      title: "เกิดข้อผิดพลาด",
      message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
    });
  }
});

app.use((req, res) => {
  if (req.headers.accept && req.headers.accept.includes("application/json")) {
    res.status(404).json({
      success: false,
      error: "ไม่พบหน้าที่ต้องการ",
    });
  } else {
    res.status(404).render("404", {
      title: "ไม่พบหน้าที่ต้องการ",
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Restaurant Server running on port ${PORT}`);
  console.log(`📊 Database: ${dbPath}`);
  console.log(`🌐 Web: http://localhost:${PORT}`);
});

module.exports = app;