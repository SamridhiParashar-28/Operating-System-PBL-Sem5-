# Implementation Log & Session Audit Document

**Project:** Mini File System + Disk Scheduling Simulator  
**Course:** Operating Systems Lab — Project-Based Learning (Sem 5)  
**Author / Contributor:** Samridhi Parashar (assisted by Antigravity AI Assistant)  
**Date Created:** November 1, 2026  
**Repository:** `Operating-System-PBL-Sem5-`  

---

## 1. Project Overview & Objectives
This document maintains an exact, comprehensive log of all architectural decisions, component implementations, system calls, mathematical calculations, and edits made during this project development session.

The project is an educational, interactive simulator designed to demonstrate fundamental Operating Systems principles:
1. **Virtual File System (VFS):** Inode tables, directory tree traversal, file descriptors, permission masking (`rwx`), and system call logging.
2. **Disk Space Allocation:** Visual representation of Contiguous (with First-Fit, Best-Fit, and Worst-Fit placement policies and Compaction), Linked, and Indexed block allocation, tracking both Internal and External fragmentation.
3. **Disk Arm Scheduling:** Simulation and step-by-step Canvas visualization of six classic algorithms (FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK) with side-by-side performance benchmarking and Chart.js reporting.

---

## 2. Chronological Record of Edits & Changes

### Session 1: Project Initialization & Core Engines
- **Step 1: Environment Diagnostics & Workspace Inspection**
  - Inspected working directory `Operating-System-PBL-Sem5-`.
  - Verified Node.js (`v24.13.1`) and npm (`11.8.0`) availability.
- **Step 2: Dependency Configuration (`package.json`)**
  - Initialized `package.json` with Express v4.19+ dependency and startup scripts (`npm start`, `npm run dev`).
  - Executed automated `npm install`.
- **Step 3: Core VFS Engine Implementation (`core/FileSystem.js`)**
  - Implemented `Inode` class with attributes: `id`, `name`, `type`, `parentId`, `size`, `content`, `createdAt`, `modifiedAt`, `permissions` (octal), `owner`, `children`, and `allocatedBlocks`.
  - Implemented symbolic permission generator converting octal modes (e.g. `0o755` → `rwxr-xr-x`).
  - Implemented `FileSystem` engine simulating POSIX system calls:
    - `sys_mkdir`: directory creation and parent pointer updates.
    - `sys_creat`: file inode allocation and content initialization.
    - `sys_open`: creates entry in system-wide Open File Table, returning a file descriptor (`fd`).
    - `sys_close`: releases file descriptor.
    - `sys_read` / `sys_write`: cursor-based streaming I/O.
    - `sys_unlink` / `sys_rmdir`: recursive or non-recursive deletion.
    - `sys_rename`, `sys_move`, `sys_copy`: directory hierarchy restructuring.
    - `sys_chmod`: permission bitwise updates.
    - `exportState` / `importState`: JSON snapshot serialization.
    - In-memory circular audit log tracking recent system calls.
- **Step 4: Disk Block Allocation Engine (`core/DiskAllocator.js`)**
  - Simulated a 64-block disk device with 512 bytes per block (total 32 KB capacity).
  - Implemented three classic allocation strategies:
    1. **Contiguous Allocation:** Continuous blocks search using First-Fit, Best-Fit, and Worst-Fit placement algorithms.
    2. **Linked Allocation:** Scattered free block allocation with next-block pointers.
    3. **Indexed Allocation:** Dedicated Index Block containing direct addresses to data blocks.
  - Implemented **Disk Compaction (Defragmentation)**: re-allocates contiguous files to the start of the disk, eliminating external fragmentation holes.
  - Implemented dynamic fragmentation calculations:
    - *Internal Fragmentation:* `(blockSize - (fileSize % blockSize))` for the tail block.
    - *External Fragmentation:* analysis of scattered free holes unable to satisfy contiguous block allocations.
    - *Storage Efficiency Percentage:* `(Payload Bytes / Total Allocated Bytes) * 100`.
