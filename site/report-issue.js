/*!
 * report-issue.js — ระบบแจ้งปัญหา/แจ้งแก้ไขข้อมูล (Direct Partner Portal)
 * -------------------------------------------------------------------------
 * ไฟล์นี้ทำงานแยกอิสระจากระบบเดิม 100%
 *  - ไม่แก้ไข ไม่เขียนทับ ไม่ผูกกับตัวแปรใด ๆ ของหน้าเว็บเดิม
 *  - ทุกอย่างห่อด้วย try/catch ถ้าไฟล์นี้มีปัญหา หน้าเว็บเดิมยังทำงานปกติ
 *  - ถอนออกได้ทันทีโดยลบ <script> 1 บรรทัดใน index.html
 *
 * วิธีติดตั้ง: ใส่บรรทัดนี้ก่อนแท็บปิด body ของ index.html
 *   <script src="report-issue.js" defer><\/script>
 *
 * หมายเหตุ: ไฟล์นี้ปลอดภัยทั้งแบบแยกไฟล์ และแบบวางโค้ดทั้งหมดลงในแท็ก script
 *           ของ index.html โดยตรง (ไม่มีลำดับอักขระที่ทำให้แท็ก script ปิดก่อนกำหนด)
 */
(function () {
  'use strict';

  /* ======================================================================
   * 1) ตั้งค่า — แก้เฉพาะส่วนนี้
   * ==================================================================== */
  var CONFIG = {
    // URL ของ Google Apps Script Web App (ได้จากขั้นตอน Deploy)
    // ถ้ายังไม่ใส่ ระบบจะยังทำงานได้ แต่จะให้ผู้ใช้คัดลอกข้อความไปส่งเองแทน
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbz_Jkd2jt_qTRmk6GHsQ79fDHQ80mnJu2s8gr36pRotRWwF_3fvDnQPgTZ1L-LrRIMaKw/exec',

    // รุ่นของหน้าเว็บ (ช่วยให้รู้ว่าผู้แจ้งใช้เวอร์ชันไหน)
    APP_VERSION: '2026.08',

    // ข้อความบนปุ่ม
    BUTTON_LABEL: 'แจ้งแก้ไขข้อมูล',

    // ถ้าหาปุ่ม "ออกจากระบบ" ไม่เจอ ให้แสดงเป็นปุ่มลอยมุมขวาล่างแทน
    FLOATING_FALLBACK: true,

    // ช่องทางสำรองให้ผู้ใช้ติดต่อ กรณีส่งไม่สำเร็จจริง ๆ (เว้นว่างได้)
    FALLBACK_CONTACT: ''
  };

  /* ======================================================================
   * 2) ประเภทปัญหา — เพิ่ม/ลดได้ตามต้องการ
   * ==================================================================== */
  var ISSUE_TYPES = [
    'ข้อมูลคริสตจักรในเครือข่ายไม่ถูกต้อง',
    'ชื่อ-นามสกุล / ชื่อผู้บุกเบิก สะกดผิด',
    'ตัวเลขไม่ถูกต้อง (เป้าหมาย / ผลจริง / งบประมาณ)',
    'ข้อมูลติดต่อ / ที่อยู่ / พิกัด ไม่ถูกต้อง',
    'ข้อมูลหายไป / ควรมีแต่ไม่แสดง',
    'ขอเพิ่มข้อมูลใหม่',
    'เข้าใช้งานไม่ได้ / ปุ่มหรือลิงก์ใช้ไม่ได้',
    'อื่น ๆ'
  ];

  /* ======================================================================
   * 3) ตัวช่วยพื้นฐาน
   * ==================================================================== */
  var NS = 'rptIssue';
  var opened = false;

  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') { node.textContent = attrs[k]; }
        else if (k === 'html') { node.innerHTML = attrs[k]; }
        else if (k === 'style') { node.setAttribute('style', attrs[k]); }
        else { node.setAttribute(k, attrs[k]); }
      });
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  /* ======================================================================
   * 4) เก็บบริบทอัตโนมัติ — หัวใจของระบบนี้
   *    ผู้ใช้ไม่ต้องพิมพ์เองว่าอยู่หน้าไหน ใครเป็นคนแจ้ง
   * ==================================================================== */

  // เดา "หน้า/เมนูที่กำลังเปิดอยู่" จากหลายทาง เอาอันที่น่าเชื่อที่สุด
  function detectCurrentSection() {
    return safe(function () {
      // 4.1 เมนูที่ถูกทำเครื่องหมายว่า active อยู่
      var activeSel = [
        '.nav-link.active', '.menu-item.active', '.tab.active', '.tab-btn.active',
        '[class*="active"][class*="tab"]', '[class*="active"][class*="menu"]',
        '[aria-selected="true"]', '[aria-current="page"]'
      ].join(',');
      var active = document.querySelector(activeSel);
      if (active && active.textContent.trim()) {
        return active.textContent.trim().replace(/\s+/g, ' ').slice(0, 80);
      }

      // 4.2 หัวข้อใหญ่ที่มองเห็นอยู่บนจอ
      var heads = document.querySelectorAll('h1, h2, .page-title, .section-title, .card-title');
      for (var i = 0; i < heads.length; i++) {
        var r = heads[i].getBoundingClientRect();
        var visible = r.height > 0 && r.top < (window.innerHeight * 0.6) && r.bottom > 0;
        if (visible && heads[i].textContent.trim()) {
          return heads[i].textContent.trim().replace(/\s+/g, ' ').slice(0, 80);
        }
      }

      // 4.3 จาก hash ของ URL
      if (location.hash && location.hash.length > 1) {
        return decodeURIComponent(location.hash.replace(/^#\/?/, '')).slice(0, 80);
      }

      return '';
    }, '');
  }

  // เดาผู้ใช้ที่ล็อกอินอยู่ — พยายามหลายทาง ถ้าไม่เจอก็ปล่อยว่างให้กรอกเอง
  function detectUser() {
    var out = { name: '', phone: '' };

    safe(function () {
      // 4.4 ตัวแปร global ที่แอปมักตั้งไว้
      var globals = ['currentUser', 'user', 'loggedInUser', 'userData', 'partner', 'currentPartner'];
      for (var i = 0; i < globals.length; i++) {
        var g = window[globals[i]];
        if (g && typeof g === 'object') {
          out.name = out.name || g.name || g.fullName || g.displayName || g.ชื่อ || '';
          out.phone = out.phone || g.phone || g.tel || g.mobile || g.phoneNumber || g.เบอร์โทร || '';
        }
      }
    });

    safe(function () {
      // 4.5 ค่าที่เก็บไว้ตอนล็อกอิน
      var stores = [window.sessionStorage, window.localStorage];
      for (var s = 0; s < stores.length; s++) {
        var store = stores[s];
        if (!store) continue;
        for (var k = 0; k < store.length; k++) {
          var key = store.key(k);
          if (!/user|login|phone|partner|auth|profile|เบอร|ผู้ใช/i.test(key)) continue;
          var raw = store.getItem(key);
          if (!raw) continue;

          // เก็บเป็น JSON
          if (/^[\[{]/.test(raw.trim())) {
            var obj = safe(function () { return JSON.parse(raw); }, null);
            if (obj && typeof obj === 'object') {
              out.name = out.name || obj.name || obj.fullName || obj.displayName || '';
              out.phone = out.phone || obj.phone || obj.tel || obj.mobile || obj.phoneNumber || '';
              continue;
            }
          }
          // เก็บเป็นเบอร์โทรตรง ๆ
          if (!out.phone && /^0\d{8,9}$/.test(raw.trim())) out.phone = raw.trim();
          if (!out.name && /name|ชื่อ/i.test(key) && raw.length < 60) out.name = raw.trim();
        }
      }
    });

    return out;
  }

  function collectContext() {
    var u = detectUser();
    return {
      หน้าที่พบ: detectCurrentSection(),
      ชื่อผู้แจ้ง: u.name,
      เบอร์ติดต่อ: u.phone,
      url: safe(function () { return location.href; }, ''),
      เวลาเครื่องผู้ใช้: safe(function () { return new Date().toString(); }, ''),
      อุปกรณ์: safe(function () { return navigator.userAgent; }, ''),
      ขนาดจอ: safe(function () { return window.innerWidth + 'x' + window.innerHeight; }, ''),
      เวอร์ชัน: CONFIG.APP_VERSION
    };
  }

  /* ======================================================================
   * 5) หน้าตา (CSS) — ใช้ชื่อคลาสเฉพาะ ไม่ชนกับสไตล์เดิมของเว็บ
   * ==================================================================== */
  var CSS = [
    '.' + NS + '-btn{display:inline-flex;align-items:center;gap:6px;font-family:inherit;',
    'font-size:14px;line-height:1;padding:9px 14px;border-radius:8px;cursor:pointer;',
    'border:1px solid #d0d5dd;background:#fff;color:#344054;font-weight:500;',
    'transition:background .15s,border-color .15s;white-space:nowrap;}',
    '.' + NS + '-btn:hover{background:#f9fafb;border-color:#98a2b3;}',
    '.' + NS + '-btn:focus-visible{outline:2px solid #2563eb;outline-offset:2px;}',

    '.' + NS + '-float{position:fixed;right:18px;bottom:18px;z-index:2147483000;',
    'box-shadow:0 4px 14px rgba(16,24,40,.18);background:#fff;}',

    '.' + NS + '-ov{position:fixed;inset:0;z-index:2147483001;background:rgba(16,24,40,.55);',
    'display:flex;align-items:center;justify-content:center;padding:16px;',
    'font-family:inherit;-webkit-font-smoothing:antialiased;}',

    '.' + NS + '-modal{background:#fff;width:100%;max-width:560px;max-height:92vh;overflow:auto;',
    'border-radius:14px;box-shadow:0 20px 48px rgba(16,24,40,.28);}',

    '.' + NS + '-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;',
    'padding:18px 20px 12px;border-bottom:1px solid #eaecf0;position:sticky;top:0;background:#fff;',
    'border-radius:14px 14px 0 0;}',
    '.' + NS + '-hd h2{margin:0;font-size:17px;font-weight:700;color:#101828;}',
    '.' + NS + '-hd p{margin:4px 0 0;font-size:13px;color:#667085;line-height:1.5;}',
    '.' + NS + '-x{border:0;background:transparent;font-size:24px;line-height:1;cursor:pointer;',
    'color:#667085;padding:2px 6px;border-radius:6px;}',
    '.' + NS + '-x:hover{background:#f2f4f7;color:#101828;}',

    '.' + NS + '-bd{padding:16px 20px 4px;}',
    '.' + NS + '-f{margin-bottom:15px;}',
    '.' + NS + '-f label{display:block;font-size:13px;font-weight:600;color:#344054;margin-bottom:6px;}',
    '.' + NS + '-f .req{color:#d92d20;margin-left:2px;}',
    '.' + NS + '-f .hint{display:block;font-weight:400;color:#667085;font-size:12px;margin-top:3px;}',
    '.' + NS + '-f input,.' + NS + '-f select,.' + NS + '-f textarea{width:100%;box-sizing:border-box;',
    'font-family:inherit;font-size:14.5px;color:#101828;padding:10px 12px;border:1px solid #d0d5dd;',
    'border-radius:8px;background:#fff;}',
    '.' + NS + '-f textarea{min-height:84px;resize:vertical;line-height:1.5;}',
    '.' + NS + '-f input:focus,.' + NS + '-f select:focus,.' + NS + '-f textarea:focus{',
    'outline:0;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.14);}',
    '.' + NS + '-f.err input,.' + NS + '-f.err select,.' + NS + '-f.err textarea{border-color:#d92d20;}',
    '.' + NS + '-f .msg{display:none;color:#d92d20;font-size:12.5px;margin-top:5px;}',
    '.' + NS + '-f.err .msg{display:block;}',

    '.' + NS + '-ctx{background:#f9fafb;border:1px solid #eaecf0;border-radius:9px;padding:10px 12px;',
    'font-size:12.5px;color:#475467;line-height:1.65;margin-bottom:15px;}',
    '.' + NS + '-ctx b{color:#101828;font-weight:600;}',

    '.' + NS + '-hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;}',

    '.' + NS + '-ft{display:flex;gap:10px;justify-content:flex-end;padding:14px 20px 18px;',
    'border-top:1px solid #eaecf0;position:sticky;bottom:0;background:#fff;}',
    '.' + NS + '-ft button{font-family:inherit;font-size:14.5px;font-weight:600;padding:11px 20px;',
    'border-radius:8px;cursor:pointer;border:1px solid transparent;}',
    '.' + NS + '-cancel{background:#fff;border-color:#d0d5dd!important;color:#344054;}',
    '.' + NS + '-cancel:hover{background:#f9fafb;}',
    '.' + NS + '-send{background:#2563eb;color:#fff;}',
    '.' + NS + '-send:hover{background:#1d4ed8;}',
    '.' + NS + '-send[disabled]{background:#98a2b3;cursor:not-allowed;}',

    '.' + NS + '-done{padding:28px 24px 24px;text-align:center;}',
    '.' + NS + '-done .ic{font-size:42px;line-height:1;}',
    '.' + NS + '-done h3{margin:12px 0 6px;font-size:17px;color:#101828;}',
    '.' + NS + '-done p{margin:0 0 6px;font-size:14px;color:#475467;line-height:1.6;}',
    '.' + NS + '-tk{display:inline-block;margin-top:10px;background:#eff6ff;color:#1d4ed8;',
    'border:1px solid #bfdbfe;border-radius:8px;padding:8px 14px;font-weight:700;font-size:15px;',
    'letter-spacing:.5px;}',
    '.' + NS + '-copy{margin-top:14px;width:100%;box-sizing:border-box;font-family:inherit;font-size:13px;',
    'min-height:120px;padding:10px;border:1px solid #d0d5dd;border-radius:8px;}',

    '@media (max-width:600px){',
    '.' + NS + '-ov{padding:0;align-items:flex-end;}',
    '.' + NS + '-modal{max-width:none;max-height:94vh;border-radius:16px 16px 0 0;}',
    '.' + NS + '-hd{border-radius:16px 16px 0 0;}',
    '.' + NS + '-ft button{flex:1;}',
    '.' + NS + '-float{right:14px;bottom:14px;}}'
  ].join('');

  /* ======================================================================
   * 6) สร้างแบบฟอร์ม
   * ==================================================================== */
  var ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 9v4"/><path d="M10.36 3.6 2.4 17.2A1.9 1.9 0 0 0 4.04 20h15.92a1.9 1.9 0 0 0 ' +
    '1.64-2.8L13.64 3.6a1.9 1.9 0 0 0-3.28 0Z"/><path d="M12 17h.01"/></svg>';

  function field(id, labelText, control, required, hint) {
    var lab = el('label', { 'for': NS + '-' + id });
    lab.appendChild(document.createTextNode(labelText));
    if (required) lab.appendChild(el('span', { 'class': 'req', text: '*' }));
    if (hint) lab.appendChild(el('span', { 'class': 'hint', text: hint }));
    return el('div', { 'class': NS + '-f', 'data-f': id }, [
      lab, control, el('div', { 'class': 'msg', text: 'กรุณากรอกข้อมูลในช่องนี้' })
    ]);
  }

  function buildModal(ctx) {
    var typeSel = el('select', { id: NS + '-type' });
    typeSel.appendChild(el('option', { value: '', text: '— เลือกประเภท —' }));
    ISSUE_TYPES.forEach(function (t) { typeSel.appendChild(el('option', { value: t, text: t })); });

    var pageInput = el('input', {
      id: NS + '-page', type: 'text', value: ctx.หน้าที่พบ || '',
      placeholder: 'เช่น รายชื่อผู้บุกเบิกในเครือข่าย'
    });
    var wrongInput = el('input', {
      id: NS + '-wrong', type: 'text',
      placeholder: 'เช่น คริสตจักรบ้านใหม่ / ยอดเงินงวดที่ 2 = 5,000'
    });
    var correctArea = el('textarea', {
      id: NS + '-correct',
      placeholder: 'เช่น ชื่อที่ถูกต้องคือ "คริสตจักรบ้านใหม่พัฒนา" / ยอดที่ถูกต้องคือ 15,000 บาท'
    });
    var detailArea = el('textarea', {
      id: NS + '-detail', placeholder: 'ข้อมูลอื่นที่จะช่วยให้ทีมงานตรวจสอบได้เร็วขึ้น (ไม่บังคับ)'
    });
    var nameInput = el('input', {
      id: NS + '-name', type: 'text', value: ctx.ชื่อผู้แจ้ง || '', placeholder: 'ชื่อ-นามสกุล'
    });
    var phoneInput = el('input', {
      id: NS + '-phone', type: 'tel', value: ctx.เบอร์ติดต่อ || '',
      placeholder: 'เบอร์โทรที่ติดต่อกลับได้', inputmode: 'tel'
    });
    var honey = el('input', { id: NS + '-hp', type: 'text', 'class': NS + '-hp', tabindex: '-1', autocomplete: 'off' });

    var ctxBox = el('div', { 'class': NS + '-ctx' });
    ctxBox.innerHTML =
      '<b>ระบบแนบข้อมูลนี้ให้อัตโนมัติ</b> เพื่อให้ทีมงานตรวจสอบได้เร็วขึ้น<br>' +
      'เวลาที่แจ้ง · หน้าที่กำลังเปิด · อุปกรณ์ที่ใช้' +
      (ctx.ชื่อผู้แจ้ง || ctx.เบอร์ติดต่อ ? ' · ผู้ใช้ที่เข้าสู่ระบบอยู่' : '');

    var body = el('div', { 'class': NS + '-bd' }, [
      field('type', 'ประเภทปัญหา', typeSel, true),
      field('page', 'หน้า / ส่วนที่พบปัญหา', pageInput, true, 'ระบบเติมให้อัตโนมัติแล้ว แก้ไขได้'),
      field('wrong', 'ข้อมูลที่แสดงอยู่ตอนนี้', wrongInput, false, 'ไม่บังคับ แต่ช่วยให้หาเจอเร็วขึ้นมาก'),
      field('correct', 'ข้อมูลที่ถูกต้องควรเป็น', correctArea, true),
      field('detail', 'รายละเอียดเพิ่มเติม', detailArea, false),
      field('name', 'ชื่อผู้แจ้ง', nameInput, true),
      field('phone', 'เบอร์ติดต่อกลับ', phoneInput, false, 'ไม่บังคับ แต่ช่วยให้สอบถามเพิ่มเติมได้'),
      ctxBox, honey
    ]);

    var closeBtn = el('button', { 'class': NS + '-x', type: 'button', 'aria-label': 'ปิด', text: '×' });
    var head = el('div', { 'class': NS + '-hd' }, [
      el('div', {}, [
        el('h2', { text: 'แจ้งแก้ไขข้อมูล' }),
        el('p', { text: 'พบข้อมูลไม่ถูกต้อง แจ้งเราได้ที่นี่ ทีมงานจะตรวจสอบและแก้ไขให้ครับ' })
      ]),
      closeBtn
    ]);

    var cancelBtn = el('button', { 'class': NS + '-cancel', type: 'button', text: 'ยกเลิก' });
    var sendBtn = el('button', { 'class': NS + '-send', type: 'submit', text: 'ส่งเรื่อง' });
    var foot = el('div', { 'class': NS + '-ft' }, [cancelBtn, sendBtn]);

    var form = el('form', { novalidate: 'novalidate' }, [body, foot]);
    var modal = el('div', { 'class': NS + '-modal', role: 'dialog', 'aria-modal': 'true' }, [head, form]);
    var overlay = el('div', { 'class': NS + '-ov' }, [modal]);

    return {
      overlay: overlay, modal: modal, form: form, honey: honey, sendBtn: sendBtn,
      closers: [closeBtn, cancelBtn],
      values: function () {
        return {
          ประเภทปัญหา: typeSel.value.trim(),
          หน้าที่พบ: pageInput.value.trim(),
          ข้อมูลที่ผิด: wrongInput.value.trim(),
          ข้อมูลที่ถูกต้อง: correctArea.value.trim(),
          รายละเอียด: detailArea.value.trim(),
          ชื่อผู้แจ้ง: nameInput.value.trim(),
          เบอร์ติดต่อ: phoneInput.value.trim()
        };
      },
      firstField: typeSel
    };
  }

  /* ======================================================================
   * 7) ตรวจสอบและส่ง
   * ==================================================================== */
  var REQUIRED = [
    { key: 'ประเภทปัญหา', f: 'type', msg: 'กรุณาเลือกประเภทปัญหา' },
    { key: 'หน้าที่พบ', f: 'page', msg: 'กรุณาระบุหน้าหรือส่วนที่พบปัญหา' },
    { key: 'ข้อมูลที่ถูกต้อง', f: 'correct', msg: 'กรุณาระบุข้อมูลที่ถูกต้อง' },
    { key: 'ชื่อผู้แจ้ง', f: 'name', msg: 'กรุณากรอกชื่อผู้แจ้ง' }
  ];

  function validate(ui, vals) {
    var firstBad = null;
    ui.modal.querySelectorAll('.' + NS + '-f').forEach(function (n) { n.classList.remove('err'); });
    REQUIRED.forEach(function (r) {
      if (vals[r.key]) return;
      var node = ui.modal.querySelector('[data-f="' + r.f + '"]');
      if (!node) return;
      node.classList.add('err');
      node.querySelector('.msg').textContent = r.msg;
      if (!firstBad) firstBad = node;
    });
    if (firstBad) {
      var input = firstBad.querySelector('input,select,textarea');
      if (input) safe(function () { input.focus(); });
      safe(function () { firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
      return false;
    }
    return true;
  }

  function asPlainText(payload) {
    return [
      'แจ้งแก้ไขข้อมูล — Direct Partner Portal',
      '────────────────────────',
      'ประเภท: ' + payload.ประเภทปัญหา,
      'หน้าที่พบ: ' + payload.หน้าที่พบ,
      'ข้อมูลที่ผิด: ' + (payload.ข้อมูลที่ผิด || '-'),
      'ข้อมูลที่ถูกต้อง: ' + payload.ข้อมูลที่ถูกต้อง,
      'รายละเอียด: ' + (payload.รายละเอียด || '-'),
      'ผู้แจ้ง: ' + payload.ชื่อผู้แจ้ง + (payload.เบอร์ติดต่อ ? ' (' + payload.เบอร์ติดต่อ + ')' : ''),
      'เวลา: ' + payload.เวลาเครื่องผู้ใช้,
      'หน้า: ' + payload.url
    ].join('\n');
  }

  // ส่งไป Apps Script — ใช้ Content-Type: text/plain เพื่อเลี่ยง CORS preflight
  function send(payload) {
    if (!CONFIG.ENDPOINT) return Promise.reject(new Error('NO_ENDPOINT'));

    return fetch(CONFIG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    }).then(function (res) {
      return res.text();
    }).then(function (txt) {
      var data = safe(function () { return JSON.parse(txt); }, null);
      if (data && data.ok) return data;
      throw new Error('BAD_RESPONSE');
    })['catch'](function (err) {
      // สำรอง: ยิงแบบ no-cors ข้อมูลถึงชีตแน่ แต่จะอ่านเลขที่เรื่องกลับมาไม่ได้
      return fetch(CONFIG.ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function () {
        return { ok: true, ticket: '', degraded: true };
      })['catch'](function () { throw err; });
    });
  }

  /* ======================================================================
   * 8) หน้าจอผลลัพธ์
   * ==================================================================== */
  function showSuccess(ui, result) {
    var inner = el('div', { 'class': NS + '-done' }, [
      el('div', { 'class': 'ic', text: '✅' }),
      el('h3', { text: 'รับเรื่องเรียบร้อยแล้ว' }),
      el('p', { text: 'ขอบคุณที่ช่วยแจ้งครับ ทีมงานจะตรวจสอบและแก้ไขให้โดยเร็วที่สุด' })
    ]);
    if (result && result.ticket) {
      inner.appendChild(el('p', { text: 'หมายเลขเรื่องของท่านคือ' }));
      inner.appendChild(el('div', { 'class': NS + '-tk', text: result.ticket }));
      inner.appendChild(el('p', {
        style: 'margin-top:12px;font-size:13px;color:#667085;',
        text: 'ใช้หมายเลขนี้อ้างอิงได้เมื่อต้องการสอบถามความคืบหน้า'
      }));
    }
    var ok = el('button', { 'class': NS + '-send', type: 'button', text: 'เรียบร้อย' });
    ok.addEventListener('click', close);
    ui.modal.innerHTML = '';
    ui.modal.appendChild(inner);
    ui.modal.appendChild(el('div', { 'class': NS + '-ft' }, [ok]));
    safe(function () { ok.focus(); });
  }

  function showFailure(ui, payload) {
    var text = asPlainText(payload);
    var box = el('textarea', { 'class': NS + '-copy', readonly: 'readonly' });
    box.value = text;

    var inner = el('div', { 'class': NS + '-done' }, [
      el('div', { 'class': 'ic', text: '⚠️' }),
      el('h3', { text: 'ส่งอัตโนมัติไม่สำเร็จ' }),
      el('p', {
        text: 'อาจเป็นเพราะสัญญาณอินเทอร์เน็ตขัดข้อง กรุณาคัดลอกข้อความด้านล่างส่งให้ทีมงาน' +
          (CONFIG.FALLBACK_CONTACT ? ' ที่ ' + CONFIG.FALLBACK_CONTACT : '')
      }),
      box
    ]);
    var copy = el('button', { 'class': NS + '-send', type: 'button', text: 'คัดลอกข้อความ' });
    copy.addEventListener('click', function () {
      safe(function () { box.select(); document.execCommand('copy'); });
      safe(function () { navigator.clipboard.writeText(text); });
      copy.textContent = 'คัดลอกแล้ว ✓';
    });
    var back = el('button', { 'class': NS + '-cancel', type: 'button', text: 'ปิด' });
    back.addEventListener('click', close);

    ui.modal.innerHTML = '';
    ui.modal.appendChild(inner);
    ui.modal.appendChild(el('div', { 'class': NS + '-ft' }, [back, copy]));
  }

  /* ======================================================================
   * 9) เปิด / ปิด
   * ==================================================================== */
  var current = null, lastFocus = null, scrollLock = '';

  function close() {
    if (!current) return;
    safe(function () { current.overlay.remove(); });
    safe(function () { document.body.style.overflow = scrollLock; });
    safe(function () { if (lastFocus && lastFocus.focus) lastFocus.focus(); });
    current = null;
    opened = false;
  }

  function onKey(e) {
    if (!current) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }

  function open() {
    if (opened) return;
    opened = true;
    lastFocus = document.activeElement;

    var ctx = collectContext();
    var ui = buildModal(ctx);
    current = ui;

    ui.closers.forEach(function (b) { b.addEventListener('click', close); });
    ui.overlay.addEventListener('mousedown', function (e) { if (e.target === ui.overlay) close(); });

    ui.form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (ui.honey.value) { close(); return; }          // กันบอท

      var vals = ui.values();
      if (!validate(ui, vals)) return;

      var payload = vals;
      Object.keys(ctx).forEach(function (k) {
        if (payload[k] === undefined || payload[k] === '') payload[k] = ctx[k];
      });
      payload.url = ctx.url;
      payload.อุปกรณ์ = ctx.อุปกรณ์;
      payload.ขนาดจอ = ctx.ขนาดจอ;
      payload.เวอร์ชัน = ctx.เวอร์ชัน;
      payload.เวลาเครื่องผู้ใช้ = ctx.เวลาเครื่องผู้ใช้;

      ui.sendBtn.disabled = true;
      ui.sendBtn.textContent = 'กำลังส่ง…';

      send(payload).then(function (result) {
        showSuccess(ui, result);
      })['catch'](function () {
        showFailure(ui, payload);
      });
    });

    scrollLock = safe(function () { return document.body.style.overflow; }, '');
    safe(function () { document.body.style.overflow = 'hidden'; });
    document.body.appendChild(ui.overlay);
    safe(function () { ui.firstField.focus(); });
  }

  /* ======================================================================
   * 10) หาปุ่ม "ออกจากระบบ" แล้ววางปุ่มแจ้งปัญหาไว้ข้าง ๆ
   * ==================================================================== */
  var LOGOUT_RE = /ออกจากระบบ|ล็อกเอาต์|logout|log\s?out|sign\s?out/i;

  function findLogout() {
    return safe(function () {
      var cands = document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]');
      for (var i = 0; i < cands.length; i++) {
        var n = cands[i];
        var txt = (n.textContent || '') + ' ' + (n.value || '') + ' ' +
          (n.getAttribute('aria-label') || '') + ' ' + (n.getAttribute('title') || '') + ' ' +
          (n.id || '') + ' ' + (n.className || '');
        if (!LOGOUT_RE.test(txt)) continue;
        var r = n.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;   // ซ่อนอยู่ ข้ามไป
        return n;
      }
      return null;
    }, null);
  }

  function makeButton(extraClass) {
    var b = el('button', {
      type: 'button',
      'class': NS + '-btn' + (extraClass ? ' ' + extraClass : ''),
      id: NS + '-trigger',
      title: 'พบข้อมูลไม่ถูกต้อง แจ้งเราได้ที่นี่'
    });
    b.innerHTML = ICON + '<span>' + CONFIG.BUTTON_LABEL + '</span>';
    b.addEventListener('click', function (e) { e.preventDefault(); open(); });
    return b;
  }

  function mount() {
    if (document.getElementById(NS + '-trigger')) return true;

    var logout = findLogout();
    if (logout && logout.parentNode) {
      var btn = makeButton();
      // เว้นระยะจากปุ่มออกจากระบบ กันกดพลาด
      btn.style.marginRight = '10px';
      logout.parentNode.insertBefore(btn, logout);
      return true;
    }

    if (CONFIG.FLOATING_FALLBACK) {
      document.body.appendChild(makeButton(NS + '-float'));
      return true;
    }
    return false;
  }

  /* ======================================================================
   * 11) เริ่มทำงาน
   * ==================================================================== */
  function init() {
    try {
      if (document.getElementById(NS + '-style')) return;
      var st = el('style', { id: NS + '-style' });
      st.textContent = CSS;
      document.head.appendChild(st);
      document.addEventListener('keydown', onKey, true);

      mount();

      // หน้าเว็บนี้แสดงปุ่มออกจากระบบหลังล็อกอิน จึงต้องเฝ้าดูจนกว่าจะเจอ
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        var trigger = document.getElementById(NS + '-trigger');
        var isFloating = trigger && trigger.classList.contains(NS + '-float');

        // เจอปุ่มออกจากระบบทีหลัง → ย้ายปุ่มไปอยู่ข้าง ๆ ให้ถูกที่
        if ((!trigger || isFloating) && findLogout()) {
          if (trigger) trigger.remove();
          mount();
        }
        if (tries > 60) clearInterval(timer);   // เลิกเฝ้าหลัง ~2 นาที
      }, 2000);

      // เปิดฟอร์มจากที่อื่นได้ เช่น onclick="reportIssue()"
      window.reportIssue = open;
    } catch (e) {
      // เงียบไว้ — ห้ามให้ไฟล์นี้ทำหน้าเว็บเดิมพัง
      if (window.console && console.warn) console.warn('[report-issue] init failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
