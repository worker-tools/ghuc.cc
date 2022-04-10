# ghuc.cc
Your friendly neighborhood redirection service for **Deno** 🦕 to import code _directly from GitHub_.

> ghuc.cc = GitHub User Content Carbon Copy

Use the concise and familiar API you know and love from unpkg, skypack and esm.sh for any GitHub repository, e.g.:

<https://ghuc.cc/worker-tools/middleware@0.1.0-pre.10/index.ts>

redirects to `https://raw.githubusercontent.com/worker-tools/middleware/v0.1.0-pre.10/index.ts`[^1]. 

Because GHUC.cc _keeps it simple_ and uses redirects you don't have to worry about it reaching GH API rate limits, etc.

GHUC.cc accpets any GitHub tag or branch as a version specifier. For example, to redirect to the `dev` branch use `worker-tools/middleware@dev/index.ts`

You can also leave out the version suffix, in which case GHUC.cc will redirect to the repository's default branch:

<https://ghuc.cc/worker-tools/router/index.ts>

Note that you cannot leave out the path. In the spirit of Deno's module resolution philsophy, 
ghuc expect a full path and file extension.

Ghuc.cc was developer for and with [Worker Tools](https://workers.tools).

[^1]: Note that the version suffix was interpreted as a git tag starting with `v`, which is common practice for JS repositories.
If a repository uses bare version tags, you can append a `!` to prevent this behavior.
E.g. `https://ghuc.cc/user/repo@1.0.0!/index.ts` redirects to a tag with the name `1.0.0`.
