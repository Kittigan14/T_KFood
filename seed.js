const path = require("path");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "database", "database.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error("❌ Error opening database:", err.message);
  console.log("✅ Connected to SQLite database:", dbPath);
});

const categories = [
  { id: 1, name: "เมนูผัด" },
  { id: 2, name: "เมนูต้ม" },
  { id: 3, name: "เมนูยำ" },
  { id: 4, name: "เมนูทอด" },
  { id: 5, name: "เมนูปิ้งย่าง" },
  { id: 6, name: "เครื่องดื่ม" },
  { id: 7, name: "ของหวาน" },
  { id: 8, name: "เมนูข้าว" }
];

const products = [
  { name: "ผัดไทยกุ้งสด", description: "เส้นจันทร์ผัดกับซอสเข้มข้น", price: 60, category_id: 1, image_url: "padthai.jpg" },
  { name: "ผัดกะเพราไก่", description: "กะเพราหอมเผ็ดร้อน เสิร์ฟพร้อมข้าว", price: 55, category_id: 1, image_url: "gapao.jpg" },
  { name: "ผัดซีอิ๊วหมู", description: "เส้นใหญ่ผัดซีอิ๊วเข้มข้น", price: 60, category_id: 1, image_url: "padseeew.jpg" },
  { name: "ผัดพริกแกงหมู", description: "เผ็ดจัดจ้าน หอมเครื่องแกง", price: 65, category_id: 1, image_url: "padprikgaeng.jpg" },
  { name: "ราดหน้าหมูหมัก", description: "ราดหน้าเส้นใหญ่ หอมอร่อย", price: 70, category_id: 1, image_url: "radna.jpg" },

  { name: "ต้มยำกุ้ง", description: "น้ำซุปต้มยำรสจัดจ้าน", price: 80, category_id: 2, image_url: "tomyum.jpg" },
  { name: "ต้มจืดเต้าหู้หมูสับ", description: "น้ำซุปใสหอมหวาน", price: 55, category_id: 2, image_url: "tomjerd.jpg" },
  { name: "แกงจืดสาหร่าย", description: "เบาๆ สุขภาพดี", price: 50, category_id: 2, image_url: "seaweed_soup.jpg" },
  { name: "ต้มแซ่บกระดูกอ่อน", description: "แซ่บซี๊ดถึงใจ", price: 85, category_id: 2, image_url: "tomzap.jpg" },
  { name: "แกงเห็ดรวม", description: "น้ำแกงสมุนไพร หอมอร่อย", price: 65, category_id: 2, image_url: "mushroom_soup.jpg" },

  { name: "ยำวุ้นเส้น", description: "ยำเผ็ดเปรี้ยวกลมกล่อม", price: 55, category_id: 3, image_url: "yum.jpg" },
  { name: "ยำทะเลรวม", description: "กุ้ง หมึก หอย สดๆ", price: 95, category_id: 3, image_url: "yum_talay.jpg" },
  { name: "ยำมาม่า", description: "เผ็ดจี๊ดจ๊าดถึงใจ", price: 50, category_id: 3, image_url: "yum_mama.jpg" },
  { name: "ยำไข่ดาว", description: "ไข่ดาวทอดกรอบ คลุกน้ำยำ", price: 45, category_id: 3, image_url: "yum_kai_dao.jpg" },
  { name: "ยำหมูยอ", description: "หมูยอเด้งๆ คลุกน้ำยำ", price: 55, category_id: 3, image_url: "yum_moo_yor.jpg" },

  { name: "ไก่ทอดน้ำปลา", description: "กรอบนอกนุ่มใน", price: 70, category_id: 4, image_url: "friedchicken.jpg" },
  { name: "หมูสามชั้นทอด", description: "หมูทอดกรอบ เค็มนิดๆ", price: 80, category_id: 4, image_url: "friedpork.jpg" },
  { name: "ปลาทอดกรอบ", description: "ปลาทอดหอม กรอบอร่อย", price: 100, category_id: 4, image_url: "friedfish.jpg" },
  { name: "ทอดมันกุ้ง", description: "ทอดมันกุ้งเด้งๆ", price: 85, category_id: 4, image_url: "shrimpcake.jpg" },
  { name: "ปอเปี๊ยะทอด", description: "ไส้ผักหมูสับ ห่อแป้งทอด", price: 60, category_id: 4, image_url: "springroll.jpg" },

  { name: "หมูปิ้ง", description: "หมูหมักเครื่องเทศย่างหอม", price: 50, category_id: 5, image_url: "grilledpork.jpg" },
  { name: "ไก่ย่าง", description: "ไก่หมักสมุนไพร ย่างเตาถ่าน", price: 65, category_id: 5, image_url: "grilledchicken.jpg" },
  { name: "เนื้อย่าง", description: "เนื้อย่างนุ่มลิ้น", price: 90, category_id: 5, image_url: "grilledbeef.jpg" },
  { name: "ปลาหมึกย่าง", description: "หมึกสดย่างพร้อมน้ำจิ้มซีฟู้ด", price: 95, category_id: 5, image_url: "grilledsquid.jpg" },
  { name: "ไส้อั่ว", description: "หมูสมุนไพรย่างแบบเหนือ", price: 85, category_id: 5, image_url: "saiua.jpg" },

  { name: "ชาเย็น", description: "เครื่องดื่มเย็นชื่นใจ", price: 40, category_id: 6, image_url: "thaitea.jpg" },
  { name: "กาแฟเย็น", description: "กาแฟเข้มข้น หอมละมุน", price: 45, category_id: 6, image_url: "icedcoffee.jpg" },
  { name: "น้ำมะนาวโซดา", description: "สดชื่นซาบซ่า", price: 35, category_id: 6, image_url: "lemon_soda.jpg" },
  { name: "น้ำเปล่า", description: "สะอาด สดชื่น", price: 15, category_id: 6, image_url: "water.jpg" },
  { name: "โกโก้เย็น", description: "โกโก้เข้ม หวานมัน", price: 45, category_id: 6, image_url: "icedcocoa.jpg" },

  { name: "ข้าวเหนียวมะม่วง", description: "ข้าวเหนียวนุ่ม มะม่วงหวาน", price: 65, category_id: 7, image_url: "mango.jpg" },
  { name: "บัวลอย", description: "น้ำกะทิหอม หวานกำลังดี", price: 40, category_id: 7, image_url: "bualoy.jpg" },
  { name: "ลอดช่อง", description: "หวานเย็น ชื่นใจ", price: 35, category_id: 7, image_url: "lodchong.jpg" },
  { name: "ไอศกรีมกะทิ", description: "เย็นๆ หอมกะทิสด", price: 30, category_id: 7, image_url: "coconuticecream.jpg" },
  { name: "เครปเค้กสตรอเบอร์รี่", description: "เครปนุ่ม ครีมสด ราดซอส", price: 85, category_id: 7, image_url: "strawberry_crepe.jpg" },

  { name: "ข้าวผัดกุ้ง", description: "ข้าวผัดหอมกลิ่นกระทะ", price: 70, category_id: 8, image_url: "friedrice.jpg" },
  { name: "ข้าวมันไก่", description: "ไก่นุ่ม น้ำจิ้มเต้าเจี้ยว", price: 60, category_id: 8, image_url: "khaomankai.jpg" },
  { name: "ข้าวแกงเขียวหวาน", description: "แกงเขียวหวานเข้มข้น", price: 75, category_id: 8, image_url: "green_curry.jpg" },
  { name: "ข้าวหน้าเป็ด", description: "เป็ดย่างหนังกรอบ", price: 80, category_id: 8, image_url: "duckrice.jpg" },
  { name: "ข้าวหมูกระเทียม", description: "หมูผัดกระเทียมหอมๆ", price: 65, category_id: 8, image_url: "garlicporkrice.jpg" }
];

