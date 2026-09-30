// Website platforms for the server: which addresses are staging, and which platform a site or scan belongs to.
// The data lives in shared/platforms.json so the app uses the same list.
const data = require('../shared/platforms.json');

const LIST = data.list.map(p => ({ ...p, re: p.staging.map(s => new RegExp(s, 'i')) }));
const byId = id => LIST.find(p => p.id === id) || null;
const clean = host => String(host || '').toLowerCase().replace(/^www\./, '');

/** True when the address is a platform's staging or preview address, like *.webflow.io or *.myshopify.com. */
const isStaging = host => { const h = clean(host); return !!h && LIST.some(p => p.re.some(r => r.test(h))); };
/** The platform a staging or preview address belongs to, if it's one we know. */
const ofHost = host => { const h = clean(host); return (LIST.find(p => p.re.some(r => r.test(h))) || {}).id || null; };
/** The platform id for what a scan detected ("Webflow", "WordPress", ... or "Other"). */
const ofScan = name => data.detect[name] || null;

module.exports = { LIST, byId, isStaging, ofHost, ofScan };
