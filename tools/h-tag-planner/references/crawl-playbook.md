# Crawl playbook

Proven on Webflow staging. Works the same on WordPress, Shopify and Wix sites.

## Access

- **WebFetch fails on Webflow staging** (`*.webflow.io` disallows robots) and may strip tags on other sites anyway. Do not fetch with curl, Python or any other HTTP client. Use the browser: Claude in Chrome (`mcp__claude-in-chrome__*`) or the built-in browser (`mcp__remote-devices__Claude_Browser__*`).
- Browser flow: `tabs_context_mcp` (createIfEmpty) → `navigate` to the site → run scripts with `javascript_tool`. Scripts can `fetch()` other same-origin pages and parse them with `DOMParser`, so one tab can audit the whole site.
- **Output cap**: `javascript_tool` results get truncated at around 1,000 characters. For big results, store them on `window`, write them into the page body inside a `<main><article><pre>`, then read them with `get_page_text` (no cap). Split them into chunks of about 30,000 characters.
- Close the tab you created when you're done.

## 1. Navigation

Sites often have two navs: a visible desktop mega-menu and a separate mobile or footer nav. Find the visible top-level nav first:

```js
const clean=s=>(s||'').replace(/\s+/g,' ').trim();
const vis=el=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0};
const navs=[...document.querySelectorAll('[class*="nav"],nav,header,footer')].filter(n=>!n.parentElement.closest('[class*="nav"],nav,header,footer'));
navs.map(n=>`[${(n.className+'').slice(0,40)}] visible:${vis(n)} :: `+clean(n.innerText).slice(0,300)).join('\n')
```

Then list the header nav's links, using dropdown titles where they exist:

```js
const clean=s=>(s||'').replace(/\s+/g,' ').trim();
const n=document.querySelector('HEADER_NAV_SELECTOR');
[...n.querySelectorAll('a')].map(a=>{const t=a.querySelector('[class*="title"]');return clean(t?t.innerText:a.innerText).slice(0,45)+' > '+(a.getAttribute('href')||'').replace(/^https?:\/\/[^/]+/,'')}).join('\n')
```

Dropdown group labels (Solutions, Industries…) usually sit in toggle elements. Read them from the nav's visible text. Hover and click menus often won't open with synthetic events, so don't spend time on it.

## 2. Page list and status

```js
const paths=[...new Set([...document.querySelectorAll('a')].map(a=>a.getAttribute('href')||'').filter(h=>h.startsWith('/')||h.startsWith(location.origin)).map(h=>h.replace(location.origin,'').split('#')[0]).filter(Boolean))];
const out=[];for(const p of paths){const r=await fetch(p);out.push(r.status+' '+p)}out.join('\n')
```

Also try `/sitemap.xml` (it often 404s on staging). Record 404s, `href="#"` buttons, and nav items that point to the wrong page.

## 3. Audit every page (headings + context)

Run this once. It fetches every path, strips the nav and footer, and walks the DOM in order. Replace the nav/footer selectors with the site's own if its class names differ.

