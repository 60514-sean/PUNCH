// 碰器嚴選系統 — Settings + Recycle bin
const { useState: useStateS, useMemo: useMemoS } = React;

// Collection metadata: key, label, icon, display formatter
const TRASH_COLLS = [
  { key:'orders',    label:'訂單',       icon:'orders',    fmt: o => ({ title: o.no+' · '+o.client, sub: o.product, meta: fmtMoney(o.amount) }) },
  { key:'finances',  label:'收支',       icon:'finance',   fmt: f => ({ title: (f.type==='income'?'收入 · ':'支出 · ')+f.cat, sub: f.desc, meta: fmtMoney(f.amount) }) },
  { key:'stocks',    label:'庫存',       icon:'inventory', fmt: s => ({ title: s.name, sub: s.cat, meta: s.qty+' '+s.unit }) },
  { key:'products',  label:'產品',       icon:'product',   fmt: p => ({ title: p.name, sub: p.cat||p.spec, meta: fmtMoney(p.price) }) },
  { key:'customers', label:'客戶',       icon:'crm',       fmt: c => ({ title: c.name, sub: c.email||c.phone||'—', meta: c.tier+' 級' }) },
  { key:'quotes',    label:'報價單',     icon:'quote',     fmt: q => ({ title: q.num+' · '+q.client, sub: (q.items||[]).map(i=>i.name).join('、'), meta: fmtMoney(q.grand) }) },
  { key:'channels',  label:'通路',       icon:'channel',   fmt: c => ({ title: c.name, sub: c.note, meta: fmtMoney(c.sales) }) },
];

