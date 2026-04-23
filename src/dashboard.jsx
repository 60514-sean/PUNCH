// 碰器嚴選系統 — Dashboard view
const { useMemo, useState } = React;

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return '早安';
  if (h >= 12 && h < 17) return '午安';
  if (h >= 17 && h < 21) return '晚安';
  return '深夜好';
}

const Dashboard = ({ state, setState, goto, openTask, openOrder, ...props }) => {
  const { orders, finances, stocks, goals, tasks } = state;
  const thisMonth = goals.month;

  const monthFinances = finances.filter(f => ym(f.date) === thisMonth);
  const income = monthFinances.filter(f=>f.type==='income').reduce((a,b)=>a+b.amount,0);
  const expense = monthFinances.filter(f=>f.type==='expense').reduce((a,b)=>a+b.amount,0);
  const net = income - expense;

  const trend = useMemo(()=>{
    const months = [];
    const [y,m] = thisMonth.split('-').map(Number);
    for (let i=5;i>=0;i--){
      const d = new Date(y, m-1-i, 1);
      const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      const label = (d.getMonth()+1)+'月';
      const inc = finances.filter(f=>f.type==='income'&&ym(f.date)===key).reduce((a,b)=>a+b.amount,0);
      const exp = finances.filter(f=>f.type==='expense'&&ym(f.date)===key).reduce((a,b)=>a+b.amount,0);
      months.push({ key, label, income:inc, expense:exp, net: inc-exp });
    }
    return months;
  }, [finances, thisMonth]);

  const pendingOrders = orders.filter(o => ['待處理','進行中','出貨中'].includes(o.status));
  const todayTasks = tasks.filter(t => !t.done);

  const lastMonthInc = trend[trend.length-2]?.income || 0;
  const incDelta = lastMonthInc ? ((income - lastMonthInc)/lastMonthInc*100) : 0;

  const toggleTask = (id) => {
    setState(s => ({ ...s, tasks: s.tasks.map(t=>t.id===id?{...t, done:!t.done}:t) }));
  };

  // inline task add
  const [taskInput, setTaskInput] = useState('');
  const [taskAdding, setTaskAdding] = useState(false);
  const addTaskInline = () => {
    if (!taskInput.trim()) return;
    setState(s=>({ ...s, tasks:[{ id:uid(), title:taskInput.trim(), due:'今天', priority:'mid', done:false, link:null }, ...s.tasks] }));
    setTaskInput(''); setTaskAdding(false);
    toast('待辦已新增');
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">{thisMonth.replace('-','年 ')+' 月'} · 營運總覽</div>
          <h1 className="h1">{getGreeting()}，{props.tweaks?.greet_name||'康老闆'}</h1>
          <div className="sub">這個月已完成 {orders.filter(o=>o.status==='已完成').length} 筆訂單，{pendingOrders.length} 筆仍進行中。</div>
        </div>
        <div className="topbar-r">
          <button className="btn btn-ghost" onClick={()=>goto('finance')}><Icon name="finance" size={14}/> 收支</button>
          <button className="btn btn-primary" onClick={()=>goto('orders', { openNew:true })}><Icon name="plus" size={14}/> 新增訂單</button>
        </div>
      </div>

      <MonthGoalMethod state={state} setState={setState} income={income} orders={orders} customers={state.customers}/>

      {/* KPI */}
      <div className="kpi-row">
        <div className="kpi kpi-income">
          <div className="kpi-head"><span className="kpi-lab">本月收入</span><span className="kpi-ic"><Icon name="arrowUp" size={12}/></span></div>
          <div className="kpi-val mono-val">{fmtMoney(income, true)}</div>
          <div className={'kpi-foot '+(incDelta>=0?'up':'down')}><Icon name={incDelta>=0?'arrowUp':'arrowDown'} size={10}/> 較上月 {fmtPct(incDelta)}</div>
        </div>
        <div className="kpi kpi-expense">
          <div className="kpi-head"><span className="kpi-lab">本月支出</span><span className="kpi-ic"><Icon name="arrowDown" size={12}/></span></div>
          <div className="kpi-val mono-val" style={{ color:'var(--terracotta)' }}>{fmtMoney(expense, true)}</div>
          <div className="kpi-foot muted">{monthFinances.filter(f=>f.type==='expense').length} 筆紀錄</div>
        </div>
        <div className="kpi kpi-net">
          <div className="kpi-head"><span className="kpi-lab">淨利</span><span className="kpi-ic"><Icon name="finance" size={12}/></span></div>
          <div className="kpi-val mono-val" style={{ color:'var(--clay)' }}>{fmtMoney(net, true)}</div>
          <div className="kpi-foot muted">毛利率 {income?Math.round(net/income*100):0}%</div>
        </div>
        <div className="kpi kpi-orders">
          <div className="kpi-head"><span className="kpi-lab">進行中訂單</span><span className="kpi-ic"><Icon name="orders" size={12}/></span></div>
          <div className="kpi-val">{pendingOrders.length}<span className="kpi-unit">筆</span></div>
          <div className="kpi-foot muted">待收 {fmtMoney(pendingOrders.reduce((a,b)=>a+b.amount,0), true)}</div>
        </div>
      </div>

      {/* 現金流 + 月度目標 */}
      <div className="grid-2-1">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">現金流趨勢</div>
              <div className="card-subtle">近 6 個月 · 收入／支出／淨利</div>
            </div>
            <div style={{ display:'flex', gap:14, fontSize:12, color:'var(--ink-mute)' }}>
              <span style={{ display:'inline-flex',alignItems:'center',gap:5 }}><span style={{ width:10,height:2,background:'var(--clay)',display:'inline-block' }}/>收入</span>
              <span style={{ display:'inline-flex',alignItems:'center',gap:5 }}><span style={{ width:10,height:2,background:'var(--terracotta)',display:'inline-block' }}/>支出</span>
              <span style={{ display:'inline-flex',alignItems:'center',gap:5 }}><span style={{ width:10,height:2,background:'var(--sage)',display:'inline-block' }}/>淨利</span>
            </div>
          </div>
          <DualLine data={trend}/>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">月度目標</div><div className="card-subtle">{thisMonth.replace('-','年')+' 月達成率'}</div></div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <GoalRow label="月營收目標" value={income} max={goals.revenue.target} color="var(--clay)" fmt={(v)=>fmtMoney(v,true)}/>
            <GoalRow label="訂單數" value={goals.orders.actual} max={goals.orders.target} color="var(--sage)" fmt={v=>v+' 筆'}/>
            <GoalRow label="新客戶" value={goals.newClients.actual} max={goals.newClients.target} color="var(--ochre)" fmt={v=>v+' 位'}/>
            <GoalRow label="平均毛利率" value={goals.margin.actual} max={goals.margin.target} color="var(--moss)" fmt={v=>v+'%'}/>
          </div>
        </div>
      </div>

      {/* 今日待辦 */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">今日待辦</div>
            <div className="card-subtle">{todayTasks.length} 項未完成</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setTaskAdding(a=>!a)}>
            <Icon name={taskAdding?'check':'plus'} size={12}/> {taskAdding?'完成':'新增'}
          </button>
        </div>

        {taskAdding && (
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            <input className="input" autoFocus placeholder="輸入待辦事項，按 Enter 新增"
              value={taskInput} onChange={e=>setTaskInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') addTaskInline(); if(e.key==='Escape'){ setTaskAdding(false); setTaskInput(''); } }}/>
            <button className="btn btn-primary btn-sm" onClick={addTaskInline}>加入</button>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column' }}>
          {tasks.slice(0,8).map(t=>(
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--rule-soft)' }}>
              <button onClick={()=>toggleTask(t.id)} style={{
                width:20, height:20, borderRadius:5, border:'1.5px solid '+(t.done?'var(--moss)':'var(--ink-faint)'),
                background: t.done?'var(--moss)':'transparent', display:'flex',alignItems:'center',justifyContent:'center',
                cursor:'pointer', color:'var(--paper-soft)', flexShrink:0
              }}>
                {t.done && <Icon name="check" size={12}/>}
              </button>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="task-title" style={{ color: t.done?'var(--ink-faint)':'var(--ink)', textDecoration: t.done?'line-through':'none' }}>{t.title}</div>
                <div className="task-meta" style={{ display:'flex', gap:8 }}>
                  <span>{t.due}</span>
                  {t.priority==='high' && <Pill tone="terracotta">重要</Pill>}
                  {t.priority==='mid' && <Pill tone="ochre">一般</Pill>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .grid-2-1 { display: grid; grid-template-columns: 1.7fr 1fr; gap: 14px; }
        @media (max-width: 900px) {
          .grid-2-1 { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

// Goal progress row
const GoalRow = ({ label, value, max, color, fmt }) => {
  const pct = Math.min(1, value/(max||1));
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <span className="goal-row-label">{label}</span>
        <span className="mono goal-row-val">
          <span style={{ fontWeight:700 }}>{fmt(value)}</span>
          <span style={{ color:'var(--ink-faint)' }}> / {fmt(max)}</span>
        </span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: pct*100+'%', background: color }}/>
      </div>
      <div className="goal-row-pct mono" style={{ color: pct>=1?'var(--moss)':'var(--ink-mute)' }}>
        {Math.round(pct*100)}% {pct>=1?'· 已達成':''}
      </div>
    </div>
  );
};

// Dual-line chart with income/expense/net
const DualLine = ({ data }) => {
  const height = 220;
  const pad = { t:14, r:10, b:28, l:44 };
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

  const incPts = mk('income');
  const expPts = mk('expense');
  const netPts = mk('net');

  // y-axis ticks — 4 lines
  const yTicks = [0, 0.33, 0.66, 1].map(t => minY + (maxY-minY)*(1-t));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:'100%', height, display:'block' }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaInc" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--clay)" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="var(--clay)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* grid */}
      {yTicks.map((v,i)=>(
        <g key={i}>
          <line x1={pad.l} x2={w-pad.r} y1={yFor(v)} y2={yFor(v)} stroke="var(--rule-soft)" strokeWidth="1" strokeDasharray="2 3"/>
          <text x={pad.l-8} y={yFor(v)+3} textAnchor="end" fontSize="10" fill="var(--ink-mute)" fontFamily="var(--f-mono)">{fmtMoney(v, true)}</text>
        </g>
      ))}
      {/* x labels */}
      {data.map((d,i)=>(
        <text key={i} x={pad.l + i*xStep} y={h-pad.b+16} textAnchor="middle" fontSize="11" fill="var(--ink-mute)" fontFamily="var(--f-mono)">{d.label}</text>
      ))}
      {/* income area */}
      <path d={`${lineOf(incPts)} L ${pad.l+innerW} ${h-pad.b} L ${pad.l} ${h-pad.b} Z`} fill="url(#areaInc)"/>
      {/* lines */}
      <path d={lineOf(expPts)} stroke="var(--terracotta)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4"/>
      <path d={lineOf(netPts)} stroke="var(--sage)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={lineOf(incPts)} stroke="var(--clay)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {/* points */}
      {incPts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3" fill="var(--paper-soft)" stroke="var(--clay)" strokeWidth="1.8"/>)}
    </svg>
  );
};

// ═══ 本月目標與作法 ═══
const MonthGoalMethod = ({ state, setState, income, orders, customers }) => {
  const { goals } = state;
  const methods = state.monthMethods || [];
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  const revPct = goals.revenue.target ? Math.min(100, Math.round(income/goals.revenue.target*100)) : 0;
  const ordPct = goals.orders.target ? Math.min(100, Math.round(goals.orders.actual/goals.orders.target*100)) : 0;

  const addMethod = () => {
    if (!draft.trim()) return;
    setState(s => ({ ...s, monthMethods: [...(s.monthMethods||[]), { id:'mm_'+Date.now(), text: draft.trim(), done:false }] }));
    setDraft('');
  };
  const toggle = (id) => setState(s => ({ ...s, monthMethods: (s.monthMethods||[]).map(m => m.id===id?{...m, done:!m.done}:m) }));
  const del = (id) => setState(s => ({ ...s, monthMethods: (s.monthMethods||[]).filter(m => m.id!==id) }));

  const doneCount = methods.filter(m=>m.done).length;

  return (
    <div className="card" style={{ padding:0, overflow:'hidden', background:'linear-gradient(180deg, var(--clay-tint) 0%, var(--paper-soft) 60%)' }}>
      <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--rule-soft)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom:4 }}>{goals.month.replace('-','年 ')+' 月'} · 本月目標</div>
          <div style={{ fontSize:20, fontWeight:700, lineHeight:1.3, color:'var(--ink)' }}>
            月營收目標 <span style={{ color:'var(--clay)' }}>{fmtMoney(goals.revenue.target, true)}</span>
            <span style={{ color:'var(--sage)', marginLeft:10, fontWeight:700 }}>已達 {revPct}%</span>
          </div>
          <div style={{ fontSize:13, color:'var(--ink-mute)', marginTop:6 }}>訂單 {goals.orders.actual}/{goals.orders.target} · 新客 {goals.newClients.actual}/{goals.newClients.target} · 毛利率 {goals.margin.actual}%</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:12, color:'var(--ink-mute)', letterSpacing:'0.6px' }}>作法完成</div>
          <div style={{ fontSize:20, fontWeight:700 }}><span style={{ color:'var(--sage)' }}>{doneCount}</span> <span style={{ color:'var(--ink-mute)', fontSize:15 }}>/ {methods.length || '—'}</span></div>
        </div>
      </div>

      <div style={{ padding:'14px 20px 18px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-soft)', letterSpacing:'0.6px' }}>作法 / 行動清單</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(e=>!e)}>
            <Icon name={editing?'check':'edit'} size={12}/> {editing?'完成':'編輯'}
          </button>
        </div>

        {methods.length===0 && !editing && (
          <div style={{ fontSize:13, color:'var(--ink-mute)', padding:'10px 0' }}>尚未設定本月作法。點「編輯」開始新增。</div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {methods.map((m, i) => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'var(--paper-soft)', borderRadius:6, border:'1px solid var(--rule-soft)' }}>
              <button onClick={()=>toggle(m.id)} style={{ width:18, height:18, borderRadius:4, border:'1.5px solid '+(m.done?'var(--sage)':'var(--ink-faint)'), background: m.done?'var(--sage)':'transparent', cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {m.done && <Icon name="check" size={10} style={{ color:'#fff' }}/>}
              </button>
              <div style={{ flex:1, fontSize:14, color: m.done?'var(--ink-mute)':'var(--ink)', textDecoration: m.done?'line-through':'none', minWidth:0, lineHeight:1.5 }}>
                <span style={{ color:'var(--ink-faint)', marginRight:6, fontFamily:'var(--f-mono)', fontSize:12 }}>{String(i+1).padStart(2,'0')}</span>
                {m.text}
              </div>
              {editing && <button className="btn btn-ghost btn-sm" onClick={()=>del(m.id)} style={{ padding:'3px 6px' }}><Icon name="x" size={11}/></button>}
            </div>
          ))}
        </div>

        {editing && (
          <div style={{ display:'flex', gap:6, marginTop:10 }}>
            <input className="input" placeholder="例：聯繫 5 位 A 級客戶做新品試水溫" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addMethod();}}/>
            <button className="btn btn-primary btn-sm" onClick={addMethod}><Icon name="plus" size={12}/> 新增</button>
          </div>
        )}
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;
