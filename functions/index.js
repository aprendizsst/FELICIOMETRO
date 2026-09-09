const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

exports.aggregateFeliciometro = onDocumentCreated("responses/{responseId}", async (event) => {
  if (!event.data) return;
  const data = event.data.data();
  const happiness = Number(data.happiness || 0);
  const needs = Array.isArray(data.needs) ? data.needs : [];
  const isEnergy = happiness >= 4;
  const needsPause = needs.includes("pausa");
  const statsRef = db.doc("publicStats/live");

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(statsRef);
    const current = snap.exists ? snap.data() : {};
    const total = Number(current.total || 0) + 1;
    const sum = Number(current.sum || 0) + happiness;
    const energyCount = Number(current.energyCount || 0) + (isEnergy ? 1 : 0);
    const pauseCount = Number(current.pauseCount || 0) + (needsPause ? 1 : 0);
    let trend = Array.isArray(current.trend) ? [...current.trend] : [];
    trend.push(happiness);
    trend = trend.slice(-24);

    tx.set(statsRef, {
      total,
      sum,
      average: Number((sum / total).toFixed(2)),
      energyCount,
      pauseCount,
      energyPct: Number(((energyCount / total) * 100).toFixed(1)),
      pausePct: Number(((pauseCount / total) * 100).toFixed(1)),
      trend,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
});
