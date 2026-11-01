/**
 * routes/reportRoutes.js
 * Generates comprehensive educational simulation reports (HTML / Markdown)
 * summarizing File System state, Allocation methods, and Disk Scheduling benchmarks.
 */

const express = require('express');

module.exports = function createReportRouter(fileSystem, allocator, scheduler) {
  const router = express.Router();

  // GET /api/report/summary (JSON)
  router.get('/summary', (req, res) => {
    try {
      const fsTree = fileSystem.getTree(0);
      const fsLogs = fileSystem.operationLogs.slice(0, 15);
      const openFiles = fileSystem.getOpenFileTable();
      const allocStats = allocator.getStatistics();
      const allocFiles = Array.from(allocator.files.values());

      // Run default comparison on current sample queue
      const sampleQueue = [98, 183, 37, 122, 14, 124, 65, 67];
      const diskComparison = scheduler.compareAll(sampleQueue, 53, 'up', 199);

      res.json({
        success: true,
        generatedAt: new Date().toISOString(),
        fileSystem: {
          totalInodes: fileSystem.inodes.size,
          openFileCount: openFiles.length,
          openFiles,
          recentLogs: fsLogs
        },
        allocation: {
          stats: allocStats,
          files: allocFiles
        },
        diskScheduling: diskComparison
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/report/download (Styled HTML printable report)
  router.get('/download', (req, res) => {
    try {
      const openFiles = fileSystem.getOpenFileTable();
      const allocStats = allocator.getStatistics();
      const allocFiles = Array.from(allocator.files.values());
      const fsLogs = fileSystem.operationLogs.slice(0, 10);
      const sampleQueue = [98, 183, 37, 122, 14, 124, 65, 67];
      const diskComparison = scheduler.compareAll(sampleQueue, 53, 'up', 199);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Operating Systems Simulation Report</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 36px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155; }
    h1 { color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-top: 0; }
    h2 { color: #818cf8; margin-top: 32px; border-bottom: 1px solid #334155; padding-bottom: 6px; }
    h3 { color: #f1f5f9; }
    .meta-box { background: #0f172a; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; border-left: 4px solid #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; margin-bottom: 24px; font-size: 14px; }
    th, td { border: 1px solid #334155; padding: 10px 14px; text-align: left; }
    th { background: #0f172a; color: #94a3b8; font-weight: 600; }
    tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-best { background: #065f46; color: #34d399; }
    .badge-info { background: #1e3a8a; color: #93c5fd; }
    .print-btn { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; float: right; }
    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .container { background: #fff; box-shadow: none; border: none; max-width: 100%; padding: 0; }
      .print-btn { display: none; }
      th { background: #eee; color: #000; }
      th, td { border: 1px solid #ccc; }
      h1, h2, h3 { color: #000; }
      .meta-box { background: #f9f9f9; border-left-color: #000; color: #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
    <h1>OS Lab PBL Simulation Report</h1>
    <div class="meta-box">
      <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
      <strong>Course:</strong> Operating Systems Lab (PBL - Sem 5)<br>
      <strong>Simulator:</strong> Mini File System + Disk Scheduling Simulator
    </div>

    <h2>1. Virtual File System (VFS) Status</h2>
    <p>Total Inodes Managed: <strong>${fileSystem.inodes.size}</strong> | Open File Descriptors: <strong>${openFiles.length}</strong></p>
    <table>
      <thead>
        <tr><th>Inode ID</th><th>Name</th><th>Type</th><th>Size</th><th>Permissions</th><th>Owner</th></tr>
      </thead>
      <tbody>
        ${Array.from(fileSystem.inodes.values()).map(inode => `
          <tr>
            <td>${inode.id}</td>
            <td>${inode.name}</td>
            <td><span class="badge badge-info">${inode.type}</span></td>
            <td>${inode.size} B</td>
            <td><code>${inode.getPermissionString()}</code></td>
            <td>${inode.owner}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>2. Disk Space Allocation Analysis</h2>
    <p>Current Strategy: <strong>${allocStats.currentStrategy.toUpperCase()}</strong> (${allocStats.placementPolicy})</p>
    <table>
      <thead>
        <tr><th>Metric</th><th>Value</th><th>Description</th></tr>
      </thead>
      <tbody>
        <tr><td>Total Disk Capacity</td><td>${allocStats.totalCapacityBytes} Bytes (${allocStats.totalBlocks} blocks @ ${allocStats.blockSize}B)</td><td>Simulated block device size</td></tr>
        <tr><td>Used Disk Blocks</td><td>${allocStats.usedBlocks} / ${allocStats.totalBlocks} (${((allocStats.usedBlocks/allocStats.totalBlocks)*100).toFixed(1)}%)</td><td>Data and index blocks in use</td></tr>
        <tr><td>Free Blocks</td><td>${allocStats.freeBlocks} blocks</td><td>Available for new file allocation</td></tr>
        <tr><td>Internal Fragmentation</td><td>${allocStats.internalFragmentationBytes} Bytes</td><td>Unused space within final allocated blocks</td></tr>
        <tr><td>External Fragmentation</td><td>${allocStats.hasExternalFragmentation ? allocStats.externalFragmentationBlocks + ' blocks scattered' : 'None (Contiguous free run)'}</td><td>Non-contiguous free gaps</td></tr>
        <tr><td>Storage Space Efficiency</td><td>${allocStats.storageEfficiencyPercent}%</td><td>Ratio of file payload to allocated block space</td></tr>
      </tbody>
    </table>

    <h2>3. Disk Scheduling Performance Comparison</h2>
    <p>Tested Queue: <code>[${sampleQueue.join(', ')}]</code> | Initial Head Position: <strong>53</strong> (Direction: UP)</p>
    <table>
      <thead>
        <tr><th>Algorithm</th><th>Total Head Movement</th><th>Average Seek Time</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${diskComparison.summaryTable.map(row => `
          <tr>
            <td><strong>${row.algorithm}</strong> (${row.name})</td>
            <td><strong>${row.totalHeadMovement}</strong> cylinders</td>
            <td>${row.averageSeekTime} cyl/req</td>
            <td>${row.isBest ? '<span class="badge badge-best">★ Optimal (Lowest Seek)</span>' : `+${row.differenceFromBest} (${row.percentDifference})`}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="meta-box" style="border-left-color: #34d399; margin-top: 30px;">
      <strong>Educational Takeaway:</strong> In this test queue, <strong>${diskComparison.bestAlgorithm.algorithm}</strong> achieved the minimum head movement (${diskComparison.bestAlgorithm.totalHeadMovement} cylinders) due to avoiding unnecessary boundary traversals and optimizing local seek proximity.
    </div>
  </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', 'inline; filename="os-simulation-report.html"');
      res.send(html);
    } catch (err) {
      res.status(500).send(`Error generating report: ${err.message}`);
    }
  });

  return router;
};
