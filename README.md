# Mini File System + Disk Scheduling Simulator

A modern, full-stack educational simulator built for **Operating Systems Lab (Project-Based Learning — Semester 5)**.

This application provides an interactive, visual environment to understand and analyze:
1. **Virtual File Systems (VFS):** Inodes, hierarchical directories, POSIX file permissions (`rwx`), active Open File Table descriptors (`fd`), and real-time kernel system call tracing.
2. **Disk Space Allocation Methods:** Contiguous Allocation (with First-Fit, Best-Fit, and Worst-Fit placement policies plus Disk Compaction), Linked Allocation, and Indexed Allocation with live fragmentation tracking.
3. **Disk Arm Scheduling Algorithms:** Visual, animated simulation of **FCFS, SSTF, SCAN, C-SCAN, LOOK, and C-LOOK**, with a side-by-side comparative benchmarking dashboard.

---

## 📸 Screenshots

*(Place screenshots of the application dashboard here)*

| 1. Virtual File System Explorer | 2. Disk Allocation Platter Map |
| :---: | :---: |
| ![VFS Explorer Screenshot](docs/screenshots/vfs-explorer.png) | ![Disk Allocation Screenshot](docs/screenshots/disk-allocation.png) |

| 3. Disk Arm Scheduling Simulator | 4. Multi-Algorithm Performance Benchmark |
| :---: | :---: |
| ![Disk Scheduling Screenshot](docs/screenshots/disk-scheduling.png) | ![Performance Comparison Screenshot](docs/screenshots/performance-chart.png) |

---

## ✨ Key Features

### 1. File Operations Page (`/file-ops` or `index.html`)
- **Virtual Inode Architecture:** Every file and folder maintains an Inode with unique ID, ownership, timestamps, size, permissions, and block pointers.
- **Classic OS Operations:**
  - Create file (`sys_creat`) and directory (`sys_mkdir`)
  - Open (`sys_open`) with access modes (`r`, `w`, `a`), generating File Descriptors (`fd`)
  - Streaming Read (`sys_read`) and Write (`sys_write`) tracking cursor offset
  - Append to file (`sys_append`)
  - Rename (`sys_rename`), Move (`sys_move`), and Copy (`sys_copy`)
  - Delete (`sys_unlink` / `sys_rmdir`) with optional recursive subtree removal
  - Change permissions (`sys_chmod`) using a 9-box user/group/others interactive octal matrix
- **Active Open File Table (OFTable):** Live monitor of currently opened files, assigned file descriptors, and cursor positions.
- **Kernel System Call Console:** Real-time streaming terminal logging every low-level operation with timestamps and status.
- **Directory Tree & Breadcrumb Navigation:** Interactive tree view with expandable folders and path breadcrumbs.
- **Import / Export:** Download or upload the complete file system state as JSON.

### 2. Disk Allocation Methods Page (`/allocation` or `allocation.html`)
- **Interactive 64-Block Disk Device:** 64 blocks of 512 bytes each (32 KB total simulated capacity).
- **Three Classic Allocation Strategies:**
  - **Contiguous Allocation:** Continuous blocks with placement policies:
    - *First-Fit:* Selects the first hole large enough.
    - *Best-Fit:* Selects the smallest hole that fits the file.
    - *Worst-Fit:* Selects the largest hole to leave useful remnant space.
  - **Linked Allocation:** Scattered block allocation where each block points to the next block in the chain.
  - **Indexed Allocation:** Dedicated **Index Block** storing pointers to all allocated data blocks.
- **Disk Compaction (Defragmentation):** One-click defragmenter that reorganizes fragmented blocks to the beginning of the disk.
- **Dynamic Fragmentation Analytics:**
  - *Internal Fragmentation:* Wasted bytes inside the tail blocks (`blockSize - (size % blockSize)`).
  - *External Fragmentation:* Number of free blocks trapped in non-contiguous gaps.
  - *Storage Space Efficiency:* Ratio of file data to allocated disk space.
- **Strategy Switching:** Switch existing files on-the-fly between Contiguous, Linked, and Indexed schemes for instant comparison.

### 3. Disk Scheduling Page (`/disk` or `disk-scheduling.html`)
- **Six Algorithms Implemented:**
  1. **FCFS (First-Come, First-Served):** Services requests strictly in arrival order.
  2. **SSTF (Shortest Seek Time First):** Greedily chooses the request with minimum seek distance from current head.
  3. **SCAN (Elevator Algorithm):** Sweeps in one direction to the disk boundary (0 or max), then reverses.
  4. **C-SCAN (Circular SCAN):** Sweeps in one direction, resets to the boundary without servicing on return.
  5. **LOOK:** Sweeps in one direction only as far as the furthest request, avoiding unnecessary boundary seeks.
  6. **C-LOOK (Circular LOOK):** Like C-SCAN, but only travels between the lowest and highest requested cylinders.
- **Animated HTML5 Canvas Visualizer:**
  - Renders physical disk track line, numbered ticks, and glowing magnetic head carriage.
  - Color-coded pending request pins (orange = pending, green = serviced).
  - 2D seek trajectory path graph tracing head movements over time.
  - Play, Pause, Step-Forward, Reset, and Speed multiplier (0.5x, 1x, 2x, 4x) controls.
