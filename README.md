# Recon Dashboard

Version: 1.0.36
This version number should be updated whenever code changes are made.

## What It Does

Recon Dashboard is a web-based GUI for running authorized reconnaissance on targets.  
The frontend provides a clean workflow for students, while the backend runs real Kali tools and streams results back to the UI.
The backend logs each command and its output to the Activity & Logs panel in sequence.
On startup, the backend warns if it's not running under sudo (some tools need root).

## Prerequisites (Kali)

- Kali Linux
- Node.js 18+ and npm
- Recon & scanning tools (install via apt or use the dashboard tool installer):
  - subfinder
  - assetfinder
  - findomain
  - httpx or httpx-toolkit
  - nmap
  - nuclei
  - nikto
  - gobuster
  - dnsutils (dig)
  - curl

## Install

```bash
# From the project root
npm install
cd server
npm install
```

## Run

```bash
# Terminal 1 - backend API
cd server
npm start

# Terminal 2 - frontend UI
cd ..
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Tool Status & Install Buttons

The dashboard includes a tool status panel.  
Green = installed, Red = missing.  
Click a red tool to install it via the backend (requires running the backend as root):

```bash
sudo npm start
```
