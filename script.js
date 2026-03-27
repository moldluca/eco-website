const STORAGE_KEY = "eco-tracker-data";
const days = ["Luni", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];

const defaultData = {
  water: 0,
  energy: 0,
  transport: 0,
  score: 72,
  weeklyScores: [null, null, null, null, null, null, null],
  history: [],
  theme: "light"
};

const data = loadData();
let chart;

initShared();
initHomePage();
initDashboardPage();
initHistoryPage();

function initShared() {
  applyTheme(data.theme);
  initBackgroundMotion();
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }
}

function initHomePage() {
  const animatedHeroScore = document.getElementById("animatedHeroScore");
  if (!animatedHeroScore) {
    return;
  }

  animateNumber(animatedHeroScore, Math.round(data.score));
}

function initDashboardPage() {
  const ecoForm = document.getElementById("ecoForm");
  if (!ecoForm) {
    return;
  }

  ensureDataShape();

  const waterInput = document.getElementById("waterInput");
  const energyInput = document.getElementById("energyInput");
  const transportInput = document.getElementById("transportInput");

  const ecoScoreResult = document.getElementById("ecoScoreResult");
  const badgeResult = document.getElementById("badgeResult");
  const recommendationsList = document.getElementById("recommendationsList");
  const formFeedback = document.getElementById("formFeedback");

  const treesSavedEl = document.getElementById("treesSaved");
  const waterSavedEl = document.getElementById("waterSaved");
  const co2ReducedEl = document.getElementById("co2Reduced");

  const exportPngBtn = document.getElementById("exportPngBtn");
  const resetWeekBtn = document.getElementById("resetWeekBtn");
  const calculateBtn = document.getElementById("calculateBtn");

  hydrateInputs(waterInput, energyInput, transportInput);
  initChart();
  renderDashboardScore(ecoScoreResult, badgeResult, data.score);
  renderRecommendations(recommendationsList, data.score);
  renderImpact(treesSavedEl, waterSavedEl, co2ReducedEl, data.score);

  const handleEcoCalculation = (event) => {
    event.preventDefault();

    try {
      ensureDataShape();

      const water = parseInputNumber(waterInput.value);
      const energy = parseInputNumber(energyInput.value);
      const transport = parseInputNumber(transportInput.value);

      if ([water, energy, transport].some((value) => Number.isNaN(value) || !Number.isFinite(value) || value < 0)) {
        if (formFeedback) {
          formFeedback.textContent = "Completează valori numerice valide (ex: 10 sau 10.5).";
        }
        return;
      }

      if (formFeedback) {
        formFeedback.textContent = "";
      }

      // Formula ceruta: 100 - (apa*0.2 + energie*0.3 + transport*0.5)
      const rawScore = 100 - (water * 0.2 + energy * 0.3 + transport * 0.5);
      const score = clamp(roundToTwo(rawScore), 0, 100);

      data.water = water;
      data.energy = energy;
      data.transport = transport;
      data.score = score;

      const todayIndex = getMondayFirstDayIndex(new Date());
      data.weeklyScores[todayIndex] = score;

      saveData();

      renderDashboardScore(ecoScoreResult, badgeResult, score);
      renderRecommendations(recommendationsList, score);
      renderImpact(treesSavedEl, waterSavedEl, co2ReducedEl, score);
      updateChart();
    } catch (error) {
      console.error("Calculate Eco Score failed", error);
      if (formFeedback) {
        formFeedback.textContent = "A apărut o eroare la calcul. Reîncarcă pagina și încearcă din nou.";
      }
    }
  };

  ecoForm.addEventListener("submit", handleEcoCalculation);

  if (calculateBtn) {
    calculateBtn.addEventListener("click", handleEcoCalculation);
  }

  if (exportPngBtn) {
    exportPngBtn.addEventListener("click", exportWeeklyPng);
  }

  if (resetWeekBtn) {
    resetWeekBtn.addEventListener("click", () => {
      resetCurrentWeek(ecoScoreResult, badgeResult, recommendationsList, treesSavedEl, waterSavedEl, co2ReducedEl);
    });
  }
}

