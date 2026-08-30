const el = id => document.getElementById(id);
const STORE_KEY = 'feed_saas_api_base';
let API_BASE = localStorage.getItem(STORE_KEY) || '';
const api = () => API_BASE.replace(/\/$/,'');

function normalizeBackend(value='') {
  const clean = value.trim().replace(/\/$/,'');
  if (!/^https:\/\//i.test(clean)) throw new Error('Use a URL completa iniciando com https://');
  return clean;
}

async function connectBackend(value) {
  const base = normalizeBackend(value);
  el('backendMsg').textContent = 'Testando conexão...';
  const r = await fetch(`${base}/api/health`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(data.error || 'O backend respondeu com erro.');
  if (data.database !== 'connected' || data.storage !== 'connected') throw new Error('Backend online, mas D1/KV não estão conectados.');
  API_BASE = base;
  localStorage.setItem(STORE_KEY, base);
  showConnected(data);
  await loadShops();
}

function showConnected(health={}) {
  el('setupCard').hidden = true;
  el('connectionBar').hidden = false;
  el('appCard').hidden = false;
  el('shopsSection').hidden = false;
  el('connectedUrl').textContent = API_BASE;
  el('backendMsg').textContent = '';
}

function showSetup(message='') {
  el('setupCard').hidden = false;
  el('connectionBar').hidden = true;
  el('appCard').hidden = true;
  el('shopsSection').hidden = true;
  el('backendUrl').value = API_BASE;
  el('backendMsg').textContent = message;
}

el('connectBackend').addEventListener('click', async () => {
  try {
    await connectBackend(el('backendUrl').value);
  } catch (err) {
    el('backendMsg').textContent = err.message;
  }
});

el('changeBackend').addEventListener('click', () => showSetup('Informe a nova URL e teste novamente.'));

el('add').addEventListener('submit', async e => {
  e.preventDefault();
  el('msg').textContent='Detectando plataforma e cadastrando loja...';
  try {
    const r = await fetch(`${api()}/api/shops`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:el('url').value})});
    const data = await r.json();
    if(!r.ok) throw new Error(data.error||'Falha');
    el('msg').textContent=`Loja criada. Plataforma: ${data.shop.platform}. Agora execute a primeira varredura.`;
    el('url').value='';
    loadShops();
  } catch(err){ el('msg').textContent=err.message; }
});

async function loadShops(){
  if (!API_BASE) return;
  try{
    const r=await fetch(`${api()}/api/shops`);
    const shops=await r.json();
    if(!r.ok) throw new Error(shops.error || 'Falha ao carregar lojas');
    el('shops').innerHTML=shops.map(card).join('') || '<p>Nenhuma loja cadastrada.</p>';
  }catch(e){
    el('shops').innerHTML=`<p>${esc(e.message)}</p>`;
  }
}

function card(s){
  const feed=`${api()}/feed/${s.feed_token}.xml`;
  return `<article class="shop">
    <h3>${esc(s.name||s.domain)}</h3>
    <div class="meta">${esc(s.domain)}</div>
    <span class="pill">${esc(s.platform||'detectando')}</span>
    <span class="pill">${esc(s.discovery_method||'sem scan')}</span>
    <div class="stat">${s.product_count||0}</div>
    <div class="meta">produtos monitorados</div>
    <p class="meta">Último scan: ${s.last_scan?new Date(s.last_scan).toLocaleString():'Nunca'}</p>
    <a href="${feed}" target="_blank">${feed}</a>
    <div class="actions">
      <button onclick="scanShop('${s.id}', this)">Atualizar agora</button>
      <button class="ghost" onclick="navigator.clipboard.writeText('${feed}')">Copiar XML</button>
    </div>
  </article>`;
}

async function scanShop(id, button){
  button.disabled=true;
  button.textContent='Rastreando...';
  try{
    const r=await fetch(`${api()}/api/shops/${id}/scan`,{method:'POST'});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error || 'Falha no rastreamento');
    alert(`Concluído: ${d.products} produtos encontrados`);
    loadShops();
  }catch(e){alert(e.message)}
  finally{button.disabled=false;button.textContent='Atualizar agora'}
}

function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

window.loadShops = loadShops;
window.scanShop = scanShop;

(async function init(){
  if (!API_BASE) return showSetup();
  try { await connectBackend(API_BASE); }
  catch (e) { showSetup(`A conexão salva não respondeu: ${e.message}`); }
})();
