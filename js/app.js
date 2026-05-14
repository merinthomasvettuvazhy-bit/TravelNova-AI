const map = L.map("map", {
  zoomControl: true
}).setView([12.9716, 77.5946], 13);

/* =========================================
   MAP FIX
========================================= */

setTimeout(() => {
  map.invalidateSize();
}, 500);

/* =========================================
   BASE MAP
========================================= */

/* =========================================
   MAP THEMES
========================================= */

const darkMapLayer =
L.tileLayer(

"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",

{
  attribution:"© OpenStreetMap © CARTO",
  maxZoom:20
}

);

const lightMapLayer =
L.tileLayer(

"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

{
  attribution:"© OpenStreetMap",
  maxZoom:20
}

);

/* =========================================
   DEFAULT THEME
========================================= */

let darkMode = true;

darkMapLayer.addTo(map);

/* =========================================
   VARIABLES
========================================= */

let routeControl = null;

let userLat = null;
let userLng = null;

let selectedPlaceName = "";
let selectedLat = null;
let selectedLng = null;

let userMarker = null;
let destinationMarker = null;
let selectedDestinationAddress = "";

let navigationStarted = false;
let watchId = null;

let routeCoordinates = [];
let currentStepIndex = 0;

let weatherUpdateTimer = null;

let trafficLayer = null;
let trafficMonitoring = false;
const TOMTOM_API_KEY = "rx9GTkIOIuZ1Dq8D3TKwigfAQxqiDhSJ";

let nearbyMarkers = [];

window.routeSteps = [];

/* =========================================
   LIVE TRACKING
========================================= */

let liveTrackingEnabled = false;

let trackingShareId =
Math.random()
.toString(36)
.substring(2,10);

let trackingUpdateInterval = null;

/* =========================================
   SEARCH DROPDOWN
========================================= */

const mainSearchBar =
document.getElementById("mainSearchBar");

const searchDropdown =
document.getElementById("searchDropdown");

mainSearchBar.onclick = () => {

  searchDropdown.style.display =
  searchDropdown.style.display === "block"
  ? "none"
  : "block";

};

/* =========================================
   LOCATION
========================================= */

/* =========================================
   LOCATION
========================================= */

navigator.geolocation.getCurrentPosition(

(position) => {

  const lat = position.coords.latitude;
  const lng = position.coords.longitude;

  userLat = lat;
  userLng = lng;

  /* ---------- DEFAULT START LOCATION ---------- */

  selectedStartLat = lat;
  selectedStartLng = lng;

  map.setView([lat, lng], 15);

  showWeather("current");

  /* =====================================
     START INPUT DEFAULT TEXT
  ===================================== */

  const startInput =
  document.getElementById("startInput");

  startInput.value = "Current Location";

  /* =====================================
     ALLOW USER TO EDIT MANUALLY
  ===================================== */

  startInput.removeAttribute("readonly");

  startInput.addEventListener("focus", ()=>{

    if(
      startInput.value === "Current Location"
    ){

      startInput.select();

    }

  });

  /* =====================================
     USER MARKER
  ===================================== */

  const userIcon = L.icon({

    iconUrl:
    "https://cdn-icons-png.flaticon.com/512/744/744465.png",

    iconSize:[45,45],
    iconAnchor:[22,22]

  });

  userMarker =
  L.marker(
    [lat,lng],
    {
      draggable:true,
      icon:userIcon
    }
  )
  .addTo(map)
  .bindPopup("📍 You are here")
  .openPopup();

  /* =====================================
     DRAG USER MARKER
  ===================================== */

  userMarker.on("dragend", ()=>{

    const pos =
    userMarker.getLatLng();

    userLat = pos.lat;
    userLng = pos.lng;

    selectedStartLat = pos.lat;
    selectedStartLng = pos.lng;

    map.flyTo(
      [pos.lat,pos.lng],
      16
    );

    showWeather(
      "destination",
      pos.lat,
      pos.lng
    );

  });

},

(err)=>{

  console.log(err);

  alert("Location access denied");

}

);

/* =========================================
   START LOCATION AUTOCOMPLETE
========================================= */

const startInput =
document.getElementById(
  "startInput"
);

startInput.addEventListener(
"input",
async ()=>{

  const query =
  startInput.value;

  /* ---------- IGNORE EMPTY ---------- */

  if(
    query.length < 2 ||
    query === "Current Location"
  ){

    return;

  }

  try{

    const response =
    await fetch(
`https://photon.komoot.io/api/?q=${query}`
    );

    const data =
    await response.json();

    /* ---------- CREATE DROPDOWN ---------- */

    let startSuggestions =
    document.getElementById(
      "startSuggestions"
    );

    if(!startSuggestions){

      startSuggestions =
      document.createElement("div");

      startSuggestions.id =
      "startSuggestions";

      startSuggestions.className =
      "suggestionsBox";

      startInput.parentNode.appendChild(
        startSuggestions
      );

    }

    startSuggestions.innerHTML = "";

    data.features
    .slice(0,5)
    .forEach(place=>{

      const div =
      document.createElement("div");

      div.className =
      "suggestionItem";

      div.innerText =
      (place.properties.name || "")
      + " "
      + (place.properties.city || "");

      div.onclick = ()=>{

        const lat =
        place.geometry.coordinates[1];

        const lng =
        place.geometry.coordinates[0];

        startInput.value =
        div.innerText;

        userLat = lat;
        userLng = lng;

        selectedStartLat = lat;
        selectedStartLng = lng;

        flyToLocation(
          lat,
          lng,
          16
        );

        if(userMarker){

          userMarker.setLatLng(
            [lat,lng]
          );

        }

        startSuggestions.innerHTML = "";

      };

      startSuggestions.appendChild(div);

    });

  }catch(e){

    console.log(e);

  }

});
/* =========================================
   NAVIGATION
========================================= */