- **Step 5: Disk Arm Scheduling Engine (`core/DiskScheduler.js`)**
  - Implemented six algorithms with step-by-step trace generation:
    1. **FCFS (First-Come, First-Served):** strict queue order execution.
    2. **SSTF (Shortest Seek Time First):** greedy selection of nearest cylinder.
    3. **SCAN (Elevator):** sweeps to physical disk boundary before reversing.
    4. **C-SCAN (Circular SCAN):** sweeps in one direction, resets to boundary 0 without servicing on return.
    5. **LOOK:** reverses at furthest pending request without reaching disk boundary.
    6. **C-LOOK (Circular LOOK):** jumps directly to lowest/highest pending request.
  - Implemented multi-algorithm comparative benchmark engine (`compareAll()`) that determines optimal and worst algorithms for any given queue.
  - Added textbook preset configurations (Silberschatz Classic, Locality of Reference, Wild Swings, Uniform).

### Session 2: Backend REST API Layer & Server Architecture
- **Step 6: REST API Route Handlers**
  - Created `routes/fsRoutes.js`: 18 endpoints covering VFS CRUD, Inodes, Open File Table, permissions, and log streaming.
  - Created `routes/allocationRoutes.js`: endpoints for allocate, deallocate, compact, switch-strategy, and JSON export/import.
  - Created `routes/diskRoutes.js`: endpoints for running simulations, 6-algorithm benchmarks, preset loading, and CSV generation.
  - Created `routes/reportRoutes.js`: generates comprehensive, printable HTML and JSON simulation summaries.
- **Step 7: Express Server Entrypoint (`server.js`)**
  - Integrated all routes with `/api/*` prefixes.
  - Configured static asset serving for `public/`.
  - Added pretty URLs: `/file-ops`, `/allocation`, `/disk`, `/disk-scheduling`.

### Session 3: Modern Frontend Design & Interactive UI
- **Step 8: Design System & Styling (`public/css/*`)**
  - Created `public/css/main.css`: CSS custom properties, dark color palette (`#0a0e17`, `#111827`, `#1e293b`), responsive sidebar, buttons, cards, modal system, tooltips, and toast notifications.
  - Created `public/css/file-ops.css`: tree directory view, breadcrumbs, file tables, inode inspector, open file descriptors bar, and terminal console.
  - Created `public/css/allocation.css`: strategy switcher, statistics cards, 64-block visual disk map with internal fragmentation indicators.
  - Created `public/css/disk.css`: playback control bar, HTML5 Canvas container, seek trace table, and benchmark charts.
- **Step 9: Client JavaScript Modules (`public/js/*`)**
  - Created `public/js/notifications.js`: toast notification system.
  - Created `public/js/api.js`: REST client wrapper.
  - Created `public/js/file-ops.js`: interactive tree view, file table, modal controllers (create, rename, move, copy, chmod with 9-checkbox octal calculator, open/close file descriptors, streaming read/write).
  - Created `public/js/allocation.js`: block grid renderer, compaction animator, file allocator, and block inspector.
  - Created `public/js/disk.js`: HTML5 Canvas rendering engine for disk cylinder tracks, magnetic head carriage with glow, and seek trajectory line graph.
  - Created `public/js/comparison.js`: Chart.js interactive bar chart and comparative benchmark tables.
- **Step 10: HTML Dashboard Pages (`public/*.html`)**
  - Created `public/index.html` (Virtual File System).
  - Created `public/allocation.html` (Disk Space Allocation Methods).
  - Created `public/disk-scheduling.html` (Disk Scheduling & Performance Comparison).

### Session 4: Deployment & Documentation
- **Step 11: Windows Startup Launcher (`start.bat`)**
  - Created one-click batch script that checks Node.js, installs `node_modules` if absent, opens default browser to `http://localhost:3000`, and starts Express server.
- **Step 12: Comprehensive Documentation (`README.md`)**
  - Created complete educational README with architecture overview, algorithm summaries, mathematical formulations, and step-by-step usage guide.

