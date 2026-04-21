<<<<<<< Updated upstream
const canvas = document.getElementById('drawing-board');
const toolbar = document.getElementById('toolbar');
const ctx = canvas.getContext('2d');

// Usa o mesmo host/porta da pagina servida pelo FastAPI.
const API_BASE_URL = window.location.origin;
const roomCode = 'sala-a';

let tool = 'select';
let strokeColor = '#000000';
let lineWidth = 5;

// Estado atual da interacao com o canvas.
let isPainting = false;
let startPoint = null;
let currentStrokePoints = [];
let previewElement = null;
let selectedElementId = null;
let elements = [];

/**
 * Ajusta o canvas ao viewport atual e redesenha o estado em memoria.
 */
function resizeCanvas() {
    canvas.width = window.innerWidth - 20;
    canvas.height = window.innerHeight - toolbar.offsetHeight - 20;
    drawBoard(elements);
}

resizeCanvas();

const toolInput = document.getElementById('tool');
if (toolInput) {
    toolInput.addEventListener('change', (e) => {
        tool = e.target.value;
    });
}

document.getElementById('stroke').addEventListener('change', (e) => {
    strokeColor = e.target.value;
});

document.getElementById('lineWidth').addEventListener('change', (e) => {
    lineWidth = Number(e.target.value) || 1;
});

document.getElementById('clear').addEventListener('click', async () => {
    await clearBoard();
    selectedElementId = null;
    await refreshBoard();
});

const deleteSelectedButton = document.getElementById('deleteSelected');
if (deleteSelectedButton) {
    deleteSelectedButton.addEventListener('click', async () => {
        if (!selectedElementId) return;
        await deleteElement(selectedElementId);
        selectedElementId = null;
        await refreshBoard();
    });
}

window.addEventListener('resize', resizeCanvas);

canvas.addEventListener('mousedown', (e) => {
    const p = getCanvasPoint(e);

    if (tool === 'select') {
        selectedElementId = pickElementIdAtPoint(p);
        drawBoard(elements);
        return;
    }

    isPainting = true;
    startPoint = p;

    if (tool === 'freehand') {
        currentStrokePoints = [p];
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isPainting) return;
    const p = getCanvasPoint(e);

    if (tool === 'freehand') {
        currentStrokePoints.push(p);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        return;
    }

    // Preview local da forma antes de enviar para API.
    previewElement = buildShapeElementFromPoints(startPoint, p);
    drawBoard(elements, previewElement);
});

canvas.addEventListener('mouseup', async (e) => {
    await finishInteraction(e);
});

canvas.addEventListener('mouseleave', async (e) => {
    await finishInteraction(e);
});

/**
 * Finaliza o desenho atual, persiste no backend e atualiza a tela.
 * @param {MouseEvent|undefined} e Evento final da interacao.
 * @returns {Promise<void>}
 */
async function finishInteraction(e) {
    if (!isPainting) return;
    isPainting = false;

    const endPoint = e ? getCanvasPoint(e) : startPoint;

    if (tool === 'freehand') {
        if (currentStrokePoints.length >= 2) {
            await createElement({
                type: 'freehand',
                stroke_color: strokeColor,
                stroke_width: lineWidth,
                fill_color: null,
                geometry: { points: currentStrokePoints.map(normalizePoint) }
            });
        }

        currentStrokePoints = [];
        ctx.beginPath();
        await refreshBoard();
        return;
    }

    const element = buildShapeElementFromPoints(startPoint, endPoint);
    previewElement = null;
    startPoint = null;

    if (element) {
        await createElement(element);
        await refreshBoard();
    } else {
        drawBoard(elements);
    }
}

/**
 * Monta o payload de um elemento geometrico a partir de dois pontos do mouse.
 * @param {{x:number, y:number}} a Ponto inicial em pixels do canvas.
 * @param {{x:number, y:number}} b Ponto final em pixels do canvas.
 * @returns {object|null} Payload do elemento ou null quando a geometria e invalida.
 */
