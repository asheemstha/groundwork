// The templates a new install starts with: the agency's website project checklist, plus client messages and emails.
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

const PHASES = [
  {
    id: 'setup', name: 'Setup', due: { from: 'kickoff', days: 0 },
    groups: [
      ['Our process', [
        us('Contract signed: scope, page count, revision rounds, what’s out of scope', { due: { from: 'kickoff', days: -7 } }),
        us('Timeline with a date for each sign-off and client review window'),
        us('Team and roles named: PM, design, dev, SEO, copy'),
        us('Workspace ready: Drive folder, Slack channel, task board, Figma file'),
        us('Shared password vault for client logins'),
      ]],
      ['Needed from the client', [
        client('One decision-maker who can approve on schedule, plus a backup'),
        client('Agreed feedback turnaround and one channel for feedback'),
      ]],
    ],
    handoff: { title: 'Ready for kickoff', needs: 'us', items: [us('Kickoff meeting booked with an agenda')] },
  },
  {
    id: 'discover', name: 'Discover', due: { from: 'kickoff', days: 14 },
    groups: [
      ['Our process', [
        us('Kickoff and onboarding walkthrough', { due: { from: 'kickoff', days: 0 } }),
        us('Goals, audiences and success metrics agreed, each with a baseline and a target'),
        us('Analytics reviewed: 12-month baseline of traffic, top pages and conversions saved'),
        us('Competitive analysis'),
        us('Crawl the current site and save the full URL list', { part: 'existing', tool: 'scan', done: 'Every page on the current site is listed, so nothing is lost when URLs change.', due: { from: 'kickoff', days: 3 } }),
        us('Content inventory: every page marked keep, rewrite, merge or remove', { part: 'existing' }),
        us('SEO audit: top landing pages, ranking keywords, backlinks to protect', { part: 'existing' }),
        us('Existing site audited: UX, accessibility, tech and scripts in use', { part: 'existing' }),
        us('Sitemap and final page list'),
        us('Content plan: purpose, keyword, writer and due date for each page'),
        us('Tracking plan: which conversions we measure'),
        us('Content migration scope: what moves and who moves it', { part: 'content' }),
        us('Browsers and devices to test on agreed'),
      ]],
      ['Needed from the client: access', [
        client('Google Drive access', { due: { from: 'kickoff', days: 2 } }),
        client('Current CMS or codebase, and hosting access', { part: 'existing', due: { from: 'kickoff', days: 2 } }),
        client('Domain registrar and DNS access', { due: { from: 'kickoff', days: 5 } }),
        client('GA4, Google Tag Manager and Search Console access', { due: { from: 'kickoff', days: 2 } }),
        client('Hotjar or Clarity access, if they use it', { due: { from: 'kickoff', days: 5 } }),
        client('Names of the tools to integrate: CRM, email, booking, payments', { part: 'integrations', due: { from: 'kickoff', days: 5 } }),
      ]],
      ['Needed from the client: business', [
        client('Project type and scope', { due: { from: 'kickoff', days: 3 } }),
        client('Business goals, pain points and current site problems', { due: { from: 'kickoff', days: 3 } }),
        client('Main offer, products or services', { due: { from: 'kickoff', days: 3 } }),
        client('Primary user action and main goal', { due: { from: 'kickoff', days: 3 } }),
        client('Target audiences and markets, research and personas', { due: { from: 'kickoff', days: 5 } }),
        client('Customer, sales or support insights', { due: { from: 'kickoff', days: 7 } }),
        client('Success metrics', { due: { from: 'kickoff', days: 5 } }),
        client('Competitors and sites they like', { due: { from: 'kickoff', days: 5 } }),
      ]],
      ['Needed from the client: content and brand', [
        client('Who writes the copy, with real deadlines', { due: { from: 'kickoff', days: 5 } }),
        client('Required pages and features, or the final page list', { due: { from: 'kickoff', days: 7 } }),
        client('Existing material to reuse: case studies, testimonials, bios, photos', { due: { from: 'kickoff', days: 10 } }),
        client('Forms: fields, where submissions go, who gets notified', { due: { from: 'kickoff', days: 10 } }),
        client('Legal pages: privacy policy and terms', { due: { from: 'kickoff', days: 21 } }),
        client('Brand guidelines: logo files, fonts with a web licence, colours, photos', { due: { from: 'kickoff', days: 5 } }),
      ]],
      ['Needed from the client: technical', [
        client('Technical limitations and requirements', { due: { from: 'kickoff', days: 7 } }),
        client('Languages, and who translates', { part: 'languages', due: { from: 'kickoff', days: 7 } }),
        client('Integrations list', { part: 'integrations', due: { from: 'kickoff', days: 7 } }),
        client('Desktop and mobile requirements', { due: { from: 'kickoff', days: 7 } }),
        client('Interaction and animation requirements', { due: { from: 'kickoff', days: 10 } }),
        client('Compliance: accessibility standard, privacy and cookie rules for their markets', { due: { from: 'kickoff', days: 10 } }),
        client('Traffic and conversion data, testing data, interviews, surveys', { due: { from: 'kickoff', days: 10 } }),
      ]],
    ],
    handoff: {
      title: 'Handoff to Design', needs: 'client',
      items: [
        us('Discovery doc, final and in one place'),
        us('Sitemap and content plan, with keywords'),
        us('Research findings and analytics baseline'),
        us('Old URL list and content inventory', { part: 'existing' }),
        us('Tracking plan'),
        us('Brand assets organised and linked'),
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
        us('Visual direction: style tile or homepage concept', { due: { from: 'kickoff', days: 24 } }),
        us('Component library with hover, focus and error states', { due: { from: 'kickoff', days: 30 } }),
        us('Every page at every breakpoint, with real content', { due: { from: 'kickoff', days: 36 } }),
        us('Heading structure (H1 to H3) marked on each page', { tool: 'headings', done: 'Every page in the designs shows its H1 to H3, and the tag fixes from the heading plan are agreed.', due: { from: 'kickoff', days: 32 } }),
        us('Colour contrast, text sizes and focus states meet WCAG AA', { due: { from: 'kickoff', days: 36 } }),
        us('Edge cases: long titles, empty lists, form errors, 404 page', { due: { from: 'kickoff', days: 36 } }),
        us('CMS collections and fields defined', { due: { from: 'kickoff', days: 38 } }),
        us('Interactive prototypes for the decisions that matter'),
        us('Developer joins design reviews'),
      ]],
      ['Needed from the client', [
        client('Final or near-final content', { due: { from: 'kickoff', days: 26 } }),
        client('Feedback on each design round, from the decision-maker', { due: { from: 'kickoff', days: 30 } }),
        client('Written approval of the visual direction', { due: { from: 'kickoff', days: 26 } }),
      ]],
    ],
    handoff: {
      title: 'Handoff to Development', needs: 'client',
      items: [
        us('Figma organised: In progress, For review, Approved'),
        us('Final layouts for every breakpoint'),
        us('Component library with rules'),
        us('Interaction and animation specs'),
        us('Prototypes for the key flows'),
        us('Exported assets, with font and image licences'),
        us('Approved content placed in the designs'),
        us('SEO per page: title, meta description, H1, slug', { tool: 'seo' }),
        us('CMS structure: collections and fields'),
      ],
    },
  },
  {
    id: 'development', name: 'Development', due: { from: 'launch', days: -14 },
    groups: [
      ['Our process', [
        us('Staging site password-protected and set to noindex', { due: { from: 'kickoff', days: 42 } }),
        us('Build on the chosen platform and configure the CMS'),
        us('Completed pages shared for desktop and mobile review'),
        us('Forms: validation, spam protection, messages, recipients, CRM'),
        us('Integrations wired up', { part: 'integrations' }),
        us('Content entered'),
        us('Old CMS items migrated', { part: 'content' }),
        us('Tracking built from the tracking plan'),
        us('Cookie consent banner, if required'),
        us('SEO: titles, meta, OG images, alt text, schema, canonicals, favicon, 404 page', { tool: 'seo' }),
        us('Accessibility and performance handled from the first line'),
        us('Redirect map: each old URL goes to its closest new page', { part: 'existing', tool: 'redirects' }),
        us('Designer QA against the approved designs'),
        us('Changes made during development documented'),
      ]],
      ['Needed from the client', [
        client('Logins for integrations: CRM, email, payments', { part: 'integrations', due: { from: 'kickoff', days: 45 } }),
        client('Review of completed pages within the agreed window'),
      ]],
    ],
    handoff: {
      title: 'Handoff to Launch', needs: 'client',
      items: [
        us('Staging link with all pages complete'),
        us('CMS notes: how to edit what'),
        us('Integration list and config notes', { part: 'integrations' }),
        us('Changes log'),
        us('Redirect map ready to apply', { part: 'existing' }),
        us('Known issues list, split into before and after launch'),
      ],
    },
  },
  {
    id: 'launch', name: 'Launch', due: { from: 'launch', days: -3 },
    groups: [
      ['QA: content', [
        us('No placeholder text, images or dummy “#” links left', { tool: 'launch', due: { from: 'launch', days: -5 } }),
        us('Proofread every page', { due: { from: 'launch', days: -5 } }),
        us('Contact details: tap-to-call phones, addresses, emails, hours', { due: { from: 'launch', days: -5 } }),
        us('Legal pages present and linked in the footer', { tool: 'launch', due: { from: 'launch', days: -5 } }),
        us('Copyright year and social links', { due: { from: 'launch', days: -5 } }),
      ]],
      ['QA: function', [
        us('Every form sent once: right inbox, CRM, confirmation, auto-reply', { due: { from: 'launch', days: -5 } }),
        us('All links and buttons work', { tool: 'launch', due: { from: 'launch', days: -5 } }),
        us('404 page, loading, empty, success and error states', { due: { from: 'launch', days: -5 } }),
        us('Search, filters and pagination, if any', { due: { from: 'launch', days: -5 } }),
        us('Payments: a test purchase and a refund', { part: 'payments', due: { from: 'launch', days: -5 } }),
      ]],
      ['QA: devices, accessibility and speed', [
        us('Real devices and desktop browsers from the agreed list', { due: { from: 'launch', days: -4 } }),
        us('Accessibility: automated scan, keyboard walkthrough, screen reader check (WCAG 2.2 AA)', { due: { from: 'launch', days: -4 } }),
        us('Real phone test: LCP under 2.5s, INP under 200ms, CLS under 0.1', { due: { from: 'launch', days: -4 } }),
      ]],
      ['QA: SEO and tracking', [
        us('Titles, meta descriptions, one H1 per page, alt text, OG images, favicon', { tool: 'launch', due: { from: 'launch', days: -4 } }),
        us('Canonicals point to the live domain', { tool: 'launch', due: { from: 'launch', days: -4 } }),
        us('Conversions fire, and nothing tracks before consent where it’s required', { due: { from: 'launch', days: -4 } }),
      ]],
      ['Launch day', [
        us('Content freeze agreed', { due: { from: 'launch', days: -2 } }),
        us('DNS: lower the TTL a day ahead, keep the email records', { due: { from: 'launch', days: -1 } }),
        us('Publish, then check SSL and the www and https redirects', { due: { from: 'launch', days: 0 } }),
        us('Remove noindex and the staging password so Google can index the site', { tool: 'launch', due: { from: 'launch', days: 0 }, done: 'The live site has no noindex tag and no password, and robots.txt doesn’t block any page.' }),
        us('Apply the 301 redirects and test the top old URLs', { part: 'existing', tool: 'redirects', due: { from: 'launch', days: 0 } }),
        us('Submit sitemap.xml in Search Console', { due: { from: 'launch', days: 0 } }),
        us('Submit a form on the live site and see the visit in analytics', { due: { from: 'launch', days: 0 } }),
      ]],
      ['Needed from the client', [
        client('Final content check', { due: { from: 'launch', days: -7 } }),
        client('Contact details and legal pages confirmed', { due: { from: 'launch', days: -5 } }),
        client('Go-live approval and date', { due: { from: 'launch', days: -4 } }),
      ]],
    ],
    handoff: {
      title: 'Handoff to the client', needs: 'client',
      items: [
        us('Live site'),
        us('Ownership transfer: Webflow site, hosting billing, domain, Figma files, licences'),
        us('CMS training session, recorded, and training materials'),
        us('Analytics, Tag Manager and Search Console access'),
        us('Credentials returned; our access removed or kept under support'),
        us('Support terms: how long, what’s covered, how to report issues'),
        us('First improvements roadmap'),
      ],
    },
  },
  {
    id: 'after', name: 'After launch', due: { from: 'launch', days: 30 },
    groups: [
      ['Our process', [
        us('Days 1 to 3: 404s and redirects checked', { tool: 'redirects', due: { from: 'launch', days: 3 } }),
        us('Week 1: leads arriving, analytics numbers look right', { due: { from: 'launch', days: 7 } }),
        us('Weeks 2 to 4: indexing, and traffic against the baseline', { due: { from: 'launch', days: 28 } }),
        us('After-launch items from the known issues list fixed', { due: { from: 'launch', days: 21 } }),
        us('30-day check-in with the client: results against the success metrics, then the roadmap', { due: { from: 'launch', days: 30 } }),
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
    body: 'Hi {client first name},\n\nA quick nudge on a couple of things we’re still waiting for:\n\n{items}\n\nIf anything is holding you up, let me know and we’ll work it out.\n\nThanks!\n{your name}',
  },
  {
    id: 'signoff-request', kind: 'message', name: 'Ask for sign-off', use: [],
    body: 'Hi {client first name},\n\nThe {phase} work for {project} is ready. Could you reply to this message to approve it? Once you do, we’ll start the next phase.\n\nThanks!\n{your name}',
  },
  {
    id: 'kickoff', kind: 'email', name: 'Kickoff welcome', use: [], subject: 'Welcome aboard, here’s what happens next',
    body: 'Hi {client first name},\n\nThanks for choosing us for the new {project} site. Here’s how the project runs:\n\n1. Discover: we learn about your business, your audience and your goals.\n2. Design: we design every page and share it for your feedback.\n3. Development: we build the site and share pages as they’re ready.\n4. Launch: we test everything and take the site live on {launch date}.\n\nThe first step is the kickoff call. Could you send a few times that work for you this week?\n\nThanks!\n{your name}',
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

function defaults() {
  let n = 0;
  const item = ([title, who, x = {}]) => ({ id: 'i' + (++n), title, who, done: x.done || '', part: x.part || null, tool: x.tool || null, due: x.due || null });
  const website = {
    id: 'website', kind: 'checklist', name: 'Website project', version: 1, updated: Date.now(), parts: PARTS,
    phases: PHASES.map((ph, pi) => ({
      id: ph.id, name: ph.name, due: ph.due,
      groups: ph.groups.map(([name, items], gi) => ({ id: `${ph.id}-g${gi + 1}`, name, items: items.map(item) })),
      handoff: { title: ph.handoff.title, needs: ph.handoff.needs, items: ph.handoff.items.map(item) },
    })),
  };
  return [website, ...MESSAGES.map(m => ({ subject: '', ...m, updated: Date.now() }))];
}

module.exports = { defaults };
