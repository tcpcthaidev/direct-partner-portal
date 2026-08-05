/*!
 * api-retry.js — ลองเรียกใหม่อัตโนมัติเมื่อ Google ตอบกลับมาไม่ใช่ JSON
 * Direct Partner Portal · Thailand Church Planting Training Center
 *
 * ปัญหาที่แก้
 *   บางครั้ง Apps Script ตอบกลับเป็นหน้า HTML แทนที่จะเป็นข้อมูล JSON
 *   (มักเกิดตอนสคริปต์ไม่ได้ถูกเรียกมาสักพักแล้วต้องปลุกเครื่องขึ้นมาใหม่)
 *   หน้าเว็บจะขึ้นข้อความว่า Unexpected token '<' ทั้งที่จริงแล้วแค่ลองใหม่ก็ผ่าน
 *
 * วิธีทำ
 *   ห่อ window.fetch ไว้อีกชั้น ถ้าคำตอบไม่ได้ขึ้นต้นด้วย { หรือ [ ให้รอแล้วลองใหม่เงียบ ๆ
 *   ไม่แก้โค้ดเดิมของหน้าเว็บเลยแม้แต่บรรทัดเดียว ถ้าไฟล์นี้โหลดไม่ได้ทุกอย่างทำงานเหมือนเดิม
 *
 * ข้อควรระวังที่ออกแบบไว้แล้ว
 *   คำสั่งที่ "ทำซ้ำแล้วเกิดของใหม่" เช่น เพิ่มคริสตจักร หรือ ส่งเรื่องแจ้งปัญหา จะไม่ลองซ้ำเด็ดขาด
 *   เพราะถ้าคำสั่งแรกถึงเซิร์ฟเวอร์แล้วจริง แต่คำตอบหล่นหาย การลองใหม่จะได้ข้อมูลซ้ำสองรายการ
 *   จึงลองซ้ำเฉพาะคำสั่งที่ทำกี่ครั้งผลก็เท่าเดิม (อ่านข้อมูล / ลบ / กู้คืน)
 */
(function () {
  'use strict';

  var CONFIG = {
    MATCH: /script\.google\.com\/macros\//,
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1200,

    // บางครั้งคำขอค้างไม่ตอบกลับเลย ถ้าไม่กำหนดเวลาไว้ ปุ่มจะขึ้นว่า "กำลังลบ..." ค้างตลอดไป
    ATTEMPT_TIMEOUT_MS: 20000,   // รอคำตอบต่อหนึ่งครั้งไม่เกินเท่านี้
    TOTAL_DEADLINE_MS: 45000,    // รวมทุกครั้งแล้วไม่เกินเท่านี้ แล้วค่อยแจ้งผู้ใช้ว่าไม่สำเร็จ

    // คำสั่งที่ปลอดภัยจะลองซ้ำ ทำกี่ครั้งผลลัพธ์ก็เหมือนเดิม
    SAFE_ACTIONS: [
      'checkLogin',        // แค่อ่านข้อมูลมาแสดง
      'listChurches',      // อ่านรายชื่อ
      'listDeleted',       // อ่านรายการที่ถูกลบ
      'deleteChurches',    // เขียนคำว่า "ลบแล้ว" ทับค่าเดิม ทำซ้ำได้ผลเท่าเดิม
      'restoreChurches'    // ล้างค่าในช่องเดิม ทำซ้ำได้ผลเท่าเดิม
    ]
  };

  try {
    if (window.__apiRetryInstalled) return;
    var original = window.fetch;
    if (typeof original !== 'function') return;
    window.__apiRetryInstalled = true;

    function wait(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    /** อ่านชื่อคำสั่งจาก body ที่กำลังจะส่ง ถ้าอ่านไม่ได้ให้ถือว่าไม่ปลอดภัย */
    function actionOf(init) {
      try {
        if (!init || typeof init.body !== 'string') return '';
        var parsed = JSON.parse(init.body);
        return String(parsed && parsed.action || '');
      } catch (e) {
        return '';
      }
    }

    function isSafe(action) {
      if (!action) return false;
      for (var i = 0; i < CONFIG.SAFE_ACTIONS.length; i++) {
        if (CONFIG.SAFE_ACTIONS[i] === action) return true;
      }
      return false;
    }

    function looksLikeJson(text) {
      var c = String(text || '').trim().charAt(0);
      return c === '{' || c === '[';
    }

    /** สร้างคำตอบใหม่จากข้อความที่อ่านมาแล้ว เพื่อให้โค้ดเดิมเรียก .json() ได้ตามปกติ */
    function rebuild(text, res) {
      try {
        return new Response(text, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers
        });
      } catch (e) {
        return res;
      }
    }

    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var self = this;

      if (!CONFIG.MATCH.test(url) || !isSafe(actionOf(init))) {
        return original.apply(self, arguments);
      }

      var deadline = Date.now() + CONFIG.TOTAL_DEADLINE_MS;
      var giveUp = false;

      /** ยิงหนึ่งครั้งพร้อมจับเวลา ถ้าเกินกำหนดให้ยกเลิกคำขอนั้นทิ้ง
       *  ยกเลิกได้อย่างปลอดภัยเพราะคำสั่งที่เข้าเงื่อนไขลองซ้ำล้วนทำกี่ครั้งผลก็เท่าเดิม */
      function once() {
        var ctrl = null;
        var opts = init || {};
        try {
          ctrl = new AbortController();
          opts = {};
          for (var k in (init || {})) { if (Object.prototype.hasOwnProperty.call(init, k)) opts[k] = init[k]; }
          opts.signal = ctrl.signal;
        } catch (e) { ctrl = null; }

        var timer = ctrl ? setTimeout(function () {
          try { ctrl.abort(); } catch (e2) {}
        }, CONFIG.ATTEMPT_TIMEOUT_MS) : null;

        return original.call(self, input, opts).then(function (res) {
          if (timer) clearTimeout(timer);
          return res;
        }, function (err) {
          if (timer) clearTimeout(timer);
          throw err;
        });
      }

      function attempt(n) {
        if (Date.now() >= deadline) giveUp = true;

        return once().then(function (res) {
          return res.clone().text().then(function (text) {
            if (looksLikeJson(text) || n >= CONFIG.MAX_ATTEMPTS || giveUp) return rebuild(text, res);
            if (window.console && console.info) {
              console.info('[api-retry] คำตอบไม่ใช่ JSON กำลังลองใหม่ครั้งที่ ' + (n + 1));
            }
            return wait(CONFIG.DELAY_MS).then(function () { return attempt(n + 1); });
          }, function () {
            return res;
          });
        }, function (err) {
          if (n >= CONFIG.MAX_ATTEMPTS || Date.now() >= deadline) {
            throw new Error('เซิร์ฟเวอร์ไม่ตอบกลับภายในเวลาที่กำหนด กรุณาลองใหม่อีกครั้ง');
          }
          if (window.console && console.info) {
            console.info('[api-retry] คำขอล้มเหลวหรือใช้เวลานานเกินไป กำลังลองใหม่ครั้งที่ ' + (n + 1));
          }
          return wait(CONFIG.DELAY_MS).then(function () { return attempt(n + 1); });
        });
      }

      return attempt(1);
    };
  } catch (e) {
    if (window.console && console.warn) console.warn('[api-retry] ติดตั้งไม่สำเร็จ:', e);
  }
})();
