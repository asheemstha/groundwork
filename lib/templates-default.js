// The templates a new install starts with: a short website checklist, the full agency process, plus client messages
// and emails.
// Each item: [title, who, extra]. who is "us" or "client". extra can set part (optional part id), tool, due and done
// (what "done" means). Due dates are days from kickoff or launch; items without one use their phase's due date.

const PARTS = [
  { id: 'existing', name: 'Replacing an existing website', desc: 'Old URL list, content inventory, SEO audit, redirects' },
  { id: 'content', name: 'Moving old content', desc: 'Blog posts or CMS items to migrate' },
  { id: 'integrations', name: 'Integrations', desc: 'CRM, booking, email marketing' },
  { id: 'languages', name: 'More than one language', desc: 'Translation, language switcher, hreflang' },
  { id: 'payments', name: 'Online payments', desc: 'Test purchase, refunds, receipts' },
];

const us = (t, x) => [t, 'us', x];
const client = (t, x) => [t, 'client', x];

// Bump SEED when a checklist here changes, so an untouched copy updates.
const SEED = 7;

const PHASES = [
  {
    id: 'setup', name: 'Setup', due: { from: 'kickoff', days: 0 },
    groups: [
      ['Our process', [
        us('Contract signed: scope, page count, revision rounds, what’s out of scope', { due: { from: 'kickoff', days: -7 } }),
        us('Timeline with a date for each sign-off and each client review window'),
        us('Team and roles named: PM, design, dev, SEO, copy'),
        us('Workspace ready: Drive folder, Slack channel, task board, Figma file from the starter template'),
        us('Shared password vault for client logins (no credentials in chat or email)'),
      ]],
      ['Needed from client', [
        client('One decision-maker who can approve on schedule, plus a named backup'),
        client('Agreed feedback turnaround (e.g. 3 business days) and one channel for feedback'),
      ]],
    ],
    handoff: { title: 'Kickoff, confirmed', needs: 'us', items: [us('Kickoff meeting booked with an agenda')] },
  },
  {
    id: 'discover', name: 'Discover', due: { from: 'kickoff', days: 14 },
    groups: [
      ['Our process', [
        us('Kickoff and onboarding walkthrough', { due: { from: 'kickoff', days: 0 } }),
        us('Align on goals, audiences and success metrics (each metric with a baseline and a target)'),
        us('Review analytics: save a 12-month baseline of traffic, top pages and conversions'),
        us('Competitive analysis'),
        us('Crawl the current site and save the full URL list (for redirects later)', { part: 'existing', tool: 'scan', done: 'Every page on the current site is listed, so nothing is lost when URLs change.', due: { from: 'kickoff', days: 3 } }),
        us('Content inventory: mark every page keep, rewrite, merge or remove', { part: 'existing' }),
        us('SEO audit: top landing pages, ranking keywords, backlinks to protect', { part: 'existing' }),
        us('Audit the rest of the existing site: UX, accessibility, tech, scripts in use', { part: 'existing' }),
        us('Sitemap and final page list'),
        us('Content plan: for each page, its purpose, keyword, writer and due date'),
        us('Tracking plan: which conversions we measure'),
        us('Content migration scope: which old CMS items move, and who moves them', { part: 'content' }),
        us('Browsers and devices to test on, agreed'),
      ]],
      ['Needed from client: access (through the password vault)', [
        client('Google Drive', { due: { from: 'kickoff', days: 2 } }),
        client('Current CMS or codebase, and hosting', { part: 'existing', due: { from: 'kickoff', days: 2 } }),
        client('Domain registrar and DNS', { due: { from: 'kickoff', days: 5 } }),
        client('GA4, Google Tag Manager, Search Console', { due: { from: 'kickoff', days: 2 } }),
        client('Hotjar or Clarity, if they use it', { due: { from: 'kickoff', days: 5 } }),
        client('Names of the tools to integrate: CRM, email, booking, payments (logins can come later)', { part: 'integrations', due: { from: 'kickoff', days: 5 } }),
      ]],
      ['Needed from client: business', [
        client('Project type and scope', { due: { from: 'kickoff', days: 3 } }),
        client('Business goals, pain points and current site problems', { due: { from: 'kickoff', days: 3 } }),
        client('Main offer, products or services', { due: { from: 'kickoff', days: 3 } }),
        client('Primary user action and main goal', { due: { from: 'kickoff', days: 3 } }),
        client('Target audiences and markets, existing research and personas', { due: { from: 'kickoff', days: 5 } }),
        client('Customer, sales or support insights', { due: { from: 'kickoff', days: 7 } }),
        client('Success metrics', { due: { from: 'kickoff', days: 5 } }),
        client('Competitors and sites they like', { due: { from: 'kickoff', days: 5 } }),
      ]],
      ['Needed from client: content and brand', [
        client('Who writes the copy (us or the client), with real deadlines', { due: { from: 'kickoff', days: 5 } }),
        client('Required pages and features, or the final page list', { due: { from: 'kickoff', days: 7 } }),
        client('Existing material to reuse: case studies, testimonials, team bios, photos', { due: { from: 'kickoff', days: 10 } }),
        client('Forms: fields, where submissions go, who gets notified', { due: { from: 'kickoff', days: 10 } }),
        client('Legal pages: privacy policy and terms', { due: { from: 'kickoff', days: 21 } }),
        client('Website URL, if applicable', { due: { from: 'kickoff', days: 2 } }),
        client('Brand guidelines: logo files, fonts (with a web licence), colours, photos', { due: { from: 'kickoff', days: 5 } }),
      ]],
      ['Needed from client: technical', [
        client('Current platform or CMS, and the platform for the new site', { due: { from: 'kickoff', days: 5 } }),
        client('Technical limitations and requirements', { due: { from: 'kickoff', days: 7 } }),
        client('Languages, and who translates', { part: 'languages', due: { from: 'kickoff', days: 7 } }),
        client('Integrations list', { part: 'integrations', due: { from: 'kickoff', days: 7 } }),
        client('Desktop and mobile requirements (or other breakpoints)', { due: { from: 'kickoff', days: 7 } }),
        client('Interaction and animation requirements', { due: { from: 'kickoff', days: 10 } }),
        client('Compliance: accessibility standard, privacy and cookie rules for their markets', { due: { from: 'kickoff', days: 10 } }),
        client('Traffic and conversion data, testing data, interviews, surveys', { due: { from: 'kickoff', days: 10 } }),
      ]],
    ],
    handoff: {
      title: 'Handoff to Design, approved in writing', needs: 'client',
      items: [
        us('Discovery doc (final, in one place)'),
        us('Sitemap and content plan, with keywords'),
        us('Research findings and analytics baseline'),
        us('Old URL list and content inventory', { part: 'existing' }),
        us('Tracking plan'),
        us('Brand assets organized and linked'),
        us('Content schedule with the named copywriter and dates'),
      ],
    },
  },
  {
    id: 'design', name: 'Design', due: { from: 'kickoff', days: 40 },
    groups: [
      ['Our process', [
        us('Information architecture and navigation', { due: { from: 'kickoff', days: 18 } }),
        us('UX flows for the key journeys', { due: { from: 'kickoff', days: 19 } }),
        us('Wireframes, desktop and mobile', { due: { from: 'kickoff', days: 21 } }),
        us('Visual direction (style tile or homepage concept), approved before designing every page', { due: { from: 'kickoff', days: 24 } }),
        us('Component library with rules, including hover, focus, error and disabled states', { due: { from: 'kickoff', days: 30 } }),
        us('Every page at every breakpoint, presented in realistic context', { due: { from: 'kickoff', days: 36 } }),
        us('Interactive prototypes for the decisions that matter'),
        us('Colour contrast, text sizes and focus states meet WCAG AA', { due: { from: 'kickoff', days: 36 } }),
        us('Heading structure (H1 to H3) marked on each page', { tool: 'headings', done: 'Every page in the designs shows its H1 to H3, and the tag fixes from the heading plan are agreed.', due: { from: 'kickoff', days: 32 } }),
        us('Edge cases: long titles, missing images, empty CMS lists, form errors and success, 404 page', { due: { from: 'kickoff', days: 36 } }),
        us('CMS collections and fields defined', { due: { from: 'kickoff', days: 38 } }),
        us('Developer joins design reviews (catches unbuildable stuff before approval)'),
      ]],
      ['Needed from client', [
        client('Final or near-final content, by the content schedule dates', { due: { from: 'kickoff', days: 26 } }),
        client('Feedback collected once per round, from the decision-maker, within the agreed window', { due: { from: 'kickoff', days: 30 } }),
        client('Written approval of the visual direction, then of the final designs', { due: { from: 'kickoff', days: 26 } }),
      ]],
    ],
    handoff: {
      title: 'Handoff to Development, final designs approved in writing', needs: 'client',
      items: [
        us('Organized Figma files: In progress, For review, Approved, Approved + content'),
        us('Final layouts for all breakpoints'),
        us('Component library with defined rules'),
        us('Interaction and animation specs'),
        us('Prototypes for key flows'),
        us('Exported assets (images, icons, fonts) with licences, can be listed within Figma'),
        us('Approved content placed in the designs'),
        us('SEO per page: title, meta description, H1, slug', { tool: 'seo', check: 'plan' }),
        us('CMS structure (collections and fields)'),
      ],
    },
  },
  {
    id: 'development', name: 'Development', due: { from: 'launch', days: -14 },
    groups: [
      ['Our process', [
        us('Staging site password-protected and set to noindex', { due: { from: 'kickoff', days: 42 } }),
        us('Build on the chosen platform, configure the CMS'),
        us('Share completed pages for desktop and mobile review as they’re done'),
        us('Forms: validation, spam protection, success and error messages, the right recipients, CRM connection'),
        us('Wire up integrations', { part: 'integrations' }),
        us('Content entered, and old CMS items migrated'),
        us('Tracking built from the tracking plan (GA4, Tag Manager, conversions, consent)'),
        us('Cookie consent banner, if required'),
        us('SEO: titles, meta, OG images, alt text, schema, canonicals, favicon, 404 page', { tool: 'seo', check: 'live' }),
        us('Accessibility and performance handled from the first line'),
        us('Redirect map: each old URL points to its closest new page', { part: 'existing', tool: 'redirects', check: 'map' }),
        us('Designer reviews the build against approved designs (design QA), including states and animations'),
        us('Document changes made during development'),
      ]],
      ['Needed from client', [
        client('Logins for integrations (CRM, email, payments), by a set date', { part: 'integrations', due: { from: 'kickoff', days: 45 } }),
        client('Review of completed pages as they’re shared, within the agreed window'),
      ]],
    ],
    handoff: {
      title: 'Handoff to Launch/QA, build signed off against approved designs', needs: 'client',
      items: [
        us('Staging link with all pages complete'),
        us('CMS structure notes (how to edit what)'),
        us('Integration list and config notes', { part: 'integrations' }),
        us('Changes log from development'),
        us('Redirect map ready to apply', { part: 'existing' }),
        us('Known issues list, split into fix before launch and fix after launch'),
      ],
    },
  },
  {
    id: 'launch', name: 'Launch', due: { from: 'launch', days: 0 },
    groups: [
      ['QA: content', [
        us('No placeholder text, images or dummy “#” links left', { tool: 'launch', check: 'placeholders', due: { from: 'launch', days: -5 } }),
        us('Proofread every page', { due: { from: 'launch', days: -5 } }),
        us('Contact data: phones (tap to call), addresses, emails, hours', { due: { from: 'launch', days: -5 } }),
        us('Legal pages present and linked in the footer', { tool: 'launch', check: 'legal', due: { from: 'launch', days: -5 } }),
        us('Copyright year and social links', { due: { from: 'launch', days: -5 } }),
      ]],
      ['QA: function', [
        us('Every form submitted once: arrives in the right inbox or CRM, confirmation shows, auto-reply sends', { due: { from: 'launch', days: -5 } }),
        us('All links and buttons work', { tool: 'launch', check: 'links', due: { from: 'launch', days: -5 } }),
        us('Error page, loading, empty, success and error states', { due: { from: 'launch', days: -5 } }),
        us('Search, filters and pagination, if any', { due: { from: 'launch', days: -5 } }),
        us('Payments: a test purchase and a refund, if any', { part: 'payments', due: { from: 'launch', days: -5 } }),
      ]],
      ['QA: devices, accessibility and speed', [
        us('Test on real devices (iPhone Safari, Android Chrome), plus desktop Chrome, Safari, Firefox and Edge', { due: { from: 'launch', days: -4 } }),
        us('Accessibility check: automated scan, keyboard-only walkthrough, screen reader spot check (WCAG 2.2 AA covers AODA and ADA)', { due: { from: 'launch', days: -4 } }),
        us('Performance check on a real phone: CLS under 0.1, INP under 200ms, LCP under 2.5s (a target; some projects can’t reach it because of other requirements)', { due: { from: 'launch', days: -4 } }),
      ]],
      ['QA: SEO and tracking', [
        us('Titles, meta descriptions, one H1 per page, alt text, OG images, favicon', { tool: 'launch', check: 'seo', due: { from: 'launch', days: -4 } }),
        us('Canonicals point to the live domain', { tool: 'launch', check: 'canonicals', due: { from: 'launch', days: -4 } }),
        us('GA4 and conversions fire (check in real time), and nothing tracks before cookie consent where it’s required', { due: { from: 'launch', days: -4 } }),
      ]],
      ['Launch day', [
        us('Content freeze agreed', { due: { from: 'launch', days: -2 } }),
        us('DNS: lower the TTL a day ahead, keep the email records (MX, SPF, DKIM)', { due: { from: 'launch', days: -1 } }),
        us('Publish, then check SSL and the www and https redirects', { tool: 'launch', check: 'https', due: { from: 'launch', days: 0 } }),
        us('Remove noindex and the staging password; robots.txt allows indexing', { tool: 'launch', check: 'indexing', due: { from: 'launch', days: 0 }, done: 'The live site has no noindex tag and no password, and robots.txt doesn’t block any page.' }),
        us('Apply 301 redirects from all old URLs and test the top ones', { part: 'existing', tool: 'redirects', check: 'live', due: { from: 'launch', days: 0 } }),
        us('Submit sitemap.xml in Search Console', { due: { from: 'launch', days: 0 } }),
        us('Submit a form on the live site and see the visit in analytics', { due: { from: 'launch', days: 0 } }),
      ]],
      ['Needed from client', [
        client('Check the final content', { due: { from: 'launch', days: -7 } }),
        client('Confirm contact data and legal pages are correct', { due: { from: 'launch', days: -5 } }),
        client('Go-live approval and date', { due: { from: 'launch', days: -4 } }),
      ]],
    ],
    handoff: {
      title: 'Handoff to Client, go-live approved', needs: 'client',
      items: [
        us('Live site'),
        us('Source files and full ownership transfer: Webflow site, hosting billing, domain, Figma files, font and image licences'),
        us('CMS training session (recorded) and training materials'),
        us('Analytics, Tag Manager and Search Console access'),
        us('All credentials returned; our access removed or kept under a support agreement'),
        us('Support terms: how long, what’s covered, how to report issues'),
        us('First improvements roadmap'),
      ],
    },
  },
  {
    id: 'after', name: 'After launch', due: { from: 'launch', days: 30 },
    groups: [
      ['Our process', [
        us('Days 1 to 3: check 404s and redirects (crawl plus Search Console)', { tool: 'redirects', check: 'after', due: { from: 'launch', days: 3 } }),
        us('Week 1: leads arriving, analytics numbers look right', { due: { from: 'launch', days: 7 } }),
        us('Weeks 2 to 4: indexing, and traffic against the baseline', { due: { from: 'launch', days: 28 } }),
        us('Fix the after-launch items from the known issues list', { due: { from: 'launch', days: 21 } }),
        us('30-day check-in with the client: results against success metrics, then the roadmap', { due: { from: 'launch', days: 30 } }),
        us('Internal retro: what slowed us down', { due: { from: 'launch', days: 30 } }),
        us('Ask for a testimonial or case study', { due: { from: 'launch', days: 30 } }),
      ]],
    ],
    handoff: { title: 'Project closed', needs: 'us', items: [] },
  },
];

