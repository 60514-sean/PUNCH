// 碰器嚴選系統 — Finance + Inventory views
const { useState: useStateF, useMemo: useMemoF } = React;

// 現金流折線圖（從 dashboard 移入）
const DualLine = ({ data }) => {
  const height = 220;
  const pad = { t:14, r:10, b:28, l:48 };
  const w = 600; const h = height;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxY = Math.max(...data.map(d=>Math.max(d.income,d.expense,d.net)), 0);
  const minY = Math.min(...data.map(d=>Math.min(d.income,d.expense,d.net,0)), 0);
  const range = maxY - minY || 1;
  const xStep = innerW / (data.length-1 || 1);
  const yFor = v => pad.t + (1 - (v-minY)/range) * innerH;
  const mk = key => data.map((d,i)=>[pad.l + i*xStep, yFor(d[key])]);
  const lineOf = (pts) => 'M '+pts.map(([x,y])=>`${x} ${y}`).join(' L ');
  const incPts = mk('income'), expPts = mk('expense'), netPts = mk('net');
  const yTicks = [0, 0.33, 0.66, 1].map(t => minY + (maxY-minY)*(1-t));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:'100%', height, display:'block' }} preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="areaInc2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--clay)" stopOpacity="0.18"/><stop offset="100%" stopColor="var(--clay)" stopOpacity="0"/></linearGradient></defs>
      {yTicks.map((v,i)=>(
        <g key={i}>
          <line x1={pad.l} x2={w-pad.r} y1={yFor(v)} y2={yFor(v)} stroke="var(--rule-soft)" strokeWidth="1" strokeDasharray="2 3"/>
          <text x={pad.l-8} y={yFor(v)+3} textAnchor="end" fontSize="11" fill="var(--ink-mute)" fontFamily="var(--f-mono)">{fmtMoney(v, true)}</text>
        </g>
      ))}
      {data.map((d,i)=>(
        <text key={i} x={pad.l + i*xStep} y={h-pad.b+16} textAnchor="middle" fontSize="11" fill="var(--ink-mute)" fontFamily="var(--f-mono)">{d.label}</text>
      ))}
      <path d={`${lineOf(incPts)} L ${pad.l+innerW} ${h-pad.b} L ${pad.l} ${h-pad.b} Z`} fill="url(#areaInc2)"/>
      <path d={lineOf(expPts)} stroke="var(--terracotta)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4"/>
      <path d={lineOf(netPts)} stroke="var(--sage)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={lineOf(incPts)} stroke="var(--clay)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {incPts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3" fill="var(--paper-soft)" stroke="var(--clay)" strokeWidth="1.8"/>)}
    </svg>
  );
};

