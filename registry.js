/*!
 * registry.js — ทะเบียนผู้บุกเบิกกลาง: ให้ผู้นำ/ผู้ช่วยตรวจและยืนยันรายชื่อในเครือของตน
 * Direct Partner Portal · Thailand Church Planting Training Center
 *
 * ใช้ backend เดิม (WEBAPP_URL) กับ action ใหม่: rosterGet / rosterAction
 * ผู้นำยืนยันได้ทันที ส่วนแก้ไข / ไม่ใช่ของฉัน / เพิ่มคน จะเป็น "คำขอ" ให้เจ้าหน้าที่ตรวจก่อน
 */
(function () {
  'use strict';

  var NS = 'reg';
  var state = { data: null, loading: false, filter: 'all', q: '', busy: false };

  var CSS = [
    '.view-tab.registry{background:#0f9d58;color:#fff;}',
    '#registry-container{margin-top:4px;}',
    '.reg-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px;}',
    '.reg-sum .c{background:#fff;border:1.5px solid var(--card-border);border-radius:16px;padding:14px 16px;}',
    '.reg-sum .n{font-size:1.7rem;font-weight:800;line-height:1.1;}',
    '.reg-sum .l{font-size:0.78rem;color:var(--text-mute);margin-top:2px;}',
    '.reg-sum .c.ok .n{color:#0f9d58;} .reg-sum .c.wait .n{color:#d97706;} .reg-sum .c.r2 .n{color:#2a2ae0;}',
    '.reg-bar{height:14px;border-radius:10px;background:#eef1f7;overflow:hidden;margin:2px 0 6px 0;}',
    '.reg-bar>div{height:100%;background:linear-gradient(90deg,#0f9d58,#1ec8a5);border-radius:10px;transition:width .3s;}',
    '.reg-cap{font-size:0.8rem;color:var(--text-mute);margin-bottom:16px;}',
    '.reg-help{background:#f0fdf4;border:1.5px solid #bbf7d0;color:#14532d;border-radius:14px;padding:12px 16px;font-size:0.85rem;line-height:1.7;margin-bottom:16px;}',
    '.reg-help b{color:#052e16;}',
    '.reg-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px;}',
    '.reg-tools input{flex:1 1 220px;min-width:180px;padding:10px 14px;border-radius:12px;border:1.5px solid var(--card-border);font-family:inherit;font-size:0.9rem;}',
    '.reg-chip{border:1.5px solid var(--card-border);background:#fff;border-radius:999px;padding:7px 14px;font-family:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;color:#334155;}',
    '.reg-chip.on{background:#1c1c3a;border-color:#1c1c3a;color:#fff;}',
    '.reg-btn{border:none;border-radius:999px;padding:9px 16px;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;white-space:nowrap;}',
    '.reg-btn:disabled{opacity:.5;cursor:default;}',
    '.reg-btn.g{background:#0f9d58;color:#fff;} .reg-btn.b{background:linear-gradient(90deg,#2ec5e0,#2a5be0);color:#fff;}',
    '.reg-btn.o{background:#fff;border:1.5px solid #cbd5e1;color:#334155;} .reg-btn.r{background:#fff;border:1.5px solid #fecaca;color:#b91c1c;}',
    '.reg-btn.sm{padding:6px 12px;font-size:0.76rem;}',
    '.reg-h{font-weight:700;font-size:1rem;margin:22px 0 10px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
    '.reg-h small{font-weight:500;color:var(--text-mute);font-size:0.8rem;}',
    '.reg-list{display:flex;flex-direction:column;gap:10px;}',
    '.reg-row{background:#fff;border:1.5px solid var(--card-border);border-radius:16px;padding:12px 16px;display:grid;grid-template-columns:1fr auto;gap:8px 14px;align-items:center;}',
    '.reg-row.ok{border-color:#86efac;background:#f7fef9;}',
    '.reg-row.pend{border-color:#fdba74;background:#fffaf3;}',
    '.reg-row.guess{border-color:#a5b4fc;background:#f5f7ff;}',
    '.reg-row .who{min-width:0;}',
    '.reg-row .nm{font-weight:700;font-size:0.95rem;}',
    '.reg-row .id{font-size:0.7rem;color:#94a3b8;font-weight:600;margin-left:6px;}',
    '.reg-row .ch{font-size:0.85rem;color:var(--blue);font-weight:600;}',
    '.reg-row .ph{font-size:0.78rem;color:var(--text-mute);}',
    '.reg-row .tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}',
    '.reg-tag{font-size:0.7rem;font-weight:600;border-radius:999px;padding:3px 9px;background:#f1f5f9;color:#475569;}',
    '.reg-tag.y{background:#dcfce7;color:#166534;} .reg-tag.n{background:#fee2e2;color:#991b1b;} .reg-tag.w{background:#ffedd5;color:#9a3412;} .reg-tag.i{background:#e0e7ff;color:#3730a3;}',
    '.reg-row .act{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}',
    '.reg-row .st{grid-column:1 / -1;font-size:0.74rem;color:var(--text-mute);}',
    '@media (max-width:640px){.reg-row{grid-template-columns:1fr;} .reg-row .act{justify-content:flex-start;}}',
    '.reg-empty{text-align:center;padding:26px 10px;color:var(--text-mute);background:#fff;border:1.5px dashed var(--card-border);border-radius:16px;}',
    '.reg-note{font-size:0.78rem;color:var(--text-mute);margin-top:6px;}',
    '.reg-ov{position:fixed;inset:0;background:rgba(16,24,40,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;}',
    '.reg-modal{background:#fff;border-radius:20px;max-width:480px;width:100%;padding:24px 24px 18px 24px;max-height:92vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,.25);}',
    '.reg-modal h3{margin:0 0 4px 0;font-size:1.1rem;} .reg-modal .sub{font-size:0.82rem;color:var(--text-mute);margin-bottom:14px;line-height:1.6;}',
    '.reg-modal label{display:block;font-size:0.8rem;font-weight:600;margin:10px 0 4px 0;}',
    '.reg-modal input,.reg-modal textarea{width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--card-border);font-family:inherit;font-size:0.9rem;}',
    '.reg-modal textarea{min-height:70px;resize:vertical;}',
    '.reg-modal .msg{min-height:20px;font-size:0.82rem;margin-top:10px;font-weight:600;}',
    '.reg-modal .msg.err{color:#b91c1c;} .reg-modal .msg.ok{color:#0f9d58;}',
    '.reg-modal .btns{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;}',
    '.reg-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#101828;color:#fff;padding:12px 18px;border-radius:12px;font-size:0.88rem;z-index:10000;box-shadow:0 12px 30px rgba(0,0,0,.3);max-width:92vw;}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById(NS + '-css')) return;
    var s = document.createElement('style');
    s.id = NS + '-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function thDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/.exec(String(s || ''));
    if (!m) return s || '';
    return Number(m[3]) + ' ' + TH_MONTHS[Number(m[2]) - 1] + ' ' + String(Number(m[1]) + 543).slice(-2) + (m[4] ? ' ' + m[4] + ' น.' : '');
  }

  function phone() { try { return (typeof currentLoginPhone === 'string' && currentLoginPhone) ? currentLoginPhone : ''; } catch (x) { return ''; } }
  function cid() { try { return getClientId(); } catch (x) { return ''; } }
  function api(action, payload) {
    var body = Object.assign({ action: action, phone: phone(), clientId: cid() }, payload || {});
    return fetch(WEBAPP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'reg-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  }

  function box() {
    var c = document.getElementById('registry-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'registry-container';
      c.style.display = 'none';
      var after = document.getElementById('round1-container') || document.getElementById('planter-container');
      if (after && after.parentNode) after.parentNode.insertBefore(c, after.nextSibling);
      else document.body.appendChild(c);
    }
    return c;
  }

  /* ----------------------------- โหลดข้อมูล ----------------------------- */

  function load(force) {
    var c = box();
    if (state.data && !force) { render(); return; }
    if (state.loading) return;
    state.loading = true;
    if (!state.data) c.innerHTML = '<div class="r1-empty">กำลังโหลดทะเบียนผู้บุกเบิก… (ครั้งแรกอาจใช้เวลา 10–20 วินาที เพราะระบบตรวจรายงานครั้งที่ 2 ให้ด้วย)</div>';
    api('rosterGet').then(function (res) {
      state.loading = false;
      if (!res || !res.success) { c.innerHTML = '<div class="r1-empty">' + e((res && res.message) || 'โหลดข้อมูลไม่สำเร็จ') + '</div>'; return; }
      state.data = res;
      render();
    }).catch(function (err) {
      state.loading = false;
      c.innerHTML = '<div class="r1-empty">เชื่อมต่อไม่สำเร็จ: ' + e(err.message || err) + ' <button class="reg-btn o sm" id="reg-retry">ลองใหม่</button></div>';
      var b = document.getElementById('reg-retry');
      if (b) b.onclick = function () { load(true); };
    });
  }

  /* ----------------------------- แสดงผล ----------------------------- */

  function isOk(it) { return it.confirm === 'ยืนยันแล้ว'; }
  function isPend(it) { return String(it.confirm).indexOf('แจ้ง') === 0; }
  function sent(s) { return String(s || '').indexOf('ส่งแล้ว') === 0; }

  function counts(items) {
    var c = { all: items.length, ok: 0, wait: 0, pend: 0, r2: 0, nor2: 0, guess: 0 };
    items.forEach(function (it) {
      if (isOk(it)) c.ok++; else if (isPend(it)) c.pend++; else c.wait++;
      if (sent(it.r2)) c.r2++; else c.nor2++;
      if (it.status === 'คาดว่าเป็นของผู้นำนี้') c.guess++;
    });
    return c;
  }

  function match(it) {
    var f = state.filter;
    if (f === 'wait' && (isOk(it) || isPend(it))) return false;
    if (f === 'ok' && !isOk(it)) return false;
    if (f === 'pend' && !isPend(it)) return false;
    if (f === 'nor2' && sent(it.r2)) return false;
    if (state.q) {
      var q = state.q.toLowerCase();
      if ((it.name + ' ' + it.church + ' ' + it.phone + ' ' + it.id).toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  }

  function rowHtml(it) {
    var cls = isOk(it) ? 'ok' : isPend(it) ? 'pend' : (it.status === 'คาดว่าเป็นของผู้นำนี้' ? 'guess' : '');
    var tags = [];
    if (it.status === 'คาดว่าเป็นของผู้นำนี้') tags.push('<span class="reg-tag i">ระบบคาดว่าอยู่ในเครือของคุณ</span>');
    tags.push(sent(it.r1) ? '<span class="reg-tag y">รายงานครั้งที่ 1 ✓</span>' : '<span class="reg-tag">รายงานครั้งที่ 1 —</span>');
    tags.push(sent(it.r2) ? '<span class="reg-tag y" title="' + e(it.r2) + '">รายงานครั้งที่ 2 ✓ ' + e(it.r2.replace(/^ส่งแล้ว\s*/, '')) + '</span>' : '<span class="reg-tag n">ยังไม่ส่งรายงานครั้งที่ 2</span>');
    if (/^(ทีมงานเพิ่มเอง)/.test(it.source)) tags.push('<span class="reg-tag w" title="ชื่อนี้ไม่ได้มาจากฟอร์มลงทะเบียน">ไม่มีใบลงทะเบียน</span>');

    var act;
    if (isOk(it)) {
      act = '<button class="reg-btn o sm" data-a="unconfirm" data-id="' + e(it.id) + '">ยกเลิกยืนยัน</button>' +
        '<button class="reg-btn o sm" data-a="edit" data-id="' + e(it.id) + '">✏ แจ้งแก้ไข</button>';
    } else if (isPend(it)) {
      act = '<span class="reg-tag w">' + e(it.confirm) + '</span>';
    } else {
      act = '<button class="reg-btn g sm" data-a="confirm" data-id="' + e(it.id) + '">✔ ยืนยัน</button>' +
        '<button class="reg-btn o sm" data-a="edit" data-id="' + e(it.id) + '">✏ แจ้งแก้ไข</button>' +
        '<button class="reg-btn r sm" data-a="notmine" data-id="' + e(it.id) + '">✖ ไม่ใช่ของฉัน</button>';
    }
    var st = '';
    if (isOk(it)) st = 'ยืนยันโดย ' + e(it.confirmBy) + ' · ' + e(thDate(it.confirmAt));
    else if (isPend(it)) st = 'แจ้งโดย ' + e(it.confirmBy) + ' · ' + e(thDate(it.confirmAt)) + (it.leaderNote ? ' · “' + e(it.leaderNote) + '”' : '');

    return '<div class="reg-row ' + cls + '">' +
      '<div class="who"><div class="nm">' + e(it.name || '(ไม่มีชื่อ)') + '<span class="id">' + e(it.id) + '</span></div>' +
      '<div class="ch">' + e(it.church || '-') + '</div>' +
      (it.phone ? '<div class="ph">โทร ' + e(it.phone) + '</div>' : '') +
      '<div class="tags">' + tags.join('') + '</div></div>' +
      '<div class="act">' + act + '</div>' +
      (st ? '<div class="st">' + st + '</div>' : '') + '</div>';
  }

  function render() {
    var c = box();
    var d = state.data;
    if (!d) return;
    var items = d.items || [];
    var k = counts(items);
    var goal = Number(d.goal) || 0;
    var pct = k.all ? Math.round(k.ok * 100 / k.all) : 0;

    var h = '';
    h += '<div class="reg-sum">' +
      '<div class="c"><div class="n">' + (goal || '-') + '</div><div class="l">เป้าหมาย (MOU)</div></div>' +
      '<div class="c"><div class="n">' + k.all + '</div><div class="l">รายชื่อในทะเบียน</div></div>' +
      '<div class="c ok"><div class="n">' + k.ok + '</div><div class="l">ยืนยันแล้ว</div></div>' +
      '<div class="c wait"><div class="n">' + k.wait + '</div><div class="l">รอคุณยืนยัน</div></div>' +
      '<div class="c r2"><div class="n">' + k.r2 + '</div><div class="l">ส่งรายงานครั้งที่ 2 แล้ว</div></div>' +
      '</div>';
    h += '<div class="reg-bar"><div style="width:' + pct + '%"></div></div>' +
      '<div class="reg-cap">ยืนยันแล้ว ' + k.ok + ' จาก ' + k.all + ' คน (' + pct + '%)' + (k.pend ? ' · ส่งคำขอถึงเจ้าหน้าที่แล้ว ' + k.pend + ' คน' : '') +
      (goal && k.all < goal ? ' · ยังขาดจากเป้าหมาย ' + (goal - k.all) + ' คน' : '') + '</div>';

    h += '<div class="reg-help"><b>วิธีใช้:</b> ตรวจทีละชื่อว่าเป็นผู้บุกเบิกในเครือข่ายของคุณจริงหรือไม่ ' +
      '· ถูกต้องกด <b>✔ ยืนยัน</b> · ชื่อ/เบอร์/คริสตจักรผิดกด <b>✏ แจ้งแก้ไข</b> · ไม่ใช่คนในเครือกด <b>✖ ไม่ใช่ของฉัน</b> ' +
      '· มีคนที่ยังไม่อยู่ในรายชื่อกด <b>➕ เพิ่มคนที่ขาด</b><br>รายชื่อชุดนี้คือ <b>ทะเบียนกลาง</b> ที่ TCPC ใช้นับจำนวนผู้บุกเบิกและติดตามรายงาน ' +
      'การแก้ไข/เพิ่ม/ลบ เจ้าหน้าที่จะตรวจก่อนปรับในทะเบียน</div>';

    if (d.isAssistant) h += '<div class="reg-note" style="margin:-6px 0 12px 0">คุณเข้าในฐานะ <b>' + e(d.who) + '</b> — การยืนยันจะบันทึกชื่อของคุณไว้</div>';

    h += '<div class="reg-tools">' +
      '<input id="reg-q" placeholder="ค้นหาชื่อ คริสตจักร เบอร์ หรือรหัส" value="' + e(state.q) + '">' +
      '<button class="reg-btn b" data-a="add">➕ เพิ่มคนที่ขาด</button>' +
      '<button class="reg-btn o" data-a="reload" title="โหลดข้อมูลล่าสุด">↻ รีเฟรช</button></div>';
    var chips = [['all', 'ทั้งหมด', k.all], ['wait', 'รอยืนยัน', k.wait], ['ok', 'ยืนยันแล้ว', k.ok], ['pend', 'ส่งคำขอแล้ว', k.pend], ['nor2', 'ยังไม่ส่งรายงานครั้งที่ 2', k.nor2]];
    h += '<div class="reg-tools">' + chips.map(function (x) {
      return '<button class="reg-chip' + (state.filter === x[0] ? ' on' : '') + '" data-f="' + x[0] + '">' + x[1] + ' (' + x[2] + ')</button>';
    }).join('') + '</div>';

    var shown = items.filter(match);
    var waitShown = shown.filter(function (it) { return !isOk(it) && !isPend(it); });
    h += '<div class="reg-h">ผู้บุกเบิกในทะเบียนของคุณ <small>แสดง ' + shown.length + ' คน</small>' +
      (waitShown.length > 1 ? '<button class="reg-btn g sm" data-a="confirmAll">✔ ยืนยันทุกคนที่แสดงและยังไม่ยืนยัน (' + waitShown.length + ')</button>' : '') + '</div>';
    if (!items.length) h += '<div class="reg-empty">ยังไม่มีรายชื่อในทะเบียนของคุณ — กด ➕ เพิ่มคนที่ขาด เพื่อส่งรายชื่อให้เจ้าหน้าที่</div>';
    else if (!shown.length) h += '<div class="reg-empty">ไม่พบรายชื่อตามตัวกรองนี้</div>';
    else h += '<div class="reg-list">' + shown.map(rowHtml).join('') + '</div>';

    var miss = d.r2Missing || [];
    if (miss.length) {
      h += '<div class="reg-h">⚠️ ส่งรายงานครั้งที่ 2 แล้ว แต่ยังไม่มีในทะเบียน <small>' + miss.length + ' รายการ — ถ้าเป็นคนในเครือของคุณ กดขอเพิ่มเข้าทะเบียน</small></div><div class="reg-list">';
      miss.forEach(function (m, i) {
        h += '<div class="reg-row pend"><div class="who"><div class="nm">' + e(m.name || '(ไม่ได้ระบุชื่อ)') + '</div>' +
          '<div class="ch">' + e(m.church || '-') + '</div><div class="ph">ส่งรายงานเมื่อ ' + e(thDate(m.at)) + (m.host ? ' · Host: ' + e(m.host) : '') + '</div></div>' +
          '<div class="act"><button class="reg-btn b sm" data-a="addFromReport" data-i="' + i + '">➕ ขอเพิ่มเข้าทะเบียน</button></div></div>';
      });
      h += '</div>';
    }

    var reqs = d.requests || [];
    if (reqs.length) {
      h += '<div class="reg-h">คำขอที่ส่งถึงเจ้าหน้าที่ <small>' + reqs.length + ' รายการล่าสุด</small></div><div class="reg-list">';
      reqs.forEach(function (q) {
        var tag = q.status === 'รอตรวจ' ? 'w' : (q.status.indexOf('อนุมัติ') === 0 ? 'y' : 'n');
        var what = q.type === 'เพิ่มคนใหม่' ? (q.name + ' · ' + q.church) : (q.id + ' ' + q.before);
        var change = q.type === 'แก้ไขข้อมูล' ? [q.name, q.phone, q.church].filter(Boolean).join(' · ') : '';
        h += '<div class="reg-row"><div class="who"><div class="nm">' + e(q.type) + '<span class="id">' + e(q.no) + '</span></div>' +
          '<div class="ph">' + e(what) + '</div>' + (change ? '<div class="ph">ขอเปลี่ยนเป็น: ' + e(change) + '</div>' : '') +
          (q.note ? '<div class="ph">รายละเอียด: ' + e(q.note) + '</div>' : '') +
          (q.staffNote ? '<div class="ph"><b>เจ้าหน้าที่:</b> ' + e(q.staffNote) + '</div>' : '') +
          '<div class="ph">ส่งโดย ' + e(q.by) + ' · ' + e(thDate(q.at)) + '</div></div>' +
          '<div class="act"><span class="reg-tag ' + tag + '">' + e(q.status) + '</span></div></div>';
      });
      h += '</div>';
    }

    h += '<div class="reg-note" style="margin-top:18px">สถานะรายงานครั้งที่ 2 ' +
      (d.hasR2Source ? 'อัปเดตจากแบบฟอร์ม Church Planter อัตโนมัติ' + (d.r2SyncedAt ? ' (ล่าสุด ' + e(thDate(d.r2SyncedAt)) + ')' : '') : 'ยังไม่ได้เชื่อมกับแบบฟอร์มของเครือข่ายนี้') +
      (d.syncNote ? ' · ' + e(d.syncNote) : '') + '</div>';

    c.innerHTML = h;
    var qi = document.getElementById('reg-q');
    if (qi) {
      qi.addEventListener('input', function () {
        state.q = qi.value.trim();
        var pos = qi.selectionStart;
        render();
        var n = document.getElementById('reg-q');
        if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} }
      });
    }
  }

  /* ----------------------------- การกระทำ ----------------------------- */

  function findItem(id) { return (state.data.items || []).filter(function (x) { return x.id === id; })[0]; }

  function run(op, data, okMsg) {
    if (state.busy) return Promise.resolve(null);
    state.busy = true;
    document.body.style.cursor = 'progress';
    return api('rosterAction', { op: op, data: data }).then(function (res) {
      state.busy = false;
      document.body.style.cursor = '';
      if (res && res.success) {
        state.data = res;
        render();
        toast(res.message || okMsg || 'บันทึกแล้ว');
      }
      return res;
    }).catch(function (err) {
      state.busy = false;
      document.body.style.cursor = '';
      return { success: false, message: 'เชื่อมต่อไม่สำเร็จ: ' + (err.message || err) };
    });
  }

  function modal(opts) {
    var ov = document.createElement('div');
    ov.className = 'reg-ov';
    var fields = (opts.fields || []).map(function (f) {
      return '<label>' + e(f.label) + '</label>' + (f.area ? '<textarea data-k="' + f.k + '" placeholder="' + e(f.ph || '') + '">' + e(f.v || '') + '</textarea>'
        : '<input data-k="' + f.k + '" value="' + e(f.v || '') + '" placeholder="' + e(f.ph || '') + '"' + (f.tel ? ' type="tel"' : '') + '>');
    }).join('');
    ov.innerHTML = '<div class="reg-modal"><h3>' + e(opts.title) + '</h3><div class="sub">' + (opts.sub || '') + '</div>' + fields +
      '<div class="msg"></div><div class="btns"><button class="reg-btn o" data-x="cancel">ยกเลิก</button>' +
      '<button class="reg-btn ' + (opts.danger ? 'r' : 'g') + '" data-x="ok">' + e(opts.okText || 'ส่ง') + '</button></div></div>';
    document.body.appendChild(ov);
    var msgEl = ov.querySelector('.msg');
    var okBtn = ov.querySelector('[data-x="ok"]');
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener('click', function (ev) { if (ev.target === ov) close(); });
    ov.querySelector('[data-x="cancel"]').onclick = close;
    okBtn.onclick = function () {
      var vals = {};
      ov.querySelectorAll('[data-k]').forEach(function (el) { vals[el.getAttribute('data-k')] = el.value.trim(); });
      var err = opts.validate ? opts.validate(vals) : '';
      if (err) { msgEl.className = 'msg err'; msgEl.textContent = err; return; }
      okBtn.disabled = true;
      msgEl.className = 'msg';
      msgEl.textContent = 'กำลังบันทึก…';
      opts.submit(vals, function (res) {
        okBtn.disabled = false;
        if (res && res.success) { close(); return; }
        msgEl.className = 'msg err';
        msgEl.textContent = (res && res.message) || 'บันทึกไม่สำเร็จ';
        if (res && res.duplicate && opts.onDuplicate) { okBtn.textContent = 'ยืนยันว่าเป็นคนละคน ส่งคำขอ'; opts.onDuplicate(); }
      });
    };
    var first = ov.querySelector('[data-k]');
    if (first) first.focus();
  }

  function openEdit(it) {
    modal({
      title: 'แจ้งแก้ไขข้อมูล', okText: 'ส่งคำขอแก้ไข',
      sub: '<b>' + e(it.id) + '</b> · ' + e(it.name) + ' · ' + e(it.church) + '<br>กรอกเฉพาะช่องที่ต้องการแก้ เจ้าหน้าที่จะตรวจแล้วปรับในทะเบียน',
      fields: [
        { k: 'name', label: 'ชื่อ-นามสกุลที่ถูกต้อง', v: it.name },
        { k: 'phone', label: 'เบอร์โทรที่ถูกต้อง', v: it.phone, tel: true },
        { k: 'church', label: 'ชื่อคริสตจักรที่ถูกต้อง', v: it.church },
        { k: 'note', label: 'รายละเอียดเพิ่มเติม (เช่น เปลี่ยนตัวผู้บุกเบิก)', area: true }
      ],
      validate: function (v) {
        if (v.name === it.name && v.phone === it.phone && v.church === it.church && !v.note) return 'ยังไม่ได้แก้ไขข้อมูลใดเลย';
        return '';
      },
      submit: function (v, done) {
        run('edit', {
          id: it.id,
          name: v.name !== it.name ? v.name : '',
          phone: v.phone !== it.phone ? v.phone : '',
          church: v.church !== it.church ? v.church : '',
          note: v.note
        }).then(done);
      }
    });
  }

  function openNotMine(it) {
    modal({
      title: 'แจ้งว่าไม่ใช่ผู้บุกเบิกในเครือของคุณ', okText: 'แจ้งเจ้าหน้าที่', danger: true,
      sub: '<b>' + e(it.id) + '</b> · ' + e(it.name) + ' · ' + e(it.church) + '<br>เจ้าหน้าที่จะย้ายไปผู้นำที่ถูกต้อง หรือนำออกจากทะเบียน',
      fields: [{ k: 'note', label: 'เหตุผล / ทราบไหมว่าอยู่ในเครือของใคร', area: true, ph: 'เช่น อยู่กับเครือข่าย ... / เลิกบุกเบิกแล้ว / ชื่อซ้ำกับ P-...' }],
      validate: function (v) { return v.note ? '' : 'กรุณาระบุเหตุผลสั้นๆ'; },
      submit: function (v, done) { run('notmine', { id: it.id, note: v.note }).then(done); }
    });
  }

  function openAdd(pre) {
    var force = false;
    modal({
      title: 'เพิ่มผู้บุกเบิกที่ยังไม่อยู่ในทะเบียน', okText: 'ส่งคำขอเพิ่ม',
      sub: 'ระบบจะส่งคำขอให้เจ้าหน้าที่ตรวจ และตรวจชื่อ/เบอร์ซ้ำกับทะเบียนทั้งหมดให้อัตโนมัติ',
      fields: [
        { k: 'name', label: 'ชื่อ-นามสกุลผู้บุกเบิก *', v: pre && pre.name },
        { k: 'phone', label: 'เบอร์โทรผู้บุกเบิก (ช่วยกันชื่อซ้ำ)', tel: true },
        { k: 'church', label: 'ชื่อคริสตจักร/กลุ่มที่บุกเบิก *', v: pre && pre.church },
        { k: 'note', label: 'หมายเหตุ (จังหวัด/อำเภอ หรือข้อมูลอื่น)', area: true }
      ],
      validate: function (v) { return (!v.name || !v.church) ? 'กรุณากรอกชื่อผู้บุกเบิกและชื่อคริสตจักร' : ''; },
      onDuplicate: function () { force = true; },
      submit: function (v, done) {
        run('add', { name: v.name, phone: v.phone, church: v.church, note: v.note, fromReport: !!pre, force: force }).then(done);
      }
    });
  }

  function confirmBox(title, sub, okText, fn) {
    modal({ title: title, sub: sub, okText: okText, fields: [], submit: function (v, done) { fn().then(done); } });
  }

  function onClick(ev) {
    var c = document.getElementById('registry-container');
    if (!c || !c.contains(ev.target) || !state.data) return;
    var chip = ev.target.closest('[data-f]');
    if (chip) { state.filter = chip.getAttribute('data-f'); render(); return; }
    var b = ev.target.closest('[data-a]');
    if (!b) return;
    var a = b.getAttribute('data-a'), id = b.getAttribute('data-id');
    var it = id ? findItem(id) : null;
    if (a === 'reload') { load(true); return; }
    if (a === 'add') { openAdd(null); return; }
    if (a === 'addFromReport') { openAdd((state.data.r2Missing || [])[Number(b.getAttribute('data-i'))]); return; }
    if (!it && a !== 'confirmAll') return;
    if (a === 'confirm') { b.disabled = true; run('confirm', { ids: [it.id] }); return; }
    if (a === 'unconfirm') { b.disabled = true; run('unconfirm', { ids: [it.id] }); return; }
    if (a === 'edit') { openEdit(it); return; }
    if (a === 'notmine') { openNotMine(it); return; }
    if (a === 'confirmAll') {
      var ids = (state.data.items || []).filter(match).filter(function (x) { return !isOk(x) && !isPend(x); }).map(function (x) { return x.id; });
      confirmBox('ยืนยันทั้งหมด ' + ids.length + ' คน?',
        'ยืนยันว่าทุกคนที่แสดงอยู่ตอนนี้ (และยังไม่ยืนยัน) เป็นผู้บุกเบิกในเครือข่ายของคุณ ข้อมูลถูกต้อง<br>ถ้าไม่แน่ใจบางคน ให้ยืนยันทีละคนแทน',
        'ยืนยัน ' + ids.length + ' คน', function () { return run('confirm', { ids: ids }); });
    }
  }

  /* ----------------------------- เชื่อมกับหน้าเดิม ----------------------------- */

  window.PlanterRegistry = {
    show: function () { injectCss(); box().style.display = 'block'; load(false); },
    hide: function () { var c = document.getElementById('registry-container'); if (c) c.style.display = 'none'; },
    reset: function () { state = { data: null, loading: false, filter: 'all', q: '', busy: false }; var c = document.getElementById('registry-container'); if (c) { c.innerHTML = ''; c.style.display = 'none'; } }
  };

  injectCss();
  document.addEventListener('click', onClick);
})();
