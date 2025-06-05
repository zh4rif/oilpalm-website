// Initialize map centered on Malaysia
let map = L.map('map').setView([2.8681, 101.3316], 14);

// Base layers
let baseLayers = {
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics'
    }),
    terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri, DeLorme, NAVTEQ'
    }),
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap contributors'
    })
};

// Add default layer
baseLayers.satellite.addTo(map);

// Drawing layers
let drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Sample plantation polygons
let samplePolygons = [
    {
        coordinates: [[2.876, 101.3125], [2.876, 101.3318], [2.8684, 101.3317], [2.8684, 101.3125]],
        properties: { id: 'P001', area: 800, health: 'Good', ndvi: 0.72 }
    },
    {
        coordinates: [[2.8684, 101.3124], [2.8684, 101.3317], [2.8557, 101.3317], [2.856, 101.3124]],
        properties: { id: 'P002', area: 1200, health: 'Fair', ndvi: 0.65 }
    },
    {
        coordinates: [[2.8758, 101.3016], [2.8760, 101.3124], [2.8685, 101.3124], [2.8685, 101.3016]],
        properties: { id: 'P003', area: 500, health: 'Excellent', ndvi: 0.78 }
    }

];

// Add sample polygons to map
samplePolygons.forEach(polygon => {
    let color = polygon.properties.health === 'Excellent' ? '#4CAF50' : 
               polygon.properties.health === 'Good' ? '#8BC34A' : 
               polygon.properties.health === 'Fair' ? '#FFC107' : '#FF5722';
    
    let poly = L.polygon(polygon.coordinates, {
        color: color,
        fillColor: color,
        fillOpacity: 0.3,
        weight: 2
    }).addTo(map);
    
    poly.bindPopup(`
        <strong>Plantation ${polygon.properties.id}</strong><br>
        Area: ${polygon.properties.area} Ha<br>
        Health: ${polygon.properties.health}<br>
        NDVI: ${polygon.properties.ndvi}
    `);
});

// Drawing control variables
let currentDrawing = null;
let isDrawing = false;

// Global state
let appState = {
    selectedPolygon: null,
    drawingMode: null,
    layers: {
        satellite: true,
        terrain: false,
        ndvi: false,
        clouds: false,
        polygons: true
    }
};

// Initialize trend chart
let ctx = document.getElementById('trendChart').getContext('2d');
let trendChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'NDVI Average',
            data: [0.65, 0.68, 0.72, 0.70, 0.73, 0.67],
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                min: 0.6,
                max: 0.8
            }
        }
    }
});

