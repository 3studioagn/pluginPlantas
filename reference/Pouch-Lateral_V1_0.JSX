// ==========================================
// SCRIPT: Pouch Lateral v1.0
// Layout horizontal — frente + verso, soldas horizontais fixas 7,5 mm.
// Cameron 3 mm + Refile 3 mm (padrão stand-up).
// Fotocélula deitada 40 × 5 mm (padrão Nylon Poli).
// ==========================================

function mm2pt(mm) { return mm * 2.83465; }

function cmyk(c, m, y, k) {
    var col = new CMYKColor();
    col.cyan = c; col.magenta = m; col.yellow = y; col.black = k;
    return col;
}

var _arialBold = null;
function getArialBold() {
    if (_arialBold) return _arialBold;
    var fonts = app.textFonts;
    for (var i = 0; i < fonts.length; i++) {
        var f = fonts[i];
        if (f.family === "Arial" && f.style === "Bold") { _arialBold = f; return f; }
    }
    return null;
}
function applyArialBold(t) {
    var f = getArialBold();
    if (f) try { t.textRange.characterAttributes.textFont = f; } catch(e) {}
}

function drawRect(layer, top, left, w, h, color) {
    var r = layer.pathItems.rectangle(top, left, w, h);
    r.filled = true; r.stroked = false; r.fillColor = color;
    return r;
}

function drawLine(layer, x1, y1, x2, y2, color, strokeW, dashed) {
    var ln = layer.pathItems.add();
    ln.setEntirePath([[x1, y1], [x2, y2]]);
    ln.filled = false; ln.stroked = true;
    ln.strokeColor = color; ln.strokeWidth = strokeW || 1;
    if (dashed) ln.strokeDashes = [5, 5];
    return ln;
}

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
    b1.filled = false; b1.stroked = true; b1.strokeColor = color; b1.strokeWidth = 1;

    var b2 = group.pathItems.add();
    b2.setEntirePath([[x2, y + tickH], [x2, y - tickH]]);
    b2.filled = false; b2.stroked = true; b2.strokeColor = color; b2.strokeWidth = 1;

    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.top  = y + mm2pt(2) + t.height;
        t.left = x1 + (x2 - x1) / 2 - t.width / 2;
    }

    // Label vertical rotacionado 90° (para faixas estreitas — cameron/refile)
    if (verticalLabel !== undefined && verticalLabel !== "") {
        var vt = group.textFrames.add();
        vt.contents = verticalLabel;
        vt.textRange.characterAttributes.size = fontSize;
        applyArialBold(vt);
        try { vt.textRange.characterAttributes.fillColor = color; } catch(e) {}
        vt.rotate(90);
        vt.top  = y + mm2pt(5) + vt.height;
        vt.left = x1 + (x2 - x1) / 2 - vt.width / 2;
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
    b1.filled = false; b1.stroked = true; b1.strokeColor = color; b1.strokeWidth = 1;

    var b2 = group.pathItems.add();
    b2.setEntirePath([[x - tickW, y2], [x + tickW, y2]]);
    b2.filled = false; b2.stroked = true; b2.strokeColor = color; b2.strokeWidth = 1;

    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.rotate(90);
        t.top  = (y1 + y2) / 2 + t.height / 2;
        t.left = centered ? (x - t.width / 2) : (x - mm2pt(2) - t.width);
    }
}

function addText(layer, txt, x, y, size, color, rot) {
    var t = layer.textFrames.add();
    t.contents = txt;
    t.textRange.characterAttributes.size = size;
    applyArialBold(t);
    try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
    if (rot) {
        t.rotate(rot);
        t.top  = y + t.height;
        t.left = x - t.width / 2;
    } else {
        t.top  = y + t.height / 2;
        t.left = x - t.width  / 2;
    }
}

// ============================================================
//  INTERFACE
// ============================================================
var dlg = new Window("dialog", "Gerador: Pouch Lateral v1.0");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group");
g1.add("statictext", undefined, "Comprimento Face (mm):");
var inputComp = g1.add("edittext", undefined, "260"); inputComp.characters = 5;

