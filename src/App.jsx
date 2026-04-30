import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from "recharts";

// ─────────────────────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://zkvqobiiagibqamovijm.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprdnFvYmlpYWdpYnFhbW92aWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzU4OTMsImV4cCI6MjA5Mjk1MTg5M30.Wh_jmtCZFNV-dUjbfwd-c-ByLluBMSqvfUVVtjycIHA";

// Lightweight Supabase REST helper (no SDK needed in single-file artifact)
const sb = {
  _headers: {
    "apikey":        SUPABASE_ANON,
    "Authorization": `Bearer ${SUPABASE_ANON}`,
    "Content-Type":  "application/json",
  },

  // Auth: sign in
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { ...this._headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  // Auth: sign out
  async signOut(accessToken) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { ...this._headers, Authorization: `Bearer ${accessToken}` },
    });
  },

  // Auth: get user from stored token
  async getUser(accessToken) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { ...this._headers, Authorization: `Bearer ${accessToken}` },
    });
    return r.json();
  },

  // DB: get perfil for a user_id
  async getPerfil(userId, accessToken) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/perfiles?user_id=eq.${userId}&select=*`,
      { headers: { ...this._headers, Authorization: `Bearer ${accessToken}` } }
    );
    const data = await r.json();
    return Array.isArray(data) ? data[0] : null;
  },

  // DB: get all atletas (coach only)
  async getAtletas(accessToken) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/perfiles?rol=eq.atleta&select=*`,
      { headers: { ...this._headers, Authorization: `Bearer ${accessToken}` } }
    );
    return r.json();
  },

  // DB: upsert perfil
  async upsertPerfil(data, accessToken) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/perfiles`, {
      method: "POST",
      headers: {
        ...this._headers,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(data),
    });
    return r.json();
  },

  // DB: generic select with filters
  async select(table, filters = {}, accessToken) {
    const params = Object.entries(filters).map(([k,v])=>`${k}=eq.${v}`).join("&");
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${params}&select=*&order=created_at.desc`,
      { headers: { ...this._headers, Authorization: `Bearer ${accessToken}` } }
    );
    return r.json();
  },

  // DB: insert row
  async insert(table, row, accessToken) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...this._headers,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });
    return r.json();
  },

  // Storage session in localStorage
  saveSession(session) {
    try { localStorage.setItem("jp_session", JSON.stringify(session)); } catch(_){}
  },
  loadSession() {
    try { return JSON.parse(localStorage.getItem("jp_session")); } catch(_){ return null; }
  },
  clearSession() {
    try { localStorage.removeItem("jp_session"); } catch(_){}
  },
};

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  bg:       "#080810",
  surface:  "#0e0e1a",
  card:     "#13131f",
  cardHov:  "#17172a",
  border:   "#1f1f35",
  accent:   "#ff4d1c",
  accentLo: "#ff4d1c18",
  accentMd: "#ff4d1c44",
  green:    "#00e5a0",
  greenLo:  "#00e5a018",
  gold:     "#ffd166",
  goldLo:   "#ffd16618",
  warn:     "#ff6b6b",
  warnLo:   "#ff6b6b18",
  text:     "#eeeef5",
  muted:    "#5a5a7a",
  font:     "'Barlow Condensed', sans-serif",
  body:     "'DM Sans', sans-serif",
  mono:     "'JetBrains Mono', monospace",
};

// ─────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;0,900;1,800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-text-size-adjust:100%;}
body{background:${T.bg};color:${T.text};font-family:${T.body};overflow-x:hidden;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:${T.surface};}
::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px;}

/* ── NAV desktop ── */
.nav{display:flex;align-items:center;gap:10px;padding:0 20px;height:58px;
  border-bottom:1px solid ${T.border};background:${T.surface};
  position:sticky;top:0;z-index:100;}
.nav-beast{font-family:${T.font};font-size:20px;font-weight:900;
  font-style:italic;color:${T.accent};line-height:1;}
.nav-sub{font-family:${T.font};font-size:11px;font-weight:600;
  letter-spacing:3px;color:${T.muted};text-transform:uppercase;}
.nav-client{padding:4px 12px;border-radius:20px;background:${T.accentLo};
  border:1px solid ${T.accentMd};font-size:12px;font-weight:600;
  color:${T.accent};cursor:pointer;white-space:nowrap;}
.nav-tabs{display:flex;gap:3px;margin-left:auto;}
.nav-tab{padding:7px 13px;border-radius:8px;font-size:12px;font-weight:600;
  font-family:${T.body};cursor:pointer;border:none;transition:all .2s;
  background:transparent;color:${T.muted};}
.nav-tab:hover{color:${T.text};background:${T.border};}
.nav-tab.active{background:${T.accentLo};color:${T.accent};border:1px solid ${T.accentMd};}
.nav-mode{padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;
  cursor:pointer;border:1px solid ${T.border};background:transparent;
  color:${T.muted};transition:all .2s;font-family:${T.body};white-space:nowrap;}
.nav-mode.coach-on{background:${T.accentLo};color:${T.accent};border-color:${T.accentMd};}

/* ── BOTTOM NAV mobile ── */
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:100;
  background:${T.surface};border-top:1px solid ${T.border};padding:8px 4px 12px;}
.bottom-nav-inner{display:flex;justify-content:space-around;align-items:center;}
.bnav-btn{display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:6px 10px;border-radius:10px;border:none;background:transparent;
  color:${T.muted};cursor:pointer;transition:all .2s;font-family:${T.body};min-width:52px;}
.bnav-btn.active{color:${T.accent};}
.bnav-icon{font-size:20px;line-height:1;}
.bnav-label{font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;font-family:${T.font};}

/* ── LAYOUT ── */
.page{padding:20px;max-width:1360px;margin:0 auto;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}

/* ── CARD ── */
.card{background:${T.card};border:1px solid ${T.border};border-radius:16px;padding:20px;}
.ctitle{font-size:10px;font-weight:700;letter-spacing:2.5px;color:${T.muted};
  text-transform:uppercase;margin-bottom:14px;font-family:${T.font};}
.stitle{font-family:${T.font};font-size:26px;font-weight:900;font-style:italic;
  margin-bottom:18px;color:${T.text};}
.stitle span{color:${T.accent};}

/* ── COACH NOTES ── */
.cnote{border-radius:12px;padding:14px 18px;margin-top:14px;}
.cnote-default{background:${T.greenLo};border:1px solid ${T.green}33;}
.cnote-warn{background:${T.warnLo};border:1px solid ${T.warn}44;}
.cnote-gold{background:${T.goldLo};border:1px solid ${T.gold}44;}
.cnote-accent{background:${T.accentLo};border:1px solid ${T.accentMd};}
.cnote-label{font-size:9px;font-weight:800;letter-spacing:2.5px;
  text-transform:uppercase;margin-bottom:5px;font-family:${T.font};}
.cnote-default .cnote-label{color:${T.green};}
.cnote-warn .cnote-label{color:${T.warn};}
.cnote-gold .cnote-label{color:${T.gold};}
.cnote-accent .cnote-label{color:${T.accent};}
.cnote-text{font-size:13px;line-height:1.65;color:${T.text};}

/* ── INPUTS ── */
input[type=range]{width:100%;-webkit-appearance:none;height:6px;
  border-radius:3px;background:${T.border};outline:none;cursor:pointer;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;
  border-radius:50%;background:${T.accent};cursor:pointer;box-shadow:0 0 10px ${T.accentMd};}
input[type=number],input[type=text],textarea{background:${T.surface};
  border:1px solid ${T.border};border-radius:10px;color:${T.text};
  font-family:${T.body};font-size:14px;padding:11px 14px;width:100%;
  outline:none;transition:border .2s;-webkit-appearance:none;}
input[type=number]:focus,input[type=text]:focus,textarea:focus{border-color:${T.accent};}
textarea{resize:vertical;min-height:80px;line-height:1.5;}
select{background:${T.surface};border:1px solid ${T.border};border-radius:10px;
  color:${T.text};font-family:${T.body};font-size:14px;padding:11px 14px;
  outline:none;cursor:pointer;width:100%;}
select:focus{border-color:${T.accent};}

/* ── BUTTONS ── */
.btn{padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;
  font-family:${T.body};cursor:pointer;border:none;transition:all .2s;
  -webkit-tap-highlight-color:transparent;}
