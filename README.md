# CRD GLOBAL SOLUTIONS – WEBSITE README

## Project Structure

```
d:\CRD GLOBAL\
├── index.html              ← Main homepage
├── login.html              ← Portal "Coming Soon" placeholder (/login)
├── README.md               ← This file
└── assets\
    ├── css\
    │   └── style.css       ← All styles (responsive, brand colors)
    ├── js\
    │   └── main.js         ← Navigation, modal, form, animations
    └── images\             ← Drop logo and other images here
        └── (empty – add crd-logo.png or .svg here)
```

---

## ⚠️ IMPORTANT: Logo Setup

The website currently uses an **SVG text/icon placeholder** for the CRD Global Solutions logo.

**To use your actual logo:**

1. Place your logo file (PNG or SVG) in:
   ```
   d:\CRD GLOBAL\assets\images\crd-logo.png
   ```
2. In `index.html`, find the comment:
   ```html
   <!-- LOGO PLACEHOLDER: Replace the SVG below ... -->
   ```
3. Replace the entire `<div class="logo-svg">` block with:
   ```html
   <img src="assets/images/crd-logo.png"
        alt="CRD Global Solutions"
        class="logo-img"
        width="180" height="60" />
   ```
4. Do the same for the footer logo (search for `footer-logo` in `index.html`).

---

## Google Maps Integration

In `index.html`, find the `<iframe>` in the Contact section.
Replace the `src` attribute with your actual Google Maps embed URL:

1. Open Google Maps
2. Search: **CRD Global Solutions, Etawah** (or pin your exact address)
3. Click **Share → Embed a map → Copy iframe**
4. Paste only the `src="..."` URL into the iframe in `index.html`

---

## LOGIN / PORTAL INTEGRATION (Future)

- The **LOGIN button** in the header currently opens a "Portal Coming Soon" modal.
- The `/login` URL serves `login.html` (coming soon page).
- When your solar management software is ready:
  1. Replace the modal with a redirect: `window.location.href = 'https://portal.crdglobalsolutions.com'`
  2. OR replace `login.html` with your actual login form connected to your backend.
  3. The `window.CRDPortal` object in `main.js` is ready for auth integration.

---

## Enquiry Form Backend (Future)

The enquiry form currently shows a success message without sending data anywhere.

To connect it to a backend or email service:

**Option A: EmailJS (no backend needed)**
```js
emailjs.send('YOUR_SERVICE', 'YOUR_TEMPLATE', formData);
```

**Option B: Custom API**
```js
fetch('/api/enquiry', { method: 'POST', body: new FormData(form) })
```

In `main.js`, find the comment:
```js
// FUTURE INTEGRATION: Replace the setTimeout below with a real fetch()
```
And replace the `setTimeout` block.

---

## Brand Colors

| Token          | Color    | Hex       |
|----------------|----------|-----------|
| Blue (Primary) | Navy     | `#1A3C6E` |
| Blue (Dark)    | Dark Navy| `#0B2545` |
| Green          | Energy   | `#27AE60` |
| Yellow         | Sun      | `#F5A623` |
| White          | Clean    | `#FFFFFF` |

---

## Browser Support

- Chrome, Firefox, Edge, Safari (last 2 versions)
- Mobile: iOS Safari, Android Chrome
- No external CSS framework dependencies
- No jQuery – vanilla JS only

---

## Deployment

### Static Hosting (Netlify / Vercel / cPanel)

Simply upload the entire `d:\CRD GLOBAL\` folder.

### Custom Domain

Set DNS A record to your hosting server.
Point `www.crdglobalsolutions.com` to the uploaded folder.

### Future URL Structure

```
https://www.crdglobalsolutions.com/          → index.html (homepage)
https://www.crdglobalsolutions.com/login     → login.html → future portal
```

---

© 2026 CRD Global Solutions. Etawah, Uttar Pradesh.
