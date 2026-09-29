# Heading rules

The rulebook for both outputs. Section A says why the rules exist (with sources). Section B holds the rules this skill enforces. Sections C–E cover edge cases, platforms and wording. Quote Section A sparingly in the guide's Overview; apply Section B everywhere.

## A. What the research says (verified September 2026)

**Screen reader users depend on headings.**
- On long pages, 71.6% of screen reader users look for information by moving through the headings. 88.8% find heading levels very or somewhat useful. (WebAIM Screen Reader User Survey #10, 2024.)
- W3C WAI: nest headings by rank. Skipping ranks "can be confusing and should be avoided where possible". Jumping back up (H4 to H2) to start a new section is fine.
- WCAG 2.2: 1.3.1 Info and Relationships (Level A) requires text that looks like a heading to be marked up as one. 2.4.6 Headings and Labels (Level AA) requires headings to describe their topic. 2.4.10 Section Headings (Level AAA) asks for content to be organised under headings.

**HTML itself.**
- MDN: do not skip heading levels. Do not use headings to resize text. More than one `<h1>` is allowed but "not considered a best practice": a page should have one H1 that describes it, like its `<title>`.
- The HTML "document outline algorithm" was removed from the WHATWG spec in 2022. Heading rank alone defines the hierarchy: an H1 inside a `<section>` is still an H1. Browsers are also removing the old default styles that shrank nested H1s (Firefox 140; Chrome shows deprecation warnings). Never rely on sectioning elements to fix levels.

**Google.**
- Title links: Google builds a result's title from the `<title>`, the "main visual title", heading elements such as the H1, and other large, prominent text. It advises making the main title distinct and "the most prominent on the page", for example by putting it in the first visible `<h1>`.
- Order and count: "Having your headings in semantic order is fantastic for screen readers, but from Google Search perspective, it doesn't matter if you're using them out of order." "There's also no magical, ideal amount of headings a given page should have." (SEO Starter Guide; Gary Illyes, July 2024.)
- Multiple H1s cause Google no problems (John Mueller). Fixing heading order on an existing site "isn't going to change your site's rankings", but "it helps search engines lightly to better understand your content, and it's good for accessibility" (Mueller, September 2024).
- Mueller has also said a heading is "a really strong signal" that the part of the page under it is about that topic. That makes heading wording, the H1 above all, the SEO lever. The tag order matters for accessibility and clarity.
- AI features (Google's generative AI optimization guide, updated July 2026): pages should have "headings that provide a clear structure". There is "no requirement to break your content into tiny pieces for AI", and no special AI files or markup are needed. So: plain, well-structured, people-first headings, with no gimmicks.

**Ahrefs on H1s and keywords.**
- Title tags drive clicks and H1s give context. Put the target keyword in the H1 when it reads naturally. Keep H1s under about 70 characters. Match the H1 to what the top-ranking results show searchers want.
- Secondary keywords belong in subheadings "when they represent subtopics worth covering". Don't stuff keywords where they don't fit.

**Takeaway for clients:** correct tags are accessibility and hygiene work, and they help machines read the page. They won't move rankings on their own. The ranking lever is the wording of the H1 and the main H2s, chosen from real keyword research, with one page per keyword.

Sources:
- WebAIM Survey #10: https://webaim.org/projects/screenreadersurvey10/
- W3C WAI headings tutorial: https://www.w3.org/WAI/tutorials/page-structure/headings/
- MDN heading elements: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/Heading_Elements
- MDN on h1 default style changes: https://developer.mozilla.org/en-US/blog/h1-element-styles/
- WHATWG PR removing the outline algorithm: https://github.com/whatwg/html/pull/7829
- Google title links: https://developers.google.com/search/docs/appearance/title-link
- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google AI optimization guide: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- SEJ on Illyes, July 2024: https://www.searchenginejournal.com/google-clarifies-h1-h6-headings-for-seo/522454/
- SEJ on Mueller, September 2024: https://www.searchenginejournal.com/google-says-fixing-headings-wont-change-rankings/526639/
- SEJ on Mueller and multiple H1s: https://www.searchenginejournal.com/h1-headings-for-google/406720/
- Ahrefs, H1 tag: https://ahrefs.com/blog/h1-tag
- Ahrefs, secondary keywords: https://ahrefs.com/blog/secondary-keywords/

## B. House rules

These rules are stricter than Google's minimum on purpose: one standard that serves accessibility, Google and AI answers at once.

### The H1
1. **Exactly one H1 per page.**
2. **It is the main visible title.** That is usually the hero title and the first heading in the main content. It is never the logo, never in the nav, and never a hidden element when a visible title exists.
3. **It says what the page is about**, in the words a buyer searches. A tagline that names no service ("Built for what's next") is a weak H1. In the Live map, keep it and add a suggestion. In the Optimization plan, rewrite it.
4. **It carries the page's primary keyword, naturally** (Optimization plan). In the Live map, flag any H1 that lacks it.
5. **It is unique across the site.** No two pages share an H1 or target the same primary keyword in their H1s.
6. **70 characters or fewer.** No trailing period unless the brand writes every headline that way.
7. **It matches the `<title>` topic.** The wording can differ, but both describe the same page.
8. **CMS template pages** (blog posts, locations, team members): the H1 is bound to the item's name or title field. The page type decides which field.

### H2–H6
9. **H2 for each main section. H3 for items inside an H2 section. H4 only inside an H3.** Never skip a level going down (H2 straight to H4). Going back up to start a new section is fine.
10. **Pick the tag by structure, never by size.** The look comes from the class. A small pill label can be an H2 and a big stat can be plain text.
11. **Text that titles content beneath it is a heading.** That covers section titles, card titles with a description, FAQ questions, process steps and tab-panel titles.
12. **These are not headings:** eyebrows and overlines, the subheading line under an H1, stats and big numbers, buttons, links, tab and carousel controls, form labels, checklist items, bold lead-ins inside a paragraph, testimonial quotes and names, logo-strip captions, nav labels, footer column titles, cookie banners and modals.
13. **A big centred title that starts a visually separate block is an H2**, even when it sits inside the same `<section>` as an earlier H2 and its card grid. The cards under it become H3s.
14. **Descriptive, unique on the page, clean.** No duplicate headings on one page, no trailing colons or periods, one casing style across the site. In the Live map, list violations as suggestions.
15. **Global chrome carries no headings.** The nav, mega-menu, footer, cookie banner and popups should not contain H1–H6, so every page's outline starts with its own H1. If they do, retag them to text.
16. **Repeated components take the same level everywhere.** A footer CTA or logo band is usually an H2. If it's a component, fix it once.
17. **Don't create heading bloat.** Many tiny repeated feature labels (for example six features × four tabs) stay as bold text. Tag them only when each has real content and the outline stays readable.
18. **Heading text should be at most about 60 characters** for H2 and below, unless it's a question.

## C. Edge cases

- **Tabs**: tab buttons are not headings. Each panel's content is in the DOM, so give each panel an H3 title (Optimization plan) or suggest adding one (Live map).
- **Accordions and FAQs**: each question is an H3 (or H2 when the FAQ is the page's main content), with the heading wrapping the toggle button. Answers stay as paragraphs.
- **Carousels and sliders**: slide titles that head content are headings. Duplicated slides (clones made for looping) must not add duplicate headings. Flag them if they do.
- **Responsive duplicates**: when desktop and mobile versions of a block both exist in the DOM with one hidden, both carry heading tags. Flag this. Only one element should carry the heading, or the hidden one should be text.
- **Visually hidden headings**: allowed only to label a section that has no visible title, and never as the H1 when a visible title exists. Never use them to insert keywords.
- **Hero sliders with several headlines**: only the first or main slide's headline is the H1. The others are text or H2s.
- **Logos**: never wrap the logo in an H1. This is common in WordPress themes, where the site title is an H1 on every page. Flag it.
- **Sidebars and widgets** (WordPress): widget titles are often H2/H3 and pollute the outline. Suggest turning them to text, or leave them at a level below the main content.
- **Legal pages**: one H1 plus an H2 per section is enough.

## D. Platform how-to (for the guide's "Applying it" section)

- **Webflow**: select the heading, then Settings panel (D) → Heading Settings → H1–H6. A Div, Text Block or Paragraph may not switch to a heading. If not, drag a Heading element next to it, give it the same class(es), paste the same text and delete the old element. Components (Symbols) update everywhere. Rich Text (CMS) headings are edited in the CMS item.
- **WordPress (Gutenberg)**: select the Heading block and change the level in the toolbar. A Paragraph block becomes a heading via Transform → Heading. Theme templates (site title, widget titles) are edited in the Site Editor or the theme files. Page builders (Elementor and others) set the HTML tag in the widget's settings.
- **Shopify**: headings live in theme sections. Where the section schema has a heading tag setting, use it. Otherwise edit the section's Liquid file. The product title is the H1 in the product template.
- **Wix**: select the text, then Text settings → the Heading 1–6 / Paragraph style. The "SEO settings" → "HTML tag" option lets a heading keep its look while changing its tag.

## E. Writing headings (Optimization plan)

- Lead with the term buyers use, then the brand flavour: "Office Cleaning for Chicago Workplaces" rather than "Elevate Your Workspace".
- Industry and location pages combine the service with a modifier ("Cleaning Services for Medical Clinics"). The bare service term belongs to the service page.
- Where a section already answers the question, phrase its H2 or H3 as that question ("What Is Day Porter Service?"). Take the question from Ahrefs question keywords or People Also Ask. Don't turn every heading into a question.
- Keep the client's voice and claims. Never invent services, locations, numbers or awards.
- Each rewrite carries a one-line reason naming the keyword or problem it fixes.