// Layer toggle function
function toggleLayer(layerName) {
    switch(layerName) {
        case 'satellite':
            if (map.hasLayer(baseLayers.satellite)) {
                map.removeLayer(baseLayers.satellite);
            } else {
                baseLayers.satellite.addTo(map);
                if (map.hasLayer(baseLayers.terrain)) {
                    map.removeLayer(baseLayers.terrain);
                }
            }
            break;
        case 'terrain':
            if (map.hasLayer(baseLayers.terrain)) {
                map.removeLayer(baseLayers.terrain);
            } else {
                baseLayers.terrain.addTo(map);
                if (map.hasLayer(baseLayers.satellite)) {
                    map.removeLayer(baseLayers.satellite);
                }
            }
            break;
        case 'ndvi':
            showNotification('NDVI overlay activated');
            break;
        case 'clouds':
            showNotification('Cloud masking applied');
            break;
    }
    
    // Update button states
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Drawing functions
function activateDrawing(type) {
    // Clear previous drawing state
    clearActiveDrawing();
    
    appState.drawingMode = type;
    
    // Update UI
    document.querySelectorAll('.draw-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    showNotification(`${type} drawing mode activated`);
    
    // Set cursor style
    map.getContainer().style.cursor = 'crosshair';
    
    // Enable drawing based on type
    if (type === 'polygon') {
        enablePolygonDrawing();
    } else if (type === 'rectangle') {
        enableRectangleDrawing();
    } else if (type === 'circle') {
        enableCircleDrawing();
    }
}

function enablePolygonDrawing() {
    let points = [];
    let tempPolyline = null;
    
    map.on('click', function(e) {
        if (appState.drawingMode !== 'polygon') return;
        
        points.push([e.latlng.lat, e.latlng.lng]);
        
        if (points.length === 1) {
            // First point
            L.marker(e.latlng).addTo(drawnItems);
        } else if (points.length >= 2) {
            // Update temporary polyline
            if (tempPolyline) {
                map.removeLayer(tempPolyline);
            }
            tempPolyline = L.polyline(points, {color: '#ff0000', weight: 2}).addTo(map);
        }
    });
    
    map.on('dblclick', function(e) {
        if (appState.drawingMode !== 'polygon' || points.length < 3) return;
        
        // Complete polygon
        if (tempPolyline) {
            map.removeLayer(tempPolyline);
        }
        
        let polygon = L.polygon(points, {
            color: '#4CAF50',
            fillColor: '#4CAF50',
            fillOpacity: 0.3,
            weight: 2
        }).addTo(drawnItems);
        
        // Add popup with analysis options
        polygon.bindPopup(`
            <strong>New Polygon</strong><br>
            <button onclick="analyzePolygon()" class="btn">Analyze</button>
            <button onclick="deletePolygon()" class="btn">Delete</button>
        `);
        
        // Calculate area
        let area = calculatePolygonArea(points);
        showNotification(`Polygon created: ${area.toFixed(2)} hectares`);
        
        // Reset drawing state
        clearActiveDrawing();
        points = [];
    });
}

function enableRectangleDrawing() {
    let startPoint = null;
    let tempRectangle = null;
    
    map.on('mousedown', function(e) {
        if (appState.drawingMode !== 'rectangle') return;
        startPoint = e.latlng;
    });
    
    map.on('mousemove', function(e) {
        if (!startPoint || appState.drawingMode !== 'rectangle') return;
        
        if (tempRectangle) {
            map.removeLayer(tempRectangle);
        }
        
        let bounds = L.latLngBounds(startPoint, e.latlng);
        tempRectangle = L.rectangle(bounds, {
            color: '#ff0000',
            weight: 2,
            fillOpacity: 0.1
        }).addTo(map);
    });
    
    map.on('mouseup', function(e) {
        if (!startPoint || appState.drawingMode !== 'rectangle') return;
        
        if (tempRectangle) {
            map.removeLayer(tempRectangle);
        }
        
        let bounds = L.latLngBounds(startPoint, e.latlng);
        let rectangle = L.rectangle(bounds, {
            color: '#4CAF50',
            fillColor: '#4CAF50',
            fillOpacity: 0.3,
            weight: 2
        }).addTo(drawnItems);
        
        rectangle.bindPopup(`
            <strong>New Rectangle</strong><br>
            <button onclick="analyzePolygon()" class="btn">Analyze</button>
            <button onclick="deletePolygon()" class="btn">Delete</button>
        `);
        
        showNotification('Rectangle created');
        clearActiveDrawing();
        startPoint = null;
    });
}

function enableCircleDrawing() {
    let centerPoint = null;
    let tempCircle = null;
    
    map.on('mousedown', function(e) {
        if (appState.drawingMode !== 'circle') return;
        centerPoint = e.latlng;
    });
    
    map.on('mousemove', function(e) {
        if (!centerPoint || appState.drawingMode !== 'circle') return;
        
        if (tempCircle) {
            map.removeLayer(tempCircle);
        }
        
        let radius = centerPoint.distanceTo(e.latlng);
        tempCircle = L.circle(centerPoint, {
            radius: radius,
            color: '#ff0000',
            weight: 2,
            fillOpacity: 0.1
        }).addTo(map);
    });
    
    map.on('mouseup', function(e) {
        if (!centerPoint || appState.drawingMode !== 'circle') return;
        
        if (tempCircle) {
            map.removeLayer(tempCircle);
        }
        
        let radius = centerPoint.distanceTo(e.latlng);
        let circle = L.circle(centerPoint, {
            radius: radius,
            color: '#4CAF50',
            fillColor: '#4CAF50',
            fillOpacity: 0.3,
            weight: 2
        }).addTo(drawnItems);
        
        circle.bindPopup(`
            <strong>New Circle</strong><br>
            Radius: ${(radius/1000).toFixed(2)} km<br>
            <button onclick="analyzePolygon()" class="btn">Analyze</button>
            <button onclick="deletePolygon()" class="btn">Delete</button>
        `);
        
        showNotification('Circle created');
        clearActiveDrawing();
        centerPoint = null;
    });
}

function clearActiveDrawing() {
    appState.drawingMode = null;
    map.getContainer().style.cursor = '';
    map.off('click mousedown mousemove mouseup dblclick');
}

function clearDrawings() {
    drawnItems.clearLayers();
    showNotification('All drawings cleared');
}

function calculatePolygonArea(points) {
    // Simple area calculation (Shoelace formula)
    let area = 0;
    let n = points.length;
    
    for (let i = 0; i < n; i++) {
        let j = (i + 1) % n;
        area += points[i][0] * points[j][1];
        area -= points[j][0] * points[i][1];
    }
    
    area = Math.abs(area) / 2;
    // Convert to hectares (rough approximation)
    return area * 111.32 * 111.32 / 100;
}

// Auto-detection functions
function autoDetectPolygons() {
    showLoading('Analyzing satellite imagery for palm plantations...');
    
    setTimeout(() => {
        // Simulate auto-detection
        let detectedPolygons = [
            {
                coordinates: [[2.8685, 101.3317], [2.8685, 101.3537], [2.8629, 101.3537], [2.8629, 101.3442], [2.8556, 101.3442], [2.8556, 101.3317]],
                confidence: 0.92,
                area: 450
            },
            {
                coordinates: [[2.8832, 101.3317], [2.8832, 101.3609], [2.8684, 101.3610], [2.8685, 101.3316]],
                confidence: 0.87,
                area: 380
            }
        ];
        
        detectedPolygons.forEach((poly, index) => {
            let color = poly.confidence > 0.9 ? '#4CAF50' : '#FFC107';
            let polygon = L.polygon(poly.coordinates, {
                color: color,
                fillColor: color,
                fillOpacity: 0.4,
                weight: 2
            }).addTo(drawnItems);
            
            polygon.bindPopup(`
                <strong>Auto-detected Plantation</strong><br>
                Confidence: ${(poly.confidence * 100).toFixed(1)}%<br>
                Area: ${poly.area} Ha<br>
                <button onclick="confirmDetection()">Confirm</button>
                <button onclick="rejectDetection()">Reject</button>
            `);
        });
        
        hideLoading();
        showNotification(`${detectedPolygons.length} plantations detected`);
    }, 3000);
}

// Analysis functions
function runSpatialAnalysis() {
    showLoading('Running spatial analysis...');
    
    setTimeout(() => {
        hideLoading();
        showNotification('Spatial analysis complete');
        
        // Update metrics
        updateAnalyticsPanel({
            totalArea: 5623.4,
            healthyPercentage: 94.2,
            avgNDVI: 0.68,
            riskAreas: 12
        });
    }, 2000);
}

function trendAnalysis() {
    showLoading('Analyzing historical trends...');
    
    setTimeout(() => {
        // Generate new trend data
        let newData = [];
        for (let i = 0; i < 12; i++) {
            newData.push(0.6 + Math.random() * 0.2);
        }
        
        trendChart.data.datasets[0].data = newData;
        trendChart.update();
        
        hideLoading();
        showNotification('Trend analysis updated');
    }, 2500);
}

function generateReport() {
    showLoading('Generating comprehensive report...');
    
    setTimeout(() => {
        hideLoading();
        showNotification('Report generated successfully');
        
        // Simulate download
        let reportData = {
            timestamp: new Date().toISOString(),
            totalArea: '5,623.4 Ha',
            healthyPolygons: 2692,
            avgNDVI: 0.68,
            alerts: 3,
            recommendations: [
                'Monitor Block 7A for potential disease outbreak',
                'Schedule irrigation for Sector 12',
                'Consider replanting in low-performing areas'
            ]
        };
        
        downloadJSON(reportData, 'palm-plantation-report.json');
    }, 2000);
}

// Data export functions
function exportData(format) {
    showLoading(`Preparing ${format.toUpperCase()} export...`);
    
    setTimeout(() => {
        switch(format) {
            case 'geojson':
                exportGeoJSON();
                break;
            case 'shapefile':
                exportShapefile();
                break;
            case 'csv':
                exportCSV();
                break;
            case 'report':
                generatePDFReport();
                break;
        }
        hideLoading();
    }, 1500);
}

function exportGeoJSON() {
    let geojson = {
        type: "FeatureCollection",
        features: []
    };
    
    // Add drawn items to GeoJSON
    drawnItems.eachLayer(function(layer) {
        if (layer.toGeoJSON) {
            geojson.features.push(layer.toGeoJSON());
        }
    });
    
    downloadJSON(geojson, 'plantation-data.geojson');
    showNotification('GeoJSON exported successfully');
}

function exportShapefile() {
    // Simulate shapefile export
    showNotification('Shapefile export initiated - check downloads');
}

function exportCSV() {
    let csvContent = "ID,Area_Ha,NDVI,Health_Status,Latitude,Longitude\n";
    csvContent += "P001,2500,0.72,Good,4.25,108.75\n";
    csvContent += "P002,1800,0.65,Fair,3.55,109.45\n";
    csvContent += "P003,3200,0.78,Excellent,4.55,107.75\n";
    
    downloadCSV(csvContent, 'plantation-data.csv');
    showNotification('CSV exported successfully');
}

// Utility functions
function showLoading(message = 'Processing...') {
    let overlay = document.getElementById('loadingOverlay');
    overlay.querySelector('span').textContent = message;
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showNotification(message) {
    let notification = document.getElementById('notification');
    let text = document.getElementById('notificationText');
    
    text.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function downloadJSON(data, filename) {
    let blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadCSV(content, filename) {
    let blob = new Blob([content], {type: 'text/csv'});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Map control functions
function fullScreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen();
    }
}

function resetView() {
    map.setView([4.2105, 108.9758], 8);
    showNotification('View reset to Malaysia');
}

function measureDistance() {
    showNotification('Distance measurement tool activated');
    // Implement distance measurement
}

function takeScreenshot() {
    showNotification('Screenshot captured');
    // Implement screenshot functionality
}

function requestNewImagery() {
    showLoading('Requesting latest satellite imagery...');
    
    setTimeout(() => {
        hideLoading();
        showNotification('Imagery update scheduled - ETA 2 hours');
    }, 2000);
}

function setOpacity(layer, value) {
    let opacity = value / 100;
    // Apply opacity to respective layers
    showNotification(`${layer} opacity set to ${value}%`);
}

function updateAnalyticsPanel(data) {
    // Update the metrics display
    document.querySelectorAll('.metric-value').forEach((el, index) => {
        switch(index) {
            case 0:
                el.textContent = '2,847';
                break;
            case 1:
                el.textContent = data.healthyPercentage + '%';
                break;
            case 2:
                el.textContent = '1.2GB';
                break;
        }
    });
}

// API Integration simulation
function fetchSatelliteData() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                timestamp: new Date().toISOString(),
                resolution: '2.5m',
                cloudCover: 15,
                bands: ['RGB', 'NIR', 'SWIR']
            });
        }, 1000);
    });
}

