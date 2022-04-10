# ghuc.cc
Your friendly neighborhood redirection service for **Deno** 🦕 to import code _directly from GitHub_.

> ghuc.cc = GitHub User Content Carbon Copy

Use the concise and familiar API you know and love from unpkg, skypack and esm.sh for any GitHub repository, e.g.:

<https://ghuc.cc/worker-tools/router@0.1.0-pre.10/index.ts>

to redirect to `https://raw.githubusercontent.com/worker-tools/router/v0.1.0-pre.10/index.ts`[^1]. 

Because GHUC.cc _keeps it simple_ and uses redirects you don't have to worry about it reaching GH API rate limits, etc.

GHUC.cc accpets any GitHub tag or branch as a version specifier. For example, to redirect to the `dev` branch use `worker-tools/router@dev/index.ts`

You can also leave out the version suffix, in which case GHUC.cc will redirect to the repository's default branch:

<https://ghuc.cc/worker-tools/router/index.ts>

Note that you cannot leave out the path. In the spirit of Deno's module resolution philsophy, 
ghuc expect a full path and file extension.

Ghuc.cc was developer for and with [Worker Tools](https://workers.tools).

[^1]: Note that a version suffix was interpreted a tag starting with `v`, which is common practice for JS repositories.
If your repository uses non-`v`-prefixed version tags, you can append a `!` to force the bare version. 
E.g. `https://ghuc.cc/user/pro@1.0.0!/index.ts` redirects to a tag with the name `1.0.0`.
