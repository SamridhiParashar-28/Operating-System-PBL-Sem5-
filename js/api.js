/**
 * api.js
 * Dual-Mode REST API Client + In-Browser Simulation Engine
 * 
 * Automatically detects whether the Node.js Express backend is available.
 * - Localhost with Node.js: communicates with /api/* REST endpoints.
 * - GitHub Pages (Static Hosting): automatically falls back to an in-memory client
 *   simulation engine so the live deployed simulator works 100% without a cloud server!
 */

// ============================================================================
// CLIENT-SIDE IN-MEMORY ENGINES (FOR STATIC GITHUB PAGES DEPLOYMENT)
// ============================================================================

class ClientScheduler {
  constructor(defaultMax = 199) {
    this.defaultMax = defaultMax;
  }

  getPresets() {
    return [
      {
        name: 'Silberschatz Textbook Classic',
        queue: [98, 183, 37, 122, 14, 124, 65, 67],
        initialHead: 53,
        direction: 'up',
        maxCylinder: 199,
        description: 'Standard example from Operating System Concepts.'
      },
      {
        name: 'High Clustering (Locality)',
        queue: [45, 48, 52, 50, 160, 162, 165, 158],
        initialHead: 40,
        direction: 'up',
        maxCylinder: 199,
        description: 'Demonstrates SSTF and LOOK efficiency with spatial locality.'
      },
      {
        name: 'Alternating Extremities (Wild Swings)',
        queue: [10, 190, 15, 185, 20, 180, 25, 175],
        initialHead: 100,
        direction: 'up',
        maxCylinder: 199,
        description: 'Presents worst-case scenario for FCFS ping-ponging.'
      },
      {
        name: 'Uniformly Distributed',
        queue: [20, 40, 60, 80, 100, 120, 140, 160, 180],
        initialHead: 90,
        direction: 'down',
        maxCylinder: 199,
        description: 'Uniform spacing across disk surface.'
      }
    ];
  }

  buildSteps(seekSequence, originalQueue) {
    const steps = [];
    let runningTotal = 0;
    const reqSet = new Set(originalQueue);

    for (let i = 1; i < seekSequence.length; i++) {
      const from = seekSequence[i - 1];
      const to = seekSequence[i];
      const dist = Math.abs(to - from);
      runningTotal += dist;
      const isServiced = reqSet.has(to);

      steps.push({
        stepNumber: i,
        from,
        to,
        seekDistance: dist,
        runningTotal,
        isServicedRequest: isServiced,
        note: isServiced ? `Serviced request at cylinder ${to}` : `Head boundary movement to ${to}`
      });
    }

    return {
      seekSequence,
      steps,
      totalHeadMovement: runningTotal,
      averageSeekTime: originalQueue.length > 0 ? parseFloat((runningTotal / originalQueue.length).toFixed(2)) : 0,
      requestCount: originalQueue.length
    };
  }

  fcfs(queue, head, maxCyl) {
    const seekSequence = [head, ...queue];
    const metrics = this.buildSteps(seekSequence, queue);
    return {
      algorithm: 'FCFS',
      name: 'First-Come, First-Served',
      initialHead: head,
      direction: 'n/a',
      maxCylinder: maxCyl,
      ...metrics,
      timeComplexity: 'O(N)',
      description: 'Requests are addressed strictly in arrival order. Can result in wild head swings across the disk.',
      pros: ['Completely fair; prevents starvation', 'Simplest algorithm to implement', 'Low overhead'],
      cons: ['High average seek time and poor throughput', 'Inefficient for dispersed requests']
    };
  }

  sstf(queue, head, maxCyl) {
    const pending = [...queue];
    const seekSequence = [head];
    let cur = head;

    while (pending.length > 0) {
      let closestIdx = 0;
      let minDist = Math.abs(pending[0] - cur);
      for (let i = 1; i < pending.length; i++) {
        const d = Math.abs(pending[i] - cur);
        if (d < minDist) {
          minDist = d;
          closestIdx = i;
        }
      }
      cur = pending[closestIdx];
      seekSequence.push(cur);
      pending.splice(closestIdx, 1);
    }

    const metrics = this.buildSteps(seekSequence, queue);
    return {
      algorithm: 'SSTF',
      name: 'Shortest Seek Time First',
      initialHead: head,
      direction: 'adaptive',
      maxCylinder: maxCyl,
      ...metrics,
      timeComplexity: 'O(N²)',
      description: 'Greedily chooses request with minimum seek distance from current head position.',
      pros: ['Substantially lower seek time than FCFS', 'High throughput for localized clusters'],
      cons: ['Risk of starvation for distant cylinders', 'High variance in response times']
    };
  }