document.getElementById(
  "goBtn"
).onclick = async ()=>{

  const destination =
  destinationInput.value;

  if(!destination){

    alert("Enter destination");
    return;

  }

  searchDropdown.style.display =
  "none";

  try{

    const res =
    await fetch(
`https://photon.komoot.io/api/?q=${destination}`
    );

    const data =
    await res.json();

    if(!data.features.length){

      alert("Destination not found");
      return;

    }

    const destLat =
    data.features[0]
    .geometry.coordinates[1];

    const destLng =
    data.features[0]
    .geometry.coordinates[0];

    selectedLat = destLat;
    selectedLng = destLng;

    if(!userLat || !userLng){

      alert("User location unavailable");
      return;

    }

await generateRoute(
  userLat,
  userLng,
  destLat,
  destLng
);

await createOrUpdateDestinationMarker(
  destLat,
  destLng,
  destination
);

    addMessage(
      "🧭 Route generated successfully",
      "bot"
    );

    speak(
      "Route generated successfully"
    );

  }catch(e){

    console.log(e);

    alert("Navigation failed");

  }

};

/* =========================================
   UNIVERSAL ROUTE GENERATOR
========================================= */

async function generateRoute(
startLat,
startLng,
destLat,
destLng
){

  try{

    if(routeControl){

      map.removeLayer(
        routeControl
      );

    }

    currentStepIndex = 0;

    routeCoordinates = [];

    const routeUrl =

`https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;

    const routeRes =
    await fetch(routeUrl);

    const routeData =
    await routeRes.json();

    if(
      !routeData.routes ||
      !routeData.routes.length
    ){

      alert("Route unavailable");
      return;

    }

    window.routeSteps =
    routeData.routes[0]
    .legs[0]
    .steps;

    const coords =
    routeData.routes[0]
    .geometry.coordinates;

    const latlngs =
    coords.map(c=>[c[1],c[0]]);

    routeCoordinates =
    latlngs;

    routeControl =
    L.polyline(
      latlngs,
      {
        color:"#00E5FF",
        weight:6,
        opacity:0.95
      }
    ).addTo(map);

    map.fitBounds(
      routeControl.getBounds()
    );

    syncAdvancedMap();

    addMessage(
      "🧭 Route updated",
      "bot"
    );

  }catch(e){

    console.log(e);

  }
  startSmartTravelSystem();

}

/* =========================================
   CHATBOT
========================================= */

document
.getElementById("robotBtn")
.onclick = ()=>{

  const bot =
  document.getElementById(
    "chatbot"
  );

  bot.style.display =
  (bot.style.display === "flex")
  ? "none"
  : "flex";

};

document
.getElementById("closeChatBtn")
.onclick = ()=>{

  document
  .getElementById("chatbot")
  .style.display = "none";

};

document
.getElementById("sendBtn")
.onclick = sendMessage;

function sendMessage(){

  const input =
  document.getElementById(
    "chatInput"
  );

  const msg =
  input.value.trim();

  if(!msg) return;

  addMessage(msg,"user");

  input.value = "";

  handleBotCommand(msg);

}

async function handleBotCommand(msg){

  const text =
  msg.toLowerCase();

  addMessage(
    "🤖 Processing request...",
    "bot"
  );

  await new Promise(
    r=>setTimeout(r,500)
  );

  if(text.includes("weather")){

    showWeather("current");

    addMessage(
      "🌦 Showing weather",
      "bot"
    );

    return;

  }

  if(
    text.includes("go to")
    ||
    text.includes("navigate")
  ){

    const place =
    text
    .replace("go to","")
    .replace("navigate","")
    .trim();

    searchDestination(place);

    return;

  }

  if(text.includes("traffic")){

    document
    .getElementById("trafficBtn")
    .click();

    return;

  }

  if(
    text.includes("safety")
    ||
    text.includes("pulse")
  ){

    openSafety();

    return;

  }

  /* =========================================
   UI CONTROL COMMANDS
========================================= */

if (text.includes("dark mode")) {

  if (!darkMode) {
    darkBtn.click();
  }

  addMessage("🌙 Dark mode enabled", "bot");
  speak("Dark mode enabled");
  return;
}

if (text.includes("light mode")) {

  if (darkMode) {
    darkBtn.click();
  }

  addMessage("☀ Light mode enabled", "bot");
  speak("Light mode enabled");
  return;
}

if (text.includes("theme")) {

  darkBtn.click();

  addMessage("🎨 Theme toggled", "bot");
  speak("Theme changed");
  return;
}

if (text.includes("advance map on")) {

  if (!advanceMapEnabled) {
    advanceMapBtn.click();
  }

  addMessage("🗺 Advanced map enabled", "bot");
  speak("Advanced map enabled");
  return;
}

if (text.includes("advance map off")) {

  if (advanceMapEnabled) {
    advanceMapBtn.click();
  }

  addMessage("🗺 Advanced map disabled", "bot");
  speak("Advanced map disabled");
  return;
}

if (text.includes("share location") || 
text.includes("share live") || 
text.includes("share") || 
text.includes("share map") || text.includes("map share") || 
text.includes("share live location") ||
text.includes("share live traffic") ) {

  shareBtn.click();

  addMessage("📡 Sharing live location", "bot");
  speak("Sharing live location");
  return;
}

  addMessage(
`🤖 Try:
• weather
• traffic
• PulseX
• dark mode
• light mode
• theme
• advance map on
• advance map off
• share location`,
"bot");

}

function addMessage(text,type){

  const div =
  document.createElement("div");

  div.className =
  "message " + type;

  div.innerText = text;

  const chat =
  document.getElementById(
    "chatMessages"
  );

  chat.appendChild(div);

  chat.scrollTop =
  chat.scrollHeight;

}

/* =========================================
   DESTINATION SEARCH
========================================= */

async function searchDestination(place){

  try{

    const url =
`https://photon.komoot.io/api/?q=${place}`;

    const res =
    await fetch(url);

    const data =
    await res.json();

    if(!data.features.length){

      addMessage(
        "❌ Not found",
        "bot"
      );

      return;

    }

    const lat =
    data.features[0]
    .geometry.coordinates[1];

    const lng =
    data.features[0]
    .geometry.coordinates[0];
 
flyToLocation(lat, lng, 15);

    if(destinationMarker){

      map.removeLayer(
        destinationMarker
      );

    }

    destinationMarker =
    L.marker([lat,lng])
    .addTo(map)
    .bindPopup(place)
    .openPopup();
     
    syncAdvancedMap();

  }catch(e){

    console.log(e);

  }

}

