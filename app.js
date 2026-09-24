(function () {
  "use strict";

  // Auth check
  const token = localStorage.getItem("routeai_token");
  const userRaw = localStorage.getItem("routeai_user");
  if (!token || !userRaw) {
    window.location.href = "index.html";
    return;
  }
  let currentUser = JSON.parse(userRaw);

  const ROUTE_COLORS = ["#16a34a", "#2563eb", "#a855f7", "#ea580c", "#0891b2"];
  const ROUTE_COLORS_BLOCKED = ["#dc2626", "#f87171", "#b91c1c", "#ef4444", "#991b1b"];

  const state = {
    map: null,
    userMarker: null,
    sourceMarker: null,
    destMarker: null,
    routeLayers: [],       // all drawn route polylines
    photoMarkers: [],
    currentPos: null,
    source: null,
    destination: null,
    isTracking: true,
    watchId: null,
    photos: [],
    activeSearch: null,
    lastAnalysis: null,
    allRoutes: [],         // { coordinates, distance, duration, analysis, color, index }
    selectedRouteIndex: 0
  };

  const DEMO_PLACES = [
    { name: "Guwahati", lat: 26.1445, lng: 91.7362, state: "Assam" },
    { name: "Silchar", lat: 24.8333, lng: 92.7789, state: "Assam" },
    { name: "Agartala", lat: 23.8315, lng: 91.2868, state: "Tripura" },
    { name: "Aizawl", lat: 23.7271, lng: 92.7176, state: "Mizoram" },
    { name: "Imphal", lat: 24.8170, lng: 93.9368, state: "Manipur" },
    { name: "Kohima", lat: 25.6751, lng: 94.1086, state: "Nagaland" },
    { name: "Dimapur", lat: 25.9045, lng: 93.7266, state: "Nagaland" },
    { name: "Shillong", lat: 25.5788, lng: 91.8933, state: "Meghalaya" },
    { name: "Jorhat", lat: 26.7509, lng: 94.2037, state: "Assam" },
    { name: "Dibrugarh", lat: 27.4728, lng: 94.9120, state: "Assam" },
    { name: "Tezpur", lat: 26.6338, lng: 92.8000, state: "Assam" },
    { name: "Itanagar", lat: 27.0844, lng: 93.6053, state: "Arunachal" },
    { name: "Churachandpur", lat: 24.3333, lng: 93.6833, state: "Manipur" },
    { name: "Lunglei", lat: 22.8840, lng: 92.7390, state: "Mizoram" },
    { name: "Karimganj", lat: 24.8680, lng: 92.3550, state: "Assam" },
    { name: "Hailakandi", lat: 24.6840, lng: 92.5610, state: "Assam" },
    { name: "Nagaon", lat: 26.3500, lng: 92.6830, state: "Assam" },
    { name: "Tura", lat: 25.5140, lng: 90.2020, state: "Meghalaya" },
    { name: "Mokokchung", lat: 26.3220, lng: 94.5120, state: "Nagaland" },
    { name: "Thoubal", lat: 24.6390, lng: 94.0100, state: "Manipur" }
  ];

  const $ = (s) => document.querySelector(s);
  const sourceInput = $("#source-input");
  const destInput = $("#destination-input");
  const sourceSugg = $("#source-suggestions");
  const destSugg = $("#dest-suggestions");
  const sourceClear = $("#source-clear");
  const destClear = $("#dest-clear");
  const useMyLocBtn = $("#use-my-location");
  const calcRouteBtn = $("#calc-route-btn");
  const openPlanBtn = $("#open-plan-btn");
  const closePlanner = $("#close-planner");
  const plannerPanel = $("#route-planner-panel");
  const homeRouteSummary = $("#home-route-summary");
  const uploadBtn = $("#upload-photo-btn");
  const centerBtn = $("#center-me-btn");
  const trackBtn = $("#toggle-track-btn");
  const showAnalysisBtn = $("#show-analysis-btn");
  const showRoutesBtn = $("#show-routes-btn");
  const closeAnalysis = $("#close-analysis");
  const closeRoutes = $("#close-routes");
  const analysisPanel = $("#analysis-panel");
  const routesPanel = $("#routes-panel");
  const routesList = $("#routes-list");
  const routeStatus = $("#route-status");
  const routeInfo = $("#route-info");
  const sourceLocEl = $("#source-loc");
  const destLocEl = $("#dest-loc");
  const gpsStatus = $("#gps-status");
  const userBadge = $("#user-badge");
  const logoutBtn = $("#logout-btn");
  const uploadModal = $("#upload-modal");
  const photoInput = $("#photo-input");
  const photoPreview = $("#photo-preview");
  const previewCont = $("#preview-container");
  const photoDesc = $("#photo-desc");
  const useGpsCheck = $("#use-current-gps");
  const confirmUpload = $("#confirm-upload");
  const cancelUpload = $("#cancel-upload");
  const toastEl = $("#toast");
  const uploadHint = $("#upload-hint");
  const networkBanner = $("#network-banner");
  const quickReportBtn = $("#quick-report-btn");
  const quickReportModal = $("#quick-report-modal");
  const cancelQuickReport = $("#cancel-quick-report");
  const saveQuickReport = $("#save-quick-report");
  const incidentType = $("#incident-type");
  const incidentSeverity = $("#incident-severity");
  const incidentNote = $("#incident-note");
  const incidentGps = $("#incident-gps");
  const offlineDataBtn = $("#offline-data-btn");
  const savedDataPanel = $("#saved-data-panel");
  const closeSavedData = $("#close-saved-data");
  const pendingCount = $("#pending-count");
  const cachedCount = $("#cached-count");
  const connectionValue = $("#connection-value");
  const savedDataList = $("#saved-data-list");
  const myUploadSearch = $("#my-upload-search");
  const showMyUploadsBtn = $("#show-my-uploads");
  const showAllUploadsBtn = $("#show-all-uploads");
  const deleteSelectedUploadsBtn = $("#delete-selected-uploads");
  let uploadViewMode = "mine";
  const syncNowBtn = $("#sync-now-btn");
  const syncMiniStatus = $("#sync-mini-status");
  const incidentPhoto = $("#incident-photo");
  const incidentPhotoName = $("#incident-photo-name");

  const OFFLINE_DB = "routeai-offline-v2";
  const OFFLINE_STORE = "reports";
  const ROUTE_CACHE_KEY = "routeai_route_cache_v2";
  let dbPromise = null;

  function init() {
    userBadge.textContent = `${currentUser.name} (${currentUser.role})`;
    if (currentUser.role === "admin") userBadge.classList.add("official");
    quickReportBtn.style.display = "";
    uploadBtn.style.display = "";
    document.getElementById("offline-hint").textContent = "Your reports can be saved offline and synced later";
    uploadHint.textContent = "Your upload is linked to your account. You can delete only your own uploads.";

    initMap();
    loadPhotos();
    startTracking();
    bindEvents();
    updateNetworkUI();
    refreshOfflinePanel();
    window.addEventListener("online", () => { updateNetworkUI(); syncOfflineReports(); });
    window.addEventListener("offline", updateNetworkUI);
    if (incidentPhoto) incidentPhoto.addEventListener("change", () => { incidentPhotoName.textContent = incidentPhoto.files?.[0]?.name || "No photo selected"; });
    showToast(`Welcome, ${currentUser.name}`);
  }

  function initMap() {
    state.map = L.map("map", { zoomControl: true }).setView([24.8333, 92.7789], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap"
    }).addTo(state.map);

    const userIcon = L.divIcon({
      className: "user-marker",
      html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(37,99,235,0.35);"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9]
    });
    state.userMarker = L.marker([24.8333, 92.7789], { icon: userIcon }).addTo(state.map);
  }

  // GPS
  function startTracking() {
    if (!navigator.geolocation) {
      gpsStatus.textContent = "GPS: N/A";
      gpsStatus.className = "status-pill offline";
      return;
    }
    const opts = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };
    navigator.geolocation.getCurrentPosition(onPosition, onGeoError, opts);
    if (state.isTracking) {
      state.watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, opts);
    }
  }

  function onPosition(pos) {
    const { latitude, longitude } = pos.coords;
    state.currentPos = { lat: latitude, lng: longitude };
    state.userMarker.setLatLng([latitude, longitude]);
    gpsStatus.textContent = "GPS: Live";
    gpsStatus.className = "status-pill online";
    if (!state.map._userCentered) {
      state.map.setView([latitude, longitude], 12);
      state.map._userCentered = true;
    }
  }

  function onGeoError() {
    gpsStatus.textContent = "GPS: Error";
    gpsStatus.className = "status-pill offline";
  }

  function toggleTracking() {
    state.isTracking = !state.isTracking;
    if (state.isTracking) {
      trackBtn.classList.add("active");
      trackBtn.textContent = "🔴 Live";
      startTracking();
    } else {
      trackBtn.classList.remove("active");
      trackBtn.textContent = "⚪ Off";
      if (state.watchId) { navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
    }
  }

  // Search
  function filterPlaces(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return DEMO_PLACES.filter(p =>
      p.name.toLowerCase().includes(q) || (p.state && p.state.toLowerCase().includes(q))
    ).slice(0, 8);
  }

  function renderSuggestions(container, places, type) {
    if (!places.length) {
      container.innerHTML = `<div class="suggestion-item">No match. Click map to set.</div>`;
    } else {
      container.innerHTML = places.map(p => `
        <div class="suggestion-item" data-lat="${p.lat}" data-lng="${p.lng}" data-name="${p.name}" data-type="${type}">
          ${p.name}<div class="sub">${p.state || ""}</div>
        </div>`).join("");
    }
    container.classList.remove("hidden");
  }

  function onSourceInput() {
    state.activeSearch = "source";
    destSugg.classList.add("hidden");
    if (!sourceInput.value.trim()) { sourceSugg.classList.add("hidden"); return; }
    renderSuggestions(sourceSugg, filterPlaces(sourceInput.value), "source");
  }

  function onDestInput() {
    state.activeSearch = "dest";
    sourceSugg.classList.add("hidden");
    if (!destInput.value.trim()) { destSugg.classList.add("hidden"); return; }
    renderSuggestions(destSugg, filterPlaces(destInput.value), "dest");
  }

  function onSuggestionClick(e) {
    const item = e.target.closest(".suggestion-item");
    if (!item || !item.dataset.lat) return;
    const lat = parseFloat(item.dataset.lat);
    const lng = parseFloat(item.dataset.lng);
    const name = item.dataset.name;
    if (item.dataset.type === "source") {
      setSource(lat, lng, name);
      sourceInput.value = name;
      sourceSugg.classList.add("hidden");
    } else {
      setDestination(lat, lng, name);
      destInput.value = name;
      destSugg.classList.add("hidden");
    }
  }

  function setSource(lat, lng, name) {
    state.source = { lat, lng, name };
    if (state.sourceMarker) state.map.removeLayer(state.sourceMarker);
    const icon = L.divIcon({
      className: "src",
      html: `<div style="width:20px;height:20px;background:#2563eb;border:3px solid white;border-radius:50%;"></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10]
    });
    state.sourceMarker = L.marker([lat, lng], { icon }).addTo(state.map).bindPopup(`<b>From</b><br>${name}`);
    sourceLocEl.textContent = name;
    if (homeRouteSummary) homeRouteSummary.textContent = `From ${name} → choose destination`;
    fitBoth();
  }

  function setDestination(lat, lng, name) {
    state.destination = { lat, lng, name };
    if (state.destMarker) state.map.removeLayer(state.destMarker);
    const icon = L.divIcon({
      className: "dst",
      html: `<div style="width:20px;height:20px;background:#16a34a;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);"></div>`,
      iconSize: [20, 20], iconAnchor: [10, 20]
    });
    state.destMarker = L.marker([lat, lng], { icon }).addTo(state.map).bindPopup(`<b>To</b><br>${name}`);
    destLocEl.textContent = name;
    if (homeRouteSummary) homeRouteSummary.textContent = `${state.source?.name || "Start"} → ${name}`;
    fitBoth();
  }

  function fitBoth() {
    if (state.source && state.destination) {
      state.map.fitBounds(L.latLngBounds(
        [state.source.lat, state.source.lng],
        [state.destination.lat, state.destination.lng]
      ), { padding: [60, 60] });
    } else if (state.source) state.map.setView([state.source.lat, state.source.lng], 12);
    else if (state.destination) state.map.setView([state.destination.lat, state.destination.lng], 12);
  }

  function useMyLocationAsSource() {
    if (!state.currentPos) { showToast("Waiting for GPS…"); return; }
    setSource(state.currentPos.lat, state.currentPos.lng, "My Current Location");
    sourceInput.value = "My Current Location";
    showToast("From = your GPS location");
  }

  function onMapClick(e) {
    if (!uploadModal.classList.contains("hidden")) return;
    const { lat, lng } = e.latlng;
    const name = `Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    if (state.activeSearch === "source" || !state.source) {
      setSource(lat, lng, name);
      sourceInput.value = name;
      state.activeSearch = "dest";
      showToast("From set. Now set To.");
    } else {
      setDestination(lat, lng, name);
      destInput.value = name;
      showToast("To set.");
    }
  }

  // ========== FETCH ALL ROUTES + AI ANALYSIS ==========
  async function calculateBestRoute() {
    if (!state.source) { showToast("Set From point"); return; }
    if (!state.destination) { showToast("Set To point"); return; }

    showRouteStatus("Finding all possible routes + AI analysis…", "info");
    routeInfo.classList.add("hidden");
    clearRoutes();
    state.allRoutes = [];
    routesPanel.classList.add("hidden");
    analysisPanel.classList.add("hidden");

    const start = state.source;
    const end = state.destination;

    try {
      // Request multiple alternatives from OSRM
      const routes = await fetchAllOSRMRoutes(start, end);

      if (!routes.length) {
        showRouteStatus("No road routes found. Try different points.", "warning");
        return;
      }

      // Analyze each route for blockages
      const analyzed = [];
      for (let i = 0; i < routes.length; i++) {
        const r = routes[i];
        let analysis = { roadAvailability: "Clear", isFullyBlocked: false, blockageCount: 0, nearbyBlockages: [] };
        try {
          analysis = await fetch("/api/analyze-route", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              fromLat: start.lat, fromLng: start.lng,
              toLat: end.lat, toLng: end.lng,
              routeCoords: r.coordinates
            })
          }).then(res => res.json());
        } catch (_) {}

        const isBlocked = analysis.isFullyBlocked || analysis.roadAvailability === "Blocked";
        const isPartial = analysis.roadAvailability === "Partially Blocked";
        let color;
        if (isBlocked) color = ROUTE_COLORS_BLOCKED[i % ROUTE_COLORS_BLOCKED.length];
        else if (isPartial) color = "#f59e0b";
        else color = ROUTE_COLORS[i % ROUTE_COLORS.length];

        analyzed.push({
          index: i,
          coordinates: r.coordinates,
          distance: r.distance,
          duration: r.duration,
          analysis,
          color,
          isBlocked,
          isPartial,
          offlineCached: !!r.offlineCached,
          offlineFallback: !!r.offlineFallback,
          label: r.offlineFallback ? "Offline Fallback" : (i === 0 ? "Primary" : `Alternative ${i}`)
        });
      }

      state.allRoutes = analyzed;

      // Prefer first clear route, else first partial, else first
      let bestIdx = analyzed.findIndex(r => !r.isBlocked && !r.isPartial);
      if (bestIdx < 0) bestIdx = analyzed.findIndex(r => !r.isBlocked);
      if (bestIdx < 0) bestIdx = 0;
      state.selectedRouteIndex = bestIdx;

      // Draw all routes (selected thicker)
      drawAllRoutes();

      // Update analysis for selected
      state.lastAnalysis = analyzed[bestIdx].analysis;
      updateAnalysisPanel(state.lastAnalysis);

      // Build routes list UI
      renderRoutesList();
      routesPanel.classList.remove("hidden");

      const allBlocked = analyzed.every(r => r.isBlocked);
      if (allBlocked) {
        showRouteStatus("🚫 All routes are blocked. Stay where you are.", "danger");
        analysisPanel.classList.remove("hidden");
        await sendSmsAlert();
      } else {
        const best = analyzed[bestIdx];
        const distKm = (best.distance / 1000).toFixed(1);
        const durMin = Math.round(best.duration / 60);
        routeInfo.textContent = `${analyzed.length} route(s) found · Best: ${distKm} km · ~${durMin} min`;
        routeInfo.classList.remove("hidden");
        const statusMsg = best.offlineFallback
          ? `📴 Offline fallback shown · reconnect for live road routing`
          : best.offlineCached
          ? `📦 Cached route shown · reconnect for live road updates`
          : best.isPartial
          ? `⚠️ Route has partial blockages (${analyzed.length} total)`
          : `✅ ${analyzed.length} route(s) found · ${best.label}`;
        showRouteStatus(statusMsg, best.isPartial ? "warning" : "success");
        analysisPanel.classList.remove("hidden");
      }

      // Fit bounds to all routes
      const allCoords = analyzed.flatMap(r => r.coordinates);
      if (allCoords.length) {
        state.map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
      }

    } catch (err) {
      console.error(err);
      showRouteStatus("Routing error. Check internet.", "warning");
      showToast(err.message || "Route failed");
    }
  }

  async function fetchAllOSRMRoutes(start, end) {
    const key = routeCacheKey(start, end);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true&steps=false`;
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) throw new Error("Routing service unavailable");
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route found");
      const routes = data.routes.map(route => ({
        coordinates: route.geometry.coordinates.map(c => [c[1], c[0]]),
        distance: route.distance,
        duration: route.duration
      }));
      cacheRoutes(key, routes);
      return routes;
    } catch (e) {
      const cached = getCachedRoutes(key);
      if (cached?.length) {
        showToast("Offline mode: using your last saved route");
        return cached.map(r => ({ ...r, offlineCached: true }));
      }
      // Last-resort offline path: keeps the app usable and lets the user record an incident.
      const direct = haversineMeters(start.lat, start.lng, end.lat, end.lng);
      showToast("No signal: using offline straight-line fallback. Reconnect for road routing.");
      return [{
        coordinates: [[start.lat, start.lng], [end.lat, end.lng]],
        distance: direct,
        duration: Math.round(direct / 11.1),
        offlineFallback: true
      }];
    }
  }

  function routeCacheKey(a, b) {
    return `${a.lat.toFixed(3)},${a.lng.toFixed(3)}|${b.lat.toFixed(3)},${b.lng.toFixed(3)}`;
  }
  function cacheRoutes(key, routes) {
    try {
      const cache = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || "{}");
      cache[key] = { savedAt: Date.now(), routes };
      const keys = Object.keys(cache).sort((a,b) => cache[b].savedAt - cache[a].savedAt).slice(0, 12);
      const trimmed = {}; keys.forEach(k => trimmed[k] = cache[k]);
      localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(trimmed));
    } catch (_) {}
  }
  function getCachedRoutes(key) {
    try { return JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || "{}")[key]?.routes || null; }
    catch (_) { return null; }
  }
  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R=6371000, p1=lat1*Math.PI/180, p2=lat2*Math.PI/180, dp=(lat2-lat1)*Math.PI/180, dl=(lon2-lon1)*Math.PI/180;
    const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function clearRoutes() {
    state.routeLayers.forEach(layer => {
      if (state.map.hasLayer(layer)) state.map.removeLayer(layer);
    });
    state.routeLayers = [];
  }

  function drawAllRoutes() {
    clearRoutes();
    const selected = state.selectedRouteIndex;

    // Draw non-selected first (under), then selected on top
    state.allRoutes.forEach((r, i) => {
      if (i === selected) return;
      const layer = L.polyline(r.coordinates, {
        color: r.color,
        weight: 4,
        opacity: 0.45,
        lineJoin: "round",
        dashArray: "10 8"
      }).addTo(state.map);
      layer._routeIndex = i;
      layer.on("click", () => selectRoute(i));
      state.routeLayers.push(layer);
    });

    // Selected route on top
    if (state.allRoutes[selected]) {
      const r = state.allRoutes[selected];
      const layer = L.polyline(r.coordinates, {
        color: r.color,
        weight: 7,
        opacity: 0.95,
        lineJoin: "round"
      }).addTo(state.map);
      layer._routeIndex = selected;
      layer.on("click", () => selectRoute(selected));
      state.routeLayers.push(layer);
    }
  }

  function selectRoute(index) {
    if (index < 0 || index >= state.allRoutes.length) return;
    state.selectedRouteIndex = index;
    const r = state.allRoutes[index];
    state.lastAnalysis = r.analysis;
    updateAnalysisPanel(r.analysis);
    drawAllRoutes();
    renderRoutesList();

    const distKm = (r.distance / 1000).toFixed(1);
    const durMin = Math.round(r.duration / 60);
    routeInfo.textContent = `Selected: ${r.label} · ${distKm} km · ~${durMin} min`;
    routeInfo.classList.remove("hidden");

    if (r.offlineFallback) {
      showRouteStatus("📴 Offline fallback — reconnect for live road routing", "warning");
    } else if (r.offlineCached) {
      showRouteStatus("📦 Cached route — reconnect for fresh road data", "warning");
    } else if (r.isBlocked) {
      showRouteStatus(`🚫 ${r.label} is blocked`, "danger");
    } else if (r.isPartial) {
      showRouteStatus(`⚠️ ${r.label} has partial blockages`, "warning");
    } else {
      showRouteStatus(`✅ ${r.label} is clear`, "success");
    }

    state.map.fitBounds(L.latLngBounds(r.coordinates), { padding: [50, 50] });
  }

  function renderRoutesList() {
    if (!state.allRoutes.length) {
      routesList.innerHTML = `<div class="route-item empty">No routes calculated yet.</div>`;
      return;
    }

    routesList.innerHTML = state.allRoutes.map((r, i) => {
      const distKm = (r.distance / 1000).toFixed(1);
      const durMin = Math.round(r.duration / 60);
      const statusClass = r.isBlocked ? "blocked" : r.isPartial ? "partial" : "clear";
      const statusText = r.isBlocked ? "Blocked" : r.isPartial ? "Partial" : "Clear";
      const active = i === state.selectedRouteIndex ? "active" : "";

      return `
        <button type="button" class="route-item ${statusClass} ${active}" data-index="${i}">
          <span class="route-color" style="background:${r.color}"></span>
          <span class="route-meta">
            <span class="route-name">${r.label}</span>
            <span class="route-stats">${distKm} km · ~${durMin} min</span>
          </span>
          <span class="route-badge ${statusClass}">${statusText}</span>
        </button>`;
    }).join("");

    routesList.querySelectorAll(".route-item").forEach(el => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.dataset.index, 10);
        selectRoute(idx);
      });
    });
  }

  // SMS when all blocked
  async function sendSmsAlert() {
    try {
      const res = await fetch("/api/send-sms-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          phone: currentUser.phone,
          userId: currentUser.id,
          userName: currentUser.name,
          message: `RouteAI Alert: All routes from ${state.source?.name || "start"} to ${state.destination?.name || "end"} are blocked. Stay where you are and wait for clearance.`
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`SMS alert sent to ${currentUser.phone}`);
      }
    } catch (e) {
      console.warn("SMS failed", e);
      showToast("SMS simulation logged on server");
    }
  }

  // Analysis panel
  function updateAnalysisPanel(a) {
    $("#a-road").textContent = a.roadAvailability || "—";
    $("#a-road").style.color = a.roadAvailability === "Clear" ? "#4ade80" :
      a.roadAvailability === "Blocked" ? "#f87171" : "#fbbf24";

    const w = a.weather || {};
    $("#a-weather").textContent = w.condition || "—";
    $("#a-temp").textContent = w.temp != null ? `${w.temp}°C` : "—";
    $("#a-block").textContent = a.blockageCount ?? "0";
    $("#a-recommendation").textContent = a.recommendation || "";

    const list = $("#a-block-list");
    if (a.nearbyBlockages && a.nearbyBlockages.length) {
      list.innerHTML = a.nearbyBlockages.map(b => `
        <div class="a-block-item">
          📷 ${b.description}<br>
          <small>By ${b.by} (${b.role}) · ${new Date(b.time).toLocaleString()}</small>
        </div>`).join("");
      list.classList.remove("hidden");
    } else {
      list.classList.add("hidden");
    }
  }

  // Photos / reports
  async function loadPhotos() {
    try {
      const res = await fetch("/api/photos", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Could not load reports");
      state.photos = await res.json();
      state.photoMarkers.forEach(m => state.map.removeLayer(m));
      state.photoMarkers = [];
      state.photos.forEach(addPhotoMarker);
      refreshOfflinePanel();
    } catch (_) {
      // Offline mode can continue with already cached/local reports.
    }
  }

  function canManagePhoto(photo) {
    return !!photo && (currentUser.role === "admin" || String(photo.userId) === String(currentUser.id));
  }

  function addPhotoMarker(photo) {
    const icon = L.divIcon({
      className: "ph",
      html: `<div style="width:26px;height:26px;background:${photo.role === "official" ? "#b45309" : "#dc2626"};border:2px solid white;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;">📷</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });
    const imgHtml = photo.url
      ? `<img src="${photo.url}" style="width:100%;border-radius:6px;margin-bottom:4px" />`
      : (photo.dataUrl ? `<img src="${photo.dataUrl}" style="width:100%;border-radius:6px;margin-bottom:4px" />` : "");
    const manageHtml = canManagePhoto(photo)
      ? `<button class="delete-report-btn" data-photo-id="${escapeHtml(photo.id)}">🗑️ Remove report</button>`
      : "";
    const marker = L.marker([photo.lat, photo.lng], { icon }).addTo(state.map).bindPopup(`
      <div style="max-width:210px">${imgHtml}
        <b>${escapeHtml(photo.description || photo.incidentType || "Report")}</b><br>
        <small>${escapeHtml(photo.userName || "Unknown")} (${escapeHtml(photo.role || "public")})<br>${new Date(photo.timestamp).toLocaleString()}</small>
        ${photo.source === "offline" ? `<div style="margin-top:5px;color:#b45309"><small>${photo.syncedAt ? "Synced from offline storage" : "Saved offline · waiting to sync"}</small></div>` : ""}
        ${manageHtml}
      </div>
    `);
    marker._routeAiPhotoId = String(photo.id);
    marker.on("popupopen", (e) => {
      const btn = e.popup.getElement()?.querySelector(".delete-report-btn");
      if (btn) btn.addEventListener("click", () => deleteServerPhoto(photo.id));
    });
    state.photoMarkers.push(marker);
  }

  async function deleteServerPhoto(id) {
    const photo = state.photos.find(p => String(p.id) === String(id));
    if (!photo) return;
    if (!canManagePhoto(photo)) { showToast("You can only remove your own reports"); return; }
    if (!confirm("Remove this geo-tagged photo/report? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      state.photos = state.photos.filter(p => String(p.id) !== String(id));
      state.photoMarkers = state.photoMarkers.filter(marker => {
        if (String(marker._routeAiPhotoId) === String(id)) { state.map.removeLayer(marker); return false; }
        return true;
      });
      refreshOfflinePanel();
      showToast("Report removed");
    } catch (err) {
      showToast(err.message || "Could not remove report");
    }
  }

  function openUploadModal() {
    if (!currentUser) { showToast("Please sign in"); return; }
    uploadModal.classList.remove("hidden");
    photoInput.value = "";
    photoDesc.value = "";
    previewCont.classList.add("hidden");
    useGpsCheck.checked = true;
  }

  function closeUploadModal() { uploadModal.classList.add("hidden"); }

  function onPhotoSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      photoPreview.src = ev.target.result;
      previewCont.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }

  async function confirmPhotoUpload() {
    if (!currentUser) { showToast("Please sign in"); return; }
    if (!photoInput.files[0] && !photoPreview.src) {
      showToast("Select a photo first");
      return;
    }
    let lat, lng;
    if (useGpsCheck.checked) {
      if (!state.currentPos) { showToast("GPS not ready"); return; }
      lat = state.currentPos.lat;
      lng = state.currentPos.lng;
    } else {
      const c = state.map.getCenter();
      lat = c.lat; lng = c.lng;
    }

    const form = new FormData();
    if (photoInput.files[0]) form.append("photo", photoInput.files[0]);
    form.append("lat", lat);
    form.append("lng", lng);
    form.append("description", photoDesc.value.trim() || "No description");
    form.append("userId", currentUser.id);
    form.append("userName", currentUser.name);
    form.append("role", currentUser.role);
    if (photoPreview.src && photoPreview.src.startsWith("data:")) {
      form.append("dataUrl", photoPreview.src);
    }

    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      state.photos.push(data.photo);
      addPhotoMarker(data.photo);
      closeUploadModal();
      showToast("Photo uploaded & geo-tagged!");
    } catch (err) {
      // Keep the original photo-report feature usable without signal.
      if (photoPreview.src && photoPreview.src.startsWith("data:")) {
        try {
          await queueOfflineReport({
            id:`offline-photo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            lat,lng,
            description:photoDesc.value.trim() || "Offline photo report",
            incidentType:"Photo Report",
            severity:"Medium",
            userId:currentUser.id,userName:currentUser.name,role:currentUser.role,
            dataUrl:photoPreview.src,
            timestamp:new Date().toISOString()
          });
          closeUploadModal();
          refreshOfflinePanel();
          showToast("Photo saved offline. It will sync when signal returns.");
          return;
        } catch (_) {}
      }
      showToast(err.message || "Upload failed");
    }
  }

  function showRouteStatus(msg, type) {
    routeStatus.textContent = msg;
    routeStatus.className = `route-status ${type}`;
  }

  function showToast(msg, ms = 2800) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.add("hidden"), ms);
  }


  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]+/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch]));
  }

  // ========== OFFLINE-FIRST DATA COLLECTION ==========
  function openOfflineDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("IndexedDB unavailable"));
      const req = indexedDB.open(OFFLINE_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(OFFLINE_STORE)) {
          req.result.createObjectStore(OFFLINE_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function queueOfflineReport(report) {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE, "readwrite");
      tx.objectStore(OFFLINE_STORE).put(report);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getOfflineReports() {
    try {
      const db = await openOfflineDB();
      return await new Promise((resolve, reject) => {
        const tx=db.transaction(OFFLINE_STORE,"readonly"), req=tx.objectStore(OFFLINE_STORE).getAll();
        req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
      });
    } catch (_) { return []; }
  }

  async function deleteOfflineReport(id) {
    const db=await openOfflineDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(OFFLINE_STORE,"readwrite");
      tx.objectStore(OFFLINE_STORE).delete(id); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
  }

  function updateNetworkUI() {
    const online = navigator.onLine;
    networkBanner.className = `network-banner ${online ? "online" : "offline"}`;
    networkBanner.textContent = online ? "🟢 Online · Live sync enabled" : "🔴 Offline · Reports are saved on this device";
    if (connectionValue) connectionValue.textContent = online ? "Online" : "Offline";
    if (syncMiniStatus) syncMiniStatus.textContent = online ? "Online & syncing" : "Offline · saving locally";
  }

  async function syncOfflineReports() {
    if (!currentUser) return;
    if (!navigator.onLine) return;
    const pending = await getOfflineReports();
    if (!pending.length) { refreshOfflinePanel(); return; }
    networkBanner.className = "network-banner syncing";
    networkBanner.textContent = `🟡 Syncing ${pending.length} saved report(s)…`;
    if (syncMiniStatus) syncMiniStatus.textContent = `Syncing ${pending.length}…`;
    let synced=0;
    for (const report of pending) {
      try {
        const res=await fetch("/api/photos/batch",{
          method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
          body:JSON.stringify({items:[report]})
        });
        if (!res.ok) throw new Error("sync failed");
        const data = await res.json();
        await deleteOfflineReport(report.id);
        state.photos = state.photos.filter(p => String(p.id) !== String(report.id));
        const syncedPhoto = data.photos?.[0];
        if (syncedPhoto) {
          state.photos.push(syncedPhoto);
          addPhotoMarker(syncedPhoto);
        }
        state.photoMarkers = state.photoMarkers.filter(marker => {
          if (String(marker._routeAiPhotoId) === String(report.id)) { state.map.removeLayer(marker); return false; }
          return true;
        });
        synced++;
      } catch (_) { break; }
    }
    updateNetworkUI();
    refreshOfflinePanel();
    if (synced) showToast(`${synced} offline report(s) synced`);
    if (syncMiniStatus) syncMiniStatus.textContent = navigator.onLine ? "Online & synced" : "Offline · saving locally";
  }

  async function refreshOfflinePanel() {
    const pending = await getOfflineReports();
    const cache = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || "{}");
    if (pendingCount) pendingCount.textContent = pending.length;
    if (cachedCount) cachedCount.textContent = Object.keys(cache).length;
    if (connectionValue) connectionValue.textContent = navigator.onLine ? "Online" : "Offline";
    if (!savedDataList) return;

    const pendingHtml = pending.length ? `
      <h4 class="saved-section-title">Pending offline reports</h4>
      ${pending.map(r => `<div class="saved-item">
        <b>⏳ ${escapeHtml(r.incidentType || "Incident")}</b>
        <small>${escapeHtml(r.description || "No note")} · ${escapeHtml(r.severity || "Medium")}<br>${new Date(r.timestamp).toLocaleString()}</small>
        <button class="small-danger-btn delete-offline-btn" data-id="${escapeHtml(r.id)}">🗑️ Remove</button>
      </div>`).join("")}
    ` : `<div class="saved-item"><b>✓ No pending offline reports</b><small>New reports saved without signal will appear here.</small></div>`;

    const q = (myUploadSearch?.value || "").trim().toLowerCase();
    const visible = (uploadViewMode === "mine" ? state.photos.filter(p => String(p.userId) === String(currentUser.id)) : state.photos).slice().reverse().filter(p => {
      if (!q) return true;
      return [p.incidentType,p.description,p.userName,p.severity,p.role].some(v => String(v || "").toLowerCase().includes(q));
    });
    const title = uploadViewMode === "mine" ? "My uploads" : "All uploads";
    const uploadsHtml = visible.length ? `
      <h4 class="saved-section-title">${title} · ${visible.length}</h4>
      ${visible.map(p => {
        const own = String(p.userId) === String(currentUser.id);
        const img = p.url || p.dataUrl;
        return `<div class="upload-item">
          <input type="checkbox" class="upload-select" data-id="${escapeHtml(p.id)}" ${own ? "" : "disabled"} title="Select your upload" />
          ${img ? `<img src="${escapeHtml(img)}" alt="upload" />` : `<div class="upload-thumb-placeholder">📍</div>`}
          <div class="upload-item-main">
            <b>${escapeHtml(p.incidentType || "Geo-tagged report")}</b>
            <small>${escapeHtml(p.description || "No description")} · ${escapeHtml(p.severity || "Medium")}<br>By ${escapeHtml(p.userName || "Unknown")} · ${new Date(p.timestamp).toLocaleString()}</small>
            <div class="upload-item-actions">
              ${own ? `<button class="small-danger-btn delete-server-list-btn" data-id="${escapeHtml(p.id)}">🗑️ Delete my upload</button>` : `<span class="owner-badge">🔒 Only uploader can delete</span>`}
            </div>
          </div>
        </div>`;
      }).join("")}
    ` : `<div class="saved-item"><b>📭 No matching uploads</b><small>${uploadViewMode === "mine" ? "Your uploaded photos and reports will appear here." : "No uploads match your search."}</small></div>`;

    savedDataList.innerHTML = pendingHtml + uploadsHtml;
    savedDataList.querySelectorAll(".delete-offline-btn").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("Remove this saved offline report?")) return;
      await deleteOfflineReport(btn.dataset.id);
      state.photos = state.photos.filter(p => String(p.id) !== String(btn.dataset.id));
      state.photoMarkers = state.photoMarkers.filter(marker => {
        if (String(marker._routeAiPhotoId) === String(btn.dataset.id)) { state.map.removeLayer(marker); return false; }
        return true;
      });
      refreshOfflinePanel();
      showToast("Offline report removed");
    }));
    savedDataList.querySelectorAll(".delete-server-list-btn").forEach(btn => btn.addEventListener("click", () => deleteServerPhoto(btn.dataset.id)));
    showMyUploadsBtn?.classList.toggle("active", uploadViewMode === "mine");
    showAllUploadsBtn?.classList.toggle("active", uploadViewMode === "all");
  }

  function openQuickReport() {
    if (!currentUser) { showToast("Please sign in"); return; }
    incidentNote.value="";
    incidentSeverity.value="High";
    incidentType.value="Flood / Waterlogging";
    incidentGps.checked=true;
    if (incidentPhoto) { incidentPhoto.value=""; incidentPhotoName.textContent="No photo selected"; }
    quickReportModal.classList.remove("hidden");
  }
  function closeQuickReport() { quickReportModal.classList.add("hidden"); }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function saveQuickIncident() {
    if (!currentUser) { showToast("Please sign in"); return; }
    let pos=state.currentPos;
    if (incidentGps.checked && !pos) {
      if (!navigator.onLine) { showToast("GPS not available. Turn on location or uncheck GPS."); return; }
      showToast("Waiting for GPS…"); return;
    }
    if (!pos) {
      const c=state.map.getCenter(); pos={lat:c.lat,lng:c.lng};
    }
    let dataUrl = null;
    if (incidentPhoto?.files?.[0]) {
      try { dataUrl = await fileToDataUrl(incidentPhoto.files[0]); }
      catch (_) { showToast("Could not read the photo"); return; }
    }
    const report={
      id:`offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      lat:pos.lat,lng:pos.lng,
      description:incidentNote.value.trim()||incidentType.value,
      incidentType:incidentType.value,severity:incidentSeverity.value,
      userId:currentUser.id,userName:currentUser.name,role:currentUser.role,
      dataUrl,
      timestamp:new Date().toISOString()
    };
    try {
      if (navigator.onLine) {
        const res=await fetch("/api/photos/batch",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({items:[report]})});
        if (!res.ok) throw new Error("online save failed");
        const data=await res.json();
        if(data.photos?.[0]) { state.photos.push(data.photos[0]); addPhotoMarker(data.photos[0]); }
        showToast("Incident reported and synced");
      } else {
        await queueOfflineReport(report);
        const localReport = { ...report, source: "offline", pending: true };
        state.photos.push(localReport);
        addPhotoMarker(localReport);
        showToast("Saved on this device. It will sync automatically when signal returns.");
      }
      closeQuickReport(); refreshOfflinePanel();
    } catch (_) {
      await queueOfflineReport(report);
      const localReport = { ...report, source: "offline", pending: true };
      state.photos.push(localReport);
      addPhotoMarker(localReport);
      closeQuickReport(); refreshOfflinePanel();
      showToast("Saved on this device. Sync will happen when signal returns.");
    }
  }

  function bindEvents() {
    openPlanBtn?.addEventListener("click", () => sourceInput?.focus());
    closePlanner?.addEventListener("click", () => plannerPanel.classList.add("hidden"));
    sourceInput.addEventListener("input", onSourceInput);
    sourceInput.addEventListener("focus", () => { state.activeSearch = "source"; onSourceInput(); });
    destInput.addEventListener("input", onDestInput);
    destInput.addEventListener("focus", () => { state.activeSearch = "dest"; onDestInput(); });
    sourceSugg.addEventListener("click", onSuggestionClick);
    destSugg.addEventListener("click", onSuggestionClick);

    sourceClear.addEventListener("click", () => {
      sourceInput.value = ""; sourceSugg.classList.add("hidden");
      if (state.sourceMarker) { state.map.removeLayer(state.sourceMarker); state.sourceMarker = null; }
      state.source = null; sourceLocEl.textContent = "Not set"; if (homeRouteSummary) homeRouteSummary.textContent = "Choose a start and destination";
      clearRoutes(); state.allRoutes = [];
      routeStatus.classList.add("hidden"); routeInfo.classList.add("hidden");
      routesPanel.classList.add("hidden");
    });
    destClear.addEventListener("click", () => {
      destInput.value = ""; destSugg.classList.add("hidden");
      if (state.destMarker) { state.map.removeLayer(state.destMarker); state.destMarker = null; }
      state.destination = null; destLocEl.textContent = "Not set"; if (homeRouteSummary) homeRouteSummary.textContent = "Choose a start and destination";
      clearRoutes(); state.allRoutes = [];
      routeStatus.classList.add("hidden"); routeInfo.classList.add("hidden");
      routesPanel.classList.add("hidden");
    });

    useMyLocBtn.addEventListener("click", useMyLocationAsSource);
    calcRouteBtn.addEventListener("click", async () => { await calculateBestRoute(); });
    quickReportBtn.addEventListener("click", openQuickReport);
    cancelQuickReport.addEventListener("click", closeQuickReport);
    saveQuickReport.addEventListener("click", saveQuickIncident);
    offlineDataBtn.addEventListener("click", () => { refreshOfflinePanel(); savedDataPanel.classList.toggle("hidden"); routesPanel.classList.add("hidden"); analysisPanel.classList.add("hidden"); });
    closeSavedData.addEventListener("click", () => savedDataPanel.classList.add("hidden"));
    syncNowBtn.addEventListener("click", syncOfflineReports);
    uploadBtn.addEventListener("click", openUploadModal);
    cancelUpload.addEventListener("click", closeUploadModal);
    confirmUpload.addEventListener("click", confirmPhotoUpload);
    photoInput.addEventListener("change", onPhotoSelected);
    centerBtn.addEventListener("click", () => {
      if (state.currentPos) state.map.setView([state.currentPos.lat, state.currentPos.lng], 15);
      else showToast("No GPS yet");
    });
    trackBtn.addEventListener("click", toggleTracking);
    showAnalysisBtn.addEventListener("click", () => {
      if (state.lastAnalysis) {
        updateAnalysisPanel(state.lastAnalysis);
        analysisPanel.classList.toggle("hidden");
        routesPanel.classList.add("hidden");
      } else showToast("Run a route first to see analysis");
    });
    showRoutesBtn.addEventListener("click", () => {
      if (state.allRoutes.length) {
        routesPanel.classList.toggle("hidden");
        analysisPanel.classList.add("hidden");
      } else showToast("Find routes first");
    });
    closeAnalysis.addEventListener("click", () => analysisPanel.classList.add("hidden"));
    closeRoutes.addEventListener("click", () => routesPanel.classList.add("hidden"));
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("routeai_token");
      localStorage.removeItem("routeai_user");
      window.location.href = "index.html";
    });
    state.map.on("click", onMapClick);
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-panel")) {
        sourceSugg.classList.add("hidden");
        destSugg.classList.add("hidden");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
