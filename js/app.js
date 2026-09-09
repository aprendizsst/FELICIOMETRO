import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const state = {
  name: "",
  mood: null,
  needs: [],
  db: null,
  auth: null,
  adminUser: null,
  firebaseReady: false,
  responses: [],
  responsesUnsub: null,
  firstRealtimeLoad: true,
  lastTopId: null,
  displayAvg: 0,
  gaugeAnimationFrame: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const MOOD_LABELS = {
  1: "Hoy necesita una pausa",
  2: "Está afrontando algunos retos",
  3: "Está bien",
  4: "Se siente bien y con energía",
  5: "¡Está brillando!"
};

const NEED_LABELS = {
  conexion: "🤝 Conexión",
  pausa: "🧘 Una pausa",
  escuchado: "💬 Ser escuchado",
  motivacion: "🌱 Motivación",
  reconocimiento: "❤️ Reconocimiento",
  sonreir: "😄 Un momento para sonreír",
  contagiar: "✨ Quiere contagiar su bienestar"
};

function firebaseConfigured() {
  return Boolean(firebaseConfig?.apiKey) && !String(firebaseConfig.apiKey).includes("REEMPLAZAR");
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove("show"), 2900);
}

function currentScreen() {
  return $(".screen.active")?.dataset.screen || "welcome";
}

function go(screen) {
  const protectedScreens = new Set(["admin", "dashboard"]);
  let target = screen;

  if (protectedScreens.has(target) && !state.adminUser) {
    target = "admin-login";
    toast("Inicia sesión como administrador para ver los resultados.");
  }

  $$(".screen").forEach(el => el.classList.toggle("active", el.dataset.screen === target));
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (target === "admin" || target === "dashboard") {
    ensureRealtimeSubscription();
  }

  if (target === "dashboard") {
    setDashboardLoading(state.firstRealtimeLoad);
    renderAllRealtimeViews(state.responses, false);
  }
}

function setDashboardLoading(loading) {
  const loader = $("#dashboardLoader");
  if (!loader) return;
  loader.classList.toggle("active", Boolean(loading));
}

function initFirebase() {
  if (!firebaseConfigured()) {
    console.warn("Feliciómetro: Firebase aún no está configurado.");
    $("#dashboardStatus").textContent = "Firebase todavía no está configurado.";
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    state.db = getFirestore(app);
    state.auth = getAuth(app);
    state.firebaseReady = true;

    onAuthStateChanged(state.auth, user => {
      state.adminUser = user || null;

      if (user) {
        $("#adminEmailLabel").textContent = user.email || "Administrador conectado";
        if (currentScreen() === "admin-login") {
          go("admin");
        }
        ensureRealtimeSubscription();
      } else {
        stopRealtimeSubscription();
        if (["admin", "dashboard"].includes(currentScreen())) {
          go("welcome");
        }
      }
    });
  } catch (error) {
    console.error("Error iniciando Firebase", error);
    toast("No fue posible conectar Firebase. Revisa firebase-config.js.");
  }
}

function personalizeExperience() {
  const safeName = state.name || "tú";
  $("#helloName").textContent = safeName;
  $("#needName").textContent = safeName;
  $("#thanksName").textContent = safeName;
  $("#moodPersonalText").textContent = `${safeName}, tómate un momento para pensar en cómo te sientes ahora.`;
}

function personalizedClosing() {
  const name = state.name || "tú";
  const messages = {
    1: `${name}, gracias por permitirte reconocer que hoy necesitas una pausa. Escucharte también es cuidarte.`,
    2: `${name}, gracias por compartirlo. Reconocer los retos que estás afrontando es una forma de cuidar tu bienestar.`,
    3: `${name}, gracias por compartir cómo estás. Tu respuesta también ayuda a entender cómo nos sentimos como equipo.`,
    4: `${name}, qué bueno saber que hoy te sientes bien y con energía. Gracias por sumar esa energía al equipo.`,
    5: `${name}, ¡qué bueno verte brillando! Gracias por compartir tu bienestar y ayudar a contagiarlo.`
  };
  $("#thanksMessage").textContent = messages[state.mood] || `Gracias, ${name}. Tu bienestar también cuenta.`;
}

function resetParticipantFlow() {
  state.name = "";
  state.mood = null;
  state.needs = [];
  $("#nameInput").value = "";
  $$(".mood-option").forEach(el => el.classList.remove("selected"));
  $$(".needs-grid button").forEach(el => el.classList.remove("selected"));
  $("#goNeeds").disabled = true;
  $("#submitResponse").disabled = true;
  go("welcome");
}

async function saveResponse() {
  if (!state.firebaseReady || !state.db) {
    throw new Error("Firebase no está configurado.");
  }

  const payload = {
    name: state.name.trim(),
    happiness: Number(state.mood),
    needs: [...state.needs],
    createdAt: serverTimestamp(),
    source: "qr-web",
    version: 2
  };

  await addDoc(collection(state.db, "responses"), payload);
}

