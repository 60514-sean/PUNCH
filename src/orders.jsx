// 碰器嚴選系統 — Orders / CRM views
const { useState: useStateO, useMemo: useMemoO } = React;

const OrdersView = ({ state, setState, openOrder, pendingNew, clearPendingNew }) => {
  const [filter, setFilter] = useStateO('全部');
  const [q, setQ] = useStateO('');
  const [modalOpen, setModalOpen] = useStateO(false);
  const [editingId, setEditingId] = useStateO(null);
  const [form, setForm] = useStateO(emptyOrder());

  React.useEffect(()=>{
    if (pendingNew) { openNew(); clearPendingNew(); }
  }, [pendingNew]);

  function emptyOrder(){
    return { id:'', no:'', client:'', product:'', amount:'', cost:'', date:'', status:'待處理', note:'' };
  }

  const openNew = () => {
    const today = new Date();
    const no = 'SO-'+today.getFullYear()+String(today.getMonth()+1).padStart(2,'0')+String(today.getDate()).padStart(2,'0')+'-'+String(state.orders.length+1).padStart(3,'0');
    setForm({ ...emptyOrder(), no, date: today.toISOString().slice(0,10) });
    setEditingId(null); setModalOpen(true);
  };
  const openEdit = (o) => { setForm({...o}); setEditingId(o.id); setModalOpen(true); };
  const saveOrder = () => {
    if (!form.client || !form.product) { toast('請填寫客戶與產品'); return; }
    const amt = Number(form.amount)||0;
    const cost = Number(form.cost)||0;
    if (editingId) {
      setState(s=>({ ...s, orders: s.orders.map(o=>o.id===editingId?{...form, amount:amt, cost}:o) }));
      toast('訂單已更新');
    } else {
      const newO = { ...form, id: uid(), amount:amt, cost, created: new Date().toISOString().slice(0,10) };
      setState(s=>({ ...s, orders: [newO, ...s.orders] }));
      toast('訂單已新增');
    }
    setModalOpen(false);
  };
  const delOrder = () => {
    if (!confirm('刪除此訂單？將移至回收桶（保留 10 天）。')) return;
    setState(s=> window.softDel(s, 'orders', editingId));
    setModalOpen(false); toast('已移至回收桶');
  };

  const filtered = state.orders.filter(o => !o._deleted && (filter==='全部' || o.status===filter) &&
    (!q || o.client.includes(q) || o.product.includes(q) || o.no.includes(q)))
    .slice().sort((a,b)=>{
      // Done/cancelled go to bottom
      const rank = s => (s==='已完成' || s==='已取消') ? 1 : 0;
      const ra = rank(a.status), rb = rank(b.status);
      if (ra !== rb) return ra - rb;
      // Then: nearest due date first (earliest date)
      return (a.date||'9999').localeCompare(b.date||'9999');
    });

  const tallies = useMemoO(()=>{
    const m = {};
    state.orders.filter(o=>!o._deleted).forEach(o => { m[o.status] = (m[o.status]||0)+1; });
    return m;
  }, [state.orders]);

  const totalAmt = filtered.reduce((a,b)=>a+b.amount, 0);
  const totalProfit = filtered.reduce((a,b)=>a+(b.amount-b.cost), 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">業務</div>
          <h1 className="h1">訂單追蹤</h1>
          <div className="sub">{state.orders.length} 筆訂單 · 小計 {fmtMoney(totalAmt,true)} · 毛利 {fmtMoney(totalProfit,true)}</div>
        </div>
        <div className="topbar-r">
          <button className="btn btn-ghost"><Icon name="download" size={14}/> 匯出</button>
          <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={14}/> 新增訂單</button>
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:14 }}>
          <div style={{ position:'relative', flex:'1 1 240px', minWidth:200 }}>
            <Icon name="search" size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--ink-mute)' }}/>
            <input className="input has-leading-icon" placeholder="搜尋客戶、產品或訂單編號…" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['全部','待處理','進行中','出貨中','已完成','已取消'].map(s =>(
              <button key={s} className={'btn btn-sm '+(filter===s?'btn-ink':'btn-ghost')} onClick={()=>setFilter(s)}>
                {s} {s!=='全部' && <span style={{ opacity:0.7, marginLeft:2 }}>{tallies[s]||0}</span>}
              </button>
            ))}
          </div>
        </div>

        <table className="tbl desk-only">
          <thead>
            <tr>
              <th>訂單編號 / 產品</th><th>客戶</th><th>狀態</th>
              <th style={{ textAlign:'right' }}>金額</th>
              <th style={{ textAlign:'right' }}>毛利</th>
              <th style={{ textAlign:'right' }}>交期</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const profit = o.amount - o.cost;
              const pct = o.amount ? Math.round(profit/o.amount*100) : 0;
              return (
                <tr key={o.id} className="clickable" onClick={()=>openEdit(o)}>
                  <td>
                    <div className="mono" style={{ fontSize:11, color:'var(--ink-mute)' }}>{o.no}</div>
                    <div style={{ fontSize:13, marginTop:3, color:'var(--ink-soft)' }}>{o.product}</div>
                  </td>
                  <td style={{ fontWeight:600 }}>{o.client}</td>
                  <td><Pill tone={STATUS_COLOR[o.status]}>{o.status}</Pill></td>
                  <td className="num" style={{ fontWeight:700, color:'var(--ink)' }}>{fmtMoney(o.amount)}</td>
                  <td className="num">
                    <div style={{ color:'var(--moss)', fontWeight:600 }}>{fmtMoney(profit)}</div>
                    <div style={{ fontSize:10, color:'var(--ink-mute)' }}>{pct}%</div>
                  </td>
                  <td className="num" style={{ color:'var(--ink-mute)' }}>{fmtDateFull(o.date)}</td>
                  <td style={{ width:28, textAlign:'right' }}><Icon name="chevron" size={14} style={{ color:'var(--ink-faint)' }}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Mobile card list */}
        <div className="mob-cards">
          {filtered.map(o => {
            const profit = o.amount - o.cost;
            const pct = o.amount ? Math.round(profit/o.amount*100) : 0;
            return (
              <div key={o.id} className="mob-card" onClick={()=>openEdit(o)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div className="mono" style={{ fontSize:10, color:'var(--ink-mute)' }}>{o.no}</div>
                    <div style={{ fontSize:14, fontWeight:700, marginTop:2 }}>{o.client}</div>
                  </div>
                  <Pill tone={STATUS_COLOR[o.status]}>{o.status}</Pill>
                </div>
                <div style={{ fontSize:12, color:'var(--ink-soft)', lineHeight:1.5, marginBottom:8 }}>{o.product}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', paddingTop:8, borderTop:'1px dashed var(--rule-soft)' }}>
                  <div>
                    <div style={{ fontSize:10, color:'var(--ink-mute)' }}>交期 {fmtDateFull(o.date)}</div>
                    <div className="mono" style={{ fontSize:11, color:'var(--moss)', marginTop:2 }}>毛利 {fmtMoney(profit)} · {pct}%</div>
                  </div>
                  <div className="mono" style={{ fontSize:17, fontWeight:700 }}>{fmtMoney(o.amount)}</div>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length===0 && <EmptyState icon="orders" title="找不到符合的訂單" hint="試試清除搜尋條件或新增一筆訂單"/>}
      </div>

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)}
        title={editingId ? '編輯訂單' : '新增訂單'}
        footer={<>
          {editingId && <button className="btn btn-danger" onClick={delOrder}><Icon name="trash" size={13}/> 刪除</button>}
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={saveOrder}>{editingId?'儲存變更':'建立訂單'}</button>
        </>}
      >
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="row">
            <div className="field"><label>訂單編號</label><input className="input mono" value={form.no} onChange={e=>setForm({...form, no:e.target.value})}/></div>
            <div className="field"><label>狀態</label>
              <select className="select" value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
                <option>待處理</option><option>進行中</option><option>出貨中</option><option>已完成</option><option>已取消</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>客戶名稱<span className="req">*</span></label>
            <input className="input" list="customer-suggestions" value={form.client} onChange={e=>setForm({...form, client:e.target.value})}/>
            <datalist id="customer-suggestions">
              {state.customers.map(c=><option key={c.id} value={c.name}/>)}
            </datalist>
          </div>
          <div className="field"><label>產品／服務<span className="req">*</span></label><textarea className="textarea" value={form.product} onChange={e=>setForm({...form, product:e.target.value})}/></div>
          <div className="row-3">
            <div className="field"><label>金額</label><input className="input mono" type="number" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})}/></div>
            <div className="field"><label>成本</label><input className="input mono" type="number" value={form.cost} onChange={e=>setForm({...form, cost:e.target.value})}/></div>
            <div className="field"><label>交貨日</label><input className="input" type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/></div>
          </div>
          <div className="field"><label>備註</label><textarea className="textarea" value={form.note} onChange={e=>setForm({...form, note:e.target.value})}/></div>
        </div>
      </Modal>
    </div>
  );
};

