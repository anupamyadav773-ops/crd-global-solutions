/* global API_BASE_URL, L */

/**
 * ==============================================================================
 * TECHNICIAN GPS LOCATION HISTORY & ROUTE TRACKING JAVASCRIPT
 * CRD Global Solutions Field Service Management
 * ==============================================================================
 */

let map = null;
let trailPolyline = null;
let milestoneMarkers = [];
let movingMarker = null;
let routeData = null;

// Playback state
let isPlaying = false;
let playbackTimer = null;
let currentPlaybackIndex = 0;
let playbackSpeed = 1;

// Default fallback coordinates (Varanasi / Sigra, India)
const DEFAULT_LAT = 25.3176;
const DEFAULT_LNG = 82.9739;

document.addEventListener("DOMContentLoaded", () => {
    // Set default date to today
    const dateInput = document.getElementById("historyDate");
    if (dateInput && !dateInput.value) {
        const todayStr = new Date().toISOString().split("T")[0];
        dateInput.value = todayStr;
    }

    initMap();
    loadHistoryData();
});

// ==========================================
// 1. MAP INITIALIZATION
// ==========================================
function initMap() {
    map = L.map("historyMap", {
        center: [DEFAULT_LAT, DEFAULT_LNG],
        zoom: 13,
        zoomControl: true
    });

    // High quality OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

// ==========================================
// 2. FETCH HISTORY & ROUTE TELEMETRY
// ==========================================
async function loadHistoryData() {
    stopPlayback();

    const empSelect = document.getElementById("technicianSelect");
    const dateInput = document.getElementById("historyDate");
    const jobFilter = document.getElementById("jobFilter");

    const empId = empSelect ? empSelect.value : "";
    const dateVal = dateInput ? dateInput.value : "";
    const jobId = jobFilter ? jobFilter.value : "all";

    const base = window.API_BASE_URL || "https://crdbilling-api.onrender.com";
    let url = `${base}/api/admin/technician-gps-history?date=${encodeURIComponent(dateVal)}`;
    if (empId) url += `&employee_id=${encodeURIComponent(empId)}`;
    if (jobId && jobId !== "all") url += `&service_job_id=${encodeURIComponent(jobId)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (data && data.success) {
            routeData = data;

            // 1. Populate technicians dropdown if not populated or only 1 item
            if (empSelect && (!empSelect.options || empSelect.options.length <= 1)) {
                populateTechniciansList(data.technicians_list, data.employee ? data.employee.id : null);
            }

            // 2. Populate jobs filter dropdown
            populateJobsFilter(data.jobs_handled);

            // 3. Update KPI stat badges
            updateKpiStats(data);

            // 4. Render Milestones in Left Drawer
            renderTimelineDrawer(data.milestones);

            // 5. Render Map Layers (Trail + Milestone Markers)
            renderMapLayers(data);

            // 6. Reset Playback Scrubber
            resetPlayback();

            // 7. Auto-fit bounds
            fitMapBounds();
        } else {
            console.error("Failed to load GPS history:", data);
            showEmptyState("No GPS Data", data.message || "Failed to retrieve location history.");
        }
    } catch (err) {
        console.error("Error fetching GPS location history:", err);
        showEmptyState("Connection Error", "Could not reach server to retrieve GPS history.");
    }
}

// ==========================================
// 3. POPULATE DROPDOWNS
// ==========================================
function populateTechniciansList(techs, selectedId) {
    const empSelect = document.getElementById("technicianSelect");
    if (!empSelect) return;

    empSelect.innerHTML = "";
    if (!techs || techs.length === 0) {
        empSelect.innerHTML = '<option value="">No Active Technicians</option>';
        return;
    }

    techs.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.full_name} (${t.employee_code || "EMP"})`;
        if (selectedId && t.id === selectedId) {
            opt.selected = true;
        }
        empSelect.appendChild(opt);
    });
}

function populateJobsFilter(jobs) {
    const jobFilter = document.getElementById("jobFilter");
    if (!jobFilter) return;

    const currentVal = jobFilter.value;
    jobFilter.innerHTML = '<option value="all">All Jobs & Milestones</option>';

    if (jobs && jobs.length > 0) {
        jobs.forEach(j => {
            const opt = document.createElement("option");
            opt.value = j.id;
            opt.textContent = `#${j.service_number || j.id} - ${j.customer_name || "Customer"}`;
            if (currentVal && currentVal == j.id) {
                opt.selected = true;
            }
            jobFilter.appendChild(opt);
        });
    }
}

