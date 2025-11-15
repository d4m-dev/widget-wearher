(function () {
  // ------------ ĐỌC THAM SỐ TỪ SCRIPT ------------
  const scriptEl = document.currentScript;
  const API_KEY = scriptEl.getAttribute("data-api-key") || "617c4ee55ebc9a4b8dac0a1a1b8aa49f";
  const DEFAULT_CITY = scriptEl.getAttribute("data-default-city") || "Hồ Chí Minh";
  const REFRESH_INTERVAL_MS = parseInt(scriptEl.getAttribute("data-refresh") || "60000", 10);

  if (!API_KEY || API_KEY === "617c4ee55ebc9a4b8dac0a1a1b8aa49f") {
    console.warn("[VN Weather Widget] Thiếu API key. Thêm data-api-key vào thẻ <script>.");
  }

  let lastLocation = null; // { type: 'coords' | 'city', lat, lon, city }
  let refreshTimer = null;

  const PROVINCES_VN = [
    "Hà Nội","Hồ Chí Minh","Đà Nẵng","Hải Phòng","Cần Thơ",
    "An Giang","Bà Rịa - Vũng Tàu","Bạc Liêu","Bắc Giang","Bắc Kạn",
    "Bắc Ninh","Bến Tre","Bình Dương","Bình Định","Bình Phước",
    "Bình Thuận","Cà Mau","Cao Bằng","Đắk Lắk","Đắk Nông",
    "Điện Biên","Đồng Nai","Đồng Tháp","Gia Lai","Hà Giang",
    "Hà Nam","Hà Tĩnh","Hải Dương","Hậu Giang","Hòa Bình",
    "Hưng Yên","Khánh Hòa","Kiên Giang","Kon Tum","Lai Châu",
    "Lâm Đồng","Lạng Sơn","Lào Cai","Long An","Nam Định",
    "Nghệ An","Ninh Bình","Ninh Thuận","Phú Thọ","Phú Yên",
    "Quảng Bình","Quảng Nam","Quảng Ngãi","Quảng Ninh","Quảng Trị",
    "Sóc Trăng","Sơn La","Tây Ninh","Thái Bình","Thái Nguyên",
    "Thanh Hóa","Thừa Thiên Huế","Tiền Giang","Trà Vinh",
    "Tuyên Quang","Vĩnh Long","Vĩnh Phúc","Yên Bái"
  ];

  const API_BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

  // ------------ CSS CHO WIDGET ------------
  const style = document.createElement("style");
  style.textContent = `
  #vn-weather-widget {
    font-family: "Poppins", system-ui, -apple-system, sans-serif;
  }
  .vnw-widget{
    width:100%;
    max-width:420px;
    padding:18px 18px 20px;
    border-radius:22px;
    background:linear-gradient(145deg,#ffb199 0%,#ff667c 40%,#845ec2 100%);
    box-shadow:0 20px 35px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.06);
    position:relative;
    overflow:hidden;
    color:#fff;
  }
  .vnw-sky{
    position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;
  }
  .vnw-sun{
    position:absolute;width:120px;height:120px;border-radius:50%;
    background:radial-gradient(circle at 30% 30%,#fff9c4,#ffeb3b,#f59e0b);
    top:40px;right:-10px;opacity:0;transform-origin:center;
    animation:vnwSunPulse 6s ease-in-out infinite;
  }
  @keyframes vnwSunPulse{0%,100%{transform:scale(1);opacity:.8;}50%{transform:scale(1.1);opacity:1;}}
  .vnw-cloud{
    position:absolute;width:160px;height:70px;background:rgba(255,255,255,.95);
    border-radius:50px;top:70px;left:-180px;opacity:0;
    filter:drop-shadow(0 8px 16px rgba(0,0,0,.2));
    animation:vnwCloudMove 22s linear infinite;
  }
  .vnw-cloud::before,.vnw-cloud::after{
    content:"";position:absolute;background:inherit;width:90px;height:75px;border-radius:50%;top:-26px;
  }
  .vnw-cloud::before{left:15px;}
  .vnw-cloud::after{right:5px;top:-20px;}
  @keyframes vnwCloudMove{
    0%{transform:translateX(0);opacity:0;}
    10%{opacity:1;}
    90%{opacity:1;}
    100%{transform:translateX(560px);opacity:0;}
  }
  .vnw-rain-layer{position:absolute;width:100%;height:100%;overflow:hidden;opacity:0;}
  .vnw-raindrop{
    position:absolute;width:2px;height:30px;background:rgba(187,222,251,.9);
    top:-40px;left:0;border-radius:999px;animation:vnwRainFall .9s linear infinite;
  }
  @keyframes vnwRainFall{
    0%{transform:translateY(0);opacity:0;}
    10%{opacity:1;}
    100%{transform:translateY(260px);opacity:0;}
  }
  .vnw-storm-flash{
    position:absolute;width:3px;height:140%;background:rgba(255,255,255,.9);
    top:-20%;left:50%;transform:skewX(-20deg);opacity:0;animation:vnwStorm 5s linear infinite;
  }
  @keyframes vnwStorm{
    0%,92%,100%{opacity:0;}
    93%{opacity:.9;}94%{opacity:0;}95%{opacity:.8;}96%{opacity:0;}
  }
  .vnw-mist{
    position:absolute;inset:auto 0 0 0;height:90px;
    background:radial-gradient(circle at top,rgba(255,255,255,.75),rgba(255,255,255,0));
    opacity:0;animation:vnwMist 8s ease-in-out infinite;
  }
  @keyframes vnwMist{
    0%,100%{transform:translateX(0);opacity:.6;}
    50%{transform:translateX(-20px);opacity:.85;}
  }
  .vnw-sky.sunny .vnw-sun{opacity:1;}
  .vnw-sky.cloudy .vnw-cloud{opacity:1;}
  .vnw-sky.rainy .vnw-cloud{opacity:1;}
  .vnw-sky.rainy .vnw-rain-layer{opacity:1;}
  .vnw-sky.storm .vnw-cloud{opacity:1;}
  .vnw-sky.storm .vnw-rain-layer{opacity:1;}
  .vnw-sky.storm .vnw-storm-flash{opacity:1;}
  .vnw-sky.misty .vnw-mist{opacity:1;}

  .vnw-content{position:relative;z-index:1;font-size:14px;}
  .vnw-search-row{display:flex;gap:8px;margin-bottom:14px;position:relative;}
  .vnw-search-bar{
    flex:1;display:flex;align-items:center;
    background:rgba(255,255,255,.35);border-radius:16px;
    padding:6px 10px;backdrop-filter:blur(6px);position:relative;
  }
  .vnw-search-input{
    flex:1;border:none;background:transparent;outline:none;color:#fff;font-size:13px;
  }
  .vnw-search-input::placeholder{color:rgba(255,255,255,.8);}
  .vnw-btn,.vnw-location-btn{
    border:none;background:rgba(255,255,255,.35);border-radius:999px;
    width:32px;height:32px;display:flex;align-items:center;justify-content:center;
    cursor:pointer;font-size:14px;color:#fff;flex-shrink:0;
  }
  .vnw-location-btn{width:38px;background:rgba(15,23,42,.7);}
  .vnw-suggestions{
    position:absolute;left:0;right:50px;top:38px;
    background:rgba(15,23,42,.96);border-radius:12px;
    padding:4px 0;box-shadow:0 12px 25px rgba(0,0,0,.4);
    max-height:180px;overflow-y:auto;z-index:10;display:none;
  }
  .vnw-suggestion-item{
    padding:6px 10px;font-size:13px;cursor:pointer;
    display:flex;align-items:center;gap:6px;
  }
  .vnw-suggestion-item:hover{background:rgba(55,65,81,.9);}
  .vnw-main-info{margin-top:4px;margin-bottom:14px;}
  .vnw-location-text{font-size:20px;font-weight:600;display:flex;align-items:center;gap:4px;}
  .vnw-location-text .flag{font-size:15px;}
  .vnw-temp{font-size:46px;font-weight:700;line-height:1;margin:6px 0 4px;}
  .vnw-temp-range{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;}
  .vnw-temp-pill{
    padding:3px 10px;border-radius:999px;background:rgba(0,0,0,.18);
    display:inline-flex;align-items:center;gap:4px;
  }
  .vnw-weather-desc{
    margin-top:8px;display:inline-flex;align-items:center;gap:6px;
    font-size:14px;padding:5px 10px;border-radius:999px;background:rgba(0,0,0,.25);
  }
  .vnw-weather-icon{font-size:18px;}
  .vnw-extra-info{
    display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px;
  }
  .vnw-card{
    border-radius:14px;padding:10px 8px;background:rgba(0,0,0,.25);backdrop-filter:blur(4px);
  }
  .vnw-card:nth-child(1){background:rgba(15,23,42,.75);}
  .vnw-card:nth-child(2){background:rgba(132,204,22,.8);color:#111827;}
  .vnw-card:nth-child(3){background:rgba(255,255,255,.8);color:#111827;}
  .vnw-label{font-size:11px;opacity:.9;}
  .vnw-value{margin-top:4px;font-weight:700;font-size:14px;}
  .vnw-status{margin-top:8px;font-size:11px;opacity:.85;}
  @media(max-width:480px){
    .vnw-widget{margin:16px;}
  }
  `;
  document.head.appendChild(style);

  // ------------ HTML CỦA WIDGET ------------
  const widgetHtml = `
  <div class="vnw-widget">
    <div class="vnw-sky sunny" id="vnw-sky">
      <div class="vnw-sun"></div>
      <div class="vnw-cloud"></div>
      <div class="vnw-rain-layer">
        <div class="vnw-raindrop" style="left:10%;animation-delay:0s;"></div>
        <div class="vnw-raindrop" style="left:25%;animation-delay:.2s;"></div>
        <div class="vnw-raindrop" style="left:40%;animation-delay:.1s;"></div>
        <div class="vnw-raindrop" style="left:55%;animation-delay:.35s;"></div>
        <div class="vnw-raindrop" style="left:70%;animation-delay:.15s;"></div>
        <div class="vnw-raindrop" style="left:83%;animation-delay:.28s;"></div>
      </div>
      <div class="vnw-storm-flash"></div>
      <div class="vnw-mist"></div>
    </div>

    <div class="vnw-content">
      <div class="vnw-search-row">
        <div class="vnw-search-bar">
          <input id="vnw-search" class="vnw-search-input" type="text" placeholder="Tìm kiếm tỉnh / thành phố ở Việt Nam">
          <button id="vnw-search-btn" class="vnw-btn" title="Tìm kiếm">🔍</button>
          <div class="vnw-suggestions" id="vnw-suggestions"></div>
        </div>
        <button class="vnw-location-btn" id="vnw-location-btn" title="Dùng vị trí hiện tại">📍</button>
      </div>

      <div class="vnw-main-info">
        <div class="vnw-location-text">
          <span class="flag">🇻🇳</span>
          <span id="vnw-location-name">Đang xác định vị trí...</span>
        </div>
        <div class="vnw-temp" id="vnw-temp">--°C</div>
        <div class="vnw-temp-range">
          <span class="vnw-temp-pill" id="vnw-min-temp">↓ --°C</span>
          <span class="vnw-temp-pill" id="vnw-max-temp">↑ --°C</span>
        </div>
        <div class="vnw-weather-desc">
          <span class="vnw-weather-icon" id="vnw-icon">☀️</span>
          <span id="vnw-weather-text">Chưa có dữ liệu</span>
        </div>
      </div>

      <div class="vnw-extra-info">
        <div class="vnw-card">
          <div class="vnw-label">Độ ẩm</div>
          <div class="vnw-value" id="vnw-humidity">--%</div>
        </div>
        <div class="vnw-card">
          <div class="vnw-label">Gió</div>
          <div class="vnw-value" id="vnw-wind">-- km/h</div>
        </div>
        <div class="vnw-card">
          <div class="vnw-label">Áp suất</div>
          <div class="vnw-value" id="vnw-pressure">-- hPa</div>
        </div>
      </div>

      <div class="vnw-status" id="vnw-status">
        Cho phép truy cập vị trí để lấy thời tiết nơi bạn đang đứng.
      </div>
    </div>
  </div>
  `;

  // ------------ HÀM TIỆN ÍCH ------------
  function setStatus(text) {
    const el = document.getElementById("vnw-status");
    if (el) el.textContent = text;
  }
  function capitalizeFirstLetter(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  function mapWeatherToStyle(main, desc) {
    const sky = { icon: "☀️", skyClass: "sunny" };
    const lowerMain = (main || "").toLowerCase();
    const lowerDesc = (desc || "").toLowerCase();
    if (lowerMain.includes("cloud")) { sky.icon="☁️"; sky.skyClass="cloudy"; }
    if (lowerMain.includes("rain") || lowerMain.includes("drizzle")) { sky.icon="🌧️"; sky.skyClass="rainy"; }
    if (lowerMain.includes("thunder")) { sky.icon="⛈️"; sky.skyClass="storm"; }
    if (lowerMain.includes("mist") || lowerMain.includes("fog") || lowerMain.includes("haze") || lowerDesc.includes("sương")) {
      sky.icon="🌫️"; sky.skyClass="misty";
    }
    if (lowerMain.includes("clear")) { sky.icon="☀️"; sky.skyClass="sunny"; }
    return sky;
  }
  function setSkyMode(mode) {
    const skyEl = document.getElementById("vnw-sky");
    if (skyEl) skyEl.className = "vnw-sky " + mode;
  }
  function removeVietnameseTone(str) {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }

  // ------------ GỌI API THỜI TIẾT ------------
  async function fetchWeather(url) {
    setStatus("Đang tải dữ liệu thời tiết...");
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let msg = "Không lấy được dữ liệu. Mã lỗi: " + res.status;
        if (res.status === 401) msg = "API key không hợp lệ hoặc thiếu. Kiểm tra lại data-api-key.";
        if (res.status === 404) msg = "Không tìm thấy địa điểm. Vui lòng kiểm tra lại tên tỉnh / thành phố.";
        throw new Error(msg);
      }
      const data = await res.json();
      updateUIWithWeather(data);
      setStatus("Đã cập nhật lúc: " + new Date().toLocaleTimeString("vi-VN"));
    } catch (err) {
      console.error(err);
      setStatus("Lỗi: " + err.message);
    }
  }

  async function fetchWeatherByCoords(lat, lon) {
    lastLocation = { type: "coords", lat, lon };
    startAutoRefresh();
    const url = `${API_BASE_URL}?lat=${lat}&lon=${lon}&units=metric&lang=vi&appid=${API_KEY}`;
    return fetchWeather(url);
  }
  async function fetchWeatherByCity(cityName) {
    lastLocation = { type: "city", city: cityName };
    startAutoRefresh();
    const q = encodeURIComponent(cityName + ",VN");
    const url = `${API_BASE_URL}?q=${q}&units=metric&lang=vi&appid=${API_KEY}`;
    return fetchWeather(url);
  }

  function updateUIWithWeather(data) {
    if (!data || !data.main) {
      setStatus("Không có dữ liệu phù hợp.");
      return;
    }
    const temp = Math.round(data.main.temp * 10) / 10;
    const tempMin = Math.round(data.main.temp_min * 10) / 10;
    const tempMax = Math.round(data.main.temp_max * 10) / 10;
    const humidity = data.main.humidity;
    const pressure = data.main.pressure;
    const windMs = data.wind.speed;
    const windKmH = Math.round(windMs * 3.6 * 100) / 100;

    const city = data.name || "Không rõ";
    const country = data.sys && data.sys.country ? data.sys.country : "VN";

    const weatherMain = data.weather[0].main;
    const weatherDesc = capitalizeFirstLetter(data.weather[0].description || "");

    document.getElementById("vnw-location-name").textContent = `${city}, ${country}`;
    document.getElementById("vnw-temp").textContent = `${temp}°C`;
    document.getElementById("vnw-min-temp").textContent = `↓ ${tempMin}°C`;
    document.getElementById("vnw-max-temp").textContent = `↑ ${tempMax}°C`;
    document.getElementById("vnw-humidity").textContent = `${humidity}%`;
    document.getElementById("vnw-pressure").textContent = `${pressure} hPa`;
    document.getElementById("vnw-wind").textContent = `${windKmH} km/h`;
    document.getElementById("vnw-weather-text").textContent = weatherDesc;

    const { icon, skyClass } = mapWeatherToStyle(weatherMain, weatherDesc);
    document.getElementById("vnw-icon").textContent = icon;
    setSkyMode(skyClass);
  }

  // ------------ AUTO REFRESH ------------
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    if (!REFRESH_INTERVAL_MS || REFRESH_INTERVAL_MS <= 0) return;

    refreshTimer = setInterval(() => {
      if (!lastLocation) return;
      if (lastLocation.type === "coords") {
        fetchWeatherByCoords(lastLocation.lat, lastLocation.lon);
      } else if (lastLocation.type === "city") {
        fetchWeatherByCity(lastLocation.city);
      }
    }, REFRESH_INTERVAL_MS);
  }

  // ------------ GEOLOCATION ------------
  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("Trình duyệt không hỗ trợ lấy vị trí. Đang dùng mặc định: " + DEFAULT_CITY);
      fetchWeatherByCity(DEFAULT_CITY);
      return;
    }
    setStatus("Đang xin quyền truy cập vị trí...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setStatus("Đã lấy vị trí. Đang tải thời tiết...");
        fetchWeatherByCoords(latitude, longitude);
      },
      (err) => {
        console.error(err);
        setStatus("Không truy cập được vị trí (" + err.message + "). Dùng mặc định: " + DEFAULT_CITY);
        fetchWeatherByCity(DEFAULT_CITY);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 600000 }
    );
  }

  // ------------ GỢI Ý TỈNH / THÀNH & TÌM KIẾM ------------
  function showSuggestions(keyword) {
    const box = document.getElementById("vnw-suggestions");
    const input = document.getElementById("vnw-search");
    if (!box || !input) return;
    const query = keyword.trim();
    if (!query) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }
    const plainQuery = removeVietnameseTone(query.toLowerCase());
    const matches = PROVINCES_VN.filter((name) => {
      const plainName = removeVietnameseTone(name.toLowerCase());
      return plainName.includes(plainQuery);
    }).slice(0, 8);
    if (matches.length === 0) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }
    box.innerHTML = "";
    matches.forEach((name) => {
      const item = document.createElement("div");
      item.className = "vnw-suggestion-item";
      item.innerHTML = `<span class="flag">🇻🇳</span><span>${name}</span>`;
      item.addEventListener("click", () => {
        input.value = name;
        box.style.display = "none";
        box.innerHTML = "";
        fetchWeatherByCity(name);
      });
      box.appendChild(item);
    });
    box.style.display = "block";
  }

  function hideSuggestions() {
    const box = document.getElementById("vnw-suggestions");
    if (!box) return;
    setTimeout(() => { box.style.display = "none"; }, 150);
  }

  function handleSearch() {
    const input = document.getElementById("vnw-search");
    if (!input) return;
    const value = input.value.trim();
    if (!value) {
      setStatus("Vui lòng nhập tên tỉnh / thành phố ở Việt Nam.");
      return;
    }
    fetchWeatherByCity(value);
  }

  // ------------ KHỞI TẠO ------------
  function initWidget() {
    const container = document.getElementById("vn-weather-widget");
    if (!container) {
      console.warn('[VN Weather Widget] Không tìm thấy <div id="vn-weather-widget"> để nhúng widget.');
      return;
    }
    container.innerHTML = widgetHtml;

    const searchBtn = document.getElementById("vnw-search-btn");
    const searchInput = document.getElementById("vnw-search");
    const locationBtn = document.getElementById("vnw-location-btn");
    const suggestionsBox = document.getElementById("vnw-suggestions");

    if (searchBtn) searchBtn.addEventListener("click", handleSearch);
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleSearch();
      });
      searchInput.addEventListener("input", (e) => showSuggestions(e.target.value));
      searchInput.addEventListener("blur", hideSuggestions);
    }
    if (suggestionsBox) {
      suggestionsBox.addEventListener("mousedown", (e) => e.preventDefault());
    }
    if (locationBtn) locationBtn.addEventListener("click", requestCurrentLocation);

    requestCurrentLocation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWidget);
  } else {
    initWidget();
  }
})();
