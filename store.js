/* ============================================================
   跑道笔记 · 本地数据模块（store.js）
   纯本地 localStorage，不联网、不注册、不依赖任何服务器。
   负责：本机收藏的训练计划、以及“一键备份 / 换机恢复”。
   打卡记录由 checkin.html 维护（键 track_notes_checkins_v1），
   这里只做读取与备份合并，保证各页面键名一致。
   ============================================================ */
(function(){
  "use strict";

  var CHECKIN_KEY = "track_notes_checkins_v1";   // 打卡记录（与 checkin.html 一致）
  var PLAN_KEY    = "track_notes_plans_v1";      // 收藏的训练计划
  var BACKUP_TAG  = "PD1:";                      // 备份码前缀，便于识别

  /* 通用：读取数组 / 写入数组 */
  function readArray(key){
    try{
      var v = JSON.parse(localStorage.getItem(key));
      return Array.isArray(v) ? v : [];
    }catch(e){ return []; }
  }
  function writeArray(key, arr){
    localStorage.setItem(key, JSON.stringify(arr));
  }

  /* ---------------- 收藏计划（本机） ---------------- */
  function listPlans(){
    var list = readArray(PLAN_KEY);
    // 最新收藏在前
    list.sort(function(a,b){ return (b.created_at||"") < (a.created_at||"") ? -1 : 1; });
    return list;
  }
  function hasPlan(hash){
    return readArray(PLAN_KEY).some(function(p){ return p.hash === hash; });
  }
  function addPlan(plan){
    var list = readArray(PLAN_KEY);
    if(hasPlan(plan.hash)) return false;          // 同一计划不重复收藏
    list.push({
      id: Date.now() + "" + Math.floor(Math.random()*1000),
      title: plan.title,
      hash: plan.hash,
      created_at: plan.created_at
    });
    writeArray(PLAN_KEY, list);
    return true;
  }
  function removePlan(id){
    writeArray(PLAN_KEY, readArray(PLAN_KEY).filter(function(p){ return p.id !== id; }));
  }
  function removePlanByHash(hash){
    writeArray(PLAN_KEY, readArray(PLAN_KEY).filter(function(p){ return p.hash !== hash; }));
  }

  /* ---------------- 备份 / 恢复 ---------------- */
  function getCheckins(){ return readArray(CHECKIN_KEY); }
  function setCheckins(arr){ writeArray(CHECKIN_KEY, arr); }

  /* 组装备份对象 */
  function buildBackup(){
    return {
      app: "track-notes",
      version: 1,
      exported_at: new Date().toISOString(),
      checkins: getCheckins(),
      plans: readArray(PLAN_KEY)
    };
  }

  /* 对象 -> 备份码（Base64，兼容中文） */
  function encodeBackup(obj){
    var json = JSON.stringify(obj);
    return BACKUP_TAG + btoa(unescape(encodeURIComponent(json)));
  }
  /* 备份码 / JSON 文本 -> 对象，失败抛错 */
  function decodeBackup(text){
    var t = String(text == null ? "" : text).trim();
    if(!t) throw new Error("备份内容是空的");
    var json;
    try{
      if(t.indexOf(BACKUP_TAG) === 0){
        json = decodeURIComponent(escape(atob(t.slice(BACKUP_TAG.length))));
      }else{
        json = t;   // 兼容直接粘贴的 .json 文本
      }
      var obj = JSON.parse(json);
      if(!obj || obj.app !== "track-notes" || !Array.isArray(obj.checkins)){
        throw new Error("not a track-notes backup");
      }
      return obj;
    }catch(e){
      throw new Error("备份码无效或已损坏，请确认完整复制");
    }
  }

  /* 合并导入（打卡按 日期+距离+用时 去重，计划按 hash 去重），返回新增条数 */
  function mergeImport(obj){
    var oldCheckins = getCheckins();
    var cSeen = {};
    oldCheckins.forEach(function(c){
      cSeen[c.run_date + "|" + c.distance_km + "|" + c.duration_seconds] = true;
    });
    var cAdded = 0;
    (obj.checkins || []).forEach(function(c){
      if(c && c.run_date && c.distance_km != null && c.duration_seconds != null){
        var fp = c.run_date + "|" + c.distance_km + "|" + c.duration_seconds;
        if(!cSeen[fp]){ oldCheckins.push(c); cSeen[fp] = true; cAdded++; }
      }
    });
    // 打卡按日期、id 排序，与 checkin.html 展示顺序保持一致
    oldCheckins.sort(function(a,b){
      if(a.run_date === b.run_date) return (b.id || 0) - (a.id || 0);
      return a.run_date < b.run_date ? 1 : -1;
    });
    setCheckins(oldCheckins);

    var oldPlans = readArray(PLAN_KEY);
    var pSeen = {};
    oldPlans.forEach(function(p){ pSeen[p.hash] = true; });
    var pAdded = 0;
    (obj.plans || []).forEach(function(p){
      if(p && p.hash && !pSeen[p.hash]){
        if(!p.id) p.id = Date.now() + "" + Math.floor(Math.random()*1000);
        oldPlans.push(p); pSeen[p.hash] = true; pAdded++;
      }
    });
    writeArray(PLAN_KEY, oldPlans);

    return { checkinsAdded: cAdded, plansAdded: pAdded };
  }

  /* 触发浏览器下载 .json 备份文件 */
  function downloadBackup(){
    var obj = buildBackup();
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date(), p = function(n){ return String(n).padStart(2,"0"); };
    var name = "paodao-backup-" + d.getFullYear() + p(d.getMonth()+1) + p(d.getDate())
      + "-" + p(d.getHours()) + p(d.getMinutes()) + ".json";
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  window.PDStore = {
    CHECKIN_KEY: CHECKIN_KEY,
    PLAN_KEY: PLAN_KEY,
    listPlans: listPlans,
    hasPlan: hasPlan,
    addPlan: addPlan,
    removePlan: removePlan,
    removePlanByHash: removePlanByHash,
    getCheckins: getCheckins,
    buildBackup: buildBackup,
    encodeBackup: encodeBackup,
    decodeBackup: decodeBackup,
    mergeImport: mergeImport,
    downloadBackup: downloadBackup
  };
})();
