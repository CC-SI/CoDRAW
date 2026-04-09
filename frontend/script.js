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
