/**
 * StepTracker - iOS-style Step Tracking Web App
 * Uses DeviceMotion API for step detection with HealthKit-like functionality
 */

class StepTracker {
    constructor() {
        // State
        this.isTracking = false;
        this.startTime = null;
        this.elapsedTime = 0;
        this.stepCount = 0;
        this.timerInterval = null;
        this.walks = [];

        // Step detection parameters
        this.lastAcceleration = { x: 0, y: 0, z: 0 };
        this.stepThreshold = 1.2;
        this.lastStepTime = 0;
        this.minStepInterval = 250; // Minimum ms between steps
        this.accelerationBuffer = [];
        this.bufferSize = 4;

        // DOM Elements
        this.timerDisplay = document.getElementById('timerDisplay');
        this.timerLabel = document.getElementById('timerLabel');
        this.timerProgress = document.getElementById('timerProgress');
        this.stepCountEl = document.getElementById('stepCount');
        this.stepsPerMinuteEl = document.getElementById('stepsPerMinute');
        this.controlButton = document.getElementById('controlButton');
        this.summaryModal = document.getElementById('summaryModal');
        this.historyList = document.getElementById('historyList');

        // Chart
        this.chart = null;
        this.currentPeriod = 'week';

        this.init();
    }

    init() {
        this.loadWalks();
        this.setupEventListeners();
        this.updateStatusTime();
        this.updateDateDisplay();
        this.renderHistory();
        this.initChart();

        // Update status time every minute
        setInterval(() => this.updateStatusTime(), 60000);

        // Add SVG gradient for timer ring
        this.addTimerGradient();
    }

