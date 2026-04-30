// ==========================================
// SCRIPT: BOX POUCH v1
// ==========================================

function mm2pt(mm) { return mm * 2.83465; }

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
    return null; // fallback: usa fonte padrão
}

function applyArialBold(t) {
    var f = getArialBold();
    if (f) try { t.textRange.characterAttributes.textFont = f; } catch(e) {}
}

// --- FUNÇÕES DE DESENHO ---
function drawRect(layer, top, left, w, h, color) {
    var rect = layer.pathItems.rectangle(top, left, w, h);
    rect.filled = true;
    rect.stroked = false;
    rect.fillColor = color;
    return rect;
}

// Retângulo tracejado sem preenchimento (cantos retos)
function drawDashedRect(layer, top, left, w, h, color, strokeW) {
    var rect = layer.pathItems.rectangle(top, left, w, h);
    rect.filled = false;
    rect.stroked = true;
    rect.strokeColor = color;
    rect.strokeWidth = strokeW || 1;
    rect.strokeDashes = [5, 5];
    return rect;
}

function drawLine(layer, x1, y1, x2, y2, color, strokeW, dashed) {
    var line = layer.pathItems.add();
    line.setEntirePath([[x1, y1], [x2, y2]]);
    line.filled = false;
    line.stroked = true;
    line.strokeColor = color;
    line.strokeWidth = strokeW || 1;
    if (dashed) line.strokeDashes = [5, 5];
    return line;
}

