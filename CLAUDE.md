# Gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

## Available Gstack Skills

- `/office-hours` — Schedule and manage office hours
- `/plan-ceo-review` — Plan CEO review sessions
- `/plan-eng-review` — Plan engineering reviews
- `/plan-design-review` — Plan design reviews
- `/design-consultation` — Get design consultation
- `/design-shotgun` — Rapid design iterations
- `/design-html` — Generate HTML designs
- `/review` — Review code or documents
- `/ship` — Ship features or releases
- `/land-and-deploy` — Land and deploy changes
- `/canary` — Manage canary deployments
- `/benchmark` — Run benchmarks
- `/browse` — Web browsing and research
- `/connect-chrome` — Connect to Chrome browser
- `/qa` — Quality assurance testing
- `/qa-only` — QA-only workflows
- `/design-review` — Formal design reviews
- `/setup-browser-cookies` — Configure browser cookies
- `/setup-deploy` — Set up deployment
- `/setup-gbrain` — Configure gstack brain
- `/retro` — Run retrospectives
- `/investigate` — Investigate issues
- `/document-release` — Document releases
- `/document-generate` — Generate documentation
- `/codex` — Code knowledge base
- `/cso` — Chief security officer workflows
- `/autoplan` — Automatic planning
- `/plan-devex-review` — Plan developer experience reviews
- `/devex-review` — Developer experience reviews
- `/careful` — Careful mode operations
- `/freeze` — Freeze deployments
- `/guard` — Security guard mode
- `/unfreeze` — Unfreeze deployments
- `/gstack-upgrade` — Upgrade gstack
- `/learn` — Learning and documentation

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).
