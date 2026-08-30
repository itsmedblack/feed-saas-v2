const el = id => document.getElementById(id);
const STORE_KEY = 'feed_saas_api_base';
let API_BASE = localStorage.getItem(STORE_KEY) || '';
let currentShop = null;
const api = () => API_BASE.replace(/\/$/,'');

function normalizeBackend(value='') {
  const clean = value.trim().replace(/\/$/,'');
  if (!/^https:\/\//i.test(clean)) throw new Error('Use uma URL completa iniciando com https://');
  return clean;
}

async function request(path, options={}) {
  const r = await fetch(`${api()}${path}`, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
  return data;
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
  showConnected();
  await loadShops();
}

function showConnected() {
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
  try { await connectBackend(el('backendUrl').value); }
  catch (err) { el('backendMsg').textContent = err.message; }
});

el('changeBackend').addEventListener('click', () => showSetup('Informe a nova URL e teste novamente.'));

el('add').addEventListener('submit', async e => {
  e.preventDefault();
  el('msg').textContent='Detectando plataforma e cadastrando loja...';
  try {
    const data = await request('/api/shops', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:el('url').value})});
    el('msg').textContent=`Loja criada. Plataforma: ${data.shop.platform}. Iniciando primeira varredura...`;
    el('url').value='';
    await loadShops();
    await scanShop(data.shop.id, null, true);
  } catch(err){ el('msg').textContent=err.message; }
});

async function loadShops(){
  if (!API_BASE) return;
  try{
    const shops=await request('/api/shops');
    el('shops').innerHTML=shops.map(card).join('') || '<div class="empty">Nenhuma loja cadastrada.</div>';
  }catch(e){ el('shops').innerHTML=`<div class="empty">${esc(e.message)}</div>`; }
}

function scheduleLabel(s) {
  const map = {manual:'Manual',hourly:'A cada hora',daily:'Diário',weekly:'Semanal',biweekly:'Quinzenal',monthly:'Mensal'};
  const base = map[s.schedule_type] || 'Manual';
  if (!['manual','hourly'].includes(s.schedule_type) && s.schedule_hour != null) return `${base} · ${String(s.schedule_hour).padStart(2,'0')}:00`;
  return base;
}

function card(s){
  const feed=`${api()}/feed/${s.feed_token}.xml`;
  const scanStats = s.last_job_finished_at ? `<div class="scan-mini"><span>+${s.last_products_new||0} novos</span><span>${s.last_products_updated||0} atualizados</span><span>${s.last_errors||0} erros</span></div>` : '';
  return `<article class="shop">
    <div class="shop-top"><div><h3>${esc(s.name||s.domain)}</h3><div class="meta">${esc(s.domain)}</div></div><span class="status-dot" title="Ativa"></span></div>
    <div><span class="pill">${esc(s.platform||'detectando')}</span><span class="pill">${esc(s.discovery_method||'sem scan')}</span><span class="pill schedule-pill">${esc(scheduleLabel(s))}</span></div>
    <div class="stat">${s.product_count||0}</div><div class="meta">produtos monitorados</div>
    <p class="meta">Último scan: ${s.last_scan?new Date(s.last_scan).toLocaleString('pt-BR'):'Nunca'}</p>
    ${scanStats}
    <a class="feed-link" href="${feed}" target="_blank">${feed}</a>
    <div class="actions">
      <button onclick="scanShop('${s.id}', this)">Atualizar agora</button>
      <button class="ghost" onclick="openShop('${s.id}')">Gerenciar</button>
      <button class="ghost" onclick="copyText('${feed}', this)">Copiar XML</button>
    </div>
  </article>`;
}

async function scanShop(id, button, firstScan=false){
  if(button){button.disabled=true;button.textContent='Rastreando...';}
  try{
    const d=await request(`/api/shops/${id}/scan`,{method:'POST'});
    const message = `Concluído: ${d.products} produtos · ${d.created} novos · ${d.updated} atualizados · ${d.errors} erros`;
    if (firstScan) el('msg').textContent = message; else alert(message);
    await loadShops();
    if (currentShop?.id === id) await refreshCurrentTab();
  }catch(e){ if (firstScan) el('msg').textContent=e.message; else alert(e.message); }
  finally{if(button){button.disabled=false;button.textContent='Atualizar agora';}}
}

async function copyText(text, button){
  await navigator.clipboard.writeText(text);
  if(button){const old=button.textContent;button.textContent='Copiado';setTimeout(()=>button.textContent=old,1200)}
}

async function openShop(id){
  currentShop = await request(`/api/shops/${id}`);
  el('modalShopName').textContent = currentShop.name || currentShop.domain;
  el('modalShopDomain').textContent = currentShop.domain;
  el('shopModal').hidden = false;
  document.body.classList.add('modal-open');
  setupScheduleFields();
  activateTab('products');
}

function closeModal(){
  el('shopModal').hidden = true;
  document.body.classList.remove('modal-open');
  currentShop = null;
}

