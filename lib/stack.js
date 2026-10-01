// What a site runs on, as far as a visitor's browser can see: the platform, plugins, forms, chat, booking and other
// services it loads, and who hosts its DNS. Read from the pages the launch check opens; nothing is logged in to.
const dns = require('dns').promises;

// [name, kind, test on a script, frame or stylesheet address]
const SIGNS = [
  ['Webflow', 'Platform', /webflow\.com|website-files\.com|wdfl\.co/i], ['Shopify', 'Platform', /cdn\.shopify\.com|shopifycdn/i],
  ['Squarespace', 'Platform', /squarespace(-cdn)?\.com|sqspcdn/i], ['Wix', 'Platform', /wixstatic\.com|parastorage\.com/i],
  ['Framer', 'Platform', /framerusercontent\.com|framer\.com\/m\//i], ['WordPress', 'Platform', /\/wp-content\/|\/wp-includes\//i],
  ['HubSpot forms', 'Forms', /js\.hsforms\.net|forms\.hubspot\.com/i], ['Typeform', 'Forms', /typeform\.com/i], ['Jotform', 'Forms', /jotform/i],
  ['Google Forms', 'Forms', /docs\.google\.com\/forms/i], ['Tally', 'Forms', /tally\.so/i], ['Formspree', 'Forms', /formspree\.io/i],
  ['Mailchimp', 'Email marketing', /list-manage\.com|mailchimp/i], ['Klaviyo', 'Email marketing', /klaviyo/i], ['Kit (ConvertKit)', 'Email marketing', /convertkit|\bkit\.com\/|ck\.page/i],
  ['Calendly', 'Booking', /calendly\.com/i], ['Cal.com', 'Booking', /cal\.com\/embed/i], ['Acuity', 'Booking', /acuityscheduling/i],
  ['Intercom', 'Chat', /intercom(cdn)?\.io/i], ['Drift', 'Chat', /drift\.com|driftt\.com/i], ['Crisp', 'Chat', /crisp\.chat/i], ['Tidio', 'Chat', /tidio/i],
  ['Zendesk', 'Chat', /zdassets\.com|zopim/i], ['HubSpot', 'Marketing', /js\.hs-scripts\.com|js\.hs-analytics\.net|js\.hs-banner\.com|js\.hubspot\.com/i],
  ['YouTube', 'Embeds', /youtube(-nocookie)?\.com\/embed/i], ['Vimeo', 'Embeds', /player\.vimeo\.com/i], ['Google Maps', 'Embeds', /google\.com\/maps|maps\.googleapis/i],
  ['Google Fonts', 'Fonts', /fonts\.googleapis\.com|fonts\.gstatic\.com/i], ['Adobe Fonts', 'Fonts', /use\.typekit\.net/i],
  ['reCAPTCHA', 'Spam protection', /google\.com\/recaptcha|recaptcha\.net/i], ['hCaptcha', 'Spam protection', /hcaptcha\.com/i], ['Cloudflare Turnstile', 'Spam protection', /challenges\.cloudflare\.com/i],
  ['Stripe', 'Payments', /js\.stripe\.com/i], ['PayPal', 'Payments', /paypal\.com\/sdk/i],
  ['Finsweet Attributes', 'Webflow add-ons', /finsweet/i], ['Memberstack', 'Members', /memberstack/i], ['Outseta', 'Members', /outseta/i],
];
// Who answers for a domain's DNS, by its name servers.
const DNS_HOSTS = [[/cloudflare\.com$/i, 'Cloudflare'], [/awsdns/i, 'Amazon Route 53'], [/domaincontrol\.com$/i, 'GoDaddy'], [/registrar-servers\.com$/i, 'Namecheap'],
  [/googledomains\.com$|google\.com$/i, 'Google'], [/squarespacedns\.com$/i, 'Squarespace'], [/wixdns\.net$/i, 'Wix'], [/nsone\.net$/i, 'NS1'], [/dnsimple/i, 'DNSimple'],
  [/azure-dns/i, 'Azure'], [/digitalocean\.com$/i, 'DigitalOcean'], [/hover\.com$/i, 'Hover'], [/name\.com$/i, 'Name.com'], [/porkbun\.com$/i, 'Porkbun'],
  [/vercel-dns\.com$/i, 'Vercel'], [/netlify/i, 'Netlify'], [/dynect|oraclecloud/i, 'Oracle Dyn'], [/hostgator|bluehost|siteground|dreamhost/i, 'The web host']];

// WordPress plugin folders under their own names; others are tidied from the folder name.
const PLUGINS = { 'wordpress-seo': 'Yoast SEO', 'seo-by-rank-math': 'Rank Math', 'contact-form-7': 'Contact Form 7', gravityforms: 'Gravity Forms', 'wpforms-lite': 'WPForms',
  wpforms: 'WPForms', woocommerce: 'WooCommerce', elementor: 'Elementor', 'elementor-pro': 'Elementor Pro', js_composer: 'WPBakery', revslider: 'Slider Revolution',
  'wp-rocket': 'WP Rocket', 'litespeed-cache': 'LiteSpeed Cache', 'w3-total-cache': 'W3 Total Cache', jetpack: 'Jetpack', 'google-site-kit': 'Site Kit by Google',
  'ninja-forms': 'Ninja Forms', formidable: 'Formidable Forms', 'wp-super-cache': 'WP Super Cache', autoptimize: 'Autoptimize', 'complianz-gdpr': 'Complianz',
  'cookie-law-info': 'CookieYes', 'wpml-string-translation': 'WPML', 'sitepress-multilingual-cms': 'WPML', 'advanced-custom-fields': 'ACF', 'advanced-custom-fields-pro': 'ACF Pro' };
const pluginName = f => PLUGINS[f.toLowerCase()] || f.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const PLATFORMS = SIGNS.filter(x => x[1] === 'Platform').map(x => x[0]);
// "Elementor 3.21.5; features: ..." and "Powered by Slider Revolution 6.6" become "Elementor" and "Slider Revolution".
const tidy = g => g.split(';')[0].replace(/^powered by\s+/i, '').replace(/\s+(v(ersion)?\s?)?\d[\w.-]*.*$/i, '').replace(/\s+-\s.*$/, '').trim().slice(0, 40);

/** The services the pages load, from the addresses of their scripts, frames and stylesheets and their generator tags. */
function detect(pages) {
  const found = new Map();
  const add = (name, kind, path) => {
    const k = name.toLowerCase(), x = found.get(k) || { name, kind, pages: new Set() };
    if (kind === 'WordPress plugin') x.kind = kind;
    if (path) x.pages.add(path); found.set(k, x);
  };
  for (const pg of pages) {
    for (const u of pg.assets || []) {
      for (const [name, kind, re] of SIGNS) if (re.test(u)) add(name, kind, pg.path);
      const wp = u.match(/\/wp-content\/plugins\/([a-z0-9_-]+)\//i); if (wp) add(pluginName(wp[1]), 'WordPress plugin', pg.path);
    }
    for (const g of pg.generators || []) {
      const known = PLATFORMS.find(n => g.toLowerCase().startsWith(n.toLowerCase()));
      if (known) add(known, 'Platform', pg.path);
      else if (tidy(g)) add(tidy(g), 'Built with', pg.path);
    }
  }
  // On WordPress, other generator tags are plugins or the theme.
  const wp = found.has('wordpress');
  const order = ['Platform', 'WordPress plugin', 'Built with', 'Webflow add-ons', 'Forms', 'Booking', 'Chat', 'Email marketing', 'Marketing', 'Payments', 'Members', 'Spam protection', 'Embeds', 'Fonts'];
  return [...found.values()].map(x => ({ name: x.name, kind: wp && x.kind === 'Built with' ? 'WordPress plugin' : x.kind, pages: x.pages.size }))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name)).slice(0, 60);
}

