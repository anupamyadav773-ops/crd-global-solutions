/* global API_BASE_URL, L */

/**
 * ==============================================================================
 * TECHNICIAN LIVE MAP TRACKING JAVASCRIPT
 * Real-time Multi-Technician GPS Visualization with Leaflet & OpenStreetMap
 * ==============================================================================
 */

let map = null;
let markersMap = {};
let officeMarker = null;
let officeCircle = null;

let techniciansData = [];
let officeData = null;
let currentFilter = "all";
let searchTerm = "";
let selectedEmployeeId = null;

let autoRefreshTimer = null;
let autoRefreshSecs = 20;
let isAutoRefreshOn = true;
let isFirstLoad = true;

// Default fallback coords (Varanasi / UP, India)
const DEFAULT_LAT = 25.3176;
const DEFAULT_LNG = 82.9739;

document.addEventListener("DOMContentLoaded", () => {
    initMap();
    loadLiveLocations(false);
    startAutoRefresh();
});

// ==========================================
// 1. MAP INITIALIZATION
// ==========================================
function initMap() {
    map = L.map("liveMap", {
        center: [DEFAULT_LAT, DEFAULT_LNG],
        zoom: 12,
        zoomControl: true
    });

    // High quality OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

// ==========================================
// 2. FETCH LIVE LOCATIONS & TELEMETRY
// ==========================================
async function loadLiveLocations(isManual = false) {
    const liveIndicator = document.getElementById("liveStatusText");
    if (liveIndicator) liveIndicator.innerText = "Fetching...";

    try {
        const base = window.API_BASE_URL || "https://paribilling-api.onrender.com";
        const res = await fetch(`${base}/api/technicians/live-locations`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (data && data.success) {
            techniciansData = data.technicians || [];
            officeData = data.office_geofence || null;

            // Update KPI badges
            updateStatsStrip(data);

            // Render office & technician markers on map
            updateMapLayers();

            // Render cards in the left drawer
            renderDrawerCards();

            if (isFirstLoad) {
                isFirstLoad = false;
                fitAllMarkers();
            }

            if (liveIndicator) liveIndicator.innerText = "Live Monitoring";
        } else {
            console.error("API error response:", data);
            if (liveIndicator) liveIndicator.innerText = "Sync Failed";
        }
    } catch (err) {
        console.error("Error loading live technician locations:", err);
        if (liveIndicator) liveIndicator.innerText = "Offline / Retrying";
    }
}

// ==========================================
// 3. STATS STRIP UPDATES
// ==========================================
function updateStatsStrip(data) {
    const totalEl = document.getElementById("statTotalTechs");
    const activeEl = document.getElementById("statActiveJobs");
    const onDutyEl = document.getElementById("statOnDuty");
    const offlineEl = document.getElementById("statOffline");

    const total = techniciansData.length;
    const active = techniciansData.filter(t => t.active_job_status === "Travel" || t.active_job_status === "In Progress").length;
    const onDuty = techniciansData.filter(t => t.attendance_status === "Present" && !t.check_out_time && (!t.active_job_status || t.active_job_status === "Assigned")).length;
    const offline = total - (active + onDuty);

    if (totalEl) totalEl.innerText = total;
    if (activeEl) activeEl.innerText = active;
    if (onDutyEl) onDutyEl.innerText = onDuty;
    if (offlineEl) offlineEl.innerText = Math.max(0, offline);
}

// ==========================================
// 4. MAP LAYERS & MARKERS
// ==========================================
function updateMapLayers() {
    if (!map) return;

    // 1. Office / Workshop Marker & Geofence Circle
    if (officeData && officeData.latitude && officeData.longitude) {
        const offLat = parseFloat(officeData.latitude);
        const offLng = parseFloat(officeData.longitude);
        const radius = parseInt(officeData.radius_meters || 100);

        if (!officeMarker) {
            const officeIcon = L.divIcon({
                className: "custom-tech-marker",
                html: `
                    <div class="office-marker-pin" title="${escapeHtml(officeData.office_name || 'Main Office')}">
                        🏬
                    </div>
                `,
                iconSize: [44, 44],
                iconAnchor: [22, 22]
            });

            officeMarker = L.marker([offLat, offLng], { icon: officeIcon }).addTo(map);
            officeMarker.bindPopup(`
                <div class="tech-popup-card">
                    <div class="popup-header" style="background:#dc2626;">
                        <h4>🏬 ${escapeHtml(officeData.office_name || 'Main Office / Workshop')}</h4>
                    </div>
                    <div class="popup-body">
                        <div class="popup-row">📍 <strong>Address:</strong> ${escapeHtml(officeData.office_address || 'CRD Global Solutions')}</div>
                        <div class="popup-row">⭕ <strong>Geofence Radius:</strong> ${radius} meters</div>
                        <div class="popup-row">🛡️ <strong>Attendance Lock:</strong> ${officeData.is_active ? 'Active' : 'Disabled'}</div>
                    </div>
                </div>
            `);
        } else {
            officeMarker.setLatLng([offLat, offLng]);
        }

        // Draw / update geofence circle
        if (!officeCircle) {
            officeCircle = L.circle([offLat, offLng], {
                radius: radius,
                color: "#dc2626",
                fillColor: "#ef4444",
                fillOpacity: 0.12,
                weight: 2,
                dashArray: "4, 6"
            }).addTo(map);
        } else {
            officeCircle.setLatLng([offLat, offLng]);
            officeCircle.setRadius(radius);
        }
    }

    // 2. Track existing marker IDs to remove stale ones
    const currentEmpIds = new Set();

    techniciansData.forEach(tech => {
        if (!tech.has_location) return;

        const lat = parseFloat(tech.latitude);
        const lng = parseFloat(tech.longitude);
        const empId = tech.employee_id;
        currentEmpIds.add(empId);

        // Determine icon pin color & emoji
        let pinClass = "pin-blue";
        let emoji = "👷";
        if (tech.active_job_status === "Travel") {
            pinClass = "pin-yellow";
            emoji = "🛵";
        } else if (tech.active_job_status === "In Progress") {
            pinClass = "pin-green";
            emoji = "🔧";
        } else if (tech.attendance_status === "Present" && !tech.check_out_time) {
            pinClass = "pin-blue";
            emoji = "🟢";
        } else {
            pinClass = "pin-gray";
            emoji = "⚪";
        }

        const firstName = (tech.full_name || "Tech").split(" ")[0];

        const customIcon = L.divIcon({
            className: "custom-tech-marker",
            html: `
                <div class="tech-marker-pin ${pinClass}" id="marker-pin-${empId}">
                    <span>${emoji}</span>
                    <span class="tech-marker-label">${escapeHtml(firstName)}</span>
                </div>
            `,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            popupAnchor: [0, -22]
        });

        // Popup content
        const popupHtml = buildTechPopupHtml(tech);

        if (markersMap[empId]) {
            // Update position smoothly
            markersMap[empId].setLatLng([lat, lng]);
            markersMap[empId].setIcon(customIcon);
            markersMap[empId].setPopupContent(popupHtml);
        } else {
            // Create new marker
            const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
            marker.bindPopup(popupHtml);
            marker.on("click", () => {
                selectTechnicianCard(empId, false);
            });
            markersMap[empId] = marker;
        }
    });

    // Remove markers that are no longer online / active
    Object.keys(markersMap).forEach(id => {
        const numId = parseInt(id);
        if (!currentEmpIds.has(numId)) {
            map.removeLayer(markersMap[numId]);
            delete markersMap[numId];
        }
    });
}

// ==========================================
// 5. POPUP BUILDER
// ==========================================
function buildTechPopupHtml(tech) {
    const badgeClass = getBadgeClass(tech.status_color);
    const lastTime = formatTimeAgo(tech.last_location_time);

    let jobHtml = "";
    if (tech.active_job_number) {
        jobHtml = `
            <div class="popup-job-box">
                <div style="font-weight:700; color:#0284c7; margin-bottom:3px;">
                    📋 Job #${escapeHtml(tech.active_job_number)}
                </div>
                <div><strong>Customer:</strong> ${escapeHtml(tech.active_job_customer || "Customer")}</div>
                ${tech.active_job_address ? `<div><strong>Address:</strong> ${escapeHtml(tech.active_job_address)}</div>` : ""}
                ${tech.active_job_complaint ? `<div><strong>Issue:</strong> ${escapeHtml(tech.active_job_complaint)}</div>` : ""}
            </div>
        `;
    }

    const phoneLink = tech.phone ? `<a href="tel:${tech.phone}" class="popup-btn popup-btn-call">📞 Call Tech</a>` : "";

    return `
        <div class="tech-popup-card">
            <div class="popup-header">
                <div>
                    <h4>${escapeHtml(tech.full_name)}</h4>
                    <span style="font-size:0.75rem; color:#94a3b8;">${escapeHtml(tech.employee_code || '')} • ${escapeHtml(tech.designation || 'Technician')}</span>
                </div>
                <span class="tech-status-badge ${badgeClass}">${escapeHtml(tech.status_badge || 'Active')}</span>
            </div>
            <div class="popup-body">
                ${jobHtml}
                <div class="popup-row">
                    🔋 <strong>Battery:</strong> ${tech.battery_level !== null && tech.battery_level !== undefined ? `${tech.battery_level}%` : 'N/A'}
                    <span style="margin: 0 6px; color:#cbd5e1;">|</span>
                    ⚡ <strong>Speed:</strong> ${tech.speed_kmh ? `${tech.speed_kmh} km/h` : '0 km/h'}
                </div>
                <div class="popup-row">
                    ⏱️ <strong>Last Ping:</strong> ${lastTime}
                </div>
                <div class="popup-actions">
                    ${phoneLink}
                    <a href="technician-schedule.html" class="popup-btn popup-btn-schedule">📅 Schedule</a>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// 6. LEFT DRAWER CARDS RENDERING
// ==========================================
function renderDrawerCards() {
    const container = document.getElementById("techCardsList");
    if (!container) return;

    // Filter technicians
    let filtered = techniciansData.filter(tech => {
        // Status filter
        if (currentFilter === "active") {
            if (tech.active_job_status !== "Travel" && tech.active_job_status !== "In Progress") return false;
        } else if (currentFilter === "onduty") {
            if (tech.attendance_status !== "Present" || tech.check_out_time || tech.active_job_status === "Travel" || tech.active_job_status === "In Progress") return false;
        } else if (currentFilter === "offline") {
            if (tech.has_location && tech.attendance_status === "Present" && !tech.check_out_time) return false;
        }

        // Search term
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            const name = (tech.full_name || "").toLowerCase();
            const phone = (tech.phone || "").toLowerCase();
            const code = (tech.employee_code || "").toLowerCase();
            const job = (tech.active_job_number || "").toLowerCase();
            if (!name.includes(q) && !phone.includes(q) && !code.includes(q) && !job.includes(q)) {
                return false;
            }
        }
        return true;
    });

    const countBadge = document.getElementById("visibleTechCount");
    if (countBadge) countBadge.innerText = `${filtered.length} Showing`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="tech-drawer-empty">
                <div style="font-size:2rem; margin-bottom:8px;">🔍</div>
                <p>No technicians match the current filter or search criteria.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(tech => {
        const isSelected = tech.employee_id === selectedEmployeeId ? "selected" : "";
        const badgeClass = getBadgeClass(tech.status_color);
        const lastTime = formatTimeAgo(tech.last_location_time);

        let jobChip = "";
        if (tech.active_job_number) {
            jobChip = `
                <div class="tech-job-chip">
                    <strong>#${escapeHtml(tech.active_job_number)}</strong>: ${escapeHtml(tech.active_job_customer || "Customer")}
                    ${tech.active_job_address ? `<div style="color:#64748b; font-size:0.72rem; margin-top:2px;">📍 ${escapeHtml(tech.active_job_address)}</div>` : ""}
                </div>
            `;
        }

        return `
            <div class="tech-card ${isSelected}" id="card-emp-${tech.employee_id}" onclick="flyToTechnician(${tech.employee_id})">
                <div class="tech-card-header">
                    <div>
                        <span class="tech-card-name">${escapeHtml(tech.full_name)}</span>
                        <span class="tech-card-code">${escapeHtml(tech.employee_code || '')}</span>
                    </div>
                    <span class="tech-status-badge ${badgeClass}">${escapeHtml(tech.status_badge || 'Offline')}</span>
                </div>

                ${jobChip}

                <div class="tech-telemetry-row">
                    <span class="telemetry-item">
                        ${tech.has_location ? '📍 Live GPS' : '⚠️ No Signal'}
                    </span>
                    <span class="telemetry-item">
                        🔋 ${tech.battery_level !== null && tech.battery_level !== undefined ? `${tech.battery_level}%` : '--'}
                    </span>
                    <span class="telemetry-item">
                        ⚡ ${tech.speed_kmh ? `${tech.speed_kmh} km/h` : '0 km/h'}
                    </span>
                    <span class="telemetry-item">
                        ⏱️ ${lastTime}
                    </span>
                </div>
            </div>
        `;
    }).join("");
}

// ==========================================
// 7. CAMERA & NAVIGATION CONTROLS
// ==========================================
function flyToTechnician(empId) {
    selectTechnicianCard(empId, true);
}

function selectTechnicianCard(empId, triggerFly = true) {
    selectedEmployeeId = empId;

    // Update UI card highlight
    document.querySelectorAll(".tech-card").forEach(el => el.classList.remove("selected"));
    const cardEl = document.getElementById(`card-emp-${empId}`);
    if (cardEl) {
        cardEl.classList.add("selected");
        cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Pan map & open popup
    const marker = markersMap[empId];
    if (marker && map) {
        if (triggerFly) {
            map.flyTo(marker.getLatLng(), 16, {
                animate: true,
                duration: 1.2
            });
        }
        marker.openPopup();
    } else {
        const tech = techniciansData.find(t => t.employee_id === empId);
        if (tech && !tech.has_location) {
            alert(`Location unavailable for ${tech.full_name}.\nDevice has not reported recent GPS coordinates.`);
        }
    }
}

function focusOnOffice() {
    if (!officeData || !officeData.latitude || !officeData.longitude || !map) {
        alert("Office location is not configured yet in Geofence Settings.");
        return;
    }
    const offLat = parseFloat(officeData.latitude);
    const offLng = parseFloat(officeData.longitude);
    map.flyTo([offLat, offLng], 15, { animate: true, duration: 1.0 });
    if (officeMarker) officeMarker.openPopup();
}

function fitAllMarkers() {
    if (!map) return;
    const latLngs = [];

    if (officeData && officeData.latitude && officeData.longitude) {
        latLngs.push([parseFloat(officeData.latitude), parseFloat(officeData.longitude)]);
    }

    techniciansData.forEach(t => {
        if (t.has_location) {
            latLngs.push([parseFloat(t.latitude), parseFloat(t.longitude)]);
        }
    });

    if (latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } else {
        map.setView([DEFAULT_LAT, DEFAULT_LNG], 12);
    }
}

function toggleFullscreenMap() {
    const elem = document.querySelector(".map-workspace-layout");
    if (!document.fullscreenElement) {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// ==========================================
// 8. FILTERS & SEARCH
// ==========================================
function filterByStatus(status) {
    currentFilter = status;

    // Update tab UI
    document.querySelectorAll(".drawer-tabs .tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-filter") === status);
    });

    // Update KPI pills UI
    document.querySelectorAll(".map-stats-strip .stat-pill").forEach(pill => pill.classList.remove("active"));
    if (status === "all") document.getElementById("pillAll")?.classList.add("active");
    if (status === "active") document.getElementById("pillActive")?.classList.add("active");
    if (status === "onduty") document.getElementById("pillOnDuty")?.classList.add("active");
    if (status === "offline") document.getElementById("pillOffline")?.classList.add("active");

    renderDrawerCards();
}

function onSearchChanged() {
    const input = document.getElementById("techSearchInput");
    searchTerm = input ? input.value.trim() : "";
    renderDrawerCards();
}

// ==========================================
// 9. AUTO-REFRESH TIMER
// ==========================================
function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
        if (isAutoRefreshOn) {
            loadLiveLocations(false);
        }
    }, autoRefreshSecs * 1000);
}

function toggleAutoRefresh() {
    isAutoRefreshOn = !isAutoRefreshOn;
    const btn = document.getElementById("autoRefreshBtn");
    const label = document.getElementById("autoRefreshLabel");

    if (isAutoRefreshOn) {
        if (btn) btn.className = "btn btn-secondary btn-sm";
        if (label) label.innerText = `${autoRefreshSecs}s`;
        startAutoRefresh();
    } else {
        if (btn) btn.className = "btn btn-outline btn-sm";
        if (label) label.innerText = "OFF";
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
    }
}

// ==========================================
// 10. UTILITY HELPERS
// ==========================================
function getBadgeClass(color) {
    if (color === "success") return "badge-success";
    if (color === "warning") return "badge-warning";
    if (color === "info") return "badge-info";
    if (color === "secondary") return "badge-secondary";
    return "badge-dark";
}

function formatTimeAgo(timeStr) {
    if (!timeStr) return "N/A";
    try {
        const time = new Date(timeStr);
        if (isNaN(time.getTime())) return String(timeStr).substring(11, 16) || "Today";
        const diffSecs = Math.floor((new Date() - time) / 1000);
        if (diffSecs < 60) return "Just now";
        const diffMins = Math.floor(diffSecs / 60);
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return time.toLocaleDateString();
    } catch (e) {
        return "Recent";
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

