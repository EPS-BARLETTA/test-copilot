"use strict";

(function(){
  const CONFIG_KEY = "eps_datahub_config_v1";
  const SESSION_KEY = "eps_datahub_session_v1";
  const LAST_QR_KEY = "eps_datahub_last_qr";
  let importedFromQuery = false;

  const pages = {
    cover: document.getElementById("cover"),
    config: document.getElementById("config"),
    entry: document.getElementById("entry"),
    summary: document.getElementById("summary")
  };

  const configQrModal = document.getElementById("configQrModal");
  const entryQrModal = document.getElementById("entryQrModal");

  const state = {
    config: {
      fields: [],
      chrono: false
    },
    mode: "indiv",
    participants: [],
    teams: [],
    currentParticipant: null,
    currentTeam: null
  };

  const elements = {
    btnGoConfig: document.getElementById("btnGoConfig"),
    btnGoEntry: document.getElementById("btnGoEntry"),
    btnBackCover1: document.getElementById("btnBackCover1"),
    btnBackCover2: document.getElementById("btnBackCover2"),
    btnGoSummary: document.getElementById("btnGoSummary"),
    btnBackEntry: document.getElementById("btnBackEntry"),
    btnAddField: document.getElementById("btnAddField"),
    cfgChrono: document.getElementById("cfgChrono"),
    fieldList: document.getElementById("fieldList"),
    participantTabs: document.getElementById("participantTabs"),
    participantForm: document.getElementById("participantForm"),
    teamTabs: document.getElementById("teamTabs"),
    teamForm: document.getElementById("teamForm"),
    summaryList: document.getElementById("summaryList"),
    sessionInfo: document.getElementById("sessionInfo"),
    modeHint: document.getElementById("modeHint"),
    btnAddParticipant: document.getElementById("btnAddParticipant"),
    btnAddTeam: document.getElementById("btnAddTeam"),
    modeButtons: document.querySelectorAll(".mode-switch button[data-mode]"),
    btnShareConfig: document.getElementById("btnShareConfig"),
    btnResetApp: document.getElementById("btnResetApp"),
    configQrBox: document.getElementById("configQrBox"),
    btnConfigQrClose: document.getElementById("btnConfigQrClose"),
    entryQrBox: document.getElementById("entryQrBox"),
    entryQrTitle: document.getElementById("entryQrTitle"),
    entryQrStatus: document.getElementById("entryQrStatus"),
    btnEntryQrClose: document.getElementById("btnEntryQrClose"),
    btnEntryQrFullscreen: document.getElementById("btnEntryQrFullscreen"),
    btnOpenPrint: document.getElementById("btnOpenPrint")
  };

  function normalizeConfig(){
    if(!state.config || typeof state.config !== "object"){
      state.config = { fields: [], chrono: false };
    }
    if(!Array.isArray(state.config.fields)){
      state.config.fields = [];
    }
    state.config.chrono = Boolean(state.config.chrono);
  }

  const colorPalette = ["#2563eb","#0ea5e9","#38bdf8","#60a5fa","#1d4ed8","#3b82f6","#0284c7","#7dd3fc"];
  const timers = new Map();

  function uid(){
    return Math.random().toString(36).slice(2,9);
  }

  function saveConfig(){
    localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
  }

  function saveSession(){
    const data = {
      participants: state.participants,
      teams: state.teams,
      currentParticipant: state.currentParticipant,
      currentTeam: state.currentTeam,
      mode: state.mode
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function loadConfig(){
    try{
      const raw = localStorage.getItem(CONFIG_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && Array.isArray(parsed.fields)){
          state.config = parsed;
          normalizeConfig();
        }
      }
    }catch(e){
      console.warn("Impossible de charger la configuration", e);
    }
  }

  function loadSession(){
    try{
      const raw = localStorage.getItem(SESSION_KEY);
      if(!raw) return;
      const parsed = JSON.parse(raw);
      if(parsed && Array.isArray(parsed.participants)){
        state.participants = parsed.participants;
        state.teams = parsed.teams || [];
        state.participants.forEach((p, idx)=>{
          if(!p.color) p.color = colorPalette[idx % colorPalette.length];
          p.timerMs = p.timerMs || 0;
          p.timerRunning = Boolean(p.timerRunning);
          if(!p.timerRunning) p.timerStart = null;
        });
        state.teams.forEach((t, idx)=>{
          if(!t.color) t.color = colorPalette[idx % colorPalette.length];
          t.timerMs = t.timerMs || 0;
          t.timerRunning = Boolean(t.timerRunning);
          if(!t.timerRunning) t.timerStart = null;
        });
        state.currentParticipant = parsed.currentParticipant || (state.participants[0]?.id || null);
        state.currentTeam = parsed.currentTeam || (state.teams[0]?.id || null);
        state.mode = parsed.mode || "indiv";
      }
    }catch(e){
      console.warn("Impossible de charger la session", e);
    }
  }

  function decodeConfigFromQuery(){
    const params = new URLSearchParams(window.location.search);
    const token = params.get("config");
    if(!token) return;
    try{
      let json;
      try{
        const decoded = atob(token);
        json = window.LZString && window.LZString.decompressFromEncodedURIComponent
          ? window.LZString.decompressFromEncodedURIComponent(decoded)
          : decodeURIComponent(decoded);
      }catch(err){
        json = decodeURIComponent(atob(token));
      }
      const data = JSON.parse(json);
      if(data && Array.isArray(data.fields)){
        state.config = data;
        normalizeConfig();
        importedFromQuery = true;
        saveConfig();
        params.delete("config");
        const url = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, "", url);
      }
    }catch(e){
      console.warn("Config import invalide", e);
    }
  }

  function setPage(id){
    Object.entries(pages).forEach(([key, node])=>{
      if(node) node.classList.toggle("visible", key === id);
    });
  }

  function ensureFieldCodes(){
    state.config.fields.forEach(field=>{
      if(!field.code) field.code = makeCode(field.label);
      if(field.type !== "select"){
        field.options = [];
        field.optionsText = "";
      }else if(!field.options || !field.options.length){
        if(field.optionsText){
          field.options = field.optionsText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
        }else{
          field.options = [];
        }
      }
    });
  }

  function makeCode(label){
    if(!label) return `F${Math.floor(Math.random()*90)+10}`;
    const clean = label.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const asc = clean.match(/[A-Z0-9]/g);
    if(asc && asc.length){
      return asc.join("").slice(0,6) || `F${Math.floor(Math.random()*90)+10}`;
    }
    const words = clean.split(/\s+/).filter(Boolean);
    if(words.length === 1) return words[0].slice(0,6).toUpperCase();
    return words.map(w=>w[0]).join("").slice(0,6).toUpperCase();
  }

  function renderFields(){
    ensureFieldCodes();
    const container = elements.fieldList;
    container.innerHTML = "";
    if(!state.config.fields.length){
      container.innerHTML = `<p class="muted small">Ajoutez vos premiers champs (ex : Niveau de départ, Projet de grimpe, Résultat).</p>`;
      return;
    }
    state.config.fields.forEach(field=>{
      const wrapper = document.createElement("div");
      wrapper.className = "note";
      wrapper.innerHTML = `
        <label class="field">
          <span>Intitulé</span>
          <input value="${field.label || ""}" data-field="label" data-id="${field.id}">
        </label>
        <div class="input-row">
          <label class="field">
            <span>Type</span>
            <select data-field="type" data-id="${field.id}">
              <option value="text" ${field.type==="text"?"selected":""}>Saisie libre</option>
              <option value="select" ${field.type==="select"?"selected":""}>Menu déroulant</option>
            </select>
          </label>
          <label class="field">
            <span>Abréviation QR</span>
            <input value="${field.code || ""}" data-field="code" data-id="${field.id}">
          </label>
        </div>
        ${field.type==="select"
          ? `<div class="dropdown-area">
              <span class="muted small">Une option par ligne</span>
              <textarea data-field="options" data-id="${field.id}" placeholder="Ex : 4A&#10;4A+&#10;4B">${field.optionsText || ""}</textarea>
            </div>` : ""
        }
        <div style="text-align:right;margin-top:8px;">
          <button class="btn btn-red small" data-remove="${field.id}">Supprimer</button>
        </div>
      `;
      container.appendChild(wrapper);
    });

    container.querySelectorAll("input[data-field], select[data-field], textarea[data-field]").forEach(input=>{
      input.addEventListener("input", ()=>{
        const id = input.dataset.id;
        const field = state.config.fields.find(f=>f.id===id);
        if(!field) return;
        const prop = input.dataset.field;
        if(prop === "type"){
          field.type = input.value;
          if(field.type !== "select"){
            field.options = [];
            field.optionsText = "";
          }
          saveConfig();
          renderFields();
          renderParticipantForm();
          renderTeamForm();
          return;
        }
        field[prop] = input.value;
        if(prop === "label" && !field.code){
          field.code = makeCode(field.label);
        }
        if(prop === "options") {
          field.optionsText = input.value;
          field.options = input.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
        }
        saveConfig();
        renderParticipantForm();
        renderTeamForm();
      });
    });

    container.querySelectorAll("button[data-remove]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.remove;
        state.config.fields = state.config.fields.filter(f=>f.id!==id);
        renderFields();
        saveConfig();
      });
    });
    updateSessionInfo();
  }

  function addField(){
    state.config.fields.push({
      id: uid(),
      label: "Nouveau champ",
      type: "text",
      options: [],
      optionsText: "",
      code: ""
    });
    renderFields();
    saveConfig();
  }

  function renderModeButtons(){
    elements.modeButtons.forEach(btn=>{
      const mode = btn.dataset.mode;
      btn.classList.toggle("btn-blue", state.mode === mode);
      btn.classList.toggle("btn-light", state.mode !== mode);
    });
    document.getElementById("indivPane").style.display = state.mode === "indiv" ? "block" : "none";
    document.getElementById("teamPane").style.display = state.mode === "team" ? "block" : "none";
    const base = state.mode === "indiv"
      ? "Ajoutez vos élèves puis saisissez les champs paramétrés."
      : "Chaque équipe peut contenir plusieurs membres. Les champs sont communs à la cordée / équipe.";
    elements.modeHint.textContent = state.config.chrono ? `${base} Chrono disponible.` : base;
  }

  function addParticipant(){
    const entry = {
      id: uid(),
      prenom: "",
      classe: "",
      note: "",
      fields: {},
      color: colorPalette[state.participants.length % colorPalette.length],
      timerMs: 0,
      timerRunning: false,
      timerStart: null
    };
    state.participants.push(entry);
    state.currentParticipant = entry.id;
    saveSession();
    renderParticipants();
  }

  function addTeam(){
    const entry = {
      id: uid(),
      name: "",
      members: "",
      note: "",
      fields: {},
      color: colorPalette[state.teams.length % colorPalette.length],
      timerMs: 0,
      timerRunning: false,
      timerStart: null
    };
    state.teams.push(entry);
    state.currentTeam = entry.id;
    saveSession();
    renderTeams();
  }

  function renderParticipants(){
    const tabs = elements.participantTabs;
    tabs.innerHTML = "";
    if(!state.participants.length){
      tabs.innerHTML = `<p class="muted small">Ajoutez vos premiers élèves.</p>`;
      elements.participantForm.innerHTML = "";
      return;
    }
    const grid = document.createElement("div");
    grid.className = "tab-grid";
    state.participants.forEach((p, idx)=>{
      if(!p.color) p.color = colorPalette[idx % colorPalette.length];
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tab" + (state.currentParticipant===p.id ? " active" : "");
      tab.dataset.id = p.id;
      tab.style.background = p.color;
      tab.innerHTML = `
        <div class="tab-name">${p.prenom || "Élève"}</div>
        <div class="tab-sub">${p.classe || ""}</div>
      `;
      tab.onclick = ()=>{
        state.currentParticipant = p.id;
        renderParticipants();
        saveSession();
      };
      grid.appendChild(tab);
    });
    tabs.appendChild(grid);
    renderParticipantForm();
  }

  function updateParticipantTabLabel(id, prenom, classe){
    const tab = elements.participantTabs.querySelector(`[data-id="${id}"]`);
    if(tab){
      const nameSpan = tab.querySelector(".tab-name");
      const subSpan = tab.querySelector(".tab-sub");
      if(nameSpan) nameSpan.textContent = prenom || "Élève";
      if(subSpan) subSpan.textContent = classe || "";
    }
  }

  function renderParticipantForm(){
    const target = state.participants.find(p=>p.id===state.currentParticipant);
    if(!target){
      elements.participantForm.innerHTML = "";
      return;
    }
    const inputs = state.config.fields.map(field=>{
      if(field.type === "select"){
        const options = (field.options || []).map(opt=>`<option value="${opt}" ${target.fields[field.id]===opt?"selected":""}>${opt}</option>`).join("");
        return `
          <label class="field">
            <span>${field.label}</span>
            <select data-entry="${target.id}" data-field="${field.id}">
              <option value="">—</option>
              ${options}
            </select>
          </label>
        `;
      }
      return `
        <label class="field">
          <span>${field.label}</span>
          <input data-entry="${target.id}" data-field="${field.id}" value="${target.fields[field.id] || ""}">
        </label>
      `;
    }).join("");

    const chronoBlock = state.config.chrono ? buildTimerBlock(target) : "";

    elements.participantForm.innerHTML = `
      <div class="input-row">
        <label class="field">
          <span>Prénom / identifiant</span>
          <input id="participantName" value="${target.prenom}">
        </label>
        <label class="field">
          <span>Classe / groupe</span>
          <input id="participantClass" value="${target.classe || ""}">
        </label>
      </div>
      ${state.config.chrono ? chronoBlock : ""}
      ${inputs}
      <label class="field">
        <span>Commentaire</span>
        <textarea id="participantNote">${target.note || ""}</textarea>
      </label>
      <div class="summary-actions">
        <button class="btn btn-blue" id="btnShowParticipantQr">QR ScanProf</button>
        <button class="btn btn-red" id="btnDeleteParticipant">Supprimer</button>
      </div>
    `;

    document.getElementById("participantName").oninput = (e)=>{
      target.prenom = e.target.value;
      updateParticipantTabLabel(target.id, target.prenom, target.classe);
      saveSession();
    };
    document.getElementById("participantClass").oninput = (e)=>{
      target.classe = e.target.value;
      updateParticipantTabLabel(target.id, target.prenom, target.classe);
      saveSession();
    };
    document.getElementById("participantNote").oninput = (e)=>{
      target.note = e.target.value;
      saveSession();
    };
    elements.participantForm.querySelectorAll("input[data-field], select[data-field]").forEach(input=>{
      input.addEventListener("input", ()=>{
        const fieldId = input.dataset.field;
        target.fields[fieldId] = input.value;
        saveSession();
      });
    });
    document.getElementById("btnShowParticipantQr").onclick = ()=>{
      openEntryQrModal(target,"indiv");
    };
    document.getElementById("btnDeleteParticipant").onclick = ()=>{
      cleanupTimer(target.id);
      state.participants = state.participants.filter(p=>p.id!==target.id);
      state.currentParticipant = state.participants[0]?.id || null;
      saveSession();
      renderParticipants();
    };
    if(state.config.chrono){
      attachTimerControls(target);
    }
  }

  function renderTeams(){
    const tabs = elements.teamTabs;
    tabs.innerHTML = "";
    if(!state.teams.length){
      tabs.innerHTML = `<p class="muted small">Ajoutez vos premières équipes.</p>`;
      elements.teamForm.innerHTML = "";
      return;
    }
    const grid = document.createElement("div");
    grid.className = "tab-grid";
    state.teams.forEach((team, idx)=>{
      if(!team.color) team.color = colorPalette[idx % colorPalette.length];
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tab" + (state.currentTeam===team.id ? " active" : "");
      tab.dataset.id = team.id;
      tab.style.background = team.color;
      tab.innerHTML = `
        <div class="tab-name">${team.name || "Équipe"}</div>
        <div class="tab-sub">${team.members || ""}</div>
      `;
      tab.onclick = ()=>{
        state.currentTeam = team.id;
        renderTeams();
        saveSession();
      };
      grid.appendChild(tab);
    });
    tabs.appendChild(grid);
    renderTeamForm();
  }

  function updateTeamTabLabel(id, name, members){
    const tab = elements.teamTabs.querySelector(`[data-id="${id}"]`);
    if(tab){
      const nameSpan = tab.querySelector(".tab-name");
      const subSpan = tab.querySelector(".tab-sub");
      if(nameSpan) nameSpan.textContent = name || "Équipe";
      if(subSpan) subSpan.textContent = members || "";
    }
  }

  function renderTeamForm(){
    const team = state.teams.find(t=>t.id===state.currentTeam);
    if(!team){
      elements.teamForm.innerHTML = "";
      return;
    }
    const inputs = state.config.fields.map(field=>{
      if(field.type === "select"){
        const options = (field.options || []).map(opt=>`<option value="${opt}" ${team.fields[field.id]===opt?"selected":""}>${opt}</option>`).join("");
        return `
          <label class="field">
            <span>${field.label}</span>
            <select data-team="${team.id}" data-field="${field.id}">
              <option value="">—</option>
              ${options}
            </select>
          </label>
        `;
      }
      return `
        <label class="field">
          <span>${field.label}</span>
          <input data-team="${team.id}" data-field="${field.id}" value="${team.fields[field.id] || ""}">
        </label>
      `;
    }).join("");

    const chronoBlock = state.config.chrono ? buildTimerBlock(team) : "";

    elements.teamForm.innerHTML = `
      <div class="input-row">
        <label class="field">
          <span>Nom de l’équipe / cordée</span>
          <input id="teamName" value="${team.name}">
        </label>
        <label class="field">
          <span>Membres</span>
          <input id="teamMembers" value="${team.members || ""}" placeholder="Ex : Léo, Ana, Tom">
        </label>
      </div>
      ${state.config.chrono ? chronoBlock : ""}
      ${inputs}
      <label class="field">
        <span>Commentaire</span>
        <textarea id="teamNote">${team.note || ""}</textarea>
      </label>
      <div class="summary-actions">
        <button class="btn btn-blue" id="btnShowTeamQr">QR ScanProf</button>
        <button class="btn btn-red" id="btnDeleteTeam">Supprimer</button>
      </div>
    `;

    document.getElementById("teamName").oninput = (e)=>{
      team.name = e.target.value;
      updateTeamTabLabel(team.id, team.name, team.members);
      saveSession();
    };
    document.getElementById("teamMembers").oninput = (e)=>{
      team.members = e.target.value;
      updateTeamTabLabel(team.id, team.name, team.members);
      saveSession();
    };
    document.getElementById("teamNote").oninput = (e)=>{
      team.note = e.target.value;
      saveSession();
    };
    elements.teamForm.querySelectorAll("input[data-field], select[data-field]").forEach(input=>{
      input.addEventListener("input", ()=>{
        const fieldId = input.dataset.field;
        team.fields[fieldId] = input.value;
        saveSession();
      });
    });
    document.getElementById("btnShowTeamQr").onclick = ()=>{
      openEntryQrModal(team,"team");
    };
    document.getElementById("btnDeleteTeam").onclick = ()=>{
      cleanupTimer(team.id);
      state.teams = state.teams.filter(t=>t.id!==team.id);
      state.currentTeam = state.teams[0]?.id || null;
      saveSession();
      renderTeams();
    };
    if(state.config.chrono){
      attachTimerControls(team);
    }
  }

  function buildTimerBlock(entry){
    const current = entry.timerRunning
      ? (entry.timerMs || 0) + (Date.now() - (entry.timerStart || Date.now()))
      : (entry.timerMs || 0);
    return `
      <div class="timer-block" data-id="${entry.id}">
        <div class="timer-display" id="timerDisplay-${entry.id}">${formatDuration(current)}</div>
        <div class="timer-actions">
          <button class="btn btn-green small" data-timer="start">▶︎ Démarrer</button>
          <button class="btn btn-amber small" data-timer="stop">■ Stop</button>
          <button class="btn btn-light small" data-timer="reset">↺ Reset</button>
        </div>
      </div>
    `;
  }

  function formatDuration(ms=0){
    const total = Math.max(0, Math.floor(ms));
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const tenths = Math.floor((total % 1000) / 100);
    return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}.${tenths}`;
  }

  function updateTimerDisplay(id, ms){
    const el = document.getElementById(`timerDisplay-${id}`);
    if(el) el.textContent = formatDuration(ms);
  }

  function runTimer(entry){
    cleanupTimer(entry.id);
    const interval = setInterval(()=>{
      const ms = (entry.timerMs || 0) + (Date.now() - (entry.timerStart || Date.now()));
      updateTimerDisplay(entry.id, ms);
    }, 120);
    timers.set(entry.id, interval);
  }

  function startTimer(entry){
    if(entry.timerRunning) return;
    entry.timerRunning = true;
    entry.timerStart = Date.now();
    runTimer(entry);
    saveSession();
  }

  function stopTimer(entry){
    if(!entry.timerRunning) return;
    entry.timerRunning = false;
    entry.timerMs = (entry.timerMs || 0) + (Date.now() - (entry.timerStart || Date.now()));
    entry.timerStart = null;
    cleanupTimer(entry.id);
    updateTimerDisplay(entry.id, entry.timerMs);
    saveSession();
  }

  function resetTimer(entry){
    entry.timerRunning = false;
    entry.timerStart = null;
    entry.timerMs = 0;
    cleanupTimer(entry.id);
    updateTimerDisplay(entry.id, 0);
    saveSession();
  }

  function attachTimerControls(entry){
    const block = document.querySelector(`.timer-block[data-id="${entry.id}"]`);
    if(!block) return;
    block.querySelectorAll("button[data-timer]").forEach(btn=>{
      btn.onclick = ()=>{
        const action = btn.dataset.timer;
        if(action === "start") startTimer(entry);
        else if(action === "stop") stopTimer(entry);
        else resetTimer(entry);
      };
    });
    if(entry.timerRunning){
      runTimer(entry);
    }else{
      updateTimerDisplay(entry.id, entry.timerMs || 0);
    }
  }

  function cleanupTimer(id){
    if(timers.has(id)){
      clearInterval(timers.get(id));
      timers.delete(id);
    }
  }

  function updateSessionInfo(){
    const count = state.config.fields.length;
    if(count){
      elements.sessionInfo.textContent = `${count} champ(s) actifs${state.config.chrono ? " • Chrono actif" : ""}.`;
    }else{
      elements.sessionInfo.textContent = "Aucun champ paramétré. Configurez-les ou importez une configuration.";
    }
  }

  function openConfigQr(){
    if(!state.config.fields.length){
      alert("Ajoutez au moins un champ pour générer un QR.");
      return;
    }
    const signal = JSON.stringify(state.config);
    const payload = (window.LZString && window.LZString.compressToEncodedURIComponent)
      ? window.LZString.compressToEncodedURIComponent(signal)
      : signal;
    const encoded = btoa(payload);
    const url = `${window.location.origin}${window.location.pathname}?config=${encoded}`;
    elements.configQrBox.innerHTML = "";
    if(typeof QRCode === "undefined"){
      elements.configQrBox.textContent = "Librairie QR indisponible.";
    }else{
      new QRCode(elements.configQrBox, {
        text: url,
        width: 220,
        height: 220,
        correctLevel: QRCode.CorrectLevel.M
      });
    }
    configQrModal.classList.add("visible");
  }

  function closeConfigQr(){
    configQrModal.classList.remove("visible");
  }

  function openEntryQrModal(entry, type){
    if(!entry){
      alert("Sélectionnez d'abord une entrée.");
      return;
    }
    const payload = buildScanProfPayload(entry, type);
    if(!payload){
      entryQrModal.classList.remove("visible");
      return;
    }
    elements.entryQrBox.innerHTML = "";
    const json = JSON.stringify(payload);
    const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    const bytes = encoder ? encoder.encode(json).length : json.length;
    const max = window.ScanProfExport?.MAX_QR_BYTES || 2800;
    const fieldCount = Math.max(0, Object.keys(payload[0] || {}).length - 1);
    elements.entryQrTitle.textContent = type === "team"
      ? `QR équipe — ${entry.name || "Equipe"}`
      : `QR élève — ${entry.prenom || "Élève"}`;
    elements.entryQrStatus.textContent = `Champs : ${fieldCount} • ${bytes}/${max} octets`;
    if(bytes > max){
      elements.entryQrStatus.textContent += " • Réduisez la saisie ou scindez en plusieurs QR.";
    }

    if(typeof QRCode === "undefined"){
      elements.entryQrBox.textContent = "Librairie QR indisponible.";
    }else{
      new QRCode(elements.entryQrBox, {
        text: json,
        width: 220,
        height: 220,
        correctLevel: QRCode.CorrectLevel.M
      });
      try{
        sessionStorage.setItem(LAST_QR_KEY, json);
      }catch(e){}
    }
    entryQrModal.classList.add("visible");
  }

  function closeEntryQrModal(){
    entryQrModal.classList.remove("visible");
  }

  function buildScanProfPayload(entry, type){
    if(!window.ScanProfExport){
      alert("Fonctions QR indisponibles.");
      return null;
    }
    const data = {
      prenom: type === "team" ? (entry.name || "Equipe") : (entry.prenom || ""),
      classe: type === "team" ? (entry.members || "") : (entry.classe || ""),
      commentaire: entry.note || ""
    };
    state.config.fields.forEach((field, index)=>{
      const value = entry.fields[field.id];
      if(value){
        data[`observable_${index+1}`] = `${field.code || `F${index+1}`} ${value}`.trim();
      }
    });
    if(state.config.chrono && entry.timerMs){
      data.chrono = formatDuration(entry.timerMs);
    }
    return window.ScanProfExport.wrapPayload(data);
  }

  function renderSummary(){
    const list = elements.summaryList;
    list.innerHTML = "";
    const all = [
      ...state.participants.map(p=>({ type:"indiv", ref:p })),
      ...state.teams.map(t=>({ type:"team", ref:t }))
    ];
    if(!all.length){
      list.innerHTML = `<p class="muted">Aucune donnée saisie pour l’instant.</p>`;
      return;
    }
    all.forEach(item=>{
      const card = document.createElement("div");
      card.className = "summary-item";
      const title = item.type === "team"
        ? `${item.ref.name || "Equipe"} — ${item.ref.members || ""}`
        : `${item.ref.prenom || "Élève"} ${item.ref.classe || ""}`;
      card.innerHTML = `
        <strong>${title}</strong>
        <div class="summary-actions">
          <button class="btn btn-blue small">QR ScanProf</button>
        </div>
      `;
      card.querySelector("button").onclick = ()=>openEntryQrModal(item.ref, item.type);
      list.appendChild(card);
    });
  }

  function openPrint(){
    saveSession();
    window.open("print.html","_blank");
  }

  function resetApplication(){
    if(!confirm("Effacer la configuration et toutes les données ?")) return;
    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(SESSION_KEY);
    state.config = { fields: [], chrono: false };
    state.participants = [];
    state.teams = [];
    state.currentParticipant = null;
    state.currentTeam = null;
    saveConfig();
    saveSession();
    renderFields();
    renderParticipants();
    renderTeams();
    renderModeButtons();
    updateSessionInfo();
    alert("Application réinitialisée.");
  }

  function init(){
    loadConfig();
    loadSession();
    decodeConfigFromQuery();
    ensureFieldCodes();
    renderFields();
    renderParticipants();
    renderTeams();
    renderModeButtons();
    updateSessionInfo();

    elements.btnGoEntry.onclick = ()=>setPage("entry");
    elements.btnGoConfig.onclick = ()=>{
      if(importedFromQuery){
        alert("Section réservée à l’enseignant.");
        return;
      }
      const code = prompt("Code enseignant ?");
      if(code === "57"){
        setPage("config");
      }else if(code !== null){
        alert("Code incorrect.");
      }
    };
    elements.btnBackCover1.onclick = ()=>setPage("cover");
    elements.btnBackCover2.onclick = ()=>setPage("cover");
    elements.btnGoSummary.onclick = ()=>{
      renderSummary();
      setPage("summary");
    };
    elements.btnBackEntry.onclick = ()=>setPage("entry");
    elements.btnAddField.onclick = addField;
    elements.btnAddParticipant.onclick = addParticipant;
    elements.btnAddTeam.onclick = addTeam;
    if(elements.btnResetApp){
      elements.btnResetApp.onclick = resetApplication;
    }
    elements.btnShareConfig.onclick = openConfigQr;
    elements.btnConfigQrClose.onclick = closeConfigQr;
    elements.btnEntryQrClose.onclick = closeEntryQrModal;
    if(elements.btnEntryQrFullscreen){
      elements.btnEntryQrFullscreen.onclick = ()=>window.open("scanprof-qr.html","_blank");
    }
    elements.btnOpenPrint.onclick = openPrint;
    if(elements.cfgChrono){
      elements.cfgChrono.checked = Boolean(state.config.chrono);
      elements.cfgChrono.addEventListener("change", ()=>{
        state.config.chrono = elements.cfgChrono.checked;
        saveConfig();
        renderModeButtons();
        renderParticipantForm();
        renderTeamForm();
        updateSessionInfo();
      });
    }

    elements.modeButtons.forEach(btn=>{
      btn.addEventListener("click", ()=>{
        state.mode = btn.dataset.mode;
        renderModeButtons();
        saveSession();
      });
    });

    if(importedFromQuery){
      if(elements.btnGoConfig) elements.btnGoConfig.style.display = "none";
      if(elements.btnBackCover1) elements.btnBackCover1.style.display = "none";
      if(elements.btnBackCover2) elements.btnBackCover2.style.display = "none";
      setPage("entry");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
