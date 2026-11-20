function getLinesAndBoxes(canvas, numberOfLines) {
  const hMap = new Map(); // y -> [[x1, x2], ...]
  const vMap = new Map(); // x -> [[y1, y2], ...]
  const xSet = new Set();
  const ySet = new Set();
  const lines = [];

  for (let i = 0; i < numberOfLines; i++) {
    const direction = Math.random() < 0.5 ? "horizontal" : "vertical";
    const xMin = Math.floor(Math.random() * canvas.width);
    const xMax = xMin + Math.floor(Math.random() * (canvas.width - xMin));
    const yMin = Math.floor(Math.random() * canvas.height);
    const yMax = yMin + Math.floor(Math.random() * (canvas.height - yMin));

    if (direction === "horizontal") {
      lines.push({ x1: xMin, y1: yMin, x2: xMax, y2: yMin });
      if (xMax > xMin) {
        if (!hMap.has(yMin)) hMap.set(yMin, []);
        hMap.get(yMin).push([xMin, xMax]);
        xSet.add(xMin);
        xSet.add(xMax);
        ySet.add(yMin);
      }
    } else {
      lines.push({ x1: xMin, y1: yMin, x2: xMin, y2: yMax });
      if (yMax > yMin) {
        if (!vMap.has(xMin)) vMap.set(xMin, []);
        vMap.get(xMin).push([yMin, yMax]);
        xSet.add(xMin);
        ySet.add(yMin);
        ySet.add(yMax);
      }
    }
  }

  // 1. Merge overlapping or touching segments
  const mergeIntervals = (intervals) => {
    if (!intervals.length) return [];
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [[...intervals[0]]];
    for (let i = 1; i < intervals.length; i++) {
      const last = merged[merged.length - 1];
      const curr = intervals[i];
      if (curr[0] <= last[1]) {
        last[1] = Math.max(last[1], curr[1]);
      } else {
        merged.push([...curr]);
      }
    }
    return merged;
  };

  const covers = (mergedList, targetStart, targetEnd) => {
    if (!mergedList) return false;
    for (const [start, end] of mergedList) {
      if (start <= targetStart && end >= targetEnd) return true;
      if (start > targetStart) break;
    }
    return false;
  };

  for (const [y, list] of hMap) hMap.set(y, mergeIntervals(list));
  for (const [x, list] of vMap) vMap.set(x, mergeIntervals(list));

  // 2. Build elementary grid from sorted unique coordinates
  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => a - b);
  const cols = xs.length - 1;
  const rows = ys.length - 1;

  if (cols <= 0 || rows <= 0) return [];

  // Helpers to check if a grid cell edge has a wall
  const hasTopWall = (c, r) => covers(hMap.get(ys[r]), xs[c], xs[c + 1]);
  const hasBottomWall = (c, r) => covers(hMap.get(ys[r + 1]), xs[c], xs[c + 1]);
  const hasLeftWall = (c, r) => covers(vMap.get(xs[c]), ys[r], ys[r + 1]);
  const hasRightWall = (c, r) => covers(vMap.get(xs[c + 1]), ys[r], ys[r + 1]);

  // 3. Flood-fill grid cells into connected regions
  const visited = Array.from({ length: rows }, () => new Uint8Array(cols));
  const boxes = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (visited[r][c]) continue;

      const queue = [[c, r]];
      visited[r][c] = 1;
      let minC = c,
        maxC = c,
        minR = r,
        maxR = r;
      let cellCount = 0;

      while (queue.length > 0) {
        const [currC, currR] = queue.shift();
        cellCount++;
        minC = Math.min(minC, currC);
        maxC = Math.max(maxC, currC);
        minR = Math.min(minR, currR);
        maxR = Math.max(maxR, currR);

        // Move Up if no top wall
        if (
          currR > 0 &&
          !visited[currR - 1][currC] &&
          !hasTopWall(currC, currR)
        ) {
          visited[currR - 1][currC] = 1;
          queue.push([currC, currR - 1]);
        }
        // Move Down if no bottom wall
        if (
          currR < rows - 1 &&
          !visited[currR + 1][currC] &&
          !hasBottomWall(currC, currR)
        ) {
          visited[currR + 1][currC] = 1;
          queue.push([currC, currR + 1]);
        }
        // Move Left if no left wall
        if (
          currC > 0 &&
          !visited[currR][currC - 1] &&
          !hasLeftWall(currC, currR)
        ) {
          visited[currR][currC - 1] = 1;
          queue.push([currC - 1, currR]);
        }
        // Move Right if no right wall
        if (
          currC < cols - 1 &&
          !visited[currR][currC + 1] &&
          !hasRightWall(currC, currR)
        ) {
          visited[currR][currC + 1] = 1;
          queue.push([currC + 1, currR]);
        }
      }

      // 4. Verify the region is a solid rectangle and fully closed on all 4 sides
      const expectedCells = (maxC - minC + 1) * (maxR - minR + 1);
      if (cellCount !== expectedCells) continue;

      let isClosed = true;
      for (let i = minC; i <= maxC; i++) {
        if (!hasTopWall(i, minR) || !hasBottomWall(i, maxR)) {
          isClosed = false;
          break;
        }
      }
      if (!isClosed) continue;

      for (let j = minR; j <= maxR; j++) {
        if (!hasLeftWall(minC, j) || !hasRightWall(maxC, j)) {
          isClosed = false;
          break;
        }
      }

      if (isClosed) {
        boxes.push({
          x: xs[minC],
          y: ys[minR],
          width: xs[maxC + 1] - xs[minC],
          height: ys[maxR + 1] - ys[minR],
        });
      }
    }
  }

  return [lines, boxes];
}

