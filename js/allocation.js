/**
 * allocation.js
 * Frontend controller for Disk Allocation Methods:
 * Contiguous (First/Best/Worst Fit), Linked, Indexed, Compaction, and Fragmentation Analysis.
 */

document.addEventListener('DOMContentLoaded', () => {
  const AllocApp = {
    state: null,
    currentStrategy: 'contiguous',
    currentPolicy: 'first-fit',

    async init() {
      this.bindEvents();
      await this.refresh();
    },

    bindEvents() {
      // Strategy tabs
      document.querySelectorAll('.strategy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const strategy = e.target.dataset.strategy;
          this.switchStrategy(strategy);
        });
      });

      // Placement policy select
      document.getElementById('placementPolicySelect')?.addEventListener('change', (e) => {
        this.currentPolicy = e.target.value;
        this.switchStrategy(this.currentStrategy, this.currentPolicy);
      });

      // Allocate form
      document.getElementById('formAllocateFile')?.addEventListener('submit', (e) => this.handleAllocate(e));

      // Compaction button
      document.getElementById('btnCompactDisk')?.addEventListener('click', () => this.handleCompaction());

      // Reset disk button
      document.getElementById('btnResetDisk')?.addEventListener('click', () => this.handleResetDisk());

      // Export/Import
      document.getElementById('btnExportAlloc')?.addEventListener('click', () => {
        window.location.href = '/api/allocation/export';
      });
      document.getElementById('importAllocInput')?.addEventListener('change', (e) => this.handleImport(e));

      // Modal close handlers
      document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const modal = e.target.closest('.modal-overlay');
          if (modal) modal.classList.remove('active');
        });
      });
    },

    async refresh() {
      try {
        const data = await API.allocation.getState();
        this.state = data;
        this.currentStrategy = data.strategy;
        this.currentPolicy = data.placementPolicy;

        this.updateActiveTab(data.strategy);
        this.renderStats(data.stats);
        this.renderBlockGrid(data.blocks);
        this.renderFileList(data.files);
      } catch (err) {
        Toast.error(err.message);
      }
    },

    updateActiveTab(strategy) {
      document.querySelectorAll('.strategy-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.strategy === strategy);
      });

      const policyContainer = document.getElementById('policySelectorContainer');
      const compactionBtn = document.getElementById('btnCompactDisk');
      if (policyContainer) {
        policyContainer.style.display = (strategy === 'contiguous') ? 'flex' : 'none';
      }
      if (compactionBtn) {
        compactionBtn.style.display = (strategy === 'contiguous') ? 'inline-flex' : 'none';
      }
    },

    async switchStrategy(strategy, policy = this.currentPolicy) {
      try {
        const res = await API.allocation.switchStrategy(strategy, policy);
        Toast.success(res.message);
        if (res.failedFiles && res.failedFiles.length > 0) {
          Toast.warning(`Note: ${res.failedFiles.length} file(s) could not fit in the new allocation layout`);
        }
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    renderStats(stats) {
      document.getElementById('statTotalCapacity').textContent = `${(stats.totalCapacityBytes / 1024).toFixed(1)} KB`;
      document.getElementById('statUsedBlocks').textContent = `${stats.usedBlocks} / ${stats.totalBlocks}`;
      document.getElementById('statFreeBlocks').textContent = `${stats.freeBlocks} blocks`;
      document.getElementById('statInternalFrag').textContent = `${stats.internalFragmentationBytes} B`;
      document.getElementById('statExternalFrag').textContent = stats.hasExternalFragmentation
        ? `${stats.externalFragmentationBlocks} blocks scattered (${stats.externalFragmentationHoles} holes)`
        : '0 blocks (None)';
      document.getElementById('statEfficiency').textContent = `${stats.storageEfficiencyPercent}%`;
    },

    renderBlockGrid(blocks) {
      const grid = document.getElementById('blockGrid');
      if (!grid) return;
      grid.innerHTML = '';

      blocks.forEach(block => {
        const cell = document.createElement('div');
        cell.className = `block-cell ${block.status === 'free' ? 'is-free' : ''} ${block.isIndex ? 'is-index' : ''}`;

        if (block.color && block.status !== 'free') {
          cell.style.backgroundColor = `${block.color}22`;
          cell.style.borderColor = block.color;
        }

        let badgeContent = '';
        if (block.status === 'allocated' && block.nextBlock !== null) {
          badgeContent = `<span class="block-pointer-badge">→ #${block.nextBlock}</span>`;
        } else if (block.isIndex) {
          badgeContent = `<span class="block-pointer-badge" style="background:#7c3aed; color:#fff;">INDEX</span>`;
        }

        let fragBar = '';
        if (block.internalFrag > 0) {
          const fragPercent = Math.min(100, Math.round((block.internalFrag / 512) * 100));
          fragBar = `<div class="block-internal-frag-bar" style="width: ${fragPercent}%" title="Internal fragmentation: ${block.internalFrag} bytes unused"></div>`;
        }

        cell.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="block-id">#${block.id}</span>
            ${badgeContent}
          </div>
          <div class="block-file-name" title="${block.fileName || 'Free block'}">
            ${block.status === 'free' ? '<span style="color:#64748b; font-size:9px;">FREE</span>' : block.fileName}
          </div>
          ${fragBar}
        `;

        cell.addEventListener('click', () => this.inspectBlock(block));
        grid.appendChild(cell);
      });
    },

    renderFileList(files) {
      const container = document.getElementById('allocatedFilesList');
      const countEl = document.getElementById('allocatedFilesCount');
      if (countEl) countEl.textContent = files.length;
      if (!container) return;

      container.innerHTML = '';
      if (files.length === 0) {
        container.innerHTML = `<div style="color:#64748b; font-size:12px; text-align:center; padding:16px;">No files currently allocated on disk.</div>`;
        return;
      }

      files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'alloc-file-item';
        item.innerHTML = `
          <div style="display:flex; align-items:center;">
            <span class="alloc-file-color-tag" style="background:${file.color}"></span>
            <div>
              <strong>${file.name}</strong>
              <div style="font-size:11px; color:#64748b;">
                ${file.size} B (${file.blocks.length} blocks) |
                ${file.strategy === 'indexed' ? `Index: #${file.indexBlock}` : `Blocks: [${file.blocks.join(', ')}]`}
              </div>
            </div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="AllocApp.handleDeallocate('${file.name}')">Free</button>
        `;
        container.appendChild(item);
      });
    },

    inspectBlock(block) {
      document.getElementById('inspectBlockId').textContent = `#${block.id}`;
      document.getElementById('inspectBlockStatus').textContent = block.status.toUpperCase();
      document.getElementById('inspectBlockFile').textContent = block.fileName || 'None (Free space)';
      document.getElementById('inspectBlockDataBytes').textContent = `${block.dataBytes} Bytes`;
      document.getElementById('inspectBlockFrag').textContent = `${block.internalFrag} Bytes unused`;

      const pointerSection = document.getElementById('inspectBlockPointersSection');
      const pointerVal = document.getElementById('inspectBlockPointers');
      if (block.isIndex) {
        pointerSection.style.display = 'block';
        pointerVal.textContent = `Pointers to Data Blocks: [${block.pointers.join(', ')}]`;
      } else if (block.nextBlock !== null) {
        pointerSection.style.display = 'block';
        pointerVal.textContent = `Linked Next Block: #${block.nextBlock}`;
      } else {
        pointerSection.style.display = 'none';
      }

      document.getElementById('modalInspectBlock').classList.add('active');
    },

    async handleAllocate(e) {
      e.preventDefault();
      const name = document.getElementById('allocFileName').value.trim();
      const size = parseInt(document.getElementById('allocFileSize').value, 10);
      const strategy = this.currentStrategy;
      const policy = this.currentPolicy;

      try {
        const res = await API.allocation.allocate(name, size, strategy, policy);
        Toast.success(res.message);
        document.getElementById('allocFileName').value = '';
        document.getElementById('allocFileSize').value = '';
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    async handleDeallocate(fileName) {
      if (!confirm(`Deallocate file '${fileName}' and reclaim all its blocks?`)) return;
      try {
        const res = await API.allocation.deallocate(fileName);
        Toast.success(res.message);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    async handleCompaction() {
      try {
        const res = await API.allocation.compact();
        Toast.success(res.message);
        await this.refresh();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    async handleResetDisk() {
      if (!confirm('Clear all blocks on simulated disk?')) return;
      try {
        await API.allocation.reset();
        Toast.info('Disk reset to all free blocks');
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
        await API.allocation.importState(json);
        Toast.success('Imported disk allocation state successfully');
        await this.refresh();
      } catch (err) {
        Toast.error(`Import failed: ${err.message}`);
      }
      e.target.value = '';
    }
  };

  window.AllocApp = AllocApp;
  AllocApp.init();
});
