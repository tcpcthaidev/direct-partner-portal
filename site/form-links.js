/*!
 * form-links.js — ต่อลิงก์แบบฟอร์มประเมินผลคริสตจักรให้ Direct Partner แต่ละคน
 * Direct Partner Portal · Thailand Church Planting Training Center
 *
 * ปัญหาที่แก้
 *   เดิมหน้าเว็บเก็บลิงก์ปุ่มประเมินไว้ชุดเดียวใช้ร่วมกันทุกคน (REPORT_FORM_URLS)
 *   และมีกรณีพิเศษของ GCA เขียนแยกไว้ต่างหาก คนอื่นกดแล้วจึงขึ้นว่า "เร็ว ๆ นี้" ทั้งหมด
 *
 * วิธีทำ
 *   หลังเข้าสู่ระบบ ไปอ่านลิงก์ของคนนั้นจากชีต "แบบฟอร์มประเมินและรายงานผลปี2026"
 *   แล้วเขียนค่าลงในอาร์เรย์ REPORT_FORM_URLS ที่หน้าเว็บใช้อยู่แล้ว
 *   ไม่แตะโค้ดปุ่มเดิมเลย ปุ่มยังทำงานด้วยตรรกะเดิมทุกประการ แค่มีลิงก์ให้เปิดแล้ว
 *
 *   ทีมงานเพิ่มหรือแก้ลิงก์ได้เองในสเปรดชีต ไม่ต้องแก้โค้ดและไม่ต้องขึ้นระบบใหม่
 *   ถ้าคนไหนยังไม่มีลิงก์ ปุ่มจะขึ้นว่า "เร็ว ๆ นี้" เหมือนเดิม ไม่มีอะไรพัง
 *
 *   ถ้าช่องเดียวใส่ไว้หลายลิงก์ ระบบจะขึ้นเมนูให้เลือกก่อน คล้ายที่ GCA ใช้อยู่
 *   ส่วนเมนูเดิมของ GCA ยังทำงานเหมือนเดิมทุกอย่าง เพราะลิงก์ของ GCA อยู่คนละคอลัมน์
 */
