// 碰器嚴選系統 — Shared UI: Modal, Sparkline, Bar chart, etc.

const Modal = ({ open, onClose, title, children, footer, width }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay open" onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: width||undefined }}>
        <div className="modal-head">
          <div className="h2">{title}</div>
          <button className="modal-close" onClick={onClose} aria-label="關閉"><Icon name="close" size={18}/></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

// Sparkline: area chart with baseline dots for months
const Sparkline = ({ data, color='var(--clay)', height=120, labels=[], yFormat=(v)=>fmtMoney(v,true), showAxis=true }) => {
  if (!data || !data.length) return <div className="empty">無資料</div>;
  const w = 100; const h = 100;
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padY = 10;
  const innerH = h - padY*2;

  const pts = data.map((v,i)=>{
    const x = (i/(data.length-1||1))*w;
    const y = padY + (1 - (v-min)/range) * innerH;
    return [x,y];
  });

  const areaPath = `M 0 ${h} ${pts.map(([x,y])=>`L ${x} ${y}`).join(' ')} L ${w} ${h} Z`;
  const linePath = `M ${pts.map(([x,y])=>`${x} ${y}`).join(' L ')}`;

  // Determine y-axis marks (3)
  const axisMarks = [max, (max+min)/2, min];

  return (
    <div style={{ position:'relative', height, display:'flex', gap:8 }}>
      {showAxis && (
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', fontSize:10, color:'var(--ink-faint)', fontFamily:'var(--f-mono)', paddingTop:4, paddingBottom:22 }}>
          {axisMarks.map((v,i)=><div key={i}>{yFormat(v)}</div>)}
        </div>
      )}
      <div style={{ flex:1, position:'relative' }}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width:'100%', height:'calc(100% - 22px)', display:'block' }}>
          <defs>
            <linearGradient id="sparkgrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {/* horizontal grid */}
          <line x1="0" y1={padY} x2={w} y2={padY} stroke="var(--rule-soft)" strokeWidth="0.3" strokeDasharray="1 1" vectorEffect="non-scaling-stroke"/>
          <line x1="0" y1={h/2} x2={w} y2={h/2} stroke="var(--rule-soft)" strokeWidth="0.3" strokeDasharray="1 1" vectorEffect="non-scaling-stroke"/>
          <line x1="0" y1={h-padY} x2={w} y2={h-padY} stroke="var(--rule-soft)" strokeWidth="0.3" strokeDasharray="1 1" vectorEffect="non-scaling-stroke"/>
          <path d={areaPath} fill="url(#sparkgrad)"/>
          <path d={linePath} stroke={color} strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
          {pts.map(([x,y],i)=>
            <circle key={i} cx={x} cy={y} r="0.8" fill={color} stroke="var(--paper-soft)" strokeWidth="0.4" vectorEffect="non-scaling-stroke"/>
          )}
        </svg>
        {labels.length>0 && (
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--ink-mute)', marginTop:4, fontFamily:'var(--f-mono)' }}>
            {labels.map((l,i)=><span key={i}>{l}</span>)}
          </div>
        )}
      </div>
    </div>
  );
};

// Horizontal bars (category breakdown)
const BarList = ({ items, color='var(--clay)' }) => {
  const max = Math.max(...items.map(x=>x.value), 1);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {items.map((it,i)=>(
        <div key={i}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
            <span style={{ color:'var(--ink-soft)' }}>{it.label}</span>
            <span className="mono" style={{ color:'var(--ink)', fontWeight:600 }}>{fmtMoney(it.value)}</span>
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: (it.value/max*100)+'%', background: it.color || color }}/>
          </div>
        </div>
      ))}
    </div>
  );
};

// Circular progress ring (goal)
const Ring = ({ value, max, size=72, stroke=7, color='var(--clay)', label, sub }) => {
  const pct = Math.min(1, value/(max||1));
  const r = (size - stroke)/2;
  const c = 2*Math.PI*r;
  const dash = c * pct;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--paper-deep)" strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
                strokeDasharray={`${dash} ${c}`} strokeLinecap="round"/>
      </svg>
      <div>
        <div className="eyebrow" style={{ marginBottom:2 }}>{label}</div>
        <div style={{ fontFamily:'var(--f-serif)', fontSize:20, fontWeight:600, color:'var(--ink)', lineHeight:1.1 }}>
          {Math.round(pct*100)}<span style={{ fontSize:12, color:'var(--ink-mute)', marginLeft:2 }}>%</span>
        </div>
        <div style={{ fontSize:11, color:'var(--ink-mute)', marginTop:2 }}>{sub}</div>
      </div>
    </div>
  );
};

