// The templates a new install starts with: the gallery (lib/templates-gallery.js), the full agency process, and
// client messages and emails.
const { GALLERY } = require('./templates-gallery');
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
const SEED = 8;

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

// A template as it's saved: ids for phases, groups and items (items number up from i1 in each template).
function checklist(t) {
  let n = 0;
  const item = ([title, who, x = {}]) => ({ id: 'i' + (++n), title, who, done: x.done || '', part: x.part || null, platforms: x.platforms || null, tool: x.tool || null, check: x.check || null, due: x.due || null });
  return {
    id: t.id, kind: 'checklist', name: t.name, desc: t.desc || '', basedOn: t.basedOn || [], refSpan: t.refSpan || 70, labels: t.labels || null, repeat: t.repeat || null,
    version: 1, seed: SEED, updated: Date.now(), parts: t.parts,
    phases: t.phases.map(ph => ({
      id: ph.id, name: ph.name, due: ph.due,
      groups: ph.groups.map(([name, items], gi) => ({ id: `${ph.id}-g${gi + 1}`, name, items: items.map(item) })),
      handoff: { title: ph.handoff.title, needs: ph.handoff.needs, items: ph.handoff.items.map(item) },
    })),
  };
}
const FULL = {
  id: 'website', name: 'Full agency process', parts: PARTS, phases: PHASES.map(ph => ({ ...ph })), refSpan: 70,
  desc: 'A long checklist from a working agency: about 140 items across six phases, from contract to 30 days after launch.',
  basedOn: [{ label: 'A web agency’s own process', url: '' }],
};
function defaults() {
  return [
    ...GALLERY.map(checklist),
    checklist(FULL),
    ...MESSAGES.map(m => ({ subject: '', ...m, updated: Date.now() })),
  ];
}

// Earlier wording of the built-in messages. A saved copy that still matches one of these is updated to the new text.
const MESSAGE_FIXES = {
  reminder: ['Hi {client first name},\n\nA quick nudge on a couple of things we’re still waiting for:\n\n{items}\n\nIf anything is holding you up, let me know and we’ll work it out.\n\nThanks!\n{your name}'],
  kickoff: ['Hi {client first name},\n\nThanks for choosing us for the new {project} site. Here’s how the project runs:\n\n1. Discover: we learn about your business, your audience and your goals.\n2. Design: we design every page and share it for your feedback.\n3. Development: we build the site and share pages as they’re ready.\n4. Launch: we test everything and take the site live on {launch date}.\n\nThe first step is the kickoff call. Could you send a few times that work for you this week?\n\nThanks!\n{your name}'],
};

module.exports = { defaults, SEED, MESSAGE_FIXES };
