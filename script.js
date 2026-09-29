/* ===== Anh Khải Shop - Main JavaScript (Mobile First & Cloudflare Workers Backend) ===== */

(function () {
    'use strict';

    // ===== DOM Elements =====
    const header = document.getElementById('header');
    const hamburger = document.getElementById('hamburger');
    const navbar = document.getElementById('navbar');
    const backToTop = document.getElementById('backToTop');
    const contactForm = document.getElementById('contactForm');
    const toast = document.getElementById('toast');
    const toastClose = document.getElementById('toastClose');
    const toastMessage = document.getElementById('toastMessage');
    const searchInput = document.getElementById('searchInput');
    const productsGrid = document.getElementById('productsGrid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const headerLinks = document.querySelectorAll('.header__link');

    // ===== Cart Elements =====
    const cartToggleBtn = document.getElementById('cartToggleBtn');
    const cartCloseBtn = document.getElementById('cartCloseBtn');
    const cartDrawer = document.getElementById('cartDrawer');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartBadgeCount = document.getElementById('cartBadgeCount');
    const cartTotalCount = document.getElementById('cartTotalCount');
    const cartTotalPrice = document.getElementById('cartTotalPrice');
    const cartDrawerBody = document.getElementById('cartDrawerBody');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const messageInput = document.getElementById('message');

    // ===== Auth Elements =====
    const openAuthModalBtn = document.getElementById('openAuthModalBtn');
    const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    const authModalOverlay = document.getElementById('authModalOverlay');
    const tabLoginBtn = document.getElementById('tabLoginBtn');
    const tabRegisterBtn = document.getElementById('tabRegisterBtn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authHeaderWidget = document.getElementById('authHeaderWidget');

    // ===== Cart State =====
    let cart = JSON.parse(localStorage.getItem('anhkhai_cart')) || [];

    function saveCart() {
        localStorage.setItem('anhkhai_cart', JSON.stringify(cart));
        updateCartUI();
    }

    function formatPrice(price) {
        return parseInt(price, 10).toLocaleString('vi-VN') + '₫';
    }

    // Helper: Require Login to Purchase
    function checkAuthForPurchase() {
        const user = JSON.parse(localStorage.getItem('anhkhai_user'));
        if (!user) {
            showToast('⚠️ Vui lòng đăng nhập tài khoản để mua hàng!');
            openAuthModal();
            return false;
        }
        return true;
    }

    function updateCartUI() {
        let totalCount = 0;
        let totalPrice = 0;

        cart.forEach(function (item) {
            totalCount += item.quantity;
            totalPrice += item.price * item.quantity;
        });

        if (cartBadgeCount) cartBadgeCount.textContent = totalCount;
        if (cartTotalCount) cartTotalCount.textContent = totalCount;
        if (cartTotalPrice) cartTotalPrice.textContent = formatPrice(totalPrice);

        if (cartDrawerBody) {
            if (cart.length === 0) {
                cartDrawerBody.innerHTML = `
                    <div class="cart-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                        <p>Giỏ hàng của bạn đang trống</p>
                    </div>
                `;
            } else {
                let html = '';
                cart.forEach(function (item, index) {
                    const imgTag = item.img 
                        ? `<img src="${item.img}" alt="${item.name}" class="cart-item__img">`
                        : `<div class="cart-item__img" style="background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:20px;">👕</div>`;

                    html += `
                        <div class="cart-item" data-index="${index}">
                            ${imgTag}
                            <div class="cart-item__info">
                                <h4 class="cart-item__name">${item.name}</h4>
                                <span class="cart-item__price">${formatPrice(item.price)}</span>
                                <div class="cart-item__qty">
                                    <button class="cart-item__qty-btn qty-minus" data-index="${index}">-</button>
                                    <span class="cart-item__qty-num">${item.quantity}</span>
                                    <button class="cart-item__qty-btn qty-plus" data-index="${index}">+</button>
                                </div>
                            </div>
                            <button class="cart-item__remove" data-index="${index}" title="Xóa">&times;</button>
                        </div>
                    `;
                });
                cartDrawerBody.innerHTML = html;
            }
        }
    }

    // Toggle Cart Drawer
    function openCart() {
        if (cartDrawer && cartOverlay) {
            cartDrawer.classList.add('active');
            cartOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeCart() {
        if (cartDrawer && cartOverlay) {
            cartDrawer.classList.remove('active');
            cartOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCart);
    if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    if (cartDrawerBody) {
        cartDrawerBody.addEventListener('click', function (e) {
            const target = e.target;
            const index = parseInt(target.getAttribute('data-index'), 10);

            if (target.classList.contains('qty-plus')) {
                cart[index].quantity += 1;
                saveCart();
            } else if (target.classList.contains('qty-minus')) {
                if (cart[index].quantity > 1) {
                    cart[index].quantity -= 1;
                } else {
                    cart.splice(index, 1);
                }
                saveCart();
            } else if (target.classList.contains('cart-item__remove')) {
                const removedName = cart[index].name;
                cart.splice(index, 1);
                saveCart();
                showToast(`Đã xóa "${removedName}" khỏi giỏ hàng!`);
            }
        });
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', function () {
            if (cart.length === 0) return;
            if (confirm('Bạn có chắc chắn muốn xóa toàn bộ sản phẩm trong giỏ hàng?')) {
                cart = [];
                saveCart();
                showToast('Đã xóa sạch giỏ hàng!');
            }
        });
    }

    // Add to Cart Function
    function addToCart(product, openDrawer = false) {
        if (!checkAuthForPurchase()) return;

        const existingIndex = cart.findIndex(item => item.id === product.id);
        if (existingIndex > -1) {
            cart[existingIndex].quantity += 1;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: parseInt(product.price, 10),
                img: product.img,
                quantity: 1
            });
        }
        saveCart();
        showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);

        if (openDrawer) openCart();
    }

    document.addEventListener('click', function (e) {
        const addBtn = e.target.closest('.add-to-cart-btn');
        const buyBtn = e.target.closest('.buy-now-btn');

        if (addBtn) {
            const product = {
                id: addBtn.getAttribute('data-id'),
                name: addBtn.getAttribute('data-name'),
                price: addBtn.getAttribute('data-price'),
                img: addBtn.getAttribute('data-img')
            };
            addToCart(product, false);
        } else if (buyBtn) {
            if (!checkAuthForPurchase()) return;

            const product = {
                id: buyBtn.getAttribute('data-id'),
                name: buyBtn.getAttribute('data-name'),
                price: buyBtn.getAttribute('data-price'),
                img: buyBtn.getAttribute('data-img')
            };
            addToCart(product, false);
            populateCheckoutForm();
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    function populateCheckoutForm() {
        if (cart.length === 0 || !messageInput) return;

        let summaryText = 'ĐƠN HÀNG CỦA BẠN:\n';
        let total = 0;

        cart.forEach((item, i) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            summaryText += `${i + 1}. ${item.name} - SL: ${item.quantity} x ${formatPrice(item.price)} = ${formatPrice(itemTotal)}\n`;
        });

        summaryText += `\nTỔNG CỘNG: ${formatPrice(total)}`;
        messageInput.value = summaryText;
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function () {
            if (!checkAuthForPurchase()) return;

            if (cart.length === 0) {
                showToast('Giỏ hàng trống! Hãy thêm sản phẩm trước.');
                return;
            }
            populateCheckoutForm();
            closeCart();
            const contactSection = document.getElementById('contact');
            if (contactSection) contactSection.scrollIntoView({ behavior: 'smooth' });
            showToast('Đã chuyển đơn hàng sang form Liên Hệ. Hãy điền thông tin để chốt đơn!');
        });
    }

    updateCartUI();

    // ===== AUTHENTICATION (USER & ADMIN) =====
    function updateAuthHeaderUI() {
        if (!authHeaderWidget) return;
        const user = JSON.parse(localStorage.getItem('anhkhai_user'));

        if (user) {
            const adminBadge = user.role === 'admin' 
                ? `<a href="admin.html" class="btn btn--sm btn--primary" style="margin-right:6px;">Quản trị</a>` 
                : '';
            
            authHeaderWidget.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;">
                    ${adminBadge}
                    <span style="font-size:0.8125rem;font-weight:600;">👋 ${user.username}</span>
                    <button class="btn btn--sm btn--outline" id="userLogoutBtn" style="padding:4px 10px;font-size:0.75rem;">Thoát</button>
                </div>
            `;

            document.getElementById('userLogoutBtn').addEventListener('click', function() {
                localStorage.removeItem('anhkhai_user');
                localStorage.removeItem('anhkhai_token');
                showToast('Đã đăng xuất tài khoản');
                updateAuthHeaderUI();
            });
        } else {
            authHeaderWidget.innerHTML = `<button class="btn btn--outline btn--sm" id="openAuthModalBtn">Đăng nhập / Đăng ký</button>`;
            const newOpenBtn = document.getElementById('openAuthModalBtn');
            if (newOpenBtn) newOpenBtn.addEventListener('click', openAuthModal);
        }
    }

    function openAuthModal() {
        if (authModalOverlay) authModalOverlay.classList.add('active');
    }

    function closeAuthModal() {
        if (authModalOverlay) authModalOverlay.classList.remove('active');
    }

    if (openAuthModalBtn) openAuthModalBtn.addEventListener('click', openAuthModal);
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeAuthModal);
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', function(e) {
            if (e.target === authModalOverlay) closeAuthModal();
        });
    }

    if (tabLoginBtn && tabRegisterBtn) {
        tabLoginBtn.addEventListener('click', function() {
            tabLoginBtn.style.borderBottom = '2px solid var(--primary)';
            tabLoginBtn.style.color = 'var(--text-primary)';
            tabRegisterBtn.style.borderBottom = 'none';
            tabRegisterBtn.style.color = 'var(--text-muted)';
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        });

        tabRegisterBtn.addEventListener('click', function() {
            tabRegisterBtn.style.borderBottom = '2px solid var(--primary)';
            tabRegisterBtn.style.color = 'var(--text-primary)';
            tabLoginBtn.style.borderBottom = 'none';
            tabLoginBtn.style.color = 'var(--text-muted)';
            registerForm.style.display = 'block';
            loginForm.style.display = 'none';
        });
    }

    // Handle Login Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value.trim();

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (res.ok && data.user) {
                    localStorage.setItem('anhkhai_user', JSON.stringify(data.user));
                    localStorage.setItem('anhkhai_token', data.token);
                    showToast(`Xin chào ${data.user.username}! Đăng nhập thành công.`);
                    if (authModalOverlay) authModalOverlay.classList.remove('active');
                    updateAuthHeaderUI();
                    if (data.user.role === 'admin') {
                        setTimeout(() => window.location.href = 'admin.html', 800);
                    }
                    return;
                }
            } catch (err) {
                console.log('Worker API offline, fallback to client auth');
            }

            // Client-side Fallback Auth
            if ((username === 'anhkhaishop' || username === 'admin@anhkhaishop.com') && password === 'admin12345') {
                const user = { id: 1, username: 'anhkhaishop', email: 'admin@anhkhaishop.com', role: 'admin' };
                localStorage.setItem('anhkhai_user', JSON.stringify(user));
                showToast('Đăng nhập thành công với quyền Admin!');
                if (authModalOverlay) authModalOverlay.classList.remove('active');
                updateAuthHeaderUI();
                setTimeout(() => window.location.href = 'admin.html', 800);
            } else {
                let usersDb = JSON.parse(localStorage.getItem('anhkhai_users_db')) || [];
                let match = usersDb.find(u => (u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()) && u.password === password);

                if (match) {
                    const user = { id: match.id, username: match.username, email: match.email, role: 'user' };
                    localStorage.setItem('anhkhai_user', JSON.stringify(user));
                    showToast(`Xin chào ${match.username}! Đăng nhập thành công.`);
                    if (authModalOverlay) authModalOverlay.classList.remove('active');
                    updateAuthHeaderUI();
                } else {
                    if (username.toLowerCase() === 'anhkhaishop' || username.toLowerCase() === 'admin') {
                        showToast('❌ Mật khẩu Admin không đúng!');
                    } else {
                        showToast('❌ Tên đăng nhập hoặc mật khẩu chưa đúng! Vui lòng chọn tab Đăng Ký nếu chưa có tài khoản.');
                    }
                }
            }
        });
    }

    // Handle Register Submit
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value.trim();

            if (username.toLowerCase() === 'anhkhaishop' || username.toLowerCase() === 'admin') {
                showToast('⚠️ Tên tài khoản này được bảo lưu riêng cho Quản trị viên (Admin)!');
                return;
            }

            let usersDb = JSON.parse(localStorage.getItem('anhkhai_users_db')) || [];
            if (usersDb.some(u => u.username.toLowerCase() === username.toLowerCase())) {
                showToast('⚠️ Tên tài khoản này đã được đăng ký trước đó! Vui lòng Đăng Nhập hoặc chọn tên khác.');
                tabLoginBtn.click();
                document.getElementById('loginUsername').value = username;
                return;
            }

            // Save user to local DB
            usersDb.push({ id: Date.now(), username, email, password, role: 'user' });
            localStorage.setItem('anhkhai_users_db', JSON.stringify(usersDb));

            try {
                await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
            } catch(e){}

            showToast('🎉 Đăng ký tài khoản thành công! Nhấn "Đăng Nhập" để vào Cửa Hàng.');
            tabLoginBtn.click();
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginPassword').value = password;
        });
    }

    updateAuthHeaderUI();

    // Render Admin Custom Products if added (with API & LocalStorage sync)
    async function renderCustomProducts() {
        if (!productsGrid) return;
        let customProds = JSON.parse(localStorage.getItem('anhkhai_custom_products')) || [];

        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                const data = await res.json();
                if (data.products && Array.isArray(data.products) && data.products.length > 0) {
                    data.products.forEach(apiProd => {
                        if (!customProds.some(p => String(p.id) === String(apiProd.id))) {
                            customProds.unshift(apiProd);
                        }
                    });
                    localStorage.setItem('anhkhai_custom_products', JSON.stringify(customProds));
                }
            }
        } catch(e){}

        customProds.forEach(prod => {
            if (document.querySelector(`[data-id="${prod.id}"]`)) return;
            const article = document.createElement('article');
            article.className = 'product-card animate-on-scroll visible';
            article.setAttribute('data-category', prod.category || 'nam');
            article.innerHTML = `
                <div class="product-card__image">
                    <img src="${prod.image_url}" alt="${prod.name}" loading="lazy" onerror="this.onerror=null; this.src='assets/images/anhaolv.jpg';">
                    ${prod.badge ? `<span class="product-card__badge product-card__badge--hot">${prod.badge}</span>` : ''}
                </div>
                <div class="product-card__content">
                    <h3 class="product-card__name">${prod.name}</h3>
                    <p class="product-card__desc">${prod.description || 'Sản phẩm mới từ Anh Khải Shop'}</p>
                    <div class="product-card__footer">
                        <div class="product-card__price-row">
                            <span class="product-card__price">${formatPrice(prod.price)}</span>
                        </div>
                        <div class="product-card__actions">
                            <button class="btn btn--sm btn--outline add-to-cart-btn" data-id="${prod.id}" data-name="${prod.name}" data-price="${prod.price}" data-img="${prod.image_url}">
                                + Giỏ hàng
                            </button>
                            <button class="btn btn--sm btn--primary buy-now-btn" data-id="${prod.id}" data-name="${prod.name}" data-price="${prod.price}" data-img="${prod.image_url}">
                                Mua ngay
                            </button>
                        </div>
                    </div>
                </div>
            `;
            productsGrid.prepend(article);
        });
    }

    renderCustomProducts();

    // ===== Mobile Menu =====
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.classList.add('header__overlay');
        overlay.id = 'headerOverlay';
        document.body.appendChild(overlay);
        return overlay;
    }

    const overlay = createOverlay();

    function toggleMenu() {
        if (hamburger && navbar) {
            hamburger.classList.toggle('active');
            navbar.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = navbar.classList.contains('active') ? 'hidden' : '';
        }
    }

    function closeMenu() {
        if (hamburger && navbar) {
            hamburger.classList.remove('active');
            navbar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    if (hamburger) hamburger.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);

    headerLinks.forEach(function (link) {
        link.addEventListener('click', closeMenu);
    });

    // ===== Header Scroll Effect =====
    function handleScroll() {
        var scrollY = window.scrollY;
        if (header) {
            if (scrollY > 50) {
                header.classList.add('header--scrolled');
            } else {
                header.classList.remove('header--scrolled');
            }
        }

        if (backToTop) {
            if (scrollY > 500) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    if (backToTop) {
        backToTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ===== Scroll Animations =====
    function initScrollAnimations() {
        var animatedElements = document.querySelectorAll('.animate-on-scroll');
        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            animatedElements.forEach(function (el) { observer.observe(el); });
        } else {
            animatedElements.forEach(function (el) { el.classList.add('visible'); });
        }
    }

    initScrollAnimations();

    // ===== Product Filter =====
    filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            filterBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');

            var filter = btn.getAttribute('data-filter');
            var cards = productsGrid.querySelectorAll('.product-card');

            cards.forEach(function (card) {
                var category = card.getAttribute('data-category');
                if (filter === 'all' || category === filter) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });

    // ===== Product Search =====
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            var query = searchInput.value.toLowerCase().trim();
            var cards = productsGrid.querySelectorAll('.product-card');

            filterBtns.forEach(function (b) { b.classList.remove('active'); });
            var allBtn = document.querySelector('[data-filter="all"]');
            if (allBtn) allBtn.classList.add('active');

            cards.forEach(function (card) {
                var nameEl = card.querySelector('.product-card__name');
                var descEl = card.querySelector('.product-card__desc');
                var name = nameEl ? nameEl.textContent.toLowerCase() : '';
                var desc = descEl ? descEl.textContent.toLowerCase() : '';

                if (name.includes(query) || desc.includes(query)) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    }

    // ===== Form Submission / Order Submission =====
    if (contactForm) {
        contactForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (!checkAuthForPurchase()) return;

            const fullName = document.getElementById('fullName').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const addressEl = document.getElementById('address');
            const address = addressEl ? addressEl.value.trim() : '';
            const email = document.getElementById('email').value.trim();
            const notes = document.getElementById('message').value.trim();

            if (!fullName || !phone || !address) {
                showToast('Vui lòng điền đầy đủ Họ và tên, Số điện thoại và Địa chỉ giao hàng!');
                return;
            }

            const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
            const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

            const orderData = {
                id: orderId,
                customer_name: fullName,
                customer_email: email,
                customer_phone: phone,
                phone: phone,
                email: email,
                address: address,
                shipping_address: address,
                notes: notes,
                items: cart,
                total: totalAmount,
                total_amount: totalAmount,
                status: 'Chờ duyệt',
                date: new Date().toISOString().split('T')[0]
            };

            // Save to local orders list for Admin to approve
            let orders = JSON.parse(localStorage.getItem('anhkhai_orders')) || [];
            orders.unshift(orderData);
            localStorage.setItem('anhkhai_orders', JSON.stringify(orders));

            // Send to Worker API if available
            try {
                await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                });
            } catch(e){}

            showToast(`🎉 Đặt hàng thành công (Mã đơn #${orderId})! Đơn hàng đang chờ Admin duyệt.`);
            contactForm.reset();
            cart = [];
            saveCart();
        });
    }

    // ===== Toast Notification =====
    var toastTimeout;

    function showToast(message) {
        if (!toast || !toastMessage) return;
        toastMessage.textContent = message;
        toast.classList.add('visible');

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(function () {
            toast.classList.remove('visible');
        }, 4000);
    }

    if (toastClose) {
        toastClose.addEventListener('click', function () {
            toast.classList.remove('visible');
            if (toastTimeout) clearTimeout(toastTimeout);
        });
    }

    // ===== Product Chat =====
    const chatPanel = document.getElementById('chatPanel');
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    function toggleChat(isOpen) {
        if (!chatPanel || !chatToggleBtn) return;
        chatPanel.hidden = !isOpen;
        chatToggleBtn.setAttribute('aria-expanded', String(isOpen));
        if (isOpen && chatInput) chatInput.focus();
    }

    function appendChatMessage(text, role, extraClass) {
        const message = document.createElement('div');
        message.className = `chat-message chat-message--${role}${extraClass ? ` ${extraClass}` : ''}`;
        message.textContent = text;
        chatMessages.appendChild(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return message;
    }

    function appendChatSources(message, sources) {
        if (!Array.isArray(sources) || !sources.length) return;
        const sourceList = document.createElement('div');
        sourceList.className = 'chat-sources';
        sources.forEach(function (source) {
            const link = document.createElement('a');
            link.href = '#products';
            link.className = 'chat-source';
            link.dataset.productName = source.name;
            const name = document.createElement('strong');
            name.textContent = source.name;
            const details = document.createElement('span');
            details.textContent = `${formatPrice(source.price)}${Number.isFinite(Number(source.stock)) ? ` · Còn ${source.stock}` : ''} · Xem sản phẩm`;
            link.append(name, details);
            sourceList.appendChild(link);
        });
        message.appendChild(sourceList);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if (chatToggleBtn) chatToggleBtn.addEventListener('click', function () {
        toggleChat(chatPanel.hidden);
    });
    if (chatCloseBtn) chatCloseBtn.addEventListener('click', function () { toggleChat(false); });

    if (chatForm) {
        chatForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            const question = chatInput.value.trim();
            if (!question) return;

            appendChatMessage(question, 'user');
            chatInput.value = '';
            chatInput.disabled = true;
            chatForm.querySelector('button').disabled = true;
            const loadingMessage = appendChatMessage('Shop đang xem thông tin sản phẩm...', 'assistant', 'chat-message--loading');

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: question })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Hiện chưa thể kết nối tư vấn. Vui lòng thử lại sau.');
                loadingMessage.remove();
                const answer = appendChatMessage(data.answer, 'assistant');
                appendChatSources(answer, data.sources);
            } catch (error) {
                loadingMessage.remove();
                appendChatMessage(error.message || 'Hiện chưa thể kết nối tư vấn. Vui lòng thử lại sau.', 'assistant');
            } finally {
                chatInput.disabled = false;
                chatForm.querySelector('button').disabled = false;
                chatInput.focus();
            }
        });
    }

    if (chatMessages) {
        chatMessages.addEventListener('click', function (event) {
            const sourceLink = event.target.closest('.chat-source');
            if (!sourceLink || !searchInput) return;
            searchInput.value = sourceLink.dataset.productName;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            toggleChat(false);
            const productCard = Array.from(document.querySelectorAll('#productsGrid .product-card')).find(function (card) {
                const name = card.querySelector('.product-card__name');
                return name && name.textContent.trim() === sourceLink.dataset.productName;
            });
            if (productCard) productCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    // ===== Keyboard Accessibility =====
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeMenu();
            closeCart();
            closeAuthModal();
            toggleChat(false);
        }
    });

    handleScroll();

})();
