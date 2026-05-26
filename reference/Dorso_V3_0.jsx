// ==========================================
// SCRIPT: POUCH DORSO (COM OU SEM SANFONA) v1.1
// Baseado no v1.0
// Adiciona:
//   - Linhas tracejadas verticais marcando frente/verso (com sanfona: tb sanfonas)
//   - Labels SANFONA / FRENTE / VERSO (abaixo dos números das cotas, 8pt)
//   - Grupo "Info. (apagar)" com:
//       Área de Selagem (vermelho)          - 30 mm do topo
//       Área Segura para Textos (verde)     - 5mm das linhas, 5mm da selagem,
//                                              35mm do fundo (sem sanf) ou
//                                              5mm da dobra (com sanf)
//       Área de Dobra após Formatado (azul) - apenas se sanfMM > 0 (2*sanf+15mm)
//       Legenda no rodapé (3 itens sem sanf, 4 itens com sanf)
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

// dashed: undefined/false (sem dashes), true ([5,5] default), ou array customizado
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

// Cápsula preenchida (pill shape)
function drawCapsuleFill(parent, top, left, w, h, color) {
    var rect = parent.pathItems.roundedRectangle(top, left, w, h, h / 2, h / 2, false);
    rect.filled = true;
    rect.stroked = false;
    rect.fillColor = color;
    return rect;
}

function drawRoundedRectStroke(parent, top, left, w, h, hRadius, vRadius, color, strokeW) {
    var rect = parent.pathItems.roundedRectangle(top, left, w, h, hRadius, vRadius, false);
    rect.filled = false;
    rect.stroked = true;
    rect.strokeColor = color;
    rect.strokeWidth = strokeW || 0.5;
    return rect;
}

// --- FUNÇÕES DE TEXTO E COTAS ---
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
var dlg = new Window("dialog", "Gerador: Pouch Dorso v1.1");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group"); g1.add("statictext", undefined, "Comprimento (mm):");
var inputComp = g1.add("edittext", undefined, "230"); inputComp.characters = 5;

var g2 = dlg.add("group"); g2.add("statictext", undefined, "Largura (mm):");
var inputLarg = g2.add("edittext", undefined, "155"); inputLarg.characters = 5;

var gCheck = dlg.add("group");
var cbSanfona = gCheck.add("checkbox", undefined, "Com Sanfona");
cbSanfona.value = false;

var g3 = dlg.add("group"); g3.add("statictext", undefined, "Sanfona Lateral (mm):");
var inputSanf = g3.add("edittext", undefined, "20"); inputSanf.characters = 5;
inputSanf.enabled = cbSanfona.value;

cbSanfona.onClick = function() {
    inputSanf.enabled = cbSanfona.value;
};

var grupoBotoes = dlg.add("group"); grupoBotoes.alignment = "center";
grupoBotoes.add("button", undefined, "Cancelar", { name: "cancel" });
grupoBotoes.add("button", undefined, "Gerar Planta", { name: "ok" });

// --- EXECUÇÃO ---
if (dlg.show() == 1) {
    var c = parseFloat(inputComp.text.replace(',', '.'));
    var l = parseFloat(inputLarg.text.replace(',', '.'));
    var s = 0;

    if (cbSanfona.value) {
        s = parseFloat(inputSanf.text.replace(',', '.'));
    }

    if (isNaN(c) || isNaN(l) || (cbSanfona.value && isNaN(s))) {
        alert("Erro: Digite valores válidos.");
    } else {
        desenharPouchDorso_Completo(c, l, s);
    }
}