const FinanceView = ({ state, setState }) => {
  const [mode, setMode] = useStateF('month'); // month | all
  const [monthKey, setMonthKey] = useStateF(state.goals.month);
  const [typeFilter, setTypeFilter] = useStateF('全部');
  const [modalOpen, setModalOpen] = useStateF(false);
  const [editingId, setEditingId] = useStateF(null);
  const [form, setForm] = useStateF(emptyF());

  function emptyF(){ return { id:'', type:'income', cat:'銷售收入', desc:'', amount:'', date: new Date().toISOString().slice(0,10) }; }

  const monthStep = (n) => {
    const [y,m] = monthKey.split('-').map(Number);
    const d = new Date(y, m-1+n, 1);
    setMonthKey(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
    setMode('month');
  };

  const listRaw = useMemoF(()=>{
    const f = state.finances.filter(x => !x._deleted);
    return mode==='month' ? f.filter(x=>ym(x.date)===monthKey) : f;
  }, [state.finances, mode, monthKey]);

  const list = useMemoF(()=>{
    let f = listRaw;
    if (typeFilter==='收入') f = f.filter(x=>x.type==='income');
    if (typeFilter==='支出') f = f.filter(x=>x.type==='expense');
    return [...f].sort((a,b)=>b.date.localeCompare(a.date));
  }, [listRaw, typeFilter]);

  const income = listRaw.filter(x=>x.type==='income').reduce((a,b)=>a+b.amount,0);
  const expense = listRaw.filter(x=>x.type==='expense').reduce((a,b)=>a+b.amount,0);
  const net = income - expense;

  const trendData = useMemoF(()=>{
    const now = new Date();
    return Array.from({length:6},(_,i)=>{
      const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
      const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      const label = (d.getMonth()+1)+'月';
      const recs = state.finances.filter(x=>!x._deleted && ym(x.date)===key);
      const inc = recs.filter(x=>x.type==='income').reduce((a,b)=>a+b.amount,0);
      const exp = recs.filter(x=>x.type==='expense').reduce((a,b)=>a+b.amount,0);
      return { label, income:inc, expense:exp, net:inc-exp };
    });
  }, [state.finances]);

  const openNew = () => { setForm(emptyF()); setEditingId(null); setModalOpen(true); };
  const openEdit = (f) => { setForm({...f}); setEditingId(f.id); setModalOpen(true); };
  const save = () => {
    if (!form.desc || !form.amount) { toast('請填寫說明與金額'); return; }
    const rec = { ...form, amount: Number(form.amount) };
    if (editingId) setState(s=>({ ...s, finances: s.finances.map(x=>x.id===editingId?rec:x) }));
    else setState(s=>({ ...s, finances: [{...rec, id:uid()}, ...s.finances] }));
    toast(editingId?'已更新':'已新增');
    setModalOpen(false);
  };
  const del = () => {
    if (!confirm('刪除此筆紀錄？將移至回收桶（保留 10 天）。')) return;
    setState(s=> window.softDel(s, 'finances', editingId));
    setModalOpen(false); toast('已移至回收桶');
  };

  const catPalette = { income: ['銷售收入','服務費','其他收入'], expense: ['原料採購','人事費用','運費','租金','水電費','設備','其他支出'] };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">財務</div>
          <h1 className="h1">收支控管</h1>
          <div className="sub">{mode==='month'?monthKey:'全部期間'} · {listRaw.length} 筆紀錄</div>
        </div>
        <div className="topbar-r">
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={()=>monthStep(-1)}><Icon name="chevronLeft" size={12}/></button>
            <span className="btn btn-ghost btn-sm mono" style={{ minWidth:84, justifyContent:'center', cursor:'default', fontWeight:700 }}>{monthKey}</span>
            <button className="btn btn-ghost btn-sm" onClick={()=>monthStep(1)}><Icon name="chevron" size={12}/></button>
          </div>
          <button className={'btn btn-sm '+(mode==='all'?'btn-ink':'btn-ghost')} onClick={()=>setMode(mode==='all'?'month':'all')}>
            {mode==='all'?'查看單月':'查看全部'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Icon name="plus" size={14}/> 新增</button>
        </div>
      </div>

      {trendData.some(d=>d.income||d.expense) && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">現金流趨勢</div>
            <div className="card-subtle" style={{ display:'flex', gap:14, fontSize:11 }}>
              <span style={{ color:'var(--clay)' }}>— 收入</span>
              <span style={{ color:'var(--terracotta)' }}>--- 支出</span>
              <span style={{ color:'var(--sage)' }}>— 淨利</span>
            </div>
          </div>
          <DualLine data={trendData}/>
        </div>
      )}

      <div className="card flat" style={{ padding:0 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)' }} className="fin-kpi">
          <div className="stat"><span className="lab">收入</span><span className="val mono-val" style={{ color:'var(--moss)' }}>{fmtMoney(income,true)}</span><span className="delta muted">{listRaw.filter(x=>x.type==='income').length} 筆</span></div>
          <div className="stat"><span className="lab">支出</span><span className="val mono-val" style={{ color:'var(--terracotta)' }}>{fmtMoney(expense,true)}</span><span className="delta muted">{listRaw.filter(x=>x.type==='expense').length} 筆</span></div>
          <div className="stat"><span className="lab">淨利</span><span className="val mono-val" style={{ color:'var(--clay)' }}>{fmtMoney(net,true)}</span><span className="delta muted">毛利率 {income?Math.round(net/income*100):0}%</span></div>
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
          <Segmented options={[{value:'全部',label:'全部'},{value:'收入',label:'收入'},{value:'支出',label:'支出'}]} value={typeFilter} onChange={setTypeFilter}/>
        </div>
        <table className="tbl desk-only">
          <thead><tr><th>日期</th><th>類型／分類</th><th>說明</th><th style={{ textAlign:'right' }}>金額</th><th></th></tr></thead>
          <tbody>
            {list.map(f=>(
              <tr key={f.id} className="clickable" onClick={()=>openEdit(f)}>
                <td className="mono" style={{ fontSize:12, color:'var(--ink-mute)' }}>{fmtDateFull(f.date)}</td>
                <td>
                  <Pill tone={f.type==='income'?'sage':'terracotta'}>{f.type==='income'?'收入':'支出'}</Pill>
                  <span style={{ marginLeft:8, fontSize:12, color:'var(--ink-soft)' }}>{f.cat}</span>
                </td>
                <td>{f.desc}</td>
                <td className="num" style={{ fontWeight:700, color: f.type==='income'?'var(--moss)':'var(--terracotta)' }}>{f.type==='income'?'+':'-'}{fmtMoney(f.amount)}</td>
                <td><Icon name="chevron" size={13} style={{ color:'var(--ink-faint)' }}/></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mob-cards">
          {list.map(f=>(
            <div key={f.id} className="mob-card" onClick={()=>openEdit(f)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <Pill tone={f.type==='income'?'sage':'terracotta'}>{f.type==='income'?'收入':'支出'}</Pill>
                    <span style={{ fontSize:11, color:'var(--ink-mute)' }}>{f.cat}</span>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, lineHeight:1.4 }}>{f.desc}</div>
                  <div className="mono" style={{ fontSize:10, color:'var(--ink-mute)', marginTop:4 }}>{fmtDateFull(f.date)}</div>
                </div>
                <div className="mono" style={{ fontSize:16, fontWeight:700, color: f.type==='income'?'var(--moss)':'var(--terracotta)', whiteSpace:'nowrap' }}>
                  {f.type==='income'?'+':'-'}{fmtMoney(f.amount)}
                </div>
              </div>
            </div>
          ))}
        </div>
        {list.length===0 && <EmptyState icon="finance" title="尚無紀錄"/>}
      </div>

      {/* 支出分佈 */}
      {mode==='month' && (()=>{
        const map = {};
        listRaw.filter(x=>x.type==='expense').forEach(f=>{ map[f.cat]=(map[f.cat]||0)+f.amount; });
        const palette=['var(--clay)','var(--terracotta)','var(--ochre)','var(--sage)','var(--ink-soft)'];
        const cats=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>({label:k,value:v,color:palette[i%palette.length]}));
        if (!cats.length) return null;
        return (
          <div className="card">
            <div className="card-head">
              <div className="card-title">本月支出分佈</div>
              <div className="card-subtle">共 {fmtMoney(expense, true)}</div>
            </div>
            <BarList items={cats}/>
          </div>
        );
      })()}

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editingId?'編輯紀錄':'新增收支紀錄'}
        footer={<>
          {editingId && <button className="btn btn-danger" onClick={del}><Icon name="trash" size={13}/> 刪除</button>}
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={save}>儲存</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="row">
            <div className="field"><label>類型</label>
              <div style={{ display:'flex',gap:6 }}>
                {[{v:'income',l:'收入'},{v:'expense',l:'支出'}].map(t=>(
                  <button key={t.v} className={'btn btn-sm '+(form.type===t.v?'btn-ink':'btn-ghost')} style={{ flex:1 }}
                    onClick={()=>setForm({...form, type:t.v, cat: t.v==='income'?'銷售收入':'原料採購'})}>{t.l}</button>
                ))}
              </div>
            </div>
            <div className="field"><label>分類</label>
              <select className="select" value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>
                {catPalette[form.type].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>說明<span className="req">*</span></label><input className="input" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/></div>
          <div className="row">
            <div className="field"><label>金額<span className="req">*</span></label><input className="input mono" type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></div>
            <div className="field"><label>日期</label><input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ═══ Inventory ═══
const KIND_OPTS = [
  { v:'goods',     l:'商品' },
  { v:'material',  l:'材料' },
  { v:'packaging', l:'包材' },
  { v:'display',   l:'展品' },
];
const KIND_VALUES = KIND_OPTS.map(o => o.v);
const InventoryView = ({ state, setState }) => {
  const [tab, setTab] = useStateF('all'); // all | goods | material | packaging | display | logs
  const [q, setQ] = useStateF('');
  const [modalOpen, setModalOpen] = useStateF(false);
  const [adjOpen, setAdjOpen] = useStateF(false);
  const [editingId, setEditingId] = useStateF(null);
  const [form, setForm] = useStateF({ id:'', kind:'goods', name:'', cat:'', unit:'', qty:'', min:'', price:'', photo:'', note:'', loc:'' });
  const [adj, setAdj] = useStateF({ id:'', name:'', current:0, type:'add', qty:'', note:'' });
  const [noteView, setNoteView] = useStateF(null); // 點圖示要看的品項
  const [viewMode, setViewMode] = useStateF('list'); // list | grid
  const [photoView, setPhotoView] = useStateF(''); // 點縮圖放大要看的 URL

  const openNew = () => {
    const defKind = KIND_VALUES.includes(tab) ? tab : 'goods';
    setForm({ id:'', kind: defKind, name:'', cat:'', unit:'', qty:'', min:'', price:'', photo:'', note:'', loc:'' });
    setEditingId(null); setModalOpen(true);
  };
  const openEdit = (s) => { setForm({...s}); setEditingId(s.id); setModalOpen(true); };
  const openAdj = (s) => { setAdj({ id:s.id, name:s.name, current:s.qty, type:'add', qty:'', note:'' }); setAdjOpen(true); };

  const save = () => {
    if (!form.name) { toast('請填寫名稱'); return; }
    const rec = { ...form, qty: Number(form.qty)||0, min: Number(form.min)||0, price: Number(form.price)||0, updated: new Date().toISOString().slice(0,10) };
    if (editingId) setState(s=>({ ...s, stocks: s.stocks.map(x=>x.id===editingId?rec:x) }));
    else setState(s=>({ ...s, stocks: [{...rec, id:uid()}, ...s.stocks] }));
    toast(editingId?'已更新':'已新增');
    setModalOpen(false);
  };
  const del = () => {
    if (!confirm('刪除此品項？將移至回收桶（保留 10 天）。')) return;
    setState(s=> window.softDel(s, 'stocks', editingId));
    setModalOpen(false); toast('已移至回收桶');
  };
  const saveAdj = () => {
    const q = Number(adj.qty)||0;
    if (!q && adj.type!=='set') { toast('請輸入數量'); return; }
    setState(s=>{
      const newStocks = s.stocks.map(x=>{
        if (x.id!==adj.id) return x;
        let nq = x.qty;
        if (adj.type==='add') nq = x.qty + q;
        else if (adj.type==='sub') nq = Math.max(0, x.qty - q);
        else nq = q;
        return { ...x, qty: nq, updated: new Date().toISOString().slice(0,10) };
      });
      const log = {
        id: uid(), stockId: adj.id, name: adj.name,
        type: adj.type==='sub'?'out': (adj.type==='add'?'in':'adj'),
        qty: q, note: adj.note, date: new Date().toISOString().slice(0,10),
      };
      return { ...s, stocks: newStocks, logs: [log, ...s.logs] };
    });
    toast('庫存已更新');
    setAdjOpen(false);
  };

  const allStocks = state.stocks.filter(x => !x._deleted);
  const items = allStocks.filter(x => (tab==='all' || tab==='logs' ? true : x.kind===tab) &&
    (!q || x.name.includes(q) || (x.loc||'').includes(q)));
  const alertCount = allStocks.filter(x=>x.qty<=x.min).length;
  const invValue = allStocks.reduce((a,b)=>a+b.qty*b.price,0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">資源</div>
          <h1 className="h1">庫存管理</h1>
          <div className="sub">總品項 {allStocks.length} 項 · 庫存價值 {fmtMoney(invValue,true)} · <span style={{ color: alertCount?'var(--terracotta)':'var(--moss)' }}>{alertCount} 項警示</span></div>
        </div>
        <div className="topbar-r">
          <button className={'btn btn-sm '+(tab==='logs'?'btn-ink':'btn-ghost')} onClick={()=>setTab(tab==='logs'?'all':'logs')}>
            {tab==='logs'?'回到庫存':'進出貨紀錄'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Icon name="plus" size={14}/> 新增品項</button>
        </div>
      </div>

      {tab!=='logs' && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:'1 1 200px', minWidth:200, maxWidth:320 }}>
            <Icon name="search" size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ink-mute)' }}/>
            <input className="input has-leading-icon" placeholder="搜尋…" value={q} onChange={e=>setQ(e.target.value)}
              style={{ padding:'6px 11px 6px 30px', fontSize:13, borderRadius:7 }}/>
          </div>
          <select className="select" value={tab} onChange={e=>setTab(e.target.value)}
                  style={{ minWidth:120, padding:'7px 28px 7px 11px', fontSize:13 }}>
            <option value="all">全部庫存</option>
            {KIND_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}庫存</option>)}
          </select>
          <Segmented options={[{value:'list',label:'列表'},{value:'grid',label:'網格'}]} value={viewMode} onChange={setViewMode}/>
        </div>
      )}

      {tab==='logs' ? (
        <div className="card">
          <div className="card-head"><div className="card-title">進出貨紀錄</div><div className="card-subtle">最新 {state.logs.length} 筆</div></div>
          <table className="tbl desk-only">
            <thead><tr><th>日期</th><th>品項</th><th>類型</th><th style={{textAlign:'right'}}>數量</th><th>備註</th></tr></thead>
            <tbody>
              {state.logs.map(l=>(
                <tr key={l.id}>
                  <td className="mono" style={{ fontSize:12, color:'var(--ink-mute)' }}>{fmtDateFull(l.date)}</td>
                  <td style={{ fontWeight:600 }}>{l.name}</td>
                  <td>
                    <Pill tone={l.type==='in'?'sage':l.type==='out'?'terracotta':'ochre'}>
                      {l.type==='in'?'進貨':l.type==='out'?'出貨':'盤點'}
                    </Pill>
                  </td>
                  <td className="num" style={{ fontWeight:700, color: l.type==='in'?'var(--moss)':'var(--terracotta)' }}>
                    {l.type==='in'?'+':l.type==='out'?'-':''}{l.qty}
                  </td>
                  <td style={{ fontSize:12, color:'var(--ink-soft)' }}>{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mob-cards">
            {state.logs.map(l=>(
              <div key={l.id} className="mob-card" style={{ cursor:'default' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <Pill tone={l.type==='in'?'sage':l.type==='out'?'terracotta':'ochre'}>
                        {l.type==='in'?'進貨':l.type==='out'?'出貨':'盤點'}
                      </Pill>
                      <span className="mono" style={{ fontSize:10, color:'var(--ink-mute)' }}>{fmtDateFull(l.date)}</span>
                    </div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{l.name}</div>
                    {l.note && <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:3 }}>{l.note}</div>}
                  </div>
                  <div className="mono" style={{ fontSize:16, fontWeight:700, color: l.type==='in'?'var(--moss)':'var(--terracotta)' }}>
                    {l.type==='in'?'+':l.type==='out'?'-':''}{l.qty}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          {viewMode === 'list' && <>
          <table className="tbl desk-only">
            <thead><tr>
              <th>品項</th>
              <th style={{textAlign:'right'}}>庫存 / 底線</th>
              <th style={{textAlign:'right'}}>單價</th>
              <th style={{textAlign:'right'}}>小計</th>
              <th style={{ width:110 }}></th>
            </tr></thead>
            <tbody>
              {items.map(s=>{
                const low = s.qty<=s.min;
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <PhotoThumb url={s.photo} size={64} alt={s.name} onClick={()=>s.photo && setPhotoView(s.photo)}/>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                            {s.name}
                            {low && <Pill tone="terracotta" dot>低於底線</Pill>}
                          </div>
                          <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2 }}>{[(KIND_OPTS.find(o=>o.v===s.kind)||{}).l, '更新 '+fmtDateFull(s.updated)].filter(Boolean).join(' · ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num" style={{ minWidth:120 }}>
                      <span style={{ fontSize:18, fontWeight:700, color: low?'var(--terracotta)':'var(--ink)' }}>{s.qty}</span>
                      <span style={{ fontSize:12, color:'var(--ink-mute)', fontWeight:500, marginLeft:4 }}>/ {s.min} {s.unit}</span>
                    </td>
                    <td className="num">{fmtMoney(s.price)}</td>
                    <td className="num" style={{ fontWeight:700 }}>{fmtMoney(s.qty*s.price)}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                          <div style={{ width:22, display:'flex', alignItems:'center', flexShrink:0 }}>
                            {s.note && <button type="button" title="檢視備註" onClick={(e)=>{e.stopPropagation();setNoteView(s);}}
                              style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', padding:2, border:'none', background:'none', cursor:'pointer', color:'var(--ink-mute)', borderRadius:4 }}><Icon name="note" size={14}/></button>}
                          </div>
                          {s.loc && <span style={{ fontSize:11, color:'var(--ink-mute)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>位置 {s.loc}</span>}
                        </div>
                        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>openAdj(s)}>進出貨</button>
                          <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(s)}><Icon name="edit" size={12}/></button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Mobile card view */}
          <div className="mob-cards">
            {items.map(s=>{
              const low = s.qty<=s.min;
              return (
                <div key={s.id} className="mob-card" style={{ cursor:'default' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <PhotoThumb url={s.photo} size={88} alt={s.name} onClick={()=>s.photo && setPhotoView(s.photo)}/>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        {s.name}
                        {low && <Pill tone="terracotta" dot>低於底線</Pill>}
                      </div>
                      <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2 }}>{[(KIND_OPTS.find(o=>o.v===s.kind)||{}).l, '更新 '+fmtDateFull(s.updated)].filter(Boolean).join(' · ')}</div>
                      <div className="mono" style={{ marginTop:6, display:'flex', alignItems:'baseline', gap:6 }}>
                        <span style={{ fontSize:20, fontWeight:700, color: low?'var(--terracotta)':'var(--ink)' }}>{s.qty}</span>
                        <span style={{ fontSize:11, color:'var(--ink-mute)' }}>/ {s.min} {s.unit}</span>
                        <span style={{ flex:1 }}/>
                        <span style={{ fontSize:12, color:'var(--ink-mute)' }}>小計</span>
                        <strong className="mono" style={{ fontSize:13 }}>{fmtMoney(s.qty*s.price)}</strong>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:10, paddingTop:8, borderTop:'1px dashed var(--rule-soft)' }}>
                    {s.note && <button type="button" title="檢視備註" onClick={(e)=>{e.stopPropagation();setNoteView(s);}}
                      style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', padding:6, border:'none', background:'none', cursor:'pointer', color:'var(--ink-mute)', borderRadius:4 }}><Icon name="note" size={15}/></button>}
                    {s.loc && <span style={{ fontSize:11, color:'var(--ink-mute)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0 }}>位置 {s.loc}</span>}
                    <div style={{ flex:1 }}/>
                    <button className="btn btn-ghost btn-sm" onClick={(e)=>{e.stopPropagation();openAdj(s);}}>進出貨</button>
                    <button className="btn btn-ghost btn-sm" onClick={(e)=>{e.stopPropagation();openEdit(s);}}><Icon name="edit" size={11}/></button>
                  </div>
                </div>
              );
            })}
          </div>
          </>}
          {viewMode === 'grid' && (
            <div className="stock-grid">
              {items.map(s => {
                const low = s.qty <= s.min;
                return (
                  <div key={s.id} style={{ border:'1px solid var(--rule-soft)', borderRadius:10, padding:10, cursor:'pointer', background:'var(--paper-soft)', display:'flex', flexDirection:'column', gap:8 }}
                       onClick={()=>openEdit(s)}>
                    <div style={{ position:'relative', aspectRatio:'1/1', borderRadius:7, overflow:'hidden', background:'var(--paper-deep)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-faint)' }}
                         onClick={(e)=>{ if (s.photo){ e.stopPropagation(); setPhotoView(s.photo); } }}>
                      {s.photo
                        ? <img src={cldThumb(s.photo, 400)} alt={s.name}
                               style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', cursor:'zoom-in' }} loading="lazy"/>
                        : <Icon name="image" size={28}/>
                      }
                      {low && <div style={{ position:'absolute', top:6, left:6 }}><Pill tone="terracotta" dot>低於底線</Pill></div>}
                      {s.note && <button type="button" title="檢視備註" onClick={(e)=>{e.stopPropagation();setNoteView(s);}}
                        style={{ position:'absolute', top:6, right:6, width:28, height:28, padding:0,
                                 display:'inline-flex', alignItems:'center', justifyContent:'center',
                                 border:'none', background:'rgba(255,255,255,0.88)', cursor:'pointer',
                                 color:'var(--ink-soft)', borderRadius:'50%' }}><Icon name="note" size={13}/></button>}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                      <div style={{ display:'flex', alignItems:'baseline', gap:4, marginTop:2 }}>
                        <span className="mono" style={{ fontSize:17, fontWeight:700, color: low?'var(--terracotta)':'var(--ink)' }}>{s.qty}</span>
                        <span style={{ fontSize:11, color:'var(--ink-mute)' }}>/ {s.min} {s.unit}</span>
                      </div>
                      {s.loc && <div style={{ fontSize:10, color:'var(--ink-mute)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>位置 {s.loc}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {items.length===0 && <EmptyState icon="inventory" title="尚無庫存品項"/>}
        </div>
      )}

      {/* Add/Edit stock */}
      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editingId?'編輯品項':'新增庫存品項'}
        footer={<>
          {editingId && <button className="btn btn-danger" onClick={del}><Icon name="trash" size={13}/> 刪除</button>}
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={save}>儲存</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>商品照片</label>
            <PhotoUpload value={form.photo} onChange={(url)=>setForm({...form, photo:url})} size={120}/>
          </div>
          <div className="field"><label>名稱<span className="req">*</span></label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
          <div className="row">
            <div className="field"><label>分類</label>
              <select className="select" value={form.kind} onChange={e=>setForm({...form, kind:e.target.value})}>
                {KIND_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div className="field"><label>單位</label><input className="input" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></div>
          </div>
          <div className="row">
            <div className="field"><label>現有庫存</label><input className="input mono" type="number" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})}/></div>
            <div className="field"><label>安全底線</label><input className="input mono" type="number" value={form.min} onChange={e=>setForm({...form,min:e.target.value})}/></div>
          </div>
          <div className="row">
            <div className="field"><label>倉儲位置</label><input className="input" value={form.loc} onChange={e=>setForm({...form,loc:e.target.value})} placeholder="例：A 區 - 架 2"/></div>
            <div className="field"><label>單價成本</label><input className="input mono" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div>
          </div>
          <div className="field"><label>備註</label>
            <textarea className="textarea" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="規格、廠商、注意事項…"/>
          </div>
        </div>
      </Modal>

      {/* Adjust stock */}
      <Modal open={adjOpen} onClose={()=>setAdjOpen(false)} title="調整庫存"
        footer={<>
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setAdjOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={saveAdj}>確認</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ padding:'14px 16px', background:'var(--paper-deep)', borderRadius:8, textAlign:'center' }}>
            <div className="eyebrow" style={{ marginBottom:4 }}>{adj.name}</div>
            <div style={{ fontFamily:'var(--f-mono)', fontSize:28, fontWeight:700 }}>{adj.current}</div>
            <div style={{ fontSize:11, color:'var(--ink-mute)' }}>現有庫存</div>
          </div>
          <div className="row">
            <div className="field"><label>調整方式</label>
              <select className="select" value={adj.type} onChange={e=>setAdj({...adj,type:e.target.value})}>
                <option value="add">進貨 (＋)</option><option value="sub">出貨 (－)</option><option value="set">盤點 (＝)</option>
              </select>
            </div>
            <div className="field"><label>數量</label><input className="input mono" type="number" value={adj.qty} onChange={e=>setAdj({...adj,qty:e.target.value})}/></div>
          </div>
          <div className="field"><label>備註</label><input className="input" value={adj.note} onChange={e=>setAdj({...adj,note:e.target.value})} placeholder="進出貨說明"/></div>
        </div>
      </Modal>

      {/* View note */}
      <Modal open={!!noteView} onClose={()=>setNoteView(null)} title={noteView ? noteView.name + ' · 備註' : '備註'}
        footer={<>
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setNoteView(null)}>關閉</button>
        </>}>
        <div style={{ whiteSpace:'pre-wrap', fontSize:14, color:'var(--ink)', lineHeight:1.6, padding:'4px 0' }}>
          {noteView?.note}
        </div>
      </Modal>

      <PhotoLightbox url={photoView} onClose={()=>setPhotoView('')}/>
    </div>
  );
};

Object.assign(window, { FinanceView, InventoryView });
