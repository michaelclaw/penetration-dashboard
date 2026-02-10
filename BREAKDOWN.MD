# Reconnaissance Management Panel - Module Breakdown

This document explains each section of the Reconnaissance Management Panel (Recon tab) and Scanning tab, how they work under the hood, and how data persists so targets and scan results remain after refresh or service restart.

## Panel Layout (Recon Tab)
The Recon tab is composed of the following sections, laid out in a grid:
- Target & Scope
- Recon Status Overview
- Asset Discovery Summary
- Findings & Alerts
- Activity & Logs
- Controls & Config Shortcuts

## Panel Layout (Scanning Tab)
The Scanning tab is composed of the following sections:
- Host & Service Discovery (Nmap)
- Vulnerability Scan (Nuclei)
- Vulnerability Scan (Nikto)
- Validation & Triage
- Tool Status (Kali)

## Target & Scope
Purpose: capture targets, view saved targets, and launch auxiliary OSINT lookups.

What it does:
- Lets the user define a target type (Domain/IP/CIDR/Org name), target value, and notes.
- Creates a target record in the backend when “Add Target” is clicked.
- Shows a table of all saved targets with status and last run.
- Provides quick external lookups:
  - ICANN/RDAP lookup (domain-only) shown in a modal.
  - Whitepages lookup via a new tab.
  - Company OSINT quick links that open OpenCorporates or Wayback Machine via a picker modal.

How it works:
- On load, it calls `GET /api/targets` and populates “Saved targets”.
- On submit, it sends `POST /api/targets` with name/type/target/tags/notes.
- ICANN/RDAP lookup normalizes a domain and opens the in-app modal, which calls `GET /api/icann/rdap`.
- Whitepages and OSINT links use `window.open()` to launch external sites.

Persistence:
- Targets are stored in the SQLite database table `targets`. Refreshing the page reloads the list via `GET /api/targets`.

## Recon Status Overview
Purpose: start/pause/stop recon jobs, track pipeline progress, and show stage details.

What it does:
- Displays the current reconnaissance pipeline stage and progress.
- Starts a recon job for a selected target and profile.
- Tracks stage updates in real time via WebSocket messages.
- Lets users open a “Scanning Window” to see stage-by-stage progress.
- Allows import of results via the “Import Results” modal.
- Shows API health status and stores last job state.

How it works:
- Starts a job via `POST /api/recon/start` (targetId + profile).
- Updates stage progress via WebSocket events (`stage_update`, `job_complete`, `job_error`).
- Fetches target list on load (`GET /api/targets`) and uses the selected target for job control.
- Stage details modal queries stored data:
  - Subdomains: `GET /api/subdomains?targetId=...`
  - Services: `GET /api/services?targetId=...` (services now primarily come from Scanning tab Nmap runs)
  - DNS records: `GET /api/dns-records?targetId=...`
  - Findings: `GET /api/findings?targetId=...`

Persistence:
- UI state (current job, stages, progress, selected profile/target) is cached in `localStorage` using keys scoped by user (e.g., `recon_dashboard_last_job:*`).
- The actual recon results are written to the SQLite DB during the pipeline (see “Data Storage Model”).

## Asset Discovery Summary
Purpose: summarize discovered assets across all targets.

What it does:
- Shows root domains derived from saved domain targets.
- Summarizes subdomain counts and “sensitive” subdomain keywords.
- Lists subdomain records and IPs with status/first-seen/last-seen.
- Computes a total unique IP count.

How it works:
- Loads targets with `GET /api/targets`.
- For each target, fetches subdomains via `GET /api/subdomains?targetId=...`.
- Refreshes every 10 seconds to reflect new recon results.

Persistence:
- Subdomains are stored in `subdomains` table (unique per target/subdomain).
- Root domains are derived from saved targets; subdomains are read from DB.

## Findings & Alerts
Purpose: list findings, show severity summary, and manage finding status.

What it does:
- Displays counts of high/medium/low/total findings.
- Lists open findings with severity, type, title, host, and status.
- Allows status updates (Confirmed / False Positive).
- Provides a quick “view details” pop-up and export to JSON.

How it works:
- Fetches open findings via `GET /api/findings?status=Open`.
- Fetches summary via `GET /api/findings/summary`.
- Updates a finding via `PUT /api/findings/:id`.
- Refreshes every 5 seconds to surface new results.

Persistence:
- Findings are stored in the `findings` table and updated in place.

## Activity & Logs
Purpose: show live activity and provide access to full logs.

What it does:
- Shows a live stream of activity messages (WebSocket).
- Allows viewing of the last 300 log lines.
- Allows downloading logs as a text file.
- Provides diagnostics for installed tools.

How it works:
- Live activity updates are received via WebSocket (`activity` events).
- Full log list is loaded via `GET /api/activity?limit=300`.
- Export uses `GET /api/activity/export?limit=1000`.
- Diagnostics uses `GET /api/tools/status`.

Persistence:
- Activity logs are stored in the `activity_logs` table with timestamps.

## Controls & Config Shortcuts
Purpose: quick profile selection and tool availability checks.

What it does:
- Lets users switch recon profiles (Standard, OSINT-heavy, Stealth, Custom).
- Shows Kali tool availability and one-click install actions.

How it works:
- Tool status: `GET /api/tools/status`.
- Install action: `POST /api/tools/install` with `toolId`.
- Profile selection is stored in `localStorage`.

