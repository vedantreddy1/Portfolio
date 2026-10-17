import { DEFAULT_CONTENT } from '../data/defaultContent';

export function hydrateContent(remote) {
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return structuredClone(DEFAULT_CONTENT);
  return {
    ...structuredClone(DEFAULT_CONTENT),
    ...remote,
    profile: { ...DEFAULT_CONTENT.profile, ...(remote.profile || {}) },
    contact: { ...DEFAULT_CONTENT.contact, ...(remote.contact || {}) },
    metrics: Array.isArray(remote.metrics) ? remote.metrics : structuredClone(DEFAULT_CONTENT.metrics),
    projects: Array.isArray(remote.projects) ? remote.projects : structuredClone(DEFAULT_CONTENT.projects),
    services: Array.isArray(remote.services) ? remote.services : structuredClone(DEFAULT_CONTENT.services),
    brands: Array.isArray(remote.brands) ? remote.brands : structuredClone(DEFAULT_CONTENT.brands),
    testimonials: Array.isArray(remote.testimonials) ? remote.testimonials : [],
    press: Array.isArray(remote.press) ? remote.press : structuredClone(DEFAULT_CONTENT.press),
    faqs: Array.isArray(remote.faqs) ? remote.faqs : structuredClone(DEFAULT_CONTENT.faqs),
    advantages: Array.isArray(remote.advantages) ? remote.advantages : structuredClone(DEFAULT_CONTENT.advantages),
    categories: Array.isArray(remote.categories) ? remote.categories : [...DEFAULT_CONTENT.categories]
  };
}

export function downloadJson(content) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `kawalpreet-portfolio-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
}