const promotions = [
  ['ส่วนลด 20%', 'ลด 20% สำหรับการสั่งซื้อครั้งแรก', 'percentage', 20, null, null, 200, 100, 100, 1, 'NEW20'],
  ['ลด 50 บาท', 'ลดทันที 50 บาท เมื่อสั่งอาหารครบ 300 บาท', 'fixed_amount', 50, null, null, 300, null, null, null, 'SAVE50'],
  ['ลด 10% ทุกเมนู', 'ส่วนลด 10% สำหรับการสั่งซื้อทุกประเภท', 'percentage', 10, null, null, null, null, null, null, 'SUMMER24'],
  ['ส่วนลด 20 บาท', 'ลด 20 บาท เมื่อสั่งเมนูข้าว', 'fixed_amount', 20, null, null, null, null, null, null, 'FOODIE20']
];

const admins = [
  {
    name: "AdminTester",
    email: "admin@tkfood.com",
    password: "123123",
    phone: "0911111111",
    role: "admin"
  },
];

const employees = [
  { name: "สุรชัย ใจดี", email: "surachai.j@tkfood.com", phone: "081-123-4567", position: "Food Delivery", salary: 15000, hire_date: "2024-01-15" },
  { name: "วิชัย สมัครงาน", email: "vichai.s@tkfood.com", phone: "089-987-6543", position: "Food Delivery", salary: 15000, hire_date: "2024-02-20" },
  { name: "สมหญิง รักสงบ", email: "somyin.r@tkfood.com", phone: "090-000-1111", position: "Food Delivery", salary: 15000, hire_date: "2024-03-10" }
];