el('closeModal').addEventListener('click', closeModal);
el('shopModal').addEventListener('click', e => { if(e.target === el('shopModal')) closeModal(); });
document.addEventListener('keydown', e => { if(e.key==='Escape' && !el('shopModal').hidden) closeModal(); });

for(const t of document.querySelectorAll('.tab')) t.addEventListener('click',()=>activateTab(t.dataset.tab));

async function activateTab(name){
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));
  document.querySelectorAll('.tabpane').forEach(x=>x.classList.toggle('active',x.id===`tab-${name}`));
  if(name==='products') await loadProducts();
  if(name==='health') await loadHealth();
  if(name==='history') await loadHistory();
  if(name==='schedule') setupScheduleFields();
  if(name==='settings') setupShopSettings();
}

async function refreshCurrentTab(){
  const active = document.querySelector('.tab.active')?.dataset.tab || 'products';
  await activateTab(active);
}

let searchTimer;
el('productSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadProducts,300)});
el('productFilter').addEventListener('change',loadProducts);
el('refreshProducts').addEventListener('click',loadProducts);

async function loadProducts(){
  if(!currentShop) return;
  el('productsBody').innerHTML='<tr><td colspan="6" class="loading">Carregando produtos...</td></tr>';
  const q=encodeURIComponent(el('productSearch').value||'');
  const filter=encodeURIComponent(el('productFilter').value||'all');
  try{
    const rows=await request(`/api/shops/${currentShop.id}/products?q=${q}&filter=${filter}&limit=1000`);
    el('productsCount').textContent=`${rows.length} produto(s) exibido(s)`;
    el('productsBody').innerHTML=rows.map(productRow).join('') || '<tr><td colspan="6" class="loading">Nenhum produto neste filtro.</td></tr>';
  }catch(e){el('productsBody').innerHTML=`<tr><td colspan="6" class="loading">${esc(e.message)}</td></tr>`}
}

function productRow(p){
  const price=p.price==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:p.currency||'BRL'}).format(p.price);
  const stock=p.availability==='out_of_stock'?'<span class="badge danger">Indisponível</span>':'<span class="badge success">Disponível</span>';
  const image=p.image_url?`<img class="product-img" src="${esc(p.image_url)}" loading="lazy" onerror="this.style.display='none'">`:'<div class="no-img">—</div>';
  return `<tr><td><div class="product-cell">${image}<div><a href="${esc(p.url)}" target="_blank">${esc(p.title)}</a><small>${esc(p.external_id||p.id)}</small></div></div></td><td>${esc(p.sku||'—')}</td><td>${price}</td><td>${stock}</td><td>${esc(p.category||'—')}</td><td>${p.updated_at?new Date(p.updated_at).toLocaleString('pt-BR'):'—'}</td></tr>`;
}

