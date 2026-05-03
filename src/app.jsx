// 碰器嚴選系統 — App shell + routing
const { useState: useSt, useEffect: useEf, useRef: useRef } = React;

// 部署 GAS 後填入網址
const GAS_URL = window.GAS_URL || '';

const NAV = [
  { group:'營運', items:[
    { key:'dashboard', label:'總覽', icon:'dashboard' },
  ]},
  { group:'業務', items:[
    { key:'orders', label:'訂單追蹤', icon:'orders' },
    { key:'quote', label:'報價單', icon:'quote' },
    { key:'crm', label:'客戶管理', icon:'crm' },
    { key:'channels', label:'通路管理', icon:'channel' },
  ]},
  { group:'資源', items:[
    { key:'finance', label:'收支控管', icon:'finance' },
    { key:'inventory', label:'庫存管理', icon:'inventory' },
    { key:'product', label:'產品成本', icon:'product' },
  ]},
  { group:'系統', items:[
    { key:'settings', label:'設定 · 回收桶', icon:'settings' },
  ]},
];

const TRASH_DAYS = 10;
const TRASH_MS = TRASH_DAYS * 86400 * 1000;

// Purge soft-deleted items older than TRASH_DAYS
function purgeOldTrash(state) {
  const now = Date.now();
  const colls = ['orders','finances','stocks','products','customers','quotes','channels','tasks','logs'];
  colls.forEach(k => {
    if (Array.isArray(state[k])) {
      state[k] = state[k].filter(x => !x._deleted || (now - x._deleted < TRASH_MS));
    }
  });
  return state;
}

// Soft-delete helper: call like setState(s => softDel(s, 'orders', id))
window.softDel = (state, coll, id) => ({
  ...state,
  [coll]: (state[coll]||[]).map(x => x.id===id ? {...x, _deleted: Date.now()} : x),
});
window.restoreItem = (state, coll, id) => ({
  ...state,
  [coll]: (state[coll]||[]).map(x => x.id===id ? (({_deleted, ...rest}) => rest)(x) : x),
});
window.purgeItem = (state, coll, id) => ({
  ...state,
  [coll]: (state[coll]||[]).filter(x => x.id!==id),
});

const MOBILE_NAV = [
  { key:'dashboard', label:'總覽', icon:'dashboard' },
  { key:'orders', label:'訂單', icon:'orders' },
  { key:'finance', label:'收支', icon:'finance' },
  { key:'inventory', label:'庫存', icon:'inventory' },
  { key:'quote', label:'報價單', icon:'quote' },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "clay",
  "density": "comfortable",
  "serif": "Noto Serif TC",
  "greet_name": "康老闆"
}/*EDITMODE-END*/;

function mergeWithSeed(parsed) {
  const fresh = JSON.parse(JSON.stringify(window.SEED));
  Object.keys(fresh).forEach(k => { if (!(k in parsed)) parsed[k] = fresh[k]; });
  return purgeOldTrash(parsed);
}

// 一次性遷移：偵測到任何舊示範資料殘留就自動清空
const STATE_VERSION = 'v3-empty-2026-05-02';
function isOldDemoState(parsed) {
  if (!parsed) return false;
  const has = (arr, ids) => Array.isArray(arr) && arr.some(x => x && ids.includes(x.id));
  if (has(parsed.orders,    ['o1','o2','o3','o4','o5','o6','o7','o8'])) return true;
  if (has(parsed.finances,  ['f1','f5','f10','f14','f18','f20','f21'])) return true;
  if (has(parsed.stocks,    ['s1','s2','s3','g1','g2','g3','g4','g5'])) return true;
  if (has(parsed.logs,      ['l1','l2','l3','l4','l5','l6','l7','l8'])) return true;
  if (has(parsed.products,  ['p1','p2','p3','p4','p5'])) return true;
  if (has(parsed.customers, ['c1','c2','c3','c4','c5','c6','c7','c8'])) return true;
  if (has(parsed.tasks,     ['t1','t2','t3','t4','t5','t6','t7'])) return true;
  if (has(parsed.quotes,    ['q1','q2'])) return true;
  if (has(parsed.channels,  ['ch1','ch2','ch3','ch4','ch5','ch6'])) return true;
  if (Array.isArray(parsed.monthMethods) && parsed.monthMethods.some(m=>m && (m.id==='mm4'||m.id==='mm5'))) return true;
  if (parsed.goals && parsed.goals.month==='2026-04' && parsed.goals.revenue && parsed.goals.revenue.actual===64300) return true;
  return false;
}