  scan(queue, head, dir = 'up', maxCyl) {
    const left = queue.filter(x => x < head).sort((a, b) => b - a);
    const right = queue.filter(x => x > head).sort((a, b) => a - b);
    const exact = queue.filter(x => x === head);
    const seq = [head, ...exact];

    if (dir === 'up') {
      seq.push(...right);
      if (left.length > 0) {
        if (!seq.includes(maxCyl)) seq.push(maxCyl);
        seq.push(...left);
      }
    } else {
      seq.push(...left);
      if (right.length > 0) {
        if (!seq.includes(0)) seq.push(0);
        seq.push(...right);
      }
    }

    const metrics = this.buildSteps(seq, queue);
    return {
      algorithm: 'SCAN',
      name: 'SCAN (Elevator Algorithm)',
      initialHead: head,
      direction: dir,
      maxCylinder: maxCyl,
      ...metrics,
      timeComplexity: 'O(N log N)',
      description: 'Sweeps in one direction to the physical boundary before reversing, servicing requests along the path.',
      pros: ['Eliminates starvation', 'Bounded maximum wait time'],
      cons: ['Unnecessary seek to disk boundary 0 or max', 'Delays requests behind current sweep']
    };
  }

  cscan(queue, head, dir = 'up', maxCyl) {
    const left = queue.filter(x => x < head).sort((a, b) => a - b);
    const right = queue.filter(x => x > head).sort((a, b) => a - b);
    const seq = [head];

    if (dir === 'up') {
      seq.push(...right);
      if (left.length > 0) {
        seq.push(maxCyl);
        seq.push(0);
        seq.push(...left);
      }
    } else {
      const leftDesc = queue.filter(x => x < head).sort((a, b) => b - a);
      const rightDesc = queue.filter(x => x > head).sort((a, b) => b - a);
      seq.push(...leftDesc);
      if (rightDesc.length > 0) {
        seq.push(0);
        seq.push(maxCyl);
        seq.push(...rightDesc);
      }
    }

    const metrics = this.buildSteps(seq, queue);
    return {
      algorithm: 'C-SCAN',
      name: 'C-SCAN (Circular SCAN)',
      initialHead: head,
      direction: dir,
      maxCylinder: maxCyl,
      ...metrics,
      timeComplexity: 'O(N log N)',
      description: 'Services requests in one direction only. Resets immediately to start boundary without servicing on return.',
      pros: ['Provides more uniform waiting times than regular SCAN', 'Prevents middle cylinder bias'],
      cons: ['Wasted return seek travel to boundary']
    };
  }

  look(queue, head, dir = 'up', maxCyl) {
    const left = queue.filter(x => x < head).sort((a, b) => b - a);
    const right = queue.filter(x => x > head).sort((a, b) => a - b);
    const seq = [head];

    if (dir === 'up') {
      seq.push(...right);
      if (left.length > 0) seq.push(...left);
    } else {
      seq.push(...left);
      if (right.length > 0) seq.push(...right);
    }

    const metrics = this.buildSteps(seq, queue);
    return {
      algorithm: 'LOOK',
      name: 'LOOK Algorithm',
      initialHead: head,
      direction: dir,
      maxCylinder: maxCyl,
      ...metrics,
      timeComplexity: 'O(N log N)',
      description: 'Optimized SCAN: only sweeps as far as the furthest request in each direction before reversing.',
      pros: ['Avoids unnecessary boundary travel', 'Lower seek distance than standard SCAN'],
      cons: ['Requires tracking queue boundary limits']
    };
  }

