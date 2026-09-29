// Cloudflare Pages Functions / Workers Backend API Router
// Handles Auth (Login/Register), Products (CRUD), Orders, and R2 Image Uploads
import { buildSystemPrompt, deleteProductIndex, getMinimumMatchScore, getProductCatalog, indexProducts, searchProducts } from './rag.js';

let globalCustomProducts = [
    { id: 'def_101', name: 'áo hoàng gia', category: 'nam', price: 120000, description: 'Phong cách hoàng gia sang trọng, chất liệu vải mềm mại thoáng mát.', image_url: 'assets/images/aohoanggia.jpg', badge: 'Hot' },
    { id: 'def_102', name: 'áo chó', category: 'nu', price: 199999, description: 'Thời trang nữ chất liệu cao cấp, kiểu dáng thời thượng cá tính.', image_url: 'assets/images/aochonu.jpg', badge: 'Mới' },
    { id: 'def_103', name: 'Váy new', category: 'nu', price: 499999, description: 'Váy nữ thiết kế ren lộng lẫy quyến rũ, kiểu dáng tôn dáng quyến rũ.', image_url: 'assets/images/vay.jpg', badge: 'Hot' },
    { id: 'def_104', name: 'phông micky', category: 'nu', price: 199999, description: 'Áo phông micky nữ dễ thương, vải cotton mềm mịn thoáng mát.', image_url: 'assets/images/aogaunu.jpg', badge: 'Hot' }
];
let globalOrders = [];

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method;

    // CORS Headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json; charset=utf-8'
    };

    if (method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // ===== AUTHENTICATION ENDPOINTS =====

        // POST /api/auth/register
        if (path === '/auth/register' && method === 'POST') {
            const body = await request.json();
            const { username, email, password } = body;

            if (!username || !email || !password) {
                return new Response(JSON.stringify({ error: 'Vui lòng điền đầy đủ thông tin' }), { status: 400, headers: corsHeaders });
            }

            if (username.toLowerCase() === 'anhkhaishop' || username.toLowerCase() === 'admin') {
                return new Response(JSON.stringify({ error: 'Tên tài khoản này được bảo lưu riêng cho Quản trị viên (Admin)' }), { status: 400, headers: corsHeaders });
            }

            const passHash = await hashPassword(password);
            
            if (env.DB) {
                try {
                    await env.DB.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)')
                        .bind(username, email, passHash, 'user')
                        .run();
                } catch (e) {
                    return new Response(JSON.stringify({ error: 'Tài khoản hoặc email đã tồn tại' }), { status: 400, headers: corsHeaders });
                }
            }

            return new Response(JSON.stringify({ message: 'Đăng ký tài khoản thành công!' }), { status: 200, headers: corsHeaders });
        }

        // POST /api/auth/login
        if (path === '/auth/login' && method === 'POST') {
            const body = await request.json();
            const { username, password } = body;

            if (!username || !password) {
                return new Response(JSON.stringify({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' }), { status: 400, headers: corsHeaders });
            }

            const passHash = await hashPassword(password);

            let user = null;
            if (env.DB) {
                user = await env.DB.prepare('SELECT id, username, email, role FROM users WHERE (username = ? OR email = ?) AND password_hash = ?')
                    .bind(username, username, passHash)
                    .first();
            } else {
                // Hardcoded fallback for demo/testing without D1 bound
                if ((username === 'anhkhaishop' || username === 'admin@anhkhaishop.com') && password === 'admin12345') {
                    user = { id: 1, username: 'anhkhaishop', email: 'admin@anhkhaishop.com', role: 'admin' };
                } else if (username && password) {
                    user = { id: 2, username: username, email: `${username}@gmail.com`, role: 'user' };
                }
            }

            if (!user) {
                return new Response(JSON.stringify({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }), { status: 401, headers: corsHeaders });
            }

            const token = btoa(JSON.stringify({ id: user.id, username: user.username, role: user.role, exp: Date.now() + 86400000 }));

            return new Response(JSON.stringify({
                message: 'Đăng nhập thành công!',
                token,
                user: { id: user.id, username: user.username, email: user.email, role: user.role }
            }), { status: 200, headers: corsHeaders });
        }

        // ===== PRODUCTS ENDPOINTS =====

        // GET /api/products
        if ((path === '/products' || path === '') && method === 'GET') {
            let products = [];
            if (env.DB) {
                try {
                    const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY id DESC').all();
                    products = url.searchParams.get('includeInactive') === 'true'
                        ? results
                        : results.filter(product => product.is_active !== 0);
                } catch(e) {
                    products = globalCustomProducts;
                }
            } else {
                products = globalCustomProducts;
            }
            return new Response(JSON.stringify({ products }), { status: 200, headers: corsHeaders });
        }

        // POST /api/chat/reindex (Bootstrap or repair the product vector index)
        if (path === '/chat/reindex' && method === 'POST') {
            const expectedSecret = env.CHAT_REINDEX_SECRET;
            const suppliedSecret = request.headers.get('Authorization') || '';
            if (!expectedSecret || suppliedSecret !== `Bearer ${expectedSecret}`) {
                return new Response(JSON.stringify({ error: 'Không có quyền thực hiện re-index.' }), { status: 401, headers: corsHeaders });
            }

            const products = await getProductCatalog(env, globalCustomProducts);
            const indexed = await indexProducts(env, products);
            return new Response(JSON.stringify({ message: 'Đã đồng bộ vector sản phẩm.', indexed }), { status: 200, headers: corsHeaders });
        }

        // POST /api/chat (Product consultation using retrieval-augmented generation)
        if (path === '/chat' && method === 'POST') {
            if (!env.AI || !env.VECTORIZE) {
                return new Response(JSON.stringify({ error: 'Tính năng tư vấn chưa được cấu hình Workers AI và Vectorize.' }), { status: 503, headers: corsHeaders });
            }

            const body = await request.json();
            const message = typeof body.message === 'string' ? body.message.trim() : '';
            if (!message || message.length > 500) {
                return new Response(JSON.stringify({ error: 'Câu hỏi phải có nội dung và không vượt quá 500 ký tự.' }), { status: 400, headers: corsHeaders });
            }

            const matches = await searchProducts(env, message, 5);
            const minimumScore = getMinimumMatchScore(env);
            const products = matches.filter(product => product.score >= minimumScore);
            const refusal = 'Xin lỗi, tôi không tìm thấy sản phẩm nào phù hợp trong cửa hàng. Bạn có thể hỏi theo cách khác không?';
            if (!products.length) {
                return new Response(JSON.stringify({ answer: refusal, sources: [] }), { status: 200, headers: corsHeaders });
            }

            const result = await env.AI.run(env.CHAT_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
                messages: [
                    { role: 'system', content: buildSystemPrompt(products) },
                    { role: 'user', content: message }
                ],
                max_tokens: 400,
                temperature: 0.2
            });
            const answer = typeof result.response === 'string' ? result.response.trim() : '';
            if (!answer) {
                return new Response(JSON.stringify({ error: 'Shop chưa tạo được câu trả lời. Vui lòng thử lại.' }), { status: 502, headers: corsHeaders });
            }
            return new Response(JSON.stringify({
                answer,
                sources: products.map(product => ({
                    product_id: product.product_id,
                    name: product.name,
                    price: product.price,
                    stock: product.stock,
                    image_url: product.image_url
                }))
            }), { status: 200, headers: corsHeaders });
        }

        // POST /api/products (Add product - Admin)
        if ((path === '/products' || path === '') && method === 'POST') {
            const body = await request.json();
            const { name, category, price, description, image_url, badge, stock } = body;

            if (!name || !price) {
                return new Response(JSON.stringify({ error: 'Tên và giá sản phẩm là bắt buộc' }), { status: 400, headers: corsHeaders });
            }

            const newProd = {
                id: body.id || ('prod_' + Date.now()),
                name,
                category: category || 'nam',
                price: parseInt(price, 10),
                description: description || '',
                image_url: image_url || '',
                badge: badge || '',
                stock: Number.isFinite(Number(stock)) ? Number(stock) : 100,
                is_active: 1
            };

            if (env.DB) {
                try {
                    const inserted = await env.DB.prepare('INSERT INTO products (name, category, price, description, image_url, badge, stock, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                        .bind(newProd.name, newProd.category, newProd.price, newProd.description, newProd.image_url, newProd.badge, newProd.stock, newProd.is_active)
                        .run();
                    newProd.id = inserted.meta.last_row_id;
                } catch(e){}
            }

            // Unshift into global Worker memory if not present
            if (!globalCustomProducts.some(p => String(p.id) === String(newProd.id))) {
                globalCustomProducts.unshift(newProd);
            }

            try {
                await indexProducts(env, [newProd]);
            } catch (error) {
                console.error('Product created but could not be indexed for chat', error);
            }

            return new Response(JSON.stringify({ message: 'Thêm sản phẩm thành công!', product: newProd }), { status: 200, headers: corsHeaders });
        }

        // PUT /api/products/:id (Update product or change its visibility)
        if (path.startsWith('/products/') && method === 'PUT') {
            const id = path.split('/')[2];
            const body = await request.json();
            let currentProduct = null;

            if (env.DB && id) {
                currentProduct = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
            } else {
                currentProduct = globalCustomProducts.find(product => String(product.id) === String(id));
            }
            if (!currentProduct) {
                return new Response(JSON.stringify({ error: 'Không tìm thấy sản phẩm' }), { status: 404, headers: corsHeaders });
            }

            const updatedProduct = {
                ...currentProduct,
                name: body.name === undefined ? currentProduct.name : String(body.name).trim(),
                category: body.category === undefined ? currentProduct.category : String(body.category),
                price: body.price === undefined ? Number(currentProduct.price) : Number(body.price),
                description: body.description === undefined ? currentProduct.description : String(body.description),
                image_url: body.image_url === undefined ? currentProduct.image_url : String(body.image_url),
                badge: body.badge === undefined ? currentProduct.badge : String(body.badge),
                stock: body.stock === undefined ? Number(currentProduct.stock ?? 0) : Number(body.stock),
                is_active: body.is_active === undefined ? Number(currentProduct.is_active ?? 1) : (body.is_active ? 1 : 0)
            };
            if (!updatedProduct.name || !Number.isFinite(updatedProduct.price) || updatedProduct.price < 0 || !Number.isFinite(updatedProduct.stock) || updatedProduct.stock < 0) {
                return new Response(JSON.stringify({ error: 'Tên, giá hoặc tồn kho không hợp lệ' }), { status: 400, headers: corsHeaders });
            }

            if (env.DB) {
                await env.DB.prepare('UPDATE products SET name = ?, category = ?, price = ?, description = ?, image_url = ?, badge = ?, stock = ?, is_active = ? WHERE id = ?')
                    .bind(updatedProduct.name, updatedProduct.category, updatedProduct.price, updatedProduct.description || '', updatedProduct.image_url || '', updatedProduct.badge || '', updatedProduct.stock, updatedProduct.is_active, id)
                    .run();
            } else {
                globalCustomProducts = globalCustomProducts.map(product => String(product.id) === String(id) ? updatedProduct : product);
            }

            if (updatedProduct.is_active) {
                try {
                    await indexProducts(env, [updatedProduct]);
                } catch (error) {
                    console.error('Product updated but could not be indexed for chat', error);
                }
            } else if (env.VECTORIZE) {
                try {
                    await deleteProductIndex(env, id);
                } catch (error) {
                    console.error('Product hidden but could not be removed from chat index', error);
                }
            }

            return new Response(JSON.stringify({ message: 'Cập nhật sản phẩm thành công!', product: updatedProduct }), { status: 200, headers: corsHeaders });
        }

        // DELETE /api/products/:id
        if (path.startsWith('/products/') && method === 'DELETE') {
            const id = path.split('/')[2];
            if (env.DB && id) {
                try {
                    await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
                } catch(e){}
            }
            globalCustomProducts = globalCustomProducts.filter(p => String(p.id) !== String(id));
            if (env.VECTORIZE && id) {
                try {
                    await deleteProductIndex(env, id);
                } catch (error) {
                    console.error('Product deleted but could not be removed from chat index', error);
                }
            }
            return new Response(JSON.stringify({ message: 'Xóa sản phẩm thành công!' }), { status: 200, headers: corsHeaders });
        }

        // ===== ORDERS ENDPOINTS =====

        // POST /api/orders (Create order)
        if (path === '/orders' && method === 'POST') {
            const body = await request.json();
            const { customer_name, customer_email, customer_phone, shipping_address, address, items, total_amount, notes } = body;
            const finalAddress = shipping_address || address || '';

            if (!customer_name || !customer_phone || !items) {
                return new Response(JSON.stringify({ error: 'Vui lòng cung cấp đầy đủ thông tin' }), { status: 400, headers: corsHeaders });
            }

            let orderId = body.id || ('ORD-' + Math.floor(1000 + Math.random() * 9000));
            const newOrder = {
                id: orderId,
                customer_name,
                customer_email: customer_email || '',
                customer_phone,
                phone: customer_phone,
                address: finalAddress,
                shipping_address: finalAddress,
                total_amount: total_amount || 0,
                total: total_amount || 0,
                notes: notes || '',
                status: 'Chờ duyệt',
                date: new Date().toISOString().split('T')[0],
                items: items || []
            };

            if (env.DB) {
                try {
                    const orderResult = await env.DB.prepare('INSERT INTO orders (customer_name, customer_email, customer_phone, shipping_address, total_amount, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
                        .bind(customer_name, customer_email || '', customer_phone, finalAddress, total_amount, notes || '', 'Chờ duyệt')
                        .run();
                    orderId = orderResult.meta.last_row_id;
                } catch(e){}
            }

            if (!globalOrders.some(o => String(o.id) === String(newOrder.id))) {
                globalOrders.unshift(newOrder);
            }

            return new Response(JSON.stringify({ message: 'Đặt hàng thành công!', order_id: orderId }), { status: 200, headers: corsHeaders });
        }

        // GET /api/orders (Admin)
        if (path === '/orders' && method === 'GET') {
            let orders = [];
            if (env.DB) {
                try {
                    const { results } = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
                    orders = results;
                } catch(e){
                    orders = globalOrders;
                }
            } else {
                orders = globalOrders;
            }
            return new Response(JSON.stringify({ orders }), { status: 200, headers: corsHeaders });
        }

        // PUT /api/orders (Update Order Status - Admin)
        if (path === '/orders' && method === 'PUT') {
            const body = await request.json();
            const { order_id, status } = body;

            if (env.DB && order_id && status) {
                try {
                    await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?')
                        .bind(status, order_id)
                        .run();
                } catch(e){}
            }

            globalOrders = globalOrders.map(o => String(o.id) === String(order_id) ? { ...o, status } : o);

            return new Response(JSON.stringify({ message: 'Cập nhật trạng thái đơn hàng thành công!' }), { status: 200, headers: corsHeaders });
        }

        // ===== CLOUDFLARE R2 IMAGE UPLOAD =====

        // POST /api/upload (Upload image to Cloudflare R2 Bucket or fallback to Base64)
        if (path === '/upload' && method === 'POST') {
            const formData = await request.formData();
            const file = formData.get('file');

            if (!file) {
                return new Response(JSON.stringify({ error: 'Không tìm thấy file ảnh' }), { status: 400, headers: corsHeaders });
            }

            const fileName = `products/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

            if (env.MY_R2_BUCKET) {
                await env.MY_R2_BUCKET.put(fileName, file.stream(), {
                    httpMetadata: { contentType: file.type }
                });
                const imageUrl = `/api/images/${fileName}`;
                return new Response(JSON.stringify({ message: 'Tải ảnh lên R2 thành công!', url: imageUrl }), { status: 200, headers: corsHeaders });
            } else {
                // R2 unbound: Convert uploaded image file buffer to Base64 Data URL for universal display
                const arrayBuffer = await file.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binary);
                const dataUrl = `data:${file.type || 'image/jpeg'};base64,${base64}`;

                return new Response(JSON.stringify({
                    message: 'Tải ảnh lên dạng Data URL thành công!',
                    url: dataUrl
                }), { status: 200, headers: corsHeaders });
            }
        }

        // GET /api/images/* (Serve images stored in R2)
        if (path.startsWith('/images/') && method === 'GET') {
            const key = path.replace(/^\/images\//, '');
            if (env.MY_R2_BUCKET) {
                const object = await env.MY_R2_BUCKET.get(key);
                if (!object) {
                    return new Response('File not found', { status: 404 });
                }
                const headers = new Headers();
                object.writeHttpMetadata(headers);
                headers.set('etag', object.httpEtag);
                headers.set('Cache-Control', 'public, max-age=31536000');
                return new Response(object.body, { headers });
            }
            return new Response('R2 Bucket not configured', { status: 404 });
        }

        return new Response(JSON.stringify({ message: 'Anh Khải Shop Worker API Running', path }), { status: 200, headers: corsHeaders });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
}

// SHA-256 Password Hashing Helper
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
