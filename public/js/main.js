    const btnSettings = document.getElementById("btnSettings");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (btnSettings && dropdownMenu) {
        btnSettings.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle("hidden");
        });

        document.addEventListener("click", (e) => {
            if (!dropdownMenu.contains(e.target) && !btnSettings.contains(e.target)) {
                dropdownMenu.classList.add("hidden");
            }
        });
    }

    // Banner slideshow with enhanced functionality
    const slides = document.querySelectorAll("#bannerSlides img");
    let currentSlide = 0;

    function nextSlide() {
        if (slides.length <= 1) return;

        slides[currentSlide].classList.add("hidden");
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.remove("hidden");
    }

    if (slides.length > 1) {
        setInterval(nextSlide, 4000);
    }

    // Product Modal functionality
    const productList = document.getElementById("productList");
    const productModal = document.getElementById("productModal");
    const modalImage = document.getElementById("modalImage");
    const modalName = document.getElementById("modalName");
    const modalPrice = document.getElementById("modalPrice");
    const formCart = document.getElementById("formCart");
    const formFav = document.getElementById("formFav");


    if (productList) {
        productList.addEventListener("click", (e) => {
            const card = e.target.closest(".product-card");
            if (!card) return;

            const id = card.dataset.id;
            const name = card.dataset.name;
            const price = card.dataset.price;
            const image = card.dataset.image;

            modalImage.src = "/images/" + image;
            modalImage.alt = name;
            modalName.textContent = name;
            modalPrice.textContent = price + " บาท";

            const btnCart = productModal.querySelector(".btn-cart");
            const btnFav = productModal.querySelector(".btn-favorite");
            if (btnCart) btnCart.dataset.id = id;
            if (btnFav) btnFav.dataset.id = id;

            productModal.classList.remove("hidden");
            document.body.style.overflow = "hidden";
        });
    }

    async function addToCart(buttonElement) {
        if (!isLoggedIn) {
            showNotification('กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าลงตะกร้า', 'error');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
            return;
        }

        let productId = buttonElement ?.dataset ?.id || currentProductId;
        if (!productId) {
            showNotification('เกิดข้อผิดพลาด: ไม่พบข้อมูลสินค้า', 'error');
            return;
        }

        const button = buttonElement || document.querySelector('.btn-cart');
        const originalText = button.textContent;
        button.textContent = 'กำลังเพิ่ม...';
        button.disabled = true;

        try {
            const response = await fetch('/api/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    product_id: parseInt(productId),
                    quantity: 1
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                showNotification(data.message || 'เพิ่มสินค้าลงตะกร้าเรียบร้อย!', 'success');
                updateCartCount();
                closeModal();
            } else {
                showNotification(data.error || 'เกิดข้อผิดพลาดในการเพิ่มสินค้า', 'error');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            showNotification('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    async function toggleFavorite(buttonElement) {
        if (!isLoggedIn) {
            showNotification('กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าโปรด', 'error');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
            return;
        }

        let productId = buttonElement ?.dataset ?.id || currentProductId;
        if (!productId) {
            showNotification('เกิดข้อผิดพลาด: ไม่พบข้อมูลสินค้า', 'error');
            return;
        }

        const button = buttonElement || document.querySelector('.btn-favorite');
        const originalText = button.textContent;
        button.textContent = 'กำลังเพิ่ม...';
        button.disabled = true;

        try {
            const response = await fetch(`/api/favorites/add/${productId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (response.ok && data.success) {
                showNotification(data.message || 'เพิ่มเป็นสินค้าที่ชอบเรียบร้อย!', 'success');
                updateFavoriteCount();
                if (!data.already_exists) {
                    closeModal();
                }
            } else {
                showNotification(data.error || 'เกิดข้อผิดพลาดในการเพิ่มสินค้าโปรด', 'error');
            }
        } catch (error) {
            console.error('Error adding to favorites:', error);
            showNotification('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    // Modal close functionality
    function closeModal() {
        if (productModal) {
            productModal.classList.add("hidden");
            document.body.style.overflow = "";
        }
    }

    // Close modal when clicking outside
    if (productModal) {
        productModal.addEventListener("click", (e) => {
            if (e.target === productModal) {
                closeModal();
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && productModal && !productModal.classList.contains("hidden")) {
            closeModal();
        }
    });

    // Category filtering
    function filterCategory(catId) {
        showLoadingState();

        fetch(`/api/products?category_id=${catId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    updateProductList(data.products);
                } else {
                    throw new Error('Failed to fetch products');
                }
            })
            .catch(err => {
                console.error('Error fetching products:', err);
                showError('เกิดข้อผิดพลาดในการโหลดสินค้า');
            })
            .finally(() => {
                hideLoadingState();
            });
    }

    function showAllProducts() {
        showLoadingState();

        fetch('/api/products')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    updateProductList(data.products);
                } else {
                    throw new Error('Failed to fetch products');
                }
            })
            .catch(err => {
                console.error('Error fetching products:', err);
                showError('เกิดข้อผิดพลาดในการโหลดสินค้า');
            })
            .finally(() => {
                hideLoadingState();
            });
    }

    function updateProductList(products) {
        const list = document.getElementById("productList");
        if (!list) return;

        list.innerHTML = "";

        if (products.length === 0) {
            list.innerHTML = '<div class="no-products">ไม่มีสินค้าในหมวดหมู่นี้</div>';
            return;
        }

        products.forEach(p => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.dataset.id = p.product_id;
            productCard.dataset.name = p.name;
            productCard.dataset.price = p.price;
            productCard.dataset.image = p.image_url;

            productCard.innerHTML = `
                <img src="/images/${p.image_url}" alt="${p.name}" onerror="this.src='/images/placeholder.jpg'">
                <div class="info">
                    <h3>${p.name}</h3>
                    <p>${p.price} บาท</p>
                </div>
            `;

            list.appendChild(productCard);
        });
    }

    // Enhanced form submission with loading states
    if (formCart) {
        formCart.addEventListener('submit', (e) => {
            e.preventDefault();

            const button = formCart.querySelector('button');
            const originalText = button.textContent;

            // Show loading state
            button.textContent = 'กำลังเพิ่ม...';
            button.disabled = true;

            // Submit form
            fetch(formCart.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                })
                .then(response => {
                    if (response.ok) {
                        showSuccess('เพิ่มสินค้าลงตะกร้าเรียบร้อย!');
                        closeModal();
                        updateCartCount();
                    } else {
                        throw new Error('Failed to add to cart');
                    }
                })
                .catch(error => {
                    console.error('Error adding to cart:', error);
                    showError('เกิดข้อผิดพลาดในการเพิ่มสินค้า กรุณาลองใหม่');
                })
                .finally(() => {
                    button.textContent = originalText;
                    button.disabled = false;
                });
        });
    }

    if (formFav) {
        formFav.addEventListener('submit', (e) => {
            e.preventDefault();

            const button = formFav.querySelector('button');
            const originalText = button.textContent;

            // Show loading state
            button.textContent = 'กำลังเพิ่ม...';
            button.disabled = true;

            // Submit form
            fetch(formFav.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                })
                .then(response => {
                    if (response.ok) {
                        showSuccess('เพิ่มเป็นสินค้าที่ชอบเรียบร้อย!');
                        closeModal();
                        updateFavoriteCount();
                    } else {
                        throw new Error('Failed to add to favorites');
                    }
                })
                .catch(error => {
                    console.error('Error adding to favorites:', error);
                    showError('เกิดข้อผิดพลาดในการเพิ่มสินค้าที่ชอบ กรุณาลองใหม่');
                })
                .finally(() => {
                    button.textContent = originalText;
                    button.disabled = false;
                });
        });
    }

    // Utility functions for user feedback
    function showSuccess(message) {
        const notification = createNotification(message, 'success');
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function showError(message) {
        // Create error notification
        const notification = createNotification(message, 'error');
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    function createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 3000;
            max-width: 350px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            ${type === 'success' ? 'background: linear-gradient(135deg, #4CAF50, #45a049);' : 'background: linear-gradient(135deg, #f44336, #d32f2f);'}
        `;
        notification.textContent = message;

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        return notification;
    }

    function showLoadingState() {
        const list = document.getElementById("productList");
        if (list) {
            list.innerHTML = '<div class="loading-spinner">กำลังโหลดสินค้า...</div>';
        }
    }

    function hideLoadingState() {}

    function updateCartCount() {
        fetch('/api/cart/count')
            .then(res => res.json())
            .then(data => {
                const cartIcon = document.querySelector('.navbar-right .icon[href="/cart"]');
                if (cartIcon && data.count) {
                    cartIcon.innerHTML = `<img src="/images/icon/shopping-cart2.png" width="24px" style="margin-right: 10px;"> ${data.count}`;
                }
            })
            .catch(err => console.log('Could not update cart count'));
    }

    function updateFavoriteCount() {
        fetch('/api/favorites/count')
            .then(res => res.json())
            .then(data => {
                const favIcon = document.querySelector('.navbar-right .icon[href="/favorites"]');
                if (favIcon && data.count) {
                    favIcon.innerHTML = `<img src="/images/icon/heart.png" width="24px"> ${data.count}`;
                }
            })
            .catch(err => console.log('Could not update favorite count'));
    }

    // Initialize page
    document.addEventListener('DOMContentLoaded', function () {
        console.log('T&KFood website loaded successfully!');

        updateCartCount();
        updateFavoriteCount();

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            });
        });
    });

    function showNotification(message, type = 'info') {
        if (type === 'success') {
            showSuccess(message);
        } else if (type === 'error') {
            showError(message);
        } else {
            console.log('Notification:', message);
        }
    }