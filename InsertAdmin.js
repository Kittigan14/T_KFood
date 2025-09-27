// setup.js - Run this file to create initial admin user and sample data
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'database.db');
const db = new sqlite3.Database(dbPath);

async function setupDatabase() {
    console.log('🚀 Setting up T&KFood Database...');

    try {
        await createAdminUser();
        await createSampleCategories();
        await createSampleProducts();
        await createSampleEmployees();

        console.log('✅ Database setup completed successfully!');
        console.log('📋 Login credentials:');
        console.log('   Email: admin@tkfood.com');
        console.log('   Password: admin123');
        console.log('🌐 Access admin panel at: http://localhost:3000/admin');

    } catch (error) {
        console.error('❌ Setup failed:', error);
    } finally {
        db.close();
    }
}

function createAdminUser() {
    return new Promise((resolve, reject) => {
        const hashedPassword = bcrypt.hashSync('admin123', 10);

        db.run(`
            INSERT OR IGNORE INTO Users (name, email, password, role, created_at) 
            VALUES (?, ?, ?, ?, ?)
        `, ['Admin User', 'admin@tkfood.com', hashedPassword, 'admin', new Date().toISOString()],
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    console.log('👤 Admin user created');
                    resolve();
                }
            });
    });
}

function createAdminUser() {
    return new Promise((resolve, reject) => {
        const promotions = [
            ['ส่วนลด 20% สำหรับลูกค้าใหม่', 'ลด 20% สำหรับการสั่งซื้อครั้งแรก', 'percentage', 20, null, null, 200, 100, 100, 1, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'NEW20'],
            ['ลด 50 บาท เมื่อซื้อครบ 300', 'ลดทันที 50 บาท เมื่อสั่งอาหารครบ 300 บาท', 'fixed_amount', 50, null, null, 300, null, null, null, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'SAVE50'],
            ['ซื้อ 2 แถม 1 เครื่องดื่ม', 'ซื้อเครื่องดื่ม 2 แก้ว แถมฟรี 1 แก้ว', 'buy_x_get_y', null, 2, 1, 0, null, null, null, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'DRINK321'],
            ['จัดส่งฟรี', 'ฟรีค่าจัดส่งสำหรับทุกออร์เดอร์', 'free_shipping', 30, null, null, 0, null, null, null, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'FREESHIP'],
            ['ส่วนลดของหวาน 15%', 'ส่วนลด 15% สำหรับของหวานทุกชนิด', 'category_discount', 15, null, null, 0, 50, null, null, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active', 'SWEET15']
        ];

        const sql = `
            INSERT OR IGNORE INTO Promotions 
            (name, description, type, discount_value, buy_quantity, get_quantity, min_order_amount, max_discount_amount, usage_limit, usage_per_customer, start_date, end_date, status, promo_code) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        let inserted = 0;
        promotions.forEach((promo, index) => {
            db.run(sql, promo, function (err) {
                if (err) {
                    reject(err);
                } else {
                    inserted++;
                    if (inserted === promotions.length) {
                        console.log('✅ Promotions inserted successfully');
                        resolve();
                    }
                }
            });
        });
    });
}

function createSampleCategories() {
    return new Promise((resolve, reject) => {
        const categories = [{
                id: 1,
                name: "เมนูผัด"
            },
            {
                id: 2,
                name: "เมนูต้ม"
            },
            {
                id: 3,
                name: "เมนูยำ"
            },
            {
                id: 4,
                name: "เมนูทอด"
            },
            {
                id: 5,
                name: "เมนูปิ้งย่าง"
            },
            {
                id: 6,
                name: "เครื่องดื่ม"
            },
            {
                id: 7,
                name: "ของหวาน"
            },
            {
                id: 8,
                name: "เมนูข้าว"
            }
        ];

        let completed = 0;
        categories.forEach((categoryName, index) => {
            db.run(`
                INSERT OR IGNORE INTO Categories (category_id, name) 
                VALUES (?, ?)
            `, [index + 1, categoryName], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                completed++;
                if (completed === categories.length) {
                    console.log('📂 Sample categories created');
                    resolve();
                }
            });
        });
    });
}

function createSampleProducts() {
    return new Promise((resolve, reject) => {
        const products = [{
                name: "ผัดไทยกุ้งสด",
                description: "เส้นจันทร์ผัดกับซอสเข้มข้น",
                price: 60,
                category_id: 1,
                image_url: "padthai.jpg"
            },
            {
                name: "ผัดกะเพราไก่",
                description: "กะเพราหอมเผ็ดร้อน เสิร์ฟพร้อมข้าว",
                price: 55,
                category_id: 1,
                image_url: "gapao.jpg"
            },
            {
                name: "ผัดซีอิ๊วหมู",
                description: "เส้นใหญ่ผัดซีอิ๊วเข้มข้น",
                price: 60,
                category_id: 1,
                image_url: "padseeew.jpg"
            },
            {
                name: "ผัดพริกแกงหมู",
                description: "เผ็ดจัดจ้าน หอมเครื่องแกง",
                price: 65,
                category_id: 1,
                image_url: "padprikgaeng.jpg"
            },
            {
                name: "ราดหน้าหมูหมัก",
                description: "ราดหน้าเส้นใหญ่ หอมอร่อย",
                price: 70,
                category_id: 1,
                image_url: "radna.jpg"
            },

            {
                name: "ต้มยำกุ้ง",
                description: "น้ำซุปต้มยำรสจัดจ้าน",
                price: 80,
                category_id: 2,
                image_url: "tomyum.jpg"
            },
            {
                name: "ต้มจืดเต้าหู้หมูสับ",
                description: "น้ำซุปใสหอมหวาน",
                price: 55,
                category_id: 2,
                image_url: "tomjerd.jpg"
            },
            {
                name: "แกงจืดสาหร่าย",
                description: "เบาๆ สุขภาพดี",
                price: 50,
                category_id: 2,
                image_url: "seaweed_soup.jpg"
            },
            {
                name: "ต้มแซ่บกระดูกอ่อน",
                description: "แซ่บซี๊ดถึงใจ",
                price: 85,
                category_id: 2,
                image_url: "tomzap.jpg"
            },
            {
                name: "แกงเห็ดรวม",
                description: "น้ำแกงสมุนไพร หอมอร่อย",
                price: 65,
                category_id: 2,
                image_url: "mushroom_soup.jpg"
            },

            {
                name: "ยำวุ้นเส้น",
                description: "ยำเผ็ดเปรี้ยวกลมกล่อม",
                price: 55,
                category_id: 3,
                image_url: "yum.jpg"
            },
            {
                name: "ยำทะเลรวม",
                description: "กุ้ง หมึก หอย สดๆ",
                price: 95,
                category_id: 3,
                image_url: "yum_talay.jpg"
            },
            {
                name: "ยำมาม่า",
                description: "เผ็ดจี๊ดจ๊าดถึงใจ",
                price: 50,
                category_id: 3,
                image_url: "yum_mama.jpg"
            },
            {
                name: "ยำไข่ดาว",
                description: "ไข่ดาวทอดกรอบ คลุกน้ำยำ",
                price: 45,
                category_id: 3,
                image_url: "yum_kai_dao.jpg"
            },
            {
                name: "ยำหมูยอ",
                description: "หมูยอเด้งๆ คลุกน้ำยำ",
                price: 55,
                category_id: 3,
                image_url: "yum_moo_yor.jpg"
            },

            {
                name: "ไก่ทอดน้ำปลา",
                description: "กรอบนอกนุ่มใน",
                price: 70,
                category_id: 4,
                image_url: "friedchicken.jpg"
            },
            {
                name: "หมูสามชั้นทอด",
                description: "หมูทอดกรอบ เค็มนิดๆ",
                price: 80,
                category_id: 4,
                image_url: "friedpork.jpg"
            },
            {
                name: "ปลาทอดกรอบ",
                description: "ปลาทอดหอม กรอบอร่อย",
                price: 100,
                category_id: 4,
                image_url: "friedfish.jpg"
            },
            {
                name: "ทอดมันกุ้ง",
                description: "ทอดมันกุ้งเด้งๆ",
                price: 85,
                category_id: 4,
                image_url: "shrimpcake.jpg"
            },
            {
                name: "ปอเปี๊ยะทอด",
                description: "ไส้ผักหมูสับ ห่อแป้งทอด",
                price: 60,
                category_id: 4,
                image_url: "springroll.jpg"
            },

            {
                name: "หมูปิ้ง",
                description: "หมูหมักเครื่องเทศย่างหอม",
                price: 50,
                category_id: 5,
                image_url: "grilledpork.jpg"
            },
            {
                name: "ไก่ย่าง",
                description: "ไก่หมักสมุนไพร ย่างเตาถ่าน",
                price: 65,
                category_id: 5,
                image_url: "grilledchicken.jpg"
            },
            {
                name: "เนื้อย่าง",
                description: "เนื้อย่างนุ่มลิ้น",
                price: 90,
                category_id: 5,
                image_url: "grilledbeef.jpg"
            },
            {
                name: "ปลาหมึกย่าง",
                description: "หมึกสดย่างพร้อมน้ำจิ้มซีฟู้ด",
                price: 95,
                category_id: 5,
                image_url: "grilledsquid.jpg"
            },
            {
                name: "ไส้อั่ว",
                description: "หมูสมุนไพรย่างแบบเหนือ",
                price: 85,
                category_id: 5,
                image_url: "saiua.jpg"
            },

            {
                name: "ชาเย็น",
                description: "เครื่องดื่มเย็นชื่นใจ",
                price: 40,
                category_id: 6,
                image_url: "thaitea.jpg"
            },
            {
                name: "กาแฟเย็น",
                description: "กาแฟเข้มข้น หอมละมุน",
                price: 45,
                category_id: 6,
                image_url: "icedcoffee.jpg"
            },
            {
                name: "น้ำมะนาวโซดา",
                description: "สดชื่นซาบซ่า",
                price: 35,
                category_id: 6,
                image_url: "lemon_soda.jpg"
            },
            {
                name: "น้ำเปล่า",
                description: "สะอาด สดชื่น",
                price: 15,
                category_id: 6,
                image_url: "water.jpg"
            },
            {
                name: "โกโก้เย็น",
                description: "โกโก้เข้ม หวานมัน",
                price: 45,
                category_id: 6,
                image_url: "icedcocoa.jpg"
            },

            {
                name: "ข้าวเหนียวมะม่วง",
                description: "ข้าวเหนียวนุ่ม มะม่วงหวาน",
                price: 65,
                category_id: 7,
                image_url: "mango.jpg"
            },
            {
                name: "บัวลอย",
                description: "น้ำกะทิหอม หวานกำลังดี",
                price: 40,
                category_id: 7,
                image_url: "bualoy.jpg"
            },
            {
                name: "ลอดช่อง",
                description: "หวานเย็น ชื่นใจ",
                price: 35,
                category_id: 7,
                image_url: "lodchong.jpg"
            },
            {
                name: "ไอศกรีมกะทิ",
                description: "เย็นๆ หอมกะทิสด",
                price: 30,
                category_id: 7,
                image_url: "coconuticecream.jpg"
            },
            {
                name: "เครปเค้กสตรอเบอร์รี่",
                description: "เครปนุ่ม ครีมสด ราดซอส",
                price: 85,
                category_id: 7,
                image_url: "strawberry_crepe.jpg"
            },

            {
                name: "ข้าวผัดกุ้ง",
                description: "ข้าวผัดหอมกลิ่นกระทะ",
                price: 70,
                category_id: 8,
                image_url: "friedrice.jpg"
            },
            {
                name: "ข้าวมันไก่",
                description: "ไก่นุ่ม น้ำจิ้มเต้าเจี้ยว",
                price: 60,
                category_id: 8,
                image_url: "khaomankai.jpg"
            },
            {
                name: "ข้าวแกงเขียวหวาน",
                description: "แกงเขียวหวานเข้มข้น",
                price: 75,
                category_id: 8,
                image_url: "green_curry.jpg"
            },
            {
                name: "ข้าวหน้าเป็ด",
                description: "เป็ดย่างหนังกรอบ",
                price: 80,
                category_id: 8,
                image_url: "duckrice.jpg"
            },
            {
                name: "ข้าวหมูกระเทียม",
                description: "หมูผัดกระเทียมหอมๆ",
                price: 65,
                category_id: 8,
                image_url: "garlicporkrice.jpg"
            }
        ];

        let completed = 0;
        products.forEach((product) => {
            db.run(`
                INSERT OR IGNORE INTO Products (name, category_id, description, price, image_url, status) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [product.name, product.category_id, product.description, product.price, product.image_url, 'available'],
                function (err) {
                    if (err) {
                        console.error('Error creating product:', err);
                    } else {
                        completed++;
                        if (completed === products.length) {
                            console.log('🍽️ Sample products created');
                            resolve();
                        }
                    }
                });
        });
    });
}