(function () {
  'use strict';

  var CONFIG = {
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbx3DyFpClo8GyUpyPQL0VkH0dHO8PODtL_rqnoVFmEFh1VaI0j29jXeBtK8pbM3r6g0Zw/exec',
    POLL_MS: 1000,
    MAX_TRIES: 240,
    RETRY_MS: [2000, 5000, 10000, 20000, 30000],  // ถ้าดึงไม่สำเร็จ ให้รอแล้วลองใหม่ตามลำดับนี้
    REFRESH_MIN_MS: 30000,           // กลับมาที่แท็บนี้แล้วดึงใหม่ได้เร็วสุดทุกกี่มิลลิวินาที
    CACHE_KEY: 'mcfl.links.v1'       // ที่เก็บลิงก์ครั้งล่าสุดไว้ในเครื่อง
  };

  var NS = 'mcfl';
  var state = { phone: '', rounds: [[], [], []], busy: false, busyPhone: '', lastFetch: 0 };

  var CSS = [
    '.' + NS + '-ov{position:fixed;inset:0;background:rgba(16,24,40,.62);z-index:99999;display:flex;',
    'align-items:center;justify-content:center;padding:18px;font-family:inherit}',
    '.' + NS + '-modal{background:#fff;color:#101828;border-radius:18px;width:100%;max-width:520px;',
    'max-height:86vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(16,24,40,.3)}',
    '.' + NS + '-head{padding:20px 22px 14px;border-bottom:1px solid #eaecf0}',
    '.' + NS + '-head h3{margin:0 0 6px;font-size:19px;font-weight:800}',
    '.' + NS + '-head p{margin:0;font-size:13px;color:#667085;line-height:1.6}',
    '.' + NS + '-list{padding:10px 16px;overflow:auto;flex:1}',
    '.' + NS + '-item{display:block;width:100%;box-sizing:border-box;text-align:right;background:#fff;',
    'border:1.5px solid #e4e7ec;border-radius:12px;padding:13px 15px;margin:7px 0;cursor:pointer;',
    'font-family:inherit;font-size:15px;font-weight:600;color:#1e3a8a}',
    '.' + NS + '-item:hover{background:#eef2ff;border-color:#93a4f4}',
    '.' + NS + '-foot{padding:12px 22px 18px;border-top:1px solid #eaecf0;display:flex;justify-content:flex-end}',
    '.' + NS + '-foot button{font-family:inherit;font-size:14.5px;font-weight:700;padding:10px 20px;',
    'border-radius:11px;cursor:pointer;border:1.5px solid #d0d5dd;background:#fff;color:#344054}'
  ].join('');

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
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

  function setUrls(rounds) {
    state.rounds = rounds || [[], [], []];
    try {
      if (typeof REPORT_FORM_URLS === 'undefined') return;
      for (var i = 0; i < 3; i++) {
        var list = state.rounds[i] || [];
        REPORT_FORM_URLS[i] = list.length ? list[0].url : '#';
      }
    } catch (e) {}
  }

  function clearUrls() { setUrls([[], [], []]); }

  /* เก็บลิงก์ครั้งล่าสุดของแต่ละเบอร์ไว้ในเครื่อง
     เพราะสคริปต์ฝั่ง Google ถ้าไม่ได้ถูกเรียกมานานจะใช้เวลาตอบกลับถึงครึ่งนาที
     ระหว่างนั้นปุ่มจะขึ้นว่า "เร็ว ๆ นี้" ทั้งที่มีลิงก์แล้ว ผู้ใช้กดรีเฟรชก็ยังไม่ทันเห็น
     จึงเอาของครั้งก่อนขึ้นให้ใช้ได้ทันที แล้วค่อยดึงของจริงมาทับเมื่อได้คำตอบ */
  function cacheRead(phone) {
    try {
      var raw = window.localStorage.getItem(CONFIG.CACHE_KEY);
      if (!raw) return null;
      var all = JSON.parse(raw);
      var hit = all && all[phone];
      return (hit && hit.rounds) ? hit.rounds : null;
    } catch (e) { return null; }
  }

  function cacheWrite(phone, rounds) {
    try {
      var raw = window.localStorage.getItem(CONFIG.CACHE_KEY);
      var all = raw ? JSON.parse(raw) : {};
      if (!all || typeof all !== 'object') all = {};
      all[phone] = { rounds: rounds, at: Date.now() };
      window.localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  function chooser(list) {
    var ov = el('div', NS + '-ov');
    var modal = el('div', NS + '-modal');

    var head = el('div', NS + '-head');
    head.appendChild(el('h3', '', 'เลือกแบบฟอร์มที่ต้องการ'));
    head.appendChild(el('p', '', 'กลุ่มของท่านมีแบบฟอร์มมากกว่าหนึ่งชุด กรุณาเลือกชุดที่ต้องการกรอก'));
    modal.appendChild(head);

    var box = el('div', NS + '-list');
    list.forEach(function (item, i) {
      var b = el('button', NS + '-item', item.name || ('แบบฟอร์มชุดที่ ' + (i + 1)));
      b.type = 'button';
      b.addEventListener('click', function () {
        window.open(item.url, '_blank');
        close();
      });
      box.appendChild(b);
    });
    modal.appendChild(box);

    var foot = el('div', NS + '-foot');
    var btnClose = el('button', '', 'ปิด');
    btnClose.type = 'button';
    foot.appendChild(btnClose);
    modal.appendChild(foot);

    ov.appendChild(modal);
    document.body.appendChild(ov);

    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    btnClose.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  }

  /* ดึงลิงก์ของเบอร์นี้ ถ้าพลาดให้ลองใหม่อีกสองสามครั้ง
     จำเป็นเพราะ Apps Script ที่ไม่ได้ถูกเรียกมาสักพักจะตอบช้าหรือตอบไม่ใช่ JSON ในครั้งแรก
     ถ้าปล่อยให้พลาดเงียบ ๆ ผู้ใช้จะเห็นปุ่มขึ้นว่า "เร็ว ๆ นี้" ทั้งที่ในสเปรดชีตมีลิงก์อยู่แล้ว */
  function fetchLinks(phone, attempt) {
    attempt = attempt || 0;
    if (attempt === 0 && state.busy && state.busyPhone === phone) return;
    state.busy = true;
    state.busyPhone = phone;
    state.lastFetch = Date.now();

    fetch(CONFIG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'formLinks', phone: phone })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (loginPhone() !== phone) { state.busy = false; return; }   // ผู้ใช้เปลี่ยนไปแล้วระหว่างรอ
      if (res && res.success) {
        state.busy = false;
        setUrls(res.rounds);
        cacheWrite(phone, res.rounds);
        return;
      }
      again(phone, attempt);
    }).catch(function () {
      again(phone, attempt);
    });
  }

  function again(phone, attempt) {
    var delay = CONFIG.RETRY_MS[attempt];
    if (delay === undefined || loginPhone() !== phone) {
      state.busy = false;                          // หมดโควตาแล้วก็ปล่อยเป็น "เร็ว ๆ นี้" ตามเดิม
      return;
    }
    setTimeout(function () { fetchLinks(phone, attempt + 1); }, delay);
  }

  function init() {
    try {
      var style = el('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      /* ถ้าครั้งไหนมีหลายลิงก์ ให้ขึ้นเมนูเลือกแทนการเปิดลิงก์แรกเงียบ ๆ
         ดักในจังหวะ capture เพื่อให้ทำงานก่อนตัวจัดการเดิมของหน้าเว็บ */
      document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.btn-report') : null;
        if (!btn) return;
        var idx = parseInt(btn.getAttribute('data-form-idx'), 10);
        if (isNaN(idx)) return;
        var list = state.rounds[idx] || [];
        if (list.length > 1) {
          e.preventDefault();
          e.stopImmediatePropagation();
          chooser(list);
        }
      }, true);

      /* ถ้าทีมงานเพิ่งใส่ลิงก์ในสเปรดชีตขณะที่ผู้ใช้เปิดหน้านี้ค้างไว้ พอกลับมาที่แท็บนี้ให้ดึงใหม่
         ผู้ใช้จึงไม่ต้องรีเฟรชเองก็เห็นลิงก์ใหม่ */
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) return;
        var p = loginPhone();
        if (!p || p !== state.phone) return;
        if (Date.now() - state.lastFetch < CONFIG.REFRESH_MIN_MS) return;
        fetchLinks(p);
      });

      /* ปลุกสคริปต์ฝั่ง Google ตั้งแต่ตอนเปิดหน้าเว็บ ระหว่างที่ผู้ใช้ยังพิมพ์เบอร์อยู่
         พอเข้าสู่ระบบเสร็จ คำขอจริงจะได้ไม่ต้องรอเครื่องบูตอีกรอบ */
      try { fetch(CONFIG.ENDPOINT, { method: 'GET' }).catch(function () {}); } catch (e0) {}

      var tries = 0;
      setInterval(function () {
        tries++;
        if (tries > CONFIG.MAX_TRIES) return;
        var p = loginPhone();
        if (p === state.phone) return;
        state.phone = p;
        var cached = p ? cacheRead(p) : null;
        if (cached) setUrls(cached); else clearUrls();
        if (p) fetchLinks(p);
      }, CONFIG.POLL_MS);
    } catch (e) {
      if (window.console && console.warn) console.warn('[form-links] init failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
