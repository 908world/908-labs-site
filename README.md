# labs.908.world

The 908 Labs site, moved off Framer. It's plain static HTML, CSS and a little JavaScript, hosted on Vercel. There's no build step: edit a file, commit, and Vercel redeploys.

## Where things live

| Path | What it is |
| --- | --- |
| `index.html`, `about.html`, `projects.html`, `packages.html`, `contact-us.html`, `404.html` | Top-level pages |
| `projects/*.html` | Case-study pages (flee-fm, superlative, winnergy, sunfired, corey-jacobs) |
| `packages/starter-package/*.html` | Package detail pages |
| `css/framer-*.css` | The original Framer layout and typography styles, exported unchanged. Layout tweaks go here. |
| `css/components-*.css` | Extra Framer component styles, only needed by the phone menu on About |
| `css/site.css` | Hand-written additions: hover transitions, form spinner, smooth scroll |
| `js/site.js` | All interactions: text reveal, counters, logo ticker, 3D services carousel, hovers, phone menu, forms, smooth scroll |
| `js/lenis.min.js` | Smooth-scroll library (same as the Framer "Smooth Scroll" component) |
| `assets/img`, `assets/fonts` | Every image and font, self-hosted. `name-512.png` / `name-1024.png` are smaller copies for phones. |
| `api/contact.js` | Vercel function that emails form enquiries through Resend |
| `vercel.json` | Clean URLs (`/about` rather than `/about.html`) and caching |

## Editing text

Each section exists up to **three times** in the HTML, once per breakpoint (desktop ≥1440px, tablet 810–1439px, phone <810px), exactly as Framer built it. The copies sit in wrappers like `<div class="ssr-variant hidden-72rtr7">`. To change a line of copy, search the page for it and update every copy.

- **Animated headings** (`data-fx="chars"`): edit the text normally. `site.js` splits it into letters at runtime.
- **Counters**: change `data-counter-end="15"` and the number inside the span.
- **Services carousel labels**: they're in the pills' HTML. The fourth pill's label list sits in `site.js` → `initCarousels` (`labels`).

## Editing images

Replace the file in `assets/img/` and keep the filename. If you use a new filename, update `src` and `srcset` everywhere it appears.

## Forms

Every form (the footer "Get in Touch", Contact, and the three package enquiry forms) posts to `/api/contact`. That function:

1. emails the enquiry to you (reply-to is set to the sender), and
2. sends the person a branded confirmation email with a copy of what they sent.

Each form says where it came from, and the enquiry email subject starts with it in brackets so you can filter your inbox:

| Form | Subject starts with |
| --- | --- |
| Starter / Studio / World package pages | `[Starter Package]`, `[Studio Package]`, `[World Package]` |
| Contact page | `[Contact page]` |
| Footer "Get in Touch" (every page) | `[General enquiry]` |

The email also has an "Enquiry" row, a Resend tag (`form: starter-package` etc.) and an `X-908-Form` header. Package enquirers get a confirmation that names their package. The labels are set in `build.py` → `PACKAGE_FORMS`, written into each `<form data-form="…">`.

Every field is required. On the contact forms, "Phone no." was replaced by a Message box. The confirmation text lives in `api/contact.js` → `confirmationHtml` (it promises a reply "within two working days"; edit it to suit).

Settings live in Vercel → Project → Settings → Environment Variables:

- `RESEND_API_KEY`: your Resend key (required)
- `CONTACT_TO`: where enquiries go (default `labs@908.world`)
- `CONTACT_FROM`: a sender on a domain you've verified in Resend, e.g. `908 Labs <hello@908.world>`. **Confirmation emails only go out once this is set.** Until the domain is verified, Resend only delivers to your own Resend inbox.

After changing a variable, redeploy (Vercel → Deployments → ⋯ → Redeploy).

## Wording

Sitewide positioning is "design & development agency" (page titles, social previews, hero tagline). The swaps live in `build.py` → `COPY_CHANGES`.

## Fonts

Headlines and buttons use **Helvetica Now Text**, and all body copy uses **Apfel Grotezk**. The Apfel override lives at the bottom of `css/site.css`.

## Links

- The "View Live Site" buttons on the case studies link to each project's live site. Superlative has no URL yet: add one to its button in `projects/superlative.html` (the `<a` just before "View Live Site").
- The footer Instagram icon links to @908world.
- Every project card links to its case study.

## Carried over from the live Framer site as-is

- The nav shows "Projects (06)", but there are five project pages.
- On About, the phone menu's fourth link reads "Journal" and goes to /packages.