function ensureRealtimeSubscription() {
  if (!state.firebaseReady || !state.db || !state.adminUser || state.responsesUnsub) return;

  state.firstRealtimeLoad = true;
  setDashboardLoading(true);

  const responsesQuery = query(collection(state.db, "responses"), orderBy("createdAt", "desc"));

  state.responsesUnsub = onSnapshot(
    responsesQuery,
    snapshot => {
      const rows = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      const newestId = rows[0]?.id || null;
      const isNewResponse = !state.firstRealtimeLoad && newestId && state.lastTopId && newestId !== state.lastTopId;
      const newestResponse = rows[0];

      state.responses = rows;
      state.lastTopId = newestId;
      setDashboardLoading(false);
      renderAllRealtimeViews(rows, isNewResponse);

      if (isNewResponse && newestResponse) {
        toast(`✨ Nueva respuesta de ${newestResponse.name || "un participante"}`);
      }

      state.firstRealtimeLoad = false;
    },
    error => {
      console.error("Error leyendo respuestas en vivo", error);
      setDashboardLoading(false);
      $("#dashboardStatus").textContent = "No fue posible leer las respuestas. Revisa las reglas de Firestore.";
      toast("No se pudieron cargar los datos en vivo.");
    }
  );
}

function stopRealtimeSubscription() {
  if (state.responsesUnsub) {
    state.responsesUnsub();
    state.responsesUnsub = null;
  }
  state.responses = [];
  state.firstRealtimeLoad = true;
  state.lastTopId = null;
}

function calculateStats(rows) {
  const validRows = rows.filter(row => Number(row.happiness) >= 1 && Number(row.happiness) <= 5);
  const total = validRows.length;
  const sum = validRows.reduce((acc, row) => acc + Number(row.happiness || 0), 0);
  const average = total ? sum / total : 0;
  const energyCount = validRows.filter(row => Number(row.happiness) >= 4).length;
  const pauseCount = validRows.filter(row => Array.isArray(row.needs) && row.needs.includes("pausa")).length;
  const uniqueUsers = new Set(
    validRows
      .map(row => String(row.name || "").trim().toLocaleLowerCase("es"))
      .filter(Boolean)
  ).size;

  return {
    total,
    average,
    uniqueUsers,
    energyPct: total ? (energyCount / total) * 100 : 0,
    pausePct: total ? (pauseCount / total) * 100 : 0
  };
}

function moodFace(value) {
  if (!value) return "😶";
  if (value < 1.5) return "😔";
  if (value < 2.5) return "😕";
  if (value < 3.5) return "🙂";
  if (value < 4.5) return "😊";
  return "🤩";
}

function moodStatus(value) {
  if (!value) return "Esperando respuestas";
  if (value < 1.5) return "Hoy necesitamos cuidarnos más";
  if (value < 2.5) return "Estamos afrontando algunos retos";
  if (value < 3.5) return "Estamos bien";
  if (value < 4.5) return "Nos sentimos bien y con energía";
  return "¡Estamos brillando!";
}

