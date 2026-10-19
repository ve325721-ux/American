import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ClerkProvider, SignIn, SignInButton, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Banknote, BedDouble, BriefcaseBusiness, CarFront, ChevronDown, ChevronUp, CircleHelp, Compass, ExternalLink, Home, Map as MapIcon, MapPin, Plus, ShoppingBag, WashingMachine, Wallet, X } from 'lucide-react';
import { useGameState } from './game/useGameState';
import * as gameExports from './game/useGameState';
import { loadBillboards, saveBillboards, recordBillboardView, recordBillboardClick } from './game/billboardStore';
import type { Billboard } from './game/billboardStore';

type Direction = 'north' | 'south' | 'east' | 'west';
type Tab = 'Map' | 'Jobs' | 'Bank' | 'Cars' | 'Home' | 'Shop';
type AnyRecord = Record<string, any>;

const stops = [
  { name: 'Times Square', area: 'MIDTOWN • THE CENTER OF IT ALL', position: [40.758, -73.9855] as [number, number], color: '#c94d2f' },
  { name: 'Central Park', area: 'MANHATTAN • TAKE A BREATH', position: [40.7829, -73.9654] as [number, number], color: '#3d7565' },
  { name: 'Wall Street', area: 'LOWER MANHATTAN • MAKE YOUR MOVE', position: [40.7074, -74.0113] as [number, number], color: '#bc9b48' },
  { name: 'Brooklyn Bridge', area: 'EAST RIVER • BETWEEN TWO WORLDS', position: [40.7061, -73.9969] as [number, number], color: '#b6653d' },
  { name: 'Harlem', area: 'UPTOWN • CULTURE RUNS DEEP', position: [40.8116, -73.9465] as [number, number], color: '#8b4c69' },
  { name: 'Brooklyn', area: 'BROOKLYN • MAKE IT YOURS', position: [40.6782, -73.9442] as [number, number], color: '#3d7565' },
  { name: 'Queens', area: 'QUEENS • EVERY BLOCK A NEW STORY', position: [40.7282, -73.7949] as [number, number], color: '#547a9b' },
  { name: 'The Bronx', area: 'THE BRONX • ROOTS & RHYTHM', position: [40.8448, -73.8648] as [number, number], color: '#ab793d' },
];

