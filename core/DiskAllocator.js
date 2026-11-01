/**
 * core/DiskAllocator.js
 * Visual Disk Allocation Methods Simulator:
 * 1. Contiguous Allocation (with First-Fit, Best-Fit, Worst-Fit placement & Compaction)
 * 2. Linked Allocation (with next-block pointer chain & FAT representation)
 * 3. Indexed Allocation (with dedicated Index Block & direct block pointer table)
 *
 * Tracks:
 * - Block status map (Free, Allocated, Index Block)
 * - Internal fragmentation (wasted bytes in last block)
 * - External fragmentation (non-contiguous free chunks)
 * - Strategy switching comparison
 */

class DiskAllocator {
  constructor(totalBlocks = 64, blockSize = 512) {
    this.totalBlocks = totalBlocks;
    this.blockSize = blockSize; // in bytes
    this.currentStrategy = 'contiguous'; // 'contiguous' | 'linked' | 'indexed'
    this.placementPolicy = 'first-fit'; // 'first-fit' | 'best-fit' | 'worst-fit'
    this.files = new Map(); // fileName -> FileMetadata
    this.blocks = []; // Array of { id, status: 'free'|'allocated'|'index', fileId, fileName, color, nextBlock, pointers, dataBytes }
    this.fileColors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ec4899', // pink
      '#8b5cf6', // purple
      '#06b6d4', // cyan
      '#ef4444', // red
      '#14b8a6', // teal
      '#f97316', // orange
      '#a855f7'  // violet
    ];
    this.colorIndex = 0;

