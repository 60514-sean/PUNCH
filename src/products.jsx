// 碰器嚴選系統 — Product cost + Quote views
const { useState: useStateP, useMemo: useMemoP } = React;

const ProductsView = ({ state, setState }) => {
  const [tab, setTab] = useStateP('saved'); // saved | costs
  const [viewMode, setViewMode] = useStateP('grid'); // list | grid
  const [q, setQ] = useStateP('');
  const [modalOpen, setModalOpen] = useStateP(false);
  const [editingId, setEditingId] = useStateP(null);
  const [form, setForm] = useStateP(emptyP());
  // 成本控管 modal
  const [costModalOpen, setCostModalOpen] = useStateP(false);
  const [costEditingId, setCostEditingId] = useStateP(null);
  const [costForm, setCostForm] = useStateP(emptyCost());

  function emptyP(){ return { id:'', name:'', spec:'', direct:0, indirect:0, directItems:[], indirectItems:[], price:'', minPrice:'' }; }
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

  const openNew = () => { setForm(emptyP()); setEditingId(null); setModalOpen(true); };
  const openEdit = (p) => { setForm({...p, directItems:upgradeItems(p.directItems), indirectItems:upgradeItems(p.indirectItems)}); setEditingId(p.id); setModalOpen(true); };

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

  const save = () => {
    if (!form.name || !form.price) { toast('請填寫名稱與售價'); return; }
    const rec = { ...form, direct:directEff, indirect:indirectEff, price:Number(form.price)||0, minPrice:Number(form.minPrice)||0 };
    if (editingId) setState(s=>({ ...s, products: s.products.map(x=>x.id===editingId?rec:x) }));
    else setState(s=>({ ...s, products: [{...rec, id:uid()}, ...s.products] }));
    toast(editingId?'已更新':'已新增');
    setModalOpen(false);
  };
  const del = () => { if(!confirm('刪除此產品？將移至回收桶（保留 10 天）。'))return; setState(s=> window.softDel(s, 'products', editingId)); setModalOpen(false); toast('已移至回收桶'); };

  // aggregated stats
  const stats = useMemoP(()=>{
    const ps = state.products.filter(x => !x._deleted);
    if (!ps.length) return { grossAvg:0, netAvg:0, count:0 };
    const gross = ps.reduce((a,p)=> a + (p.price-p.direct)/(p.price||1)*100, 0)/ps.length;
    const net = ps.reduce((a,p)=> a + (p.price-p.direct-p.indirect)/(p.price||1)*100, 0)/ps.length;
    return { grossAvg:Math.round(gross), netAvg:Math.round(net), count:ps.length };
  }, [state.products]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">資源</div>
          <h1 className="h1">產品成本分析</h1>
          <div className="sub">{stats.count} 項產品 · 平均毛利 {stats.grossAvg}% / 淨利 {stats.netAvg}%</div>
        </div>
        <div className="topbar-r">
          {tab==='saved' && <button className="btn btn-primary btn-sm" onClick={openNew}><Icon name="plus" size={14}/> 新增產品</button>}
          {tab==='costs' && <button className="btn btn-primary btn-sm" onClick={openNewCost}><Icon name="plus" size={14}/> 新增成本</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:6, flexWrap:'nowrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1 1 0', minWidth:60 }}>
          <Icon name="search" size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ink-mute)' }}/>
          <input className="input has-leading-icon" placeholder={tab==='saved'?'搜尋產品…':'搜尋成本…'} value={q} onChange={e=>setQ(e.target.value)}
            style={{ padding:'6px 11px 6px 30px', fontSize:13, borderRadius:7, width:'100%' }}/>
        </div>
        <select className="select" value={tab} onChange={e=>setTab(e.target.value)}
                style={{ flexShrink:0, width:115, padding:'7px 26px 7px 10px', fontSize:13 }}>
          <option value="saved">儲存產品</option>
          <option value="costs">物料成本</option>
        </select>
        <select className="select" value={viewMode} onChange={e=>setViewMode(e.target.value)}
                style={{ flexShrink:0, width:90, padding:'7px 26px 7px 10px', fontSize:13 }}>
          <option value="list">列表</option>
          <option value="grid">網格</option>
          <option value="text">文字</option>
        </select>
      </div>

      {tab==='saved' && (() => {
        const filtered = state.products.filter(p =>
          !p._deleted && (!q || p.name.includes(q) || (p.spec||'').includes(q)));
        return (
        <div className="card">
          {viewMode === 'grid' && (
            <div className="stock-grid">
              {filtered.map(p => {
                const tc = p.direct + p.indirect;
                const gross = p.price ? Math.round((p.price-p.direct)/p.price*100) : 0;
                const net = p.price ? Math.round((p.price-tc)/p.price*100) : 0;
                return (
                  <div key={p.id} className="card flat" style={{ border:'1px solid var(--rule-soft)', padding:14, cursor:'pointer' }} onClick={()=>openEdit(p)}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:15, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                        {p.spec && <div style={{ fontSize:13, color:'var(--ink-mute)' }}>{p.spec}</div>}
                      </div>
                      <div className="mono" style={{ fontSize:17, fontWeight:700, color:'var(--clay)', flexShrink:0, marginLeft:8 }}>{fmtMoney(p.price)}</div>
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
          {viewMode === 'list' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filtered.map(p => {
                const tc = p.direct + p.indirect;
                const gross = p.price ? Math.round((p.price-p.direct)/p.price*100) : 0;
                const net = p.price ? Math.round((p.price-tc)/p.price*100) : 0;
                return (
                  <div key={p.id} style={{ border:'1px solid var(--rule-soft)', borderRadius:10, padding:'12px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }} onClick={()=>openEdit(p)}>
                    <div style={{ flex:'1 1 160px', minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                      {p.spec && <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.spec}</div>}
                    </div>
                    <div className="mono" style={{ flexShrink:0, textAlign:'right', minWidth:60 }}>
                      <div className="eyebrow">總成本</div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{fmtMoney(Math.round(tc))}</div>
                    </div>
                    <div className="mono" style={{ flexShrink:0, textAlign:'right', minWidth:60 }}>
                      <div className="eyebrow">售價</div>
                      <div style={{ fontSize:15, fontWeight:700, color:'var(--clay)' }}>{fmtMoney(p.price)}</div>
                    </div>
                    <div className="mono" style={{ flexShrink:0, textAlign:'right', minWidth:90 }}>
                      <div className="eyebrow">毛利 / 淨利</div>
                      <div style={{ fontSize:12, fontWeight:700 }}>
                        <span style={{ color:'var(--sage)' }}>{gross}%</span>
                        <span style={{ color:'var(--ink-mute)', fontWeight:400 }}> / </span>
                        <span style={{ color:'var(--clay)' }}>{net}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                      <button className="btn btn-ghost btn-sm" title="編輯" style={{ padding:'4px 8px', fontSize:12 }} onClick={()=>openEdit(p)}><Icon name="edit" size={11}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length===0 && <EmptyState icon="product" title={q?'查無符合產品':'尚無產品'}/>}
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

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editingId?'編輯產品':'新增產品'}
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
          <div className="field"><label>產品名稱<span className="req">*</span></label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
          <div className="field"><label>規格</label><input className="input" value={form.spec} onChange={e=>setForm({...form,spec:e.target.value})}/></div>
          {/* Direct cost items */}
          <div style={{ padding:12, background:'var(--paper-deep)', borderRadius:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-soft)' }}>直接成本明細 <span className="muted" style={{ fontWeight:400 }}>（原料、燃料）</span></div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={()=>addItem('direct')}><Icon name="plus" size={11}/> 加入項目</button>
            </div>
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

          {/* Indirect cost items */}
          <div style={{ padding:12, background:'var(--paper-deep)', borderRadius:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-soft)' }}>間接成本明細 <span className="muted" style={{ fontWeight:400 }}>（人工、包材）</span></div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={()=>addItem('indirect')}><Icon name="plus" size={11}/> 加入項目</button>
            </div>
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

          <div className="row-keep">
            <div className="field"><label>售價<span className="req">*</span></label><input className="input mono" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div>
            <div className="field"><label>最低售價</label><input className="input mono" type="number" value={form.minPrice} onChange={e=>setForm({...form,minPrice:e.target.value})}/></div>
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
  const [qItem, setQItem] = useStateP({ name:'', spec:'', qty:1, price:0, cost:0 });
  const [previewOpen, setPreviewOpen] = useStateP(false);
  const [listOpen, setListOpen] = useStateP(false);
  const [infoOpen, setInfoOpen] = useStateP(false);
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

  // Auto-fill price/cost when product name matches
  const pickProduct = (name) => {
    const p = state.products.find(x => x.name === name);
    if (p) setQItem(q => ({ ...q, name, spec: p.spec||q.spec, price: p.price||q.price, cost: (p.direct+p.indirect)||q.cost }));
    else setQItem(q => ({ ...q, name }));
  };

  const addItem = () => {
    if (!qItem.name) { toast('請填寫品項名稱'); return; }
    setCurrent({...current, items:[...current.items, {...qItem, qty:Number(qItem.qty)||1, price:Number(qItem.price)||0, cost:Number(qItem.cost)||0}]});
    setQItem({ name:'', spec:'', qty:1, price:0, cost:0 });
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
          <div className="card">
            <div className="card-head" style={{ cursor:'pointer', userSelect:'none' }} onClick={()=>setInfoOpen(o=>!o)}>
              <div className="card-title">基本資訊</div>
              <div className="card-subtle" style={{ display:'flex', alignItems:'center', gap:6 }}>
                {current.client ? <span style={{ color:'var(--ink-mute)' }}>{current.client}</span> : <span style={{ color:'var(--ink-mute)' }}>點擊展開填寫</span>}
                <span style={{ display:'inline-block', transition:'transform .2s', transform: infoOpen?'rotate(90deg)':'rotate(0)' }}>▶</span>
              </div>
            </div>
            <div style={{ display: infoOpen?'flex':'none', flexDirection:'column', gap:12, marginTop:12 }}>
              {/* 報價單基本 */}
              <div className="row">
                <div className="field"><label>報價單編號</label><input className="input mono" value={current.num} onChange={e=>setCurrent({...current,num:e.target.value})}/></div>
                <div className="field"><label>報價日期</label><input className="input" type="date" value={current.date} onChange={e=>setCurrent({...current,date:e.target.value})}/></div>
              </div>
              <hr className="hr-soft"/>
              {/* 本公司資訊 */}
              <div className="row">
                <div className="field"><label>我方公司</label><input className="input" value={current.myco} onChange={e=>setCurrent({...current,myco:e.target.value})}/></div>
                <div className="field"><label>統一編號</label><input className="input mono" value={current.myTaxId||''} onChange={e=>setCurrent({...current,myTaxId:e.target.value})}/></div>
              </div>
              <div className="row">
                <div className="field"><label>姓名</label><input className="input" value={current.myName} onChange={e=>setCurrent({...current,myName:e.target.value})}/></div>
                <div className="field"><label>電話</label><input className="input" value={current.myPhone} onChange={e=>setCurrent({...current,myPhone:e.target.value})}/></div>
              </div>
              <div className="field"><label>我方地址</label><input className="input" value={current.myAddress||''} onChange={e=>setCurrent({...current,myAddress:e.target.value})}/></div>
              <div className="field"><label>Email</label><input className="input" value={current.myEmail} onChange={e=>setCurrent({...current,myEmail:e.target.value})}/></div>
              <hr className="hr-soft"/>
              {/* 客戶資訊 */}
              <div className="field"><label>客戶名稱<span className="req">*</span></label>
                <input className="input" list="quote-clients" value={current.client} onChange={e=>setCurrent({...current,client:e.target.value})}/>
                <datalist id="quote-clients">{state.customers.filter(c=>!c._deleted).map(c=><option key={c.id} value={c.name}/>)}</datalist>
              </div>
              <div className="field"><label>客戶地址</label><input className="input" value={current.cAddress||''} onChange={e=>setCurrent({...current,cAddress:e.target.value})}/></div>
              <div className="row">
                <div className="field"><label>聯絡人</label><input className="input" value={current.cName} onChange={e=>setCurrent({...current,cName:e.target.value})}/></div>
                <div className="field"><label>電話</label><input className="input" value={current.cPhone} onChange={e=>setCurrent({...current,cPhone:e.target.value})}/></div>
              </div>
              <div className="field"><label>客戶 Email</label><input className="input" value={current.cEmail} onChange={e=>setCurrent({...current,cEmail:e.target.value})}/></div>
              <div className="row">
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
                  pickProduct(name);
                  e.target.value = '';
                }}>
                  <option value="">— 選擇已儲存產品 —</option>
                  {(state.products||[]).filter(p=>!p._deleted).map(p=>(
                    <option key={p.id} value={p.name}>{p.name}{p.spec?` · ${p.spec}`:''}</option>
                  ))}
                </select>
              </div>
              <div className="row" style={{ marginBottom:10 }}>
                <div className="field"><label>品項名稱</label><input className="input" value={qItem.name} onChange={e=>setQItem({...qItem,name:e.target.value})} placeholder="或手動輸入"/></div>
                <div className="field"><label>規格</label><input className="input" value={qItem.spec} onChange={e=>setQItem({...qItem,spec:e.target.value})}/></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                <div className="field" style={{ minWidth:0 }}><label>數量</label><input className="input mono" type="number" value={qItem.qty} onChange={e=>setQItem({...qItem,qty:e.target.value})} style={{ width:'100%' }}/></div>
                <div className="field" style={{ minWidth:0 }}><label>單價</label><input className="input mono" type="number" value={qItem.price} onChange={e=>setQItem({...qItem,price:e.target.value})} style={{ width:'100%' }}/></div>
                <div className="field" style={{ minWidth:0 }}><label>成本</label><input className="input mono" type="number" value={qItem.cost} onChange={e=>setQItem({...qItem,cost:e.target.value})} style={{ width:'100%' }}/></div>
              </div>
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
                      <td><div style={{ fontWeight:600 }}>{it.name}</div>{it.spec && <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{it.spec}</div>}</td>
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
          <button className="btn btn-primary" onClick={()=>{ toast('已下載圖片（示意）'); }}><Icon name="download" size={13}/> 下載圖片</button>
        </>}>
        <QuotePreview q={current} subtotal={subtotal} taxAmt={taxAmt} grand={grand}/>
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
  const MIN_ROWS = 12;
  const rows = Math.max(q.items.length, MIN_ROWS);
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
      <div style={{ textAlign:'center', paddingBottom:'4mm', borderBottom:'2.2pt solid #1a1a1a' }}>
        <div style={{ fontSize:'24pt', fontWeight:700, letterSpacing:'10pt', paddingLeft:'10pt' }}>碰器 估價單</div>
        <div style={{ fontSize:'9pt', letterSpacing:'4pt', color:'#888', marginTop:'1.5mm', fontFamily:"'JetBrains Mono','Courier New',monospace" }}>QUOTATION</div>
      </div>

      {/* Client info block */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', columnGap:'8mm', rowGap:'2mm' }}>
        <div><span style={{color:'#777'}}>客戶名稱：</span><span style={{fontWeight:700}}>{q.client||'　'}</span></div>
        <div><span style={{color:'#777'}}>電　　話：</span><span>{q.cPhone||'　'}</span></div>
        <div><span style={{color:'#777'}}>地　　址：</span><span>{q.cAddress||'　'}</span></div>
        <div><span style={{color:'#777'}}>日　　期：</span><span style={{fontFamily:"'JetBrains Mono',monospace"}}>{q.date||'　'}</span></div>
        <div><span style={{color:'#777'}}>聯 絡 人：</span><span>{q.cName||'　'}</span></div>
        <div><span style={{color:'#777'}}>編　　號：</span><span style={{fontFamily:"'JetBrains Mono',monospace"}}>{q.num||'　'}</span></div>
      </div>

      {/* Items table */}
      <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed', marginTop:'1mm' }}>
        <colgroup>
          <col style={{ width:'8%' }}/>
          <col style={{ width:'22%' }}/>
          <col style={{ width:'30%' }}/>
          <col style={{ width:'10%' }}/>
          <col style={{ width:'14%' }}/>
          <col style={{ width:'16%' }}/>
        </colgroup>
        <thead>
          <tr style={{ background:'#1a1a1a', color:'#fff' }}>
            <th style={{ padding:'2.2mm 2mm', textAlign:'center', fontSize:'10pt', fontWeight:700, letterSpacing:'1pt' }}>序號</th>
            <th style={{ padding:'2.2mm 2mm', textAlign:'left',   fontSize:'10pt', fontWeight:700, letterSpacing:'1pt' }}>品名</th>
            <th style={{ padding:'2.2mm 2mm', textAlign:'left',   fontSize:'10pt', fontWeight:700, letterSpacing:'1pt' }}>規格</th>
            <th style={{ padding:'2.2mm 2mm', textAlign:'right',  fontSize:'10pt', fontWeight:700, letterSpacing:'1pt' }}>數量</th>
            <th style={{ padding:'2.2mm 2mm', textAlign:'right',  fontSize:'10pt', fontWeight:700, letterSpacing:'1pt' }}>單價</th>
            <th style={{ padding:'2.2mm 2mm', textAlign:'right',  fontSize:'10pt', fontWeight:700, letterSpacing:'1pt' }}>金額（未稅）</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => {
            const it = q.items[i];
            return (
              <tr key={i} style={{ borderBottom:'0.4pt solid #c8c8c8', height:'8mm' }}>
                <td style={{ padding:'1.5mm 2mm', textAlign:'center', color:'#666', fontFamily:"'JetBrains Mono',monospace" }}>{i+1}</td>
                <td style={{ padding:'1.5mm 2mm', fontWeight:600, wordBreak:'break-word' }}>{it?.name||''}</td>
                <td style={{ padding:'1.5mm 2mm', color:'#444', fontSize:'10pt', wordBreak:'break-word' }}>{it?.spec||''}</td>
                <td style={{ padding:'1.5mm 2mm', textAlign:'right', fontFamily:"'JetBrains Mono',monospace" }}>{it?it.qty:''}</td>
                <td style={{ padding:'1.5mm 2mm', textAlign:'right', fontFamily:"'JetBrains Mono',monospace" }}>{it?fmtMoney(it.price):''}</td>
                <td style={{ padding:'1.5mm 2mm', textAlign:'right', fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{it?fmtMoney(it.qty*it.price):''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

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