/** The inventory as [label, text] rows for a document: services by kind, then DNS, the registrar and the certificate. */
function rows(st, renewals) {
  const out = [], by = new Map();
  for (const s of (st && st.services) || []) by.set(s.kind, [...(by.get(s.kind) || []), s.name]);
  const LABEL = { 'WordPress plugin': 'WordPress plugins', 'Built with': 'Built with', 'Webflow add-ons': 'Webflow add-ons' };
  for (const [kind, names] of by) out.push([LABEL[kind] || kind, names.join(', ')]);
  if (st && st.dns) out.push(['DNS', st.dns.host ? `${st.dns.host} (${st.dns.servers.slice(0, 2).join(', ')})` : st.dns.servers.slice(0, 2).join(', ')]);
  const r = renewals || {};
  if (r.domain && r.domain.registrar) out.push(['Domain registrar', r.domain.registrar]);
  if (r.ssl && r.ssl.issuer) out.push(['SSL certificate from', r.ssl.issuer]);
  return out;
}

/** Who hosts the domain's DNS, from its name servers. */
async function dnsHost(domain) {
  try {
    const ns = await dns.resolveNs(domain);
    // A domain can use two providers at once; the one with the most name servers is named.
    const count = new Map();
    for (const n of ns) { const hit = DNS_HOSTS.find(([re]) => re.test(n.replace(/\.$/, ''))); if (hit) count.set(hit[1], (count.get(hit[1]) || 0) + 1); }
    const host = [...count].sort((a, b) => b[1] - a[1])[0];
    return { host: host ? host[0] : null, servers: ns.sort().slice(0, 4) };
  } catch { return null; }
}

module.exports = { detect, dnsHost, rows };
