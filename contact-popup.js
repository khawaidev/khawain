/* ============================================================
   Khawain — Contact Popup (replaces the standalone contact page)
   A self-contained 3-step modal:
     1. "Let us know your name."  → input + Proceed
     2. "How do we reach out?"    → horizontal rounded pill options (Email / WhatsApp / Instagram / X)
        + channel-specific input + Proceed
     3. "A few words you wanna say? (optional)." → textarea + Finish
   On Finish: EmailJS send using public/safe credentials called directly
   from the frontend (no backend round-trip) → popup closes → green tick
   animation on a transparent overlay. On failure the popup shows an error
   and lets the visitor retry — no mailto fallback.

   Wire-up: any <a href="#contact"> or <a href="contact.html"> or
   [data-contact-popup] opens the modal instead of navigating.
   ============================================================ */
(function () {
    'use strict';

    if (document.getElementById('kwContactPopup')) return; // already injected

    /* ---------- Config ----------
       EmailJS only needs public/safe credentials (EMAILJS_SERVICE_ID /
       EMAILJS_PUBLIC_KEY from backend/.env), so the frontend calls EmailJS
       directly — no backend service involved. The private key in .env is
       never needed client-side and never leaves the server. */
    var SERVICE_ID = 'service_fxws8zr';
    var TEMPLATE_ID = 'template_k0vqwqb';
    var PUBLIC_KEY = 'RydUBWWX80tphkBWr';
    var EMAILJS_CDN = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';

    /* ---------- Channel definitions ---------- */
    var CHANNELS = {
        email:     { label: 'Email',     type: 'email', ph: 'you@example.com',        sub: 'Enter your email address' },
        whatsapp:  { label: 'WhatsApp',  type: 'tel',   ph: '+91 98765 43210',        sub: 'Enter your phone number' },
        instagram: { label: 'Instagram', type: 'text',  ph: '@yourhandle',            sub: 'Enter your Instagram username' },
        x:         { label: 'X',         type: 'text',  ph: '@yourhandle',            sub: 'Enter your X handle' }
    };

    /* ---------- Injected styles ---------- */
    var css = [
        '.kw-overlay{position:fixed;inset:0;background:rgba(10,10,10,.52);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9990;display:none;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .25s ease;}',
        '.kw-overlay.open{display:flex;opacity:1;}',
        '.kw-popup{background:#FDFBF3;border-radius:26px;width:100%;max-width:430px;padding:30px 30px 26px;box-shadow:0 30px 80px rgba(0,0,0,.28);position:relative;transform:translateY(16px) scale(.97);transition:transform .28s ease;max-height:90vh;overflow:auto;}',
        '.kw-overlay.open .kw-popup{transform:none;}',
        '.kw-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(10,10,10,.15);background:rgba(255,255,255,.75);font-size:15px;line-height:1;color:#0A0A0A;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;}',
        '.kw-close:hover{background:#0A0A0A;color:#fff;transform:rotate(90deg);}',
        '.kw-dots{display:flex;gap:6px;margin-bottom:22px;}',
        '.kw-dot{width:7px;height:7px;border-radius:999px;background:rgba(10,10,10,.16);transition:all .3s ease;}',
        '.kw-dot.active{background:#FF4D00;width:24px;}',
        '.kw-step{display:none;}',
        '.kw-step.active{display:block;animation:kwIn .32s ease;}',
        '@keyframes kwIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
        '.kw-title{font-family:Fraunces,serif;font-weight:600;font-size:23px;letter-spacing:-.01em;color:#0A0A0A;margin-bottom:6px;}',
        '.kw-sub{font-size:13px;color:#6B6B6B;margin-bottom:20px;line-height:1.5;}',
        '.kw-field{width:100%;padding:14px 16px;border-radius:14px;border:1.5px solid rgba(10,10,10,.14);background:#fff;font-size:14.5px;font-family:inherit;color:#0A0A0A;transition:border-color .2s,box-shadow .2s;}',
        '.kw-field:focus{outline:none;border-color:#FF4D00;box-shadow:0 0 0 3px rgba(255,77,0,.14);}',
        '.kw-field::placeholder{color:#9A9A9A;}',
        '.kw-channels{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:8px;}',
        '.kw-option{display:flex;min-width:0;}',
        '.kw-channel{display:flex;align-items:center;gap:10px;width:100%;padding:12px 16px;border-radius:999px;border:1.5px solid rgba(10,10,10,.14);background:#fff;cursor:pointer;transition:all .22s ease;text-align:left;}',
        '.kw-channel:hover{border-color:rgba(10,10,10,.4);transform:translateY(-1px);box-shadow:0 6px 14px rgba(10,10,10,.08);}',
        '.kw-channel.selected{border-color:#FF4D00;background:rgba(255,77,0,.07);box-shadow:0 0 0 3px rgba(255,77,0,.14);}',
        '.kw-channel-ico{display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
        '.kw-channel-ico svg{width:20px;height:20px;}',
        '.kw-channel-ico img{width:20px;height:20px;object-fit:contain;}',
        '.kw-channel-label{font-size:13px;font-weight:600;color:#0A0A0A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '.kw-channel-input-wrap{display:none;margin:14px 0 4px;}',
        '.kw-channel-input-wrap.show{display:block;animation:kwIn .3s ease;}',
        '.kw-label{display:block;font-size:12px;font-weight:600;color:#0A0A0A;margin-bottom:8px;}',
        '.kw-proceed{width:100%;padding:14px;border-radius:999px;background:#FF4D00;color:#fff;font-size:14.5px;font-weight:700;letter-spacing:.01em;cursor:pointer;transition:transform .22s,box-shadow .22s,opacity .22s;margin-top:14px;}',
        '.kw-proceed:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 22px rgba(255,77,0,.32);}',
        '.kw-proceed:disabled{opacity:.38;cursor:not-allowed;}',
        '.kw-textarea{min-height:110px;resize:vertical;}',
        '.kw-error{display:none;margin-top:12px;font-size:12.5px;color:#DC2626;text-align:center;line-height:1.5;}',
        '.kw-error.show{display:block;}',
        '.kw-tick{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;pointer-events:none;background:transparent;}',
        '.kw-tick.show{display:flex;}',
        '.kw-tick svg{width:120px;height:120px;overflow:visible;}',
        '.kw-tick .tc{stroke-dasharray:166;stroke-dashoffset:166;animation:kwStroke .55s cubic-bezier(.65,0,.45,1) forwards;}',
        '.kw-tick .tk{stroke-dasharray:40;stroke-dashoffset:40;animation:kwStroke .35s .45s cubic-bezier(.65,0,.45,1) forwards;}',
        '@keyframes kwStroke{to{stroke-dashoffset:0}}',
        '@media(max-width:420px){.kw-popup{padding:24px 20px 22px}.kw-title{font-size:20px}.kw-channels{gap:8px}.kw-channel{padding:10px 12px;gap:8px}.kw-channel-ico svg,.kw-channel-ico img{width:18px;height:18px}.kw-channel-label{font-size:12px}}'
    ].join('\n');

    /* ---------- Injected markup ---------- */
    var svgWhatsApp = '<svg viewBox="0 0 24 24"><path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
    var svgInstagram = '<svg viewBox="0 0 24 24"><path fill="#0A0A0A" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>';
    var svgX = '<svg viewBox="0 0 24 24"><path fill="#0A0A0A" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
    var svgGmail = '<img src="https://i.ibb.co/JWc9xSmd/OIP-2.png" alt="Gmail" />';

    var html =
        '<div class="kw-overlay" id="kwContactPopup" role="dialog" aria-modal="true" aria-label="Contact Khawain">' +
        '  <div class="kw-popup">' +
        '    <button type="button" class="kw-close" id="kwClose" aria-label="Close">✕</button>' +
        '    <div class="kw-dots">' +
        '      <span class="kw-dot active" data-dot="1"></span>' +
        '      <span class="kw-dot" data-dot="2"></span>' +
        '      <span class="kw-dot" data-dot="3"></span>' +
        '    </div>' +
        '    <!-- Step 1: name -->' +
        '    <div class="kw-step active" data-step="1">' +
        '      <h3 class="kw-title">Let us know your name.</h3>' +
        '      <p class="kw-sub">We\'ll use it to address you properly.</p>' +
        '      <input type="text" class="kw-field" id="kwName" placeholder="Your name" autocomplete="name" />' +
        '      <button type="button" class="kw-proceed" id="kwProceed1" disabled>Proceed</button>' +
        '    </div>' +
        '    <!-- Step 2: channel -->' +
        '    <div class="kw-step" data-step="2">' +
        '      <h3 class="kw-title">How do we reach out?</h3>' +
        '      <p class="kw-sub">Pick how you\'d like us to contact you.</p>' +        '      <div class="kw-channels">' +
        '        <div class="kw-option"><button type="button" class="kw-channel" data-channel="email" aria-label="Email"><span class="kw-channel-ico">' + svgGmail + '</span><span class="kw-channel-label">Email</span></button></div>' +
        '        <div class="kw-option"><button type="button" class="kw-channel" data-channel="whatsapp" aria-label="WhatsApp"><span class="kw-channel-ico">' + svgWhatsApp + '</span><span class="kw-channel-label">WhatsApp</span></button></div>' +
        '        <div class="kw-option"><button type="button" class="kw-channel" data-channel="instagram" aria-label="Instagram"><span class="kw-channel-ico">' + svgInstagram + '</span><span class="kw-channel-label">Instagram</span></button></div>' +
        '        <div class="kw-option"><button type="button" class="kw-channel" data-channel="x" aria-label="X"><span class="kw-channel-ico">' + svgX + '</span><span class="kw-channel-label">X</span></button></div>' +
        '      </div>' +
        '      <div class="kw-channel-input-wrap" id="kwChannelInputWrap">' +
        '        <label class="kw-label" id="kwChannelLabel"></label>' +
        '        <input type="text" class="kw-field" id="kwChannelInput" />' +
        '      </div>' +
        '      <button type="button" class="kw-proceed" id="kwProceed2" disabled>Proceed</button>' +
        '    </div>' +
        '    <!-- Step 3: message -->' +
        '    <div class="kw-step" data-step="3">' +
        '      <h3 class="kw-title">A few words you wanna say? <span style="color:#9A9A9A;font-weight:500">(optional)</span></h3>' +
        '      <p class="kw-sub">Tell us a little about your project or how we can help.</p>' +
        '      <textarea class="kw-field kw-textarea" id="kwMessage" placeholder="Write your message here..."></textarea>' +
        '      <button type="button" class="kw-proceed" id="kwFinish">Finish</button>' +
        '      <p class="kw-error" id="kwError">Something went wrong. Please try again.</p>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="kw-tick" id="kwTick">' +
        '  <svg viewBox="0 0 52 52">' +
        '    <circle class="tc" cx="26" cy="26" r="24" fill="none" stroke="#22C55E" stroke-width="4" stroke-linecap="round"/>' +
        '    <path class="tk" fill="none" stroke="#22C55E" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" d="M15 27l8 8 15-16"/>' +
        '  </svg>' +
        '</div>';

    /* ---------- Inject into document ---------- */
    var styleEl = document.createElement('style');
    styleEl.id = 'kwContactPopupStyles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    /* ---------- Element refs ---------- */
    var overlay = document.getElementById('kwContactPopup');
    var closeBtn = document.getElementById('kwClose');
    var steps = overlay.querySelectorAll('.kw-step');
    var dots = overlay.querySelectorAll('.kw-dot');
    var nameInput = document.getElementById('kwName');
    var proceed1 = document.getElementById('kwProceed1');
    var channelBtns = overlay.querySelectorAll('.kw-channel');
    var channelInputWrap = document.getElementById('kwChannelInputWrap');
    var channelLabel = document.getElementById('kwChannelLabel');
    var channelInput = document.getElementById('kwChannelInput');
    var proceed2 = document.getElementById('kwProceed2');
    var messageInput = document.getElementById('kwMessage');
    var finishBtn = document.getElementById('kwFinish');
    var errorBox = document.getElementById('kwError');
    var tick = document.getElementById('kwTick');

    /* ---------- State ---------- */
    var currentStep = 1;
    var selectedChannel = null;
    var popupOpen = false;

    /* ---------- Helpers ---------- */
    function setStep(n) {
        currentStep = n;
        steps.forEach(function (s) { s.classList.toggle('active', +s.getAttribute('data-step') === n); });
        dots.forEach(function (d) { d.classList.toggle('active', +d.getAttribute('data-dot') === n); });
    }

    function openPopup() {
        popupOpen = true;
        resetForm();
        setStep(1);
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(function () { nameInput.focus(); }, 280);
    }

    function closePopup() {
        popupOpen = false;
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    function resetForm() {
        nameInput.value = '';
        channelBtns.forEach(function (b) { b.classList.remove('selected'); });
        selectedChannel = null;
        channelInputWrap.classList.remove('show');
        channelInput.value = '';
        messageInput.value = '';
        errorBox.classList.remove('show');
        proceed1.disabled = true;
        proceed2.disabled = true;
        finishBtn.disabled = false;
        finishBtn.textContent = 'Finish';
    }

    function updateProceed1() {
        proceed1.disabled = nameInput.value.trim() === '';
    }

    function selectChannel(key) {
        channelBtns.forEach(function (b) {
            var isSel = b.getAttribute('data-channel') === key;
            b.classList.toggle('selected', isSel);
        });
        selectedChannel = key;
        var cfg = CHANNELS[key];
        channelLabel.textContent = cfg.sub;
        channelInput.type = cfg.type;
        channelInput.placeholder = cfg.ph;
        channelInput.value = '';
        channelInputWrap.classList.add('show');
        updateProceed2();
        setTimeout(function () { channelInput.focus(); }, 60);
    }

    function updateProceed2() {
        var val = channelInput.value.trim();
        var valid = val !== '';
        if (selectedChannel && (selectedChannel === 'email' || selectedChannel === 'whatsapp')) {
            valid = channelInput.checkValidity() && val !== '';
        }
        proceed2.disabled = !(selectedChannel && valid);
    }

    /* ---------- EmailJS ---------- */
    function ensureEmailJS() {
        return new Promise(function (resolve, reject) {
            if (window.emailjs && window.emailjs.send) return resolve();
            var s = document.createElement('script');
            s.src = EMAILJS_CDN;
            s.onload = function () {
                if (window.emailjs) { emailjs.init(PUBLIC_KEY); resolve(); }
                else { reject(new Error('EmailJS failed to initialise')); }
            };
            s.onerror = function () { reject(new Error('EmailJS script failed to load')); };
            document.head.appendChild(s);
        });
    }

    function sendContact() {
        var name = nameInput.value.trim();
        var cfg = CHANNELS[selectedChannel];
        var contactVal = channelInput.value.trim();
        var msg = messageInput.value.trim();

        // Params MUST match the template_contact variables exactly (EmailJS rejects
        // sends with params that aren't declared in the template → 400 error).
        var params = {
            name: name,
            channel: cfg.label,
            contact_value: contactVal,
            email: selectedChannel === 'email' ? contactVal : '',
            phone: selectedChannel === 'whatsapp' ? contactVal : '',
            handle: (selectedChannel === 'instagram' || selectedChannel === 'x') ? contactVal : '',
            company: '',
            message: msg || 'No message provided.',
            time: new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
        };

        return ensureEmailJS().then(function () {
            if (window.emailjs && window.emailjs.send) {
                return emailjs.send(SERVICE_ID, TEMPLATE_ID, params, PUBLIC_KEY);
            }
            throw new Error('EmailJS unavailable');
        });
    }

    /* ---------- Green tick (transparent bg) ---------- */
    function playTick() {
        tick.classList.add('show');
        setTimeout(function () {
            tick.classList.remove('show');
        }, 2400);
    }

    /* ---------- Wire-up ---------- */
    nameInput.addEventListener('input', updateProceed1);
    channelInput.addEventListener('input', updateProceed2);

    proceed1.addEventListener('click', function () {
        if (!proceed1.disabled) { setStep(2); }
    });

    // Clicking anywhere on the option (pill or label) selects the channel
    overlay.querySelectorAll('.kw-option').forEach(function (opt) {
        opt.addEventListener('click', function () {
            var btn = opt.querySelector('.kw-channel');
            if (btn) selectChannel(btn.getAttribute('data-channel'));
        });
    });

    proceed2.addEventListener('click', function () {
        if (!proceed2.disabled) { setStep(3); }
    });

    finishBtn.addEventListener('click', function () {
        if (finishBtn.disabled) return;
        finishBtn.disabled = true;
        finishBtn.textContent = 'Sending...';

        sendContact()
            .then(function () {
                closePopup();
                playTick();
            })
            .catch(function (err) {
                // No mailto fallback — surface the error in the popup instead.
                console.error('Email send failed:', err);
                errorBox.textContent = 'Couldn\'t send your message right now. Please try again.';
                errorBox.classList.add('show');
                finishBtn.disabled = false;
                finishBtn.textContent = 'Try Again';
            });
    });

    closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closePopup();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && popupOpen) closePopup();
    });

    // Enter advances where allowed; textarea keeps newlines (Ctrl/Cmd+Enter to finish)
    [nameInput, channelInput, messageInput].forEach(function (inp) {
        inp.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            if (inp === messageInput) {
                if (e.ctrlKey || e.metaKey) { e.preventDefault(); finishBtn.click(); }
                return;
            }
            if (inp === nameInput && !proceed1.disabled) { e.preventDefault(); setStep(2); }
            else if (inp === channelInput && !proceed2.disabled) { e.preventDefault(); setStep(3); }
        });
    });

    // Open triggers: #contact links, legacy contact.html links, [data-contact-popup]
    function wireTriggers() {
        var links = document.querySelectorAll('a[href="#contact"], [data-contact-popup]');
        links.forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                openPopup();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireTriggers);
    } else {
        wireTriggers();
    }
})();
