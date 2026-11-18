(()=>{'use strict';
const GOOP_BASE=new URL('./',document.baseURI).pathname;
const asset=p=>GOOP_BASE+p.replace(/^\//,'');
const $=id=>document.getElementById(id), defaults={engine:'https://www.google.com/search?q=',wisp:'wss://wisp.mercurywork.shop/',customWisp:'',preferProxy:true,gameHost:'',gnmathUrl:'',moviesBase:'',musicBase:'',mangaBase:'',bloxBase:'',mangaSource:'mangadex',searchApi:''};
const sources={ugs:{label:'UGS',owner:'gmshelf',file:'ugs.json'},seraph:{label:'Seraph',owner:'gmshelf',file:'seraph.json'},truffled:{label:'Truffled',owner:'gmshelf',file:'truffled.json'},ckv:{label:'CKV',owner:'gmshelf',file:'ckv.json'},gnmath:{label:'gnmath-sdk',owner:'',file:''}};
const cats=[['games','Games','',''],['movies','Movies','',''],['music','Music','',''],['manga','Manga','',''],['blox','GoopBlox','',''],['settings','Settings','','']];
let settings={...defaults,...read('goop-settings',{})};let bookmarks=read('goop-bookmarks',[{name:'Google',url:'https://google.com'},{name:'YouTube',url:'https://youtube.com'},{name:'GitHub',url:'https://github.com'}]);let active='home',gameSource='ugs',gameCache={},currentUrl='',history=[],historyIndex=-1,scramjet=null,proxyFrame=null,initPromise=null,token=0;
function read(key,fallback){try{let value=JSON.parse(localStorage.getItem(key));return value??fallback}catch{return fallback}}
function save(){localStorage.setItem('goop-settings',JSON.stringify(settings));localStorage.setItem('goop-bookmarks',JSON.stringify(bookmarks))}
function safeUrl(s){try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
function validBase(s){return safeUrl(s?.trim()||'')}
function toast(s){const el=$('toast');el.textContent=s;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),3500)}
function view(v){active=v;['home','categoryView','settingsView','browserView'].forEach(id=>$(id).classList.toggle('hidden',id!==({home:'home',category:'categoryView',settings:'settingsView',browser:'browserView'}[v])));window.scrollTo(0,0)}
function home(){view('home');renderBookmarks()}$('homeBtn').onclick=home;$('brandHome').onclick=home;$('brandHome').onkeydown=e=>{if(e.key==='Enter')home()};document.querySelectorAll('[data-home]').forEach(b=>b.onclick=home);$('browserHome').onclick=home;$('settingsBtn').onclick=()=>{syncSettings();view('settings')};
function renderBookmarks(){const node=$('bookmarks');node.replaceChildren();bookmarks.forEach((b,i)=>{const wrap=document.createElement('div');wrap.className='bookmark';const a=document.createElement('button');a.className='bookmark';a.style.cssText='border:0;background:none;padding:0;color:inherit';a.textContent=b.name;a.onclick=()=>navigate(b.url);const x=document.createElement('button');x.className='remove';x.title='Remove bookmark';x.textContent='×';x.onclick=()=>{bookmarks.splice(i,1);save();renderBookmarks()};wrap.append(a,x);node.append(wrap)})}
$('addBookmark').onclick=()=>{let raw=prompt('Bookmark URL (https://...)');if(!raw)return;let url=safeUrl(raw.includes('://')?raw:'https://'+raw);if(!url){toast('Enter a valid web address');return}let name=prompt('Bookmark name',new URL(url).hostname)||new URL(url).hostname;bookmarks.push({name:name.trim().slice(0,55),url});save();renderBookmarks()};
$('categories').replaceChildren(...cats.map(([id,title,emoji,detail])=>{let b=document.createElement('button');b.className='tile';b.innerHTML='<span class="name">'+title+'</span><span class="tile-arrow">›</span>';b.onclick=()=>{if(id==='settings'){syncSettings();view('settings')}else openCategory(id)};return b}));
function resolveSearch(s){s=s.trim();if(!s)return null;if(/^https?:\/\//i.test(s))return safeUrl(s);if(/^localhost(:\d+)?(\/|$)/i.test(s))return 'http://'+s;if(/^(?:[\w-]+\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i.test(s))return safeUrl('https://'+s);return settings.engine+encodeURIComponent(s)}
$('homeSearchForm').onsubmit=e=>{e.preventDefault();const u=resolveSearch($('homeSearch').value);if(u)navigate(u)};$('goBtn').onclick=()=>{let u=resolveSearch($('urlInput').value);if(u)navigate(u)};$('urlInput').onkeydown=e=>{if(e.key==='Enter')$('goBtn').click()};
function status(s){$('status').textContent=s;settingsStatus=s}
let settingsStatus='';
// Browser scripts are loaded only on an HTTPS deployment; the HTML remains offline-friendly.
const runtimeLoads=new Map();
function loadRuntime(file,ready){
 if(ready())return Promise.resolve();
 if(!runtimeLoads.has(file))runtimeLoads.set(file,new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=asset(file);
  script.onload=()=>ready()?resolve():reject(Error(file+' loaded but did not initialize'));
  script.onerror=()=>reject(Error('Missing runtime: '+asset(file)+' — check your published build'));
  document.head.append(script);
 }).catch(error=>{runtimeLoads.delete(file);throw error}));
 return runtimeLoads.get(file);
}
// Official Scramjet-App 1.1 runtime: ScramjetController + BareMux + libcurl.
let goopController=null, goopTransport=null;
async function initProxy(){
 if(initPromise)return initPromise;
 initPromise=(async()=>{
  if(location.protocol==='file:')throw Error('Full web browsing activates when Goop is deployed over HTTPS. Local bookmarks, Settings and built-in games still work.');
  if(!window.isSecureContext || !('serviceWorker' in navigator))throw Error('Web browsing needs HTTPS with service worker support.');
  await Promise.all([
   loadRuntime('scram/scramjet.all.js',()=>!!window.$scramjetLoadController),
   loadRuntime('baremux/index.js',()=>!!window.BareMux)
  ]);
  await navigator.serviceWorker.register(asset('sw.js'),{scope:GOOP_BASE});
  await navigator.serviceWorker.ready;
  if(!goopController){
   const {ScramjetController}=window.$scramjetLoadController();
   goopController=new ScramjetController({prefix:asset('scramjet/'),files:{
    wasm:asset('scram/scramjet.wasm.wasm'),all:asset('scram/scramjet.all.js'),sync:asset('scram/scramjet.sync.js')
   }});
   goopController.init();
  }
  if(!goopTransport)goopTransport=new window.BareMux.BareMuxConnection(asset('baremux/worker.js'));
  const wisp=(settings.wisp||defaults.wisp).trim();
  if(!/^wss:\/\//i.test(wisp))throw Error('Select a secure Wisp server in Settings');
  await goopTransport.setTransport(asset('libcurl/index.mjs'),[{websocket:wisp}]);
  if(!proxyFrame){
   const old=$('browserFrame');
   proxyFrame=goopController.createFrame();
   proxyFrame.frame.id='browserFrame';
   proxyFrame.frame.title='Goop browser';
   old.replaceWith(proxyFrame.frame);
  }
  status('Proxy ready');
  return proxyFrame;
 })().catch(e=>{initPromise=null;status('Proxy error: '+e.message);throw e});
 return initPromise;
}
async function loadPage(url){
 const current=++token;
 hideFallback();view('browser');$('urlInput').value=url;currentUrl=url;
 status('Connecting to web browser…');
 try{
  if(location.protocol==='file:'){showBrowserSetup(url);return;}
  const f=await initProxy();
  if(current!==token)return;
  f.go(url);
  $('browserFrame').classList.remove('hidden');
  $('searchFallback').classList.add('hidden');
  status('Loading '+new URL(url).hostname+' through Scramjet');
 }catch(e){
  if(current!==token)return;
  const node=fallbackHeading('Browser connection failed','Goop could not start its proxy connection. This is a setup or Wisp issue, not a search engine iframe restriction.');
  const p=document.createElement('p');p.textContent=e.message;
  const r=document.createElement('p');r.textContent='Confirm this deployment contains /scram/, /baremux/ and /libcurl/, then check the Wisp connection under Settings.';
  node.append(p,r,buttonFor('Settings',()=>{syncSettings();view('settings')}),buttonFor('Try again',()=>loadPage(url)));
 }
}
function showEmbeddablePage(url){
 hideFallback();
 const frame=$('browserFrame');
 frame.removeAttribute('sandbox');
 frame.src=url;
 status('Loading page. Some sites prevent being displayed inside other pages.');
 const node=$('searchFallback');
 const hint=document.createElement('div');hint.className='embedding-hint';
 hint.append('If the website refuses to connect, ',buttonFor('Open in this tab',()=>location.assign(url)),
  buttonFor('Open new tab',()=>window.open(url,'_blank','noopener,noreferrer')));
 node.replaceChildren(hint);node.classList.remove('hidden');
 frame.classList.remove('hidden');
}

function hideFallback(){const node=$('searchFallback');node.classList.add('hidden');node.replaceChildren();$('browserFrame').classList.remove('hidden')}
function openFallback(){const node=$('searchFallback');node.classList.remove('hidden');$('browserFrame').classList.add('hidden');return node}
function fallbackHeading(heading,description){const node=openFallback();node.replaceChildren();const h=document.createElement('h2');h.textContent=heading;const p=document.createElement('p');p.textContent=description;node.append(h,p);return node}
function buttonFor(label,action){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.onclick=action;return b}
function showBrowserSetup(url){const node=fallbackHeading('Website browsing needs Scramjet','Goop opened this page internally, but loading external websites inside the browser requires a deployed Scramjet service worker and a working Wisp connection. A standalone local HTML file cannot bypass another website’s iframe restrictions.');const box=document.createElement('div');box.className='search-panel';box.textContent='Requested address: '+url;node.append(box,buttonFor('Open in external browser',()=>window.open(url,'_blank','noopener,noreferrer')),buttonFor('Back to Goop',home));status('Scramjet is not available on this installation. No external tab was opened.')}
async function showInPageSearch(url){
 const parsed=new URL(url),query=parsed.searchParams.get('q')||parsed.searchParams.get('query')||'';
 const engine=searchName(url)||'Web';
 const node=fallbackHeading(engine+' search','A local HTML file cannot display this search engine as an embedded page. Search engines block iframe access.');
 const term=document.createElement('div');term.className='search-panel';term.textContent='Search: '+query;node.append(term);
 const actions=document.createElement('div');actions.className='launch-actions';
 actions.append(buttonFor('Search in this tab',()=>location.assign(url)),
  buttonFor('Open new tab',()=>window.open(url,'_blank','noopener,noreferrer')),
  buttonFor('Back to Goop',home));node.append(actions);
 const base=safeUrl(settings.searchApi||'');
 if(!base){const help=document.createElement('p');help.textContent='For results displayed within Goop, Settings can connect to a CORS-enabled JSON search API. The Cherri source you provided requires hosted JavaScript and a service worker; its HTML alone cannot provide embedded web search.';node.append(help);status('Search page cannot be embedded from a local file');return;}
 const loading=document.createElement('p');loading.textContent='Fetching search results…';node.append(loading);
 try{
  const endpoint=new URL(base);endpoint.searchParams.set('q',query);endpoint.searchParams.set('format','json');
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000);
  let payload;
  try{const r=await fetch(endpoint,{signal:controller.signal,headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);payload=await r.json()}finally{clearTimeout(timer)}
  const items=Array.isArray(payload?.results)?payload.results:Array.isArray(payload?.items)?payload.items:[];
  loading.remove();
  if(!items.length){node.append('No results returned by the configured service.');return}
  for(const item of items.slice(0,40)){
   const target=safeUrl(item.url||item.link||'');if(!target)continue;
   const resultButton=document.createElement('button');resultButton.className='search-result';resultButton.type='button';
   const title=document.createElement('strong');title.textContent=item.title||new URL(target).hostname;
   const excerpt=document.createElement('span');excerpt.textContent=(item.content||item.snippet||item.description||'').replace(/<[^>]*>/g,'');
   const address=document.createElement('small');address.textContent=target;
   resultButton.append(title,excerpt,address);resultButton.onclick=()=>navigate(target);node.append(resultButton);
  }
  status('Search API results displayed');
 }catch(err){loading.textContent='Search service unavailable: '+err.message;status('Search service unavailable')}
}

async function showWikiArticle(title){const node=fallbackHeading(title,'Wikipedia article preview inside Goop');const loading=document.createElement('p');loading.textContent='Loading article…';node.append(loading);try{const api=new URL('https://en.wikipedia.org/w/api.php');for(const [k,v] of Object.entries({action:'query',prop:'extracts',explaintext:'1',exintro:'1',titles:title,format:'json',origin:'*'}))api.searchParams.set(k,v);const r=await fetch(api.toString());if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();const page=Object.values(d?.query?.pages||{})[0];loading.textContent=page?.extract||'No article preview available.';node.append(buttonFor('Search again',()=>showInPageSearch(settings.engine+encodeURIComponent($('homeSearch').value||title))),buttonFor('Open full article externally',()=>window.open('https://en.wikipedia.org/wiki/'+encodeURIComponent(title.replace(/ /g,'_')),'_blank','noopener,noreferrer')))}catch(e){loading.textContent='Unable to retrieve preview: '+e.message}}

function canUseProxy(){return window.isSecureContext && location.protocol !== 'file:' && 'serviceWorker' in navigator}
function isSearchUrl(u){try{let x=new URL(u);return /(^|\.)(google\.com|bing\.com|duckduckgo\.com|search\.brave\.com)$/.test(x.hostname)&&(/search|\?q=|\?query=|\?t=/.test(x.pathname+x.search))}catch{return false}}
function openExternalUrl(url){const tab=window.open(url,'_blank','noopener,noreferrer');if(!tab){toast('Your browser blocked the new tab. Use the Open button.');view('browser');$('urlInput').value=url;currentUrl=url;status('Open this link using the Open button above.')}}
function navigate(url,fromHistory=false){let u=safeUrl(url);if(!u){toast('Invalid URL');return}if(!fromHistory){history=history.slice(0,historyIndex+1);history.push(u);historyIndex=history.length-1}currentUrl=u;loadPage(u)}
$('backBtn').onclick=()=>{if(historyIndex>0)navigate(history[--historyIndex],true);else{try{$('browserFrame').contentWindow.history.back()}catch{}}};$('forwardBtn').onclick=()=>{if(historyIndex<history.length-1)navigate(history[++historyIndex],true)};$('reloadBtn').onclick=()=>currentUrl&&loadPage(currentUrl);$('openExternal').onclick=()=>currentUrl&&window.open(currentUrl,'_blank','noopener,noreferrer');$('saveBookmark').onclick=()=>{if(!currentUrl)return;let name=prompt('Bookmark name',new URL(currentUrl).hostname);if(name){bookmarks.push({name:name.trim(),url:currentUrl});save();toast('Bookmark saved')}};
function notice(message){const n=$('categoryNotice');n.textContent=message;n.classList.remove('hidden')}
function clearNotice(){$('categoryNotice').classList.add('hidden')}
function makeResult(title,subtitle,emoji,cover,onClick){const b=document.createElement('button');b.className='result';const p=document.createElement('div');p.className='poster';p.textContent='';if(cover&&safeUrl(cover)){const img=document.createElement('img');img.src=cover;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();p.append(img)}const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=subtitle||'';b.append(p,strong,small);b.onclick=onClick;return b}
function toolSearch(placeholder='Search…'){const input=document.createElement('input');input.className='field';input.placeholder=placeholder;input.setAttribute('aria-label',placeholder);return input}
function apiBase(id){return validBase(settings[id])}
function urlForGame(src,path){let base=apiBase('gameHost');if(!base)return null;try{return new URL(path.replace(/^\//,''),base.endsWith('/')?base:base+'/').href}catch{return null}}
async function getGames(key){if(gameCache[key])return gameCache[key];let source=sources[key];let url=key==='gnmath'?settings.gnmathUrl:`https://raw.githubusercontent.com/${source.owner}/${key}/main/${source.file}`;if(!safeUrl(url))throw Error('Add the gnmath-sdk JSON URL in Settings');const r=await fetch(url);if(!r.ok)throw Error('Catalog request failed: HTTP '+r.status);const data=await r.json();let items=Array.isArray(data)?data:(data.games||data.items||[]);if(!Array.isArray(items))throw Error('Invalid game catalog');return gameCache[key]=items.filter(g=>g&&g.name&&g.url)}
function hostBanner(){if(!apiBase('gameHost'))notice('Game catalogs can load from GitHub, but game files need a hosted copy. Set Game files hosting base URL in Settings before launching games.')}
async function showGames(q=''){let n=$('categoryResults');n.replaceChildren();clearNotice();hostBanner();const k=gameSource;try{const list=await getGames(k);if(gameSource!==k||active!=='category')return;let shown=list.filter(x=>x.name.toLowerCase().includes(q.toLowerCase())).slice(0,140);if(!shown.length){notice('No games match your search');return}shown.forEach(g=>{let img=g.img&&(!g.img.includes('placeholder'))?urlForGame(k,g.img):null;let url=urlForGame(k,g.url);let card=makeResult(g.name,k.toUpperCase(),'',img,()=>url?navigate(url):toast('Configure the game hosting URL in Settings first'));n.append(card)});if(list.length>140&&!q)toast('Showing first 140 games — search to find more')}catch(e){notice('Could not load '+sources[k].label+' catalog: '+e.message+'. If opened as a file, host Goop on HTTPS or localhost.')}}
async function fetchJson(url){const controller=new AbortController();const t=setTimeout(()=>controller.abort(),11000);try{let r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
function displayMedia(items,id){let n=$('categoryResults');n.replaceChildren();let data=Array.isArray(items)?items:(items?.results||items?.items||items?.data?.results||items?.data?.items||items?.tracks||[]);if(!Array.isArray(data)||!data.length){notice('No results returned. Try a different search.');return}data.slice(0,80).forEach(i=>{const title=i.title||i.name||i.attributes?.title||i.track?.title||'Untitled';const cover=i.cover||i.poster||i.poster_path&&('https://image.tmdb.org/t/p/w342'+i.poster_path)||i.image||i.artwork;const subtitle=i.release_date||i.artist?.name||i.artist||i.year||id;const card=makeResult(title,typeof subtitle==='string'?subtitle:id,id==='movies'?'':id==='music'?'':'',cover,()=>{if(id==='movies'){toast('Selected '+title+'. Use your Movies server player to stream.');let b=apiBase('moviesBase');if(b)navigate(b)}else if(id==='music'){const base=apiBase('musicBase');if(base)navigate(base)}else{const b=apiBase('mangaBase');if(b)navigate(b)}});n.append(card)})}
async function mediaSearch(id,term){let b=apiBase(id+'Base'),n=$('categoryResults');n.replaceChildren();clearNotice();if(!b){notice('Set the '+id+' backend URL in Settings to use this section. The GitHub repository provides server code, not a public hosted API.');return}let path=id==='movies'?'/api/search/multi?query='+encodeURIComponent(term||'popular'):id==='music'?'/api/music/search?q='+encodeURIComponent(term||'popular'):settings.mangaSource==='pill'?'/pill/search?title='+encodeURIComponent(term):'/mangadex/search?title='+encodeURIComponent(term);try{let data=await fetchJson(new URL(path.replace(/^\//,''),b.endsWith('/')?b:b+'/').href);displayMedia(data,id)}catch(e){notice('Could not access the '+id+' backend ('+e.message+'). Check URL, server status, HTTPS and CORS settings.')}}
function openCategory(id){view('category');$('categoryTitle').textContent=cats.find(c=>c[0]===id)[1];$('categoryDesc').textContent=cats.find(c=>c[0]===id)[3];$('categoryTools').replaceChildren();$('categoryResults').replaceChildren();clearNotice();if(id==='games'){const sel=document.createElement('select');sel.className='field';Object.entries(sources).forEach(([k,s])=>sel.add(new Option(s.label,k)));sel.value=gameSource;sel.onchange=()=>{gameSource=sel.value;showGames(search.value)};const search=toolSearch('Find a game…');search.oninput=()=>showGames(search.value);$('categoryTools').append(sel,search);showGames();return}if(id==='blox'){const base=apiBase('bloxBase');notice(base?'GoopBlox needs a deployed webblox-built server. It must run as a top-level page with cross-origin isolation, not inside an iframe.':'Set your deployed GoopBlox URL in Settings. webblox-built requires its own server, engine download, HTTPS, and Roblox sign-in.');let btn=document.createElement('button');btn.className='btn primary';btn.textContent='Launch GoopBlox ↗';btn.onclick=()=>{const u=apiBase('bloxBase');if(u)window.open(new URL('blox/',u.endsWith('/')?u:u+'/').href,'_blank','noopener,noreferrer');else toast('Add your GoopBlox server URL in Settings')};$('categoryTools').append(btn);const urls=[['webblox-built','https://github.com/x8rr/webblox-built'],['webblox','https://github.com/x8rr/webblox']];urls.forEach(([name,url])=>$('categoryResults').append(makeResult(name,'GitHub project','',null,()=>window.open(url,'_blank','noopener,noreferrer'))));return}const search=toolSearch('Search '+id+'…');let timer;search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>mediaSearch(id,search.value),350)};let btn=document.createElement('button');btn.className='btn';btn.textContent='Open server ↗';btn.onclick=()=>{const u=apiBase(id+'Base');if(u)window.open(u,'_blank','noopener,noreferrer');else toast('Configure this backend in Settings')};$('categoryTools').append(search,btn);mediaSearch(id,'')}
const fields=['engine','customWisp','preferProxy','gameHost','gnmathUrl','moviesBase','musicBase','mangaBase','bloxBase','mangaSource','searchApi'];function syncSettings(){fields.forEach(k=>{if($(k).type==='checkbox')$(k).checked=!!settings[k];else $(k).value=settings[k]||''});$('wisp').value=Array.from($('wisp').options).some(o=>o.value===settings.wisp)?settings.wisp:'custom';$('wispStatus').textContent=settingsStatus||'Proxy starts on first navigation when the site is hosted.'}
function updateSettings(){fields.forEach(k=>settings[k]=$(k).type==='checkbox'?$(k).checked:$(k).value.trim());settings.wisp=$('wisp').value==='custom'?settings.customWisp:defaults.wisp;save()}
fields.forEach(k=>$(k).addEventListener('change',()=>{updateSettings();if(k==='gnmathUrl')delete gameCache.gnmath}));$('wisp').onchange=()=>{if($('wisp').value==='custom'&&!$('customWisp').value)$('customWisp').focus();updateSettings()};
$('applyWisp').onclick=()=>{updateSettings();if(!/^wss:\/\//i.test(settings.wisp)){toast('Use a secure wss:// WebSocket URL');return}initPromise=null;goopTransport=null;proxyFrame=null;const old=$('browserFrame');const replacement=document.createElement('iframe');replacement.id='browserFrame';replacement.title='Goop browser';old.replaceWith(replacement);$('wispStatus').textContent='New Wisp saved. It will connect on next navigation.';toast('Wisp selection saved')};
$('testWisp').onclick=()=>{updateSettings();if(!/^wss:\/\//.test(settings.wisp)){toast('Enter a valid wss:// URL');return}let socket;try{socket=new WebSocket(settings.wisp);$('wispStatus').textContent='Testing WebSocket connection…';const timer=setTimeout(()=>{socket.close();$('wispStatus').textContent='Socket test timed out'},5000);socket.onopen=()=>{clearTimeout(timer);$('wispStatus').textContent='WebSocket handshake connected. Full Wisp protocol and site access are not verified.';socket.close()};socket.onerror=()=>{clearTimeout(timer);$('wispStatus').textContent='Could not establish WebSocket connection'}}catch(e){$('wispStatus').textContent=e.message}};
$('exportSettings').onclick=()=>{let blob=new Blob([JSON.stringify({settings,bookmarks},null,2)],{type:'application/json'});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='goop-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('clearData').onclick=()=>{if(!confirm('Reset all Goop settings and bookmarks?'))return;settings={...defaults};bookmarks=[];gameCache={};save();syncSettings();renderBookmarks();toast('Goop data reset')};

// Standalone file improvements: playable offline games + best-effort real-site embedding.
const standaloneGames = [
 {name:'2048',doc:"<!doctype html><html><head><meta charset=\"utf-8\"><style>*{box-sizing:border-box}body{margin:0;padding:24px;color:#eaffed;background:#07130b;font:15px Lexend,system-ui,sans-serif;text-align:center}button{cursor:pointer;border:1px solid #488d56;background:#193b22;color:#edffed;border-radius:8px;padding:10px 17px;font:inherit}button:hover{background:#2d5b38}h2{margin:0 0 7px;font-size:24px}p{color:#a5cbb0}.board{margin:18px auto}.row{display:flex;justify-content:center;gap:6px}.cell{display:grid;place-items:center;border-radius:8px;font-weight:700}small{color:#8eb397}</style></head><body><h2>2048</h2><p>Score: <span id=\"score\">0</span> · Arrow keys or WASD</p><div id=\"board\" class=\"board\" style=\"display:grid;grid-template-columns:repeat(4,78px);gap:7px;width:max-content;max-width:100%\"></div><button onclick=\"reset()\">New game</button><p><small>Combine matching tiles to reach 2048</small></p><script>let a,score;const b=document.getElementById('board');function reset(){a=Array.from({length:4},()=>Array(4).fill(0));score=0;spawn();spawn();render()}function spawn(){let free=[];a.forEach((row,y)=>row.forEach((v,x)=>{if(!v)free.push([y,x])}));if(!free.length)return;let [y,x]=free[Math.random()*free.length|0];a[y][x]=Math.random()<.9?2:4}function combine(row){let vals=row.filter(Boolean),out=[];for(let i=0;i<vals.length;i++){if(vals[i]===vals[i+1]){out.push(vals[i]*2);score+=vals[i]*2;i++}else out.push(vals[i])}while(out.length<4)out.push(0);return out}function move(key){let old=JSON.stringify(a);for(let i=0;i<4;i++){let v;if(key==='ArrowLeft'||key==='ArrowRight'){v=a[i].slice();if(key==='ArrowRight')v.reverse();v=combine(v);if(key==='ArrowRight')v.reverse();a[i]=v}else{v=a.map(r=>r[i]);if(key==='ArrowDown')v.reverse();v=combine(v);if(key==='ArrowDown')v.reverse();v.forEach((x,j)=>a[j][i]=x)}}if(JSON.stringify(a)!==old){spawn();render()}}function render(){b.replaceChildren();a.flat().forEach(v=>{const el=document.createElement('div');el.className='cell';el.style.cssText='width:78px;height:78px;background:'+(v?'#326e40':'#162c1c')+';font-size:'+(v>1000?'21':'27')+'px';el.textContent=v||'';b.append(el)});document.getElementById('score').textContent=score}document.addEventListener('keydown',e=>{let k={w:'ArrowUp',s:'ArrowDown',a:'ArrowLeft',d:'ArrowRight'}[e.key]||e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)){e.preventDefault();move(k)}});let start;document.addEventListener('touchstart',e=>{start=[e.touches[0].clientX,e.touches[0].clientY]},{passive:true});document.addEventListener('touchend',e=>{if(!start)return;let x=e.changedTouches[0].clientX-start[0],y=e.changedTouches[0].clientY-start[1];if(Math.max(Math.abs(x),Math.abs(y))<25)return;move(Math.abs(x)>Math.abs(y)?(x>0?'ArrowRight':'ArrowLeft'):(y>0?'ArrowDown':'ArrowUp'));start=null});reset();<\/script></body></html>"},
 {name:'Snake',doc:"<!doctype html><html><head><meta charset=\"utf-8\"><style>*{box-sizing:border-box}body{margin:0;padding:24px;color:#eaffed;background:#07130b;font:15px Lexend,system-ui,sans-serif;text-align:center}button{cursor:pointer;border:1px solid #488d56;background:#193b22;color:#edffed;border-radius:8px;padding:10px 17px;font:inherit}button:hover{background:#2d5b38}h2{margin:0 0 7px;font-size:24px}p{color:#a5cbb0}.board{margin:18px auto}.row{display:flex;justify-content:center;gap:6px}.cell{display:grid;place-items:center;border-radius:8px;font-weight:700}small{color:#8eb397}</style></head><body><h2>Snake</h2><p>Score: <span id=\"score\">0</span> · Arrow keys or WASD · Swipe on mobile</p><canvas id=\"game\" width=\"400\" height=\"400\" style=\"max-width:95%;height:auto;border:1px solid #3d8651;background:#071009;border-radius:10px;touch-action:none\"></canvas><div><button onclick=\"restart()\">Restart</button></div><script>const c=document.getElementById('game'),ctx=c.getContext('2d'),N=20;let snake,dir,next,food,score,alive;function place(){do{food=[Math.floor(Math.random()*N),Math.floor(Math.random()*N)]}while(snake.some(p=>p[0]===food[0]&&p[1]===food[1]))}function restart(){snake=[[10,10],[9,10],[8,10]];dir=[1,0];next=dir;score=0;alive=true;document.getElementById('score').textContent=score;place();draw()}function input(x,y){if(x!==-dir[0]||y!==-dir[1])next=[x,y]}document.addEventListener('keydown',e=>{let m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[e.key];if(m){e.preventDefault();input(...m)}});let start; c.addEventListener('touchstart',e=>{start=[e.touches[0].clientX,e.touches[0].clientY]},{passive:true});c.addEventListener('touchend',e=>{if(!start)return;let x=e.changedTouches[0].clientX-start[0],y=e.changedTouches[0].clientY-start[1];if(Math.max(Math.abs(x),Math.abs(y))<20)return;Math.abs(x)>Math.abs(y)?input(Math.sign(x),0):input(0,Math.sign(y));start=null});function draw(){ctx.fillStyle='#071009';ctx.fillRect(0,0,400,400);ctx.fillStyle='#b9ffce';ctx.fillRect(food[0]*20+3,food[1]*20+3,14,14);snake.forEach((p,i)=>{ctx.fillStyle=i===0?'#b2ffbd':'#3acd6c';ctx.fillRect(p[0]*20+1,p[1]*20+1,18,18)});if(!alive){ctx.fillStyle='#fff';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillText('Game Over',200,190)}}function tick(){if(!alive)return;dir=next;const h=[snake[0][0]+dir[0],snake[0][1]+dir[1]];const eat=h[0]===food[0]&&h[1]===food[1];if(h.some(v=>v<0||v>=20)||snake.slice(0,eat?undefined:-1).some(p=>p[0]===h[0]&&p[1]===h[1])){alive=false;draw();return}snake.unshift(h);if(eat){score++;document.getElementById('score').textContent=score;place()}else snake.pop();draw()}restart();setInterval(tick,130);<\/script></body></html>"},
 {name:'Tic Tac Toe',doc:"<!doctype html><html><head><meta charset=\"utf-8\"><style>*{box-sizing:border-box}body{margin:0;padding:24px;color:#eaffed;background:#07130b;font:15px Lexend,system-ui,sans-serif;text-align:center}button{cursor:pointer;border:1px solid #488d56;background:#193b22;color:#edffed;border-radius:8px;padding:10px 17px;font:inherit}button:hover{background:#2d5b38}h2{margin:0 0 7px;font-size:24px}p{color:#a5cbb0}.board{margin:18px auto}.row{display:flex;justify-content:center;gap:6px}.cell{display:grid;place-items:center;border-radius:8px;font-weight:700}small{color:#8eb397}</style></head><body><h2>Tic Tac Toe</h2><p id=\"info\">Your turn: X</p><div class=\"board\" id=\"board\" style=\"display:grid;grid-template-columns:repeat(3,90px);gap:9px;width:max-content\"></div><button onclick=\"reset()\">New game</button><script>let cells=Array(9).fill(''),turn='X',end=false;const b=document.getElementById('board'),msg=document.getElementById('info');function reset(){cells.fill('');turn='X';end=false;draw();msg.textContent='Your turn: X'}function draw(){b.replaceChildren();cells.forEach((v,i)=>{const el=document.createElement('button');el.textContent=v;el.style.cssText='height:90px;font-size:38px';el.onclick=()=>play(i);b.append(el)})}function play(i){if(cells[i]||end)return;cells[i]=turn;const win=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(x=>x.every(j=>cells[j]===turn));if(win){msg.textContent=turn+' wins!';end=true}else if(cells.every(Boolean)){msg.textContent='Draw!';end=true}else{turn=turn==='X'?'O':'X';msg.textContent='Your turn: '+turn}draw()}draw();<\/script></body></html>"}
];
sources.offline={label:'Built-in / Offline',owner:'',file:''};
gameSource='offline';
const originalShowGames=showGames;
showGames=async function(q=''){
 if(gameSource!=='offline')return originalShowGames(q);
 clearNotice();
 const n=$('categoryResults');n.replaceChildren();
 standaloneGames.filter(g=>g.name.toLowerCase().includes(q.toLowerCase())).forEach(g=>{
  n.append(makeResult(g.name,'Works without internet','',null,()=>{
   $('searchGuide')?.classList.add('hidden');view('browser');$('urlInput').value='goop://games/'+g.name.toLowerCase().replaceAll(' ','-');
   currentUrl='';$('browserFrame').classList.remove('hidden');$('searchFallback').classList.add('hidden');
   $('browserFrame').removeAttribute('src');$('browserFrame').srcdoc=g.doc;
   status(g.name+' · Built into Goop');
  }));
 });
 if(!n.childElementCount)notice('No matching built-in games.');
};

function searchName(url){
 try{const host=new URL(url).hostname;
 if(host.includes('duckduckgo.com'))return 'DuckDuckGo';
 if(host==='search.brave.com')return 'Brave Search';
 if(host.includes('bing.com'))return 'Bing';
 if(host.includes('google.com'))return 'Google';
 return '';
 }catch{return ''}
}
function setSearchGuide(url,proxied){
 const bar=$('searchGuide');if(!bar)return;
 bar.replaceChildren();const name=searchName(url);
 if(!name){bar.classList.add('hidden');return;}
 bar.classList.remove('hidden');
 const message=document.createElement('span');
 message.textContent=proxied?name+' through Scramjet · requires hosted runtime and a Wisp connection':name+' · direct iframe embedding is blocked in standalone HTML. Results need a CORS-enabled search API or Scramjet on a hosted site.';
 const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open results if blocked';
 const close=document.createElement('button');close.textContent='Hide';close.onclick=()=>bar.classList.add('hidden');
 bar.append(message,link,close);
}
$('openExternal').title='Open a blocked site in your browser (only when you choose)';
if(location.protocol==='file:')status('Standalone HTML: built-in games work offline; external site embedding varies by website.');

renderBookmarks();syncSettings();
})();