  clook(queue, head, dir = 'up', maxCyl) {
    const left = queue.filter(x => x < head).sort((a, b) => a - b);
    const right = queue.filter(x => x > head).sort((a, b) => a - b);
    const seq = [head];

    if (dir === 'up') {
      seq.push(...right);
      if (left.length > 0) seq.push(...left);
    } else {
      const leftDesc = queue.filter(x => x < head).sort((a, b) => b - a);
      const rightDesc = queue.filter(x => x > head).sort((a, b) => b - a);
      seq.push(...leftDesc);
      if (rightDesc.length > 0) seq.push(...rightDesc);
    }

    const metrics = this.buildSteps(seq, queue);
    return {
      algorithm: 'C-LOOK',
      name: 'C-LOOK (Circular LOOK)',
      initialHead: head,
      direction: dir,
      maxCylinder: maxCyl,
      ...metrics,
      timeComplexity: 'O(N log N)',
      description: 'Circular elevator that reverses directly from the highest request to the lowest request.',
      pros: ['Lowest total head travel among circular schedulers', 'Eliminates boundary traversal penalties'],
      cons: ['Slight overhead to track extreme requests']
    };
  }

  run(algo, queue, head, dir = 'up', maxCyl = 199) {
    const a = (algo || 'fcfs').toLowerCase();
    if (a === 'fcfs') return this.fcfs(queue, head, maxCyl);
    if (a === 'sstf') return this.sstf(queue, head, maxCyl);
    if (a === 'scan') return this.scan(queue, head, dir, maxCyl);
    if (a === 'c-scan' || a === 'cscan') return this.cscan(queue, head, dir, maxCyl);
    if (a === 'look') return this.look(queue, head, dir, maxCyl);
    if (a === 'c-look' || a === 'clook') return this.clook(queue, head, dir, maxCyl);
    return this.fcfs(queue, head, maxCyl);
  }

  compareAll(queue, head, dir = 'up', maxCyl = 199) {
    const results = [
      this.fcfs(queue, head, maxCyl),
      this.sstf(queue, head, maxCyl),
      this.scan(queue, head, dir, maxCyl),
      this.cscan(queue, head, dir, maxCyl),
      this.look(queue, head, dir, maxCyl),
      this.clook(queue, head, dir, maxCyl)
    ];

    let best = results[0];
    let worst = results[0];
    for (const r of results) {
      if (r.totalHeadMovement < best.totalHeadMovement) best = r;
      if (r.totalHeadMovement > worst.totalHeadMovement) worst = r;
    }

    const summaryTable = results.map(r => ({
      algorithm: r.algorithm,
      name: r.name,
      totalHeadMovement: r.totalHeadMovement,
      averageSeekTime: r.averageSeekTime,
      totalSteps: r.steps.length,
      seekSequencePreview: r.seekSequence.slice(0, 10).join(' → ') + (r.seekSequence.length > 10 ? '...' : ''),
      isBest: r.algorithm === best.algorithm,
      differenceFromBest: r.totalHeadMovement - best.totalHeadMovement,
      percentDifference: best.totalHeadMovement > 0
        ? (((r.totalHeadMovement - best.totalHeadMovement) / best.totalHeadMovement) * 100).toFixed(1) + '%'
        : '0%'
    }));

    return {
      queue,
      initialHead: head,
      direction: dir,
      maxCylinder: maxCyl,
      bestAlgorithm: {
        algorithm: best.algorithm,
        name: best.name,
        totalHeadMovement: best.totalHeadMovement
      },
      worstAlgorithm: {
        algorithm: worst.algorithm,
        name: worst.name,
        totalHeadMovement: worst.totalHeadMovement
      },
      summaryTable,
      detailedResults: results
    };
  }
}

