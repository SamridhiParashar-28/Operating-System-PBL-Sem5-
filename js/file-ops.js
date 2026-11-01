/**
 * file-ops.js
 * Frontend controller for File Operations & Virtual File System (VFS)
 */

document.addEventListener('DOMContentLoaded', () => {
  const FileOpsApp = {
    currentPath: '/',
    selectedItem: null,
    treeData: null,
    expandedPaths: new Set(['/']),

    async init() {
      this.bindEvents();
      await this.refresh();
      // Auto-poll logs every 4 seconds to show background activities
      setInterval(() => this.loadLogs(), 4000);
      setInterval(() => this.loadOpenFiles(), 4000);
    },

    bindEvents() {
      // Toolbar action buttons
      document.getElementById('btnNewFile')?.addEventListener('click', () => this.showNewFileModal());
      document.getElementById('btnNewFolder')?.addEventListener('click', () => this.showNewFolderModal());
      document.getElementById('btnResetFs')?.addEventListener('click', () => this.resetFileSystem());
      document.getElementById('btnExportFs')?.addEventListener('click', () => {
        window.location.href = '/api/fs/export';
      });
      document.getElementById('importFileInput')?.addEventListener('change', (e) => this.handleImport(e));

      // Content preview save/append
      document.getElementById('btnSaveContent')?.addEventListener('click', () => this.saveFileContent());
      document.getElementById('btnAppendContent')?.addEventListener('click', () => this.appendFileContent());

      // Terminal clear
      document.getElementById('btnClearTerminal')?.addEventListener('click', () => {
        const body = document.getElementById('terminalBody');
        if (body) body.innerHTML = '<div style="color: #64748b; font-style: italic;">Audit log cleared from display.</div>';
      });

      // Modal close handlers
      document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const modal = e.target.closest('.modal-overlay');
          if (modal) modal.classList.remove('active');
        });
      });

      // Modal action forms
      document.getElementById('formNewFile')?.addEventListener('submit', (e) => this.handleNewFile(e));
      document.getElementById('formNewFolder')?.addEventListener('submit', (e) => this.handleNewFolder(e));
      document.getElementById('formRename')?.addEventListener('submit', (e) => this.handleRename(e));
      document.getElementById('formMove')?.addEventListener('submit', (e) => this.handleMove(e));
      document.getElementById('formCopy')?.addEventListener('submit', (e) => this.handleCopy(e));
      document.getElementById('formChmod')?.addEventListener('submit', (e) => this.handleChmod(e));
      document.getElementById('formOpen')?.addEventListener('submit', (e) => this.handleOpen(e));
      document.getElementById('formFdIo')?.addEventListener('submit', (e) => this.handleFdIo(e));

      // Chmod checkbox change listeners
      document.querySelectorAll('.chmod-cb').forEach(cb => {
        cb.addEventListener('change', () => this.updateChmodOctalDisplay());
      });
    },

    async refresh() {
      try {
        await Promise.all([
          this.loadTree(),
          this.loadDirectory(this.currentPath),
          this.loadOpenFiles(),
          this.loadLogs()
        ]);
      } catch (err) {
        Toast.error(err.message);
      }
    },

    // 1. Directory Tree
    async loadTree() {
      const data = await API.fs.getTree();
      this.treeData = data.tree;
      const container = document.getElementById('treeContainer');
      if (container) {
        container.innerHTML = '';
        container.appendChild(this.renderTreeNode(this.treeData));
      }
    },

    renderTreeNode(node) {
      const div = document.createElement('div');
      div.className = 'tree-node';

      const isDir = node.type === 'directory';
      const isExpanded = this.expandedPaths.has(node.path);

      const item = document.createElement('div');
      item.className = `tree-item ${node.path === this.currentPath ? 'active' : ''}`;
      item.innerHTML = `
        ${isDir ? `<span class="tree-toggle ${isExpanded ? 'open' : ''}">▶</span>` : '<span style="width:14px"></span>'}
        <span class="tree-icon">${isDir ? (isExpanded ? '📂' : '📁') : '📄'}</span>
        <span class="tree-name">${node.name}</span>
      `;

      // Click to toggle or navigate
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isDir) {
          if (this.expandedPaths.has(node.path)) {
            if (node.path !== '/') this.expandedPaths.delete(node.path);
          } else {
            this.expandedPaths.add(node.path);
          }
          this.navigateTo(node.path);
        } else {
          this.inspectItem(node.path);
        }
      });

      div.appendChild(item);

      if (isDir && node.children && isExpanded) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        for (const child of node.children) {
          childrenContainer.appendChild(this.renderTreeNode(child));
        }
        div.appendChild(childrenContainer);
      }

      return div;
    },

    // 2. Directory Listing
    async loadDirectory(path) {
      this.currentPath = path;
      this.renderBreadcrumb(path);
      const data = await API.fs.list(path);
      const tbody = document.getElementById('fileTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';
      if (data.items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:24px;">Empty directory</td></tr>`;
        return;
      }

      data.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = `file-row ${this.selectedItem?.path === item.path ? 'selected' : ''}`;
        const isDir = item.type === 'directory';

        tr.innerHTML = `
          <td>
            <div class="file-name-cell">
              <span>${isDir ? '📁' : '📄'}</span>
              <strong>${item.name}</strong>
            </div>
          </td>
          <td><span class="badge ${isDir ? 'badge-primary' : 'badge-purple'}">${item.type}</span></td>
          <td>${item.size} B</td>
          <td><span class="perm-code">${item.permissions} (${item.octalPerm})</span></td>
          <td><code>#${item.id}</code></td>
          <td style="color:#64748b; font-size:11px;">${new Date(item.modifiedAt).toLocaleTimeString()}</td>
          <td>
            <div class="action-buttons">
              ${!isDir ? `<button class="btn btn-secondary btn-sm" title="Open with File Descriptor" onclick="FileOpsApp.openFilePrompt('${item.path}')">Open</button>` : ''}
              <button class="btn btn-secondary btn-sm" title="Permissions (chmod)" onclick="FileOpsApp.showChmodModal('${item.path}', '${item.permissions}')">chmod</button>
              <button class="btn btn-secondary btn-sm" title="Rename" onclick="FileOpsApp.showRenameModal('${item.path}', '${item.name}')">Rename</button>
              <button class="btn btn-secondary btn-sm" title="Move" onclick="FileOpsApp.showMoveModal('${item.path}')">Move</button>
              <button class="btn btn-secondary btn-sm" title="Copy" onclick="FileOpsApp.showCopyModal('${item.path}')">Copy</button>
              <button class="btn btn-danger btn-sm" title="Delete" onclick="FileOpsApp.deletePrompt('${item.path}', ${isDir})">Del</button>
            </div>
          </td>
        `;

        tr.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          if (isDir) {
            this.expandedPaths.add(item.path);
            this.navigateTo(item.path);
          } else {
            this.inspectItem(item.path);
          }
        });

        tbody.appendChild(tr);
      });
    },

    navigateTo(path) {
      this.currentPath = path;
      this.loadTree();
      this.loadDirectory(path);
      this.inspectItem(path);
    },

    renderBreadcrumb(path) {
      const el = document.getElementById('breadcrumbContainer');
      if (!el) return;

      const parts = path === '/' ? [''] : path.split('/');
      el.innerHTML = '';

      let accum = '';
      parts.forEach((part, index) => {
        if (index === 0) {
          accum = '/';
          const span = document.createElement('span');
          span.className = 'breadcrumb-part';
          span.textContent = 'root (/)';
          span.addEventListener('click', () => this.navigateTo('/'));
          el.appendChild(span);
        } else {
          accum += (accum === '/' ? '' : '/') + part;
          const sep = document.createElement('span');
          sep.className = 'breadcrumb-separator';
          sep.textContent = '/';
          el.appendChild(sep);

          const curPath = accum;
          const span = document.createElement('span');
          span.className = 'breadcrumb-part';
          span.textContent = part;
          span.addEventListener('click', () => this.navigateTo(curPath));
          el.appendChild(span);
        }
      });
    },

    // 3. Metadata & Inspector
    async inspectItem(path) {
      try {
        const data = await API.fs.getMetadata(path);
        const meta = data.metadata;
        this.selectedItem = meta;

        document.getElementById('metaName').textContent = meta.name;
        document.getElementById('metaPath').textContent = meta.path;
        document.getElementById('metaType').textContent = meta.type.toUpperCase();
        document.getElementById('metaSize').textContent = `${meta.size} Bytes`;
        document.getElementById('metaInode').textContent = `#${meta.id}`;
        document.getElementById('metaOwner').textContent = meta.owner;
        document.getElementById('metaPerm').textContent = `${meta.permissions} (${meta.octalPerm})`;
        document.getElementById('metaModified').textContent = new Date(meta.modifiedAt).toLocaleTimeString();

        const previewContainer = document.getElementById('contentPreviewContainer');
        const textarea = document.getElementById('fileContentEditor');
        if (meta.type === 'file') {
          previewContainer.style.display = 'flex';
          textarea.value = meta.content || '';
          textarea.removeAttribute('disabled');
        } else {
          previewContainer.style.display = 'none';
        }
      } catch (err) {
        console.warn('Inspect failed:', err);
      }
    },

    async saveFileContent() {
      if (!this.selectedItem || this.selectedItem.type !== 'file') return;
      const content = document.getElementById('fileContentEditor').value;
      try {
        await API.fs.edit(this.selectedItem.path, content);
        Toast.success(`Saved '${this.selectedItem.name}' successfully`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    async appendFileContent() {
      if (!this.selectedItem || this.selectedItem.type !== 'file') return;
      const extra = prompt(`Enter text to append to '${this.selectedItem.name}':`);
      if (extra === null) return;
      try {
        await API.fs.append(this.selectedItem.path, '\n' + extra);
        Toast.success(`Appended text to '${this.selectedItem.name}'`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    // 4. Open File Descriptors Table
    async loadOpenFiles() {
      const data = await API.fs.getOpenFiles();
      const container = document.getElementById('openFdTags');
      const countBadge = document.getElementById('openFdCount');
      if (countBadge) countBadge.textContent = data.openFiles.length;

      if (!container) return;
      container.innerHTML = '';
      if (data.openFiles.length === 0) {
        container.innerHTML = `<span style="color:#64748b; font-size:12px;">No active file descriptors currently open.</span>`;
        return;
      }

      data.openFiles.forEach(fd => {
        const chip = document.createElement('div');
        chip.className = 'fd-chip';
        chip.innerHTML = `
          <span class="fd-badge">FD: ${fd.fd}</span>
          <span><strong>${fd.name}</strong> (${fd.mode})</span>
          <span style="color:#64748b;">cursor: ${fd.cursor}/${fd.fileSize}B</span>
          <button class="btn btn-secondary btn-sm" onclick="FileOpsApp.showFdIoModal(${fd.fd}, '${fd.path}', '${fd.mode}')">I/O</button>
          <button class="btn btn-danger btn-sm" onclick="FileOpsApp.closeFd(${fd.fd})">Close</button>
        `;
        container.appendChild(chip);
      });
    },

    async closeFd(fd) {
      try {
        await API.fs.close(fd);
        Toast.info(`Closed File Descriptor ${fd}`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    // 5. System Call Audit Console
    async loadLogs() {
      const data = await API.fs.getLogs();
      const body = document.getElementById('terminalBody');
      if (!body) return;

      body.innerHTML = '';
      data.logs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.innerHTML = `
          <span class="log-time">[${log.timestamp}]</span>
          <span class="log-op">${log.operation}</span>
          <span class="log-path">${log.path}</span>
          <span class="log-status-${log.status}">[${log.status}]</span>
          <span class="log-msg">${log.message}</span>
        `;
        body.appendChild(div);
      });
    },

    // Modals & Actions
    showNewFileModal() {
      document.getElementById('newFilePathPrefix').textContent = this.currentPath === '/' ? '/' : this.currentPath + '/';
      document.getElementById('newFileName').value = '';
      document.getElementById('newFileContent').value = '';
      document.getElementById('modalNewFile').classList.add('active');
    },

    async handleNewFile(e) {
      e.preventDefault();
      const name = document.getElementById('newFileName').value.trim();
      const content = document.getElementById('newFileContent').value;
      const perm = document.getElementById('newFilePerm').value.trim();
      const fullPath = (this.currentPath === '/' ? '/' : this.currentPath + '/') + name;

      try {
        await API.fs.createFile(fullPath, content, perm);
        document.getElementById('modalNewFile').classList.remove('active');
        Toast.success(`Created file '${name}'`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    showNewFolderModal() {
      document.getElementById('newFolderPathPrefix').textContent = this.currentPath === '/' ? '/' : this.currentPath + '/';
      document.getElementById('newFolderName').value = '';
      document.getElementById('modalNewFolder').classList.add('active');
    },

    async handleNewFolder(e) {
      e.preventDefault();
      const name = document.getElementById('newFolderName').value.trim();
      const perm = document.getElementById('newFolderPerm').value.trim();
      const fullPath = (this.currentPath === '/' ? '/' : this.currentPath + '/') + name;

      try {
        await API.fs.mkdir(fullPath, perm);
        document.getElementById('modalNewFolder').classList.remove('active');
        Toast.success(`Created directory '${name}'`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    showRenameModal(path, currentName) {
      document.getElementById('renameTargetPath').value = path;
      document.getElementById('renameNewName').value = currentName;
      document.getElementById('modalRename').classList.add('active');
    },

    async handleRename(e) {
      e.preventDefault();
      const path = document.getElementById('renameTargetPath').value;
      const newName = document.getElementById('renameNewName').value.trim();
      try {
        await API.fs.rename(path, newName);
        document.getElementById('modalRename').classList.remove('active');
        Toast.success(`Renamed to '${newName}'`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    showMoveModal(srcPath) {
      document.getElementById('moveSrcPath').value = srcPath;
      document.getElementById('moveDestDir').value = this.currentPath;
      document.getElementById('modalMove').classList.add('active');
    },

    async handleMove(e) {
      e.preventDefault();
      const src = document.getElementById('moveSrcPath').value;
      const dest = document.getElementById('moveDestDir').value.trim();
      try {
        await API.fs.move(src, dest);
        document.getElementById('modalMove').classList.remove('active');
        Toast.success(`Moved successfully`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    showCopyModal(srcPath) {
      document.getElementById('copySrcPath').value = srcPath;
      document.getElementById('copyDestDir').value = this.currentPath;
      document.getElementById('modalCopy').classList.add('active');
    },

    async handleCopy(e) {
      e.preventDefault();
      const src = document.getElementById('copySrcPath').value;
      const dest = document.getElementById('copyDestDir').value.trim();
      try {
        await API.fs.copy(src, dest);
        document.getElementById('modalCopy').classList.remove('active');
        Toast.success(`Copied successfully`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    showChmodModal(path, permStr) {
      document.getElementById('chmodTargetPath').value = path;
      // Parse current permissions e.g. -rwxr-xr--
      const s = permStr.slice(1); // skip d or -
      document.getElementById('cbUr').checked = s[0] === 'r';
      document.getElementById('cbUw').checked = s[1] === 'w';
      document.getElementById('cbUx').checked = s[2] === 'x';
      document.getElementById('cbGr').checked = s[3] === 'r';
      document.getElementById('cbGw').checked = s[4] === 'w';
      document.getElementById('cbGx').checked = s[5] === 'x';
      document.getElementById('cbOr').checked = s[6] === 'r';
      document.getElementById('cbOw').checked = s[7] === 'w';
      document.getElementById('cbOx').checked = s[8] === 'x';
      this.updateChmodOctalDisplay();
      document.getElementById('modalChmod').classList.add('active');
    },

    updateChmodOctalDisplay() {
      const u = (document.getElementById('cbUr').checked ? 4 : 0) +
                (document.getElementById('cbUw').checked ? 2 : 0) +
                (document.getElementById('cbUx').checked ? 1 : 0);
      const g = (document.getElementById('cbGr').checked ? 4 : 0) +
                (document.getElementById('cbGw').checked ? 2 : 0) +
                (document.getElementById('cbGx').checked ? 1 : 0);
      const o = (document.getElementById('cbOr').checked ? 4 : 0) +
                (document.getElementById('cbOw').checked ? 2 : 0) +
                (document.getElementById('cbOx').checked ? 1 : 0);
      const octal = `${u}${g}${o}`;
      document.getElementById('chmodOctalDisplay').textContent = `0o${octal}`;
      document.getElementById('chmodModeVal').value = octal;
    },

    async handleChmod(e) {
      e.preventDefault();
      const path = document.getElementById('chmodTargetPath').value;
      const mode = document.getElementById('chmodModeVal').value;
      try {
        await API.fs.chmod(path, mode);
        document.getElementById('modalChmod').classList.remove('active');
        Toast.success(`Updated permissions for '${path}'`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    openFilePrompt(path) {
      document.getElementById('openFilePath').value = path;
      document.getElementById('modalOpen').classList.add('active');
    },

    async handleOpen(e) {
      e.preventDefault();
      const path = document.getElementById('openFilePath').value;
      const mode = document.getElementById('openMode').value;
      try {
        const res = await API.fs.open(path, mode);
        document.getElementById('modalOpen').classList.remove('active');
        Toast.success(`Allocated File Descriptor ${res.descriptor.fd} for mode '${mode}'`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    showFdIoModal(fd, path, mode) {
      document.getElementById('ioFd').value = fd;
      document.getElementById('ioFileTitle').textContent = `FD ${fd} (${path}, mode: ${mode})`;
      document.getElementById('ioWriteData').value = '';
      document.getElementById('ioReadOutput').textContent = '(Output will appear here)';
      document.getElementById('modalFdIo').classList.add('active');
    },

    async handleFdIo(e) {
      e.preventDefault();
      const fd = document.getElementById('ioFd').value;
      const writeData = document.getElementById('ioWriteData').value;
      const readLength = document.getElementById('ioReadLength').value;

      try {
        if (writeData) {
          await API.fs.write(fd, writeData);
          Toast.success(`Wrote data to FD ${fd}`);
        }
        if (readLength) {
          const res = await API.fs.read(fd, readLength);
          document.getElementById('ioReadOutput').textContent = res.data;
          Toast.info(`Read ${res.bytesRead} bytes from FD ${fd}`);
        }
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    async deletePrompt(path, isDir) {
      const conf = confirm(`Are you sure you want to delete ${isDir ? 'directory' : 'file'} '${path}'?`);
      if (!conf) return;
      try {
        await API.fs.delete(path, true);
        Toast.success(`Deleted '${path}'`);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    async resetFileSystem() {
      if (!confirm('Reset entire file system to default starter files?')) return;
      try {
        await API.fs.reset();
        Toast.info('Virtual File System reset');
        this.currentPath = '/';
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    async handleImport(e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const res = await API.fs.importState(json);
        Toast.success(res.message);
        this.currentPath = '/';
        await this.refresh();
      } catch (err) {
        Toast.error(`Import failed: ${err.message}`);
      }
      e.target.value = '';
    }
  };

  window.FileOpsApp = FileOpsApp;
  FileOpsApp.init();
});
