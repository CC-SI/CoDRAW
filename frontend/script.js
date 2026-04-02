const canvas = document.getElementById('drawing-board');
const toolbar = document.getElementById('toolbar');
const ctx = canvas.getContext('2d');

// Global variables for drawing state
let isPainting = false;
let lineWidth = 5;
let startX;
let startY;

// Set canvas size dynamically
canvas.width = window.innerWidth - 20; // Adjust for margin/padding
canvas.height = window.innerHeight - toolbar.offsetHeight - 20;

// Add event listeners for toolbar controls
toolbar.addEventListener('change', e => {
    if (e.target.id === 'stroke') {
        ctx.strokeStyle = e.target.value;
    }
    if (e.target.id === 'lineWidth') {
        lineWidth = e.target.value;
    }
});

// Add event listener for the clear button
document.getElementById('clear').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Event listeners for drawing on the canvas
canvas.addEventListener('mousedown', (e) => {
    isPainting = true;
    startX = e.clientX - canvas.offsetLeft;
    startY = e.clientY - canvas.offsetTop;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
});

canvas.addEventListener('mouseup', () => {
    isPainting = false;
    ctx.stroke();
    ctx.beginPath(); // Start a new path for the next drawing action
});

canvas.addEventListener('mousemove', draw);

function draw(e) {
    if (!isPainting) return;

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round'; // Creates smooth line endings
    ctx.lineTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
    ctx.stroke();
}