/* =========================================
   DESTINATION MARKER SYSTEM
========================================= */

async function createOrUpdateDestinationMarker(
lat,
lng,
address = "Destination"
){

  selectedLat = lat;
  selectedLng = lng;

  selectedDestinationAddress =
  address;

  /* ---------- REMOVE OLD ---------- */

  if(destinationMarker){

    map.removeLayer(
      destinationMarker
    );

  }

  /* ---------- LEAFLET MARKER ---------- */

  destinationMarker =
  L.marker(
    [lat,lng],
    {
      draggable:true
    }
  )
  .addTo(map)
  .bindPopup(
    `📍 ${address}`
  )
  .openPopup();

  /* ---------- UPDATE INPUT ---------- */

  document
  .getElementById(
    "destinationInput"
  ).value = address;

  /* ---------- DRAGGING ---------- */

  destinationMarker.on(
    "dragend",
    async ()=>{

      const pos =
      destinationMarker.getLatLng();

      selectedLat = pos.lat;
      selectedLng = pos.lng;

      const placeName =
      await reverseGeocode(
        pos.lat,
        pos.lng
      );

      document
      .getElementById(
        "destinationInput"
      ).value = placeName;

      destinationMarker
      .bindPopup(
        `📍 ${placeName}`
      )
      .openPopup();

      syncAdvancedMap();

      if(userLat && userLng){

        generateRoute(
          userLat,
          userLng,
          pos.lat,
          pos.lng
        );

      }

    }
  );

  syncAdvancedMap();

}

/* =========================================
   REVERSE GEOCODING
========================================= */

