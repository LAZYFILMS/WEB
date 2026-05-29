// Shared cart for LAZY FILM STORE — persists across all pages via localStorage
(function () {
    const STORE = 'https://store.lazyfilms.in';
    const KEY = 'lf_cart';

    // Shopify domain used when a cart contains at least one DEV+SCAN bundle
    // line, or when a mixed cart needs to be routed entirely through Shopify.
    // The storefront is locked down via theme.liquid redirects so the
    // discounted bundle-priced variants can only be reached this way.
    const SHOPIFY_DOMAIN = 'rphzqx-d5.myshopify.com';

    // ProductId used for the auto-added Return Negative shipping line.
    // Defined in store/index.html (SHOPIFY_RETURN_NEGATIVE) but shared here
    // so the cart UI can detect the line and render the helper hint.
    const RETURN_NEGATIVE_PRODUCT_ID = 'shopify_return_negative';

    // Monotonically-increasing cart item id. Date.now() alone collides when
    // multiple items are added in the same millisecond (e.g. a bundle line
    // and the auto-added Return Negative), causing Remove to nuke both.
    var __idCounter = 0;
    function nextCartItemId() {
        __idCounter += 1;
        return Date.now() * 1000 + __idCounter;
    }

    // --- State helpers ---
    function getCart() {
        try { return JSON.parse(localStorage.getItem(KEY)) || { items: [] }; }
        catch (e) { return { items: [] }; }
    }
    function saveCart(c) { localStorage.setItem(KEY, JSON.stringify(c)); }
    function getCount() { return getCart().items.reduce(function (s, i) { return s + i.quantity; }, 0); }
    function getTotal() { return getCart().items.reduce(function (s, i) { return s + i.price * i.quantity; }, 0); }

    // --- Public API ---
    window.addToCart = function (item) {
        // item: { name, price, quantity, productId,
        //         platform?, productKey?, bundleVariantIds? }
        var cart = getCart();
        var existing = cart.items.find(function (i) { return i.productId === item.productId; });
        if (existing) {
            existing.quantity += item.quantity;
            // Refresh routing metadata in case it was missing on an older
            // cart item (e.g. saved before the bundle schema existed).
            if (item.platform)         existing.platform         = item.platform;
            if (item.productKey)       existing.productKey       = item.productKey;
            if (item.bundleVariantIds) existing.bundleVariantIds = item.bundleVariantIds;
        } else {
            cart.items.push({
                id:               nextCartItemId(),
                name:             item.name,
                price:            item.price,
                quantity:         item.quantity,
                productId:        item.productId,
                platform:         item.platform || 'woocommerce',
                productKey:       item.productKey || null,
                bundleVariantIds: item.bundleVariantIds || null
            });
        }
        saveCart(cart);
        renderCart();
        if (typeof window.onCartUpdate === 'function') window.onCartUpdate();
    };

    // Add an item only if the same productId isn't already in the cart.
    // Used by the bundle flow to auto-add the Return Negative shipping line
    // exactly once (without bumping its quantity if multiple bundles are
    // added). The user can still remove it manually.
    window.ensureInCart = function (item) {
        var cart = getCart();
        var existing = cart.items.find(function (i) { return i.productId === item.productId; });
        if (existing) return false;
        cart.items.push({
            id:               nextCartItemId(),
            name:             item.name,
            price:            item.price,
            quantity:         item.quantity || 1,
            productId:        item.productId,
            platform:         item.platform || 'woocommerce',
            productKey:       item.productKey || null,
            bundleVariantIds: item.bundleVariantIds || null
        });
        saveCart(cart);
        renderCart();
        if (typeof window.onCartUpdate === 'function') window.onCartUpdate();
        return true;
    };

    window.removeFromCart = function (id) {
        var cart = getCart();
        cart.items = cart.items.filter(function (i) { return i.id !== id; });
        saveCart(cart);
        renderCart();
        if (typeof window.onCartUpdate === 'function') window.onCartUpdate();
    };

    function isBundleItem(i) {
        // Defensive: any of these mark a Shopify-routed bundle line.
        return (
            i.platform === 'shopify' ||
            (Array.isArray(i.bundleVariantIds) && i.bundleVariantIds.length > 0) ||
            (typeof i.productId === 'string' && i.productId.indexOf('bundle_') === 0)
        );
    }

    window.checkoutCart = function () {
        var cart = getCart();
        if (!cart.items.length) { alert('Your cart is empty.'); return; }

        var hasBundle = cart.items.some(isBundleItem);

        // All-WooCommerce cart → original woocommerce flow.
        if (!hasBundle) {
            var wooItems = cart.items
                .map(function (i) { return i.productId + ':' + i.quantity; })
                .join(',');
            window.location.href = STORE + '/?lf_cart=' + wooItems;
            return;
        }

        // At least one DEV+SCAN bundle → route the entire cart to Shopify.
        // Each bundle line expands into 3 Shopify cart lines (roll + process +
        // scan) at the same quantity. WooCommerce-tagged items get swapped to
        // their corresponding Shopify roll variant via the global map exposed
        // by the store page.
        var shopifyNormalMap = window.LF_SHOPIFY_NORMAL_BY_PRODUCT_KEY || {};
        var missing = [];
        var parts = [];

        cart.items.forEach(function (item) {
            var qty = item.quantity;

            if (isBundleItem(item) && item.bundleVariantIds && item.bundleVariantIds.length) {
                // Bundle: emit one line per component variant at the same qty.
                item.bundleVariantIds.forEach(function (vid) {
                    if (!vid || String(vid).indexOf('TODO') === 0) {
                        missing.push(item.name);
                    } else {
                        parts.push(vid + ':' + qty);
                    }
                });
                return;
            }

            // WooCommerce-tagged plain roll → substitute Shopify roll variant.
            var rollId = shopifyNormalMap[item.productKey];
            if (!rollId || String(rollId).indexOf('TODO') === 0) {
                missing.push(item.name);
                return;
            }
            parts.push(rollId + ':' + qty);
        });

        if (missing.length) {
            alert('Cannot check out — Shopify variant missing for: ' +
                missing.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '));
            return;
        }

        // (Return Negative is no longer auto-appended at checkout — it's
        // added to the cart as a removable line item when a bundle is added.)

        // Shopify cart permalink: /cart/<variantId>:<qty>,<variantId>:<qty>...
        window.location.href = 'https://' + SHOPIFY_DOMAIN + '/cart/' + parts.join(',');
    };

    // --- Drawer helpers ---
    var drawerOpenAllowed = false;
    function openDrawer() {
        if (!drawerOpenAllowed) return;
        var d = document.getElementById('lf-cart-drawer');
        var o = document.getElementById('lf-cart-overlay');
        if (d) d.classList.add('open');
        if (o) o.classList.add('open');
    }
    function closeDrawer() {
        var d = document.getElementById('lf-cart-drawer');
        var o = document.getElementById('lf-cart-overlay');
        if (d) d.classList.remove('open');
        if (o) o.classList.remove('open');
    }

    // --- Render ---
    function renderCart() {
        var count = getCount();
        var badge = document.getElementById('lf-cart-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }

        var container = document.getElementById('lf-cart-items');
        var totalEl = document.getElementById('lf-cart-total');
        if (!container) return;

        var cart = getCart();
        if (!cart.items.length) {
            container.innerHTML = '<p class="lf-empty">Your cart is empty.</p>';
            if (totalEl) totalEl.textContent = '₹0';
            return;
        }

        var hasReturnNegative = cart.items.some(function (i) {
            return i.productId === RETURN_NEGATIVE_PRODUCT_ID;
        });
        var hint = hasReturnNegative
            ? '<p class="lf-return-hint">Remove "Return Negative" from the cart if you don\'t want negatives shipped back.</p>'
            : '';

        container.innerHTML = hint + cart.items.map(function (item) {
            return '<div class="lf-cart-item">' +
                '<div class="lf-item-info">' +
                    '<div class="lf-item-name">' + item.name + '</div>' +
                    '<div class="lf-item-meta">Qty: ' + item.quantity + ' &times; &#8377;' + item.price + '</div>' +
                '</div>' +
                '<div class="lf-item-right">' +
                    '<span class="lf-item-total">&#8377;' + (item.price * item.quantity) + '</span>' +
                    '<button class="lf-remove" onclick="removeFromCart(' + item.id + ')" title="Remove">&times;</button>' +
                '</div>' +
            '</div>';
        }).join('');

        if (totalEl) totalEl.textContent = '₹' + getTotal();
    }

    // --- Inject CSS + HTML on DOM ready ---
    function init() {
        var style = document.createElement('style');
        style.textContent = [
            '#lf-cart-btn{position:fixed;bottom:24px;right:24px;width:52px;height:52px;background:#000;color:#fff;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:9998;box-shadow:0 2px 12px rgba(0,0,0,.28);transition:background .15s;}',
            '#lf-cart-btn:hover{background:#333;}',
            '#lf-cart-badge{position:absolute;top:-5px;right:-5px;background:#e00;color:#fff;font-size:11px;font-weight:700;width:18px;height:18px;border-radius:50%;display:none;align-items:center;justify-content:center;font-family:sans-serif;line-height:1;}',
            '#lf-cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;opacity:0;pointer-events:none;transition:opacity .25s;}',
            '#lf-cart-overlay.open{opacity:1;pointer-events:all;}',
            '#lf-cart-drawer{position:fixed;top:0;right:0;width:370px;max-width:100vw;height:100%;background:#fff;z-index:10000;display:flex;flex-direction:column;transform:translateX(100%);box-shadow:-4px 0 24px rgba(0,0,0,.15);}',
            '#lf-cart-drawer.open{transform:translateX(0);}',
            '#lf-cart-drawer.lf-ready{transition:transform .3s ease;}',
            '.lf-drawer-header{display:flex;justify-content:space-between;align-items:center;padding:20px 20px 16px;border-bottom:2px solid #000;}',
            '.lf-drawer-title{font-family:"stratos-black","stratos",sans-serif;font-size:18px;font-weight:700;text-transform:uppercase;margin:0;letter-spacing:.5px;}',
            '.lf-close-btn{background:none;border:none;font-size:26px;line-height:1;cursor:pointer;padding:0;color:#000;}',
            '.lf-close-btn:hover{color:#555;}',
            '#lf-cart-items{flex:1;overflow-y:auto;padding:8px 20px;}',
            '.lf-empty{color:#aaa;font-size:14px;text-align:center;padding:40px 0;font-family:"stratos",monospace;}',
            '.lf-return-hint{font-size:11.5px;font-style:italic;color:#666;font-family:"stratos",monospace;margin:8px 0 4px;line-height:1.4;}',
            '.lf-cart-item{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid #eee;}',
            '.lf-item-info{flex:1;min-width:0;}',
            '.lf-item-name{font-size:14px;font-weight:600;font-family:"stratos",monospace;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '.lf-item-meta{font-size:12px;color:#888;font-family:"stratos",monospace;}',
            '.lf-item-right{display:flex;align-items:center;gap:12px;margin-left:12px;}',
            '.lf-item-total{font-size:14px;font-weight:700;font-family:"stratos",monospace;white-space:nowrap;}',
            '.lf-remove{background:none;border:none;color:#ccc;cursor:pointer;font-size:22px;line-height:1;padding:0;transition:color .15s;}',
            '.lf-remove:hover{color:#e00;}',
            '.lf-drawer-footer{padding:16px 20px 20px;border-top:2px solid #000;}',
            '.lf-total-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}',
            '.lf-total-label{font-family:"stratos-black","stratos",sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;}',
            '#lf-cart-total{font-family:"stratos-black","stratos",sans-serif;font-size:15px;font-weight:700;}',
            '.lf-checkout-btn{width:100%;background:#000;color:#fff;border:none;padding:14px;font-size:13px;font-family:"stratos-black","stratos",sans-serif;text-transform:uppercase;cursor:pointer;letter-spacing:1px;transition:background .15s;}',
            '.lf-checkout-btn:hover{background:#333;}',
            '@media(max-width:420px){#lf-cart-drawer{width:100%;}}'
        ].join('');
        document.head.appendChild(style);

        var wrap = document.createElement('div');
        wrap.innerHTML =
            '<div id="lf-cart-overlay"></div>' +
            '<div id="lf-cart-drawer">' +
                '<div class="lf-drawer-header">' +
                    '<h2 class="lf-drawer-title">Cart</h2>' +
                    '<button class="lf-close-btn" id="lf-close-btn">&times;</button>' +
                '</div>' +
                '<div id="lf-cart-items"></div>' +
                '<div class="lf-drawer-footer">' +
                    '<div class="lf-total-row">' +
                        '<span class="lf-total-label">Total</span>' +
                        '<span id="lf-cart-total">&#8377;0</span>' +
                    '</div>' +
                    '<button class="lf-checkout-btn" id="lf-checkout-btn">Checkout &rarr;</button>' +
                '</div>' +
            '</div>' +
            '<button id="lf-cart-btn">' +
                '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
                '<span id="lf-cart-badge">0</span>' +
            '</button>';

        document.body.appendChild(wrap);

        // Enable transition only after first paint so the drawer doesn't animate on page load
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                var drawer = document.getElementById('lf-cart-drawer');
                if (drawer) drawer.classList.add('lf-ready');
            });
        });

        // Wire up events using IDs (safe after insertion)
        document.getElementById('lf-cart-overlay').addEventListener('click', closeDrawer);
        document.getElementById('lf-close-btn').addEventListener('click', closeDrawer);
        document.getElementById('lf-checkout-btn').addEventListener('click', window.checkoutCart);
        document.getElementById('lf-cart-btn').addEventListener('click', function () {
            drawerOpenAllowed = true;
            openDrawer();
            drawerOpenAllowed = false;
        });

        renderCart();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
