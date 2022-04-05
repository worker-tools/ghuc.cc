import { badRequest, methodNotAllowed } from '@worker-tools/response-creators';

self.addEventListener('fetch', ev => ev.respondWith(handle(ev)))

const pattern = new URLPattern({ pathname: '/:org/:repo@:version/:path' });
const patternNoVersion = new URLPattern({ pathname: '/:org/:repo/:path' });

/** @param {FetchEvent} ev */
async function handle(ev) {
  const { request } = ev;
  if (request.method !== 'GET') return methodNotAllowed();

  const cache = caches.default;
  const maybe = await cache.match(request.url);
  if (maybe) return maybe;

  let match = pattern.exec(request.url)
  if (match) {
    const { pathname: { groups: { org, repo, version, path } } } = match;
    // console.log(org, repo, version, path)
    const branchOrTag = version && version.match(/^\d/) ? `v${version}` : version;
    const resp = await fetch(`https://raw.githubusercontent.com/${org}/${repo}/${branchOrTag}/${path}`, request)
    if (resp.status === 200) ev.waitUntil(cache.put(request.url, resp.clone()))
    return resp;
  }

  match = patternNoVersion.exec(request.url)
  if (match) {
    const { pathname: { groups: { org, repo, path } } } = match;
    // console.log(org, repo, path)
    const gh = await fetch(`https://api.github.com/repos/${org}/${repo}`, {
      headers: { 
        'Accept': 'application/vnd.github.v3+json', 
        'User-Agent': navigator.userAgent, 
      },
    })
    // console.log(gh.status)
    if (gh.ok) {
      const { default_branch: defaultBranch } = await gh.json();
      const resp = await fetch(`https://raw.githubusercontent.com/${org}/${repo}/${defaultBranch}/${path}`, request)
      if (resp.status === 200) ev.waitUntil(cache.put(request.url, resp.clone()))
      return resp;
    }
  }

  return badRequest("Needs to match pattern '/:org/:repo{@:version}?/:path'")
}