// --- LÓGICA PRINCIPAL ---
function desenharPouchDorso_Completo(compMM, largMM, sanfMM) {
    // CONSTANTES DO PROCESSO
    var MARGEM_ESQ_MM = 30;
    var MARGEM_DIR_MM = 15;

    // CÁLCULOS DA ESTRUTURA
    var faceCentralMM  = largMM - (2 * sanfMM) - 15;
    var sanfAbertaMM   = 2 * sanfMM;
    var totalMM        = 2 * largMM;
    var espUtilMM      = totalMM - MARGEM_ESQ_MM - MARGEM_DIR_MM;
    var meiaFrenteMM   = (espUtilMM - faceCentralMM - (2 * sanfAbertaMM)) / 2;

    // Validações
    if (faceCentralMM <= 0) {
        alert("Atenção: a largura (" + largMM + " mm) deve ser maior que 2×sanfona+15 (" + (2 * sanfMM + 15) + " mm).");
        return;
    }
    if (meiaFrenteMM <= 0) {
        alert("Atenção: as medidas resultam em meia-frente inválida (" + meiaFrenteMM + " mm). Ajuste os valores.");
        return;
    }

    // CONVERSÕES PARA PONTOS
    var compPt        = mm2pt(compMM);
    var margEsqPt     = mm2pt(MARGEM_ESQ_MM);
    var margDirPt     = mm2pt(MARGEM_DIR_MM);
    var meiaFrentePt  = mm2pt(meiaFrenteMM);
    var sanfAbertaPt  = mm2pt(sanfAbertaMM);
    var faceCentralPt = mm2pt(faceCentralMM);
    var totalPt       = mm2pt(totalMM);

    var refile     = mm2pt(3);
    var cameron    = mm2pt(3);
    var soldaFundo = mm2pt(15);

    var totalPouchW = (cameron * 2) + (refile * 2) + totalPt;
    var totalPouchH = compPt;

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);

    var docW = totalPouchW + (marginX * 2);
    var docH = totalPouchH + (marginY * 2);

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;

    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var corFundo            = cmyk(15, 12, 12, 0);
    var corPreto            = cmyk(0, 0, 0, 100);
    var corCota             = cmyk(0, 0, 0, 60);
    var corMagenta          = cmyk(0, 100, 0, 0);
    var corMagentaAmarelo   = cmyk(0, 17, 65, 0);  // #ffd45a

    var ab   = doc.artboards[0].artboardRect;
    var x0   = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0   = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // EIXOS X
    var xCamEsq        = x0;
    var xRefEsq        = xCamEsq       + cameron;
    var xPouchIni      = xRefEsq       + refile;

    var xMeiaFrenteEsq = xPouchIni     + margEsqPt;
    var xSanfEsqIni    = xMeiaFrenteEsq + meiaFrentePt;
    var xSanfEsqDobra  = xSanfEsqIni   + mm2pt(sanfMM);
    var xFaceCenIni    = xSanfEsqIni   + sanfAbertaPt;
    var xFaceCenFim    = xFaceCenIni   + faceCentralPt;
    var xSanfDirDobra  = xFaceCenFim   + mm2pt(sanfMM);
    var xSanfDirFim    = xFaceCenFim   + sanfAbertaPt;
    var xMargDirIni    = xSanfDirFim   + meiaFrentePt;

    var xPouchFim      = xMargDirIni   + margDirPt;
    var xRefDir        = xPouchFim     + refile;
    var xCamDir        = xRefDir       + cameron;

    // EIXOS Y
    var yTopo       = y0;
    var yFundo      = yTopo - compPt;

    // =======================================
    // 1. MATERIAL (path solto)
    // =======================================
    var rectMaterial = drawRect(layerV1, yTopo, xPouchIni, totalPt, totalPouchH, corFundo);
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
    // 3. ARTE (grupo: fotocélula + arte laranja)
    // =======================================
    var groupArte = layerV1.groupItems.add(); groupArte.name = "Arte";

    var rectAdicionalW = mm2pt(15);
    var rectAdicionalH = mm2pt(10);
    var rectAdicionalY = yFundo + mm2pt(15) + rectAdicionalH;
    var rectAdicionalX = xPouchIni;
    var rectFotocelula = groupArte.pathItems.rectangle(rectAdicionalY, rectAdicionalX, rectAdicionalW, rectAdicionalH);
    rectFotocelula.filled = true; rectFotocelula.stroked = false; rectFotocelula.fillColor = corPreto;
    rectFotocelula.name = "Fotocélula";

    var rectMagentaX1 = rectAdicionalX + rectAdicionalW;
    var rectMagentaX2 = xPouchFim + mm2pt(3);
    var rectMagentaW  = rectMagentaX2 - rectMagentaX1;
    var rectMagentaH  = totalPouchH;
    var rectMagentaY  = yTopo;
    var rectArte = groupArte.pathItems.rectangle(rectMagentaY, rectMagentaX1, rectMagentaW, rectMagentaH);
    rectArte.filled = true; rectArte.stroked = false; rectArte.fillColor = corMagentaAmarelo;
    rectArte.name = "Arte";

    // =======================================
    // 4. COTAS (grupo) - inclui linhas verticais das zonas + labels + cotas
    // =======================================
    var groupAll = layerV1.groupItems.add(); groupAll.name = "Cotas";

    // Sub-grupo: LINHAS TRACEJADAS VERTICAIS DAS ZONAS
    var groupLinhasZonas = groupAll.groupItems.add();
    groupLinhasZonas.name = "Linhas Zonas";

    var pontosLinhas;
    if (sanfMM > 0) {
        pontosLinhas = [xMeiaFrenteEsq, xSanfEsqIni, xFaceCenIni, xFaceCenFim, xSanfDirFim, xMargDirIni];
    } else {
        pontosLinhas = [xMeiaFrenteEsq, xFaceCenIni, xFaceCenFim, xMargDirIni];
    }
    for (var L = 0; L < pontosLinhas.length; L++) {
        drawLine(groupLinhasZonas, pontosLinhas[L], yTopo, pontosLinhas[L], yFundo, corCota, 0.75, true);
    }

    // Sub-grupo: COTAS
    var yCota1 = yTopo + mm2pt(25);
    var yCota2 = yTopo + mm2pt(15);
    var yCota3 = yTopo + mm2pt(6);

    var groupCotas = groupAll.groupItems.add();
    groupCotas.name = "Cotas";

    drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, totalMM + " mm", corCota);

    function fmtMM(v) {
        var r = Math.round(v * 100) / 100;
        if (r === Math.floor(r)) return r + " mm";
        return (r + "").replace(".", ",") + " mm";
    }

    var xMeioMargEsq = xPouchIni + mm2pt(15);
    drawCotaH(groupCotas, xPouchIni,     xMeioMargEsq,    yCota2, "15 mm", corCota);
    drawCotaH(groupCotas, xMeioMargEsq,  xMeiaFrenteEsq,  yCota2, "15 mm", corCota);
    drawCotaH(groupCotas, xMeiaFrenteEsq,   xSanfEsqIni,    yCota2, fmtMM(meiaFrenteMM),     corCota);

    if (sanfAbertaMM > 0) {
        drawCotaH(groupCotas, xSanfEsqIni,      xFaceCenIni,    yCota2, fmtMM(sanfAbertaMM),     corCota);
    }

    drawCotaH(groupCotas, xFaceCenIni,      xFaceCenFim,    yCota2, fmtMM(faceCentralMM),    corCota);

    if (sanfAbertaMM > 0) {
        drawCotaH(groupCotas, xFaceCenFim,      xSanfDirFim,    yCota2, fmtMM(sanfAbertaMM),     corCota);
    }

    drawCotaH(groupCotas, xSanfDirFim,      xMargDirIni,    yCota2, fmtMM(meiaFrenteMM),     corCota);
    drawCotaH(groupCotas, xMargDirIni,      xPouchFim,      yCota2, fmtMM(MARGEM_DIR_MM),    corCota);

    drawCotaH(groupCotas, xCamEsq, xRefEsq,   yCota3, "", corCota, 6, "3 mm CAMERON");
    drawCotaH(groupCotas, xRefEsq, xPouchIni, yCota3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xPouchFim, xRefDir, yCota3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xRefDir,   xCamDir, yCota3, "", corCota, 6, "3 mm CAMERON");

    var xCotaV1 = x0 - mm2pt(14);
    drawCotaV(groupCotas, xCotaV1, yTopo, yFundo, compMM + " mm", corCota);

    // LINHAS DE LIMITE DO MATERIAL (magenta)
    var yLimiteMaterial = yFundo - mm2pt(3);
    drawLine(groupAll, xPouchIni, yLimiteMaterial, xPouchIni, yCota3, corMagenta, 0.75, true);
    drawLine(groupAll, xPouchFim, yLimiteMaterial, xPouchFim, yCota3, corMagenta, 0.75, true);

    // Definição das ZONAS
    var zonas;
    if (sanfMM > 0) {
        zonas = [
            { ini: xMeiaFrenteEsq, fim: xSanfEsqIni,  nome: "VERSO"   },
            { ini: xSanfEsqIni,    fim: xFaceCenIni,  nome: "SANFONA" },
            { ini: xFaceCenIni,    fim: xFaceCenFim,  nome: "FRENTE"  },
            { ini: xFaceCenFim,    fim: xSanfDirFim,  nome: "SANFONA" },
            { ini: xSanfDirFim,    fim: xMargDirIni,  nome: "VERSO"   }
        ];
    } else {
        zonas = [
            { ini: xMeiaFrenteEsq, fim: xFaceCenIni,  nome: "VERSO"  },
            { ini: xFaceCenIni,    fim: xFaceCenFim,  nome: "FRENTE" },
            { ini: xFaceCenFim,    fim: xMargDirIni,  nome: "VERSO"  }
        ];
    }

    // Sub-grupo: LABELS DAS ZONAS (SANFONA / FRENTE / VERSO)
    var groupLabelsCotas = groupAll.groupItems.add();
    groupLabelsCotas.name = "Labels Zonas";
    var yLabel = yCota2 - mm2pt(3);  // 3mm abaixo da linha da cota de subdivisão
    for (var LL = 0; LL < zonas.length; LL++) {
        var zLL = zonas[LL];
        var xCentroL = (zLL.ini + zLL.fim) / 2;
        addText(groupLabelsCotas, zLL.nome, xCentroL, yLabel, 8, corCota, 0);
    }

    // =======================================
    // 5. INFO. (APAGAR) - GRUPO criado por ÚLTIMO (fica no topo)
    // =======================================
    var groupInfo = layerV1.groupItems.add();
    groupInfo.name = "Info. (apagar)";

    // Cores dos elementos
    var corSelagem = cmyk(0,  85, 90, 0);   // vermelho/laranja
    var corSegura  = cmyk(85, 0,  100, 0);  // verde
    var corDobra   = cmyk(75, 15, 0,  0);   // azul/ciano

    var dashesArea = [4, 3];
    var strokeArea = 1;

    // Dimensões das áreas
    var areaSelagemH = mm2pt(30);
    var margemH      = mm2pt(5);   // 5mm das linhas tracejadas verticais
    var margemV      = mm2pt(5);   // 5mm da selagem (e da dobra, quando houver)

    var yLimiteSelagem = yTopo - areaSelagemH;
    var yTopoSegura    = yLimiteSelagem - margemV;

    var yLimiteDobra, yFundoSegura, areaDobraH;
    if (sanfMM > 0) {
        areaDobraH    = mm2pt((2 * sanfMM) + 15);
        yLimiteDobra  = yFundo + areaDobraH;
        yFundoSegura  = yLimiteDobra + margemV;  // 5mm acima da dobra
    } else {
        yFundoSegura  = yFundo + mm2pt(35);      // 35mm acima do fundo (sem sanfona)
    }
    var alturaSegura = yTopoSegura - yFundoSegura;

    if (alturaSegura <= 0) {
        var minFundo = (sanfMM > 0) ? ((2 * sanfMM) + 15 + 5) : 35;
        alert("Atenção: o comprimento (" + compMM + " mm) é muito pequeno para comportar:\n" +
              "  - Área de Selagem (30 mm)\n" +
              "  - Margem da selagem (5 mm)\n" +
              "  - " + (sanfMM > 0 ? ("Área de Dobra (" + ((2*sanfMM)+15) + " mm) + margem (5 mm)") : "35 mm do fundo") + "\n\n" +
              "Soma mínima (apenas margens, sem área segura): " + (30 + 5 + minFundo) + " mm. As marcações de Info não foram desenhadas.");
        app.redraw();
        return;
    }

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

    // -------- ÁREA DE DOBRA APÓS FORMATADO (retângulos azuis) - apenas com sanfona --------
    if (sanfMM > 0) {
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
    var groupLegenda = groupInfo.groupItems.add();
    groupLegenda.name = "Legenda";

    var capW         = mm2pt(14);
    var capH         = mm2pt(5);
    var padInterno   = mm2pt(8);
    var padVert      = mm2pt(4);
    var espQuadTexto = mm2pt(3);
    var espItens     = mm2pt(12);
    var fontLegenda  = 8;
    var raioCaixa    = mm2pt(3);

    // Caixa externa
    var caixaLeft    = xPouchIni;
    var caixaW       = xPouchFim - xPouchIni;
    var caixaH       = capH + (padVert * 2);
    var caixaTop     = yFundo - mm2pt(10);
    var caixaCentroY = caixaTop - (caixaH / 2);

    drawRoundedRectStroke(groupLegenda, caixaTop, caixaLeft, caixaW, caixaH, raioCaixa, raioCaixa, corCota, 0.5);

    // Conteúdo da legenda - 3 itens sem sanfona, 4 itens com sanfona
    var itens = [
        { texto: "APAGAR",                          cor: null      },
        { texto: "ÁREA SEGURA",                     cor: corSegura },
        { texto: "ÁREA DE SELAGEM",                 cor: corSelagem}
    ];
    if (sanfMM > 0) {
        itens.push({ texto: "ÁREA DE DOBRA APÓS FORMATADO", cor: corDobra });
    }

    var corApagar = cmyk(0, 0, 0, 70);  // 70% de preto, só para o APAGAR
    var xAtual = caixaLeft + padInterno;

    for (var p = 0; p < itens.length; p++) {
        var it = itens[p];
        var sizeAtual, corAtual;
        if (it.cor) {
            sizeAtual = fontLegenda;
            corAtual  = corCota;
            drawCapsuleFill(groupLegenda, caixaCentroY + (capH / 2), xAtual, capW, capH, it.cor);
            xAtual += capW + espQuadTexto;
        } else {
            sizeAtual = 10;
            corAtual  = corApagar;
        }
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

    var msgFinal = "Pouch Dorso v1.1 gerado com sucesso!\n\n" +
                   "Comprimento: " + compMM + " mm\n" +
                   "Largura:     " + largMM + " mm (total: " + totalMM + " mm)\n";

    if (sanfMM > 0) {
        msgFinal += "Sanfona:     " + sanfMM + " mm (aberta: " + sanfAbertaMM + " mm)\n";
        msgFinal += "Área de Dobra: " + ((2 * sanfMM) + 15) + " mm do fundo\n";
    } else {
        msgFinal += "Modelo:      Sem Sanfona (área segura fixa em 35 mm do fundo)\n";
    }

    msgFinal += "Face central: " + faceCentralMM + " mm\n" +
                "Versos (meia-frente):  " + meiaFrenteMM + " mm";

    alert(msgFinal);
}