async function reverseGeocode(
lat,
lng
){

  try{

    const url =

`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

    const res =
    await fetch(url);

    const data =
    await res.json();

    return (
      data.display_name
      || "Selected Destination"
    );

  }catch(e){

    console.log(e);

    return "Selected Destination";

  }

}

/* =========================================
   WEATHER SYSTEM
========================================= */

async function showWeather(
type="current",
lat=null,
lng=null
){

  try{

    if(type === "current"){

      lat = userLat;
      lng = userLng;

    }

    if(!lat || !lng) return;

    document
    .getElementById("weather")
    .innerText =
    "🌦 Loading...";

    const url =
`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m`;

    const res =
    await fetch(url);

    const data =
    await res.json();

    const temp =
    data.current.temperature_2m;

    const wind =
    data.current.wind_speed_10m;

    const humidity =
    data.current.relative_humidity_2m;

    document
    .getElementById("weather")
    .innerText =
`🌡 ${temp}°C | 💨 ${wind} km/h | 💧 ${humidity}%`;

  }catch(e){

    console.log(e);

    document
    .getElementById("weather")
    .innerText =
    "❌ Weather unavailable";

  }

}

/* =========================================
   DARK MODE SYSTEM
========================================= */

const weatherContainer =
document.getElementById("weather");

/* ---------- CREATE BUTTON ---------- */

const darkBtn =
document.createElement("button");

darkBtn.id = "darkModeBtn";

darkBtn.innerHTML =
"🌙 Dark Mode";

/* ---------- INSERT LEFT OF WEATHER ---------- */

weatherContainer.parentNode.insertBefore(
  darkBtn,
  weatherContainer
);

/* =========================================
   APPLY THEME
========================================= */

function applyTheme(){

  /* ---------- DARK MODE ---------- */

  if(darkMode){

    if(map.hasLayer(lightMapLayer)){

      map.removeLayer(
        lightMapLayer
      );

    }

    darkMapLayer.addTo(map);

    darkBtn.innerHTML =
    "🌙 Dark Mode";

    document.body.classList.add(
      "darkTheme"
    );

  }

  /* ---------- LIGHT MODE ---------- */

  else{

    if(map.hasLayer(darkMapLayer)){

      map.removeLayer(
        darkMapLayer
      );

    }

    lightMapLayer.addTo(map);

    darkBtn.innerHTML =
    "☀ Light Mode";

    document.body.classList.remove(
      "darkTheme"
    );

  }

  /* ---------- KEEP TRAFFIC ABOVE MAP ---------- */

  if(trafficMonitoring && trafficLayer){

    trafficLayer.bringToFront();

  }

  /* ---------- SAVE ---------- */

  localStorage.setItem(
    "travelnova_darkmode",
    darkMode
  );

}

/* =========================================
   BUTTON CLICK
========================================= */

darkBtn.onclick = ()=>{

  darkMode = !darkMode;

  applyTheme();

};

/* =========================================
   LOAD SAVED THEME
========================================= */

const savedTheme =
localStorage.getItem(
  "travelnova_darkmode"
);

if(savedTheme !== null){

  darkMode =
  savedTheme === "true";

}

applyTheme();

/* =========================================
   ADVANCE MAP BUTTON (FIXED STABLE VERSION)
========================================= */

let advanceMapEnabled = false;
let mapLibreMap = null;

const mapContainer = document.getElementById("map");
const mapLibreContainer = document.getElementById("maplibre");

/* =========================================
   UNIVERSAL MAP HELPERS
========================================= */

function flyToLocation(lat, lng, zoom = 15) {

  if (advanceMapEnabled && mapLibreMap) {
    mapLibreMap.flyTo({
      center: [lng, lat],
      zoom: zoom
    });
  } else {
    map.flyTo([lat, lng], zoom);
  }
}

function setMapCenter(lat, lng, zoom = 15) {

  if (advanceMapEnabled && mapLibreMap) {
    mapLibreMap.setCenter([lng, lat]);
    mapLibreMap.setZoom(zoom);
  } else {
    map.setView([lat, lng], zoom);
  }
}

/* =========================================
   BUTTON
========================================= */

const advanceMapBtn = document.createElement("button");
advanceMapBtn.id = "advanceMapBtn";
advanceMapBtn.innerHTML = "🗺 Advance Map";

darkBtn.insertAdjacentElement("afterend", advanceMapBtn);

/* =========================================
   LIVE TRACKING SHARE BUTTON
========================================= */

const shareBtn = document.getElementById("nearbyBtn");

shareBtn.onclick = () => {

  if (!userLat || !userLng) {
    alert("Location unavailable");
    return;
  }

  startLiveTracking();
};

/* =========================================
   INIT MAPLIBRE (SAFE CREATOR)
========================================= */

/* =========================================
   INIT MAPLIBRE
========================================= */

function initMapLibre() {

  if (mapLibreMap) return;

  mapLibreMap = new maplibregl.Map({

    container: "maplibre",

    style:
"https://api.maptiler.com/maps/019e1b06-64f2-7466-9694-5ae9ce6dc189/style.json?key=i7UTbCoRIUapttoYJMwv",

    center: [
      userLng || 77.5946,
      userLat || 12.9716
    ],

    zoom: 15

  });

  mapLibreMap.on(
    "load",
    ()=>{

      renderAdvancedMapLayers();

      /* =====================================
         CLICK ADVANCED MAP
      ===================================== */

      mapLibreMap.on(
        "click",
        async (e)=>{

          const lat =
          e.lngLat.lat;

          const lng =
          e.lngLat.lng;

          const placeName =
          await reverseGeocode(
            lat,
            lng
          );

          await createOrUpdateDestinationMarker(
            lat,
            lng,
            placeName
          );

          if(userLat && userLng){

            await generateRoute(
              userLat,
              userLng,
              lat,
              lng
            );

          }

        }
      );

    }
  );

}

/* =========================================
   RENDER MARKERS + ROUTE
========================================= */

/* =========================================
   RENDER MARKERS + ROUTE (FIXED)
========================================= */

function renderAdvancedMapLayers() {

  if (!mapLibreMap) return;

  /* =====================================
     REMOVE OLD USER MARKER
  ===================================== */

  if (window.advancedUserMarker) {

    window.advancedUserMarker.remove();

  }

  /* =====================================
     REMOVE OLD DESTINATION MARKER
  ===================================== */

  if (window.advancedDestinationMarker) {

    window.advancedDestinationMarker.remove();

  }

  /* =====================================
     USER MARKER
  ===================================== */

  if (userLat && userLng) {

    window.advancedUserMarker =
    new maplibregl.Marker({
      color: "#00E5FF"
    })
    .setLngLat([userLng, userLat])
    .addTo(mapLibreMap);

  }

  /* =====================================
     DESTINATION MARKER
  ===================================== */

  if (selectedLat && selectedLng) {

    window.advancedDestinationMarker =
new maplibregl.Marker({
  color:"#ff1744",
  draggable:true
})
.setLngLat([
  selectedLng,
  selectedLat
])
.addTo(mapLibreMap);

/* ---------- DRAGGING ---------- */

window.advancedDestinationMarker.on(
  "dragend",
  async ()=>{

    const lngLat =
    window
    .advancedDestinationMarker
    .getLngLat();

    selectedLat =
    lngLat.lat;

    selectedLng =
    lngLat.lng;

    const placeName =
    await reverseGeocode(
      lngLat.lat,
      lngLat.lng
    );

    await createOrUpdateDestinationMarker(
      lngLat.lat,
      lngLat.lng,
      placeName
    );

    if(userLat && userLng){

      await generateRoute(
        userLat,
        userLng,
        lngLat.lat,
        lngLat.lng
      );

    }

  }
);

  }

  /* =====================================
     ROUTE
  ===================================== */

  if (routeCoordinates.length) {

    const geojson = {

      type: "Feature",

      geometry: {

        type: "LineString",

        coordinates:
        routeCoordinates.map(c => [
          c[1],
          c[0]
        ])

      }

    };

    /* ---------- CREATE SOURCE ---------- */

    if (!mapLibreMap.getSource("route")) {

      mapLibreMap.addSource("route", {

        type: "geojson",
        data: geojson

      });

      mapLibreMap.addLayer({

        id: "route",

        type: "line",

        source: "route",

        paint: {

          "line-color": "#00E5FF",
          "line-width": 6

        }

      });

    }

    /* ---------- UPDATE ROUTE ---------- */

    else {

      mapLibreMap
      .getSource("route")
      .setData(geojson);

    }

  }

}

/* =========================================
   TOGGLE BUTTON LOGIC (FIXED)
========================================= */

advanceMapBtn.onclick = () => {

  advanceMapEnabled = !advanceMapEnabled;

  /* ================= ENABLE ================= */
  if (advanceMapEnabled) {

    mapContainer.style.display = "none";
    mapLibreContainer.style.display = "block";

    initMapLibre();

    setTimeout(() => {
      mapLibreMap.resize();
    }, 200);

    if (userLat && userLng) {
      mapLibreMap.flyTo({
        center: [userLng, userLat],
        zoom: 16
      });
    }

    renderAdvancedMapLayers();

    advanceMapBtn.innerHTML = "🚀 Advanced ON";

    addMessage("🗺 Advanced map enabled", "bot");
    speak("Advanced map enabled");
  }

  /* ================= DISABLE ================= */
  else {

    mapLibreContainer.style.display = "none";
    mapContainer.style.display = "block";

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    advanceMapBtn.innerHTML = "🗺 Advance Map";

    addMessage("🗺 Advanced map disabled", "bot");
    speak("Advanced map disabled");
  }
};

/* =========================================
   SYNC FUNCTION (UPDATED SAFE VERSION)
========================================= */

function syncAdvancedMap() {

  if (!advanceMapEnabled || !mapLibreMap) return;

  renderAdvancedMapLayers();

  if (userLat && userLng) {
    mapLibreMap.flyTo({
      center: [userLng, userLat],
      zoom: 16
    });
  }
}
/* =========================================
   SAFETY
========================================= */

function openSafety(){

  window.open(
"https://merinthomasvettuvazhy-bit.github.io/PulseX/",
"_blank"
  );

}

/* =========================================
   TRAFFIC SYSTEM
========================================= */
/* =========================================
   ULTRA LIVE TRAFFIC SYSTEM
========================================= */

let trafficIncidentMarkers = [];
let trafficRefreshInterval = null;

/* =========================================
   TRAFFIC BUTTON
========================================= */

document
.getElementById("trafficBtn")
.onclick = async ()=>{

  /* =====================================
     DISABLE TRAFFIC
  ===================================== */

  if(trafficMonitoring){

    trafficMonitoring = false;

    /* ---------- REMOVE FLOW LAYER ---------- */

    if(trafficLayer){

      map.removeLayer(trafficLayer);
      trafficLayer = null;

    }

    /* ---------- REMOVE INCIDENTS ---------- */

    trafficIncidentMarkers.forEach(marker=>{

      map.removeLayer(marker);

    });

    trafficIncidentMarkers = [];

    /* ---------- STOP AUTO REFRESH ---------- */

    if(trafficRefreshInterval){

      clearInterval(
        trafficRefreshInterval
      );

    }

    addMessage(
      "🚦 Live traffic disabled",
      "bot"
    );

    speak(
      "Live traffic disabled"
    );

    return;

  }

  /* =====================================
     ENABLE TRAFFIC
  ===================================== */

  trafficMonitoring = true;

  /* ---------- LIVE FLOW LAYER ---------- */

  trafficLayer =
  L.tileLayer(

`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?tileSize=256&style=relative&key=${TOMTOM_API_KEY}`,

    {
      tileSize:256,
      opacity:0.95,
      attribution:"© TomTom Traffic",
      zIndex:999
    }

  ).addTo(map);

  /* ---------- LOAD INCIDENTS ---------- */

  await loadLiveTrafficIncidents();

  /* ---------- AUTO REFRESH ---------- */

  trafficRefreshInterval =
  setInterval(()=>{

    if(trafficMonitoring){

      loadLiveTrafficIncidents();

    }

  },60000);

  addMessage(
    "🚦 Ultra live traffic enabled",
    "bot"
  );

  speak(
    "Ultra live traffic enabled"
  );

};

/* =========================================
   LOAD LIVE INCIDENTS
========================================= */

async function loadLiveTrafficIncidents(){

  try{

    /* ---------- CLEAR OLD INCIDENTS ---------- */

    trafficIncidentMarkers.forEach(marker=>{

      map.removeLayer(marker);

    });

    trafficIncidentMarkers = [];

    /* ---------- GET MAP BOUNDS ---------- */

    const bounds =
    map.getBounds();

    const bbox =
`${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    /* ---------- INCIDENT API ---------- */

    const incidentUrl =

`https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description},startTime,endTime}}}&language=en-GB&t=1111&key=${TOMTOM_API_KEY}`;

    const response =
    await fetch(incidentUrl);

    const data =
    await response.json();

    if(
      !data.incidents ||
      !data.incidents.length
    ){

      addMessage(
        "✅ No traffic incidents nearby",
        "bot"
      );

      return;

    }

    /* ---------- CREATE INCIDENTS ---------- */

    data.incidents.forEach(incident=>{

      try{

        const coords =
        incident.geometry.coordinates;

        if(!coords || !coords.length)
        return;

        const lng =
        coords[0][0];

        const lat =
        coords[0][1];

        const description =
        incident.properties
        ?.events?.[0]
        ?.description
        || "Traffic alert";

        const delay =
        incident.properties
        ?.magnitudeOfDelay || 0;

        /* =====================================
           NEON STYLING
        ===================================== */

        let bgColor = "#00E5FF";
        let pulseColor = "#00E5FF";
        let trafficLabel = "LIVE";

        const lowerDesc =
        description.toLowerCase();

        /* ---------- ROAD CLOSED ---------- */

        if(
          lowerDesc.includes("closed")
        ){

          bgColor = "#ff1744";
          pulseColor = "#ff1744";
          trafficLabel = "CLOSED";

        }

        /* ---------- ACCIDENT ---------- */

        else if(
          lowerDesc.includes("accident")
        ){

          bgColor = "#ff3d00";
          pulseColor = "#ff3d00";
          trafficLabel = "CRASH";

        }

        /* ---------- CONSTRUCTION ---------- */

        else if(
          lowerDesc.includes("construction")
        ){

          bgColor = "#FFD600";
          pulseColor = "#FFD600";
          trafficLabel = "WORK";

        }

        /* ---------- JAM ---------- */

        else if(
          lowerDesc.includes("jam")
        ){

          bgColor = "#ff9100";
          pulseColor = "#ff9100";
          trafficLabel = "JAM";

        }

        /* ---------- DELAY LEVEL ---------- */

        if(delay >= 3){

          bgColor = "#ff1744";
          pulseColor = "#ff1744";

        }

        /* =====================================
           MODERN DIV ICON
        ===================================== */

        const trafficIcon =
        L.divIcon({

          className:
          "modernTrafficMarker",

          html:`

          <div
          class="trafficPulse"
          style="
            --pulse:${pulseColor};
          ">
          </div>

          <div
          class="trafficCore"
          style="
            background:${bgColor};

            box-shadow:
            0 0 15px ${pulseColor},
            0 0 30px ${pulseColor},
            0 0 60px ${pulseColor};
          ">

            <div class="trafficDot"></div>

            <span class="trafficText">
              ${trafficLabel}
            </span>

          </div>

          `,

          iconSize:[90,90],
          iconAnchor:[45,45]

        });

        /* =====================================
           CREATE MARKER
        ===================================== */

        const marker =
        L.marker(
          [lat,lng],
          {
            icon:trafficIcon
          }
        )
        .addTo(map)
        .bindPopup(

`
<div class="trafficPopup">

  <div class="trafficPopupTitle">
    ${trafficLabel}
  </div>

  <div class="trafficPopupDesc">
    ${description}
  </div>

  <div class="trafficPopupDelay">
    Delay Level:
    ${delay}
  </div>

</div>
`

        );

        trafficIncidentMarkers.push(
          marker
        );

      }catch(e){

        console.log(
          "Marker error:",
          e
        );

      }

    });

  }catch(e){

    console.log(
      "Traffic API Error:",
      e
    );

    addMessage(
      "❌ Traffic service unavailable",
      "bot"
    );

  }

}

/* =========================================
   REFRESH INCIDENTS WHEN MAP MOVES
========================================= */

map.on(
  "moveend",
  ()=>{

    if(trafficMonitoring){

      loadLiveTrafficIncidents();

    }

  }
);

/* =========================================
   CLICK MAP TO SET DESTINATION
========================================= */

map.on(
"click",
async (e)=>{

  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  const placeName =
  await reverseGeocode(
    lat,
    lng
  );

  await createOrUpdateDestinationMarker(
    lat,
    lng,
    placeName
  );

  if(userLat && userLng){

    await generateRoute(
      userLat,
      userLng,
      lat,
      lng
    );

  }

}
);

/* =========================================
   MODERN TRAFFIC CSS
========================================= */

const trafficStyle =
document.createElement("style");

trafficStyle.innerHTML = `

/* =====================================
   TRAFFIC MARKER ROOT
===================================== */

.modernTrafficMarker{

  background:transparent !important;
  border:none !important;

}

/* =====================================
   PULSE EFFECT
===================================== */

.trafficPulse{

  position:absolute;

  width:70px;
  height:70px;

  border-radius:50%;

  background:var(--pulse);

  opacity:0.25;

  top:10px;
  left:10px;

  filter:blur(5px);

  animation:
  trafficPulseAnim 2s infinite;

}

/* =====================================
   MAIN CORE
===================================== */

.trafficCore{

  position:absolute;

  width:70px;
  height:70px;

  border-radius:50%;

  border:3px solid rgba(
    255,
    255,
    255,
    0.9
  );

  display:flex;
  align-items:center;
  justify-content:center;
  flex-direction:column;

  backdrop-filter:blur(15px);

  animation:
  trafficFloat 3s ease-in-out infinite;

}

/* =====================================
   CENTER DOT
===================================== */

.trafficDot{

  width:14px;
  height:14px;

  border-radius:50%;

  background:white;

  margin-bottom:6px;

  box-shadow:
  0 0 12px white,
  0 0 25px white;

}

/* =====================================
   TEXT
===================================== */

.trafficText{

  font-size:9px;

  font-weight:800;

  color:white;

  letter-spacing:1px;

  text-shadow:
  0 0 8px white;

}

/* =====================================
   POPUP
===================================== */

.trafficPopup{

  min-width:200px;

  color:#111;

  font-family:sans-serif;

}

.trafficPopupTitle{

  font-size:15px;
  font-weight:800;

  margin-bottom:8px;

}

.trafficPopupDesc{

  font-size:13px;

  line-height:1.5;

  margin-bottom:10px;

}

.trafficPopupDelay{

  font-size:12px;

  color:#666;

}

/* =====================================
   ANIMATIONS
===================================== */

@keyframes trafficPulseAnim{

  0%{

    transform:scale(0.8);
    opacity:0.55;

  }

  70%{

    transform:scale(1.7);
    opacity:0;

  }

  100%{

    opacity:0;

  }

}

@keyframes trafficFloat{

  0%{
    transform:translateY(0px);
  }

  50%{
    transform:translateY(-6px);
  }

  100%{
    transform:translateY(0px);
  }

}

`;

document.head.appendChild(
  trafficStyle
);

/* =========================================
   VOICE NAVIGATION
========================================= */

const voiceBtn =
document.getElementById(
  "voiceBtn"
);

voiceBtn.onclick = ()=>{

  if(!routeCoordinates.length){

    alert(
      "Generate route first"
    );

    return;

  }

  if(navigationStarted){

    stopNavigation();
    return;

  }

  startNavigation();

};

function startNavigation(){

  navigationStarted = true;

  addMessage(
    "🎤 Voice navigation activated",
    "bot"
  );

  speak(
    "Voice navigation activated"
  );

  weatherUpdateTimer =
  setInterval(()=>{

    if(userLat && userLng){

      showWeather(
        "destination",
        userLat,
        userLng
      );

    }

  },300000);

  watchId =
  navigator.geolocation.watchPosition(

    (position)=>{

      const lat =
      position.coords.latitude;

      const lng =
      position.coords.longitude;

      userLat = lat;
      userLng = lng;
      syncAdvancedMap();

    flyToLocation(lat, lng, 18);

      if(userMarker){

        userMarker.setLatLng(
          [lat,lng]
        );

      }

      const speed =
      position.coords.speed;

      if(speed !== null){

        const kmh =
        speed * 3.6;

        if(kmh < 10){

          addMessage(
            "🚦 Heavy traffic detected",
            "bot"
          );

        }
        else if(kmh < 25){

          addMessage(
            "🚦 Moderate traffic detected",
            "bot"
          );

        }
        handleLiveSpeed(position);
        refreshSmartTravel();
      }

      checkNavigationStep(
        lat,
        lng
      );

    },

    (err)=>{

      console.log(err);

    },

    {
      enableHighAccuracy:true
    }
  );

}

function stopNavigation(){

  navigationStarted = false;

  navigator
  .geolocation
  .clearWatch(watchId);

  clearInterval(
    weatherUpdateTimer
  );

  addMessage(
    "🛑 Navigation stopped",
    "bot"
  );
stopSmartTravelSystem();

}

function checkNavigationStep(
lat,
lng
){

  if(!window.routeSteps)
  return;

  const step =
  window.routeSteps[
    currentStepIndex
  ];

  if(!step)
  return;

  const stepLat =
  step.maneuver.location[1];

  const stepLng =
  step.maneuver.location[0];

  const distance =
  map.distance(
    [lat,lng],
    [stepLat,stepLng]
  );

  if(distance < 80){

    let instruction =
    step.maneuver.modifier
    || "straight";

    let road =
    step.name || "road";

    let text = "";

    if(
      instruction.includes("left")
    ){

      text =
      `Turn left to ${road}`;

    }
    else if(
      instruction.includes("right")
    ){

      text =
      `Turn right to ${road}`;

    }
    else{

      text =
      `Continue on ${road}`;

    }

    speak(text);

    addMessage(
      `🧭 ${text}`,
      "bot"
    );

    currentStepIndex++;

  }

  const finalPoint =
  routeCoordinates[
    routeCoordinates.length - 1
  ];

  if(!finalPoint)
  return;

  const finalDistance =
  map.distance(
    [lat,lng],
    finalPoint
  );

  if(finalDistance < 30){

    speak(
      "You have arrived"
    );

    addMessage(
      " Destination reached",
      "bot"
    );

    stopNavigation();

  }

}

/* =========================================
   LIVE WHATSAPP TRACKING SYSTEM
========================================= */

shareBtn.onclick = ()=>{

  if(!userLat || !userLng){

    alert("Location unavailable");
    return;

  }

  startLiveTracking();

};

/* =========================================
   START LIVE TRACKING
========================================= */

function startLiveTracking(){

  liveTrackingEnabled = true;

  /* ---------- CREATE VIEWER LINK ---------- */

  const trackingUrl =

`${window.location.origin}${window.location.pathname}?track=${trackingShareId}`;

  /* =====================================
     SAVE INITIAL DATA
  ===================================== */

  localStorage.setItem(

    "travelnova_tracking_" +
    trackingShareId,

    JSON.stringify({

      lat:userLat,
      lng:userLng,
      destination:selectedDestinationAddress,
      active:true

    })

  );

  /* =====================================
     AUTO UPDATE LOCATION
  ===================================== */

  if(trackingUpdateInterval){

    clearInterval(
      trackingUpdateInterval
    );

  }

  trackingUpdateInterval =
  setInterval(()=>{

    localStorage.setItem(

      "travelnova_tracking_" +
      trackingShareId,

      JSON.stringify({

        lat:userLat,
        lng:userLng,
        destination:selectedDestinationAddress,
        active:navigationStarted

      })

    );

  },3000);

  /* =====================================
     OPEN WHATSAPP SHARE
  ===================================== */

  const whatsappText =

`🚗 Live Trip Tracking

Track my live journey here:

${trackingUrl}

You can only view my live location.`;

  const whatsappUrl =

`https://wa.me/?text=${encodeURIComponent(
  whatsappText
)}`;

  window.open(
    whatsappUrl,
    "_blank"
  );

  addMessage(
    "📡 Live tracking link shared",
    "bot"
  );

  speak(
    "Live tracking enabled"
  );

}

/* =========================================
   VIEWER MODE
========================================= */

const urlParams =
new URLSearchParams(
  window.location.search
);

const trackingId =
urlParams.get("track");

/* =====================================
   VIEW ONLY MODE
===================================== */

if(trackingId){

  enableViewerMode(
    trackingId
  );

}

/* =========================================
   ENABLE VIEWER MODE
========================================= */

function enableViewerMode(id){

  /* ---------- HIDE CONTROLS ---------- */

  const elementsToHide = [

    "searchDropdown",
    "chatbot",
    "robotBtn",
    "voiceBtn",
    "trafficBtn"

  ];

  elementsToHide.forEach(el=>{

    const item =
    document.getElementById(el);

    if(item){

      item.style.display =
      "none";

    }

  });

  /* =====================================
     DISABLE MAP INTERACTION
  ===================================== */

  map.dragging.disable();

  map.touchZoom.disable();

  map.doubleClickZoom.disable();

  map.scrollWheelZoom.disable();

  map.boxZoom.disable();

  map.keyboard.disable();

  /* =====================================
     TRACK LIVE LOCATION
  ===================================== */

  setInterval(()=>{

    const saved =
    localStorage.getItem(

      "travelnova_tracking_" +
      id

    );

    if(!saved) return;

    const data =
    JSON.parse(saved);

    const lat =
    data.lat;

    const lng =
    data.lng;

    /* ---------- REMOVE OLD ---------- */

    if(window.viewerMarker){

      map.removeLayer(
        window.viewerMarker
      );

    }

    /* ---------- CREATE LIVE MARKER ---------- */

    const liveIcon =
    L.icon({

      iconUrl:
"https://cdn-icons-png.flaticon.com/512/684/684908.png",

      iconSize:[45,45],
      iconAnchor:[22,44]

    });

    window.viewerMarker =
    L.marker(
      [lat,lng],
      {
        icon:liveIcon
      }
    )
    .addTo(map)
    .bindPopup(
      `🚗 Driver Live Location`
    );

    map.setView(
      [lat,lng],
      15
    );

  },3000);

}

/* =========================================
   SPEECH SYSTEM
========================================= */

function speak(text){

  window.speechSynthesis.cancel();

  const speech =
  new SpeechSynthesisUtterance(
    text
  );

  speech.lang = "en-US";

  speech.rate = 0.95;

  speech.pitch = 1;

  speech.volume = 1;

  window.speechSynthesis.speak(
    speech
  );

}

/* =========================================
   VOICE COMMANDS
========================================= */

if(
  "webkitSpeechRecognition"
  in window
){

  const recognition =
  new webkitSpeechRecognition();

  recognition.continuous = true;

  recognition.interimResults = false;

  recognition.lang = "en-US";

  recognition.onresult =
  (event)=>{

    const text =
    event.results[
      event.results.length - 1
    ][0].transcript;

    addMessage(
      `🎤 ${text}`,
      "user"
    );

    handleBotCommand(text);

  };

  if(voiceBtn){

    voiceBtn.addEventListener(
      "dblclick",
      ()=>{

        recognition.start();

        speak(
          "Voice assistant activated"
        );

      }
    );

  }

}
/* =========================================
   SMART PANEL TOGGLE
========================================= */

const smartTravelPanel =
document.getElementById("smartTravelPanel");

const togglePanelBtn =
document.getElementById("togglePanelBtn");

let panelOpen = true;

togglePanelBtn.addEventListener("click", () => {

  panelOpen = !panelOpen;

  if(panelOpen){

    smartTravelPanel.classList.remove("collapsed");

    togglePanelBtn.innerHTML = "−";

  } else {

    smartTravelPanel.classList.add("collapsed");

    togglePanelBtn.innerHTML = "+";

  }

});
/* =========================================================
   1. ETA ENGINE
========================================================= */

function calculateSmartETA(distanceMeters, liveSpeedKmh, trafficLevel = "normal") {

  // 🔥 REALISTIC BASE SPEED (India city traffic model)
  let speed = liveSpeedKmh && liveSpeedKmh > 5 ? liveSpeedKmh : 22;

  // ---------------- TRAFFIC FACTOR (STRONGER) ----------------
  let trafficMultiplier = 1;

  if (trafficLevel === "heavy") trafficMultiplier = 3.0;
  else if (trafficLevel === "moderate") trafficMultiplier = 1.8;
  else if (trafficLevel === "light") trafficMultiplier = 1.2;

  // ---------------- TIME FACTOR ----------------
  const hour = new Date().getHours();
  let timeMultiplier = 1;

  // Peak Bangalore traffic windows
  if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) {
    timeMultiplier = 1.6;
  }

  // Late night slight improvement
  if (hour >= 23 || hour <= 5) {
    timeMultiplier = 0.85;
  }

  // ---------------- WEATHER FACTOR ----------------
  let weatherMultiplier = 1;

  const weatherText = document.getElementById("weather")?.innerText || "";

  if (
    weatherText.toLowerCase().includes("rain") ||
    weatherText.includes("💧")
  ) {
    weatherMultiplier = 1.4; // stronger impact
  }

  const distanceKm = distanceMeters / 1000;

  // 🔥 FINAL ETA
  let eta =
    (distanceKm / speed) *
    60 *
    trafficMultiplier *
    timeMultiplier *
    weatherMultiplier;

  return Math.max(5, eta);
}