function initHistoryPage() {
  const historyList = document.getElementById("historyList");
  if (!historyList) {
    return;
  }

  if (!data.history.length) {
    historyList.innerHTML = '<div class="history-item"><p>Nu există săptămâni arhivate încă.</p></div>';
    return;
  }

  historyList.innerHTML = data.history
    .slice()
    .reverse()
    .map((item) => {
      const scoresLine = item.scores
        .map((score) => (score === null ? "-" : score))
        .join(" | ");

      return `
        <article class="history-item panel-card">
          <p><strong>${item.weekLabel}</strong></p>
          <p>Media săptămânii: <strong>${item.average}</strong></p>
          <p>Scoruri (Lu-Du): ${scoresLine}</p>
          <p class="muted">Reset la: ${item.savedAt}</p>
        </article>
      `;
    })
    .join("");
}

function renderDashboardScore(ecoScoreResult, badgeResult, score) {
  ecoScoreResult.textContent = `${score} / 100`;
  badgeResult.textContent = getBadge(score);
}

function renderRecommendations(recommendationsList, score) {
  const recommendations = getRecommendations(score);
  recommendationsList.innerHTML = recommendations.map((item) => `<li>${item}</li>`).join("");
}

function renderImpact(treesSavedEl, waterSavedEl, co2ReducedEl, score) {
  const treesSaved = (score / 10).toFixed(1);
  const waterSaved = Math.round(score * 3.1);
  const co2Reduced = (score * 0.42).toFixed(1);

  treesSavedEl.textContent = treesSaved;
  waterSavedEl.textContent = `${waterSaved} L`;
  co2ReducedEl.textContent = `${co2Reduced} kg`;
}

function getRecommendations(score) {
  if (score < 40) {
    return [
      "Reduce consumul de apă cu 10% în următoarele 7 zile.",
      "Folosește bicicleta 2 zile pe săptămână.",
      "Stinge aparatele din priză când nu le folosești."
    ];
  }

  if (score < 70) {
    return [
      "Ai progres bun. Încearcă dușuri mai scurte cu 2 minute.",
      "Mută o parte din drumurile scurte pe jos.",
      "Setează aparatele pe mod eco pentru eficiență mai bună."
    ];
  }

  return [
    "Felicitări! Ai un scor eco excelent.",
    "Menține ritmul și împărtășește obiceiurile tale cu prietenii.",
    "Testează o zi pe săptămână complet fără mașină."
  ];
}

function getBadge(score) {
  if (score < 45) {
    return "Eco Beginner";
  }
  if (score < 80) {
    return "Green Explorer";
  }
  return "Planet Saver";
}

