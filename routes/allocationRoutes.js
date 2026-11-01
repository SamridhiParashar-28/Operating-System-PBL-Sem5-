/**
 * routes/allocationRoutes.js
 * REST API Endpoints for Disk Allocation Methods:
 * Contiguous, Linked, Indexed, Compaction, Fragmentation stats, Import/Export
 */

const express = require('express');

module.exports = function createAllocationRouter(allocator) {
  const router = express.Router();

  // GET /api/allocation/state
  router.get('/state', (req, res) => {
    try {
      res.json({ success: true, ...allocator.getState() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/allocation/allocate
  router.post('/allocate', (req, res) => {
    try {
      const { fileName, size, strategy, placementPolicy } = req.body;
      const fileMeta = allocator.allocate(fileName, size, strategy, placementPolicy);
      res.json({
        success: true,
        message: `Allocated '${fileName}' (${fileMeta.blocks.length} blocks) using ${fileMeta.strategy.toUpperCase()}`,
        file: fileMeta,
        state: allocator.getState()
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/allocation/deallocate
  router.post('/deallocate', (req, res) => {
    try {
      const { fileName } = req.body;
      if (!fileName) return res.status(400).json({ success: false, error: 'fileName is required' });
      const result = allocator.deallocate(fileName);
      res.json({
        success: true,
        message: `Deallocated '${fileName}', freed ${result.freedBlocks} blocks`,
        result,
        state: allocator.getState()
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/allocation/compact
  router.post('/compact', (req, res) => {
    try {
      const result = allocator.compact();
      res.json({
        success: true,
        ...result,
        state: allocator.getState()
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/allocation/switch-strategy
  router.post('/switch-strategy', (req, res) => {
    try {
      const { strategy, placementPolicy } = req.body;
      const result = allocator.switchStrategy(strategy, placementPolicy);
      res.json({
        success: true,
        message: `Switched strategy to ${strategy.toUpperCase()}`,
        ...result,
        state: allocator.getState()
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/allocation/reset
  router.post('/reset', (req, res) => {
    try {
      allocator.initDisk();
      allocator.files.clear();
      allocator.colorIndex = 0;
      res.json({ success: true, message: 'Disk blocks cleared', state: allocator.getState() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/allocation/export
  router.get('/export', (req, res) => {
    try {
      const data = allocator.exportState();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="disk-allocation-map.json"');
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/allocation/import
  router.post('/import', (req, res) => {
    try {
      const data = req.body;
      const state = allocator.importState(data);
      res.json({ success: true, message: 'Disk allocation state imported successfully', state });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
};
