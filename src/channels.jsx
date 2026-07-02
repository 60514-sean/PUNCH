// 碰器嚴選系統 — Sales channel control
const { useState: useStateCH, useMemo: useMemoCH } = React;

const strokeCollatorCH = new Intl.Collator('zh-u-co-stroke');

const CHANNEL_TYPES = [
  { v:'direct', l:'自營直銷', tone:'sage' },
  { v:'marketplace', l:'線上平台', tone:'clay' },
  { v:'pop-up', l:'快閃/實體', tone:'ochre' },
  { v:'wholesale', l:'批發', tone:'ink' },
];

// ─── 季節加權（1 = 平均水準），用於預估下月銷量 ───
const SEASON_FACTOR = { 1:1.25, 2:1.1, 3:0.95, 4:0.95, 5:1.1, 6:0.9, 7:0.9, 8:0.9, 9:0.95, 10:1.0, 11:1.2, 12:1.35 };
const seasonFactor = (m) => SEASON_FACTOR[m] || 1;

function ymAddCH(ymStr, delta) {
  const [y,m] = ymStr.split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function last6MonthsCH() {
  const now = new Date();
  const cur = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const arr = [];
  for (let i=5;i>=0;i--) arr.push(ymAddCH(cur,-i));
  return arr;
}
const monthLabelCH = (ymStr) => Number(ymStr.split('-')[1]) + '月';

// 依「近 3 個月平均銷量 × 下月季節加權」估算進貨時機與建議數量
function predictItem(state, channelId, stockId) {
  const sales = (state.channelSales||[]).filter(x=>!x._deleted && x.channelId===channelId && x.stockId===stockId)
    .sort((a,b)=>a.month.localeCompare(b.month));
  if (!sales.length) return null;
  const recent = sales.slice(-3);
  const avgQty = recent.reduce((a,b)=>a+(Number(b.qty)||0),0)/recent.length;
  const avgFactor = recent.reduce((a,b)=>a+seasonFactor(Number(b.month.split('-')[1])),0)/recent.length || 1;
  const now = new Date();
  const nextMonthNum = now.getMonth()+2 > 12 ? (now.getMonth()+2-12) : now.getMonth()+2;
  const predictedQty = avgQty * (seasonFactor(nextMonthNum)/avgFactor);
  const stockRow = (state.channelStock||[]).find(r=>r.channelId===channelId && r.stockId===stockId);
  const currentQty = stockRow ? stockRow.qty : 0;
  const dailyRate = predictedQty/30;
  const daysLeft = dailyRate>0 ? currentQty/dailyRate : null;
  const leadDays = 7;
  const dueInDays = daysLeft==null ? null : Math.max(0, Math.round(daysLeft - leadDays));
  const restockDate = dueInDays==null ? null : new Date(now.getTime()+dueInDays*86400000).toISOString().slice(0,10);
  const suggestedQty = Math.max(0, Math.ceil(predictedQty*1.5 - currentQty));
  return {
    currentQty,
    avgQty: Math.round(avgQty*10)/10,
    predictedQty: Math.round(predictedQty*10)/10,
    daysLeft: daysLeft==null ? null : Math.round(daysLeft),
    restockDate,
    suggestedQty,
  };
}

// 某通路（或全部）目前有紀錄過的品項組合
function allItemPairsCH(state, channelId) {
  const map = new Map();
  (state.channelStock||[]).filter(r=>!channelId || r.channelId===channelId).forEach(r=>map.set(r.channelId+'|'+r.stockId, { channelId:r.channelId, stockId:r.stockId }));
  (state.channelSales||[]).filter(x=>!x._deleted && (!channelId || x.channelId===channelId)).forEach(r=>map.set(r.channelId+'|'+r.stockId, { channelId:r.channelId, stockId:r.stockId }));
  return Array.from(map.values());
}

// ─── 業績金額固定含稅（5% 營業稅）。毛利(含稅) = 業績金額 − 通路抽成；淨利 = 毛利(含稅) − 稅 − 進貨成本 ───
const VAT_RATE = 5;
const untaxCH = (amt) => (Number(amt)||0) / (1 + VAT_RATE/100);

// 某通路某品項「至今」的進貨加權平均單位成本（依 channelRestocks 歷史回推，未進貨過則退回庫存管理單價成本）
function channelAvgCost(state, channelId, stockId) {
  const restocks = (state.channelRestocks||[]).filter(r=>!r._deleted && r.channelId===channelId && r.stockId===stockId);
  const totalQty = restocks.reduce((a,b)=>a+(Number(b.qty)||0),0);
  const totalCost = restocks.reduce((a,b)=>a+(Number(b.cost)||0),0);
  if (totalQty>0) return totalCost/totalQty;
  // 「產品管理」是成本的主要維護處：有連結產品就優先用產品的成本結構（直接+間接成本）
  const linkedProduct = (state.products||[]).find(p=>!p._deleted && p.stockId===stockId);
  if (linkedProduct) return (Number(linkedProduct.direct)||0) + (Number(linkedProduct.indirect)||0);
  // 未連結產品時，退回庫存管理單價當備援
  const stockItem = state.stocks.find(s=>s.id===stockId);
  return stockItem ? Number(stockItem.price)||0 : 0;
}

// 單筆月銷售的利潤拆解：通路抽成、進貨成本、毛利(含稅)、稅、淨利
// 毛利(含稅) = 業績金額 − 通路抽成；淨利 = 毛利(含稅) − 稅（毛利中內含的營業稅）− 進貨成本
function calcSaleProfit(channel, qty, revenue, unitCost) {
  const cost = (Number(qty)||0) * (Number(unitCost)||0);
  const fee = channel.fee_unit==='%' ? (Number(revenue)||0) * (Number(channel.fee)||0)/100 : (Number(qty)||0) * (Number(channel.fee)||0);
  const grossTaxed = (Number(revenue)||0) - fee;
  const tax = grossTaxed - untaxCH(grossTaxed);
  const profit = grossTaxed - tax - cost;
  return { cost, fee, grossTaxed, tax, profit };
}

// ═══ 通路詳情：庫存/進貨、月銷售、分析與預判 ═══
const ChannelDetail = ({ channel, state, setState, onBack, onEdit }) => {
  const [subTab, setSubTab] = useStateCH('stock'); // stock | sales | analysis
  const [restockOpen, setRestockOpen] = useStateCH(false);
  const [restockForm, setRestockForm] = useStateCH({ stockId:'', newName:'', qty:'', cost:'', date:new Date().toISOString().slice(0,10), note:'' });
  const [restockEdit, setRestockEdit] = useStateCH(null);
  const [openingOpen, setOpeningOpen] = useStateCH(false);
  const [openingForm, setOpeningForm] = useStateCH({ stockId:'', newName:'', qty:'' });
  const [saleOpen, setSaleOpen] = useStateCH(false);
  const [saleMonth, setSaleMonth] = useStateCH(new Date().toISOString().slice(0,7));
  const [saleRows, setSaleRows] = useStateCH([]);
  const [saleEditOpen, setSaleEditOpen] = useStateCH(false);
  const [saleEditForm, setSaleEditForm] = useStateCH({ id:null, productId:'', stockId:'', month:'', qty:'', price:'', note:'' });

  const goodsStocks = state.stocks.filter(s=>!s._deleted && s.kind==='goods').sort((a,b)=>strokeCollatorCH.compare(a.name, b.name));
  // 月銷售品項改抓「產品管理」清單；透過產品上的 stockId 連結取得「庫存管理」品項以維持扣庫存邏輯
  const saleProducts = (state.products||[]).filter(p=>!p._deleted).sort((a,b)=>strokeCollatorCH.compare(a.name, b.name));
  const stockOfProduct = (product) => product && product.stockId ? state.stocks.find(s=>!s._deleted && s.kind==='goods' && s.id===product.stockId) : null;
  const stockRows = (state.channelStock||[]).filter(r=>r.channelId===channel.id);
  const restocks = (state.channelRestocks||[]).filter(r=>r.channelId===channel.id && !r._deleted).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const sales = (state.channelSales||[]).filter(r=>r.channelId===channel.id && !r._deleted).sort((a,b)=>(b.month||'').localeCompare(a.month||'') || (a.name||'').localeCompare(b.name||''));

  const openRestock = () => { setRestockForm({ stockId: goodsStocks[0]?.id||'__new__', newName:'', qty:'', cost:'', date:new Date().toISOString().slice(0,10), note:'' }); setRestockOpen(true); };
  const saveRestock = () => {
    const qty = Number(restockForm.qty)||0;
    if (!qty) { toast('請輸入數量'); return; }
    const isNew = restockForm.stockId==='__new__';
    const newName = isNew ? (restockForm.newName||'').trim() : '';
    if (isNew && !newName) { toast('請輸入新品項名稱'); return; }
    if (!isNew && !state.stocks.find(s=>s.id===restockForm.stockId)) { toast('請選擇品項'); return; }
    const date = restockForm.date || new Date().toISOString().slice(0,10);
    setState(s=>{
      let stocksNext = s.stocks;
      let stockId = restockForm.stockId;
      let name;
      if (isNew) {
        stockId = uid();
        name = newName;
        stocksNext = [{ id:stockId, kind:'goods', name, cat:'', unit:'', qty:0, min:0, price:0, updated:date }, ...s.stocks];
      } else {
        const stockItem = s.stocks.find(x=>x.id===stockId);
        name = stockItem.name;
        stocksNext = s.stocks.map(x=> x.id===stockId ? { ...x, qty:Math.max(0,x.qty-qty), updated:date } : x);
      }
      const warehouseLog = { id:uid(), stockId, name, type:'out', qty, note:'出貨至通路：'+channel.name+(restockForm.note?'（'+restockForm.note+'）':''), date };
      let found = false;
      let chStock = (s.channelStock||[]).map(r=>{
        if (r.channelId===channel.id && r.stockId===stockId) { found = true; return { ...r, qty:r.qty+qty }; }
        return r;
      });
      if (!found) chStock = [...chStock, { id:uid(), channelId:channel.id, stockId, name, qty }];
      const restockRec = { id:uid(), channelId:channel.id, stockId, name, qty, cost:Number(restockForm.cost)||0, date, note:restockForm.note||'' };
      return { ...s, stocks: stocksNext, logs:[warehouseLog, ...s.logs], channelStock: chStock, channelRestocks:[restockRec, ...(s.channelRestocks||[])] };
    });
    toast(isNew?'已新增品項並登記進貨':'已登記進貨');
    setRestockOpen(false);
  };
  const openOpening = () => { setOpeningForm({ stockId: goodsStocks[0]?.id||'__new__', newName:'', qty:'' }); setOpeningOpen(true); };
  const saveOpening = () => {
    const qty = Number(openingForm.qty)||0;
    if (qty<0) { toast('數量不可為負數'); return; }
    const isNew = openingForm.stockId==='__new__';
    const newName = isNew ? (openingForm.newName||'').trim() : '';
    if (isNew && !newName) { toast('請輸入新品項名稱'); return; }
    if (!isNew && !state.stocks.find(s=>s.id===openingForm.stockId)) { toast('請選擇品項'); return; }
    setState(s=>{
      let stocksNext = s.stocks;
      let stockId = openingForm.stockId;
      let name;
      if (isNew) {
        stockId = uid();
        name = newName;
        stocksNext = [{ id:stockId, kind:'goods', name, cat:'', unit:'', qty:0, min:0, price:0, updated:new Date().toISOString().slice(0,10) }, ...s.stocks];
      } else {
        name = s.stocks.find(x=>x.id===stockId).name;
      }
      let found = false;
      let chStock = (s.channelStock||[]).map(r=>{
        if (r.channelId===channel.id && r.stockId===stockId) { found = true; return { ...r, qty, name }; }
        return r;
      });
      if (!found) chStock = [...chStock, { id:uid(), channelId:channel.id, stockId, name, qty }];
      return { ...s, stocks: stocksNext, channelStock: chStock };
    });
    toast(isNew?'已新增品項並設定原始庫存':'已設定原始庫存');
    setOpeningOpen(false);
  };
  const saveRestockEditFn = () => {
    if (!restockEdit) return;
    setState(s=>({ ...s, channelRestocks: (s.channelRestocks||[]).map(x=>x.id===restockEdit.id?{...x, date:restockEdit.date, note:restockEdit.note}:x) }));
    toast('已更新');
    setRestockEdit(null);
  };
  const deleteRestock = () => {
    if (!restockEdit) return;
    if (!confirm('刪除此筆進貨紀錄？將把庫存加回原倉庫。')) return;
    const rec = restockEdit;
    setState(s=>{
      const stocksNext = s.stocks.map(x=> x.id===rec.stockId ? { ...x, qty:x.qty+rec.qty } : x);
      const chStock = (s.channelStock||[]).map(r=> (r.channelId===rec.channelId && r.stockId===rec.stockId) ? { ...r, qty:Math.max(0,r.qty-rec.qty) } : r);
      return { ...s, stocks: stocksNext, channelStock: chStock, channelRestocks: (s.channelRestocks||[]).filter(x=>x.id!==rec.id) };
    });
    toast('已刪除，庫存已還原');
    setRestockEdit(null);
  };

  const emptySaleRow = () => {
    const firstP = saleProducts[0];
    const matched = stockOfProduct(firstP);
    return { rowId:uid(), productId:firstP?.id||'', stockId:matched?matched.id:'', qty:'', price:'', note:'' };
  };
  const openSaleNew = () => {
    setSaleMonth(new Date().toISOString().slice(0,7));
    setSaleRows([emptySaleRow()]);
    setSaleOpen(true);
  };
  const addSaleRow = () => setSaleRows(rows=>[...rows, emptySaleRow()]);
  const removeSaleRow = (rowId) => setSaleRows(rows=>rows.filter(r=>r.rowId!==rowId));
  const updateSaleRow = (rowId, patch) => setSaleRows(rows=>rows.map(r=>r.rowId===rowId?{...r,...patch}:r));
  const pickRowProduct = (rowId, productId) => {
    const product = saleProducts.find(p=>p.id===productId);
    const matched = stockOfProduct(product);
    if (product && !matched) toast('此產品尚未連結庫存管理品項，請先到「產品管理」設定連結');
    updateSaleRow(rowId, { productId, stockId: matched?matched.id:'', price:'' });
  };
  const saveSaleBatch = () => {
    const validRows = saleRows.filter(r=>r.stockId && Number(r.qty)>0);
    if (!validRows.length) { toast('請至少填寫一筆有效品項（需選品項與數量）'); return; }
    setState(s=>{
      let chStock = s.channelStock||[];
      const newRecs = validRows.map(r=>{
        const stockItem = state.stocks.find(x=>x.id===r.stockId);
        const qty = Number(r.qty)||0;
        const price = Number(r.price)||0;
        const revenue = qty * price;
        const unitCost = channelAvgCost(state, channel.id, r.stockId);
        chStock = chStock.map(cr=> (cr.channelId===channel.id && cr.stockId===r.stockId) ? { ...cr, qty:Math.max(0, cr.qty-qty) } : cr);
        return { id:uid(), channelId:channel.id, stockId:r.stockId, name:stockItem.name, month:saleMonth, qty, price, revenue, unitCost, note:r.note||'' };
      });
      return { ...s, channelSales: [...newRecs, ...(s.channelSales||[])], channelStock: chStock };
    });
    toast(`已新增 ${validRows.length} 筆月銷售`);
    setSaleOpen(false);
  };
  const openSaleEdit = (rec) => {
    const price = rec.price!=null ? rec.price : (rec.qty ? Math.round((rec.revenue/rec.qty)*100)/100 : 0);
    const matchedProduct = saleProducts.find(p=>p.stockId===rec.stockId) || saleProducts.find(p=>p.name===rec.name);
    setSaleEditForm({ id:rec.id, productId:matchedProduct?matchedProduct.id:'', stockId:rec.stockId, month:rec.month, qty:rec.qty, price, note:rec.note||'' });
    setSaleEditOpen(true);
  };
  const pickEditProduct = (productId) => {
    const product = saleProducts.find(p=>p.id===productId);
    const matched = stockOfProduct(product);
    if (product && !matched) toast('此產品尚未連結庫存管理品項，請先到「產品管理」設定連結');
    setSaleEditForm({ ...saleEditForm, productId, stockId: matched?matched.id:'', price:'' });
  };
  const saveSaleEdit = () => {
    const stockItem = state.stocks.find(s=>s.id===saleEditForm.stockId);
    if (!stockItem) { toast('請選擇品項'); return; }
    const qty = Number(saleEditForm.qty)||0;
    const price = Number(saleEditForm.price)||0;
    const revenue = qty * price;
    const unitCost = channelAvgCost(state, channel.id, stockItem.id);
    setState(s=>{
      const old = (s.channelSales||[]).find(x=>x.id===saleEditForm.id);
      const delta = qty - (old ? Number(old.qty)||0 : 0);
      const salesNext = (s.channelSales||[]).map(x=> x.id===saleEditForm.id ? { ...x, qty, price, revenue, unitCost, note:saleEditForm.note||'' } : x);
      const chStock = (s.channelStock||[]).map(r=> (r.channelId===channel.id && r.stockId===stockItem.id) ? { ...r, qty:Math.max(0, r.qty-delta) } : r);
      return { ...s, channelSales: salesNext, channelStock: chStock };
    });
    toast('已更新');
    setSaleEditOpen(false);
  };
  const handleDeleteSale = () => {
    if (!saleEditForm.id) return;
    if (!confirm('刪除此筆銷售紀錄？將把數量加回通路庫存。')) return;
    setState(s=>{
      const chStock = (s.channelStock||[]).map(r=> (r.channelId===channel.id && r.stockId===saleEditForm.stockId) ? { ...r, qty:r.qty+(Number(saleEditForm.qty)||0) } : r);
      return { ...s, channelStock: chStock, channelSales: (s.channelSales||[]).filter(x=>x.id!==saleEditForm.id) };
    });
    toast('已刪除，數量已還原');
    setSaleEditOpen(false);
  };

  const salesWithProfit = useMemoCH(()=>{
    return sales.map(r=>({ ...r, ...calcSaleProfit(channel, r.qty, r.revenue, r.unitCost!=null?r.unitCost:channelAvgCost(state, channel.id, r.stockId)) }));
  }, [sales, channel, state]);

  const salesByMonth = useMemoCH(()=>{
    const map = new Map();
    salesWithProfit.forEach(r=>{
      if (!map.has(r.month)) map.set(r.month, []);
      map.get(r.month).push(r);
    });
    return Array.from(map.entries())
      .sort((a,b)=>b[0].localeCompare(a[0]))
      .map(([month, rows])=>({
        month,
        rows: [...rows].sort((a,b)=>(a.name||'').localeCompare(b.name||'')),
        qty: rows.reduce((a,r)=>a+(Number(r.qty)||0),0),
        revenue: rows.reduce((a,r)=>a+(Number(r.revenue)||0),0),
        profit: rows.reduce((a,r)=>a+r.profit,0),
      }));
  }, [salesWithProfit]);

  const revenueTrend = useMemoCH(()=>{
    const months = last6MonthsCH();
    return months.map(m=>({ key:m, label:monthLabelCH(m), value: salesWithProfit.filter(x=>x.month===m).reduce((a,b)=>a+(Number(b.revenue)||0),0) }));
  }, [salesWithProfit]);

  const profitTrend = useMemoCH(()=>{
    const months = last6MonthsCH();
    return months.map(m=>({ key:m, label:monthLabelCH(m), value: salesWithProfit.filter(x=>x.month===m).reduce((a,b)=>a+b.profit,0) }));
  }, [salesWithProfit]);

  const analysisRows = useMemoCH(()=>{
    return allItemPairsCH(state, channel.id).map(p=>{
      const stockItem = state.stocks.find(s=>s.id===p.stockId);
      const pred = predictItem(state, channel.id, p.stockId);
      return { stockId:p.stockId, name: stockItem?stockItem.name:'(已刪除品項)', pred };
    }).filter(r=>r.pred);
  }, [state, channel.id]);

  const typeTag = CHANNEL_TYPES.find(t=>t.v===channel.type) || CHANNEL_TYPES[0];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="topbar">
        <div className="topbar-l">
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom:8 }}><Icon name="chevronLeft" size={14}/> 返回通路列表</button>
          <div className="eyebrow">通路詳情</div>
          <h1 className="h1">{channel.name}</h1>
          <div className="sub"><Pill tone={typeTag.tone}>{typeTag.l}</Pill> · 抽成 {channel.fee}{channel.fee_unit}</div>
        </div>
        <div className="topbar-r">
          <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" size={13}/> 編輯基本資料</button>
        </div>
      </div>

      <Segmented options={[{value:'stock',label:'庫存 / 進貨'},{value:'sales',label:'月銷售'},{value:'analysis',label:'分析與預判'}]} value={subTab} onChange={setSubTab}/>

      {subTab==='stock' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">通路庫存</div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost btn-sm" onClick={openOpening}><Icon name="edit" size={13}/> 設定原始庫存</button>
              <button className="btn btn-primary btn-sm" onClick={openRestock}><Icon name="plus" size={13}/> 登記進貨</button>
            </div>
          </div>
          <table className="tbl desk-only">
            <thead><tr><th>品項</th><th style={{ textAlign:'right' }}>目前在此通路庫存</th></tr></thead>
            <tbody>
              {stockRows.map(r=>(
                <tr key={r.id}><td style={{ fontWeight:600 }}>{r.name}</td><td className="num" style={{ fontWeight:700 }}>{r.qty}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mob-cards">
            {stockRows.map(r=>(
              <div key={r.id} className="mob-card">
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:600 }}>{r.name}</span>
                  <span className="mono" style={{ fontWeight:700 }}>{r.qty}</span>
                </div>
              </div>
            ))}
          </div>
          {stockRows.length===0 && <EmptyState icon="channel" title="尚無進貨紀錄" hint="登記第一筆進貨，開始追蹤此通路庫存"/>}

          <div style={{ marginTop:20, paddingTop:16, borderTop:'1px dashed var(--rule-soft)' }}>
            <div className="card-title" style={{ marginBottom:10 }}>進貨歷史</div>
            <table className="tbl desk-only">
              <thead><tr><th>日期</th><th>品項</th><th style={{ textAlign:'right' }}>數量</th><th style={{ textAlign:'right' }}>成本</th><th>備註</th></tr></thead>
              <tbody>
                {restocks.map(r=>(
                  <tr key={r.id} style={{ cursor:'pointer' }} onClick={()=>setRestockEdit({...r})}>
                    <td className="mono" style={{ fontSize:12, color:'var(--ink-mute)' }}>{fmtDateFull(r.date)}</td>
                    <td>{r.name}</td>
                    <td className="num" style={{ color:'var(--moss)', fontWeight:700 }}>+{r.qty}</td>
                    <td className="num">{r.cost?fmtMoney(r.cost):'-'}</td>
                    <td style={{ fontSize:12, color:'var(--ink-soft)' }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mob-cards">
              {restocks.map(r=>(
                <div key={r.id} className="mob-card" style={{ cursor:'pointer' }} onClick={()=>setRestockEdit({...r})}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <div><div style={{ fontWeight:600 }}>{r.name}</div><div style={{ fontSize:11, color:'var(--ink-mute)' }}>{fmtDateFull(r.date)}</div></div>
                    <div className="mono" style={{ fontWeight:700, color:'var(--moss)' }}>+{r.qty}</div>
                  </div>
                </div>
              ))}
            </div>
            {restocks.length===0 && <div style={{ padding:'12px 0', fontSize:12, color:'var(--ink-mute)' }}>尚無紀錄</div>}
          </div>
        </div>
      )}

      {subTab==='sales' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">每月銷售紀錄（依品項）</div>
            <button className="btn btn-primary btn-sm" onClick={openSaleNew}><Icon name="plus" size={13}/> 新增月銷售</button>
          </div>
          {salesByMonth.map(g=>(
            <div key={g.month} className="month-group">
              <div className="month-group-head">
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ fontFamily:'var(--f-serif)', fontSize:19, fontWeight:700 }}>{monthLabelCH(g.month)}</span>
                  <span className="mono" style={{ fontSize:11, color:'var(--ink-faint)' }}>{g.month}</span>
                  <span className="pill" style={{ fontSize:11 }}>{g.qty} 件</span>
                </div>
                <div style={{ display:'flex', gap:20, alignItems:'center' }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'var(--ink-mute)' }}>業績（含稅）</div>
                    <div className="mono" style={{ fontWeight:700 }}>{fmtMoney(g.revenue,true)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'var(--ink-mute)' }}>淨利</div>
                    <div className="mono" style={{ fontWeight:700, color: g.profit>=0?'var(--moss)':'var(--terracotta)' }}>{fmtMoney(Math.round(g.profit),true)}</div>
                  </div>
                </div>
              </div>
              {g.rows.map(r=>(
                <div key={r.id} className="month-group-row" onClick={()=>openSaleEdit(r)}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:600 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{r.qty} 件{r.note?' · '+r.note:''}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div className="mono" style={{ fontWeight:700 }}>{fmtMoney(r.revenue,true)}</div>
                    <div className="mono" style={{ fontSize:11, color: r.profit>=0?'var(--moss)':'var(--terracotta)' }}>淨利 {fmtMoney(Math.round(r.profit),true)}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {sales.length===0 && <EmptyState icon="finance" title="尚無銷售紀錄" hint="新增本月的品項銷售資料"/>}
        </div>
      )}

      {subTab==='analysis' && (
        <>
          <div className="card flat" style={{ padding:0 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)' }} className="crm-stats">
              <div className="stat"><span className="lab">本月業績（含稅）</span><span className="val mono-val">{fmtMoney(salesWithProfit.filter(x=>x.month===new Date().toISOString().slice(0,7)).reduce((a,b)=>a+(Number(b.revenue)||0),0),true)}</span></div>
              <div className="stat"><span className="lab">本月淨利</span><span className="val mono-val" style={{ color:'var(--moss)' }}>{fmtMoney(Math.round(salesWithProfit.filter(x=>x.month===new Date().toISOString().slice(0,7)).reduce((a,b)=>a+b.profit,0)),true)}</span></div>
              <div className="stat"><span className="lab">近6月累計淨利</span><span className="val mono-val" style={{ color:'var(--moss)' }}>{fmtMoney(Math.round(profitTrend.reduce((a,b)=>a+b.value,0)),true)}</span></div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="card-title">近 6 個月業績趨勢</div><div className="card-subtle">含稅金額</div></div>
            <Sparkline data={revenueTrend.map(m=>m.value)} labels={revenueTrend.map(m=>m.label)} color="var(--clay)"/>
          </div>
          <div className="card">
            <div className="card-head"><div className="card-title">近 6 個月淨利趨勢</div><div className="card-subtle">毛利(含稅) − 稅 − 進貨成本</div></div>
            <Sparkline data={profitTrend.map(m=>m.value)} labels={profitTrend.map(m=>m.label)} color="var(--moss)"/>
          </div>
          <div className="card">
            <div className="card-head"><div className="card-title">品項進貨預判</div><div className="card-subtle">依近 3 月銷量與季節指數估算</div></div>
            <table className="tbl desk-only">
              <thead><tr><th>品項</th><th style={{ textAlign:'right' }}>目前庫存</th><th style={{ textAlign:'right' }}>近3月均銷</th><th style={{ textAlign:'right' }}>預估下月銷量</th><th style={{ textAlign:'right' }}>可撐天數</th><th style={{ textAlign:'right' }}>建議進貨量</th><th>建議進貨日</th></tr></thead>
              <tbody>
                {analysisRows.map(r=>(
                  <tr key={r.stockId}>
                    <td style={{ fontWeight:600 }}>{r.name}</td>
                    <td className="num">{r.pred.currentQty}</td>
                    <td className="num">{r.pred.avgQty}</td>
                    <td className="num">{r.pred.predictedQty}</td>
                    <td className="num" style={{ color: r.pred.daysLeft!=null && r.pred.daysLeft<=14 ? 'var(--terracotta)':'var(--ink)' }}>{r.pred.daysLeft==null?'--':r.pred.daysLeft+' 天'}</td>
                    <td className="num" style={{ fontWeight:700 }}>{r.pred.suggestedQty}</td>
                    <td className="mono" style={{ fontSize:12 }}>{r.pred.restockDate?fmtDateFull(r.pred.restockDate):'--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mob-cards">
              {analysisRows.map(r=>(
                <div key={r.stockId} className="mob-card">
                  <div style={{ fontWeight:700, marginBottom:6 }}>{r.name}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:12 }}>
                    <div className="muted">目前庫存 <b>{r.pred.currentQty}</b></div>
                    <div className="muted">近3月均銷 <b>{r.pred.avgQty}</b></div>
                    <div className="muted">可撐天數 <b style={{ color: r.pred.daysLeft!=null && r.pred.daysLeft<=14?'var(--terracotta)':undefined }}>{r.pred.daysLeft==null?'--':r.pred.daysLeft+'天'}</b></div>
                    <div className="muted">建議進貨 <b>{r.pred.suggestedQty}</b></div>
                  </div>
                  {r.pred.restockDate && <div style={{ marginTop:6, fontSize:11, color:'var(--ink-mute)' }}>建議進貨日 {fmtDateFull(r.pred.restockDate)}</div>}
                </div>
              ))}
            </div>
            {analysisRows.length===0 && <EmptyState icon="channel" title="資料不足以預判" hint="需至少 1 個月的月銷售紀錄才能估算"/>}
          </div>
        </>
      )}

      {/* 設定原始庫存 */}
      <Modal open={openingOpen} onClose={()=>setOpeningOpen(false)} title="設定原始庫存"
        footer={<><div style={{ flex:1 }}/><button className="btn btn-ghost" onClick={()=>setOpeningOpen(false)}>取消</button><button className="btn btn-primary" onClick={saveOpening}>儲存</button></>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>品項<span className="req">*</span></label>
            <select className="select" value={openingForm.stockId} onChange={e=>setOpeningForm({...openingForm,stockId:e.target.value})}>
              {goodsStocks.length===0 && <option value="">尚無商品庫存品項</option>}
              {goodsStocks.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__new__">+ 新增此通路專屬新品項…</option>
            </select>
          </div>
          {openingForm.stockId==='__new__' && (
            <div className="field"><label>新品項名稱<span className="req">*</span></label>
              <input className="input" value={openingForm.newName} onChange={e=>setOpeningForm({...openingForm,newName:e.target.value})} placeholder="例：快閃限定紀念杯"/>
            </div>
          )}
          <div className="field"><label>此通路目前實際庫存數量</label><input className="input mono" type="number" value={openingForm.qty} onChange={e=>setOpeningForm({...openingForm,qty:e.target.value})}/></div>
          <div style={{ fontSize:11, color:'var(--ink-mute)' }}>直接設定此通路的庫存數字，不會扣「庫存管理」倉庫、也不會產生進貨紀錄。適合第一次啟用系統時，登記通路現場已有的庫存；選「新增此通路專屬新品項」則會同步在「庫存管理」建立這個品項（倉庫庫存從 0 開始）。之後的進出貨請用「登記進貨」與「新增月銷售」。</div>
        </div>
      </Modal>

      {/* 登記進貨 */}
      <Modal open={restockOpen} onClose={()=>setRestockOpen(false)} title="登記進貨"
        footer={<><div style={{ flex:1 }}/><button className="btn btn-ghost" onClick={()=>setRestockOpen(false)}>取消</button><button className="btn btn-primary" onClick={saveRestock}>儲存</button></>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>品項<span className="req">*</span></label>
            <select className="select" value={restockForm.stockId} onChange={e=>setRestockForm({...restockForm,stockId:e.target.value})}>
              {goodsStocks.length===0 && <option value="">尚無商品庫存品項</option>}
              {goodsStocks.map(s=><option key={s.id} value={s.id}>{s.name}（倉庫現有 {s.qty}）</option>)}
              <option value="__new__">+ 新增此通路專屬新品項…</option>
            </select>
          </div>
          {restockForm.stockId==='__new__' && (
            <div className="field"><label>新品項名稱<span className="req">*</span></label>
              <input className="input" value={restockForm.newName} onChange={e=>setRestockForm({...restockForm,newName:e.target.value})} placeholder="例：快閃限定紀念杯"/>
            </div>
          )}
          <div className="row">
            <div className="field"><label>進貨數量</label><input className="input mono" type="number" value={restockForm.qty} onChange={e=>setRestockForm({...restockForm,qty:e.target.value})}/></div>
            <div className="field"><label>本批總成本（選填）</label><input className="input mono" type="number" value={restockForm.cost} onChange={e=>setRestockForm({...restockForm,cost:e.target.value})}/></div>
          </div>
          <div className="row">
            <div className="field"><label>日期</label><input className="input" type="date" value={restockForm.date} onChange={e=>setRestockForm({...restockForm,date:e.target.value})}/></div>
            <div className="field"><label>備註</label><input className="input" value={restockForm.note} onChange={e=>setRestockForm({...restockForm,note:e.target.value})}/></div>
          </div>
          <div style={{ fontSize:11, color:'var(--ink-mute)' }}>進貨會從「庫存管理」倉庫扣除對應數量，並記錄一筆出貨紀錄。填寫總成本可用於估算此通路的單位進貨成本與銷售淨利；選「新增此通路專屬新品項」會先在「庫存管理」建立品項（倉庫庫存從 0 開始）再登記出貨。</div>
        </div>
      </Modal>

      {/* 編輯進貨紀錄（日期/備註） */}
      <Modal open={!!restockEdit} onClose={()=>setRestockEdit(null)} title="編輯進貨紀錄"
        footer={<><button className="btn btn-danger" onClick={deleteRestock}><Icon name="trash" size={13}/> 刪除</button><div style={{ flex:1 }}/><button className="btn btn-ghost" onClick={()=>setRestockEdit(null)}>取消</button><button className="btn btn-primary" onClick={saveRestockEditFn}>確認</button></>}>
        {restockEdit && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ padding:'12px 16px', background:'var(--paper-deep)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div className="eyebrow">{restockEdit.name}</div>
              <div className="mono" style={{ fontWeight:700, color:'var(--moss)' }}>+{restockEdit.qty}</div>
            </div>
            <div className="row">
              <div className="field"><label>日期</label><input className="input" type="date" value={restockEdit.date} onChange={e=>setRestockEdit({...restockEdit,date:e.target.value})}/></div>
              <div className="field"><label>備註</label><input className="input" value={restockEdit.note||''} onChange={e=>setRestockEdit({...restockEdit,note:e.target.value})}/></div>
            </div>
          </div>
        )}
      </Modal>

      {/* 新增月銷售（可一次新增多筆品項） */}
      <Modal open={saleOpen} onClose={()=>setSaleOpen(false)} title="新增月銷售"
        footer={<>
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setSaleOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={saveSaleBatch}>儲存全部</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field" style={{ maxWidth:220 }}><label>月份</label><input className="input" type="month" value={saleMonth} onChange={e=>setSaleMonth(e.target.value)}/></div>
          {saleRows.map((row, idx) => {
            const unitCost = row.stockId ? channelAvgCost(state, channel.id, row.stockId) : 0;
            const revenue = (Number(row.qty)||0)*(Number(row.price)||0);
            const p = calcSaleProfit(channel, Number(row.qty)||0, revenue, unitCost);
            return (
              <div key={row.rowId} style={{ border:'1px solid var(--rule-soft)', borderRadius:'var(--r-lg)', background:'var(--paper-deep)', padding:14, display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span className="eyebrow">第 {idx+1} 筆</span>
                  {saleRows.length>1 && <button className="btn btn-ghost btn-sm" onClick={()=>removeSaleRow(row.rowId)}><Icon name="trash" size={13}/> 移除</button>}
                </div>
                <div className="field"><label>品項<span className="req">*</span></label>
                  <select className="select" value={row.productId} onChange={e=>pickRowProduct(row.rowId, e.target.value)}>
                    {saleProducts.length===0 && <option value="">尚無產品成本項目</option>}
                    {saleProducts.map(sp=><option key={sp.id} value={sp.id}>{sp.name}</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field" style={{ minWidth:0 }}><label>數量</label><input className="input mono" type="number" value={row.qty} onChange={e=>updateSaleRow(row.rowId,{qty:e.target.value})}/></div>
                  <div className="field" style={{ minWidth:0 }}><label>售價（含稅／單）</label><input className="input mono" type="number" value={row.price} onChange={e=>updateSaleRow(row.rowId,{price:e.target.value})}/></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field" style={{ minWidth:0 }}><label>業績（自動計算）</label>
                    <div className="input mono" style={{ background:'var(--paper-soft)', fontWeight:700, display:'flex', alignItems:'center' }}>{fmtMoney(revenue)}</div>
                  </div>
                  <div className="field" style={{ minWidth:0 }}><label>預估淨利</label>
                    <div className="input mono" style={{ background:'var(--paper-soft)', fontWeight:700, display:'flex', alignItems:'center', color: p.profit>=0?'var(--moss)':'var(--terracotta)' }}>{revenue?fmtMoney(Math.round(p.profit)):'-'}</div>
                  </div>
                </div>
                <div className="field"><label>備註</label><input className="input" value={row.note} onChange={e=>updateSaleRow(row.rowId,{note:e.target.value})}/></div>
              </div>
            );
          })}
          {saleRows.length>1 && (()=>{
            const totalRevenue = saleRows.reduce((a,r)=>a+(Number(r.qty)||0)*(Number(r.price)||0),0);
            const totalProfit = saleRows.reduce((a,r)=>{
              const unitCost = r.stockId ? channelAvgCost(state, channel.id, r.stockId) : 0;
              const revenue = (Number(r.qty)||0)*(Number(r.price)||0);
              return a + calcSaleProfit(channel, Number(r.qty)||0, revenue, unitCost).profit;
            },0);
            return (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'var(--paper-deep)', border:'1px solid var(--rule-soft)', borderRadius:'var(--r-lg)' }}>
                <span style={{ fontWeight:700 }}>合計</span>
                <div style={{ display:'flex', gap:24 }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'var(--ink-mute)' }}>業績</div>
                    <div className="mono" style={{ fontWeight:700 }}>{fmtMoney(totalRevenue)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'var(--ink-mute)' }}>淨利</div>
                    <div className="mono" style={{ fontWeight:700, color: totalProfit>=0?'var(--moss)':'var(--terracotta)' }}>{fmtMoney(Math.round(totalProfit))}</div>
                  </div>
                </div>
              </div>
            );
          })()}
          <button className="btn btn-ghost btn-sm" onClick={addSaleRow} style={{ alignSelf:'flex-start' }}><Icon name="plus" size={13}/> 再新增一筆品項</button>
        </div>
      </Modal>

      {/* 編輯月銷售 */}
      <Modal open={saleEditOpen} onClose={()=>setSaleEditOpen(false)} title="編輯月銷售"
        footer={<>
          <button className="btn btn-danger" onClick={handleDeleteSale}><Icon name="trash" size={13}/> 刪除</button>
          <div style={{ flex:1 }}/>
          <button className="btn btn-ghost" onClick={()=>setSaleEditOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={saveSaleEdit}>儲存</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>品項<span className="req">*</span></label>
            <select className="select" value={saleEditForm.productId} disabled onChange={e=>pickEditProduct(e.target.value)}>
              {saleProducts.length===0 && <option value="">尚無產品成本項目</option>}
              {saleProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              {!saleProducts.some(p=>p.id===saleEditForm.productId) &&
                <option value={saleEditForm.productId}>{(state.stocks.find(s=>s.id===saleEditForm.stockId)||{}).name || '（原品項）'}</option>}
            </select>
          </div>
          <div className="row">
            <div className="field"><label>月份</label><input className="input" type="month" value={saleEditForm.month} disabled/></div>
            <div className="field"><label>銷售數量</label><input className="input mono" type="number" value={saleEditForm.qty} onChange={e=>setSaleEditForm({...saleEditForm,qty:e.target.value})}/></div>
          </div>
          {saleEditForm.stockId && (
            <div style={{ fontSize:11, color:'var(--ink-mute)' }}>
              此品項在本通路目前平均進貨成本：<strong className="mono" style={{ color:'var(--ink)' }}>{fmtMoney(Math.round(channelAvgCost(state, channel.id, saleEditForm.stockId)))}</strong>／單，請自行輸入售價
            </div>
          )}
          <div className="row">
            <div className="field"><label>售價（含稅／單）</label><input className="input mono" type="number" value={saleEditForm.price} onChange={e=>setSaleEditForm({...saleEditForm,price:e.target.value})}/></div>
            <div className="field"><label>業績金額（含稅，自動計算）</label>
              <div className="input mono" style={{ background:'var(--paper-deep)', display:'flex', alignItems:'center', fontWeight:700 }}>
                {fmtMoney((Number(saleEditForm.qty)||0)*(Number(saleEditForm.price)||0))}
              </div>
            </div>
          </div>
          <div className="field"><label>備註</label><input className="input" value={saleEditForm.note} onChange={e=>setSaleEditForm({...saleEditForm,note:e.target.value})}/></div>
          {saleEditForm.stockId && (Number(saleEditForm.qty)>0 || Number(saleEditForm.price)>0) && (()=>{
            const previewCost = channelAvgCost(state, channel.id, saleEditForm.stockId);
            const previewRevenue = (Number(saleEditForm.qty)||0)*(Number(saleEditForm.price)||0);
            const p = calcSaleProfit(channel, Number(saleEditForm.qty)||0, previewRevenue, previewCost);
            return (
              <div style={{ padding:'12px 14px', background:'var(--paper-deep)', borderRadius:8, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, fontSize:12 }}>
                <div><div className="muted" style={{ fontSize:11 }}>通路抽成</div><div className="mono" style={{ fontWeight:700 }}>{fmtMoney(Math.round(p.fee))}</div></div>
                <div><div className="muted" style={{ fontSize:11 }}>進貨成本</div><div className="mono" style={{ fontWeight:700 }}>{fmtMoney(Math.round(p.cost))}</div></div>
                <div><div className="muted" style={{ fontSize:11 }}>毛利（含稅）</div><div className="mono" style={{ fontWeight:700 }}>{fmtMoney(Math.round(p.grossTaxed))}</div></div>
                <div><div className="muted" style={{ fontSize:11 }}>預估淨利</div><div className="mono" style={{ fontWeight:700, color: p.profit>=0?'var(--moss)':'var(--terracotta)' }}>{fmtMoney(Math.round(p.profit))}</div></div>
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
};

// ═══ 全通路分析 ═══
const ChannelsAnalysis = ({ state, channels }) => {
  const months = last6MonthsCH();
  const allSales = (state.channelSales||[]).filter(x=>!x._deleted);

  const channelsById = new Map(channels.map(c=>[c.id,c]));
  const salesWithProfit = allSales.map(r=>{
    const ch = channelsById.get(r.channelId);
    if (!ch) return { ...r, cost:0, fee:0, grossTaxed:r.revenue, tax:r.revenue-untaxCH(r.revenue), profit:untaxCH(r.revenue) };
    const unitCost = r.unitCost!=null ? r.unitCost : channelAvgCost(state, r.channelId, r.stockId);
    return { ...r, ...calcSaleProfit(ch, r.qty, r.revenue, unitCost) };
  });

  const byChannel = channels.map(c=>{
    const recs = salesWithProfit.filter(x=>x.channelId===c.id);
    return {
      id:c.id, name:c.name,
      revenue: recs.reduce((a,b)=>a+(Number(b.revenue)||0),0),
      profit: recs.reduce((a,b)=>a+b.profit,0),
    };
  }).sort((a,b)=>b.revenue-a.revenue);
  const byChannelProfit = [...byChannel].sort((a,b)=>b.profit-a.profit);

  const monthlyTotal = months.map(m=>({ key:m, label:monthLabelCH(m), value: salesWithProfit.filter(x=>x.month===m).reduce((a,b)=>a+(Number(b.revenue)||0),0) }));
  const monthlyProfit = months.map(m=>({ key:m, label:monthLabelCH(m), value: salesWithProfit.filter(x=>x.month===m).reduce((a,b)=>a+b.profit,0) }));

  const byType = CHANNEL_TYPES.map(t=>({
    label:t.l,
    value: channels.filter(c=>c.type===t.v).reduce((sum,c)=> sum + salesWithProfit.filter(x=>x.channelId===c.id).reduce((a,b)=>a+(Number(b.revenue)||0),0), 0),
  }));

  const alerts = [];
  channels.forEach(c=>{
    allItemPairsCH(state, c.id).forEach(p=>{
      const pred = predictItem(state, c.id, p.stockId);
      if (!pred) return;
      if (pred.daysLeft!=null && pred.daysLeft<=30) {
        const stockItem = state.stocks.find(s=>s.id===p.stockId);
        alerts.push({ channelName:c.name, itemName: stockItem?stockItem.name:'(已刪除品項)', ...pred });
      }
    });
  });
  alerts.sort((a,b)=>(a.daysLeft??999)-(b.daysLeft??999));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="card">
        <div className="card-head"><div className="card-title">全通路業績趨勢（近 6 個月）</div><div className="card-subtle">含稅金額</div></div>
        <Sparkline data={monthlyTotal.map(m=>m.value)} labels={monthlyTotal.map(m=>m.label)} color="var(--clay)"/>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">全通路淨利趨勢（近 6 個月）</div><div className="card-subtle">毛利(含稅) − 稅 − 進貨成本</div></div>
        <Sparkline data={monthlyProfit.map(m=>m.value)} labels={monthlyProfit.map(m=>m.label)} color="var(--moss)"/>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">通路業績排名</div><div className="card-subtle">依各通路月銷售紀錄加總</div></div>
        {byChannel.some(c=>c.revenue>0)
          ? <BarList items={byChannel.map(c=>({ label:c.name, value:c.revenue }))}/>
          : <EmptyState icon="channel" title="尚無品項銷售資料" hint="於各通路的「月銷售」分頁登記後即可看到排名"/>}
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">通路淨利排名</div><div className="card-subtle">扣除進貨成本與抽成後</div></div>
        {byChannelProfit.some(c=>c.profit!==0)
          ? <BarList items={byChannelProfit.map(c=>({ label:c.name, value:Math.round(c.profit) }))} color="var(--moss)"/>
          : <EmptyState icon="channel" title="尚無資料"/>}
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">通路類型佔比</div></div>
        {byType.some(t=>t.value>0)
          ? <BarList items={byType}/>
          : <EmptyState icon="channel" title="尚無資料"/>}
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">進貨提醒</div><div className="card-subtle">預估 30 天內需補貨的品項</div></div>
        <table className="tbl desk-only">
          <thead><tr><th>通路</th><th>品項</th><th style={{ textAlign:'right' }}>目前庫存</th><th style={{ textAlign:'right' }}>可撐天數</th><th style={{ textAlign:'right' }}>建議進貨量</th><th>建議進貨日</th></tr></thead>
          <tbody>
            {alerts.slice(0,15).map((a,i)=>(
              <tr key={i}>
                <td>{a.channelName}</td>
                <td style={{ fontWeight:600 }}>{a.itemName}</td>
                <td className="num">{a.currentQty}</td>
                <td className="num" style={{ color:'var(--terracotta)', fontWeight:700 }}>{a.daysLeft==null?'--':a.daysLeft+' 天'}</td>
                <td className="num">{a.suggestedQty}</td>
                <td className="mono" style={{ fontSize:12 }}>{a.restockDate?fmtDateFull(a.restockDate):'--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mob-cards">
          {alerts.slice(0,15).map((a,i)=>(
            <div key={i} className="mob-card">
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <div><div style={{ fontWeight:700 }}>{a.itemName}</div><div style={{ fontSize:11, color:'var(--ink-mute)' }}>{a.channelName}</div></div>
                <div className="mono" style={{ fontWeight:700, color:'var(--terracotta)' }}>{a.daysLeft==null?'--':a.daysLeft+'天'}</div>
              </div>
              <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:4 }}>建議進貨 {a.suggestedQty}（{a.restockDate?fmtDateFull(a.restockDate):'--'}）</div>
            </div>
          ))}
        </div>
        {alerts.length===0 && <EmptyState icon="channel" title="目前沒有需要注意的補貨提醒"/>}
      </div>
    </div>
  );
};

// ═══ 通路列表 + CRUD ═══
const ChannelsView = ({ state, setState }) => {
  const [modalOpen, setModalOpen] = useStateCH(false);
  const [editingId, setEditingId] = useStateCH(null);
  const [form, setForm] = useStateCH(emptyCH());
  const [topTab, setTopTab] = useStateCH('list'); // list | analysis
  const [detailId, setDetailId] = useStateCH(null);
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
  const activeChannel = detailId ? list.find(c=>c.id===detailId) : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {activeChannel ? (
        <ChannelDetail channel={activeChannel} state={state} setState={setState}
          onBack={()=>setDetailId(null)} onEdit={()=>openEdit(activeChannel)}/>
      ) : (
        <>
          <div className="topbar">
            <div className="topbar-l">
              <div className="eyebrow">業務</div>
              <h1 className="h1">通路控管</h1>
              <div className="sub">{list.length} 個通路 · 總銷售 {fmtMoney(totals.sales,true)} · 扣除平台費淨收 {fmtMoney(totals.net,true)}</div>
            </div>
            <div className="topbar-r">
              <button className={'btn btn-sm '+(topTab==='analysis'?'btn-ink':'btn-ghost')} onClick={()=>setTopTab(topTab==='analysis'?'list':'analysis')}>
                {topTab==='analysis'?'回到通路列表':'全通路分析'}
              </button>
              <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={14}/> 新增通路</button>
            </div>
          </div>

          {topTab==='analysis' ? (
            <ChannelsAnalysis state={state} channels={list}/>
          ) : (
            <>
              <div className="card flat" style={{ padding:0 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }} className="crm-stats">
                  <div className="stat"><span className="lab">銷售總額</span><span className="val mono-val">{fmtMoney(totals.sales,true)}</span><span className="delta muted">所有通路</span></div>
                  <div className="stat"><span className="lab">平台費用</span><span className="val mono-val" style={{ color:'var(--terracotta)' }}>{fmtMoney(totals.fee,true)}</span><span className="delta muted">{totals.sales?Math.round(totals.fee/totals.sales*100):0}% 佔比</span></div>
                  <div className="stat"><span className="lab">實收淨額</span><span className="val mono-val" style={{ color:'var(--clay)' }}>{fmtMoney(totals.net,true)}</span><span className="delta muted">扣除手續費</span></div>
                  <div className="stat"><span className="lab">訂單筆數</span><span className="val">{totals.orders}</span><span className="delta muted">平均單價 {fmtMoney(totals.orders?Math.round(totals.sales/totals.orders):0)}</span></div>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><div className="card-title">通路明細</div><div className="card-subtle">點卡片查看詳情</div></div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:12 }}>
                  {list.map(c => {
                    const feeAmt = c.fee_unit==='%' ? c.sales * c.fee/100 : c.orders * c.fee;
                    const net = c.sales - feeAmt;
                    const pct = totals.sales ? Math.round(c.sales/totals.sales*100) : 0;
                    const t = CHANNEL_TYPES.find(x=>x.v===c.type) || CHANNEL_TYPES[0];
                    return (
                      <div key={c.id} className="card flat" style={{ border:'1px solid var(--rule-soft)', padding:14, cursor:'pointer' }} onClick={()=>setDetailId(c.id)}>
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
            </>
          )}
        </>
      )}

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
