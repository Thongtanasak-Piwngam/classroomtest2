/* ClassRoom – ระบบจัดการชั้นเรียน (ครู / นักเรียน)
   ฐานข้อมูล: Google Sheets ผ่าน Apps Script */

// ===== ตั้งค่า: ใส่ URL เว็บแอปของ Apps Script ตรงนี้ที่เดียว =====
// ต้องขึ้นต้นด้วย https://script.google.com/macros/s/ และลงท้ายด้วย /exec
const API_URL = 'https://script.google.com/macros/s/AKfycbzTYOg54v3AXqPzHIABbhgsy7ioOE-vpidgfK9UeTt_eg5VvxyuqINifQj_jZMD9lqI/exec';

// ===================================================================
// ฟังก์ชันช่วยเหลือ
// ===================================================================
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// ===================================================================
// ตัวแปรสถานะของแอป
//   db = ข้อมูลที่ดึงจาก Google Sheets, me = ผู้ใช้ที่ล็อกอิน, cur = ห้องที่เปิดอยู่
//   draft = ค่าที่ครูกำลังแก้แต่ยังไม่กดบันทึก (เช็กส่งงาน / คะแนน)
// ===================================================================
let wmode = 'sub', dirty = false, draft = {}, db = { users: [], classes: [] }, me = null, cur = null, tab = 'stu', msg = '', deletedIds = [], busy = 0, cred = null, lastJson = '', statusText = '';
// ===================================================================
// สื่อสารกับ Google Apps Script (ฐานข้อมูล)
// ===================================================================
function setStatus(t) { statusText = t; const x = document.getElementById('st'); if (x)
    x.textContent = t; }
async function api(a, d) { const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ a, u: cred.u, p: cred.p, d }) }); return r.json(); }
function applyData(x) { if (x.error)
    return false; me = x.me; db = x; return true; }
