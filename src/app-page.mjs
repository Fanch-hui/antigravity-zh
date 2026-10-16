export function isAppPath(pathname) {
  if (['/', '/index.html', '/history', '/settings', '/sidecars', '/customizations',
    '/multi', '/new-project', '/onboarding', '/artifact', '/s',
    '/settings-standalone', '/terminal-standalone'].includes(pathname)) return true;
  return [
    /^\/(?:c|view|battle|sidecars|customizations\/sidecars)\/[^/]+\/?$/,
    /^\/sidecars\/triggers\/[^/]+\/?$/,
    /^\/customizations\/plugins\/[^/]+\/?$/,
    /^\/customizations\/marketplaces\/[^/]+\/(?:plugins|skills|bundles)\/[^/]+\/?$/,
    /^\/forked\/[^/]+\/[^/]+\/?$/,
  ].some(pattern => pattern.test(pathname));
}