function App(){
  const [state, setState] = useSt(()=>{
    try {
      const versionTag = localStorage.getItem('bangqi_state_version');
      const saved = localStorage.getItem('bangqi_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 自動清除舊版示範資料
        if (versionTag !== STATE_VERSION && isOldDemoState(parsed)) {
          localStorage.removeItem('bangqi_state');
          localStorage.setItem('bangqi_state_version', STATE_VERSION);
          return JSON.parse(JSON.stringify(window.SEED));
        }
        localStorage.setItem('bangqi_state_version', STATE_VERSION);
        return mergeWithSeed(parsed);
      }
      localStorage.setItem('bangqi_state_version', STATE_VERSION);
    } catch(e){}
    return JSON.parse(JSON.stringify(window.SEED));
  });
  const [syncStatus, setSyncStatus] = useSt('idle'); // idle | syncing | ok | error
  const saveTimer = useRef(null);
  const initialLoaded = useRef(false); // 防止初次 fetch 還沒完成就 push 空 state 蓋掉雲端
  const urlParams = new URLSearchParams(window.location.search);
  const forcedPage = urlParams.get('page');
  const embedded = window.self !== window.top;

  const [page, setPage] = useSt(()=> forcedPage || localStorage.getItem('bangqi_page') || 'dashboard');
  const [menuOpen, setMenuOpen] = useSt(false);
  const [taskOpen, setTaskOpen] = useSt(false);
  const [taskForm, setTaskForm] = useSt({ title:'', due:'今天', priority:'mid' });
  const [orderModalFlag, setOrderModalFlag] = useSt(false);
  const [tweaks, setTweaks] = useSt(TWEAK_DEFAULTS);
  const [tweakOpen, setTweakOpen] = useSt(false);
  const [showTop, setShowTop] = useSt(false);

  useEf(()=>{
    const getY = () => window.pageYOffset || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const onScroll = () => setShowTop(getY() > 5);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });
    const interval = setInterval(onScroll, 200);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('wheel', onScroll);
      clearInterval(interval);
    };
  }, []);

  useEf(()=>{
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type==='__activate_edit_mode') setTweakOpen(true);
      if (e.data.type==='__deactivate_edit_mode') setTweakOpen(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type:'__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  useEf(()=>{
    const root = document.documentElement;
    const accents = {
      clay: { a:'#8B5A3C', t:'#F4EADE', s:'#6B8E5A' },
      indigo: { a:'#3E5171', t:'#E6E9F0', s:'#6B8E5A' },
      moss: { a:'#4F6B4A', t:'#E8ECE3', s:'#A67B5B' },
      rust: { a:'#A85A3A', t:'#F5E6DC', s:'#6B8E5A' }
    };
    const a = accents[tweaks.accent] || accents.clay;
    root.style.setProperty('--clay', a.a);
    root.style.setProperty('--clay-tint', a.t);
    root.style.setProperty('--moss', a.s);
    root.style.setProperty('--f-serif', `"${tweaks.serif}", serif`);
    root.style.setProperty('--pad', tweaks.density==='compact' ? '12px' : tweaks.density==='spacious' ? '22px' : '16px');
  }, [tweaks]);

  useEf(()=>{
    if (embedded) document.body.classList.add('forced-mobile');
  }, [embedded]);

  const updateTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    window.parent.postMessage({ type:'__edit_mode_set_keys', edits:{ [k]: v }}, '*');
  };

  // 啟動時從 GAS 載入最新資料
  useEf(()=>{
    if (!GAS_URL) { initialLoaded.current = true; return; }
    fetch(GAS_URL)
      .then(r => r.json())
      .then(res => {
        if (res.ok && res.data) {
          const merged = mergeWithSeed(res.data);
          setState(merged);
          localStorage.setItem('bangqi_state', JSON.stringify(merged));
        }
      })
      .catch(()=>{})
      .finally(()=> { initialLoaded.current = true; });
  }, []);

  // 狀態變更時存 localStorage + 防抖儲存 GAS
  useEf(()=>{
    localStorage.setItem('bangqi_state', JSON.stringify(state));
    if (!GAS_URL) return;
    if (!initialLoaded.current) return; // 初次 fetch 未完成前不 push，避免覆蓋雲端
    clearTimeout(saveTimer.current);
    setSyncStatus('syncing');
    saveTimer.current = setTimeout(()=>{
      fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action:'save', data: state }),
      })
        .then(r => r.json())
        .then(res => setSyncStatus(res.ok ? 'ok' : 'error'))
        .catch(()=> setSyncStatus('error'));
    }, 1500);
  }, [state]);

  useEf(()=>{ localStorage.setItem('bangqi_page', page); }, [page]);

  const goto = (p, opts={}) => {
    setPage(p); setMenuOpen(false);
    if (opts.openNew && p==='orders') setOrderModalFlag(true);
  };

  const addTask = () => {
    if (!taskForm.title) return;
    setState(s=>({ ...s, tasks:[{ id:uid(), title:taskForm.title, due:taskForm.due, priority:taskForm.priority, done:false, link:null }, ...s.tasks] }));
    setTaskOpen(false); setTaskForm({ title:'', due:'今天', priority:'mid' });
    toast('待辦已新增');
  };

  const pending = state.orders.filter(o => ['待處理','進行中','出貨中'].includes(o.status)).length;
  const alerts = state.stocks.filter(s => s.qty<=s.min).length;

  const pageProps = { state, setState, goto, tweaks,
    openTask: ()=>setTaskOpen(true),
    openOrder: (id)=>{ setPage('orders'); }
  };

  const renderPage = () => {
    switch(page){
      case 'dashboard': return <Dashboard {...pageProps}/>;
      case 'orders': return <OrdersView {...pageProps} pendingNew={orderModalFlag} clearPendingNew={()=>setOrderModalFlag(false)}/>;
      case 'finance': return <FinanceView {...pageProps}/>;
      case 'inventory': return <InventoryView {...pageProps}/>;
      case 'product': return <ProductsView {...pageProps}/>;
      case 'quote': return <QuotesView {...pageProps}/>;
      case 'crm': return <CRMView {...pageProps}/>;
      case 'channels': return <ChannelsView {...pageProps}/>;
      case 'settings': return <SettingsView {...pageProps}/>;
      default: return <Dashboard {...pageProps}/>;
    }
  };

  const counts = { orders: pending, inventory: alerts };

  return (
    <>
      {/* Mobile topbar */}
      <div className="mobile-topbar">
        <div className="m-brand">
          <div className="brand-mark">碰</div>
          <div className="name">碰器嚴選</div>
        </div>
        <div className="m-actions">
          <button className="icon-btn" onClick={()=>setMenuOpen(true)}><Icon name="menu" size={16}/></button>
        </div>
      </div>

      <div className="app-shell">
        {/* Sidebar (desktop) */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">碰</div>
            <div className="brand-text">
              <div className="name">碰器嚴選</div>
              <div className="tag">Workshop · Curation</div>
            </div>
          </div>

          {NAV.map(group => (
            <div className="nav-group" key={group.group}>
              <div className="nav-group-label">{group.group}</div>
              {group.items.map(it => (
                <button key={it.key} className={'nav-item '+(page===it.key?'active':'')} onClick={()=>goto(it.key)}>
                  <Icon name={it.icon} className="nav-ic" size={17}/>
                  <span>{it.label}</span>
                  {counts[it.key]>0 && <span className="nav-count">{counts[it.key]}</span>}
                </button>
              ))}
            </div>
          ))}

          <div className="sidebar-footer">
            <div className="sync-chip">
              <span className="dot" style={{ background: syncStatus==='error'?'#c0392b': syncStatus==='syncing'?'#e6a817':'#6B8E5A' }}/>
              { !GAS_URL ? '本機模式' : syncStatus==='syncing' ? '同步中…' : syncStatus==='error' ? '同步失敗' : '已同步' }
            </div>
          </div>
        </aside>

        <main className="main">
          {renderPage()}
        </main>
      </div>

      {/* Mobile drawer menu */}
      <div className={'mobile-menu '+(menuOpen?'open':'')}>
        <div className="mobile-menu-head">
          <div className="m-brand">
            <div className="brand-mark">碰</div>
            <div className="brand-text">
              <div style={{ fontFamily:'var(--f-serif)', fontSize:15, fontWeight:700 }}>碰器嚴選</div>
              <div className="tag" style={{ fontSize:10, color:'var(--ink-mute)', letterSpacing:1.2, textTransform:'uppercase', marginTop:2 }}>Workshop · Curation</div>
            </div>
          </div>
          <button className="icon-btn" onClick={()=>setMenuOpen(false)}><Icon name="close" size={16}/></button>
        </div>
        <div className="mobile-menu-body">
          {NAV.map(group=>(
            <div className="nav-group" key={group.group}>
              <div className="nav-group-label">{group.group}</div>
              {group.items.map(it=>(
                <button key={it.key} className={'nav-item '+(page===it.key?'active':'')} onClick={()=>goto(it.key)}>
                  <Icon name={it.icon} className="nav-ic" size={17}/>
                  <span>{it.label}</span>
                  {counts[it.key]>0 && <span className="nav-count">{counts[it.key]}</span>}
                </button>
              ))}
            </div>
          ))}
          <div style={{ marginTop:14 }}>
            <div className="sync-chip">
              <span className="dot" style={{ background: syncStatus==='error'?'#c0392b': syncStatus==='syncing'?'#e6a817':'#6B8E5A' }}/>
              { !GAS_URL ? '本機模式' : syncStatus==='syncing' ? '同步中…' : syncStatus==='error' ? '同步失敗' : '已同步' }
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        {MOBILE_NAV.map(n=>(
          <button key={n.key} className={(page===n.key||(n.key==='more'&&menuOpen))?'active':''}
            onClick={()=>{ if(n.key==='more')setMenuOpen(true); else goto(n.key); }}>
            <Icon name={n.icon} size={20}/>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* Add task modal */}
      <Modal open={taskOpen} onClose={()=>setTaskOpen(false)} title="新增待辦"
        footer={<><div style={{flex:1}}/><button className="btn btn-ghost" onClick={()=>setTaskOpen(false)}>取消</button><button className="btn btn-primary" onClick={addTask}>加入</button></>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>事項</label><input className="input" autoFocus value={taskForm.title} onChange={e=>setTaskForm({...taskForm, title:e.target.value})} placeholder="例如：青田茶事 出貨確認"/></div>
          <div className="row">
            <div className="field"><label>期限</label><input className="input" value={taskForm.due} onChange={e=>setTaskForm({...taskForm, due:e.target.value})} placeholder="今天 / 明天 / 本週"/></div>
            <div className="field"><label>優先</label>
              <select className="select" value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})}>
                <option value="high">重要</option><option value="mid">一般</option><option value="low">次要</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Tweaks panel */}
      {tweakOpen && (
        <div className="tweaks-panel">
          <div className="tweaks-head">
            <div style={{ fontFamily:'var(--f-serif)', fontSize:15, fontWeight:700 }}>Tweaks</div>
            <button className="icon-btn" onClick={()=>setTweakOpen(false)}><Icon name="close" size={14}/></button>
          </div>
          <div className="tweaks-body">
            <div className="tweaks-row">
              <div className="tweaks-label">主色調</div>
              <div className="swatch-row">
                {[['clay','#8B5A3C'],['indigo','#3E5171'],['moss','#4F6B4A'],['rust','#A85A3A']].map(([k,c])=>(
                  <button key={k} className={'swatch '+(tweaks.accent===k?'on':'')} style={{ background:c }} onClick={()=>updateTweak('accent', k)}/>
                ))}
              </div>
            </div>
            <div className="tweaks-row">
              <div className="tweaks-label">密度</div>
              <div style={{ display:'flex', gap:6 }}>
                {['compact','comfortable','spacious'].map(d=>(
                  <button key={d} className={'btn btn-sm '+(tweaks.density===d?'btn-ink':'btn-ghost')} onClick={()=>updateTweak('density', d)}>
                    {d==='compact'?'緊湊':d==='spacious'?'寬敞':'標準'}
                  </button>
                ))}
              </div>
            </div>
            <div className="tweaks-row">
              <div className="tweaks-label">襯線字體</div>
              <select className="select" value={tweaks.serif} onChange={e=>updateTweak('serif', e.target.value)}>
                <option>Noto Serif TC</option>
                <option>Noto Sans TC</option>
              </select>
            </div>
            <div className="tweaks-row">
              <div className="tweaks-label">問候名字</div>
              <input className="input" value={tweaks.greet_name} onChange={e=>updateTweak('greet_name', e.target.value)}/>
            </div>
            <hr className="hr-soft"/>
            <button className="btn btn-danger btn-sm" style={{ width:'100%' }}
              onClick={()=>{ if(confirm('重置所有資料為示範資料？')){ localStorage.removeItem('bangqi_state'); location.reload(); } }}>
              重置為示範資料
            </button>
          </div>
        </div>
      )}

      <div id="toast" className="toast"/>

      <button type="button" aria-label="回到頂部" title="回到頂部"
        onClick={()=>{
          try { window.scrollTo({ top:0, behavior:'smooth' }); } catch { window.scrollTo(0,0); }
          if (document.documentElement) document.documentElement.scrollTop = 0;
          if (document.body) document.body.scrollTop = 0;
        }}
        style={{
          position:'fixed',
          right:16,
          bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
          width:48, height:48, borderRadius:'50%',
          background:'var(--clay)', color:'#fff', border:'none',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 6px 16px rgba(0,0,0,0.32)',
          zIndex:9999,
          cursor:'pointer',
          opacity: showTop?1:0,
          pointerEvents: showTop?'auto':'none',
          transform: showTop?'translateY(0)':'translateY(8px)',
          transition:'opacity 0.2s ease, transform 0.2s ease'
        }}>
        <Icon name="arrowUp" size={20}/>
      </button>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
