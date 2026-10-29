(() => {
  "use strict";
  const ALPHABET = [..."ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"];
  const COLORS = { blue: "#2370dc", orange: "#ef8523", green: "#24a65b", red: "#d63737" };
  const $ = (id) => document.getElementById(id);

  const configScreen = $("config-screen");
  const gameScreen = $("game-screen");
  const activeRoscoEl = $("active-rosco");
  const inactiveRoscoEl = $("inactive-rosco");
  const turnLabel = $("turn-label");
  const scoreboard = $("scoreboard");
  const fullscreenButton = $("fullscreen-button");
  const confirmDialog = $("confirm-dialog");
  let blueTeam = null, orangeTeam = null, activeTeam = null, inactiveTeam = null;
  let pendingAction = null;

  function createTeam(name, color, letters) {
    return { name, color, letters: [...letters], states: letters.map(() => "pending"), currentIndex: 0 };
  }
  function countState(team, state) { return team.states.filter((s) => s === state).length; }
  function isComplete(team) { return countState(team, "pending") === 0; }

  function findNextPending(team, startIndex) {
    const n = team.states.length;
    for (let step = 0; step < n; step++) {
      const candidate = ((startIndex + step) % n + n) % n;
      if (team.states[candidate] === "pending") {
        team.currentIndex = candidate;
        return;
      }
    }
    team.currentIndex = -1;
  }

  // La letra pasada sigue pendiente, pero no vuelve a seleccionarse hasta completar la vuelta.
  function passLetter(team) {
    if (isComplete(team) || team.currentIndex < 0) return;
    findNextPending(team, team.currentIndex + 1);
  }

  function selectedLetters() {
    return ALPHABET.filter((letter) => {
      if (letter === "Ñ" && !$("include-n").checked) return false;
      if (letter === "W" && !$("include-w").checked) return false;
      if (letter === "X" && !$("include-x").checked) return false;
      if (letter === "Y" && !$("include-y").checked) return false;
      if (letter === "Z" && !$("include-z").checked) return false;
      return true;
    });
  }

  function startGame(event) {
    event.preventDefault();
    const letters = selectedLetters();
    if (!letters.length) { alert("Debes incluir al menos una letra."); return; }
    blueTeam = createTeam($("name-blue").value.trim() || "Equipo azul", COLORS.blue, letters);
    orangeTeam = createTeam($("name-orange").value.trim() || "Equipo naranja", COLORS.orange, letters);
    activeTeam = blueTeam;
    inactiveTeam = orangeTeam;
    configScreen.hidden = true;
    gameScreen.hidden = false;
    render();
  }

  function switchTurn() {
    [activeTeam, inactiveTeam] = [inactiveTeam, activeTeam];
    render();
  }

  function answerCurrent(correct) {
    if (!activeTeam || isComplete(activeTeam) || activeTeam.currentIndex < 0) { render(); return; }
    const answeredIndex = activeTeam.currentIndex;
    activeTeam.states[answeredIndex] = correct ? "correct" : "incorrect";
    findNextPending(activeTeam, answeredIndex + 1);
    // Correcta: conserva turno. Incorrecta: pasa al otro participante.
    if (!correct) switchTurn();
    else render();
  }

  function passTurn() {
    if (!activeTeam) return;
    if (!isComplete(activeTeam)) passLetter(activeTeam);
    // Espacio cambia de participante y deja la letra pasada pendiente.
    switchTurn();
  }

  function render() {
    if (!activeTeam || !inactiveTeam) return;
    turnLabel.textContent = isComplete(activeTeam)
      ? `Turno: ${activeTeam.name} · rosco completado`
      : `Turno: ${activeTeam.name} · letra ${activeTeam.letters[activeTeam.currentIndex]}`;
    scoreboard.textContent =
      `${blueTeam.name}: ${countState(blueTeam, "correct")} correctas · ${countState(blueTeam, "incorrect")} incorrectas` +
      `     |     ${orangeTeam.name}: ${countState(orangeTeam, "correct")} correctas · ${countState(orangeTeam, "incorrect")} incorrectas`;
    renderRosco(activeTeam, activeRoscoEl, true);
    renderRosco(inactiveTeam, inactiveRoscoEl, false);
    fullscreenButton.textContent = document.fullscreenElement ? "Salir pantalla completa" : "Pantalla completa";
  }

  function renderRosco(team, container, large) {
    container.replaceChildren();
    const width = container.clientWidth || (large ? window.innerWidth : 150);
    const height = container.clientHeight || (large ? window.innerHeight : 150);
    const cx = width / 2, cy = height / 2;
    const radius = large
      ? Math.max(70, Math.min(width * 0.32, height * 0.39, 255))
      : Math.min(width, height) * 0.36;
    const diameter = large
      ? Math.max(34, Math.min(54, radius / 4))
      : Math.max(16, Math.min(25, radius / 3));
    const letterRadius = Math.max(0, radius - diameter / 2 - (large ? 4 : 2));

    team.letters.forEach((letter, index) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index / team.letters.length);
      const circle = document.createElement("div");
      const state = team.states[index];
      circle.className = `rosco-letter ${state}`;
      if (large && index === team.currentIndex && !isComplete(team)) circle.classList.add("current");
      circle.textContent = letter;
      circle.style.left = `${cx + letterRadius * Math.cos(angle)}px`;
      circle.style.top = `${cy + letterRadius * Math.sin(angle)}px`;
      circle.style.width = `${diameter}px`;
      circle.style.height = `${diameter}px`;
      circle.style.fontSize = `${large ? Math.max(14, diameter / 2) : Math.max(9, diameter / 2)}px`;
      circle.style.backgroundColor = state === "correct" ? COLORS.green : state === "incorrect" ? COLORS.red : team.color;
      circle.title = `${letter}: ${state === "correct" ? "correcta" : state === "incorrect" ? "incorrecta" : "pendiente"}`;
      container.append(circle);
    });

    const name = document.createElement("div");
    name.className = "rosco-name";
    name.textContent = team.name;
    container.append(name);
    if (large) {
      const next = document.createElement("div");
      next.className = "rosco-next";
      next.textContent = isComplete(team) ? "Rosco completado" : `Siguiente letra: ${team.letters[team.currentIndex]}`;
      container.append(next);
    }
  }

  function askConfirmation(message, action) {
    pendingAction = action;
    $("dialog-message").textContent = message;
    if (typeof confirmDialog.showModal === "function") confirmDialog.showModal();
    else if (confirm(message)) { const actionToRun = pendingAction; pendingAction = null; actionToRun?.(); }
  }
  function closeConfirmation(confirmed) {
    if (confirmDialog.open) confirmDialog.close();
    const action = pendingAction;
    pendingAction = null;
    if (confirmed) action?.();
  }
  function resetGame() {
    if (!blueTeam || !orangeTeam) return;
    blueTeam.states.fill("pending");
    orangeTeam.states.fill("pending");
    blueTeam.currentIndex = 0;
    orangeTeam.currentIndex = 0;
    activeTeam = blueTeam;
    inactiveTeam = orangeTeam;
    render();
  }
  function backToConfig() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    gameScreen.hidden = true;
    configScreen.hidden = false;
  }
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      alert("El navegador no ha permitido cambiar a pantalla completa.");
    }
    render();
  }

  $("config-form").addEventListener("submit", startGame);
  $("restart-button").addEventListener("click", () => askConfirmation("¿Quieres reiniciar los dos roscos?", resetGame));
  $("config-button").addEventListener("click", () => askConfirmation("¿Volver a la configuración? Se perderá el progreso actual.", backToConfig));
  fullscreenButton.addEventListener("click", toggleFullscreen);
  $("dialog-cancel").addEventListener("click", () => closeConfirmation(false));
  $("dialog-confirm").addEventListener("click", () => closeConfirmation(true));
  confirmDialog.addEventListener("cancel", () => { pendingAction = null; });
  document.addEventListener("fullscreenchange", render);
  window.addEventListener("resize", () => { if (activeTeam && !gameScreen.hidden) render(); });

  document.addEventListener("keydown", (event) => {
    if (!activeTeam || gameScreen.hidden || confirmDialog.open) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === "Space") { event.preventDefault(); passTurn(); }
    else if (event.code === "Enter" || event.code === "NumpadEnter") { event.preventDefault(); answerCurrent(true); }
    else if (event.key.toLowerCase() === "x") { event.preventDefault(); answerCurrent(false); }
  });
})();