// Client-side in-memory Allocator
class ClientAllocator {
  constructor(totalBlocks = 64, blockSize = 512) {
    this.totalBlocks = totalBlocks;
    this.blockSize = blockSize;
    this.currentStrategy = 'contiguous';
    this.placementPolicy = 'first-fit';
    this.files = new Map();
    this.blocks = [];
    this.colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6', '#f97316', '#a855f7'];
    this.colorIdx = 0;
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

  initSampleFiles() {
    this.allocate('kernel.sys', 1200, 'contiguous', 'first-fit');
    this.allocate('app.exe', 2200, 'contiguous', 'first-fit');
    this.allocate('data.db', 1800, 'contiguous', 'first-fit');
    this.deallocate('app.exe');
    this.allocate('cache.tmp', 900, 'contiguous', 'first-fit');
  }

  allocate(fileName, fileSize, strategy = this.currentStrategy, policy = this.placementPolicy) {
    const size = parseInt(fileSize, 10);
    const dataBlocks = Math.ceil(size / this.blockSize) || 1;
    const totalBlocks = strategy === 'indexed' ? dataBlocks + 1 : dataBlocks;
    const freeBlocks = this.blocks.filter(b => b.status === 'free').map(b => b.id);

    if (totalBlocks > freeBlocks.length) {
      throw new Error(`Not enough free disk space. Needed: ${totalBlocks}, Available: ${freeBlocks.length}`);
    }

    const color = this.colors[this.colorIdx++ % this.colors.length];
    let allocated = [];
    let indexId = null;

    if (strategy === 'contiguous') {
      // Find contiguous hole
      const holes = [];
      let start = null, len = 0;
      for (let i = 0; i < this.blocks.length; i++) {
        if (this.blocks[i].status === 'free') {
          if (start === null) start = i;
          len++;
        } else {
          if (start !== null) {
            holes.push({ start, len });
            start = null;
            len = 0;
          }
        }
      }
      if (start !== null) holes.push({ start, len });

      const fits = holes.filter(h => h.len >= totalBlocks);
      if (fits.length === 0) throw new Error('External fragmentation: No contiguous hole large enough. Run compaction.');
      let chosen = fits[0];
      if (policy === 'best-fit') chosen = fits.reduce((b, c) => c.len < b.len ? c : b, fits[0]);
      if (policy === 'worst-fit') chosen = fits.reduce((w, c) => c.len > w.len ? c : w, fits[0]);

      for (let i = 0; i < totalBlocks; i++) allocated.push(chosen.start + i);
    } else if (strategy === 'linked') {
      allocated = freeBlocks.slice(0, totalBlocks);
    } else if (strategy === 'indexed') {
      indexId = freeBlocks[0];
      const dataB = freeBlocks.slice(1, totalBlocks);
      allocated = [indexId, ...dataB];
    }

    // Assign blocks
    if (strategy === 'indexed') {
      this.blocks[indexId] = {
        id: indexId,
        status: 'index',
        fileName,
        fileId: fileName,
        color,
        isIndex: true,
        nextBlock: null,
        pointers: allocated.slice(1),
        dataBytes: (allocated.length - 1) * 4,
        internalFrag: 0
      };
      for (let i = 1; i < allocated.length; i++) {
        const bId = allocated[i];
        const isLast = (i === allocated.length - 1);
        const dataB = isLast ? (size % this.blockSize || this.blockSize) : this.blockSize;
        this.blocks[bId] = {
          id: bId,
          status: 'allocated',
          fileName,
          fileId: fileName,
          color,
          isIndex: false,
          nextBlock: null,
          pointers: [],
          dataBytes: dataB,
          internalFrag: isLast ? (this.blockSize - dataB) : 0
        };
      }
    } else {
      for (let i = 0; i < allocated.length; i++) {
        const bId = allocated[i];
        const isLast = (i === allocated.length - 1);
        const dataB = isLast ? (size % this.blockSize || this.blockSize) : this.blockSize;
        this.blocks[bId] = {
          id: bId,
          status: 'allocated',
          fileName,
          fileId: fileName,
          color,
          isIndex: false,
          nextBlock: (i < allocated.length - 1) ? allocated[i + 1] : null,
          pointers: [],
          dataBytes: dataB,
          internalFrag: isLast ? (this.blockSize - dataB) : 0
        };
      }
    }

    const meta = {
      name: fileName,
      size,
      strategy,
      color,
      blocks: allocated,
      dataBlocks,
      indexBlock: indexId,
      internalFragmentation: this.blockSize - (size % this.blockSize || this.blockSize)
    };
    this.files.set(fileName, meta);
    return meta;
  }

  deallocate(name) {
    const f = this.files.get(name);
    if (!f) throw new Error(`File '${name}' not found`);
    for (const bId of f.blocks) {
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
    this.files.delete(name);
    return { freedBlocks: f.blocks.length };
  }

  compact() {
    const currentFiles = Array.from(this.files.values());
    this.initDisk();
    this.files.clear();
    this.colorIdx = 0;
    for (const f of currentFiles) {
      this.allocate(f.name, f.size, 'contiguous', 'first-fit');
    }
    return { message: 'Compaction defragmentation complete.' };
  }

  switchStrategy(strat, pol = this.placementPolicy) {
    const prev = Array.from(this.files.values()).map(f => ({ name: f.name, size: f.size }));
    this.currentStrategy = strat;
    this.placementPolicy = pol;
    this.initDisk();
    this.files.clear();
    this.colorIdx = 0;
    for (const f of prev) {
      this.allocate(f.name, f.size, strat, pol);
    }
    return { message: `Switched to ${strat.toUpperCase()}` };
  }

  getStatistics() {
    const freeB = this.blocks.filter(b => b.status === 'free').length;
    const usedB = this.blocks.length - freeB;
    let internalFrag = 0;
    let fileBytes = 0;
    for (const f of this.files.values()) {
      internalFrag += f.internalFragmentation;
      fileBytes += f.size;
    }
    const eff = usedB > 0 ? ((fileBytes / (usedB * this.blockSize)) * 100).toFixed(1) : '100.0';

    return {
      totalBlocks: this.totalBlocks,
      blockSize: this.blockSize,
      totalCapacityBytes: this.totalBlocks * this.blockSize,
      freeBlocks: freeB,
      usedBlocks: usedB,
      internalFragmentationBytes: internalFrag,
      hasExternalFragmentation: this.currentStrategy === 'contiguous' && freeB > 0,
      externalFragmentationBlocks: freeB,
      externalFragmentationHoles: 2,
      storageEfficiencyPercent: parseFloat(eff),
      currentStrategy: this.currentStrategy,
      placementPolicy: this.placementPolicy
    };
  }

  getState() {
    return {
      blocks: this.blocks,
      files: Array.from(this.files.values()),
      stats: this.getStatistics(),
      strategy: this.currentStrategy,
      placementPolicy: this.placementPolicy
    };
  }
}

// Client-side in-memory VFS
class ClientFS {
  constructor() {
    this.reset();
  }

  reset() {
    this.inodes = new Map();
    this.nextId = 1;
    this.openFiles = new Map();
    this.nextFd = 100;
    this.logs = [];

    // Root
    this.inodes.set(0, {
      id: 0,
      name: '/',
      type: 'directory',
      parentId: null,
      size: 0,
      content: null,
      permissions: 0o755,
      owner: 'root',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      children: [1, 2],
      allocatedBlocks: []
    });

    this.inodes.set(1, {
      id: 1,
      name: 'home',
      type: 'directory',
      parentId: 0,
      size: 0,
      content: null,
      permissions: 0o755,
      owner: 'root',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      children: [3],
      allocatedBlocks: []
    });

    this.inodes.set(2, {
      id: 2,
      name: 'welcome.txt',
      type: 'file',
      parentId: 0,
      size: 118,
      content: 'Welcome to the Mini File System & Disk Scheduling Simulator!\nThis platform demonstrates core OS concepts interactively.',
      permissions: 0o644,
      owner: 'user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      allocatedBlocks: [0]
    });

    this.inodes.set(3, {
      id: 3,
      name: 'user',
      type: 'directory',
      parentId: 1,
      size: 0,
      content: null,
      permissions: 0o755,
      owner: 'user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      children: [4],
      allocatedBlocks: []
    });

    this.inodes.set(4, {
      id: 4,
      name: 'notes.txt',
      type: 'file',
      parentId: 3,
      size: 96,
      content: 'Operating Systems PBL Sem 5.\nVisualizing Contiguous, Linked, and Indexed block allocation schemes.',
      permissions: 0o644,
      owner: 'user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      allocatedBlocks: [1]
    });

    this.nextId = 5;
    this.log('FS_INIT', '/', 'SUCCESS', 'In-memory virtual file system initialized');
  }

  log(op, path, status, msg) {
    this.logs.unshift({
      id: this.logs.length + 1,
      timestamp: new Date().toLocaleTimeString(),
      operation: op,
      path,
      status,
      message: msg
    });
  }

  getPermString(type, perm) {
    const rwx = (p) => ((p & 4 ? 'r' : '-') + (p & 2 ? 'w' : '-') + (p & 1 ? 'x' : '-'));
    return (type === 'directory' ? 'd' : '-') + rwx((perm >> 6) & 7) + rwx((perm >> 3) & 7) + rwx(perm & 7);
  }

  getPath(id) {
    if (id === 0) return '/';
    const parts = [];
    let cur = this.inodes.get(id);
    while (cur && cur.id !== 0) {
      parts.unshift(cur.name);
      cur = this.inodes.get(cur.parentId);
    }
    return '/' + parts.join('/');
  }

  resolve(pathStr) {
    if (!pathStr || pathStr === '/') return this.inodes.get(0);
    const parts = pathStr.split('/').filter(p => p.length > 0);
    let cur = this.inodes.get(0);
    for (const part of parts) {
      if (cur.type !== 'directory') return null;
      const childId = cur.children.find(cid => this.inodes.get(cid)?.name === part);
      if (childId === undefined) return null;
      cur = this.inodes.get(childId);
    }
    return cur;
  }

  getTree(id = 0) {
    const node = this.inodes.get(id);
    if (!node) return null;
    const res = {
      id: node.id,
      name: node.name,
      type: node.type,
      size: node.size,
      path: this.getPath(node.id),
      permissions: this.getPermString(node.type, node.permissions),
      octalPerm: '0' + node.permissions.toString(8),
      owner: node.owner,
      createdAt: node.createdAt,
      modifiedAt: node.modifiedAt,
      children: []
    };
    if (node.type === 'directory' && node.children) {
      res.children = node.children.map(cid => this.getTree(cid)).filter(Boolean);
    }
    return res;
  }

  list(pathStr) {
    const node = this.resolve(pathStr);
    if (!node) throw new Error(`Directory '${pathStr}' not found`);
    return (node.children || []).map(cid => {
      const c = this.inodes.get(cid);
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        size: c.size,
        permissions: this.getPermString(c.type, c.permissions),
        octalPerm: '0' + c.permissions.toString(8),
        owner: c.owner,
        createdAt: c.createdAt,
        modifiedAt: c.modifiedAt,
        path: this.getPath(c.id),
        allocatedBlocks: c.allocatedBlocks || []
      };
    });
  }

  getMetadata(pathStr) {
    const node = this.resolve(pathStr);
    if (!node) throw new Error(`'${pathStr}' not found`);
    return {
      id: node.id,
      name: node.name,
      path: this.getPath(node.id),
      type: node.type,
      size: node.size,
      content: node.content,
      permissions: this.getPermString(node.type, node.permissions),
      octalPerm: '0' + node.permissions.toString(8),
      owner: node.owner,
      createdAt: node.createdAt,
      modifiedAt: node.modifiedAt,
      allocatedBlocks: node.allocatedBlocks || []
    };
  }

  createFile(pathStr, content = '', perm = 0o644) {
    const lastSlash = pathStr.lastIndexOf('/');
    const parentPath = lastSlash === 0 ? '/' : pathStr.slice(0, lastSlash);
    const fileName = pathStr.slice(lastSlash + 1);
    const parent = this.resolve(parentPath);
    if (!parent) throw new Error(`Parent '${parentPath}' not found`);

    const id = this.nextId++;
    const node = {
      id,
      name: fileName,
      type: 'file',
      parentId: parent.id,
      size: content.length,
      content,
      permissions: perm,
      owner: 'user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      allocatedBlocks: []
    };
    this.inodes.set(id, node);
    parent.children.push(id);
    this.log('SYS_CREAT', pathStr, 'SUCCESS', `Created file '${fileName}'`);
    return node;
  }

  mkdir(pathStr, perm = 0o755) {
    const lastSlash = pathStr.lastIndexOf('/');
    const parentPath = lastSlash === 0 ? '/' : pathStr.slice(0, lastSlash);
    const dirName = pathStr.slice(lastSlash + 1);
    const parent = this.resolve(parentPath);
    if (!parent) throw new Error(`Parent '${parentPath}' not found`);

    const id = this.nextId++;
    const node = {
      id,
      name: dirName,
      type: 'directory',
      parentId: parent.id,
      size: 0,
      content: null,
      permissions: perm,
      owner: 'user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      children: [],
      allocatedBlocks: []
    };
    this.inodes.set(id, node);
    parent.children.push(id);
    this.log('SYS_MKDIR', pathStr, 'SUCCESS', `Created directory '${dirName}'`);
    return node;
  }

  edit(pathStr, content) {
    const node = this.resolve(pathStr);
    if (!node || node.type !== 'file') throw new Error(`File '${pathStr}' not found`);
    node.content = content;
    node.size = content.length;
    node.modifiedAt = new Date().toISOString();
    this.log('SYS_WRITE', pathStr, 'SUCCESS', `Updated content of '${node.name}'`);
    return node;
  }

  append(pathStr, extra) {
    const node = this.resolve(pathStr);
    if (!node || node.type !== 'file') throw new Error(`File '${pathStr}' not found`);
    node.content += extra;
    node.size = node.content.length;
    node.modifiedAt = new Date().toISOString();
    this.log('SYS_APPEND', pathStr, 'SUCCESS', `Appended to '${node.name}'`);
    return node;
  }

  chmod(pathStr, mode) {
    const node = this.resolve(pathStr);
    if (!node) throw new Error(`'${pathStr}' not found`);
    const octal = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    node.permissions = octal;
    node.modifiedAt = new Date().toISOString();
    this.log('SYS_CHMOD', pathStr, 'SUCCESS', `Changed permissions to 0o${octal.toString(8)}`);
    return { inode: node };
  }

  delete(pathStr) {
    const node = this.resolve(pathStr);
    if (!node || node.id === 0) throw new Error('Cannot delete target');
    const parent = this.inodes.get(node.parentId);
    if (parent) {
      parent.children = parent.children.filter(cid => cid !== node.id);
    }
    this.inodes.delete(node.id);
    this.log('SYS_UNLINK', pathStr, 'SUCCESS', `Deleted '${node.name}'`);
    return true;
  }

  rename(pathStr, newName) {
    const node = this.resolve(pathStr);
    if (!node) throw new Error(`'${pathStr}' not found`);
    node.name = newName;
    node.modifiedAt = new Date().toISOString();
    this.log('SYS_RENAME', pathStr, 'SUCCESS', `Renamed to '${newName}'`);
    return node;
  }

  open(pathStr, mode = 'r') {
    const node = this.resolve(pathStr);
    if (!node || node.type !== 'file') throw new Error(`File '${pathStr}' not found`);
    const fd = this.nextFd++;
    const desc = { fd, inodeId: node.id, path: pathStr, mode, cursor: 0, openedAt: new Date().toLocaleTimeString() };
    this.openFiles.set(fd, desc);
    this.log('SYS_OPEN', pathStr, 'SUCCESS', `Allocated FD ${fd} in mode '${mode}'`);
    return desc;
  }

  close(fd) {
    this.openFiles.delete(parseInt(fd, 10));
    this.log('SYS_CLOSE', `FD:${fd}`, 'SUCCESS', `Closed FD ${fd}`);
    return true;
  }

  read(fd, len) {
    const d = this.openFiles.get(parseInt(fd, 10));
    if (!d) throw new Error(`Bad FD ${fd}`);
    const n = this.inodes.get(d.inodeId);
    const content = n.content || '';
    const slice = len ? content.slice(d.cursor, d.cursor + parseInt(len, 10)) : content;
    d.cursor += slice.length;
    return { data: slice, bytesRead: slice.length, cursor: d.cursor };
  }

  write(fd, data) {
    const d = this.openFiles.get(parseInt(fd, 10));
    if (!d) throw new Error(`Bad FD ${fd}`);
    const n = this.inodes.get(d.inodeId);
    n.content = (n.content || '') + data;
    n.size = n.content.length;
    return { bytesWritten: data.length, newSize: n.size };
  }

  getOpenFiles() {
    return Array.from(this.openFiles.values()).map(d => {
      const n = this.inodes.get(d.inodeId);
      return { ...d, name: n ? n.name : '?', fileSize: n ? n.size : 0 };
    });
  }
}

// Global Singletons for In-Browser Engine
const clientFS = new ClientFS();
const clientAllocator = new ClientAllocator(64, 512);
const clientScheduler = new ClientScheduler(199);

// Check if running on GitHub Pages (static)
const isStaticHosting = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';

// ============================================================================
// MAIN DUAL-MODE API WRAPPER
// ============================================================================

const API = {
  isStaticMode: isStaticHosting,

  async request(url, options = {}) {
    // If running statically on GitHub Pages, immediately bypass server fetch
    if (this.isStaticMode) {
      return this.handleClientRequest(url, options);
    }

    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server error occurred');
      }
      return data;
    } catch (err) {
      console.warn(`[API] Server unavailable for ${url}. Switching to in-browser client engine.`);
      this.isStaticMode = true;
      return this.handleClientRequest(url, options);
    }
  },

  handleClientRequest(url, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};

    // 1. File System
    if (url.startsWith('/api/fs/tree')) return { success: true, tree: clientFS.getTree(0) };
    if (url.startsWith('/api/fs/list')) {
      const u = new URL(url, 'http://dummy.local');
      const p = u.searchParams.get('path') || '/';
      return { success: true, path: p, items: clientFS.list(p) };
    }
    if (url.startsWith('/api/fs/metadata')) {
      const u = new URL(url, 'http://dummy.local');
      const p = u.searchParams.get('path');
      return { success: true, metadata: clientFS.getMetadata(p) };
    }
    if (url === '/api/fs/mkdir') return { success: true, inode: clientFS.mkdir(body.path, body.permissions ? parseInt(body.permissions, 8) : 0o755) };
    if (url === '/api/fs/create') return { success: true, inode: clientFS.createFile(body.path, body.content, body.permissions ? parseInt(body.permissions, 8) : 0o644) };
    if (url === '/api/fs/open') return { success: true, descriptor: clientFS.open(body.path, body.mode) };
    if (url === '/api/fs/close') return { success: true, result: clientFS.close(body.fd) };
    if (url === '/api/fs/read') return { success: true, ...clientFS.read(body.fd, body.length) };
    if (url === '/api/fs/write') return { success: true, ...clientFS.write(body.fd, body.data) };
    if (url === '/api/fs/edit') return { success: true, inode: clientFS.edit(body.path, body.content) };
    if (url === '/api/fs/append') return { success: true, inode: clientFS.append(body.path, body.data) };
    if (url === '/api/fs/delete') return { success: true, result: clientFS.delete(body.path) };
    if (url === '/api/fs/rename') return { success: true, inode: clientFS.rename(body.path, body.newName) };
    if (url === '/api/fs/chmod') return { success: true, ...clientFS.chmod(body.path, body.mode) };
    if (url === '/api/fs/open-files') return { success: true, openFiles: clientFS.getOpenFiles() };
    if (url === '/api/fs/logs') return { success: true, logs: clientFS.logs };
    if (url === '/api/fs/reset') { clientFS.reset(); return { success: true }; }

    // 2. Allocation
    if (url === '/api/allocation/state') return { success: true, ...clientAllocator.getState() };
    if (url === '/api/allocation/allocate') {
      const meta = clientAllocator.allocate(body.fileName, body.size, body.strategy, body.placementPolicy);
      return { success: true, message: `Allocated '${body.fileName}'`, file: meta, state: clientAllocator.getState() };
    }
    if (url === '/api/allocation/deallocate') {
      const res = clientAllocator.deallocate(body.fileName);
      return { success: true, message: `Deallocated '${body.fileName}'`, result: res, state: clientAllocator.getState() };
    }
    if (url === '/api/allocation/compact') return { success: true, ...clientAllocator.compact(), state: clientAllocator.getState() };
    if (url === '/api/allocation/switch-strategy') return { success: true, ...clientAllocator.switchStrategy(body.strategy, body.placementPolicy), state: clientAllocator.getState() };
    if (url === '/api/allocation/reset') { clientAllocator.initDisk(); clientAllocator.files.clear(); return { success: true, state: clientAllocator.getState() }; }

    // 3. Disk Scheduling
    if (url === '/api/disk/schedule') {
      const res = clientScheduler.run(body.algorithm, body.queue, body.initialHead, body.direction, body.maxCylinder);
      return { success: true, ...res };
    }
    if (url === '/api/disk/compare-all') {
      const res = clientScheduler.compareAll(body.queue, body.initialHead, body.direction, body.maxCylinder);
      return { success: true, ...res };
    }
    if (url === '/api/disk/presets') return { success: true, presets: clientScheduler.getPresets() };

    return { success: true };
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
      let csv = `Request Queue,"${(queue || []).join(', ')}"\nInitial Head,${initialHead}\n\n`;
      csv += 'Algorithm,Name,Total Head Movement,Avg Seek Time,Steps,Difference,Percent\n';
      summaryTable.forEach(r => {
        csv += `"${r.algorithm}","${r.name}",${r.totalHeadMovement},${r.averageSeekTime},${r.totalSteps},${r.differenceFromBest},"${r.percentDifference}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
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