function convertWeatherToSmartLabel(weatherText) {

  const text = (weatherText || "").toLowerCase();

  // 🌧️ Rain group
  if (text.includes("thunder")) return "🌧️ STORMY";
  if (text.includes("rain")) return "🌧️ RAINY";
  if (text.includes("drizzle") || text.includes("showers")) return "🌧️ SHOWERS";
  if (text.includes("wet")) return "🌧️ WET";

  // ☀️ Clear group
  if (text.includes("clear")) return "CLEAR";
  if (text.includes("sun")) return "☀️ SUNNY";
  if (text.includes("bright")) return "☀️ BRIGHT";
  if (text.includes("fair")) return "FAIR";
  if (text.includes("dry")) return "DRY";

  // ☁️ Cloud group
  if (text.includes("fog")) return "☁️ FOGGY";
  if (text.includes("mist")) return "☁️ MISTY";
  if (text.includes("cloud")) return "☁️ CLOUDY";
  if (text.includes("dark")) return "☁️ DARK";

  // 💨 Wind group
  if (text.includes("gust")) return "💨 GUSTY";
  if (text.includes("wind")) return "💨 WINDY";
  if (text.includes("breeze")) return "💨 BREEZY";

  // 🌡️ Cold group
  if (text.includes("snow")) return "☃️ SNOWY";
  if (text.includes("cold")) return "❄️ COLD";
  if (text.includes("chill")) return "❄️ CHILLY";
  if (text.includes("freeze")) return "❄️ FREEZING";

  // ☀️ default
  return "CLEAR";
}

