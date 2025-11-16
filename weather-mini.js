(() => {
  const DEFAULT_API_KEY = "617c4ee55ebc9a4b8dac0a1a1b8aa49f";
  const API_BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

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

  class VnWeatherWidget extends HTMLElement {
    constructor() {
      super();

      this.apiKey = DEFAULT_API_KEY;
      this.defaultCity = "Hồ Chí Minh";
      this.refreshMs = 60000;
      this.lastLocation = null;
      this.refreshTimer = null;

      this.handleSearch = this.handleSearch.bind(this);
      this.handleInputChange = this.handleInputChange.bind(this);
      this.handleInputBlur = this.handleInputBlur.bind(this);
      this.handleLocationClick = this.handleLocationClick.bind(this);

      const shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = this.renderTemplate();

      // Cache DOM trong shadow
      this.$sky = shadow.getElementById("vnw-sky");
      this.$search = shadow.getElementById("vnw-search");
      this.$searchBtn = shadow.getElementById("vnw-search-btn");
      this.$locationBtn = shadow.getElementById("vnw-location-btn");
      this.$suggestions = shadow.getElementById("vnw-suggestions");

      this.$locationName = shadow.getElementById("vnw-location-name");
      this.$temp = shadow.getElementById("vnw-temp");
      this.$minTemp = shadow.getElementById("vnw-min-temp");
      this.$maxTemp = shadow.getElementById("vnw-max-temp");
      this.$humidity = shadow.getElementById("vnw-humidity");
      this.$wind = shadow.getElementById("vnw-wind");
      this.$pressure = shadow.getElementById("vnw-pressure");
      this.$icon = shadow.getElementById("vnw-icon");
      this.$weatherText = shadow.getElementById("vnw-weather-text");
      this.$status = shadow.getElementById("vnw-status");
    }

    static get observedAttributes() {
      return ["api-key", "default-city", "refresh-ms"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === "api-key" && newValue) {
        this.apiKey = newValue;
      }
      if (name === "default-city" && newValue) {
        this.defaultCity = newValue;
      }
      if (name === "refresh-ms") {
        const val = parseInt(newValue, 10);
        if (!isNaN(val) && val > 0) {
          this.refreshMs = val;
          this.startAutoRefresh();
        }
      }
    }

    connectedCallback() {
      // Lấy giá trị attribute lần đầu
      const attrApi = this.getAttribute("api-key");
      if (attrApi) this.apiKey = attrApi;

      const attrCity = this.getAttribute("default-city");
      if (attrCity) this.defaultCity = attrCity;

      const attrRefresh = this.getAttribute("refresh-ms");
      if (attrRefresh) {
        const val = parseInt(attrRefresh, 10);
        if (!isNaN(val) && val > 0) this.refreshMs = val;
      }

      // Gắn sự kiện
      if (this.$searchBtn) {
        this.$searchBtn.addEventListener("click", this.handleSearch);
      }
      if (this.$search) {
        this.$search.addEventListener("keydown", (e) => {
          if (e.key === "Enter") this.handleSearch();
        });
        this.$search.addEventListener("input", this.handleInputChange);
        this.$search.addEventListener("blur", this.handleInputBlur);
      }
      if (this.$suggestions) {
        this.$suggestions.addEventListener("mousedown", (e) => e.preventDefault());
      }
      if (this.$locationBtn) {
        this.$locationBtn.addEventListener("click", this.handleLocationClick);
      }

      // Khởi chạy: xin vị trí, nếu fail → defaultCity
      this.requestCurrentLocation();
    }

    disconnectedCallback() {
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      if (this.$searchBtn) {
        this.$searchBtn.removeEventListener("click", this.handleSearch);
      }
      if (this.$search) {
        this.$search.removeEventListener("input", this.handleInputChange);
        this.$search.removeEventListener("blur", this.handleInputBlur);
      }
      if (this.$locationBtn) {
        this.$locationBtn.removeEventListener("click", this.handleLocationClick);
      }
    }

    // ==========================
    // TEMPLATE + CSS
    // ==========================
    renderTemplate() {
      return `
<style>
  :host {
    display: inline-block;
    font-family: "Poppins", system-ui, -apple-system, sans-serif;
  }

  .vnw-widget{
    width: 360px;
    max-width: 100%;
    padding: 18px 18px 20px;
    border-radius: 22px;
    background: linear-gradient(145deg,#ffb199 0%,#ff667c 40%,#845ec2 100%);
    box-shadow:
      0 20px 35px rgba(0,0,0,0.4),
      0 0 0 1px rgba(255,255,255,0.06);
    position: relative;
    overflow: hidden;
    color: #fff;
    box-sizing: border-box;
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
</style>

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
    }

    // ==========================
    // API & LOGIC
    // ==========================

    setStatus(text) {
      if (this.$status) this.$status.textContent = text;
    }

    capitalizeFirst(str) {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    mapWeatherToStyle(main, desc) {
      const sky = { icon: "☀️", skyClass: "sunny" };
      const lowerMain = (main || "").toLowerCase();
      const lowerDesc = (desc || "").toLowerCase();

      if (lowerMain.includes("cloud")) { sky.icon = "☁️"; sky.skyClass = "cloudy"; }
      if (lowerMain.includes("rain") || lowerMain.includes("drizzle")) { sky.icon = "🌧️"; sky.skyClass = "rainy"; }
      if (lowerMain.includes("thunder")) { sky.icon = "⛈️"; sky.skyClass = "storm"; }
      if (
        lowerMain.includes("mist") ||
        lowerMain.includes("fog") ||
        lowerMain.includes("haze") ||
        lowerDesc.includes("sương")
      ) {
        sky.icon = "🌫️"; sky.skyClass = "misty";
      }
      if (lowerMain.includes("clear")) { sky.icon = "☀️"; sky.skyClass = "sunny"; }

      return sky;
    }

    setSkyMode(mode) {
      if (this.$sky) this.$sky.className = "vnw-sky " + mode;
    }

    async fetchWeather(url) {
      this.setStatus("Đang tải dữ liệu thời tiết...");
      try {
        const res = await fetch(url);
        if (!res.ok) {
          let msg = "Không lấy được dữ liệu. Mã lỗi: " + res.status;
          if (res.status === 401) msg = "API key không hợp lệ hoặc thiếu.";
          if (res.status === 404) msg = "Không tìm thấy địa điểm. Kiểm tra lại tên tỉnh / thành phố.";
          throw new Error(msg);
        }
        const data = await res.json();
        this.updateUIWithWeather(data);
        this.setStatus("Đã cập nhật lúc: " + new Date().toLocaleTimeString("vi-VN"));
      } catch (err) {
        console.error(err);
        this.setStatus("Lỗi: " + err.message);
      }
    }

    async fetchWeatherByCoords(lat, lon) {
      this.lastLocation = { type: "coords", lat, lon };
      this.startAutoRefresh();
      const url = `${API_BASE_URL}?lat=${lat}&lon=${lon}&units=metric&lang=vi&appid=${this.apiKey}`;
      return this.fetchWeather(url);
    }

    async fetchWeatherByCity(cityName) {
      this.lastLocation = { type: "city", city: cityName };
      this.startAutoRefresh();
      const q = encodeURIComponent(cityName + ",VN");
      const url = `${API_BASE_URL}?q=${q}&units=metric&lang=vi&appid=${this.apiKey}`;
      return this.fetchWeather(url);
    }

    updateUIWithWeather(data) {
      if (!data || !data.main) {
        this.setStatus("Không có dữ liệu phù hợp.");
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
      const weatherDesc = this.capitalizeFirst(data.weather[0].description || "");

      if (this.$locationName) this.$locationName.textContent = `${city}, ${country}`;
      if (this.$temp) this.$temp.textContent = `${temp}°C`;
      if (this.$minTemp) this.$minTemp.textContent = `↓ ${tempMin}°C`;
      if (this.$maxTemp) this.$maxTemp.textContent = `↑ ${tempMax}°C`;
      if (this.$humidity) this.$humidity.textContent = `${humidity}%`;
      if (this.$pressure) this.$pressure.textContent = `${pressure} hPa`;
      if (this.$wind) this.$wind.textContent = `${windKmH} km/h`;
      if (this.$weatherText) this.$weatherText.textContent = weatherDesc;

      const { icon, skyClass } = this.mapWeatherToStyle(weatherMain, weatherDesc);
      if (this.$icon) this.$icon.textContent = icon;
      this.setSkyMode(skyClass);
    }

    startAutoRefresh() {
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      if (!this.refreshMs || this.refreshMs <= 0) return;

      this.refreshTimer = setInterval(() => {
        if (!this.lastLocation) return;
        if (this.lastLocation.type === "coords") {
          this.fetchWeatherByCoords(this.lastLocation.lat, this.lastLocation.lon);
        } else if (this.lastLocation.type === "city") {
          this.fetchWeatherByCity(this.lastLocation.city);
        }
      }, this.refreshMs);
    }

    requestCurrentLocation() {
      if (!navigator.geolocation) {
        this.setStatus("Trình duyệt không hỗ trợ lấy vị trí. Đang dùng mặc định: " + this.defaultCity);
        this.fetchWeatherByCity(this.defaultCity);
        return;
      }
      this.setStatus("Đang xin quyền truy cập vị trí...");

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          this.setStatus("Đã lấy vị trí. Đang tải thời tiết...");
          this.fetchWeatherByCoords(latitude, longitude);
        },
        (err) => {
          console.error(err);
          this.setStatus("Không truy cập được vị trí (" + err.message + "). Dùng mặc định: " + this.defaultCity);
          this.fetchWeatherByCity(this.defaultCity);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 600000 }
      );
    }

    // ==========================
    // GỢI Ý TỈNH / THÀNH
    // ==========================
    removeVietnameseTone(str) {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
    }

    showSuggestions(keyword) {
      const box = this.$suggestions;
      const input = this.$search;
      if (!box || !input) return;

      const query = (keyword || "").trim();
      if (!query) {
        box.style.display = "none";
        box.innerHTML = "";
        return;
      }

      const plainQuery = this.removeVietnameseTone(query.toLowerCase());

      const matches = PROVINCES_VN.filter((name) => {
        const plainName = this.removeVietnameseTone(name.toLowerCase());
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
          this.fetchWeatherByCity(name);
        });
        box.appendChild(item);
      });

      box.style.display = "block";
    }

    hideSuggestions() {
      if (!this.$suggestions) return;
      setTimeout(() => {
        if (this.$suggestions) this.$suggestions.style.display = "none";
      }, 150);
    }

    // ==========================
    // EVENT HANDLERS
    // ==========================
    handleSearch() {
      if (!this.$search) return;
      const value = this.$search.value.trim();
      if (!value) {
        this.setStatus("Vui lòng nhập tên tỉnh / thành phố ở Việt Nam.");
        return;
      }
      this.fetchWeatherByCity(value);
    }

    handleInputChange(e) {
      this.showSuggestions(e.target.value);
    }

    handleInputBlur() {
      this.hideSuggestions();
    }

    handleLocationClick() {
      this.requestCurrentLocation();
    }
  }

  customElements.define("vn-weather", VnWeatherWidget);
})();
