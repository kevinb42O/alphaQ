const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const menu = $('.menu-toggle');
$('.header').classList.add('menu-ready');
menu.addEventListener('click', () => {const open = menu.getAttribute('aria-expanded') !== 'true';menu.setAttribute('aria-expanded', String(open));menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');$('#navigation').classList.toggle('open', open);});
$$('#navigation a').forEach(a => a.addEventListener('click', () => {menu.setAttribute('aria-expanded', 'false');menu.setAttribute('aria-label','Open navigation');$('#navigation').classList.remove('open');}));
const gallery = {
  esp: {
    title: 'ESP range and colours',
    alt: 'ESP tab with range controls, category buttons and visibility colours',
    description: 'Set the range, choose a colour pair for each category and decide which elements to display.',
    features: ['Maximum range of 2,500 m with automatic distance fading', 'Visible and invisible colours for Players, Team, Bots, World and Equipment', 'Individual switches for boxes, bones, names and other overlays']
  },
  hud: {
    title: 'Reticles and awareness',
    alt: 'HUD tab with reticle settings, an Alpha-Q logo preview, awareness and tracers',
    description: 'Fine-tune your reticle with a live preview alongside your awareness and tracer controls.',
    features: ['Precision, Heart, Quackshot, Alpha-Q logo, Devil face and Pentagram', 'Transparent Devil face artwork with a fixed centre dot', 'Size, thickness and outline controls plus adjustable RGB cycling']
  },
  gameplay: {
    title: 'Camera and gameplay',
    alt: 'Gameplay tab with camera, spin and weapon settings',
    description: 'Adjust your view and set up the controls you use during a session.',
    features: ['Camera scale from 60% to 200%', 'Camera settings saved separately from presets', 'Remappable spin pause with OFF, PAUSED, WAITING, AIM and ON states']
  },
  lobby: {
    title: 'Lobby overview',
    alt: 'Lobby tab with example player rows and the preset sidebar',
    description: 'See the Lobby tab’s player table and keep your presets within reach.',
    features: ['Player table in a dedicated tab', 'Collapsible preset sidebar', 'Camera and spin changes for lobby transitions in v5.1.2']
  },
  presets: {
    title: 'Preset library',
    alt: 'Presets tab with preset rows, key assignments and management controls',
    description: 'Save and switch setups from the Presets tab or the collapsible sidebar.',
    features: ['Load, save, create, rename and duplicate presets', 'Active-preset checkmark, unsaved-change prompts and recovery copies', 'Custom hotkeys work with the menu open or closed']
  }
};
const galleryTabs = $$('.gallery-tabs [role="tab"]');
const galleryScreen = $('#gallery-screen');
const galleryZoom = $('#gallery-zoom');
const galleryTitle = $('#gallery-title');
const galleryDescription = $('#gallery-description');
const galleryFeatures = $('#gallery-features');
gallery.aim = {
  title: galleryTitle.textContent,
  alt: galleryScreen.alt,
  description: galleryDescription.textContent,
  features: [...galleryFeatures.children].map(item => item.textContent)
};

function setTab(tab) {
  const key = tab.dataset.tab;
  const data = gallery[key];
  const image = `assets/release-5-1-2/${key}.webp`;
  for (const button of galleryTabs) {
    const active = button === tab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  $('#gallery-panel').setAttribute('aria-labelledby', tab.id);
  galleryScreen.src = image;
  galleryScreen.alt = data.alt;
  galleryTitle.textContent = data.title;
  galleryDescription.textContent = data.description;
  galleryFeatures.replaceChildren(...data.features.map(feature => {
    const item = document.createElement('li');
    item.textContent = feature;
    return item;
  }));
  galleryZoom.dataset.image = image;
  galleryZoom.dataset.caption = `${tab.textContent} menu preview`;
}
let galleryTransition;
function changeTab(tab) {
  if (tab.getAttribute('aria-selected') === 'true') return;
  setTab(tab);
  galleryTransition?.cancel();

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    galleryTransition = $('#gallery-screen').animate(
      [{ opacity: 0.55, clipPath: 'inset(0 12% 0 0)' }, { opacity: 1, clipPath: 'inset(0)' }],
      { duration: 300, easing: 'cubic-bezier(.16, 1, .3, 1)' }
    );
  }
}
galleryTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => changeTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % galleryTabs.length;
    if (event.key === 'ArrowLeft') next = (index + galleryTabs.length - 1) % galleryTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = galleryTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    changeTab(galleryTabs[next]);
    galleryTabs[next].focus();
  });
});
const dialog=$('#image-dialog');let imageTrigger=null;
$$('[data-image]').forEach(button=>button.addEventListener('click',()=>{imageTrigger=button;$('#lightbox-image').src=button.dataset.image;$('#lightbox-image').alt=button.dataset.caption;$('#image-caption').textContent=button.dataset.caption;dialog.showModal();}));
$('#close-image').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>imageTrigger?.focus());
const names=['Balanced','Precision','Fast response','Custom'];const defaults=['Numpad1','Numpad2','Numpad3','Numpad4'];const storage='alpha-q.website-demo.binds.v1';let binds=[...defaults], selected=0, capturing=null, captureTimer=null;
try{const saved=JSON.parse(localStorage.getItem(storage));if(Array.isArray(saved)&&saved.length===4&&saved.every(k=>typeof k==='string'&&k!=='KeyB'&&/^[A-Za-z0-9]{1,24}$/.test(k))&&new Set(saved).size===4)binds=saved;}catch{}
function persist(){try{localStorage.setItem(storage,JSON.stringify(binds));}catch{}}
function label(code){return code.replace('Numpad','NUM ').replace('Digit','').replace('Key','').replace('Mouse0','MOUSE 1').replace('Mouse1','MOUSE 3').replace('Mouse2','MOUSE 2').replace('Mouse3','MOUSE 4').replace('Mouse4','MOUSE 5').replace('Arrow','').replace('Left',' L').replace('Right',' R').toUpperCase();}
function status(text){$('#demo-status-text').textContent=text;}
function render(){const rows=$('#preset-rows');rows.replaceChildren(...names.map((name,i)=>{const row=document.createElement('div');row.className='preset-row'+(i===selected?' active':'');const nameButton=document.createElement('button');nameButton.className='preset-name';nameButton.type='button';nameButton.setAttribute('aria-pressed',String(i===selected));nameButton.innerHTML='<span class="preset-bullet" aria-hidden="true"></span>';nameButton.append(document.createTextNode(name));nameButton.addEventListener('click',()=>selectPreset(i));const key=document.createElement('button');key.className='bind-button'+(capturing===i?' capturing':'');key.textContent=capturing===i?'PRESS KEY':label(binds[i]);key.setAttribute('aria-label',`Change binding for ${name}, currently ${label(binds[i])}`);key.addEventListener('click',()=>startCapture(i));row.append(nameButton,key);return row;}));$('#cancel-bind').hidden=capturing===null;}
function endCapture(){clearTimeout(captureTimer);capturing=null;render();}
function selectPreset(i){endCapture();selected=i;render();status(`${names[i]} selected. Website demo only.`);$('#preset-demo').focus({preventScroll:true});}
function startCapture(i){clearTimeout(captureTimer);capturing=i;render();status(`Press one key or mouse button for ${names[i]}.`);$('#preset-demo').focus({preventScroll:true});captureTimer=setTimeout(()=>{endCapture();status('Capture timed out. Your previous binding is unchanged.');},15000);}
function assign(code){if(code==='KeyB'){status('B is reserved for bot targeting. Choose another key.');return;}if(binds.some((b,i)=>b===code&&i!==capturing)){status(`${label(code)} is already assigned. Choose another key.`);return;}const i=capturing;binds[i]=code;persist();endCapture();status(`${names[i]} bound to ${label(code)}. Saved in this browser.`);$('#preset-demo').focus({preventScroll:true});}
$('#preset-demo').addEventListener('keydown',e=>{if(e.repeat||e.code==='Tab')return;if(capturing!==null){if(e.ctrlKey||e.metaKey||e.altKey){status('Use a single key without a modifier chord.');return;}e.preventDefault();if(e.code)assign(e.code);}else if(e.target===$('#preset-demo')){const i=binds.indexOf(e.code);if(i!==-1){e.preventDefault();selectPreset(i);}}});
$('#preset-demo').addEventListener('mousedown',e=>{if(capturing!==null&&!e.target.closest('button')){e.preventDefault();assign('Mouse'+e.button);}else if(capturing===null&&!e.target.closest('button')){const i=binds.indexOf('Mouse'+e.button);if(i!==-1){e.preventDefault();selectPreset(i);}}});
$('#preset-demo').addEventListener('contextmenu',e=>{if(capturing!==null||binds.includes('Mouse2'))e.preventDefault();});
$('#cancel-bind').addEventListener('click',()=>{endCapture();status('Capture canceled. Your previous binding is unchanged.');});$('#reset-binds').addEventListener('click',()=>{clearTimeout(captureTimer);capturing=null;binds=[...defaults];selected=0;persist();render();status('Demo reset. Balanced selected.');});render();
$$('[data-days]').forEach(button=>button.addEventListener('click',()=>{const days=button.dataset.days,price=Number(button.dataset.price).toFixed(2);$$('[data-days]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});$('#duration-summary').textContent=`${days}-day access · €${price}`;$('#access-link').textContent=`Get ${days} ${days==='1'?'day':'days'} — €${price}`;}));
$('#year').textContent=new Date().getFullYear();

// Move keyboard focus with same-page navigation so a previously focused demo
// cannot pull the viewport back after a section jump or layout change.
$$('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
  const hash=link.getAttribute('href');const target=hash==='#'?document.body:$(hash);
  if(!target)return;event.preventDefault();history.pushState(null,'',hash);
  if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
  target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});
}));

if('IntersectionObserver' in window){const links=$$('#navigation a[href^="#"]');const spy=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)links.forEach(a=>a.classList.toggle('active',a.hash==='#'+entry.target.id));}},{rootMargin:'-10% 0px -65% 0px'});links.forEach(a=>{const section=$(a.hash);if(section)spy.observe(section);});}