Persistence:
- Profile selection is stored in `localStorage` per user.
- Tool status is read from the backend each load.

## Scanning Window (Modal)
Purpose: show detailed progress while a recon job runs.

What it does:
- Displays overall progress.
- Shows each stage with a progress bar and “found” counts.

How it works:
- Receives `currentStage`, `progress`, and `stages` from `ReconStatusOverview`.
- Renders status based on stage state (QUEUED/RUNNING/DONE).

## Import Results (Modal)
## Scanning Tab: Host & Service Discovery (Nmap)
Purpose: run backend Nmap scans and review discovered hosts/services.

What it does:
- Starts Nmap scans for the selected target.
- Shows scan history per target.
- Displays services in a structured table (host, port, service, version).
- Stores raw output for audit/review.

How it works:
- Starts a scan via `POST /api/scans/start` with `tool: "nmap"`.
- Scan records are stored in `scan_runs` with a `scan_id`.
- Parsed service results are stored in the `services` table with `job_id = scan_id`.
- Scan history and details are loaded via:
  - `GET /api/scans?targetId=...&tool=nmap`
  - `GET /api/scans/:scanId`
  - `GET /api/services?targetId=...&jobId=...`

Persistence:
- Scan runs persist in `scan_runs`.
- Nmap services persist in `services` and remain available after refresh/restart.

## Scanning Tab: Vulnerability Scan (Nuclei)
Purpose: run nuclei templates and capture vulnerability findings.

What it does:
- Starts nuclei scans for the selected target.
- Stores findings with severity, host, and template details.
- Exposes raw output for review.

How it works:
- Starts a scan via `POST /api/scans/start` with `tool: "nuclei"`.
- Parsed findings are written to `findings` with `type = "nuclei"` and `job_id = scan_id`.
- History/details via `GET /api/scans` and `GET /api/scans/:scanId`.
- Findings are fetched with `GET /api/findings?targetId=...&jobId=...&type=nuclei`.

Persistence:
- Scan runs and findings are stored in SQLite and survive restarts.

## Scanning Tab: Vulnerability Scan (Nikto)
Purpose: run Nikto web checks and store identified issues.

What it does:
- Runs Nikto against the selected target.
- Parses JSON output (with text fallback).
- Saves findings to the database and provides raw output.

How it works:
- Starts a scan via `POST /api/scans/start` with `tool: "nikto"`.
- Findings are stored in `findings` with `type = "nikto"` and `job_id = scan_id`.
- Findings are fetched with `GET /api/findings?targetId=...&jobId=...&type=nikto`.

Persistence:
- Scan runs and findings persist in SQLite and are reloaded after refresh.

## Scanning Tab: Validation & Triage
Purpose: manually confirm or dismiss findings across scans.

What it does:
- Shows combined findings for the selected target (Nuclei, Nikto, and recon hints).
- Lets users mark status: Confirmed, False Positive, Needs Review.

How it works:
- Loads findings via `GET /api/findings?targetId=...`.
- Updates status via `PUT /api/findings/:id`.
- Status is reused across Recon and Scanning views.

Persistence:
- Status updates are stored in `findings` and remain after refresh/restart.

## Scanning Tab: Tool Status (Kali)
Purpose: show tool availability and install missing tools.

What it does:
- Lists CLI tools used by scanning (Nmap, Nuclei, Nikto).
- Shows installed (green) vs missing (red) with a one-click install.

How it works:
- Tool status: `GET /api/tools/status`.
- Install action: `POST /api/tools/install`.
- Requires backend to run under sudo for installs.

Persistence:
- Tool status is read live from the backend each load.
Purpose: manual import of results without running real tools (assignment-safe).

What it does:
- Allows importing subdomains, services, findings, and activity logs.
- Associates the import with a selected target.

How it works:
- Loads targets via `GET /api/targets`.
- Submits import payload via `POST /api/import`.

Persistence:
- Imports are stored in the same DB tables as normal recon outputs.

## Data Storage Model (Why data remains after refresh)
The application stores operational data in a SQLite database located at `server/recon.db`. This is initialized on backend startup and persists across restarts.

Key tables used for persistence:
- `targets`: saved targets (name/type/target/tags/notes/status/last_run).
- `recon_jobs`: each recon job with status and profile.
- `subdomains`: discovered subdomains (unique per target).
- `services`: discovered services/ports (Nmap scans are stored here too).
- `findings`: vulnerability findings (recon hints, nuclei, nikto).
- `activity_logs`: chronological run logs.
- `dns_records`: DNS enumeration results.
- `scan_runs`: scanning tab runs with raw output and summary metadata.

Process flow:
1. **Add target**  
   `POST /api/targets` inserts a row into `targets`.
2. **Start recon**  
   `POST /api/recon/start` creates a job row in `recon_jobs`, updates target status, and runs the pipeline.
3. **Pipeline stages**  
   Each stage writes results into its table (subdomains, dns_records, findings, activity_logs).
4. **Run scans (Scanning tab)**  
   `POST /api/scans/start` stores a row in `scan_runs`, then writes `services` (Nmap) or `findings` (Nuclei/Nikto).
4. **Refresh the UI**  
   The UI reads from the backend (`GET /api/targets`, `/subdomains`, `/services`, `/findings`, `/activity`, `/scans`) so data is always loaded from the DB, not from memory.

UI state (non-data):
- Current selected profile/target and last job progress are stored in `localStorage`.
- This allows the UI to restore the previous view state after a refresh, while the underlying data still comes from the database.

