/**
 * disk.js
 * Disk Scheduling Simulator with HTML5 Canvas animation engine:
 * Supports FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK.
 */

document.addEventListener('DOMContentLoaded', () => {
  const DiskApp = {
    canvas: null,
    ctx: null,
    simulationResult: null,
    currentStepIndex: 0,
    isPlaying: false,
    playSpeed: 1, // multiplier
    animationFrameId: null,
    headCurrentPos: 53,
    headTargetPos: 53,
    transitionProgress: 1,

    async init() {
      this.initCanvas();
      this.bindEvents();
      this.loadPresets();
      await this.runSimulation();
    },

    initCanvas() {
      this.canvas = document.getElementById('diskCanvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      window.addEventListener('resize', () => {
        this.resizeCanvas();
        this.draw();
      });
    },

    resizeCanvas() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * window.devicePixelRatio;
      this.canvas.height = rect.height * window.devicePixelRatio;
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    },

    bindEvents() {
      // Run button
      document.getElementById('btnRunSchedule')?.addEventListener('click', () => {
        this.runSimulation();
      });

      // Play / Pause
      document.getElementById('btnPlayPause')?.addEventListener('click', () => {
        this.togglePlay();
      });

      // Step forward
      document.getElementById('btnStepForward')?.addEventListener('click', () => {
        this.stepForward();
      });

      // Reset
      document.getElementById('btnResetAnim')?.addEventListener('click', () => {
        this.resetAnimation();
      });

      // Speed selector
      document.getElementById('speedSelect')?.addEventListener('change', (e) => {
        this.playSpeed = parseFloat(e.target.value) || 1;
      });

      // Preset selector
      document.getElementById('presetSelect')?.addEventListener('change', (e) => {
        this.applyPreset(e.target.value);
      });

      // Random queue generator
      document.getElementById('btnRandomQueue')?.addEventListener('click', () => {
        this.generateRandomQueue();
      });

      // Algorithm change
      document.getElementById('algoSelect')?.addEventListener('change', () => {
        this.runSimulation();
      });

      // Export queue
      document.getElementById('btnExportQueue')?.addEventListener('click', () => {
        this.exportCurrentQueue();
      });
    },

    async loadPresets() {
      try {
        const data = await API.disk.getPresets();
        const select = document.getElementById('presetSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- Choose a Preset --</option>';
        data.presets.forEach((p, idx) => {
          const opt = document.createElement('option');
          opt.value = idx;
          opt.textContent = `${p.name} (Head: ${p.initialHead})`;
          select.appendChild(opt);
        });
        this.presets = data.presets;
      } catch (err) {
        console.warn('Could not load presets:', err);
      }
    },

    applyPreset(index) {
      if (!this.presets || index === '') return;
      const p = this.presets[parseInt(index, 10)];
      if (!p) return;

      document.getElementById('queueInput').value = p.queue.join(', ');
      document.getElementById('headInput').value = p.initialHead;
      document.getElementById('directionSelect').value = p.direction;
      document.getElementById('maxCylinderInput').value = p.maxCylinder;
      Toast.info(`Loaded preset: ${p.name}`);
      this.runSimulation();
    },

    generateRandomQueue() {
      const maxCyl = parseInt(document.getElementById('maxCylinderInput').value, 10) || 199;
      const count = 8;
      const queue = [];
      for (let i = 0; i < count; i++) {
        queue.push(Math.floor(Math.random() * (maxCyl + 1)));
      }
      const randomHead = Math.floor(Math.random() * (maxCyl + 1));
      document.getElementById('queueInput').value = queue.join(', ');
      document.getElementById('headInput').value = randomHead;
      Toast.success('Generated random cylinder requests');
      this.runSimulation();
    },

    getFormValues() {
      const queueRaw = document.getElementById('queueInput').value;
      const queue = queueRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      const initialHead = parseInt(document.getElementById('headInput').value, 10);
      const direction = document.getElementById('directionSelect').value;
      const maxCylinder = parseInt(document.getElementById('maxCylinderInput').value, 10) || 199;
      const algorithm = document.getElementById('algoSelect').value;

      return { queue, initialHead, direction, maxCylinder, algorithm };
    },

    async runSimulation() {
      const { queue, initialHead, direction, maxCylinder, algorithm } = this.getFormValues();

      if (queue.length === 0) {
        Toast.error('Please enter at least one valid cylinder request');
        return;
      }

      try {
        const result = await API.disk.schedule(algorithm, queue, initialHead, direction, maxCylinder);
        this.simulationResult = result;
        this.renderMetrics(result);
        this.renderStepsTable(result);
        this.resetAnimation();
        this.draw();
      } catch (err) {
        Toast.error(err.message);
      }
    },

    renderMetrics(result) {
      document.getElementById('metricAlgoName').textContent = result.name;
      document.getElementById('metricTotalSeek').textContent = `${result.totalHeadMovement} Cylinders`;
      document.getElementById('metricAvgSeek').textContent = `${result.averageSeekTime} Cyl/Req`;
      document.getElementById('metricComplexity').textContent = result.timeComplexity;
      document.getElementById('algoDescription').textContent = result.description;

      const prosList = document.getElementById('algoPros');
      const consList = document.getElementById('algoCons');
      if (prosList) {
        prosList.innerHTML = result.pros.map(p => `<li>✓ ${p}</li>`).join('');
      }
      if (consList) {
        consList.innerHTML = result.cons.map(c => `<li>✕ ${c}</li>`).join('');
      }
    },

    renderStepsTable(result) {
      const tbody = document.getElementById('stepsTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';
      result.steps.forEach(step => {
        const tr = document.createElement('tr');
        tr.id = `step-row-${step.stepNumber}`;
        tr.innerHTML = `
          <td><strong>Step ${step.stepNumber}</strong></td>
          <td>${step.from}</td>
          <td><span style="color:#38bdf8; font-weight:bold;">${step.to}</span></td>
          <td>${step.seekDistance} cyl</td>
          <td>${step.runningTotal} cyl</td>
          <td><span class="badge ${step.isServicedRequest ? 'badge-success' : 'badge-warning'}">${step.note}</span></td>
        `;
        tbody.appendChild(tr);
      });
    },

    // Animation Controls
    togglePlay() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    },

    play() {
      if (!this.simulationResult) return;
      if (this.currentStepIndex >= this.simulationResult.steps.length) {
        this.currentStepIndex = 0;
      }
      this.isPlaying = true;
      document.getElementById('btnPlayPause').innerHTML = '<span>⏸ Pause</span>';
      this.animateLoop();
    },

    pause() {
      this.isPlaying = false;
      document.getElementById('btnPlayPause').innerHTML = '<span>▶ Play</span>';
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
    },

    resetAnimation() {
      this.pause();
      this.currentStepIndex = 0;
      if (this.simulationResult) {
        this.headCurrentPos = this.simulationResult.initialHead;
        this.headTargetPos = this.simulationResult.initialHead;
      }
      this.transitionProgress = 1;
      this.highlightStepRow(0);
      this.draw();
    },

    stepForward() {
      if (!this.simulationResult) return;
      if (this.currentStepIndex < this.simulationResult.steps.length) {
        this.currentStepIndex++;
        const target = this.simulationResult.seekSequence[this.currentStepIndex];
        this.headCurrentPos = this.headTargetPos;
        this.headTargetPos = target;
        this.transitionProgress = 1;
        this.highlightStepRow(this.currentStepIndex);
        this.draw();
      } else {
        Toast.info('Simulation reached end of request sequence');
      }
    },

    highlightStepRow(stepNum) {
      document.querySelectorAll('.steps-table tr').forEach(r => r.classList.remove('step-active'));
      const row = document.getElementById(`step-row-${stepNum}`);
      if (row) {
        row.classList.add('step-active');
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      const indicator = document.getElementById('currentStepIndicator');
      if (indicator && this.simulationResult) {
        indicator.textContent = `Step ${stepNum} of ${this.simulationResult.steps.length}`;
      }
    },

    animateLoop() {
      if (!this.isPlaying) return;

      const speedFactor = 0.03 * this.playSpeed;
      this.transitionProgress += speedFactor;

      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1;
        this.headCurrentPos = this.headTargetPos;

        if (this.currentStepIndex < this.simulationResult.steps.length) {
          this.currentStepIndex++;
          this.highlightStepRow(this.currentStepIndex);
          if (this.currentStepIndex < this.simulationResult.seekSequence.length) {
            this.headTargetPos = this.simulationResult.seekSequence[this.currentStepIndex];
            this.transitionProgress = 0;
          }
        } else {
          this.pause();
          Toast.success('Disk scheduling animation completed!');
          this.draw();
          return;
        }
      }

      this.draw();
      this.animationFrameId = requestAnimationFrame(() => this.animateLoop());
    },

    // HTML5 Canvas Drawing
    draw() {
      if (!this.ctx || !this.simulationResult) return;
      const ctx = this.ctx;
      const width = this.canvas.getBoundingClientRect().width;
      const height = this.canvas.getBoundingClientRect().height;

      ctx.clearRect(0, 0, width, height);

      const maxCyl = this.simulationResult.maxCylinder || 199;
      const paddingX = 50;
      const trackY = 120;
      const trackWidth = width - (paddingX * 2);

      const getX = (cyl) => paddingX + (cyl / maxCyl) * trackWidth;

      // 1. Draw Disk Cylinder Track Line
      ctx.strokeStyle = '#243049';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(paddingX, trackY);
      ctx.lineTo(paddingX + trackWidth, trackY);
      ctx.stroke();

      // Track ends tick marks
      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('0', paddingX, trackY + 28);
      ctx.fillText(String(maxCyl), paddingX + trackWidth, trackY + 28);

      // Intermediate cylinder ticks (every 25%)
      for (let i = 1; i < 4; i++) {
        const val = Math.round((maxCyl / 4) * i);
        const x = getX(val);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, trackY - 10);
        ctx.lineTo(x, trackY + 10);
        ctx.stroke();
        ctx.fillText(String(val), x, trackY + 28);
      }

      // 2. Draw Seek Trajectory Path Graph (Bottom 2D trace)
      const graphTop = 180;
      const graphHeight = height - graphTop - 30;
      const totalSteps = this.simulationResult.seekSequence.length - 1;

      if (totalSteps > 0) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i <= this.currentStepIndex && i < this.simulationResult.seekSequence.length; i++) {
          const cyl = this.simulationResult.seekSequence[i];
          const x = getX(cyl);
          const y = graphTop + (i / totalSteps) * graphHeight;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw points on graph
        for (let i = 0; i <= this.currentStepIndex && i < this.simulationResult.seekSequence.length; i++) {
          const cyl = this.simulationResult.seekSequence[i];
          const x = getX(cyl);
          const y = graphTop + (i / totalSteps) * graphHeight;

          ctx.fillStyle = (i === this.currentStepIndex) ? '#38bdf8' : '#818cf8';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Draw Pending Request Pins on Main Track
      const originalQueue = this.getFormValues().queue;
      const servicedSoFar = new Set(this.simulationResult.seekSequence.slice(0, this.currentStepIndex + 1));

      originalQueue.forEach(req => {
        const x = getX(req);
        const isServiced = servicedSoFar.has(req);

        // Pin stem
        ctx.strokeStyle = isServiced ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, trackY - 35);
        ctx.lineTo(x, trackY);
        ctx.stroke();

        // Pin head
        ctx.fillStyle = isServiced ? '#10b981' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(x, trackY - 35, 6, 0, Math.PI * 2);
        ctx.fill();

        // Pin text
        ctx.fillStyle = '#f1f5f9';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(req), x, trackY - 45);
      });

      // 4. Draw Current Magnetic Head Carriage
      const interpolatedPos = this.headCurrentPos + (this.headTargetPos - this.headCurrentPos) * this.transitionProgress;
      const headX = getX(interpolatedPos);

      // Magnetic head glow
      const glow = ctx.createRadialGradient(headX, trackY, 5, headX, trackY, 25);
      glow.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(headX, trackY, 25, 0, Math.PI * 2);
      ctx.fill();

      // Carriage arm
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(headX, trackY - 16);
      ctx.lineTo(headX - 12, trackY + 16);
      ctx.lineTo(headX + 12, trackY + 16);
      ctx.closePath();
      ctx.fill();

      // Head position label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`HEAD: ${Math.round(interpolatedPos)}`, headX, trackY - 20);
    },

    exportCurrentQueue() {
      const data = {
        queue: this.getFormValues().queue,
        initialHead: this.getFormValues().initialHead,
        direction: this.getFormValues().direction,
        maxCylinder: this.getFormValues().maxCylinder,
        algorithm: this.getFormValues().algorithm,
        result: this.simulationResult
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `disk-schedule-${data.algorithm.toLowerCase()}-results.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      Toast.success('Exported simulation results');
    }
  };

  window.DiskApp = DiskApp;
  DiskApp.init();
});
