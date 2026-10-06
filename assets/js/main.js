/**
 * CRD GLOBAL SOLUTIONS - CORE ENGINE & DYNAMIC RENDERER
 * Supports live rendering from CRD_SITE_DATA & in-browser Admin Edit modal
 */

'use strict';

// 1. Data Loader & State Management (Loads default or localStorage data)
function getSiteData() {
  const saved = localStorage.getItem('CRD_CUSTOM_DATA');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn("Could not parse saved custom data, reverting to defaults", e);
    }
  }
  return window.CRD_SITE_DATA;
}

function saveSiteData(newData) {
  localStorage.setItem('CRD_CUSTOM_DATA', JSON.stringify(newData));
  renderAllSections();
}

function resetSiteData() {
  localStorage.removeItem('CRD_CUSTOM_DATA');
  renderAllSections();
}

// 2. Render Functions
function renderAllSections() {
  const data = getSiteData();
  
  // Render Top Header Contact & Brand
  renderTopHeader(data.company);
  
  // Render Hero
  renderHero(data.hero, data.company);
  
  // Render Quick Categories (6 Top Cards)
  renderQuickCategories(data.quickCategories);
  
  // Render Our Solar Solutions (8 Icons Grid)
  renderSolutions(data.solutions);
  
  // Render Popular Products (6 Product Cards)
  renderProducts(data.products, data.company);
  
  // Render Banners (PM Surya Ghar & Solar Pump)
  renderBanners(data.banners, data.company);
  
  // Render Why Choose Us (6 Features)
  renderWhyChooseUs(data.whyChooseUs);
  
  // Render Projects Gallery (6 Cards)
  renderProjects(data.projects);
  
  // Render Testimonials (Customer Reviews)
  renderTestimonials(data.testimonials);
  
  // Render About & Location
  renderAboutAndLocation(data.about, data.company);
  
  // Render Footer
  renderFooter(data.company);

  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderTopHeader(c) {
  const brandLogo = document.getElementById('top-brand-logo');
  if (brandLogo) {
    brandLogo.src = c.logoImg || 'assets/images/crd-logo.jpg';
    brandLogo.alt = c.name;
  }
  
  const brandName = document.getElementById('top-brand-name');
  if (brandName) brandName.textContent = c.name;
  
  const brandSub = document.getElementById('top-brand-sub');
  if (brandSub) brandSub.textContent = c.logoSubtext || "Solar | Energy | Sustainable Future";
  
  const brandGst = document.getElementById('top-brand-gst');
  if (brandGst) brandGst.textContent = `GSTIN: ${c.gstNo}`;
  
  const callValue = document.getElementById('top-call-value');
  if (callValue) {
    callValue.innerHTML = `<a href="tel:+91${c.phone1}">${c.phone1}</a> / <a href="tel:+91${c.phone2}">${c.phone2}</a>`;
  }
  
  const emailValue = document.getElementById('top-email-value');
  if (emailValue) {
    emailValue.innerHTML = `<a href="mailto:${c.email}">${c.email}</a>`;
  }
  
  const locValue = document.getElementById('top-loc-value');
  if (locValue) {
    locValue.textContent = `${c.address.line1}, ${c.address.line2}`;
  }
}

function renderHero(h, c) {
  const badge = document.getElementById('hero-badge-pill');
  if (badge) badge.innerHTML = `<i data-lucide="sun"></i> ${h.badge}`;
  
  const title = document.getElementById('hero-main-title');
  if (title) {
    title.innerHTML = `${h.headlineMain} <br/><span class="highlight-green">${h.headlineSub}</span>`;
  }
  
  const desc = document.getElementById('hero-subtitle-desc');
  if (desc) desc.textContent = h.description;
  
  const tagsContainer = document.getElementById('hero-feature-tags');
  if (tagsContainer && h.keyPoints) {
    tagsContainer.innerHTML = h.keyPoints.map(kp => `
      <div class="hero-tag">
        <i data-lucide="${kp.icon || 'check-circle'}"></i>
        <span>${kp.text}</span>
      </div>
    `).join('');
  }
  
  const ctaBtn = document.getElementById('hero-cta-btn');
  if (ctaBtn) {
    ctaBtn.textContent = h.ctaBtn || "Get Free Consultation →";
  }
  
  const waBtn = document.getElementById('hero-wa-btn');
  if (waBtn) {
    waBtn.href = `https://wa.me/91${c.phone1}?text=Hello%20CRD%20Global%20Solutions,%20I%20want%20to%20know%20more%20about%20Solar%20Solutions.`;
  }
}

function renderQuickCategories(cats) {
  const container = document.getElementById('quick-categories-grid');
  if (!container || !cats) return;
  
  container.innerHTML = cats.map(cat => `
    <a href="${cat.link || '#solutions'}" class="cat-card-item">
      <div class="cat-card-img-wrap">
        <img src="${cat.image}" alt="${cat.title}" loading="lazy" />
      </div>
      <div class="cat-card-content">
        <div class="cat-card-title">${cat.title}</div>
        <div class="cat-card-sub">${cat.subtitle}</div>
      </div>
    </a>
  `).join('');
}

function renderSolutions(solutions) {
  const container = document.getElementById('solutions-icon-grid');
  if (!container || !solutions) return;
  
  container.innerHTML = solutions.map(sol => `
    <div class="sol-icon-card" onclick="openEnquiryModal('${sol.title}')">
      <div class="sol-icon-box">
        <i data-lucide="${sol.icon || 'sun'}"></i>
      </div>
      <div class="sol-icon-title">${sol.title}</div>
    </div>
  `).join('');
}

function renderProducts(products, c) {
  const container = document.getElementById('products-cards-grid');
  if (!container || !products) return;
  
  container.innerHTML = products.map(p => `
    <div class="product-item-card">
      <div class="prod-img-box">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
      </div>
      <div class="prod-info-box">
        <div class="prod-name-title">${p.name}</div>
        <div class="prod-brand-tag">${p.brand}</div>
        <div class="prod-price-tag">${p.price}</div>
        <button class="btn-enquire-card" onclick="enquireProduct('${p.name}', '${p.whatsappMsg}')">
          Enquire Now
        </button>
      </div>
    </div>
  `).join('');
}

function renderBanners(b, c) {
  // PM Surya Ghar
  const pmTitle = document.getElementById('pm-banner-title');
  if (pmTitle) pmTitle.textContent = b.pmSuryaGhar.title;
  
  const pmHead = document.getElementById('pm-banner-headline');
  if (pmHead) pmHead.textContent = b.pmSuryaGhar.headline;
  
  const pmPerks = document.getElementById('pm-banner-perks');
  if (pmPerks && b.pmSuryaGhar.perks) {
    pmPerks.innerHTML = b.pmSuryaGhar.perks.map(pk => `
      <div class="banner-perk-item">
        <span class="perk-bold">${pk.label}</span>
        <span class="perk-sub">${pk.desc}</span>
      </div>
    `).join('');
  }
  
  // Solar Water Pump
  const pumpTitle = document.getElementById('pump-banner-title');
  if (pumpTitle) pumpTitle.textContent = b.solarPump.title;
  
  const pumpSub = document.getElementById('pump-banner-sub');
  if (pumpSub) pumpSub.textContent = b.solarPump.subtitle;
  
  const pumpBtn = document.getElementById('pump-banner-btn');
  if (pumpBtn) {
    pumpBtn.onclick = () => {
      window.open(`https://wa.me/91${c.phone1}?text=${encodeURIComponent(b.solarPump.whatsappMsg)}`, '_blank');
    };
  }
}

function renderWhyChooseUs(list) {
  const container = document.getElementById('why-crd-grid');
  if (!container || !list) return;
  
  container.innerHTML = list.map(item => `
    <div class="why-crd-card">
      <div class="why-icon-round">
        <i data-lucide="${item.icon || 'check-circle'}"></i>
      </div>
      <div class="why-card-title">${item.title}</div>
      <div class="why-card-desc">${item.desc}</div>
    </div>
  `).join('');
}

function renderProjects(projects) {
  const container = document.getElementById('projects-gallery-grid');
  if (!container || !projects) return;
  
  container.innerHTML = projects.map(p => `
    <div class="project-card-item">
      <div class="proj-img-wrap">
        <img src="${p.image}" alt="${p.title}" loading="lazy" />
      </div>
      <div class="proj-info-col">
        <div class="proj-title-txt">${p.title}</div>
        <div class="proj-loc-txt">${p.location} (${p.capacity})</div>
      </div>
    </div>
  `).join('');
}

function renderTestimonials(reviews) {
  const container = document.getElementById('reviews-grid-strip');
  if (!container || !reviews) return;
  
  container.innerHTML = reviews.map(r => `
    <div class="review-item-box">
      <div class="review-avatar-char">${r.initial}</div>
      <div class="review-text-wrap">
        <div class="reviewer-name">${r.name}</div>
        <div class="star-rating-row">★★★★★</div>
        <p class="review-comment-p">${r.comment}</p>
      </div>
    </div>
  `).join('');
}

function renderAboutAndLocation(about, c) {
  const aboutText = document.getElementById('about-summary-text');
  if (aboutText) aboutText.textContent = about.text;
  
  const aboutImg = document.getElementById('about-thumb-img');
  if (aboutImg && about.image) aboutImg.src = about.image;
  
  const locText = document.getElementById('location-summary-text');
  if (locText) {
    locText.textContent = `${c.address.line1}, ${c.address.line2}`;
  }
}

function renderFooter(c) {
  const ftName = document.getElementById('footer-company-name');
  if (ftName) ftName.textContent = c.name;
  
  const ftGst = document.getElementById('footer-gst-no');
  if (ftGst) ftGst.textContent = `GSTIN: ${c.gstNo}`;
  
  const ftPhone = document.getElementById('footer-phone');
  if (ftPhone) {
    ftPhone.innerHTML = `<a href="tel:+91${c.phone1}">+91 ${c.phone1}</a> / <a href="tel:+91${c.phone2}">+91 ${c.phone2}</a>`;
  }
  
  const ftEmail = document.getElementById('footer-email');
  if (ftEmail) {
    ftEmail.innerHTML = `<a href="mailto:${c.email}">${c.email}</a>`;
  }
  
  const ftAddr = document.getElementById('footer-address');
  if (ftAddr) {
    ftAddr.textContent = `${c.address.line1}, ${c.address.line2}`;
  }
  
  // Floating WA
  const floatWa = document.getElementById('floating-wa');
  if (floatWa) {
    floatWa.href = `https://wa.me/91${c.phone1}?text=Hello%20CRD%20Global%20Solutions,%20I%20have%20an%20enquiry.`;
  }
}

// 3. User Actions (Enquiry, WhatsApp, Modal Triggers)
function openEnquiryModal(serviceName = "Solar Consultation") {
  const modal = document.getElementById('enquiry-modal');
  const serviceInput = document.getElementById('enquiry-service-field');
  if (serviceInput) serviceInput.value = serviceName;
  if (modal) modal.classList.add('open');
}

function closeEnquiryModal() {
  const modal = document.getElementById('enquiry-modal');
  if (modal) modal.classList.remove('open');
}

function enquireProduct(prodName, defaultMsg) {
  const data = getSiteData();
  const phone = data.company.phone1;
  const msg = defaultMsg || `Hello CRD Global Solutions, I want to enquire about ${prodName}.`;
  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function handleEnquirySubmit(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value;
  const phone = form.phone.value;
  const service = form.service.value;
  const note = form.message.value;
  
  const data = getSiteData();
  const waMsg = `*New Website Enquiry - CRD Global Solutions*\n\n*Name:* ${name}\n*Phone:* ${phone}\n*Service/Product:* ${service}\n*Details:* ${note || 'N/A'}`;
  
  // Open WhatsApp with populated info
  window.open(`https://wa.me/91${data.company.phone1}?text=${encodeURIComponent(waMsg)}`, '_blank');
  
  alert("Thank you! Your enquiry details have been prepared for WhatsApp submission.");
  form.reset();
  closeEnquiryModal();
}

// 4. In-Browser Dynamic Editor for All Info (Admin Settings)
function openAdminEditor() {
  const data = getSiteData();
  const editorModal = document.getElementById('admin-editor-modal');
  
  document.getElementById('edit-company-name').value = data.company.name;
  document.getElementById('edit-phone1').value = data.company.phone1;
  document.getElementById('edit-phone2').value = data.company.phone2;
  document.getElementById('edit-email').value = data.company.email;
  document.getElementById('edit-gst').value = data.company.gstNo;
  document.getElementById('edit-address1').value = data.company.address.line1;
  document.getElementById('edit-address2').value = data.company.address.line2;
  document.getElementById('edit-logo-url').value = data.company.logoImg;
  
  // JSON RAW for all products/cards
  document.getElementById('edit-raw-json').value = JSON.stringify(data, null, 2);
  
  if (editorModal) editorModal.classList.add('open');
}

function closeAdminEditor() {
  const editorModal = document.getElementById('admin-editor-modal');
  if (editorModal) editorModal.classList.remove('open');
}

function saveAdminEditor(e) {
  e.preventDefault();
  try {
    // Attempt parse raw json if modified, else update form fields
    const rawInput = document.getElementById('edit-raw-json').value;
    let data = JSON.parse(rawInput);
    
    // Quick overrides from top inputs
    data.company.name = document.getElementById('edit-company-name').value;
    data.company.phone1 = document.getElementById('edit-phone1').value;
    data.company.phone2 = document.getElementById('edit-phone2').value;
    data.company.email = document.getElementById('edit-email').value;
    data.company.gstNo = document.getElementById('edit-gst').value;
    data.company.address.line1 = document.getElementById('edit-address1').value;
    data.company.address.line2 = document.getElementById('edit-address2').value;
    data.company.logoImg = document.getElementById('edit-logo-url').value;
    
    saveSiteData(data);
    alert("Website information updated successfully!");
    closeAdminEditor();
  } catch (err) {
    alert("Invalid JSON format in advanced editor: " + err.message);
  }
}

// 5. Mobile Menu Toggle
function toggleMobileNav() {
  const nav = document.getElementById('nav-links-menu');
  if (nav) nav.classList.toggle('open');
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  renderAllSections();
});
