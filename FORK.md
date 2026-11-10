# Local fork of Floci UI

A fork of [floci-io/floci-ui](https://github.com/floci-io/floci-ui) with changes that are not (yet) upstream, meant to run next to the
local fork of Floci. Nothing here is sent upstream.

## Branches

| Ref | Meaning |
|---|---|
| `main` | Mirror of upstream `main`. Fast-forward only. |
| `local` | `main` plus our changes, a short linear series of commits, rebased onto `main` when upstream moves (so force-pushed). Type-check, lint and tests below pass before every push. |
| `feat/*`, `fix/*` | Working branches off `main`, merged into `local` by cherry-pick. |

Update routine: `git fetch upstream && git checkout main && git merge --ff-only upstream/main && git checkout local && git rebase main`, run
the tests, `git push --force-with-lease origin main local`. A conflict is analysed, not resolved by habit: has upstream implemented the
same thing (drop our commit) or changed what ours relies on (adapt it)? Nothing is pushed to the `upstream` remote.

## What the fork adds

- Bedrock guardrails in the Cloud Explorer (list, create, inspect, delete).
- Bedrock models: a read-only list of the foundation models the emulated Bedrock reports (the model picker). It needs a Floci
  that serves `ListFoundationModels` (upstream floci PR #7675).
- Inspecting an S3 bucket also shows Object Lock (default mode and retention), lifecycle rules and default encryption; inspecting an SQS
  queue shows its redrive policy (dead-letter queue, max receive count), KMS key and the queues that use it as their dead-letter queue.
  Read-only fields in the inspector, not separate views.
- `docker/Dockerfile.lockfile`: a build from `pnpm-lock.yaml` (the upstream `docker/Dockerfile` runs `npm install` without a lockfile and
  fails on current npm).

Not done: a Converse test panel, per-object retention and legal hold, version lists, a redrive button.

## Build the image

```bash
docker build -f docker/Dockerfile.lockfile --build-arg VERSION=local -t floci-ui-local:local .
```

About 6.5 minutes cold, image 190 MB. It listens on 4500 and needs `FLOCI_ENDPOINT` (and AWS variables), as the upstream image does.
Not published to any registry.

## Tests

```bash
pnpm install --frozen-lockfile
pnpm --filter @floci/api type-check && (cd packages/api && bun test)
pnpm --filter @floci/frontend type-check && pnpm --filter @floci/frontend lint && pnpm --filter @floci/frontend test
```
