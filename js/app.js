import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, onSnapshot, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const state={name:"",mood:null,needs:[],db:null,auth:null,firebaseReady:false};
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function go(screen){
  $$(".screen").forEach(el=>el.classList.toggle("active",el.dataset.screen===screen));
  window.scrollTo({top:0,behavior:"smooth"});
}
function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2500);
}
function configured(){return firebaseConfig.apiKey&&!firebaseConfig.apiKey.includes("REEMPLAZAR")}
function demoStats(){return{total:1248,average:4.1,energyPct:76,pausePct:54,trend:[2.5,2.9,3.1,3.5,3.2,3.8,4,3.7,4.2,4,4.3,4.1]}}
function renderBars(container,values=[]){
  container.innerHTML="";
  (values.length?values:[2.5,3,3.4,3.1,3.8,4.1]).forEach(v=>{
    const b=document.createElement("span");
    b.style.height=`${Math.max(12,Math.min(100,(Number(v)/5)*100))}%`;
    b.title=`${Number(v).toFixed(1)}/5`;
    container.appendChild(b);
  });
}
function renderPublic(data){
  const total=Number(data.total||0),avg=Number(data.average||0),energy=Number(data.energyPct||0),pause=Number(data.pausePct||0);
  $("#total").textContent=total.toLocaleString("es-CO");
  $("#avgScore").textContent=avg.toFixed(1);
  $("#energy").textContent=`${Math.round(energy)}%`;
  $("#pause").textContent=`${Math.round(pause)}%`;
  const angle=-90+((Math.max(1,Math.min(5,avg))-1)/4)*180;
  $("#needle").style.transform=`rotate(${angle}deg)`;
  renderBars($("#trend"),data.trend||[]);
}
function subscribeStats(){
  if(!state.firebaseReady){renderPublic(demoStats());return}
  onSnapshot(doc(state.db,"publicStats","live"),snap=>renderPublic(snap.exists()?snap.data():demoStats()),()=>renderPublic(demoStats()));
}
function initFirebase(){
  if(!configured()){console.warn("Firebase no configurado: modo demostración.");renderPublic(demoStats());return}
  const app=initializeApp(firebaseConfig);
  state.db=getFirestore(app); state.auth=getAuth(app); state.firebaseReady=true;
  onAuthStateChanged(state.auth,user=>{if(user&&$(".screen.active")?.dataset.screen==="admin-login"){go("admin");loadAdmin()}});
  subscribeStats();
}
async function saveResponse(){
  const data={happiness:state.mood,needs:state.needs,createdAt:serverTimestamp(),source:"qr-web",version:1};
  if(!state.firebaseReady){
    const rows=JSON.parse(localStorage.getItem("feliciometro_demo")||"[]");
    rows.push({...data,createdAt:new Date().toISOString()});
    localStorage.setItem("feliciometro_demo",JSON.stringify(rows)); return;
  }
  await addDoc(collection(state.db,"responses"),data);
}
async function loadAdmin(){
  if(!state.firebaseReady){
    const d=demoStats();
    $("#aTotal").textContent=d.total; $("#aAvg").textContent=d.average.toFixed(1);
    $("#aPause").textContent=Math.round(d.total*d.pausePct/100);
    $("#aEnergy").textContent=Math.round(d.total*d.energyPct/100);
    renderBars($("#adminTrend"),d.trend); return;
  }
  try{
    const q=query(collection(state.db,"responses"),orderBy("createdAt","desc"),limit(300));
    const snap=await getDocs(q), rows=snap.docs.map(x=>x.data()), total=rows.length;
    const avg=total?rows.reduce((s,r)=>s+Number(r.happiness||0),0)/total:0;
    const pause=rows.filter(r=>(r.needs||[]).includes("pausa")).length;
    const energy=rows.filter(r=>Number(r.happiness||0)>=4).length;
    $("#aTotal").textContent=total; $("#aAvg").textContent=avg.toFixed(1);
    $("#aPause").textContent=pause; $("#aEnergy").textContent=energy;
    renderBars($("#adminTrend"),rows.slice().reverse().map(r=>Number(r.happiness||0)).slice(-20));
  }catch(e){console.error(e);toast("No fue posible cargar los datos.")}
}
function exportDemo(){
  const rows=JSON.parse(localStorage.getItem("feliciometro_demo")||"[]");
  const csv=["fecha,felicidad,necesidades",...rows.map(r=>`${r.createdAt||""},${r.happiness||""},"${(r.needs||[]).join("|")}"`)].join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="feliciometro-respuestas-anonimas.csv";a.click();URL.revokeObjectURL(url);
}

$("#nameForm").addEventListener("submit",e=>{e.preventDefault();state.name=$("#nameInput").value.trim();if(!state.name)return;$("#helloName").textContent=state.name;go("mood")});
$$(".mood").forEach(btn=>btn.addEventListener("click",()=>{$$(".mood").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected");state.mood=Number(btn.dataset.mood);$("#goNeeds").disabled=false}));
$("#goNeeds").addEventListener("click",()=>go("needs"));
$$(".needs button").forEach(btn=>btn.addEventListener("click",()=>{btn.classList.toggle("selected");state.needs=$$(".needs button.selected").map(x=>x.dataset.need);$("#submitResponse").disabled=state.needs.length===0}));
$("#submitResponse").addEventListener("click",async()=>{const btn=$("#submitResponse");btn.disabled=true;btn.innerHTML="Guardando...";try{await saveResponse();go("thanks")}catch(e){console.error(e);toast("No pudimos guardar tu respuesta.");btn.disabled=false}btn.innerHTML='Enviar mi respuesta <span>→</span>'});
$("#viewDashboard").addEventListener("click",()=>{subscribeStats();go("dashboard")});
$("#openAdmin").addEventListener("click",()=>{if(state.auth?.currentUser){go("admin");loadAdmin()}else go("admin-login")});
$$("[data-go]").forEach(btn=>btn.addEventListener("click",()=>go(btn.dataset.go)));
$("#adminForm").addEventListener("submit",async e=>{e.preventDefault();$("#adminError").textContent="";if(!state.firebaseReady){$("#adminError").textContent="Configura Firebase para habilitar el acceso real.";return}try{await signInWithEmailAndPassword(state.auth,$("#adminEmail").value,$("#adminPassword").value);go("admin");loadAdmin()}catch{$("#adminError").textContent="Correo o contraseña incorrectos."}});
$("#logout").addEventListener("click",async()=>{if(state.auth)await signOut(state.auth);go("welcome")});
$("#refresh").addEventListener("click",loadAdmin);
$("#festival").addEventListener("click",()=>{subscribeStats();go("dashboard")});
$("#export").addEventListener("click",()=>{if(!state.firebaseReady){exportDemo();return}toast("La exportación segura de Firebase se habilitará con función administrativa.")});
$("#copyLink").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname);toast("Enlace público copiado.")}catch{toast("No se pudo copiar el enlace.")}});

initFirebase();renderPublic(demoStats());