/* =========================================================
   2. SMART PANEL UPDATER
========================================================= */

function updateSmartTravelPanel(distanceKm, etaMins, weatherText, trafficText) {

  document.getElementById("distanceValue").innerText =
    distanceKm ? `${distanceKm.toFixed(1)} km` : "-- km";

  document.getElementById("etaValue").innerText =
    etaMins ? `${Math.round(etaMins)} mins` : "-- mins";

  // ✅ FIX: actually convert and display
  const rawWeather = weatherText || document.getElementById("weather")?.innerText || "--";
  const smartWeather = convertWeatherToSmartLabel(rawWeather);

  document.getElementById("weatherValue").innerText =
    smartWeather;

  document.getElementById("trafficValue").innerText =
    trafficText || "--";
}

/* =========================================================
   3. LIVE SPEED TRACKING
========================================================= */

window.lastSpeedKmh = 35;

function handleLiveSpeed(position) {

  if (position.coords.speed !== null) {
    window.lastSpeedKmh = position.coords.speed * 3.6;
  }
}


/* =========================================================
   4. MAIN ETA + PANEL REFRESH ENGINE
========================================================= */

function refreshSmartTravel() {

  if (!routeCoordinates.length || !userLat || !userLng) return;

  const finalPoint = routeCoordinates[routeCoordinates.length - 1];

  const remainingDistance = map.distance(
    [userLat, userLng],
    finalPoint
  );

  const trafficLevel =
    trafficMonitoring ? "moderate" : "light";

  const eta = calculateSmartETA(
    remainingDistance,
    window.lastSpeedKmh,
    trafficLevel
  );

  const distanceKm = remainingDistance / 1000;

  const weatherText = document.getElementById("weather")?.innerText || "--";

  const trafficText = trafficMonitoring ? "Live Traffic ON" : "Live Traffic OFF";

  updateSmartTravelPanel(
    distanceKm,
    eta,
    weatherText,
    trafficText
  );
}


/* =========================================================
   5. START SMART SYSTEM LOOP
========================================================= */

let smartTravelInterval = null;

function startSmartTravelSystem() {

  if (smartTravelInterval) return;

  smartTravelInterval = setInterval(() => {

    refreshSmartTravel();

  }, 3000);
}


/* =========================================================
   6. STOP SMART SYSTEM LOOP
========================================================= */

function stopSmartTravelSystem() {

  if (smartTravelInterval) {
    clearInterval(smartTravelInterval);
    smartTravelInterval = null;
  }

  updateSmartTravelPanel(null, null, "--", "--");
}
