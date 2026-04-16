// ==========================================
// SCRIPT: STAND-UP POUCH v5
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
    rect.strokeWidth = 1;
    rect.strokeDashes = [5, 5];
    return rect;
}

// Retângulo tracejado sem preenchimento (cantos arredondados)
function drawDashedRoundedRect(layer, top, left, w, h, rx, ry, color, strokeW) {
    var rect = layer.pathItems.roundedRectangle(top, left, w, h, rx, ry);
    rect.filled = false;
    rect.stroked = true;
    rect.strokeColor = color;
    rect.strokeWidth = 1;
    rect.strokeDashes = [5, 5];
    return rect;
}

function drawLine(layer, x1, y1, x2, y2, color, strokeW, dashed) {
    var line = layer.pathItems.add();
    line.setEntirePath([[x1, y1], [x2, y2]]);
    line.filled = false;
    line.stroked = true;
    line.strokeColor = color;
    line.strokeWidth = 1;
    if (dashed) line.strokeDashes = [5, 5];
    return line;
}


function drawNotch(layer, x, y, size, color, isTop) {
    var notch = layer.pathItems.add();
    var halfSize = size / 2;
    if (isTop) {
        notch.setEntirePath([[x - halfSize, y], [x + halfSize, y], [x, y - size]]);
    } else {
        notch.setEntirePath([[x - halfSize, y], [x + halfSize, y], [x, y + size]]);
    }
    notch.closed = true;
    notch.filled = true;
    notch.stroked = false;
    notch.fillColor = color;
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
var dlg = new Window("dialog", "Gerador: Stand-up Pouch");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group"); g1.add("statictext", undefined, "Comprimento Face (mm):");
var inputComp = g1.add("edittext", undefined, "260"); inputComp.characters = 5;

var g2 = dlg.add("group"); g2.add("statictext", undefined, "Largura/Altura (mm):");
var inputLarg = g2.add("edittext", undefined, "160"); inputLarg.characters = 5;

var g3 = dlg.add("group"); g3.add("statictext", undefined, "Sanfona Fundo (mm):");
var inputSanf = g3.add("edittext", undefined, "40"); inputSanf.characters = 5;

var g4 = dlg.add("group"); g4.add("statictext", undefined, "Distância Abre Fácil (mm):");
var inputAbre = g4.add("edittext", undefined, "20"); inputAbre.characters = 5;

var g5 = dlg.add("group"); g5.add("statictext", undefined, "Distância Zíper (mm):");
var inputZip = g5.add("edittext", undefined, "25"); inputZip.characters = 5;

var grupoBotoes = dlg.add("group"); grupoBotoes.alignment = "center";
grupoBotoes.add("button", undefined, "Cancelar", { name: "cancel" });
grupoBotoes.add("button", undefined, "Gerar Planta", { name: "ok" });

// --- EXECUÇÃO ---
if (dlg.show() == 1) {
    var c = parseFloat(inputComp.text.replace(',', '.'));
    var l = parseFloat(inputLarg.text.replace(',', '.'));
    var s = parseFloat(inputSanf.text.replace(',', '.'));
    var a = parseFloat(inputAbre.text.replace(',', '.'));
    var z = parseFloat(inputZip.text.replace(',', '.'));
    if (isNaN(c) || isNaN(l) || isNaN(s) || isNaN(a) || isNaN(z)) {
        alert("Erro: Digite valores válidos.");
    } else {
        desenharSUP_Completo(c, l, s, a, z);
    }
}

// --- LÓGICA PRINCIPAL ---
function desenharSUP_Completo(compMM, largMM, sanfMM, abreMM, ziperMM) {
    var compPt = mm2pt(compMM);
    var largPt = mm2pt(largMM);
    var sanfPt = mm2pt(sanfMM);

    var refile        = mm2pt(3);
    var cameron       = mm2pt(3);
    var soldaLat      = mm2pt(7.5);
    var posAbreFacil  = mm2pt(abreMM);
    var posZiper      = mm2pt(ziperMM);
    var ziperLargura  = mm2pt(12);  // largura total da faixa do zíper (eixo X)
    var ziperInnerW   = mm2pt(4);   // largura do retângulo interno (eixo X)
    var ziperInnerR   = mm2pt(1.5); // raio dos cantos arredondados do rect interno

    // Validação: zíper não pode entrar na zona de sanfona
    var utilFrente = compMM - sanfMM;
    if (posZiper >= mm2pt(utilFrente)) {
        alert("Atenção: a posição do zíper (" + 25 + " mm) cruza a zona de sanfona (" + utilFrente + " mm útil). Revise as dimensões.");
        return;
    }

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);

    var totalPouchW = (cameron * 2) + (refile * 2) + (compPt * 2);
    var totalPouchH = largPt;

    var docW = totalPouchW + (marginX * 2);
    var docH = totalPouchH + (marginY * 2);

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;

    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var corFundo   = cmyk(15, 12, 12, 0);
    var corPreto   = cmyk(0, 0, 0, 100);
    var corFaca    = cmyk(0, 0, 0, 60);
    var corCota    = cmyk(0, 0, 0, 60);
    var corMagenta = cmyk(0, 100, 0, 0);

    // Centraliza o conteúdo na prancheta
    var ab   = doc.artboards[0].artboardRect; // [left, top, right, bottom]
    var x0   = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0   = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // --- EIXOS X ---
    var xCamEsq   = x0;
    var xRefEsq   = xCamEsq  + cameron;
    var xPouchIni = xRefEsq  + refile;
    var xCentro   = xPouchIni + compPt;
    var xPouchFim = xCentro  + compPt;
    var xRefDir   = xPouchFim + refile;
    var xCamDir   = xRefDir  + cameron;

    var xSanfEsq = xCentro - sanfPt;
    var xSanfDir = xCentro + sanfPt;

    // --- EIXOS Y ---
    var yTopo       = y0;
    var ySoldaTopo  = yTopo - soldaLat;
    var yFundo      = yTopo - largPt;
    var ySoldaFundo = yFundo + soldaLat;

    // Alturas dos retângulos do zíper:
    // Externo: altura total do material (yTopo → yFundo)
    // Interno: entre as soldas (ySoldaTopo → ySoldaFundo)
    var ziperAlturaExt = largPt;                       // yTopo → yFundo
    var ziperAlturaInt = ySoldaTopo - ySoldaFundo;     // ySoldaTopo → ySoldaFundo

    // =======================================
    // 1. BASE E CHAPADOS
    // =======================================

    // Material (base cinza) — solto na camada V1, criado primeiro (fica no fundo)
    var rectMaterial = drawRect(layerV1, yTopo, xPouchIni, compPt * 2, totalPouchH, corFundo);
    rectMaterial.name = "Material";

    // Camerons (preto, agrupados) — grupo "Cameron", criado segundo
    var groupCameron = layerV1.groupItems.add(); groupCameron.name = "Cameron";
    var rc1 = groupCameron.pathItems.rectangle(yTopo, xCamEsq, cameron, totalPouchH);
    rc1.filled = true; rc1.stroked = false; rc1.fillColor = corPreto;
    var rc2 = groupCameron.pathItems.rectangle(yTopo, xRefDir, cameron, totalPouchH);
    rc2.filled = true; rc2.stroked = false; rc2.fillColor = corPreto;

    // Grupo "Cotas" — criado por último (fica no topo)
    var groupAll = layerV1.groupItems.add(); groupAll.name = "Cotas";

    // Labels de solda
    var meiaFacePt = compPt / 2;
    addText(groupAll, "SOLDA", xPouchIni + meiaFacePt, yTopo  - mm2pt(3.75), 8, corCota, 0);
    addText(groupAll, "SOLDA", xCentro   + meiaFacePt, yTopo  - mm2pt(3.75), 8, corCota, 0);
    addText(groupAll, "SOLDA", xPouchIni + meiaFacePt, yFundo + mm2pt(3.75), 8, corCota, 0);
    addText(groupAll, "SOLDA", xCentro   + meiaFacePt, yFundo + mm2pt(3.75), 8, corCota, 0);



    // =======================================
    // 2. LINHAS DE FACA E DOBRA
    // =======================================
    drawLine(groupAll, xPouchIni, yTopo,  xPouchFim, yTopo,  corFaca, 1, true);
    drawLine(groupAll, xPouchIni, yFundo, xPouchFim, yFundo, corFaca, 1, true);

    drawLine(groupAll, xPouchIni, ySoldaTopo,  xPouchFim, ySoldaTopo,  corFaca, 1, true);
    drawLine(groupAll, xPouchIni, ySoldaFundo, xPouchFim, ySoldaFundo, corFaca, 1, true);

    drawLine(groupAll, xCentro, yTopo, xCentro, yFundo, corFaca, 1, true);

    drawLine(groupAll, xSanfEsq, yTopo, xSanfEsq, yFundo, corFaca, 1, true);
    drawLine(groupAll, xSanfDir, yTopo, xSanfDir, yFundo, corFaca, 1, true);


    // =======================================
    // 3. PIQUES ABRE FÁCIL
    // =======================================
    var piqueSize = mm2pt(3.5);

    // Abre fácil ESQUERDO — linha + 2 triângulos agrupados
    var groupAbreEsq = groupAll.groupItems.add();
    drawNotch(groupAbreEsq, xPouchIni + posAbreFacil, yTopo,  piqueSize, corCota, true);
    drawNotch(groupAbreEsq, xPouchIni + posAbreFacil, yFundo, piqueSize, corCota, false);
    drawLine(groupAbreEsq,  xPouchIni + posAbreFacil, yTopo, xPouchIni + posAbreFacil, yFundo, corCota, 1, true);

    // Abre fácil DIREITO — linha + 2 triângulos agrupados
    var groupAbreDir = groupAll.groupItems.add();
    drawNotch(groupAbreDir, xPouchFim - posAbreFacil, yTopo,  piqueSize, corCota, true);
    drawNotch(groupAbreDir, xPouchFim - posAbreFacil, yFundo, piqueSize, corCota, false);
    drawLine(groupAbreDir,  xPouchFim - posAbreFacil, yTopo, xPouchFim - posAbreFacil, yFundo, corCota, 1, true);


    // =======================================
    // 3b. MARCAÇÃO VISUAL DO ZÍPER
    //
    // Retângulo EXTERNO:
    //   - Largura (X): ziperLargura (12 mm), inicia na linha de 25 mm
    //   - Altura (Y): altura total do material (yTopo → yFundo)
    //   - Stroke: tracejado 0.75 pt
    //
    // Retângulo INTERNO:
    //   - Largura (X): 4 mm, centralizado dentro do externo
    //   - Altura (Y): entre as soldas (ySoldaTopo → ySoldaFundo)
    //   - Cantos: arredondados (raio 1.5 mm)
    //   - Stroke: tracejado 0.5 pt
    // =======================================

    // Offset X para centralizar o retângulo interno (4 mm) dentro do externo (12 mm)
    var ziperInnerOffsetX = (ziperLargura - ziperInnerW) / 2;

    // --- Zíper ESQUERDO — externo + interno agrupados ---
    var xZipEsqL = xPouchIni + posZiper;
    var groupZipEsq = groupAll.groupItems.add();

    drawDashedRect(groupZipEsq,
        yTopo, xZipEsqL, ziperLargura, ziperAlturaExt, corCota, 1);

    drawDashedRoundedRect(groupZipEsq,
        ySoldaTopo, xZipEsqL + ziperInnerOffsetX, ziperInnerW, ziperAlturaInt,
        ziperInnerR, ziperInnerR, corCota, 1);

    // --- Zíper DIREITO — externo + interno agrupados ---
    var xZipDirL = xPouchFim - posZiper - ziperLargura;
    var groupZipDir = groupAll.groupItems.add();

    drawDashedRect(groupZipDir,
        yTopo, xZipDirL, ziperLargura, ziperAlturaExt, corCota, 1);

    drawDashedRoundedRect(groupZipDir,
        ySoldaTopo, xZipDirL + ziperInnerOffsetX, ziperInnerW, ziperAlturaInt,
        ziperInnerR, ziperInnerR, corCota, 1);

    // =======================================
    // 4. LIMITES ZONA K-SEAL (±5mm da dobra de sanfona)
    // =======================================
    drawLine(groupAll, xSanfEsq - mm2pt(5), yTopo, xSanfEsq - mm2pt(5), yFundo, corCota, 0.75, true);
    drawLine(groupAll, xSanfEsq + mm2pt(5), yTopo, xSanfEsq + mm2pt(5), yFundo, corCota, 0.75, true);
    drawLine(groupAll, xSanfDir - mm2pt(5), yTopo, xSanfDir - mm2pt(5), yFundo, corCota, 0.75, true);
    drawLine(groupAll, xSanfDir + mm2pt(5), yTopo, xSanfDir + mm2pt(5), yFundo, corCota, 0.75, true);

    // =======================================
    // 5. COTAS HORIZONTAIS (5 NÍVEIS + refile/cameron no nível 4)
    // =======================================
    var yCota1 = yTopo + mm2pt(45);
    var yCota2 = yTopo + mm2pt(35);
    var yCota3 = yTopo + mm2pt(25);
    var yCota4 = yTopo + mm2pt(15);
    var yCota5 = yTopo + mm2pt(6);

    // Grupo pai que contém todas as cotas
    var groupCotas = groupAll.groupItems.add();

    drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, (compMM * 2) + " mm", corCota);

    drawCotaH(groupCotas, xPouchIni, xCentro,  yCota2, compMM + " mm", corCota);
    drawCotaH(groupCotas, xCentro,  xPouchFim, yCota2, compMM + " mm", corCota);

    drawCotaH(groupCotas, xPouchIni, xSanfEsq, yCota3, utilFrente + " mm", corCota);
    drawCotaH(groupCotas, xSanfEsq, xSanfDir,  yCota3, (sanfMM * 2) + " mm", corCota);
    drawCotaH(groupCotas, xSanfDir, xPouchFim, yCota3, utilFrente + " mm", corCota);

    drawCotaH(groupCotas, xPouchIni,            xPouchIni + posZiper, yCota4, ziperMM + " mm", corCota);
    drawCotaH(groupCotas, xPouchFim - posZiper, xPouchFim,            yCota4, ziperMM + " mm", corCota);
    drawCotaH(groupCotas, xSanfEsq, xCentro,  yCota4, sanfMM + " mm", corCota);
    drawCotaH(groupCotas, xCentro,  xSanfDir, yCota4, sanfMM + " mm", corCota);
    drawCotaH(groupCotas, xCamEsq,   xRefEsq,   yCota4, "", corCota, 6, "3 mm CAMERON");
    drawCotaH(groupCotas, xRefEsq,   xPouchIni, yCota4, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xPouchFim, xRefDir,   yCota4, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xRefDir,   xCamDir,   yCota4, "", corCota, 6, "3 mm CAMERON");

    drawCotaH(groupCotas, xPouchIni,                xPouchIni + posAbreFacil, yCota5, abreMM + " mm", corCota);
    drawCotaH(groupCotas, xPouchFim - posAbreFacil, xPouchFim,                yCota5, abreMM + " mm", corCota);
    drawCotaH(groupCotas, xSanfEsq - mm2pt(5), xSanfEsq + mm2pt(5), yCota5, "10 mm", corCota, 8);
    drawCotaH(groupCotas, xSanfDir - mm2pt(5), xSanfDir + mm2pt(5), yCota5, "10 mm", corCota, 8);

    // =======================================
    // 6. COTAS VERTICAIS
    // =======================================
    var xCotaV3 = x0 - mm2pt(5);
    var xCotaV2 = x0 - mm2pt(5);
    var xCotaV1 = xCotaV3 - mm2pt(9);

    drawCotaV(groupCotas, xCotaV1, yTopo,       yFundo,       largMM + " mm",        corCota);
    drawCotaV(groupCotas, xCotaV2, ySoldaTopo,  ySoldaFundo,  (largMM - 15) + " mm", corCota);
    drawCotaV(groupCotas, xCotaV3, yTopo,       ySoldaTopo,   "7,5 mm",              corCota, 8);
    drawCotaV(groupCotas, xCotaV3, ySoldaFundo, yFundo,       "7,5 mm",              corCota, 8);

    // =======================================
    // 7. LINHAS DE LIMITE DO MATERIAL (MAGENTA)
    // =======================================
    var yLimiteMaterial = yFundo - mm2pt(3);
    drawLine(groupAll, xPouchIni, yLimiteMaterial, xPouchIni, yCota4, corMagenta, 0.75, true);
    drawLine(groupAll, xPouchFim, yLimiteMaterial, xPouchFim, yCota4, corMagenta, 0.75, true);

    app.redraw();
    alert("Stand-up Pouch v5 gerado com sucesso!");
}