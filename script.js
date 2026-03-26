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

  const waterInput = document.getElementById("waterInput");
  const energyInput = document.getElementById("energyInput");
  const transportInput = document.getElementById("transportInput");

  const ecoScoreResult = document.getElementById("ecoScoreResult");
  const badgeResult = document.getElementById("badgeResult");
  const recommendationsList = document.getElementById("recommendationsList");

  const treesSavedEl = document.getElementById("treesSaved");
  const waterSavedEl = document.getElementById("waterSaved");
  const co2ReducedEl = document.getElementById("co2Reduced");

  const exportPngBtn = document.getElementById("exportPngBtn");
  const resetWeekBtn = document.getElementById("resetWeekBtn");

  hydrateInputs(waterInput, energyInput, transportInput);
  initChart();
  renderDashboardScore(ecoScoreResult, badgeResult, data.score);
  renderRecommendations(recommendationsList, data.score);
  renderImpact(treesSavedEl, waterSavedEl, co2ReducedEl, data.score);

  ecoForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const water = Number(waterInput.value);
    const energy = Number(energyInput.value);
    const transport = Number(transportInput.value);

    if ([water, energy, transport].some((value) => Number.isNaN(value) || value < 0)) {
      return;
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
  });

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
  if (!chart) {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