function saveData() {
    if (!me || me.role !== 'teacher')
        return;
    busy++;
    setStatus('⏳ กำลังบันทึก...');
    api('save', { classes: db.classes.filter(c => c.owner === me.u), del: deletedIds.splice(0) }).then(() => { busy--; setStatus('🟢 บันทึกแล้ว'); }).catch(() => { busy--; setStatus('⚠ บันทึกไม่สำเร็จ'); });
}
const nameOf = u => (db.users.find(x => x.u === u) || { name: u }).name;
const getClass = id => db.classes.find(c => c.id === id);
const readInput = id => document.getElementById(id).value.trim();
const gradeOf = p => p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : 'F';
function calcStudent(c, u) { let s = 0, m = 0, n = 0; c.works.forEach(w => { if (w.sub[u])
    n++; const v = w.score[u]; if (v !== undefined && v !== '') {
    s += +v;
    m += +w.max;
} }); const p = m ? s / m * 100 : 0; return { s, m, n, p, g: m ? gradeOf(p) : '-' }; }
// ===================================================================
// วาดหน้าจอ
// ===================================================================
function render() {
    const a = document.getElementById('app');
    if (cur && me && !getClass(cur))
        cur = null;
    if (!me) {
        a.innerHTML = loginView();
        return;
    }
    a.innerHTML = `<header><div class="wrap"><b>🎓 ClassRoom</b><span class="tag">${me.role === 'teacher' ? 'ครู' : 'นักเรียน'}</span><span class="sp"></span><span class="mu" id="st">${statusText}</span><span class="mu">${esc(me.name)}</span><button class="g" onclick="logout()">ออกจากระบบ</button></div></header><div class="wrap">${me.role === 'teacher' ? (cur ? renderTeacherDetail() : renderTeacherClasses()) : (cur ? renderStudentDetail() : renderStudentClasses())}</div>`;
}
// ===================================================================
// เข้าสู่ระบบ / ออกจากระบบ
// ===================================================================
function loginView() { return `<div class="wrap"><div class="card login"><h2>🎓 ClassRoom</h2><p class="mu">เข้าสู่ระบบด้วยรหัสที่ครูหรือโรงเรียนกำหนดให้</p>${msg ? `<p class="no">${esc(msg)}</p>` : ''}<div class="row"><input id="lu" placeholder="รหัสผู้ใช้ / รหัสนักเรียน" style="width:100%"></div><div class="row"><input id="lp" type="password" placeholder="รหัสผ่าน" style="width:100%" onkeydown="if(event.key==='Enter')doLogin()"></div><button style="width:100%" onclick="doLogin()">เข้าสู่ระบบ</button></div></div>`; }
async function doLogin() {
    cred = { u: readInput('lu'), p: document.getElementById('lp').value };
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(API_URL)) {
        msg = 'ยังไม่ได้ใส่ URL ของ Apps Script ที่ถูกต้องในไฟล์ app.js (ต้องลงท้ายด้วย /exec)';
        cred = null;
        render();
        return;
    }
    setStatus('');
    try {
        const x = await api('load');
        if (applyData(x)) {
            msg = '';
            try {
                sessionStorage.setItem('cred', JSON.stringify(cred));
            }
            catch (_) { }
            cur = null;
            lastJson = JSON.stringify(x);
            render();
        }
        else {
            msg = 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
            cred = null;
            render();
        }
    }
    catch (_) {
        msg = 'เชื่อมต่อฐานข้อมูลไม่ได้ (ตรวจ URL ของ Apps Script)';
        cred = null;
        render();
    }
}
function logout() { me = null; cur = null; cred = null; try {
    sessionStorage.removeItem('cred');
}
catch (_) { } render(); }
// ===================================================================
// ฝั่งครู: รายการห้องเรียน เพิ่ม/ลบห้อง
// ===================================================================
function renderTeacherClasses() {
    const L = db.classes.filter(c => c.owner === me.u);
    return `<div class="card"><h3>➕ เพิ่มชั้นเรียน</h3><div class="row"><input id="cs" placeholder="วิชา เช่น คณิตศาสตร์"><input id="cr" placeholder="ห้อง เช่น ม.1/1"><button onclick="addClass()">เพิ่มห้อง</button></div></div>
<h3>ชั้นเรียนของฉัน (${L.length})</h3>${L.length ? '' : '<p class="mu">ยังไม่มีชั้นเรียน</p>'}
<div class="grid">${L.map(c => `<div class="card cl" onclick="cur='${c.id}';tab='stu';render()"><h3>${esc(c.subject)}</h3><span class="tag">ห้อง ${esc(c.room)}</span><p class="mu">👥 ${c.students.length} คน · 📝 ${c.works.length} งาน</p><button class="d" onclick="event.stopPropagation();deleteClass('${c.id}')">🗑 ลบห้อง</button></div>`).join('')}</div>`;
}
function addClass() { const s = readInput('cs'), r = readInput('cr'); if (!s || !r)
    return; db.classes.push({ id: uid(), owner: me.u, subject: s, room: r, code: Math.random().toString(36).slice(2, 8).toUpperCase(), students: [], ann: [], works: [] }); saveData(); render(); }
function deleteClass(id) { if (confirm('ลบชั้นเรียนนี้และข้อมูลทั้งหมด?')) {
    deletedIds.push(id);
    db.classes = db.classes.filter(c => c.id !== id);
    saveData();
    render();
} }
// ===================================================================
// ฝั่งครู: ภายในห้อง (4 แท็บ)
// ===================================================================
function renderTeacherDetail() {
    const c = getClass(cur);
    const tabs = [['stu', '👥 นักเรียน'], ['work', '📝 งานและคะแนน'], ['ann', '📢 ประกาศ'], ['sum', '📊 สรุปผล']];
    return `<p><button class="g" onclick="if(confirmDiscard()){cur=null;render()}">← กลับ</button></p><h2>${esc(c.subject)} <span class="tag">ห้อง ${esc(c.room)}</span></h2>
<div class="tabs">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" onclick="if(confirmDiscard()){tab='${t[0]}';render()}">${t[1]}</button>`).join('')}</div>${{ stu: tabStudents, work: tabWorks, ann: tabAnnouncements, sum: tabSummary }[tab](c)}`;
}
// --- แท็บ: นักเรียน ---
function tabStudents(c) {
    const free = db.users.filter(u => u.role === 'student' && !c.students.includes(u.u));
    return `<div class="card"><h3>เพิ่มนักเรียนเข้าห้อง</h3><div class="row"><select id="ps"><option value="">— เลือกนักเรียนที่มีบัญชี —</option>${free.map(u => `<option value="${u.u}">${esc(u.name)} (${u.u})</option>`).join('')}</select><button onclick="addStudent()">เพิ่ม</button></div>
