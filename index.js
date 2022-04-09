import 'urlpattern-polyfill';

import { ok, badRequest, methodNotAllowed, temporaryRedirect, permanentRedirect, notFound } from '@worker-tools/response-creators';
import { WorkerRouter } from '@worker-tools/router';
import { accepts, provides, createMiddleware, combine } from '@worker-tools/middleware';
import { html, HTMLResponse, HTMLContent } from '@worker-tools/html';

// const loggingMw = createMiddleware({}, async (ax) => {
//   const { request, match: { pathname: { groups } } } = await ax
//   console.log(`[${new Date()}]`, request.url, JSON.stringify(groups))
//   return ax;
// })

const navigator = self.navigator || { userAgent: 'Cloudflare Workers' }

const layout = (title, content) => html`<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>${title}</title>
  </head>
  <body>
    <main style="width:800px;margin:auto">
      <h1>GHUC.CC</h1>
      <span>ghuc.cc stands for "GitHub User Content Carbon Copy". 
        It is your handy redirection service to import TypeScript directly from GitHub for use in Deno.</span>
      <br/>
      <br/>
      ${content}
    </main>
  </body>
</html>`

const router = new WorkerRouter(provides(['text/html', '*/*']))
  .get('/:user/:repo{\@:version}?/:path(.*)', async (_req, { match, type }) => {
    const { pathname: { groups: { user, repo, version, path } } } = match;
    // console.log(user, repo, version, path)
    // TODO: support latest, next, etc..

    let branchOrTag;
    if (version) {
      branchOrTag = version.match(/^\d+\.\d+\.\d+/) ? `v${version}` : version;
    } else {
      // TODO: cache
      const gh = await fetch(`https://api.github.com/repos/${user}/${repo}`, {
        headers: { 
          'Accept': 'application/vnd.github.v3+json', 
          'User-Agent': navigator.userAgent, 
        },
      })
      if (!gh.ok) throw Error('response from gh not ok')
      const { default_branch: defaultBranch } = await gh.json();
      branchOrTag = defaultBranch;
    }

    if (type === 'text/html') {
      return new HTMLResponse(layout('ghuc.cc', html`<div>
        <script>
          (async () => {
            const res = await fetch('https://raw.githubusercontent.com/${user}/${repo}/${branchOrTag}/${path}')
            if (res.ok) document.getElementById('code').textContent = await res.text()
          })()
        </script>
        <span>Showing contents for: ${user}/${repo}/${branchOrTag}/${path}</span>
        <hr/>
        <pre><code id="code"></code></pre>
      </div>`))
    }

    return temporaryRedirect(`https://raw.githubusercontent.com/${user}/${repo}/${branchOrTag}/${path}`);
  })
  .get('/favicon.ico', () => ok())
  .any('*', (req, { type }) => {
    if (type === 'text/html') {
      return new HTMLResponse(layout('ghuc.cc', html`Needs to match pattern <code>/:user/:repo{\@:version}?/:path(.*)</code>`))
    }
    return badRequest("Needs to match pattern '/:user/:repo{\@:version}?/:path(.*)'")
  })
  .recover('*', (req, { type, error, response }) => {
    console.log(error)
    return response;
  })

self.addEventListener('fetch', router);