// ═══ CRM ═══
const CRMView = ({ state, setState }) => {
  const [tier, setTier] = useStateO('全部');
  const [q, setQ] = useStateO('');
  const [modalOpen, setModalOpen] = useStateO(false);
  const [editingId, setEditingId] = useStateO(null);
  const [form, setForm] = useStateO({ name:'', tier:'B', phone:'', email:'', note:'' });

  const openNew = () => { setForm({ name:'', tier:'B', phone:'', email:'', note:'' }); setEditingId(null); setModalOpen(true); };
  const openEdit = (c) => { setForm({...c}); setEditingId(c.id); setModalOpen(true); };
  const save = () => {
    if (!form.name) { toast('請填寫客戶名稱'); return; }
    if (editingId) {
      setState(s=>({ ...s, customers: s.customers.map(c=>c.id===editingId?{...c, ...form}:c) }));
      toast('已更新');
    } else {
      setState(s=>({ ...s, customers: [{...form, id:uid(), orders:0, total:0, last:''}, ...s.customers] }));
      toast('已新增');
    }
    setModalOpen(false);
  };
  const del = () => {
    if (!confirm('刪除此客戶？將移至回收桶（保留 10 天）。')) return;
    setState(s=> window.softDel(s, 'customers', editingId));
    setModalOpen(false); toast('已移至回收桶');
  };

  const filtered = state.customers.filter(c => !c._deleted && (tier==='全部' || c.tier===tier) &&
    (!q || c.name.includes(q) || (c.email||'').includes(q)));

  const stats = {
    all: state.customers.filter(c=>!c._deleted).length,
    A: state.customers.filter(c=>!c._deleted && c.tier==='A').length,
    B: state.customers.filter(c=>!c._deleted && c.tier==='B').length,
    C: state.customers.filter(c=>!c._deleted && c.tier==='C').length,
    totalRev: state.customers.filter(c=>!c._deleted).reduce((a,b)=>a+b.total,0),
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">業務</div>
          <h1 className="h1">客戶管理</h1>
          <div className="sub">{stats.all} 位客戶 · 累計交易 {fmtMoney(stats.totalRev,true)}</div>
        </div>
        <div className="topbar-r">
          <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={14}/> 新增客戶</button>
        </div>
      </div>

      <div className="card flat" style={{ padding:0 }}>
        <div className="crm-stats" style={{ display:'grid' }}>
          <div className="stat"><span className="lab">A 級（VIP）</span><span className="val" style={{ color:'var(--clay)' }}>{stats.A}</span><span className="delta muted">重點維護</span></div>
          <div className="stat"><span className="lab">B 級</span><span className="val" style={{ color:'var(--sage)' }}>{stats.B}</span><span className="delta muted">穩定合作</span></div>
          <div className="stat"><span className="lab">C 級</span><span className="val" style={{ color:'var(--ink-mute)' }}>{stats.C}</span><span className="delta muted">偶爾接洽</span></div>
          <div className="stat"><span className="lab">累計交易額</span><span className="val mono-val">{fmtMoney(stats.totalRev, true)}</span><span className="delta muted">全客戶總和</span></div>
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:14 }}>
          <div style={{ position:'relative', flex:'1 1 240px', minWidth:200 }}>
            <Icon name="search" size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--ink-mute)' }}/>
            <input className="input has-leading-icon" placeholder="搜尋名稱或 Email…" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
          <Segmented options={[{value:'全部',label:'全部'},{value:'A',label:'A 級'},{value:'B',label:'B 級'},{value:'C',label:'C 級'}]} value={tier} onChange={setTier}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
          {filtered.map(c => (
            <div key={c.id} className="card flat" style={{ padding:16, cursor:'pointer', border:'1px solid var(--rule-soft)' }} onClick={()=>openEdit(c)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontFamily:'var(--f-serif)', fontSize:17, fontWeight:600, color:'var(--ink)' }}>{c.name}</div>
                  {c.note && <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:3, lineHeight:1.4 }}>{c.note}</div>}
                </div>
                <Pill tone={c.tier==='A'?'clay':c.tier==='B'?'sage':'outline'}>{c.tier} 級</Pill>
              </div>
              <div style={{ display:'flex', gap:8, flexDirection:'column', fontSize:12, color:'var(--ink-soft)', marginBottom:12 }}>
                {c.phone && <div style={{ display:'flex',gap:8, alignItems:'center' }}><Icon name="phone" size={12} style={{ color:'var(--ink-faint)' }}/>{c.phone}</div>}
                {c.email && <div style={{ display:'flex',gap:8, alignItems:'center' }}><Icon name="mail" size={12} style={{ color:'var(--ink-faint)' }}/>{c.email}</div>}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:'1px dashed var(--rule-soft)' }}>
                <div>
                  <div className="eyebrow" style={{ fontSize:9 }}>訂單</div>
                  <div className="mono" style={{ fontSize:15, fontWeight:700 }}>{c.orders}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="eyebrow" style={{ fontSize:9 }}>累計交易</div>
                  <div className="mono" style={{ fontSize:15, fontWeight:700, color:'var(--clay)' }}>{fmtMoney(c.total, true)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)}
        title={editingId?'編輯客戶':'新增客戶'}
        footer={<>
          {editingId && <button className="btn btn-danger" onClick={del}><Icon name="trash" size={13}/> 刪除</button>}
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={save}>儲存</button>
        </>}
      >
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>客戶名稱<span className="req">*</span></label><input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
          <div className="field">
            <label>等級</label>
            <div style={{ display:'flex', gap:6 }}>
              {['A','B','C'].map(t => (
                <button key={t} className={'btn btn-sm '+(form.tier===t?'btn-ink':'btn-ghost')} style={{ flex:1 }} onClick={()=>setForm({...form, tier:t})}>{t} 級</button>
              ))}
            </div>
          </div>
          <div className="row">
            <div className="field"><label>電話</label><input className="input" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></div>
            <div className="field"><label>Email</label><input className="input" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
          </div>
          <div className="field"><label>備註</label><textarea className="textarea" value={form.note} onChange={e=>setForm({...form, note:e.target.value})}/></div>
        </div>
      </Modal>
    </div>
  );
};

Object.assign(window, { OrdersView, CRMView });
