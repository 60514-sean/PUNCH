// 碰器嚴選系統 — Product cost + Quote views
const { useState: useStateP, useMemo: useMemoP } = React;

const ProductsView = ({ state, setState }) => {
  const [tab, setTab] = useStateP('saved'); // saved | calc
  const [viewMode, setViewMode] = useStateP('grid'); // list | grid
  const [q, setQ] = useStateP('');
  const [modalOpen, setModalOpen] = useStateP(false);
  const [editingId, setEditingId] = useStateP(null);
  const [form, setForm] = useStateP(emptyP());
  const [calc, setCalc] = useStateP({ direct:'', indirect:'', gross:30, net:15, custom:'' });

  function emptyP(){ return { id:'', name:'', spec:'', direct:0, indirect:0, directItems:[], indirectItems:[], price:'', minPrice:'' }; }

  const openNew = () => { setForm(emptyP()); setEditingId(null); setModalOpen(true); };
  const openEdit = (p) => { setForm({...p, directItems:[...(p.directItems||[])], indirectItems:[...(p.indirectItems||[])]}); setEditingId(p.id); setModalOpen(true); };

  const sumItems = (arr) => (arr||[]).reduce((a,b)=>a+(Number(b.a)||0),0);
  const directSum = sumItems(form.directItems);
  const indirectSum = sumItems(form.indirectItems);
  const directEff = (form.directItems||[]).length ? directSum : Number(form.direct)||0;
  const indirectEff = (form.indirectItems||[]).length ? indirectSum : Number(form.indirect)||0;

  const addItem = (kind) => setForm(f => ({ ...f, [kind+'Items']: [...(f[kind+'Items']||[]), { n:'', a:0 }] }));
  const updItem = (kind, i, k, v) => setForm(f => ({ ...f, [kind+'Items']: (f[kind+'Items']||[]).map((x,idx)=>idx===i?{...x,[k]: k==='a'?(Number(v)||0):v}:x) }));
  // 名稱輸入時若完整匹配庫存品項名稱，自動帶入該品項單價
  const pickStockForItem = (kind, i, name) => setForm(f => ({
    ...f,
    [kind+'Items']: (f[kind+'Items']||[]).map((x,idx) => {
      if (idx !== i) return x;
      const stock = state.stocks.find(s => !s._deleted && s.name === name);
      return (stock && stock.price != null)
        ? { ...x, n: name, a: Number(stock.price) || 0 }
        : { ...x, n: name };
    })
  }));
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

  // live calc
  const d = Number(calc.direct)||0, ind = Number(calc.indirect)||0;
  const total = d + ind;
  const grossPrice = calc.gross ? Math.round(d / (1 - calc.gross/100)) : 0;
  const netPrice = calc.net ? Math.round(total / (1 - calc.net/100)) : 0;
  const cp = Number(calc.custom)||0;
  const cGross = cp ? Math.round((cp-d)/cp*1000)/10 : 0;
  const cNet = cp ? Math.round((cp-total)/cp*1000)/10 : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">資源</div>
          <h1 className="h1">產品成本分析</h1>
          <div className="sub">{stats.count} 項產品 · 平均毛利 {stats.grossAvg}% / 淨利 {stats.netAvg}%</div>
        </div>
        <div className="topbar-r">
          {tab==='saved' && <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={14}/> 新增產品</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'nowrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1 1 0', minWidth:120 }}>
          <Icon name="search" size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ink-mute)' }}/>
          <input className="input has-leading-icon" placeholder="搜尋產品…" value={q} onChange={e=>setQ(e.target.value)}
            style={{ padding:'6px 11px 6px 30px', fontSize:13, borderRadius:7, width:'100%' }}/>
        </div>
        <div style={{ flexShrink:0 }}>
          <Segmented options={[{value:'saved',label:'已儲存產品'},{value:'calc',label:'快速試算'}]} value={tab} onChange={setTab}/>
        </div>
        <div style={{ flexShrink:0 }}>
          <Segmented options={[{value:'list',label:'列表'},{value:'grid',label:'網格'}]} value={viewMode} onChange={setViewMode}/>
        </div>
      </div>

      {tab==='saved' && (() => {
        const filtered = state.products.filter(p =>
          !p._deleted && (!q || p.name.includes(q) || (p.spec||'').includes(q)));
        return (
        <div className="card">
          <div className="card-head"><div className="card-title">已儲存產品</div><div className="card-subtle">點選卡片檢視／編輯</div></div>
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
                      <div><div className="eyebrow">總成本</div><div className="mono" style={{ fontSize:14, fontWeight:700 }}>{fmtMoney(tc)}</div></div>
                      <div style={{ textAlign:'right' }}><div className="eyebrow">淨利</div><div className="mono" style={{ fontSize:14, fontWeight:700, color:net>=20?'var(--moss)':'var(--terracotta)' }}>{fmtMoney(p.price-tc)}</div></div>
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
                      <div style={{ fontSize:13, fontWeight:600 }}>{fmtMoney(tc)}</div>
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
          {filtered.length===0 && <EmptyState icon="product" title={q?'查無符合產品':'尚無產品'}/>}
        </div>
        );
      })()}

      {tab==='calc' && (
        <div className="card">
          <div className="card-head"><div className="card-title">快速試算</div><div className="card-subtle">不儲存，僅供估算</div></div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="row">
              <div className="field"><label>直接成本</label><input className="input mono" type="number" value={calc.direct} onChange={e=>setCalc({...calc,direct:e.target.value})} placeholder="0"/></div>
              <div className="field"><label>間接成本</label><input className="input mono" type="number" value={calc.indirect} onChange={e=>setCalc({...calc,indirect:e.target.value})} placeholder="0"/></div>
            </div>
            <div className="row">
              <div className="field"><label>目標毛利率 %</label><input className="input mono" type="number" value={calc.gross} onChange={e=>setCalc({...calc,gross:e.target.value})}/></div>
              <div className="field"><label>目標淨利率 %</label><input className="input mono" type="number" value={calc.net} onChange={e=>setCalc({...calc,net:e.target.value})}/></div>
            </div>

            <div style={{ background:'var(--clay-tint)', borderRadius:8, padding:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--paper-deep)' }}>
                <span style={{ fontSize:14, color:'var(--ink-soft)' }}>總成本</span>
                <span className="mono" style={{ fontWeight:700, fontSize:15 }}>{fmtMoney(total)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--paper-deep)' }}>
                <span style={{ fontSize:14, color:'var(--ink-soft)' }}>毛利建議售價</span>
                <span className="mono" style={{ fontWeight:700, fontSize:15, color:'var(--moss)' }}>{fmtMoney(grossPrice)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
                <span style={{ fontSize:14, color:'var(--ink-soft)' }}>淨利建議售價</span>
                <span className="mono" style={{ fontWeight:700, fontSize:15, color:'var(--clay)' }}>{fmtMoney(netPrice)}</span>
              </div>
            </div>

            <hr className="hr-dashed"/>

            <div className="field">
              <label>自訂售價</label>
              <input className="input mono" type="number" value={calc.custom} onChange={e=>setCalc({...calc,custom:e.target.value})} placeholder="輸入檢查利潤"/>
            </div>
            {cp>0 && (
              <div style={{ padding:'12px 14px', background:'var(--paper-deep)', borderRadius:8, display:'flex', justifyContent:'space-between', fontSize:14 }}>
                <span><span className="muted">毛利率 </span><strong className="mono">{cGross}%</strong></span>
                <span><span className="muted">淨利率 </span><strong className="mono" style={{ color: cNet>=20?'var(--moss)':cNet>=10?'var(--ochre)':'var(--terracotta)' }}>{cNet}%</strong></span>
                <span><span className="muted">淨利 </span><strong className="mono">{fmtMoney(cp-total)}</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editingId?'編輯產品':'新增產品'}
        footer={<>
          {editingId && <button className="btn btn-danger" onClick={del}><Icon name="trash" size={13}/> 刪除</button>}
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={save}>儲存</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <datalist id="products-stock-items">
            {state.stocks.filter(s=>!s._deleted).map(s=>(
              <option key={s.id} value={s.name}/>
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
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 110px 28px', gap:6, marginBottom:6 }}>
                <input className="input" style={{ padding:'6px 9px', fontSize:12 }} placeholder="項目（可選庫存或自填）" value={it.n} list="products-stock-items" onChange={e=>pickStockForItem('direct',i,e.target.value)}/>
                <input className="input mono" style={{ padding:'6px 9px', fontSize:12 }} type="number" placeholder="金額" value={it.a} onChange={e=>updItem('direct',i,'a',e.target.value)}/>
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding:'4px' }} onClick={()=>delItem('direct',i)}><Icon name="close" size={11}/></button>
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
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 110px 28px', gap:6, marginBottom:6 }}>
                <input className="input" style={{ padding:'6px 9px', fontSize:12 }} placeholder="項目（可選庫存或自填）" value={it.n} list="products-stock-items" onChange={e=>pickStockForItem('indirect',i,e.target.value)}/>
                <input className="input mono" style={{ padding:'6px 9px', fontSize:12 }} type="number" placeholder="金額" value={it.a} onChange={e=>updItem('indirect',i,'a',e.target.value)}/>
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding:'4px' }} onClick={()=>delItem('indirect',i)}><Icon name="close" size={11}/></button>
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
              <div><span className="muted">總成本 </span><strong className="mono">{fmtMoney(directEff+indirectEff)}</strong></div>
              <div style={{ textAlign:'right' }}><span className="muted">售價 </span><strong className="mono">{fmtMoney(form.price)}</strong></div>
              <div><span className="muted">毛利 </span><strong className="mono" style={{ color:'var(--moss)' }}>{fmtMoney(form.price-directEff)} ({Math.round((form.price-directEff)/form.price*100)}%)</strong></div>
              <div style={{ textAlign:'right' }}><span className="muted">淨利 </span><strong className="mono" style={{ color:'var(--clay)', fontWeight:700 }}>{fmtMoney(form.price-directEff-indirectEff)} ({Math.round((form.price-directEff-indirectEff)/form.price*100)}%)</strong></div>
            </div>
          )}
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

  function emptyQ(){
    const today = new Date().toISOString().slice(0,10);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('bangqi_myco') || '{}'); } catch(e){}
    return { id:'', num:'QT-'+today.replace(/-/g,''), date:today, valid:'',
      myco: saved.myco || '碰器有限公司',
      myName: saved.myName || '康竣傑',
      myPhone: saved.myPhone || '0903-993-359',
      myEmail: saved.myEmail || 'sean605147@gmail.com',
      client:'', cName:'', cPhone:'', cEmail:'',
      note: saved.note || '付款方式：50% 訂金、50% 交貨。\n有效期限請以本單為準。',
      tax:5, items:[] };
  }

  // When user edits 'my company' fields, persist
  React.useEffect(()=>{
    localStorage.setItem('bangqi_myco', JSON.stringify({
      myco: current.myco, myName: current.myName,
      myPhone: current.myPhone, myEmail: current.myEmail, note: current.note,
    }));
  }, [current.myco, current.myName, current.myPhone, current.myEmail, current.note]);

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
          <button className="btn btn-ghost" onClick={()=>setPreviewOpen(true)}><Icon name="eye" size={14}/> 預覽</button>
          <button className="btn btn-primary" onClick={saveQuote}>儲存</button>
        </div>
      </div>

      <div className="grid-2-1-p">
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="card">
            <div className="card-head"><div className="card-title">基本資訊</div></div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="row">
                <div className="field"><label>報價單編號</label><input className="input mono" value={current.num} onChange={e=>setCurrent({...current,num:e.target.value})}/></div>
                <div className="field"><label>報價日期</label><input className="input" type="date" value={current.date} onChange={e=>setCurrent({...current,date:e.target.value})}/></div>
              </div>
              <div className="field"><label>我方公司</label><input className="input" value={current.myco} onChange={e=>setCurrent({...current,myco:e.target.value})}/></div>
              <div className="row">
                <div className="field"><label>姓名</label><input className="input" value={current.myName} onChange={e=>setCurrent({...current,myName:e.target.value})}/></div>
                <div className="field"><label>電話</label><input className="input" value={current.myPhone} onChange={e=>setCurrent({...current,myPhone:e.target.value})}/></div>
              </div>
              <div className="field"><label>Email</label><input className="input" value={current.myEmail} onChange={e=>setCurrent({...current,myEmail:e.target.value})}/></div>
              <hr className="hr-soft"/>
              <div className="field"><label>客戶名稱<span className="req">*</span></label>
                <input className="input" list="quote-clients" value={current.client} onChange={e=>setCurrent({...current,client:e.target.value})}/>
                <datalist id="quote-clients">{state.customers.map(c=><option key={c.id} value={c.name}/>)}</datalist>
              </div>
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
            <div className="card-head"><div className="card-title">報價品項</div><div className="card-subtle">{current.items.length} 項</div></div>
            <div style={{ background:'var(--paper-deep)', padding:12, borderRadius:8, marginBottom:12 }}>
              <div className="row" style={{ marginBottom:10 }}>
                <div className="field"><label>品項名稱</label><input className="input" value={qItem.name} onChange={e=>pickProduct(e.target.value)} list="quote-products" placeholder="輸入或選擇既有產品"/>
                  <datalist id="quote-products">{state.products.map(p=><option key={p.id} value={p.name}/>)}</datalist></div>
                <div className="field"><label>規格</label><input className="input" value={qItem.spec} onChange={e=>setQItem({...qItem,spec:e.target.value})}/></div>
              </div>
              <div className="row-3" style={{ marginBottom:10 }}>
                <div className="field"><label>數量</label><input className="input mono" type="number" value={qItem.qty} onChange={e=>setQItem({...qItem,qty:e.target.value})}/></div>
                <div className="field"><label>單價</label><input className="input mono" type="number" value={qItem.price} onChange={e=>setQItem({...qItem,price:e.target.value})}/></div>
                <div className="field"><label>成本</label><input className="input mono" type="number" value={qItem.cost} onChange={e=>setQItem({...qItem,cost:e.target.value})}/></div>
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

        {/* Summary */}
        <div className="card" style={{ alignSelf:'flex-start', position:'sticky', top:16 }}>
          <div className="card-head"><div className="card-title">總計</div></div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13 }}>
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
      <Modal open={previewOpen} onClose={()=>setPreviewOpen(false)} title="報價單預覽" width={720}
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