```js
window.audit = async (path) => {
 const clean=s=>(s||'').replace(/\s+/g,' ').trim();
 const res=await fetch(path); if(!res.ok) return `\n########## ${path} → HTTP ${res.status}\n`;
 const doc=new DOMParser().parseFromString(await res.text(),'text/html');
 doc.querySelectorAll('nav,header,footer,.w-nav,[class*="navigation"],[class*="footer"],script,style,noscript,svg').forEach(e=>e.remove());
 const hidden=el=>{for(let e=el;e&&e!==doc.body;e=e.parentElement){const c=(e.className||'')+'',st=e.getAttribute('style')||'';if(/w-condition-invisible|(^|\s)(hide|hidden|u-hide|sr-only|visually-hidden)(\s|$)/i.test(c)||/display:\s*none/.test(st))return true}return false};
 const lines=[];
 const walk=el=>{for(const c of el.children){const t=c.tagName,cls=(typeof c.className==='string'?c.className:'')||'';
   if(/^H[1-6]$/.test(t)){lines.push(`<<${t}>>${hidden(c)?'(HIDDEN)':''} [${cls}] ${clean(c.textContent)}`+(c.closest('.w-tab-pane,[role=tabpanel]')?' {in tab}':''));continue}
   if(t==='SECTION'){lines.push(`--- section [${cls.slice(0,40)}] #${c.id||'-'}`)}
   const direct=[...c.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
   if(direct&&!/^(A|BUTTON|LABEL|OPTION|SELECT)$/.test(t)){const hl=/(^|\s)(d[1-6]|h[1-6]|heading[\w-]*|[\w-]*title[\w-]*)(\s|$)/i.test(cls);lines.push(`   ${hl?'~~HEADING-STYLE-NOT-TAGGED~~ ':''}${t.toLowerCase()}${hidden(c)?'(HIDDEN)':''} [${cls}] ${clean(c.textContent).slice(0,160)}`);continue}
   if(/^(A|BUTTON)$/.test(t)){lines.push(`   (link/btn) ${clean(c.textContent).slice(0,60)} → ${c.getAttribute('href')||''}`);continue}
   walk(c)}};
 walk(doc.body);
 return `\n########## ${path}\nTITLE: ${doc.title}\nDESC: ${doc.querySelector('meta[name=description]')?.content||'-'}\nCOUNTS: `+['H1','H2','H3','H4','H5','H6'].map(h=>h+'='+doc.querySelectorAll(h).length).join(' ')+'\n'+lines.join('\n');
};
window.R=''; for(const p of PATHS){ try{ window.R+=await window.audit(p) }catch(e){ window.R+=`\n########## ${p} ERR ${e}` } }
window.R.length
```

Then dump it in chunks and read each chunk with `get_page_text`:

```js
window.show=txt=>{document.body.innerHTML='<main><article><pre id="dump"></pre></article></main>';document.getElementById('dump').textContent=txt};
const parts=window.R.split('\n########## ').slice(1);
window.show('########## '+parts.slice(0,5).join('\n\n########## ')); document.body.innerText.length
```

Drop noise lines before showing them if needed, for example grid-guide numbers, form checkbox labels and form success or error messages.

**Also check the global chrome.** Before removing the nav and footer, count headings inside them:

```js
[...document.querySelectorAll('nav h1,nav h2,nav h3,nav h4,header h1,header h2,header h3,footer h1,footer h2,footer h3,footer h4,[class*="nav"] :is(h1,h2,h3,h4),[class*="footer"] :is(h1,h2,h3,h4)')].map(h=>h.tagName+' '+h.textContent.trim().slice(0,40)).join('\n')||'none'
```

## 4. Section structure (for tricky pages)

Shows which headings share a `<section>`, and which sit inside tabs:

```js
const clean=s=>(s||'').replace(/\s+/g,' ').trim();
const secs=[...document.querySelectorAll('section, main > div')].filter(s=>s.querySelector('h1,h2,h3,h4')).filter((s,i,a)=>!a.some(o=>o!==s&&o.contains(s)));
secs.map((s,i)=>`S${i} [${(s.className+'').slice(0,30)}] #${s.id||'-'} :: `+[...s.querySelectorAll('h1,h2,h3,h4')].map(h=>h.tagName+' '+clean(h.innerText).slice(0,26)+(h.closest('.w-tab-pane')?' (tab '+h.closest('.w-tab-pane').getAttribute('data-w-tab')+')':'')).join(' / ')).join('\n')
```

Avoid output that looks like `id=` or `class=` pairs. The browser tool may block it as query-string data, so use `#id` and `[class]` formatting.

Take a screenshot (`computer` → screenshot, scale 0.5) after `scrollIntoView` on any heading whose visual role is unclear.

## 5. Verification (Step 6 of the skill)

Build the expected list from the data. Every row whose `cur` is H1–H6 becomes "Hn|text", in page order. Then compare it with the live pages:

```js
const EXP = { "/": ["H1|…","H2|…"], "/about": [ … ] };
const clean=s=>(s||'').replace(/\s+/g,' ').trim(); const rep=[];
for (const [path, exp] of Object.entries(EXP)) {
  const doc=new DOMParser().parseFromString(await (await fetch(path,{cache:'no-store'})).text(),'text/html');
  const act=[...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>h.tagName+'|'+clean(h.textContent));
  const same=act.length===exp.length&&act.every((a,i)=>a===exp[i]);
  if(same) rep.push('OK '+path+' ('+act.length+')'); else { const i=act.findIndex((a,k)=>a!==exp[k]); rep.push('DIFF '+path+' first@'+i+': '+(act[i]||'-')+' vs '+(exp[i]||'-')); }
}
rep.join('\n')
```

Check the "make heading" items too: confirm each listed text exists on its page as non-heading text (`div`, `p` or `span` whose trimmed text equals it exactly, not inside a heading). Fix the data until every page reports OK.
