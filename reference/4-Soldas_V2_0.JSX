// ==========================================
// SCRIPT: 4 SOLDAS v1.1
// Baseado no v1.0
// Adiciona o grupo "Info. (apagar)" DENTRO da camada V1 com:
//   - Labels SANFONA / FRENTE / SANFONA / VERSO (8pt, abaixo dos números das cotas)
//   - Retângulos VERMELHOS tracejados por zona (Área de Selagem)
//   - Retângulos VERDES tracejados por zona (Área Segura para Textos)
//   - Retângulos AZUIS tracejados por zona (Área de Dobra após Formatado)
//   - Legenda no rodapé com cápsulas coloridas, alinhada à esquerda dentro
//     da caixa (a caixa cobre toda a largura do material e fica centralizada)
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

// --- FUNÇÕES DE DESENHO ---
function drawRect(layer, top, left, w, h, color) {
    var rect = layer.pathItems.rectangle(top, left, w, h);
    rect.filled = true;
    rect.stroked = false;
    rect.fillColor = color;
    return rect;
}

function drawLine(layer, x1, y1, x2, y2, color, strokeW, dashed) {
    var line = layer.pathItems.add();
    line.setEntirePath([[x1, y1], [x2, y2]]);
    line.filled = false;
    line.stroked = true;
    line.strokeColor = color;
    line.strokeWidth = strokeW || 1;
    if (dashed) {
        if (dashed === true) line.strokeDashes = [5, 5];
        else if (dashed.length !== undefined) line.strokeDashes = dashed;
    }
    return line;
}

function drawRectStroke(layer, top, left, w, h, color, strokeW, dashed) {
    var rect = layer.pathItems.rectangle(top, left, w, h);
    rect.filled = false;
    rect.stroked = true;
    rect.strokeColor = color;
    rect.strokeWidth = strokeW || 1;
    if (dashed) {
        if (dashed === true) rect.strokeDashes = [5, 5];
        else if (dashed.length !== undefined) rect.strokeDashes = dashed;
    }
    return rect;
}

// Cápsula preenchida (pill shape) — raio = altura/2 deixa os lados completamente arredondados
function drawCapsuleFill(parent, top, left, w, h, color) {
    var rect = parent.pathItems.roundedRectangle(top, left, w, h, h / 2, h / 2, false);
    rect.filled = true;
    rect.stroked = false;
    rect.fillColor = color;
    return rect;
}

// Retângulo com cantos arredondados, apenas stroke (caixa externa da legenda)
function drawRoundedRectStroke(parent, top, left, w, h, hRadius, vRadius, color, strokeW) {
    var rect = parent.pathItems.roundedRectangle(top, left, w, h, hRadius, vRadius, false);
    rect.filled = false;
    rect.stroked = true;
    rect.strokeColor = color;
    rect.strokeWidth = strokeW || 0.5;
    return rect;
}

// --- COTAS ---
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
    return t;
}

// --- INTERFACE ---
var dlg = new Window("dialog", "Gerador: 4 Soldas v1.1");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group"); g1.add("statictext", undefined, "Comprimento (mm):");
var inputComp = g1.add("edittext", undefined, "300"); inputComp.characters = 5;

var g2 = dlg.add("group"); g2.add("statictext", undefined, "Largura (mm):");
var inputLarg = g2.add("edittext", undefined, "175"); inputLarg.characters = 5;

var g3 = dlg.add("group"); g3.add("statictext", undefined, "Sanfona Lateral (mm):");
var inputSanf = g3.add("edittext", undefined, "30"); inputSanf.characters = 5;

var grupoBotoes = dlg.add("group"); grupoBotoes.alignment = "center";
grupoBotoes.add("button", undefined, "Cancelar", { name: "cancel" });
grupoBotoes.add("button", undefined, "Gerar Planta", { name: "ok" });

if (dlg.show() == 1) {
    var c = parseFloat(inputComp.text.replace(',', '.'));
    var l = parseFloat(inputLarg.text.replace(',', '.'));
    var s = parseFloat(inputSanf.text.replace(',', '.'));
    if (isNaN(c) || isNaN(l) || isNaN(s)) {
        alert("Erro: Digite valores válidos.");
    } else {
        desenhar4Soldas_Completo(c, l, s);
    }
}