// The short checklist most projects start from: about 50 items, the ones that matter on every website. Each item
// says what done means, so someone new to the process knows when to tick it.
const LEAN_PARTS = PARTS.filter(p => ['existing', 'content', 'integrations'].includes(p.id));
const LEAN = [
  {
    id: 'discover', name: 'Discover', due: { from: 'kickoff', days: 14 },
    groups: [
      ['Our process', [
        us('Kickoff call with the client', { due: { from: 'kickoff', days: 0 }, done: 'Everyone knows the goals, the dates, who approves what and how feedback is sent.' }),
        us('Goals and success metrics agreed, each with a baseline', { done: 'Two or three measurable goals, like leads or calls booked, each with today’s number from analytics.' }),
        us('Crawl the current site and save the full URL list (for redirects later)', { part: 'existing', tool: 'scan', done: 'Every page on the current site is listed, so nothing is lost when URLs change.', due: { from: 'kickoff', days: 3 } }),
        us('Top pages and backlinks to protect, from analytics and Search Console', { part: 'existing', due: { from: 'kickoff', days: 7 }, done: 'A short list of the pages that bring the most visits and links, so they keep their URL or get a redirect.' }),
        us('Content inventory: mark every page keep, rewrite, merge or remove', { part: 'existing', done: 'Each old page has a decision, and the ones you keep have a place in the new sitemap.' }),
        us('Sitemap and content plan: every page, who writes it and by when', { done: 'A page list the client has seen, with a writer and a due date for each page’s copy.' }),
      ]],
      ['Needed from client', [
        client('Access to the domain, analytics and Search Console', { due: { from: 'kickoff', days: 5 }, done: 'You can log in to the domain’s DNS, Google Analytics and Search Console, shared through a password manager.' }),
        client('Access to the current site’s CMS and hosting', { part: 'existing', due: { from: 'kickoff', days: 3 }, done: 'You can log in to the old site, so you can export content and set up redirects.' }),
        client('Brand files: logo, fonts, colours and photos', { due: { from: 'kickoff', days: 5 }, done: 'Logo files (SVG), fonts with a web licence, the brand colours and photos you’re allowed to use.' }),
        client('Tools to connect: CRM, email, booking', { part: 'integrations', due: { from: 'kickoff', days: 7 }, done: 'The names of the tools the site sends data to. Logins can come later.' }),
      ]],
    ],
    handoff: { title: 'Discovery approved', needs: 'client', items: [us('Sitemap and content plan, shared with the client', { done: 'The client has the page list and the content plan, and has replied to approve them.' })] },
  },
  {
    id: 'design', name: 'Design', due: { from: 'kickoff', days: 40 },
    groups: [
      ['Our process', [
        us('Wireframes for the key pages', { due: { from: 'kickoff', days: 21 }, done: 'Layouts for the home page and each type of page, before final visuals.' }),
        us('Visual direction approved before designing every page', { due: { from: 'kickoff', days: 24 }, done: 'The client has approved one page in full design, so the rest follow the same look.' }),
        us('Every page designed for desktop and mobile', { due: { from: 'kickoff', days: 36 }, done: 'Each page in the sitemap has a desktop and a mobile design with real or near-final content.' }),
        us('Heading structure and SEO for each page, marked in the designs', { due: { from: 'kickoff', days: 36 }, done: 'Each page shows its H1 and subheadings, and has a title and description to use.' }),
      ]],
      ['Needed from client', [
        client('Final content, by the dates in the content plan', { due: { from: 'kickoff', days: 26 }, done: 'Copy for every page is in, in one shared document or folder.' }),
        client('Feedback in one reply per review round', { due: { from: 'kickoff', days: 30 }, done: 'One person sends one set of comments per round, within the agreed number of days.' }),
      ]],
    ],
    handoff: { title: 'Designs approved', needs: 'client', items: [us('Final designs for every page, with the approved content', { done: 'The client has approved the final designs in writing.' })] },
  },
  {
    id: 'build', name: 'Build', due: { from: 'launch', days: -14 },
    groups: [
      ['Our process', [
        us('Staging site hidden from search engines', { due: { from: 'kickoff', days: 42 }, done: 'Staging has a password or a noindex tag, so Google doesn’t list it.' }),
        us('Pages and CMS built, content entered', { done: 'Every page in the sitemap is on staging with its final content.' }),
        us('Old blog posts or CMS items moved over', { part: 'content', done: 'Every old post or item you’re keeping is on staging, with its images and, where possible, the same URL.' }),
        us('Forms: spam protection, the right recipients, a clear success message', { done: 'Each form sends to the right inbox or CRM and shows a message when it’s sent.' }),
        us('Integrations connected', { part: 'integrations', done: 'Test data reaches each connected tool.' }),
        us('Analytics and conversions set up, with cookie consent where it’s required', { done: 'A test visit and a test form submission show up in analytics.' }),
        us('Heading plan on staging: every tag fix done', { tool: 'headings', done: 'Scan staging, plan the headings, and work through the tag fixes. This ticks itself when they’re all done.' }),
        us('SEO plan on staging: a title, description and URL for every page', { tool: 'seo', check: 'plan', done: 'This ticks itself once an SEO plan covers every page the scan read.' }),
        us('SEO in place: titles, descriptions, OG images, alt text', { tool: 'seo', check: 'live', done: 'The planned titles and descriptions are on the pages, share images are set and images have alt text.' }),
        us('Redirect map: each old URL points to its closest new page', { part: 'existing', tool: 'redirects', check: 'map', done: 'Every old URL has a new page you’re happy with.' }),
      ]],
      ['Needed from client', [
        client('Review of pages as they’re shared', { done: 'The client has looked at each page on staging and sent their comments.' }),
        client('Privacy policy and terms text, or who writes it', { due: { from: 'launch', days: -14 }, done: 'The legal text is ready to publish. The client or their lawyer owns the wording.' }),
      ]],
    ],
    handoff: { title: 'Build approved on staging', needs: 'client', items: [us('Staging link with every page done, and a list of known issues', { done: 'The client has approved staging in writing and knows what will be fixed after launch.' })] },
  },
  {
    id: 'launch', name: 'Launch', due: { from: 'launch', days: 0 },
    groups: [
      ['Before launch', [
        us('Scan the old site again, for pages added since kickoff', { part: 'existing', tool: 'scan', check: 'recrawl', due: { from: 'launch', days: -7 }, done: 'A fresh URL list, so new pages get redirects too. This ticks itself when the old site is scanned in the 10 days before launch.' }),
        us('Back up the old site before its hosting ends', { part: 'existing', due: { from: 'launch', days: -5 }, done: 'An export of the old site’s pages, files and form entries, saved where the client can reach it.' }),
        us('No placeholder text, images or dummy “#” links left', { tool: 'launch', check: 'placeholders', due: { from: 'launch', days: -5 }, done: 'The launch check finds no placeholder text, placeholder images or links to “#”.' }),
        us('All links and buttons work', { tool: 'launch', check: 'links', due: { from: 'launch', days: -5 }, done: 'The launch check finds no broken links.' }),
        us('Titles, meta descriptions and one H1 on every page', { tool: 'launch', check: 'seo', due: { from: 'launch', days: -4 }, done: 'The launch check finds a title, a description and exactly one H1 on every page.' }),
        us('Canonicals point to the live domain', { tool: 'launch', check: 'canonicals', due: { from: 'launch', days: -4 }, done: 'Every page’s canonical tag uses the live domain, not staging.' }),
        us('Privacy policy and terms linked in the footer', { tool: 'launch', check: 'legal', due: { from: 'launch', days: -5 }, done: 'The launch check finds working links to the legal pages on every page.' }),
        us('Every form submitted once and received', { due: { from: 'launch', days: -5 }, done: 'Each form was sent from staging, and the message arrived where it should.' }),
        us('Accessibility check: keyboard only, colour contrast, alt text', { due: { from: 'launch', days: -4 }, done: 'Every page works with the keyboard alone, text passes a contrast check and images have alt text.' }),
        us('Tested on a real phone and in the main browsers', { due: { from: 'launch', days: -4 }, done: 'Checked on an iPhone and an Android phone, and in Chrome, Safari and Firefox.' }),
      ]],
      ['Launch day', [
        us('DNS change ready: TTL lowered a day ahead, email records (MX, SPF, DKIM) kept', { due: { from: 'launch', days: -1 }, done: 'The DNS change is ready and doesn’t touch the records that deliver the client’s email.' }),
        us('Publish, then check SSL and the www and https redirects', { tool: 'launch', check: 'https', due: { from: 'launch', days: 0 }, done: 'The launch check of the live domain finds a valid certificate, and every address version lands on one https domain.' }),
        us('Search engines allowed: no noindex, robots.txt open', { tool: 'launch', check: 'indexing', due: { from: 'launch', days: 0 }, done: 'The live site has no noindex tag and no password, and robots.txt doesn’t block any page.' }),
        us('301 redirects live and tested', { part: 'existing', tool: 'redirects', check: 'live', due: { from: 'launch', days: 0 }, done: 'A test of the live domain finds every old URL redirects once, with a 301, to the right page.' }),
        us('Sitemap submitted in Search Console', { due: { from: 'launch', days: 0 }, done: 'Search Console shows the new sitemap as submitted.' }),
      ]],
      ['Needed from client', [
        client('Go-live approval and date', { due: { from: 'launch', days: -4 }, done: 'The client has confirmed the launch date in writing.' }),
      ]],
    ],
    handoff: { title: 'Site live, handed over', needs: 'client', items: [us('CMS training, and every login handed over', { done: 'The client can edit the site on their own and has the logins to everything.' })] },
  },
  {
    id: 'after', name: 'After launch', due: { from: 'launch', days: 30 },
    groups: [
      ['Our process', [
        us('Days 1 to 3: check 404s and redirects', { tool: 'redirects', check: 'after', due: { from: 'launch', days: 3 }, done: 'A redirect test after launch day passes, and Search Console shows no new 404s.' }),
        us('Week 1: leads arriving and analytics look right', { due: { from: 'launch', days: 7 }, done: 'Form entries arrive and the analytics numbers look normal.' }),
        us('30-day check-in: results against the goals', { due: { from: 'launch', days: 30 }, done: 'A short note comparing the first month with the baseline, sent to the client.' }),
      ]],
    ],
    handoff: { title: 'Project closed', needs: 'us', items: [] },
  },
];