<p class="mu">บัญชีนักเรียนและรหัสผ่านจัดการในชีต Users ของ Google Sheets</p></div>
<div class="card tw"><h3>รายชื่อนักเรียน (${c.students.length})</h3><table><tr><th>#</th><th>ชื่อ</th><th>ผู้ใช้</th><th></th></tr>${c.students.map((u, i) => `<tr><td>${i + 1}</td><td>${esc(nameOf(u))}</td><td>${u}</td><td><button class="d" onclick="removeStudent('${u}')">นำออก</button></td></tr>`).join('') || '<tr><td colspan=4 class="mu">ยังไม่มีนักเรียน</td></tr>'}</table></div>`;
}
function addStudent() { const u = readInput('ps'); if (!u)
    return; getClass(cur).students.push(u); saveData(); render(); }
function removeStudent(u) { const c = getClass(cur); c.students = c.students.filter(x => x !== u); saveData(); render(); }
// --- แท็บ: งานและคะแนน (เช็กส่งงาน กับ ให้คะแนน แยกปุ่มบันทึกกัน) ---
function tabWorks(c) {
    const sm = wmode === 'sub';
    const hd = c.works.map(w => `<th>${esc(w.title)}<br><span class="mu">${w.max > 0 ? 'เต็ม ' + w.max : 'เช็กส่งอย่างเดียว'}${w.due ? ' · กำหนด ' + esc(w.due) : ''}</span><br>${sm ? `<button class="g" onclick="checkAll('${w.id}')">✓ ทั้งหมด</button>` : ''}<button class="d" onclick="deleteWork('${w.id}')">✕ ลบงาน</button></th>`).join('');
    const cell = (w, u) => {
        const k = w.id + '|' + u;
        if (sm) {
            const v = k in draft ? draft[k] : w.sub[u];
            return `<td><input type="checkbox" ${v ? 'checked' : ''} onchange="markDraft('${k}',this.checked?1:0)"></td>`;
        }
        if (w.max === 0)
            return `<td class="mu">— ไม่มีคะแนน</td>`; // งานเช็กส่งอย่างเดียว
        const v = k in draft ? draft[k] : (w.score[u] ?? '');
        return `<td><input type="number" min="0" max="${w.max}" value="${v}" oninput="markDraft('${k}',this.value)"></td>`;
    };
    return `<div class="card"><h3>เพิ่มช่องคะแนน / งาน</h3><div class="row"><input id="wt" placeholder="ชื่องาน"><input id="wm" type="number" min="0" placeholder="คะแนนเต็ม (เว้นว่าง = เช็กส่งอย่างเดียว)" style="width:270px"><input id="wd" type="date"><button onclick="addWork()">เพิ่มงาน</button></div></div>
<div class="tabs"><button class="${sm ? 'on' : ''}" onclick="setWorkMode('sub')">✅ เช็กส่งงาน</button><button class="${sm ? '' : 'on'}" onclick="setWorkMode('score')">🏆 ให้คะแนน</button></div>
<div class="card tw"><div class="row"><h3 style="margin:0;flex:1">${sm ? 'เช็กว่านักเรียนส่งงานหรือไม่' : 'กรอกคะแนนนักเรียน'}</h3><span id="dt" class="no" style="display:${dirty ? 'inline' : 'none'}">● มีการแก้ไขที่ยังไม่บันทึก</span><button onclick="saveDraft()">💾 ${sm ? 'บันทึกการส่งงาน' : 'บันทึกคะแนน'}</button><button class="g" onclick="draft={};dirty=false;render()">ยกเลิก</button></div>
${c.works.length ? `<table><tr><th>นักเรียน</th>${hd}<th>${sm ? 'ส่งแล้ว' : 'รวม'}</th></tr>${c.students.map(u => { const r = calcStudent(c, u); return `<tr><td>${esc(nameOf(u))}</td>${c.works.map(w => cell(w, u)).join('')}<td><b>${sm ? r.n + '/' + c.works.length : r.s + '/' + r.m}</b></td></tr>`; }).join('') || '<tr><td class="mu">เพิ่มนักเรียนก่อน</td></tr>'}</table><p class="mu">${sm ? 'ติ๊ก = ส่งงานแล้ว แล้วกด “บันทึกการส่งงาน” (การให้คะแนนแยกคนละส่วน ไม่ทำให้ติ๊กส่งอัตโนมัติ)' : 'กรอกคะแนนแล้วกด “บันทึกคะแนน” · เว้นว่าง = ยังไม่ตรวจ'}</p>` : '<p class="mu">ยังไม่มีงาน</p>'}</div>`;
}
function confirmDiscard() { if (dirty && !confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการทิ้งหรือไม่?'))
    return false; dirty = false; draft = {}; return true; }
function setWorkMode(m) { if (confirmDiscard()) {
    wmode = m;
    render();
} }
function markDraft(k, v) { draft[k] = v; dirty = true; const x = document.getElementById('dt'); if (x)
    x.style.display = 'inline'; }
function checkAll(id) { getClass(cur).students.forEach(u => draft[id + '|' + u] = 1); dirty = true; render(); }
function saveDraft() {
    const c = getClass(cur);
    Object.keys(draft).forEach(k => {
        const [i, u] = k.split('|'), w = c.works.find(x => x.id === i);
        if (!w)
            return;
        const v = draft[k];
        if (wmode === 'sub') {
            if (v)
                w.sub[u] = 1;
            else
                delete w.sub[u];
        }
        else if (v === '' || v === undefined)
            delete w.score[u];
        else if (!isNaN(+v))
            w.score[u] = Math.max(0, Math.min(+v, w.max));
    });
    draft = {};
    dirty = false;
    saveData();
    render();
}
function addWork() { const t = readInput('wt'), m = +readInput('wm') || 0; if (!t || m < 0)
    return alert('กรอกชื่องาน (คะแนนเต็มเว้นว่างได้ถ้าเป็นงานเช็กส่งอย่างเดียว)'); getClass(cur).works.push({ id: uid(), title: t, max: m, due: readInput('wd'), sub: {}, score: {} }); saveData(); render(); }
function deleteWork(id) { if (confirm('ลบงานนี้?')) {
    const c = getClass(cur);
    c.works = c.works.filter(w => w.id !== id);
    saveData();
    render();
} }
function findWork(id) { return getClass(cur).works.find(w => w.id === id); }
// --- แท็บ: ประกาศ ---
function tabAnnouncements(c) {
    return `<div class="card"><h3>โพสต์ประกาศ</h3><textarea id="at" placeholder="พิมพ์ประกาศถึงนักเรียน..."></textarea><div class="row"><button onclick="addAnnouncement()">ประกาศ</button></div></div>
${c.ann.slice().reverse().map(a => `<div class="ann">${esc(a.t)}<br><span class="mu">${esc(a.d)}</span> <button class="d" onclick="deleteAnnouncement('${a.id}')">ลบ</button></div>`).join('') || '<p class="mu">ยังไม่มีประกาศ</p>'}`;
}
function addAnnouncement() { const t = readInput('at'); if (!t)
    return; getClass(cur).ann.push({ id: uid(), t, d: new Date().toLocaleString('th-TH') }); saveData(); render(); }
function deleteAnnouncement(id) { const c = getClass(cur); c.ann = c.ann.filter(a => a.id !== id); saveData(); render(); }
// --- แท็บ: สรุปผล ---
function tabSummary(c) {
    const rs = c.students.map(u => ({ u, ...calcStudent(c, u) }));
    const avg = rs.length ? rs.reduce((a, r) => a + r.p, 0) / rs.length : 0;
    const tot = rs.length * c.works.length, sent = rs.reduce((a, r) => a + r.n, 0);
    return `<div class="stat"><div><b>${c.students.length}</b>นักเรียน</div><div><b>${c.works.length}</b>งาน</div><div><b>${avg.toFixed(1)}%</b>คะแนนเฉลี่ย</div><div><b>${tot ? Math.round(sent / tot * 100) : 0}%</b>อัตราส่งงาน</div></div>
<div class="card tw"><div class="row"><h3 style="margin:0;flex:1">ตารางสรุป</h3><button class="g" onclick="exportCsv()">⬇ ดาวน์โหลด CSV</button></div><table><tr><th>ชื่อ</th><th>ส่งงาน</th><th>คะแนนรวม</th><th>ร้อยละ</th><th>เกรด</th></tr>${rs.map(r => `<tr><td>${esc(nameOf(r.u))}</td><td>${r.n}/${c.works.length}</td><td>${r.s}/${r.m}</td><td style="min-width:110px">${r.p.toFixed(1)}%<div class="bar"><i style="width:${r.p}%"></i></div></td><td><b>${r.g}</b></td></tr>`).join('')}</table></div>`;
}
function exportCsv() {
    const c = getClass(cur);
    let t = '\ufeffชื่อ,' + c.works.map(w => '"' + w.title + ' (' + (w.max || 'เช็กส่ง') + ')"').join(',') + ',รวม\n';
    c.students.forEach(u => { t += '"' + nameOf(u) + '",' + c.works.map(w => w.score[u] ?? '').join(',') + ',' + calcStudent(c, u).s + '\n'; });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' }));
    a.download = c.subject + '-' + c.room + '.csv';
    a.click();
}
// ===================================================================
// ฝั่งนักเรียน: ดูห้อง งาน และคะแนนของตัวเอง
// ===================================================================
function renderStudentClasses() {
    const L = db.classes.filter(c => c.students.includes(me.u));
    return `
<h3>ห้องเรียนของฉัน (${L.length})</h3>${L.length ? '' : '<p class="mu">ยังไม่ได้อยู่ในห้องใด</p>'}
<div class="grid">${L.map(c => { const r = calcStudent(c, me.u); return `<div class="card cl" onclick="cur='${c.id}';render()"><h3>${esc(c.subject)}</h3><span class="tag">ห้อง ${esc(c.room)}</span><p class="mu">ครู: ${esc(nameOf(c.owner))}<br>ส่งงาน ${r.n}/${c.works.length} · คะแนน ${r.s}/${r.m} (${r.g})</p><div class="bar"><i style="width:${c.works.length ? r.n / c.works.length * 100 : 0}%"></i></div></div>`; }).join('')}</div>`;
}
function renderStudentDetail() {
    const c = getClass(cur), r = calcStudent(c, me.u), late = w => w.due && !w.sub[me.u] && w.due < new Date().toISOString().slice(0, 10);
    return `<p><button class="g" onclick="cur=null;msg='';render()">← กลับ</button></p><h2>${esc(c.subject)} <span class="tag">ห้อง ${esc(c.room)}</span></h2>
<div class="stat"><div><b>${r.s}/${r.m}</b>คะแนนที่ตรวจแล้ว</div><div><b>${r.m ? r.p.toFixed(1) + '%' : '-'}</b>ร้อยละ</div><div><b>${r.g}</b>เกรดปัจจุบัน</div><div><b>${r.n}/${c.works.length}</b>งานที่ส่ง</div></div>
<div class="card"><h3>📢 ประกาศ</h3>${c.ann.slice().reverse().map(a => `<div class="ann">${esc(a.t)}<br><span class="mu">${esc(a.d)}</span></div>`).join('') || '<p class="mu">ไม่มีประกาศ</p>'}</div>
<div class="card tw"><h3>📝 งานและคะแนนของฉัน</h3><table><tr><th>งาน</th><th>กำหนดส่ง</th><th>สถานะ</th><th>คะแนน</th></tr>${c.works.map(w => `<tr><td>${esc(w.title)}</td><td>${esc(w.due || '-')}</td><td>${w.sub[me.u] ? '<span class="ok">✔ ส่งแล้ว</span>' : late(w) ? '<span class="no">✘ เลยกำหนด</span>' : '<span class="no">ยังไม่ส่ง</span>'}</td><td>${w.max === 0 ? '<span class="mu">เช็กส่งอย่างเดียว</span>' : w.score[me.u] !== undefined ? `<b>${w.score[me.u]}</b>/${w.max}` : `<span class="mu">รอตรวจ /${w.max}</span>`}</td></tr>`).join('') || '<tr><td colspan=4 class="mu">ยังไม่มีงาน</td></tr>'}</table></div>`;
}
// ===================================================================
// เริ่มต้นแอป และดึงข้อมูลใหม่ทุก 5 วินาที (เกือบเรียลไทม์)
// ===================================================================
try {
    cred = JSON.parse(sessionStorage.getItem('cred'));
}
catch (_) { }
if (cred) {
    api('load').then(x => { if (applyData(x))
        lastJson = JSON.stringify(x);
    else
        cred = null; render(); }).catch(() => { cred = null; render(); });
}
else
    render();
setInterval(async () => {
    if (!me || busy || dirty || document.hidden)
        return;
    const a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))
        return;
    try {
        const x = await api('load');
        if (x.error)
            return;
        const j = JSON.stringify(x);
        if (j !== lastJson) {
            lastJson = j;
            applyData(x);
            render();
        }
        setStatus('🟢 ' + new Date().toLocaleTimeString('th-TH'));
    }
    catch (_) {
        setStatus('⚠ ออฟไลน์');
    }
}, 5000);