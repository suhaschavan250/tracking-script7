(function () {
  // Ensure gtag is globally available
  window.gtag = window.gtag || function () {
    console.log('gtag function is not available');
  };

  // Fetch the config from the URL parameters
  function getConfigFromQuery() {
    const scripts = document.querySelectorAll('script');
    const trackingScript = Array.from(scripts).find(s => s.src && s.src.includes('tracking-script5'));

    if (!trackingScript || !trackingScript.src.includes('?')) {
      console.log('[Tracking] Tracking script not found or missing query params.');
      return {};
    }

    const src = trackingScript.src;
    const queryString = src.substring(src.indexOf('?') + 1);
    const params = new URLSearchParams(queryString);

    const config = {
      facebookPixelId: params.get('facebookPixelId'),
      googleAdsId: params.get('googleAdsId'),
      scroll20ConversionId: params.get('scroll20ConversionId'),
      scroll50ConversionId: params.get('scroll50ConversionId'),
      anyClickConversionId: params.get('anyClickConversionId'),
      ctaClickConversionId: params.get('ctaClickConversionId'),
      ga4MeasurementId: params.get('ga4Id'),
      tiktokPixelId: params.get('tiktokPixelId'),
      ctaText: (params.get('ctaText') || "").trim()
    };

    console.log('[Tracking] Config from query:', config);
    return config;
  }

  const CONFIG = getConfigFromQuery();

  // Send GA4 config
  try {
    gtag('config', CONFIG.ga4MeasurementId);
  } catch (e) {
    console.log('[Tracking] gtag config failed:', e);
  }

  const scrollTracked = { '20': false, '50': false };

  // Check if the necessary pixel functions are ready
  function pixelsReady() {
    return (
      typeof fbq === 'function' ||
      typeof window.gtag === 'function' ||
      typeof ttq === 'function'
    );
  }

  // Get current scroll percentage
  function getScrollPercent() {
    const doc = document.documentElement;
    const scrollTop = window.pageYOffset || doc.scrollTop;
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    return Math.round((scrollTop / scrollHeight) * 100);
  }

  // Send event to all platforms
  function sendToAllPlatforms(eventName, data = {}) {
    console.log(`[Tracking] Sending event "${eventName}"`, data);

    // Facebook Pixel
    if (typeof fbq === 'function' && CONFIG.facebookPixelId) {
      fbq('trackCustom', eventName, data);
      console.log(`[Tracking] Sent to Facebook: ${eventName}`);
    } else {
      console.log(`[Tracking] Facebook not ready or missing ID: ${eventName}`);
    }

    // Google Ads
    if (typeof window.gtag === 'function' && CONFIG.googleAdsId) {
      let conversionId = null;
      if (eventName === 'scroll_20') conversionId = CONFIG.scroll20ConversionId;
      if (eventName === 'scroll_50') conversionId = CONFIG.scroll50ConversionId;
      if (eventName === 'any_click') conversionId = CONFIG.anyClickConversionId;
      if (eventName === 'any_cta') conversionId = CONFIG.ctaClickConversionId;

      if (conversionId) {
        window.gtag('event', 'conversion', { 'send_to': `${CONFIG.googleAdsId}/${conversionId}` });
        console.log(`[Tracking] Sent to Google Ads: ${eventName}`);
      } else {
        console.log(`[Tracking] No Google Ads conversion ID for: ${eventName}`);
      }
    } else {
      console.log(`[Tracking] window.gtag not ready or Google Ads ID missing: ${eventName}`);
    }

    // Google Analytics 4 (GA4)
    if (typeof window.gtag === 'function' && CONFIG.ga4MeasurementId) {
      window.gtag('event', eventName, data);
      console.log(`[Tracking] Sent to GA4: ${eventName}`);
    } else {
      console.log(`[Tracking] GA4 measurement ID missing or window.gtag not ready: ${eventName}`);
    }

    // TikTok Pixel
    if (typeof ttq === 'function' && CONFIG.tiktokPixelId) {
      ttq.track(eventName, data);
      console.log(`[Tracking] Sent to TikTok: ${eventName}`);
    } else {
      console.log(`[Tracking] TikTok not ready or missing ID: ${eventName}`);
    }
  }

  // Handle scroll events
  function handleScroll() {
    const percent = getScrollPercent();

    if (!scrollTracked['20'] && percent >= 20) {
      sendToAllPlatforms('scroll_20', { percent, url: window.location.href });
      scrollTracked['20'] = true;
    }

    if (!scrollTracked['50'] && percent >= 50) {
      sendToAllPlatforms('scroll_50', { percent, url: window.location.href });
      scrollTracked['50'] = true;
    }

    if (scrollTracked['20'] && scrollTracked['50']) {
      window.removeEventListener('scroll', debounceScroll);
    }
  }

  let scrollTimeout = null;
  function debounceScroll() {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      handleScroll();
      scrollTimeout = null;
    }, 200);
  }

  // Normalize strings for comparison
  function normalize(str) {
    return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // Handle click events
  function handleClick(event) {
    const clickedText = (event.target.textContent || '').trim();
    const url = window.location.href;
    const clickedNormalized = normalize(clickedText);
    const expected = normalize(CONFIG.ctaText);

    console.log('[Tracking] Clicked Text:', `"${clickedText}"`);
    console.log('[Tracking] CTA Text:', `"${CONFIG.ctaText}"`);
    console.log('[Tracking] Normalized Match:', clickedNormalized === expected);

    sendToAllPlatforms('any_click', {
      url,
      text: clickedText.slice(0, 100)
    });

    if (clickedNormalized === expected) {
      sendToAllPlatforms('any_cta', {
        url,
        text: clickedText.slice(0, 50)
      });
    }
  }

  // Initialize event listeners
  function initListeners() {
    window.addEventListener('scroll', debounceScroll, { passive: true });
    setTimeout(handleScroll, 1000);
    document.addEventListener('click', handleClick);
  }

  // Start tracking when the document is ready
  function startTracking() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initListeners();
    } else {
      window.addEventListener('DOMContentLoaded', initListeners);
    }
  }

  // Wait for pixels to be ready before starting tracking
  function waitForPixels() {
    let attempts = 0;
    const interval = setInterval(() => {
      if (pixelsReady()) {
        clearInterval(interval);
        console.log('[Tracking] Pixels detected, starting tracking.');
        startTracking();
      } else if (attempts++ >= 40) {
        clearInterval(interval);
        console.log('[Tracking] Pixels not detected after waiting, starting anyway.');
        startTracking();
      }
    }, 500);
  }

  waitForPixels();
})();
