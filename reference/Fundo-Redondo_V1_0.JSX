// ==========================================
// SCRIPT: Fundo Redondo v2.3
// Gera planta de embalagem flexível com topo e fundo em curva, a partir de
// curvaturas Bezier extraídas do gabarito MÁXIMO (Modelo_Final.pdf, 460×370mm).
//
// FILOSOFIA DA CURVATURA: uma única CURVA MESTRE em mm absolutos cobre o
// tamanho máximo (370mm × 460mm). Para peças menores, a curva é APARADA —
// pega-se o recorte central de largura W dos 370mm da curva mestre. Os
// cantos da peça menor pousam EM CIMA da curva mestre, não na borda dela.
//
// Consequências:
//   - Peça 370×460: enxerga a curva INTEIRA (prof ~54mm)
//   - Peça 160×260: enxerga apenas os 160mm centrais (prof aparente ~11mm)
//   - Peça 120×170: enxerga apenas os 120mm centrais (prof aparente ~6mm)
//   - Peça 50×100: enxerga apenas os 50mm centrais (prof aparente ~1mm)
//
// Interpretação de parâmetros:
//   Comprimento = distância entre o PONTO MAIS BAIXO DO TOPO (vale superior)
//                 e o PONTO MAIS BAIXO DO FUNDO (vale inferior).
//   Distância de Fundo = da LINHA SUPERIOR DA SOLDA até o início da ARTE.
// ==========================================

function mm2pt(mm) { return mm * 2.83465; }

// Formata número como string com vírgula decimal (padrão BR)
function fmt(n) { return String(n).replace('.', ','); }

// Formata número com até 2 casas decimais e vírgula (para cotas calculadas).
// Se o número for inteiro (ex.: 210), retorna "210" (sem vírgula nem zeros).
// Se tiver decimais significativos (ex.: 198.98), retorna "198,98".
function fmt2(n) {
    var r = Math.round(n * 100) / 100;
    // Inteiro: sem vírgula
    if (r === Math.round(r)) return String(Math.round(r));
    // Decimal: 2 casas com vírgula
    var s = String(r);
    var parts = s.split('.');
    if (parts[1].length === 1) parts[1] += '0';
    return parts.join(',');
}

function cmyk(c, m, y, k) {
    var col = new CMYKColor();
    col.cyan = c; col.magenta = m; col.yellow = y; col.black = k;
    return col;
}

// Encontra Arial Bold iterando pelos fontes disponíveis
var _arialBold = null;
function getArialBold() {
    if (_arialBold) return _arialBold;
    var fonts = app.textFonts;
    for (var i = 0; i < fonts.length; i++) {
        var f = fonts[i];
        if (f.family === "Arial" && f.style === "Bold") {
            _arialBold = f;
            return f;
        }
    }
    return null;
}

function applyArialBold(t) {
    var f = getArialBold();
    if (f) try { t.textRange.characterAttributes.textFont = f; } catch(e) {}
}

// ============================================================
// CURVA MESTRE (extraída de Modelo_Final.pdf, peça máxima 460×370mm)
// Coordenadas em mm ABSOLUTOS com origem no canto superior/inferior esquerdo.
// Percorrida da ESQUERDA para a DIREITA em ambos os casos.
// Curvas agora são SIMÉTRICAS (pontas esq e dir batem nos extremos x=0 e x=370).
//   x: 0 (esquerda) a 370 (direita) em mm
//   y: profundidade em mm abaixo da linha dos cantos (positivo = mais fundo)
// ============================================================
var MASTER_W_MM = 370.00;

// Curva MESTRE do TOPO (2 segmentos Bezier, simétricos)
// y=0 quando a curva toca a linha dos cantos superiores
var MASTER_TOP_CURVE_MM = [
    [[  0.000,  0.000], [ 66.658, 35.905], [125.278, 53.702], [184.876, 53.295]],
    [[185.124, 53.295], [244.721, 53.702], [303.341, 35.905], [370.000,  0.000]]
];

// Curva MESTRE do FUNDO (4 segmentos Bezier, simétricos)
// y=0 quando a curva toca a linha dos cantos inferiores
var MASTER_BOTTOM_CURVE_MM = [
    [[  0.000,  0.000], [ 58.916, 31.839], [111.367, 49.121], [166.654, 53.532]],
    [[166.654, 53.532], [172.685, 53.904], [178.801, 54.062], [185.000, 54.015]],
    [[185.000, 54.015], [191.198, 54.062], [197.314, 53.904], [203.346, 53.532]],
    [[203.346, 53.532], [258.632, 49.121], [311.084, 31.839], [370.000,  0.000]]
];

// Limites do gabarito (maior peça possível)
var MAX_W_MM = 370.0;
var MAX_C_MM = 460.0;  // comprimento máximo (vale-a-vale)

// Densidade de amostragem da curva mestre (mais = mais suave e preciso)
var BEZIER_SEGMENTS = 80;

// Caches (calculados uma vez)
var _topSamples = null;
var _botSamples = null;
var _maxTopMM = null;
var _maxBotMM = null;

function _getTopSamples() {
    if (_topSamples === null) {
        _topSamples = bezierChainPoints(MASTER_TOP_CURVE_MM, BEZIER_SEGMENTS);
    }
    return _topSamples;
}
function _getBotSamples() {
    if (_botSamples === null) {
        _botSamples = bezierChainPoints(MASTER_BOTTOM_CURVE_MM, BEZIER_SEGMENTS);
    }
    return _botSamples;
}

function _computeMax(samples) {
    var m = 0;
    for (var i = 0; i < samples.length; i++) {
        if (samples[i][1] > m) m = samples[i][1];
    }
    return m;
}
function _getMaxTopMM() {
    if (_maxTopMM === null) _maxTopMM = _computeMax(_getTopSamples());
    return _maxTopMM;
}
function _getMaxBotMM() {
    if (_maxBotMM === null) _maxBotMM = _computeMax(_getBotSamples());
    return _maxBotMM;
}

// Interpolação linear em amostras ordenadas por x (ascendente)
function _interpY(samples, xTarget) {
    if (xTarget <= samples[0][0]) return samples[0][1];
    if (xTarget >= samples[samples.length - 1][0]) return samples[samples.length - 1][1];
    for (var i = 0; i < samples.length - 1; i++) {
        var x1 = samples[i][0], x2 = samples[i + 1][0];
        if (x1 <= xTarget && xTarget <= x2) {
            if (x2 - x1 < 1e-9) return samples[i][1];
            var t = (xTarget - x1) / (x2 - x1);
            return samples[i][1] + t * (samples[i + 1][1] - samples[i][1]);
        }
    }
    return samples[samples.length - 1][1];
}

// Profundidade APARENTE da curva do topo/fundo para uma peça de largura W
// (= distância do canto ao vale da curva)
function getDepthTopMM(widthMM) {
    if (widthMM > MASTER_W_MM) widthMM = MASTER_W_MM;
    var xL = (MASTER_W_MM - widthMM) / 2;
    var xR = (MASTER_W_MM + widthMM) / 2;
    var cornerY = (_interpY(_getTopSamples(), xL) + _interpY(_getTopSamples(), xR)) / 2;
    return _getMaxTopMM() - cornerY;
}
function getDepthBotMM(widthMM) {
    if (widthMM > MASTER_W_MM) widthMM = MASTER_W_MM;
    var xL = (MASTER_W_MM - widthMM) / 2;
    var xR = (MASTER_W_MM + widthMM) / 2;
    var cornerY = (_interpY(_getBotSamples(), xL) + _interpY(_getBotSamples(), xR)) / 2;
    return _getMaxBotMM() - cornerY;
}