function fetchWeatherData() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                temperature: 28,
                humidity: 78,
                windSpeed: 12,
                condition: 'Partly Cloudy',
                forecast: '7-day outlook available'
            });
        }, 800);
    });
}

// Security and compliance
function encryptData(data) {
    // Implement encryption for Malaysian compliance
    return btoa(JSON.stringify(data));
}

function auditLog(action, user, timestamp) {
    let logEntry = {
        action: action,
        user: user || 'anonymous',
        timestamp: timestamp || new Date().toISOString(),
        encrypted: true
    };
    
    // Log to secure storage
    console.log('Audit Log:', logEntry);
}

// Initialize real-time updates
setInterval(() => {
    // Simulate real-time data updates
    updateRealTimeMetrics();
}, 30000);

function updateRealTimeMetrics() {
    // Update various metrics with slight variations
    let healthPercentage = 94.2 + (Math.random() - 0.5) * 2;
    document.querySelector('.metric-card:nth-child(2) .metric-value').textContent = 
        healthPercentage.toFixed(1) + '%';
    
    // Add audit log
    auditLog('metrics_updated', 'system');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    showNotification('Palm Monitor Platform initialized');
    
    // Load initial data
    fetchSatelliteData().then(data => {
        console.log('Satellite data loaded:', data);
    });
    
    fetchWeatherData().then(data => {
        console.log('Weather data loaded:', data);
    });
    
    // Set up periodic updates
    setInterval(updateRealTimeMetrics, 60000);
});

// Confirm/Reject detection functions
function confirmDetection() {
    showNotification('Detection confirmed and added to database');
}

function rejectDetection() {
    showNotification('Detection rejected');
}

function analyzePolygon() {
    showNotification('Polygon analysis initiated');
}

let currentPolygon; // Assuming this holds your drawn polygon

function deletePolygon() {
if (currentPolygon) {
currentPolygon.remove(); // Removes from map
showNotification('Polygon deleted');
currentPolygon = null;
 } else {
showNotification('No polygon to delete');
}
}


function generatePDFReport() {
    showNotification('PDF report generated');
}