# CasinoPlanet — agent instructions

### DeepContext
Resume first (workset_resume), work the loop, commit with the status_report LAST.
The authoritative discipline is served by the MCP server: read deepcontext://discipline
(and deepcontext://methodology for how we build), or run the dc-resume / dc-commit prompts.
Project slug: casinoplanet (see .deepcontext).
Repo specifics: build/test: `python serve.py` (local dev server at http://localhost:8000,
serves index.html and the browser-based test_runner.html); `python build_single_file.py` /
`python build_single_file_mobile.py` (package src/**/*.js + style.css into standalone
CasinoPlanet.html / CasinoPlanetMobile.html — both git-tracked, expect a diff when rebuilding);
`npm test` (Playwright run of the full test_runner.html suite — real per-case pass/fail and
exit codes; config launches serve.py itself); `npm run test:selfcheck` (harness negative
control: proves a failing case fails the run; run it after touching the harness);
`python3 tools/check_id_contract.py` (static check that every DOM id
shared client code requires exists in index.html and mobile.html; exits non-zero on any gap;
tier-2 absences are gated on the committed tools/id_contract_waiver.json, regenerated with
--write-waiver). The npm workflow is real: Playwright test tooling only, no bundler. Forge/PRs: GitHub, MatthewByers1116/CasinoPlanet, via `gh` CLI. Deploy: none
observed — standalone built HTML files are the distributable artifact (e.g. for itch.io).
