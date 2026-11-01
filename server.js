/**
 * server.js
 * Mini File System & Disk Scheduling Simulator
 * Express Backend Server
 */

const express = require('express');
const path = require('path');
const FileSystem = require('./core/FileSystem');
const DiskAllocator = require('./core/DiskAllocator');
const DiskScheduler = require('./core/DiskScheduler');

const createFsRouter = require('./routes/fsRoutes');
const createAllocationRouter = require('./routes/allocationRoutes');
const createDiskRouter = require('./routes/diskRoutes');
const createReportRouter = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Core OS Simulation Engines in Memory
const fileSystem = new FileSystem();
const diskAllocator = new DiskAllocator(64, 512); // 64 blocks, 512 bytes each
const diskScheduler = new DiskScheduler(199);      // 200 cylinders: 0 to 199

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static frontend assets (supports both root placement for GitHub Pages and public/ folder)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routers
app.use('/api/fs', createFsRouter(fileSystem));
app.use('/api/allocation', createAllocationRouter(diskAllocator));
app.use('/api/disk', createDiskRouter(diskScheduler));
app.use('/api/report', createReportRouter(fileSystem, diskAllocator, diskScheduler));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Pretty page routes
app.get('/file-ops', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/allocation', (req, res) => {
  res.sendFile(path.join(__dirname, 'allocation.html'));
});

app.get('/disk', (req, res) => {
  res.sendFile(path.join(__dirname, 'disk-scheduling.html'));
});

app.get('/disk-scheduling', (req, res) => {
  res.sendFile(path.join(__dirname, 'disk-scheduling.html'));
});


// Start Server
app.listen(PORT, () => {
  console.log('================================================================');
  console.log('  MINI FILE SYSTEM & DISK SCHEDULING SIMULATOR (OS LAB PBL)     ');
  console.log('================================================================');
  console.log(`  ✓ Server running at: http://localhost:${PORT}`);
  console.log(`  ✓ File Operations:   http://localhost:${PORT}/file-ops`);
  console.log(`  ✓ Disk Allocation:   http://localhost:${PORT}/allocation`);
  console.log(`  ✓ Disk Scheduling:   http://localhost:${PORT}/disk`);
  console.log('================================================================');
});
