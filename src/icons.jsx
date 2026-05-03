// 碰器嚴選系統 — Icons + small helpers
// Minimalist line icons in a handmade weight (1.6 stroke, round caps).

const Icon = ({ name, size=18, style={}, className='' }) => {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    orders: <><path d="M5 7h14l-1 13a1 1 0 01-1 1H7a1 1 0 01-1-1z"/><path d="M9 7V5a3 3 0 016 0v2"/></>,
    finance: <><path d="M3 18V8a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 10h18"/><path d="M7 15h3"/></>,
    inventory: <><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></>,
    product: <><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18M3 12h18"/></>,
    quote: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6"/></>,
    file: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/></>,
    package: <><path d="M16.5 9.4l-9-5.19"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></>,
    users: <><circle cx="9" cy="8" r="4"/><path d="M3 21v-1a6 6 0 0112 0v1"/><circle cx="17" cy="9" r="3"/><path d="M21 20v-1a4 4 0 00-4-4"/></>,
    channel: <><circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/></>,
    crm: <><circle cx="9" cy="8" r="4"/><path d="M3 21v-1a6 6 0 0112 0v1"/><circle cx="17" cy="9" r="3"/><path d="M21 20v-1a4 4 0 00-4-4"/></>,
    task: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M8 14l2 2 4-4"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    close: <><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></>,
    chevron: <polyline points="9 6 15 12 9 18"/>,
    chevronDown: <polyline points="6 9 12 15 18 9"/>,
    chevronLeft: <polyline points="15 6 9 12 15 18"/>,
    arrowUp: <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
    arrowDown: <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
    search: <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></>,
    menu: <><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></>,
    download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    alert: <><path d="M10.3 3.86L1.82 18a2 2 0 001.7 3h16.96a2 2 0 001.7-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    check: <polyline points="5 12 10 17 19 7"/>,
    circle: <circle cx="12" cy="12" r="8"/>,
    cloud: <path d="M18 10a6 6 0 00-11.2-2A4 4 0 006 16h12a4 4 0 000-8z"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></>,
    trendUp: <><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></>,
    phone: <path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 10a16 16 0 006 6l1.36-1.36a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/>,
    dot: <circle cx="12" cy="12" r="2"/>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>,
    star: <polygon points="12 2 15 9 22 10 17 15 18 22 12 19 6 22 7 15 2 10 9 9 12 2"/>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></>,
    camera: <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>,
    note: <><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></>,
    transfer: <><polyline points="17 2 21 6 17 10"/><line x1="3" y1="6" x2="21" y2="6"/><polyline points="7 22 3 18 7 14"/><line x1="3" y1="18" x2="21" y2="18"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      style={{ stroke: 'currentColor', fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink:0, ...style }}
      className={className}>
      {paths[name]}
    </svg>
  );
};

// ─── Utilities ───
const fmtMoney = (n, compact=false) => {
  if (n==null || isNaN(n)) return '0';
  const neg = n < 0;
  const abs = Math.abs(n);
  if (compact && abs >= 10000) {
    if (abs >= 100000000) return (neg?'-':'') + (abs/100000000).toFixed(1) + '億';
    if (abs >= 10000) return (neg?'-':'') + (abs/10000).toFixed(abs >= 100000 ? 0 : 1) + '萬';
  }
  // 保留小數位（最多 10 位），整數不顯示小數點
  return (neg?'-':'') + abs.toLocaleString('en-US', { maximumFractionDigits: 10 });
};
const fmtPct = n => (n==null || isNaN(n)) ? '--' : (n>0?'+':'') + Math.round(n*10)/10 + '%';
const fmtDate = (s) => {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
};
const fmtDateFull = (s) => {
  if (!s) return '';
  // 容錯：GAS 偶爾把日期讀成 ISO 字串，截短成 YYYY-MM-DD
  if (typeof s === 'string' && s.length > 10 && s.includes('T')) s = s.slice(0,10);
  return String(s).replace(/-/g,'/');
};
const uid = () => 'id' + Math.random().toString(36).slice(2,9);
const ym = (d) => d.slice(0,7);

const STATUS_COLOR = {
  '待處理': 'ochre', '進行中': 'clay', '出貨中': 'sage',
  '已完成': 'outline', '已取消': 'outline',
};

const CAT_COLOR = {
  '銷售收入': 'moss', '服務費': 'moss', '其他收入': 'moss',
  '原料採購': 'clay', '人事費用': 'terracotta', '運費': 'ochre',
  '租金': 'ink', '水電費': 'ink', '設備': 'sage', '運營成本': 'ink', '其他支出': 'ink',
};

// Toast
let _toastTimer = null;
const toast = (msg) => {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>t.classList.remove('show'), 1800);
};

Object.assign(window, { Icon, fmtMoney, fmtPct, fmtDate, fmtDateFull, uid, ym, STATUS_COLOR, CAT_COLOR, toast });