function animateNumber(element, target, { decimals = 0, suffix = "" } = {}) {
  if (!element) return;
  const start = Number(element.dataset.numericValue || 0);
  const end = Number(target || 0);
  element.dataset.numericValue = String(end);
  const duration = 650;
  const startTime = performance.now();

  const tick = now => {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = start + (end - start) * eased;
    element.textContent = decimals ? value.toFixed(decimals) + suffix : Math.round(value).toLocaleString("es-CO") + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function animateGauge(targetAverage) {
  cancelAnimationFrame(state.gaugeAnimationFrame);

  const start = Number(state.displayAvg || 0);
  const end = Number(targetAverage || 0);
  const duration = 950;
  const started = performance.now();
  const needle = $("#meterNeedle");
  const avgEl = $("#dashboardAvg");
  const faceEl = $("#meterFace");
  const labelEl = $("#meterMoodLabel");

  const render = now => {
    const p = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = start + (end - start) * eased;
    const angle = value > 0 ? -90 + ((Math.max(1, Math.min(5, value)) - 1) / 4) * 180 : -90;

    needle.style.transform = `rotate(${angle}deg)`;
    avgEl.textContent = value.toFixed(1);

    if (p < 1) {
      state.gaugeAnimationFrame = requestAnimationFrame(render);
    } else {
      state.displayAvg = end;
      const nextFace = moodFace(end);
      if (faceEl.textContent !== nextFace) {
        faceEl.textContent = nextFace;
        faceEl.classList.remove("face-change");
        void faceEl.offsetWidth;
        faceEl.classList.add("face-change");
      }
      labelEl.textContent = moodStatus(end);
    }
  };

  state.gaugeAnimationFrame = requestAnimationFrame(render);
}

function renderAllRealtimeViews(rows, isNewResponse = false) {
  const stats = calculateStats(rows);

  // Admin KPI
  animateNumber($("#adminTotal"), stats.total);
  animateNumber($("#adminUsers"), stats.uniqueUsers);
  animateNumber($("#adminAvg"), stats.average, { decimals: 1 });
  animateNumber($("#adminEnergy"), stats.energyPct, { suffix: "%" });
  animateNumber($("#adminPause"), stats.pausePct, { suffix: "%" });
  $("#adminAvgFace").textContent = moodFace(stats.average);

  // Private dashboard KPI
  animateNumber($("#dashboardTotal"), stats.total);
  animateNumber($("#dashboardEnergy"), stats.energyPct, { suffix: "%" });
  animateNumber($("#dashboardPause"), stats.pausePct, { suffix: "%" });
  animateGauge(stats.average);

  const now = new Date();
  $("#dashboardStatus").textContent = stats.total
    ? `Última actualización ${now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} · ${stats.total.toLocaleString("es-CO")} respuestas reales`
    : "Todavía no hay respuestas registradas.";

  renderLiveBars(rows);
  renderResponsesList();

  if (isNewResponse) {
    $$(".kpi, .dash-stat, .dashboard-hero, .live-chart-card").forEach(el => {
      el.classList.remove("live-flash");
      void el.offsetWidth;
      el.classList.add("live-flash");
    });
  }
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = timestampToDate(value);
  if (!date) return "Registrando...";
  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(value) {
  const date = timestampToDate(value);
  if (!date) return "Ahora";
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function renderLiveBars(rows) {
  const container = $("#liveBars");
  if (!container) return;
  container.innerHTML = "";

  const recent = rows
    .filter(row => Number(row.happiness) >= 1 && Number(row.happiness) <= 5)
    .slice(0, 12)
    .reverse();

  if (!recent.length) {
    container.innerHTML = '<div class="empty-state"><span>📊</span><p>El gráfico aparecerá cuando lleguen respuestas.</p></div>';
    return;
  }

  const colors = { 1: "#ff6b82", 2: "#ff9f47", 3: "#f5cf39", 4: "#58d77e", 5: "#24c9aa" };

  recent.forEach((row, index) => {
    const value = Number(row.happiness);
    const item = document.createElement("div");
    item.className = "live-bar-item" + (index === recent.length - 1 ? " newest-bar" : "");
    item.title = `${row.name || "Participante"}: ${value}/5 · ${MOOD_LABELS[value] || ""}`;

    const label = document.createElement("b");
    label.textContent = String(value);

    const track = document.createElement("span");
    track.className = "live-bar-track";

    const bar = document.createElement("i");
    bar.style.setProperty("--bar-color", colors[value] || "#44b8ff");
    track.appendChild(bar);

    const time = document.createElement("small");
    time.textContent = formatTime(row.createdAt);

    item.append(label, track, time);
    container.appendChild(item);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.height = `${Math.max(16, (value / 5) * 118)}px`;
      });
    });
  });

  container.scrollLeft = container.scrollWidth;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function responseMatchesFilters(row) {
  const search = $("#responseSearch").value.trim().toLocaleLowerCase("es");
  const moodFilter = $("#moodFilter").value;
  const name = String(row.name || "").toLocaleLowerCase("es");
  const searchMatches = !search || name.includes(search);
  const moodMatches = moodFilter === "all" || String(row.happiness) === moodFilter;
  return searchMatches && moodMatches;
}

function renderResponsesList() {
  const container = $("#responsesList");
  if (!container) return;

  const filtered = state.responses.filter(responseMatchesFilters);
  const visible = filtered.slice(0, 250);

  $("#responsesCountText").textContent = filtered.length === state.responses.length
    ? `${state.responses.length.toLocaleString("es-CO")} respuestas cargadas en tiempo real`
    : `${filtered.length.toLocaleString("es-CO")} coincidencias de ${state.responses.length.toLocaleString("es-CO")} respuestas`;

  if (!visible.length) {
    container.innerHTML = '<div class="empty-state"><span>☁️</span><p>No hay respuestas que coincidan con este filtro.</p></div>';
    return;
  }

  container.innerHTML = visible.map((row, index) => {
    const mood = Number(row.happiness) || 0;
    const needs = Array.isArray(row.needs) ? row.needs : [];
    const tags = needs.map(need => `<span class="need-tag">${escapeHtml(NEED_LABELS[need] || need)}</span>`).join("");

    return `
      <article class="response-card" style="animation-delay:${Math.min(index, 15) * 0.025}s">
        <div class="response-top">
          <div class="response-person">
            <span class="person-avatar">👤</span>
            <div>
              <b>${escapeHtml(row.name || "Sin nombre")}</b>
              <small>${escapeHtml(formatDateTime(row.createdAt))}</small>
            </div>
          </div>
          <span class="score-badge score-${mood}">${mood}/5</span>
        </div>
        <p class="response-mood">${escapeHtml(MOOD_LABELS[mood] || "Respuesta registrada")}</p>
        <div class="need-tags">${tags || '<span class="need-tag">Sin necesidades seleccionadas</span>'}</div>
      </article>`;
  }).join("");

  if (filtered.length > visible.length) {
    container.insertAdjacentHTML("beforeend", `<div class="empty-state"><p>Mostrando las 250 respuestas más recientes de este filtro. Usa la búsqueda para localizar un participante.</p></div>`);
  }
}

function exportResponsesCsv() {
  if (!state.adminUser || !state.responses.length) {
    toast("No hay respuestas para exportar.");
    return;
  }

  const header = ["Nombre", "Felicidad", "Estado", "Necesidades", "Fecha"];
  const lines = state.responses.map(row => {
    const mood = Number(row.happiness) || 0;
    const needs = Array.isArray(row.needs) ? row.needs.map(n => NEED_LABELS[n] || n).join(" | ") : "";
    return [
      row.name || "",
      mood,
      MOOD_LABELS[mood] || "",
      needs,
      formatDateTime(row.createdAt)
    ].map(csvCell).join(",");
  });

  const csv = "\uFEFF" + [header.map(csvCell).join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `feliciometro-respuestas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

// ========================== PARTICIPANTE ==========================
$("#nameForm").addEventListener("submit", event => {
  event.preventDefault();
  state.name = $("#nameInput").value.trim();
  if (!state.name) return;
  personalizeExperience();
  go("mood");
});

$$(".mood-option").forEach(button => {
  button.addEventListener("click", () => {
    $$(".mood-option").forEach(item => item.classList.remove("selected"));
    button.classList.add("selected");
    state.mood = Number(button.dataset.mood);
    $("#goNeeds").disabled = false;
  });
});

$("#goNeeds").addEventListener("click", () => {
  $("#needName").textContent = state.name || "Tú";
  go("needs");
});

$$(".needs-grid button").forEach(button => {
  button.addEventListener("click", () => {
    button.classList.toggle("selected");
    state.needs = $$(".needs-grid button.selected").map(item => item.dataset.need);
    $("#submitResponse").disabled = state.needs.length === 0;
  });
});

$("#submitResponse").addEventListener("click", async () => {
  const button = $("#submitResponse");
  button.disabled = true;
  button.innerHTML = '<span class="loading-inline">Guardando tu respuesta...</span>';

  try {
    await saveResponse();
    personalizeExperience();
    personalizedClosing();
    go("thanks");
  } catch (error) {
    console.error("No se pudo guardar la respuesta", error);
    toast(firebaseConfigured()
      ? "No pudimos guardar tu respuesta. Revisa la conexión e inténtalo de nuevo."
      : "Firebase todavía no está configurado. Configúralo antes de recibir respuestas reales.");
    button.disabled = false;
  } finally {
    button.innerHTML = 'Enviar mi respuesta <span aria-hidden="true">→</span>';
  }
});

$("#finishExperience").addEventListener("click", resetParticipantFlow);

// ========================== NAVEGACIÓN ==========================
$$('[data-go]').forEach(button => {
  button.addEventListener("click", () => go(button.dataset.go));
});

$("#openAdmin").addEventListener("click", () => {
  if (state.adminUser) go("admin");
  else go("admin-login");
});

// ========================== ADMIN ==========================
$("#adminForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("#adminError").textContent = "";

  if (!state.firebaseReady || !state.auth) {
    $("#adminError").textContent = "Firebase todavía no está configurado en js/firebase-config.js.";
    return;
  }

  try {
    await signInWithEmailAndPassword(
      state.auth,
      $("#adminEmail").value.trim(),
      $("#adminPassword").value
    );
    go("admin");
  } catch (error) {
    console.error("Error de autenticación", error);
    $("#adminError").textContent = "Correo o contraseña incorrectos.";
  }
});

$("#logout").addEventListener("click", async () => {
  if (state.auth) await signOut(state.auth);
  go("welcome");
});

$("#openFestival").addEventListener("click", () => go("dashboard"));
$("#responseSearch").addEventListener("input", renderResponsesList);
$("#moodFilter").addEventListener("change", renderResponsesList);
$("#exportCsv").addEventListener("click", exportResponsesCsv);

$("#copyLink").addEventListener("click", async () => {
  const publicUrl = `${location.origin}${location.pathname}`;
  try {
    await navigator.clipboard.writeText(publicUrl);
    toast("Enlace público del Feliciómetro copiado.");
  } catch {
    toast("No se pudo copiar el enlace automáticamente.");
  }
});

initFirebase();
