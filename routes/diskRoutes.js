/**
 * routes/diskRoutes.js
 * REST API Endpoints for Disk Scheduling:
 * FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK, comparative benchmarking, CSV/JSON export
 */

const express = require('express');

module.exports = function createDiskRouter(scheduler) {
  const router = express.Router();

  // POST /api/disk/schedule
  router.post('/schedule', (req, res) => {
    try {
      const { algorithm = 'fcfs', queue, initialHead = 53, direction = 'up', maxCylinder = 199 } = req.body;
      const result = scheduler.run(algorithm, queue, initialHead, direction, maxCylinder);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/disk/compare-all
  router.post('/compare-all', (req, res) => {
    try {
      const { queue, initialHead = 53, direction = 'up', maxCylinder = 199 } = req.body;
      const comparison = scheduler.compareAll(queue, initialHead, direction, maxCylinder);
      res.json({ success: true, ...comparison });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // GET /api/disk/presets
  router.get('/presets', (req, res) => {
    try {
      const presets = scheduler.getPresets();
      res.json({ success: true, presets });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/disk/export-csv
  router.post('/export-csv', (req, res) => {
    try {
      const { summaryTable, queue, initialHead } = req.body;
      if (!Array.isArray(summaryTable)) {
        return res.status(400).json({ success: false, error: 'summaryTable is required' });
      }

      let csv = `Request Queue,"${(queue || []).join(', ')}"\n`;
      csv += `Initial Head Position,${initialHead}\n\n`;
      csv += 'Algorithm,Name,Total Head Movement (Cylinders),Average Seek Time,Total Steps,Diff From Best,Percent Diff\n';

      for (const row of summaryTable) {
        csv += `"${row.algorithm}","${row.name}",${row.totalHeadMovement},${row.averageSeekTime},${row.totalSteps},${row.differenceFromBest},"${row.percentDifference}"\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="disk-scheduling-comparison.csv"');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
