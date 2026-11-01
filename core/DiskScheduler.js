/**
 * core/DiskScheduler.js
 * Comprehensive Disk Scheduling Algorithms Engine:
 * 1. FCFS (First-Come, First-Served)
 * 2. SSTF (Shortest Seek Time First)
 * 3. SCAN (Elevator Algorithm)
 * 4. C-SCAN (Circular SCAN)
 * 5. LOOK (Look Algorithm)
 * 6. C-LOOK (Circular LOOK)
 *
 * Provides step-by-step trace, seek calculations, educational explanations,
 * and multi-algorithm comparative benchmarking.
 */

class DiskScheduler {
  constructor(defaultMaxCylinder = 199) {
    this.defaultMaxCylinder = defaultMaxCylinder;
  }

  // Sanitize and validate request queue
  validateInput(queue, initialHead, maxCylinder = this.defaultMaxCylinder) {
    if (!Array.isArray(queue) || queue.length === 0) {
      throw new Error('Request queue cannot be empty');
    }

    const cleanQueue = queue
      .map(x => parseInt(x, 10))
      .filter(x => !isNaN(x));

    if (cleanQueue.length === 0) {
      throw new Error('Queue contains no valid numeric cylinders');
    }

    const head = parseInt(initialHead, 10);
    if (isNaN(head)) {
      throw new Error('Initial head position must be a number');
    }

    const maxCyl = parseInt(maxCylinder, 10) || this.defaultMaxCylinder;

    if (head < 0 || head > maxCyl) {
      throw new Error(`Initial head (${head}) must be between 0 and ${maxCyl}`);
    }

    for (const req of cleanQueue) {
      if (req < 0 || req > maxCyl) {
        throw new Error(`Cylinder request ${req} is out of bounds (0 - ${maxCyl})`);
      }
    }

    return { queue: cleanQueue, initialHead: head, maxCylinder: maxCyl };
  }

  // Build step-by-step execution metrics from seek sequence
  buildSteps(seekSequence, originalQueue) {
    const steps = [];
    let runningTotal = 0;
    const requestSet = new Set(originalQueue);

    for (let i = 1; i < seekSequence.length; i++) {
      const from = seekSequence[i - 1];
      const to = seekSequence[i];
      const distance = Math.abs(to - from);
      runningTotal += distance;

      const isServiced = requestSet.has(to);
      let note = isServiced ? `Serviced request at cylinder ${to}` : `Head boundary movement to ${to}`;
      if (to === from) note = `Head stationary at ${to}`;

      steps.push({
        stepNumber: i,
        from,
        to,
        seekDistance: distance,
        runningTotal,
        isServicedRequest: isServiced,
        note
      });
    }

    const totalHeadMovement = runningTotal;
    const requestCount = originalQueue.length;
    const averageSeekTime = requestCount > 0 ? (totalHeadMovement / requestCount).toFixed(2) : 0;

    return {
      seekSequence,
      steps,
      totalHeadMovement,
      averageSeekTime: parseFloat(averageSeekTime),
      requestCount
    };
  }

  // 1. FCFS (First-Come, First-Served)
  fcfs(rawQueue, rawHead, rawMaxCylinder) {
    const { queue, initialHead, maxCylinder } = this.validateInput(rawQueue, rawHead, rawMaxCylinder);
    const seekSequence = [initialHead, ...queue];
    const metrics = this.buildSteps(seekSequence, queue);

    return {
      algorithm: 'FCFS',
      name: 'First-Come, First-Served',
      initialHead,
      direction: 'n/a',
      maxCylinder,
      ...metrics,
      timeComplexity: 'O(N)',
      description: 'Requests are addressed strictly in the order they arrive. Does not optimize seek time, which can result in wild head swings (the "wild swing" problem).',
      pros: ['Completely fair; prevents starvation', 'Simplest scheduling algorithm to implement', 'Low computational overhead'],
      cons: ['High average seek time and poor throughput', 'Inefficient when requests are dispersed across disk']
    };
  }

