import 'urlpattern-polyfill';

import { ok, badRequest, temporaryRedirect } from '@worker-tools/response-creators';
import { WorkerRouter } from '@worker-tools/router';
import { provides } from '@worker-tools/middleware';
import { StorageArea } from '@worker-tools/cloudflare-kv-storage';
import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler'

import { html, HTMLResponse } from '@worker-tools/html';

const navigator = self.navigator || { userAgent: 'Cloudflare Workers' }

const defaultBranchStorage = new StorageArea('default-branches');

const layout = (title, content) => html`<html>

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${title}</title>
  <link rel="stylesheet" href="/_public/index.css">
</head>

<body>
  <main style="width:800px;margin:auto">
    <h1>GHUC.CC</h1>
    <span>ghuc.cc = GitHub User Content Carbon Copy<br>
      Your friendly neighborhood redirection service for <strong>Deno 🦕</strong> to import code <em>directly from GitHub</em>.</span>
    <br />
    <br />
    ${content}
  </main>
  <footer style="width:800px;margin:auto">
    <hr/>
    <div style="display:flex;justify-content:space-between">
      <div>
        Build:
        <span class="muted">${(self.GITHUB_SHA || '123456789').substring(0, 7)}</span>
      </div>
      <div class="muted"> 
        <a href="/">Home</a>
        |
        <a href="https://github.com/worker-tools/ghuc.cc">GitHub</a>
        <!-- <a href="mailto:ghuc@workers.tools">Contact</a> -->
      </div>
    </div>
  </footer>
</body>

</html>`

export const mkPage = ({ user, repo, branchOrTag, path }, url) => {
  return new HTMLResponse(layout('ghuc.cc', html`<div>
  <!-- <code>import * as ${user.replaceAll('-', '_') + '__' + repo.replaceAll('-', '_')} from '<a href="${url}">${new URL(new URL(url).pathname, 'https://ghuc.cc')}</a>'</code><br><br> -->
  <!-- <code>import {} from '<a href="${url}">${new URL(new URL(url).pathname, 'https://ghuc.cc')}</a>'</code><br><br> -->
  <div style="display:flex; justify-content:space-between">
    <div>
      📦 ${new URL(new URL(url).pathname, 'https://ghuc.cc')}<br/>
      ➡️ <span class="muted">https://raw.githubusercontent.com/${user}/${repo}/${branchOrTag}/${path}</span>
    </div>
    <div class="muted">
      <a href="https://raw.githubusercontent.com/${user}/${repo}/${branchOrTag}/${path}">Raw</a>
      |
      <a href="https://github.com/${user}/${repo}/blob/${branchOrTag}/${path}">Repository</a>
    </div>
  </div>
  <hr />
  <pre><code id="code"><noscript>JS required to load remote content.</noscript></code></pre>
  <script>
    (async () => {
      document.getElementById('code').textContent = 'Fetching...'
      const gh = await fetch('https://raw.githubusercontent.com/${user}/${repo}/${branchOrTag}/${path}')
      if (gh.ok) document.getElementById('code').textContent = await gh.text();
      else document.getElementById('code').textContent = 'Response from GitHub not ok: ' + gh.status;
    })()
  </script>
</div>`))
}

export const mkInfo = (response) => {
  return new HTMLResponse(layout('ghuc.cc',
    html`<div>
      Needs to match pattern <code>/:user/:repo{\@:version}?/:path(.*)</code>. Examples:
      <ul>
        <li><a href="/worker-tools/router/index.ts">${new URL('/worker-tools/router/index.ts', 'https://ghuc.cc')}</a></li>
        <li><a href="/worker-tools/middleware@0.1.0-pre.10/index.ts">${new URL('/worker-tools/middleware@0.1.0-pre.10/index.ts', 'https://ghuc.cc')}</a></li>
        <li><a href="/kenchris/urlpattern-polyfill@a076337/src/index.d.ts">${new URL('/kenchris/urlpattern-polyfill@a076337/src/index.d.ts', 'https://ghuc.cc')}</a></li>
      </ul>

    </div>`), response)
}

export const mkError = (response, error) => {
  return new HTMLResponse(layout('ghuc.cc',
    html`<div>
      Something went wrong: <code>${error && error.message || response.statusText}</code>.
    </div>`), response)
}

const ghAPI = (href, originalRequest) => {
  return fetch(new URL(href, 'https://api.github.com').href, {
    headers: { 
      'Accept': 'application/vnd.github.v3+json', 
      'User-Agent': navigator.userAgent, 
      ...originalRequest.headers.has('authorization') 
        ? { 'Authorization': originalRequest.headers.get('authorization') } 
        : {}
    },
  })
}

const getBranchOrTag = async ({ user, repo, version }, { request, waitUntil }) => {
  if (version) {
    return version.match(/^\d+\.\d+\.\d+/) 
      ? version.endsWith('!') ? version.substring(0, version.length - 1) : `v${version}` 
      : version;
  } else {
    let defaultBranch = await defaultBranchStorage.get([user, repo])
    if (!defaultBranch) {
      const gh = await ghAPI(`/repos/${user}/${repo}`, request)
      if (!gh.ok) throw Error(`Response from GitHub not ok: ${gh.status}`)
      defaultBranch = (await gh.json()).default_branch;
      waitUntil(defaultBranchStorage.set([user, repo], defaultBranch, { expirationTtl: 60 * 60 * 24 * 30 }))
    }
    return defaultBranch;
  }
}

const handlePrefix = prefix => request => {
  // compute the default (e.g. / -> index.html)
  let defaultAssetKey = mapRequestToAsset(request)
  let url = new URL(defaultAssetKey.url)

  // strip the prefix from the path for lookup
  url.pathname = url.pathname.replace(prefix, '/')

  // inherit all other props from the default request
  return new Request(url, defaultAssetKey)
}

const assetsRouter = new WorkerRouter()
  .get('*', (_, ctx) => getAssetFromKV(ctx.event, { mapRequestToAsset: handlePrefix('/_public') }))
  .recover('*', provides(['text/html', '*/*']), (_, { type, response }) => {
    if (type === 'text/html') return mkError(response)
    return response;
  })

const router = new WorkerRouter(provides(['text/html', '*/*']), { debug: self.DEBUG })
  .get('/favicon.ico', () => ok()) // TODO
  .use('/_public/*', assetsRouter)
  .get('/:handle/:repo(@?[^@]+){@:version([^/]+)}?/:path(.*)', async (request, { match, type, waitUntil }) => {
    const { pathname: { groups: { handle, repo, version, path } } } = match;

    const user = handle.startsWith('@') ? handle.substring(1) : handle
    const branchOrTag = await getBranchOrTag({ user, repo, version }, { request, waitUntil })

    if (type === 'text/html') return mkPage({ user, repo, branchOrTag, path }, request.url)
    return temporaryRedirect(`https://raw.githubusercontent.com/${user}/${repo}/${branchOrTag}/${path}`);
  })
  .get('/', (_, { type }) => {
    if (type === 'text/html') return mkInfo()
    return ok("Needs to match pattern '/:user/:repo{\@:version}?/:path(.*)'")
  })
  .any('*', (_, { type }) => {
    if (type === 'text/html') return mkInfo(badRequest())
    return badRequest("Needs to match pattern '/:user/:repo{\@:version}?/:path(.*)'")
  })
  .recover('*', provides(['text/html', '*/*']), (_, { type, error, response }) => {
    if (type === 'text/html') return mkError(response, error)
    return response;
  })

self.addEventListener('fetch', router);