    this.initDisk();
    this.initSampleFiles();
  }

  initDisk() {
    this.blocks = [];
    for (let i = 0; i < this.totalBlocks; i++) {
      this.blocks.push({
        id: i,
        status: 'free',
        fileName: null,
        fileId: null,
        color: null,
        isIndex: false,
        nextBlock: null,
        pointers: [],
        dataBytes: 0,
        internalFrag: 0
      });
    }
  }

  getNextColor() {
    const color = this.fileColors[this.colorIndex % this.fileColors.length];
    this.colorIndex++;
    return color;
  }

  initSampleFiles() {
    this.allocate('kernel.sys', 1200, 'contiguous', 'first-fit'); // ~3 blocks
    this.allocate('app.exe', 2200, 'contiguous', 'first-fit');    // ~5 blocks
    this.allocate('data.db', 1800, 'contiguous', 'first-fit');    // ~4 blocks
    // Deallocate middle file to intentionally demonstrate fragmentation
    this.deallocate('app.exe');
    this.allocate('cache.tmp', 900, 'contiguous', 'first-fit');   // ~2 blocks into the hole
  }

  // Calculate needed blocks for a file of size bytes
  calculateBlocksNeeded(fileSize, strategy = this.currentStrategy) {
    const dataBlocks = Math.ceil(fileSize / this.blockSize) || 1;
    if (strategy === 'indexed') {
      return { dataBlocks, totalBlocks: dataBlocks + 1, indexBlocks: 1 };
    }
    return { dataBlocks, totalBlocks: dataBlocks, indexBlocks: 0 };
  }

  // Allocate a file using specified strategy
  allocate(fileName, fileSize, strategy = this.currentStrategy, placementPolicy = this.placementPolicy) {
    if (!fileName || fileName.trim() === '') {
      throw new Error('File name cannot be empty');
    }
    if (this.files.has(fileName)) {
      throw new Error(`File '${fileName}' already exists on disk`);
    }
    const size = parseInt(fileSize, 10);
    if (isNaN(size) || size <= 0) {
      throw new Error('File size must be a positive integer in bytes');
    }

    const { dataBlocks, totalBlocks, indexBlocks } = this.calculateBlocksNeeded(size, strategy);
    const freeBlockCount = this.blocks.filter(b => b.status === 'free').length;

    if (totalBlocks > freeBlockCount) {
      throw new Error(`Not enough free disk space. Needed: ${totalBlocks} blocks, Available: ${freeBlockCount} blocks`);
    }

    const color = this.getNextColor();
    let allocatedBlockIds = [];
    let indexBlockId = null;

    if (strategy === 'contiguous') {
      allocatedBlockIds = this.allocateContiguous(totalBlocks, placementPolicy);
      if (!allocatedBlockIds) {
        throw new Error(`External Fragmentation Error: Unable to find ${totalBlocks} contiguous free blocks under '${placementPolicy}' policy, even though ${freeBlockCount} total free blocks exist. Try running Disk Compaction.`);
      }

      // Assign blocks
      for (let i = 0; i < allocatedBlockIds.length; i++) {
        const bId = allocatedBlockIds[i];
        const isLast = (i === allocatedBlockIds.length - 1);
        const dataBytes = isLast ? (size % this.blockSize || this.blockSize) : this.blockSize;
        const internalFrag = isLast ? (this.blockSize - dataBytes) : 0;

        this.blocks[bId] = {
          id: bId,
          status: 'allocated',
          fileName,
          fileId: fileName,
          color,
          isIndex: false,
          nextBlock: (i < allocatedBlockIds.length - 1) ? allocatedBlockIds[i + 1] : null,
          pointers: [],
          dataBytes,
          internalFrag
        };
      }
    } else if (strategy === 'linked') {
      // Linked: any free blocks can be used
      const freeBlocks = this.blocks.filter(b => b.status === 'free').map(b => b.id);
      allocatedBlockIds = freeBlocks.slice(0, totalBlocks);

      for (let i = 0; i < allocatedBlockIds.length; i++) {
        const bId = allocatedBlockIds[i];
        const nextId = (i < allocatedBlockIds.length - 1) ? allocatedBlockIds[i + 1] : null;
        const isLast = (i === allocatedBlockIds.length - 1);
        const dataBytes = isLast ? (size % this.blockSize || this.blockSize) : this.blockSize;
        const internalFrag = isLast ? (this.blockSize - dataBytes) : 0;

        this.blocks[bId] = {
          id: bId,
          status: 'allocated',
          fileName,
          fileId: fileName,
          color,
          isIndex: false,
          nextBlock: nextId,
          pointers: [],
          dataBytes,
          internalFrag
        };
      }
    } else if (strategy === 'indexed') {
      // Indexed: First allocated block is Index Block, subsequent are data blocks
      const freeBlocks = this.blocks.filter(b => b.status === 'free').map(b => b.id);
      indexBlockId = freeBlocks[0];
      const dataBlockIds = freeBlocks.slice(1, totalBlocks);
      allocatedBlockIds = [indexBlockId, ...dataBlockIds];

      // Setup index block
      this.blocks[indexBlockId] = {
        id: indexBlockId,
        status: 'index',
        fileName,
        fileId: fileName,
        color,
        isIndex: true,
        nextBlock: null,
        pointers: [...dataBlockIds],
        dataBytes: dataBlockIds.length * 4, // 4-byte addresses
        internalFrag: 0
      };

      // Setup data blocks
      for (let i = 0; i < dataBlockIds.length; i++) {
        const bId = dataBlockIds[i];
        const isLast = (i === dataBlockIds.length - 1);
        const dataBytes = isLast ? (size % this.blockSize || this.blockSize) : this.blockSize;
        const internalFrag = isLast ? (this.blockSize - dataBytes) : 0;

        this.blocks[bId] = {
          id: bId,
          status: 'allocated',
          fileName,
          fileId: fileName,
          color,
          isIndex: false,
          nextBlock: null,
          pointers: [],
          dataBytes,
          internalFrag
        };
      }
    }

    const fileMeta = {
      name: fileName,
      size,
      strategy,
      placementPolicy: strategy === 'contiguous' ? placementPolicy : 'n/a',
      color,
      blocks: allocatedBlockIds,
      dataBlocks,
      indexBlock: indexBlockId,
      startBlock: allocatedBlockIds[0],
      endBlock: allocatedBlockIds[allocatedBlockIds.length - 1],
      totalAllocatedSize: totalBlocks * this.blockSize,
      internalFragmentation: (this.blockSize - (size % this.blockSize || this.blockSize))
    };

    this.files.set(fileName, fileMeta);
    return fileMeta;
  }

  // Contiguous block placement algorithm
  allocateContiguous(numBlocks, policy) {
    // Find all free continuous runs: [{ start, length }]
    const holes = [];
    let currentStart = null;
    let currentLen = 0;

    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i].status === 'free') {
        if (currentStart === null) currentStart = i;
        currentLen++;
      } else {
        if (currentStart !== null) {
          holes.push({ start: currentStart, length: currentLen });
          currentStart = null;
          currentLen = 0;
        }
      }
    }
    if (currentStart !== null) {
      holes.push({ start: currentStart, length: currentLen });
    }

    // Filter holes that are large enough
    const candidateHoles = holes.filter(h => h.length >= numBlocks);
    if (candidateHoles.length === 0) return null;

    let chosenHole = null;
    if (policy === 'first-fit') {
      chosenHole = candidateHoles[0];
    } else if (policy === 'best-fit') {
      // Smallest hole that fits
      chosenHole = candidateHoles.reduce((best, cur) => cur.length < best.length ? cur : best, candidateHoles[0]);
    } else if (policy === 'worst-fit') {
      // Largest hole
      chosenHole = candidateHoles.reduce((worst, cur) => cur.length > worst.length ? cur : worst, candidateHoles[0]);
    } else {
      chosenHole = candidateHoles[0];
    }

    const allocated = [];
    for (let i = 0; i < numBlocks; i++) {
      allocated.push(chosenHole.start + i);
    }
    return allocated;
  }

  // Deallocate a file and free its blocks
  deallocate(fileName) {
    const file = this.files.get(fileName);
    if (!file) {
      throw new Error(`File '${fileName}' not found on disk`);
    }

    for (const bId of file.blocks) {
      this.blocks[bId] = {
        id: bId,
        status: 'free',
        fileName: null,
        fileId: null,
        color: null,
        isIndex: false,
        nextBlock: null,
        pointers: [],
        dataBytes: 0,
        internalFrag: 0
      };
    }

    this.files.delete(fileName);
    return { freedBlocks: file.blocks.length, fileName };
  }

  // Compaction (Defragmentation for contiguous allocation)
  compact() {
    const currentFiles = Array.from(this.files.values());
    this.initDisk();
    this.files.clear();
    this.colorIndex = 0;

    let nextStartBlock = 0;
    const relocatedFiles = [];

    for (const file of currentFiles) {
      const { totalBlocks } = this.calculateBlocksNeeded(file.size, 'contiguous');
      const newBlockIds = [];
      const color = file.color;

      for (let i = 0; i < totalBlocks; i++) {
        const bId = nextStartBlock + i;
        newBlockIds.push(bId);
        const isLast = (i === totalBlocks - 1);
        const dataBytes = isLast ? (file.size % this.blockSize || this.blockSize) : this.blockSize;
        const internalFrag = isLast ? (this.blockSize - dataBytes) : 0;

        this.blocks[bId] = {
          id: bId,
          status: 'allocated',
          fileName: file.name,
          fileId: file.name,
          color,
          isIndex: false,
          nextBlock: (i < totalBlocks - 1) ? bId + 1 : null,
          pointers: [],
          dataBytes,
          internalFrag
        };
      }

      nextStartBlock += totalBlocks;

      const updatedMeta = {
        name: file.name,
        size: file.size,
        strategy: 'contiguous',
        placementPolicy: file.placementPolicy,
        color,
        blocks: newBlockIds,
        dataBlocks: totalBlocks,
        indexBlock: null,
        startBlock: newBlockIds[0],
        endBlock: newBlockIds[newBlockIds.length - 1],
        totalAllocatedSize: totalBlocks * this.blockSize,
        internalFragmentation: (this.blockSize - (file.size % this.blockSize || this.blockSize))
      };

      this.files.set(file.name, updatedMeta);
      relocatedFiles.push(updatedMeta);
    }

    return {
      message: `Compaction completed successfully. Consolidated ${relocatedFiles.length} files. Free blocks now contiguous at end of disk.`,
      relocatedFiles,
      contiguousFreeStart: nextStartBlock,
      contiguousFreeLength: this.totalBlocks - nextStartBlock
    };
  }

  // Switch strategy: re-allocate existing files under new strategy for direct comparison
  switchStrategy(newStrategy, placementPolicy = this.placementPolicy) {
    if (!['contiguous', 'linked', 'indexed'].includes(newStrategy)) {
      throw new Error(`Unknown allocation strategy '${newStrategy}'`);
    }

    const previousFiles = Array.from(this.files.values()).map(f => ({
      name: f.name,
      size: f.size
    }));

    this.currentStrategy = newStrategy;
    this.placementPolicy = placementPolicy;
    this.initDisk();
    this.files.clear();
    this.colorIndex = 0;

    const failedFiles = [];
    const successfulFiles = [];

    for (const f of previousFiles) {
      try {
        const res = this.allocate(f.name, f.size, newStrategy, placementPolicy);
        successfulFiles.push(res);
      } catch (err) {
        failedFiles.push({ name: f.name, reason: err.message });
      }
    }

    return {
      strategy: newStrategy,
      placementPolicy,
      successfulFiles,
      failedFiles
    };
  }

  // Calculate statistics
  getStatistics() {
    const freeBlocks = this.blocks.filter(b => b.status === 'free').length;
    const allocatedBlocks = this.blocks.filter(b => b.status === 'allocated').length;
    const indexBlocks = this.blocks.filter(b => b.status === 'index').length;
    const usedBlocks = allocatedBlocks + indexBlocks;

    // Calculate Internal Fragmentation
    let totalInternalFrag = 0;
    for (const file of this.files.values()) {
      totalInternalFrag += file.internalFragmentation;
    }

    // Calculate External Fragmentation (free holes analysis)
    const holes = [];
    let currentHole = 0;
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i].status === 'free') {
        currentHole++;
      } else {
        if (currentHole > 0) {
          holes.push(currentHole);
          currentHole = 0;
        }
      }
    }
    if (currentHole > 0) holes.push(currentHole);

    const largestFreeChunk = holes.length > 0 ? Math.max(...holes) : 0;
    // External fragmentation in Contiguous exists if free blocks > 0 but scattered
    const hasExternalFrag = this.currentStrategy === 'contiguous' && holes.length > 1;
    const externalFragBlocks = hasExternalFrag ? (freeBlocks - largestFreeChunk) : 0;

    // Efficiency: (Actual File Bytes) / (Allocated Bytes)
    let totalFileBytes = 0;
    for (const file of this.files.values()) {
      totalFileBytes += file.size;
    }
    const totalAllocatedBytes = usedBlocks * this.blockSize;
    const storageEfficiency = totalAllocatedBytes > 0
      ? ((totalFileBytes / totalAllocatedBytes) * 100).toFixed(1)
      : '100.0';

    return {
      totalBlocks: this.totalBlocks,
      blockSize: this.blockSize,
      totalCapacityBytes: this.totalBlocks * this.blockSize,
      freeBlocks,
      usedBlocks,
      allocatedBlocks,
      indexBlocks,
      fileCount: this.files.size,
      totalFileBytes,
      totalAllocatedBytes,
      internalFragmentationBytes: totalInternalFrag,
      internalFragmentationAvg: this.files.size > 0 ? Math.round(totalInternalFrag / this.files.size) : 0,
      externalFragmentationHoles: holes.length,
      largestContiguousFreeChunk: largestFreeChunk,
      externalFragmentationBlocks: externalFragBlocks,
      hasExternalFragmentation: hasExternalFrag,
      storageEfficiencyPercent: parseFloat(storageEfficiency),
      currentStrategy: this.currentStrategy,
      placementPolicy: this.placementPolicy
    };
  }

  // Get full visualization state
  getState() {
    return {
      blocks: this.blocks,
      files: Array.from(this.files.values()),
      stats: this.getStatistics(),
      strategy: this.currentStrategy,
      placementPolicy: this.placementPolicy
    };
  }

  // Export Allocation State
  exportState() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      strategy: this.currentStrategy,
      placementPolicy: this.placementPolicy,
      totalBlocks: this.totalBlocks,
      blockSize: this.blockSize,
      files: Array.from(this.files.values()),
      blocks: this.blocks
    };
  }

  // Import Allocation State
  importState(data) {
    if (!data || !Array.isArray(data.blocks) || !Array.isArray(data.files)) {
      throw new Error('Invalid allocation state format');
    }

    this.currentStrategy = data.strategy || 'contiguous';
    this.placementPolicy = data.placementPolicy || 'first-fit';
    this.totalBlocks = data.totalBlocks || 64;
    this.blockSize = data.blockSize || 512;
    this.blocks = data.blocks;

    this.files.clear();
    for (const f of data.files) {
      this.files.set(f.name, f);
    }

    return this.getState();
  }
}

module.exports = DiskAllocator;
