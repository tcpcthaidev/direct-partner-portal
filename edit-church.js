/*!
 * edit-church.js — แก้ไขชื่อคริสตจักรและที่อยู่ได้เองจากหน้าเว็บ
 * Direct Partner Portal · Thailand Church Planting Training Center
 *
 * ทำงานเสริมบนหน้าเว็บเดิม ไม่แก้โครงสร้างเดิม ถ้าไฟล์นี้พังหน้าเว็บยังใช้ได้ครบทุกอย่าง
 *
 * แนวคิดสำคัญ
 *   ตำบล อำเภอ จังหวัด เป็น "เมนูเลือก" ไม่ใช่ช่องพิมพ์อิสระ
 *   เพราะถ้าปล่อยให้พิมพ์เอง อีกไม่นานจะมีทั้ง กทม / กรุงเทพ / กรุงเทพมหานคร ปนกัน
 *   จนสรุปยอดรายจังหวัดไม่ได้ ส่วนชื่อคริสตจักรยังพิมพ์อิสระเพราะเป็นชื่อเฉพาะ
 *
 *   ค่าเดิมที่ไม่ตรงกับรายการมาตรฐานจะไม่ถูกทิ้ง แต่ใส่ไว้เป็นตัวเลือกพร้อมกำกับว่าเป็นค่าเดิม
 *   ผู้ใช้จึงเลือกเก็บไว้เหมือนเดิมได้ ไม่ถูกบังคับให้เปลี่ยน
 */
