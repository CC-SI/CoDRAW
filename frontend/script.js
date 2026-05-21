// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const API_BASE = `${window.location.origin}/api`;

// ─── ESTADO DA SESSÃO ────────────────────────────────────────────────────────
let sessao = {
  sala: null,
  usuario: null,
  senha: null,
  isProfessor: false,
  ultimoId: 0,
  pollingTimer: null,
};

// ─── ESTADO DAS FERRAMENTAS ──────────────────────────────────────────────────
let ferramenta = "caneta"; // caneta | borracha | texto | linha | retangulo | circulo | triangulo | losango | seta | estrela
let isPainting = false;
let startX = 0;
let startY = 0;

// Snapshot do canvas antes de começar a desenhar uma forma geométrica (para preview)
let snapshotAntes = null;

// Posição onde o usuário clicou para inserir texto
let textoX = 0;
let textoY = 0;

// ─── CANVAS ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById("drawing-board");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const toolbar = document.getElementById("toolbar");
  const newWidth = window.innerWidth;
  const newHeight = window.innerHeight - toolbar.offsetHeight;

  if (canvas.width === 0 || canvas.height === 0) {
    canvas.width = newWidth;
    canvas.height = newHeight;
    return;
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = newWidth;
  canvas.height = newHeight;
  ctx.putImageData(imgData, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ─── TROCAR FERRAMENTA ───────────────────────────────────────────────────────
function setFerramenta(nova) {
  ferramenta = nova;

  document.querySelectorAll(".btn-tool").forEach((btn) => btn.classList.remove("active"));
  const el = document.getElementById("tool-" + nova);
  if (el) el.classList.add("active");

  canvas.style.cursor = nova === "borracha" ? "cell" : nova === "texto" ? "text" : "crosshair";

  // Controles da borracha
  const isBorracha = nova === "borracha";
  document.getElementById("label-borracha").style.display = isBorracha ? "inline" : "none";
  document.getElementById("eraserWidth").style.display = isBorracha ? "inline-block" : "none";

  // Controles de fonte (só para texto)
  const isTxt = nova === "texto";
  document.getElementById("fontFamily").style.display = isTxt ? "inline-block" : "none";
  document.getElementById("fontSize").style.display = isTxt ? "inline-block" : "none";
  document.getElementById("label-bold").style.display = isTxt ? "flex" : "none";
  document.getElementById("label-italic").style.display = isTxt ? "flex" : "none";
}
window.setFerramenta = setFerramenta;

// ─── FUNÇÕES DE DESENHO ──────────────────────────────────────────────────────

// Traço livre (caneta ou borracha) — usado no polling
function desenharTraco(t) {
  ctx.beginPath();
  ctx.moveTo(t.x1, t.y1);
  ctx.lineTo(t.x2, t.y2);
  if (t.cor === "borracha") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = t.cor;
  }
  ctx.lineWidth = parseInt(t.espessura, 10);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

// Forma geométrica — usado no polling e no mouseup
function desenharForma(t) {
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = t.cor;
  ctx.lineWidth = parseInt(t.espessura, 10);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  const w = t.x2 - t.x1;
  const h = t.y2 - t.y1;
  const cx = t.x1 + w / 2;
  const cy = t.y1 + h / 2;

  if (t.ferramenta === "linha") {
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);

  } else if (t.ferramenta === "retangulo") {
    ctx.strokeRect(t.x1, t.y1, w, h);

  } else if (t.ferramenta === "circulo") {
    ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);

  } else if (t.ferramenta === "triangulo") {
    ctx.moveTo(cx, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.lineTo(t.x1, t.y2);
    ctx.closePath();

  } else if (t.ferramenta === "losango") {
    ctx.moveTo(cx, t.y1);
    ctx.lineTo(t.x2, cy);
    ctx.lineTo(cx, t.y2);
    ctx.lineTo(t.x1, cy);
    ctx.closePath();

  } else if (t.ferramenta === "seta") {
    const ang = Math.atan2(t.y2 - t.y1, t.x2 - t.x1);
    const headLen = Math.max(14, Math.hypot(w, h) * 0.2);
    const headAng = Math.PI / 6;
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.lineTo(t.x2 - headLen * Math.cos(ang - headAng), t.y2 - headLen * Math.sin(ang - headAng));
    ctx.moveTo(t.x2, t.y2);
    ctx.lineTo(t.x2 - headLen * Math.cos(ang + headAng), t.y2 - headLen * Math.sin(ang + headAng));

  } else if (t.ferramenta === "estrela") {
    const raioExt = Math.min(Math.abs(w), Math.abs(h)) / 2;
    const raioInt = raioExt * 0.45;
    const pontas = 5;
    for (let i = 0; i < pontas * 2; i += 1) {
      const ang = (i * Math.PI) / pontas - Math.PI / 2;
      const r = i % 2 === 0 ? raioExt : raioInt;
      const px = cx + r * Math.cos(ang);
      const py = cy + r * Math.sin(ang);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  ctx.stroke();
}

// Texto — usado no polling e na confirmação do input
function desenharTexto(t) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = t.cor;
  ctx.font = t.font;
  ctx.textBaseline = "top";
  // Suporta quebras de linha
  const linhas = t.texto.split("\n");
  const alturaLinha = parseInt(t.font_size || t.fontSize || 24, 10) * 1.25;
  linhas.forEach((linha, i) => {
    ctx.fillText(linha, t.x1, t.y1 + i * alturaLinha);
  });
}

// Decide qual função usar baseado no campo ferramenta do traço
function renderizarTraco(t) {
  const formas = ["linha", "retangulo", "circulo", "triangulo", "losango", "seta", "estrela"];
  if (t.ferramenta === "texto") {
    desenharTexto(t);
  } else if (t.ferramenta && formas.includes(t.ferramenta)) {
    desenharForma(t);
  } else {
    desenharTraco(t);
  }
}

// Preview visual da forma enquanto arrasta (não salva)
function previewForma(x2, y2) {
  if (!snapshotAntes) return;
  ctx.putImageData(snapshotAntes, 0, 0);
  const cor = document.getElementById("stroke").value;
  const espessura = parseInt(document.getElementById("lineWidth").value, 10) || 3;
  desenharForma({ ferramenta, x1: startX, y1: startY, x2, y2, cor, espessura });
}

// ─── POLLING ─────────────────────────────────────────────────────────────────
function iniciarPolling() {
  if (sessao.pollingTimer) clearInterval(sessao.pollingTimer);

  sessao.pollingTimer = setInterval(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/salas/${sessao.sala}/tracos?desde_id=${sessao.ultimoId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      data.tracos.forEach((t) => {
        if (t.usuario !== sessao.usuario) renderizarTraco(t);
        sessao.ultimoId = t.id;
      });
    } catch (_) {}
  }, 1000);
}

// ─── SALVAR TRAÇO NO BACKEND ─────────────────────────────────────────────────
async function salvarTraco(traco) {
  try {
    const res = await fetch(`${API_BASE}/salas/${sessao.sala}/tracos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(traco),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.id > sessao.ultimoId) sessao.ultimoId = data.id;
    }
  } catch (_) {
    console.warn("Falha ao salvar traço.");
  }
}

// ─── EVENTOS DO CANVAS ───────────────────────────────────────────────────────
const formasGeometricas = ["linha", "retangulo", "circulo", "triangulo", "losango", "seta", "estrela"];

canvas.addEventListener("mousedown", (e) => {
  if (!sessao.sala) return;

  const x = e.clientX - canvas.offsetLeft;
  const y = e.clientY - canvas.offsetTop;

  // Ferramenta texto: abre o input flutuante
  if (ferramenta === "texto") {
    textoX = x;
    textoY = y;
    const box = document.getElementById("text-input-box");
    box.style.display = "flex";
    box.style.left = `${e.clientX + 8}px`;
    box.style.top  = `${e.clientY + 8}px`;
    document.getElementById("text-area").value = "";
    document.getElementById("text-area").focus();
    return;
  }

  isPainting = true;
  startX = x;
  startY = y;

  if (formasGeometricas.includes(ferramenta)) {
    snapshotAntes = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } else {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
  }
});

canvas.addEventListener("mouseup", async (e) => {
  if (!isPainting) return;
  isPainting = false;

  const endX = e.clientX - canvas.offsetLeft;
  const endY = e.clientY - canvas.offsetTop;
  const cor = document.getElementById("stroke").value;
  const espessura = parseInt(document.getElementById("lineWidth").value, 10) || 3;

  if (formasGeometricas.includes(ferramenta)) {
    ctx.putImageData(snapshotAntes, 0, 0);
    const traco = { usuario: sessao.usuario, ferramenta, x1: startX, y1: startY, x2: endX, y2: endY, cor, espessura };
    desenharForma(traco);
    await salvarTraco(traco);
  }

  ctx.beginPath();
});

canvas.addEventListener("mousemove", async (e) => {
  if (!isPainting) return;

  const endX = e.clientX - canvas.offsetLeft;
  const endY = e.clientY - canvas.offsetTop;
  const cor = document.getElementById("stroke").value;
  const espessura = parseInt(document.getElementById("lineWidth").value, 10) || 3;
  const espessuraBorracha = parseInt(document.getElementById("eraserWidth").value, 10) || 20;

  // Preview de forma — só visual, não salva
  if (formasGeometricas.includes(ferramenta)) {
    previewForma(endX, endY);
    return;
  }

  // Caneta ou borracha
  if (ferramenta === "borracha") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = cor;
  }

  ctx.lineWidth = ferramenta === "borracha" ? espessuraBorracha : espessura;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";

  await salvarTraco({
    usuario: sessao.usuario,
    ferramenta,
    x1: startX, y1: startY,
    x2: endX, y2: endY,
    cor: ferramenta === "borracha" ? "borracha" : cor,
    espessura: ferramenta === "borracha" ? espessuraBorracha : espessura,
  });

  startX = endX;
  startY = endY;
});

// ─── FERRAMENTA TEXTO ────────────────────────────────────────────────────────

function montarFont() {
  const size = parseInt(document.getElementById("fontSize").value, 10) || 24;
  const family = document.getElementById("fontFamily").value;
  const bold = document.getElementById("toggle-bold").checked ? "bold " : "";
  const italic = document.getElementById("toggle-italic").checked ? "italic " : "";
  return { font: `${italic}${bold}${size}px ${family}`, fontSize: size };
}

function fecharTextBox() {
  const box = document.getElementById("text-input-box");
  box.style.display = "none";
}

document.getElementById("btn-cancelar-texto").addEventListener("click", fecharTextBox);

document.getElementById("btn-confirmar-texto").addEventListener("click", async () => {
  const texto = document.getElementById("text-area").value.trim();
  if (!texto) { fecharTextBox(); return; }

  const cor = document.getElementById("stroke").value;
  const { font, fontSize } = montarFont();

  const traco = {
    usuario: sessao.usuario,
    ferramenta: "texto",
    x1: textoX, y1: textoY,
    x2: textoX, y2: textoY,
    cor, espessura: 1,
    texto, font, font_size: fontSize,
  };

  desenharTexto(traco);
  await salvarTraco(traco);
  fecharTextBox();
});

// ─── TOOLBAR: LIMPAR LOUSA ───────────────────────────────────────────────────
document.getElementById("clear").addEventListener("click", async () => {
  if (!sessao.sala) return;
  if (!confirm("Tem certeza que deseja limpar toda a lousa?")) return;

  try {
    const res = await fetch(`${API_BASE}/salas/${sessao.sala}/tracos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha: sessao.senha }),
    });

    if (res.ok) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sessao.ultimoId = 0;
    } else {
      const err = await res.json();
      alert(`Erro: ${err.detail}`);
    }
  } catch (_) {
    alert("Falha de conexão com o servidor.");
  }
});