const SettingsView = ({ state, setState }) => {
  const [tab, setTab] = useStateS('trash');
  const [filter, setFilter] = useStateS('all');

  // Gather all deleted items
  const trashList = useMemoS(() => {
    const list = [];
    TRASH_COLLS.forEach(c => {
      (state[c.key] || []).forEach(x => {
        if (x._deleted) list.push({ coll: c.key, collLabel: c.label, icon: c.icon, item: x, ...c.fmt(x) });
      });
    });
    return list.sort((a,b) => b.item._deleted - a.item._deleted);
  }, [state]);

  const filtered = filter==='all' ? trashList : trashList.filter(t => t.coll===filter);

  const restore = (coll, id) => {
    setState(s => window.restoreItem(s, coll, id));
    toast('已復原');
  };
  const purge = (coll, id) => {
    if (!confirm('永久刪除此項目？此操作無法復原。')) return;
    setState(s => window.purgeItem(s, coll, id));
    toast('已永久刪除');
  };
  const purgeAll = () => {
    if (!confirm('清空回收桶？所有項目將永久刪除。')) return;
    setState(s => {
      const next = {...s};
      TRASH_COLLS.forEach(c => {
        next[c.key] = (next[c.key]||[]).filter(x => !x._deleted);
      });
      return next;
    });
    toast('回收桶已清空');
  };

  const daysLeft = (ts) => Math.max(0, Math.ceil((ts + 10*86400*1000 - Date.now()) / 86400000));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">系統</div>
          <h1 className="h1">設定 · 回收桶</h1>
          <div className="sub">刪除的項目會保留 10 天，期滿自動清除。共 {trashList.length} 筆在回收桶中。</div>
        </div>
        <div className="topbar-r">
          {trashList.length > 0 && <button className="btn btn-ghost" onClick={purgeAll}><Icon name="trash" size={14}/> 清空回收桶</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className={'btn btn-sm '+(tab==='trash'?'btn-ink':'btn-ghost')} onClick={()=>setTab('trash')}>
          <Icon name="trash" size={12}/> 回收桶 {trashList.length>0 && <span style={{ opacity:0.7 }}>({trashList.length})</span>}
        </button>
        <button className={'btn btn-sm '+(tab==='about'?'btn-ink':'btn-ghost')} onClick={()=>setTab('about')}>
          <Icon name="settings" size={12}/> 關於
        </button>
      </div>

      {tab==='trash' && (
        <>
          {/* collection filter */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button className={'btn btn-sm '+(filter==='all'?'btn-ink':'btn-ghost')} onClick={()=>setFilter('all')}>
              全部 <span style={{ opacity:0.7, marginLeft:2 }}>{trashList.length}</span>
            </button>
            {TRASH_COLLS.map(c => {
              const count = trashList.filter(t=>t.coll===c.key).length;
              if (count===0) return null;
              return (
                <button key={c.key} className={'btn btn-sm '+(filter===c.key?'btn-ink':'btn-ghost')} onClick={()=>setFilter(c.key)}>
                  <Icon name={c.icon} size={11}/> {c.label} <span style={{ opacity:0.7, marginLeft:2 }}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {filtered.length===0 ? (
              <EmptyState icon="trash" title="回收桶是空的" hint="已刪除的項目會顯示在這裡，10 天後自動清除"/>
            ) : (
              <div style={{ display:'flex', flexDirection:'column' }}>
                {filtered.map((t, i) => {
                  const days = daysLeft(t.item._deleted);
                  const urgent = days <= 2;
                  return (
                    <div key={t.coll+'_'+t.item.id} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto auto auto', gap:14, alignItems:'center', padding:'14px 18px', borderBottom: i<filtered.length-1?'1px solid var(--rule-soft)':'none' }}>
                      <div style={{ width:36, height:36, borderRadius:8, background:'var(--clay-tint)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--clay)' }}>
                        <Icon name={t.icon} size={16}/>
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                        <div style={{ fontSize:11, color:'var(--ink-mute)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          <span style={{ background:'var(--paper-soft)', padding:'1px 6px', borderRadius:3, marginRight:6 }}>{t.collLabel}</span>
                          {t.sub || '—'}
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize:12, color:'var(--ink-mute)', textAlign:'right' }}>{t.meta}</div>
                      <div style={{ fontSize:11, color: urgent?'var(--terracotta)':'var(--ink-mute)', textAlign:'right', fontWeight: urgent?700:500 }}>
                        剩 {days} 天
                        <div style={{ fontSize:10, fontFamily:'var(--f-mono)', opacity:0.7 }}>{fmtDateFull(new Date(t.item._deleted).toISOString().slice(0,10))}</div>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>restore(t.coll, t.item.id)} title="復原">
                          <Icon name="arrowUp" size={11}/> 復原
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>purge(t.coll, t.item.id)} title="永久刪除" style={{ color:'var(--terracotta)' }}>
                          <Icon name="x" size={11}/>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ fontSize:11, color:'var(--ink-mute)', padding:'0 4px' }}>
            💡 提示：回收桶保留期為 10 天。項目到期後會在下次開啟系統時自動清除。
          </div>
        </>
      )}

      {tab==='about' && (
        <div className="card">
          <div className="card-head"><div className="card-title">關於系統</div></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, fontSize:13, lineHeight:1.8 }} className="about-grid">
            <div><span className="muted">名稱　　</span>碰器嚴選系統</div>
            <div><span className="muted">版本　　</span>v1.2</div>
            <div><span className="muted">使用者　</span>碰器有限公司 · 康竣傑</div>
            <div><span className="muted">資料位置</span>本機瀏覽器</div>
          </div>
          <hr className="hr-soft" style={{ margin:'16px 0' }}/>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-danger btn-sm" onClick={()=>{ if(confirm('重置所有資料為示範資料？')){ localStorage.removeItem('bangqi_state'); location.reload(); } }}>
              重置為示範資料
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>{
              const data = JSON.stringify(JSON.parse(localStorage.getItem('bangqi_state')||'{}'), null, 2);
              const blob = new Blob([data], {type:'application/json'});
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'bangqi-backup-'+new Date().toISOString().slice(0,10)+'.json';
              a.click();
              URL.revokeObjectURL(url);
            }}>匯出備份</button>
          </div>
        </div>
      )}
    </div>
  );
};

window.SettingsView = SettingsView;