function colorAndDrawBoxes(ctx, boxes, palette) {
  if (boxes === undefined) return;
  const n = boxes.length;
  if (n === 0) return;

  // 1. Build adjacency list (boxes sharing a border segment of length > 0)
  const adj = Array.from({ length: n }, () => []);

  const shareBorder = (a, b) => {
    const touchX = a.x + a.width === b.x || b.x + b.width === a.x;
    const overlapY =
      Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height);
    if (touchX && overlapY) return true;

    const touchY = a.y + a.height === b.y || b.y + b.height === a.y;
    const overlapX =
      Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width);
    if (touchY && overlapX) return true;

    return false;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (shareBorder(boxes[i], boxes[j])) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  // 2. Order nodes by degree descending (most constrained boxes first)
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => adj[b].length - adj[a].length,
  );

  const assignedColor = new Array(n).fill(-1);
  const maxColors = Math.min(4, palette.length);

  const isSafe = (node, colorIdx) => {
    for (const neighbor of adj[node]) {
      if (assignedColor[neighbor] === colorIdx) return false;
    }
    return true;
  };

  // 3. Backtracking solver
  const solve = (step) => {
    if (step === n) return true;
    const node = order[step];

    for (let c = 0; c < maxColors; c++) {
      if (isSafe(node, c)) {
        assignedColor[node] = c;
        if (solve(step + 1)) return true;
        assignedColor[node] = -1;
      }
    }
    return false;
  };

  const fullSuccess = solve(0);

  // Fallback: If palette has fewer than 4 colors and a full solution failed,
  // greedily assign colors where possible and leave uncolorable boxes blank (-1)
  if (!fullSuccess) {
    assignedColor.fill(-1);
    for (const node of order) {
      for (let c = 0; c < maxColors; c++) {
        if (isSafe(node, c)) {
          assignedColor[node] = c;
          break;
        }
      }
    }
  }

  // 4. Fill colored boxes and redraw crisp borders on top
  for (let i = 0; i < n; i++) {
    const box = boxes[i];
    const colorIdx = assignedColor[i];

    if (colorIdx !== -1) {
      ctx.fillStyle = palette[colorIdx];
      ctx.fillRect(box.x, box.y, box.width, box.height);
    }

    // Redraw box border so the fill doesn't cover your black lines
    ctx.strokeRect(box.x, box.y, box.width, box.height);
  }
}

function drawLines(ctx, lines) {
  if (lines === undefined) return;

  ctx.beginPath();
  for (const line of lines) {
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
  }
  ctx.stroke();
}

function drawCanvas(canvas, lines = [], boxes = []) {
  const maxLines = 80;
  const numberOfLines = Math.floor(Math.random() * maxLines) + 1;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (
    lines === undefined ||
    lines.length === 0 ||
    boxes === undefined ||
    boxes.length === 0
  ) {
    const [lines, boxes] = getLinesAndBoxes(canvas, numberOfLines);
    STATE.lines = lines;
    STATE.boxes = boxes;
  }

  colorAndDrawBoxes(context, STATE.boxes, STATE.colors);
  drawLines(context, STATE.lines);

  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
  }
  link.href = canvas.toDataURL("image/png");
}

function randRgb() {
  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);
  return { r: r, g: g, b: b };
}