// Quantos sub-pontos por segmento Bezier (maior = mais suave)
var BEZIER_SEGMENTS = 40;

// --- FUNÇÕES DE DESENHO BÁSICAS ---
function drawRect(layer, top, left, w, h, color) {
    var rect = layer.pathItems.rectangle(top, left, w, h);
    rect.filled = true; rect.stroked = false; rect.fillColor = color;
    return rect;
}

function drawLine(layer, x1, y1, x2, y2, color, strokeW, dashed) {
    var line = layer.pathItems.add();
    line.setEntirePath([[x1, y1], [x2, y2]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;
    if (dashed) line.strokeDashes = [5, 5];
    return line;
}

function drawPolyline(layer, pts, color, dashed) {
    var line = layer.pathItems.add();
    line.setEntirePath(pts);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;
    line.closed = false;
    if (dashed) line.strokeDashes = [5, 5];
    return line;
}

// --- FUNÇÕES BEZIER / GEOMETRIA DO POUCH ---
// Avalia um ponto de uma curva Bezier cúbica em t ∈ [0, 1]
function bezierAt(p0, cp1, cp2, p3, t) {
    var u = 1 - t;
    var x = u*u*u*p0[0] + 3*u*u*t*cp1[0] + 3*u*t*t*cp2[0] + t*t*t*p3[0];
    var y = u*u*u*p0[1] + 3*u*u*t*cp1[1] + 3*u*t*t*cp2[1] + t*t*t*p3[1];
    return [x, y];
}

// Gera pontos de uma sequência de curvas Bezier.
// Cada segmento é [P0, CP1, CP2, P3] em coordenadas normalizadas.
// O ponto final de um segmento coincide com o inicial do próximo — por isso
// pulamos o índice 0 a partir do segundo segmento, evitando duplicatas.
function bezierChainPoints(curves, segments) {
    var pts = [];
    for (var i = 0; i < curves.length; i++) {
        var seg = curves[i];
        var start = (i === 0) ? 0 : 1;
        for (var j = start; j <= segments; j++) {
            var t = j / segments;
            pts.push(bezierAt(seg[0], seg[1], seg[2], seg[3], t));
        }
    }
    return pts;
}


// ============================================================
// GEOMETRIA BEZIER: trim + subdivisão + construção de paths com nós reais
// Usado para produzir curvas no Illustrator com POUCOS nós (ao invés de
// polilinha densa com muitos pontos). Os segmentos Bezier da curva mestre
// são aparados em x=[xL, xR] via De Casteljau, depois transladados para
// coordenadas do Illustrator.
// ============================================================

// Interpolação linear entre dois pontos 2D
function _lerp(a, b, t) {
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

// Avalia a coord X de uma Bezier cúbica em t
function _bezXAt(seg, t) {
    var u = 1 - t, u2 = u * u, t2 = t * t;
    return u2 * u * seg[0][0] + 3 * u2 * t * seg[1][0] + 3 * u * t2 * seg[2][0] + t2 * t * seg[3][0];
}

// Subdivisão De Casteljau: retorna [parte_esquerda, parte_direita]
function _subdivBez(seg, t) {
    var p0 = seg[0], p1 = seg[1], p2 = seg[2], p3 = seg[3];
    var q0 = _lerp(p0, p1, t);
    var q1 = _lerp(p1, p2, t);
    var q2 = _lerp(p2, p3, t);
    var r0 = _lerp(q0, q1, t);
    var r1 = _lerp(q1, q2, t);
    var s  = _lerp(r0, r1, t);
    return [[p0, q0, r0, s], [s, r1, q2, p3]];
}

// Encontra t tal que x(t) = targetX (busca binária; assume x monotônico)
function _findTForX(seg, targetX) {
    if (targetX <= seg[0][0]) return 0;
    if (targetX >= seg[3][0]) return 1;
    var lo = 0, hi = 1;
    for (var i = 0; i < 60; i++) {
        var mid = (lo + hi) / 2;
        var x = _bezXAt(seg, mid);
        if (Math.abs(x - targetX) < 1e-6) return mid;
        if (x < targetX) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

// Apara uma cadeia de segmentos Bezier ao intervalo x=[xL, xR]. Retorna
// nova cadeia de segmentos cobrindo exatamente esse intervalo.
function _trimBezChain(masterSegs, xL_mm, xR_mm) {
    var out = [];
    for (var i = 0; i < masterSegs.length; i++) {
        var seg = masterSegs[i];
        var sX0 = seg[0][0], sX3 = seg[3][0];
        if (sX3 <= xL_mm + 1e-6 || sX0 >= xR_mm - 1e-6) continue;

        var cur = seg;
        if (sX0 < xL_mm) {
            cur = _subdivBez(cur, _findTForX(cur, xL_mm))[1];
        }
        if (cur[3][0] > xR_mm) {
            cur = _subdivBez(cur, _findTForX(cur, xR_mm))[0];
        }
        out.push(cur);
    }
    return out;
}

// Inverte um segmento Bezier (troca direção da curva)
function _revBez(seg) { return [seg[3], seg[2], seg[1], seg[0]]; }

// Inverte a ordem de uma cadeia de segmentos Bezier (e inverte cada um)
function _revBezChain(segs) {
    var out = [];
    for (var i = segs.length - 1; i >= 0; i--) out.push(_revBez(segs[i]));
    return out;
}

// Transforma segmentos Bezier de coords MASTER mm para coords ILLUSTRATOR pt.
// xStartPt     = Illustrator x correspondente a master x = masterOriginXMM
// masterOriginXMM = valor de master x no canto esquerdo da peça
// yBase        = Illustrator y onde master y = cornerY (yTop ou yCantosBot)
// cornerY      = master y no canto da peça (profundidade relativa)
// offsetSignedPt = offset em pts aplicado ao Y (negativo para cima no Illustrator);
//                  para TOPO usar -yOffsetPt (offset pra dentro = baixo no Illustrator)
//                  para FUNDO usar +yOffsetPt (offset pra dentro = cima no Illustrator)
function _transformSegsToPt(segs, xStartPt, masterOriginXMM, yBase, cornerY, offsetSignedPt) {
    if (!offsetSignedPt) offsetSignedPt = 0;
    var out = [];
    for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        var t = [];
        for (var j = 0; j < 4; j++) {
            var p = seg[j];
            var px = xStartPt + mm2pt(p[0] - masterOriginXMM);
            var py = yBase - mm2pt(p[1] - cornerY) + offsetSignedPt;
            t.push([px, py]);
        }
        out.push(t);
    }
    return out;
}

// Adiciona pontos Bezier a um pathItem a partir de uma cadeia de segmentos.
// segsPt: array de [[p0, cp1, cp2, p3], ...] em coords Illustrator (pontos).
// closed: se true, não fecha os endpoints com leftDir/rightDir internos
//         (usado quando o path continua com outra cadeia de segmentos);
//         se false (cadeia aberta), endpoints têm dir=anchor (sem tangente).
// continuesFrom: se true, o primeiro ponto tem leftDir = cp2 do último seg
//                anterior (permitindo que duas cadeias se conectem com tangente).
//                Normalmente false para material/arte (cantos são corners).
function _addBezSegsToPath(pathItem, segsPt) {
    if (segsPt.length === 0) return;
    function addPt(anchor, lDir, rDir) {
        var pp = pathItem.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
        pp.pointType = PointType.SMOOTH;
    }
    // Primeiro ponto: anchor = seg[0].p0; leftDir = anchor; rightDir = seg[0].cp1
    addPt(segsPt[0][0], segsPt[0][0], segsPt[0][1]);
    // Pontos intermediários (junções entre segmentos)
    for (var i = 0; i < segsPt.length - 1; i++) {
        addPt(segsPt[i][3], segsPt[i][2], segsPt[i+1][1]);
    }
    // Último ponto: anchor = seg[last].p3; leftDir = seg[last].cp2; rightDir = anchor
    var last = segsPt.length - 1;
    addPt(segsPt[last][3], segsPt[last][2], segsPt[last][3]);
}

// Desenha uma curva Bezier aberta (open path) em um layer ou grupo.
// Usa os segmentos Bezier diretamente como nós do path.
function drawBezierOpen(layer, segsPt, strokeColor, dashed) {
    var p = layer.pathItems.add();
    _addBezSegsToPath(p, segsPt);
    p.closed = false;
    p.filled = false;
    p.stroked = true;
    p.strokeColor = strokeColor;
    p.strokeWidth = 1;
    if (dashed) p.strokeDashes = [5, 5];
    return p;
}

// Desenha o contorno do material como path fechado preenchido, usando Bezier real.
// Wmm = largura (mm), Cmm = comprimento vale-a-vale (mm).
// yTop = Y dos cantos superiores.
function drawMaterial(layer, xL, yTop, Wmm, Cmm, color) {
    if (Wmm > MASTER_W_MM) Wmm = MASTER_W_MM;
    var Cpt = mm2pt(Cmm);
    var dTopoPt  = mm2pt(getDepthTopMM(Wmm));
    var dFundoPt = mm2pt(getDepthBotMM(Wmm));

    var yTopoCentro   = yTop - dTopoPt;
    var yFundoExtremo = yTopoCentro - Cpt;
    var yCantosFundo  = yFundoExtremo + dFundoPt;

    var masterXL = (MASTER_W_MM - Wmm) / 2;
    var masterXR = (MASTER_W_MM + Wmm) / 2;

    var topCornerY = (_interpY(_getTopSamples(), masterXL) + _interpY(_getTopSamples(), masterXR)) / 2;
    var botCornerY = (_interpY(_getBotSamples(), masterXL) + _interpY(_getBotSamples(), masterXR)) / 2;

    var topSegsMM = _trimBezChain(MASTER_TOP_CURVE_MM,    masterXL, masterXR);
    var botSegsMM = _trimBezChain(MASTER_BOTTOM_CURVE_MM, masterXL, masterXR);

    var topSegsPt = _transformSegsToPt(topSegsMM, xL, masterXL, yTop,          topCornerY, 0);
    var botSegsPt = _transformSegsToPt(botSegsMM, xL, masterXL, yCantosFundo,  botCornerY, 0);
    var botSegsPtRL = _revBezChain(botSegsPt);

    var p = layer.pathItems.add();
    _addBezSegsToPath(p, topSegsPt);
    _addBezSegsToPath(p, botSegsPtRL);
    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Material";
    return p;
}

// --- FUNÇÕES DE COTAS ---
function drawCotaH(layer, x1, x2, y, textStr, color, fontSize, verticalLabel) {
    if (fontSize === undefined) fontSize = 12;
    var tickH = mm2pt(1);
    var group = layer.groupItems.add();

    var line = group.pathItems.add();
    line.setEntirePath([[x1, y], [x2, y]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;

    var b1 = group.pathItems.add();
    b1.setEntirePath([[x1, y + tickH], [x1, y - tickH]]);
    b1.filled = false; b1.stroked = true;
    b1.strokeColor = color; b1.strokeWidth = 1;

    var b2 = group.pathItems.add();
    b2.setEntirePath([[x2, y + tickH], [x2, y - tickH]]);
    b2.filled = false; b2.stroked = true;
    b2.strokeColor = color; b2.strokeWidth = 1;

    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.top  = y + mm2pt(2) + t.height;
        t.left = x1 + ((x2 - x1) / 2) - (t.width / 2);
    }

    if (verticalLabel !== undefined && verticalLabel !== "") {
        var vt = group.textFrames.add();
        vt.contents = verticalLabel;
        vt.textRange.characterAttributes.size = fontSize;
        applyArialBold(vt);
        try { vt.textRange.characterAttributes.fillColor = color; } catch(e) {}
        vt.rotate(90);
        vt.top  = y + mm2pt(5) + vt.height;
        vt.left = x1 + ((x2 - x1) / 2) - (vt.width / 2);
    }
}

function drawCotaV(layer, x, y1, y2, textStr, color, fontSize, centered) {
    if (fontSize === undefined) fontSize = 12;
    if (centered === undefined) centered = false;
    var tickW = mm2pt(1);
    var group = layer.groupItems.add();

    var line = group.pathItems.add();
    line.setEntirePath([[x, y1], [x, y2]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;

    var b1 = group.pathItems.add();
    b1.setEntirePath([[x - tickW, y1], [x + tickW, y1]]);
    b1.filled = false; b1.stroked = true;
    b1.strokeColor = color; b1.strokeWidth = 1;

    var b2 = group.pathItems.add();
    b2.setEntirePath([[x - tickW, y2], [x + tickW, y2]]);
    b2.filled = false; b2.stroked = true;
    b2.strokeColor = color; b2.strokeWidth = 1;

    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.rotate(90);
        t.top  = (y1 + y2) / 2 + (t.height / 2);
        t.left = centered ? (x - t.width / 2) : (x - mm2pt(2) - t.width);
    }
}

function addText(layer, txt, x, y, size, color, rot) {
    var t = layer.textFrames.add();
    t.contents = txt;
    t.textRange.characterAttributes.size = size;
    applyArialBold(t);
    try { t.textRange.characterAttributes.fillColor = color; } catch (e) {}
    if (rot) {
        t.rotate(rot);
        t.top  = y + t.height;
        t.left = x - (t.width / 2);
    } else {
        t.top  = y + (t.height / 2);
        t.left = x - (t.width  / 2);
    }
}

// --- INTERFACE ---
var dlg = new Window("dialog", "Gerador: Fundo Redondo");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group"); g1.add("statictext", undefined, "Comprimento (mm):");
var inputComp = g1.add("edittext", undefined, "260"); inputComp.characters = 5;

var g2 = dlg.add("group"); g2.add("statictext", undefined, "Largura (mm):");
var inputLarg = g2.add("edittext", undefined, "160"); inputLarg.characters = 5;

var g5 = dlg.add("group"); g5.alignChildren = "right";
var inputFrente = g5.add("checkbox", undefined, "Somente frente");

// --- Tamanho do queijo (toggle + painel) ---
var gQueijoChk = dlg.add("group"); gQueijoChk.alignChildren = "right";
var inputQueijo = gQueijoChk.add("checkbox", undefined, "Tamanho do queijo");

var panelQueijo = dlg.add("panel", undefined, "Dimensões do queijo");
panelQueijo.orientation = "column"; panelQueijo.alignChildren = "right";
panelQueijo.margins = 12; panelQueijo.visible = false;

var gqDiam = panelQueijo.add("group"); gqDiam.add("statictext", undefined, "Diâmetro (mm):");
var inputQDiam = gqDiam.add("edittext", undefined, "120"); inputQDiam.characters = 5;
gqDiam.visible = false;  // só aparece quando "Queijo redondo" está marcado

var gq1 = panelQueijo.add("group"); gq1.add("statictext", undefined, "Comprimento (mm):");
var inputQComp = gq1.add("edittext", undefined, "140"); inputQComp.characters = 5;

var gq2 = panelQueijo.add("group"); gq2.add("statictext", undefined, "Largura (mm):");
var inputQLarg = gq2.add("edittext", undefined, "80"); inputQLarg.characters = 5;

var gq3 = panelQueijo.add("group"); gq3.add("statictext", undefined, "Altura (mm):");
var inputQAlt = gq3.add("edittext", undefined, "50"); inputQAlt.characters = 5;

var gq4 = panelQueijo.add("group"); gq4.add("statictext", undefined, "Recuo da arte (mm):");
var inputRecuo = gq4.add("edittext", undefined, "5"); inputRecuo.characters = 5;

var gqRedondo = panelQueijo.add("group"); gqRedondo.alignChildren = "right";
var inputQRedondo = gqRedondo.add("checkbox", undefined, "Queijo redondo");

// --- Tamanho da arte (toggle + painel) — mutuamente exclusivo com queijo ---
var gArteChk = dlg.add("group"); gArteChk.alignChildren = "right";
var inputArte = gArteChk.add("checkbox", undefined, "Tamanho da arte");

var panelArte = dlg.add("panel", undefined, "Dimensões da arte");
panelArte.orientation = "column"; panelArte.alignChildren = "right";
panelArte.margins = 12; panelArte.visible = false;

// --- FRENTE ---
var gLabelF = panelArte.add("group"); gLabelF.alignChildren = "left";
var lblF = gLabelF.add("statictext", undefined, "Frente:");
try { lblF.graphics.font = ScriptUI.newFont(lblF.graphics.font.name, "BOLD", lblF.graphics.font.size); } catch(e) {}

var gaDiamF = panelArte.add("group"); gaDiamF.add("statictext", undefined, "Diâmetro (mm):");
var inputADiamF = gaDiamF.add("edittext", undefined, "120"); inputADiamF.characters = 5;
gaDiamF.visible = false;

var ga1F = panelArte.add("group"); ga1F.add("statictext", undefined, "Tamanho (mm):");
var inputATamF = ga1F.add("edittext", undefined, "180"); inputATamF.characters = 5;

var ga2F = panelArte.add("group"); ga2F.add("statictext", undefined, "Largura (mm):");
var inputALargF = ga2F.add("edittext", undefined, "120"); inputALargF.characters = 5;

var gaFundoF = panelArte.add("group"); gaFundoF.add("statictext", undefined, "Distância de fundo (mm):");
var inputAFundoF = gaFundoF.add("edittext", undefined, "10"); inputAFundoF.characters = 5;

// --- VERSO (escondido quando "Somente frente" marcado) ---
var gLabelV = panelArte.add("group"); gLabelV.alignChildren = "left";
var lblV = gLabelV.add("statictext", undefined, "Verso:");
try { lblV.graphics.font = ScriptUI.newFont(lblV.graphics.font.name, "BOLD", lblV.graphics.font.size); } catch(e) {}

var gaDiamV = panelArte.add("group"); gaDiamV.add("statictext", undefined, "Diâmetro (mm):");
var inputADiamV = gaDiamV.add("edittext", undefined, "110"); inputADiamV.characters = 5;
gaDiamV.visible = false;

var ga1V = panelArte.add("group"); ga1V.add("statictext", undefined, "Tamanho (mm):");
var inputATamV = ga1V.add("edittext", undefined, "170"); inputATamV.characters = 5;

var ga2V = panelArte.add("group"); ga2V.add("statictext", undefined, "Largura (mm):");
var inputALargV = ga2V.add("edittext", undefined, "110"); inputALargV.characters = 5;

var gaFundoV = panelArte.add("group"); gaFundoV.add("statictext", undefined, "Distância de fundo (mm):");
var inputAFundoV = gaFundoV.add("edittext", undefined, "10"); inputAFundoV.characters = 5;

var gaRedonda = panelArte.add("group"); gaRedonda.alignChildren = "right";
var inputARedonda = gaRedonda.add("checkbox", undefined, "Arte redonda");

// --- Borda caída (visível apenas quando queijo está marcado) ---
var gBorda = dlg.add("group"); gBorda.alignChildren = "right"; gBorda.visible = false;
var inputBorda = gBorda.add("checkbox", undefined, "Borda caída");

inputQueijo.onClick = function() {
    if (this.value) {
        // Exclusão mútua: desmarca "Tamanho da arte" e esconde painel da arte
        inputArte.value = false;
        inputARedonda.value = false;
        panelArte.visible = false;
    }
    panelQueijo.visible = this.value;
    gBorda.visible = this.value;
    if (!this.value) {
        inputBorda.value = false;
        inputQRedondo.value = false;
        inputRecuo.enabled = true;
        gqDiam.visible = false;
        gq1.visible = true;
        gq2.visible = true;
    }
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputQRedondo.onClick = function() {
    // Queijo redondo: perguntar só Diâmetro (esconde Comp/Larg)
    gqDiam.visible = this.value;
    gq1.visible = !this.value;
    gq2.visible = !this.value;
    dlg.layout.layout(true);
    dlg.layout.resize();
};

function _updateArteVisibility() {
    if (!panelArte.visible) return;
    var redonda  = inputARedonda.value;
    var soFrente = inputFrente.value;

    gaDiamF.visible = redonda;
    ga1F.visible    = !redonda;
    ga2F.visible    = !redonda;

    gLabelV.visible = !soFrente;
    gaDiamV.visible = redonda && !soFrente;
    ga1V.visible    = !redonda && !soFrente;
    ga2V.visible    = !redonda && !soFrente;
    gaFundoV.visible = !soFrente;
}

inputArte.onClick = function() {
    if (this.value) {
        // Exclusão mútua: desmarca "Tamanho do queijo"
        inputQueijo.value = false;
        panelQueijo.visible = false;
        gBorda.visible = false;
        inputBorda.value = false;
        inputQRedondo.value = false;
        inputRecuo.enabled = true;
        gqDiam.visible = false; gq1.visible = true; gq2.visible = true;
    } else {
        inputARedonda.value = false;
    }
    panelArte.visible = this.value;
    _updateArteVisibility();
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputARedonda.onClick = function() {
    _updateArteVisibility();
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputFrente.onClick = function() {
    // Reflete em panelArte se estiver visível: esconde subseção Verso quando só frente
    _updateArteVisibility();
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputBorda.onClick = function() {
    // Borda caída fixa recuo em 5mm (tanto frente quanto verso) — desabilita o input
    inputRecuo.enabled = !this.value;
};

var grupoBotoes = dlg.add("group"); grupoBotoes.alignment = "center";
grupoBotoes.add("button", undefined, "Cancelar", { name: "cancel" });
grupoBotoes.add("button", undefined, "Gerar Planta", { name: "ok" });

// --- EXECUÇÃO ---
if (dlg.show() == 1) {
    var c = parseFloat(inputComp.text.replace(',', '.'));
    var l = parseFloat(inputLarg.text.replace(',', '.'));
    var s = 30; // selagem padrão fixa em 30mm (campo removido da UI)
    var f = 10; // distância de fundo padrão (modo A); sobrescrita em queijo/arte
    var r = parseFloat(inputRecuo.text.replace(',', '.'));
    var queijoData = null;
    var arteData = null;
    if (inputQueijo.value) {
        var qa = parseFloat(inputQAlt.text.replace(',', '.'));
        var qc, ql;
        if (inputQRedondo.value) {
            var qd = parseFloat(inputQDiam.text.replace(',', '.'));
            qc = qd; ql = qd;
        } else {
            qc = parseFloat(inputQComp.text.replace(',', '.'));
            ql = parseFloat(inputQLarg.text.replace(',', '.'));
        }
        if (isNaN(qc) || isNaN(ql) || isNaN(qa)) {
            alert("Erro: Digite valores válidos para o queijo.");
        } else {
            queijoData = {
                comp: qc, larg: ql, alt: qa,
                bordaCaida: inputBorda.value,
                redondo: inputQRedondo.value
            };
        }
        f = inputBorda.value ? 5 : 0;
        if (inputBorda.value) r = 5;
    } else if (inputArte.value) {
        var redonda = inputARedonda.value;
        var atF, alF, atV, alV;
        if (redonda) {
            atF = parseFloat(inputADiamF.text.replace(',', '.'));
            alF = atF;
            atV = parseFloat(inputADiamV.text.replace(',', '.'));
            alV = atV;
        } else {
            atF = parseFloat(inputATamF.text.replace(',', '.'));
            alF = parseFloat(inputALargF.text.replace(',', '.'));
            atV = parseFloat(inputATamV.text.replace(',', '.'));
            alV = parseFloat(inputALargV.text.replace(',', '.'));
        }
        var dfF = parseFloat(inputAFundoF.text.replace(',', '.'));
        var dfV = parseFloat(inputAFundoV.text.replace(',', '.'));
        var soFrente = inputFrente.value;
        var frenteOk = !isNaN(atF) && !isNaN(alF) && !isNaN(dfF);
        var versoOk  = soFrente || (!isNaN(atV) && !isNaN(alV) && !isNaN(dfV));
        if (!frenteOk || !versoOk) {
            alert("Erro: Digite valores válidos para a arte.");
        } else {
            arteData = {
                redonda: redonda,
                frente: { tamanho: atF, largura: alF, distFundo: dfF },
                verso:  soFrente ? null : { tamanho: atV, largura: alV, distFundo: dfV }
            };
        }
    }
    if (isNaN(c) || isNaN(l) || isNaN(s) || isNaN(f) || isNaN(r)) {
        alert("Erro: Digite valores válidos.");
    } else if (inputFrente.value) {
        desenharFR_Frente(c, l, s, f, r, queijoData, arteData);
    } else {
        desenharFR_Duplo(c, l, s, f, r, queijoData, arteData);
    }
}

// --- LÓGICA: FRENTE + VERSO (duas faces lado a lado) ---
// recuoMM = recuo lateral/arte da frente em mm. Verso usa recuoMM + 5.
function desenharFR_Duplo(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt = mm2pt(largMM);
    var compPt = mm2pt(compMM);
    var dTopoPt = mm2pt(getDepthTopMM(largMM));
    var dFundoPt = mm2pt(getDepthBotMM(largMM));
    var gapFaces = mm2pt(40);

    if (!_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData)) return;

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
    var totalPouchW = (largPt * 2) + gapFaces;
    var totalPouchH = dTopoPt + compPt;
    var docW = totalPouchW + (marginX * 2);
    var docH = totalPouchH + (marginY * 2);

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;
    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // UM grupo top-level por categoria, compartilhado entre frente e verso
    var topMaterial = layerV1.groupItems.add(); topMaterial.name = "Material";
    var topArte     = layerV1.groupItems.add(); topArte.name     = "Arte";
    var topCotas    = layerV1.groupItems.add(); topCotas.name    = "Cotas";

    // Verso: no modo queijo sem borda caída usa recuoMM+5; em borda caída ou arte custom, usa o mesmo da frente.
    var versoRecuoMM = (queijoData && !queijoData.bordaCaida) ? recuoMM + 5 : recuoMM;
    _desenharFaceFR(topMaterial, topArte, topCotas, x0, y0,
                    largMM, compMM, selagemMM, fundoMM, recuoMM, "Frente", queijoData, arteData);
    _desenharFaceFR(topMaterial, topArte, topCotas, x0 + largPt + gapFaces, y0,
                    largMM, compMM, selagemMM, fundoMM, versoRecuoMM, "Verso", queijoData, arteData);

    app.redraw();
    alert("Fundo Redondo v3.8 (frente + verso) gerado com sucesso!");
}

// --- LÓGICA: SOMENTE FRENTE ---
function desenharFR_Frente(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt = mm2pt(largMM);
    var compPt = mm2pt(compMM);
    var dTopoPt = mm2pt(getDepthTopMM(largMM));

    if (!_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData)) return;

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
    var totalH = dTopoPt + compPt;
    var docW = largPt + (marginX * 2);
    var docH = totalH + (marginY * 2);

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;
    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - largPt) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalH) / 2;

    var topMaterial = layerV1.groupItems.add(); topMaterial.name = "Material";
    var topArte     = layerV1.groupItems.add(); topArte.name     = "Arte";
    var topCotas    = layerV1.groupItems.add(); topCotas.name    = "Cotas";

    _desenharFaceFR(topMaterial, topArte, topCotas, x0, y0,
                    largMM, compMM, selagemMM, fundoMM, recuoMM, "Frente", queijoData, arteData);

    app.redraw();
    alert("Fundo Redondo v3.8 (somente frente) gerado com sucesso!");
}

// --- VALIDAÇÃO ---
// compMM = distância vale-a-vale (topo ao fundo).
// recuoMM = recuo lateral da arte na frente. Verso = recuoMM + 5 (só em modo queijo sem borda).
// Limites: largura ≤ 370mm e comprimento ≤ 460mm (tamanho do gabarito máximo).
function _validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    if (largMM > MAX_W_MM) {
        alert("Erro: a largura máxima é " + fmt(MAX_W_MM) + " mm (limite do gabarito).");
        return false;
    }
    if (compMM > MAX_C_MM) {
        alert("Erro: o comprimento máximo é " + fmt(MAX_C_MM) + " mm (limite do gabarito).");
        return false;
    }
    if (recuoMM < 0) {
        alert("Erro: o recuo da arte deve ser maior ou igual a 0.");
        return false;
    }
    // Verso usa recuoMM + 5 em queijo sem borda
    var recuoMaxMM = recuoMM + 5;
    if (largMM - 2 * recuoMaxMM <= 0) {
        alert("Erro: recuo da arte muito grande para a largura.\n" +
              "Na frente: recuo = " + fmt(recuoMM) + " mm (arte = " + fmt2(largMM - 2 * recuoMM) + " mm).\n" +
              "No verso: recuo = " + fmt(recuoMaxMM) + " mm → arte = " + fmt2(largMM - 2 * recuoMaxMM) + " mm.");
        return false;
    }
    // arte mínima só é checada quando NÃO há queijo nem arte custom (modo A usa selagem+fundo fixos)
    if (!queijoData && !arteData) {
        var arteAlt = compMM - selagemMM - fundoMM - 10;  // 5 respiro + 5 solda = 10
        if (arteAlt < 5) {
            alert("Erro: o comprimento é insuficiente.\n" +
                  "Mínimo necessário: selagem (" + fmt(selagemMM) +
                  ") + fundo (" + fmt(fundoMM) + ") + solda+respiro (10) + 5 de arte = " +
                  fmt2(selagemMM + fundoMM + 10 + 5) + " mm.");
            return false;
        }
    }

    // Validação específica da ARTE CUSTOM (frente e verso, se houver)
    if (arteData) {
        var lados = [];
        lados.push({ nome: "frente", info: arteData.frente });
        if (arteData.verso) lados.push({ nome: "verso", info: arteData.verso });
        for (var li = 0; li < lados.length; li++) {
            var nm = lados[li].nome, inf = lados[li].info;
            if (inf.tamanho <= 0 || inf.largura <= 0) {
                alert("Erro: dimensões da arte (" + nm + ") devem ser positivas.");
                return false;
            }
            if (inf.distFundo < 0) {
                alert("Erro: a distância de fundo da arte (" + nm + ") deve ser ≥ 0.");
                return false;
            }
            if (inf.largura > largMM) {
                alert("Erro: a largura da arte (" + nm + ", " + fmt(inf.largura) +
                      " mm) é maior que a largura da peça (" + fmt(largMM) + " mm).");
                return false;
            }
            var espacoV_a = inf.tamanho + inf.distFundo;
            var espacoMaxV_a = compMM - 10 - 5;
            if (espacoV_a > espacoMaxV_a) {
                alert("Erro: a arte (" + nm + ") não cabe na peça.\n" +
                      "Tamanho + distância de fundo = " + fmt2(espacoV_a) + " mm.\n" +
                      "Espaço máximo disponível = " + fmt2(espacoMaxV_a) + " mm.");
                return false;
            }
        }
    }

    // Validação específica do queijo (se definido)
    if (queijoData) {
        if (queijoData.comp <= 0 || queijoData.larg <= 0 || queijoData.alt <= 0) {
            alert("Erro: dimensões do queijo devem ser positivas.");
            return false;
        }
        if (queijoData.larg > largMM) {
            alert("Erro: a largura do queijo (" + fmt(queijoData.larg) +
                  " mm) é maior que a largura da peça (" + fmt(largMM) + " mm).");
            return false;
        }
        // Altura do queijo vertical ocupada no design (comprimento + metade da altura)
        var espacoV = queijoData.comp + queijoData.alt / 2;
        var espacoMaxV = compMM - 10 - 5;  // compMM - solda (5+5) - pelo menos 5mm de selagem
        if (espacoV > espacoMaxV) {
            alert("Erro: o queijo não cabe na peça.\n" +
                  "Espaço ocupado pelo queijo (comp + altura/2) = " + fmt2(espacoV) + " mm.\n" +
                  "Espaço máximo disponível = " + fmt2(espacoMaxV) + " mm.");
            return false;
        }
        // Se não for borda caída, a arte dentro do queijo precisa de pelo menos alguma área (considerando verso)
        if (!queijoData.bordaCaida) {
            var minDim = recuoMaxMM * 2;
            if (queijoData.larg <= minDim) {
                alert("Erro: largura do queijo deve ser > " + fmt(minDim) + " mm (arte do verso = queijo − " + fmt(minDim) + ").");
                return false;
            }
            if (queijoData.comp <= minDim) {
                alert("Erro: comprimento do queijo deve ser > " + fmt(minDim) + " mm (arte do verso = queijo − " + fmt(minDim) + ").");
                return false;
            }
        }
    }
    return true;
}

// --- HELPER: desenha UMA face completa (material + arte + fotocélula + solda + cotas) ---
// Recebe os 3 grupos top-level (Material, Arte, Cotas) já criados — adiciona
// sub-grupos nomeados com `nomeGrupo` ("Frente" / "Verso") dentro de cada um.
// recuoMM = recuo lateral da arte (e offset da arte ao queijo em modos B/D).
// (xStart, yStart) = canto superior ESQUERDO do bounding-box da peça.
// yStart corresponde ao Y dos CANTOS SUPERIORES (ponto mais alto do material).
// compMM = distância do ponto mais baixo do topo ao ponto mais baixo do fundo.
function _desenharFaceFR(topMaterial, topArte, topCotas, xStart, yStart, largMM, compMM, selagemMM, fundoMM, recuoMM, nomeGrupo, queijoData, arteData) {
    var largPt    = mm2pt(largMM);
    var compPt    = mm2pt(compMM);
    var selagemPt = mm2pt(selagemMM);
    var fundoPt   = mm2pt(fundoMM);
    var margemLat = mm2pt(recuoMM);
    var isFrente  = (nomeGrupo === "Frente");

    // Profundidades aparentes variam com a largura (recorte central da mestre)
    var dTopoMM   = getDepthTopMM(largMM);
    var dFundoMM  = getDepthBotMM(largMM);
    var dTopoPt   = mm2pt(dTopoMM);
    var dFundoPt  = mm2pt(dFundoMM);

    var corFundo   = cmyk(15, 12, 12, 0);
    var corFaca    = cmyk(0, 0, 0, 60);
    var corCota    = cmyk(0, 0, 0, 60);
    var corCyan    = cmyk(70, 10, 16, 0);
    var corMagenta = cmyk(0, 100, 0, 0);
    var corPreto   = cmyk(0, 0, 0, 100);

    var xMatIni = xStart;
    var xMatFim = xStart + largPt;
    var yTopo          = yStart;                               // cantos superiores (Y máximo da peça)
    var yTopoCentro    = yTopo - dTopoPt;                      // vale superior
    var yFundoExtremo  = yTopoCentro - compPt;                 // vale inferior
    var yCantosFundo   = yFundoExtremo + dFundoPt;             // cantos inferiores (fim da lateral reta)

    // Linhas de referência no CENTRO da peça (usadas para cotas e queijo)
    var yLinhaBaixoSoldaCentro = yFundoExtremo + mm2pt(5);
    var yLinhaTopoSoldaCentro  = yFundoExtremo + mm2pt(10);

    // Sub-grupos desta face dentro de cada grupo top-level
    var groupMaterial = topMaterial.groupItems.add(); if (nomeGrupo) groupMaterial.name = nomeGrupo;
    var groupArte     = topArte.groupItems.add();     if (nomeGrupo) groupArte.name     = nomeGrupo;
    var groupCotas    = topCotas.groupItems.add();    if (nomeGrupo) groupCotas.name    = nomeGrupo;

    // ------------------------------------------------------------------
    // 1. MATERIAL (contorno curvo preenchido) — recorte central da mestre
    // ------------------------------------------------------------------
    drawMaterial(groupMaterial, xMatIni, yTopo, largMM, compMM, corFundo);

    // ------------------------------------------------------------------
    // 2. ARTE + (opcional) SIMULAÇÃO DO QUEIJO
    //
    // Modos:
    //   (A) Sem queijo                            → arte com topo E fundo CURVOS, recuo lateral = recuoMM
    //   (B) Queijo retangular, sem borda caída    → arte RETANGULAR, recuoMM dentro do queijo
    //   (C) Queijo retangular + borda caída       → arte curva (= A) + retângulo do queijo em Cotas
    //   (D) Queijo REDONDO, sem borda caída       → arte ELÍPTICA, recuoMM dentro do queijo
    //   (E) Queijo REDONDO + borda caída          → arte curva (= A) + elipse do queijo em Cotas
    //
    // Em todos os modos com queijo: desenha o queijo em MAGENTA TRACEJADO
    // dentro do grupo COTAS (linhas de referência, não fazem parte da arte).
    // ------------------------------------------------------------------

    // Limites master da ARTE quando curva (material encolhido recuoMM cada lado)
    var masterXL_piece = (MASTER_W_MM - largMM) / 2;
    var masterXR_piece = (MASTER_W_MM + largMM) / 2;
    var arteXL_master = masterXL_piece + recuoMM;
    var arteXR_master = masterXR_piece - recuoMM;
    var topCornerY_piece = (_interpY(_getTopSamples(), masterXL_piece) + _interpY(_getTopSamples(), masterXR_piece)) / 2;
    var botCornerY_piece = (_interpY(_getBotSamples(), masterXL_piece) + _interpY(_getBotSamples(), masterXR_piece)) / 2;

    // Variáveis que dependem do modo — precisam ser acessíveis para as cotas
    var yArteTopCentro, yArteBotCentro;
    var arteLeftCota, arteRightCota, arteWidthMM;
    var distFundoEfetivoMM, arteAltEfetivaMM, selagemEfetivaMM;

    // Helper local: coords do retângulo/elipse do queijo
    function _queijoBBox() {
        var xC = xMatIni + largPt / 2;
        var qB = yLinhaTopoSoldaCentro + mm2pt(queijoData.alt / 2);
        var qT = qB + mm2pt(queijoData.comp);
        var qL = xC - mm2pt(queijoData.larg / 2);
        var qR = xC + mm2pt(queijoData.larg / 2);
        return { left: qL, right: qR, bot: qB, top: qT, cx: xC, cy: (qB + qT) / 2 };
    }

    if (arteData) {
        // --- MODO F/G: ARTE CUSTOM (sem queijo, sem linha magenta) ---
        // Seleciona dimensões da face correta. Se verso não definido (Somente frente), reutiliza frente.
        var aInfo = isFrente ? arteData.frente : (arteData.verso || arteData.frente);
        var aFundo = aInfo.distFundo;  // distância de fundo desta face
        var xCentro = xMatIni + largPt / 2;
        var arteBot = yLinhaTopoSoldaCentro + mm2pt(aFundo);
        var arteTop = arteBot + mm2pt(aInfo.tamanho);
        var arteL = xCentro - mm2pt(aInfo.largura / 2);
        var arteR = xCentro + mm2pt(aInfo.largura / 2);

        if (arteData.redonda) {
            _drawFilledEllipse(groupArte, xCentro, (arteBot + arteTop) / 2,
                               arteR - arteL, arteTop - arteBot, corCyan, "Arte");
        } else {
            var arteShape = groupArte.pathItems.rectangle(arteTop, arteL, arteR - arteL, arteTop - arteBot);
            arteShape.filled = true; arteShape.stroked = false; arteShape.fillColor = corCyan;
            arteShape.name = "Arte";
        }

        yArteBotCentro = arteBot;
        yArteTopCentro = arteTop;
        arteLeftCota  = arteL;
        arteRightCota = arteR;
        arteWidthMM   = aInfo.largura;
        distFundoEfetivoMM = aFundo;
        arteAltEfetivaMM   = aInfo.tamanho;
        selagemEfetivaMM   = compMM - 10 - aFundo - aInfo.tamanho;
    } else if (queijoData && !queijoData.bordaCaida) {
        var bbox = _queijoBBox();
        var offPt = mm2pt(recuoMM);

        if (queijoData.redondo) {
            // --- MODO D: QUEIJO (em Cotas) e ARTE (em Arte) como ELIPSES ---
            _drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                               bbox.right - bbox.left, bbox.top - bbox.bot,
                               corMagenta, "Queijo");
            _drawFilledEllipse(groupArte, bbox.cx, bbox.cy,
                               bbox.right - bbox.left - 2 * offPt,
                               bbox.top - bbox.bot - 2 * offPt,
                               corCyan, "Arte");
        } else {
            // --- MODO B: QUEIJO (em Cotas) e ARTE (em Arte) como RETÂNGULOS ---
            _drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
            var arteLeft = bbox.left + offPt;
            var arteRight = bbox.right - offPt;
            var arteBot = bbox.bot + offPt;
            var arteTop = bbox.top - offPt;
            var arteShape = groupArte.pathItems.rectangle(arteTop, arteLeft, arteRight - arteLeft, arteTop - arteBot);
            arteShape.filled = true; arteShape.stroked = false; arteShape.fillColor = corCyan;
            arteShape.name = "Arte";
        }

        yArteBotCentro = bbox.bot + offPt;
        yArteTopCentro = bbox.top - offPt;
        arteLeftCota  = bbox.left + offPt;
        arteRightCota = bbox.right - offPt;
        arteWidthMM   = queijoData.larg - 2 * recuoMM;
        distFundoEfetivoMM = queijoData.alt / 2 + recuoMM;
        arteAltEfetivaMM   = queijoData.comp - 2 * recuoMM;
        selagemEfetivaMM   = compMM - 10 - distFundoEfetivoMM - arteAltEfetivaMM;
    } else {
        // --- MODO A, C ou E: ARTE CURVA (padrão) ---
        var arteTopSegsMM = _trimBezChain(MASTER_TOP_CURVE_MM,    arteXL_master, arteXR_master);
        var arteBotSegsMM = _trimBezChain(MASTER_BOTTOM_CURVE_MM, arteXL_master, arteXR_master);
        var arteTopSegsPt = _transformSegsToPt(arteTopSegsMM, xMatIni, masterXL_piece, yTopo,         topCornerY_piece, -mm2pt(selagemMM));
        var arteBotSegsPt = _transformSegsToPt(arteBotSegsMM, xMatIni, masterXL_piece, yCantosFundo,  botCornerY_piece, +mm2pt(10 + fundoMM));
        var arteBotSegsPtRL = _revBezChain(arteBotSegsPt);

        var arteShape = groupArte.pathItems.add();
        _addBezSegsToPath(arteShape, arteTopSegsPt);
        _addBezSegsToPath(arteShape, arteBotSegsPtRL);
        arteShape.closed = true;
        arteShape.filled = true; arteShape.stroked = false;
        arteShape.fillColor = corCyan;
        arteShape.name = "Arte";

        yArteBotCentro = yFundoExtremo + mm2pt(10 + fundoMM);
        yArteTopCentro = yTopoCentro - selagemPt;
        arteLeftCota  = xMatIni + margemLat;
        arteRightCota = xMatFim - margemLat;
        arteWidthMM   = largMM - 2 * recuoMM;
        distFundoEfetivoMM = fundoMM;
        arteAltEfetivaMM   = compMM - selagemMM - 10 - fundoMM;
        selagemEfetivaMM   = selagemMM;

        // Modo C ou E: borda caída + queijo em Cotas (retângulo ou elipse tracejada)
        if (queijoData && queijoData.bordaCaida) {
            var bbox = _queijoBBox();
            if (queijoData.redondo) {
                _drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                                   bbox.right - bbox.left, bbox.top - bbox.bot,
                                   corMagenta, "Queijo");
            } else {
                _drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
            }
        }
    }

    // ------------------------------------------------------------------
    // 2b. FOTOCÉLULA padrão (40 × 5 mm, 100% preto)
    //     Posição: 5mm da lateral ESQUERDA e 5mm abaixo do vale do topo.
    //     SOMENTE NA FRENTE.
    // ------------------------------------------------------------------
    if (isFrente) {
        var fotoW = mm2pt(40), fotoH = mm2pt(5);
        var fotoTop  = yTopoCentro - mm2pt(5);
        var fotoLeft = xMatIni + mm2pt(5);  // canto esquerdo a 5mm da borda
        var fotocel = groupArte.pathItems.rectangle(fotoTop, fotoLeft, fotoW, fotoH);
        fotocel.filled = true; fotocel.stroked = false;
        fotocel.fillColor = corPreto;
        fotocel.name = "Fotocélula";
    }

    // ------------------------------------------------------------------
    // 3. LINHAS DE FACA DA SOLDA CURVA (dentro de Cotas — Bezier real)
    // ------------------------------------------------------------------
    var matBotSegsMM = _trimBezChain(MASTER_BOTTOM_CURVE_MM, masterXL_piece, masterXR_piece);
    var solda5SegsPt  = _transformSegsToPt(matBotSegsMM, xMatIni, masterXL_piece, yCantosFundo, botCornerY_piece, +mm2pt(5));
    var solda10SegsPt = _transformSegsToPt(matBotSegsMM, xMatIni, masterXL_piece, yCantosFundo, botCornerY_piece, +mm2pt(10));
    drawBezierOpen(groupCotas, solda5SegsPt,  corFaca, true);
    drawBezierOpen(groupCotas, solda10SegsPt, corFaca, true);

    // Label "SOLDA" centrado na faixa da solda (7.5mm acima do ponto mais baixo)
    addText(groupCotas, "SOLDA", xMatIni + largPt / 2, yFundoExtremo + mm2pt(7.5), 8, corCota, 0);

    // ------------------------------------------------------------------
    // 4. COTAS HORIZONTAIS (acima do topo)
    //    - Externa: largura total do material (sempre)
    //    - 3 internas: margem esq / largura da ARTE / margem dir
    //      As margens e a largura da arte se ajustam ao modo (sem queijo,
    //      com queijo retangular/redondo, com/sem borda caída).
    // ------------------------------------------------------------------
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);
    var margemLateralMM = (largMM - arteWidthMM) / 2;

    var _latFontSize = (queijoData && queijoData.bordaCaida) ? 5 : 12;

    drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, fmt(largMM) + " mm", corCota);
    drawCotaH(groupCotas, xMatIni,        arteLeftCota,  yCota2, fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    drawCotaH(groupCotas, arteLeftCota,   arteRightCota, yCota2, fmt2(arteWidthMM)     + " mm", corCota);
    drawCotaH(groupCotas, arteRightCota,  xMatFim,       yCota2, fmt2(margemLateralMM) + " mm", corCota, _latFontSize);

    // ------------------------------------------------------------------
    // 5. COTAS VERTICAIS (à esquerda) — valores seguem a geometria real
    // ------------------------------------------------------------------
    var xCotaV1 = xMatIni - mm2pt(14);
    var xCotaV2 = xMatIni - mm2pt(5);

    // Cota principal (externa): Comprimento total
    drawCotaV(groupCotas, xCotaV1, yTopoCentro, yFundoExtremo, fmt(compMM) + " mm", corCota);

    // Cotas internas (xCotaV2), de baixo para cima, medidas no centro
    drawCotaV(groupCotas, xCotaV2, yFundoExtremo,             yLinhaBaixoSoldaCentro, "5 mm", corCota, 5);
    drawCotaV(groupCotas, xCotaV2, yLinhaBaixoSoldaCentro,    yLinhaTopoSoldaCentro,  "5 mm", corCota, 5);
    if (distFundoEfetivoMM > 0) {
        var _dfFontSize = (queijoData && queijoData.bordaCaida) ? 5 : 12;
        drawCotaV(groupCotas, xCotaV2, yLinhaTopoSoldaCentro, yArteBotCentro,
                  fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
    }
    drawCotaV(groupCotas, xCotaV2, yArteBotCentro, yArteTopCentro,
              fmt2(arteAltEfetivaMM) + " mm", corCota);
    drawCotaV(groupCotas, xCotaV2, yArteTopCentro, yTopoCentro,
              fmt2(selagemEfetivaMM) + " mm", corCota);
}

// Desenha um retângulo com stroke tracejado (sem preenchimento). Usado para a simulação do queijo.
function _drawDashedRect(layer, x1, x2, y1, y2, color, name) {
    var rect = layer.pathItems.add();
    rect.setEntirePath([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
    rect.closed = true;
    rect.filled = false;
    rect.stroked = true;
    rect.strokeColor = color;
    rect.strokeWidth = 1;
    rect.strokeDashes = [5, 5];
    if (name) rect.name = name;
    return rect;
}

// Desenha uma elipse tracejada (sem preenchimento) centrada em (cx, cy) com
// dimensões totais (w, h). Usado para a simulação do queijo redondo.
// No sistema Y-up do Illustrator, "top" da bounding-box é cy + h/2.
function _drawDashedEllipse(layer, cx, cy, w, h, color, name) {
    var top = cy + h / 2;
    var left = cx - w / 2;
    var el = layer.pathItems.ellipse(top, left, w, h);
    el.filled = false;
    el.stroked = true;
    el.strokeColor = color;
    el.strokeWidth = 1;
    el.strokeDashes = [5, 5];
    if (name) el.name = name;
    return el;
}

// Desenha uma elipse preenchida centrada em (cx, cy) com dimensões (w, h).
// Usada para a arte redonda (dentro do queijo redondo).
function _drawFilledEllipse(layer, cx, cy, w, h, color, name) {
    var top = cy + h / 2;
    var left = cx - w / 2;
    var el = layer.pathItems.ellipse(top, left, w, h);
    el.filled = true;
    el.fillColor = color;
    el.stroked = false;
    if (name) el.name = name;
    return el;
}