function createSampleEmployees() {
    return new Promise((resolve, reject) => {
        const employees = [{
                name: 'สมชาย ใจดี',
                email: 'somchai@tkfood.com',
                phone: '081-234-5678',
                position: 'หัวหน้าครัว',
                salary: 25000,
                hire_date: '2023-01-15'
            },
            {
                name: 'สมหญิง รักงาน',
                email: 'somying@tkfood.com',
                phone: '082-345-6789',
                position: 'พนักงานเสิร์ฟ',
                salary: 18000,
                hire_date: '2023-03-20'
            },
            {
                name: 'วิรัช มานะดี',
                email: 'wirat@tkfood.com',
                phone: '083-456-7890',
                position: 'พนักงานครัว',
                salary: 20000,
                hire_date: '2023-06-10'
            }
        ];

        let completed = 0;
        employees.forEach((employee) => {
            db.run(`
                INSERT OR IGNORE INTO Employees (name, email, phone, position, salary, hire_date) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [employee.name, employee.email, employee.phone, employee.position, employee.salary, employee.hire_date],
                function (err) {
                    if (err) {
                        console.error('Error creating employee:', err);
                    } else {
                        completed++;
                        if (completed === employees.length) {
                            console.log('👨‍💼 Sample employees created');
                            resolve();
                        }
                    }
                });
        });
    });
}

// Run setup
setupDatabase();