.btn-accent{background:${T.accent};color:#fff;}
.btn-accent:hover{filter:brightness(1.15);box-shadow:0 0 20px ${T.accentMd};}
.btn-outline{background:transparent;border:1px solid ${T.border};color:${T.muted};}
.btn-outline:hover{border-color:${T.accent};color:${T.accent};}
.btn-ghost{background:transparent;border:none;color:${T.muted};font-size:13px;
  cursor:pointer;padding:6px 10px;border-radius:8px;-webkit-tap-highlight-color:transparent;}
.btn-ghost:hover{color:${T.warn};}
.btn-green{background:${T.green};color:#080810;}
.btn-sm{padding:8px 16px;font-size:13px;}
.btn-xs{padding:5px 12px;font-size:12px;}
.btn-full{width:100%;}

/* ── TABLE ── */
table{width:100%;border-collapse:collapse;font-size:13px;}
th{text-align:left;padding:9px 12px;font-size:9px;letter-spacing:2px;
  color:${T.muted};font-weight:800;text-transform:uppercase;
  border-bottom:1px solid ${T.border};font-family:${T.font};}
td{padding:9px 12px;border-bottom:1px solid ${T.border}33;vertical-align:middle;}
tr:last-child td{border-bottom:none;}

/* ── BADGE ── */
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
  border-radius:20px;font-size:10px;font-weight:800;font-family:${T.font};}
.badge-green{background:${T.greenLo};color:${T.green};border:1px solid ${T.green}33;}
.badge-red{background:${T.warnLo};color:${T.warn};border:1px solid ${T.warn}44;}
.badge-gold{background:${T.goldLo};color:${T.gold};border:1px solid ${T.gold}44;}
.badge-accent{background:${T.accentLo};color:${T.accent};border:1px solid ${T.accentMd};}
.badge-muted{background:${T.border};color:${T.muted};}

/* ── MACRO PILLS ── */
.mpill{font-size:11px;font-weight:600;padding:3px 9px;border-radius:16px;}
.mpill-c{color:#4fc3f7;background:#4fc3f718;}
.mpill-p{color:#f48fb1;background:#f48fb118;}
.mpill-f{color:${T.gold};background:${T.goldLo};}
.mpill-k{color:${T.muted};background:${T.border};}

/* ── CALENDAR ── */
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.cal-day{aspect-ratio:1;border-radius:7px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;font-size:11px;font-weight:600;
  cursor:pointer;transition:all .15s;border:1px solid transparent;
  -webkit-tap-highlight-color:transparent;}
.cal-day:hover{background:${T.accentLo};border-color:${T.accentMd};}
.cal-day.has-data{background:${T.greenLo};border-color:${T.green}33;}
.cal-day.has-journal{background:${T.goldLo};border-color:${T.gold}33;}
.cal-day.has-train{background:#4fc3f718;border-color:#4fc3f744;}
.cal-day.selected{background:${T.accentLo};border-color:${T.accent};color:${T.accent};}
.cal-day.today{border-color:${T.gold};color:${T.gold};}
.cal-day.rest-day{background:${T.border}44;}
.cal-hdr{font-size:9px;font-weight:800;letter-spacing:2px;color:${T.muted};
  text-align:center;padding-bottom:6px;font-family:${T.font};}

/* ── EXERCISE ── */
.ex-block{background:${T.surface};border:1px solid ${T.border};
  border-radius:12px;padding:14px;margin-bottom:10px;}
.ex-name{font-family:${T.font};font-size:17px;font-weight:800;}
.set-row{display:grid;grid-template-columns:28px 1fr 1fr 1fr 90px auto;
  gap:6px;align-items:center;margin-bottom:5px;}
.set-num{font-size:10px;color:${T.muted};font-weight:700;text-align:center;
  font-family:${T.mono};}

/* ── MEAL ── */
.meal-opt{border:1px solid ${T.border};border-radius:12px;padding:14px;
  cursor:pointer;transition:all .2s;-webkit-tap-highlight-color:transparent;}
.meal-opt:hover{background:${T.cardHov};}
.meal-opt.sel{border-color:${T.accent};background:${T.accentLo};}
.meal-name{font-family:${T.font};font-size:16px;font-weight:800;margin-bottom:3px;}
.meal-desc{font-size:11px;color:${T.muted};line-height:1.4;margin-bottom:9px;}

/* ── DAY PILLS ── */
.day-pill{padding:8px 14px;border-radius:10px;font-size:12px;font-weight:700;
  font-family:${T.font};cursor:pointer;border:1px solid ${T.border};
  background:transparent;color:${T.muted};transition:all .15s;
  -webkit-tap-highlight-color:transparent;text-align:center;}
.day-pill:hover{border-color:${T.accent};color:${T.accent};}
.day-pill.train{background:${T.accentLo};color:${T.accent};border-color:${T.accentMd};}
.day-pill.rest{background:${T.border};color:${T.muted};}
.day-pill.sel{border-color:${T.accent};color:${T.accent};}

/* ── INNER TABS ── */
.tab-inner{display:flex;gap:6px;margin-bottom:20px;border-bottom:1px solid ${T.border};padding-bottom:12px;overflow-x:auto;}
.tab-inner-btn{padding:7px 16px;border-radius:8px;font-size:12px;font-weight:700;
  font-family:${T.body};cursor:pointer;border:none;background:transparent;
  color:${T.muted};transition:all .2s;white-space:nowrap;}
.tab-inner-btn.active{background:${T.accentLo};color:${T.accent};}

/* ── JOURNAL DIARY ── */
.score-ring{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 12px;
  border-radius:14px;border:1px solid ${T.border};background:${T.surface};cursor:pointer;
  transition:all .2s;-webkit-tap-highlight-color:transparent;}
.score-ring:hover{border-color:${T.accent};}
.score-ring.selected{border-color:${T.accent};background:${T.accentLo};}
.score-num{font-family:${T.mono};font-size:22px;font-weight:700;}
.score-label{font-size:10px;font-weight:700;letter-spacing:1px;color:${T.muted};
  text-transform:uppercase;font-family:${T.font};}
.journal-card{border-radius:14px;padding:16px;border:1px solid ${T.border};
  background:${T.surface};margin-bottom:10px;}
.journal-score-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;
  border-radius:20px;font-size:11px;font-weight:800;font-family:${T.font};}

/* ── MODAL ── */
.modal-bg{position:fixed;inset:0;background:#00000090;z-index:200;
  display:flex;align-items:center;justify-content:center;padding:16px;}
.modal{background:${T.card};border:1px solid ${T.border};
  border-radius:20px;padding:28px;width:500px;max-width:100%;
  max-height:90vh;overflow-y:auto;}
.modal-title{font-family:${T.font};font-size:24px;font-weight:900;
  font-style:italic;margin-bottom:20px;color:${T.text};}
.flabel{font-size:10px;color:${T.muted};margin-bottom:5px;font-weight:700;letter-spacing:1px;}

/* ── CELEBRATE ── */
@keyframes beastPulse{0%,100%{box-shadow:0 0 0 0 #ff4d1c33}50%{box-shadow:0 0 30px 6px #ff4d1c33}}
.celebrate{background:linear-gradient(135deg,#ff4d1c18,#ffd16618);
  border:1px solid ${T.gold}55;border-radius:12px;padding:16px 20px;
  animation:beastPulse 2s ease-in-out infinite;margin-bottom:16px;}

/* ── STAT ROW ── */
.stat-row{display:flex;justify-content:space-between;align-items:center;
  padding:11px 0;border-bottom:1px solid ${T.border}44;}
.stat-row:last-child{border-bottom:none;}

/* ── PLAN EDITOR ── */
.plan-day-row{display:flex;align-items:center;gap:10px;padding:12px 0;
  border-bottom:1px solid ${T.border}44;}
.plan-day-row:last-child{border-bottom:none;}
.plan-day-label{font-family:${T.font};font-size:15px;font-weight:800;
  width:90px;flex-shrink:0;}
.drag-handle{cursor:grab;color:${T.muted};font-size:16px;padding:2px 4px;}
.ex-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;
  border-radius:20px;background:${T.surface};border:1px solid ${T.border};
  font-size:12px;font-weight:600;margin:2px;}
.ex-pill-remove{background:transparent;border:none;color:${T.muted};
  cursor:pointer;font-size:13px;padding:0 2px;line-height:1;}
.ex-pill-remove:hover{color:${T.warn};}

/* ── LOGIN ── */
.login-screen{position:fixed;inset:0;background:${T.bg};z-index:400;
  display:flex;align-items:center;justify-content:center;padding:20px;
  animation:fadeIn .4s ease;}
.login-box{background:${T.card};border:1px solid ${T.border};border-radius:24px;
  padding:40px 32px;width:100%;max-width:440px;text-align:center;}
.login-role-btn{flex:1;padding:20px 10px;border-radius:14px;border:2px solid ${T.border};
  background:transparent;color:${T.text};cursor:pointer;transition:all .2s;
  font-family:${T.body};-webkit-tap-highlight-color:transparent;}
.login-role-btn:hover{border-color:${T.accent};background:${T.accentLo};}
.login-role-btn.selected{border-color:${T.accent};background:${T.accentLo};}
.login-error{background:${T.warnLo};border:1px solid ${T.warn}44;border-radius:10px;
  padding:10px 14px;font-size:13px;color:${T.warn};margin-bottom:12px;text-align:left;}

/* ── STATS EVOLUTION ── */
.stats-ex-btn{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;
  font-family:${T.body};cursor:pointer;border:1px solid ${T.border};
  background:transparent;color:${T.muted};transition:all .2s;white-space:nowrap;flex-shrink:0;}
.stats-ex-btn.active{background:${T.accentLo};color:${T.accent};border-color:${T.accentMd};}
.pr-card{background:${T.surface};border:1px solid ${T.border};border-radius:12px;
  padding:16px;text-align:center;}
.pr-val{font-family:${T.mono};font-size:24px;font-weight:700;color:${T.accent};}
.pr-label{font-size:10px;font-weight:700;letter-spacing:2px;color:${T.muted};
  text-transform:uppercase;font-family:${T.font};margin-top:4px;}

/* ── REPORT ── */
.report-header{background:linear-gradient(135deg,#ff4d1c22,#ffd16610);
  border:1px solid ${T.accentMd};border-radius:16px;padding:24px;margin-bottom:20px;}
.report-kpi{background:${T.surface};border:1px solid ${T.border};border-radius:12px;
  padding:16px;text-align:center;}
.report-kpi-val{font-family:${T.mono};font-size:28px;font-weight:700;}
.report-kpi-label{font-size:10px;font-weight:700;letter-spacing:2px;
  color:${T.muted};text-transform:uppercase;margin-top:4px;font-family:${T.font};}
.report-kpi-sub{font-size:11px;color:${T.muted};margin-top:3px;}
.report-section{margin-bottom:24px;}
.report-section-title{font-family:${T.font};font-size:18px;font-weight:800;
  font-style:italic;color:${T.accent};margin-bottom:12px;
  padding-bottom:6px;border-bottom:1px solid ${T.accentMd};}
.report-row{display:flex;justify-content:space-between;align-items:center;
  padding:9px 0;border-bottom:1px solid ${T.border}33;font-size:13px;}
.report-row:last-child{border-bottom:none;}
.report-week-btn{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;
  font-family:${T.body};cursor:pointer;border:1px solid ${T.border};
  background:transparent;color:${T.muted};transition:all .2s;}
.report-week-btn.active{background:${T.accentLo};color:${T.accent};border-color:${T.accentMd};}
.score-ring{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-family:${T.mono};font-size:18px;font-weight:800;
  border:3px solid;}

/* ── PRINT / PDF ── */
@media print{
  .nav,.bottom-nav,.no-print{display:none!important;}
  body{background:#fff!important;color:#000!important;}
  .card,.report-header,.report-kpi{background:#f8f8f8!important;border-color:#ddd!important;}
  .report-kpi-val,.report-section-title{color:#ff4d1c!important;}
  .stitle span{color:#ff4d1c!important;}
}

/* ── ONBOARDING ── */
@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.onboarding{position:fixed;inset:0;background:${T.bg};z-index:300;
  display:flex;align-items:center;justify-content:center;padding:20px;
  animation:fadeIn .4s ease;}
.onboarding-box{background:${T.card};border:1px solid ${T.border};border-radius:24px;
  padding:36px 32px;width:100%;max-width:480px;text-align:center;}

/* ════════════════════════════════════
   RESPONSIVE — MOBILE (≤768px)
   ════════════════════════════════════ */
@media(max-width:768px){
  .nav-tabs{display:none;}
  .nav-mode{display:none;}
  .nav-sub{display:none;}
  .bottom-nav{display:block;}
  .page{padding:16px 14px 90px;}
  .g2,.g3,.g4{grid-template-columns:1fr;}
  .btn{padding:14px 22px;font-size:15px;}
  .btn-sm{padding:10px 18px;font-size:14px;}
  .btn-xs{padding:7px 14px;font-size:13px;}
  .meal-grid-inner{grid-template-columns:1fr !important;}
  .set-row{grid-template-columns:24px 1fr 1fr 1fr 70px auto;gap:4px;}
  .card{padding:16px;}
  .stitle{font-size:22px;margin-bottom:14px;}
  .day-pills-wrap{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;}
  .day-pill{flex-shrink:0;font-size:11px;padding:7px 12px;}
  .modal-bg{align-items:flex-end;padding:0;}
  .modal{border-radius:20px 20px 0 0;padding:20px 16px;width:100%;max-width:100%;}
  .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  table{min-width:480px;}
  .onboarding-box{padding:28px 20px;}
}`;

// ─────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────
const DAY_LABELS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

const INIT_WEEK_PLAN = {
  0: { label:"Domingo",    type:"rest",  muscle:"Descanso", exercises:[] },
  1: { label:"Lunes",     type:"train", muscle:"Espalda + Tríceps", exercises:["Dominadas","Remo con Barra","Jalón al Pecho","Press Cerrado","Extensiones Tríceps"] },
  2: { label:"Martes",    type:"train", muscle:"Bíceps + Hombro + Pecho", exercises:["Press Banca","Aperturas","Press Militar","Elevaciones Laterales","Curl con Barra"] },
  3: { label:"Miércoles", type:"train", muscle:"Pierna — Cuádriceps", exercises:["Sentadilla","Prensa 45°","Extensión Cuádriceps","Zancadas","Sentadilla Búlgara"] },
  4: { label:"Jueves",    type:"rest",  muscle:"Descanso", exercises:[] },
  5: { label:"Viernes",   type:"train", muscle:"Torso Completo", exercises:["Press Banca Inclinado","Remo con Mancuerna","Press Militar","Remo en Polea","Fondos"] },
  6: { label:"Sábado",    type:"train", muscle:"Femoral + Glúteo", exercises:["Peso Muerto Rumano","Curl Femoral","Hip Thrust","Sentadilla Sumo","Abducción Cadera"] },
};

const EXERCISE_DB_INIT = [
  "Sentadilla","Press Banca","Peso Muerto","Dominadas","Remo con Barra",
  "Press Militar","Jalón al Pecho","Hip Thrust","Curl con Barra","Extensiones Tríceps",
  "Prensa 45°","Peso Muerto Rumano","Curl Femoral","Zancadas","Press Cerrado",
  "Elevaciones Laterales","Remo con Mancuerna","Fondos","Sentadilla Búlgara",
  "Press Banca Inclinado","Abducción Cadera","Curl Martillo","Sentadilla Sumo",
  "Extensión Cuádriceps","Aperturas","Face Pull","Remo en Polea",
];

const INIT_MEALS = [
  { id:1, name:"Desayuno", time:"08:00", options:[
    { name:"Avena + Huevos + Fruta", kcal:520, cho:72, pro:32, fat:10, items:"80g avena, 3 huevos, 1 plátano" },
    { name:"Tostadas + Pavo + Aguacate", kcal:510, cho:68, pro:34, fat:12, items:"3 tostadas, 100g pavo, ½ aguacate" },
    { name:"Bowl de Yogur + Granola", kcal:530, cho:75, pro:28, fat:11, items:"250g yogur griego, 50g granola, frutos rojos" },
  ], selected:null },
  { id:2, name:"Almuerzo", time:"13:30", options:[
    { name:"Arroz + Pollo + Verduras", kcal:680, cho:95, pro:48, fat:10, items:"150g arroz, 200g pollo, brócoli" },
    { name:"Pasta + Salmón + Espinacas", kcal:690, cho:90, pro:44, fat:14, items:"150g pasta, 180g salmón, espinacas" },
    { name:"Patata + Ternera + Pimiento", kcal:675, cho:92, pro:46, fat:11, items:"200g patata, 180g ternera, pimientos" },
  ], selected:null },
  { id:3, name:"Merienda", time:"17:00", options:[
    { name:"Batido Proteico + Plátano", kcal:340, cho:48, pro:28, fat:4, items:"30g whey, 1 plátano, 250ml leche" },
    { name:"Pan + Mantequilla Cacahuete", kcal:360, cho:44, pro:14, fat:14, items:"2 tostadas, 30g mantequilla cacahuete" },
    { name:"Fruta + Queso Fresco", kcal:320, cho:42, pro:20, fat:6, items:"200g fruta, 150g queso fresco" },
  ], selected:null },
  { id:4, name:"Cena", time:"20:30", options:[
    { name:"Merluza + Quinoa + Espárragos", kcal:510, cho:62, pro:40, fat:9, items:"200g merluza, 100g quinoa, espárragos" },
    { name:"Tortilla + Batata + Ensalada", kcal:520, cho:65, pro:36, fat:12, items:"4 huevos, 150g batata, ensalada" },
    { name:"Pavo + Arroz + Calabacín", kcal:500, cho:60, pro:42, fat:8, items:"200g pavo, 100g arroz, calabacín" },
  ], selected:null },
];

const SAMPLE_MEASURES = [
  { date:"01/05", peso:85.0, cintura:89.5, pecho:102, brazo:37.8, cuad:58, femoral:54 },
  { date:"08/05", peso:84.2, cintura:88.8, pecho:102, brazo:38.1, cuad:58, femoral:54 },
  { date:"15/05", peso:83.5, cintura:88.0, pecho:102, brazo:38.5, cuad:58.5, femoral:54.5 },
  { date:"22/05", peso:82.8, cintura:87.0, pecho:102.5, brazo:38.8, cuad:59, femoral:55 },
  { date:"29/05", peso:82.1, cintura:85.3, pecho:103, brazo:39.2, cuad:59.5, femoral:55.5 },
];

const MEASURE_FIELDS = [
  { key:"cintura", label:"Cintura", unit:"cm", color:T.warn, icon:"📏" },
  { key:"pecho",   label:"Pecho",   unit:"cm", color:"#4fc3f7", icon:"💪" },
  { key:"brazo",   label:"Brazo",   unit:"cm", color:T.green, icon:"💪" },
  { key:"cuad",    label:"Cuádriceps", unit:"cm", color:T.gold, icon:"🦵" },
  { key:"femoral", label:"Femoral", unit:"cm", color:"#f48fb1", icon:"🦵" },
];

// Generate 14 days of sample bio history
const makeBioHistory = () => {
  const today = new Date();
  const data = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0,10);
    if (i % 3 !== 1) data[key] = {
      peso: +(82 + (Math.random()-0.5)*1.5).toFixed(1),
      sueno: Math.floor(Math.random()*4)+6,
    };
  }
  return data;
};

const makeTrainHistory = () => {
  const today = new Date();
  const data = {};
  for (let i = 20; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const wd = d.getDay();
    const key = d.toISOString().slice(0,10);
    if (INIT_WEEK_PLAN[wd].type === "train" && i % 4 !== 0) {
      data[key] = {
        muscle: INIT_WEEK_PLAN[wd].muscle,
        exercises: INIT_WEEK_PLAN[wd].exercises.slice(0,3).map(name => ({
          name,
          sets: [
            { kg: Math.round(60+Math.random()*40), reps: Math.floor(6+Math.random()*6), rir: Math.floor(Math.random()*3), toFallo: false },
            { kg: Math.round(60+Math.random()*40), reps: Math.floor(6+Math.random()*6), rir: Math.floor(Math.random()*3), toFallo: false },
          ]
        }))
      };
    }
  }
  return data;
};

// Sample journal entries (sensaciones)
const makeSampleJournal = () => {
  const today = new Date();
  const data = {};
  const samples = [
    { entreno:8, dieta:7, energia:7, sueno:8, obs:"Entreno de pierna duro pero bien completado. Noto mejora en sentadilla." },
    { entreno:9, dieta:8, energia:8, sueno:7, obs:"Hoy me he sentido con mucha energía. El resto lo he aprovechado bien." },
    { entreno:6, dieta:5, energia:5, sueno:6, obs:"Día difícil con la dieta. Me ha costado no picar. Entreno correcto." },
    { entreno:8, dieta:9, energia:9, sueno:9, obs:"Semana perfecta. Noto cambios visibles en el espejo." },
  ];
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0,10);
      data[key] = samples[i % samples.length];
    }
  }
  return data;
};

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
function CoachNote({ type="default", label, children }) {
  const labels = { default:"📊 Nota del Entrenador", warn:"⚠ Ajuste Recomendado", gold:"🏆 ¡Buenas Noticias!", accent:"🔥 Beast Mode" };
  return (
    <div className={`cnote cnote-${type}`}>
      <div className="cnote-label">{label || labels[type]}</div>
      <div className="cnote-text">{children}</div>
    </div>
  );
}

function MacroPills({ kcal, cho, pro, fat }) {
  return (
    <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:7 }}>
      <span className="mpill mpill-k">{kcal} kcal</span>
      <span className="mpill mpill-c">🌾 {cho}g</span>
      <span className="mpill mpill-p">🥩 {pro}g</span>
      <span className="mpill mpill-f">🫒 {fat}g</span>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={wide?{width:680}:{}} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div className="modal-title" style={{ margin:0 }}>{title}</div>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize:18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <div className="flabel">{String(children).toUpperCase()}</div>;
}

function MiniCalendar({ year, month, markedDates, selectedDate, onSelect, getStyle }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0,10);
  const days = [];
  for (let i=0;i<firstDay;i++) days.push(null);
  for (let d=1;d<=daysInMonth;d++) {
    const key = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    days.push({ d, key });
  }
  return (
    <div className="cal-grid">
      {["D","L","M","X","J","V","S"].map(h => <div key={h} className="cal-hdr">{h}</div>)}
      {days.map((day,i) => {
        if (!day) return <div key={i} />;
        const extra = getStyle ? getStyle(day.key, day.d) : "";
        const isToday = day.key === todayKey;
        const cls = ["cal-day", extra, selectedDate===day.key?"selected":"", isToday?"today":""].filter(Boolean).join(" ");
        return (
          <div key={i} className={cls} onClick={() => onSelect(day.key)}>
            <span>{day.d}</span>
            {markedDates?.[day.key] && <div style={{ width:4,height:4,borderRadius:"50%",background:T.green,marginTop:2 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AUTH — SUPABASE LOGIN SCREEN
// ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [pass, setPass]         = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !pass) { setError("Introduce tu email y contraseña."); return; }
    setLoading(true); setError("");
    try {
      // 1. Sign in with Supabase Auth
      const authData = await sb.signIn(email.trim(), pass);
      if (authData.error || !authData.access_token) {
        setError(authData.error_description || authData.msg || "Email o contraseña incorrectos.");
        setLoading(false); return;
      }

      const { access_token, user } = authData;

      // 2. Get perfil (rol, nombre, peso, etc.)
      const perfil = await sb.getPerfil(user.id, access_token);
      if (!perfil) {
        setError("No se encontró tu perfil. Contacta con el coach.");
        setLoading(false); return;
      }

      // 3. Persist session
      sb.saveSession({ access_token, user_id: user.id });

      // 4. If coach, load all atletas
      let atletas = [];
      if (perfil.rol === "coach") {
        atletas = await sb.getAtletas(access_token);
      }

      onLogin({ access_token, user_id: user.id, perfil, atletas });
    } catch(e) {
      setError("Error de conexión. Comprueba tu internet.");
    }
    setLoading(false);
  };

  return (
    <div className="login-screen">
      <div className="login-box">
        <div style={{ fontFamily:T.font, fontSize:32, fontWeight:900, fontStyle:"italic", color:T.accent, marginBottom:4 }}>
          Javi Performance
        </div>
        <div style={{ fontFamily:T.font, fontSize:11, fontWeight:700, letterSpacing:4, color:T.muted, marginBottom:32 }}>
          COACHING HUB
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16, textAlign:"left" }}>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input type="text" placeholder="tu@email.com"
              value={email} onChange={e=>{ setEmail(e.target.value); setError(""); }}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()} autoFocus/>
          </div>
          <div style={{ position:"relative" }}>
            <FieldLabel>Contraseña</FieldLabel>
            <input type={showPass?"text":"password"} placeholder="••••••••"
              value={pass} onChange={e=>{ setPass(e.target.value); setError(""); }}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
            <button onClick={()=>setShowPass(v=>!v)}
              style={{ position:"absolute", right:12, top:30, background:"transparent",
                border:"none", cursor:"pointer", color:T.muted, fontSize:16, padding:4 }}>
              {showPass?"🙈":"👁"}
            </button>
          </div>
        </div>

        {error && <div className="login-error">⚠ {error}</div>}

        <button className="btn btn-accent btn-full" onClick={handleLogin} disabled={loading}>
          {loading ? "Entrando..." : "Entrar →"}
        </button>

        <div style={{ marginTop:16, fontSize:11, color:T.muted, lineHeight:1.6, textAlign:"center" }}>
          Accede con tu email y contraseña.<br/>Si no tienes cuenta, contacta con Javi.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING — first-time client setup (sin objetivo)
// ─────────────────────────────────────────────────────────────
function Onboarding({ onComplete, prefill }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ nombre: prefill?.nombre||"", peso: prefill?.peso||"", altura: prefill?.altura||"", edad: prefill?.edad||"" });

  const steps = [
    {
      title: "👋 Bienvenido a Javi Performance",
      subtitle: "Antes de empezar, cuéntame un poco sobre ti. Solo tardas 20 segundos.",
      fields: [["Tu nombre completo","nombre","text","ej: Andrei López"]],
      next: () => form.nombre.trim().length > 1,
    },
    {
      title: "📏 Tus datos físicos",
      subtitle: "Los necesito para calcular tus macros y seguir tu progreso.",
      fields: [
        ["Peso actual (kg)","peso","number","82"],
        ["Altura (cm)","altura","number","178"],
        ["Edad","edad","number","25"],
      ],
      next: () => form.peso && form.altura && form.edad,
    },
  ];

  const cur = steps[step];
  const canNext = cur.next();

  return (
    <div className="onboarding">
      <div className="onboarding-box">
        <div style={{ fontFamily:T.font, fontSize:11, fontWeight:700, letterSpacing:3, color:T.accent, marginBottom:12 }}>
          PASO {step+1} DE {steps.length}
        </div>
        <div style={{ fontFamily:T.font, fontSize:28, fontWeight:900, fontStyle:"italic", color:T.text, marginBottom:8 }}>
          {cur.title}
        </div>
        <div style={{ fontSize:13, color:T.muted, marginBottom:28, lineHeight:1.6 }}>{cur.subtitle}</div>

        <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:28 }}>
          {cur.fields.map(([label,key,type,placeholder])=>(
            <div key={key} style={{ textAlign:"left" }}>
              <FieldLabel>{label}</FieldLabel>
              <input type={type} placeholder={placeholder} value={form[key]}
                onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&canNext&&(step<steps.length-1?setStep(s=>s+1):onComplete(form))}
              />
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:10 }}>
          {step > 0 && (
            <button className="btn btn-outline" onClick={()=>setStep(s=>s-1)} style={{ flex:1 }}>← Atrás</button>
          )}
          <button
            className="btn btn-accent"
            style={{ flex:2, opacity: canNext?1:0.5 }}
            disabled={!canNext}
            onClick={()=>step<steps.length-1 ? setStep(s=>s+1) : onComplete(form)}
          >
            {step < steps.length-1 ? "Siguiente →" : "🚀 Empezar"}
          </button>
        </div>

        <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:20 }}>
          {steps.map((_,i)=>(
            <div key={i} style={{ width:6, height:6, borderRadius:"50%",
              background: i===step ? T.accent : T.border,
              transition:"background .2s" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 1 — DIARIO
// ─────────────────────────────────────────────────────────────
function DiarioTab({ client, coachMode }) {
  const todayKey = new Date().toISOString().slice(0,10);
  const now = new Date();
  const [history, setHistory] = useState(makeBioHistory);
  const [selDate, setSelDate] = useState(todayKey);
  const [form, setForm] = useState({ peso: parseFloat(client.peso)||82, sueno:7 });
  const [saved, setSaved] = useState(false);

  const isToday = selDate === todayKey;
  const selData = history[selDate];
  const displayData = isToday ? form : (selData || null);

  const save = () => {
    setHistory(h => ({ ...h, [selDate]: { ...form } }));
    setSaved(true); setTimeout(()=>setSaved(false), 2000);
  };

  const getNota = (sueno) => {
    if (sueno<=5) return { type:"warn", msg:"Veo que has descansado poco. Autorregula el entrenamiento y prioriza el sueño esta noche." };
    if (sueno>=8) return { type:"accent", msg:"Has descansado bien. No tienes excusa para no reventarte hoy. A por ello." };
    return { type:"default", msg:"Te sientes bien. Sabes lo que tienes que hacer, así que déjate los huevos." };
  };

  const nota = displayData ? getNota(displayData.sueno) : null;

  // 14-day chart data
  const chartData = useMemo(() => Object.entries(history)
    .sort(([a],[b])=>a.localeCompare(b)).slice(-14)
    .map(([date,v])=>({ date:date.slice(5), ...v })), [history]);

  const getCalStyle = (key) => {
    const [y,m,day] = key.split("-").map(Number);
    const wd = new Date(y, m-1, day).getDay();
    const plan = INIT_WEEK_PLAN[wd];
    if (history[key]) return "has-data";
    if (plan?.type==="rest") return "rest-day";
    return "";
  };

  return (
    <div>
      <div className="stitle">Diario de <span>{client.nombre?.split(" ")[0]||"tu Cliente"}</span></div>
      <div className="g2">
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div className="card">
            <div className="ctitle">📅 {now.toLocaleString("es",{month:"long",year:"numeric"})}</div>
            <MiniCalendar
              year={now.getFullYear()} month={now.getMonth()}
              markedDates={history} selectedDate={selDate} onSelect={setSelDate}
              getStyle={getCalStyle}
            />
            <div style={{ marginTop:10, display:"flex", gap:14, flexWrap:"wrap", fontSize:11, color:T.muted }}>
              <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:T.green, marginRight:5 }}/>Con datos</span>
              <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:2, border:`1px solid ${T.gold}`, marginRight:5 }}/>Hoy</span>
              <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:2, background:T.border, marginRight:5 }}/>Descanso</span>
            </div>
          </div>

          {selData && !isToday && (
            <div className="card">
              <div className="ctitle">📋 Registro — {selDate}</div>
              <div className="g2">
                {[["⚖ Peso",`${selData.peso} kg`,T.accent],["😴 Sueño",`${selData.sueno}/10`,selData.sueno<=5?T.warn:T.green]].map(([l,v,c])=>(
                  <div key={l} style={{ textAlign:"center", background:T.surface, borderRadius:10, padding:14 }}>
                    <div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>{l}</div>
                    <div style={{ fontFamily:T.mono, fontSize:20, fontWeight:700, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
              {nota && <CoachNote type={nota.type}>{nota.msg}</CoachNote>}
            </div>
          )}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div className="card">
            <div className="ctitle">📝 {isToday ? "Check-in de Hoy" : `Editar — ${selDate}`}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              {[
                { label:"⚖ Peso Corporal", key:"peso", min:40, max:150, step:0.1, unit:" kg", color:T.accent },
                { label:"😴 Calidad del Sueño", key:"sueno", min:1, max:10, step:1, unit:"/10", color:form.sueno<=5?T.warn:T.green },
              ].map(s=>(
                <div key={s.key}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{s.label}</span>
                    <span style={{ fontFamily:T.mono, fontSize:14, fontWeight:700, color:s.color }}>{form[s.key]}{s.unit}</span>
                  </div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={form[s.key]}
                    onChange={e=>setForm(f=>({...f,[s.key]:+e.target.value}))} />
                </div>
              ))}
              <button className="btn btn-accent" onClick={save}>
                {saved?"✓ Guardado":"Guardar Check-in"}
              </button>
            </div>
            {isToday && nota && <CoachNote type={nota.type}>{nota.msg}</CoachNote>}
          </div>

          <div className="card">
            <div className="ctitle">📈 Tendencia de Peso — Últimas 2 Semanas</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.accent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                <XAxis dataKey="date" tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false} interval={1}/>
                <YAxis domain={["auto","auto"]} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8}}/>
                <Area type="monotone" dataKey="peso" stroke={T.accent} strokeWidth={2} fill="url(#wg)" dot={{fill:T.accent,r:3}} name="Peso (kg)"/>
              </AreaChart>
            </ResponsiveContainer>
            {chartData.length >= 2 && (() => {
              const first = chartData.find(d=>d.peso)?.peso;
              const last = [...chartData].reverse().find(d=>d.peso)?.peso;
              if (!first||!last) return null;
              const diff = (last - first).toFixed(1);
              const isDown = diff < 0;
              return (
                <div style={{ marginTop:10, display:"flex", gap:10, flexWrap:"wrap" }}>
                  <span className={`badge ${isDown?"badge-green":"badge-gold"}`}>
                    {isDown?"↓":"↑"} {Math.abs(diff)} kg en 2 semanas
                  </span>
                  <span style={{ fontSize:11, color:T.muted, alignSelf:"center" }}>
                    {first} kg → {last} kg
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 2 — NUTRICIÓN
// ─────────────────────────────────────────────────────────────
function NutricionTab({ client, coachMode, weekPlan }) {
  const todayWd = new Date().getDay();
  const todayPlan = weekPlan[todayWd];
  const autoType = todayPlan.type === "train" ? "entreno" : "descanso";

  const [dayType, setDayType] = useState(autoType);
  const [meals, setMeals] = useState(INIT_MEALS);
  const [editMeal, setEditMeal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newMealName, setNewMealName] = useState("");
  const [addingMeal, setAddingMeal] = useState(false);

  const peso = parseFloat(client.peso) || 82;
  const defaultTargets = useMemo(() => {
    const cho = dayType==="entreno" ? Math.round(peso*3.5) : Math.round(peso*2);
    const pro = Math.round(peso*2);
    const fat = dayType==="entreno" ? Math.round(peso*0.8) : Math.round(peso*1);
    return { cho, pro, fat, kcal: cho*4+pro*4+fat*9 };
  }, [dayType, peso]);

  const [customTargets, setCustomTargets] = useState(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const [targetForm, setTargetForm] = useState({});
  const targets = customTargets || defaultTargets;

  const openTargetEdit = () => { setTargetForm({ ...targets }); setEditingTargets(true); };
  const saveTargets = () => {
    const t = { cho:+targetForm.cho, pro:+targetForm.pro, fat:+targetForm.fat,
      kcal: +targetForm.kcal || (+targetForm.cho*4 + +targetForm.pro*4 + +targetForm.fat*9) };
    setCustomTargets(t); setEditingTargets(false);
  };
  const resetTargets = () => { setCustomTargets(null); setEditingTargets(false); };

  const totals = meals.reduce((acc,m)=>{
    if (m.selected===null) return acc;
    const o = m.options[m.selected];
    return { kcal:acc.kcal+o.kcal, cho:acc.cho+o.cho, pro:acc.pro+o.pro, fat:acc.fat+o.fat };
  },{ kcal:0,cho:0,pro:0,fat:0 });

  const selectOpt=(mIdx,oIdx)=>setMeals(ms=>ms.map((m,i)=>i===mIdx?{...m,selected:m.selected===oIdx?null:oIdx}:m));
  const startEdit=(mIdx,oIdx)=>{ setEditMeal({mIdx,oIdx}); setEditForm({...meals[mIdx].options[oIdx]}); };
  const saveEdit=()=>{
    setMeals(ms=>ms.map((m,i)=>i===editMeal.mIdx?{...m,options:m.options.map((o,j)=>j===editMeal.oIdx?{...editForm,kcal:+editForm.kcal,cho:+editForm.cho,pro:+editForm.pro,fat:+editForm.fat}:o)}:m));
    setEditMeal(null);
  };
  const addMeal=()=>{
    if (!newMealName.trim()) return;
    setMeals(ms=>[...ms,{ id:Date.now(),name:newMealName.trim(),time:"12:00",options:[
      {name:"Opción A",kcal:400,cho:50,pro:30,fat:10,items:"Personaliza aquí"},
      {name:"Opción B",kcal:400,cho:50,pro:30,fat:10,items:"Personaliza aquí"},
      {name:"Opción C",kcal:400,cho:50,pro:30,fat:10,items:"Personaliza aquí"},
    ],selected:null}]);
    setNewMealName(""); setAddingMeal(false);
  };
  const removeMeal=mIdx=>setMeals(ms=>ms.filter((_,i)=>i!==mIdx));

  const macroRows = [
    { k:"kcal", l:"Calorías", u:"kcal", c:T.text },
    { k:"cho",  l:"Carbos", u:"g", c:"#4fc3f7" },
    { k:"pro",  l:"Proteínas", u:"g", c:"#f48fb1" },
    { k:"fat",  l:"Grasas", u:"g", c:T.gold },
  ];

  return (
    <div>
      <div className="stitle">Plan <span>Nutricional</span></div>
      <div className="card" style={{ marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
          <div className="ctitle" style={{ margin:0 }}>Objetivos del Día</div>
          <div style={{ display:"flex", gap:6, marginLeft:8 }}>
            {["entreno","descanso"].map(t=>(
              <button key={t} className={`btn btn-sm ${dayType===t?"btn-accent":"btn-outline"}`}
                onClick={()=>{ setDayType(t); setCustomTargets(null); }}>
                {t==="entreno"?"🏋 Entreno":"😴 Descanso"}
              </button>
            ))}
          </div>
          {autoType===dayType
            ? <span className="badge badge-green" style={{ marginLeft:8 }}>Auto · {todayPlan.label}</span>
            : <span className="badge badge-muted" style={{ marginLeft:8 }}>Manual</span>}
          {coachMode && (
            <button className="btn btn-outline btn-sm" style={{ marginLeft:"auto" }} onClick={openTargetEdit}>
              ✏️ Editar Macros
            </button>
          )}
          {customTargets && coachMode && (
            <button className="btn btn-ghost btn-sm" onClick={resetTargets}>↩ Restablecer</button>
          )}
        </div>
        <div className="g4">
          {macroRows.map(m=>{
            const pct = Math.min(Math.round((totals[m.k]/(targets[m.k]||1))*100),100);
            return (
              <div key={m.k} style={{ background:T.surface, borderRadius:12, padding:16 }}>
                <div style={{ fontSize:10,color:T.muted,marginBottom:4,fontWeight:700,letterSpacing:1 }}>{m.l.toUpperCase()}</div>
                <div style={{ fontFamily:T.mono,fontSize:22,fontWeight:700,color:m.c }}>
                  {targets[m.k]}<span style={{ fontSize:11,color:T.muted,marginLeft:3 }}>{m.u}</span>
                </div>
                <div style={{ height:4,background:T.border,borderRadius:2,marginTop:8,overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`,height:"100%",background:m.c,borderRadius:2,transition:"width .5s" }}/>
                </div>
                <div style={{ fontSize:10,color:T.muted,marginTop:3 }}>{totals[m.k]}/{targets[m.k]} ({pct}%)</div>
              </div>
            );
          })}
        </div>
        {customTargets && <div style={{ fontSize:11,color:T.accent,marginTop:10 }}>⚡ Macros personalizados por el coach</div>}
      </div>

      {editingTargets && (
        <Modal title="✏️ Editar Macros Objetivo" onClose={()=>setEditingTargets(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[["Calorías (kcal)","kcal"],["Carbohidratos (g)","cho"],["Proteínas (g)","pro"],["Grasas (g)","fat"]].map(([l,k])=>(
              <div key={k}><FieldLabel>{l}</FieldLabel>
                <input type="number" value={targetForm[k]||""} onChange={e=>setTargetForm(f=>({...f,[k]:e.target.value}))}/>
              </div>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <button className="btn btn-accent" style={{ flex:1 }} onClick={saveTargets}>Guardar</button>
              <button className="btn btn-outline" onClick={()=>setEditingTargets(false)}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {editMeal && (
        <Modal title="✏️ Editar Opción de Comida" onClose={()=>setEditMeal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[["Nombre","name","text"],["Alimentos","items","text"],["Calorías","kcal","number"],["Carbos (g)","cho","number"],["Proteínas (g)","pro","number"],["Grasas (g)","fat","number"]].map(([l,k,t])=>(
              <div key={k}><FieldLabel>{l}</FieldLabel>
                <input type={t} value={editForm[k]||""} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}/>
              </div>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <button className="btn btn-accent" style={{ flex:1 }} onClick={saveEdit}>Guardar</button>
              <button className="btn btn-outline" onClick={()=>setEditMeal(null)}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {meals.map((meal,mIdx)=>(
        <div key={meal.id} className="card" style={{ marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
            <div style={{ fontFamily:T.font, fontSize:20, fontWeight:800 }}>{meal.name}</div>
            <div style={{ fontSize:12,color:T.muted }}>{meal.time}</div>
            {meal.selected!==null && <MacroPills {...meal.options[meal.selected]}/>}
            {coachMode && <button className="btn-ghost" style={{ marginLeft:"auto",color:T.warn }} onClick={()=>removeMeal(mIdx)}>🗑</button>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {meal.options.map((opt,oIdx)=>(
              <div key={oIdx} className={`meal-opt ${meal.selected===oIdx?"sel":""}`} onClick={()=>selectOpt(mIdx,oIdx)}>
                <div className="meal-name">{opt.name}</div>
                <div className="meal-desc">{opt.items}</div>
                <MacroPills {...opt}/>
                {coachMode && (
                  <button className="btn btn-outline btn-xs" style={{ marginTop:10,width:"100%" }}
                    onClick={e=>{ e.stopPropagation(); startEdit(mIdx,oIdx); }}>✏️ Editar</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {coachMode && (
        <div className="card" style={{ marginBottom:16 }}>
          {addingMeal ? (
            <div style={{ display:"flex", gap:10 }}>
              <input type="text" placeholder="Nombre de la comida" value={newMealName}
                onChange={e=>setNewMealName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMeal()}/>
              <button className="btn btn-accent" onClick={addMeal}>Añadir</button>
              <button className="btn btn-outline" onClick={()=>setAddingMeal(false)}>Cancelar</button>
            </div>
          ):(
            <button className="btn btn-outline" onClick={()=>setAddingMeal(true)}>+ Añadir Comida</button>
          )}
        </div>
      )}

      <div className="card">
        <div className="ctitle">Resumen del Día</div>
        <div className="g4">
          {macroRows.map(m=>(
            <div key={m.k} style={{ textAlign:"center" }}>
              <div style={{ fontSize:10,color:T.muted,marginBottom:4,letterSpacing:1 }}>{m.l.toUpperCase()}</div>
              <div style={{ fontFamily:T.mono,fontSize:22,fontWeight:700,color:m.c }}>{totals[m.k]}</div>
              <div style={{ fontSize:10,color:T.muted }}>/ {targets[m.k]} {m.u}</div>
            </div>
          ))}
        </div>
        {totals.kcal>0 && (
          <CoachNote type={totals.kcal>=targets.kcal*0.9?"gold":"default"}>
            {totals.kcal>=targets.kcal*0.9
              ? "Perfecto, has completado las calorías del día. Estás en el camino correcto."
              : `Llevas ${totals.kcal} kcal de ${targets.kcal}. Selecciona las comidas que faltan.`}
          </CoachNote>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PLAN EDITOR MODAL (coach can edit week plan)
// ─────────────────────────────────────────────────────────────
function PlanEditorModal({ weekPlan, onSave, onClose }) {
  const [plan, setPlan] = useState(() => JSON.parse(JSON.stringify(weekPlan)));
  const [exerciseDB, setExerciseDB] = useState(EXERCISE_DB_INIT);
  const [exInput, setExInput] = useState({});  // {dayIdx: string}
  const [suggestions, setSuggestions] = useState({});

  const toggleType = (wd) => {
    setPlan(p => {
      const cur = p[wd];
      const isRest = cur.type === "rest";
      return { ...p, [wd]: { ...cur, type: isRest?"train":"rest",
        muscle: isRest ? "Personalizado" : "Descanso",
        exercises: isRest ? [] : [] } };
    });
  };

  const handleExInput = (wd, val) => {
    setExInput(e=>({...e,[wd]:val}));
    setSuggestions(s=>({...s,[wd]: val.length>=2
      ? exerciseDB.filter(e=>e.toLowerCase().includes(val.toLowerCase()) && !plan[wd].exercises.includes(e)).slice(0,5)
      : []}));
  };

  const addExercise = (wd, name) => {
    const n = name || (exInput[wd]||"").trim();
    if (!n) return;
    if (!exerciseDB.includes(n)) setExerciseDB(db=>[...db, n]);
    setPlan(p=>({...p,[wd]:{...p[wd], exercises:[...p[wd].exercises, n]}}));
    setExInput(e=>({...e,[wd]:""}));
    setSuggestions(s=>({...s,[wd]:[]}));
  };

  const removeExercise = (wd, idx) => {
    setPlan(p=>({...p,[wd]:{...p[wd], exercises:p[wd].exercises.filter((_,i)=>i!==idx)}}));
  };

  const moveExercise = (wd, idx, dir) => {
    const exs = [...plan[wd].exercises];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= exs.length) return;
    [exs[idx], exs[newIdx]] = [exs[newIdx], exs[idx]];
    setPlan(p=>({...p,[wd]:{...p[wd], exercises:exs}}));
  };

  const updateMuscle = (wd, val) => {
    setPlan(p=>({...p,[wd]:{...p[wd], muscle:val}}));
  };

  return (
    <Modal title="📋 Editor del Plan Semanal" onClose={onClose} wide>
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        {[1,2,3,4,5,6,0].map(wd=>{
          const day = plan[wd];
          return (
            <div key={wd} className="plan-day-row" style={{ flexDirection:"column", alignItems:"flex-start", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, width:"100%", flexWrap:"wrap" }}>
                <div className="plan-day-label">{day.label}</div>
                <button
                  className={`btn btn-xs ${day.type==="train"?"btn-accent":"btn-outline"}`}
                  onClick={()=>toggleType(wd)}
                  style={{ minWidth:80 }}>
                  {day.type==="train"?"🏋 Entreno":"😴 Descanso"}
                </button>
                {day.type==="train" && (
                  <input type="text" placeholder="Nombre del grupo muscular..."
                    value={day.muscle==="Personalizado"?"":day.muscle}
                    onChange={e=>updateMuscle(wd,e.target.value)}
                    style={{ flex:1, minWidth:160, padding:"7px 12px", fontSize:13 }}/>
                )}
              </div>

              {day.type==="train" && (
                <div style={{ paddingLeft:100, width:"100%" }}>
                  {/* Exercise list with order controls */}
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                    {day.exercises.map((ex,i)=>(
                      <span key={i} className="ex-pill">
                        <button style={{ background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:11,padding:"0 2px" }}
                          onClick={()=>moveExercise(wd,i,-1)} disabled={i===0}>↑</button>
                        <button style={{ background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:11,padding:"0 2px" }}
                          onClick={()=>moveExercise(wd,i,1)} disabled={i===day.exercises.length-1}>↓</button>
                        {ex}
                        <button className="ex-pill-remove" onClick={()=>removeExercise(wd,i)}>✕</button>
                      </span>
                    ))}
                    {day.exercises.length===0 && (
                      <span style={{ fontSize:12, color:T.muted, fontStyle:"italic" }}>Sin ejercicios asignados</span>
                    )}
                  </div>
                  {/* Add exercise input */}
                  <div style={{ position:"relative", display:"flex", gap:6 }}>
                    <input type="text" placeholder="Buscar o escribir ejercicio..."
                      value={exInput[wd]||""}
                      onChange={e=>handleExInput(wd,e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&addExercise(wd)}
                      style={{ flex:1, padding:"7px 12px", fontSize:13 }}/>
                    <button className="btn btn-outline btn-xs" onClick={()=>addExercise(wd)}>+ Añadir</button>
                    {(suggestions[wd]||[]).length>0 && (
                      <div style={{ position:"absolute",top:"100%",left:0,right:60,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,zIndex:20,marginTop:4 }}>
                        {suggestions[wd].map(s=>(
                          <div key={s} onClick={()=>addExercise(wd,s)}
                            style={{ padding:"8px 12px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${T.border}33` }}
                            onMouseEnter={e=>e.currentTarget.style.background=T.accentLo}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:10, marginTop:20 }}>
        <button className="btn btn-accent" style={{ flex:1 }} onClick={()=>onSave(plan)}>✓ Guardar Plan</button>
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 3 — ENTRENAMIENTO
// ─────────────────────────────────────────────────────────────
function EntrenamientoTab({ client, coachMode, weekPlan, setWeekPlan }) {
  const todayKey = new Date().toISOString().slice(0,10);
  const todayWd  = new Date().getDay();
  const now      = new Date();

  const [innerTab, setInnerTab]     = useState("session");
  const [selDate, setSelDate]       = useState(todayKey);
  const [trainHistory, setTrainHistory] = useState(makeTrainHistory);
  const [exerciseDB, setExerciseDB] = useState(EXERCISE_DB_INIT);
  const [sessions, setSessions]     = useState({});
  const [showPlanEditor, setShowPlanEditor] = useState(false);

  const todayPlan = weekPlan[todayWd];
  const selWd  = new Date(selDate).getDay();
  const selPlan = weekPlan[selWd];

  const getSession = (dateKey) => {
    if (sessions[dateKey]) return sessions[dateKey];
    const plan = weekPlan[new Date(dateKey).getDay()];
    if (plan.type==="rest" || !plan.exercises.length) return [];
    return plan.exercises.map(name=>({ name, sets:[{ kg:"",reps:"",rir:"",toFallo:false }] }));
  };

  const [curSession, setCurSession] = useState(()=>getSession(todayKey));
  const [newEx, setNewEx]           = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [celebration, setCelebration] = useState(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [prRecords] = useState({ "Sentadilla":{kg:100,reps:5},"Press Banca":{kg:80,reps:8},"Peso Muerto":{kg:120,reps:5},"Dominadas":{kg:0,reps:8} });
  const [viewHistoryDate, setViewHistoryDate] = useState(null);

  const loadDate = (key) => { setSelDate(key); setCurSession(sessions[key] || getSession(key)); };

  const saveSession = () => {
    setSessions(s=>({ ...s, [selDate]: curSession }));
    if (curSession.length>0) {
      setTrainHistory(h=>({ ...h, [selDate]:{ muscle:weekPlan[new Date(selDate).getDay()].muscle, exercises:curSession }}));
    }
    setSessionSaved(true); setTimeout(()=>setSessionSaved(false), 2500);
  };

  const handleNewExInput=(v)=>{
    setNewEx(v);
    setSuggestions(v.length>=2 ? exerciseDB.filter(e=>e.toLowerCase().includes(v.toLowerCase())).slice(0,5) : []);
  };

  const addExercise=(name)=>{
    const n=name||newEx.trim(); if(!n) return;
    if(!exerciseDB.includes(n)) setExerciseDB(db=>[...db,n]);
    setCurSession(ex=>[...ex,{ name:n, sets:[{ kg:"",reps:"",rir:"",toFallo:false }] }]);
    setNewEx(""); setSuggestions([]);
  };

  const addSet=(eIdx)=>setCurSession(ex=>ex.map((e,i)=>i===eIdx?{...e,sets:[...e.sets,{kg:"",reps:"",rir:"",toFallo:false}]}:e));
  const removeSet=(eIdx,sIdx)=>setCurSession(ex=>ex.map((e,i)=>i===eIdx?{...e,sets:e.sets.filter((_,j)=>j!==sIdx)}:e));
  const removeEx=(eIdx)=>setCurSession(ex=>ex.filter((_,i)=>i!==eIdx));

  const updateSet=(eIdx,sIdx,field,val)=>{
    const updated=curSession.map((e,i)=>{ if(i!==eIdx) return e; return {...e,sets:e.sets.map((s,j)=>j!==sIdx?s:{...s,[field]:val})}; });
    setCurSession(updated);
    const ex=updated[eIdx]; const set=ex.sets[sIdx]; const prev=prRecords[ex.name];
    if(prev&&set.kg&&set.reps&&!set.toFallo&&+set.kg>prev.kg){
      setCelebration(ex.name); setTimeout(()=>setCelebration(null),5000);
    }
  };

  const getCalStyle=(key)=>{
    const [y,m,d] = key.split("-").map(Number);
    const wd=new Date(y,m-1,d).getDay();
    const plan=weekPlan[wd];
    if(trainHistory[key]) return "has-train";
    if(plan?.type==="rest") return "rest-day";
    return "";
  };

  const isRest = selPlan.type==="rest";
  const isToday = selDate===todayKey;
  const histEntry = viewHistoryDate ? (trainHistory[viewHistoryDate] || null) : null;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18, flexWrap:"wrap" }}>
        <div className="stitle" style={{ margin:0 }}>
          {isToday ? `${todayPlan.label} — ` : `${selPlan.label} — `}
          <span>{selPlan.muscle || "Descanso"}</span>
        </div>
        {coachMode && (
          <button className="btn btn-outline btn-sm" style={{ marginLeft:"auto" }} onClick={()=>setShowPlanEditor(true)}>
            📋 Editar Plan Semanal
          </button>
        )}
      </div>

      {showPlanEditor && (
        <PlanEditorModal
          weekPlan={weekPlan}
          onSave={(newPlan)=>{ setWeekPlan(newPlan); setShowPlanEditor(false); setCurSession(getSession(selDate)); }}
          onClose={()=>setShowPlanEditor(false)}
        />
      )}

      <div className="tab-inner">
        {[["session","🏋 Sesión"],["history","📅 Historial"],["stats","📈 Evolución"]].map(([k,l])=>(
          <button key={k} className={`tab-inner-btn ${innerTab===k?"active":""}`} onClick={()=>setInnerTab(k)}>{l}</button>
        ))}
      </div>

      {innerTab==="session" && (
        <>
          <div className="card" style={{ marginBottom:16 }}>
            <div className="ctitle">Seleccionar Día</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {Array.from({length:7},(_,i)=>{
                const d=new Date(); d.setDate(d.getDate()-(d.getDay()-i+7)%7);
                const key=d.toISOString().slice(0,10);
                const wd=d.getDay(); const plan=weekPlan[wd];
                return (
                  <button key={i}
                    className={`day-pill ${selDate===key?"sel":""} ${plan.type==="train"?"train":"rest"}`}
                    onClick={()=>loadDate(key)}>
                    {plan.label}<br/>
                    <span style={{ fontSize:10,opacity:0.7 }}>{plan.muscle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {celebration && (
            <div className="celebrate">
              <div style={{ fontFamily:T.font,fontSize:16,fontWeight:900,color:T.gold,marginBottom:4 }}>🏆 ¡NUEVO RÉCORD PERSONAL!</div>
              <div style={{ fontSize:14 }}>¡Brutal! Un día más superándote en <strong>{celebration}</strong>. Así se construye el cuerpo que quieres.</div>
            </div>
          )}

          {isRest ? (
            <div className="card">
              <CoachNote type="default" label="😴 Día de Recuperación">
                Hoy es día de descanso. Sal a moverte lo que tengas que moverte y repón energías. Mañana volvemos con todo.
              </CoachNote>
            </div>
          ) : (
            <>
              {curSession.map((ex,eIdx)=>(
                <div key={eIdx} className="ex-block">
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <div className="ex-name">{ex.name}</div>
                    {prRecords[ex.name] && (
                      <span className="badge badge-accent">
                        Marca: {prRecords[ex.name].kg>0?`${prRecords[ex.name].kg}kg × ${prRecords[ex.name].reps}`:`${prRecords[ex.name].reps} reps`}
                      </span>
                    )}
                    <button className="btn-ghost" onClick={()=>removeEx(eIdx)} style={{ marginLeft:"auto" }}>✕</button>
                  </div>

                  <div className="set-row" style={{ marginBottom:4 }}>
                    {["SER","KG","REPS","RIR","AL FALLO",""].map((h,i)=>(
                      <span key={i} style={{ fontSize:9,color:T.muted,fontWeight:800,letterSpacing:1 }}>{h}</span>
                    ))}
                  </div>

                  {ex.sets.map((set,sIdx)=>(
                    <div key={sIdx} className="set-row">
                      <div className="set-num">{sIdx+1}</div>
                      <input type="number" placeholder="kg" value={set.kg} onChange={e=>updateSet(eIdx,sIdx,"kg",e.target.value)}/>
                      <input type="number" placeholder="reps" value={set.reps} onChange={e=>updateSet(eIdx,sIdx,"reps",e.target.value)}/>
                      <input type="number" placeholder="0-3" value={set.toFallo?"":set.rir} disabled={set.toFallo}
                        onChange={e=>updateSet(eIdx,sIdx,"rir",e.target.value)} style={{ opacity:set.toFallo?0.35:1 }}/>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <input type="checkbox" checked={set.toFallo}
                          onChange={e=>updateSet(eIdx,sIdx,"toFallo",e.target.checked)}
                          style={{ accentColor:T.accent,width:16,height:16,cursor:"pointer" }}/>
                        {set.toFallo && <span className="badge badge-red" style={{ fontSize:9,padding:"2px 7px" }}>FALLO</span>}
                      </div>
                      <button className="btn-ghost" onClick={()=>removeSet(eIdx,sIdx)}>✕</button>
                    </div>
                  ))}
                  <button className="btn btn-outline btn-sm" style={{ marginTop:8 }} onClick={()=>addSet(eIdx)}>+ Serie</button>
                </div>
              ))}

              <div className="card" style={{ position:"relative", marginBottom:16 }}>
                <div className="ctitle">Añadir Ejercicio</div>
                <div style={{ display:"flex", gap:10 }}>
                  <div style={{ flex:1, position:"relative" }}>
                    <input type="text" placeholder="Buscar o crear ejercicio..." value={newEx}
                      onChange={e=>handleNewExInput(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&addExercise()}/>
                    {suggestions.length>0 && (
                      <div style={{ position:"absolute",top:"100%",left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,zIndex:10,marginTop:4 }}>
                        {suggestions.map(s=>(
                          <div key={s} onClick={()=>addExercise(s)}
                            style={{ padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${T.border}33` }}
                            onMouseEnter={e=>e.currentTarget.style.background=T.accentLo}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-accent" onClick={()=>addExercise()}>Añadir</button>
                </div>
                <div style={{ marginTop:10,display:"flex",flexWrap:"wrap",gap:6 }}>
                  {selPlan.exercises.filter(e=>!curSession.find(ex=>ex.name===e)).map(e=>(
                    <button key={e} className="btn btn-outline btn-xs" onClick={()=>addExercise(e)}>{e}</button>
                  ))}
                </div>
              </div>

              <button className="btn btn-accent" onClick={saveSession} style={{ width:"100%" }}>
                {sessionSaved ? "✓ Sesión Guardada" : "💾 Guardar Sesión"}
              </button>
            </>
          )}
        </>
      )}

      {innerTab==="history" && (
        <div className="g2">
          <div className="card">
            <div className="ctitle">📅 {now.toLocaleString("es",{month:"long",year:"numeric"})}</div>
            <MiniCalendar
              year={now.getFullYear()} month={now.getMonth()}
              markedDates={trainHistory} selectedDate={viewHistoryDate}
              onSelect={k=>setViewHistoryDate(k===viewHistoryDate?null:k)}
              getStyle={getCalStyle}
            />
            <div style={{ marginTop:10,display:"flex",gap:14,fontSize:11,color:T.muted }}>
              <span><span style={{ display:"inline-block",width:8,height:8,borderRadius:2,background:"#4fc3f7",marginRight:5 }}/>Entrenado</span>
              <span><span style={{ display:"inline-block",width:8,height:8,borderRadius:2,background:T.border,marginRight:5 }}/>Descanso</span>
            </div>
          </div>

          <div>
            {viewHistoryDate && histEntry ? (
              <div className="card">
                <div className="ctitle">📋 {viewHistoryDate} — {histEntry.muscle}</div>
                {histEntry.exercises.map((ex,i)=>(
                  <div key={i} style={{ marginBottom:14 }}>
                    <div style={{ fontFamily:T.font,fontSize:16,fontWeight:800,marginBottom:6 }}>{ex.name}</div>
                    <table><thead><tr><th>Serie</th><th>Kg</th><th>Reps</th><th>RIR</th></tr></thead>
                      <tbody>{ex.sets.map((s,j)=>(
                        <tr key={j}><td>{j+1}</td>
                          <td><span style={{ fontFamily:T.mono,color:T.accent }}>{s.kg}</span></td>
                          <td>{s.reps}</td>
                          <td>{s.toFallo?<span className="badge badge-red" style={{ fontSize:9 }}>FALLO</span>:s.rir}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : viewHistoryDate ? (
              <div className="card"><CoachNote type="default">No hay datos para este día.</CoachNote></div>
            ) : (
              <div className="card"><div style={{ fontSize:13,color:T.muted,textAlign:"center",padding:"20px 0" }}>Selecciona un día del calendario.</div></div>
            )}
            <div className="card" style={{ marginTop:16 }}>
              <div className="ctitle">Últimas Sesiones</div>
              {Object.entries(trainHistory).sort(([a],[b])=>b.localeCompare(a)).slice(0,6).map(([date,s])=>(
                <div key={date} className="stat-row" style={{ cursor:"pointer" }} onClick={()=>setViewHistoryDate(date)}>
                  <div>
                    <div style={{ fontWeight:600,fontSize:13 }}>{date}</div>
                    <div style={{ fontSize:11,color:T.muted }}>{s.muscle}</div>
                  </div>
                  <div style={{ display:"flex",gap:6 }}>
                    <span className="badge badge-accent">{s.exercises.length} ejercicios</span>
                    <span className="badge badge-muted">{s.exercises.reduce((a,e)=>a+e.sets.length,0)} series</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {innerTab==="stats" && (
        <EvoStats trainHistory={trainHistory} weekPlan={weekPlan}/>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATS — EVOLUCIÓN DE CARGAS Y REPS
// ─────────────────────────────────────────────────────────────
function EvoStats({ trainHistory, weekPlan }) {
  // Extract all unique exercises from history
  const allExercises = useMemo(() => {
    const set = new Set();
    Object.values(trainHistory).forEach(s => s.exercises.forEach(e => set.add(e.name)));
    return [...set].sort();
  }, [trainHistory]);

  const [selEx, setSelEx] = useState(allExercises[0] || "Sentadilla");

  // Build per-exercise time series: date → { maxKg, totalVol, maxReps, sets }
  const exHistory = useMemo(() => {
    const data = [];
    Object.entries(trainHistory)
      .sort(([a],[b])=>a.localeCompare(b))
      .forEach(([date, session]) => {
        const ex = session.exercises.find(e => e.name === selEx);
        if (!ex) return;
        const validSets = ex.sets.filter(s => +s.kg > 0 && +s.reps > 0);
        if (!validSets.length) return;
        const maxKg = Math.max(...validSets.map(s => +s.kg));
        const maxReps = Math.max(...validSets.map(s => +s.reps));
        const totalVol = validSets.reduce((a,s) => a + (+s.kg * +s.reps), 0);
        const totalSeries = validSets.length;
        data.push({ date: date.slice(5), fullDate: date, maxKg, maxReps, totalVol, totalSeries });
      });
    return data;
  }, [selEx, trainHistory]);

  // PRs
  const prKg   = exHistory.length ? Math.max(...exHistory.map(d=>d.maxKg))   : 0;
  const prReps = exHistory.length ? Math.max(...exHistory.map(d=>d.maxReps)) : 0;
  const prVol  = exHistory.length ? Math.max(...exHistory.map(d=>d.totalVol)) : 0;

  // Week-by-week volume trend
  const weeklyVol = useMemo(() => {
    const weeks = {};
    Object.entries(trainHistory)
      .sort(([a],[b])=>a.localeCompare(b))
      .forEach(([date, session]) => {
        const d = new Date(date);
        // Monday of that week
        const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay()+6)%7));
        const wk = mon.toISOString().slice(0,10);
        if (!weeks[wk]) weeks[wk] = { vol:0, series:0, sessions:0 };
        weeks[wk].sessions++;
        session.exercises.forEach(e => e.sets.forEach(s => {
          weeks[wk].vol   += (+s.kg||0) * (+s.reps||0);
          weeks[wk].series++;
        }));
      });
    return Object.entries(weeks).map(([w,v])=>({ semana:w.slice(5), vol:Math.round(v.vol), series:v.series, sessions:v.sessions }));
  }, [trainHistory]);

  // Consistency: sessions per week
  const consistencyData = weeklyVol;

  const [chartMode, setChartMode] = useState("kg"); // kg | reps | vol

  const chartKey   = chartMode === "kg" ? "maxKg" : chartMode === "reps" ? "maxReps" : "totalVol";
  const chartLabel = chartMode === "kg" ? "Peso Máx. (kg)" : chartMode === "reps" ? "Reps Máx." : "Volumen (kg×reps)";
  const chartColor = chartMode === "kg" ? T.accent : chartMode === "reps" ? T.gold : T.green;

  if (!allExercises.length) {
    return (
      <div className="card" style={{ textAlign:"center", padding:40 }}>
        <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
        <div style={{ fontSize:14, color:T.muted }}>Guarda sesiones de entrenamiento para ver tu evolución aquí.</div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div className="stitle" style={{ margin:0 }}>Evolución <span>de Cargas</span></div>

      {/* Global PRs */}
      <div className="g4">
        {[
          { label:"Récord de Peso", val:`${prKg} kg`, sub:"en un ejercicio", color:T.accent, icon:"🏆" },
          { label:"Récord de Reps", val:prReps, sub:"en una serie", color:T.gold, icon:"🔥" },
          { label:"Sesiones Totales", val:Object.keys(trainHistory).length, sub:"registradas", color:T.green, icon:"📅" },
          { label:"Volumen Pico", val:`${prVol.toLocaleString()}`, sub:"kg×reps en un día", color:"#4fc3f7", icon:"⚡" },
        ].map(k=>(
          <div key={k.label} className="pr-card" style={{ textAlign:"center" }}>
            <div style={{ fontSize:24, marginBottom:4 }}>{k.icon}</div>
            <div className="pr-val" style={{ color:k.color, fontSize:22 }}>{k.val}</div>
            <div className="pr-label">{k.label}</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Exercise selector */}
      <div className="card">
        <div className="ctitle">Selecciona un Ejercicio</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", maxHeight:120, overflowY:"auto" }}>
          {allExercises.map(ex=>(
            <button key={ex} className={`stats-ex-btn ${selEx===ex?"active":""}`}
              onClick={()=>setSelEx(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise evolution chart */}
      {exHistory.length >= 2 ? (
        <div className="card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:10 }}>
            <div style={{ fontFamily:T.font, fontSize:18, fontWeight:900, fontStyle:"italic" }}>{selEx}</div>
            <div style={{ display:"flex", gap:6 }}>
              {[["kg","⚖ Peso"],["reps","🔢 Reps"],["vol","📦 Volumen"]].map(([m,l])=>(
                <button key={m} className={`stats-ex-btn ${chartMode===m?"active":""}`}
                  onClick={()=>setChartMode(m)} style={{ fontSize:11, padding:"5px 10px" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Mini PRs for this exercise */}
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            {[
              { l:"Mejor Peso", v:`${Math.max(...exHistory.map(d=>d.maxKg))} kg`, c:T.accent },
              { l:"Mejor Reps", v:`${Math.max(...exHistory.map(d=>d.maxReps))} reps`, c:T.gold },
              { l:"Sesiones", v:exHistory.length, c:T.green },
              { l:"Mejor Volumen", v:`${Math.max(...exHistory.map(d=>d.totalVol))} kg×r`, c:"#4fc3f7" },
            ].map(k=>(
              <div key={k.l} style={{ background:T.surface, borderRadius:10, padding:"10px 14px", flex:1, minWidth:80, textAlign:"center", border:`1px solid ${T.border}` }}>
                <div style={{ fontFamily:T.mono, fontSize:16, fontWeight:700, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:10, color:T.muted, marginTop:2, fontWeight:700, letterSpacing:1 }}>{k.l.toUpperCase()}</div>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={exHistory}>
              <defs>
                <linearGradient id="evog" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="date" tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
              <YAxis tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8}}
                formatter={(v)=>[`${v}${chartMode==="kg"?" kg":chartMode==="reps"?" reps":" kg×r"}`, chartLabel]}/>
              <Area type="monotone" dataKey={chartKey} stroke={chartColor} strokeWidth={2}
                fill="url(#evog)" dot={{fill:chartColor,r:4}} activeDot={{r:6}} name={chartLabel}/>
            </AreaChart>
          </ResponsiveContainer>

          {/* Session-by-session table */}
          <div style={{ marginTop:16 }}>
            <div className="ctitle">Historial de sesiones — {selEx}</div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Fecha</th><th>Peso Máx.</th><th>Reps Máx.</th><th>Volumen</th><th>Series</th></tr></thead>
                <tbody>
                  {[...exHistory].reverse().map((d,i)=>{
                    const prev = [...exHistory].reverse()[i+1];
                    const kgUp = prev && d.maxKg > prev.maxKg;
                    const kgDown = prev && d.maxKg < prev.maxKg;
                    return (
                      <tr key={d.fullDate}>
                        <td style={{ fontWeight:600 }}>{d.date}</td>
                        <td>
                          <span style={{ fontFamily:T.mono, color:T.accent, fontWeight:700 }}>{d.maxKg} kg</span>
                          {prev && d.maxKg !== prev.maxKg && (
                            <span style={{ fontSize:10, marginLeft:5, color:kgUp?T.green:T.warn }}>
                              {kgUp?"↑":"↓"}{Math.abs(d.maxKg-prev.maxKg)}
                            </span>
                          )}
                        </td>
                        <td><span style={{ fontFamily:T.mono, color:T.gold }}>{d.maxReps}</span></td>
                        <td><span style={{ fontFamily:T.mono, color:T.green }}>{d.totalVol}</span></td>
                        <td><span className="badge badge-muted">{d.totalSeries} ser.</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign:"center", padding:30 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
          <div style={{ fontSize:14, color:T.muted }}>
            {exHistory.length === 1
              ? `Solo hay 1 sesión con ${selEx}. Necesitas al menos 2 para ver la evolución.`
              : `No hay sesiones registradas con ${selEx}.`}
          </div>
        </div>
      )}

      {/* Weekly volume trend */}
      {weeklyVol.length >= 2 && (
        <div className="card">
          <div className="ctitle">📊 Volumen Semanal Total (todos los ejercicios)</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={weeklyVol}>
              <defs>
                <linearGradient id="wvg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.green} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={T.green} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="semana" tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8}}
                formatter={(v,n)=>n==="vol"?[`${v.toLocaleString()} kg×r`,"Volumen"]:[v,n]}/>
              <Area type="monotone" dataKey="vol" stroke={T.green} strokeWidth={2} fill="url(#wvg)" dot={{fill:T.green,r:3}} name="vol"/>
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:10, marginTop:12 }}>
            {weeklyVol.slice(-1).map(w=>(
              <div key={w.semana} style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <span className="badge badge-green">📦 {w.vol.toLocaleString()} kg×reps esta semana</span>
                <span className="badge badge-accent">🏋 {w.sessions} sesiones</span>
                <span className="badge badge-muted">📋 {w.series} series</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 4 — COMPOSICIÓN
// ─────────────────────────────────────────────────────────────
function ComposicionTab({ client, coachMode }) {
  const [measures, setMeasures] = useState(SAMPLE_MEASURES);
  const [newEntry, setNewEntry] = useState({ date:"",peso:"",cintura:"",pecho:"",brazo:"",cuad:"",femoral:"" });
  const [addingEntry, setAddingEntry] = useState(false);

  const first=measures[0]; const last=measures[measures.length-1];
  const diffPeso=(first.peso-last.peso).toFixed(1);
  const diffCintura=((first.cintura-last.cintura)/first.cintura*100).toFixed(1);
  const diffBrazo=(last.brazo-first.brazo).toFixed(1);

  const saveEntry=()=>{
    const e={...newEntry}; Object.keys(e).forEach(k=>{ if(k!=="date") e[k]=parseFloat(e[k])||0; });
    setMeasures(m=>[...m,e]);
    setNewEntry({date:"",peso:"",cintura:"",pecho:"",brazo:"",cuad:"",femoral:""});
    setAddingEntry(false);
  };

  return (
    <div>
      <div className="stitle">Composición <span>Corporal</span></div>
      <div className="g3" style={{ marginBottom:18 }}>
        {[
          { label:"Pérdida de Peso", val:`−${diffPeso} kg`, sub:`${first.peso} → ${last.peso} kg`, color:T.accent },
          { label:"Reducción Cintura", val:`−${diffCintura}%`, sub:`${first.cintura} → ${last.cintura} cm`, color:T.green },
          { label:"Ganancia Brazo", val:`+${diffBrazo} cm`, sub:`${first.brazo} → ${last.brazo} cm`, color:T.gold },
        ].map(s=>(
          <div key={s.label} className="card" style={{ textAlign:"center" }}>
            <div className="ctitle">{s.label}</div>
            <div style={{ fontFamily:T.mono,fontSize:32,fontWeight:700,color:s.color }}>{s.val}</div>
            <div style={{ fontSize:12,color:T.muted,marginTop:4 }}>{s.sub}</div>
            <div style={{ marginTop:10 }}><span className="badge badge-green">Progresando ↑</span></div>
          </div>
        ))}
      </div>

      <div className="g2" style={{ marginBottom:18 }}>
        <div className="card">
          <div className="ctitle">📉 Evolución del Peso</div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={measures}>
              <defs>
                <linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.accent} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="date" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis domain={["auto","auto"]} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8}}/>
              <Area type="monotone" dataKey="peso" stroke={T.accent} strokeWidth={2} fill="url(#pg2)" dot={{fill:T.accent,r:3}} name="Peso (kg)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="ctitle">📐 Medidas Corporales (cm)</div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={measures}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="date" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8}}/>
              <Legend wrapperStyle={{fontSize:10}}/>
              {MEASURE_FIELDS.map(f=><Line key={f.key} type="monotone" dataKey={f.key} stroke={f.color} strokeWidth={2} dot={{r:2}} name={f.label}/>)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div className="ctitle" style={{ margin:0 }}>Historial de Medidas</div>
          {coachMode && <button className="btn btn-outline btn-sm" onClick={()=>setAddingEntry(!addingEntry)}>+ Añadir Medición</button>}
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr>
              <th>Fecha</th><th>Peso</th>
              {MEASURE_FIELDS.map(f=><th key={f.key}>{f.icon} {f.label}</th>)}
            </tr></thead>
            <tbody>
              {measures.map((m,i)=>(
                <tr key={i}>
                  <td style={{ fontWeight:600 }}>{m.date}</td>
                  <td><span style={{ fontFamily:T.mono,color:T.accent }}>{m.peso}</span> kg</td>
                  {MEASURE_FIELDS.map(f=>{
                    const prev=i>0?measures[i-1][f.key]:null;
                    const delta=prev!==null?(m[f.key]-prev).toFixed(1):null;
                    const up=delta>0;
                    const good=(f.key==="cintura"||f.key==="femoral")?!up:up;
                    return (
                      <td key={f.key}>
                        <span style={{ fontFamily:T.mono,color:f.color }}>{m[f.key]}</span>
                        {delta!==null&&parseFloat(delta)!==0&&(
                          <span style={{ fontSize:10,marginLeft:4,color:good?T.green:T.warn }}>{up?"↑":"↓"}{Math.abs(delta)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {addingEntry && coachMode && (
          <div style={{ marginTop:16,padding:16,background:T.surface,borderRadius:12 }}>
            <div className="ctitle">Nueva Medición</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10 }}>
              {[["Fecha","date","text"],["Peso (kg)","peso","number"],...MEASURE_FIELDS.map(f=>[f.label+" (cm)",f.key,"number"])].map(([l,k,t])=>(
                <div key={k}><FieldLabel>{l}</FieldLabel>
                  <input type={t} placeholder={l} value={newEntry[k]} onChange={e=>setNewEntry(n=>({...n,[k]:e.target.value}))}/>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:10,marginTop:12 }}>
              <button className="btn btn-accent" onClick={saveEntry}>Guardar</button>
              <button className="btn btn-outline" onClick={()=>setAddingEntry(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <CoachNote type="gold">
          Tu cintura ha bajado un {diffCintura}% mientras el brazo ha ganado {diffBrazo}cm. Recomposición corporal real, no solo el número en la báscula.
        </CoachNote>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 5 — DIARIO DE SENSACIONES (nuevo: puntuaciones + notas)
// ─────────────────────────────────────────────────────────────
const SCORE_FIELDS = [
  { key:"entreno", label:"Entreno", emoji:"🏋", color:T.accent },
  { key:"dieta",   label:"Dieta",   emoji:"🍽", color:"#4fc3f7" },
  { key:"energia", label:"Energía", emoji:"⚡", color:T.gold },
  { key:"sueno",   label:"Sueño",   emoji:"😴", color:T.green },
];

function ScoreColor(val) {
  if (!val) return T.muted;
  if (val >= 8) return T.green;
  if (val >= 6) return T.gold;
  return T.warn;
}

function DiarioSensacionesTab({ client, coachMode }) {
  const todayKey = new Date().toISOString().slice(0,10);
  const now = new Date();
  const [journal, setJournal] = useState(makeSampleJournal);
  const [selDate, setSelDate] = useState(todayKey);
  const [innerTab, setInnerTab] = useState("entrada"); // entrada | historial

  // Today's entry form
  const todayEntry = journal[todayKey] || null;
  const [scores, setScores] = useState({ entreno:7, dieta:7, energia:7, sueno:7 });
  const [obs, setObs] = useState("");
  const [saved, setSaved] = useState(false);

  const saveEntry = () => {
    setJournal(j=>({ ...j, [selDate]: { ...scores, obs } }));
    setSaved(true); setTimeout(()=>setSaved(false), 2000);
  };

  const loadDate = (key) => {
    setSelDate(key);
    const entry = journal[key];
    if (entry) {
      setScores({ entreno:entry.entreno||5, dieta:entry.dieta||5, energia:entry.energia||5, sueno:entry.sueno||5 });
      setObs(entry.obs||"");
    } else {
      setScores({ entreno:7, dieta:7, energia:7, sueno:7 });
      setObs("");
    }
  };

  const isToday = selDate === todayKey;

  const getCalStyle = (key) => {
    if (journal[key]) return "has-journal";
    return "";
  };

  // Chart data: last 14 days average score
  const chartData = useMemo(() => {
    const days = [];
    for (let i=13;i>=0;i--) {
      const d=new Date(); d.setDate(d.getDate()-i);
      const key=d.toISOString().slice(0,10);
      const entry=journal[key];
      days.push({ date:key.slice(5), ...( entry ? { entreno:entry.entreno, dieta:entry.dieta, energia:entry.energia, sueno:entry.sueno } : {}) });
    }
    return days;
  }, [journal]);

  const selEntry = journal[selDate];

  return (
    <div>
      <div className="stitle">Diario de <span>Sensaciones</span></div>

      <div className="tab-inner">
        {[["entrada","📝 Registro"],["historial","📅 Historial"]].map(([k,l])=>(
          <button key={k} className={`tab-inner-btn ${innerTab===k?"active":""}`} onClick={()=>setInnerTab(k)}>{l}</button>
        ))}
      </div>

      {innerTab==="entrada" && (
        <div className="g2">
          {/* LEFT — score sliders */}
          <div className="card">
            <div className="ctitle">
              {isToday ? "📝 Cómo te sientes hoy" : `📝 Editar — ${selDate}`}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              {SCORE_FIELDS.map(f=>(
                <div key={f.key}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{f.emoji} {f.label}</span>
                    <span style={{ fontFamily:T.mono, fontSize:18, fontWeight:700, color:ScoreColor(scores[f.key]) }}>
                      {scores[f.key]}/10
                    </span>
                  </div>
                  {/* Score buttons 1-10 */}
                  <div style={{ display:"flex", gap:4 }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                      <button key={n}
                        onClick={()=>setScores(s=>({...s,[f.key]:n}))}
                        style={{
                          flex:1, padding:"8px 0", border:`1px solid ${scores[f.key]===n?f.color:T.border}`,
                          borderRadius:8, background: scores[f.key]===n ? f.color+"22" : "transparent",
                          color: scores[f.key]===n ? f.color : T.muted,
                          fontFamily:T.mono, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all .15s"
                        }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <FieldLabel>📓 Observaciones (opcional)</FieldLabel>
                <textarea
                  placeholder="Cuéntame cómo ha ido el día, qué te ha costado, qué te ha salido bien..."
                  value={obs}
                  onChange={e=>setObs(e.target.value)}
                  style={{ marginBottom:0 }}
                />
              </div>

              <button className="btn btn-accent btn-full" onClick={saveEntry}>
                {saved ? "✓ Guardado" : isToday ? "💾 Guardar Sensaciones" : "💾 Actualizar Registro"}
              </button>
            </div>

            {!coachMode && (
              <CoachNote type="default" label="💬 ¿Para qué sirve esto?">
                Estos registros me ayudan a ver cómo te estás sintiendo semana a semana. Si veo que el entreno baja mucho o la dieta flojea, te aviso y ajustamos.
              </CoachNote>
            )}
          </div>

          {/* RIGHT — today's summary or selected day */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {selEntry && (
              <div className="card">
                <div className="ctitle">📊 {isToday ? "Tu registro de hoy" : `Registro — ${selDate}`}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                  {SCORE_FIELDS.map(f=>(
                    <div key={f.key} style={{ textAlign:"center", background:T.surface, borderRadius:12, padding:14, border:`1px solid ${T.border}` }}>
                      <div style={{ fontSize:18, marginBottom:4 }}>{f.emoji}</div>
                      <div style={{ fontFamily:T.mono, fontSize:28, fontWeight:700, color:ScoreColor(selEntry[f.key]) }}>
                        {selEntry[f.key]}
                      </div>
                      <div style={{ fontSize:10, color:T.muted, fontWeight:700, letterSpacing:1, fontFamily:T.font }}>
                        {f.label.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
                {selEntry.obs && (
                  <div style={{ background:T.surface, borderRadius:10, padding:12, fontSize:13, lineHeight:1.6, color:T.text, border:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:10, color:T.muted, fontWeight:700, letterSpacing:1, marginBottom:6, fontFamily:T.font }}>OBSERVACIONES</div>
                    {selEntry.obs}
                  </div>
                )}
                {/* Average score */}
                {(() => {
                  const avg = ((selEntry.entreno+selEntry.dieta+selEntry.energia+selEntry.sueno)/4).toFixed(1);
                  return (
                    <div style={{ marginTop:12, textAlign:"center" }}>
                      <div style={{ fontSize:11, color:T.muted, marginBottom:4 }}>MEDIA DEL DÍA</div>
                      <div style={{ fontFamily:T.mono, fontSize:32, fontWeight:700, color:ScoreColor(+avg) }}>{avg}/10</div>
                    </div>
                  );
                })()}
              </div>
            )}

            {!selEntry && (
              <div className="card" style={{ textAlign:"center", padding:30 }}>
                <div style={{ fontSize:32, marginBottom:12 }}>📝</div>
                <div style={{ fontSize:14, color:T.muted }}>
                  {isToday ? "Aún no has registrado las sensaciones de hoy." : "No hay registro para este día."}
                </div>
              </div>
            )}

            {coachMode && selEntry && (
              <div className="card">
                <div className="ctitle">🔧 Nota del Coach</div>
                {(() => {
                  const avg = (selEntry.entreno+selEntry.dieta+selEntry.energia+selEntry.sueno)/4;
                  if (avg >= 8) return <CoachNote type="accent">Semana de 10. Así se hacen las cosas. Sigue en esta línea.</CoachNote>;
                  if (avg >= 6) return <CoachNote type="default">Buena semana en general. Hay margen de mejora en algún área, sigue el plan.</CoachNote>;
                  return <CoachNote type="warn">Ha sido una semana dura. Revisa qué está fallando y ajustamos si hace falta.</CoachNote>;
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {innerTab==="historial" && (
        <div className="g2">
          <div className="card">
            <div className="ctitle">📅 {now.toLocaleString("es",{month:"long",year:"numeric"})}</div>
            <MiniCalendar
              year={now.getFullYear()} month={now.getMonth()}
              markedDates={journal} selectedDate={selDate}
              onSelect={k=>{ loadDate(k); setInnerTab("entrada"); }}
              getStyle={getCalStyle}
            />
            <div style={{ marginTop:10,display:"flex",gap:14,fontSize:11,color:T.muted }}>
              <span><span style={{ display:"inline-block",width:8,height:8,borderRadius:"50%",background:T.gold,marginRight:5 }}/>Con registro</span>
              <span><span style={{ display:"inline-block",width:8,height:8,borderRadius:2,border:`1px solid ${T.gold}`,marginRight:5 }}/>Hoy</span>
            </div>

            <div style={{ marginTop:20 }}>
              <div className="ctitle">📈 Evolución — Últimas 2 Semanas</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                  <XAxis dataKey="date" tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false} interval={2}/>
                  <YAxis domain={[0,10]} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8}}/>
                  <Legend wrapperStyle={{fontSize:10}}/>
                  {SCORE_FIELDS.map(f=>(
                    <Line key={f.key} type="monotone" dataKey={f.key} stroke={f.color} strokeWidth={2}
                      dot={{r:3,fill:f.color}} name={f.label} connectNulls/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div className="ctitle" style={{ margin:0, marginBottom:8 }}>Registros Recientes</div>
            {Object.entries(journal).sort(([a],[b])=>b.localeCompare(a)).slice(0,8).map(([date,entry])=>{
              const avg = ((entry.entreno+entry.dieta+entry.energia+entry.sueno)/4).toFixed(1);
              return (
                <div key={date} className="journal-card" style={{ cursor:"pointer" }}
                  onClick={()=>{ loadDate(date); setInnerTab("entrada"); }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{date}</div>
                    <div style={{ fontFamily:T.mono, fontSize:20, fontWeight:700, color:ScoreColor(+avg) }}>{avg}/10</div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {SCORE_FIELDS.map(f=>(
                      <span key={f.key} style={{ fontSize:11, color:T.muted }}>
                        {f.emoji} <span style={{ color:ScoreColor(entry[f.key]), fontWeight:700 }}>{entry[f.key]}</span>
                      </span>
                    ))}
                  </div>
                  {entry.obs && (
                    <div style={{ fontSize:12, color:T.muted, marginTop:6, fontStyle:"italic",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      "{entry.obs}"
                    </div>
                  )}
                </div>
              );
            })}
            {Object.keys(journal).length === 0 && (
              <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:30 }}>
                No hay registros todavía. Empieza anotando cómo te sientes hoy.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CLIENT MODAL
// ─────────────────────────────────────────────────────────────
function ClientModal({ client, onSave, onClose }) {
  const [form, setForm] = useState({ ...client });
  return (
    <Modal title="👤 Datos del Cliente" onClose={onClose}>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {[["Nombre completo","nombre","text"],["Peso actual (kg)","peso","number"],["Altura (cm)","altura","number"],["Edad","edad","number"],["Objetivo principal","objetivo","text"]].map(([l,k,t])=>(
          <div key={k}><FieldLabel>{l}</FieldLabel>
            <input type={t} value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>
          </div>
        ))}
        <div style={{ display:"flex",gap:10,marginTop:8 }}>
          <button className="btn btn-accent" style={{ flex:1 }} onClick={()=>{ onSave(form); onClose(); }}>Guardar</button>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB — INFORMES (Coach only)
// ─────────────────────────────────────────────────────────────
function InformesTab({ client }) {
  const bioHistory   = useMemo(makeBioHistory,   []);
  const trainHistory = useMemo(makeTrainHistory, []);
  const journalData  = useMemo(makeSampleJournal,[]);
  const measures     = SAMPLE_MEASURES;

  // Build list of Monday-based weeks with data
  const weeks = useMemo(() => {
    const today = new Date();
    const result = [];
    for (let w = 0; w < 4; w++) {
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1 - w * 7);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      const label = w === 0 ? "Esta semana"
        : w === 1 ? "Semana pasada"
        : `${monday.getDate()}/${monday.getMonth()+1} – ${sunday.getDate()}/${sunday.getMonth()+1}`;
      const keys = [];
      for (let d = 0; d < 7; d++) {
        const dd = new Date(monday); dd.setDate(monday.getDate() + d);
        keys.push(dd.toISOString().slice(0,10));
      }
      result.push({ label, keys, monday, sunday });
    }
    return result;
  }, []);

  const [selWeek, setSelWeek] = useState(1); // default: last week
  const week = weeks[selWeek];

  // ── COMPUTE STATS FOR SELECTED WEEK ──────────────────────────
  const stats = useMemo(() => {
    const bioEntries = week.keys.map(k => bioHistory[k]).filter(Boolean);
    const trainSessions = week.keys.map(k => trainHistory[k]).filter(Boolean);
    const journalEntries = week.keys.map(k => journalData[k]).filter(Boolean);

    // Weight
    const weights = bioEntries.map(e => e.peso).filter(Boolean);
    const avgPeso = weights.length ? +(weights.reduce((a,b)=>a+b,0)/weights.length).toFixed(1) : null;
    const minPeso = weights.length ? Math.min(...weights) : null;
    const maxPeso = weights.length ? Math.max(...weights) : null;

    // Sleep
    const sleeps = bioEntries.map(e => e.sueno).filter(Boolean);
    const avgSueno = sleeps.length ? +(sleeps.reduce((a,b)=>a+b,0)/sleeps.length).toFixed(1) : null;
    const badSleepDays = sleeps.filter(s=>s<=5).length;

    // Training
    const trainDays = trainSessions.length;
    const plannedDays = week.keys.filter(k => INIT_WEEK_PLAN[new Date(k).getDay()]?.type==="train").length;
    const adherenceTrain = plannedDays ? Math.round((trainDays/plannedDays)*100) : 0;
    const totalSeries = trainSessions.reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+e.sets.length,0),0);
    const totalEjercicios = trainSessions.reduce((a,s)=>a+s.exercises.length,0);
    const volumenTotal = trainSessions.reduce((a,s)=>
      a+s.exercises.reduce((b,e)=>b+e.sets.reduce((c,set)=>c+(+set.kg||0)*(+set.reps||0),0),0),0);

    // PRs
    const prs = [];
    trainSessions.forEach(s => s.exercises.forEach(ex => {
      ex.sets.forEach(set => { if (+set.kg > 95) prs.push(ex.name); }); // demo threshold
    }));

    // Journal averages
    const avgEntreno = journalEntries.length ? +(journalEntries.reduce((a,e)=>a+(e.entreno||0),0)/journalEntries.length).toFixed(1) : null;
    const avgDieta   = journalEntries.length ? +(journalEntries.reduce((a,e)=>a+(e.dieta||0),0)/journalEntries.length).toFixed(1)   : null;
    const avgEnergia = journalEntries.length ? +(journalEntries.reduce((a,e)=>a+(e.energia||0),0)/journalEntries.length).toFixed(1)  : null;

    // Body comp delta (first vs last measure in range, or global)
    const firstM = measures[0]; const lastM = measures[measures.length-1];
    const deltaPeso    = firstM && lastM ? +(lastM.peso - firstM.peso).toFixed(1) : null;
    const deltaCintura = firstM && lastM ? +(lastM.cintura - firstM.cintura).toFixed(1) : null;
    const deltaBrazo   = firstM && lastM ? +(lastM.brazo - firstM.brazo).toFixed(1) : null;

    // Overall score (0-10)
    const scoreComponents = [
      avgSueno ? (avgSueno / 10) * 10 : null,
      adherenceTrain,
      avgEntreno,
      avgDieta,
      avgEnergia,
    ].filter(Boolean);
    const overallScore = scoreComponents.length
      ? +(scoreComponents.reduce((a,b)=>a+b,0)/scoreComponents.length).toFixed(1) : null;

    return {
      bioEntries, trainSessions, journalEntries,
      avgPeso, minPeso, maxPeso,
      avgSueno, badSleepDays,
      trainDays, plannedDays, adherenceTrain,
      totalSeries, totalEjercicios, volumenTotal: Math.round(volumenTotal),
      prs: [...new Set(prs)],
      avgEntreno, avgDieta, avgEnergia,
      deltaPeso, deltaCintura, deltaBrazo,
      overallScore,
      checkIns: bioEntries.length,
    };
  }, [selWeek, bioHistory, trainHistory, journalData]);

  // Radar chart data
  const radarData = [
    { subject:"Descanso", val: stats.avgSueno || 0, fullMark:10 },
    { subject:"Entreno",  val: stats.avgEntreno || 0, fullMark:10 },
    { subject:"Dieta",    val: stats.avgDieta || 0, fullMark:10 },
    { subject:"Energía",  val: stats.avgEnergia || 0, fullMark:10 },
    { subject:"Adherencia", val: (stats.adherenceTrain/10) || 0, fullMark:10 },
  ];

  // Weight chart for selected week
  const weightChart = week.keys.map(k => ({
    date: k.slice(5),
    peso: bioHistory[k]?.peso || null,
  })).filter(d => d.peso);

  const scoreColor = (v) => v >= 8 ? T.green : v >= 6 ? T.gold : T.warn;

  const printReport = () => window.print();

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div className="stitle" style={{ margin:0 }}>Informe <span>Semanal</span></div>
        <button className="btn btn-accent no-print" onClick={printReport}>
          🖨️ Exportar PDF
        </button>
      </div>

      {/* Week selector */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }} className="no-print">
        {weeks.map((w,i) => (
          <button key={i} className={`report-week-btn ${selWeek===i?"active":""}`} onClick={()=>setSelWeek(i)}>
            {w.label}
          </button>
        ))}
      </div>

      {/* Report header card */}
      <div className="report-header">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, marginBottom:16 }}>
          <div>
            <div style={{ fontFamily:T.font, fontSize:24, fontWeight:900, fontStyle:"italic" }}>
              {client?.nombre} — {weeks[selWeek].label}
            </div>
            <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>
              {weeks[selWeek].monday.toLocaleDateString("es")} → {weeks[selWeek].sunday.toLocaleDateString("es")}
            </div>
          </div>
          {stats.overallScore && (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:10, color:T.muted, fontWeight:700, letterSpacing:2, marginBottom:6 }}>PUNTUACIÓN GLOBAL</div>
              <div style={{
                width:72, height:72, borderRadius:"50%",
                border:`4px solid ${scoreColor(stats.overallScore)}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:`${scoreColor(stats.overallScore)}18`,
                margin:"0 auto"
              }}>
                <span style={{ fontFamily:T.mono, fontSize:24, fontWeight:800, color:scoreColor(stats.overallScore) }}>
                  {stats.overallScore}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* KPI row */}
        <div className="g4">
          {[
            { label:"Check-ins", val:stats.checkIns, sub:"de 7 días", color:T.text },
            { label:"Peso Medio", val:stats.avgPeso ? `${stats.avgPeso}kg` : "—", sub:`${stats.minPeso}–${stats.maxPeso}kg`, color:T.accent },
            { label:"Sueño Medio", val:stats.avgSueno ? `${stats.avgSueno}/10` : "—", sub:`${stats.badSleepDays} días bajos`, color:stats.avgSueno>=7?T.green:T.warn },
            { label:"Sesiones", val:`${stats.trainDays}/${stats.plannedDays}`, sub:`${stats.adherenceTrain}% adherencia`, color:stats.adherenceTrain>=80?T.green:T.gold },
          ].map(k => (
            <div key={k.label} className="report-kpi">
              <div className="report-kpi-val" style={{ color:k.color }}>{k.val}</div>
              <div className="report-kpi-label">{k.label}</div>
              <div className="report-kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="g2" style={{ marginBottom:20 }}>
        {/* Radar */}
        <div className="card">
          <div className="report-section-title">📡 Radar de Rendimiento</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={T.border}/>
              <PolarAngleAxis dataKey="subject" tick={{ fill:T.muted, fontSize:11, fontWeight:700 }}/>
              <Radar name="Andrei" dataKey="val" stroke={T.accent} fill={T.accent} fillOpacity={0.25} strokeWidth={2}/>
              <Tooltip contentStyle={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8 }}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Weight trend */}
        <div className="card">
          <div className="report-section-title">⚖ Peso — {weeks[selWeek].label}</div>
          {weightChart.length > 1 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={weightChart}>
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.accent} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                  <XAxis dataKey="date" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis domain={["auto","auto"]} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8}}/>
                  <Area type="monotone" dataKey="peso" stroke={T.accent} strokeWidth={2} fill="url(#rg)" dot={{fill:T.accent,r:3}} name="Peso (kg)"/>
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display:"flex", gap:12, marginTop:10, flexWrap:"wrap" }}>
                {[
                  { l:"Inicio semana", v:`${weightChart[0]?.peso}kg` },
                  { l:"Fin semana", v:`${weightChart[weightChart.length-1]?.peso}kg` },
                  { l:"Variación", v:`${(weightChart[weightChart.length-1]?.peso - weightChart[0]?.peso).toFixed(1)}kg` },
                ].map(s => (
                  <div key={s.l} style={{ background:T.surface, borderRadius:8, padding:"8px 14px", flex:1, textAlign:"center" }}>
                    <div style={{ fontSize:9, color:T.muted, fontWeight:700, letterSpacing:1 }}>{s.l.toUpperCase()}</div>
                    <div style={{ fontFamily:T.mono, fontSize:16, fontWeight:700, color:T.accent, marginTop:2 }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color:T.muted, fontSize:13, padding:"20px 0", textAlign:"center" }}>Sin datos de peso esta semana.</div>
          )}
        </div>
      </div>

      {/* Training detail */}
      <div className="card report-section" style={{ marginBottom:20 }}>
        <div className="report-section-title">🏋 Resumen de Entrenamiento</div>
        <div className="g3" style={{ marginBottom:16 }}>
          {[
            { l:"Series totales", v:stats.totalSeries, color:T.accent },
            { l:"Ejercicios distintos", v:stats.totalEjercicios, color:T.gold },
            { l:"Volumen total (kg×reps)", v:`${stats.volumenTotal.toLocaleString()}`, color:T.green },
          ].map(k => (
            <div key={k.l} className="report-kpi">
              <div className="report-kpi-val" style={{ color:k.color }}>{k.v}</div>
              <div className="report-kpi-label">{k.l}</div>
            </div>
          ))}
        </div>

        {/* Sessions with exercise breakdown */}
        {stats.trainSessions.length > 0 ? stats.trainSessions.map((s,i) => {
          const sessionDate = week.keys.find(k=>trainHistory[k]===s);
          return (
            <div key={i} style={{ background:T.surface, borderRadius:12, padding:"12px 14px", marginBottom:10, border:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div>
                  <span style={{ fontWeight:700, fontFamily:T.font, fontSize:15 }}>{sessionDate?.slice(5) || `Sesión ${i+1}`}</span>
                  <span style={{ color:T.accent, fontFamily:T.font, fontWeight:800, fontSize:15, marginLeft:8 }}>{s.muscle}</span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <span className="badge badge-accent">{s.exercises.length} ejerc.</span>
                  <span className="badge badge-muted">{s.exercises.reduce((a,e)=>a+e.sets.length,0)} series</span>
                </div>
              </div>
              {/* Per-exercise summary */}
              {s.exercises.map((ex,j)=>{
                const validSets = ex.sets.filter(s=>+s.kg>0&&+s.reps>0);
                if (!validSets.length) return null;
                const maxKg = Math.max(...validSets.map(s=>+s.kg));
                const totalVol = validSets.reduce((a,s)=>a+(+s.kg)*(+s.reps),0);
                return (
                  <div key={j} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"6px 0", borderTop:`1px solid ${T.border}33`, fontSize:12 }}>
                    <span style={{ color:T.text, fontWeight:600 }}>{ex.name}</span>
                    <div style={{ display:"flex", gap:10 }}>
                      <span style={{ color:T.accent, fontFamily:T.mono }}>{maxKg}kg máx.</span>
                      <span style={{ color:T.muted }}>{validSets.length} series</span>
                      <span style={{ color:T.green, fontFamily:T.mono }}>{totalVol} vol.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }) : (
          <div style={{ color:T.muted, fontSize:13, padding:"12px 0" }}>Sin sesiones registradas esta semana.</div>
        )}

        {stats.prs.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:11, color:T.gold, fontWeight:700, marginBottom:8 }}>🏆 POSIBLES RÉCORDS ESTA SEMANA</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {stats.prs.map(pr => <span key={pr} className="badge badge-gold">{pr}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* Sensaciones */}
      <div className="card report-section" style={{ marginBottom:20 }}>
        <div className="report-section-title">💬 Sensaciones del Cliente</div>
        {stats.journalEntries.length > 0 ? (
          <>
            <div className="g4" style={{ marginBottom:16 }}>
              {[
                { l:"Entreno", v:stats.avgEntreno, color:T.accent },
                { l:"Dieta",   v:stats.avgDieta,   color:"#4fc3f7" },
                { l:"Energía", v:stats.avgEnergia, color:T.gold },
                { l:"Sueño",   v:stats.avgSueno,   color:T.green },
              ].map(k => (
                <div key={k.l} className="report-kpi">
                  <div className="report-kpi-val" style={{ color:k.v>=7?T.green:k.v>=5?T.gold:T.warn }}>
                    {k.v || "—"}<span style={{ fontSize:14, color:T.muted }}>/10</span>
                  </div>
                  <div className="report-kpi-label">{k.l}</div>
                </div>
              ))}
            </div>
            {stats.journalEntries.slice(0,3).map((e,i) => (
              <div key={i} style={{ background:T.surface, borderRadius:10, padding:"12px 14px", marginBottom:8, fontSize:13, lineHeight:1.6, color:T.muted, fontStyle:"italic" }}>
                "{e.obs}"
              </div>
            ))}
          </>
        ) : (
          <div style={{ color:T.muted, fontSize:13, padding:"12px 0" }}>Sin entradas en el diario esta semana.</div>
        )}
      </div>

      {/* Body comp */}
      <div className="card report-section" style={{ marginBottom:20 }}>
        <div className="report-section-title">📐 Composición Corporal — Progreso Global</div>
        <div className="g3">
          {[
            { l:"Variación Peso", v:stats.deltaPeso !== null ? `${stats.deltaPeso > 0 ? "+" : ""}${stats.deltaPeso}kg` : "—", good:stats.deltaPeso < 0, color: stats.deltaPeso < 0 ? T.green : T.warn },
            { l:"Variación Cintura", v:stats.deltaCintura !== null ? `${stats.deltaCintura > 0 ? "+" : ""}${stats.deltaCintura}cm` : "—", color: stats.deltaCintura < 0 ? T.green : T.warn },
            { l:"Ganancia Brazo", v:stats.deltaBrazo !== null ? `+${stats.deltaBrazo}cm` : "—", color: T.gold },
          ].map(k => (
            <div key={k.l} className="report-kpi">
              <div className="report-kpi-val" style={{ color:k.color }}>{k.v}</div>
              <div className="report-kpi-label">{k.l}</div>
              <div className="report-kpi-sub">desde el inicio</div>
            </div>
          ))}
        </div>
      </div>

      {/* Coach notes */}
      <div className="card">
        <div className="report-section-title">📝 Valoración del Coach</div>
        <div style={{ background:T.accentLo, border:`1px solid ${T.accentMd}`, borderRadius:12, padding:16, fontSize:14, lineHeight:1.8, color:T.text }}>
          {stats.overallScore >= 8
            ? `¡Semana sobresaliente para ${client?.nombre}! La adherencia al entrenamiento ha sido excelente (${stats.adherenceTrain}%) y las sensaciones generales son muy positivas. El sueño medio de ${stats.avgSueno}/10 ha apoyado bien la recuperación. Seguimos en la dirección correcta.`
            : stats.overallScore >= 6
            ? `Semana correcta para ${client?.nombre}. Hay margen de mejora en ${stats.avgSueno < 7 ? "el descanso" : "la adherencia nutricional"}. El entrenamiento ha sido consistente con ${stats.trainDays} sesiones completadas. Esta semana intentamos subir un escalón.`
            : `Semana con dificultades para ${client?.nombre}. El descanso bajo (${stats.avgSueno}/10) y el estrés han podido afectar al rendimiento. Vamos a revisar la carga de esta semana y ajustar para que la próxima sea más sólida. Sin agobios, el proceso es largo.`
          }
        </div>
        {stats.trainDays < stats.plannedDays && (
          <CoachNote type="warn" label="⚠ Sesiones perdidas">
            Ha habido {stats.plannedDays - stats.trainDays} sesión(es) sin registrar esta semana. Revisar si fue por lesión, trabajo u otro motivo para ajustar el plan.
          </CoachNote>
        )}
        {stats.prs.length > 0 && (
          <CoachNote type="gold" label="🏆 Récords conseguidos">
            Esta semana se han registrado marcas personales en: {stats.prs.join(", ")}. Comunicárselo al cliente para reforzar la motivación.
          </CoachNote>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COACH — ATHLETE SELECTOR PANEL
// ─────────────────────────────────────────────────────────────
function AtletaSelector({ atletas, selectedId, onSelect }) {
  return (
    <div className="card" style={{ marginBottom:20 }}>
      <div className="ctitle">👥 Seleccionar Atleta</div>
      {atletas.length === 0 ? (
        <div style={{ color:T.muted, fontSize:13 }}>No hay atletas registrados aún.</div>
      ) : (
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {atletas.map(a => (
            <button key={a.user_id || a.id}
              className={`btn btn-sm ${selectedId === (a.user_id || a.id) ? "btn-accent" : "btn-outline"}`}
              onClick={() => onSelect(a)}>
              👤 {a.nombre || a.email}
              {a.peso && <span style={{ fontSize:10, color:selectedId===(a.user_id||a.id)?T.text:T.muted, marginLeft:6 }}>{a.peso}kg</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP ROOT — SUPABASE INTEGRATED
// ─────────────────────────────────────────────────────────────
const TABS_CLIENT = [
  { key:"bio",      label:"📅 Diario",      icon:"📅", short:"Diario" },
  { key:"nut",      label:"🍽 Nutrición",   icon:"🍽", short:"Nutri" },
  { key:"train",    label:"🏋 Entreno",     icon:"🏋", short:"Entreno" },
  { key:"journal",  label:"💬 Sensaciones", icon:"💬", short:"Notas" },
  { key:"comp",     label:"📊 Composición", icon:"📊", short:"Progreso" },
];

const TABS_COACH = [
  ...TABS_CLIENT,
  { key:"informes", label:"📋 Informes",    icon:"📋", short:"Informe" },
];

export default function App() {
  // ── Auth state ──────────────────────────────────────────────
  const [session, setSession]       = useState(null);   // { access_token, user_id, perfil, atletas }
  const [loadingAuth, setLoadingAuth] = useState(true); // checking stored session on boot

  // ── App state ──────────────────────────────────────────────
  const [tab, setTab]               = useState("bio");
  const [showModal, setShowModal]   = useState(false);
  const [weekPlan, setWeekPlan]     = useState(INIT_WEEK_PLAN);
  const [selectedAtleta, setSelectedAtleta] = useState(null); // coach: which athlete is selected

  // ── Restore session on mount ────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      const stored = sb.loadSession();
      if (!stored?.access_token) { setLoadingAuth(false); return; }
      try {
        // Validate token is still valid
        const user = await sb.getUser(stored.access_token);
        if (user.id) {
          const perfil = await sb.getPerfil(user.id, stored.access_token);
          if (perfil) {
            let atletas = [];
            if (perfil.rol === "coach") atletas = await sb.getAtletas(stored.access_token);
            setSession({ access_token: stored.access_token, user_id: user.id, perfil, atletas });
          }
        }
      } catch(_) { sb.clearSession(); }
      setLoadingAuth(false);
    };
    restore();
  }, []);

  // ── Derived values ──────────────────────────────────────────
  const coachMode = session?.perfil?.rol === "coach";
  const TABS = coachMode ? TABS_COACH : TABS_CLIENT;
  const activeTab = (!coachMode && tab === "informes") ? "bio" : tab;

  // Client object: coach sees selected athlete's data, client sees own
  const client = useMemo(() => {
    if (!session) return null;
    if (coachMode) {
      // Coach viewing a selected athlete
      if (selectedAtleta) {
        return {
          nombre:  selectedAtleta.nombre  || selectedAtleta.email || "Atleta",
          peso:    selectedAtleta.peso    || "80",
          altura:  selectedAtleta.altura  || "175",
          edad:    selectedAtleta.edad    || "25",
          user_id: selectedAtleta.user_id || selectedAtleta.id,
        };
      }
      // Coach's own profile until an athlete is selected
      return {
        nombre: session.perfil.nombre || "Coach",
        peso:   session.perfil.peso   || "80",
        altura: session.perfil.altura || "175",
        edad:   session.perfil.edad   || "30",
      };
    }
    // Athlete: own profile
    return {
      nombre: session.perfil.nombre || "Atleta",
      peso:   session.perfil.peso   || "80",
      altura: session.perfil.altura || "175",
      edad:   session.perfil.edad   || "25",
    };
  }, [session, selectedAtleta, coachMode]);

  // ── Auth handlers ───────────────────────────────────────────
  const handleLogin = useCallback((sessionData) => {
    sb.saveSession({ access_token: sessionData.access_token, user_id: sessionData.user_id });
    setSession(sessionData);
    // Auto-select first athlete if coach
    if (sessionData.perfil?.rol === "coach" && sessionData.atletas?.length > 0) {
      setSelectedAtleta(sessionData.atletas[0]);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    if (session?.access_token) {
      try { await sb.signOut(session.access_token); } catch(_){}
    }
    sb.clearSession();
    setSession(null);
    setSelectedAtleta(null);
    setTab("bio");
  }, [session]);

  const handleSaveClient = useCallback(async (updated) => {
    if (!session?.access_token) return;
    // Update in Supabase
    await sb.upsertPerfil({
      user_id: session.user_id,
      nombre:  updated.nombre,
      peso:    updated.peso,
      altura:  updated.altura,
      edad:    updated.edad,
      rol:     session.perfil.rol,
    }, session.access_token);
    // Update local session
    setSession(s => ({ ...s, perfil: { ...s.perfil, ...updated } }));
  }, [session]);

  // ── Loading state ───────────────────────────────────────────
  if (loadingAuth) {
    return (
      <>
        <style>{CSS}</style>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
          minHeight:"100vh", flexDirection:"column", gap:16 }}>
          <div style={{ fontFamily:T.font, fontSize:28, fontWeight:900, fontStyle:"italic", color:T.accent }}>
            Javi Performance
          </div>
          <div style={{ color:T.muted, fontSize:13 }}>Cargando sesión...</div>
        </div>
      </>
    );
  }

  // ── Login ───────────────────────────────────────────────────
  if (!session) {
    return (
      <>
        <style>{CSS}</style>
        <LoginScreen onLogin={handleLogin}/>
      </>
    );
  }

  // ── Onboarding: athlete with no profile data yet ─────────────
  if (!coachMode && (!session.perfil.nombre || !session.perfil.peso)) {
    return (
      <>
        <style>{CSS}</style>
        <Onboarding
          prefill={session.perfil}
          onComplete={async (data) => {
            await sb.upsertPerfil({ user_id: session.user_id, ...data, rol:"atleta" }, session.access_token);
            setSession(s => ({ ...s, perfil: { ...s.perfil, ...data } }));
          }}
        />
      </>
    );
  }

  // ── Main App ────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div>
        <nav className="nav">
          <div>
            <div className="nav-beast">Javi Performance</div>
            <div className="nav-sub">Hub</div>
          </div>
          <div className="nav-client" onClick={()=>setShowModal(true)}>
            {coachMode ? "🔧" : "👤"} {client?.nombre?.split(" ")[0]}
          </div>
          <div className="nav-tabs">
            {TABS.map(t=>(
              <button key={t.key} className={`nav-tab ${activeTab===t.key?"active":""}`} onClick={()=>setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          {coachMode && (
            <div style={{ fontSize:11, color:T.accent, fontWeight:700, whiteSpace:"nowrap",
              padding:"4px 10px", background:T.accentLo, borderRadius:8, border:`1px solid ${T.accentMd}` }}>
              MODO COACH
            </div>
          )}
          <button className="nav-mode" onClick={handleLogout}>⏻ Salir</button>
        </nav>

        <div className="page">
          {/* Coach: athlete selector at top of every page */}
          {coachMode && session.atletas?.length > 0 && (
            <AtletaSelector
              atletas={session.atletas}
              selectedId={selectedAtleta?.user_id || selectedAtleta?.id}
              onSelect={setSelectedAtleta}
            />
          )}

          {activeTab==="bio"      && <DiarioTab           client={client} coachMode={coachMode}/>}
          {activeTab==="nut"      && <NutricionTab         client={client} coachMode={coachMode} weekPlan={weekPlan}/>}
          {activeTab==="train"    && <EntrenamientoTab     client={client} coachMode={coachMode} weekPlan={weekPlan} setWeekPlan={setWeekPlan}/>}
          {activeTab==="journal"  && <DiarioSensacionesTab client={client} coachMode={coachMode}/>}
          {activeTab==="comp"     && <ComposicionTab       client={client} coachMode={coachMode}/>}
          {activeTab==="informes" && coachMode && <InformesTab client={client}/>}
        </div>

        <div className="bottom-nav">
          <div className="bottom-nav-inner">
            {TABS.map(t=>(
              <button key={t.key} className={`bnav-btn ${activeTab===t.key?"active":""}`} onClick={()=>setTab(t.key)}>
                <span className="bnav-icon">{t.icon}</span>
                <span className="bnav-label">{t.short}</span>
              </button>
            ))}
            <button className="bnav-btn" onClick={handleLogout}>
              <span className="bnav-icon">⏻</span>
              <span className="bnav-label">Salir</span>
            </button>
          </div>
        </div>

        {showModal && <ClientModal client={client} onSave={handleSaveClient} onClose={()=>setShowModal(false)}/>}
      </div>
    </>
  );
}
