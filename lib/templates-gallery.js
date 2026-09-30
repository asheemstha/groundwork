// The template gallery: checklists for the common kinds of website work, written in Groundwork's own words from public
// guidance (credited in `basedOn`), and working on any platform. Every item says what done means.
//
// Each item: [title, who, extra]. extra: done (what done means), due ({ from: 'kickoff' | 'launch', days }), part
// (an optional part of the project), platforms (only on projects built with these), tool and check (what ticks it).
// `refSpan` is the kickoff-to-launch length the day offsets were written for; a project stretches them to its own dates.

const us = (t, x) => [t, 'us', x];
const client = (t, x) => [t, 'client', x];
const K = days => ({ from: 'kickoff', days });
const L = days => ({ from: 'launch', days });

const GOOGLE_MOVE = { label: 'Google Search Central: site moves with URL changes', url: 'https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes' };
const GOOGLE_SEO = { label: 'Google SEO Starter Guide', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' };
const WEBDEV = { label: 'web.dev: Core Web Vitals', url: 'https://web.dev/articles/vitals' };
const WCAG = { label: 'W3C: WCAG 2.2', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/' };
const WCAG_EASY = { label: 'W3C: Easy Checks', url: 'https://www.w3.org/WAI/test-evaluate/preliminary/' };

// ---------- pieces most website templates share ----------
const kickoff = () => us('Kickoff call with the client', { due: K(0), done: 'Everyone knows the goals, the dates, who approves what and how feedback is sent.' });
const goals = baseline => us(baseline ? 'Goals and success metrics agreed, each with a baseline' : 'Goals and success metrics agreed', { done: baseline ? 'Two or three measurable goals, like leads or calls booked, each with today’s number from analytics.' : 'Two or three measurable goals, like leads or calls booked, with a target for each.' });
const sitemap = () => us('Sitemap and content plan: every page, who writes it and by when', { done: 'A page list the client has seen, with a writer and a due date for each page’s copy.' });
const brandFiles = () => client('Brand files: logo, fonts, colours and photos', { due: K(5), done: 'Logo files (SVG), fonts with a web licence, the brand colours and photos you’re allowed to use.' });
const toolsToConnect = () => client('Tools to connect: CRM, email, booking', { part: 'integrations', due: K(7), done: 'The names of the tools the site sends data to. Logins can come later.' });
const designGroup = () => ['Our process', [
  us('Wireframes for the key pages', { due: K(21), done: 'Layouts for the home page and each type of page, before final visuals.' }),
  us('Visual direction approved before designing every page', { due: K(24), done: 'The client has approved one page in full design, so the rest follow the same look.' }),
  us('Every page designed for desktop and mobile', { due: K(36), done: 'Each page in the sitemap has a desktop and a mobile design with real or near-final content.' }),
  us('Heading structure and SEO for each page, marked in the designs', { due: K(36), done: 'Each page shows its H1 and subheadings, and has a title and description to use.' }),
]];
const designClient = () => ['Needed from client', [
  client('Final content, by the dates in the content plan', { due: K(26), done: 'Copy for every page is in, in one shared document or folder.' }),
  client('Feedback in one reply per review round', { due: K(30), done: 'One person sends one set of comments per round, within the agreed number of days.' }),
]];
const designHandoff = () => ({ title: 'Designs approved', needs: 'client', items: [us('Final designs for every page, with the approved content', { done: 'The client has approved the final designs in writing.' })] });
// Platform steps that only show on projects built with that platform.
const platformSteps = () => [
  us('Webflow: site plan paid for, and the site in the client’s workspace or ready to transfer', { platforms: ['webflow'], done: 'The client owns the hosting, and you know how the site moves to their workspace.' }),
  us('WordPress: theme and plugins updated, backups and a security plugin set up', { platforms: ['wordpress'], done: 'Everything is on its latest version, a backup runs on a schedule, and logins are protected.' }),
  us('Framer: site plan and custom domain set up', { platforms: ['framer'], done: 'The plan is paid for and the custom domain is ready to connect on launch day.' }),
  us('Squarespace: site plan active, and the site no longer private', { platforms: ['squarespace'], done: 'The plan is paid for and visitors can open the site without a password.' }),
  us('Wix: Premium plan active and the domain connected', { platforms: ['wix'], done: 'The site runs on the client’s domain with no Wix ads.' }),
];
const buildCore = () => [
  us('Staging site hidden from search engines', { due: K(42), done: 'Staging has a password or a noindex tag, so Google doesn’t list it.' }),
  us('Pages and CMS built, content entered', { done: 'Every page in the sitemap is on staging with its final content.' }),
  us('Old blog posts or CMS items moved over', { part: 'content', done: 'Every old post or item you’re keeping is on staging, with its images and, where possible, the same URL.' }),
  us('Forms: spam protection, the right recipients, a clear success message', { done: 'Each form sends to the right inbox or CRM and shows a message when it’s sent.' }),
  us('Integrations connected', { part: 'integrations', done: 'Test data reaches each connected tool.' }),
  us('Analytics and conversions set up, with cookie consent where it’s required', { done: 'A test visit and a test form submission show up in analytics, and nothing tracks before consent where the law asks for it.' }),
  us('Helpful 404 page, with links to the main sections', { done: 'A missing page shows a friendly page with a way back, and returns a real 404 status.' }),
  us('Heading plan on staging: every tag fix done', { tool: 'headings', done: 'Scan staging, plan the headings, and work through the tag fixes. This ticks itself when they’re all done.' }),
  us('SEO plan on staging: a title, description and URL for every page', { tool: 'seo', check: 'plan', done: 'This ticks itself once an SEO plan covers every page the scan read.' }),
  us('SEO in place: titles, descriptions, share images, alt text', { tool: 'seo', check: 'live', done: 'The planned titles and descriptions are on the pages, share images are set and images have alt text.' }),
];
const buildClient = () => ['Needed from client', [
  client('Review of pages as they’re shared', { done: 'The client has looked at each page on staging and sent their comments.' }),
  client('Privacy policy and terms text, or who writes it', { due: L(-14), done: 'The legal text is ready to publish. The client or their lawyer owns the wording.' }),
]];
const buildHandoff = what => ({ title: `${what} approved on staging`, needs: 'client', items: [us('Staging link with every page done, and a list of known issues', { done: 'The client has approved staging in writing and knows what will be fixed after launch.' })] });
const launchChecks = () => [
  us('No placeholder text, images or dummy “#” links left', { tool: 'launch', check: 'placeholders', due: L(-5), done: 'The launch check finds no placeholder text, placeholder images or links to “#”.' }),
  us('All links and buttons work', { tool: 'launch', check: 'links', due: L(-5), done: 'The launch check finds no broken links.' }),
  us('Titles, meta descriptions and one H1 on every page', { tool: 'launch', check: 'seo', due: L(-4), done: 'The launch check finds a title, a description and exactly one H1 on every page.' }),
  us('Canonicals point to the live domain', { tool: 'launch', check: 'canonicals', due: L(-4), done: 'Every page’s canonical tag uses the live domain, not staging.' }),
  us('Privacy policy and terms linked in the footer', { tool: 'launch', check: 'legal', due: L(-5), done: 'The launch check finds working links to the legal pages on every page.' }),
  us('Every form submitted once and received', { due: L(-5), done: 'Each form was sent from staging, and the message arrived where it should.' }),
  us('Accessibility check: keyboard only, colour contrast, alt text', { due: L(-4), done: 'Every page works with the keyboard alone, text passes a contrast check and images have alt text.' }),
  us('Tested on a real phone and in the main browsers', { due: L(-4), done: 'Checked on an iPhone and an Android phone, and in Chrome, Safari and Firefox.' }),
];
const publish = () => us('Publish, then check SSL and the www and https redirects', { tool: 'launch', check: 'https', due: L(0), done: 'The launch check of the live domain finds a valid certificate, and every address version lands on one https domain.' });
const indexing = () => us('Search engines allowed: no noindex, robots.txt open', { tool: 'launch', check: 'indexing', due: L(0), done: 'The live site has no noindex tag and no password, and robots.txt doesn’t block any page.' });
const dns = () => us('DNS change ready: TTL lowered a day ahead, email records (MX, SPF, DKIM) kept', { due: L(-1), done: 'The DNS change is ready and doesn’t touch the records that deliver the client’s email.' });
const sitemapSubmitted = () => us('Sitemap submitted in Search Console', { due: L(0), done: 'Search Console shows the new sitemap as submitted.' });
const goLive = () => client('Go-live approval and date', { due: L(-4), done: 'The client has confirmed the launch date in writing.' });
const handover = () => ({ title: 'Site live, handed over', needs: 'client', items: [us('CMS training, and every login handed over', { done: 'The client can edit the site on their own and has the logins to everything.' })] });
const checkIn = () => us('30-day check-in: results against the goals', { due: L(30), done: 'A short note comparing the first month with the goals, sent to the client.' });

const PARTS = {
  content: { id: 'content', name: 'Moving old content', desc: 'Blog posts or CMS items to migrate' },
  integrations: { id: 'integrations', name: 'Integrations', desc: 'CRM, booking, email marketing' },
  local: { id: 'local', name: 'A local business', desc: 'Google Business Profile, address and opening hours' },
  moving: { id: 'moving', name: 'Moving from another store', desc: 'Products, customers and orders to bring over' },
  domain: { id: 'domain', name: 'Changing the domain', desc: 'Search Console Change of Address and old domain variants' },
};

// ---------- the templates ----------
const REDESIGN = {
  id: 'website-lean', name: 'Website redesign', refSpan: 70,
  desc: 'Replace an existing site without losing its search traffic: old URLs saved, redirects mapped and tested, launch checked.',
  basedOn: [GOOGLE_MOVE, GOOGLE_SEO],
  parts: [PARTS.content, PARTS.integrations],
  phases: [
    { id: 'discover', name: 'Discover', due: K(14), groups: [
      ['Our process', [
        kickoff(), goals(true),
        us('Crawl the current site and save the full URL list (for redirects later)', { tool: 'scan', due: K(3), done: 'Every page on the current site is listed, so nothing is lost when URLs change.' }),
        us('Top pages and backlinks to protect, from analytics and Search Console', { due: K(7), done: 'A short list of the pages that bring the most visits and links, so they keep their URL or get a redirect.' }),
        us('Content inventory: mark every page keep, rewrite, merge or remove', { done: 'Each old page has a decision, and the ones you keep have a place in the new sitemap.' }),
        sitemap(),
      ]],
      ['Needed from client', [
        client('Access to the domain, analytics and Search Console', { due: K(5), done: 'You can log in to the domain’s DNS, Google Analytics and Search Console, shared through a password manager.' }),
        client('Access to the current site’s CMS and hosting', { due: K(3), done: 'You can log in to the old site, so you can export content and set up redirects.' }),
        brandFiles(), toolsToConnect(),
      ]],
    ], handoff: { title: 'Discovery approved', needs: 'client', items: [us('Sitemap and content plan, shared with the client', { done: 'The client has the page list and the content plan, and has replied to approve them.' })] } },
    { id: 'design', name: 'Design', due: K(40), groups: [designGroup(), designClient()], handoff: designHandoff() },
    { id: 'build', name: 'Build', due: L(-14), groups: [
      ['Our process', [...buildCore(), us('Redirect map: each old URL points to its closest new page', { tool: 'redirects', check: 'map', done: 'Every old URL has a new page you’re happy with.' })]],
      ['On this platform', platformSteps()],
      buildClient(),
    ], handoff: buildHandoff('Build') },
    { id: 'launch', name: 'Launch', due: L(0), groups: [
      ['Before launch', [
        us('Scan the old site again, for pages added since kickoff', { tool: 'scan', check: 'recrawl', due: L(-7), done: 'A fresh URL list, so new pages get redirects too. This ticks itself when the old site is scanned in the 10 days before launch.' }),
        us('Back up the old site before its hosting ends', { due: L(-5), done: 'An export of the old site’s pages, files and form entries, saved where the client can reach it.' }),
        ...launchChecks(),
      ]],
      ['Launch day', [dns(), publish(), indexing(),
        us('301 redirects live and tested', { tool: 'redirects', check: 'live', due: L(0), done: 'A test of the live domain finds every old URL redirects once, with a 301, to the right page.' }),
        sitemapSubmitted()]],
      ['Needed from client', [goLive()]],
    ], handoff: handover() },
    { id: 'after', name: 'After launch', due: L(30), groups: [
      ['Our process', [
        us('Days 1 to 3: check 404s and redirects', { tool: 'redirects', check: 'after', due: L(3), done: 'A redirect test after launch day passes, and Search Console shows no new 404s.' }),
        us('Week 1: leads arriving and analytics look right', { due: L(7), done: 'Form entries arrive and the analytics numbers look normal.' }),
        us('Weeks 2 to 4: indexing and search traffic against the baseline', { due: L(28), done: 'Search Console shows the new pages indexed, and search traffic is back near the baseline.' }),
        us('Redirects kept for at least a year', { due: L(30), done: 'Everyone knows not to remove the redirects for a year, and there’s a reminder to review them.' }),
        checkIn(),
      ]],
    ], handoff: { title: 'Project closed', needs: 'us', items: [] } },
  ],
};

const NEW_SITE = {
  id: 'website-new', name: 'New website', refSpan: 70,
  desc: 'A site for a business that doesn’t have one yet, or starts fresh on a new domain: from the brief to indexed in Google.',
  basedOn: [GOOGLE_SEO, WEBDEV],
  parts: [PARTS.content, PARTS.integrations, PARTS.local],
  phases: [
    { id: 'discover', name: 'Discover', due: K(14), groups: [
      ['Our process', [kickoff(), goals(false), sitemap()]],
      ['Needed from client', [
        client('Access to the domain, or the name they want to buy', { due: K(5), done: 'You can log in to the domain’s DNS, or the client has bought the domain.' }),
        brandFiles(), toolsToConnect(),
        client('Business details: address, phone and opening hours', { part: 'local', due: K(7), done: 'The details exactly as they should appear on the site and on Google.' }),
      ]],
    ], handoff: { title: 'Discovery approved', needs: 'client', items: [us('Sitemap and content plan, shared with the client', { done: 'The client has the page list and the content plan, and has replied to approve them.' })] } },
    { id: 'design', name: 'Design', due: K(40), groups: [designGroup(), designClient()], handoff: designHandoff() },
    { id: 'build', name: 'Build', due: L(-14), groups: [
      ['Our process', [...buildCore(), us('Site title, favicon and share image set', { done: 'The browser tab, bookmarks and link previews show the right name and images.' })]],
      ['On this platform', platformSteps()],
      buildClient(),
    ], handoff: buildHandoff('Build') },
    { id: 'launch', name: 'Launch', due: L(0), groups: [
      ['Before launch', [...launchChecks(),
        us('Speed checked against Core Web Vitals on key pages', { due: L(-4), done: 'Key pages load their main content in 2.5 seconds or less, respond to taps in 200 ms or less, and don’t shift around.' })]],
      ['Launch day', [
        us('Domain connected and the primary domain set', { due: L(0), done: 'The site answers on the domain, and one version (with or without www) is the main one.' }),
        publish(), indexing(),
        us('Search Console verified and the sitemap submitted', { due: L(0), done: 'The domain is verified in Search Console and the sitemap shows as submitted.' }),
        us('Google Business Profile points to the new site', { part: 'local', due: L(1), done: 'The profile’s website link, details and hours match the site.' }),
      ]],
      ['Needed from client', [goLive()]],
    ], handoff: handover() },
    { id: 'after', name: 'After launch', due: L(30), groups: [
      ['Our process', [
        us('Week 1: leads arriving and analytics look right', { due: L(7), done: 'Form entries arrive and the analytics numbers look normal.' }),
        us('Weeks 2 to 4: pages indexed in Search Console', { due: L(28), done: 'Search Console shows the main pages indexed, with no errors to fix.' }),
        checkIn(),
      ]],
    ], handoff: { title: 'Project closed', needs: 'us', items: [] } },
  ],
};

const STORE = {
  id: 'store', name: 'Online store', refSpan: 70, labels: { launch: 'Store opens' },
  desc: 'A shop on Shopify, WooCommerce or another platform: products, payments, tax, shipping and policies, then test orders before it opens.',
  basedOn: [{ label: 'Shopify Help Center: prepare to launch', url: 'https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/setup-prepare-for-launch' }, { label: 'WooCommerce: store launch checklist', url: 'https://woocommerce.com/posts/ecommerce-website-launch-checklist/' }],
  parts: [PARTS.moving, PARTS.integrations],
  phases: [
    { id: 'discover', name: 'Discover', due: K(14), groups: [
      ['Our process', [
        kickoff(), goals(false),
        us('Crawl the current store and save the full URL list', { part: 'moving', tool: 'scan', due: K(3), done: 'Every product, collection and page URL is listed, so redirects can be made later.' }),
        us('Catalogue plan: collections, variants and how products get in', { done: 'You know how products are grouped, which options they have, and whether they’re imported or entered by hand.' }),
        sitemap(),
      ]],
      ['Needed from client', [
        client('Business details: legal name, address, currency and store email', { due: K(5), done: 'The details the store, invoices and emails need.' }),
        brandFiles(),
        client('Payment account set up in the client’s name, with payout bank details', { due: K(10), done: 'The client has their own payment provider account and it can pay out to their bank.' }),
        client('Shipping rules: zones, rates, carriers and free-shipping threshold', { due: K(10), done: 'Where the store ships, what it costs, and when shipping is free.' }),
        client('Tax registrations for each region, confirmed with their accountant', { due: K(10), done: 'Which taxes to charge where, in writing from the client or their accountant.' }),
        client('Access to the current store', { part: 'moving', due: K(3), done: 'You can export products, customers and orders from the old store.' }),
      ]],
    ], handoff: { title: 'Store plan approved', needs: 'client', items: [us('Catalogue, payments, shipping and tax plan, shared with the client', { done: 'The client has approved how the store will sell, ship and charge tax.' })] } },
    { id: 'design', name: 'Design', due: K(40), groups: [
      ['Our process', [
        us('Wireframes for home, collection, product and cart pages', { due: K(21), done: 'Layouts for each type of store page, before final visuals.' }),
        us('Visual direction approved before designing every page', { due: K(24), done: 'The client has approved one page in full design, so the rest follow the same look.' }),
        us('Every page type designed for desktop and mobile', { due: K(36), done: 'Home, collections, product, cart and content pages each have a desktop and a mobile design.' }),
      ]],
      ['Needed from client', [
        client('Product data: titles, descriptions, prices, variants, stock and images', { due: K(30), done: 'Every product is ready to import, with photos you’re allowed to use.' }),
        client('Store policies: refunds, shipping, privacy and terms', { due: K(30), done: 'The policy text is ready to publish. The client or their lawyer owns the wording.' }),
      ]],
    ], handoff: designHandoff() },
    { id: 'build', name: 'Build', due: L(-14), groups: [
      ['Our process', [
        us('Store theme and pages built, products imported', { done: 'Every page and product is on the staging store.' }),
        us('Products checked: titles, prices, variants, images and stock', { done: 'A second look at every product finds nothing wrong.' }),
        us('Payments connected and paying out to the right account', { done: 'The payment provider is live on the store and shows the client’s bank for payouts.' }),
        us('Taxes set for each region, as the client’s accountant advised', { done: 'Test carts in each region show the right tax.' }),
        us('Shipping rates checked with sample addresses in each zone', { done: 'Test carts to an address in each zone show the right rates.' }),
        us('Policies published and linked: refunds, shipping, privacy, terms', { done: 'Each policy has its own page, linked from the footer and checkout.' }),
        us('Order emails branded, and the sending domain has SPF and DKIM records', { done: 'Order and shipping emails carry the brand and don’t land in spam.' }),
        us('Analytics and store tracking set up, with cookie consent where it’s required', { done: 'Test purchases show up in analytics, and nothing tracks before consent where the law asks for it.' }),
        us('Products, customers and orders moved from the old store', { part: 'moving', done: 'The old store’s data is in the new one, checked against the old counts.' }),
        us('Redirect map: each old URL points to its closest new page', { part: 'moving', tool: 'redirects', check: 'map', done: 'Every old product and collection URL has a new page you’re happy with.' }),
        us('SEO plan on staging: titles and descriptions for every page', { tool: 'seo', check: 'plan', done: 'This ticks itself once an SEO plan covers every page the scan read.' }),
        us('Integrations connected', { part: 'integrations', done: 'Test orders reach each connected tool.' }),
      ]],
      buildClient(),
    ], handoff: buildHandoff('Store') },
    { id: 'launch', name: 'Launch', due: L(0), groups: [
      ['Before launch', [
        us('Test orders: a success, a failed payment, a discount code, a refund and a cancellation', { due: L(-5), done: 'Each one behaves as it should, and stock and totals are right afterwards.' }),
        us('Test orders on a phone and a computer, signed in and as a guest', { due: L(-5), done: 'Checkout works everywhere a customer might use it.' }),
        us('Every order email arrives', { due: L(-5), done: 'Confirmation, shipping and refund emails reach the inbox, not spam.' }),
        ...launchChecks().filter(x => !/form submitted/i.test(x[0])),
      ]],
      ['Launch day', [
        us('Payment test mode off, and the store password or coming-soon page removed', { due: L(0), done: 'A real customer can open the store and pay.' }),
        publish(), indexing(),
        us('301 redirects live and tested', { part: 'moving', tool: 'redirects', check: 'live', due: L(0), done: 'A test of the live domain finds every old URL redirects once, with a 301, to the right page.' }),
        us('Admin accounts use two-factor sign-in', { due: L(0), done: 'Everyone with access to the store’s admin signs in with a second step.' }),
        us('A real order placed and refunded on the live store', { due: L(1), done: 'A small real payment went through and came back, end to end.' }),
        sitemapSubmitted(),
      ]],
      ['Needed from client', [goLive()]],
    ], handoff: { title: 'Store open, handed over', needs: 'client', items: [us('Training on orders, products and refunds, and every login handed over', { done: 'The client can run the store on their own.' })] } },
    { id: 'after', name: 'After launch', due: L(30), groups: [
      ['Our process', [
        us('Days 1 to 3: check 404s and redirects', { part: 'moving', tool: 'redirects', check: 'after', due: L(3), done: 'A redirect test after launch day passes, and Search Console shows no new 404s.' }),
        us('Week 1: orders, payouts and emails working', { due: L(7), done: 'Real orders came in, the first payout arrived, and customers got their emails.' }),
        us('30-day check-in: sales and conversion against the goals', { due: L(30), done: 'A short note on the first month’s orders and conversion, sent to the client.' }),
      ]],
    ], handoff: { title: 'Project closed', needs: 'us', items: [] } },
  ],
};

const LANDING = {
  id: 'landing', name: 'Landing page or campaign', refSpan: 21, labels: { launch: 'Goes live' },
  desc: 'One page for an ad, email or launch campaign: the message matches the ad, the form and tracking work, and it has an end date.',
  basedOn: [{ label: 'Google Ads: landing page experience', url: 'https://support.google.com/google-ads/answer/6238826' }, { label: 'Google Analytics: campaign URLs', url: 'https://support.google.com/analytics/answer/10917952' }],
  parts: [],
  phases: [
    { id: 'plan', name: 'Plan', due: K(5), groups: [
      ['Our process', [
        us('Brief agreed: the offer, who it’s for and the one action the page asks for', { due: K(0), done: 'One sentence each for the offer, the audience and the action.' }),
        us('Where visitors come from, and what each ad or email promises', { due: K(2), done: 'A list of the traffic sources and the promise each one makes, so the page can keep it.' }),
        us('Tracking plan: the conversion event and a UTM-tagged link for each source', { due: K(5), done: 'Every link to the page has utm_source, utm_medium and utm_campaign, and you know which event counts as a conversion.' }),
      ]],
      ['Needed from client', [client('Copy, offer details and images', { due: K(5), done: 'Everything the page says and shows, approved by the client.' })]],
    ], handoff: { title: 'Plan approved', needs: 'client', items: [] } },
    { id: 'build', name: 'Build', due: L(-3), groups: [
      ['Our process', [
        us('Page designed and built for phones first', { done: 'The page reads well and works on a phone before it’s polished for desktop.' }),
        us('The headline matches what the ad or email promised', { done: 'Someone arriving from each source sees the promise they clicked on.' }),
        us('Form sends to the CRM or inbox, thanks the visitor, and has spam protection', { done: 'A test submission arrives where it should and the visitor sees a thank-you message.' }),
        us('Conversion event fires, with consent where it’s required', { done: 'A test submission shows up as a conversion, and nothing tracks before consent where the law asks for it.' }),
        us('Fast on a phone: Core Web Vitals checked', { done: 'The main content shows in 2.5 seconds or less and nothing shifts while it loads.' }),
        us('Search engines: indexed or noindex, decided on purpose', { done: 'Campaign-only pages carry noindex; pages meant for search have a canonical and a title.' }),
        us('Quick accessibility check: contrast, form labels, keyboard', { done: 'Text is readable, every field has a label, and the form works with the keyboard.' }),
      ]],
      ['Needed from client', [client('Review and approve the page', { due: L(-3), done: 'The client has approved the page in writing.' })]],
    ], handoff: { title: 'Page approved', needs: 'client', items: [] } },
    { id: 'launch', name: 'Live and measured', due: L(14), groups: [
      ['Our process', [
        us('No placeholder text or dummy links', { tool: 'launch', check: 'placeholders', due: L(-1), done: 'The launch check finds no placeholder text or links to “#”.' }),
        us('All links and buttons work', { tool: 'launch', check: 'links', due: L(-1), done: 'The launch check finds no broken links.' }),
        publish(),
        us('A test visit from each source’s link arrives with its UTM tags', { due: L(0), done: 'Analytics shows each test visit under the right source and campaign.' }),
        us('First results after a week: visits, conversion rate and cost per lead', { due: L(7), done: 'A short note to the client with the first week’s numbers.' }),
        us('End date decided: redirect or update the page when the campaign ends', { due: L(14), done: 'Everyone knows what happens to the page, and when.' }),
      ]],
    ], handoff: { title: 'Campaign wrapped', needs: 'us', items: [] } },
  ],
};

const MIGRATION = {
  id: 'migration', name: 'SEO site migration', refSpan: 42, labels: { launch: 'Migration day' },
  desc: 'Moving a site to a new domain or platform while keeping its rankings: benchmark, map every URL, launch, then watch for weeks.',
  basedOn: [GOOGLE_MOVE, { label: 'Search Console Help: Change of Address', url: 'https://support.google.com/webmasters/answer/9370220' }],
  parts: [PARTS.domain],
  phases: [
    { id: 'prepare', name: 'Prepare', due: K(14), groups: [
      ['Our process', [
        us('Kickoff: the old and new domains or platforms, the date, and who owns DNS', { due: K(0), done: 'Everyone knows what moves where, when, and who can change DNS.' }),
        us('Crawl the old site and save every URL', { tool: 'scan', due: K(2), done: 'Every URL on the old site is listed.' }),
        us('Top pages from analytics and Search Console, and the sites that link to them most', { due: K(5), done: 'A list of the pages and links that matter most, so they’re checked first.' }),
        us('Benchmark saved: traffic, rankings for key terms and conversions, with dates', { due: K(5), done: 'Numbers from before the move, to compare with after.' }),
        us('Old and new sites verified in Search Console', { due: K(7), done: 'Both are verified, and verification tags or files will survive the move.' }),
      ]],
      ['Needed from client', [client('Access to DNS, analytics, Search Console and both platforms', { due: K(3), done: 'You can log in to everything the move touches.' })]],
    ], handoff: { title: 'Migration plan approved', needs: 'client', items: [us('URL inventory and benchmark, shared with the client', { done: 'The client has seen what moves and the numbers you’ll compare against.' })] } },
    { id: 'map', name: 'Map', due: L(-7), groups: [
      ['Our process', [
        us('Redirect map: every old URL to its closest new page, one to one', { tool: 'redirects', check: 'map', done: 'Every old URL has a new page you’re happy with. None go to the home page by default.' }),
        us('No redirect chains: each old URL reaches its final page in one step', { done: 'A test shows one redirect per old URL, never a chain or a loop.' }),
        us('Canonicals, internal links and hreflang use the new URLs', { done: 'The new site never points back at old addresses.' }),
        us('New robots.txt and sitemap ready', { done: 'robots.txt allows crawling and the sitemap lists only new URLs.' }),
        us('The server can handle the extra crawling after launch', { done: 'For self-hosted sites, the host knows a crawl spike is coming.' }),
      ]],
    ], handoff: { title: 'Redirect map approved', needs: 'client', items: [] } },
    { id: 'launch', name: 'Migration day', due: L(0), groups: [
      ['Our process', [
        us('Redirects live and tested', { tool: 'redirects', check: 'live', due: L(0), done: 'A test of the live domain finds every old URL redirects once, with a 301, to the right page.' }),
        indexing(),
        us('Canonicals point to the live domain', { tool: 'launch', check: 'canonicals', due: L(0), done: 'Every page’s canonical tag uses the new live domain.' }),
        us('New sitemap submitted in Search Console', { due: L(0), done: 'Search Console shows the new sitemap as submitted.' }),
        us('Change of Address filed for every old domain version', { part: 'domain', due: L(0), done: 'Filed in Search Console for the old domain with and without www, and any old subdomains.' }),
        us('Ads, social profiles and important links updated to the new URLs', { due: L(2), done: 'Paid ads, profiles and the top linking sites you control point to the new pages.' }),
      ]],
    ], handoff: { title: 'Migration live', needs: 'us', items: [] } },
    { id: 'watch', name: 'Watch', due: L(60), groups: [
      ['Our process', [
        us('Days 1 to 3: check 404s and redirects', { tool: 'redirects', check: 'after', due: L(3), done: 'A redirect test after migration day passes, and Search Console shows no new 404s.' }),
        us('Week 1: indexing and crawl errors in Search Console', { due: L(7), done: 'New pages are being indexed and crawl errors are fixed.' }),
        us('Week 4: traffic and rankings against the benchmark', { due: L(28), done: 'A short note to the client comparing the numbers, with anything to fix.' }),
        us('Redirects kept for at least a year', { due: L(60), done: 'Everyone knows not to remove the redirects for a year, and there’s a reminder to review them.' }),
      ]],
    ], handoff: { title: 'Migration closed', needs: 'us', items: [] } },
  ],
};

const ACCESSIBILITY = {
  id: 'accessibility', name: 'Accessibility pass', refSpan: 21, labels: { launch: 'Deadline' },
  desc: 'Check a site against WCAG 2.2 AA, fix what fails and confirm it. Meeting 2.2 AA also meets 2.0 and 2.1 AA, which AODA and ADA Title II point to.',
  basedOn: [WCAG, WCAG_EASY],
  parts: [],
  phases: [
    { id: 'check', name: 'Check', due: K(7), groups: [
      ['Our process', [
        us('Scope agreed: which pages and templates, against WCAG 2.2 AA', { due: K(0), done: 'A list of the pages and page types to check, and the standard, agreed with the client.' }),
        us('Page titles say what each page is', { done: 'WCAG 2.4.2. Each title names the page and the site.' }),
        us('Images have useful alt text; decorative images have empty alt', { done: 'WCAG 1.1.1. Alt text says what an image means, not what file it is.' }),
        us('Headings, landmarks and a skip link are in place', { done: 'WCAG 1.3.1 and 2.4.1. Headings follow the page’s outline, and keyboard users can skip the menu.' }),
        us('Text contrast at least 4.5:1, and controls and focus rings at least 3:1', { done: 'WCAG 1.4.3 and 1.4.11. Large text can go down to 3:1.' }),
        us('Everything works with the keyboard, in a sensible order, with no traps', { done: 'WCAG 2.1.1, 2.1.2 and 2.4.3. Menus, forms, sliders and pop-ups included.' }),
        us('Focus is always visible, and not hidden by sticky headers or cookie banners', { done: 'WCAG 2.4.7 and 2.4.11.' }),
        us('Form fields have labels, errors are explained in words, personal fields use autocomplete', { done: 'WCAG 3.3.1, 3.3.2 and 1.3.5.' }),
        us('Buttons and links are at least 24 by 24 pixels, or spaced apart', { done: 'WCAG 2.5.8.' }),
        us('Pages work at 200% zoom and at 320 pixels wide', { done: 'WCAG 1.4.4 and 1.4.10. Nothing is cut off and nothing scrolls sideways.' }),
        us('Moving content can be paused, nothing flashes, videos have captions', { done: 'WCAG 2.2.2, 2.3.1 and 1.2.2.' }),
      ]],
    ], handoff: { title: 'Findings shared', needs: 'client', items: [us('List of issues by page and severity, shared with the client', { done: 'The client knows what fails and what it takes to fix.' })] } },
    { id: 'fix', name: 'Fix', due: L(-5), groups: [
      ['Our process', [
        us('Issues fixed, most severe first', { done: 'Every issue on the list is fixed or has an agreed reason to wait.' }),
        us('Accessibility statement published, with a way to report problems', { done: 'A page says what standard the site aims for and how to get help.' }),
      ]],
      ['Needed from client', [client('Content fixes the client owns: alt text for their images, captions for their videos', { done: 'The client’s own content passes the same checks.' })]],
    ], handoff: { title: 'Fixes done', needs: 'us', items: [] } },
    { id: 'confirm', name: 'Confirm', due: L(0), groups: [
      ['Our process', [
        us('Every fixed issue tested again', { done: 'Each fix is checked the same way the issue was found.' }),
        us('Main journeys tested with a screen reader', { done: 'VoiceOver on a Mac or iPhone gets through the key tasks, like contact and checkout.' }),
      ]],
    ], handoff: { title: 'Accessibility pass signed off', needs: 'client', items: [] } },
  ],
};

const CARE = {
  id: 'care', name: 'Monthly care plan', refSpan: 28, repeat: 'monthly', labels: { kickoff: 'Month starts', launch: 'Report due' },
  desc: 'The recurring checks for a site you look after: backups, updates, security, forms, speed and Search Console, then a short report. Starts again each month.',
  basedOn: [{ label: 'WordPress Advanced Administration Handbook', url: 'https://developer.wordpress.org/advanced-administration/security/backup/' }, GOOGLE_SEO],
  parts: [],
  phases: [
    { id: 'month', name: 'This month', due: L(0), groups: [
      ['Our process', [
        us('Backups ran, and a test restore works from a copy stored elsewhere', { due: K(2), done: 'You restored a recent backup somewhere safe and the site worked.' }),
        us('Updates applied after a backup: platform, theme, plugins or apps', { due: K(7), done: 'Everything is on its latest version and the site still works.' }),
        us('Security: scan run, old admin accounts removed, two-factor sign-in on', { due: K(7), done: 'No warnings, no one has access who shouldn’t, and every admin uses a second step.' }),
        us('Uptime alerts reviewed', { due: K(10), done: 'Any downtime this month is explained.' }),
        us('Every form tested, and a test checkout on stores', { due: K(10), done: 'Each form and the checkout work end to end.' }),
        us('Broken links fixed', { tool: 'launch', check: 'links', due: K(14), done: 'A launch check this month finds no broken links.' }),
        us('Speed checked against Core Web Vitals', { due: K(14), done: 'Key pages still meet the targets, or the report says what to do about it.' }),
        us('Search Console checked: indexing, manual actions and security issues', { due: K(14), done: 'No new errors, or they’re fixed.' }),
        us('Domain, SSL and hosting renewals coming up flagged', { due: K(14), done: 'Anything that renews in the next two months is on the client’s radar.' }),
        us('Privacy policy still matches the tools installed', { due: K(14), done: 'Every tracking or marketing tool on the site is covered.' }),
        us('Short report sent: what was done, traffic, and anything to decide', { due: L(0), done: 'The client has a one-page summary of the month.' }),
      ]],
    ], handoff: { title: 'Month closed', needs: 'us', items: [] } },
  ],
};

module.exports = { GALLERY: [REDESIGN, NEW_SITE, STORE, LANDING, MIGRATION, ACCESSIBILITY, CARE] };