// --- ZÍPER MICKEY ---
// Desenha o zíper mickey conforme PDF de referência:
//   - Cabeça em forma de "halter" (2 elipses tangentes no topo, fundo curvo
//     formando um vale entre as orelhas, com 2 pernas descendo)
//   - Trilha vertical (cápsula tracejada) abaixo
// SEM retângulo externo.
//
// xCenter   = posição X central do zíper
// yCabeca   = posição Y do TOPO da cabeça
// trilhaH   = altura da trilha (vai do fundo das pernas até trilhaH abaixo)
// w         = largura horizontal da cabeça (define todas as outras proporções)
// --- ZÍPER MICKEY ---
// Estrutura medida pixel a pixel no PDF original (peça = 22mm × 200mm):
//   earR = 0.144×w, earSpacing = 0.409×w, earCY = 0.290×h abaixo do topo
//   valley = 0.211×h abaixo do topo, legs em ±0.117×w do centro
//   trilha: largura 0.239×w, começa em 0.838×h do topo
//
// xCenter = centro X da peça | yTop = topo da peça (AI Y) | w = 22mm | h = altura total
// --- ZÍPER MICKEY ---
// Implementado com base no script original do Zíper Mickey.
//
// Estrutura:
//   1. Retângulo externo tracejado (cinza 42%, stroke 0.502pt, dash [2.509, 1.507])
//   2. Trilha interna – rounded rect tracejado (cinza 44%, mesmos parâmetros)
//   3. Cabeça Mickey – path fechado PREENCHIDO (cinza 44%, sem stroke)
//
// Constantes originais (em pt):
//   OUTER_W   = 62.362pt = 22mm
//   TRACK_LEFT offset do centro = +2.979pt, TRACK_RIGHT = +17.031pt
//   TRACK_R   = 6.158pt (raio dos cantos da trilha)
//   TRACK_TOP_OFF = 49.523pt (do topo do rect externo até o topo da trilha)
//   TRACK_BOT_OFF = 13.740pt (do fundo da trilha até o fundo do rect externo)
//   OUTER_CENTER_X original = 130.0pt
//   PDF_OUTER_TOP original  =  72.708pt
//
// xCenter = centro X do rect externo no artboard (AI)
// xCenter = centro X da peça no artboard
// yTop    = topo do rect externo no artboard (AI Y)
// h       = COMPRIMENTO da peça = altura do bloco azul (frente ou verso)
// Largura = FIXA em 22mm
function drawZiperMickey(layer, xCenter, yTop, h) {
    var grupo = layer.groupItems.add();
    grupo.name = "Zíper Mickey";

    var STROKE_W    = 0.502;
    var DASH_PAT    = [2.509, 1.507];
    var w           = mm2pt(22);

    // A cabeça Mickey mantém tamanho ORIGINAL (sem escala)
    var CX0  = 130.0;
    var CY0  = 72.708;

    function mx(raw_x) { return xCenter + raw_x - CX0; }
    function my(raw_y) { return yTop    + CY0  - raw_y; }

    // Cor = corFaca (mesma das linhas de solda)
    var fillC = new CMYKColor();
    fillC.cyan = 0; fillC.magenta = 0; fillC.yellow = 0; fillC.black = 60;

    // -------- 1. RETÂNGULO EXTERNO TRACEJADO --------
    var extRect = grupo.pathItems.add();
    var oL = xCenter - w/2;
    var oR = xCenter + w/2;
    var oT = yTop;
    var oB = yTop - h;
    function addCorner(pi, x, y) {
        var pp = pi.pathPoints.add();
        pp.anchor = [x, y]; pp.leftDirection = [x, y]; pp.rightDirection = [x, y];
        pp.pointType = PointType.CORNER;
    }
    addCorner(extRect, oL, oT);
    addCorner(extRect, oR, oT);
    addCorner(extRect, oR, oB);
    addCorner(extRect, oL, oB);
    extRect.closed = true;
    extRect.filled = false; extRect.stroked = true;
    extRect.strokeColor = fillC; extRect.strokeWidth = 1;
    extRect.strokeDashes = [5, 5];

    // -------- 2. TRILHA INTERNA – rounded rect tracejado --------
    // Topo fixo (posição da cabeça é fixa), fundo acompanha h
    var tl = xCenter + 2.979;
    var tr = xCenter + 17.031;
    var tt = yTop    - 49.523;          // topo da trilha: FIXO
    var tb = yTop - h + 13.740;         // fundo da trilha: VARIÁVEL conforme h
    var rv = 6.158;
    var K  = 0.5523;

    function addSmooth(pi, ax, ay, lx, ly, rx, ry) {
        var pp = pi.pathPoints.add();
        pp.anchor         = [ax, ay];
        pp.leftDirection  = [lx, ly];
        pp.rightDirection = [rx, ry];
        pp.pointType = PointType.SMOOTH;
    }

    var innerTrack = grupo.pathItems.add();
    addSmooth(innerTrack, tl+rv, tt,    tl+rv-rv*K, tt,    tl+rv+rv*K, tt);
    addSmooth(innerTrack, tr-rv, tt,    tr-rv-rv*K, tt,    tr-rv+rv*K, tt);
    addSmooth(innerTrack, tr,    tt-rv, tr, tt-rv+rv*K,    tr, tt-rv-rv*K);
    addSmooth(innerTrack, tr,    tb+rv, tr, tb+rv+rv*K,    tr, tb+rv-rv*K);
    addSmooth(innerTrack, tr-rv, tb,    tr-rv+rv*K, tb,    tr-rv-rv*K, tb);
    addSmooth(innerTrack, tl+rv, tb,    tl+rv+rv*K, tb,    tl+rv-rv*K, tb);
    addSmooth(innerTrack, tl,    tb+rv, tl, tb+rv-rv*K,    tl, tb+rv+rv*K);
    addSmooth(innerTrack, tl,    tt-rv, tl, tt-rv-rv*K,    tl, tt-rv+rv*K);
    innerTrack.closed = true;
    innerTrack.filled = false; innerTrack.stroked = true;
    innerTrack.strokeColor = fillC; innerTrack.strokeWidth = 1;
    innerTrack.strokeDashes = [5, 5];

    // -------- 3. CABEÇA MICKEY – path fechado PREENCHIDO --------
    var mickeyRaw = [
        [160.5618,91.3707,160.5618,91.3707,160.6198,90.9537],
        [160.6598,90.0947,160.6598,90.5297,160.6598,89.6717],
        [160.5648,88.8477,160.6208,89.2577,160.5648,88.8477],
        [160.4968,88.3667,160.4968,88.3667,160.4968,88.3667],
        [160.4068,87.9917,160.4068,87.9917,160.0228,86.3587],
        [158.1008,83.7457,159.2138,84.8877,156.4988,82.1017],
        [151.8868,81.1097,154.3048,81.1097,150.8468,81.1097],
        [148.9628,81.6197,149.8628,81.2797,148.0358,81.9317],
        [146.4608,83.0087,147.1918,82.4137,146.4608,83.0087],
        [146.4608,83.0367,146.4608,83.0367,145.5048,83.6317],
        [143.3118,84.4257,144.4648,84.1137,142.1868,84.7657],
        [139.7408,84.9357,141.0068,84.9357,138.5038,84.9357],
        [136.1978,84.4257,137.2948,84.7657,135.0458,84.1137],
        [133.0488,83.0367,133.9768,83.6317,132.2898,82.4137],
        [130.5468,81.6197,131.4468,81.9317,129.6468,81.2797],
        [127.6228,81.1097,128.6628,81.1097,125.2048,81.1097],
        [121.4088,83.7457,123.0118,82.1017,119.8068,85.3617],
        [118.8508,90.0947,118.8508,87.6287,118.8508,92.5897],
        [121.4088,96.4447,119.8068,94.8287,123.0118,98.0887],
        [127.6228,99.0807,125.2048,99.0807,127.8198,99.0807],
        [128.2698,99.0527,128.0448,99.0807,128.4948,99.0527],
        [128.9158,98.9957,128.6918,99.0247,129.3378,98.9397],
        [130.1248,99.0527,129.7598,98.9397,130.5188,99.1657],
        [131.2218,99.6477,130.8848,99.3647,131.5588,99.9597],
        [131.9528,100.6397,131.7838,100.2717,132.1218,101.0087],
        [132.2058,101.8587,132.2058,101.4057,132.2058,101.8587],
        [132.2058,107.6987,132.2058,107.6987,132.2058,107.6987],
        [133.2178,107.6987,133.2178,107.6987,133.2178,107.6987],
        [133.2178,107.2167,133.2178,107.2167,133.2178,107.2167],
        [133.2178,105.3457,133.2178,105.3457,133.2178,105.3457],
        [133.2178,101.8587,133.2178,101.8587,133.2178,101.2917],
        [132.8528,100.2437,133.0778,100.7247,132.6278,99.7327],
        [131.8688,98.9107,132.2898,99.2797,131.4188,98.5137],
        [130.4058,98.1177,130.9408,98.2587,129.8998,97.9467],
        [128.7758,98.0037,129.3378,97.9187,128.5788,98.0317],
        [128.1848,98.0607,128.3818,98.0607,128.0168,98.0887],
        [127.6228,98.0887,127.8198,98.0887,125.4578,98.0887],
        [122.1118,95.7647,123.5178,97.1817,120.7058,94.3187],
        [119.8348,90.0947,119.8348,92.3067,119.8348,87.8837],
        [122.1118,84.4537,120.7058,85.8997,123.5178,83.0087],
        [127.6228,82.1017,125.4578,82.1017,128.5508,82.1017],
        [130.2098,82.5547,129.4218,82.2717,131.0248,82.8387],
        [132.4308,83.8027,131.7838,83.2637,132.4308,83.8027],
        [132.5428,83.8877,132.5428,83.8877,132.5718,83.9437],
        [132.6838,83.9727,132.6278,83.9727,133.6678,84.5957],
        [135.9168,85.3897,134.7648,85.0777,137.1258,85.7297],
        [139.7408,85.9287,138.4198,85.9287,141.0908,85.9287],
        [143.5648,85.3897,142.3838,85.7297,144.7738,85.0497],
        [146.8828,83.9437,145.8708,84.5677,146.9108,83.9157],
        [146.9948,83.8587,146.9668,83.8877,146.9948,83.8587],
        [147.0798,83.8027,147.0798,83.8027,147.7258,83.2637],
        [149.2728,82.5547,148.4568,82.8387,150.0878,82.2717],
        [151.8868,82.1017,150.9598,82.1017,154.0238,82.1017],
        [157.3978,84.4537,155.9638,83.0087,158.8038,85.8997],
        [159.6758,90.0947,159.6758,87.8837,159.6758,92.3067],
        [157.3978,95.7647,158.8038,94.3187,155.9638,97.1817],
        [151.8868,98.0887,154.0238,98.0887,151.6908,98.0887],
        [151.2968,98.0607,151.4938,98.0887,151.0998,98.0607],
        [150.7348,98.0037,150.9318,98.0317,150.1718,97.9187],
        [149.0758,98.1177,149.6098,97.9467,148.5698,98.2587],
        [147.6418,98.9107,148.0638,98.5137,147.1918,99.2797],
        [146.6298,100.2437,146.8548,99.7327,146.4048,100.7247],
        [146.2918,101.8587,146.2918,101.2917,146.2918,101.8587],
        [146.2918,105.3457,146.2918,105.3457,146.2918,105.3457],
        [146.2918,107.2167,146.2918,107.2167,146.2918,107.2167],
        [146.2918,107.6987,146.2918,107.6987,146.2918,107.6987],
        [147.2758,107.6987,147.2758,107.6987,147.2758,107.6987],
        [147.2758,101.8587,147.2758,101.8587,147.2758,101.4057],
        [147.5288,100.6397,147.3608,101.0087,147.6978,100.2717],
        [148.2888,99.6477,147.9508,99.9597,148.6258,99.3647],
        [149.3568,99.0527,148.9628,99.1657,149.7508,98.9397],
        [150.5938,98.9957,150.1438,98.9397,150.7908,99.0247],
        [151.2408,99.0527,151.0158,99.0527,151.4658,99.0807],
        [151.8868,99.0807,151.6628,99.0807,154.3048,99.0807],
        [158.1008,96.4447,156.4988,98.0887,159.2138,95.3027],
        [160.4068,92.2107,160.0228,93.8457,160.4068,92.2107]
    ];

    var mickey = grupo.pathItems.add();
    for (var i = 0; i < mickeyRaw.length; i++) {
        var r = mickeyRaw[i];
        var pp = mickey.pathPoints.add();
        pp.anchor         = [mx(r[0]), my(r[1])];
        pp.leftDirection  = [mx(r[2]), my(r[3])];
        pp.rightDirection = [mx(r[4]), my(r[5])];
        pp.pointType = PointType.SMOOTH;
    }
    mickey.closed    = true;
    mickey.filled    = true;
    mickey.fillColor = fillC;
    mickey.stroked   = false;

    return grupo;
}