function randHsl() {
  const rgb = randRgb();
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    switch (mx) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function rgbToHex(r, g, b) {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function single(h, s, l) {
  return [{ h, s, l }];
}

function complementary(h, s, l) {
  return [
    { h, s, l },
    { h: (h + 180) % 360, s, l },
  ];
}

function splitComplementary(h, s, l) {
  return [0, 150, 210].map((offset) => ({
    h: (((h + offset) % 360) + 360) % 360,
    s,
    l,
  }));
}

function tetradic(h, s, l) {
  return [0, 90, 180, 270].map((offset) => ({
    h: (((h + offset) % 360) + 360) % 360,
    s,
    l,
  }));
}

function analogous(h, s, l) {
  return [-60, -30, 0, 30, 60].map((offset) => ({
    h: (((h + offset) % 360) + 360) % 360,
    s,
    l,
  }));
}

const colorGenerators = {
  1: single,
  2: complementary,
  3: splitComplementary,
  4: tetradic,
  5: analogous,
};

const STATE = {
  colors: ["#db0e0e", "#d8b40f", "#0f26d1", "#9fa2a2"],
  lines: [],
  boxes: [],
  is_playing: false,
};

function updateColorsForLayout(canvas, nbColors) {
  // Update colors, but keep the same layout.
  const hsl = randHsl();
  const newColors = colorGenerators[`${nbColors}`](hsl.h, hsl.s, hsl.l)
    .map((hsl) => hslToRgb(hsl.h, hsl.s, hsl.l))
    .map((rgb) => rgbToHex(rgb.r, rgb.g, rgb.b));
  STATE.colors = newColors;
  drawCanvas(canvas, STATE.lines, STATE.boxes);
}

function changeColorsForLayout(canvas) {
  const hsl = randHsl();
  let nbColorsKey = `${STATE.colors.length}`;
  const newColors = colorGenerators[nbColorsKey](hsl.h, hsl.s, hsl.l)
    .map((hsl) => hslToRgb(hsl.h, hsl.s, hsl.l))
    .map((rgb) => rgbToHex(rgb.r, rgb.g, rgb.b));
  STATE.colors = newColors;
  drawCanvas(canvas, STATE.lines, STATE.boxes);
}

function automateChanges(canvas) {
  setTimeout(() => {
    if (!STATE.is_playing) {
      return;
    }

    let val = Math.random();
    if (val <= 0.4) {
      changeColorsForLayout(canvas);
    } else if (val <= 0.6) {
      const newColorCount = Math.floor(Math.random() * 3) + 1;
      const hsl = randHsl();
      const newColors = colorGenerators[`${newColorCount}`](hsl.h, hsl.s, hsl.l)
        .map((hsl) => hslToRgb(hsl.h, hsl.s, hsl.l))
        .map((rgb) => rgbToHex(rgb.r, rgb.g, rgb.b));
      STATE.colors = newColors;
      drawCanvas(canvas);
    } else {
      // change lines only
      drawCanvas(canvas);
    }

    automateChanges(canvas);
  }, 1000);
}

function saveCanvas(canvas, anchorId) {
  const a = document.getElementById(anchorId);
  if (a === null) {
    return;
  }
  a.setAttribute("download", "mystijl-export.png");
  // here is the most important part because if you dont replace you will get a DOM 18 exception.
  a.setAttribute(
    "href",
    canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"),
  );
  a.click();
}

// eslint-disable-next-line no-unused-vars
function initCanvas(elementId) {
  const canvas = document.getElementById(elementId);
  if (canvas === null) {
    console.log(`No element with id '${elementId}' exists.`);
    return;
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  window.onresize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawCanvas(canvas);
  };

  const parent = canvas.parentElement;
  const canvasAnchorName = `${elementId}-image-download-anchor`;
  if (parent !== null) {
    const a = document.createElement("a");
    a.setAttribute("id", canvasAnchorName);
    parent.appendChild(a);
  }

  window.addEventListener("keyup", (evt) => {
    if (["s", "S"].includes(evt.key)) {
      saveCanvas(canvas, canvasAnchorName);
      return;
    }

    if (STATE.is_playing && !["p", "P"].includes(evt.key)) {
      return;
    }

    if (["1", "2", "3", "4", "5"].includes(evt.key)) {
      updateColorsForLayout(canvas, evt.key);
    } else if (["n", "N"].includes(evt.key)) {
      // Update lines, keep the same colors.
      drawCanvas(canvas);
    } else if (["c", "C"].includes(evt.key)) {
      changeColorsForLayout(canvas);
    } else if (["p", "P"].includes(evt.key)) {
      if (STATE.is_playing) {
        STATE.is_playing = false;
        return;
      }
      STATE.is_playing = true;

      automateChanges(canvas);
    }
  });

  drawCanvas(canvas);

  return canvas;
}
