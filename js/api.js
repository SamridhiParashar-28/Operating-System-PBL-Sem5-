/**
 * api.js
 * Modular REST API client for File System, Disk Allocation, and Disk Scheduling.
 */

const API = {
  // Helper for requests
  async request(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server error occurred');
      }
      return data;
    } catch (err) {
      console.error(`API Error [${url}]:`, err);
      throw err;
    }
  },

  // File System APIs
  fs: {
    getTree: () => API.request('/api/fs/tree'),
    list: (path = '/') => API.request(`/api/fs/list?path=${encodeURIComponent(path)}`),
    getMetadata: (path) => API.request(`/api/fs/metadata?path=${encodeURIComponent(path)}`),
    mkdir: (path, permissions) => API.request('/api/fs/mkdir', { method: 'POST', body: JSON.stringify({ path, permissions }) }),
    createFile: (path, content, permissions) => API.request('/api/fs/create', { method: 'POST', body: JSON.stringify({ path, content, permissions }) }),
    open: (path, mode) => API.request('/api/fs/open', { method: 'POST', body: JSON.stringify({ path, mode }) }),
    close: (fd) => API.request('/api/fs/close', { method: 'POST', body: JSON.stringify({ fd }) }),
    read: (fd, length) => API.request('/api/fs/read', { method: 'POST', body: JSON.stringify({ fd, length }) }),
    write: (fd, data) => API.request('/api/fs/write', { method: 'POST', body: JSON.stringify({ fd, data }) }),
    edit: (path, content) => API.request('/api/fs/edit', { method: 'POST', body: JSON.stringify({ path, content }) }),
    append: (path, data) => API.request('/api/fs/append', { method: 'POST', body: JSON.stringify({ path, data }) }),
    delete: (path, recursive = false) => API.request('/api/fs/delete', { method: 'POST', body: JSON.stringify({ path, recursive }) }),
    rename: (path, newName) => API.request('/api/fs/rename', { method: 'POST', body: JSON.stringify({ path, newName }) }),
    move: (srcPath, destDirPath) => API.request('/api/fs/move', { method: 'POST', body: JSON.stringify({ srcPath, destDirPath }) }),
    copy: (srcPath, destDirPath) => API.request('/api/fs/copy', { method: 'POST', body: JSON.stringify({ srcPath, destDirPath }) }),
    chmod: (path, mode) => API.request('/api/fs/chmod', { method: 'POST', body: JSON.stringify({ path, mode }) }),
    getOpenFiles: () => API.request('/api/fs/open-files'),
    getLogs: () => API.request('/api/fs/logs'),
    reset: () => API.request('/api/fs/reset', { method: 'POST' }),
    importState: (jsonState) => API.request('/api/fs/import', { method: 'POST', body: JSON.stringify(jsonState) })
  },

  // Disk Allocation APIs
  allocation: {
    getState: () => API.request('/api/allocation/state'),
    allocate: (fileName, size, strategy, placementPolicy) => API.request('/api/allocation/allocate', {
      method: 'POST',
      body: JSON.stringify({ fileName, size, strategy, placementPolicy })
    }),
    deallocate: (fileName) => API.request('/api/allocation/deallocate', {
      method: 'POST',
      body: JSON.stringify({ fileName })
    }),
    compact: () => API.request('/api/allocation/compact', { method: 'POST' }),
    switchStrategy: (strategy, placementPolicy) => API.request('/api/allocation/switch-strategy', {
      method: 'POST',
      body: JSON.stringify({ strategy, placementPolicy })
    }),
    reset: () => API.request('/api/allocation/reset', { method: 'POST' }),
    importState: (jsonState) => API.request('/api/allocation/import', {
      method: 'POST',
      body: JSON.stringify(jsonState)
    })
  },

  // Disk Scheduling APIs
  disk: {
    schedule: (algorithm, queue, initialHead, direction, maxCylinder) => API.request('/api/disk/schedule', {
      method: 'POST',
      body: JSON.stringify({ algorithm, queue, initialHead, direction, maxCylinder })
    }),
    compareAll: (queue, initialHead, direction, maxCylinder) => API.request('/api/disk/compare-all', {
      method: 'POST',
      body: JSON.stringify({ queue, initialHead, direction, maxCylinder })
    }),
    getPresets: () => API.request('/api/disk/presets'),
    exportCsv: async (summaryTable, queue, initialHead) => {
      const res = await fetch('/api/disk/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryTable, queue, initialHead })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'disk-scheduling-comparison.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }
};

window.API = API;