    addTimerGradient() {
        const svg = document.querySelector('.timer-ring');
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#34C759"/>
                <stop offset="100%" style="stop-color:#30D158"/>
            </linearGradient>
        `;
        svg.insertBefore(defs, svg.firstChild);
    }

    setupEventListeners() {
        // Control button
        this.controlButton.addEventListener('click', () => this.toggleTracking());

        // Close summary modal
        document.getElementById('closeSummary').addEventListener('click', () => {
            this.summaryModal.classList.remove('active');
        });

        // Tab navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.closest('.tab-button')));
        });

        // Period selector
        document.querySelectorAll('.period-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchPeriod(e.target));
        });

        // Close modal on overlay click
        this.summaryModal.addEventListener('click', (e) => {
            if (e.target === this.summaryModal) {
                this.summaryModal.classList.remove('active');
            }
        });
    }

    updateStatusTime() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        document.getElementById('statusTime').textContent = `${hours}:${minutes}`;
    }

    updateDateDisplay() {
        const now = new Date();
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        document.getElementById('dateDisplay').textContent = now.toLocaleDateString('en-US', options);
    }

    switchTab(button) {
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        button.classList.add('active');
        const tabName = button.dataset.tab;
        document.getElementById(`${tabName}View`).classList.add('active');

        if (tabName === 'history') {
            this.renderHistory();
            this.updateChart();
        }
    }

    switchPeriod(button) {
        document.querySelectorAll('.period-button').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        this.currentPeriod = button.dataset.period;
        this.updateChart();
        this.updateHistoryStats();
    }

    async toggleTracking() {
        if (this.isTracking) {
            this.stopTracking();
        } else {
            await this.startTracking();
        }
    }

    async startTracking() {
        // Request motion permission on iOS
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission !== 'granted') {
                    alert('Motion permission is required to count steps. Please enable it in Settings.');
                    return;
                }
            } catch (error) {
                console.log('DeviceMotion permission request failed:', error);
            }
        }

        this.isTracking = true;
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.stepCount = 0;
        this.accelerationBuffer = [];

        // Update UI
        this.controlButton.classList.remove('start');
        this.controlButton.classList.add('stop');
        this.controlButton.querySelector('.button-text').textContent = 'Stop Walk';
        this.timerLabel.textContent = 'Walking...';
        this.timerLabel.classList.add('active');

        // Start timer
        this.timerInterval = setInterval(() => this.updateTimer(), 100);

        // Start step detection
        this.startStepDetection();
    }

    stopTracking() {
        this.isTracking = false;

        // Stop timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        // Stop step detection
        this.stopStepDetection();

        // Calculate final stats
        const duration = this.elapsedTime;
        const steps = this.stepCount;
        const stepsPerMinute = duration > 0 ? (steps / (duration / 60000)).toFixed(1) : 0;

        // Save walk data
        if (duration > 1000) { // Only save if walk was longer than 1 second
            this.saveWalk({
                date: new Date().toISOString(),
                duration: duration,
                steps: steps,
                stepsPerMinute: parseFloat(stepsPerMinute)
            });
        }

        // Update UI
        this.controlButton.classList.remove('stop');
        this.controlButton.classList.add('start');
        this.controlButton.querySelector('.button-text').textContent = 'Start Walk';
        this.timerLabel.textContent = 'Ready to walk';
        this.timerLabel.classList.remove('active');

        // Show summary modal
        this.showSummary(duration, steps, stepsPerMinute);

        // Reset displays
        setTimeout(() => {
            this.timerDisplay.textContent = '00:00:00';
            this.stepCountEl.textContent = '0';
            this.stepsPerMinuteEl.textContent = '0.0';
            this.updateTimerRing(0);
        }, 500);
    }

    updateTimer() {
        this.elapsedTime = Date.now() - this.startTime;

        const totalSeconds = Math.floor(this.elapsedTime / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        this.timerDisplay.textContent =
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update steps per minute
        const stepsPerMinute = this.elapsedTime > 0
            ? (this.stepCount / (this.elapsedTime / 60000)).toFixed(1)
            : 0;
        this.stepsPerMinuteEl.textContent = stepsPerMinute;

        // Update timer ring (complete circle every 60 seconds)
        const ringProgress = (totalSeconds % 60) / 60;
        this.updateTimerRing(ringProgress);
    }

    updateTimerRing(progress) {
        const circumference = 2 * Math.PI * 90; // r = 90
        const offset = circumference * (1 - progress);
        this.timerProgress.style.strokeDashoffset = offset;
    }

    startStepDetection() {
        // Use DeviceMotion API for step detection
        if (window.DeviceMotionEvent) {
            this.motionHandler = (event) => this.handleMotion(event);
            window.addEventListener('devicemotion', this.motionHandler);
        } else {
            // Fallback: simulate steps for demo purposes on desktop
            console.log('DeviceMotion not available, using simulation mode');
            this.simulateSteps();
        }
    }

    stopStepDetection() {
        if (this.motionHandler) {
            window.removeEventListener('devicemotion', this.motionHandler);
            this.motionHandler = null;
        }
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }

    handleMotion(event) {
        if (!this.isTracking) return;

        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration) return;

        // Calculate magnitude of acceleration
        const magnitude = Math.sqrt(
            Math.pow(acceleration.x || 0, 2) +
            Math.pow(acceleration.y || 0, 2) +
            Math.pow(acceleration.z || 0, 2)
        );

        // Add to buffer for smoothing
        this.accelerationBuffer.push(magnitude);
        if (this.accelerationBuffer.length > this.bufferSize) {
            this.accelerationBuffer.shift();
        }

        // Calculate average
        const avgMagnitude = this.accelerationBuffer.reduce((a, b) => a + b, 0) / this.accelerationBuffer.length;

        // Detect step based on acceleration change
        const now = Date.now();
        const deltaAcc = Math.abs(avgMagnitude - 9.8); // Deviation from gravity

        if (deltaAcc > this.stepThreshold &&
            (now - this.lastStepTime) > this.minStepInterval) {
            this.registerStep();
            this.lastStepTime = now;
        }
    }

    simulateSteps() {
        // Simulate realistic walking cadence (100-120 steps per minute)
        this.simulationInterval = setInterval(() => {
            if (this.isTracking && Math.random() > 0.1) { // 90% chance each tick
                this.registerStep();
            }
        }, 550); // ~109 steps per minute
    }

    registerStep() {
        this.stepCount++;
        this.stepCountEl.textContent = this.stepCount;

        // Add subtle haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    showSummary(duration, steps, stepsPerMinute) {
        // Format duration
        const totalSeconds = Math.floor(duration / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let durationText;
        if (hours > 0) {
            durationText = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            durationText = `${minutes} min ${seconds} sec`;
        } else {
            durationText = `${seconds} sec`;
        }

        document.getElementById('summaryDuration').textContent = durationText;
        document.getElementById('summarySteps').textContent = steps;
        document.getElementById('summaryPace').textContent = stepsPerMinute;

        this.summaryModal.classList.add('active');
    }

    saveWalk(walkData) {
        this.walks.push(walkData);
        localStorage.setItem('stepTrackerWalks', JSON.stringify(this.walks));
    }

    loadWalks() {
        const saved = localStorage.getItem('stepTrackerWalks');
        this.walks = saved ? JSON.parse(saved) : [];
    }

    deleteWalk(index) {
        this.walks.splice(index, 1);
        localStorage.setItem('stepTrackerWalks', JSON.stringify(this.walks));
        this.renderHistory();
        this.updateChart();
    }

    getFilteredWalks() {
        const now = new Date();
        let filtered = [...this.walks];

        switch (this.currentPeriod) {
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filtered = this.walks.filter(w => new Date(w.date) >= weekAgo);
                break;
            case 'month':
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                filtered = this.walks.filter(w => new Date(w.date) >= monthAgo);
                break;
            case 'all':
            default:
                break;
        }

        return filtered;
    }

    renderHistory() {
        const walks = this.getFilteredWalks();

        if (walks.length === 0) {
            this.historyList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
                    </svg>
                    <p>No walks recorded yet</p>
                    <span>Start your first walk to see your history</span>
                </div>
            `;
            return;
        }