function initChart() {
  const ctx = document.getElementById("ecoChart");
  if (!ctx || typeof Chart === "undefined") {
    return;
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: days,
      datasets: [{
        label: "Eco Score",
        data: data.weeklyScores,
        borderColor: "#0d7a48",
        backgroundColor: "rgba(13, 122, 72, 0.15)",
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        spanGaps: true,
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function updateChart() {
  if (!chart || !chart.data || !chart.data.datasets || !chart.data.datasets[0]) {
    return;
  }

  chart.data.datasets[0].data = data.weeklyScores;
  chart.update();
}

function exportWeeklyPng() {
  const canvas = document.getElementById("ecoChart");
  if (!canvas) {
    return;
  }

  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.download = `eco-weekly-${dateStamp}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function resetCurrentWeek(ecoScoreResult, badgeResult, recommendationsList, treesSavedEl, waterSavedEl, co2ReducedEl) {
  ensureDataShape();

  const hasAnyScore = data.weeklyScores.some((score) => score !== null);

  if (hasAnyScore) {
    const average = roundToTwo(getAverage(data.weeklyScores.filter((score) => score !== null)));
    data.history.push({
      weekLabel: getWeekLabel(new Date()),
      scores: [...data.weeklyScores],
      average,
      savedAt: new Date().toLocaleString("ro-RO")
    });
  }

  data.weeklyScores = [null, null, null, null, null, null, null];
  data.score = 72;
  data.water = 0;
  data.energy = 0;
  data.transport = 0;

  saveData();

  ecoScoreResult.textContent = "72 / 100";
  badgeResult.textContent = getBadge(72);
  renderRecommendations(recommendationsList, 72);
  renderImpact(treesSavedEl, waterSavedEl, co2ReducedEl, 72);
  updateChart();
}

function hydrateInputs(waterInput, energyInput, transportInput) {
  waterInput.value = data.water || "";
  energyInput.value = data.energy || "";
  transportInput.value = data.transport || "";
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
  data.theme = nextTheme;
  applyTheme(nextTheme);
  saveData();
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.textContent = theme === "dark" ? "Light" : "Dark";
  }
}

function animateNumber(element, target) {
  const start = Number(element.dataset.value || 0);
  const duration = 950;
  const startTime = performance.now();

  function step(timestamp) {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const current = Math.round(start + (target - start) * easeOutCubic(progress));
    element.dataset.value = String(current);
    element.innerHTML = `${current}<span>/100</span> 🌱`;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...defaultData };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...defaultData,
      ...parsed,
      weeklyScores: normalizeWeeklyScores(parsed.weeklyScores),
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch {
    return { ...defaultData };
  }
}

function normalizeWeeklyScores(value) {
  if (!Array.isArray(value)) {
    return [...defaultData.weeklyScores];
  }

  const normalized = value.slice(0, 7).map((item) => (typeof item === "number" ? item : null));
  while (normalized.length < 7) {
    normalized.push(null);
  }
  return normalized;
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Saving eco tracker data failed", error);
  }
}

function ensureDataShape() {
  if (!Array.isArray(data.weeklyScores)) {
    data.weeklyScores = [...defaultData.weeklyScores];
  }
  if (!Array.isArray(data.history)) {
    data.history = [];
  }
}

function getMondayFirstDayIndex(date) {
  const jsDay = date.getDay();
  return (jsDay + 6) % 7;
}

function getWeekLabel(date) {
  const start = new Date(date);
  const dayIndex = getMondayFirstDayIndex(start);
  start.setDate(start.getDate() - dayIndex);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const formatter = new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function getAverage(values) {
  if (!values.length) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function parseInputNumber(rawValue) {
  if (typeof rawValue !== "string") {
    return Number.NaN;
  }

  const normalized = rawValue.trim().replace(",", ".");
  if (!normalized) {
    return Number.NaN;
  }

  return Number(normalized);
}

function initBackgroundMotion() {
  const leftShape = document.querySelector(".bg-shape-left");
  const rightShape = document.querySelector(".bg-shape-right");

  if (!leftShape || !rightShape) {
    return;
  }

  const motion = {
    mouseX: 0,
    mouseY: 0,
    currentX: 0,
    currentY: 0
  };

  window.addEventListener("pointermove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 2;
    const y = (event.clientY / window.innerHeight - 0.5) * 2;
    motion.mouseX = x;
    motion.mouseY = y;
  });

  let rafId = 0;
  const startTime = performance.now();

  const animate = (now) => {
    const t = (now - startTime) / 1000;

    // Smooth interpolation to avoid jittery cursor-following.
    motion.currentX += (motion.mouseX - motion.currentX) * 0.06;
    motion.currentY += (motion.mouseY - motion.currentY) * 0.06;

    const leftX = Math.sin(t * 0.7) * 28 + motion.currentX * 14;
    const leftY = Math.cos(t * 0.9) * 18 + motion.currentY * 12;
    const rightX = Math.cos(t * 0.6) * 24 - motion.currentX * 16;
    const rightY = Math.sin(t * 0.8) * 20 - motion.currentY * 10;

    leftShape.style.transform = `translate3d(${leftX}px, ${leftY}px, 0) scale(1.03)`;
    rightShape.style.transform = `translate3d(${rightX}px, ${rightY}px, 0) scale(0.98)`;

    rafId = window.requestAnimationFrame(animate);
  };

  rafId = window.requestAnimationFrame(animate);

  window.addEventListener("beforeunload", () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
  });
}