function buildShapeElementFromPoints(a, b) {
    const aNorm = normalizePoint(a);
    const bNorm = normalizePoint(b);

    const ax = aNorm.x;
    const ay = aNorm.y;
    const bx = bNorm.x;
    const by = bNorm.y;

    const minX = Math.min(ax, bx);
    const minY = Math.min(ay, by);
    const width = Math.abs(ax - bx);
    const height = Math.abs(ay - by);

    if (tool === 'rectangle') {
        if (width === 0 || height === 0) return null;
        return {
            type: 'rectangle',
            stroke_color: strokeColor,
            stroke_width: lineWidth,
            fill_color: null,
            geometry: { x: minX, y: minY, width, height }
        };
    }

    if (tool === 'circle') {
        const dx = bx - ax;
        const dy = by - ay;
        const radius = Math.sqrt((dx * dx) + (dy * dy));
        if (radius === 0) return null;
        return {
            type: 'circle',
            stroke_color: strokeColor,
            stroke_width: lineWidth,
            fill_color: null,
            geometry: { cx: ax, cy: ay, radius }
        };
    }

    if (tool === 'triangle') {
        if (width === 0 || height === 0) return null;
        return {
            type: 'triangle',
            stroke_color: strokeColor,
            stroke_width: lineWidth,
            fill_color: null,
            geometry: {
                p1: { x: minX + (width / 2), y: minY },
                p2: { x: minX, y: minY + height },
                p3: { x: minX + width, y: minY + height }
            }
        };
    }

    if (tool === 'diamond') {
        if (width === 0 || height === 0) return null;
        return {
            type: 'diamond',
            stroke_color: strokeColor,
            stroke_width: lineWidth,
            fill_color: null,
            geometry: { cx: minX + (width / 2), cy: minY + (height / 2), width, height }
        };
    }

    return null;
}

/**
 * Desenha a lousa completa e, opcionalmente, um draft de preview.
 * @param {Array<object>} boardElements Elementos persistidos da sala.
 * @param {object|null} draft Elemento temporario de preview.
 */
function drawBoard(boardElements, draft = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const element of boardElements) {
        drawElement(element, element.id === selectedElementId);
    }

    if (draft) {
        drawElement(draft, false, true);
    }
}

/**
 * Desenha um unico elemento no canvas com estilo e estado de selecao.
 * @param {object} element Elemento no formato retornado pela API.
 * @param {boolean} selected Indica se o elemento esta selecionado.
 * @param {boolean} isDraft Indica desenho temporario (linha tracejada).
 */
function drawElement(element, selected = false, isDraft = false) {
    ctx.strokeStyle = element.stroke_color;
    ctx.lineWidth = element.stroke_width;
    ctx.lineCap = 'round';
    ctx.setLineDash(isDraft ? [6, 4] : []);

    if (element.type === 'freehand') {
        const pts = element.geometry.points || [];
        if (pts.length < 2) return;

        const p0 = denormalizePoint(pts[0]);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);

        for (let i = 1; i < pts.length; i += 1) {
            const p = denormalizePoint(pts[i]);
            ctx.lineTo(p.x, p.y);
        }

        ctx.stroke();
    }

    if (element.type === 'rectangle') {
        const g = element.geometry;
        const x = g.x * canvas.width;
        const y = g.y * canvas.height;
        const w = g.width * canvas.width;
        const h = g.height * canvas.height;
        ctx.strokeRect(x, y, w, h);
    }

    if (element.type === 'circle') {
        const g = element.geometry;
        ctx.beginPath();
        ctx.arc(
            g.cx * canvas.width,
            g.cy * canvas.height,
            g.radius * Math.min(canvas.width, canvas.height),
            0,
            Math.PI * 2
        );
        ctx.stroke();
    }

    if (element.type === 'triangle') {
        const g = element.geometry;
        const p1 = denormalizePoint(g.p1);
        const p2 = denormalizePoint(g.p2);
        const p3 = denormalizePoint(g.p3);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.stroke();
    }

    if (element.type === 'diamond') {
        const g = element.geometry;
        const cx = g.cx * canvas.width;
        const cy = g.cy * canvas.height;
        const hw = (g.width * canvas.width) / 2;
        const hh = (g.height * canvas.height) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - hh);
        ctx.lineTo(cx + hw, cy);
        ctx.lineTo(cx, cy + hh);
        ctx.lineTo(cx - hw, cy);
        ctx.closePath();
        ctx.stroke();
    }

    if (selected && element.id) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 2;
        const box = getElementBoundsPx(element);
        if (box) {
            ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
        }
    }

    ctx.setLineDash([]);
}

/**
 * Calcula uma bounding box em pixels para selecao simples por clique.
 * @param {object} element Elemento no formato retornado pela API.
 * @returns {{x:number,y:number,w:number,h:number}|null} Caixa limite do elemento.
 */