---

## 3. Architecture & File Structure Summary
```
Operating-System-PBL-Sem5-/
├── package.json                   # Dependencies and scripts
├── server.js                      # Express server entry point & static file routing
├── start.bat                      # Windows 1-click startup automation script
├── README.md                      # Complete project documentation & guide
├── IMPLEMENTATION_LOG.md          # Chronological record of all edits & implementations
├── core/
│   ├── FileSystem.js              # VFS, Inodes, Open File Table, POSIX calls
│   ├── DiskAllocator.js           # Contiguous (First/Best/Worst Fit), Linked, Indexed, Compaction
│   └── DiskScheduler.js           # FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK algorithms
├── routes/
│   ├── fsRoutes.js                # REST API endpoints for File System
│   ├── allocationRoutes.js        # REST API endpoints for Disk Allocation
│   ├── diskRoutes.js              # REST API endpoints for Disk Scheduling
│   └── reportRoutes.js            # Printable simulation report generator
└── public/
    ├── index.html                 # Page 1: File Operations & VFS Explorer
    ├── allocation.html            # Page 2: Disk Allocation Visualizer
    ├── disk-scheduling.html       # Page 3: Disk Arm Scheduling & Benchmark
    ├── css/
    │   ├── main.css               # Core modern dark design system
    │   ├── file-ops.css           # VFS Explorer & terminal styling
    │   ├── allocation.css         # 64-block disk map styling
    │   └── disk.css               # Animation canvas & comparison styling
    └── js/
        ├── api.js                 # Shared REST API client
        ├── notifications.js       # Toast alert system
        ├── file-ops.js            # VFS controller & modals
        ├── allocation.js          # Disk allocator controller & block inspector
        ├── disk.js                # HTML5 Canvas animation engine
        └── comparison.js          # Multi-algorithm benchmark & Chart.js
```

---


---

## 4. Key Verification Metrics
- **Node.js Environment:** Verified running on `v24.13.1` with Express `v4.19.2`.
- **POSIX System Calls Tested:** `mkdir`, `creat`, `open`, `close`, `read`, `write`, `append`, `unlink`, `rename`, `move`, `copy`, `chmod`.
- **Allocation Policies Tested:** Contiguous (First-Fit, Best-Fit, Worst-Fit), Linked List with pointers, Indexed with dedicated Index Block.
- **Disk Scheduling Algorithms Tested:** FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK.
- **Data Persistence & Portability:** JSON state export and import supported on all modules.

---

## 5. Session 5: GitHub Deployment & Dual-Mode Hosting Engine
- **GitHub Repository Sync:** Verified Git remote `origin` pointing to `https://github.com/SamridhiParashar-28/Operating-System-PBL-Sem5-.git`.
- **Created `.gitignore`:** Added exclusions for `node_modules/`, `package-lock.json`, and debug logs.
- **Created GitHub Actions Workflow (`.github/workflows/deploy-pages.yml`):** Automated deployment workflow targeting GitHub Pages using `actions/deploy-pages@v4` pointing to the `./public` artifact directory.
- **Dual-Mode Client Engine (`public/js/api.js`):** Engineered a transparent fallback layer containing client-side simulation engines (`ClientFS`, `ClientAllocator`, `ClientScheduler`). When deployed statically to GitHub Pages, the simulator executes 100% in-browser without requiring an active cloud backend.

---

## 6. Session 6: Root Placement for Branch-Based GitHub Pages Deployment
- **Root Placement for GitHub Pages:** Placed `index.html`, `allocation.html`, `disk-scheduling.html`, `css/`, and `js/` directly at repository root `/` so that selecting **Deploy from a branch -> main / (root)** in GitHub Settings immediately serves `index.html` instead of `README.md`.
- **Created `.nojekyll`:** Added `.nojekyll` to root to disable GitHub Jekyll markdown transformation and directory filtering.
- **Updated `server.js`:** Configured Express to serve both root and `public/` directory so local Node.js execution via `start.bat` remains 100% compatible.


