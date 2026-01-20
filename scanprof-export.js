"use strict";

(function(global){
  const MAX_QR_BYTES = 2800;

  function sanitizeValue(val){
    if(val == null) return "";
    return String(val).trim();
  }

  function wrapPayload(entry){
    if(!entry) return [];
    const cleaned = {};
    Object.keys(entry).forEach(key=>{
      const value = sanitizeValue(entry[key]);
      if(value) cleaned[key] = value;
    });
    if(!cleaned.prenom) cleaned.prenom = "Inconnu";
    const payload = [cleaned];
    const json = JSON.stringify(payload);
    let byteLength = json.length;
    if(typeof TextEncoder !== "undefined"){
      byteLength = new TextEncoder().encode(json).length;
    }
    if(byteLength > MAX_QR_BYTES){
      console.warn("Payload QR trop volumineux", byteLength);
    }
    return payload;
  }

  global.ScanProfExport = {
    wrapPayload,
    MAX_QR_BYTES
  };
})(window);