async function loadHealth(){
  if(!currentShop)return;
  el('healthContent').innerHTML='<div class="loading">Calculando qualidade do feed...</div>';
  try{
    const h=await request(`/api/shops/${currentShop.id}/health`);
    const tone=h.score>=95?'excellent':h.score>=80?'warn':'bad';
    el('healthContent').innerHTML=`
      <div class="health-score ${tone}"><div class="score-ring"><strong>${h.score}%</strong><span>Feed Health</span></div><div><h3>${healthLabel(h.score)}</h3><p class="muted small">${h.valid} de ${h.total} produtos possuem os campos críticos para entrar no XML.</p></div></div>
      <div class="health-grid">
        ${metricCard('Produtos válidos',h.valid,'critical-good')}
        ${metricCard('Sem imagem',h.critical.missingImage,h.critical.missingImage?'critical-bad':'critical-good')}
        ${metricCard('Sem preço',h.critical.missingPrice,h.critical.missingPrice?'critical-bad':'critical-good')}
        ${metricCard('Sem título',h.critical.missingTitle,h.critical.missingTitle?'critical-bad':'critical-good')}
        ${metricCard('Sem GTIN',h.recommendations.missingGtin,'critical-warn')}
        ${metricCard('Sem marca',h.recommendations.missingBrand,'critical-warn')}
        ${metricCard('Sem categoria',h.recommendations.missingCategory,'critical-warn')}
        ${metricCard('Fora de estoque',h.inventory.outOfStock,'neutral')}
      </div>
      <div class="health-note"><strong>Erros críticos</strong> impedem o produto de entrar no XML atual: imagem, preço e título. GTIN, marca e categoria são recomendações importantes para enriquecer o catálogo.</div>`;
  }catch(e){el('healthContent').innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
function healthLabel(score){return score>=95?'Feed saudável':score>=80?'Feed com ajustes recomendados':'Feed precisa de atenção'}
function metricCard(label,value,tone){return `<div class="metric ${tone}"><span>${esc(label)}</span><strong>${value}</strong></div>`}

function setupScheduleFields(){
  if(!currentShop)return;
  const hourSelect=el('scheduleHour');
  if(!hourSelect.options.length) for(let i=0;i<24;i++){const o=document.createElement('option');o.value=i;o.textContent=`${String(i).padStart(2,'0')}:00`;hourSelect.appendChild(o)}
  el('scheduleType').value=currentShop.schedule_type||'manual';
  hourSelect.value=currentShop.schedule_hour==null?3:Number(currentShop.schedule_hour);
  toggleHour();
}
el('scheduleType').addEventListener('change',toggleHour);
function toggleHour(){el('scheduleHourWrap').hidden=['manual','hourly'].includes(el('scheduleType').value)}
el('saveSchedule').addEventListener('click',async()=>{
  if(!currentShop)return;
  el('scheduleMsg').textContent='Salvando...';
  try{
    const type=el('scheduleType').value, hour=Number(el('scheduleHour').value);
    await request(`/api/shops/${currentShop.id}/schedule`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({type,hour})});
    currentShop.schedule_type=type;currentShop.schedule_hour=['manual','hourly'].includes(type)?null:hour;
    el('scheduleMsg').textContent='Agendamento salvo. O Worker aplicará automaticamente.';
    await loadShops();
  }catch(e){el('scheduleMsg').textContent=e.message}
});

async function loadHistory(){
  if(!currentShop)return;
  el('historyContent').innerHTML='<div class="loading">Carregando histórico...</div>';
  try{
    const jobs=await request(`/api/shops/${currentShop.id}/jobs`);
    el('historyContent').innerHTML=jobs.length?`<div class="history-list">${jobs.map(jobCard).join('')}</div>`:'<div class="empty">Nenhuma varredura registrada.</div>';
  }catch(e){el('historyContent').innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
function jobCard(j){
  const ok=j.status==='done';
  return `<div class="job"><div><span class="badge ${ok?'success':'danger'}">${ok?'Concluído':esc(j.status)}</span><strong>${j.started_at?new Date(j.started_at).toLocaleString('pt-BR'):'—'}</strong></div><div class="job-stats"><span>${j.urls_analyzed||0}<small>URLs</small></span><span>${j.products_found||0}<small>Produtos</small></span><span>${j.products_new||0}<small>Novos</small></span><span>${j.products_updated||0}<small>Atualizados</small></span><span>${j.errors||0}<small>Erros</small></span></div>${j.error_message?`<p class="error-text">${esc(j.error_message)}</p>`:''}</div>`;
}

function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

window.loadShops=loadShops;window.scanShop=scanShop;window.openShop=openShop;window.copyText=copyText;

(async function init(){
  if (!API_BASE) return showSetup();
  try { await connectBackend(API_BASE); }
  catch (e) { showSetup(`A conexão salva não respondeu: ${e.message}`); }
})();


function setupShopSettings(){
  if(!currentShop) return;
  el('editShopName').value = currentShop.name || '';
  el('editShopUrl').value = currentShop.domain || '';
  el('feedInStockOnly').checked = Number(currentShop.feed_in_stock_only ?? 1) === 1;
  el('merchantStoreName').value = currentShop.merchant_store_name || currentShop.name || '';
  el('defaultBrand').value = currentShop.default_brand || '';
  el('googleProductCategory').value = currentShop.google_product_category || '';
  el('editShopMsg').textContent = '';
}

el('saveShop').addEventListener('click', async () => {
  if(!currentShop) return;
  el('editShopMsg').textContent = 'Salvando...';
  try {
    const data = await request(`/api/shops/${currentShop.id}`, {
      method:'PUT',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        name:el('editShopName').value,
        url:el('editShopUrl').value,
        feedInStockOnly:el('feedInStockOnly').checked,
        merchantStoreName:el('merchantStoreName').value,
        defaultBrand:el('defaultBrand').value,
        googleProductCategory:el('googleProductCategory').value
      })
    });
    currentShop = data.shop;
    el('modalShopName').textContent = currentShop.name || currentShop.domain;
    el('modalShopDomain').textContent = currentShop.domain;
    el('editShopMsg').textContent = 'Alterações salvas. Clique em “Atualizar agora” no painel para regenerar o XML imediatamente.';
    await loadShops();
  } catch(e){ el('editShopMsg').textContent = e.message; }
});

el('deleteShop').addEventListener('click', async () => {
  if(!currentShop) return;
  const label = currentShop.name || currentShop.domain;
  if(!confirm(`Excluir ${label}? Esta ação removerá também os produtos, histórico e o XML.`)) return;
  try {
    await request(`/api/shops/${currentShop.id}`, {method:'DELETE'});
    closeModal();
    await loadShops();
    el('msg').textContent = 'Loja excluída.';
  } catch(e){ alert(e.message); }
});

el('goPanel').addEventListener('click', () => {
  if(!el('shopModal').hidden) closeModal();
  document.getElementById('panel').scrollIntoView({behavior:'smooth', block:'start'});
});