var g2 = dlg.add("group");
g2.add("statictext", undefined, "Largura/Altura (mm):");
var inputLarg = g2.add("edittext", undefined, "160"); inputLarg.characters = 5;

var gBtn = dlg.add("group"); gBtn.alignment = "center";
gBtn.add("button", undefined, "Cancelar",     { name: "cancel" });
gBtn.add("button", undefined, "Gerar Planta", { name: "ok"     });

// ============================================================
//  EXECUÇÃO
// ============================================================
if (dlg.show() == 1) {
    var c = parseFloat(inputComp.text.replace(',', '.'));
    var l = parseFloat(inputLarg.text.replace(',', '.'));
    if (isNaN(c) || isNaN(l) || c <= 0 || l <= 0) {
        alert("Erro: Digite valores válidos.");
    } else {
        desenharPouchLateral(c, l);
    }
}

// ============================================================
//  DESENHO
// ============================================================
function desenharPouchLateral(compMM, largMM) {

    // Constantes fixas
    var cameron    = mm2pt(3);    // faixa preta externa
    var refile     = mm2pt(3);    // espaço entre cameron e borda do material
    var soldaLat   = mm2pt(7.5);  // solda horizontal topo e fundo
    var margemArte = mm2pt(5);    // respiro entre solda e área de arte
    var margemVert = soldaLat + margemArte; // 12,5 mm — do topo/fundo até o início da arte

    var compPt = mm2pt(compMM);
    var largPt = mm2pt(largMM);

    // Validação
    var cyanH = largPt - (margemVert * 2);
    if (cyanH <= 0) {
        alert("Erro: a largura informada é insuficiente para as soldas (mínimo " +
              (7.5 * 2 + 5 * 2 + 1) + " mm).");
        return;
    }

    // Cores
    var corFundo   = cmyk(15, 12, 12, 0);
    var corPreto   = cmyk(0, 0, 0, 100);
    var corCyan    = cmyk(70, 10, 16, 0);
    var corFaca    = cmyk(0, 0, 0, 60);
    var corCota    = cmyk(0, 0, 0, 60);
    var corMagenta = cmyk(0, 100, 0, 0);

    // Dimensões totais do documento
    // Largura: cameron + refile + material(2 faces) + refile + cameron
    var totalPouchW = (cameron * 2) + (refile * 2) + (compPt * 2);
    var totalPouchH = largPt;

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
    var docW    = totalPouchW + marginX * 2;
    var docH    = totalPouchH + marginY * 2;

    // Documento
    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;
    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    // Centralizar na prancheta
    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // ---- EIXOS X ----
    var xCamEsq   = x0;
    var xRefEsq   = xCamEsq  + cameron;
    var xPouchIni = xRefEsq  + refile;
    var xCentro   = xPouchIni + compPt;
    var xPouchFim = xCentro  + compPt;
    var xRefDir   = xPouchFim + refile;
    var xCamDir   = xRefDir  + cameron;

    // ---- EIXOS Y ----
    var yTopo       = y0;
    var ySoldaTopo  = yTopo - soldaLat;
    var yFundo      = yTopo - largPt;
    var ySoldaFundo = yFundo + soldaLat;

    // ============================================================
    // 1. MATERIAL  (cinza, base)
    // ============================================================
    var groupMaterial = layerV1.groupItems.add(); groupMaterial.name = "Material";
    var rectMat = drawRect(groupMaterial, yTopo, xPouchIni, compPt * 2, totalPouchH, corFundo);
    rectMat.name = "Material";

    // ============================================================
    // 2. CAMERON  (preto, faixas externas esq e dir)
    // ============================================================
    var groupCameron = layerV1.groupItems.add(); groupCameron.name = "Cameron";
    var rc1 = groupCameron.pathItems.rectangle(yTopo, xCamEsq, cameron, totalPouchH);
    rc1.filled = true; rc1.stroked = false; rc1.fillColor = corPreto;
    var rc2 = groupCameron.pathItems.rectangle(yTopo, xRefDir, cameron, totalPouchH);
    rc2.filled = true; rc2.stroked = false; rc2.fillColor = corPreto;

    // ============================================================
    // 4. COTAS  (linhas de faca, labels, cotas métricas)
    // ============================================================
    var groupAll   = layerV1.groupItems.add(); groupAll.name = "Cotas";
    var groupCotas = groupAll.groupItems.add(); groupCotas.name = "Cotas";

    // ---- Labels SOLDA ----
    var meiaFacePt = compPt / 2;
    addText(groupAll, "SOLDA", xPouchIni + meiaFacePt, yTopo  - mm2pt(3.75), 8, corCota, 0);
    addText(groupAll, "SOLDA", xCentro   + meiaFacePt, yTopo  - mm2pt(3.75), 8, corCota, 0);
    addText(groupAll, "SOLDA", xPouchIni + meiaFacePt, yFundo + mm2pt(3.75), 8, corCota, 0);
    addText(groupAll, "SOLDA", xCentro   + meiaFacePt, yFundo + mm2pt(3.75), 8, corCota, 0);

    // ---- Linhas de faca ----
    // Bordas externas do material
    drawLine(groupAll, xPouchIni, yTopo,  xPouchFim, yTopo,  corFaca, 1, true);
    drawLine(groupAll, xPouchIni, yFundo, xPouchFim, yFundo, corFaca, 1, true);
    // Limites das soldas horizontais
    drawLine(groupAll, xPouchIni, ySoldaTopo,  xPouchFim, ySoldaTopo,  corFaca, 1, true);
    drawLine(groupAll, xPouchIni, ySoldaFundo, xPouchFim, ySoldaFundo, corFaca, 1, true);
    // Dobra central (entre frente e verso)
    drawLine(groupAll, xCentro, yTopo, xCentro, yFundo, corFaca, 1, true);

    // ---- Linhas magenta de referência nas bordas do material ----
    var yLimiteMagenta = yFundo - mm2pt(3);
    drawLine(groupAll, xPouchIni, yLimiteMagenta, xPouchIni, yTopo + mm2pt(15), corMagenta, 0.75, true);
    drawLine(groupAll, xPouchFim, yLimiteMagenta, xPouchFim, yTopo + mm2pt(15), corMagenta, 0.75, true);

    // ---- COTAS HORIZONTAIS ----
    // Nível 1: largura total do material (2 faces)
    // Nível 2: comprimento por face
    // Nível 3: cameron | refile | [material] | refile | cameron  (labels verticais)
    var yCota1 = yTopo + mm2pt(25);
    var yCota2 = yTopo + mm2pt(15);
    var yCota3 = yTopo + mm2pt(6);

    drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, (compMM * 2) + " mm", corCota);

    drawCotaH(groupCotas, xPouchIni, xCentro,   yCota2, compMM + " mm", corCota);
    drawCotaH(groupCotas, xCentro,   xPouchFim, yCota2, compMM + " mm", corCota);

    drawCotaH(groupCotas, xCamEsq,   xRefEsq,   yCota3, "", corCota, 6, "3 mm CAMERON");
    drawCotaH(groupCotas, xRefEsq,   xPouchIni, yCota3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xPouchFim, xRefDir,   yCota3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xRefDir,   xCamDir,   yCota3, "", corCota, 6, "3 mm CAMERON");

    // ---- COTAS VERTICAIS ----
    // Eixos ancorados à esquerda do cameron (xCamEsq) para não colidir com as faixas
    var xCotaV1 = xCamEsq - mm2pt(14);
    var xCotaV2 = xCamEsq - mm2pt(5);

    drawCotaV(groupCotas, xCotaV1, yTopo, yFundo, largMM + " mm", corCota);

    drawCotaV(groupCotas, xCotaV2, yTopo,       ySoldaTopo,  "7,5 mm",             corCota, 8);
    drawCotaV(groupCotas, xCotaV2, ySoldaTopo,  ySoldaFundo, (largMM - 15) + " mm", corCota);
    drawCotaV(groupCotas, xCotaV2, ySoldaFundo, yFundo,      "7,5 mm",             corCota, 8);

    app.redraw();
    alert("Pouch Lateral v1.0 gerado com sucesso!\n\n" +
          "Material : " + (compMM * 2) + " × " + largMM + " mm\n" +
          "Arte     : " + compMM + " × " + (largMM - 25) + " mm (por face)");
}