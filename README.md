
# File Upload Website (Full‑Stack)

A clean, modern file‑upload website built with:

- **Backend:** Node.js + Express + Multer (file uploads)  
- **Frontend:** React + Vite + Tailwind CSS  
- **Storage:** Local filesystem (./server/uploads) with JSON metadata  
- **Deploy:** Dockerfile included; works locally with Node 18+

## Features
- Drag‑and‑drop and multi‑file upload
- Upload progress per file
- File list with size and date
- Download and delete files
- Sensible server‑side limits (configurable via `.env`)

---

## Quick Start (Local)

### 1) Backend
```bash
cd server
cp .env.example .env   # optional: tweak limits/port
npm install
npm run dev            # starts http://localhost:3000
```

### 2) Frontend (in another terminal)
```bash
cd client
npm install
npm run dev            # starts http://localhost:5173 (proxied to backend)
```
Open http://localhost:5173

**Production build served by Express:**
```bash
# build frontend
cd client
npm run build

# copy static build into server/public
mkdir -p ../server/public
rm -rf ../server/public/*
cp -r dist/* ../server/public/

# run server (serves / and /api)
cd ../server
npm start
# visit http://localhost:3000
```

---

## Docker
Build and run the all‑in‑one image:
```bash
docker build -t file-upload-site .
docker run --name file-upload -p 3000:3000 -v $(pwd)/server/uploads:/app/server/uploads file-upload-site
# visit http://localhost:3000
```

---

## Configuration
Create `server/.env` (copy `server/.env.example`) to override defaults:
```
PORT=3000
UPLOAD_DIR=uploads
MAX_FILE_SIZE=104857600   # 100MB
```

---

## Notes
- This project stores files on local disk for simplicity. For cloud storage (S3, GCS, etc.), swap Multer's diskStorage with a streaming upload to your provider.
- No authentication is included. If you need auth or link‑sharing, ask and we can add it.


---

## Zero-Docker Deploy from GitHub (Render)

This repo includes a **`render.yaml`** blueprint for one-click provisioning on Render (free tier). It will:
- Build the React app
- Copy the built files into `server/public`
- Install the server and start it
- Attach a **persistent disk** at `server/uploads` so your files survive restarts

### Steps
1. **Push this project to a new GitHub repo.**
2. Go to **https://dashboard.render.com/** → **New** → **Blueprint**.
3. Paste your GitHub repo URL and click **Connect**.
4. Review settings (you can keep defaults). Click **Apply**.
5. Wait for the first deploy to finish, then open the URL Render gives you.

No Docker needed. Subsequent `git push` to your default branch will auto-deploy.

> If you prefer to set it up manually on Render (without the blueprint), create a “Web Service”:
> - Root Directory: repo root
> - Build Command:
>   ```bash
>   npm --prefix client ci && npm --prefix client run build && \

>   mkdir -p server/public && rm -rf server/public/* && cp -r client/dist/* server/public/ && \

>   npm --prefix server ci
>   ```
> - Start Command:
>   ```bash
>   npm --prefix server start
>   ```
> - Add a **Disk** mounted at `/app/server/uploads` (2 GB+).
> - Environment (optional): `MAX_FILE_SIZE=104857600` (100 MB).
