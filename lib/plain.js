// Error messages in plain words: what happened and what to do, instead of a browser or network code.
/** The plain version of an error, or its first line when there's nothing better to say. */
function plain(e) {
  // Node's fetch says only "fetch failed"; the reason is in its cause.
  const m = String((e && e.message) || e || '') + (e && e.cause ? ' ' + (e.cause.code || e.cause.message || '') : '');
  if (/ERR_INTERNET_DISCONNECTED|ENETUNREACH|EAI_AGAIN/.test(m)) return 'This Mac seems to be offline. Check the internet connection and try again.';
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND/.test(m)) return 'We couldn’t find that site. Check the address for typos.';
  if (/ERR_CONNECTION|ECONNREFUSED|ECONNRESET/.test(m)) return 'The site didn’t respond. Check that it’s online, then try again.';
  if (/ERR_CERT|SSL|certificate/i.test(m)) return 'The site’s security certificate isn’t valid, so the browser won’t open it. Try the http:// address, or fix the certificate first.';
  if (/ERR_TOO_MANY_REDIRECTS/.test(m)) return 'The site keeps redirecting in a loop, so no page loads.';
  if (/Timeout|timed out/i.test(m)) return 'The site took too long to load. Try again, or scan fewer pages.';
  const http = m.match(/HTTP (\d{3})/);
  if (http && (http[1] === '401' || http[1] === '403')) return `The site blocked the scan (HTTP ${http[1]}). It may be password-protected or behind a firewall such as Cloudflare.`;
  if (http && http[1] === '404') return 'That address returned “page not found” (HTTP 404). Check the address.';
  if (http && http[1][0] === '5') return `The site had a server error (HTTP ${http[1]}). Try again in a few minutes.`;
  if (/CLOUDFLARE_CHALLENGE/.test(m)) return 'The site’s Cloudflare bot protection turned the scan away. Scan the staging address instead, or allow Groundwork in the site’s Cloudflare settings.';
  if (/rate.?limit|usage limit|\b429\b|quota/i.test(m)) return 'Your AI plan’s usage limit was reached. Try again when it resets; the pages already planned are kept.';
  if (/not logged in|login required|unauthori[sz]ed|invalid api key|authentication/i.test(m)) return 'Claude Code or Codex isn’t signed in any more. Open Settings, AI accounts, to sign in again.';
  if (/^fetch failed\s*$/i.test(m)) return 'The site didn’t respond. Check that it’s online, then try again.';
  if (/ECONNABORTED|EPIPE|socket hang up/i.test(m)) return 'The connection dropped part way. Try again.';
  if (/Target page, context or browser has been closed|Browser has been closed|browser.*closed/i.test(m)) return 'The scan browser closed part way, often because the Mac went to sleep. Try again.';
  if (/Executable doesn’t exist|Chrome.*not found|no browser/i.test(m)) return 'Groundwork needs Chrome or Edge on this Mac for scans and checks. Install one, then try again.';
  if (/ENOSPC/.test(m)) return 'This Mac is out of disk space. Free some up, then try again.';
  if (/EACCES|EPERM/.test(m)) return 'Groundwork wasn’t allowed to read or write a file it needs. Check the data folder’s permissions in Finder.';
  if (/^(page|frame|locator)\.\w+: /.test(m)) return plain(m.replace(/^(page|frame|locator)\.\w+: /, ''));
  return m.split('\n')[0].replace(/^Error: /, '');
}

module.exports = { plain };
