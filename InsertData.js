const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database/database.db", (err) => {
  if (err) return console.error("❌ Error opening database:", err.message);
  console.log("✅ Connected to SQLite database.");
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

categories.forEach(cat => {
  db.run(
    "INSERT INTO Categories (category_id, name) VALUES (?, ?)",
    [cat.id, cat.name],
    (err) => {
      if (err) console.log("❌ Insert category error:", err.message);
    }
  );
});

const products = [
  { name: "ผัดไทยกุ้งสด", description: "เส้นจันทร์ผัดกับซอสเข้มข้น", price: 60, category_id: 1, image_url: "padthai.jpg" },
  { name: "ต้มยำกุ้ง", description: "น้ำซุปต้มยำรสจัดจ้าน", price: 80, category_id: 2, image_url: "tomyum.jpg" },
  { name: "ยำวุ้นเส้น", description: "ยำเผ็ดเปรี้ยวกลมกล่อม", price: 55, category_id: 3, image_url: "yum.jpg" },
  { name: "ไก่ทอดน้ำปลา", description: "กรอบนอกนุ่มใน", price: 70, category_id: 4, image_url: "friedchicken.jpg" },
  { name: "หมูปิ้ง", description: "หมูหมักเครื่องเทศย่างหอม", price: 50, category_id: 5, image_url: "grilledpork.jpg" },
  { name: "ชาเย็น", description: "เครื่องดื่มเย็นชื่นใจ", price: 40, category_id: 6, image_url: "thaitea.jpg" },
  { name: "ข้าวเหนียวมะม่วง", description: "ข้าวเหนียวนุ่ม มะม่วงหวาน", price: 65, category_id: 7, image_url: "mango.jpg" },
  { name: "ข้าวผัดกุ้ง", description: "ข้าวผัดหอมกลิ่นกระทะ", price: 70, category_id: 8, image_url: "friedrice.jpg" }
];

products.forEach(p => {
  db.run(
    "INSERT INTO Products (name, description, price, category_id, image_url) VALUES (?, ?, ?, ?, ?)",
    [p.name, p.description, p.price, p.category_id, p.image_url],
    (err) => {
      if (err) console.log("❌ Insert product error:", err.message);
    }
  );
});

const promotions = [
        ['ส่วนลด 20% สำหรับลูกค้าใหม่', 'ลด 20% สำหรับการสั่งซื้อครั้งแรก', 'percentage', 20, null, null, 200, 100, 100, 1, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'NEW20'],
        ['ลด 50 บาท เมื่อซื้อครบ 300', 'ลดทันที 50 บาท เมื่อสั่งอาหารครบ 300 บาท', 'fixed_amount', 50, null, null, 300, null, null, null, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'SAVE50'],
        ['ซื้อ 2 แถม 1 เครื่องดื่ม', 'ซื้อเครื่องดื่ม 2 แก้ว แถมฟรี 1 แก้ว', 'buy_x_get_y', null, 2, 1, 0, null, null, null, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'DRINK321'],
        ['จัดส่งฟรี', 'ฟรีค่าจัดส่งสำหรับทุกออร์เดอร์', 'free_shipping', 30, null, null, 0, null, null, null, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'FREESHIP'],
        ['ส่วนลดของหวาน 15%', 'ส่วนลด 15% สำหรับของหวานทุกชนิด', 'category_discount', 15, null, null, 0, 50, null, null, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'SWEET15']
    ];

promotions.forEach(promotion => {
    db.run(`
        INSERT OR IGNORE INTO Promotions 
        (name, description, type, discount_value, buy_quantity, get_quantity, min_order_amount, max_discount_amount, usage_limit, usage_per_customer, start_date, end_date, status, promo_code) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, promotion);
});

db.run(`INSERT OR IGNORE INTO Promotion_Categories (promotion_id, category_id) VALUES (5, 3)`);

console.log("✅ Data inserted successfully.");
db.close();
