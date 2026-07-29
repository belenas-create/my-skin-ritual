import { initializeCloudSync, saveCloudProduct, deleteCloudProduct, saveCloudDevice, deleteCloudDevice, saveCloudRoutine } from './cloud-sync.js';
const CATS=["Limpeza", "Tônico / loção", "Essência / ampola", "Sérum / tratamento", "Tratamento noturno / renovação", "Área dos olhos", "Hidratante / reparador", "Protetor solar", "Máscara / uso semanal", "Lábios", "Equipamentos e dispositivos", "Finalização / maquiagem", "Corpo / pés", "Cabelo / couro cabeludo", "Outros"];const SP='skinCustomV2',SR='skinRoutineV2',DSTORE='skinRitualDevicesV1';let base=[],custom=[],period='all',rp='day',dashPeriod='day',current=null,devices=[],currentDevice=null;const defaultDevices=[{id:'device-age-r',brand:'Medicube',name:'AGE-R Booster Pro',how:'Air Shot na pele limpa e seca; Booster após sérum ou ampola; MC Mode após o skincare; Derma Shot como etapa final com produto que ofereça deslizamento.',freq:'Uso gradual conforme tolerância',timing:'Depende do modo',notes:'Evite modos intensos com ácidos ou retinoides quando a pele estiver sensibilizada.',image:'',custom:false}];const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],all=()=>[...base,...custom],safeParse=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}catch(error){console.warn('Dados locais inválidos em',key,error);return fallback}},esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])),norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();async function init(){document.body.classList.add('appLoading');bindCloudStatus();custom=safeParse(SP,[]);devices=safeParse(DSTORE,[]);try{const response=await fetch('data/products.json');if(!response.ok)throw new Error(`Falha ao carregar catálogo (${response.status})`);base=await response.json()}catch(error){console.error(error);base=[];toast('Não foi possível carregar o catálogo. Seus itens pessoais continuam disponíveis.')}$('#cat').innerHTML=CATS.map(x=>`<option>${x}</option>`).join('');nav();events();bindDevices();render();document.body.classList.remove('appLoading');initializeCloudSync().catch(error=>{console.error(error);window.dispatchEvent(new CustomEvent('skin-cloud-status',{detail:{state:'error',message:'Falha na sincronização'}}))});if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(console.error)}function nav(){$$('.nav').forEach(b=>b.onclick=()=>{$$('.page').forEach(x=>x.classList.remove('active'));$$('.nav').forEach(x=>{x.classList.remove('active');x.removeAttribute('aria-current')});$('#'+b.dataset.page).classList.add('active');b.classList.add('active');b.setAttribute('aria-current','page');if(b.dataset.page==='routine')routine();if(b.dataset.page==='dashboard')renderDashboard();scrollTo({top:0,behavior:'smooth'})});$('.nav.active')?.setAttribute('aria-current','page')}function goToPage(page){document.querySelector(`.nav[data-page="${page}"]`)?.click()}function events(){$('#search').oninput=e=>brands(e.target.value);$$('.period').forEach(b=>b.onclick=()=>{$$('.period').forEach(x=>x.classList.remove('active'));b.classList.add('active');period=b.dataset.period;stages()});$$('.rt').forEach(b=>b.onclick=()=>{$$('.rt').forEach(x=>x.classList.remove('active'));b.classList.add('active');rp=b.dataset.r;routine()});$('#brand').onchange=()=>{let n=$('#brand').value==='__new__';$('#newBrandBox').hidden=!n;$('#newBrand').required=n};$('#photo').onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader;r.onload=()=>{$('#preview').src=r.result;$('#preview').hidden=false;$('#ph').hidden=true};r.readAsDataURL(f)};$('#form').onsubmit=save;$('#close').onclick=()=>$('#dlg').close();$('#delete').onclick=del;$$('[data-go]').forEach(b=>b.onclick=()=>goToPage(b.dataset.go));$$('.dashPeriod').forEach(b=>b.onclick=()=>{$$('.dashPeriod').forEach(x=>x.classList.remove('active'));b.classList.add('active');dashPeriod=b.dataset.dashPeriod;renderDashboard()})}function periods(p){return Array.isArray(p.periods)?p.periods:p.period==='day'?['day']:p.period==='night'||p.period==='weekly'?['night']:['day','night']}function card(p){return `<button class="card" data-id="${p.id}">${p.image?`<img loading="lazy" src="${p.image}">`:'<div class="placeholder">✦</div>'}<b>${esc(p.name)}</b><small>${esc(p.category||p.stage||'Outros')}</small></button>`}function wire(){$$('.card').forEach(c=>c.onclick=()=>open(c.dataset.id))}function render(){renderDashboard();brands('');stages();routine();renderDevices();$('#count').textContent=all().length+' produtos';brandOptions()}function renderDashboard(){
 const products=all(),routineData=safeParse(SR,{}),selected=routineData[dashPeriod]||{},steps=RM[dashPeriod];
 const selectedItems=steps.map(step=>({step,product:products.find(p=>p.id===selected[step])}));
 const completed=selectedItems.filter(x=>x.product).length,totalSteps=steps.length;
 $('#dashProducts').textContent=products.length;$('#dashBrands').textContent=new Set(products.map(p=>p.brand).filter(Boolean)).size;$('#dashDevices').textContent=allDevices().length;$('#dashRoutine').textContent=Math.round((completed/totalSteps)*100)+'%';
 $('#dashRoutineList').innerHTML=selectedItems.slice(0,5).map((item,i)=>`<div class="dashRoutineStep"><span>${i+1}</span><div><small>${esc(item.step)}</small><b>${item.product?esc(item.product.name):'Etapa ainda não preenchida'}</b></div>${item.product&&item.product.image?`<img src="${item.product.image}" alt="">`:'<i>✦</i>'}</div>`).join('')+(steps.length>5?`<p class="dashMore">+ ${steps.length-5} etapas na rotina completa</p>`:'');
 const counts=CATS.map(cat=>({cat,count:products.filter(p=>(p.category||p.stage||'Outros')===cat).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count).slice(0,6),max=Math.max(1,...counts.map(x=>x.count));
 $('#dashCategories').innerHTML=counts.map(x=>`<div class="categoryBar"><div><span>${esc(x.cat)}</span><b>${x.count}</b></div><i><em style="width:${Math.max(8,(x.count/max)*100)}%"></em></i></div>`).join('')||'<div class="note">Nenhum produto disponível.</div>';
 const recent=[...custom].sort((a,b)=>String(b.id).localeCompare(String(a.id))).slice(0,4);
 $('#dashRecent').innerHTML=recent.length?recent.map(p=>`<button class="recentItem" type="button" data-recent-id="${esc(p.id)}">${p.image?`<img src="${p.image}" alt="">`:'<i>✦</i>'}<span><small>${esc(p.brand||'Minha coleção')}</small><b>${esc(p.name)}</b><em>${esc(p.category||p.stage||'Outros')}</em></span></button>`).join(''):'<div class="emptyRecent"><span>✦</span><p>Seus produtos adicionados aparecerão aqui.</p><button type="button" data-go="add">Adicionar primeiro produto</button></div>';
 $$('[data-recent-id]').forEach(b=>b.onclick=()=>open(b.dataset.recentId));$$('#dashRecent [data-go]').forEach(b=>b.onclick=()=>goToPage(b.dataset.go));
}
function brands(q){q=norm(q);let x=all().filter(p=>!q||norm(p.name+' '+p.brand+' '+p.benefit).includes(q)),g=x.reduce((a,p)=>((a[p.brand]??=[]).push(p),a),{});$('#brands').innerHTML=Object.keys(g).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(k=>`<section class="block"><div class="head"><h2>${esc(k)}</h2><span>${g[k].length}</span></div><div class="cards">${g[k].map(card).join('')}</div></section>`).join('')||'<div class="note">Nenhum produto encontrado.</div>';wire()}function stages(){let x=all().filter(p=>period==='all'||periods(p).includes(period));$('#stageList').innerHTML=CATS.map(k=>{let a=x.filter(p=>(p.category||'Outros')===k);return a.length?`<section class="block"><div class="head"><h3>${esc(k)}</h3><span>${a.length}</span></div><div class="scroll">${a.map(card).join('')}</div></section>`:''}).join('');wire()}const RM={day:['Limpeza','Tônico / loção','Essência / ampola','Sérum / tratamento','Área dos olhos','Hidratante / reparador','Protetor solar'],night:['Limpeza','Tônico / loção','Essência / ampola','Sérum / tratamento','Tratamento noturno / renovação','Área dos olhos','Hidratante / reparador']};function routine(){let sv=safeParse(SR,{}),steps=RM[rp];$('#routineList').innerHTML=`<div class="routineBox">${steps.map((k,i)=>{let opts=all().filter(p=>(p.category||'Outros')===k&&periods(p).includes(rp));return `<div class="step"><span class="no">${i+1}</span><div><b>${k}</b></div><select data-step="${k}"><option value="">Nenhum</option>${opts.map(p=>`<option value="${p.id}" ${sv[rp]?.[k]===p.id?'selected':''}>${esc(p.brand)} — ${esc(p.name)}</option>`).join('')}</select></div>`}).join('')}</div>`;$$('[data-step]').forEach(s=>s.onchange=()=>{let d=safeParse(SR,{});d[rp]??={};d[rp][s.dataset.step]=s.value;localStorage.setItem(SR,JSON.stringify(d));saveCloudRoutine(d).catch(console.error);alerts()});alerts()}function alerts(){let sv=safeParse(SR,{})[rp]||{},x=Object.values(sv).map(id=>all().find(p=>p.id===id)).filter(Boolean),t=norm(x.map(p=>p.name+' '+p.benefit).join(' ')),a=[];if((/retinol|retinal|retinoid/.test(t))&&(/glycolic|glicol/.test(t)))a.push('Evite retinoide e ácido glicólico na mesma rotina, especialmente no início.');$('#alerts').innerHTML=a.map(x=>`<div class="alert">⚠ ${x}</div>`).join('')}function brandOptions(){let cur=$('#brand').value,b=[...new Set(all().map(p=>p.brand))].sort((a,b)=>a.localeCompare(b,'pt-BR'));$('#brand').innerHTML='<option value="">Selecione</option>'+b.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')+'<option value="__new__">＋ Nova marca</option>';if([...$('#brand').options].some(o=>o.value===cur))$('#brand').value=cur}function save(e){e.preventDefault();let sel=$('#brand').value,brand=(sel==='__new__'?$('#newBrand').value:sel).trim(),u=$('#use').value;if(!brand)return;custom.push({id:'custom-'+Date.now(),custom:true,brand,name:$('#name').value.trim(),category:$('#cat').value,stage:$('#cat').value,benefit:$('#benefit').value.trim(),frequency:$('#freq').value.trim(),averagePriceBRL:Number($('#price').value)||null,priceUpdated:new Date().toISOString().slice(0,7),notes:$('#notes').value.trim(),period:u,periods:u==='day'?['day']:u==='night'||u==='weekly'?['night']:['day','night'],image:$('#preview').hidden?'':$('#preview').src});localStorage.setItem(SP,JSON.stringify(custom));saveCloudProduct(custom[custom.length-1]).catch(console.error);e.target.reset();$('#preview').hidden=true;$('#preview').src='';$('#ph').hidden=false;$('#newBrandBox').hidden=true;render();toast('Produto salvo com sucesso ✨')}let toastTimer;function toast(t){let x=$('#toast');if(!x)return;x.textContent=t;x.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>x.classList.remove('show'),2600)}function open(id){current=all().find(p=>p.id===id);if(!current)return;$('#dimg').src=current.image||'';$('#dimg').hidden=!current.image;$('#dbrand').textContent=current.brand;$('#dname').textContent=current.name;$('#dcat').textContent=current.category||current.stage;$('#dbenefit').textContent=current.benefit||'';$('#dmeta').textContent=[current.frequency&&'Frequência: '+current.frequency,current.period&&'Uso: '+current.period].filter(Boolean).join(' · ');const price=$('#dprice');if(current.averagePriceBRL){price.hidden=false;price.innerHTML='<small>PREÇO MÉDIO NO BRASIL</small><strong>'+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(current.averagePriceBRL)+'</strong><span>Estimativa atualizada em '+(current.priceUpdated||'2026-07').split('-').reverse().join('/')+'</span>'}else{price.hidden=true;price.innerHTML=''}$('#dnotes').textContent=current.notes||'';$('#delete').hidden=!current.custom;$('#dlg').showModal();$('#close').focus()}function del(){if(!current?.custom)return;if(confirm('Excluir este produto?')){custom=custom.filter(p=>p.id!==current.id);localStorage.setItem(SP,JSON.stringify(custom));deleteCloudProduct(current.id).catch(console.error);$('#dlg').close();render()}}

function bindCloudStatus(){
 const box=$('#cloudStatus');
 if(!box)return;
 window.addEventListener('skin-cloud-status',event=>{
   const {state,message}=event.detail;
   box.dataset.state=state;
   box.textContent=(state==='online'?'● ':state==='syncing'?'◌ ':state==='error'?'! ':state==='pending'?'◷ ':state==='offline'?'○ ':'● ')+message;
 });
 window.addEventListener('skin-cloud-data',event=>{
   const {type,value}=event.detail||{};
   if(type==='products')custom=Array.isArray(value)?value:[];
   if(type==='devices')devices=Array.isArray(value)?value:[];
   if(type==='products'||type==='devices')render();
   if(type==='routine'){if(document.querySelector('#routine.active'))routine();renderDashboard()}
 });
}

function allDevices(){return [...defaultDevices,...devices]}
function deviceMatchesFilter(d,filter){
 const text=norm(`${d.freq||''} ${d.timing||''} ${d.notes||''}`);
 if(filter==='morning')return /manha|matinal|am\b/.test(text);
 if(filter==='night')return /noite|noturn|pm\b/.test(text);
 if(filter==='weekly')return /semana|semanal|1x|2x|3x|4x/.test(text);
 if(filter==='attention')return Boolean((d.notes||'').trim());
 return true;
}
function deviceCard(d){
 const timing=d.timing?.trim()||'Momento ainda não definido';
 const freq=d.freq?.trim()||'Frequência ainda não definida';
 return `<article class="deviceCard" data-device="${esc(d.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(d.name)}">
   <div class="deviceVisual">${d.image?`<img loading="lazy" src="${d.image}" alt="${esc(d.name)}">`:`<span>◇</span>`}<em>${d.custom?'Meu dispositivo':'Catálogo'}</em></div>
   <div class="deviceBody"><small>${esc(d.brand||'Dispositivo')}</small><h3>${esc(d.name)}</h3><p class="devicePurpose">${esc(d.how||'Adicione instruções de uso para consultar durante a rotina.')}</p>
   <div class="deviceTags"><span>◷ ${esc(freq)}</span><span>↳ ${esc(timing)}</span></div>
   ${d.notes?`<div class="deviceCare">⚠ ${esc(d.notes)}</div>`:''}<button class="deviceOpen" type="button">Ver detalhes <b>→</b></button></div>
 </article>`;
}
function renderDevices(){
 const box=$('#deviceList');if(!box)return;
 const query=norm($('#deviceSearch')?.value||''),filter=$('#deviceFilter')?.value||'all',allD=allDevices();
 const shown=allD.filter(d=>(!query||norm(`${d.name} ${d.brand} ${d.how} ${d.freq} ${d.timing}`).includes(query))&&deviceMatchesFilter(d,filter));
 box.innerHTML=shown.map(deviceCard).join('');
 $('#deviceEmpty').hidden=shown.length>0;
 $('#deviceCount').textContent=allD.length;
 $('#deviceRoutineCount').textContent=allD.filter(d=>(d.timing||'').trim()).length;
 $('#deviceCareCount').textContent=allD.filter(d=>(d.notes||'').trim()).length;
 $$('[data-device]').forEach(x=>{const open=()=>openDevice(x.dataset.device);x.onclick=open;x.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
}
function resetDeviceForm(){
 const f=$('#deviceForm'),open=$('#openDeviceForm');if(!f)return;
 f.reset();delete f.dataset.editId;$('#devicePreview').hidden=true;$('#devicePreview').src='';$('#devicePh').hidden=false;
 $('#deviceFormEyebrow').textContent='NOVO DISPOSITIVO';$('#deviceFormTitle').textContent='Adicionar dispositivo';open.textContent='＋ Novo dispositivo';
}
function showDeviceForm(editing=false){
 const f=$('#deviceForm');f.hidden=false;
 if(!editing){resetDeviceForm();f.hidden=false}
 setTimeout(()=>f.scrollIntoView({behavior:'smooth',block:'start'}),80);
}
function bindDevices(){
 const f=$('#deviceForm'),open=$('#openDeviceForm');
 if(open)open.onclick=()=>showDeviceForm(false);
 $('#cancelDeviceForm').onclick=()=>{resetDeviceForm();f.hidden=true};
 $('#deviceSearch').oninput=renderDevices;$('#deviceFilter').onchange=renderDevices;
 const photo=$('#devicePhoto');
 if(photo)photo.onchange=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{$('#devicePreview').src=r.result;$('#devicePreview').hidden=false;$('#devicePh').hidden=true};r.readAsDataURL(file)};
 if(f)f.onsubmit=e=>{e.preventDefault();
   const item={id:f.dataset.editId||'custom-device-'+Date.now(),brand:$('#deviceBrand').value.trim(),name:$('#deviceName').value.trim(),how:$('#deviceHow').value.trim(),freq:$('#deviceFreq').value.trim(),timing:$('#deviceTiming').value.trim(),notes:$('#deviceNotes').value.trim(),image:$('#devicePreview').hidden?'':$('#devicePreview').src,custom:true};
   if(f.dataset.editId){devices=devices.map(d=>d.id===f.dataset.editId?item:d)}else{devices.push(item)}
   localStorage.setItem(DSTORE,JSON.stringify(devices));saveCloudDevice(item).catch(console.error);resetDeviceForm();f.hidden=true;renderDevices();toast('Dispositivo salvo ✨')};
 const close=$('#deviceClose'),delBtn=$('#deviceDelete'),editBtn=$('#deviceEdit');
 if(close)close.onclick=()=>$('#deviceDlg').close();
 if(editBtn)editBtn.onclick=()=>{
   if(!currentDevice?.custom)return;
   $('#deviceBrand').value=currentDevice.brand||'';$('#deviceName').value=currentDevice.name||'';$('#deviceHow').value=currentDevice.how||'';$('#deviceFreq').value=currentDevice.freq||'';$('#deviceTiming').value=currentDevice.timing||'';$('#deviceNotes').value=currentDevice.notes||'';
   if(currentDevice.image){$('#devicePreview').src=currentDevice.image;$('#devicePreview').hidden=false;$('#devicePh').hidden=true}else{$('#devicePreview').src='';$('#devicePreview').hidden=true;$('#devicePh').hidden=false}
   f.dataset.editId=currentDevice.id;$('#deviceFormEyebrow').textContent='EDITAR DISPOSITIVO';$('#deviceFormTitle').textContent=currentDevice.name;f.hidden=false;open.textContent='＋ Novo dispositivo';$('#deviceDlg').close();setTimeout(()=>f.scrollIntoView({behavior:'smooth',block:'start'}),100);
 };
 if(delBtn)delBtn.onclick=()=>{if(!currentDevice?.custom)return;if(confirm('Excluir este dispositivo?')){devices=devices.filter(d=>d.id!==currentDevice.id);localStorage.setItem(DSTORE,JSON.stringify(devices));deleteCloudDevice(currentDevice.id).catch(console.error);$('#deviceDlg').close();renderDevices();toast('Dispositivo excluído')}};
}
function openDevice(id){
 currentDevice=allDevices().find(d=>d.id===id);if(!currentDevice)return;
 $('#deviceDimg').src=currentDevice.image||'';$('#deviceDimg').style.display=currentDevice.image?'block':'none';
 $('#deviceDbrand').textContent=currentDevice.brand||'';$('#deviceDname').textContent=currentDevice.name;
 $('#deviceDhow').innerHTML=`<strong>Como usar</strong><span>${esc(currentDevice.how||'Nenhuma instrução registrada.')}</span>`;
 $('#deviceDmeta').innerHTML=[currentDevice.freq&&`<span><b>Frequência</b>${esc(currentDevice.freq)}</span>`,currentDevice.timing&&`<span><b>Momento da rotina</b>${esc(currentDevice.timing)}</span>`].filter(Boolean).join('');
 $('#deviceDnotes').innerHTML=currentDevice.notes?`<strong>Cuidados importantes</strong><span>${esc(currentDevice.notes)}</span>`:'';
 $('#deviceDnotes').hidden=!currentDevice.notes;$('#deviceEdit').hidden=!currentDevice.custom;$('#deviceDelete').hidden=!currentDevice.custom;$('#deviceDlg').showModal();$('#deviceClose').focus();
}

$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()}));
window.addEventListener('online',()=>toast('Conexão restabelecida. Sincronizando…'));
window.addEventListener('offline',()=>toast('Você está offline. As alterações ficarão salvas neste aparelho.'));
init();