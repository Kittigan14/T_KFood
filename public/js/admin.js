class AdminPanel {
    constructor() {
        this.currentSection = 'dashboard';
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.loadDashboard();
    }

    setupNavigation() {
        document.querySelectorAll('.menu-item').forEach(item => {
            if (item.href && !item.href.includes('logout')) {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const section = item.dataset.section;
                    if (section) {
                        this.switchSection(section);
                    }
                });
            }
        });
    }

    setupEventListeners() {
        // Form submissions
        document.getElementById('product-form') ?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        document.getElementById('category-form') ?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCategory();
        });

        document.getElementById('employee-form') ?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEmployee();
        });

        // Search and filter inputs
        document.getElementById('product-search') ?.addEventListener('input',
            debounce((e) => this.filterProducts(e.target.value), 300)
        );

        document.getElementById('member-search') ?.addEventListener('input',
            debounce((e) => this.filterMembers(e.target.value), 300)
        );

        document.getElementById('product-category-filter') ?.addEventListener('change',
            (e) => this.filterProductsByCategory(e.target.value)
        );

        document.getElementById('order-status-filter') ?.addEventListener('change',
            (e) => this.filterOrdersByStatus(e.target.value)
        );

        document.getElementById('order-date-filter') ?.addEventListener('change',
            (e) => this.filterOrdersByDate(e.target.value)
        );

        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    switchSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`) ?.classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`) ?.classList.add('active');

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            settings: 'Settings',
            products: 'Product Management',
            categories: 'Category Management',
            members: 'Member Information',
            orders: 'Orders Management',
            employees: 'Employee Management'
        };
        document.getElementById('page-title').textContent = titles[sectionName] || sectionName;

        this.currentSection = sectionName;
        this.loadSectionData(sectionName);
    }

    async loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'products':
                await this.loadProducts();
                await this.loadCategoriesForFilter();
                break;
            case 'categories':
                await this.loadCategories();
                break;
            case 'members':
                await this.loadMembers();
                break;
            case 'orders':
                await this.loadOrders();
                break;
            case 'employees':
                await this.loadEmployees();
                break;
        }
    }

    // Dashboard Methods
    async loadDashboard() {
        try {
            const [ordersRes, productsRes, membersRes] = await Promise.all([
                fetch('/api/admin/stats/orders'),
                fetch('/api/admin/stats/products'),
                fetch('/api/admin/stats/members')
            ]);

            if (ordersRes.ok) {
                const ordersData = await ordersRes.json();
                document.getElementById('total-orders').textContent = ordersData.total || 0;
            }

            if (productsRes.ok) {
                const productsData = await productsRes.json();
                document.getElementById('total-products').textContent = productsData.total || 0;
            }

            if (membersRes.ok) {
                const membersData = await membersRes.json();
                document.getElementById('total-members').textContent = membersData.total || 0;
            }

            await this.loadRecentOrders();
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    async loadRecentOrders() {
        try {
            const container = document.getElementById('recent-orders-list');
            container.innerHTML = '<div class="loading">Loading...</div>';

            const response = await fetch('/api/admin/orders/recent');
            const data = await response.json();

            if (data.success && data.orders.length > 0) {
                container.innerHTML = data.orders.map(order => `
                    <div class="recent-order-item">
                        <div>
                            <strong>Order #${order.order_id}</strong>
                            <span class="status-badge status-${order.order_status}">${order.order_status}</span>
                        </div>
                        <div>
                            <span>${order.customer_name}</span>
                            <span>${order.final_amount} บาท</span>
                        </div>
                        <div class="order-date">${new Date(order.created_at).toLocaleDateString('th-TH')}</div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p>No recent orders found.</p>';
            }
        } catch (error) {
            console.error('Error loading recent orders:', error);
            document.getElementById('recent-orders-list').innerHTML = '<p class="error">Error loading orders</p>';
        }
    }

    // ✅ Products Methods (แก้แล้ว)
    async loadProducts() {
        try {
            const container = document.getElementById('products-table-container');
            container.innerHTML = '<div class="loading">Loading products...</div>';

            const response = await fetch('/api/admin/products');
            const data = await response.json();

            if (data.success) {
                this.renderProductsTable(data.products);
            } else {
                container.innerHTML = '<p class="error">Error loading products</p>';
            }
        } catch (error) {
            console.error('Error loading products:', error);
            document.getElementById('products-table-container').innerHTML =
                '<p class="error">Error loading products</p>';
        }
    }

    renderProductsTable(products) {
        const container = document.getElementById('products-table-container');

        if (!products || products.length === 0) {
            container.innerHTML = '<p>No products found.</p>';
            return;
        }

        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => `
                        <tr>
                            <td><img src="/images/${product.image_url || 'placeholder.jpg'}" alt="${product.name}"></td>
                            <td>${product.name}</td>
                            <td>${product.category_name || 'No Category'}</td>
                            <td>${product.price} บาท</td>
                            <td><span class="status-badge status-${product.status}">${product.status}</span></td>
                            <td class="action-buttons">
                                <button class="btn-edit" onclick="adminPanel.editProduct(${product.product_id})">Edit</button>
                                <button class="btn-delete" onclick="adminPanel.deleteProduct(${product.product_id})">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = table;
    }

    async loadCategoriesForFilter() {
        try {
            const response = await fetch('/api/categories');
            const data = await response.json();

            if (data.success) {
                const select = document.getElementById('product-category-filter');
                const productCategorySelect = document.getElementById('product-category');

                const options = data.categories.map(cat =>
                    `<option value="${cat.category_id}">${cat.name}</option>`
                ).join('');

                if (select) {
                    select.innerHTML = '<option value="">All Categories</option>' + options;
                }

                if (productCategorySelect) {
                    productCategorySelect.innerHTML = '<option value="">Select Category</option>' + options;
                }
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    openProductModal(productId = null) {
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('product-modal-title');
        const form = document.getElementById('product-form');

        if (productId) {
            title.textContent = 'Edit Product';
            this.loadProductForEdit(productId);
        } else {
            title.textContent = 'Add Product';
            form.reset();
            document.getElementById('product-id').value = '';
        }

        modal.classList.add('active');
    }

    async loadProductForEdit(productId) {
        try {
            const response = await fetch(`/api/admin/products/${productId}`);
            const data = await response.json();

            if (data.success) {
                const product = data.product;
                document.getElementById('product-id').value = product.product_id;
                document.getElementById('product-name').value = product.name;
                document.getElementById('product-category').value = product.category_id || '';
                document.getElementById('product-description').value = product.description || '';
                document.getElementById('product-price').value = product.price;
                document.getElementById('product-image').value = product.image_url || '';
                document.getElementById('product-status').value = product.status;
            }
        } catch (error) {
            console.error('Error loading product:', error);
            this.showNotification('Error loading product data', 'error');
        }
    }

    async saveProduct() {
        const form = document.getElementById('product-form');
        const formData = new FormData(form);
        const productId = document.getElementById('product-id').value;

        const productData = {
            name: document.getElementById('product-name').value,
            category_id: document.getElementById('product-category').value || null,
            description: document.getElementById('product-description').value,
            price: parseFloat(document.getElementById('product-price').value),
            image_url: document.getElementById('product-image').value,
            status: document.getElementById('product-status').value
        };

        try {
            const url = productId ? `/api/admin/products/${productId}` : '/api/admin/products';
            const method = productId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(productId ? 'Product updated successfully' : 'Product added successfully', 'success');
                this.closeModal('product-modal');
                this.loadProducts();
            } else {
                this.showNotification(data.error || 'Error saving product', 'error');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            this.showNotification('Error saving product', 'error');
        }
    }

    async editProduct(productId) {
        this.openProductModal(productId);
    }

    async deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/products/${productId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Product deleted successfully', 'success');
                this.loadProducts();
            } else {
                this.showNotification(data.error || 'Error deleting product', 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            this.showNotification('Error deleting product', 'error');
        }
    }

    // Categories Methods
    async loadCategories() {
        try {
            const container = document.getElementById('categories-table-container');
            container.innerHTML = '<div class="loading">Loading categories...</div>';

            const response = await fetch('/api/admin/categories');
            const data = await response.json();

            if (data.success) {
                this.renderCategoriesTable(data.categories);
            } else {
                container.innerHTML = '<p class="error">Error loading categories</p>';
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            document.getElementById('categories-table-container').innerHTML = '<p class="error">Error loading categories</p>';
        }
    }

    renderCategoriesTable(categories) {
        const container = document.getElementById('categories-table-container');

        if (categories.length === 0) {
            container.innerHTML = '<p>No categories found.</p>';
            return;
        }

        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Product Count</th>
                        <th>Created At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${categories.map(category => `
                        <tr>
                            <td>${category.name}</td>
                            <td>${category.product_count || 0}</td>
                            <td>${new Date(category.created_at).toLocaleDateString('th-TH')}</td>
                            <td class="action-buttons">
                                <button class="btn-edit" onclick="adminPanel.editCategory(${category.category_id})">Edit</button>
                                <button class="btn-delete" onclick="adminPanel.deleteCategory(${category.category_id})">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = table;
    }

    openCategoryModal(categoryId = null) {
        const modal = document.getElementById('category-modal');
        const title = document.getElementById('category-modal-title');
        const form = document.getElementById('category-form');

        if (categoryId) {
            title.textContent = 'Edit Category';
            this.loadCategoryForEdit(categoryId);
        } else {
            title.textContent = 'Add Category';
            form.reset();
            document.getElementById('category-id').value = '';
        }

        modal.classList.add('active');
    }

    async loadCategoryForEdit(categoryId) {
        try {
            const response = await fetch(`/api/admin/categories/${categoryId}`);
            const data = await response.json();

            if (data.success) {
                const category = data.category;
                document.getElementById('category-id').value = category.category_id;
                document.getElementById('category-name').value = category.name;
            }
        } catch (error) {
            console.error('Error loading category:', error);
            this.showNotification('Error loading category data', 'error');
        }
    }

    async saveCategory() {
        const categoryId = document.getElementById('category-id').value;
        const categoryData = {
            name: document.getElementById('category-name').value
        };

        try {
            const url = categoryId ? `/api/admin/categories/${categoryId}` : '/api/admin/categories';
            const method = categoryId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(categoryId ? 'Category updated successfully' : 'Category added successfully', 'success');
                this.closeModal('category-modal');
                this.loadCategories();
                this.loadCategoriesForFilter(); // Refresh filter options
            } else {
                this.showNotification(data.error || 'Error saving category', 'error');
            }
        } catch (error) {
            console.error('Error saving category:', error);
            this.showNotification('Error saving category', 'error');
        }
    }

    async editCategory(categoryId) {
        this.openCategoryModal(categoryId);
    }

    async deleteCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category? This will affect products in this category.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/categories/${categoryId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Category deleted successfully', 'success');
                this.loadCategories();
                this.loadCategoriesForFilter(); // Refresh filter options
            } else {
                this.showNotification(data.error || 'Error deleting category', 'error');
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            this.showNotification('Error deleting category', 'error');
        }
    }

    // Members Methods
    async loadMembers() {
        try {
            const container = document.getElementById('members-table-container');
            container.innerHTML = '<div class="loading">Loading members...</div>';

            const response = await fetch('/api/admin/members');
            const data = await response.json();

            if (data.success) {
                this.renderMembersTable(data.members);
            } else {
                container.innerHTML = '<p class="error">Error loading members</p>';
            }
        } catch (error) {
            console.error('Error loading members:', error);
            document.getElementById('members-table-container').innerHTML = '<p class="error">Error loading members</p>';
        }
    }

    renderMembersTable(members) {
        const container = document.getElementById('members-table-container');

        if (members.length === 0) {
            container.innerHTML = '<p>No members found.</p>';
            return;
        }

        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Join Date</th>
                        <th>Total Orders</th>
                    </tr>
                </thead>
                <tbody>
                    ${members.map(member => `
                        <tr>
                            <td>${member.name}</td>
                            <td>${member.email}</td>
                            <td>${member.phone || 'N/A'}</td>
                            <td><span class="status-badge ${member.role === 'admin' ? 'status-completed' : 'status-pending'}">${member.role}</span></td>
                            <td>${new Date(member.created_at).toLocaleDateString('th-TH')}</td>
                            <td>${member.order_count || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = table;
    }

    // Orders Methods
    async loadOrders() {
        try {
            const container = document.getElementById('orders-table-container');
            container.innerHTML = '<div class="loading">Loading orders...</div>';

            const response = await fetch('/api/admin/orders');
            const data = await response.json();

            if (data.success) {
                this.renderOrdersTable(data.orders);
            } else {
                container.innerHTML = '<p class="error">Error loading orders</p>';
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            document.getElementById('orders-table-container').innerHTML = '<p class="error">Error loading orders</p>';
        }
    }

    renderOrdersTable(orders) {
        const container = document.getElementById('orders-table-container');

        if (orders.length === 0) {
            container.innerHTML = '<p>No orders found.</p>';
            return;
        }

        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th>Order Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td>#${order.order_id}</td>
                            <td>${order.customer_name}</td>
                            <td>${order.final_amount} บาท</td>
                            <td><span class="status-badge status-${order.order_status}">${order.order_status}</span></td>
                            <td>${new Date(order.created_at).toLocaleDateString('th-TH')}</td>
                            <td class="action-buttons">
                                <button class="btn-view" onclick="adminPanel.viewOrderDetails(${order.order_id})">View</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = table;
    }

    async viewOrderDetails(orderId) {
        try {
            const response = await fetch(`/api/admin/orders/${orderId}`);
            const data = await response.json();

            if (data.success) {
                this.showOrderModal(data.order, data.items);
            } else {
                this.showNotification('Error loading order details', 'error');
            }
        } catch (error) {
            console.error('Error loading order details:', error);
            this.showNotification('Error loading order details', 'error');
        }
    }

    showOrderModal(order, items) {
        const modal = document.getElementById('order-modal');
        const content = document.getElementById('order-details-content');

        const orderContent = `
            <div class="order-header">
                <div><strong>Order ID:</strong> #${order.order_id}</div>
                <div><strong>Customer:</strong> ${order.customer_name}</div>
                <div><strong>Total:</strong> ${order.final_amount} บาท</div>
                <div><strong>Status:</strong> <span class="status-badge status-${order.order_status}">${order.order_status}</span></div>
                <div><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleString('th-TH')}</div>
                <div><strong>Address:</strong> ${order.delivery_address || 'N/A'}</div>
            </div>

            <div class="order-items">
                <h4>Order Items</h4>
                ${items.map(item => `
                    <div class="order-item">
                        <img src="/images/${item.image_url || 'placeholder.jpg'}" alt="${item.name}">
                        <div class="order-item-info">
                            <h5>${item.name}</h5>
                            <p>Quantity: ${item.quantity} × ${item.price} บาท</p>
                        </div>
                        <div class="order-item-price">${item.quantity * item.price} บาท</div>
                    </div>
                `).join('')}
            </div>

            <div class="order-total">
                <h4>Total: ${order.final_amount} บาท</h4>
            </div>

            <div class="status-update">
                <h4>Update Order Status</h4>
                <select id="order-status-select">
                    <option value="pending" ${order.order_status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="accepted" ${order.order_status === 'accepted' ? 'selected' : ''}>Accepted</option>
                    <option value="cooking" ${order.order_status === 'cooking' ? 'selected' : ''}>Cooking</option>
                    <option value="delivering" ${order.order_status === 'delivering' ? 'selected' : ''}>Delivering</option>
                    <option value="completed" ${order.order_status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="cancelled" ${order.order_status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
                <button class="btn-submit" onclick="adminPanel.updateOrderStatus(${order.order_id})">Update Status</button>
            </div>
        `;

        content.innerHTML = orderContent;
        modal.classList.add('active');
    }

    async updateOrderStatus(orderId) {
        const status = document.getElementById('order-status-select').value;

        try {
            const response = await fetch(`/api/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Order status updated successfully', 'success');
                this.closeModal('order-modal');
                this.loadOrders();
            } else {
                this.showNotification(data.error || 'Error updating order status', 'error');
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            this.showNotification('Error updating order status', 'error');
        }
    }

    // Employees Methods
    async loadEmployees() {
        try {
            const container = document.getElementById('employees-table-container');
            container.innerHTML = '<div class="loading">Loading employees...</div>';

            const response = await fetch('/api/admin/employees');
            const data = await response.json();

            if (data.success) {
                this.renderEmployeesTable(data.employees);
            } else {
                container.innerHTML = '<p class="error">Error loading employees</p>';
            }
        } catch (error) {
            console.error('Error loading employees:', error);
            document.getElementById('employees-table-container').innerHTML = '<p class="error">Error loading employees</p>';
        }
    }

    renderEmployeesTable(employees) {
        const container = document.getElementById('employees-table-container');

        if (employees.length === 0) {
            container.innerHTML = '<p>No employees found.</p>';
            return;
        }

        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Position</th>
                        <th>Salary</th>
                        <th>Hire Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${employees.map(employee => `
                        <tr>
                            <td>${employee.name}</td>
                            <td>${employee.email}</td>
                            <td>${employee.phone || 'N/A'}</td>
                            <td>${employee.position}</td>
                            <td>${employee.salary ? employee.salary + ' บาท' : 'N/A'}</td>
                            <td>${new Date(employee.hire_date).toLocaleDateString('th-TH')}</td>
                            <td class="action-buttons">
                                <button class="btn-edit" onclick="adminPanel.editEmployee(${employee.employee_id})">Edit</button>
                                <button class="btn-delete" onclick="adminPanel.deleteEmployee(${employee.employee_id})">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = table;
    }

    openEmployeeModal(employeeId = null) {
        const modal = document.getElementById('employee-modal');
        const title = document.getElementById('employee-modal-title');
        const form = document.getElementById('employee-form');

        if (employeeId) {
            title.textContent = 'Edit Employee';
            this.loadEmployeeForEdit(employeeId);
        } else {
            title.textContent = 'Add Employee';
            form.reset();
            document.getElementById('employee-id').value = '';
        }

        modal.classList.add('active');
    }

    // Products Methods
    async loadProducts() {
        try {
            const container = document.getElementById('products-table-container');
            container.innerHTML = '<div class="loading">Loading products...</div>';

            const response = await fetch('/api/admin/products');
            const data = await response.json();

            if (data.success) {
                this.renderProductsTable(data.products);
            } else {
                container.innerHTML = '<p class="error">Error loading products</p>';
            }
        } catch (error) {
            console.error('Error loading products:', error);
            document.getElementById('products-table-container').innerHTML =
                '<p class="error">Error loading products</p>';
        }
    }

    renderProductsTable(products) {
        const container = document.getElementById('products-table-container');

        if (!products || products.length === 0) {
            container.innerHTML = '<p>No products found.</p>';
            return;
        }

        const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(product => `
                    <tr>
                        <td><img src="/images/${product.image_url || 'placeholder.jpg'}" alt="${product.name}"></td>
                        <td>${product.name}</td>
                        <td>${product.category_name || 'No Category'}</td>
                        <td>${product.price} บาท</td>
                        <td><span class="status-badge status-${product.status}">${product.status}</span></td>
                        <td class="action-buttons">
                            <button class="btn-edit" onclick="adminPanel.editProduct(${product.product_id})">Edit</button>
                            <button class="btn-delete" onclick="adminPanel.deleteProduct(${product.product_id})">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
        container.innerHTML = table;
    }
};