  // 2. SSTF (Shortest Seek Time First)
  sstf(rawQueue, rawHead, rawMaxCylinder) {
    const { queue, initialHead, maxCylinder } = this.validateInput(rawQueue, rawHead, rawMaxCylinder);
    const pending = [...queue];
    const seekSequence = [initialHead];
    let currentHead = initialHead;

    while (pending.length > 0) {
      let closestIdx = 0;
      let minDistance = Math.abs(pending[0] - currentHead);

      for (let i = 1; i < pending.length; i++) {
        const dist = Math.abs(pending[i] - currentHead);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      currentHead = pending[closestIdx];
      seekSequence.push(currentHead);
      pending.splice(closestIdx, 1);
    }

    const metrics = this.buildSteps(seekSequence, queue);

    return {
      algorithm: 'SSTF',
      name: 'Shortest Seek Time First',
      initialHead,
      direction: 'adaptive',
      maxCylinder,
      ...metrics,
      timeComplexity: 'O(N²)',
      description: 'Greedily selects the request with minimum seek distance from current head position. Significantly improves throughput compared to FCFS.',
      pros: ['Substantially lower total seek time than FCFS', 'High throughput for localized clusters of requests'],
      cons: ['Risk of starvation for requests far from current head', 'High variance in response times']
    };
  }

  // 3. SCAN (Elevator Algorithm)
  scan(rawQueue, rawHead, direction = 'up', rawMaxCylinder) {
    const { queue, initialHead, maxCylinder } = this.validateInput(rawQueue, rawHead, rawMaxCylinder);
    const dir = direction.toLowerCase() === 'down' ? 'down' : 'up';

    const left = queue.filter(x => x < initialHead).sort((a, b) => b - a); // descending
    const right = queue.filter(x => x > initialHead).sort((a, b) => a - b); // ascending
    const exact = queue.filter(x => x === initialHead);

    const seekSequence = [initialHead];
    if (exact.length > 0) seekSequence.push(...exact);

    if (dir === 'up') {
      seekSequence.push(...right);
      // If there are left requests, head must travel all the way to disk edge (maxCylinder) before reversing
      if (left.length > 0) {
        if (!seekSequence.includes(maxCylinder)) {
          seekSequence.push(maxCylinder);
        }
        seekSequence.push(...left);
      }
    } else {
      seekSequence.push(...left);
      // If there are right requests, head travels to 0 before reversing
      if (right.length > 0) {
        if (!seekSequence.includes(0)) {
          seekSequence.push(0);
        }
        seekSequence.push(...right);
      }
    }

    const metrics = this.buildSteps(seekSequence, queue);

    return {
      algorithm: 'SCAN',
      name: 'SCAN (Elevator Algorithm)',
      initialHead,
      direction: dir,
      maxCylinder,
      ...metrics,
      timeComplexity: 'O(N log N)',
      description: 'Head sweeps in one direction servicing requests until it reaches the physical edge of the disk, then reverses direction. Like a building elevator.',
      pros: ['Eliminates starvation; upper bound on waiting time', 'Much better performance and lower seek times than FCFS'],
      cons: ['Inefficient when reversing from empty disk boundaries', 'Requests just behind the head must wait for full round trip']
    };
  }

  // 4. C-SCAN (Circular SCAN)
  cscan(rawQueue, rawHead, direction = 'up', rawMaxCylinder) {
    const { queue, initialHead, maxCylinder } = this.validateInput(rawQueue, rawHead, rawMaxCylinder);
    const dir = direction.toLowerCase() === 'down' ? 'down' : 'up';

    const left = queue.filter(x => x < initialHead).sort((a, b) => a - b); // ascending
    const right = queue.filter(x => x > initialHead).sort((a, b) => a - b); // ascending
    const exact = queue.filter(x => x === initialHead);

    const seekSequence = [initialHead];
    if (exact.length > 0) seekSequence.push(...exact);

    if (dir === 'up') {
      seekSequence.push(...right);
      if (left.length > 0) {
        seekSequence.push(maxCylinder);
        seekSequence.push(0);
        seekSequence.push(...left);
      }
    } else {
      const leftDesc = queue.filter(x => x < initialHead).sort((a, b) => b - a);
      const rightDesc = queue.filter(x => x > initialHead).sort((a, b) => b - a);
      seekSequence.push(...leftDesc);
      if (rightDesc.length > 0) {
        seekSequence.push(0);
        seekSequence.push(maxCylinder);
        seekSequence.push(...rightDesc);
      }
    }

    const metrics = this.buildSteps(seekSequence, queue);

    return {
      algorithm: 'C-SCAN',
      name: 'C-SCAN (Circular SCAN)',
      initialHead,
      direction: dir,
      maxCylinder,
      ...metrics,
      timeComplexity: 'O(N log N)',
      description: 'Services requests in one direction only. When reaching the end, it immediately returns to the beginning without servicing any requests on return sweep.',
      pros: ['Provides more uniform waiting times than regular SCAN', 'Prevents bias toward middle cylinders'],
      cons: ['Wasted return seek without servicing any requests', 'Unnecessary travel to boundary 0 and maxCylinder']
    };
  }

  // 5. LOOK
  look(rawQueue, rawHead, direction = 'up', rawMaxCylinder) {
    const { queue, initialHead, maxCylinder } = this.validateInput(rawQueue, rawHead, rawMaxCylinder);
    const dir = direction.toLowerCase() === 'down' ? 'down' : 'up';

    const left = queue.filter(x => x < initialHead).sort((a, b) => b - a); // descending
    const right = queue.filter(x => x > initialHead).sort((a, b) => a - b); // ascending
    const exact = queue.filter(x => x === initialHead);

    const seekSequence = [initialHead];
    if (exact.length > 0) seekSequence.push(...exact);

    if (dir === 'up') {
      seekSequence.push(...right);
      if (left.length > 0) {
        seekSequence.push(...left);
      }
    } else {
      seekSequence.push(...left);
      if (right.length > 0) {
        seekSequence.push(...right);
      }
    }

    const metrics = this.buildSteps(seekSequence, queue);

    return {
      algorithm: 'LOOK',
      name: 'LOOK Algorithm',
      initialHead,
      direction: dir,
      maxCylinder,
      ...metrics,
      timeComplexity: 'O(N log N)',
      description: 'An optimization of SCAN. The head only goes as far as the final request in each direction, reversing immediately instead of traveling all the way to the disk edge.',
      pros: ['Prevents unnecessary seeks to disk boundaries 0 and maxCylinder', 'Superior seek efficiency compared to standard SCAN'],
      cons: ['Slightly more complex book-keeping to track extremities of requests']
    };
  }

  // 6. C-LOOK (Circular LOOK)
  clook(rawQueue, rawHead, direction = 'up', rawMaxCylinder) {
    const { queue, initialHead, maxCylinder } = this.validateInput(rawQueue, rawHead, rawMaxCylinder);
    const dir = direction.toLowerCase() === 'down' ? 'down' : 'up';

    const left = queue.filter(x => x < initialHead).sort((a, b) => a - b); // ascending
    const right = queue.filter(x => x > initialHead).sort((a, b) => a - b); // ascending
    const exact = queue.filter(x => x === initialHead);

    const seekSequence = [initialHead];
    if (exact.length > 0) seekSequence.push(...exact);

    if (dir === 'up') {
      seekSequence.push(...right);
      if (left.length > 0) {
        seekSequence.push(...left);
      }
    } else {
      const leftDesc = queue.filter(x => x < initialHead).sort((a, b) => b - a);
      const rightDesc = queue.filter(x => x > initialHead).sort((a, b) => b - a);
      seekSequence.push(...leftDesc);
      if (rightDesc.length > 0) {
        seekSequence.push(...rightDesc);
      }
    }

    const metrics = this.buildSteps(seekSequence, queue);

    return {
      algorithm: 'C-LOOK',
      name: 'C-LOOK (Circular LOOK)',
      initialHead,
      direction: dir,
      maxCylinder,
      ...metrics,
      timeComplexity: 'O(N log N)',
      description: 'An optimization of C-SCAN. Moves in one direction servicing requests. Instead of traveling all the way to 0 and max cylinder, it jumps directly to the lowest/highest request.',
      pros: ['Lowest total head travel among circular algorithms', 'Eliminates boundary traversal penalty completely', 'Uniform waiting time distribution'],
      cons: ['Slight overhead to maintain sorted boundary pointers']
    };
  }

  // Run simulation for a specific algorithm
  run(algorithmName, queue, initialHead, direction = 'up', maxCylinder = this.defaultMaxCylinder) {
    const algo = (algorithmName || 'fcfs').toLowerCase();
    switch (algo) {
      case 'fcfs':
        return this.fcfs(queue, initialHead, maxCylinder);
      case 'sstf':
        return this.sstf(queue, initialHead, maxCylinder);
      case 'scan':
        return this.scan(queue, initialHead, direction, maxCylinder);
      case 'c-scan':
      case 'cscan':
        return this.cscan(queue, initialHead, direction, maxCylinder);
      case 'look':
        return this.look(queue, initialHead, direction, maxCylinder);
      case 'c-look':
      case 'clook':
        return this.clook(queue, initialHead, direction, maxCylinder);
      default:
        throw new Error(`Unsupported scheduling algorithm '${algorithmName}'`);
    }
  }

  // Multi-algorithm comparative benchmark on exact same request queue
  compareAll(queue, initialHead, direction = 'up', maxCylinder = this.defaultMaxCylinder) {
    const results = [
      this.fcfs(queue, initialHead, maxCylinder),
      this.sstf(queue, initialHead, maxCylinder),
      this.scan(queue, initialHead, direction, maxCylinder),
      this.cscan(queue, initialHead, direction, maxCylinder),
      this.look(queue, initialHead, direction, maxCylinder),
      this.clook(queue, initialHead, direction, maxCylinder)
    ];

    // Find best and worst
    let best = results[0];
    let worst = results[0];
    for (const res of results) {
      if (res.totalHeadMovement < best.totalHeadMovement) best = res;
      if (res.totalHeadMovement > worst.totalHeadMovement) worst = res;
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
      initialHead,
      direction,
      maxCylinder,
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

  // Common textbook presets for quick educational demonstration
  getPresets() {
    return [
      {
        name: 'Silberschatz Textbook Classic',
        queue: [98, 183, 37, 122, 14, 124, 65, 67],
        initialHead: 53,
        direction: 'up',
        maxCylinder: 199,
        description: 'Standard example from Operating System Concepts (Silberschatz, Galvin, Gagne).'
      },
      {
        name: 'High Clustering (Locality of Reference)',
        queue: [45, 48, 52, 50, 160, 162, 165, 158],
        initialHead: 40,
        direction: 'up',
        maxCylinder: 199,
        description: 'Demonstrates how SSTF and LOOK excel when disk requests exhibit spatial locality.'
      },
      {
        name: 'Alternating Extremities (Wild Swings)',
        queue: [10, 190, 15, 185, 20, 180, 25, 175],
        initialHead: 100,
        direction: 'up',
        maxCylinder: 199,
        description: 'Presents the worst-case scenario for FCFS with severe head ping-ponging.'
      },
      {
        name: 'Uniformly Distributed',
        queue: [20, 40, 60, 80, 100, 120, 140, 160, 180],
        initialHead: 90,
        direction: 'down',
        maxCylinder: 199,
        description: 'Uniform spacing across the disk surface.'
      }
    ];
  }
}

module.exports = DiskScheduler;