function getElementBoundsPx(element) {
    if (element.type === 'rectangle') {
        const g = element.geometry;
        return {
            x: g.x * canvas.width,
            y: g.y * canvas.height,
            w: g.width * canvas.width,
            h: g.height * canvas.height
        };
    }

    if (element.type === 'circle') {
        const g = element.geometry;
        const r = g.radius * Math.min(canvas.width, canvas.height);
        const cx = g.cx * canvas.width;
        const cy = g.cy * canvas.height;
        return { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
    }

    if (element.type === 'triangle') {
        const p = [element.geometry.p1, element.geometry.p2, element.geometry.p3].map(denormalizePoint);
        const xs = p.map((v) => v.x);
        const ys = p.map((v) => v.y);
        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys)
        };
    }

    if (element.type === 'diamond') {
        const g = element.geometry;
        const w = g.width * canvas.width;
        const h = g.height * canvas.height;
        const cx = g.cx * canvas.width;
        const cy = g.cy * canvas.height;
        return { x: cx - (w / 2), y: cy - (h / 2), w, h };
    }

    if (element.type === 'freehand') {
        const pts = (element.geometry.points || []).map(denormalizePoint);
        if (pts.length === 0) return null;
        const xs = pts.map((v) => v.x);
        const ys = pts.map((v) => v.y);
        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys)
        };
    }

    return null;
}

// Seleciona o elemento de topo (ultima camada desenhada) no ponto clicado.
/**
 * Encontra o id do elemento de topo que contem o ponto clicado.
 * @param {{x:number, y:number}} p Ponto em pixels relativo ao canvas.
 * @returns {string|null} Id do elemento selecionado ou null.
 */
function pickElementIdAtPoint(p) {
    for (let i = elements.length - 1; i >= 0; i -= 1) {
        const element = elements[i];
        const box = getElementBoundsPx(element);
        if (!box) continue;

        const hit = (
            p.x >= box.x - 6 &&
            p.x <= box.x + box.w + 6 &&
            p.y >= box.y - 6 &&
            p.y <= box.y + box.h + 6
        );

        if (hit) return element.id;
    }

    return null;
}

/**
 * Converte um evento de mouse para coordenadas locais do canvas.
 * @param {MouseEvent} e Evento de mouse.
 * @returns {{x:number, y:number}} Ponto em pixels no canvas.
 */
function getCanvasPoint(e) {
    return {
        x: e.clientX - canvas.offsetLeft,
        y: e.clientY - canvas.offsetTop
    };
}

// Coordenadas normalizadas deixam o desenho responsivo ao redimensionar o canvas.
/**
 * Converte ponto em pixels para coordenadas normalizadas (0..1).
 * @param {{x:number, y:number}} point Ponto em pixels.
 * @returns {{x:number, y:number}} Ponto normalizado.
 */
function normalizePoint(point) {
    return {
        x: canvas.width ? point.x / canvas.width : 0,
        y: canvas.height ? point.y / canvas.height : 0
    };
}

/**
 * Converte ponto normalizado (0..1) para pixels do canvas atual.
 * @param {{x:number, y:number}} point Ponto normalizado.
 * @returns {{x:number, y:number}} Ponto em pixels.
 */
function denormalizePoint(point) {
    return {
        x: point.x * canvas.width,
        y: point.y * canvas.height
    };
}

/**
 * Busca os elementos da sala na API e atualiza a renderizacao local.
 * @returns {Promise<void>}
 */
async function refreshBoard() {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomCode}/elements`);
    if (!response.ok) throw new Error(`Erro ao carregar a lousa (${response.status})`);
    elements = await response.json();
    drawBoard(elements);
}

/**
 * Envia um novo elemento para persistencia no backend.
 * @param {object} payload Elemento no contrato esperado pela API.
 * @returns {Promise<void>}
 */
async function createElement(payload) {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomCode}/elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Erro ao salvar (${response.status})`);
}

/**
 * Remove um elemento especifico da sala pelo id.
 * @param {string} elementId Identificador do elemento.
 * @returns {Promise<void>}
 */
async function deleteElement(elementId) {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomCode}/elements/${elementId}`, {
        method: 'DELETE'
    });

    if (!response.ok) throw new Error(`Erro ao apagar (${response.status})`);
}

/**
 * Remove todos os elementos da sala atual.
 * @returns {Promise<void>}
 */
async function clearBoard() {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomCode}/elements`, {
        method: 'DELETE'
    });

    if (!response.ok) throw new Error(`Erro ao limpar a lousa (${response.status})`);
}

refreshBoard().catch(console.error);
=======
// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000/api";

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
let startX, startY;

