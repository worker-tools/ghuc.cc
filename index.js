import { badRequest, methodNotAllowed, temporaryRedirect, permanentRedirect, notFound } from '@worker-tools/response-creators';
import { WorkerRouter } from '@worker-tools/router';

const router = new WorkerRouter()
  .get('/:org/:repo@:version/*', (_request, { match }) => {
    const { pathname: { groups: { org, repo, version, '0': path } } } = match;
    // console.log(org, repo, version, path)
    // TODO: support latest, next, etc..
    const branchOrTag = version && version.match(/^\d+\.\d+\.\d+/) ? `v${version}` : version;
    // const resp = await fetch(`https://raw.githubusercontent.com/${org}/${repo}/${branchOrTag}/${path}`, request)
    // if (resp.status === 200) ev.waitUntil(cache.put(request.url, resp.clone()))
    return temporaryRedirect(`https://raw.githubusercontent.com/${org}/${repo}/${branchOrTag}/${path}`);
  })
  .get('/:org/:repo/*', async (_request, { match }) => {
    const { pathname: { groups: { org, repo, '0': path } } } = match;
    // console.log(org, repo, path)
    // TODO: store default_branch in KV to reduce nr of api reqs?
    const gh = await fetch(`https://api.github.com/repos/${org}/${repo}`, {
      headers: { 
        'Accept': 'application/vnd.github.v3+json', 
        'User-Agent': navigator.userAgent, 
      },
    })
    // console.log(gh.status)
    if (gh.ok) {
      const { default_branch: defaultBranch } = await gh.json();
      // const resp = await fetch(`https://raw.githubusercontent.com/${org}/${repo}/${defaultBranch}/${path}`, request)
      // if (resp.status === 200) ev.waitUntil(cache.put(request.url, resp.clone()))
      return temporaryRedirect(`https://raw.githubusercontent.com/${org}/${repo}/${defaultBranch}/${path}`)
    } else {
      return gh;
    }
  })
  .any('*', () => {
    return badRequest("Needs to match pattern '/:org/:repo@:version/:path'")
  })

self.addEventListener('fetch', router)
