// 碰器嚴選系統 — Sales channel control
const { useState: useStateCH, useMemo: useMemoCH } = React;

const CHANNEL_TYPES = [
  { v:'direct', l:'自營直銷', tone:'sage' },
  { v:'marketplace', l:'線上平台', tone:'clay' },
  { v:'pop-up', l:'快閃/實體', tone:'ochre' },
  { v:'wholesale', l:'批發', tone:'ink' },
];

const ChannelsView = ({ state, setState }) => {
  const [modalOpen, setModalOpen] = useStateCH(false);
  const [editingId, setEditingId] = useStateCH(null);
  const [form, setForm] = useStateCH(emptyCH());
  function emptyCH(){ return { id:'', name:'', type:'direct', fee:0, fee_unit:'%', sales:0, orders:0, note:'', active:true }; }

  const list = (state.channels || []).filter(c => !c._deleted);
  const totals = useMemoCH(()=>{
    const t = { sales:0, orders:0, fee:0, net:0 };
    list.forEach(c => {
      const fee = c.fee_unit==='%' ? c.sales * c.fee/100 : c.orders * c.fee;
      t.sales += c.sales; t.orders += c.orders; t.fee += fee; t.net += (c.sales - fee);
    });
    return t;
  }, [list]);

  const openNew = () => { setForm(emptyCH()); setEditingId(null); setModalOpen(true); };
  const openEdit = (c) => { setForm({...c}); setEditingId(c.id); setModalOpen(true); };
  const save = () => {
    if (!form.name) { toast('請填寫通路名稱'); return; }
    const rec = { ...form, fee:Number(form.fee)||0, sales:Number(form.sales)||0, orders:Number(form.orders)||0 };
    if (editingId) setState(s=>({ ...s, channels: (s.channels||[]).map(x=>x.id===editingId?rec:x) }));
    else setState(s=>({ ...s, channels: [{...rec, id:uid()}, ...(s.channels||[])] }));
    toast(editingId?'已更新':'已新增');
    setModalOpen(false);
  };
  const del = () => { if(!confirm('刪除此通路？將移至回收桶（保留 10 天）。'))return; setState(s=> window.softDel(s, 'channels', editingId)); setModalOpen(false); toast('已移至回收桶'); };

  const maxSales = Math.max(...list.map(c=>c.sales), 1);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">業務</div>
          <h1 className="h1">通路控管</h1>
          <div className="sub">{list.length} 個通路 · 總銷售 {fmtMoney(totals.sales,true)} · 扣除平台費淨收 {fmtMoney(totals.net,true)}</div>
        </div>
        <div className="topbar-r">
          <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={14}/> 新增通路</button>
        </div>
      </div>

      <div className="card flat" style={{ padding:0 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }} className="crm-stats">
          <div className="stat"><span className="lab">銷售總額</span><span className="val mono-val">{fmtMoney(totals.sales,true)}</span><span className="delta muted">所有通路</span></div>
          <div className="stat"><span className="lab">平台費用</span><span className="val mono-val" style={{ color:'var(--terracotta)' }}>{fmtMoney(totals.fee,true)}</span><span className="delta muted">{totals.sales?Math.round(totals.fee/totals.sales*100):0}% 佔比</span></div>
          <div className="stat"><span className="lab">實收淨額</span><span className="val mono-val" style={{ color:'var(--clay)' }}>{fmtMoney(totals.net,true)}</span><span className="delta muted">扣除手續費</span></div>
          <div className="stat"><span className="lab">訂單筆數</span><span className="val">{totals.orders}</span><span className="delta muted">平均單價 {fmtMoney(totals.orders?Math.round(totals.sales/totals.orders):0)}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">通路明細</div><div className="card-subtle">點卡片進入編輯</div></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:12 }}>
          {list.map(c => {
            const feeAmt = c.fee_unit==='%' ? c.sales * c.fee/100 : c.orders * c.fee;
            const net = c.sales - feeAmt;
            const pct = totals.sales ? Math.round(c.sales/totals.sales*100) : 0;
            const t = CHANNEL_TYPES.find(x=>x.v===c.type) || CHANNEL_TYPES[0];
            return (
              <div key={c.id} className="card flat" style={{ border:'1px solid var(--rule-soft)', padding:14, cursor:'pointer' }} onClick={()=>openEdit(c)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontFamily:'var(--f-serif)', fontSize:16, fontWeight:600 }}>{c.name}</div>
                    <Pill tone={t.tone}>{t.l}</Pill>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="mono" style={{ fontSize:17, fontWeight:700, color:'var(--clay)' }}>{fmtMoney(c.sales,true)}</div>
                    <div style={{ fontSize:10, color:'var(--ink-mute)' }}>{c.orders} 筆</div>
                  </div>
                </div>
                <div className="bar" style={{ margin:'8px 0' }}><div className="bar-fill" style={{ width: (c.sales/maxSales*100)+'%' }}/></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'8px 0 0', borderTop:'1px dashed var(--rule-soft)', fontSize:11 }}>
                  <div><span className="muted">抽成 </span><strong className="mono">{c.fee}{c.fee_unit}</strong></div>
                  <div style={{ textAlign:'right' }}><span className="muted">淨收 </span><strong className="mono" style={{ color:'var(--moss)' }}>{fmtMoney(net,true)}</strong></div>
                </div>
                {c.note && <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:8, lineHeight:1.5 }}>{c.note}</div>}
                <div style={{ marginTop:8, fontSize:10, color:'var(--ink-faint)' }}>佔比 {pct}%</div>
              </div>
            );
          })}
        </div>
        {list.length===0 && <EmptyState icon="channel" title="尚無通路" hint="新增一個銷售通路開始追蹤"/>}
      </div>

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editingId?'編輯通路':'新增通路'}
        footer={<>
          {editingId && <button className="btn btn-danger" onClick={del}><Icon name="trash" size={13}/> 刪除</button>}
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={save}>儲存</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>通路名稱<span className="req">*</span></label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="例：Pinkoi、自有官網"/></div>
          <div className="field"><label>類型</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {CHANNEL_TYPES.map(t=>(
                <button key={t.v} className={'btn btn-sm '+(form.type===t.v?'btn-ink':'btn-ghost')} style={{ flex:'1 1 auto' }} onClick={()=>setForm({...form, type:t.v})}>{t.l}</button>
              ))}
            </div>
          </div>
          <div className="row">
            <div className="field"><label>抽成 / 手續費</label><input className="input mono" type="number" value={form.fee} onChange={e=>setForm({...form,fee:e.target.value})}/></div>
            <div className="field"><label>計費方式</label>
              <select className="select" value={form.fee_unit} onChange={e=>setForm({...form,fee_unit:e.target.value})}>
                <option value="%">百分比 (%)</option>
                <option value="元/單">固定金額 (元/單)</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field"><label>累計銷售額</label><input className="input mono" type="number" value={form.sales} onChange={e=>setForm({...form,sales:e.target.value})}/></div>
            <div className="field"><label>訂單筆數</label><input className="input mono" type="number" value={form.orders} onChange={e=>setForm({...form,orders:e.target.value})}/></div>
          </div>
          <div className="field"><label>備註</label><textarea className="textarea" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
        </div>
      </Modal>
    </div>
  );
};

Object.assign(window, { ChannelsView });