// --- FUNÇÕES DE TEXTO E COTAS ---
function drawCotaH(layer, x1, x2, y, textStr, color, fontSize, verticalLabel) {
    if (fontSize === undefined) fontSize = 12;
    var tickH = mm2pt(1);
    var group = layer.groupItems.add();

    // Linha principal
    var line = group.pathItems.add();
    line.setEntirePath([[x1, y], [x2, y]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;

    // Barra perpendicular esquerda
    var b1 = group.pathItems.add();
    b1.setEntirePath([[x1, y + tickH], [x1, y - tickH]]);
    b1.filled = false; b1.stroked = true;
    b1.strokeColor = color; b1.strokeWidth = 1;

    // Barra perpendicular direita
    var b2 = group.pathItems.add();
    b2.setEntirePath([[x2, y + tickH], [x2, y - tickH]]);
    b2.filled = false; b2.stroked = true;
    b2.strokeColor = color; b2.strokeWidth = 1;

    // Texto horizontal centralizado (acima da linha)
    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.top  = y + mm2pt(2) + t.height;
        t.left = x1 + ((x2 - x1) / 2) - (t.width / 2);
    }

    // Texto vertical rotacionado 90° (para labels de faixas estreitas)
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

    // Linha principal
    var line = group.pathItems.add();
    line.setEntirePath([[x, y1], [x, y2]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;

    // Barra perpendicular superior
    var b1 = group.pathItems.add();
    b1.setEntirePath([[x - tickW, y1], [x + tickW, y1]]);
    b1.filled = false; b1.stroked = true;
    b1.strokeColor = color; b1.strokeWidth = 1;

    // Barra perpendicular inferior
    var b2 = group.pathItems.add();
    b2.setEntirePath([[x - tickW, y2], [x + tickW, y2]]);
    b2.filled = false; b2.stroked = true;
    b2.strokeColor = color; b2.strokeWidth = 1;

    // Texto rotacionado 90°
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
    if (!txt || txt === "") return;
    try {
        var t = layer.textFrames.add();
        t.contents = txt;
        t.textRange.characterAttributes.size = size;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch (e) {}
        // Posiciona provisoriamente para calcular dimensões
        t.top  = Math.round(y);
        t.left = Math.round(x);
        if (rot) {
            t.rotate(rot);
            // Re-lê dimensões após rotação
            var th2 = (t.height && !isNaN(t.height)) ? t.height : 0;
            var tw2 = (t.width  && !isNaN(t.width))  ? t.width  : 0;
            // Centraliza sobre (x, y) usando dimensões pós-rotação
            t.top  = Math.round(y + th2 / 2);
            t.left = Math.round(x - tw2 / 2);
        } else {
            var th = (t.height && !isNaN(t.height)) ? t.height : 0;
            var tw = (t.width  && !isNaN(t.width))  ? t.width  : 0;
            t.top  = Math.round(y + th / 2);
            t.left = Math.round(x - tw / 2);
        }
    } catch(e) {}
}

// --- INTERFACE ---
var dlg = new Window("dialog", "Gerador: Box Pouch");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group"); g1.add("statictext", undefined, "Comprimento (mm):");
var inputComp = g1.add("edittext", undefined, "225"); inputComp.characters = 5;

var g2 = dlg.add("group"); g2.add("statictext", undefined, "Largura (mm):");
var inputLarg = g2.add("edittext", undefined, "195"); inputLarg.characters = 5;

var g3 = dlg.add("group"); g3.add("statictext", undefined, "Sanfona (mm):");
var inputSanf = g3.add("edittext", undefined, "40"); inputSanf.characters = 5;

// --- Zíper Mickey (opcional) ---
var painelZiper = dlg.add("panel", undefined, "Zíper Mickey");
painelZiper.orientation = "column";
painelZiper.alignChildren = "left";
painelZiper.margins = 12;

var checkZiper = painelZiper.add("checkbox", undefined, "Adicionar Zíper Mickey");

var subgZiper = painelZiper.add("group");
subgZiper.orientation = "column";
subgZiper.alignChildren = "left";
subgZiper.enabled = false;

var gDist = subgZiper.add("group");
gDist.add("statictext", undefined, "Distância (mm):");
var inputDistZiper = gDist.add("edittext", undefined, "20"); inputDistZiper.characters = 5;

checkZiper.onClick = function() {
    subgZiper.enabled = checkZiper.value;
};

var grupoBotoes = dlg.add("group"); grupoBotoes.alignment = "center";
grupoBotoes.add("button", undefined, "Cancelar", { name: "cancel" });
grupoBotoes.add("button", undefined, "Gerar Planta", { name: "ok" });

// --- EXECUÇÃO ---
if (dlg.show() == 1) {
    var c = parseFloat(inputComp.text.replace(',', '.'));
    var l = parseFloat(inputLarg.text.replace(',', '.'));
    var s = parseFloat(inputSanf.text.replace(',', '.'));
    var zipAtivo = checkZiper.value;
    var zipDist  = parseFloat(inputDistZiper.text.replace(',', '.'));
    if (isNaN(c) || isNaN(l) || isNaN(s)) {
        alert("Erro: Digite valores válidos.");
    } else if (zipAtivo && isNaN(zipDist)) {
        alert("Erro: Distância do zíper inválida.");
    } else {
        desenharBoxPouch_Completo(c, l, s, zipAtivo, zipDist);
    }
}

// --- LÓGICA PRINCIPAL ---
function desenharBoxPouch_Completo(compMM, largMM, sanfMM, ziperAtivo, ziperDistMM) {
    // =======================================
    // MEDIDAS DERIVADAS (em mm)
    // =======================================
    // Sanfona ABERTA = sanfona fechada * 2
    var sanfAbMM = sanfMM * 2;

    // Frente/Verso — PERÍMETROS ÚTEIS
    var utilFvLargMM = largMM - sanfAbMM;   // LARG - SANFONA ABERTA
    var utilFvCompMM = compMM - sanfMM;     // COMP - SANFONA FECHADA

    // Validação
    if (utilFvLargMM <= 0) {
        alert("Erro: Sanfona aberta (" + sanfAbMM + " mm) >= largura (" + largMM + " mm).\nÚtil frente/verso = " + utilFvLargMM + " mm.");
        return;
    }
    if (utilFvCompMM <= 0) {
        alert("Erro: Sanfona fechada (" + sanfMM + " mm) >= comprimento (" + compMM + " mm).\nÚtil frente/verso = " + utilFvCompMM + " mm.");
        return;
    }

    // =======================================
    // CONVERSÃO PARA PONTOS
    // =======================================
    var sanfAbPt     = mm2pt(sanfAbMM);
    var utilFvLargPt = mm2pt(utilFvLargMM);
    var utilFvCompPt = mm2pt(utilFvCompMM);

    // =======================================
    // CONSTANTES DE MONTAGEM
    // =======================================
    var refilePadrao   = mm2pt(3);     // refile padrão entre cameron e refile de borda
    var refileBorda    = mm2pt(5);     // refile nos cantos (após refilePadrao -> bloco)
    var refileInterno  = mm2pt(10);    // refile entre blocos (5 + 5 compartilhados)
    var refileVertTop  = mm2pt(2.5);   // refile vertical da faixa SUPERIOR
    var refileVertBot  = mm2pt(5);     // refile vertical da faixa INFERIOR
    var refileSolda    = mm2pt(7.5);   // distância das linhas de solda até a borda do bloco
    var cameron        = mm2pt(3);     // cameron (banda preta lateral)
    var gapEntre       = mm2pt(55);    // espaço entre as faixas

    // =======================================
    // DIMENSÕES DAS FAIXAS
    // =======================================
    // FAIXA SUPERIOR — 4 sanfonas laterais
    // 3 + 5 + 80 + 10 + 80 + 10 + 80 + 10 + 80 + 5 + 3 = 366
    var topInnerW = 2 * refilePadrao + 2 * refileBorda + 4 * sanfAbPt + 3 * refileInterno;
    // 2,5 + 185 + 2,5 = 190
    var topH      = 2 * refileVertTop + utilFvCompPt;

    // FAIXA INFERIOR — frente + verso emendados + sanfona
    // 3 + 5 + 185 + 185 + 10 + 80 + 5 + 3 = 476
    var botInnerW = 2 * refilePadrao + 2 * refileBorda + 2 * utilFvCompPt + refileInterno + sanfAbPt;
    // 5 + 115 + 5 = 125
    var botH      = 2 * refileVertBot + utilFvLargPt;

    // =======================================
    // DOCUMENTO
    // =======================================
    var contentW = Math.max(topInnerW, botInnerW) + 2 * cameron;
    var contentH = topH + gapEntre + botH;

    var marginX = mm2pt(70);
    var marginY = mm2pt(90);
    var docW = contentW + 2 * marginX;
    var docH = contentH + 2 * marginY;

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;

    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    // =======================================
    // GRUPOS RAIZ
    // - "Sanfonas" → tudo da faixa superior
    // - "Arte"     → tudo da faixa inferior
    // =======================================
    var groupSanfonas = layerV1.groupItems.add(); groupSanfonas.name = "Sanfonas";
    var groupArte     = layerV1.groupItems.add(); groupArte.name     = "Arte";

    // =======================================
    // CORES
    // =======================================
    var corCyan    = cmyk(60, 0, 15, 0);   // azul/ciano das faces úteis
    var corMagenta = cmyk(0, 100, 0, 0);   // magenta das zonas de refile
    var corPreto   = cmyk(0, 0, 0, 100);
    var corFaca    = cmyk(0, 0, 0, 60);
    var corCota    = cmyk(0, 0, 0, 60);

    // =======================================
    // POSICIONAMENTO NA PRANCHETA
    // =======================================
    var ab   = doc.artboards[0].artboardRect; // [left, top, right, bottom]
    var x0   = ab[0] + (ab[2] - ab[0] - contentW) / 2;
    var yTop = ab[1] - (ab[1] - ab[3] - contentH) / 2;

    // =======================================
    // EIXOS X — FAIXA SUPERIOR
    // Estrutura: cam3 | ref3 (padrão) | ref5 | bloco | ref5 | bloco | ... | ref5 | ref3 | cam3
    // =======================================
    var topCamL    = x0;
    var topRefExtL = topCamL    + cameron;       // início do refile padrão 3mm
    var topRefL    = topRefExtL + refilePadrao;  // início do refile de borda 5mm
    var topB1L     = topRefL    + refileBorda;
    var topB1R     = topB1L     + sanfAbPt;
    var topB2L     = topB1R     + refileInterno;
    var topB2R     = topB2L     + sanfAbPt;
    var topB3L     = topB2R     + refileInterno;
    var topB3R     = topB3L     + sanfAbPt;
    var topB4L     = topB3R     + refileInterno;
    var topB4R     = topB4L     + sanfAbPt;
    var topRefR    = topB4R     + refileBorda;
    var topRefExtR = topRefR    + refilePadrao;  // fim do refile padrão 3mm direito
    var topCamR    = topRefExtR + cameron;

    // Centros dos separadores (para fotocélulas)
    var topSep1X = (topB1R + topB2L) / 2;
    var topSep2X = (topB2R + topB3L) / 2;
    var topSep3X = (topB3R + topB4L) / 2;

    // =======================================
    // EIXOS Y — FAIXA SUPERIOR
    // =======================================
    var topYTop   = yTop;
    var topYUtilT = topYTop - refileVertTop;
    var topYUtilB = topYUtilT - utilFvCompPt;
    var topYBot   = topYUtilB - refileVertTop;

    // =======================================
    // EIXOS X — FAIXA INFERIOR (alinhada à esquerda com a superior)
    // Estrutura: cam3 | ref3 (padrão) | ref5 | F+V | ref5 | sanfona extra | ref5 | ref3 | cam3
    // =======================================
    var botCamL    = x0;
    var botRefExtL = botCamL    + cameron;
    var botRefL    = botRefExtL + refilePadrao;
    var botB1L     = botRefL    + refileBorda;             // início da frente
    var botB1M     = botB1L     + utilFvCompPt;            // dobra central
    var botB1R     = botB1M     + utilFvCompPt;            // fim do verso
    var botSepX    = botB1R     + refileInterno / 2;       // centro do separador de 10mm
    var botB2L     = botB1R     + refileInterno;
    var botB2R     = botB2L     + sanfAbPt;
    var botRefR    = botB2R     + refileBorda;
    var botRefExtR = botRefR    + refilePadrao;
    var botCamR    = botRefExtR + cameron;

    // =======================================
    // EIXOS Y — FAIXA INFERIOR
    // =======================================
    var botYTop   = topYBot - gapEntre;
    var botYUtilT = botYTop - refileVertBot;
    var botYUtilB = botYUtilT - utilFvLargPt;
    var botYBot   = botYUtilB - refileVertBot;

    // =======================================================
    // DESENHO — FAIXA SUPERIOR
    // =======================================================

    // --- Sanfonas: grupo completo ---
    // Material — filho direto do layer Sanfonas, criado primeiro = fundo absoluto
    var corMaterial = cmyk(15, 12, 12, 0);
    var matTopW = topInnerW - 2 * refilePadrao;
    var matTop  = groupSanfonas.pathItems.rectangle(topYTop, topRefL, matTopW, topH);
    matTop.filled = true; matTop.fillColor = corMaterial;
    matTop.stroked = false; matTop.name = "Material";

    var groupSanfTop = groupSanfonas.groupItems.add(); groupSanfTop.name = "Sanfonas";

    // Refile dentro do subgrupo Sanfonas
    var refileTopRect = groupSanfTop.pathItems.rectangle(topYTop, topRefExtL, topInnerW, topH);
    refileTopRect.filled = true; refileTopRect.fillColor = corMagenta;
    refileTopRect.stroked = false; refileTopRect.name = "Refile";

    var r1 = drawRect(groupSanfTop, topYUtilT, topB1L, sanfAbPt, utilFvCompPt, corCyan); r1.name = "Sanfona";
    var r2 = drawRect(groupSanfTop, topYUtilT, topB2L, sanfAbPt, utilFvCompPt, corCyan); r2.name = "Sanfona";
    var r3 = drawRect(groupSanfTop, topYUtilT, topB3L, sanfAbPt, utilFvCompPt, corCyan); r3.name = "Sanfona";
    var r4 = drawRect(groupSanfTop, topYUtilT, topB4L, sanfAbPt, utilFvCompPt, corCyan); r4.name = "Sanfona";

    var groupCamTop = groupSanfTop.groupItems.add(); groupCamTop.name = "Cameron";
    drawRect(groupCamTop, topYTop, topCamL, cameron, topH, corPreto);
    drawRect(groupCamTop, topYTop, topRefExtR, cameron, topH, corPreto);

    var fotoW = mm2pt(40);
    var fotoH = mm2pt(1);
    var groupFotoTop = groupSanfTop.groupItems.add(); groupFotoTop.name = "Fotocélulas";
    drawRect(groupFotoTop, topYTop, topSep1X - fotoW/2, fotoW, fotoH, corPreto);
    drawRect(groupFotoTop, topYTop, topSep3X - fotoW/2, fotoW, fotoH, corPreto);
    drawRect(groupFotoTop, topYBot + fotoH, topSep1X - fotoW/2, fotoW, fotoH, corPreto);
    drawRect(groupFotoTop, topYBot + fotoH, topSep3X - fotoW/2, fotoW, fotoH, corPreto);

    // =======================================================
    // DESENHO — FAIXA INFERIOR
    // =======================================================

    // Material — filho direto do layer Arte, criado primeiro = fundo absoluto
    var matBotW = botInnerW - 2 * refilePadrao;
    var matBot  = groupArte.pathItems.rectangle(botYTop, botRefL, matBotW, botH);
    matBot.filled = true; matBot.fillColor = corMaterial;
    matBot.stroked = false; matBot.name = "Material";

    // --- Frente | Verso | Fundo ---
    var groupFvBot = groupArte.groupItems.add(); groupFvBot.name = "Frente | Verso | Fundo";

    // Refile dentro do subgrupo
    var refileBotRect = groupFvBot.pathItems.rectangle(botYTop, botRefExtL, botInnerW, botH);
    refileBotRect.filled = true; refileBotRect.fillColor = corMagenta;
    refileBotRect.stroked = false; refileBotRect.name = "Refile";

    var rFV = drawRect(groupFvBot, botYUtilT, botB1L, 2 * utilFvCompPt, utilFvLargPt, corCyan); rFV.name = "Frente e Verso";
    var rFundo = drawRect(groupFvBot, botYUtilT, botB2L, sanfAbPt, utilFvLargPt, corCyan); rFundo.name = "Fundo";

    var groupCamBot = groupFvBot.groupItems.add(); groupCamBot.name = "Cameron";
    drawRect(groupCamBot, botYTop, botCamL, cameron, botH, corPreto);
    drawRect(groupCamBot, botYTop, botRefExtR, cameron, botH, corPreto);

    var xCentroFrente = (botB1L + botB1M) / 2;
    var xCentroVerso  = (botB1M + botB1R) / 2;
    var groupFotoBot = groupFvBot.groupItems.add(); groupFotoBot.name = "Fotocélulas";
    drawRect(groupFotoBot, botYTop, xCentroFrente - fotoW/2, fotoW, fotoH, corPreto);
    drawRect(groupFotoBot, botYTop, xCentroVerso  - fotoW/2, fotoW, fotoH, corPreto);
    drawRect(groupFotoBot, botYBot + fotoH, xCentroFrente - fotoW/2, fotoW, fotoH, corPreto);
    drawRect(groupFotoBot, botYBot + fotoH, xCentroVerso  - fotoW/2, fotoW, fotoH, corPreto);

    // =======================================================
    // GRUPOS "Cotas" — criados aqui para que TODAS as cotas,
    // soldas e faca fiquem dentro do mesmo grupo em cada conjunto.
    // =======================================================
    var groupCotasTop = groupSanfonas.groupItems.add(); groupCotasTop.name = "Cotas";
    var groupCotasBot = groupArte.groupItems.add();     groupCotasBot.name = "Cotas";

    // =======================================================
    // LINHAS DE FACA (tracejadas) — FAIXA SUPERIOR
    // Retângulo tracejado em CADA bloco, exatamente na borda do ciano.
    // Marca o corte do dieline (4 lados).
    // =======================================================

    function drawFacaRect(parent, left, right, top, bot) {
        // 4 linhas tracejadas no perímetro exato do bloco ciano
        drawLine(parent, left,  top, right, top, corFaca, 1, true);  // topo
        drawLine(parent, left,  bot, right, bot, corFaca, 1, true);  // fundo
        drawLine(parent, left,  top, left,  bot, corFaca, 1, true);  // esquerda
        drawLine(parent, right, top, right, bot, corFaca, 1, true);  // direita
    }

    drawFacaRect(groupCotasTop, topB1L, topB1R, topYUtilT, topYUtilB);
    drawFacaRect(groupCotasTop, topB2L, topB2R, topYUtilT, topYUtilB);
    drawFacaRect(groupCotasTop, topB3L, topB3R, topYUtilT, topYUtilB);
    drawFacaRect(groupCotasTop, topB4L, topB4R, topYUtilT, topYUtilB);

    // =======================================================
    // LINHAS DE SOLDA (tracejadas) — FAIXA SUPERIOR
    // Verticais (esq + dir, a 7,5mm das bordas do bloco) ficam SÓ DENTRO DO CIANO.
    // Horizontal INFERIOR (a 7,5mm do fundo do ciano) atravessa toda a largura.
    // TOPO ABERTO (sem horizontal superior, é a boca do pouch).
    // =======================================================

    function drawSolda3Lados(parent, left, right, blocoTop, blocoBot, r) {
        var xL = left + r;
        var xR = right - r;
        // Verticais SÓ dentro do ciano (do topo ao fundo do bloco)
        drawLine(parent, xL, blocoTop, xL, blocoBot, corFaca, 1, true);
        drawLine(parent, xR, blocoTop, xR, blocoBot, corFaca, 1, true);
        // Horizontal inferior — atravessa toda a largura do ciano
        drawLine(parent, left, blocoBot + r, right, blocoBot + r, corFaca, 1, true);
    }

    drawSolda3Lados(groupCotasTop, topB1L, topB1R, topYUtilT, topYUtilB, refileSolda);
    drawSolda3Lados(groupCotasTop, topB2L, topB2R, topYUtilT, topYUtilB, refileSolda);
    drawSolda3Lados(groupCotasTop, topB3L, topB3R, topYUtilT, topYUtilB, refileSolda);
    drawSolda3Lados(groupCotasTop, topB4L, topB4R, topYUtilT, topYUtilB, refileSolda);

    // Labels SOLDA Sanfonas:
    //   • Lateral ESQUERDA + DIREITA de cada bloco (vertical rot 90°)
    //   • FUNDO (horizontal)
    var yCentroTop = (topYUtilT + topYUtilB) / 2;
    var soldaBlocosTop = [
        [topB1L, topB1R],
        [topB2L, topB2R],
        [topB3L, topB3R],
        [topB4L, topB4R]
    ];
    for (var si = 0; si < soldaBlocosTop.length; si++) {
        var bL = soldaBlocosTop[si][0];
        var bR = soldaBlocosTop[si][1];
        addText(groupCotasTop, "SOLDA", bL + refileSolda / 2, yCentroTop, 8, corCota, 90); // esq
        addText(groupCotasTop, "SOLDA", bR - refileSolda / 2, yCentroTop, 8, corCota, 90); // dir
        addText(groupCotasTop, "SOLDA", (bL + bR) / 2, topYUtilB + refileSolda / 2, 8, corCota, 0); // fundo
    }

    // =======================================================
    // LINHAS DE FACA (tracejadas) — FAIXA INFERIOR
    // =======================================================
    drawFacaRect(groupCotasBot, botB1L, botB1R, botYUtilT, botYUtilB);
    drawFacaRect(groupCotasBot, botB2L, botB2R, botYUtilT, botYUtilB);

    // =======================================================
    // LINHAS DE SOLDA (tracejadas) — FAIXA INFERIOR
    // Verticais (a 7,5mm) ficam SÓ DENTRO DO CIANO.
    // Horizontais TOPO e FUNDO (a 7,5mm) atravessam toda a largura do ciano.
    // Dobra F/V central também só dentro do ciano.
    // =======================================================

    function drawSolda4Lados(parent, left, right, blocoTop, blocoBot, r) {
        var xL = left + r;
        var xR = right - r;
        // Verticais SÓ dentro do ciano
        drawLine(parent, xL, blocoTop, xL, blocoBot, corFaca, 1, true);
        drawLine(parent, xR, blocoTop, xR, blocoBot, corFaca, 1, true);
        // Horizontal superior — atravessa toda a largura do ciano
        drawLine(parent, left, blocoTop - r, right, blocoTop - r, corFaca, 1, true);
        // Horizontal inferior — atravessa toda a largura do ciano
        drawLine(parent, left, blocoBot + r, right, blocoBot + r, corFaca, 1, true);
    }

    // Bloco F+V (frente + verso emendados)
    drawSolda4Lados(groupCotasBot, botB1L, botB1R, botYUtilT, botYUtilB, refileSolda);

    // Sanfona extra (fundo)
    drawSolda4Lados(groupCotasBot, botB2L, botB2R, botYUtilT, botYUtilB, refileSolda);

    // Dobra F/V central
    drawLine(groupCotasBot, botB1M, botYUtilT, botB1M, botYUtilB, corFaca, 1, true);

    // =======================================================
    // LINHAS TRACEJADAS DO REFILE (magenta) — padrão Stand-Up:
    // saem 3mm além do material (lado oposto às cotas) e vão
    // até o nível mais próximo das cotas, atravessando a faixa.
    // 2 linhas para a faixa superior + 2 para a inferior = 4 no total.
    // Vão dentro do grupo "Cotas".
    // =======================================================
    var yLimiteMaterialTop = topYBot - mm2pt(3);    // 3mm abaixo do fundo da faixa superior
    var yGuiaTopFim        = topYTop + mm2pt(10);   // até o nível mais próximo das cotas
    drawLine(groupCotasTop, topRefL, yLimiteMaterialTop, topRefL, yGuiaTopFim, corMagenta, 0.75, true);
    drawLine(groupCotasTop, topRefR, yLimiteMaterialTop, topRefR, yGuiaTopFim, corMagenta, 0.75, true);

    var yLimiteMaterialBot = botYBot - mm2pt(3);    // 3mm abaixo do fundo da faixa inferior
    var yGuiaBotFim        = botYTop + mm2pt(10);   // até o nível mais próximo das cotas
    drawLine(groupCotasBot, botRefL, yLimiteMaterialBot, botRefL, yGuiaBotFim, corMagenta, 0.75, true);
    drawLine(groupCotasBot, botRefR, yLimiteMaterialBot, botRefR, yGuiaBotFim, corMagenta, 0.75, true);

    // =======================================================
    // COTAS HORIZONTAIS — FAIXA SUPERIOR (4 níveis acima)
    // =======================================================

    var yCotaT1 = topYTop + mm2pt(30); // nível 3 (mais afastado): total
    var yCotaT3 = topYTop + mm2pt(20); // nível 2: 4 passos iguais
    var yCotaT4 = topYTop + mm2pt(10); // nível 1 (mais próximo): decomposição completa

    var fmt = function(n) {
        // Formata número: inteiros sem decimal ("80 mm"), com decimal sem zeros à direita ("2,5 mm")
        var s;
        if (n === Math.floor(n)) {
            s = String(Math.floor(n));
        } else {
            s = n.toFixed(2);
            // Remove zeros à direita após o ponto, sem usar regex
            while (s.length > 0 && s.charAt(s.length - 1) === "0") {
                s = s.substring(0, s.length - 1);
            }
            if (s.charAt(s.length - 1) === ".") {
                s = s.substring(0, s.length - 1);
            }
            s = s.replace(".", ",");
        }
        return s + " mm";
    };

    // Nível 1 — total COM REFILE (refL -> refR = 360, NÃO soma os 3mm refile padrão)
    var topInnerSemPadraoMM = Math.round(topInnerW / mm2pt(1) - 6); // 366 - 6 = 360
    drawCotaH(groupCotasTop, topRefL, topRefR, yCotaT1, fmt(topInnerSemPadraoMM) + " (COM REFILE)", corCota, 10);

    // (nível 2 removido — cotas de 5mm aparecem apenas no nível 4)

    // Nível 3 — 4 passos iguais (cada um = sanfAbMM + 10) COM REFILE — entre topRefL e topRefR
    var passoTop = topInnerSemPadraoMM / 4; // em mm = 90
    var xPasso0 = topRefL;
    var xPasso1 = topRefL + mm2pt(passoTop);
    var xPasso2 = topRefL + mm2pt(passoTop * 2);
    var xPasso3 = topRefL + mm2pt(passoTop * 3);
    var xPasso4 = topRefR;
    drawCotaH(groupCotasTop, xPasso0, xPasso1, yCotaT3, fmt(passoTop) + " (COM REFILE)", corCota, 10);
    drawCotaH(groupCotasTop, xPasso1, xPasso2, yCotaT3, fmt(passoTop) + " (COM REFILE)", corCota, 10);
    drawCotaH(groupCotasTop, xPasso2, xPasso3, yCotaT3, fmt(passoTop) + " (COM REFILE)", corCota, 10);
    drawCotaH(groupCotasTop, xPasso3, xPasso4, yCotaT3, fmt(passoTop) + " (COM REFILE)", corCota, 10);

    // Nível 4 — pretas primeiro (camerons, refiles 3mm, sanfonas)
    drawCotaH(groupCotasTop, topCamL,    topRefExtL, yCotaT4, "", corCota, 6, "3 mm CAMERON");
    drawCotaH(groupCotasTop, topRefExtL, topRefL,    yCotaT4, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotasTop, topB1L,     topB1R,     yCotaT4, fmt(sanfAbMM) + " (SEM REFILE)", corCota, 10);
    drawCotaH(groupCotasTop, topB2L,     topB2R,     yCotaT4, fmt(sanfAbMM) + " (SEM REFILE)", corCota, 10);
    drawCotaH(groupCotasTop, topB3L,     topB3R,     yCotaT4, fmt(sanfAbMM) + " (SEM REFILE)", corCota, 10);
    drawCotaH(groupCotasTop, topB4L,     topB4R,     yCotaT4, fmt(sanfAbMM) + " (SEM REFILE)", corCota, 10);
    drawCotaH(groupCotasTop, topRefR,    topRefExtR, yCotaT4, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotasTop, topRefExtR, topCamR,    yCotaT4, "", corCota, 6, "3 mm CAMERON");

    // =======================================================
    // COTAS VERTICAIS — FAIXA SUPERIOR (lado esquerdo)
    // Padrão Stand-Up: V2 (útil) e V3 (refiles) NO MESMO eixo X.
    // V1 (total) mais afastado.
    // =======================================================
    var xCotaTV2 = topCamL - mm2pt(5);    // útil + refiles 2,5 (mesmo X)
    var xCotaTV3 = topCamL - mm2pt(5);    // mesmo X
    var xCotaTV1 = xCotaTV2 - mm2pt(10); // total mais afastada (10mm de distância)

    drawCotaV(groupCotasTop, xCotaTV1, topYTop,   topYBot,   fmt(topH / mm2pt(1)) + " (COM REFILE)", corCota, 10);
    drawCotaV(groupCotasTop, xCotaTV2, topYUtilT, topYUtilB, fmt(utilFvCompMM)    + " (SEM REFILE)", corCota, 10);

    // =======================================================
    // COTAS EM MAGENTA — FAIXA SUPERIOR
    // Adicionadas POR ÚLTIMO para ficarem ACIMA no grupo Cotas (palette).
    // =======================================================
    drawCotaH(groupCotasTop, topRefL,    topB1L,     yCotaT4, fmt(5),  corMagenta, 8);
    drawCotaH(groupCotasTop, topB1R,     topB2L,     yCotaT4, fmt(10), corMagenta, 8);
    drawCotaH(groupCotasTop, topB2R,     topB3L,     yCotaT4, fmt(10), corMagenta, 8);
    drawCotaH(groupCotasTop, topB3R,     topB4L,     yCotaT4, fmt(10), corMagenta, 8);
    drawCotaH(groupCotasTop, topB4R,     topRefR,    yCotaT4, fmt(5),  corMagenta, 8);
    drawCotaV(groupCotasTop, xCotaTV3, topYTop,   topYUtilT, fmt(2.5), corMagenta, 8);
    drawCotaV(groupCotasTop, xCotaTV3, topYUtilB, topYBot,   fmt(2.5), corMagenta, 8);

    // =======================================================
    // COTAS HORIZONTAIS — FAIXA INFERIOR (3 níveis acima, no gap)
    // =======================================================

    var yCotaB1    = botYTop + mm2pt(40); // nível 4 (mais afastado): total
    var yCotaB2    = botYTop + mm2pt(30); // nível 3: decomposição média
    var yCotaB3    = botYTop + mm2pt(20); // nível 2: decomposição detalhada
    var yCotaZiper = botYTop + mm2pt(10); // nível 1 (mais próximo): cotas do zíper

    // Nível 1 — total COM REFILE (refL -> refR = 470, NÃO soma os 3mm refile padrão)
    var botInnerSemPadraoMM = Math.round(botInnerW / mm2pt(1) - 6); // 476 - 6 = 470
    drawCotaH(groupCotasBot, botRefL, botRefR, yCotaB1, fmt(botInnerSemPadraoMM) + " (COM REFILE)", corCota, 10);

    // Nível 2 — (5+utilComp) | (utilComp+5) | (5+sanfAb+5) — passos COM REFILE
    var xDiv1 = botB1L + utilFvCompPt;              // meio do bloco grande
    var xDiv2 = botB1R + refileBorda;               // meio do separador (5mm do lado direito)
    drawCotaH(groupCotasBot, botRefL, xDiv1,   yCotaB2, fmt(utilFvCompMM + 5) + " (COM REFILE)", corCota, 10);
    drawCotaH(groupCotasBot, xDiv1,   xDiv2,   yCotaB2, fmt(utilFvCompMM + 5) + " (COM REFILE)", corCota, 10);
    drawCotaH(groupCotasBot, xDiv2,   botRefR, yCotaB2, fmt(sanfAbMM + 10)    + " (COM REFILE)", corCota, 10);

    // Nível 3 — decomposição (cotas pretas: camerons, refiles 3mm, blocos)
    drawCotaH(groupCotasBot, botCamL,    botRefExtL, yCotaB3, "", corCota, 6, "3 mm CAMERON");
    drawCotaH(groupCotasBot, botRefExtL, botRefL,    yCotaB3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotasBot, botB1L,     botB1M,     yCotaB3, fmt(utilFvCompMM) + " (SEM REFILE)", corCota, 10);
    drawCotaH(groupCotasBot, botB1M,     botB1R,     yCotaB3, fmt(utilFvCompMM) + " (SEM REFILE)", corCota, 10);
    drawCotaH(groupCotasBot, botB2L,     botB2R,     yCotaB3, fmt(sanfAbMM)    + " (SEM REFILE)", corCota, 10);
    drawCotaH(groupCotasBot, botRefR,    botRefExtR, yCotaB3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotasBot, botRefExtR, botCamR,    yCotaB3, "", corCota, 6, "3 mm CAMERON");

    // =======================================================
    // COTAS VERTICAIS — FAIXA INFERIOR (lado esquerdo)
    // Padrão Stand-Up: V2 (útil) e V3 (refiles) NO MESMO eixo X.
    // V1 (total) mais afastado.
    // =======================================================
    var xCotaBV2 = botCamL - mm2pt(5);    // útil + refiles 5 (mesmo X)
    var xCotaBV3 = botCamL - mm2pt(5);    // mesmo X
    var xCotaBV1 = xCotaBV2 - mm2pt(10); // total mais afastada (10mm de distância)

    drawCotaV(groupCotasBot, xCotaBV1, botYTop,   botYBot,   fmt(botH / mm2pt(1)) + " (COM REFILE)", corCota, 10);
    drawCotaV(groupCotasBot, xCotaBV2, botYUtilT, botYUtilB, fmt(utilFvLargMM)    + " (SEM REFILE)", corCota, 10);

    // =======================================================
    // COTAS EM MAGENTA — FAIXA INFERIOR
    // Adicionadas POR ÚLTIMO para ficarem ACIMA no grupo Cotas (palette).
    // =======================================================
    drawCotaH(groupCotasBot, botRefL, botB1L,  yCotaB3, fmt(5),  corMagenta, 8);
    drawCotaH(groupCotasBot, botB1R,  botB2L,  yCotaB3, fmt(10), corMagenta, 8);
    drawCotaH(groupCotasBot, botB2R,  botRefR, yCotaB3, fmt(5),  corMagenta, 8);
    drawCotaV(groupCotasBot, xCotaBV3, botYTop,   botYUtilT, fmt(5), corMagenta, 8);
    drawCotaV(groupCotasBot, xCotaBV3, botYUtilB, botYBot,   fmt(5), corMagenta, 8);

    // =======================================================
    // LABELS SOLDA ARTE — após as cotas (yCotaB3 já definido)
    // Topo e fundo: 1 por seção (frente, verso, fundo)
    // Verticais: esq do bloco + junção verso/fundo (2) + dir do fundo (1)
    // =======================================================
    var yCentroBot = (botYUtilT + botYUtilB) / 2;
    var yTopoBot   = botYUtilT - refileSolda / 2;
    var yFundoBot  = botYUtilB + refileSolda / 2;

    // Topo e fundo por seção
    addText(groupCotasBot, "SOLDA", (botB1L + botB1M) / 2, yTopoBot,  8, corCota, 0); // frente topo
    addText(groupCotasBot, "SOLDA", (botB1L + botB1M) / 2, yFundoBot, 8, corCota, 0); // frente fundo
    addText(groupCotasBot, "SOLDA", (botB1M + botB1R) / 2, yTopoBot,  8, corCota, 0); // verso topo
    addText(groupCotasBot, "SOLDA", (botB1M + botB1R) / 2, yFundoBot, 8, corCota, 0); // verso fundo
    addText(groupCotasBot, "SOLDA", (botB2L + botB2R) / 2, yTopoBot,  8, corCota, 0); // fundo topo
    addText(groupCotasBot, "SOLDA", (botB2L + botB2R) / 2, yFundoBot, 8, corCota, 0); // fundo fundo

    // Verticais
    addText(groupCotasBot, "SOLDA", botB1L + refileSolda / 2, yCentroBot, 8, corCota, 90); // esq bloco
    addText(groupCotasBot, "SOLDA", botB1R - refileSolda / 2, yCentroBot, 8, corCota, 90); // dir F+V / junção
    addText(groupCotasBot, "SOLDA", botB2L + refileSolda / 2, yCentroBot, 8, corCota, 90); // esq fundo / junção
    addText(groupCotasBot, "SOLDA", botB2R - refileSolda / 2, yCentroBot, 8, corCota, 90); // dir fundo

    // FRENTE / VERSO / FUNDO — logo abaixo de yCotaB3 (entre a cota e o bloco)
    var yFVF = yCotaB3 - mm2pt(7);
    addText(groupCotasBot, "FRENTE", (botB1L + botB1M) / 2, yFVF, 10, corCota, 0);
    addText(groupCotasBot, "VERSO",  (botB1M + botB1R) / 2, yFVF, 10, corCota, 0);
    addText(groupCotasBot, "FUNDO",  (botB2L + botB2R) / 2, yFVF, 10, corCota, 0);

    // =======================================================
    // ZÍPER MICKEY (opcional)
    // - Cabeça (halter) fica logo abaixo do topo do bloco F+V
    // - Trilha desce até quase o fundo do bloco
    // - Largura da peça = 22 mm (largura visual da cabeça)
    // =======================================================
    if (ziperAtivo) {
        var zipW = mm2pt(22);
        var zipH = utilFvLargPt;

        // Zíper sempre na FRENTE: borda direita = botB1M - ziperDistMM
        var zipXRight  = botB1M - mm2pt(ziperDistMM);
        var zipXLeft   = zipXRight - zipW;
        var xCentroZip = zipXLeft + zipW / 2;

        drawZiperMickey(groupCotasBot, xCentroZip, botYUtilT, zipH);

        // Cota: da linha central até a borda direita do zíper
        drawCotaH(groupCotasBot, zipXRight, botB1M, yCotaZiper, fmt(ziperDistMM), corCota, 8);
        // Cota: largura do zíper (22mm) — mesmo nível
        drawCotaH(groupCotasBot, zipXLeft, zipXRight, yCotaZiper, fmt(22), corCota, 8);

        // Label "ZÍPER MICKEY"
        var labelZiper = groupCotasBot.textFrames.add();
        labelZiper.contents = "ZÍPER MICKEY";
        labelZiper.textRange.characterAttributes.size = 8;
        applyArialBold(labelZiper);
        try { labelZiper.textRange.characterAttributes.fillColor = corCota; } catch(e) {}
        labelZiper.top  = yCotaZiper - mm2pt(2);
        labelZiper.left = xCentroZip - labelZiper.width / 2;
    }

    app.redraw();
    alert("Box Pouch v1 gerado com sucesso!\n\n" +
          "Comprimento: " + compMM + " mm\n" +
          "Largura: "     + largMM + " mm\n" +
          "Sanfona: "     + sanfMM + " mm (aberta: " + sanfAbMM + " mm)\n\n" +
          "Útil frente/verso: " + utilFvCompMM + " x " + utilFvLargMM + " mm\n" +
          "Faixa superior: "    + (topInnerW/mm2pt(1)).toFixed(2) + " x " + (topH/mm2pt(1)).toFixed(2) + " mm\n" +
          "Faixa inferior: "    + (botInnerW/mm2pt(1)).toFixed(2) + " x " + (botH/mm2pt(1)).toFixed(2) + " mm");
}
