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
    { key:'channels', label:'通路控管', icon:'channel' },
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
  { key:'more', label:'更多', icon:'menu' },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "clay",
  "density": "comfortable",
  "serif": "Noto Serif TC",
  "greet_name": "宇澄"
}/*EDITMODE-END*/;

function mergeWithSeed(parsed) {
  const fresh = JSON.parse(JSON.stringify(window.SEED));
  Object.keys(fresh).forEach(k => { if (!(k in parsed)) parsed[k] = fresh[k]; });
  return purgeOldTrash(parsed);
}

function App(){
  const [state, setState] = useSt(()=>{
    try {
      const saved = localStorage.getItem('bangqi_state');
      if (saved) return mergeWithSeed(JSON.parse(saved));
    } catch(e){}
    return JSON.parse(JSON.stringify(window.SEED));
  });
  const [syncStatus, setSyncStatus] = useSt('idle'); // idle | syncing | ok | error
  const saveTimer = useRef(null);
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
    if (!GAS_URL) return;
    fetch(GAS_URL)
      .then(r => r.json())
      .then(res => {
        if (res.ok && res.data) {
          const merged = mergeWithSeed(res.data);
          setState(merged);
          localStorage.setItem('bangqi_state', JSON.stringify(merged));
        }
      })
      .catch(()=>{});
  }, []);

  // 狀態變更時存 localStorage + 防抖儲存 GAS
  useEf(()=>{
    localStorage.setItem('bangqi_state', JSON.stringify(state));
    if (!GAS_URL) return;
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
          <button className="icon-btn" onClick={()=>setTaskOpen(true)}><Icon name="plus" size={16}/></button>
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
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
