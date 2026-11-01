/**
 * comparison.js
 * Multi-algorithm benchmarking and Chart.js visualization for Disk Schedulers.
 */

document.addEventListener('DOMContentLoaded', () => {
  const ComparisonApp = {
    chartInstance: null,
    lastComparisonData: null,

    init() {
      this.bindEvents();
    },

    bindEvents() {
      document.getElementById('btnRunComparison')?.addEventListener('click', () => {
        this.runComparison();
      });

      document.getElementById('btnExportCompareCsv')?.addEventListener('click', () => {
        if (!this.lastComparisonData) {
          Toast.warning('Please run a comparison first');
          return;
        }
        API.disk.exportCsv(
          this.lastComparisonData.summaryTable,
          this.lastComparisonData.queue,
          this.lastComparisonData.initialHead
        );
      });

      document.getElementById('btnExportCompareJson')?.addEventListener('click', () => {
        if (!this.lastComparisonData) {
          Toast.warning('Please run a comparison first');
          return;
        }
        const blob = new Blob([JSON.stringify(this.lastComparisonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'disk-scheduling-benchmark.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        Toast.success('Exported comparison JSON');
      });
    },

    async runComparison() {
      // Get parameters from inputs on page
      const queueRaw = document.getElementById('queueInput')?.value || '98, 183, 37, 122, 14, 124, 65, 67';
      const queue = queueRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      const initialHead = parseInt(document.getElementById('headInput')?.value, 10) || 53;
      const direction = document.getElementById('directionSelect')?.value || 'up';
      const maxCylinder = parseInt(document.getElementById('maxCylinderInput')?.value, 10) || 199;

      try {
        const data = await API.disk.compareAll(queue, initialHead, direction, maxCylinder);
        this.lastComparisonData = data;
        this.renderWinnerBanner(data);
        this.renderTable(data);
        this.renderChart(data);
        Toast.success('Benchmark comparison updated for all 6 algorithms!');
      } catch (err) {
        Toast.error(err.message);
      }
    },

    renderWinnerBanner(data) {
      const banner = document.getElementById('winnerBanner');
      if (!banner) return;

      banner.style.display = 'flex';
      document.getElementById('winnerAlgoName').textContent = `${data.bestAlgorithm.algorithm} (${data.bestAlgorithm.name})`;
      document.getElementById('winnerSeekDistance').textContent = `${data.bestAlgorithm.totalHeadMovement} Cylinders`;
      document.getElementById('winnerExplanation').textContent =
        `Achieved lowest head movement on this queue. Worst was ${data.worstAlgorithm.algorithm} with ${data.worstAlgorithm.totalHeadMovement} cylinders.`;
    },

    renderTable(data) {
      const tbody = document.getElementById('comparisonTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';
      data.summaryTable.forEach(row => {
        const tr = document.createElement('tr');
        if (row.isBest) {
          tr.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        }

        tr.innerHTML = `
          <td>
            <strong>${row.algorithm}</strong>
            <div style="font-size:11px; color:#64748b;">${row.name}</div>
          </td>
          <td><strong style="color:${row.isBest ? '#34d399' : '#f1f5f9'}; font-size:15px;">${row.totalHeadMovement}</strong> cyl</td>
          <td>${row.averageSeekTime} cyl/req</td>
          <td>${row.totalSteps} steps</td>
          <td>
            ${row.isBest
              ? '<span class="badge badge-success">★ Best Optimal</span>'
              : `<span style="color:#ef4444;">+${row.differenceFromBest} (${row.percentDifference})</span>`}
          </td>
          <td style="font-family:monospace; font-size:11px; color:#94a3b8;">${row.seekSequencePreview}</td>
        `;
        tbody.appendChild(tr);
      });
    },

    renderChart(data) {
      const ctx = document.getElementById('comparisonChart')?.getContext('2d');
      if (!ctx) return;

      const labels = data.summaryTable.map(r => r.algorithm);
      const values = data.summaryTable.map(r => r.totalHeadMovement);
      const bgColors = data.summaryTable.map(r => r.isBest ? '#10b981' : '#38bdf8');

      // If Chart.js is available
      if (window.Chart) {
        if (this.chartInstance) {
          this.chartInstance.destroy();
        }

        this.chartInstance = new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Total Head Movement (Cylinders)',
              data: values,
              backgroundColor: bgColors,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: '#1e293b'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { color: '#94a3b8' }
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` Head Movement: ${ctx.parsed.y} cylinders`
                }
              }
            },
            scales: {
              x: {
                ticks: { color: '#94a3b8' },
                grid: { color: '#1e293b' }
              },
              y: {
                ticks: { color: '#94a3b8' },
                grid: { color: '#1e293b' },
                title: {
                  display: true,
                  text: 'Seek Cylinders',
                  color: '#64748b'
                }
              }
            }
          }
        });
      } else {
        // Fallback simple Canvas renderer
        this.renderFallbackChart(ctx, labels, values, bgColors);
      }
    },

    renderFallbackChart(ctx, labels, values, colors) {
      const canvas = ctx.canvas;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const maxVal = Math.max(...values, 1);
      const barWidth = width / (labels.length * 2);
      const bottom = height - 40;

      labels.forEach((label, i) => {
        const val = values[i];
        const barHeight = (val / maxVal) * (bottom - 40);
        const x = (i * 2 + 0.5) * barWidth;
        const y = bottom - barHeight;

        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y, barWidth, barHeight);

        // Labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + barWidth / 2, bottom + 20);
        ctx.fillText(String(val), x + barWidth / 2, y - 8);
      });
    }
  };

  window.ComparisonApp = ComparisonApp;
  ComparisonApp.init();
});
