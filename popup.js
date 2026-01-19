// popup.js
document.addEventListener('DOMContentLoaded', () => {
 const btn = document.getElementById('analyze-btn');
 const log = document.getElementById('risk-log');
 btn.addEventListener('click', () => {
 addLog("Initiating page scan...");
 setTimeout(() => {
 const mockScore = (Math.random() * 0.5 + 0.5).toFixed(2);
 updateUI({
 trust_score: mockScore,
 risk_factors: ["None detected"],
 modality_breakdown: {
 signal: { score: mockScore },
 lineage: { score: mockScore },
 intent: { score: mockScore }
 }
 });
 addLog("Page analysis complete.");
 }, 1500);
 });
 function addLog(msg) {
 const p = document.createElement('p');
 p.innerText = `> ${msg}`;
 log.appendChild(p);
 log.scrollTop = log.scrollHeight;
 }
 function updateUI(data) {
 const globalScore = document.getElementById('global-score');
 globalScore.querySelector('.score-val').innerText = data.trust_score;
 updateLens('signal', data.modality_breakdown.signal.score);
 updateLens('lineage', data.modality_breakdown.lineage.score);
 updateLens('intent', data.modality_breakdown.intent.score);
 if (data.trust_score > 0.8)
 globalScore.style.borderColor = "var(--neon-green)";
 else if (data.trust_score > 0.5)
 globalScore.style.borderColor = "orange";
 else
 globalScore.style.borderColor = "var(--neon-red)";
 }
 function updateLens(id, score) {
 const el = document.getElementById(`lens-${id}`);
 el.querySelector('.lens-val').innerText = score;
 el.querySelector('.fill').style.width = `${score * 100}%`;
 }
});
