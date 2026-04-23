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
      </div>

      <div className="dash-grid">
        {/* 左欄：目標 */}
        <MonthGoalMethod state={state} setState={setState} income={income}/>

        {/* 右欄：月度進度 + 今日待辦 */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="card">
            <div className="card-head">
              <div className="card-title">月度達成</div>
              <div className="card-subtle">{thisMonth.replace('-','年')+' 月'}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <GoalRow label="月營收" value={income} max={goals.revenue.target} color="var(--clay)" fmt={v=>fmtMoney(v,true)}/>
              <GoalRow label="訂單數" value={goals.orders.actual} max={goals.orders.target} color="var(--sage)" fmt={v=>v+' 筆'}/>
              <GoalRow label="新客戶" value={goals.newClients.actual} max={goals.newClients.target} color="var(--ochre)" fmt={v=>v+' 位'}/>
              <GoalRow label="毛利率" value={goals.margin.actual} max={goals.margin.target} color="var(--moss)" fmt={v=>v+'%'}/>
            </div>
          </div>

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
                <input className="input" autoFocus placeholder="輸入待辦，按 Enter 新增"
                  value={taskInput} onChange={e=>setTaskInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter') addTaskInline(); if(e.key==='Escape'){ setTaskAdding(false); setTaskInput(''); } }}/>
                <button className="btn btn-primary btn-sm" onClick={addTaskInline}>加入</button>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column' }}>
              {tasks.slice(0,10).map(t=>(
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--rule-soft)' }}>
                  <button onClick={()=>toggleTask(t.id)} style={{
                    width:20, height:20, borderRadius:5, border:'1.5px solid '+(t.done?'var(--moss)':'var(--ink-faint)'),
                    background: t.done?'var(--moss)':'transparent', display:'flex', alignItems:'center', justifyContent:'center',
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
              {tasks.length===0 && <EmptyState icon="task" title="今日無待辦"/>}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dash-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; align-items: start; }
        @media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr; } }
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

// ═══ 目標 ═══
const DAY_LABELS = ['周一','周二','周三','周四','周五','周六','周日'];
const todayDayIdx = () => { const d = new Date().getDay(); return d===0 ? 6 : d-1; };

const MonthGoalMethod = ({ state, setState, income }) => {
  const { goals } = state;
  const weekPlan = state.weekPlan || Array.from({length:7}, ()=>[]);

  const [selDay, setSelDay] = React.useState(todayDayIdx);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [goalEdit, setGoalEdit] = React.useState(false);
  const [goalDraft, setGoalDraft] = React.useState({});

  const openGoalEdit = () => {
    setGoalDraft({ revenue: goals.revenue.target, orders: goals.orders.target, newClients: goals.newClients.target, margin: goals.margin.target });
    setGoalEdit(true);
  };
  const saveGoals = () => {
    setState(s => ({ ...s, goals: { ...s.goals,
      revenue:    { ...s.goals.revenue,    target: Number(goalDraft.revenue)    || s.goals.revenue.target },
      orders:     { ...s.goals.orders,     target: Number(goalDraft.orders)     || s.goals.orders.target },
      newClients: { ...s.goals.newClients, target: Number(goalDraft.newClients) || s.goals.newClients.target },
      margin:     { ...s.goals.margin,     target: Number(goalDraft.margin)     || s.goals.margin.target },
    }}));
    setGoalEdit(false); toast('目標已更新');
  };

  const revPct = goals.revenue.target ? Math.min(100, Math.round(income/goals.revenue.target*100)) : 0;
  const dayTasks = weekPlan[selDay] || [];

  const updatePlan = (fn) => {
    setState(s => {
      const plan = (s.weekPlan || Array.from({length:7},()=>[])).map(d=>[...d]);
      fn(plan);
      return { ...s, weekPlan: plan };
    });
  };

  const addTask = () => {
    if (!draft.trim()) return;
    updatePlan(p => { p[selDay] = [...(p[selDay]||[]), { id:'wt_'+Date.now(), text:draft.trim(), done:false }]; });
    setDraft('');
  };
  const toggleTask = (id) => updatePlan(p => { p[selDay] = (p[selDay]||[]).map(t=>t.id===id?{...t,done:!t.done}:t); });
  const delTask = (id) => updatePlan(p => { p[selDay] = (p[selDay]||[]).filter(t=>t.id!==id); });

  const doneCount = dayTasks.filter(t=>t.done).length;

  return (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--rule-soft)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div className="card-title">目標</div>
        <button className="btn btn-ghost btn-sm" onClick={openGoalEdit}><Icon name="edit" size={13}/> 編輯</button>
      </div>

      {/* Goal edit form */}
      {goalEdit && (
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--rule-soft)', background:'var(--paper-deep)' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div className="row">
              <div className="field"><label>營收目標（元）</label><input className="input mono" type="number" value={goalDraft.revenue} onChange={e=>setGoalDraft({...goalDraft,revenue:e.target.value})}/></div>
              <div className="field"><label>訂單目標（筆）</label><input className="input mono" type="number" value={goalDraft.orders} onChange={e=>setGoalDraft({...goalDraft,orders:e.target.value})}/></div>
            </div>
            <div className="row">
              <div className="field"><label>新客目標（位）</label><input className="input mono" type="number" value={goalDraft.newClients} onChange={e=>setGoalDraft({...goalDraft,newClients:e.target.value})}/></div>
              <div className="field"><label>毛利率目標（%）</label><input className="input mono" type="number" value={goalDraft.margin} onChange={e=>setGoalDraft({...goalDraft,margin:e.target.value})}/></div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={saveGoals}>儲存</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setGoalEdit(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly stats */}
      {!goalEdit && (
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--rule-soft)' }}>
          <div style={{ fontSize:19, fontWeight:700, lineHeight:1.3 }}>
            月營收目標 <span style={{ color:'var(--clay)' }}>{fmtMoney(goals.revenue.target, true)}</span>
            <span style={{ color:'var(--sage)', marginLeft:10 }}>已達 {revPct}%</span>
          </div>
          <div style={{ fontSize:13, color:'var(--ink-mute)', marginTop:5 }}>
            訂單 {goals.orders.actual}/{goals.orders.target} · 新客 {goals.newClients.actual}/{goals.newClients.target} · 毛利率 {goals.margin.actual}%
          </div>
        </div>
      )}

      {/* Day tabs + task list */}
      <div style={{ padding:'14px 18px 20px' }}>

        {/* Day tab strip */}
        <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:12 }}>
          {DAY_LABELS.map((label, i) => {
            const tasks = weekPlan[i] || [];
            const done = tasks.filter(t=>t.done).length;
            const isToday = i === todayDayIdx();
            const isActive = selDay === i;
            return (
              <button key={i}
                onClick={()=>{ setSelDay(i); setEditing(false); setDraft(''); }}
                className={'btn btn-sm '+(isActive?'btn-ink':'btn-ghost')}
                style={{ flexShrink:0, minWidth:54, position:'relative' }}>
                {label}
                {tasks.length>0 && (
                  <span style={{ marginLeft:3, fontSize:10, opacity:0.8, fontFamily:'var(--f-mono)' }}>{done}/{tasks.length}</span>
                )}
                {isToday && !isActive && (
                  <span style={{ position:'absolute', top:4, right:4, width:4, height:4, borderRadius:'50%', background:'var(--clay)', display:'block' }}/>
                )}
              </button>
            );
          })}
        </div>

        {/* Day header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-soft)' }}>
            {DAY_LABELS[selDay]}行動清單
            {dayTasks.length>0 && (
              <span style={{ marginLeft:8, fontWeight:400, color:'var(--sage)', fontFamily:'var(--f-mono)', fontSize:12 }}>
                {doneCount}/{dayTasks.length} 完成
              </span>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(e=>!e)}>
            <Icon name={editing?'check':'plus'} size={12}/> {editing?'完成':'新增'}
          </button>
        </div>

        {/* Task list */}
        {dayTasks.length===0 && !editing && (
          <div style={{ fontSize:13, color:'var(--ink-mute)', padding:'6px 0' }}>尚未設定{DAY_LABELS[selDay]}的行動目標，點「新增」開始。</div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {dayTasks.map(t => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'var(--paper-deep)', borderRadius:7 }}>
              <button onClick={()=>toggleTask(t.id)} style={{
                width:20, height:20, borderRadius:5, flexShrink:0,
                border:'1.5px solid '+(t.done?'var(--sage)':'var(--ink-faint)'),
                background: t.done?'var(--sage)':'transparent',
                cursor:'pointer', padding:0,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {t.done && <Icon name="check" size={11} style={{ color:'#fff' }}/>}
              </button>
              <div style={{ flex:1, fontSize:13, color: t.done?'var(--ink-mute)':'var(--ink)', textDecoration: t.done?'line-through':'none', lineHeight:1.5 }}>
                {t.text}
              </div>
              {editing && (
                <button className="btn btn-ghost btn-sm" onClick={()=>delTask(t.id)} style={{ padding:'3px 5px' }}>
                  <Icon name="close" size={10}/>
                </button>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div style={{ display:'flex', gap:6, marginTop:10 }}>
            <input className="input" autoFocus
              placeholder={`新增${DAY_LABELS[selDay]}行動目標…`}
              value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') addTask(); if(e.key==='Escape'){ setEditing(false); setDraft(''); } }}/>
            <button className="btn btn-primary btn-sm" onClick={addTask}><Icon name="plus" size={12}/> 新增</button>
          </div>
        )}
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;