const tabIcons: Record<Tab, typeof MapIcon> = { Map: MapIcon, Jobs: BriefcaseBusiness, Bank: Banknote, Cars: CarFront, Home, Shop: ShoppingBag };
const looks = ['Classic', 'Creative', 'Street', 'Polished'];
const lookColors = ['#d59c70', '#b56748', '#e0ba8e', '#9b634c'];
const playerIcon = (label: string) => L.divIcon({ className: '', html: `<div class="player-marker">${label.slice(0, 1).toUpperCase()}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
const destinationIcon = (color: string, n: number) => L.divIcon({ className: '', html: `<div style="width:29px;height:29px;border-radius:50%;border:2px solid #f5f0e4;background:${color};display:grid;place-items:center;color:#fff;font:700 10px 'IBM Plex Mono';box-shadow:0 2px 8px #18233055">${String(n).padStart(2, '0')}</div>`, iconSize: [29, 29], iconAnchor: [14, 14] });
const adIcon = L.divIcon({ className: '', html: '<div class="billboard-marker"><span>AD</span></div>', iconSize: [35, 35], iconAnchor: [17, 32] });

function objectArray(value: unknown): AnyRecord[] { return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') as AnyRecord[] : []; }
function catalog(names: string[]) {
  const exports = gameExports as unknown as AnyRecord;
  for (const name of names) {
    const found = objectArray(exports[name]);
    if (found.length) return found;
  }
  return [];
}
function itemId(item: AnyRecord, index: number) { return String(item.id ?? item.key ?? item.slug ?? index); }
function itemName(item: AnyRecord) { return String(item.name ?? item.title ?? item.label ?? 'City opportunity'); }
function itemDescription(item: AnyRecord) { return String(item.description ?? item.details ?? item.location ?? 'A chance to make your next move.'); }
function itemPrice(item: AnyRecord) { return Number(item.price ?? item.cost ?? item.rent ?? item.salary ?? item.pay ?? item.wage ?? 0); }
function cash(amount: number) { return `$${Math.max(0, Number(amount) || 0).toLocaleString('en-US')}`; }
function coordsOf(ad: AnyRecord): [number, number] | null {
  const loc = ad.position ?? ad.coordinates ?? ad.location;
  const lat = Number(ad.lat ?? ad.latitude ?? loc?.lat ?? loc?.latitude);
  const lng = Number(ad.lng ?? ad.lon ?? ad.longitude ?? loc?.lng ?? loc?.lon ?? loc?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}
function adName(ad: AnyRecord) { return String(ad.title ?? ad.name ?? ad.headline ?? 'A message from the neighborhood'); }
function adImage(ad: AnyRecord) { return String(ad.imageUrl ?? ad.image ?? ad.image_url ?? ad.photo ?? ''); }
function adUrl(ad: AnyRecord) { return String(ad.url ?? ad.link ?? ad.linkUrl ?? ad.href ?? '#'); }
function adPrice(ad: AnyRecord) { return Number(ad.advertisingPrice ?? ad.price ?? ad.cost ?? 0); }
function adPlace(ad: AnyRecord) { return String(ad.locationName ?? ad.location ?? ad.district ?? ad.neighborhood ?? 'New York City'); }
function adCount(ad: AnyRecord, name: string) { return Number(ad[name] ?? ad[`${name}Count`] ?? 0); }

function Recenter({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(position, Math.max(map.getZoom(), 12), { duration: 0.8 }); }, [map, position[0], position[1]]);
  return null;
}
function MapReady({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}
function BillboardMarker({ billboard, position, icon, onClickLink, onView }: { billboard: AnyRecord; position: [number, number]; icon: L.DivIcon; onClickLink: (id: string) => void; onView: (id: string) => void }) {
  const id = String(billboard.id ?? adName(billboard));
  return <Marker position={position} icon={icon} eventHandlers={{ popupopen: () => onView(id) }}>
    <Popup minWidth={210}><b>{adName(billboard)}</b><div style={{ fontSize: 10, color: '#c5b995', marginTop: 3 }}>{adPlace(billboard)} · {cash(adPrice(billboard))} placement</div>{adImage(billboard) && <img src={adImage(billboard)} alt={adName(billboard)} className="bill-image" />}{adUrl(billboard) !== '#' && <a className="bill-link" href={adUrl(billboard)} target="_blank" rel="noreferrer" onClick={() => onClickLink(id)}>Open this local link <ExternalLink size={10} style={{ display: 'inline' }} /></a>}<div className="popup-metrics"><span>{adCount(billboard, 'views')} views</span><span>{adCount(billboard, 'clicks')} clicks</span></div></Popup>
  </Marker>;
}

function Setup({ createPlayer, error }: { createPlayer: (username: string, character: string) => void; error: string | null }) {
  const [username, setUsername] = useState('');
  const [look, setLook] = useState(looks[0]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (username.trim()) createPlayer(username.trim(), look); };
  return <main className="welcome-screen">
    <div className="welcome-art" aria-hidden="true" />
    <section className="welcome-copy">
      <div className="eyebrow" style={{ color: '#f1c751' }}>THE CITY IS YOURS TO FIGURE OUT</div>
      <h1>American<br /><em>Dream:</em><br />New York City</h1>
      <p>You just got here. One thousand dollars in your pocket, the whole city in front of you. Find work. Find your people. Make a life that looks like yours.</p>
      <form className="setup-box" onSubmit={submit}>
        <label className="setup-label" htmlFor="player-name">What should the city call you?</label>
        <input id="player-name" className="input-dark" placeholder="Your name" value={username} maxLength={20} onChange={(e) => setUsername(e.target.value)} data-testid="input-player-name" required />
        <span className="setup-label">Pick your first-day look</span>
        <div className="look-grid">{looks.map((option, index) => <button key={option} type="button" onClick={() => setLook(option)} className={`look-option ${look === option ? 'active' : ''}`} data-testid={`look-${option.toLowerCase()}`}>
          <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: lookColors[index], margin: '0 auto 5px', border: '2px solid #f5f0e4' }} />{option}
        </button>)}</div>
        {error && <div role="alert" className="setup-error" data-testid="status-setup-error">{error}</div>}
        <button className="game-btn onboard-button" type="submit" disabled={!username.trim()} data-testid="button-start-life">Start my life <ChevronDown size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /></button>
      </form>
      <div className="welcome-foot">A MAP-BASED LIFE SIMULATION · YOUR STORY STARTS ON THE SIDEWALK</div>
    </section>
  </main>;
}

function GameScreen() {
  const { game, createPlayer, move, work, bank, buyCar, buyFurniture, buySupply, useSupply, rentApartment, rest, wash, saveError } = useGameState();
  const [tab, setTab] = useState<Tab>('Map');
  const [bankAmount, setBankAmount] = useState('50');
  const [ads, setAds] = useState<Billboard[]>([]);
  const [adLoading, setAdLoading] = useState(true);
  const [adError, setAdError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedStop, setSelectedStop] = useState(stops[0]);
  const [mapFocus, setMapFocus] = useState<[number, number]>(stops[0].position);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const jobs = useMemo(() => catalog(['JOBS', 'jobs', 'jobCatalog']), []);
  const cars = useMemo(() => catalog(['CARS', 'cars', 'carCatalog']), []);
  const furniture = useMemo(() => catalog(['FURNITURE', 'furniture', 'furnitureCatalog']), []);
  const supplies = useMemo(() => catalog(['SUPPLIES', 'supplies', 'supplyCatalog']), []);
  const apartments = useMemo(() => catalog(['APARTMENTS', 'apartments', 'apartmentCatalog']), []);
  const loadAds = useCallback(async () => {
    setAdLoading(true); setAdError('');
    try { setAds(await loadBillboards()); } catch { setAdError('Neighborhood ads could not load.'); } finally { setAdLoading(false); }
  }, []);
  useEffect(() => { void loadAds(); }, [loadAds]);
  useEffect(() => { if (game) setMapFocus([game.position.lat, game.position.lng]); }, [game?.position.lat, game?.position.lng]);
  const announce = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2400); };
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? '')) return;
      const controls: Record<string, Direction> = { ArrowUp: 'north', w: 'north', W: 'north', ArrowDown: 'south', s: 'south', S: 'south', ArrowLeft: 'west', a: 'west', A: 'west', ArrowRight: 'east', d: 'east', D: 'east' };
      const direction = controls[e.key];
      if (direction && game) { e.preventDefault(); move(direction); }
      if (e.key.toLowerCase() === 'm') setTab('Map');
    };
    window.addEventListener('keydown', keyHandler); return () => window.removeEventListener('keydown', keyHandler);
  }, [game, move]);
  if (!game) return <Setup createPlayer={createPlayer} error={saveError} />;

  const playerPos: [number, number] = [Number(game.position.lat), Number(game.position.lng)];
  // Keep keyboard/touch movement centered without changing the selected district label.
  // Recenter itself only animates when its target changes.
  const nearest = stops.reduce((a, b) => Math.abs(a.position[0] - playerPos[0]) + Math.abs(a.position[1] - playerPos[1]) < Math.abs(b.position[0] - playerPos[0]) + Math.abs(b.position[1] - playerPos[1]) ? a : b);
  const call = (action: () => void, message: string) => { action(); announce(message); };
  const status = [
    ['Hunger', game.hunger, 'Food'],
    ['Energy', game.energy, 'Energy'],
    ['Hygiene', game.hygiene, 'Fresh'],
  ] as [string, number, string][];
  const currentTab = <div className="phone-content" key={tab}>
    {tab === 'Map' && <><div className="content-kicker">WHERE TO NEXT, {game.username.toUpperCase()}?</div>
      <div className="action-card"><h3>GET YOUR BEARINGS</h3><p>Move around the five boroughs. Tap a neighborhood marker to find out what's there.</p><div className="row-between"><span className="price">WASD / ARROW KEYS</span><Compass size={16} color="#f1c751" /></div></div>
      <div className="district-list">{stops.map((stop, i) => <button key={stop.name} className="district-btn" onClick={() => { setSelectedStop(stop); setMapFocus(stop.position); }} data-testid={`destination-${stop.name.toLowerCase().replaceAll(' ', '-')}`}><span>{stop.name}</span><span>{stop.area.split(' • ')[0]} {i === 0 && <MapPin size={12} style={{ verticalAlign: 'middle' }} />}</span></button>)}</div>
      <div className="action-card" style={{ marginTop: 10 }}><h3>ON FOOT</h3><p>Four directions. One big city. Take it block by block.</p><div className="row-between" style={{ justifyContent: 'center', gap: 6 }}><button className="game-btn ghost" onClick={() => move('west')} aria-label="Move west" data-testid="move-west"><ChevronDown size={15} style={{ transform: 'rotate(90deg)' }} /></button><div style={{ display: 'grid', gap: 5 }}><button className="game-btn ghost" onClick={() => move('north')} aria-label="Move north" data-testid="move-north"><ChevronUp size={15} /></button><button className="game-btn ghost" onClick={() => move('south')} aria-label="Move south" data-testid="move-south"><ChevronDown size={15} /></button></div><button className="game-btn ghost" onClick={() => move('east')} aria-label="Move east" data-testid="move-east"><ChevronDown size={15} style={{ transform: 'rotate(-90deg)' }} /></button></div></div>
    </>}
    {tab === 'Jobs' && <><div className="content-kicker">WORK A SHIFT. EARN YOUR NEXT STEP.</div>{jobs.length ? jobs.map((job, i) => <div className="action-card" key={itemId(job, i)}><div className="row-between"><h3>{itemName(job)}</h3><span className="price">+{cash(itemPrice(job))}</span></div><p>{itemDescription(job)}</p><button className="game-btn" onClick={() => call(() => work(itemId(job, i)), `Shift complete. ${cash(itemPrice(job))} earned.`)} data-testid={`work-${itemId(job, i)}`}>Work this shift</button></div>) : <div className="action-card"><h3>FIND YOUR FIRST SHIFT</h3><p>Check back after exploring. The city always needs another pair of hands.</p></div>}</>}
    {tab === 'Bank' && <><div className="content-kicker">YOUR MONEY, YOUR CALL.</div><div className="action-card"><div className="row-between"><h3>AVAILABLE CASH</h3><span className="price">{cash(game.cash)}</span></div><p>Keep cash for the street. Put a little away for later.</p><div className="form-row"><input className="input-dark" value={bankAmount} type="number" min="1" onChange={(e) => setBankAmount(e.target.value)} aria-label="Amount" data-testid="input-bank-amount" /></div><div className="row-between" style={{ marginTop: 9 }}><button className="game-btn secondary" onClick={() => call(() => bank('deposit', Number(bankAmount)), `Deposited ${cash(Number(bankAmount))}.`)} data-testid="bank-deposit">Deposit</button><button className="game-btn ghost" onClick={() => call(() => bank('withdraw', Number(bankAmount)), `Withdrew ${cash(Number(bankAmount))}.`)} data-testid="bank-withdraw">Withdraw</button></div></div><div className="action-card"><div className="row-between"><h3>SAVINGS</h3><span className="price">{cash(game.bank)}</span></div><p>Deposits stay in your account. No city shortcut, just steady choices.</p></div><div className="content-kicker">RECENT MONEY MOVES</div>{game.transactions.slice(0, 12).map((transaction: AnyRecord, i: number) => <div key={`${i}-${transaction.amount}`} className="row-between" style={{ borderBottom: '1px solid #34414b', padding: '9px 1px', fontSize: 11 }}><span>{transaction.description ?? transaction.label ?? transaction.type ?? 'Transaction'}</span><span className="price">{transaction.amount >= 0 ? '+' : ''}{cash(Math.abs(Number(transaction.amount)))}</span></div>)}</>}
    {tab === 'Cars' && <><div className="content-kicker">THE CITY MOVES FAST. SO CAN YOU.</div><div className="action-card"><div className="row-between"><h3>YOUR GARAGE</h3><CarFront size={18} color="#f1c751" /></div><p>{game.vehicles.length ? `${game.vehicles.length} ride${game.vehicles.length > 1 ? 's' : ''} in your name.` : 'No wheels yet. Every borough is still in reach.'}</p>{game.vehicles.map((id: string) => <div key={id} className="price">{itemName(cars.find((car) => itemId(car, 0) === id) ?? { id })}</div>)}</div>{cars.map((car, i) => { const owned = game.vehicles.includes(itemId(car, i)); return <div className="action-card" key={itemId(car, i)}><div className="row-between"><h3>{itemName(car)}</h3><span className="price">{cash(itemPrice(car))}</span></div><p>{itemDescription(car)}</p><button className="game-btn" disabled={owned || game.cash < itemPrice(car)} onClick={() => call(() => buyCar(itemId(car, i)), `Bought ${itemName(car)}.`)} data-testid={`buy-car-${itemId(car, i)}`}>{owned ? 'In your garage' : 'Buy ride'}</button></div>; })}</>}
    {tab === 'Home' && <><div className="content-kicker">SOMEWHERE TO LAND BETWEEN EVERYTHING ELSE.</div><div className="action-card"><div className="row-between"><h3>YOUR PLACE</h3><Home size={17} color="#f1c751" /></div><p>{game.apartmentId ? `${itemName(apartments.find((place) => itemId(place, 0) === game.apartmentId) ?? { id: game.apartmentId })} is home.` : 'No lease yet. A place of your own changes the whole rhythm.'}</p><button className="game-btn secondary" onClick={() => call(rest, 'You took a moment to rest.')} data-testid="button-rest"><BedDouble size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Rest</button><button className="game-btn ghost" style={{ marginLeft: 7 }} onClick={() => call(wash, 'You cleaned up. Fresh start.')} data-testid="button-wash"><WashingMachine size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Wash up</button></div>{apartments.map((place, i) => { const current = itemId(place, i) === game.apartmentId; return <div className="action-card" key={itemId(place, i)}><div className="row-between"><h3>{itemName(place)}</h3><span className="price">{cash(itemPrice(place))}</span></div><p>{itemDescription(place)}</p><button className="game-btn" disabled={current || game.cash < itemPrice(place)} onClick={() => call(() => rentApartment(itemId(place, i)), 'You found a place to call home.')} data-testid={`rent-${itemId(place, i)}`}>{current ? 'Your current home' : 'Rent this place'}</button></div>; })}<div className="content-kicker" style={{ marginTop: 15 }}>MAKE IT FEEL LIKE YOURS</div>{furniture.map((item, i) => { const owned = game.furniture.includes(itemId(item, i)); return <div className="action-card" key={itemId(item, i)}><div className="row-between"><h3>{itemName(item)}</h3><span className="price">{cash(itemPrice(item))}</span></div><p>{itemDescription(item)}</p><button className="game-btn ghost" disabled={owned || game.cash < itemPrice(item)} onClick={() => call(() => buyFurniture(itemId(item, i)), `Added ${itemName(item)} to your place.`)} data-testid={`buy-furniture-${itemId(item, i)}`}>{owned ? 'Already at home' : 'Bring it home'}</button></div>; })}</>}
    {tab === 'Shop' && <><div className="content-kicker">SMALL THINGS KEEP YOU GOING.</div>{supplies.map((supply, i) => <div className="action-card" key={itemId(supply, i)}><div className="row-between"><h3>{itemName(supply)}</h3><span className="price">{cash(itemPrice(supply))}</span></div><p>{itemDescription(supply)}</p><div className="row-between"><span className="price">In bag: {game.inventory[itemId(supply, i)] ?? 0}</span><button className="game-btn" disabled={game.cash < itemPrice(supply)} onClick={() => call(() => buySupply(itemId(supply, i)), `${itemName(supply)} added to your bag.`)} data-testid={`buy-supply-${itemId(supply, i)}`}>Buy</button></div>{(game.inventory[itemId(supply, i)] ?? 0) > 0 && <button className="game-btn secondary" style={{ marginTop: 8 }} onClick={() => call(() => useSupply(itemId(supply, i)), `Used ${itemName(supply)}.`)} data-testid={`use-supply-${itemId(supply, i)}`}>Use one</button>}</div>)}</>}
  </div>;

  const renderedAds = ads.map((ad) => {
    const raw = ad as unknown as AnyRecord;
    const point = coordsOf(raw);
    const fallbackStop = stops.find((stop) => adPlace(raw).toLowerCase().includes(stop.name.toLowerCase())) ?? stops[0];
    return { raw, point: point ?? fallbackStop.position, id: String(raw.id ?? adName(raw)) };
  });
  return <main className="game-shell">
    <header className="topbar"><div className="brand">AMERICAN DREAM<small>NEW YORK CITY · YOUR LIFE, YOUR MOVE</small></div><div className="top-stats"><div className="stat-pill"><Wallet size={15} color="#f1c751" /><strong>{cash(game.cash)}</strong></div><div className="stat-pill"><Banknote size={14} />BANK <strong>{cash(game.bank)}</strong></div><div className="stat-pill">{game.username}</div><Link to="/admin" style={{ color: '#f1c751', fontFamily: 'IBM Plex Mono', fontSize: 9, textDecoration: 'none' }} data-testid="link-admin">AD MANAGER</Link></div></header>
    <div className="game-layout">
      <div className="map-wrap">
        <MapContainer center={playerPos} zoom={12} minZoom={10} maxZoom={18} scrollWheelZoom zoomControl={false} attributionControl>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          <MapReady onReady={setMapInstance} />
          <Recenter position={mapFocus} />
          {stops.map((stop, i) => <Marker key={stop.name} position={stop.position} icon={destinationIcon(stop.color, i + 1)} eventHandlers={{ click: () => { setSelectedStop(stop); setMapFocus(stop.position); } }}><Popup><b>{stop.name}</b><br />{stop.area}<br /><button className="game-btn" style={{ marginTop: 8, minHeight: 30 }} onClick={() => setTab('Jobs')}>See what's here</button></Popup></Marker>)}
          <Marker position={playerPos} icon={playerIcon(game.username)}><Popup><b>{game.username}</b><br />Right here, right now.</Popup></Marker>
          {renderedAds.map(({ raw, point, id }) => <BillboardMarker key={id} billboard={raw} position={point} icon={adIcon} onClickLink={(adId) => setAds(recordBillboardClick(adId))} onView={(adId) => setAds(recordBillboardView(adId))} />)}
        </MapContainer>
        <div className="map-label"><b>{selectedStop.name}</b><span>{selectedStop.area}</span></div>
        <div className="map-tools"><button className="map-tool" title="Show my position" onClick={() => { setMapFocus(playerPos); setSelectedStop(nearest); }} data-testid="map-my-location"><MapPin size={17} /></button><button className="map-tool" title="Zoom in" onClick={() => mapInstance?.zoomIn()} data-testid="map-zoom-in"><Plus size={17} /></button><button className="map-tool" title="Map help" onClick={() => setHelpOpen(!helpOpen)} data-testid="map-help"><CircleHelp size={17} /></button></div>
        {helpOpen && <div style={{ position: 'absolute', zIndex: 600, right: 65, top: 65, width: 210, background: '#182330', color: '#f5f0e4', padding: 14, borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}>Explore with WASD or arrow keys. Use the city phone for jobs, money, a place, and supplies.<button onClick={() => setHelpOpen(false)} aria-label="Close help" style={{ float: 'right', border: 0, background: 'transparent', color: '#f5f0e4' }}><X size={14} /></button></div>}
        {adLoading && <div style={{ position: 'absolute', bottom: 14, left: 15, zIndex: 400, background: '#f5f0e4', padding: '7px 10px', borderRadius: 5, font: '10px IBM Plex Mono' }}>Loading neighborhood ads…</div>}
        {!adLoading && adError && <button onClick={() => void loadAds()} style={{ position: 'absolute', bottom: 14, left: 15, zIndex: 400, background: '#182330', color: 'white', padding: '8px 10px', border: 0, borderRadius: 5, font: '10px IBM Plex Mono' }}>{adError} Retry</button>}
      </div>
      <aside className="side-panel">
        <header className="panel-head"><div className="eyebrow">YOUR DAY, DAY ONE</div><div className="row-between"><h2 className="panel-title">A LIFE IN THE MAKING</h2><span className="mono" style={{ fontSize: 9, color: '#747b77' }}>DAY 01</span></div><div className="district-line">{nearest.area} · {game.apartmentId ? 'HAS A HOME' : 'NEW IN TOWN'}</div></header>
        <div className="needs">{status.map(([label, value, unit]) => <div key={label}><div className="need-label"><span>{label}</span><span>{Math.round(value)}%</span></div><div className={`meter ${value < 30 ? 'low' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>)}</div>
        <nav className="phone-tabs" aria-label="City phone">{(['Map', 'Jobs', 'Bank', 'Cars', 'Home', 'Shop'] as Tab[]).map((name) => { const Icon = tabIcons[name]; return <button key={name} className={`phone-tab ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)} data-testid={`tab-${name.toLowerCase()}`}><Icon />{name}</button>; })}</nav>
        {currentTab}
      </aside>
    </div>
    {saveError && <div className="toast-message" role="alert">{saveError}</div>}
    {!saveError && notice && <div className="toast-message" role="status">{notice}</div>}
  </main>;
}

function BillboardManager() {
  const { signOut } = useClerk();
  const [ads, setAds] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setAds(await loadBillboards()); } catch { setError('Could not load local billboard data.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const setField = (field: string, value: string) => setEditing((current) => current ? { ...current, [field]: value } : current);
  const persist = (next: Billboard[]) => { saveBillboards(next); setAds(next); };
  const submit = (e: FormEvent) => {
    e.preventDefault(); if (!editing) return;
    const record = { id: editing.id || `ad-${Date.now()}`, title: String(editing.title ?? ''), image: String(editing.image ?? ''), location: String(editing.location ?? ''), lat: Number(editing.lat ?? 40.758), lng: Number(editing.lng ?? -73.9855), price: Number(editing.price ?? 0), link: String(editing.link ?? ''), views: Number(editing.views ?? 0), clicks: Number(editing.clicks ?? 0) } as Billboard;
    setSaving(true); try { persist(editing.id ? ads.map((ad) => String((ad as AnyRecord).id) === String(editing.id) ? record : ad) : [...ads, record]); setEditing(null); } catch { setError('Changes could not be saved in this browser.'); } finally { setSaving(false); }
  };
  const remove = (id: string) => { if (window.confirm('Remove this billboard from this browser?')) persist(ads.filter((ad) => String((ad as AnyRecord).id) !== id)); };
  return <div className="admin-page"><div className="admin-header"><div><div className="eyebrow">AMERICAN DREAM · CITY MEDIA</div><h1>BILLBOARD MANAGER</h1><div className="mono" style={{ fontSize: 11, color: '#747b77' }}>Manage the messages appearing on the city map. Changes are stored in this browser.</div></div><div style={{ display: 'flex', gap: 9, alignItems: 'center' }}><Link to="/" style={{ color: '#182330', fontSize: 12, textDecoration: 'none' }} data-testid="link-back-to-game">Back to game</Link><button className="game-btn ghost" style={{ color: '#182330', borderColor: '#b9ad9a' }} onClick={() => void signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out">Sign out</button><button className="game-btn" onClick={() => { setEditing({ title: '', image: '', location: '', price: 0, link: '', lat: 40.758, lng: -73.9855 }); }} data-testid="button-new-billboard"><Plus size={14} style={{ verticalAlign: 'middle' }} /> New billboard</button></div></div>
    {error && <div role="alert" className="admin-card" style={{ borderLeft: '4px solid #c94d2f' }}>{error} <button className="game-btn" onClick={() => void refresh()}>Retry</button></div>}
    <div className="admin-grid"><section className="admin-card"><div className="row-between"><h2 className="display" style={{ fontSize: 24, margin: 0 }}>ON THE MAP</h2><span className="mono" style={{ fontSize: 10 }}>{ads.length} LIVE PLACEMENTS</span></div>{loading ? <div style={{ padding: 30 }}>Loading billboards…</div> : ads.length === 0 ? <div style={{ padding: '34px 10px', textAlign: 'center' }}><MapPin size={23} color="#c94d2f" /><h3 className="display" style={{ fontSize: 22, margin: '9px 0 4px' }}>No billboards yet</h3><p style={{ fontSize: 12, color: '#737a78' }}>Add the first neighborhood message. It will appear on the game map.</p><button className="game-btn" onClick={() => setEditing({ title: '', image: '', location: '', price: 0, link: '', lat: 40.758, lng: -73.9855 })}>Add billboard</button></div> : <table className="admin-table"><thead><tr><th>Message</th><th>Place / price</th><th>Views / clicks</th><th></th></tr></thead><tbody>{ads.map((billboard) => { const ad = billboard as unknown as AnyRecord; return <tr key={String(ad.id)}><td><strong>{adName(ad)}</strong><div className="mono" style={{ fontSize: 9, color: '#7b817d' }}>{ad.id}</div></td><td>{adPlace(ad)}<div className="mono" style={{ fontSize: 10 }}>{cash(adPrice(ad))}</div></td><td>{adCount(ad, 'views')} / {adCount(ad, 'clicks')}</td><td><div style={{ display: 'flex', gap: 6 }}><button className="game-btn ghost" style={{ color: '#182330', borderColor: '#b9ad9a', minHeight: 31, padding: '0 9px' }} onClick={() => setEditing({ ...ad })}>Edit</button><button className="game-btn" style={{ minHeight: 31, padding: '0 9px' }} onClick={() => remove(String(ad.id))}>Remove</button></div></td></tr>; })}</tbody></table>}</section>
    <section className="admin-card"><h2 className="display" style={{ fontSize: 24, margin: '0 0 3px' }}>{editing ? (editing.id ? 'EDIT PLACEMENT' : 'NEW PLACEMENT') : 'CAMPAIGN SNAPSHOT'}</h2>{editing ? <form onSubmit={submit}>
      {[['title', 'Headline'], ['image', 'Image URL'], ['location', 'Location'], ['price', 'Advertising price'], ['link', 'Click-through URL'], ['lat', 'Latitude'], ['lng', 'Longitude']].map(([field, label]) => <div className="admin-field" key={field}><label htmlFor={`bill-${field}`}>{label}</label><input id={`bill-${field}`} value={String(editing[field] ?? '')} type={field === 'price' || field === 'lat' || field === 'lng' ? 'number' : field === 'link' ? 'url' : 'text'} min={field === 'price' ? 0 : field === 'lat' ? 40.57 : field === 'lng' ? -74.06 : undefined} max={field === 'lat' ? 40.92 : field === 'lng' ? -73.69 : undefined} step={field === 'lat' || field === 'lng' ? 'any' : undefined} onChange={(e) => setField(field, e.target.value)} required data-testid={`input-billboard-${field}`} /></div>)}
      <div className="row-between" style={{ marginTop: 15 }}><button type="button" className="game-btn ghost" style={{ color: '#182330', borderColor: '#b9ad9a' }} onClick={() => setEditing(null)}>Cancel</button><button className="game-btn" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save placement'}</button></div>
    </form> : <><p style={{ fontSize: 13, lineHeight: 1.6, color: '#737a78' }}>Each marker carries its image, neighborhood, placement price, destination link, and live view/click counters.</p><div className="action-card" style={{ color: '#f5f0e4', background: '#182330' }}><div className="eyebrow" style={{ color: '#f1c751' }}>BROWSER-LOCAL EDITOR</div><h3 className="display" style={{ fontSize: 21, marginTop: 6 }}>Keep the city talking.</h3><p>Placements and engagement counts are saved to local storage in this browser. They are not server-synced.</p></div><button className="game-btn secondary" onClick={() => void refresh()}>Refresh billboards</button></>}</section></div>
  </div>;
}

function AuthPage({ mode }: { mode: 'in' | 'up' }) {
  return <main className="auth-shell"><div><div className="brand" style={{ margin: '0 auto 24px', textAlign: 'center', color: '#f5f0e4' }}>AMERICAN DREAM<small>NEW YORK CITY</small></div>{mode === 'in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}</div></main>;
}
function ClerkAdminContent() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <main className="auth-shell"><div className="admin-card" style={{ width: 360, color: '#182330' }}><div className="eyebrow">CITY MEDIA</div><h1 className="display">CHECKING YOUR PASS</h1><div className="skeleton-line" /></div></main>;
  if (!isSignedIn) return <main className="auth-shell"><div className="admin-card" style={{ maxWidth: 430, color: '#182330' }}><div className="eyebrow">STAFF ONLY · CITY MEDIA</div><h1 className="display" style={{ fontSize: 32 }}>SIGN IN TO MANAGE ADS</h1><p style={{ fontSize: 13 }}>The city map is public. Editing its billboards is for signed-in users.</p><SignInButton mode="modal"><button className="game-btn">Continue with Clerk</button></SignInButton></div></main>;
  return <BillboardManager />;
}
function AdminGate() {
  return <ClerkAdminContent />;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in app environment.');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#c94d2f',
    colorForeground: '#182330',
    colorMutedForeground: '#737a78',
    colorDanger: '#a7332c',
    colorBackground: '#f5f0e4',
    colorInput: '#fcfaf4',
    colorInputForeground: '#182330',
    colorNeutral: '#b9ad9a',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '12px',
  },
  elements: {
    cardBox: 'bg-[#f5f0e4] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#182330]',
    headerSubtitle: 'text-[#737a78]',
    formFieldLabel: 'text-[#182330]',
    socialButtonsBlockButtonText: 'text-[#182330]',
    footerActionLink: 'text-[#a83e29]',
    footerActionText: 'text-[#737a78]',
    dividerText: 'text-[#737a78]',
    formButtonPrimary: 'bg-[#c94d2f] text-white',
  },
};

function AppRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <Switch>
      <Route path="/" component={GameScreen} />
      <Route path="/admin" component={AdminGate} />
      <Route path="/sign-in/*?" component={() => <AuthPage mode="in" />} />
      <Route path="/sign-up/*?" component={() => <AuthPage mode="up" />} />
      <Route><main className="auth-shell"><div className="admin-card"><div className="eyebrow">WRONG TURN</div><h1 className="display">THAT BLOCK ISN'T ON THE MAP.</h1><a href="/" className="game-btn" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Back to the city</a></div></main></Route>
    </Switch>
  </ClerkProvider>;
}

function App() { return <WouterRouter base={basePath}><AppRoutes /></WouterRouter>; }
export default App;