        // Sort by date descending
        const sortedWalks = [...walks].sort((a, b) => new Date(b.date) - new Date(a.date));

        this.historyList.innerHTML = sortedWalks.map((walk, index) => {
            const date = new Date(walk.date);
            const dateStr = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            const timeStr = date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
            });

            const durationMin = Math.floor(walk.duration / 60000);
            const durationSec = Math.floor((walk.duration % 60000) / 1000);
            const durationStr = durationMin > 0
                ? `${durationMin}m ${durationSec}s`
                : `${durationSec}s`;

            const originalIndex = this.walks.findIndex(w => w.date === walk.date);

            return `
                <div class="history-item" data-index="${originalIndex}">
                    <div class="history-item-left">
                        <div class="history-item-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
                            </svg>
                        </div>
                        <div>
                            <div class="history-item-date">${dateStr}</div>
                            <div class="history-item-time">${timeStr} • ${durationStr}</div>
                        </div>
                    </div>
                    <div class="history-item-right">
                        <div class="history-item-steps">${walk.steps.toLocaleString()}</div>
                        <div class="history-item-pace">${walk.stepsPerMinute} steps/min</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers for deletion
        this.historyList.querySelectorAll('.history-item').forEach(item => {
            let touchStartX = 0;
            let touchEndX = 0;

            item.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
            });

            item.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].clientX;
                if (touchStartX - touchEndX > 100) {
                    // Swipe left - show delete
                    if (confirm('Delete this walk?')) {
                        const index = parseInt(item.dataset.index);
                        this.deleteWalk(index);
                    }
                }
            });
        });

        this.updateHistoryStats();
    }

    updateHistoryStats() {
        const walks = this.getFilteredWalks();

        if (walks.length === 0) {
            document.getElementById('avgSteps').textContent = '0';
            document.getElementById('avgPace').textContent = '0';
            document.getElementById('totalWalks').textContent = '0';
            document.getElementById('chartTotal').textContent = '0 total steps';
            return;
        }

        const totalSteps = walks.reduce((sum, w) => sum + w.steps, 0);
        const avgSteps = Math.round(totalSteps / walks.length);
        const avgPace = (walks.reduce((sum, w) => sum + w.stepsPerMinute, 0) / walks.length).toFixed(1);

        document.getElementById('avgSteps').textContent = avgSteps.toLocaleString();
        document.getElementById('avgPace').textContent = avgPace;
        document.getElementById('totalWalks').textContent = walks.length;
        document.getElementById('chartTotal').textContent = `${totalSteps.toLocaleString()} total steps`;
    }

    initChart() {
        const ctx = document.getElementById('stepsChart').getContext('2d');

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Steps',
                    data: [],
                    backgroundColor: 'rgba(52, 199, 89, 0.8)',
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1C1C1E',
                        titleColor: '#FFFFFF',
                        bodyColor: '#8E8E93',
                        borderColor: '#38383A',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        callbacks: {
                            title: (items) => {
                                const walk = this.getFilteredWalks()[items[0].dataIndex];
                                if (walk) {
                                    const date = new Date(walk.date);
                                    return date.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric'
                                    });
                                }
                                return '';
                            },
                            label: (item) => {
                                const walk = this.getFilteredWalks()[item.dataIndex];
                                if (walk) {
                                    return [
                                        `Steps: ${walk.steps.toLocaleString()}`,
                                        `Pace: ${walk.stepsPerMinute} steps/min`
                                    ];
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#8E8E93',
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#38383A'
                        },
                        ticks: {
                            color: '#8E8E93',
                            font: {
                                size: 10
                            },
                            callback: (value) => {
                                if (value >= 1000) {
                                    return (value / 1000) + 'k';
                                }
                                return value;
                            }
                        }
                    }
                }
            }
        });

        this.updateChart();
    }

    updateChart() {
        const walks = this.getFilteredWalks();

        // Sort by date ascending for chart
        const sortedWalks = [...walks].sort((a, b) => new Date(a.date) - new Date(b.date));

        const labels = sortedWalks.map(walk => {
            const date = new Date(walk.date);
            if (this.currentPeriod === 'week') {
                return date.toLocaleDateString('en-US', { weekday: 'short' });
            } else if (this.currentPeriod === 'month') {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        });

        const data = sortedWalks.map(walk => walk.steps);

        // If no data, show placeholder
        if (data.length === 0) {
            this.chart.data.labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            this.chart.data.datasets[0].data = [0, 0, 0, 0, 0, 0, 0];
        } else {
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = data;
        }

        this.chart.update();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.stepTracker = new StepTracker();
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
