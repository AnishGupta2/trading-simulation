import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3000/api';

// --- NAVIGATION BAR ---
function NavBar() {
  const location = useLocation();
  return (
    <nav>
      <Link to="/" className={location.pathname === '/' ? 'active' : ''}> Live Market</Link>
      <Link to="/broker" className={location.pathname === '/broker' ? 'active' : ''}> Stock Terminal</Link>
      <Link to="/options" className={location.pathname === '/options' ? 'active' : ''}> Options Desk</Link>
      <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}> Admin</Link>
      <Link to="/payouts" className={location.pathname === '/payouts' ? 'active' : ''}> Settlements</Link>
    </nav>
  );
}

// --- 1. DASHBOARD (PROJECTOR VIEW) ---
// Replace ONLY the Dashboard function in src/App.jsx

function Dashboard() {
  const [market, setMarket] = useState({ stocks: [], round: 1 });
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      axios.get(`${API_URL}/market`).then(res => setMarket(res.data));
      axios.get(`${API_URL}/leaderboard`).then(res => setLeaderboard(res.data));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '60px' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', letterSpacing: '1px' }}>
          MARKET LIVE <span style={{ color: '#444' }}>//</span> ROUND <span style={{ color: 'var(--neon-green)', fontSize: '2.2rem' }}>{market.round}</span>
        </h1>
      </div>

      <div className="dashboard-grid">
        {/* 5x4 STOCK GRID */}
        <div className="stock-grid">
          {market.stocks.map(s => {
            const changeRaw = ((s.currentPrice - s.basePrice) / s.basePrice * 100);
            const change = changeRaw.toFixed(2);
            const isUp = s.currentPrice >= s.basePrice;
            const trendClass = isUp ? 'up-trend' : 'down-trend';

            return (
              <div key={s.id} className={`stock-tile ${trendClass}`}>
                <div className="stock-name" title={s.name}>{s.name}</div>
                <div className="stock-price">₹{s.currentPrice.toFixed(1)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`stock-change ${isUp ? 'bg-up' : 'bg-down'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(change)}%
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#555' }}>UC: ₹{(s.basePrice * 1.25).toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* LEADERBOARD (Full Height) */}
        <div className="card">
          <h2 style={{ color: 'gold', marginTop: 0, textAlign: 'center', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
            🏆 TOP TEAMS
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {leaderboard.slice(0, 10).map((team, index) => (
              <div key={team.teamId} className="leaderboard-row" style={index === 0 ? { background: 'rgba(255, 215, 0, 0.1)', borderLeft: '3px solid gold' } : {}}>
                <span style={{ width: '30px', fontWeight: 'bold', color: index === 0 ? 'gold' : '#666' }}>#{index + 1}</span>
                <span style={{ flex: 1, fontWeight: '600' }}>{team.teamId}</span>
                <span style={{ color: index === 0 ? 'gold' : 'var(--neon-green)', fontWeight: 'bold' }}>
                  ₹{team.totalValue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 2. STOCK BROKER TERMINAL ---
function StockBroker() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState('');
  const [teamId, setTeamId] = useState('');
  const [teamInfo, setTeamInfo] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [lockedPrice, setLockedPrice] = useState(null);
  const [txnDetails, setTxnDetails] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/market`).then(res => setStocks(res.data.stocks));
  }, []);

  const checkTeam = () => {
    if (teamId) axios.get(`${API_URL}/team/${teamId}`).then(res => setTeamInfo(res.data));
  }

  const handleTrade = (type) => {
    axios.post(`${API_URL}/trade/stock`, {
      teamId, stockId: selectedStock, type, quantity
    }).then(res => {
      setTxnDetails({ type, price: res.data.executionPrice, total: res.data.cashToCollectOrGive, cash: res.data.newCash });
      setLockedPrice(null);
      setQuantity('');
      checkTeam();
    }).catch(err => alert(err.response?.data?.error));
  };

  const currentStock = stocks.find(s => s.id === selectedStock);
  const price = lockedPrice || (currentStock ? currentStock.currentPrice : 0);

  return (
    <div className="container" style={{ maxWidth: '600px', margin: '0 auto', height: 'auto', overflow: 'visible', paddingBottom: '50px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>💻 Stock Terminal</h1>
      <div className="card" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
        {/* TEAM CHECKER */}
        <label style={{ color: '#888', fontSize: '0.9em', fontWeight: 'bold' }}>TEAM AUTHENTICATION</label>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px', marginBottom: '20px' }}>
          <input
            value={teamId}
            onChange={e => setTeamId(e.target.value)}
            placeholder="Enter Team ID..."
            style={{ flex: 1, fontSize: '1.2em', fontWeight: 'bold', margin: 0 }}
            onKeyDown={(e) => e.key === 'Enter' && checkTeam()}
          />
          <button className="btn-lock" onClick={checkTeam} style={{ width: 'auto', padding: '0 25px' }}>VERIFY</button>
        </div>

        {teamInfo && (
          <div style={{ background: 'linear-gradient(145deg, #1a1a1a, #222)', padding: '20px', borderRadius: '8px', marginBottom: '25px', borderLeft: '4px solid var(--accent)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
            <div style={{ color: '#888', fontSize: '0.9em', fontWeight: 'bold' }}>AVAILABLE PURCHASING POWER</div>
            <div style={{ fontSize: '2.2em', fontWeight: '800', fontFamily: 'monospace', color: '#fff' }}>₹{teamInfo.cash.toLocaleString()}</div>
            {selectedStock && (
              <div style={{ marginTop: '10px', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
                <span>Current Holding:</span>
                <span style={{ fontWeight: 'bold', color: '#fff' }}>{teamInfo.stocks[selectedStock] || 0} Shares</span>
              </div>
            )}
          </div>
        )}

        {/* TRADE FORM */}
        <label style={{ color: '#888', fontSize: '0.9em', fontWeight: 'bold' }}>MARKET SELECTION</label>
        <select onChange={e => { setSelectedStock(e.target.value); setTxnDetails(null); }} value={selectedStock} style={{ marginBottom: '20px', fontSize: '1.1em' }}>
          <option value="">Select Asset to Trade...</option>
          {stocks.map(s => <option key={s.id} value={s.id}>{s.name} (LTP: ₹{s.currentPrice.toFixed(1)})</option>)}
        </select>

        {selectedStock && (
          <div style={{ background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <div>
                <div style={{ color: '#888', fontSize: '0.9em', fontWeight: 'bold' }}>EXECUTION PRICE</div>
                <div style={{ fontSize: '2.8em', fontWeight: '800', fontFamily: 'monospace', color: lockedPrice ? 'gold' : '#00ff88', transition: 'color 0.3s' }}>
                  ₹{Number(price).toFixed(1)}
                </div>
              </div>
              <button
                onClick={() => setLockedPrice(lockedPrice ? null : currentStock.currentPrice)}
                style={{
                  width: 'auto',
                  padding: '12px 20px',
                  background: lockedPrice ? '#444' : 'var(--accent)',
                  border: lockedPrice ? '1px solid #666' : 'none',
                  color: '#fff',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {lockedPrice ? '🔓 UNLOCK PRICE' : '🔒 LOCK PRICE'}
              </button>
            </div>

            <label style={{ color: '#888', fontSize: '0.9em', fontWeight: 'bold' }}>ORDER DETAILS</label>
            <div style={{ position: 'relative', marginTop: '8px', marginBottom: '15px' }}>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                style={{ fontSize: '1.8em', paddingRight: '60px', textAlign: 'right', fontFamily: 'monospace' }}
                min="1"
              />
              <span style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#666', fontWeight: 'bold' }}>QTY</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0 25px 0' }}>
              <span style={{ color: '#888', fontWeight: 'bold' }}>ESTIMATED TOTAL</span>
              <span style={{ fontSize: '1.4em', fontWeight: 'bold', fontFamily: 'monospace', color: '#fff' }}>₹{(price * (parseInt(quantity) || 0)).toLocaleString()}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <button className="btn-buy" onClick={() => handleTrade('BUY')}>
                <div style={{ fontSize: '1.2em' }}>BUY</div>
                <div style={{ fontSize: '0.7em', opacity: 0.8, marginTop: '2px' }}>TAKE CASH</div>
              </button>
              <button className="btn-sell" onClick={() => handleTrade('SELL')}>
                <div style={{ fontSize: '1.2em' }}>SELL</div>
                <div style={{ fontSize: '0.7em', opacity: 0.8, marginTop: '2px' }}>GIVE CASH</div>
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS MESSAGE */}
        {txnDetails && (
          <div className="success-box" style={{ borderColor: txnDetails.type === 'BUY' ? 'var(--neon-green)' : 'var(--neon-red)', backgroundColor: txnDetails.type === 'BUY' ? 'rgba(0,255,136,0.1)' : 'rgba(255,51,51,0.1)' }}>
            <h2 style={{ margin: '0 0 15px 0', color: txnDetails.type === 'BUY' ? 'var(--neon-green)' : 'var(--neon-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              {txnDetails.type === 'BUY' ? '🟢' : '🔴'} TRADE EXECUTED
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
              <div>
                <div style={{ color: '#888', fontSize: '0.8em' }}>ACTION</div>
                <div style={{ fontWeight: 'bold', color: '#fff' }}>{txnDetails.type}</div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: '0.8em' }}>FILLED PRICE</div>
                <div style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#fff' }}>₹{Number(txnDetails.price).toFixed(1)}</div>
              </div>
              <div style={{ gridColumn: '1 / span 2' }}>
                <div style={{ color: '#888', fontSize: '0.8em' }}>{txnDetails.type === 'BUY' ? 'CASH DEDUCTED' : 'CASH ADDED'}</div>
                <div style={{ fontSize: '1.5em', fontWeight: 'bold', fontFamily: 'monospace', color: txnDetails.type === 'BUY' ? 'var(--neon-red)' : 'var(--neon-green)' }}>
                  {txnDetails.type === 'BUY' ? '-' : '+'} ₹{txnDetails.total.toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
              <span style={{ color: '#888', fontSize: '0.9em' }}>NEW PURCHASING POWER</span>
              <span style={{ fontSize: '1.2em', fontWeight: 'bold', fontFamily: 'monospace', color: '#fff' }}>₹{txnDetails.cash.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 3. OPTION BROKER TERMINAL ---
function OptionBroker() {
  const [stocks, setStocks] = useState([]);
  const [form, setForm] = useState({ teamId: '', stockId: '', type: 'CALL', quantity: '', expiry: '1' });
  const [result, setResult] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/market`).then(res => setStocks(res.data.stocks));
  }, []);

  const submitOption = () => {
    axios.post(`${API_URL}/trade/option`, {
      ...form, expiryDelay: parseInt(form.expiry)
    }).then(res => setResult(res.data)).catch(err => alert(err.response?.data?.error));
  };

  return (
    <div className="container" style={{ maxWidth: '600px', margin: '0 auto', height: 'auto', overflow: 'visible', paddingBottom: '50px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>📜 Options Desk</h1>
      <div className="card" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>

        <label style={{ color: '#888', fontSize: '0.9em', fontWeight: 'bold' }}>TEAM AUTHENTICATION</label>
        <input
          placeholder="Enter Team ID..."
          onChange={e => setForm({ ...form, teamId: e.target.value })}
          style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '20px' }}
        />

        <label style={{ color: '#888', fontSize: '0.9em', fontWeight: 'bold' }}>UNDERLYING ASSET</label>
        <select onChange={e => setForm({ ...form, stockId: e.target.value })} style={{ fontSize: '1.1em', marginBottom: '20px' }}>
          <option value="">Select Underlying Asset...</option>
          {stocks.map(s => <option key={s.id} value={s.id}>{s.name} (LTP: ₹{s.currentPrice.toFixed(1)})</option>)}
        </select>

        <div style={{ background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222', marginBottom: '25px' }}>
          <label style={{ color: '#888', fontSize: '0.9em', fontWeight: 'bold' }}>CONTRACT SPECIFICATIONS</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px', marginBottom: '15px' }}>
            <div>
              <div style={{ color: '#666', fontSize: '0.8em', marginBottom: '5px' }}>OPTION TYPE</div>
              <select onChange={e => setForm({ ...form, type: e.target.value })} style={{ margin: 0, fontWeight: 'bold' }}>
                <option value="CALL">CALL (Upside)</option>
                <option value="PUT">PUT (Downside)</option>
              </select>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '0.8em', marginBottom: '5px' }}>EXPIRY</div>
              <select onChange={e => setForm({ ...form, expiry: e.target.value })} style={{ margin: 0, fontWeight: 'bold' }}>
                <option value="1">Next Round (10%)</option>
                <option value="2">Next + 1 (15%)</option>
              </select>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ color: '#666', fontSize: '0.8em', marginBottom: '5px' }}>QUANTITY</div>
            <input
              type="number"
              placeholder="0"
              onChange={e => setForm({ ...form, quantity: e.target.value })}
              style={{ fontSize: '1.5em', margin: 0, paddingRight: '60px', textAlign: 'right', fontFamily: 'monospace' }}
              min="1"
            />
            <span style={{ position: 'absolute', right: '15px', bottom: '15px', color: '#666', fontWeight: 'bold' }}>QTY</span>
          </div>
        </div>

        <button className="btn-lock" onClick={submitOption} style={{ fontSize: '1.2em', padding: '18px' }}>🖋️ WRITE CONTRACT</button>

        {result && (
          <div className="success-box" style={{ borderColor: 'gold', backgroundColor: 'rgba(255, 215, 0, 0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: 'gold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              ✨ PREMIUM COLLECTED
            </h3>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '6px', marginBottom: '15px' }}>
              <div style={{ color: '#888', fontSize: '0.9em', marginBottom: '5px' }}>CASH RECEIVED</div>
              <div style={{ fontSize: '2.8em', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--neon-green)' }}>
                + ₹{result.cashToCollect.toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
              <span style={{ color: '#888', fontSize: '0.9em' }}>NEW PURCHASING POWER</span>
              <span style={{ fontSize: '1.2em', fontWeight: 'bold', fontFamily: 'monospace', color: '#fff' }}>₹{result.newCash.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 4. ADMIN & PAYOUTS (Simplified for brevity, style is global) ---
function Admin() {
  const [shocks, setShocks] = useState('{"nestle": 1.05}');
  const [scheduledShocks, setScheduledShocks] = useState('{}');
  const [currentSlope, setCurrentSlope] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/admin/schedule-shocks`).then(res => {
      setScheduledShocks(JSON.stringify(res.data, null, 2));
    }).catch(err => console.error(err));

    axios.get(`${API_URL}/admin/slope`).then(res => {
      setCurrentSlope(res.data.currentSlope);
    }).catch(err => console.error(err));
  }, []);

  const apply = () => axios.post(`${API_URL}/admin/set-shocks`, { shocks: JSON.parse(shocks) }).then(res => alert(res.data.message));
  const saveSchedule = () => axios.post(`${API_URL}/admin/schedule-shocks`, { schedule: JSON.parse(scheduledShocks) }).then(res => alert(res.data.message));
  const end = () => axios.post(`${API_URL}/admin/end-round`).then(res => alert(res.data.message));
  const updateSlope = () => axios.post(`${API_URL}/admin/slope`, { slope: currentSlope }).then(res => alert(res.data.message)).catch(err => alert(err.response?.data?.error));

  // --- DISASTER RECOVERY ---
  const downloadBackup = () => {
    axios.get(`${API_URL}/admin/backup`).then(res => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `dala_backup_round_${res.data.currentRound}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }).catch(err => alert("Failed to download backup: " + err.message));
  };

  const restoreBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm("⚠️ WARNING: This will overwrite ALL current live game data. Are you absolutely sure?")) {
      event.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        axios.post(`${API_URL}/admin/restore`, backupData).then(res => {
          alert(res.data.message);
        }).catch(err => alert(err.response?.data?.error || "Restore Failed"));
      } catch (err) {
        alert("Invalid JSON file!");
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = null;
  };

  return (
    <div className="container" style={{ maxWidth: '600px' }}>
      <h1>Admin Control</h1>
      <div className="card" style={{ marginBottom: '20px' }}>
        <button className="btn-sell" onClick={end} style={{ width: '100%', marginBottom: '15px' }}>🚨 END ROUND</button>
      </div>

      <div className="card" style={{ marginBottom: '20px', background: 'rgba(0, 80, 200, 0.1)', borderColor: '#007bff' }}>
        <h3 style={{ color: '#0aa' }}>💾 Disaster Recovery</h3>
        <p style={{ fontSize: '0.8em', color: '#888', marginBottom: '15px' }}>
          Download a full snapshot of the current game state, or upload a previous snapshot to instantly restore it.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={downloadBackup} style={{ flex: 1, padding: '12px', background: '#004488', border: '1px solid #0066aa', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            📥 DOWNLOAD BACKUP
          </button>

          <label style={{ flex: 1, padding: '12px', background: '#550000', border: '1px solid #aa0000', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', textAlign: 'center' }}>
            <input type="file" accept=".json" onChange={restoreBackup} style={{ display: 'none' }} />
            📤 RESTORE STATE
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px', background: 'rgba(255, 140, 0, 0.1)', borderColor: '#ff8c00' }}>
        <h3 style={{ color: '#ff8c00', marginTop: 0 }}>📈 Dynamic Market Slope</h3>
        <p style={{ fontSize: '0.8em', color: '#888', marginBottom: '15px' }}>
          Adjusts how drastically demand impacts prices. Default is `0.6`. Higher values mean higher volatility.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="number"
            step="0.1"
            value={currentSlope}
            onChange={e => setCurrentSlope(e.target.value)}
            style={{ flex: 1, fontSize: '1.2em', padding: '10px', background: '#000', color: 'white', border: '1px solid #333' }}
          />
          <button className="btn-buy" onClick={updateSlope} style={{ width: 'auto', padding: '0 20px' }}>UPDATE SLOPE</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>📅 Schedule Per-Round Shocks</h3>
        <p style={{ fontSize: '0.8em', color: '#888' }}>Format: {"{ \"RoundNum\": { \"stockId\": multiplier } }"}</p>
        <textarea
          rows="6"
          value={scheduledShocks}
          onChange={e => setScheduledShocks(e.target.value)}
          style={{ width: '95%', background: '#000', color: 'white', border: '1px solid #333', padding: '10px', fontFamily: 'monospace' }}
        ></textarea>
        <button className="btn-lock" onClick={saveSchedule} style={{ marginTop: '10px' }}>SAVE SCHEDULE</button>
      </div>

      <div className="card">
        <h3>⚡ Inject Immediate Market Shocks</h3>
        <textarea
          rows="3"
          value={shocks}
          onChange={e => setShocks(e.target.value)}
          style={{ width: '95%', background: '#000', color: 'white', border: '1px solid #333', padding: '10px', fontFamily: 'monospace' }}
        ></textarea>
        <button className="btn-buy" onClick={apply} style={{ marginTop: '10px' }}>APPLY IMMEDIATELY</button>
      </div>
    </div>
  );
}

function Payouts() {
  const [payouts, setPayouts] = useState([]);
  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <h1>Settlements</h1>
      <button className="btn-lock" onClick={() => axios.get(`${API_URL}/payouts`).then(res => setPayouts(res.data))}>REFRESH PAYOUTS</button>
      <div className="card">
        {payouts.map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #333' }}>
            <span style={{ fontWeight: 'bold' }}>{p.teamId}</span>
            <span>{p.reason}</span>
            <span style={{ color: 'var(--neon-green)', fontWeight: 'bold' }}>PAY: ₹{p.amount}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- MAIN ROUTER ---
function App() {
  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/broker" element={<StockBroker />} />
        <Route path="/options" element={<OptionBroker />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/payouts" element={<Payouts />} />
      </Routes>
    </Router>
  );
}

export default App;