// ─── MODAL: ENTRAR NA SALA ───────────────────────────────────────────────────
document.getElementById("btn-entrar").addEventListener("click", async () => {
  const sala = document.getElementById("inp-sala").value.trim();
  const usuario = document.getElementById("inp-usuario").value.trim();

  if (!sala || !usuario) {
    mostrarErroModal("Preencha o código da sala e seu nome.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/salas/${sala}`);

    if (res.status === 404) {
      mostrarErroModal("Sala não encontrada. Verifique o código ou crie uma nova.");
      return;
    }

    const data = await res.json();

    sessao.sala = sala;
    sessao.usuario = usuario;
    sessao.isProfessor = false;
    sessao.ultimoId = 0;

    fecharModal();
    document.getElementById("info-sala").textContent =
      `Sala: ${sala} | Professor: ${data.professor} | Você: ${usuario}`;
    document.getElementById("clear").style.display = "none";

    await carregarTodosTracos();
    iniciarPolling();
  } catch (_) {
    mostrarErroModal("Falha de conexão com o servidor. O backend está rodando?");
  }
});

// ─── MODAL: CRIAR SALA (PROFESSOR) ───────────────────────────────────────────
document.getElementById("btn-criar").addEventListener("click", async () => {
  const sala = document.getElementById("inp-sala").value.trim();
  const usuario = document.getElementById("inp-usuario").value.trim();
  const senha = document.getElementById("inp-senha").value.trim();

  if (!sala || !usuario) {
    mostrarErroModal("Preencha o código da sala e seu nome.");
    return;
  }

  if (!document.getElementById("toggle-professor").checked) {
    mostrarErroModal("Marque a opção \"Sou o professor\" para criar uma sala.");
    return;
  }

  if (!senha || senha.length < 4) {
    mostrarErroModal("A senha deve ter pelo menos 4 caracteres.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/salas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: sala, professor: usuario, senha }),
    });

    if (res.ok) {
      sessao.sala = sala;
      sessao.usuario = usuario;
      sessao.senha = senha;
      sessao.isProfessor = true;
      sessao.ultimoId = 0;

      fecharModal();
      document.getElementById("info-sala").textContent =
        `Sala: ${sala} | Professor: ${usuario} (você) 🎓`;
      document.getElementById("clear").style.display = "inline-block";

      iniciarPolling();
    } else if (res.status === 400) {
      mostrarErroModal("Já existe uma sala com esse código. Escolha outro.");
    } else {
      mostrarErroModal("Erro ao criar sala. Tente novamente.");
    }
  } catch (_) {
    mostrarErroModal("Falha de conexão com o servidor. O backend está rodando?");
  }
});

// ─── CARREGAR TRAÇOS EXISTENTES ──────────────────────────────────────────────
async function carregarTodosTracos() {
  try {
    const res = await fetch(`${API_BASE}/salas/${sessao.sala}/tracos?desde_id=0`);
    if (!res.ok) return;
    const data = await res.json();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    data.tracos.forEach((t) => {
      renderizarTraco(t);
      sessao.ultimoId = t.id;
    });
  } catch (_) {}
}

// ─── MODAL HELPERS ───────────────────────────────────────────────────────────
function fecharModal() {
  document.getElementById("modal").style.display = "none";
}

function mostrarErroModal(msg) {
  document.getElementById("modal-erro").textContent = msg;
}

document.getElementById("toggle-professor").addEventListener("change", (e) => {
  document.getElementById("senha-grupo").style.display = e.target.checked ? "flex" : "none";
  document.getElementById("modal-erro").textContent = "";
});
