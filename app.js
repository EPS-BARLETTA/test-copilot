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
      fields: []
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
    configQrBox: document.getElementById("configQrBox"),
    btnConfigQrClose: document.getElementById("btnConfigQrClose"),
    entryQrBox: document.getElementById("entryQrBox"),
    entryQrTitle: document.getElementById("entryQrTitle"),
    entryQrStatus: document.getElementById("entryQrStatus"),
    btnEntryQrClose: document.getElementById("btnEntryQrClose"),
    btnLoadConfig: document.getElementById("btnLoadConfig"),
    btnOpenPrint: document.getElementById("btnOpenPrint")
  };

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
      const json = decodeURIComponent(atob(token));
      const data = JSON.parse(json);
      if(data && Array.isArray(data.fields)){
        state.config = data;
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
    elements.modeHint.textContent = state.mode === "indiv"
      ? "Ajoutez vos élèves puis saisissez les champs paramétrés."
      : "Chaque équipe peut contenir plusieurs membres. Les champs sont communs à la cordée / équipe.";
  }

  function addParticipant(){
    const entry = {
      id: uid(),
      prenom: "",
      classe: "",
      note: "",
      fields: {}
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
      fields: {}
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
    state.participants.forEach(p=>{
      const tab = document.createElement("div");
      tab.className = "tab" + (state.currentParticipant===p.id ? " active" : "");
      tab.textContent = p.prenom || "Élève";
      tab.onclick = ()=>{
        state.currentParticipant = p.id;
        renderParticipants();
        saveSession();
      };
      tabs.appendChild(tab);
    });
    renderParticipantForm();
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
      renderParticipants();
      saveSession();
    };
    document.getElementById("participantClass").oninput = (e)=>{
      target.classe = e.target.value;
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
      state.participants = state.participants.filter(p=>p.id!==target.id);
      state.currentParticipant = state.participants[0]?.id || null;
      saveSession();
      renderParticipants();
    };
  }

  function renderTeams(){
    const tabs = elements.teamTabs;
    tabs.innerHTML = "";
    if(!state.teams.length){
      tabs.innerHTML = `<p class="muted small">Ajoutez vos premières équipes.</p>`;
      elements.teamForm.innerHTML = "";
      return;
    }
    state.teams.forEach(team=>{
      const tab = document.createElement("div");
      tab.className = "tab" + (state.currentTeam===team.id ? " active" : "");
      tab.textContent = team.name || "Équipe";
      tab.onclick = ()=>{
        state.currentTeam = team.id;
        renderTeams();
        saveSession();
      };
      tabs.appendChild(tab);
    });
    renderTeamForm();
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
      renderTeams();
      saveSession();
    };
    document.getElementById("teamMembers").oninput = (e)=>{
      team.members = e.target.value;
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
      state.teams = state.teams.filter(t=>t.id!==team.id);
      state.currentTeam = state.teams[0]?.id || null;
      saveSession();
      renderTeams();
    };
  }

  function updateSessionInfo(){
    if(state.config.fields.length){
      elements.sessionInfo.textContent = `${state.config.fields.length} champ(s) actifs.`;
    }else{
      elements.sessionInfo.textContent = "Aucun champ paramétré. Configurez-les ou importez une configuration.";
    }
  }

  function openConfigQr(){
    if(!state.config.fields.length){
      alert("Ajoutez au moins un champ pour générer un QR.");
      return;
    }
    const payload = JSON.stringify(state.config);
    const encoded = btoa(encodeURIComponent(payload));
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
    elements.entryQrTitle.textContent = type === "team"
      ? `QR équipe — ${entry.name || "Equipe"}`
      : `QR élève — ${entry.prenom || "Élève"}`;
    elements.entryQrStatus.textContent = `Champs exportés : ${Object.keys(payload[0] || {}).length - 1}`;

    const json = JSON.stringify(payload);
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

  // Import manual config
  function promptConfigImport(){
    const value = prompt("Collez ici le JSON de configuration ou laissez vide.");
    if(!value) return;
    try{
      const data = JSON.parse(value);
      if(Array.isArray(data.fields)){
        state.config = data;
        saveConfig();
        renderFields();
        updateSessionInfo();
        alert("Configuration importée.");
      }else{
        alert("Format inattendu.");
      }
    }catch(e){
      alert("Impossible de lire cette configuration.");
    }
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

    elements.btnGoConfig.onclick = ()=>setPage("config");
    elements.btnGoEntry.onclick = ()=>setPage("entry");
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
    elements.btnShareConfig.onclick = openConfigQr;
    elements.btnConfigQrClose.onclick = closeConfigQr;
    elements.btnEntryQrClose.onclick = closeEntryQrModal;
    elements.btnLoadConfig.onclick = promptConfigImport;
    elements.btnOpenPrint.onclick = openPrint;

    elements.modeButtons.forEach(btn=>{
      btn.addEventListener("click", ()=>{
        state.mode = btn.dataset.mode;
        renderModeButtons();
        saveSession();
      });
    });

    if(importedFromQuery){
      setPage("entry");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
