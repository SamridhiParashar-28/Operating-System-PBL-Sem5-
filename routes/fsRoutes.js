/**
 * routes/fsRoutes.js
 * REST API Endpoints for File System operations:
 * CRUD, Inode metadata, Open File Table, Permissions, System Log, Import/Export
 */

const express = require('express');

module.exports = function createFsRouter(fileSystem) {
  const router = express.Router();

  // GET /api/fs/tree
  router.get('/tree', (req, res) => {
    try {
      const tree = fileSystem.getTree(0);
      res.json({ success: true, tree });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/fs/list?path=/
  router.get('/list', (req, res) => {
    try {
      const path = req.query.path || '/';
      const items = fileSystem.list(path);
      res.json({ success: true, path, items });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // GET /api/fs/metadata?path=/home/user/welcome.txt
  router.get('/metadata', (req, res) => {
    try {
      const path = req.query.path;
      if (!path) return res.status(400).json({ success: false, error: 'Path is required' });
      const meta = fileSystem.getFileMetadata(path);
      res.json({ success: true, metadata: meta });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/mkdir
  router.post('/mkdir', (req, res) => {
    try {
      const { path, permissions } = req.body;
      if (!path) return res.status(400).json({ success: false, error: 'Path is required' });
      const perm = permissions ? parseInt(permissions, 8) : 0o755;
      const inode = fileSystem.mkdir(path, perm);
      res.json({ success: true, message: `Created directory '${path}'`, inode });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/create
  router.post('/create', (req, res) => {
    try {
      const { path, content = '', permissions } = req.body;
      if (!path) return res.status(400).json({ success: false, error: 'Path is required' });
      const perm = permissions ? parseInt(permissions, 8) : 0o644;
      const inode = fileSystem.createFile(path, content, perm);
      res.json({ success: true, message: `Created file '${path}'`, inode });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/open
  router.post('/open', (req, res) => {
    try {
      const { path, mode = 'r' } = req.body;
      if (!path) return res.status(400).json({ success: false, error: 'Path is required' });
      const descriptor = fileSystem.open(path, mode);
      res.json({ success: true, message: `Opened '${path}' (FD: ${descriptor.fd})`, descriptor });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/close
  router.post('/close', (req, res) => {
    try {
      const { fd } = req.body;
      if (fd === undefined) return res.status(400).json({ success: false, error: 'FD is required' });
      fileSystem.close(fd);
      res.json({ success: true, message: `Closed file descriptor ${fd}` });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/read
  router.post('/read', (req, res) => {
    try {
      const { fd, length } = req.body;
      if (fd === undefined) return res.status(400).json({ success: false, error: 'FD is required' });
      const result = fileSystem.read(fd, length ? parseInt(length, 10) : null);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/write
  router.post('/write', (req, res) => {
    try {
      const { fd, data } = req.body;
      if (fd === undefined || data === undefined) {
        return res.status(400).json({ success: false, error: 'FD and data are required' });
      }
      const result = fileSystem.write(fd, data);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/edit (direct content update)
  router.post('/edit', (req, res) => {
    try {
      const { path, content } = req.body;
      if (!path || content === undefined) {
        return res.status(400).json({ success: false, error: 'Path and content are required' });
      }
      const inode = fileSystem.writeFileContent(path, content);
      res.json({ success: true, message: `Updated '${path}'`, inode });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/append
  router.post('/append', (req, res) => {
    try {
      const { path, data } = req.body;
      if (!path || data === undefined) {
        return res.status(400).json({ success: false, error: 'Path and data are required' });
      }
      const inode = fileSystem.appendFileContent(path, data);
      res.json({ success: true, message: `Appended data to '${path}'`, inode });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/delete
  router.post('/delete', (req, res) => {
    try {
      const { path, recursive = false } = req.body;
      if (!path) return res.status(400).json({ success: false, error: 'Path is required' });
      fileSystem.delete(path, !!recursive);
      res.json({ success: true, message: `Deleted '${path}'` });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/rename
  router.post('/rename', (req, res) => {
    try {
      const { path, newName } = req.body;
      if (!path || !newName) return res.status(400).json({ success: false, error: 'Path and newName are required' });
      const inode = fileSystem.rename(path, newName);
      res.json({ success: true, message: `Renamed to '${newName}'`, inode });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/move
  router.post('/move', (req, res) => {
    try {
      const { srcPath, destDirPath } = req.body;
      if (!srcPath || !destDirPath) {
        return res.status(400).json({ success: false, error: 'srcPath and destDirPath are required' });
      }
      const inode = fileSystem.move(srcPath, destDirPath);
      res.json({ success: true, message: `Moved to '${destDirPath}'`, inode });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/copy
  router.post('/copy', (req, res) => {
    try {
      const { srcPath, destDirPath } = req.body;
      if (!srcPath || !destDirPath) {
        return res.status(400).json({ success: false, error: 'srcPath and destDirPath are required' });
      }
      const inode = fileSystem.copy(srcPath, destDirPath);
      res.json({ success: true, message: `Copied '${srcPath}' into '${destDirPath}'`, inode });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/chmod
  router.post('/chmod', (req, res) => {
    try {
      const { path, mode } = req.body;
      if (!path || mode === undefined) {
        return res.status(400).json({ success: false, error: 'Path and mode are required' });
      }
      const result = fileSystem.chmod(path, mode);
      res.json({ success: true, message: `Changed permissions`, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // GET /api/fs/open-files
  router.get('/open-files', (req, res) => {
    try {
      const list = fileSystem.getOpenFileTable();
      res.json({ success: true, openFiles: list });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/fs/logs
  router.get('/logs', (req, res) => {
    try {
      res.json({ success: true, logs: fileSystem.operationLogs });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/fs/export
  router.get('/export', (req, res) => {
    try {
      const data = fileSystem.exportState();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="mini-filesystem-state.json"');
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/import
  router.post('/import', (req, res) => {
    try {
      const state = req.body;
      const result = fileSystem.importState(state);
      res.json({ success: true, message: `Successfully imported ${result.count} files and directories`, result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/fs/reset
  router.post('/reset', (req, res) => {
    try {
      fileSystem.reset();
      res.json({ success: true, message: 'File system reset to factory default state' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
