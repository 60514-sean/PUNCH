// Mobile showcase logic
const { useState: useShowSt } = React;

const SCREENS = [
  { num: '01', name: '總覽', desc: '月度快照、現金流、目標、待辦、庫存警示', page: 'dashboard' },
  { num: '02', name: '訂單追蹤', desc: '狀態分頁、搜尋、客戶與毛利一覽', page: 'orders' },
  { num: '03', name: '收支控管', desc: '月份切換、類型篩選、收支紀錄', page: 'finance' },
  { num: '04', name: '庫存管理', desc: '材料／商品分頁、低庫存警示、進出貨', page: 'inventory' },
  { num: '05', name: '產品成本', desc: '卡片式呈現、毛利/淨利快速試算', page: 'product' },
  { num: '06', name: '客戶管理', desc: 'VIP 分級、累計交易額、偏好備註', page: 'crm' },
  { num: '07', name: '報價單', desc: '基本資訊、品項、預覽與下載', page: 'quote' },
  { num: '08', name: '通路控管', desc: '多通路銷售、手續費、淨收分析', page: 'channels' },
];

const NAV_LIST = [
  { key:'dashboard', label:'總覽', icon:'dashboard' },
  { key:'orders', label:'訂單', icon:'orders' },
  { key:'finance', label:'收支', icon:'finance' },
  { key:'inventory', label:'庫存', icon:'inventory' },
  { key:'more', label:'更多', icon:'menu' },
];

const W = 402, H = 874;

function PhoneApp({ initial }){
  const [state, setState] = useShowSt(()=> JSON.parse(JSON.stringify(window.SEED)));
  const [page, setPage] = useShowSt(initial);
  const [moreOpen, setMoreOpen] = useShowSt(false);
  const pending = state.orders.filter(o => ['待處理','進行中','出貨中'].includes(o.status)).length;
  const alerts = state.stocks.filter(s => s.qty<=s.min).length;
  const goto = (p) => {
    if (p==='more') { setMoreOpen(true); return; }
    setPage(p); setMoreOpen(false);
  };

  const props = { state, setState, goto, openTask: ()=>{}, openOrder: ()=>{}, tweaks:{ greet_name:'宇澄' } };

  let View = null;
  switch(page){
    case 'dashboard': View = <Dashboard {...props}/>; break;
    case 'orders': View = <OrdersView {...props}/>; break;
    case 'finance': View = <FinanceView {...props}/>; break;
    case 'inventory': View = <InventoryView {...props}/>; break;
    case 'product': View = <ProductsView {...props}/>; break;
    case 'quote': View = <QuotesView {...props}/>; break;
    case 'crm': View = <CRMView {...props}/>; break;
    case 'channels': View = <ChannelsView {...props}/>; break;
    case 'settings': View = <SettingsView {...props}/>; break;
    default: View = <Dashboard {...props}/>;
  }

  const bottomNavMap = { quote:'more', product:'more', crm:'more', channels:'more', settings:'more' };
  const activeKey = bottomNavMap[page] || page;

  return (
    <div className="in-phone" style={{ height:'100%', display:'flex', flexDirection:'column', background:'var(--paper)', position:'relative' }}>
      <div className="mobile-topbar" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'var(--paper-soft)', borderBottom:'1px solid var(--rule)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className="brand-mark" style={{ width:30, height:30, fontSize:16, borderRadius:7 }}>碰</div>
          <div style={{ fontFamily:'var(--f-serif)', fontWeight:700, fontSize:15 }}>碰器嚴選</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="icon-btn"><Icon name="plus" size={16}/></button>
          <button className="icon-btn"><Icon name="menu" size={16}/></button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px 14px 100px', minHeight:0 }}>
        {View}
      </div>
      <nav style={{ display:'flex', position:'absolute', bottom:34, left:0, right:0, background:'var(--paper-soft)', borderTop:'1px solid var(--rule)', zIndex:40, paddingBottom:4 }}>
        {NAV_LIST.map(n=>(
          <button key={n.key} className={activeKey===n.key?'active':''}
            onClick={()=>goto(n.key)}
            style={{
              flex:1, background:'transparent', border:0, padding:'10px 4px', display:'flex',
              flexDirection:'column', alignItems:'center', gap:3,
              color: activeKey===n.key ? 'var(--clay)' : 'var(--ink-mute)',
              fontSize:10, cursor:'pointer', fontFamily:'inherit'
            }}>
            <Icon name={n.icon} size={20}/>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {moreOpen && (
        <div onClick={()=>setMoreOpen(false)} style={{ position:'absolute', inset:0, background:'rgba(43,31,20,0.45)', zIndex:50, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'var(--paper-soft)', borderRadius:'14px 14px 0 0', padding:'16px 16px 48px', borderTop:'1px solid var(--rule)' }}>
            <div style={{ width:36, height:4, background:'var(--rule)', borderRadius:2, margin:'0 auto 14px' }}/>
            <div style={{ fontFamily:'var(--f-serif)', fontWeight:700, fontSize:15, marginBottom:12 }}>更多功能</div>
            {[
              { key:'quote', label:'報價單', icon:'quote', desc:'開立與歷史報價' },
              { key:'product', label:'產品成本', icon:'product', desc:'毛利淨利試算' },
              { key:'crm', label:'客戶管理', icon:'crm', desc:'VIP 分級與備註' },
              { key:'channels', label:'通路控管', icon:'channel', desc:'各通路抽成分析' },
              { key:'settings', label:'設定 · 回收桶', icon:'settings', desc:'誤刪復原（10 天）' },
            ].map(m => (
              <button key={m.key} onClick={()=>goto(m.key)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 10px', background:'transparent', border:0, borderBottom:'1px solid var(--rule-soft)', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
                <div style={{ width:34, height:34, borderRadius:8, background:'var(--clay-tint)', color:'var(--clay)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon name={m.icon} size={16}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)' }}>{m.label}</div>
                  <div style={{ fontSize:11, color:'var(--ink-mute)' }}>{m.desc}</div>
                </div>
                <Icon name="chevron" size={14}/>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Showcase(){
  return (
    <>
      {SCREENS.map((s) => (
        <div className="phone-wrap" key={s.page} data-screen-label={`${s.num} ${s.name}`}>
          <IOSDevice width={W} height={H} dark={false}>
            <PhoneApp initial={s.page}/>
          </IOSDevice>
          <div className="phone-label">
            <div className="num">{s.num}</div>
            <div className="name">{s.name}</div>
            <div className="desc">{s.desc}</div>
          </div>
        </div>
      ))}
      <div id="toast" className="toast"/>
    </>
  );
}

const mount = document.getElementById('phones');
ReactDOM.createRoot(mount).render(<Showcase/>);