function onTechnicianChanged() {
    loadHistoryData();
}

function onJobFilterChanged() {
    loadHistoryData();
}

// ==========================================
// 4. KPI STATS UPDATE
// ==========================================
function updateKpiStats(data) {
    const s = data.summary || {};
    
    const distEl = document.getElementById("statDistance");
    const pingsEl = document.getElementById("statPings");
    const milesEl = document.getElementById("statMilestones");
    const speedEl = document.getElementById("statSpeed");
    const windowEl = document.getElementById("statWindow");

    if (distEl) distEl.textContent = `${s.total_distance_km || 0.0} km`;
    if (pingsEl) pingsEl.textContent = s.total_points || 0;
    if (milesEl) milesEl.textContent = `${s.total_milestones || 0} / 5`;
    if (speedEl) speedEl.textContent = `${s.max_speed_kmh || 0} km/h`;
    
    if (windowEl) {
        if (s.first_ping_time && s.first_ping_time !== "--:--") {
            windowEl.textContent = `${s.first_ping_time} - ${s.last_ping_time || ""}`;
        } else {
            windowEl.textContent = "No Activity";
        }
    }

    const countBadge = document.getElementById("milestoneCountBadge");
    if (countBadge) {
        countBadge.textContent = `${(data.milestones || []).length} Checkpoints`;
    }
}

// ==========================================
// 5. TIMELINE DRAWER RENDERING
// ==========================================
function renderTimelineDrawer(milestones) {
    const container = document.getElementById("timelineContainer");
    if (!container) return;

    if (!milestones || milestones.length === 0) {
        showEmptyState("No Milestones Recorded", "No check-ins, job visits, or route milestones recorded on this date.");
        return;
    }

    let html = '<ul class="timeline-list">';

    milestones.forEach((m, idx) => {
        let itemClass = "check-in";
        let tagClass = "tag-green";
        let tagText = "Check-in";

        switch (m.type) {
            case "CHECK_IN":
                itemClass = "check-in";
                tagClass = "tag-green";
                tagText = "Punch In";
                break;
            case "JOB_LOCATION":
                itemClass = "job-loc";
                tagClass = "tag-blue";
                tagText = "Destination";
                break;
            case "ON_THE_WAY":
                itemClass = "on-the-way";
                tagClass = "tag-orange";
                tagText = "On The Way";
                break;
            case "REACHED":
                itemClass = "reached";
                tagClass = "tag-purple";
                tagText = "Reached Site";
                break;
            case "COMPLETION":
                itemClass = "completion";
                tagClass = "tag-emerald";
                tagText = "Completed";
                break;
            case "CHECK_OUT":
                itemClass = "check-out";
                tagClass = "tag-red";
                tagText = "Punch Out";
                break;
        }

        let metaHtml = "";
        if (m.customer_name) {
            metaHtml += `<span>👤 ${escapeHtml(m.customer_name)}</span>`;
        }
        if (m.customer_mobile) {
            metaHtml += `<span>📞 ${escapeHtml(m.customer_mobile)}</span>`;
        }
        if (m.rating) {
            metaHtml += `<span class="rating-badge">★ ${m.rating}/5</span>`;
        }
        if (m.working_minutes) {
            metaHtml += `<span>⏱️ ${Math.round(m.working_minutes / 60 * 10) / 10} hrs</span>`;
        }

        html += `
            <li class="timeline-item ${itemClass}" onclick="focusMilestone(${idx})" id="timelineItem-${idx}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-top">
                        <span class="milestone-tag ${tagClass}">${tagText}</span>
                        <span class="milestone-time">${escapeHtml(m.time_str || "")}</span>
                    </div>
                    <div class="milestone-title">${escapeHtml(m.title || "")}</div>
                    <div class="milestone-address">
                        <span>📍</span>
                        <span>${escapeHtml(m.address || "Location pinned on map")}</span>
                    </div>
                    ${metaHtml ? `<div class="milestone-meta">${metaHtml}</div>` : ""}
                </div>
            </li>
        `;
    });

    html += "</ul>";
    container.innerHTML = html;
}

function showEmptyState(title, desc) {
    const container = document.getElementById("timelineContainer");
    if (!container) return;
    container.innerHTML = `
        <div class="history-empty-state">
            <div class="empty-icon">🗺️</div>
            <div class="empty-title">${escapeHtml(title)}</div>
            <div class="empty-desc">${escapeHtml(desc)}</div>
            <button class="btn-demo-action" onclick="simulateSampleRoute()">⚡ Simulate Sample Route</button>
        </div>
    `;
}

