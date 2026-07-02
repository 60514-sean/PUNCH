// 碰器嚴選系統 — Product cost + Quote views
const { useState: useStateP, useMemo: useMemoP } = React;

// 數量級距：依數量取對應級距（取 minQty <= qty 的最高門檻級距）；無適用則回 null
function tierForQty(tiers, qty) {
  if (!Array.isArray(tiers) || !tiers.length) return null;
  const q = Number(qty) || 0;
  const hit = tiers
    .filter(t => Number(t.minQty) > 0 && q >= Number(t.minQty))
    .sort((a, b) => Number(b.minQty) - Number(a.minQty));
  return hit.length ? hit[0] : null;
}

const ProductsView = ({ state, setState, coll='products', sectionLabel='資源', viewTitle='產品管理', itemLabel='產品', showCostsTab=true }) => {
  const [tab, setTab] = useStateP('saved'); // saved | costs
  const [viewMode, setViewMode] = useStateP('grid'); // list | grid
  const [photoView, setPhotoView] = useStateP(''); // 點縮圖放大
  const [q, setQ] = useStateP('');
  const [modalOpen, setModalOpen] = useStateP(false);
  const [editingId, setEditingId] = useStateP(null);
  const [form, setForm] = useStateP(emptyP());
  // 成本控管 modal
  const [costModalOpen, setCostModalOpen] = useStateP(false);
  const [costEditingId, setCostEditingId] = useStateP(null);
  const [costForm, setCostForm] = useStateP(emptyCost());
  // 編輯產品 modal 內各區塊收合狀態
  const [secOpen, setSecOpen] = useStateP({ direct:true, indirect:true, tiers:true });
  const toggleSec = (k) => setSecOpen(s => ({ ...s, [k]: !s[k] }));
  // 產品 modal 內的庫存快速異動表單
  const emptyStockAdj = () => ({ type:'add', qty:'', note:'', date:new Date().toISOString().slice(0,10) });
  const [stockAdj, setStockAdj] = useStateP(emptyStockAdj());
  const linkableStocks = state.stocks.filter(s=>!s._deleted && s.kind==='goods').sort((a,b)=>strokeCollatorCH.compare(a.name, b.name));
  const linkedStock = state.stocks.find(s=>s.id===form.stockId && !s._deleted);
  const applyStockAdj = () => {
    if (!linkedStock) return;
    const q = Number(stockAdj.qty)||0;
    if (!q && stockAdj.type!=='set') { toast('請輸入數量'); return; }
    const date = stockAdj.date || new Date().toISOString().slice(0,10);
    setState(s=>{
      const newStocks = s.stocks.map(x=>{
        if (x.id!==linkedStock.id) return x;
        let nq = x.qty;
        if (stockAdj.type==='add') nq = x.qty + q;
        else if (stockAdj.type==='sub') nq = Math.max(0, x.qty - q);
        else nq = q;
        return { ...x, qty: nq, updated: date };
      });
      const log = { id:uid(), stockId:linkedStock.id, name:linkedStock.name, type: stockAdj.type==='sub'?'out':(stockAdj.type==='add'?'in':'adj'), qty:q, note:stockAdj.note, date };
      return { ...s, stocks:newStocks, logs:[log, ...s.logs] };
    });
    toast('庫存已更新');
    setStockAdj(emptyStockAdj());
  };

  function emptyP(){ return { id:'', name:'', spec:'', photo:'', direct:0, indirect:0, directItems:[], indirectItems:[], price:'', minPrice:'', tiers:[], stockId:'' }; }
  function emptyCost(){ return { id:'', kind:'direct', name:'', unit:'', price:'' }; }

  // 升級舊版明細（只有 n + a）→ 新版（n + unit_q[量詞文字] + unit_p + qty + a）
  // 邏輯：舊資料的 a 視為 unit_p，unit_q 是量詞文字（個/條/包），qty 預設 1
  const upgradeItems = (arr) => (arr||[]).map(it => ({
    n: it.n || '',
    unit_q: typeof it.unit_q === 'string' ? it.unit_q : '',
    unit_p: it.unit_p != null ? (Number(it.unit_p) || 0) : (Number(it.a) || 0),
    qty:    it.qty    != null ? (Number(it.qty)    || 1) : 1,
    a:      it.a      != null ? (Number(it.a)      || 0) : 0,
  }));

  const openNew = () => { setForm(emptyP()); setEditingId(null); setStockAdj(emptyStockAdj()); setModalOpen(true); };
  const openEdit = (p) => { setForm({...p, directItems:upgradeItems(p.directItems), indirectItems:upgradeItems(p.indirectItems)}); setEditingId(p.id); setStockAdj(emptyStockAdj()); setModalOpen(true); };
  // 複製現有設定為新項目（不直接寫入資料，需按儲存才會新增）
  const duplicateP = (p) => {
    setForm({ ...p, id:'', name: p.name+'（複製）', stockId:'', directItems:upgradeItems(p.directItems), indirectItems:upgradeItems(p.indirectItems) });
    setEditingId(null);
    setStockAdj(emptyStockAdj());
    setModalOpen(true);
    toast('已複製設定，修改後按儲存即為新'+itemLabel);
  };

  const sumItems = (arr) => (arr||[]).reduce((a,b)=>a+(Number(b.a)||0),0);
  const directSum = sumItems(form.directItems);
  const indirectSum = sumItems(form.indirectItems);
  const directEff = (form.directItems||[]).length ? directSum : Number(form.direct)||0;
  const indirectEff = (form.indirectItems||[]).length ? indirectSum : Number(form.indirect)||0;

  // 小計 = 單價 × 數量（單位量為量詞文字，不參與計算）
  const recalcA = (it) => {
    const up = Number(it.unit_p ?? 0) || 0;
    const q  = Number(it.qty    ?? 1) || 0;
    return up * q;
  };

  const addItem = (kind) => setForm(f => ({ ...f, [kind+'Items']: [...(f[kind+'Items']||[]), { n:'', unit_q:'', unit_p:0, qty:1, a:0 }] }));

  const updItem = (kind, i, k, v) => setForm(f => ({
    ...f,
    [kind+'Items']: (f[kind+'Items']||[]).map((x, idx) => {
      if (idx !== i) return x;
      const numFields = ['unit_p', 'qty', 'a'];
      const newVal = numFields.includes(k) ? (Number(v) || 0) : v;
      const updated = { ...x, [k]: newVal };
      // 單價/數量變動 → 自動重算小計
      if (k === 'unit_p' || k === 'qty') {
        updated.a = recalcA(updated);
      }
      return updated;
    })
  }));

  // 名稱輸入時若完整匹配「成本控管」中該分類的成本項目，自動帶入單位與單價並重算小計
  const pickStockForItem = (kind, i, name) => setForm(f => ({
    ...f,
    [kind+'Items']: (f[kind+'Items']||[]).map((x,idx) => {
      if (idx !== i) return x;
      const trimmed = (name || '').trim();
      const cost = (state.productCosts || []).find(c => !c._deleted && c.kind === kind && c.name === trimmed);
      if (cost) {
        const updated = {
          ...x,
          n: name,
          unit_q: cost.unit || x.unit_q || '',
          unit_p: Number(cost.price) || 0, // 一律覆寫成成本單價
        };
        updated.a = recalcA(updated);
        return updated;
      }
      return { ...x, n: name };
    })
  }));

  // ─── 成本控管 CRUD ───
  const openNewCost = () => { setCostForm(emptyCost()); setCostEditingId(null); setCostModalOpen(true); };
  const openEditCost = (c) => { setCostForm({...c}); setCostEditingId(c.id); setCostModalOpen(true); };
  const saveCost = () => {
    if (!costForm.name) { toast('請填寫成本名稱'); return; }
    const rec = { ...costForm, price: Number(costForm.price) || 0 };
    if (costEditingId) {
      setState(s => ({ ...s, productCosts: (s.productCosts || []).map(x => x.id === costEditingId ? rec : x) }));
    } else {
      setState(s => ({ ...s, productCosts: [{ ...rec, id: uid() }, ...(s.productCosts || [])] }));
    }
    toast(costEditingId ? '已更新' : '已新增');
    setCostModalOpen(false);
  };
  const delCost = () => {
    if (!confirm('刪除此成本？將移至回收桶（保留 10 天）。')) return;
    setState(s => window.softDel(s, 'productCosts', costEditingId));
    setCostModalOpen(false); toast('已移至回收桶');
  };

  const delItem = (kind, i) => setForm(f => ({ ...f, [kind+'Items']: (f[kind+'Items']||[]).filter((_,idx)=>idx!==i) }));

  // ─── 數量級距（量價表）CRUD ───
  const addTier = () => setForm(f => ({ ...f, tiers:[...(f.tiers||[]), { minQty:'', cost:'', price:'' }] }));
  const updTier = (i,k,v) => setForm(f => ({ ...f, tiers:(f.tiers||[]).map((x,idx)=> idx===i ? {...x, [k]:v} : x) }));
  const delTier = (i) => setForm(f => ({ ...f, tiers:(f.tiers||[]).filter((_,idx)=>idx!==i) }));

  const save = () => {
    if (!form.name || !form.price) { toast('請填寫名稱與售價'); return; }
    const tiers = (form.tiers||[])
      .filter(t => Number(t.minQty) > 0)
      .map(t => ({ minQty:Number(t.minQty)||0, cost:Number(t.cost)||0, price:Number(t.price)||0 }))
      .sort((a,b)=> a.minQty - b.minQty);
    const rec = { ...form, direct:directEff, indirect:indirectEff, price:Number(form.price)||0, minPrice:Number(form.minPrice)||0, tiers };
    if (editingId) setState(s=>({ ...s, [coll]: (s[coll]||[]).map(x=>x.id===editingId?rec:x) }));
    else setState(s=>({ ...s, [coll]: [{...rec, id:uid()}, ...(s[coll]||[])] }));
    toast(editingId?'已更新':'已新增');
    setModalOpen(false);
  };
  const del = () => { if(!confirm('刪除此'+itemLabel+'？將移至回收桶（保留 10 天）。'))return; setState(s=> window.softDel(s, coll, editingId)); setModalOpen(false); toast('已移至回收桶'); };

  // aggregated stats
  const stats = useMemoP(()=>{
    const ps = (state[coll]||[]).filter(x => !x._deleted);
    if (!ps.length) return { grossAvg:0, netAvg:0, count:0 };
    const gross = ps.reduce((a,p)=> a + (p.price-p.direct)/(p.price||1)*100, 0)/ps.length;
    const net = ps.reduce((a,p)=> a + (p.price-p.direct-p.indirect)/(p.price||1)*100, 0)/ps.length;
    return { grossAvg:Math.round(gross), netAvg:Math.round(net), count:ps.length };
  }, [state[coll]]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">{sectionLabel}</div>
          <h1 className="h1">{viewTitle}</h1>
          <div className="sub">{stats.count} 項{itemLabel} · 平均毛利 {stats.grossAvg}% / 淨利 {stats.netAvg}%</div>
        </div>
        <div className="topbar-r">
          {tab==='saved' && <button className="btn btn-primary btn-sm" onClick={openNew}><Icon name="plus" size={14}/> 新增{itemLabel}</button>}
          {tab==='costs' && <button className="btn btn-primary btn-sm" onClick={openNewCost}><Icon name="plus" size={14}/> 新增成本</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:6, flexWrap:'nowrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1 1 0', minWidth:60 }}>
          <Icon name="search" size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ink-mute)' }}/>
          <input className="input has-leading-icon" placeholder={tab==='saved'?('搜尋'+itemLabel+'…'):'搜尋成本…'} value={q} onChange={e=>setQ(e.target.value)}
            style={{ padding:'6px 11px 6px 30px', fontSize:13, borderRadius:7, width:'100%' }}/>
        </div>
        {showCostsTab && <select className="select" value={tab} onChange={e=>setTab(e.target.value)}
                style={{ flexShrink:0, width:115, padding:'7px 26px 7px 10px', fontSize:13 }}>
          <option value="saved">儲存{itemLabel}</option>
          <option value="costs">物料成本</option>
        </select>}
        <select className="select" value={viewMode} onChange={e=>setViewMode(e.target.value)}
                style={{ flexShrink:0, width:90, padding:'7px 26px 7px 10px', fontSize:13 }}>
          <option value="list">列表</option>
          <option value="grid">網格</option>
          <option value="text">文字</option>
        </select>
      </div>

      {tab==='saved' && (() => {
        const filtered = (state[coll]||[]).filter(p =>
          !p._deleted && (!q || p.name.includes(q) || (p.spec||'').includes(q)));
        return (
        <div className="card">
          {viewMode === 'grid' && (
            <div className="stock-grid">
              {filtered.map(p => {
                const tc = p.direct + p.indirect;
                const gross = p.price ? Math.round((p.price-p.direct)/p.price*100) : 0;
                const net = p.price ? Math.round((p.price-tc)/p.price*100) : 0;
                const st = p.stockId ? state.stocks.find(s=>s.id===p.stockId && !s._deleted) : null;
                return (
                  <div key={p.id} className="card flat" style={{ border:'1px solid var(--rule-soft)', padding:14, cursor:'pointer', position:'relative' }} onClick={()=>openEdit(p)}>
                    <button className="btn btn-ghost btn-sm" title="複製" style={{ position:'absolute', top:8, right:8, zIndex:1, padding:'4px 6px', background:'var(--paper)' }} onClick={(e)=>{ e.stopPropagation(); duplicateP(p); }}><Icon name="copy" size={12}/></button>
                    <div style={{ width:'100%', height:130, borderRadius:8, overflow:'hidden', background:'var(--paper-deep)', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {p.photo
                        ? <img src={cldThumb(p.photo, 400)} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : <Icon name="image" size={28}/>}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:10 }}>
                      <div style={{ minWidth:0, flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:700, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.3 }}>{p.name}</div>
                        {p.spec && <div style={{ fontSize:13, color:'var(--ink-mute)' }}>{p.spec}</div>}
                        {st && <div style={{ fontSize:11, marginTop:4 }}><span className="muted">庫存 </span><strong className="mono" style={{ color: st.qty<=st.min?'var(--terracotta)':'var(--ink)' }}>{st.qty}</strong></div>}
                      </div>
                      <div className="mono" style={{ fontSize:17, fontWeight:700, color:'var(--clay)', flexShrink:0 }}>{fmtMoney(p.price)}</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'10px 0 8px', borderTop:'1px dashed var(--rule-soft)' }}>
                      <div><div className="eyebrow">總成本</div><div className="mono" style={{ fontSize:14, fontWeight:700 }}>{fmtMoney(Math.round(tc))}</div></div>
                      <div style={{ textAlign:'right' }}><div className="eyebrow">淨利</div><div className="mono" style={{ fontSize:14, fontWeight:700, color:net>=20?'var(--moss)':'var(--terracotta)' }}>{fmtMoney(Math.round(p.price-tc))}</div></div>
                    </div>
                    <div style={{ display:'flex', gap:12, fontSize:13, flexWrap:'wrap' }}>
                      <span><span className="muted">毛利 </span><strong className="mono" style={{ color:'var(--sage)' }}>{gross}%</strong></span>
                      <span><span className="muted">淨利 </span><strong className="mono" style={{ color:'var(--clay)' }}>{net}%</strong></span>
                      {p.minPrice>0 && <span style={{ marginLeft:'auto' }} className="muted">底價 {fmtMoney(p.minPrice)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === 'list' && <>
            <table className="tbl desk-only">
              <thead><tr>
                <th>{itemLabel}</th>
                <th style={{textAlign:'right'}}>總成本</th>
                <th style={{textAlign:'right'}}>售價</th>
                <th style={{textAlign:'right'}}>毛利 / 淨利</th>
                <th style={{ width:60 }}></th>
              </tr></thead>
              <tbody>
                {filtered.map(p => {
                  const tc = p.direct + p.indirect;
                  const gross = p.price ? Math.round((p.price-p.direct)/p.price*100) : 0;
                  const net = p.price ? Math.round((p.price-tc)/p.price*100) : 0;
                  const st = p.stockId ? state.stocks.find(s=>s.id===p.stockId && !s._deleted) : null;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <PhotoThumb url={p.photo} size={64} alt={p.name} onClick={()=>p.photo && setPhotoView(p.photo)}/>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontWeight:600 }}>{p.name}</div>
                            {p.spec && <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2 }}>{p.spec}</div>}
                            {st && <div style={{ fontSize:11, marginTop:2 }}><span className="muted">庫存 </span><strong className="mono" style={{ color: st.qty<=st.min?'var(--terracotta)':'var(--ink)' }}>{st.qty}</strong></div>}
                          </div>
                        </div>
                      </td>
                      <td className="num">{fmtMoney(Math.round(tc))}</td>
                      <td className="num" style={{ fontWeight:700, color:'var(--clay)' }}>{fmtMoney(p.price)}</td>
                      <td className="num" style={{ fontSize:12, fontWeight:700 }}>
                        <span style={{ color:'var(--sage)' }}>{gross}%</span>
                        <span style={{ color:'var(--ink-mute)', fontWeight:400 }}> / </span>
                        <span style={{ color:'var(--clay)' }}>{net}%</span>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" title="複製" onClick={()=>duplicateP(p)}><Icon name="copy" size={12}/></button>
                          <button className="btn btn-ghost btn-sm" title="編輯" onClick={()=>openEdit(p)}><Icon name="edit" size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mob-cards">
              {filtered.map(p => {
                const tc = p.direct + p.indirect;
                const gross = p.price ? Math.round((p.price-p.direct)/p.price*100) : 0;
                const net = p.price ? Math.round((p.price-tc)/p.price*100) : 0;
                return (
                  <div key={p.id} className="mob-card" style={{ cursor:'default' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <PhotoThumb url={p.photo} size={88} alt={p.name} onClick={()=>p.photo && setPhotoView(p.photo)}/>
                      <div style={{ minWidth:0, flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700 }}>{p.name}</div>
                        {p.spec && <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2 }}>{p.spec}</div>}
                        <div className="mono" style={{ marginTop:6, display:'flex', alignItems:'baseline', gap:6 }}>
                          <span style={{ fontSize:12, color:'var(--ink-mute)' }}>成本</span>
                          <span style={{ fontSize:14, fontWeight:700 }}>{fmtMoney(Math.round(tc))}</span>
                          <span style={{ flex:1 }}/>
                          <span style={{ fontSize:20, fontWeight:700, color:'var(--clay)' }}>{fmtMoney(p.price)}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10, paddingTop:8, borderTop:'1px dashed var(--rule-soft)' }}>
                      <span style={{ fontSize:12 }}><span className="muted">毛利 </span><strong className="mono" style={{ color:'var(--sage)' }}>{gross}%</strong></span>
                      <span style={{ fontSize:12 }}><span className="muted">淨利 </span><strong className="mono" style={{ color:'var(--clay)' }}>{net}%</strong></span>
                      {p.minPrice>0 && <span style={{ fontSize:11, color:'var(--ink-mute)' }}>底價 {fmtMoney(p.minPrice)}</span>}
                      <div style={{ flex:1 }}/>
                      <button className="btn btn-ghost btn-sm" title="複製" onClick={()=>duplicateP(p)}><Icon name="copy" size={11}/></button>
                      <button className="btn btn-ghost btn-sm" title="編輯" onClick={()=>openEdit(p)}><Icon name="edit" size={11}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>}
          {viewMode === 'text' && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[...filtered].sort((a,b)=>(a.name||'').localeCompare(b.name||'','zh-Hant',{ numeric:true, sensitivity:'base' })).map(p => {
                const tc = p.direct + p.indirect;
                const gross = p.price ? Math.round((p.price-p.direct)/p.price*100) : 0;
                const net = p.price ? Math.round((p.price-tc)/p.price*100) : 0;
                return (
                  <div key={p.id} className="text-row">
                    <div className="text-row-info">
                      <span style={{ fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                      {p.spec && <span style={{ fontSize:11, color:'var(--ink-mute)' }}>{p.spec}</span>}
                      <span className="mono" style={{ fontSize:11, color:'var(--ink-mute)' }}>成本 {fmtMoney(Math.round(tc))}</span>
                      <span className="mono" style={{ color:'var(--clay)', fontWeight:700, fontSize:14 }}>{fmtMoney(p.price)}</span>
                      <span style={{ fontSize:11, color:'var(--ink-mute)' }}>
                        毛 <strong className="mono" style={{ color:'var(--sage)' }}>{gross}%</strong>
                        {' / 淨 '}<strong className="mono" style={{ color:'var(--clay)' }}>{net}%</strong>
                      </span>
                    </div>
                    <div className="text-row-actions">
                      <button className="btn btn-ghost btn-sm" title="複製" style={{ padding:'4px 8px', fontSize:12 }} onClick={()=>duplicateP(p)}><Icon name="copy" size={11}/></button>
                      <button className="btn btn-ghost btn-sm" title="編輯" style={{ padding:'4px 8px', fontSize:12 }} onClick={()=>openEdit(p)}><Icon name="edit" size={11}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length===0 && <EmptyState icon="product" title={q?('查無符合'+itemLabel):('尚無'+itemLabel)}/>}
          <PhotoLightbox url={photoView} onClose={()=>setPhotoView('')}/>
        </div>
        );
      })()}

      {tab==='costs' && (() => {
        const allCosts = (state.productCosts || []).filter(c => !c._deleted);
        const filteredCosts = allCosts.filter(c => !q || c.name.includes(q) || (c.unit||'').includes(q));
        const directCosts = filteredCosts.filter(c => c.kind === 'direct');
        const indirectCosts = filteredCosts.filter(c => c.kind === 'indirect');

        const renderListRow = (c) => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:'1px solid var(--rule-soft)', borderRadius:8, cursor:'pointer' }}
               onClick={()=>openEditCost(c)}>
            <div style={{ flex:'1 1 0', minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
              {c.unit && <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2 }}>單位 {c.unit}</div>}
            </div>
            <div className="mono" style={{ flexShrink:0, textAlign:'right' }}>
              <div className="eyebrow">單價</div>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--clay)' }}>{fmtMoney(c.price)}</div>
            </div>
          </div>
        );

        const renderGridCard = (c) => (
          <div key={c.id} style={{ border:'1px solid var(--rule-soft)', borderRadius:10, padding:12, cursor:'pointer', background:'var(--paper-soft)', display:'flex', flexDirection:'column', gap:6 }}
               onClick={()=>openEditCost(c)}>
            <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
            <div className="mono" style={{ display:'flex', alignItems:'baseline', gap:4 }}>
              <span style={{ fontSize:16, fontWeight:700, color:'var(--clay)' }}>{fmtMoney(c.price)}</span>
              {c.unit && <span style={{ fontSize:11, color:'var(--ink-mute)' }}>/ {c.unit}</span>}
            </div>
          </div>
        );

        const renderTextRow = (c) => (
          <div key={c.id} className="text-row" style={{ cursor:'pointer' }} onClick={()=>openEditCost(c)}>
            <div className="text-row-info">
              <span style={{ fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
              {c.unit && <span style={{ fontSize:11, color:'var(--ink-mute)' }}>單位 {c.unit}</span>}
              <span className="mono" style={{ color:'var(--clay)', fontWeight:700, fontSize:14 }}>{fmtMoney(c.price)}</span>
            </div>
            <div className="text-row-actions">
              <button className="btn btn-ghost btn-sm" title="編輯" style={{ padding:'4px 8px', fontSize:12 }} onClick={(e)=>{e.stopPropagation();openEditCost(c);}}><Icon name="edit" size={11}/></button>
            </div>
          </div>
        );

        const renderSection = (costs, emptyMsg) => {
          if (costs.length === 0) return <div style={{ fontSize:11, color:'var(--ink-faint)', padding:'6px 0' }}>{emptyMsg}</div>;
          if (viewMode === 'grid') return <div className="stock-grid">{costs.map(renderGridCard)}</div>;
          if (viewMode === 'text') return <div style={{ display:'flex', flexDirection:'column', gap:6 }}>{[...costs].sort((a,b)=>(a.name||'').localeCompare(b.name||'','zh-Hant',{ numeric:true, sensitivity:'base' })).map(renderTextRow)}</div>;
          return <div style={{ display:'flex', flexDirection:'column', gap:6 }}>{costs.map(renderListRow)}</div>;
        };

        return (
          <div className="card">
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-soft)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                直接成本（原料、燃料） <span style={{ fontWeight:400, color:'var(--ink-mute)' }}>共 {directCosts.length} 項</span>
              </div>
              {renderSection(directCosts, '尚未新增任何直接成本')}
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-soft)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                間接成本（人工、包材） <span style={{ fontWeight:400, color:'var(--ink-mute)' }}>共 {indirectCosts.length} 項</span>
              </div>
              {renderSection(indirectCosts, '尚未新增任何間接成本')}
            </div>
            {allCosts.length===0 && <EmptyState icon="product" title="尚無成本項目" hint="點上方「新增成本」開始建立"/>}
          </div>
        );
      })()}

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editingId?('編輯'+itemLabel):('新增'+itemLabel)}
        footer={<>
          {editingId && <button className="btn btn-danger" onClick={del}><Icon name="trash" size={13}/> 刪除</button>}
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={save}>儲存</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* 來源由「庫存管理」改為「成本控管」：依 cost.kind 過濾 */}
          <datalist id="products-stock-direct">
            {(state.productCosts || []).filter(c=>!c._deleted && c.kind==='direct').map(c=>(
              <option key={c.id} value={c.name}/>
            ))}
          </datalist>
          <datalist id="products-stock-indirect">
            {(state.productCosts || []).filter(c=>!c._deleted && c.kind==='indirect').map(c=>(
              <option key={c.id} value={c.name}/>
            ))}
          </datalist>
          <div className="field"><label>商品照片</label><PhotoUpload value={form.photo} onChange={(url)=>setForm({...form, photo:url})} size={120}/></div>
          <div className="field"><label>{itemLabel}名稱<span className="req">*</span></label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
          <div className="field"><label>規格</label><input className="input" value={form.spec} onChange={e=>setForm({...form,spec:e.target.value})}/></div>
          <div className="row-keep">
            <div className="field"><label>售價<span className="req">*</span></label><input className="input mono" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div>
            <div className="field"><label>最低售價</label><input className="input mono" type="number" value={form.minPrice} onChange={e=>setForm({...form,minPrice:e.target.value})}/></div>
          </div>

          {/* 庫存管理連結：同一頁看成本也看庫存 */}
          <div style={{ padding:12, background:'var(--paper-deep)', borderRadius:8 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-soft)', marginBottom:8 }}>庫存管理連結</div>
            <select className="select" value={form.stockId} onChange={e=>setForm({...form, stockId:e.target.value})}>
              <option value="">— 不連結庫存品項 —</option>
              {linkableStocks.map(s=><option key={s.id} value={s.id}>{s.name}（現有 {s.qty}）</option>)}
            </select>
            {form.stockId && !linkedStock && <div style={{ fontSize:11, color:'var(--terracotta)', marginTop:6 }}>找不到此庫存品項（可能已刪除），請重新連結</div>}
            {linkedStock && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px dashed var(--rule-soft)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:12, color:'var(--ink-mute)' }}>目前庫存</div>
                  <div className="mono" style={{ fontSize:18, fontWeight:700, color: linkedStock.qty<=linkedStock.min ? 'var(--terracotta)':'var(--ink)' }}>
                    {linkedStock.qty} <span style={{ fontSize:11, color:'var(--ink-mute)', fontWeight:400 }}>/ 底線 {linkedStock.min} {linkedStock.unit}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                  {[['add','進貨 +'],['sub','出貨 -'],['set','盤點設為']].map(([v,l])=>(
                    <button key={v} type="button" className={'btn btn-sm '+(stockAdj.type===v?'btn-ink':'btn-ghost')} style={{ flex:1 }} onClick={()=>setStockAdj({...stockAdj, type:v})}>{l}</button>
                  ))}
                </div>
                <div className="row">
                  <div className="field"><label>數量</label><input className="input mono" type="number" value={stockAdj.qty} onChange={e=>setStockAdj({...stockAdj,qty:e.target.value})}/></div>
                  <div className="field"><label>日期</label><input className="input" type="date" value={stockAdj.date} onChange={e=>setStockAdj({...stockAdj,date:e.target.value})}/></div>
                </div>
                <div className="field"><label>備註</label><input className="input" value={stockAdj.note} onChange={e=>setStockAdj({...stockAdj,note:e.target.value})}/></div>
                <button type="button" className="btn btn-ink btn-sm" style={{ width:'100%', marginTop:4 }} onClick={applyStockAdj}>套用庫存異動</button>
              </div>
            )}
          </div>

          {/* Direct cost items */}
          <div style={{ padding:12, background:'var(--paper-deep)', borderRadius:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: secOpen.direct?8:0, cursor:'pointer' }} onClick={()=>toggleSec('direct')}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-soft)', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ transition:'transform .2s', transform: secOpen.direct?'rotate(90deg)':'rotate(0)', fontSize:10 }}>▶</span>
                直接成本明細 <span className="muted" style={{ fontWeight:400 }}>（原料、燃料）</span>
                {!secOpen.direct && <span className="mono muted" style={{ fontWeight:400 }}>　小計 {fmtMoney(directEff)}</span>}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={(e)=>{ e.stopPropagation(); setSecOpen(s=>({...s,direct:true})); addItem('direct'); }}><Icon name="plus" size={11}/> 加入項目</button>
            </div>
            <div style={{ display: secOpen.direct?'block':'none' }}>
            {(form.directItems||[]).map((it,i)=>(
              <div key={i} style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8, padding:8, background:'var(--paper-soft)', borderRadius:6, border:'1px solid var(--rule-soft)' }}>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input className="input" style={{ flex:1, padding:'6px 9px', fontSize:12 }} placeholder="項目（可選庫存或自填）" value={it.n} list="products-stock-direct" onChange={e=>pickStockForItem('direct',i,e.target.value)}/>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding:'4px', flexShrink:0 }} onClick={()=>delItem('direct',i)}><Icon name="close" size={11}/></button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:6 }}>
                  <div><div style={{ fontSize:10, color:'var(--ink-mute)', marginBottom:2 }}>單位量</div><input className="input" style={{ padding:'4px 7px', fontSize:11, width:'100%' }} type="text" placeholder="個/條/包" value={it.unit_q || ''} onChange={e=>updItem('direct',i,'unit_q',e.target.value)}/></div>
                  <div><div style={{ fontSize:10, color:'var(--ink-mute)', marginBottom:2 }}>單價</div><input className="input mono" style={{ padding:'4px 7px', fontSize:11, width:'100%' }} type="number" value={it.unit_p ?? 0} onChange={e=>updItem('direct',i,'unit_p',e.target.value)}/></div>
                  <div><div style={{ fontSize:10, color:'var(--ink-mute)', marginBottom:2 }}>數量</div><input className="input mono" style={{ padding:'4px 7px', fontSize:11, width:'100%' }} type="number" value={it.qty ?? 1} onChange={e=>updItem('direct',i,'qty',e.target.value)}/></div>
                  <div><div style={{ fontSize:10, color:'var(--ink-mute)', marginBottom:2 }}>小計</div><input className="input mono" style={{ padding:'4px 7px', fontSize:11, width:'100%', background:'var(--paper-deep)', fontWeight:700 }} type="number" value={it.a ?? 0} readOnly/></div>
                </div>
              </div>
            ))}
            {(form.directItems||[]).length===0 && <div style={{ fontSize:11, color:'var(--ink-faint)', padding:'6px 0' }}>尚未加入明細，可直接填寫下方總額</div>}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, paddingTop:8, borderTop:'1px dashed var(--rule-soft)' }}>
              {(form.directItems||[]).length>0 ? (
                <>
                  <span style={{ fontSize:11, color:'var(--ink-mute)' }}>共 {form.directItems.length} 項</span>
                  <span className="mono" style={{ fontSize:13, fontWeight:700 }}>小計 {fmtMoney(directSum)}</span>
                </>
              ) : (
                <div className="field" style={{ flex:1, display:'flex', flexDirection:'row', alignItems:'center', gap:8 }}>
                  <label style={{ flexShrink:0 }}>直接成本總額</label>
                  <input className="input mono" style={{ flex:1, padding:'6px 9px', fontSize:12 }} type="number" value={form.direct} onChange={e=>setForm({...form,direct:e.target.value})}/>
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Indirect cost items */}
          <div style={{ padding:12, background:'var(--paper-deep)', borderRadius:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: secOpen.indirect?8:0, cursor:'pointer' }} onClick={()=>toggleSec('indirect')}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-soft)', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ transition:'transform .2s', transform: secOpen.indirect?'rotate(90deg)':'rotate(0)', fontSize:10 }}>▶</span>
                間接成本明細 <span className="muted" style={{ fontWeight:400 }}>（人工、包材）</span>
                {!secOpen.indirect && <span className="mono muted" style={{ fontWeight:400 }}>　小計 {fmtMoney(indirectEff)}</span>}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={(e)=>{ e.stopPropagation(); setSecOpen(s=>({...s,indirect:true})); addItem('indirect'); }}><Icon name="plus" size={11}/> 加入項目</button>
            </div>
            <div style={{ display: secOpen.indirect?'block':'none' }}>
            {(form.indirectItems||[]).map((it,i)=>(
              <div key={i} style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8, padding:8, background:'var(--paper-soft)', borderRadius:6, border:'1px solid var(--rule-soft)' }}>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input className="input" style={{ flex:1, padding:'6px 9px', fontSize:12 }} placeholder="項目（可選庫存或自填）" value={it.n} list="products-stock-indirect" onChange={e=>pickStockForItem('indirect',i,e.target.value)}/>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding:'4px', flexShrink:0 }} onClick={()=>delItem('indirect',i)}><Icon name="close" size={11}/></button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:6 }}>
                  <div><div style={{ fontSize:10, color:'var(--ink-mute)', marginBottom:2 }}>單位量</div><input className="input" style={{ padding:'4px 7px', fontSize:11, width:'100%' }} type="text" placeholder="個/條/包" value={it.unit_q || ''} onChange={e=>updItem('indirect',i,'unit_q',e.target.value)}/></div>
                  <div><div style={{ fontSize:10, color:'var(--ink-mute)', marginBottom:2 }}>單價</div><input className="input mono" style={{ padding:'4px 7px', fontSize:11, width:'100%' }} type="number" value={it.unit_p ?? 0} onChange={e=>updItem('indirect',i,'unit_p',e.target.value)}/></div>
                  <div><div style={{ fontSize:10, color:'var(--ink-mute)', marginBottom:2 }}>數量</div><input className="input mono" style={{ padding:'4px 7px', fontSize:11, width:'100%' }} type="number" value={it.qty ?? 1} onChange={e=>updItem('indirect',i,'qty',e.target.value)}/></div>
                  <div><div style={{ fontSize:10, color:'var(--ink-mute)', marginBottom:2 }}>小計</div><input className="input mono" style={{ padding:'4px 7px', fontSize:11, width:'100%', background:'var(--paper-deep)', fontWeight:700 }} type="number" value={it.a ?? 0} readOnly/></div>
                </div>
              </div>
            ))}
            {(form.indirectItems||[]).length===0 && <div style={{ fontSize:11, color:'var(--ink-faint)', padding:'6px 0' }}>尚未加入明細，可直接填寫下方總額</div>}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, paddingTop:8, borderTop:'1px dashed var(--rule-soft)' }}>
              {(form.indirectItems||[]).length>0 ? (
                <>
                  <span style={{ fontSize:11, color:'var(--ink-mute)' }}>共 {form.indirectItems.length} 項</span>
                  <span className="mono" style={{ fontSize:13, fontWeight:700 }}>小計 {fmtMoney(indirectSum)}</span>
                </>
              ) : (
                <div className="field" style={{ flex:1, display:'flex', flexDirection:'row', alignItems:'center', gap:8 }}>
                  <label style={{ flexShrink:0 }}>間接成本總額</label>
                  <input className="input mono" style={{ flex:1, padding:'6px 9px', fontSize:12 }} type="number" value={form.indirect} onChange={e=>setForm({...form,indirect:e.target.value})}/>
                </div>
              )}
            </div>
            </div>
          </div>

          {/* 數量級距（量價表）*/}
          <div style={{ padding:12, background:'var(--paper-deep)', borderRadius:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: secOpen.tiers?8:0, cursor:'pointer' }} onClick={()=>toggleSec('tiers')}>
              <label style={{ margin:0, fontWeight:600, display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                <span style={{ transition:'transform .2s', transform: secOpen.tiers?'rotate(90deg)':'rotate(0)', fontSize:10 }}>▶</span>
                數量級距（量價表）
                {!secOpen.tiers && (form.tiers||[]).length>0 && <span className="muted" style={{ fontWeight:400, fontSize:12 }}>　{form.tiers.length} 級</span>}
              </label>
              <button className="btn btn-ink btn-sm" onClick={(e)=>{ e.stopPropagation(); setSecOpen(s=>({...s,tiers:true})); addTier(); }}><Icon name="plus" size={12}/> 新增級距</button>
            </div>
            <div style={{ display: secOpen.tiers?'block':'none' }}>
            {(form.tiers||[]).length === 0 ? (
              <div style={{ fontSize:12, color:'var(--ink-mute)' }}>未設級距時，報價一律用上方的售價／成本。</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 32px', gap:6, fontSize:11, color:'var(--ink-mute)' }}>
                  <div>數量 ≥</div><div>成本</div><div>售價</div><div></div>
                </div>
                {(form.tiers||[]).map((t,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 32px', gap:6, alignItems:'center' }}>
                    <input className="input mono" type="number" value={t.minQty} onChange={e=>updTier(i,'minQty',e.target.value)} placeholder="數量"/>
                    <input className="input mono" type="number" value={t.cost} onChange={e=>updTier(i,'cost',e.target.value)} placeholder="成本"/>
                    <input className="input mono" type="number" value={t.price} onChange={e=>updTier(i,'price',e.target.value)} placeholder="售價"/>
                    <button className="btn btn-ghost btn-sm" onClick={()=>delTier(i)}><Icon name="close" size={12}/></button>
                  </div>
                ))}
                <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2 }}>報價填數量時，自動套用「達標的最高一級」；未達最低門檻則用上方售價／成本。</div>
              </div>
            )}
            </div>
          </div>
          {form.price>0 && (
            <div style={{ padding:12, background:'var(--clay-tint)', borderRadius:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
              <div><span className="muted">總成本 </span><strong className="mono">{fmtMoney(Math.round(directEff+indirectEff))}</strong></div>
              <div style={{ textAlign:'right' }}><span className="muted">售價 </span><strong className="mono">{fmtMoney(form.price)}</strong></div>
              <div><span className="muted">毛利 </span><strong className="mono" style={{ color:'var(--moss)' }}>{fmtMoney(form.price-directEff)} ({Math.round((form.price-directEff)/form.price*100)}%)</strong></div>
              <div style={{ textAlign:'right' }}><span className="muted">淨利 </span><strong className="mono" style={{ color:'var(--clay)', fontWeight:700 }}>{fmtMoney(Math.round(form.price-directEff-indirectEff))} ({Math.round((form.price-directEff-indirectEff)/form.price*100)}%)</strong></div>
            </div>
          )}
        </div>
      </Modal>

      {/* 成本項目 新增/編輯 Modal */}
      <Modal open={costModalOpen} onClose={()=>setCostModalOpen(false)} title={costEditingId?'編輯成本':'新增成本'}
        footer={<>
          {costEditingId && <button className="btn btn-danger" onClick={delCost}><Icon name="trash" size={13}/> 刪除</button>}
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setCostModalOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={saveCost}>儲存</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="field"><label>分類</label>
            <select className="select" value={costForm.kind} onChange={e=>setCostForm({...costForm, kind:e.target.value})}>
              <option value="direct">直接成本（原料、燃料）</option>
              <option value="indirect">間接成本（人工、包材）</option>
            </select>
          </div>
          <div className="field"><label>名稱<span className="req">*</span></label>
            <input className="input" value={costForm.name} onChange={e=>setCostForm({...costForm, name:e.target.value})} placeholder="例：玫瑰精油 / 包裝人工"/>
          </div>
          <div className="row-keep">
            <div className="field"><label>單位（量詞）</label>
              <input className="input" type="text" placeholder="個 / 條 / 包 / 小時" value={costForm.unit} onChange={e=>setCostForm({...costForm, unit:e.target.value})}/>
            </div>
            <div className="field"><label>單價</label>
              <input className="input mono" type="number" value={costForm.price} onChange={e=>setCostForm({...costForm, price:e.target.value})}/>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
};

// ═══ QUOTES ═══
const QuotesView = ({ state, setState }) => {
  const [current, setCurrent] = useStateP(emptyQ());
  const [qItem, setQItem] = useStateP({ name:'', spec:'', qty:1, price:0, cost:0, photo:'' });
  const [previewOpen, setPreviewOpen] = useStateP(false);
  const [listOpen, setListOpen] = useStateP(false);
  const [companyOpen, setCompanyOpen] = useStateP(false);
  const [customerOpen, setCustomerOpen] = useStateP(false);
  const [itemsOpen, setItemsOpen] = useStateP(false);
  const [totalOpen, setTotalOpen] = useStateP(false);

  function emptyQ(){
    const today = new Date().toISOString().slice(0,10);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('bangqi_myco') || '{}'); } catch(e){}
    return { id:'', num:'QT-'+today.replace(/-/g,''), date:today, valid:'',
      myco: saved.myco || '碰器有限公司',
      myAddress: saved.myAddress || '台南市永康區忠生路一段100號',
      myTaxId: saved.myTaxId || '94063787',
      myName: saved.myName || '康竣傑',
      myPhone: saved.myPhone || '0903-993-359',
      myEmail: saved.myEmail || 'sean605147@gmail.com',
      client:'', cAddress:'', cName:'', cPhone:'', cEmail:'',
      note: saved.note || '付款方式：50% 訂金、50% 交貨。\n有效期限請以本單為準。',
      tax:5, items:[] };
  }

  // When user edits 'my company' fields, persist
  React.useEffect(()=>{
    localStorage.setItem('bangqi_myco', JSON.stringify({
      myco: current.myco, myAddress: current.myAddress, myTaxId: current.myTaxId,
      myName: current.myName, myPhone: current.myPhone, myEmail: current.myEmail,
      note: current.note,
    }));
  }, [current.myco, current.myAddress, current.myTaxId, current.myName, current.myPhone, current.myEmail, current.note]);

  // 從指定清單（產品庫或選品配件）帶入，自動套用售價/成本/照片/級距
  const pickFrom = (list, name) => {
    const p = (list||[]).find(x => x.name === name);
    if (!p) { setQItem(q => ({ ...q, name })); return; }
    const baseCost = (Number(p.direct)||0) + (Number(p.indirect)||0);
    const tiers = Array.isArray(p.tiers) ? p.tiers : [];
    setQItem(q => {
      const tier = tierForQty(tiers, q.qty);
      return {
        ...q, name,
        spec:  p.spec  || q.spec,
        photo: p.photo || q.photo,
        tiers, basePrice: Number(p.price)||0, baseCost,
        price: tier ? tier.price : (Number(p.price)||q.price),
        cost:  tier ? tier.cost  : (baseCost||q.cost),
      };
    });
  };
  const pickProduct = (name) => pickFrom(state.products, name);

  // 改數量時：若該品項有級距，自動套對應級距的售價／成本（未達門檻回基礎價）
  const setQItemQty = (v) => setQItem(q => {
    const next = { ...q, qty: v };
    if (Array.isArray(q.tiers) && q.tiers.length) {
      const tier = tierForQty(q.tiers, v);
      next.price = tier ? tier.price : (q.basePrice != null ? q.basePrice : q.price);
      next.cost  = tier ? tier.cost  : (q.baseCost  != null ? q.baseCost  : q.cost);
    }
    return next;
  });

  const addItem = () => {
    if (!qItem.name) { toast('請填寫品項名稱'); return; }
    setCurrent({...current, items:[...current.items, {...qItem, qty:Number(qItem.qty)||1, price:Number(qItem.price)||0, cost:Number(qItem.cost)||0}]});
    setQItem({ name:'', spec:'', qty:1, price:0, cost:0, photo:'' });
  };
  const delItem = (i) => setCurrent({...current, items: current.items.filter((_,idx)=>idx!==i)});

  const subtotal = current.items.reduce((a,b)=>a+b.qty*b.price,0);
  const totalCost = current.items.reduce((a,b)=>a+b.qty*b.cost,0);
  const taxAmt = Math.round(subtotal * (Number(current.tax)||0)/100);
  const grand = subtotal + taxAmt;
  const profit = subtotal - totalCost;

  const saveQuote = () => {
    if (!current.client || !current.items.length) { toast('需要客戶與至少一項品項'); return; }
    const rec = {...current, id: current.id||uid(), grand};
    setState(s=>{
      const exists = s.quotes.find(x=>x.id===rec.id);
      return { ...s, quotes: exists ? s.quotes.map(x=>x.id===rec.id?rec:x) : [rec, ...s.quotes] };
    });
    setCurrent(rec);
    toast('已儲存');
  };
  const loadQuote = (q) => { setCurrent({...q}); setListOpen(false); toast('已載入報價'); };
  const newQuote = () => setCurrent(emptyQ());

  // 動態載入 html2canvas（首次使用才下載）
  const _loadH2C = () => new Promise((resolve, reject) => {
    if (window.html2canvas) return resolve(window.html2canvas);
    if (document.querySelector('script[data-h2c]')) {
      const t = setInterval(() => { if (window.html2canvas) { clearInterval(t); resolve(window.html2canvas); } }, 50);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.dataset.h2c = '1';
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error('html2canvas load failed'));
    document.head.appendChild(s);
  });

  // 下載報價圖片（手機優先用 Web Share 讓使用者存到相簿；桌面觸發瀏覽器下載對話框）
  const downloadQuoteImage = async () => {
    try {
      const h2c = await _loadH2C();
      const sheet = document.querySelector('.quote-a4');
      if (!sheet) { toast('找不到預覽'); return; }
      // 截圖前先把 transform 取消，避免被 scale 影響截圖尺寸
      const wrap = sheet.parentElement;
      const prevT = sheet.style.transform;
      const prevH = wrap?.style.height;
      sheet.style.transform = '';
      if (wrap) wrap.style.height = 'auto';
      const canvas = await h2c(sheet, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      sheet.style.transform = prevT;
      if (wrap) wrap.style.height = prevH;
      const filename = `碰器估價單-${current.client||'未指定'}-${current.date||''}.jpg`.replace(/[\\/:*?"<>|]/g,'_');
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
      // 手機 + Web Share API（包含「儲存影像」可存到相簿）
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && navigator.share && navigator.canShare) {
        const file = new File([blob], filename, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: '碰器估價單' });
            return;
          } catch (e) { if (e.name === 'AbortError') return; }
        }
      }
      // 桌面 / Web Share 不支援 → 觸發瀏覽器下載（瀏覽器設定為「每次都詢問」時會跳儲存對話框）
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch {} }, 2000);
      toast('已下載圖片');
    } catch (e) {
      console.error('[quote download]', e);
      toast('下載失敗：' + (e?.message || e));
    }
  };

  // 預覽開啟時，依 viewport 寬度自動縮放 A4 sheet 顯示
  React.useEffect(() => {
    if (!previewOpen) return;
    const fit = () => {
      const wrap = document.querySelector('.quote-preview-scale');
      const sheet = wrap?.querySelector('.quote-a4');
      if (!wrap || !sheet) return;
      const SHEET_W_PX = 794; // 210mm @ ~96dpi
      const avail = wrap.parentElement.clientWidth - 4;
      const scale = Math.min(1, avail / SHEET_W_PX);
      sheet.style.transform = `scale(${scale})`;
      sheet.style.transformOrigin = 'top left';
      wrap.style.width = SHEET_W_PX + 'px';
      wrap.style.height = (sheet.offsetHeight * scale) + 'px'; // 依實際內容高度（長圖自適應）
    };
    const t = setTimeout(fit, 50);
    window.addEventListener('resize', fit);
    return () => { clearTimeout(t); window.removeEventListener('resize', fit); };
  }, [previewOpen]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">業務</div>
          <h1 className="h1">報價單</h1>
          <div className="sub">{state.quotes.length} 筆歷史報價</div>
        </div>
        <div className="topbar-r">
          <button className="btn btn-ghost" onClick={()=>setListOpen(true)}>歷史報價</button>
          <button className="btn btn-ghost" onClick={newQuote}>新報價</button>
          <button className="btn btn-primary" onClick={saveQuote}>儲存</button>
        </div>
      </div>

      <div className="grid-2-1-p">
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* 公司資訊 */}
          <div className="card">
            <div className="card-head" style={{ cursor:'pointer', userSelect:'none' }} onClick={()=>setCompanyOpen(o=>!o)}>
              <div className="card-title">公司資訊</div>
              <div className="card-subtle" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'var(--ink-mute)' }}>{current.myco || '點擊展開填寫'}</span>
                <span style={{ display:'inline-block', transition:'transform .2s', transform: companyOpen?'rotate(90deg)':'rotate(0)' }}>▶</span>
              </div>
            </div>
            <div style={{ display: companyOpen?'flex':'none', flexDirection:'column', gap:12, marginTop:12 }}>
              <div className="row-keep">
                <div className="field"><label>報價單編號</label><input className="input mono" value={current.num} onChange={e=>setCurrent({...current,num:e.target.value})}/></div>
                <div className="field"><label>報價日期</label><input className="input" type="date" value={current.date} onChange={e=>setCurrent({...current,date:e.target.value})}/></div>
              </div>
              <hr className="hr-soft"/>
              <div className="row-keep">
                <div className="field"><label>我方公司</label><input className="input" value={current.myco} onChange={e=>setCurrent({...current,myco:e.target.value})}/></div>
                <div className="field"><label>統一編號</label><input className="input mono" value={current.myTaxId||''} onChange={e=>setCurrent({...current,myTaxId:e.target.value})}/></div>
              </div>
              <div className="row-keep">
                <div className="field"><label>姓名</label><input className="input" value={current.myName} onChange={e=>setCurrent({...current,myName:e.target.value})}/></div>
                <div className="field"><label>電話</label><input className="input" value={current.myPhone} onChange={e=>setCurrent({...current,myPhone:e.target.value})}/></div>
              </div>
              <div className="field"><label>我方地址</label><input className="input" value={current.myAddress||''} onChange={e=>setCurrent({...current,myAddress:e.target.value})}/></div>
              <div className="field"><label>Email</label><input className="input" value={current.myEmail} onChange={e=>setCurrent({...current,myEmail:e.target.value})}/></div>
            </div>
          </div>

          {/* 客戶資訊 */}
          <div className="card">
            <div className="card-head" style={{ cursor:'pointer', userSelect:'none' }} onClick={()=>setCustomerOpen(o=>!o)}>
              <div className="card-title">客戶資訊</div>
              <div className="card-subtle" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'var(--ink-mute)' }}>{current.client || '點擊展開填寫'}</span>
                <span style={{ display:'inline-block', transition:'transform .2s', transform: customerOpen?'rotate(90deg)':'rotate(0)' }}>▶</span>
              </div>
            </div>
            <div style={{ display: customerOpen?'flex':'none', flexDirection:'column', gap:12, marginTop:12 }}>
              <div className="field"><label>客戶名稱<span className="req">*</span></label>
                <input className="input" list="quote-clients" value={current.client} onChange={e=>setCurrent({...current,client:e.target.value})}/>
                <datalist id="quote-clients">{state.customers.filter(c=>!c._deleted).map(c=><option key={c.id} value={c.name}/>)}</datalist>
              </div>
              <div className="field"><label>客戶地址</label><input className="input" value={current.cAddress||''} onChange={e=>setCurrent({...current,cAddress:e.target.value})}/></div>
              <div className="row-keep">
                <div className="field"><label>聯絡人</label><input className="input" value={current.cName} onChange={e=>setCurrent({...current,cName:e.target.value})}/></div>
                <div className="field"><label>電話</label><input className="input" value={current.cPhone} onChange={e=>setCurrent({...current,cPhone:e.target.value})}/></div>
              </div>
              <div className="field"><label>客戶 Email</label><input className="input" value={current.cEmail} onChange={e=>setCurrent({...current,cEmail:e.target.value})}/></div>
              <div className="row-keep">
                <div className="field"><label>有效期限</label><input className="input" type="date" value={current.valid} onChange={e=>setCurrent({...current,valid:e.target.value})}/></div>
                <div className="field"><label>稅率 %</label><input className="input mono" type="number" value={current.tax} onChange={e=>setCurrent({...current,tax:e.target.value})}/></div>
              </div>
              <div className="field"><label>備註</label><textarea className="textarea" value={current.note} onChange={e=>setCurrent({...current,note:e.target.value})}/></div>
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ cursor:'pointer', userSelect:'none' }} onClick={()=>setItemsOpen(o=>!o)}>
              <div className="card-title">報價品項</div>
              <div className="card-subtle" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'var(--ink-mute)' }}>{current.items.length} 項{current.items.length?` · 小計 ${fmtMoney(subtotal)}`:''}</span>
                <span style={{ display:'inline-block', transition:'transform .2s', transform: itemsOpen?'rotate(90deg)':'rotate(0)' }}>▶</span>
              </div>
            </div>
            <div style={{ display: itemsOpen?'block':'none', marginTop:12 }}>
            <div style={{ background:'var(--paper-deep)', padding:12, borderRadius:8, marginBottom:12 }}>
              <div className="field" style={{ marginBottom:10 }}>
                <label>從產品庫快速帶入（選擇後自動填入名稱、規格、單價、成本）</label>
                <select className="select" value="" onChange={e=>{
                  const name = e.target.value;
                  if (!name) return;
                  pickFrom(state.products, name);
                  e.target.value = '';
                }}>
                  <option value="">— 選擇已儲存產品 —</option>
                  {(state.products||[]).filter(p=>!p._deleted).map(p=>(
                    <option key={p.id} value={p.name}>{p.name}{p.spec?` · ${p.spec}`:''}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom:10 }}>
                <label>從選品配件帶入（附加項目）</label>
                <select className="select" value="" onChange={e=>{
                  const name = e.target.value;
                  if (!name) return;
                  pickFrom(state.accessories, name);
                  e.target.value = '';
                }}>
                  <option value="">— 選擇選品配件 —</option>
                  {(state.accessories||[]).filter(p=>!p._deleted).map(p=>(
                    <option key={p.id} value={p.name}>{p.name}{p.spec?` · ${p.spec}`:''}</option>
                  ))}
                </select>
              </div>
              <div className="row" style={{ marginBottom:10 }}>
                <div className="field"><label>品項名稱</label><input className="input" value={qItem.name} onChange={e=>setQItem({...qItem,name:e.target.value})} placeholder="或手動輸入"/></div>
                <div className="field"><label>規格</label><input className="input" value={qItem.spec} onChange={e=>setQItem({...qItem,spec:e.target.value})}/></div>
              </div>
              <div className="field" style={{ marginBottom:10 }}><label>商品照片（從產品帶入會自動填入，可換）</label>
                <PhotoUpload value={qItem.photo} onChange={(url)=>setQItem({...qItem, photo:url})} size={96}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                <div className="field" style={{ minWidth:0 }}><label>數量</label><input className="input mono" type="number" value={qItem.qty} onChange={e=>setQItemQty(e.target.value)} style={{ width:'100%' }}/></div>
                <div className="field" style={{ minWidth:0 }}><label>單價</label><input className="input mono" type="number" value={qItem.price} onChange={e=>setQItem({...qItem,price:e.target.value})} style={{ width:'100%' }}/></div>
                <div className="field" style={{ minWidth:0 }}><label>成本</label><input className="input mono" type="number" value={qItem.cost} onChange={e=>setQItem({...qItem,cost:e.target.value})} style={{ width:'100%' }}/></div>
              </div>
              {Array.isArray(qItem.tiers) && qItem.tiers.length>0 && (()=>{
                const t = tierForQty(qItem.tiers, qItem.qty);
                return <div style={{ fontSize:11, color:'var(--moss)', marginBottom:6 }}>
                  {t ? `已套用級距：數量 ≥${t.minQty} → 單價 ${fmtMoney(t.price)}（成本 ${fmtMoney(t.cost)}）`
                     : `數量未達最低級距，使用基礎售價`}
                </div>;
              })()}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span className="mono" style={{ color:'var(--clay)', fontWeight:700 }}>小計 {fmtMoney(qItem.qty*qItem.price)}</span>
                <button className="btn btn-ink btn-sm" onClick={addItem}><Icon name="plus" size={12}/> 加入品項</button>
              </div>
            </div>

            {current.items.length>0 ? (
              <table className="tbl">
                <thead><tr><th>品項</th><th style={{textAlign:'right'}}>數量</th><th style={{textAlign:'right'}}>單價</th><th style={{textAlign:'right'}}>小計</th><th></th></tr></thead>
                <tbody>
                  {current.items.map((it,i)=>(
                    <tr key={i}>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {it.photo && <PhotoThumb url={it.photo} size={36} alt={it.name}/>}
                        <div><div style={{ fontWeight:600 }}>{it.name}</div>{it.spec && <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{it.spec}</div>}</div>
                      </div></td>
                      <td className="num">{it.qty}</td>
                      <td className="num">{fmtMoney(it.price)}</td>
                      <td className="num" style={{ fontWeight:700 }}>{fmtMoney(it.qty*it.price)}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={()=>delItem(i)}><Icon name="close" size={12}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState icon="quote" title="尚未加入品項"/>}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="card" style={{ alignSelf:'flex-start', position:'sticky', top:16 }}>
          <div className="card-head" style={{ cursor:'pointer', userSelect:'none' }} onClick={()=>setTotalOpen(o=>!o)}>
            <div className="card-title">總計</div>
            <div className="card-subtle" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span className="mono" style={{ fontWeight:700, color:'var(--clay)' }}>{fmtMoney(grand)}</span>
              <span style={{ display:'inline-block', transition:'transform .2s', transform: totalOpen?'rotate(90deg)':'rotate(0)' }}>▶</span>
            </div>
          </div>
          <div style={{ display: totalOpen?'flex':'none', flexDirection:'column', gap:8, fontSize:13, marginTop:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span className="muted">總成本</span><span className="mono">{fmtMoney(totalCost)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span className="muted">小計</span><span className="mono">{fmtMoney(subtotal)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span className="muted">稅額 ({current.tax}%)</span><span className="mono">{fmtMoney(taxAmt)}</span></div>
            <hr className="hr-soft"/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'var(--f-serif)', fontSize:16, fontWeight:600, color:'var(--clay)' }}>合計</span>
              <span className="mono" style={{ fontSize:24, fontWeight:700, color:'var(--clay)' }}>{fmtMoney(grand)}</span>
            </div>
            <div style={{ textAlign:'right', fontSize:11, color:'var(--moss)', fontFamily:'var(--f-mono)' }}>
              利潤率 {subtotal?Math.round(profit/subtotal*100):0}% · 毛利 {fmtMoney(profit)}
            </div>
          </div>
          <hr className="hr-soft" style={{ margin:'14px 0' }}/>
          <button className="btn btn-primary" style={{ width:'100%', marginBottom:8 }} onClick={saveQuote}><Icon name="check" size={14}/> 儲存報價單</button>
          <button className="btn btn-ghost" style={{ width:'100%' }} onClick={()=>setPreviewOpen(true)}><Icon name="eye" size={14}/> 預覽 / 下載</button>
        </div>
      </div>

      {/* Preview modal */}
      <Modal open={previewOpen} onClose={()=>setPreviewOpen(false)} title="報價單預覽 (A4)" width={840}
        footer={<><div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setPreviewOpen(false)}>關閉</button>
          <button className="btn btn-primary" onClick={downloadQuoteImage}><Icon name="download" size={13}/> 下載圖片</button>
        </>}>
        <div style={{ overflow:'auto', maxWidth:'100%' }}>
          <div className="quote-preview-scale">
            <QuotePreview q={current} subtotal={subtotal} taxAmt={taxAmt} grand={grand}/>
          </div>
        </div>
      </Modal>

      {/* History modal */}
      <Modal open={listOpen} onClose={()=>setListOpen(false)} title="歷史報價"
        footer={<><div style={{flex:1}}/><button className="btn btn-ghost" onClick={()=>setListOpen(false)}>關閉</button></>}>
        {state.quotes.length===0 ? <EmptyState icon="quote" title="尚無儲存的報價"/> :
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {state.quotes.map(q=>(
              <div key={q.id} style={{ padding:12, border:'1px solid var(--rule-soft)', borderRadius:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div>
                    <div className="mono" style={{ fontSize:11, color:'var(--clay)', fontWeight:700 }}>{q.num}</div>
                    <div style={{ fontWeight:600, marginTop:2 }}>{q.client}</div>
                    <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{q.date} · {q.items.length} 項</div>
                  </div>
                  <div className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--clay)' }}>{fmtMoney(q.grand)}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>loadQuote(q)}>載入</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>{ if(confirm('刪除？')){ setState(s=>({...s,quotes:s.quotes.filter(x=>x.id!==q.id)})); toast('已刪除'); } }}>刪除</button>
                </div>
              </div>
            ))}
          </div>
        }
      </Modal>
    </div>
  );
};

const QuotePreview = ({ q, subtotal, taxAmt, grand }) => {
  const taxLabel = `${q.tax || 0}%營業稅`;
  return (
    <div className="quote-a4" style={{
      width:'210mm', minHeight:'297mm', boxSizing:'border-box',
      padding:'16mm 14mm 14mm', background:'#fff', color:'#1a1a1a',
      fontFamily:"'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif",
      fontSize:'10.5pt', lineHeight:1.5,
      display:'flex', flexDirection:'column', gap:'4mm',
      boxShadow:'0 8px 32px rgba(0,0,0,0.12)',
    }}>
      {/* Title */}
      <div style={{ textAlign:'center', paddingBottom:'4mm', borderBottom:'2.2pt solid #1a1a1a', position:'relative' }}>
        <div style={{ fontSize:'24pt', fontWeight:700, letterSpacing:'10pt', paddingLeft:'10pt' }}>碰器 估價單</div>
        <div style={{ fontSize:'9pt', letterSpacing:'4pt', color:'#a08858', marginTop:'1.5mm', fontFamily:"'JetBrains Mono','Courier New',monospace" }}>QUOTATION</div>
        <div style={{ position:'absolute', left:0, right:0, bottom:'-1.2pt', height:'0.8pt', background:'#c0a060' }}/>
      </div>

      {/* Client info block */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', columnGap:'8mm', rowGap:'2mm', padding:'2mm 0' }}>
        <div><span style={{color:'#7a6f55', letterSpacing:'1pt'}}>客戶名稱：</span><span style={{fontWeight:700}}>{q.client||'　'}</span></div>
        <div><span style={{color:'#7a6f55', letterSpacing:'1pt'}}>電　　話：</span><span>{q.cPhone||'　'}</span></div>
        <div><span style={{color:'#7a6f55', letterSpacing:'1pt'}}>地　　址：</span><span>{q.cAddress||'　'}</span></div>
        <div><span style={{color:'#7a6f55', letterSpacing:'1pt'}}>日　　期：</span><span style={{fontFamily:"'JetBrains Mono',monospace"}}>{q.date||'　'}</span></div>
        <div><span style={{color:'#7a6f55', letterSpacing:'1pt'}}>聯 絡 人：</span><span>{q.cName||'　'}</span></div>
        <div><span style={{color:'#7a6f55', letterSpacing:'1pt'}}>編　　號：</span><span style={{fontFamily:"'JetBrains Mono',monospace"}}>{q.num||'　'}</span></div>
      </div>

      {/* Items - 圖文卡片式（高度隨品項自適應）*/}
      <div style={{ marginTop:'1mm' }}>
        <div style={{ background:'#1a1a1a', color:'#fff', padding:'2mm 3mm', fontSize:'10pt', fontWeight:700, letterSpacing:'3pt', borderRadius:'1.5mm 1.5mm 0 0' }}>報 價 品 項</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'2.5mm', border:'0.5pt solid #1a1a1a', borderTop:'none', borderRadius:'0 0 1.5mm 1.5mm', padding:'3mm' }}>
          {q.items.map((it, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'stretch', gap:'4mm',
              border:'0.4pt solid #d8cfb8', borderRadius:'2mm',
              background: i % 2 === 1 ? '#fbf9f3' : '#fff',
              padding:'3mm', breakInside:'avoid',
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'7mm', flexShrink:0, color:'#9a8e75', fontFamily:"'JetBrains Mono',monospace", fontSize:'11pt', fontWeight:700 }}>{String(i+1).padStart(2,'0')}</div>
              <div style={{ width:'32mm', height:'32mm', flexShrink:0, borderRadius:'1.5mm', overflow:'hidden', background:'#f2ede0', border:'0.3pt solid #e0d8c4', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {it.photo
                  ? <img src={cldThumb(it.photo, 600)} crossOrigin="anonymous" alt={it.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                  : <span style={{ color:'#bdb49c', fontSize:'8pt', letterSpacing:'1pt' }}>無照片</span>}
              </div>
              <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', justifyContent:'center' }}>
                <div style={{ fontSize:'13pt', fontWeight:700, color:'#1a1a1a' }}>{it.name||''}</div>
                {it.spec && <div style={{ fontSize:'10pt', color:'#666', marginTop:'1mm', whiteSpace:'pre-line' }}>{it.spec}</div>}
                <div style={{ fontSize:'10pt', color:'#555', marginTop:'1.5mm', fontFamily:"'JetBrains Mono',monospace" }}>數量 {it.qty} × {fmtMoney(it.price)}</div>
              </div>
              <div style={{ alignSelf:'center', textAlign:'right', flexShrink:0, minWidth:'26mm' }}>
                <div style={{ fontSize:'8.5pt', color:'#999', letterSpacing:'1pt' }}>金額（未稅）</div>
                <div style={{ fontSize:'13pt', fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:'#1a1a1a' }}>{fmtMoney(it.qty*it.price)}</div>
              </div>
            </div>
          ))}
          {q.items.length === 0 && (
            <div style={{ padding:'12mm', textAlign:'center', color:'#bbb', fontSize:'10pt' }}>尚無品項</div>
          )}
        </div>
      </div>

      {/* Totals (right-aligned) */}
      <div style={{ marginLeft:'auto', width:'52%', marginTop:'2mm' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <tbody>
            <tr style={{ borderBottom:'0.4pt solid #c8c8c8' }}>
              <td style={{ padding:'2mm 3mm', fontSize:'10.5pt', color:'#444' }}>小　　計</td>
              <td style={{ padding:'2mm 3mm', textAlign:'right', fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(subtotal)}</td>
            </tr>
            <tr style={{ borderBottom:'0.4pt solid #c8c8c8' }}>
              <td style={{ padding:'2mm 3mm', fontSize:'10.5pt', color:'#444' }}>{taxLabel}</td>
              <td style={{ padding:'2mm 3mm', textAlign:'right', fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(taxAmt)}</td>
            </tr>
            <tr style={{ background:'#1a1a1a', color:'#fff' }}>
              <td style={{ padding:'2.5mm 3mm', fontSize:'12pt', fontWeight:700, letterSpacing:'2pt' }}>總　　計</td>
              <td style={{ padding:'2.5mm 3mm', textAlign:'right', fontSize:'14pt', fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>{fmtMoney(grand)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Note */}
      {q.note && (
        <div style={{ marginTop:'3mm', fontSize:'9.5pt', color:'#444', lineHeight:1.7 }}>
          <div style={{ fontWeight:700, color:'#1a1a1a', marginBottom:'1mm', letterSpacing:'1pt' }}>備　　註</div>
          <div style={{ whiteSpace:'pre-line', paddingLeft:'2mm', borderLeft:'2pt solid #c0a060' }}>{q.note}</div>
        </div>
      )}

      {/* Spacer pushes footer to bottom */}
      <div style={{ flex:1 }}/>

      {/* Footer - my company */}
      <div style={{ paddingTop:'4mm', borderTop:'1pt solid #1a1a1a', fontSize:'10pt', lineHeight:1.7 }}>
        <div style={{ fontWeight:700, fontSize:'12pt', letterSpacing:'2pt', marginBottom:'1.5mm' }}>{q.myco}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', columnGap:'8mm', rowGap:'1mm', fontSize:'10pt', color:'#444' }}>
          {q.myAddress && <div><span style={{color:'#777'}}>地　　址：</span>{q.myAddress}</div>}
          {q.myTaxId   && <div><span style={{color:'#777'}}>統一編號：</span><span style={{fontFamily:"'JetBrains Mono',monospace"}}>{q.myTaxId}</span></div>}
          {q.myName    && <div><span style={{color:'#777'}}>聯 絡 人：</span>{q.myName}</div>}
          {q.myPhone   && <div><span style={{color:'#777'}}>電　　話：</span><span style={{fontFamily:"'JetBrains Mono',monospace"}}>{q.myPhone}</span></div>}
          {q.myEmail   && <div style={{ gridColumn:'1 / -1' }}><span style={{color:'#777'}}>E-mail：</span><span style={{fontFamily:"'JetBrains Mono',monospace"}}>{q.myEmail}</span></div>}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ProductsView, QuotesView });
