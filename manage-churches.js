/*!
 * manage-churches.js — เลือกลบรายชื่อผู้บุกเบิกทีละหลายรายการ
 * Direct Partner Portal · Thailand Church Planting Training Center
 *
 * ทำงานแบบเสริมบนหน้าเว็บเดิม ไม่แก้โครงสร้างเดิมเลย
 * ถ้าไฟล์นี้พังหรือโหลดไม่ได้ หน้าเว็บยังทำงานปกติทุกอย่าง
 *
 * แนวคิดสำคัญ
 *   เลข 1 2 3 บนการ์ดเป็นเลขตามลำดับที่แสดง ไม่ใช่รหัสถาวร
 *   จึงต้อง "เลือกให้ครบก่อน แล้วลบทีเดียว" เลขจะไม่ขยับระหว่างเลือก
 *   และก่อนลบจริงจะให้ยืนยันด้วย "ชื่อ" ไม่ใช่ "เลข"
 */
(function () {
  'use strict';

  var CONFIG = {
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbx3DyFpClo8GyUpyPQL0VkH0dHO8PODtL_rqnoVFmEFh1VaI0j29jXeBtK8pbM3r6g0Zw/exec',
    HEADING: 'รายชื่อผู้บุกเบิก',
    UNDO_SECONDS: 20,
    MAX_SELECT: 100
  };

  var NS = 'mchr';
  var state = { on: false, phone: '', busy: false, undo: null, undoTimer: null };

  /* ----------------------------- หน้าตา ----------------------------- */

  var CSS = [
    '.' + NS + '-btn{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #d7dce5;background:#fff;color:#28324a;',
    'font-family:inherit;font-size:14px;font-weight:600;padding:8px 16px;border-radius:999px;cursor:pointer;line-height:1.2}',
    '.' + NS + '-btn:hover{background:#f4f6fb;border-color:#b9c2d4}',
    '.' + NS + '-btn.' + NS + '-on{background:#1e3a8a;border-color:#1e3a8a;color:#fff}',

    '.' + NS + '-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',

    '.planter-card.' + NS + '-sel{outline:2.5px solid #2563eb;outline-offset:2px}',
    '.' + NS + '-mode .planter-card{cursor:pointer;position:relative}',
    '.' + NS + '-tick{position:absolute;top:10px;right:10px;width:26px;height:26px;border-radius:8px;border:2px solid #c3cbdb;',
    'background:#fff;display:none;align-items:center;justify-content:center;font-size:16px;color:#fff;font-weight:700;z-index:3}',
    '.' + NS + '-mode .' + NS + '-tick{display:flex}',
    '.planter-card.' + NS + '-sel .' + NS + '-tick{background:#2563eb;border-color:#2563eb}',

    '.' + NS + '-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:99998;background:#101828;color:#fff;',
    'border-radius:16px;box-shadow:0 18px 44px rgba(16,24,40,.34);padding:14px 16px;display:none;gap:10px;align-items:center;',
    'flex-wrap:wrap;max-width:min(940px,calc(100vw - 24px));font-family:inherit;font-size:14px}',
    '.' + NS + '-bar.' + NS + '-show{display:flex}',
    '.' + NS + '-count{font-weight:700;white-space:nowrap}',
    '.' + NS + '-num{flex:1 1 210px;min-width:170px;background:#1d2739;border:1.5px solid #344054;color:#fff;border-radius:10px;',
    'padding:9px 12px;font-family:inherit;font-size:14px;outline:none}',
    '.' + NS + '-num::placeholder{color:#8a94a6}',
    '.' + NS + '-num:focus{border-color:#2563eb}',
    '.' + NS + '-mini{background:transparent;border:1.5px solid #475467;color:#e6eaf2;border-radius:10px;padding:8px 12px;',
    'font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}',
    '.' + NS + '-mini:hover{background:#1d2739}',
    '.' + NS + '-danger{background:#dc2626;border-color:#dc2626;color:#fff}',
    '.' + NS + '-danger:hover{background:#b91c1c}',
    '.' + NS + '-danger:disabled{opacity:.45;cursor:not-allowed}',
    '.' + NS + '-hint{flex-basis:100%;color:#98a2b3;font-size:12.5px;line-height:1.5}',

    '.' + NS + '-ov{position:fixed;inset:0;background:rgba(16,24,40,.62);z-index:99999;display:flex;align-items:center;',
    'justify-content:center;padding:18px;font-family:inherit}',
    '.' + NS + '-modal{background:#fff;color:#101828;border-radius:18px;width:100%;max-width:560px;max-height:88vh;',
    'display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(16,24,40,.3)}',
    '.' + NS + '-head{padding:20px 22px 14px;border-bottom:1px solid #eaecf0}',
    '.' + NS + '-head h3{margin:0 0 6px;font-size:19px;font-weight:800}',
    '.' + NS + '-head p{margin:0;font-size:13.5px;color:#667085;line-height:1.6}',
    '.' + NS + '-list{padding:12px 22px;overflow:auto;flex:1}',
    '.' + NS + '-item{display:flex;gap:10px;padding:9px 0;border-bottom:1px dashed #eaecf0;font-size:14px;line-height:1.5}',
    '.' + NS + '-item:last-child{border-bottom:0}',
    '.' + NS + '-item b{color:#101828}',
    '.' + NS + '-item span{color:#667085;font-size:13px;display:block}',
    '.' + NS + '-no{flex:0 0 28px;height:28px;border-radius:8px;background:#f2f4f7;color:#475467;font-weight:700;',
    'display:flex;align-items:center;justify-content:center;font-size:12.5px}',
    '.' + NS + '-foot{padding:14px 22px 18px;border-top:1px solid #eaecf0;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}',
    '.' + NS + '-foot button{font-family:inherit;font-size:14.5px;font-weight:700;padding:11px 20px;border-radius:11px;cursor:pointer;border:1.5px solid #d0d5dd;background:#fff;color:#344054}',
    '.' + NS + '-foot .' + NS + '-go{background:#dc2626;border-color:#dc2626;color:#fff}',
    '.' + NS + '-foot .' + NS + '-go:disabled{opacity:.6;cursor:not-allowed}',
    '.' + NS + '-warn{margin:10px 22px 0;background:#fef3c7;border:1px solid #fde68a;color:#92400e;border-radius:10px;',
    'padding:10px 12px;font-size:13px;line-height:1.6}',

    '.' + NS + '-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:99999;background:#101828;',
    'color:#fff;border-radius:14px;padding:13px 16px;display:flex;gap:14px;align-items:center;font-family:inherit;font-size:14px;',
    'box-shadow:0 16px 40px rgba(16,24,40,.34);max-width:calc(100vw - 24px)}',
    '.' + NS + '-toast button{background:#fff;color:#101828;border:0;border-radius:9px;padding:8px 14px;font-family:inherit;',
    'font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}',

    '@media(max-width:640px){.' + NS + '-bar{left:12px;right:12px;transform:none;max-width:none}',
    '.' + NS + '-num{flex-basis:100%}}'
  ].join('');

  /* ----------------------------- ตัวช่วย ----------------------------- */

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  }

  function grid() { return document.querySelector('.planter-grid'); }

  /** เฉพาะการ์ดที่ยังแสดงอยู่ การ์ดที่ถูกลบจะถูกซ่อนไว้ ไม่ได้ถอดออกจากหน้า
   *  เพื่อให้กดเลิกทำแล้วเอากลับมาได้ทันทีโดยไม่ต้องรีเฟรช (รีเฟรชแล้วจะหลุดออกจากระบบ) */
  function cards() {
    if (!grid()) return [];
    return Array.prototype.slice.call(grid().querySelectorAll('.planter-card'))
      .filter(function (c) { return !c.classList.contains(NS + '-gone'); });
  }

  function cardInfo(card) {
    function t(sel) {
      var n = card.querySelector(sel);
      return n ? n.textContent.replace(/^[\s\u{1F300}-\u{1FAFF}☀-➿]+/u, '').trim() : '';
    }
    return { name: t('.p-name'), phone: t('.p-phone'), church: t('.p-church') };
  }

  /* ---- ซ่อนรายการที่เคยลบไว้แล้ว ตอนโหลดหน้าใหม่ ----
   * หลังบ้านตัวเดิมไม่รู้จักคอลัมน์ "สถานะการลบ" จึงส่งรายการที่ลบไปแล้วกลับมาด้วยเสมอ
   * ส่วนนี้จึงถามรายการที่ถูกลบแล้วซ่อนการ์ดให้ตรงกัน ถ้าถามไม่สำเร็จจะไม่ซ่อนอะไรเลย */

  function normPhoneKey(s) {
    return String(s || '').replace(/\D/g, '').replace(/^0+/, '');
  }

  function normTextKey(s) {
    return String(s || '').replace(/\s+/g, '').toLowerCase();
  }

  /** การ์ดตรงกับรายการที่ถูกลบหรือไม่
   *  ปกติเทียบด้วยเบอร์คู่กับชื่อ ถ้ารายการนั้นไม่มีเบอร์จึงถอยไปเทียบชื่อคู่กับชื่อคริสตจักร
   *  ตั้งใจให้เข้มไว้ก่อน เพราะซ่อนผิดใบแย่กว่าซ่อนไม่ครบ */
  function matchesDeleted(info, d) {
    var dp = normPhoneKey(d.phone);
    var ip = normPhoneKey(info.phone);
    var dn = normTextKey(d.name);
    var inm = normTextKey(info.name);
    if (dp && ip) return dp === ip && dn === inm;
    return dn === inm && normTextKey(d.church) === normTextKey(info.church);
  }

  function syncDeleted() {
    if (!loginPhone() || !grid()) return;
    api({ action: 'listDeleted' }).then(function (res) {
      if (!res || !res.success || !res.items || !res.items.length) return;
      var all = Array.prototype.slice.call(grid().querySelectorAll('.planter-card'));
      var hidden = 0;
      all.forEach(function (c) {
        if (c.classList.contains(NS + '-gone')) return;
        var info = cardInfo(c);
        for (var i = 0; i < res.items.length; i++) {
          if (matchesDeleted(info, res.items[i])) {
            c.classList.add(NS + '-gone');
            c.style.display = 'none';
            hidden++;
            return;
          }
        }
      });
      if (hidden) {
        renumber();
        updateCount();
      }
    }).catch(function () { /* ถามไม่ได้ก็ไม่ซ่อน ปล่อยให้หน้าเว็บทำงานตามปกติ */ });
  }

  /** ปรับตัวเลขสรุปด้านบนให้ตรงกับจำนวนการ์ดที่แสดงจริง
   *  ไม่งั้นลบไปแล้วการ์ดหายแต่ยอด "พบจริงในระบบ" ยังค้างเลขเดิม ดูแล้วสับสน */
  function updateCount() {
    try {
      var n = cards().length;

      var actual = document.getElementById('stat-actual');
      if (actual) actual.textContent = String(n);

      var capLeft = document.getElementById('progress-caption-left');
      if (capLeft) capLeft.textContent = 'พบจริง ' + n + ' คน';

      var goalEl = document.getElementById('stat-goal');
      var fill = document.getElementById('progress-fill');
      if (goalEl && fill) {
        var goal = parseInt(String(goalEl.textContent).replace(/[^0-9]/g, ''), 10);
        if (goal > 0) {
          var pct = Math.min(100, Math.round((n / goal) * 100));
          fill.style.width = pct + '%';
          if (/%/.test(fill.textContent)) fill.textContent = pct + '%';
        }
      }
    } catch (e) {}
  }

  /**
   * อ่านเบอร์ที่ล็อกอินไว้จากหน้าเว็บเดิม
   * หน้าเว็บเก็บไว้ในตัวแปร currentLoginPhone เป็นหลัก จึงอ่านตัวนั้นก่อนเสมอ
   * และไม่จำค่าไว้ เผื่อผู้ใช้ออกแล้วเข้าใหม่ด้วยเบอร์อื่นในหน้าเดิม
   */
  function loginPhone() {
    // หน้าเว็บเดิมประกาศตัวแปรนี้ไว้ในขอบเขต global แต่ไม่ได้ผูกกับ window
    // จึงต้องอ้างชื่อตรง ๆ ไม่ใช่ window.currentLoginPhone
    try {
      if (typeof currentLoginPhone === 'string' && /\d{8,}/.test(currentLoginPhone)) {
        return currentLoginPhone.replace(/\D/g, '');
      }
    } catch (e) {}
    try {
      if (typeof window.currentLoginPhone === 'string' && /\d{8,}/.test(window.currentLoginPhone)) {
        return window.currentLoginPhone.replace(/\D/g, '');
      }
    } catch (e1) {}
    var keys = ['dp_phone', 'phone', 'loginPhone', 'currentLoginPhone'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var v = localStorage.getItem(keys[i]);
        if (v && /\d{8,}/.test(v)) return v.replace(/\D/g, '');
      } catch (e2) {}
    }
    try {
      var inp = document.querySelector('input[type=tel]');
      if (inp && /\d{8,}/.test(inp.value)) return inp.value.replace(/\D/g, '');
    } catch (e3) {}
    return '';
  }

  function api(body) {
    body.phone = loginPhone();
    return fetch(CONFIG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  /** แปลงข้อความอย่าง "5, 9, 12-18" เป็นรายการเลข */
  function parseNumbers(text, max) {
    var out = [], bad = [];
    String(text || '').split(/[^0-9\-–—]+/).forEach(function (chunk) {
      if (!chunk) return;
      var m = chunk.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
      if (m) {
        var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (a > b) { var t = a; a = b; b = t; }
        for (var i = a; i <= b; i++) { if (i >= 1 && i <= max) out.push(i); else bad.push(i); }
        return;
      }
      var n = parseInt(chunk, 10);
      if (isNaN(n)) return;
      if (n >= 1 && n <= max) out.push(n); else bad.push(n);
    });
    var seen = {}, uniq = [];
    out.forEach(function (n) { if (!seen[n]) { seen[n] = 1; uniq.push(n); } });
    return { list: uniq, bad: bad };
  }

  /* --------------------------- โหมดจัดการ --------------------------- */

  var bar, numInput, countLabel, delBtn, hintLine, toggleBtn;

  function selectedCards() {
    return cards().filter(function (c) { return c.classList.contains(NS + '-sel'); });
  }

  function refresh() {
    var n = selectedCards().length;
    countLabel.textContent = 'เลือกแล้ว ' + n + ' รายการ';
    delBtn.disabled = n === 0 || state.busy;
    delBtn.textContent = n ? 'ลบ ' + n + ' รายการ' : 'ลบที่เลือก';
  }

  function setSelected(card, on) {
    card.classList.toggle(NS + '-sel', !!on);
    var tick = card.querySelector('.' + NS + '-tick');
    if (tick) tick.textContent = on ? '✓' : '';
  }

  function applyNumbers() {
    var list = cards();
    var r = parseNumbers(numInput.value, list.length);
    list.forEach(function (c) { setSelected(c, false); });
    r.list.forEach(function (n) { setSelected(list[n - 1], true); });
    hintLine.textContent = r.bad.length
      ? 'ข้ามเลขที่ไม่มีในรายการ: ' + r.bad.join(', ') + ' (มีทั้งหมด ' + list.length + ' รายการ)'
      : 'พิมพ์เลขได้ เช่น 5, 9, 14 หรือพิมพ์เป็นช่วง เช่น 12-18 · กดที่การ์ดเพื่อเลือกทีละใบก็ได้';
    refresh();
  }

  function enterMode() {
    state.on = true;
    grid().classList.add(NS + '-mode');
    toggleBtn.classList.add(NS + '-on');
    toggleBtn.textContent = '✕ ออกจากโหมดจัดการ';
    cards().forEach(function (c) {
      if (!c.querySelector('.' + NS + '-tick')) c.appendChild(el('div', NS + '-tick', ''));
      setSelected(c, false);
    });
    numInput.value = '';
    bar.classList.add(NS + '-show');
    hintLine.textContent = 'พิมพ์เลขได้ เช่น 5, 9, 14 หรือพิมพ์เป็นช่วง เช่น 12-18 · กดที่การ์ดเพื่อเลือกทีละใบก็ได้';
    refresh();
  }

  function exitMode() {
    state.on = false;
    if (grid()) grid().classList.remove(NS + '-mode');
    toggleBtn.classList.remove(NS + '-on');
    toggleBtn.textContent = '☑ จัดการรายการ';
    cards().forEach(function (c) { setSelected(c, false); });
    bar.classList.remove(NS + '-show');
  }

  /* --------------------------- หน้ายืนยัน --------------------------- */

  function confirmDialog(list, onGo) {
    var ov = el('div', NS + '-ov');
    var modal = el('div', NS + '-modal');

    var head = el('div', NS + '-head');
    var h = el('h3', '', 'ยืนยันการลบ ' + list.length + ' รายการ');
    var p = el('p', '', 'กรุณาตรวจ "ชื่อ" ให้ตรงกับที่ตั้งใจ เพราะหมายเลขบนการ์ดจะเปลี่ยนไปเมื่อมีการลบ ข้อมูลที่ลบจะถูกซ่อนไว้ ทีมงานกู้คืนให้ได้ภายหลัง');
    head.appendChild(h); head.appendChild(p);

    var box = el('div', NS + '-list');
    list.forEach(function (it) {
      var row = el('div', NS + '-item');
      row.appendChild(el('div', NS + '-no', String(it.no)));
      var body = el('div');
      body.appendChild(el('b', '', it.church || '(ไม่ระบุชื่อคริสตจักร)'));
      body.appendChild(el('span', '', it.name + (it.phone ? ' · ' + it.phone : '')));
      row.appendChild(body);
      box.appendChild(row);
    });

    var foot = el('div', NS + '-foot');
    var cancel = el('button', '', 'ย้อนกลับ');
    var go = el('button', NS + '-go', 'ยืนยันลบ');
    foot.appendChild(cancel); foot.appendChild(go);

    modal.appendChild(head); modal.appendChild(box); modal.appendChild(foot);
    ov.appendChild(modal);
    document.body.appendChild(ov);

    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    cancel.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    go.addEventListener('click', function () {
      go.disabled = true; cancel.disabled = true; go.textContent = 'กำลังลบ...';
      onGo(function (errMsg) {
        if (!errMsg) { close(); return; }
        go.disabled = false; cancel.disabled = false; go.textContent = 'ยืนยันลบ';
        var old = modal.querySelector('.' + NS + '-warn');
        if (old) old.parentNode.removeChild(old);
        var w = el('div', NS + '-warn', errMsg);
        modal.insertBefore(w, box);
      });
    });
    return close;
  }

  /* ------------------------------ ลบจริง ------------------------------ */

  function doDelete() {
    var picked = selectedCards();
    if (!picked.length) return;
    if (picked.length > CONFIG.MAX_SELECT) {
      alertBox('เลือกได้สูงสุดครั้งละ ' + CONFIG.MAX_SELECT + ' รายการ');
      return;
    }
    var all = cards();
    var list = picked.map(function (c) {
      var info = cardInfo(c);
      info.no = all.indexOf(c) + 1;
      info.el = c;
      return info;
    });

    confirmDialog(list, function (done) {
      state.busy = true;
      api({
        action: 'deleteChurches',
        targets: list.map(function (i) { return { name: i.name, phone: i.phone, church: i.church }; })
      }).then(function (res) {
        state.busy = false;
        if (!res || !res.success) { done((res && res.message) || 'ลบไม่สำเร็จ กรุณาลองใหม่'); return; }
        done(null);
        list.forEach(function (i) {
          if (!i.el) return;
          i.el.classList.add(NS + '-gone');
          i.el.style.display = 'none';
        });
        renumber();
        updateCount();
        exitMode();
        showUndo(res.deleted, (res.items || []).map(function (x) { return x.uid; }),
          list.map(function (i) { return i.el; }));
      }).catch(function (err) {
        state.busy = false;
        done('เชื่อมต่อไม่สำเร็จ: ' + err);
      });
    });
  }

  function renumber() {
    cards().forEach(function (c, i) {
      var b = c.querySelector('.index-badge');
      if (b) b.textContent = String(i + 1);
    });
  }

  function showUndo(n, uids, els) {
    hideUndo();
    var t = el('div', NS + '-toast');
    t.appendChild(el('span', '', 'ลบแล้ว ' + n + ' รายการ'));
    var btn = el('button', '', 'เลิกทำ');
    t.appendChild(btn);
    document.body.appendChild(t);
    state.undo = t;

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'กำลังกู้คืน...';
      api({ action: 'restoreChurches', uids: uids }).then(function (res) {
        hideUndo();
        if (res && res.success) {
          (els || []).forEach(function (e) {
            if (!e) return;
            e.classList.remove(NS + '-gone');
            e.style.display = '';
          });
          renumber();
          updateCount();
          alertBox('กู้คืน ' + (res.restored || 0) + ' รายการกลับมาแล้ว');
        } else {
          alertBox((res && res.message) || 'กู้คืนไม่สำเร็จ');
        }
      }).catch(function () { hideUndo(); alertBox('กู้คืนไม่สำเร็จ กรุณาลองใหม่'); });
    });

    state.undoTimer = setTimeout(hideUndo, CONFIG.UNDO_SECONDS * 1000);
  }

  function hideUndo() {
    if (state.undoTimer) { clearTimeout(state.undoTimer); state.undoTimer = null; }
    if (state.undo && state.undo.parentNode) state.undo.parentNode.removeChild(state.undo);
    state.undo = null;
  }

  function alertBox(msg) {
    var t = el('div', NS + '-toast');
    t.appendChild(el('span', '', msg));
    var b = el('button', '', 'ปิด');
    t.appendChild(b);
    document.body.appendChild(t);
    b.addEventListener('click', function () { if (t.parentNode) t.parentNode.removeChild(t); });
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 8000);
  }

  /* ------------------------------ ติดตั้ง ------------------------------ */

  function buildBar() {
    bar = el('div', NS + '-bar');
    countLabel = el('span', NS + '-count', 'เลือกแล้ว 0 รายการ');

    numInput = el('input', NS + '-num');
    numInput.type = 'text';
    numInput.placeholder = 'พิมพ์เลขที่ต้องการลบ เช่น 5, 9, 12-18';
    numInput.addEventListener('input', applyNumbers);
    numInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });

    var allBtn = el('button', NS + '-mini', 'เลือกทั้งหมด');
    allBtn.addEventListener('click', function () {
      cards().forEach(function (c) { setSelected(c, true); });
      numInput.value = '1-' + cards().length;
      refresh();
    });

    var clrBtn = el('button', NS + '-mini', 'ล้าง');
    clrBtn.addEventListener('click', function () {
      numInput.value = '';
      cards().forEach(function (c) { setSelected(c, false); });
      refresh();
    });

    delBtn = el('button', NS + '-mini ' + NS + '-danger', 'ลบที่เลือก');
    delBtn.addEventListener('click', doDelete);

    var closeBtn = el('button', NS + '-mini', 'เสร็จสิ้น');
    closeBtn.addEventListener('click', exitMode);

    hintLine = el('div', NS + '-hint', '');

    [countLabel, numInput, allBtn, clrBtn, delBtn, closeBtn, hintLine].forEach(function (x) { bar.appendChild(x); });
    document.body.appendChild(bar);
  }

  function mount() {
    var heads = Array.prototype.slice.call(document.querySelectorAll('.section-title'));
    var head = null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].textContent.indexOf(CONFIG.HEADING) === 0) { head = heads[i]; break; }
    }
    if (!head || !grid()) return false;
    if (document.getElementById(NS + '-toggle')) return true;

    var row = head.parentElement;
    if (row && !row.classList.contains(NS + '-row')) row.classList.add(NS + '-row');

    toggleBtn = el('button', NS + '-btn', '☑ จัดการรายการ');
    toggleBtn.id = NS + '-toggle';
    toggleBtn.type = 'button';
    toggleBtn.addEventListener('click', function () { state.on ? exitMode() : enterMode(); });
    (row || head).appendChild(toggleBtn);

    buildBar();

    grid().addEventListener('click', function (e) {
      if (!state.on) return;
      var card = e.target.closest ? e.target.closest('.planter-card') : null;
      if (!card) return;
      e.preventDefault();
      setSelected(card, !card.classList.contains(NS + '-sel'));
      refresh();
    });

    syncDeleted();
    watchGrid();

    return true;
  }

  /** ถ้าผู้ใช้ออกจากระบบแล้วเข้าใหม่ หน้าเว็บจะสร้างการ์ดชุดใหม่ทั้งหมด
   *  จึงต้องซ่อนรายการที่ถูกลบซ้ำอีกครั้งทุกครั้งที่รายการถูกวาดใหม่ */
  function watchGrid() {
    var g = grid();
    if (!g || g.getAttribute('data-' + NS + '-watch')) return;
    g.setAttribute('data-' + NS + '-watch', '1');
    try {
      var timer = null;
      new MutationObserver(function (muts) {
        var added = false;
        muts.forEach(function (m) { if (m.addedNodes && m.addedNodes.length) added = true; });
        if (!added) return;
        clearTimeout(timer);
        timer = setTimeout(syncDeleted, 400);
      }).observe(g, { childList: true });
    } catch (e) {}
  }

  function init() {
    try {
      var style = el('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      if (mount()) return;
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (mount() || tries > 90) clearInterval(timer);
      }, 1000);

      window.manageChurches = { enter: function () { if (!state.on) enterMode(); }, exit: exitMode };
    } catch (e) {
      if (window.console && console.warn) console.warn('[manage-churches] init failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
