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
`python run_integration_tests.py` (headless-Chrome run of the full test_runner.html suite,
writes test_report.md). No npm/vite workflow is actually used despite package.json listing
vite scripts. Forge/PRs: GitHub, MatthewByers1116/CasinoPlanet, via `gh` CLI. Deploy: none
observed — standalone built HTML files are the distributable artifact (e.g. for itch.io).