// Snapshot do canvas antes de começar a desenhar uma forma geométrica (para preview)
let snapshotAntes = null;

// Posição onde o usuário clicou para inserir texto
let textoX = 0, textoY = 0;

// ─── CANVAS ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById("drawing-board");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const toolbar = document.getElementById("toolbar");
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - toolbar.offsetHeight;
  ctx.putImageData(imgData, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ─── TROCAR FERRAMENTA ───────────────────────────────────────────────────────
function setFerramenta(nova) {
  ferramenta = nova;

  document.querySelectorAll(".btn-tool").forEach(btn => btn.classList.remove("active"));
  const el = document.getElementById("tool-" + nova);
  if (el) el.classList.add("active");

  canvas.style.cursor = nova === "borracha" ? "cell" : nova === "texto" ? "text" : "crosshair";

  // Controles da borracha
  const isBorracha = nova === "borracha";
  document.getElementById("label-borracha").style.display = isBorracha ? "inline" : "none";
  document.getElementById("eraserWidth").style.display    = isBorracha ? "inline-block" : "none";

  // Controles de fonte (só para texto)
  const isTxt = nova === "texto";
  document.getElementById("fontFamily").style.display    = isTxt ? "inline-block" : "none";
  document.getElementById("fontSize").style.display      = isTxt ? "inline-block" : "none";
  document.getElementById("label-bold").style.display    = isTxt ? "flex" : "none";
  document.getElementById("label-italic").style.display  = isTxt ? "flex" : "none";
}

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
  ctx.lineWidth = parseInt(t.espessura);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

// Forma geométrica — usado no polling e no mouseup
function desenharForma(t) {
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = t.cor;
  ctx.lineWidth = parseInt(t.espessura);
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
    for (let i = 0; i < pontas * 2; i++) {
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
  const alturaLinha = parseInt(t.fontSize) * 1.25;
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
  ctx.putImageData(snapshotAntes, 0, 0);
  const cor = document.getElementById("stroke").value;
  const espessura = parseInt(document.getElementById("lineWidth").value) || 3;
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
    box.style.left = (e.clientX + 8) + "px";
    box.style.top  = (e.clientY + 8) + "px";
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
  const espessura = parseInt(document.getElementById("lineWidth").value) || 3;

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
  const espessura = parseInt(document.getElementById("lineWidth").value) || 3;
  const espessuraBorracha = parseInt(document.getElementById("eraserWidth").value) || 20;

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
  const size   = parseInt(document.getElementById("fontSize").value) || 24;
  const family = document.getElementById("fontFamily").value;
  const bold   = document.getElementById("toggle-bold").checked ? "bold " : "";
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
    texto, font, fontSize,
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
      alert("Erro: " + err.detail);
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
    mostrarErrroModal("Preencha o código da sala e seu nome.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/salas/${sala}`);

    if (res.status === 404) {
      mostrarErrroModal("Sala não encontrada. Verifique o código ou crie uma nova.");
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
    mostrarErrroModal("Falha de conexão com o servidor. O backend está rodando?");
  }
});

// ─── MODAL: CRIAR SALA (PROFESSOR) ───────────────────────────────────────────
document.getElementById("btn-criar").addEventListener("click", async () => {
  const sala = document.getElementById("inp-sala").value.trim();
  const usuario = document.getElementById("inp-usuario").value.trim();
  const senha = document.getElementById("inp-senha").value.trim();

  if (!sala || !usuario) {
    mostrarErrroModal("Preencha o código da sala e seu nome.");
    return;
  }

  if (!document.getElementById("toggle-professor").checked) {
    mostrarErrroModal("Marque a opção \"Sou o professor\" para criar uma sala.");
    return;
  }

  if (!senha || senha.length < 4) {
    mostrarErrroModal("A senha deve ter pelo menos 4 caracteres.");
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
      mostrarErrroModal("Já existe uma sala com esse código. Escolha outro.");
    } else {
      mostrarErrroModal("Erro ao criar sala. Tente novamente.");
    }
  } catch (_) {
    mostrarErrroModal("Falha de conexão com o servidor. O backend está rodando?");
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

function mostrarErrroModal(msg) {
  document.getElementById("modal-erro").textContent = msg;
}

document.getElementById("toggle-professor").addEventListener("change", (e) => {
  document.getElementById("senha-grupo").style.display = e.target.checked ? "flex" : "none";
  document.getElementById("modal-erro").textContent = "";
});
>>>>>>> Stashed changes
