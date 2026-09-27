/**
 * CRD GLOBAL SOLUTIONS – MAIN JAVASCRIPT
 * Handles: sticky header, mobile nav, login modal,
 *          form validation, scroll animations, active nav tracking
 */

'use strict';

/* ================================================================
   DOM READY
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {

  // ----------------------------------------------------------------
  // STICKY HEADER – add class on scroll
  // ----------------------------------------------------------------
  const header = document.getElementById('site-header');
  let lastScroll = 0;

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 20);
    lastScroll = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load

  // ----------------------------------------------------------------
  // MOBILE NAV – hamburger toggle
  // ----------------------------------------------------------------
  const hamburger = document.getElementById('hamburger');
  const mainNav   = document.getElementById('main-nav');

  const closeNav = () => {
    hamburger.setAttribute('aria-expanded', 'false');
    mainNav.classList.remove('open');
    document.body.style.overflow = '';
  };

  const openNav = () => {
    hamburger.setAttribute('aria-expanded', 'true');
    mainNav.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
    isOpen ? closeNav() : openNav();
  });

  // Close nav when a link is clicked
  mainNav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeNav);
  });

  // Close nav on outside click
  document.addEventListener('click', e => {
    if (!header.contains(e.target) && mainNav.classList.contains('open')) {
      closeNav();
    }
  });

  // Close nav on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mainNav.classList.contains('open')) closeNav();
  });

  // ----------------------------------------------------------------
  // LOGIN MODAL – portal coming soon
  // ----------------------------------------------------------------
  const loginBtn    = document.getElementById('login-btn');
  const loginModal  = document.getElementById('login-modal');
  const modalClose  = document.getElementById('modal-close');
  const modalDismiss= document.getElementById('modal-dismiss');

  const openModal = (e) => {
    e.preventDefault();
    loginModal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose.focus();
    closeNav(); // close mobile nav if open
  };

  const closeModal = () => {
    loginModal.hidden = true;
    document.body.style.overflow = '';
    loginBtn.focus();
  };

  loginBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modalDismiss.addEventListener('click', closeModal);

  // Close modal on overlay click
  loginModal.addEventListener('click', e => {
    if (e.target === loginModal) closeModal();
  });

  // Close modal on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !loginModal.hidden) closeModal();
  });

  // Trap focus in modal
  loginModal.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusable = loginModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });

  // ----------------------------------------------------------------
  // ACTIVE NAV LINK – highlight based on scroll position
  // ----------------------------------------------------------------
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = [];

  navLinks.forEach(link => {
    const id = link.getAttribute('href')?.slice(1);
    if (id) {
      const el = document.getElementById(id);
      if (el) sections.push({ id, el, link });
    }
  });

  const updateActiveNav = () => {
    const scrollMid = window.scrollY + window.innerHeight * 0.4;
    let current = sections[0];

    sections.forEach(s => {
      if (s.el.offsetTop <= scrollMid) current = s;
    });

    navLinks.forEach(l => l.classList.remove('active'));
    if (current) current.link.classList.add('active');
  };

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  // ----------------------------------------------------------------
  // SCROLL ANIMATIONS – IntersectionObserver
  // ----------------------------------------------------------------
  const animatedEls = document.querySelectorAll('[data-animate]');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el    = entry.target;
        const delay = parseInt(el.dataset.delay || '0', 10);
        setTimeout(() => el.classList.add('animated'), delay);
        observer.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    animatedEls.forEach(el => observer.observe(el));
  } else {
    // Fallback for older browsers
    animatedEls.forEach(el => el.classList.add('animated'));
  }

  // ----------------------------------------------------------------
  // ENQUIRY FORM – validation + success message
  // ----------------------------------------------------------------
  const form        = document.getElementById('enquiry-form');
  const successMsg  = document.getElementById('form-success');
  const submitBtn   = document.getElementById('submit-btn');

  if (form) {
    const validators = {
      name: (v) => v.trim().length >= 2 ? '' : 'Please enter your full name.',
      mobile: (v) => /^[6-9][0-9]{9}$/.test(v.trim()) ? '' : 'Enter a valid 10-digit Indian mobile number.',
      city: (v) => v.trim().length >= 2 ? '' : 'Please enter your city or district.',
    };

    const getError = (el) => el.parentElement.querySelector('.field-error');

    const validateField = (field) => {
      const v = validators[field.name];
      if (!v) return true;
      const msg = v(field.value);
      const errEl = getError(field);
      if (errEl) errEl.textContent = msg;
      field.classList.toggle('error', !!msg);
      field.setAttribute('aria-invalid', !!msg);
      return !msg;
    };

    // Live validation on blur
    form.querySelectorAll('input, select, textarea').forEach(field => {
      field.addEventListener('blur', () => validateField(field));
      field.addEventListener('input', () => {
        if (field.classList.contains('error')) validateField(field);
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Validate all required fields
      let valid = true;
      ['name', 'mobile', 'city'].forEach(name => {
        const field = form.elements[name];
        if (!validateField(field)) valid = false;
      });

      if (!valid) {
        // Focus first error
        const firstErr = form.querySelector('.error');
        if (firstErr) firstErr.focus();
        return;
      }

      // Disable button to prevent double submit
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';

      /**
       * FUTURE INTEGRATION:
       * Replace the setTimeout below with a real fetch() to your backend:
       *
       * const data = new FormData(form);
       * fetch('/api/enquiry', { method: 'POST', body: data })
       *   .then(r => r.json())
       *   .then(showSuccess)
       *   .catch(showError);
       */
      setTimeout(() => {
        form.reset();
        form.style.display = 'none';
        successMsg.hidden = false;
        successMsg.focus();
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Submit Enquiry`;
      }, 900);
    });
  }

  // ----------------------------------------------------------------
  // SMOOTH SCROLL – polyfill for anchor links
  // ----------------------------------------------------------------
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY
                  - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h') || '72');
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ----------------------------------------------------------------
  // HERO SECTION – stagger animation on load
  // ----------------------------------------------------------------
  const heroText = document.querySelector('.hero-text');
  if (heroText) {
    heroText.style.transition = 'opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1)';
    heroText.style.opacity = '0';
    heroText.style.transform = 'translateY(30px)';
    requestAnimationFrame(() => {
      setTimeout(() => {
        heroText.style.opacity = '1';
        heroText.style.transform = 'none';
      }, 200);
    });
  }

  // ----------------------------------------------------------------
  // PERFORMANCE: Lazy-load the Google Maps iframe
  // ----------------------------------------------------------------
  const mapIframe = document.querySelector('.map-wrap iframe');
  if (mapIframe && 'IntersectionObserver' in window) {
    const src = mapIframe.getAttribute('src');
    mapIframe.removeAttribute('src');
    const mapObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          mapIframe.setAttribute('src', src);
          mapObserver.unobserve(mapIframe);
        }
      });
    }, { rootMargin: '200px' });
    mapObserver.observe(mapIframe);
  }

  // ----------------------------------------------------------------
  // UTILITY: Log info in dev (remove in production)
  // ----------------------------------------------------------------
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.info(
      '%cCRD Global Solutions Website',
      'background:#1A3C6E;color:#fff;padding:4px 12px;border-radius:4px;font-weight:bold;',
      '\nDevelopment mode. Login portal is a placeholder. Backend integration pending.'
    );
  }

});

/* ================================================================
   /login ROUTE HANDLER (future-ready)
   When the site is served as an SPA or with routing, this function
   can be called to redirect to the actual portal URL.
   ================================================================ */
window.CRDPortal = {
  /**
   * Redirect to the login portal.
   * In future, replace the URL with the actual software portal URL.
   */
  redirectToLogin: function () {
    window.location.href = '/login';
  },

  /**
   * Check if user is authenticated (placeholder).
   * Replace with real auth check using JWT/session.
   */
  isAuthenticated: function () {
    return false; // TODO: integrate with auth system
  },
};