// ==========================================
// 6. MAP LAYERS & MARKERS
// ==========================================
function renderMapLayers(data) {
    // Clear existing markers & polyline
    if (trailPolyline) {
        map.removeLayer(trailPolyline);
        trailPolyline = null;
    }
    milestoneMarkers.forEach(m => map.removeLayer(m));
    milestoneMarkers = [];

    if (movingMarker) {
        map.removeLayer(movingMarker);
        movingMarker = null;
    }

    const trail = data.trail || [];
    const milestones = data.milestones || [];

    // 1. Draw continuous route polyline
    if (trail.length >= 2) {
        const latLngs = trail.map(pt => [pt.lat, pt.lng]);
        trailPolyline = L.polyline(latLngs, {
            color: "#2563eb",
            weight: 5,
            opacity: 0.85,
            lineJoin: "round",
            dashArray: null
        }).addTo(map);
    }

    // 2. Add milestone markers
    milestones.forEach((m, idx) => {
        if (!m.latitude || !m.longitude) return;

        let iconBg = "bg-check-in";
        let iconSymbol = "🟢";

        switch (m.type) {
            case "CHECK_IN":
                iconBg = "bg-check-in";
                iconSymbol = "🟢";
                break;
            case "JOB_LOCATION":
                iconBg = "bg-job-loc";
                iconSymbol = "🏢";
                break;
            case "ON_THE_WAY":
                iconBg = "bg-on-the-way";
                iconSymbol = "🛵";
                break;
            case "REACHED":
                iconBg = "bg-reached";
                iconSymbol = "📍";
                break;
            case "COMPLETION":
                iconBg = "bg-completion";
                iconSymbol = "🏁";
                break;
            case "CHECK_OUT":
                iconBg = "bg-check-out";
                iconSymbol = "🔴";
                break;
        }

        const customIcon = L.divIcon({
            className: "custom-milestone-marker",
            html: `<div class="milestone-icon-inner ${iconBg}">${iconSymbol}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18]
        });

        const popupContent = `
            <div style="font-family: inherit; font-size: 13px; min-width: 180px;">
                <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">${escapeHtml(m.title)}</div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">⏰ ${escapeHtml(m.time_str || m.timestamp || "")}</div>
                <div style="font-size: 12px; color: #334155; margin-bottom: 6px;">📍 ${escapeHtml(m.address || "")}</div>
                ${m.customer_name ? `<div style="font-size: 11px; color: #2563eb;">Customer: <b>${escapeHtml(m.customer_name)}</b></div>` : ""}
                ${m.rating ? `<div style="font-size: 11px; color: #eab308; font-weight: bold;">Rating: ★ ${m.rating}/5</div>` : ""}
                ${m.details ? `<div style="font-size: 11px; color: #475569; margin-top: 4px;">${escapeHtml(m.details)}</div>` : ""}
            </div>
        `;

        const marker = L.marker([m.latitude, m.longitude], { icon: customIcon })
            .bindPopup(popupContent)
            .addTo(map);

        marker.milestoneIndex = idx;
        marker.on("click", () => highlightTimelineItem(idx));
        milestoneMarkers.push(marker);
    });

    // 3. Create playback moving scooter marker
    if (trail.length > 0) {
        const startPt = trail[0];
        const scooterIcon = L.divIcon({
            className: "playback-scooter-marker",
            html: `🛵`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        movingMarker = L.marker([startPt.lat, startPt.lng], {
            icon: scooterIcon,
            zIndexOffset: 1000
        }).addTo(map);
    }
}

// ==========================================
// 7. TIMELINE FOCUS & MAP CENTERING
// ==========================================
function focusMilestone(idx) {
    if (!routeData || !routeData.milestones) return;
    const m = routeData.milestones[idx];
    if (!m || !m.latitude || !m.longitude) return;

    map.setView([m.latitude, m.longitude], 16, { animate: true });

    if (milestoneMarkers[idx]) {
        milestoneMarkers[idx].openPopup();
    }

    highlightTimelineItem(idx);
}

function highlightTimelineItem(idx) {
    document.querySelectorAll(".timeline-item").forEach(item => item.classList.remove("active"));
    const el = document.getElementById(`timelineItem-${idx}`);
    if (el) {
        el.classList.add("active");
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function fitMapBounds() {
    if (!map) return;

    const group = [];
    if (milestoneMarkers.length > 0) {
        milestoneMarkers.forEach(m => group.push(m.getLatLng()));
    }
    if (trailPolyline) {
        group.push(...trailPolyline.getLatLngs());
    }

    if (group.length > 0) {
        map.fitBounds(L.latLngBounds(group), { padding: [50, 50], maxZoom: 16 });
    } else {
        map.setView([DEFAULT_LAT, DEFAULT_LNG], 13);
    }
}

// ==========================================
// 8. ROUTE PLAYBACK ENGINE
// ==========================================
function resetPlayback() {
    stopPlayback();
    currentPlaybackIndex = 0;
    const slider = document.getElementById("playbackSlider");
    const timeDisplay = document.getElementById("playbackTimeDisplay");

    const trail = routeData ? (routeData.trail || []) : [];
    if (slider) {
        slider.min = 0;
        slider.max = Math.max(0, trail.length - 1);
        slider.value = 0;
    }

    if (timeDisplay) {
        timeDisplay.textContent = trail.length > 0 ? (trail[0].time_short || "--:--") : "--:--";
    }

    if (movingMarker && trail.length > 0) {
        movingMarker.setLatLng([trail[0].lat, trail[0].lng]);
    }
}

function togglePlayback() {
    if (!routeData || !routeData.trail || routeData.trail.length === 0) return;

    if (isPlaying) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    if (!routeData || !routeData.trail || routeData.trail.length === 0) return;

    isPlaying = true;
    updatePlayIcon(true);

    const trail = routeData.trail;
    if (currentPlaybackIndex >= trail.length - 1) {
        currentPlaybackIndex = 0;
    }

    const intervalMs = Math.max(100, Math.floor(800 / playbackSpeed));

    playbackTimer = setInterval(() => {
        currentPlaybackIndex++;
        if (currentPlaybackIndex >= trail.length) {
            stopPlayback();
            currentPlaybackIndex = trail.length - 1;
            return;
        }

        applyPlaybackStep(currentPlaybackIndex);
    }, intervalMs);
}

function stopPlayback() {
    isPlaying = false;
    updatePlayIcon(false);
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
}

function updatePlayIcon(running) {
    const icon = document.getElementById("playIcon");
    if (icon) {
        icon.textContent = running ? "⏸" : "▶";
    }
}

function applyPlaybackStep(idx) {
    const trail = routeData ? (routeData.trail || []) : [];
    if (!trail[idx]) return;

    const pt = trail[idx];
    const slider = document.getElementById("playbackSlider");
    const timeDisplay = document.getElementById("playbackTimeDisplay");

    if (slider) slider.value = idx;
    if (timeDisplay) timeDisplay.textContent = pt.time_short || pt.time || "--:--";

    if (movingMarker) {
        movingMarker.setLatLng([pt.lat, pt.lng]);
    }
}

function onScrubPlayback(value) {
    stopPlayback();
    currentPlaybackIndex = parseInt(value, 10) || 0;
    applyPlaybackStep(currentPlaybackIndex);
}

function setPlaybackSpeed(speed, btn) {
    playbackSpeed = speed;
    document.querySelectorAll(".speed-chip").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");

    if (isPlaying) {
        stopPlayback();
        startPlayback();
    }
}

// ==========================================
// 9. SIMULATE DEMO ROUTE
// ==========================================
async function simulateSampleRoute() {
    const empSelect = document.getElementById("technicianSelect");
    const dateInput = document.getElementById("historyDate");

    const empId = empSelect ? empSelect.value : "";
    const dateVal = dateInput ? dateInput.value : "";

    if (!empId) {
        alert("Please select a technician first to simulate a demo route.");
        return;
    }

    const confirmSim = confirm("This will generate a realistic Varanasi sample field route (Punch-in, Travel, 5 Milestones, Punch-out) for demonstration. Proceed?");
    if (!confirmSim) return;

    try {
        const base = window.API_BASE_URL || "https://crdbilling-api.onrender.com";
        const res = await fetch(`${base}/api/admin/technician-gps-history/simulate-route`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee_id: empId,
                date: dateVal
            })
        });

        const data = await res.json();
        if (data && data.success) {
            alert(data.message || "Sample route simulated successfully!");
            loadHistoryData();
        } else {
            alert(data.message || "Failed to simulate route.");
        }
    } catch (err) {
        console.error("Simulation error:", err);
        alert("Server error while simulating demo route.");
    }
}

// Helper: Escape HTML
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