const MESSAGES = [
  {
    id: 'ask-items', kind: 'message', name: 'Ask the client for items', use: ['client-request'],
    body: 'Hi {client first name},\n\nHere’s what we need from you to keep the new {project} site on track for launch on {launch date}:\n\n{items}\n\nThanks!\n{your name}',
  },
  {
    id: 'reminder', kind: 'message', name: 'Friendly reminder', use: [],
    body: 'Hi {client first name},\n\nA quick reminder about what we’re still waiting for:\n\n{items}\n\nIf anything is holding you up, let me know and we’ll work it out.\n\nThanks!\n{your name}',
  },
  {
    id: 'signoff-request', kind: 'message', name: 'Ask for sign-off', use: [],
    body: 'Hi {client first name},\n\nThe {phase} work for {project} is ready. Could you reply to this message to approve it? Once you do, we’ll start the next phase.\n\nThanks!\n{your name}',
  },
  {
    id: 'kickoff', kind: 'email', name: 'Kickoff welcome', use: [], subject: 'Welcome aboard, here’s what happens next',
    body: 'Hi {client first name},\n\nThanks for choosing us for the new {project} site. Here’s how the project runs:\n\n1. Discover: we learn about your business, your audience and your goals.\n2. Design: we design every page and share it for your feedback.\n3. Build: we build the site and share pages as they’re ready.\n4. Launch: we test everything and take the site live on {launch date}.\n5. After launch: we check that everything works and share the first results after a month.\n\nThe first step is the kickoff call. Could you send a few times that work for you this week?\n\nThanks!\n{your name}',
  },
  {
    id: 'designs-ready', kind: 'email', name: 'Designs ready for review', use: [], subject: 'Your {project} designs are ready to look at',
    body: 'Hi {client first name},\n\nThe designs for {project} are ready for you to review. Please send all your feedback in one reply, so we can make the changes in one round.\n\nThanks!\n{your name}',
  },
  {
    id: 'launch-day', kind: 'email', name: 'Launch day', use: [], subject: '{project} is live',
    body: 'Hi {client first name},\n\nThe new {project} site is live. Over the next few weeks we’ll keep an eye on redirects, forms and analytics, and we’ll check in with the first results in a month.\n\nThanks for working with us!\n{your name}',
  },
  {
    id: 'checkin', kind: 'email', name: '30-day check-in', use: [], subject: 'How the new site did in its first month',
    body: 'Hi {client first name},\n\nThe new {project} site has been live for a month. Could we book 30 minutes to go through the results against the goals we set, and agree what to improve next?\n\nThanks!\n{your name}',
  },
];