(function () {
  'use strict';

  var CONFIG = {
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbx3DyFpClo8GyUpyPQL0VkH0dHO8PODtL_rqnoVFmEFh1VaI0j29jXeBtK8pbM3r6g0Zw/exec',
    GEO_URL: 'thai-geo.js',
    HEADING: 'รายชื่อผู้บุกเบิก',
    MAX_LEN: 120
  };

  var NS = 'mced';
  var cache = { items: null, itemsAt: 0, geo: null, geoLoading: null };

  /* ----------------------------- หน้าตา ----------------------------- */

  var CSS = [
    // มุมซ้ายบนมีเลขลำดับอยู่แล้ว จึงวางปุ่มไว้มุมขวาบน และซ่อนตอนเข้าโหมดเลือกลบเพื่อไม่ให้ชนกับช่องติ๊ก
    '.' + NS + '-pen{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:9px;border:1.5px solid #dfe3ea;',
    'background:#fff;color:#475467;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;',
    'padding:0;z-index:2;box-shadow:0 1px 2px rgba(16,24,40,.06)}',
    '.' + NS + '-pen:hover{background:#eef2ff;border-color:#93a4f4;color:#1e3a8a}',
    '.planter-card{position:relative}',
    '.mchr-mode .' + NS + '-pen{display:none}',

    '.' + NS + '-ov{position:fixed;inset:0;background:rgba(16,24,40,.62);z-index:99999;display:flex;align-items:center;',
    'justify-content:center;padding:18px;font-family:inherit}',
    '.' + NS + '-modal{background:#fff;color:#101828;border-radius:18px;width:100%;max-width:520px;max-height:90vh;',
    'display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(16,24,40,.3)}',
    '.' + NS + '-head{padding:20px 22px 14px;border-bottom:1px solid #eaecf0}',
    '.' + NS + '-head h3{margin:0 0 6px;font-size:19px;font-weight:800}',
    '.' + NS + '-head p{margin:0;font-size:13px;color:#667085;line-height:1.6}',
    '.' + NS + '-body{padding:16px 22px;overflow:auto;flex:1}',
    '.' + NS + '-f{margin-bottom:14px}',
    '.' + NS + '-f label{display:block;font-size:13.5px;font-weight:700;margin-bottom:6px;color:#344054}',
    '.' + NS + '-f input,.' + NS + '-f select{width:100%;box-sizing:border-box;font-family:inherit;font-size:15px;',
    'padding:10px 12px;border:1.5px solid #d0d5dd;border-radius:10px;background:#fff;color:#101828;outline:none}',
    '.' + NS + '-f input:focus,.' + NS + '-f select:focus{border-color:#2563eb}',
    '.' + NS + '-f select:disabled{background:#f2f4f7;color:#98a2b3}',
    '.' + NS + '-hint{font-size:12.5px;color:#667085;margin-top:5px;line-height:1.5}',
    '.' + NS + '-msg{margin:0 22px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;border-radius:10px;',
    'padding:10px 12px;font-size:13px;line-height:1.6;display:none}',
    '.' + NS + '-msg.' + NS + '-on{display:block}',
    '.' + NS + '-foot{padding:14px 22px 18px;border-top:1px solid #eaecf0;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}',
    '.' + NS + '-foot button{font-family:inherit;font-size:14.5px;font-weight:700;padding:11px 20px;border-radius:11px;',
    'cursor:pointer;border:1.5px solid #d0d5dd;background:#fff;color:#344054}',
    '.' + NS + '-foot .' + NS + '-go{background:#1e3a8a;border-color:#1e3a8a;color:#fff}',
    '.' + NS + '-foot button:disabled{opacity:.55;cursor:not-allowed}',

    '.' + NS + '-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:99999;background:#101828;',
    'color:#fff;border-radius:14px;padding:13px 18px;font-family:inherit;font-size:14px;',
    'box-shadow:0 16px 40px rgba(16,24,40,.34);max-width:calc(100vw - 24px)}'
  ].join('');

  /* ----------------------------- ตัวช่วย ----------------------------- */

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  }

  function grid() { return document.querySelector('.planter-grid'); }

  function normPhoneKey(s) {
    return String(s || '').replace(/\D/g, '').replace(/^0+/, '');
  }

  function normTextKey(s) {
    return String(s || '').replace(/\s+/g, '').toLowerCase();
  }

  function cardInfo(card) {
    function t(sel) {
      var n = card.querySelector(sel);
      return n ? n.textContent.replace(/^[\s\u{1F300}-\u{1FAFF}☀-➿]+/u, '').trim() : '';
    }
    return { name: t('.p-name'), phone: t('.p-phone'), church: t('.p-church') };
  }

  /** อ่านเบอร์ที่ล็อกอินไว้ หน้าเว็บเดิมเก็บไว้ในตัวแปร global ที่ไม่ได้ผูกกับ window */
  function loginPhone() {
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

  function toast(msg) {
    var t = el('div', NS + '-toast', msg);
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4000);
  }

  /* ------------------- ข้อมูลรายการและข้อมูลเขตการปกครอง ------------------- */

  /** ดึงรายชื่อพร้อมรหัสรายการและที่อยู่จากเซิร์ฟเวอร์ เก็บไว้ใช้ซ้ำภายในสองนาที
   *  ต้องใช้ค่าจากเซิร์ฟเวอร์ ไม่ใช่จากหน้าจอ เพราะต้องส่งกลับไปเทียบว่าข้อมูลยังไม่ถูกใครแก้ */
  function loadItems(force) {
    if (!force && cache.items && (Date.now() - cache.itemsAt) < 120000) {
      return Promise.resolve(cache.items);
    }
    return api({ action: 'listChurches' }).then(function (res) {
      if (!res || !res.success) throw new Error((res && res.message) || 'ดึงข้อมูลไม่สำเร็จ');
      cache.items = res.items || [];
      cache.itemsAt = Date.now();
      return cache.items;
    });
  }

  /** โหลดรายชื่อจังหวัด-อำเภอ-ตำบล แบบโหลดเมื่อใช้จริงเท่านั้น จะได้ไม่ถ่วงตอนเปิดหน้าเว็บ */
  function loadGeo() {
    if (cache.geo) return Promise.resolve(cache.geo);
    if (cache.geoLoading) return cache.geoLoading;

    cache.geoLoading = new Promise(function (resolve) {
      if (window.THAI_GEO) { cache.geo = window.THAI_GEO; resolve(cache.geo); return; }
      var s = document.createElement('script');
      s.src = CONFIG.GEO_URL;
      s.onload = function () { cache.geo = window.THAI_GEO || null; resolve(cache.geo); };
      s.onerror = function () { resolve(null); };   // โหลดไม่ได้ก็ถอยไปใช้ช่องพิมพ์แทน
      document.head.appendChild(s);
    });
    return cache.geoLoading;
  }

  function findItem(items, card) {
    var info = cardInfo(card);
    var ip = normPhoneKey(info.phone);
    var inm = normTextKey(info.name);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var dp = normPhoneKey(it.phone);
      if (dp && ip) { if (dp === ip && normTextKey(it.name) === inm) return it; }
      else if (normTextKey(it.name) === inm && normTextKey(it.church) === normTextKey(info.church)) return it;
    }
    return null;
  }

  /* ----------------------------- กล่องแก้ไข ----------------------------- */

  function option(value, label, selected) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    if (selected) o.selected = true;
    return o;
  }

  /** เติมตัวเลือกลงเมนู พร้อมพา "ค่าเดิม" ที่ไม่มีในรายการมาตรฐานติดมาด้วย ไม่ทิ้งข้อมูลเดิมของใคร */
  function fill(sel, list, current, placeholder) {
    sel.innerHTML = '';
    sel.appendChild(option('', placeholder, !current));
    var has = false;
    list.forEach(function (name) {
      if (name === current) has = true;
      sel.appendChild(option(name, name, name === current));
    });
    if (current && !has) {
      sel.appendChild(option(current, current + '  (ค่าเดิมในระบบ)', true));
    }
    sel.disabled = false;
  }

  function openDialog(card, item, geo) {
    var ov = el('div', NS + '-ov');
    var modal = el('div', NS + '-modal');

    var head = el('div', NS + '-head');
    head.appendChild(el('h3', '', 'แก้ไขข้อมูลคริสตจักร'));
    head.appendChild(el('p', '', 'ผู้บุกเบิก: ' + item.name + (item.phone ? ' · ' + item.phone : '')));
    modal.appendChild(head);

    var msg = el('div', NS + '-msg');
    modal.appendChild(msg);

    var body = el('div', NS + '-body');

    // ชื่อคริสตจักร — เป็นชื่อเฉพาะ จึงพิมพ์อิสระ
    var fChurch = el('div', NS + '-f');
    fChurch.appendChild(el('label', '', 'ชื่อคริสตจักร'));
    var iChurch = document.createElement('input');
    iChurch.type = 'text';
    iChurch.maxLength = CONFIG.MAX_LEN;
    iChurch.value = item.churchAt || item.church || '';
    fChurch.appendChild(iChurch);
    body.appendChild(fChurch);

    function selField(labelText, hintText) {
      var f = el('div', NS + '-f');
      f.appendChild(el('label', '', labelText));
      var s = document.createElement('select');
      f.appendChild(s);
      if (hintText) f.appendChild(el('div', NS + '-hint', hintText));
      body.appendChild(f);
      return s;
    }

    var sProv, sAmp, sTam, iProv, iAmp, iTam;

    if (geo && geo.length) {
      sProv = selField('จังหวัด', 'เลือกจังหวัดก่อน แล้วอำเภอกับตำบลจะขึ้นให้เลือกตามจังหวัดนั้น');
      sAmp = selField('อำเภอ / เขต');
      sTam = selField('ตำบล / แขวง');

      var provNames = geo.map(function (p) { return p[0]; });
      fill(sProv, provNames, item.province || '', '— ไม่ระบุ —');

      function amphuresOf(prov) {
        for (var i = 0; i < geo.length; i++) if (geo[i][0] === prov) return geo[i][1];
        return [];
      }
      function tambonsOf(prov, amp) {
        var list = amphuresOf(prov);
        for (var i = 0; i < list.length; i++) if (list[i][0] === amp) return list[i][1];
        return [];
      }

      function refreshAmp(keepCurrent) {
        var prov = sProv.value;
        var names = amphuresOf(prov).map(function (a) { return a[0]; });
        fill(sAmp, names, keepCurrent ? (item.amphoe || '') : '', '— ไม่ระบุ —');
        refreshTam(keepCurrent);
      }
      function refreshTam(keepCurrent) {
        var names = tambonsOf(sProv.value, sAmp.value);
        fill(sTam, names, keepCurrent ? (item.tambon || '') : '', '— ไม่ระบุ —');
      }

      refreshAmp(true);
      sProv.addEventListener('change', function () { refreshAmp(false); });
      sAmp.addEventListener('change', function () { refreshTam(false); });
    } else {
      // โหลดรายชื่อเขตการปกครองไม่ได้ ให้พิมพ์เองแทน ดีกว่าแก้ไม่ได้เลย
      function textField(labelText, value) {
        var f = el('div', NS + '-f');
        f.appendChild(el('label', '', labelText));
        var i = document.createElement('input');
        i.type = 'text';
        i.maxLength = CONFIG.MAX_LEN;
        i.value = value || '';
        f.appendChild(i);
        body.appendChild(f);
        return i;
      }
      iProv = textField('จังหวัด', item.province);
      iAmp = textField('อำเภอ / เขต', item.amphoe);
      iTam = textField('ตำบล / แขวง', item.tambon);
      body.appendChild(el('div', NS + '-hint', 'โหลดรายชื่อจังหวัดไม่สำเร็จ จึงให้พิมพ์เองชั่วคราว'));
    }

    modal.appendChild(body);

    var foot = el('div', NS + '-foot');
    var btnCancel = el('button', '', 'ยกเลิก');
    var btnSave = el('button', NS + '-go', 'บันทึก');
    foot.appendChild(btnCancel);
    foot.appendChild(btnSave);
    modal.appendChild(foot);

    ov.appendChild(modal);
    document.body.appendChild(ov);
    iChurch.focus();

    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    btnCancel.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    function warn(text) {
      msg.textContent = text;
      msg.classList.add(NS + '-on');
    }

    btnSave.addEventListener('click', function () {
      var next = {
        church: iChurch.value.trim(),
        province: sProv ? sProv.value : (iProv ? iProv.value.trim() : ''),
        amphoe: sAmp ? sAmp.value : (iAmp ? iAmp.value.trim() : ''),
        tambon: sTam ? sTam.value : (iTam ? iTam.value.trim() : '')
      };

      if (!next.church) { warn('กรุณากรอกชื่อคริสตจักร'); iChurch.focus(); return; }

      btnSave.disabled = true;
      btnCancel.disabled = true;
      btnSave.textContent = 'กำลังบันทึก...';
      msg.classList.remove(NS + '-on');

      api({
        action: 'updateChurch',
        uid: item.uid,
        expect: {
          church: item.churchAt || item.church || '',
          tambon: item.tambon || '',
          amphoe: item.amphoe || '',
          province: item.province || ''
        },
        fields: next
      }).then(function (res) {
        btnSave.disabled = false;
        btnCancel.disabled = false;
        btnSave.textContent = 'บันทึก';

        if (!res || !res.success) {
          warn((res && res.message) || 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
          if (res && res.stale) cache.items = null;   // ให้ดึงค่าล่าสุดใหม่รอบหน้า
          return;
        }

        // อัปเดตหน้าจอให้ตรงกับที่บันทึกไป โดยไม่ต้องรีเฟรช (รีเฟรชแล้วจะหลุดออกจากระบบ)
        var cn = card.querySelector('.p-church');
        if (cn) cn.textContent = next.church;
        var loc = card.querySelector('.p-loc');
        if (loc) loc.textContent = [next.tambon, next.amphoe, next.province].join(' / ');

        item.churchAt = next.church;
        item.church = next.church;
        item.tambon = next.tambon;
        item.amphoe = next.amphoe;
        item.province = next.province;

        close();
        toast(res.updated ? 'บันทึกการแก้ไขแล้ว' : 'ข้อมูลเดิมไม่มีอะไรเปลี่ยน');
      }).catch(function (err) {
        btnSave.disabled = false;
        btnCancel.disabled = false;
        btnSave.textContent = 'บันทึก';
        warn('เชื่อมต่อไม่สำเร็จ: ' + err);
      });
    });
  }

  /* ----------------------------- ติดปุ่ม ----------------------------- */

  function onPenClick(card, btn) {
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '…';

    Promise.all([loadItems(false), loadGeo()]).then(function (out) {
      btn.disabled = false;
      btn.textContent = label;

      var item = findItem(out[0] || [], card);
      if (!item) {
        toast('ไม่พบรายการนี้ในระบบ อาจถูกลบไปแล้ว กรุณารีเฟรชหน้าเว็บ');
        cache.items = null;
        return;
      }
      openDialog(card, item, out[1]);
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = label;
      toast('เปิดหน้าแก้ไขไม่สำเร็จ: ' + err);
    });
  }

  function decorate() {
    var g = grid();
    if (!g || !loginPhone()) return;
    Array.prototype.slice.call(g.querySelectorAll('.planter-card')).forEach(function (card) {
      if (card.querySelector('.' + NS + '-pen')) return;
      var btn = el('button', NS + '-pen', '✎');
      btn.type = 'button';
      btn.title = 'แก้ไขชื่อคริสตจักรและที่อยู่';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        onPenClick(card, btn);
      });
      card.appendChild(btn);
    });
  }

  /** รายการถูกวาดใหม่ทุกครั้งที่เข้าสู่ระบบ จึงต้องติดปุ่มใหม่ทุกครั้งเช่นกัน */
  function watch() {
    var g = grid();
    if (!g || g.getAttribute('data-' + NS + '-watch')) return;
    g.setAttribute('data-' + NS + '-watch', '1');
    try {
      var timer = null;
      new MutationObserver(function (muts) {
        var added = false;
        muts.forEach(function (m) { if (m.addedNodes && m.addedNodes.length) added = true; });
        if (!added) return;
        cache.items = null;
        clearTimeout(timer);
        timer = setTimeout(decorate, 300);
      }).observe(g, { childList: true });
    } catch (e) {}
  }

  function init() {
    try {
      var style = el('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (grid() && loginPhone()) { decorate(); watch(); }
        if (tries > 120) clearInterval(timer);
      }, 1000);
    } catch (e) {
      if (window.console && console.warn) console.warn('[edit-church] init failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