const QuotePreview = ({ q, subtotal, taxAmt, grand }) => (
  <div style={{ background:'#fff', padding:28, border:'1px solid var(--rule)', borderRadius:8, fontFamily:'var(--f-serif)' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:14, borderBottom:'2px solid var(--ink)' }}>
      <div>
        <div style={{ fontSize:26, fontWeight:700, letterSpacing:'0.02em' }}>報價單</div>
        <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:4, fontFamily:'var(--f-mono)' }}>QUOTATION</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:15, fontWeight:600 }}>{q.myco}</div>
        <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:4, fontFamily:'var(--f-sans)', lineHeight:1.5 }}>
          {q.myName}<br/>{q.myPhone}<br/>{q.myEmail}
        </div>
      </div>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, padding:'16px 0', fontFamily:'var(--f-sans)' }}>
      <div>
        <div style={{ fontSize:10, color:'var(--ink-mute)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>BILL TO</div>
        <div style={{ fontSize:15, fontWeight:700, fontFamily:'var(--f-serif)' }}>{q.client||'（客戶）'}</div>
        <div style={{ fontSize:12, color:'var(--ink-mute)', marginTop:3, lineHeight:1.5 }}>
          {q.cName&&<>{q.cName}<br/></>}{q.cPhone&&<>{q.cPhone}<br/></>}{q.cEmail}
        </div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ display:'grid', gridTemplateColumns:'auto auto', gap:'4px 12px', justifyContent:'end', fontSize:12, fontFamily:'var(--f-mono)' }}>
          <span className="muted">報價編號</span><span>{q.num}</span>
          <span className="muted">報價日期</span><span>{q.date}</span>
          <span className="muted">有效期限</span><span>{q.valid||'—'}</span>
        </div>
      </div>
    </div>
    <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'var(--f-sans)', fontSize:12, marginBottom:16 }}>
      <thead><tr style={{ background:'var(--ink)', color:'var(--paper-soft)' }}>
        <th style={{ padding:'9px 10px', textAlign:'left', fontSize:10, letterSpacing:1.4 }}>#</th>
        <th style={{ padding:'9px 10px', textAlign:'left', fontSize:10, letterSpacing:1.4 }}>品項</th>
        <th style={{ padding:'9px 10px', textAlign:'right', fontSize:10, letterSpacing:1.4 }}>數量</th>
        <th style={{ padding:'9px 10px', textAlign:'right', fontSize:10, letterSpacing:1.4 }}>單價</th>
        <th style={{ padding:'9px 10px', textAlign:'right', fontSize:10, letterSpacing:1.4 }}>小計</th>
      </tr></thead>
      <tbody>
        {q.items.map((it,i)=>(
          <tr key={i} style={{ background: i%2?'var(--paper-soft)':'#fff', borderBottom:'1px solid var(--rule-soft)' }}>
            <td style={{ padding:10, color:'var(--ink-mute)' }}>{i+1}</td>
            <td style={{ padding:10, fontWeight:600 }}>{it.name}{it.spec && <div style={{ fontWeight:400, color:'var(--ink-mute)', fontSize:11, marginTop:2 }}>{it.spec}</div>}</td>
            <td style={{ padding:10, textAlign:'right', fontFamily:'var(--f-mono)' }}>{it.qty}</td>
            <td style={{ padding:10, textAlign:'right', fontFamily:'var(--f-mono)' }}>{fmtMoney(it.price)}</td>
            <td style={{ padding:10, textAlign:'right', fontFamily:'var(--f-mono)', fontWeight:700 }}>{fmtMoney(it.qty*it.price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div style={{ display:'flex', justifyContent:'flex-end' }}>
      <div style={{ minWidth:240, fontFamily:'var(--f-mono)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}><span className="muted">小計</span><span>{fmtMoney(subtotal)}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}><span className="muted">稅額 ({q.tax}%)</span><span>{fmtMoney(taxAmt)}</span></div>
        <div style={{ background:'var(--clay)', color:'var(--paper-soft)', padding:'10px 14px', marginTop:8, borderRadius:6, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <span style={{ fontFamily:'var(--f-serif)', fontSize:13 }}>合計金額</span>
          <span style={{ fontSize:22, fontWeight:700 }}>{fmtMoney(grand)}</span>
        </div>
      </div>
    </div>
    {q.note && <div style={{ marginTop:16, fontSize:11, color:'var(--ink-mute)', lineHeight:1.7, fontFamily:'var(--f-sans)', whiteSpace:'pre-line', paddingTop:12, borderTop:'1px dashed var(--rule)' }}>{q.note}</div>}
  </div>
);

Object.assign(window, { ProductsView, QuotesView });