function checklist(id, name, parts, phases) {
  let n = 0;
  const item = ([title, who, x = {}]) => ({ id: 'i' + (++n), title, who, done: x.done || '', part: x.part || null, tool: x.tool || null, check: x.check || null, due: x.due || null });
  return {
    id, kind: 'checklist', name, version: 1, seed: SEED, updated: Date.now(), parts,
    phases: phases.map(ph => ({
      id: ph.id, name: ph.name, due: ph.due,
      groups: ph.groups.map(([name, items], gi) => ({ id: `${ph.id}-g${gi + 1}`, name, items: items.map(item) })),
      handoff: { title: ph.handoff.title, needs: ph.handoff.needs, items: ph.handoff.items.map(item) },
    })),
  };
}
function defaults() {
  return [
    checklist('website-lean', 'Website project', LEAN_PARTS, LEAN),
    checklist('website', 'Full agency process', PARTS, PHASES),
    ...MESSAGES.map(m => ({ subject: '', ...m, updated: Date.now() })),
  ];
}

// Earlier wording of the built-in messages. A saved copy that still matches one of these is updated to the new text.
const MESSAGE_FIXES = {
  reminder: ['Hi {client first name},\n\nA quick nudge on a couple of things we’re still waiting for:\n\n{items}\n\nIf anything is holding you up, let me know and we’ll work it out.\n\nThanks!\n{your name}'],
  kickoff: ['Hi {client first name},\n\nThanks for choosing us for the new {project} site. Here’s how the project runs:\n\n1. Discover: we learn about your business, your audience and your goals.\n2. Design: we design every page and share it for your feedback.\n3. Development: we build the site and share pages as they’re ready.\n4. Launch: we test everything and take the site live on {launch date}.\n\nThe first step is the kickoff call. Could you send a few times that work for you this week?\n\nThanks!\n{your name}'],
};

module.exports = { defaults, SEED, MESSAGE_FIXES };