- **Step-by-Step Seek Execution Table:** Detailed trace showing From Cylinder, To Cylinder, Seek Distance, and Running Cumulative Seek.
- **Textbook Presets:** Includes classic textbook scenarios (Silberschatz Example, High Locality, Wild Swings, Uniform) + Random Request Generator.
- **Sub-Page: Performance Comparison (All 6 Algorithms):**
  - Run all 6 algorithms simultaneously on the same request queue with one click.
  - Winner trophy banner indicating optimal algorithm.
  - Side-by-side comparison table with seek distances, average seek times, and percent difference from best.
  - Interactive **Chart.js** bar chart.
  - Export benchmark results as CSV or JSON.

### 4. Simulation Report Generator
- Click **"Download Report"** in the sidebar to generate a printable, styled HTML simulation summary documenting the VFS state, disk allocation map, and disk scheduling benchmark.

---

## 🚀 How to Run

### Method 1: One-Click Startup (Windows)
Double-click the **`start.bat`** file in the project directory.

The batch script will automatically:
1. Verify Node.js is installed.
2. Check if `node_modules` exists; if not, automatically run `npm install`.
3. Open your default web browser to `http://localhost:3000`.
4. Start the Express backend server.

### Method 2: Manual Terminal Commands
Open a terminal in the project folder and run:

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open your browser and navigate to:
# http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## 📁 Project Architecture & Structure

```
Operating-System-PBL-Sem5-/
├── package.json                   # Project metadata and Express dependency
├── server.js                      # Express backend entry point & route registration
├── start.bat                      # Windows 1-click startup automation script
├── README.md                      # Comprehensive project documentation
├── IMPLEMENTATION_LOG.md          # Chronological log of all edits and implementations
├── core/                          # In-memory OS Simulation Engines
│   ├── FileSystem.js              # Inode VFS, permissions, file descriptor table
│   ├── DiskAllocator.js           # Contiguous, Linked, Indexed allocation & Compaction
│   └── DiskScheduler.js           # FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK algorithms
├── routes/                        # REST API Route Handlers
│   ├── fsRoutes.js                # Endpoints for File System CRUD, Inodes, and OFTable
│   ├── allocationRoutes.js        # Endpoints for disk block operations and compaction
│   ├── diskRoutes.js              # Endpoints for scheduling simulations and CSV export
│   └── reportRoutes.js            # Printable simulation report generator
└── public/                        # Pure Frontend (HTML5, Vanilla CSS, Vanilla JS)
    ├── index.html                 # Page 1: File Operations & VFS Explorer
    ├── allocation.html            # Page 2: Disk Allocation Visualizer
    ├── disk-scheduling.html       # Page 3: Disk Arm Scheduling & Benchmark
    ├── css/
    │   ├── main.css               # Core modern dark design system & responsive layout
    │   ├── file-ops.css           # VFS Explorer & terminal console styling
    │   ├── allocation.css         # 64-block disk map styling
    │   └── disk.css               # Animation canvas & comparison styling
    └── js/
        ├── api.js                 # Shared REST API client
        ├── notifications.js       # Toast alert system
        ├── file-ops.js            # VFS controller, tree view, and modals
        ├── allocation.js          # Disk allocator controller & block inspector
        ├── disk.js                # HTML5 Canvas animation engine
        └── comparison.js          # Multi-algorithm benchmark & Chart.js renderer
```

---

## 🧮 Theoretical Background & Calculations

### Disk Allocation Equations
- **Internal Fragmentation:**
  $$\text{Internal Frag} = \begin{cases} 
  \text{Block Size} - (\text{File Size} \pmod{\text{Block Size}}), & \text{if } \text{File Size} \pmod{\text{Block Size}} \neq 0 \\
  0, & \text{otherwise}
  \end{cases}$$
- **Storage Space Efficiency:**
  $$\text{Efficiency } (\%) = \left(\frac{\sum \text{File Bytes}}{\text{Total Allocated Blocks} \times \text{Block Size}}\right) \times 100$$

### Disk Scheduling Equations
- **Total Head Movement:**
  $$\text{Total Seek} = \sum_{i=1}^{N} |C_i - C_{i-1}|$$
  *(where $C_0$ is the initial head position and $C_i$ is the $i$-th cylinder visited).*
- **Average Seek Time:**
  $$\text{Avg Seek Time} = \frac{\text{Total Seek}}{\text{Number of Serviced Requests}}$$

---

## 💡 Future Improvement Ideas
1. Add multi-level indexed allocation (Single indirect, Double indirect, Triple indirect like Unix FFS/ext4).
2. Simulate process concurrency with multiple simulated threads issuing simultaneous I/O requests.
3. Add a rotational latency visualization (sector rotation on disk platters).
4. Introduce Access Control Lists (ACLs) alongside traditional POSIX permissions.

---

## 👤 Author
- **Course:** Operating Systems Lab (PBL - Sem 5)
- **Student Name:** Samridhi Parashar
- **Academic Year:** 2026-2027