const Pill = ({ tone='', children, dot=false }) => (
  <span className={`pill ${tone||''}`}>
    {dot && <span className="dot"/>}
    {children}
  </span>
);

const EmptyState = ({ icon='dashboard', title, hint, action }) => (
  <div style={{ textAlign:'center', padding:'40px 20px' }}>
    <div style={{ width:52, height:52, borderRadius:'50%', background:'var(--paper-deep)', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'var(--ink-mute)', marginBottom:14 }}>
      <Icon name={icon} size={22}/>
    </div>
    <div style={{ fontFamily:'var(--f-serif)', fontSize:16, fontWeight:600, color:'var(--ink)' }}>{title}</div>
    {hint && <div style={{ fontSize:13, color:'var(--ink-mute)', marginTop:6 }}>{hint}</div>}
    {action && <div style={{ marginTop:14 }}>{action}</div>}
  </div>
);

const Segmented = ({ options, value, onChange }) => (
  <div className="seg">
    {options.map(o => (
      <button key={o.value} className={value===o.value?'active':''} onClick={()=>onChange(o.value)}>{o.label}</button>
    ))}
  </div>
);

// ─── Cloudinary 圖片上傳 ───
async function _resizeImage(file, maxPx) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob 轉換失敗')), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片讀取失敗')); };
    img.src = url;
  });
}

async function uploadToCloudinary(file) {
  const cfg = window.CLOUDINARY;
  if (!cfg || !cfg.cloudName || !cfg.uploadPreset) throw new Error('Cloudinary 尚未設定');
  const blob = await _resizeImage(file, cfg.maxPx || 800);
  const fd = new FormData();
  fd.append('file', blob);
  fd.append('upload_preset', cfg.uploadPreset);
  if (cfg.folder) fd.append('folder', cfg.folder);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, { method:'POST', body:fd });
  if (!r.ok) {
    let msg = '上傳失敗 (HTTP ' + r.status + ')';
    try { const j = await r.json(); if (j.error?.message) msg = j.error.message; } catch {}
    throw new Error(msg);
  }
  const j = await r.json();
  return j.secure_url;
}

// Cloudinary URL 即時縮圖（不重新上傳，只改 URL）
function cldThumb(url, w = 200) {
  if (!url || !url.includes('/upload/')) return url || '';
  return url.replace('/upload/', `/upload/w_${w},h_${w},c_fill,f_auto,q_auto/`);
}

// 正方形上傳區（編輯 modal 用）
const PhotoUpload = ({ value, onChange, size = 120 }) => {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const inputRef = React.useRef(null);

  const handlePick = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setErr('');
    try {
      const url = await uploadToCloudinary(f);
      onChange(url);
    } catch (ex) {
      setErr(ex.message || '上傳失敗');
    } finally {
      setBusy(false);
    }
  };

  const open = () => { if (!busy) inputRef.current?.click(); };

  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
      <div className="photo-upload-box" style={{ width:size, height:size }} onClick={open}>
        {value
          ? <img src={cldThumb(value, size*2)} alt="" />
          : <div className="photo-upload-placeholder">
              <Icon name="image" size={26}/>
              <div style={{ fontSize:11, marginTop:6, color:'var(--ink-mute)' }}>點擊上傳</div>
            </div>
        }
        {busy && <div className="photo-upload-busy">上傳中…</div>}
        <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePick}/>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, paddingTop:4 }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={open} disabled={busy}>
          <Icon name="camera" size={12}/> {value?'更換':'上傳'}
        </button>
        {value && !busy && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={()=>onChange('')}>
            移除
          </button>
        )}
        {err && <div style={{ fontSize:11, color:'var(--terracotta)', maxWidth:160 }}>{err}</div>}
      </div>
    </div>
  );
};

// 列表縮圖
const PhotoThumb = ({ url, size = 40, alt = '' }) => (
  <div style={{ width:size, height:size, borderRadius:6, overflow:'hidden', background:'var(--paper-deep)', flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-faint)' }}>
    {url
      ? <img src={cldThumb(url, size*2)} alt={alt} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy"/>
      : <Icon name="image" size={Math.min(20, Math.round(size*0.5))}/>
    }
  </div>
);

Object.assign(window, { Modal, Sparkline, BarList, Ring, Pill, EmptyState, Segmented, PhotoUpload, PhotoThumb, uploadToCloudinary, cldThumb });