function insertCategories() {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare("INSERT OR IGNORE INTO Categories (category_id, name) VALUES (?, ?)");
    categories.forEach(cat => stmt.run([cat.id, cat.name]));
    stmt.finalize((err) => {
      if (err) reject(err);
      else {
        console.log("✅ Categories inserted.");
        resolve();
      }
    });
  });
}

function insertProducts() {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare("INSERT OR IGNORE INTO Products (name, description, price, category_id, image_url) VALUES (?, ?, ?, ?, ?)");
    products.forEach(p => stmt.run([p.name, p.description, p.price, p.category_id, p.image_url]));
    stmt.finalize((err) => {
      if (err) reject(err);
      else {
        console.log("✅ Products inserted.");
        resolve();
      }
    });
  });
}

function insertPromotions() {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO Promotions 
      (name, description, type, discount_value, buy_quantity, get_quantity, min_order_amount, max_discount_amount, usage_limit, usage_per_customer, start_date, end_date, status, promo_code) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+1 year'), 'active', ?)
    `);
    promotions.forEach(promo => stmt.run(promo));
    stmt.finalize((err) => {
      if (err) reject(err);
      else {
        db.run(`INSERT OR IGNORE INTO Promotion_Categories (promotion_id, category_id) VALUES (5, 7)`, (err2) => {
          console.log("✅ Promotions inserted.");
          resolve();
        });
      }
    });
  });
}

function insertAdmin() {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO Users (name, email, password, phone, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    admins.forEach(admin => {
      const hashedPassword = bcrypt.hashSync(admin.password, 10);
      stmt.run([admin.name, admin.email, hashedPassword, admin.phone, admin.role]);
    });

    stmt.finalize((err) => {
      if (err) reject(err);
      else {
        console.log(`✅ Admin user inserted`);
        resolve();
      }
    });
  });
}

function insertEmployees() {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO Employees (name, email, phone, position, salary, hire_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    employees.forEach(emp => {
      stmt.run([emp.name, emp.email, emp.phone, emp.position, emp.salary, emp.hire_date]);
    });

    stmt.finalize((err) => {
      if (err) reject(err);
      else {
        console.log("✅ Employee data inserted.");
        resolve();
      }
    });
  });
}

async function runSeed() {
  try {
    await insertCategories();
    await insertProducts();
    await insertPromotions();
    await insertAdmin();
    await insertEmployees();
    
    return new Promise((resolve) => {
      setTimeout(() => {
        db.close(() => {
          console.log("✅ Seed database closed.");
          resolve();
        });
      }, 500);
    });
  } catch (err) {
    console.error("❌ Seed error:", err);
    throw err;
  }
}

if (require.main === module) {
  runSeed()
    .then(() => {
      console.log("✅ Seed completed!");
      process.exit(0);
    })
    .catch(err => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}

module.exports = { runSeed };