// --- LÓGICA PRINCIPAL ---
function desenhar4Soldas_Completo(compMM, largMM, sanfMM) {
    var utilFace = largMM - (2 * sanfMM);

    if (utilFace <= 0) {
        alert("Atenção: a largura (" + largMM + " mm) deve ser maior que 2x a sanfona (" + (2 * sanfMM) + " mm).");
        return;
    }

    var compPt     = mm2pt(compMM);
    var largPt     = mm2pt(largMM);
    var sanfPt     = mm2pt(sanfMM);
    var utilFacePt = mm2pt(utilFace);
    var sanfFaixa  = sanfPt * 2;

    var refile     = mm2pt(3);
    var cameron    = mm2pt(3);
    var soldaLat   = mm2pt(7.5);
    var soldaFundo = mm2pt(15);

    var totalPouchW = (cameron * 2) + (refile * 2) + (utilFacePt * 2) + (sanfFaixa * 2);
    var totalPouchH = compPt;

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);

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

    var ab   = doc.artboards[0].artboardRect;
    var x0   = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0   = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // EIXOS X
    var xCamEsq    = x0;
    var xRefEsq    = xCamEsq    + cameron;
    var xPouchIni  = xRefEsq    + refile;
    var xSanfEsqDobra = xPouchIni + sanfPt;
    var xFrenteIni    = xPouchIni + sanfFaixa;
    var xFrenteFim    = xFrenteIni + utilFacePt;
    var xSanfCenDobra = xFrenteFim + sanfPt;
    var xVersoIni     = xFrenteFim + sanfFaixa;
    var xVersoFim     = xVersoIni + utilFacePt;
    var xPouchFim  = xVersoFim;
    var xRefDir    = xPouchFim  + refile;
    var xCamDir    = xRefDir    + cameron;

    // EIXOS Y
    var yTopo       = y0;
    var yFundo      = yTopo - compPt;
    var ySoldaFundo = yFundo + soldaFundo;

    // =======================================
    // 1. MATERIAL (path solto na camada V1)
    // =======================================
    var rectMaterial = drawRect(layerV1, yTopo, xPouchIni, totalPouchW - (cameron * 2) - (refile * 2), totalPouchH, corFundo);
    rectMaterial.name = "Material";

    // =======================================
    // 2. CAMERON (grupo)
    // =======================================
    var groupCameron = layerV1.groupItems.add(); groupCameron.name = "Cameron";
    var rc1 = groupCameron.pathItems.rectangle(yTopo, xCamEsq, cameron, totalPouchH);
    rc1.filled = true; rc1.stroked = false; rc1.fillColor = corPreto;
    var rc2 = groupCameron.pathItems.rectangle(yTopo, xRefDir, cameron, totalPouchH);
    rc2.filled = true; rc2.stroked = false; rc2.fillColor = corPreto;

    // =======================================
    // 3. COTAS (grupo) - inclui soldas verticais e linhas de faca
    // =======================================
    var groupAll = layerV1.groupItems.add(); groupAll.name = "Cotas";

    var yMeio = yTopo - (compPt / 2);
    addText(groupAll, "SOLDA", xFrenteIni + (utilFacePt / 2), yFundo + (soldaFundo / 2), 8, corCota, 0);
    addText(groupAll, "SOLDA", xVersoIni  + (utilFacePt / 2), yFundo + (soldaFundo / 2), 8, corCota, 0);

    drawLine(groupAll, xPouchIni, yFundo, xPouchFim, yFundo, corFaca, 1, true);
    drawLine(groupAll, xPouchIni, ySoldaFundo, xPouchFim, ySoldaFundo, corFaca, 1, true);

    // Faixas de soldas verticais
    var groupSoldaEsq = groupAll.groupItems.add();
    drawLine(groupSoldaEsq, xPouchIni, yTopo, xPouchIni, yFundo, corFaca, 1, true);
    drawLine(groupSoldaEsq, xPouchIni + soldaLat, yTopo, xPouchIni + soldaLat, yFundo, corCota, 0.75, true);
    addText(groupSoldaEsq, "SOLDA", xPouchIni + mm2pt(3.75), yMeio, 8, corCota, 90);

    var groupSoldaDir = groupAll.groupItems.add();
    drawLine(groupSoldaDir, xPouchFim, yTopo, xPouchFim, yFundo, corFaca, 1, true);
    drawLine(groupSoldaDir, xPouchFim - soldaLat, yTopo, xPouchFim - soldaLat, yFundo, corCota, 0.75, true);
    addText(groupSoldaDir, "SOLDA", xPouchFim - mm2pt(3.75), yMeio, 8, corCota, 90);

    var groupSoldaIniFrente = groupAll.groupItems.add();
    drawLine(groupSoldaIniFrente, xFrenteIni, yTopo, xFrenteIni, yFundo, corFaca, 1, true);
    drawLine(groupSoldaIniFrente, xFrenteIni - soldaLat, yTopo, xFrenteIni - soldaLat, yFundo, corCota, 0.75, true);
    drawLine(groupSoldaIniFrente, xFrenteIni + soldaLat, yTopo, xFrenteIni + soldaLat, yFundo, corCota, 0.75, true);
    addText(groupSoldaIniFrente, "SOLDA", xFrenteIni - mm2pt(3.75), yMeio, 8, corCota, 90);
    addText(groupSoldaIniFrente, "SOLDA", xFrenteIni + mm2pt(3.75), yMeio, 8, corCota, 90);

    var groupSoldaFimFrente = groupAll.groupItems.add();
    drawLine(groupSoldaFimFrente, xFrenteFim, yTopo, xFrenteFim, yFundo, corFaca, 1, true);
    drawLine(groupSoldaFimFrente, xFrenteFim - soldaLat, yTopo, xFrenteFim - soldaLat, yFundo, corCota, 0.75, true);
    drawLine(groupSoldaFimFrente, xFrenteFim + soldaLat, yTopo, xFrenteFim + soldaLat, yFundo, corCota, 0.75, true);
    addText(groupSoldaFimFrente, "SOLDA", xFrenteFim - mm2pt(3.75), yMeio, 8, corCota, 90);
    addText(groupSoldaFimFrente, "SOLDA", xFrenteFim + mm2pt(3.75), yMeio, 8, corCota, 90);

    var groupSoldaIniVerso = groupAll.groupItems.add();
    drawLine(groupSoldaIniVerso, xVersoIni, yTopo, xVersoIni, yFundo, corFaca, 1, true);
    drawLine(groupSoldaIniVerso, xVersoIni - soldaLat, yTopo, xVersoIni - soldaLat, yFundo, corCota, 0.75, true);
    drawLine(groupSoldaIniVerso, xVersoIni + soldaLat, yTopo, xVersoIni + soldaLat, yFundo, corCota, 0.75, true);
    addText(groupSoldaIniVerso, "SOLDA", xVersoIni - mm2pt(3.75), yMeio, 8, corCota, 90);
    addText(groupSoldaIniVerso, "SOLDA", xVersoIni + mm2pt(3.75), yMeio, 8, corCota, 90);

    // Cotas
    var yCota1 = yTopo + mm2pt(25);
    var yCota2 = yTopo + mm2pt(15);
    var yCota3 = yTopo + mm2pt(6);

    var groupCotas = groupAll.groupItems.add();

    drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, (largMM * 2) + " mm", corCota);

    drawCotaH(groupCotas, xPouchIni,  xFrenteIni, yCota2, (sanfMM * 2) + " mm", corCota);
    drawCotaH(groupCotas, xFrenteIni, xFrenteFim, yCota2, utilFace + " mm", corCota);
    drawCotaH(groupCotas, xFrenteFim, xVersoIni,  yCota2, (sanfMM * 2) + " mm", corCota);
    drawCotaH(groupCotas, xVersoIni,  xVersoFim,  yCota2, utilFace + " mm", corCota);

    drawCotaH(groupCotas, xCamEsq, xRefEsq,   yCota3, "", corCota, 6, "3 mm CAMERON");
    drawCotaH(groupCotas, xRefEsq, xPouchIni, yCota3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xPouchFim, xRefDir, yCota3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xRefDir,   xCamDir, yCota3, "", corCota, 6, "3 mm CAMERON");

    var xCotaV2 = x0 - mm2pt(5);
    var xCotaV1 = xCotaV2 - mm2pt(9);

    drawCotaV(groupCotas, xCotaV1, yTopo,       yFundo,      compMM + " mm",       corCota);
    drawCotaV(groupCotas, xCotaV2, ySoldaFundo, yFundo,      "15 mm",              corCota, 8);

    var yLimiteMaterial = yFundo - mm2pt(3);
    drawLine(groupAll, xPouchIni, yLimiteMaterial, xPouchIni, yCota3, corMagenta, 0.75, true);
    drawLine(groupAll, xPouchFim, yLimiteMaterial, xPouchFim, yCota3, corMagenta, 0.75, true);

    // -------- LABELS DAS ZONAS (SANFONA/FRENTE/SANFONA/VERSO) --------
    // Pertencem ao grupo Cotas, posicionados logo abaixo da linha da cota de subdivisão (yCota2)
    // Fonte 8pt, mesma cor das cotas
    var zonasLabels = [
        { ini: xPouchIni  + soldaLat, fim: xFrenteIni - soldaLat, nome: "SANFONA" },
        { ini: xFrenteIni + soldaLat, fim: xFrenteFim - soldaLat, nome: "FRENTE"  },
        { ini: xFrenteFim + soldaLat, fim: xVersoIni  - soldaLat, nome: "SANFONA" },
        { ini: xVersoIni  + soldaLat, fim: xPouchFim  - soldaLat, nome: "VERSO"   }
    ];
    var groupLabelsCotas = groupAll.groupItems.add();
    groupLabelsCotas.name = "Labels Zonas";
    var yLabel = yCota2 - mm2pt(3);  // 3mm logo abaixo da linha da cota de subdivisão
    for (var L = 0; L < zonasLabels.length; L++) {
        var zL = zonasLabels[L];
        var xCentro = (zL.ini - soldaLat + zL.fim + soldaLat) / 2;
        addText(groupLabelsCotas, zL.nome, xCentro, yLabel, 8, corCota, 0);
    }

    // =======================================
    // 4. INFO. (APAGAR) - GRUPO criado por ÚLTIMO (fica no topo da camada)
    // =======================================
    var groupInfo = layerV1.groupItems.add();
    groupInfo.name = "Info. (apagar)";

    // Cores dos elementos
    var corSelagem = cmyk(0,  85, 90, 0);   // vermelho/laranja
    var corSegura  = cmyk(85, 0,  100, 0);  // verde
    var corDobra   = cmyk(75, 15, 0,  0);   // azul/ciano

    var dashesArea = [4, 3];
    var strokeArea = 1;  // mesma espessura das outras linhas tracejadas

    var areaSelagemH = mm2pt(30);
    var areaDobraH   = mm2pt((2 * sanfMM) + 15);
    var margemH      = mm2pt(5);
    var margemV      = mm2pt(5);

    var yLimiteSelagem = yTopo  - areaSelagemH;
    var yLimiteDobra   = yFundo + areaDobraH;
    var yTopoSegura    = yLimiteSelagem - margemV;
    var yFundoSegura   = yLimiteDobra   + margemV;
    var alturaSegura   = yTopoSegura - yFundoSegura;

    if (alturaSegura <= 0) {
        alert("Atenção: o comprimento (" + compMM + " mm) é muito pequeno para comportar:\n" +
              "  - Área de Selagem (30 mm)\n" +
              "  - Área de Dobra (" + ((2 * sanfMM) + 15) + " mm)\n" +
              "  - Margens (10 mm)\n\n" +
              "Soma mínima: " + (30 + (2 * sanfMM) + 15 + 10) + " mm. As marcações de Info. (apagar) não foram desenhadas.");
        app.redraw();
        return;
    }

    // Definição das 4 zonas (limitadas pelas linhas EXTERNAS das soldas)
    var zonas = [
        { ini: xPouchIni  + soldaLat, fim: xFrenteIni - soldaLat, nome: "SANFONA" },
        { ini: xFrenteIni + soldaLat, fim: xFrenteFim - soldaLat, nome: "FRENTE"  },
        { ini: xFrenteFim + soldaLat, fim: xVersoIni  - soldaLat, nome: "SANFONA" },
        { ini: xVersoIni  + soldaLat, fim: xPouchFim  - soldaLat, nome: "VERSO"   }
    ];

    // -------- ÁREA DE SELAGEM (retângulos vermelhos) --------
    var groupSelagem = groupInfo.groupItems.add();
    groupSelagem.name = "Area de Selagem";
    for (var i = 0; i < zonas.length; i++) {
        var z = zonas[i];
        var x1 = z.ini + margemH;
        var x2 = z.fim - margemH;
        if (x2 - x1 > 0) {
            drawRectStroke(groupSelagem, yTopo, x1, x2 - x1, areaSelagemH, corSelagem, strokeArea, dashesArea);
        }
    }

    // -------- ÁREA DE DOBRA APÓS FORMATADO (retângulos azuis) --------
    var groupDobra = groupInfo.groupItems.add();
    groupDobra.name = "Area de Dobra apos Formatado";
    for (var j = 0; j < zonas.length; j++) {
        var zd = zonas[j];
        var xd1 = zd.ini + margemH;
        var xd2 = zd.fim - margemH;
        if (xd2 - xd1 > 0) {
            drawRectStroke(groupDobra, yLimiteDobra, xd1, xd2 - xd1, areaDobraH, corDobra, strokeArea, dashesArea);
        }
    }

    // -------- ÁREA SEGURA PARA TEXTOS (retângulos verdes) --------
    var groupSegura = groupInfo.groupItems.add();
    groupSegura.name = "Area Segura para Textos";
    for (var k = 0; k < zonas.length; k++) {
        var zs = zonas[k];
        var xs1 = zs.ini + margemH;
        var xs2 = zs.fim - margemH;
        if (xs2 - xs1 > 0) {
            drawRectStroke(groupSegura, yTopoSegura, xs1, xs2 - xs1, alturaSegura, corSegura, strokeArea, dashesArea);
        }
    }

    // -------- LEGENDA NO RODAPÉ --------
    // A caixa cobre toda a largura do material (xPouchIni a xPouchFim) e por consequência
    // fica centralizada na planta. O conteúdo é alinhado à esquerda com padding interno.
    var groupLegenda = groupInfo.groupItems.add();
    groupLegenda.name = "Legenda";

    var capW         = mm2pt(14);             // largura da cápsula
    var capH         = mm2pt(5);              // altura da cápsula (raio = capH/2 = 2.5mm → cápsula completa)
    var padInterno   = mm2pt(8);              // padding interno horizontal da caixa
    var padVert      = mm2pt(4);              // padding interno vertical
    var espQuadTexto = mm2pt(3);              // espaço entre cápsula e texto
    var espItens     = mm2pt(12);             // espaço entre um item e o próximo
    var fontLegenda  = 8;
    var raioCaixa    = mm2pt(3);              // raio dos cantos da caixa

    // Caixa externa: largura = largura do material útil, centralizada (cobre de xPouchIni a xPouchFim)
    var caixaLeft   = xPouchIni;
    var caixaW      = xPouchFim - xPouchIni;
    var caixaH      = capH + (padVert * 2);
    // Topo da caixa: 10mm abaixo do fundo do material
    var caixaTop    = yFundo - mm2pt(10);
    var caixaCentroY = caixaTop - (caixaH / 2);

    drawRoundedRectStroke(groupLegenda, caixaTop, caixaLeft, caixaW, caixaH, raioCaixa, raioCaixa, corCota, 0.5);

    // Conteúdo da legenda
    var itens = [
        { texto: "APAGAR",                          cor: null      },
        { texto: "ÁREA SEGURA",                     cor: corSegura },
        { texto: "ÁREA DE SELAGEM",                 cor: corSelagem},
        { texto: "ÁREA DE DOBRA APÓS FORMATADO",    cor: corDobra  }
    ];

    var corApagar = cmyk(0, 0, 0, 70);   // 70% de preto, só para o APAGAR

    var xAtual = caixaLeft + padInterno;

    for (var p = 0; p < itens.length; p++) {
        var it = itens[p];
        var sizeAtual, corAtual;
        if (it.cor) {
            // Item com cápsula: 8pt, cinza padrão (corCota)
            sizeAtual = fontLegenda;
            corAtual  = corCota;
            drawCapsuleFill(groupLegenda, caixaCentroY + (capH / 2), xAtual, capW, capH, it.cor);
            xAtual += capW + espQuadTexto;
        } else {
            // APAGAR: 10pt, 70% preto
            sizeAtual = 10;
            corAtual  = corApagar;
        }
        // Texto da legenda, centralizado verticalmente em caixaCentroY
        var tf = groupLegenda.textFrames.add();
        tf.contents = it.texto;
        tf.textRange.characterAttributes.size = sizeAtual;
        applyArialBold(tf);
        try { tf.textRange.characterAttributes.fillColor = corAtual; } catch(e) {}
        tf.top  = caixaCentroY + (tf.height / 2);
        tf.left = xAtual;
        xAtual += tf.width + espItens;
    }

    app.redraw();
    alert("4 Soldas v1.1 gerado com sucesso!");
}