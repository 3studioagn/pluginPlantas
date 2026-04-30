// ==========================================
// SCRIPT: POUCH DORSO (COM OU SEM SANFONA) v2.0
// Baseado na lógica de montagem flexível
// ==========================================
//
// LÓGICA DA MONTAGEM:
// - Largura total do material (eixo X) = 2 × largMM
// - Comprimento = compMM
// - Margens laterais FIXAS: 30 mm (esquerda) | 15 mm (direita)
// - Estrutura útil (entre as margens fixas):
//     [meia-frente] [sanfona aberta] [face central] [sanfona aberta] [meia-frente]
//   onde:
//     sanfona aberta  = 2 × sanfMM (Se não houver sanfona, assume 0)
//     face central    = largMM − 2×sanfMM − 15
//     meia-frente     = (espaço útil − face central − 2×sanfona aberta) / 2
//
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
var dlg = new Window("dialog", "Gerador: Pouch Dorso");
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
    // ---------------------------------------
    // CONSTANTES DO PROCESSO (não mudam)
    // ---------------------------------------
    var MARGEM_ESQ_MM = 30;    // margem fixa à esquerda (cinza)
    var MARGEM_DIR_MM = 15;    // margem fixa à direita (cinza)

    // ---------------------------------------
    // CÁLCULOS DA ESTRUTURA
    // ---------------------------------------
    var faceCentralMM  = largMM - (2 * sanfMM) - 15;
    var sanfAbertaMM   = 2 * sanfMM;
    var totalMM        = 2 * largMM;
    var espUtilMM      = totalMM - MARGEM_ESQ_MM - MARGEM_DIR_MM;
    var meiaFrenteMM   = (espUtilMM - faceCentralMM - (2 * sanfAbertaMM)) / 2;

    // Validação
    if (faceCentralMM <= 0) {
        alert("Atenção: a largura (" + largMM + " mm) deve ser maior que 2×sanfona+15 (" + (2 * sanfMM + 15) + " mm).");
        return;
    }
    if (meiaFrenteMM <= 0) {
        alert("Atenção: as medidas resultam em meia-frente inválida (" + meiaFrenteMM + " mm). Ajuste os valores.");
        return;
    }

    // ---------------------------------------
    // CONVERSÕES PARA PONTOS
    // ---------------------------------------
    var compPt        = mm2pt(compMM);
    var margEsqPt     = mm2pt(MARGEM_ESQ_MM);
    var margDirPt     = mm2pt(MARGEM_DIR_MM);
    var meiaFrentePt  = mm2pt(meiaFrenteMM);
    var sanfAbertaPt  = mm2pt(sanfAbertaMM);
    var faceCentralPt = mm2pt(faceCentralMM);
    var totalPt       = mm2pt(totalMM);

    var refile     = mm2pt(3);              // refile lateral (extremidades)
    var cameron    = mm2pt(3);              // cameron lateral (extremidades)
    var soldaFundo = mm2pt(15);             // solda do fundo

    // ---------------------------------------
    // DIMENSÕES TOTAIS DO DOCUMENTO
    // ---------------------------------------
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

    var corFundo   = cmyk(15, 12, 12, 0);
    var corPreto   = cmyk(0, 0, 0, 100);
    var corCota    = cmyk(0, 0, 0, 60);
    var corMagenta = cmyk(0, 100, 0, 0);
    var corMagentaAmarelo = cmyk(0, 50, 100, 0);

    // Centraliza o conteúdo na prancheta
    var ab   = doc.artboards[0].artboardRect;
    var x0   = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0   = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // ---------------------------------------
    // EIXOS X (da esquerda para a direita)
    // ---------------------------------------
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

    // ---------------------------------------
    // EIXOS Y
    // ---------------------------------------
    var yTopo       = y0;
    var yFundo      = yTopo - compPt;

    // =======================================
    // 1. BASE E CHAPADOS
    // =======================================
    var rectMaterial = drawRect(layerV1, yTopo, xPouchIni, totalPt, totalPouchH, corFundo);
    rectMaterial.name = "Material";

    var groupCameron = layerV1.groupItems.add(); groupCameron.name = "Cameron";
    var rc1 = groupCameron.pathItems.rectangle(yTopo, xCamEsq, cameron, totalPouchH);
    rc1.filled = true; rc1.stroked = false; rc1.fillColor = corPreto;
    var rc2 = groupCameron.pathItems.rectangle(yTopo, xRefDir, cameron, totalPouchH);
    rc2.filled = true; rc2.stroked = false; rc2.fillColor = corPreto;

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
    var rectMagentaW = rectMagentaX2 - rectMagentaX1;    
    var rectMagentaH = totalPouchH;                      
    var rectMagentaY = yTopo;                           
    var rectArte = groupArte.pathItems.rectangle(rectMagentaY, rectMagentaX1, rectMagentaW, rectMagentaH);
    rectArte.filled = true; rectArte.stroked = false; rectArte.fillColor = corMagentaAmarelo;
    rectArte.name = "Arte";

    var groupAll = layerV1.groupItems.add(); groupAll.name = "Cotas";

    // =======================================
    // 4. COTAS HORIZONTAIS
    // =======================================
    var yCota1 = yTopo + mm2pt(25);
    var yCota2 = yTopo + mm2pt(15);
    var yCota3 = yTopo + mm2pt(6);

    var groupCotas = groupAll.groupItems.add();

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

    // =======================================
    // 5. COTAS VERTICAIS
    // =======================================
    var xCotaV1 = x0 - mm2pt(14);
    drawCotaV(groupCotas, xCotaV1, yTopo, yFundo, compMM + " mm", corCota);

    // =======================================
    // 6. LINHAS DE LIMITE DO MATERIAL
    // =======================================
    var yLimiteMaterial = yFundo - mm2pt(3);
    drawLine(groupAll, xPouchIni, yLimiteMaterial, xPouchIni, yCota3, corMagenta, 0.75, true);
    drawLine(groupAll, xPouchFim, yLimiteMaterial, xPouchFim, yCota3, corMagenta, 0.75, true);

    app.redraw();
    
    var msgFinal = "Pouch Dorso gerado com sucesso!\n\n" +
                   "Comprimento: " + compMM + " mm\n" +
                   "Largura:     " + largMM + " mm (total: " + totalMM + " mm)\n";
                   
    if (sanfMM > 0) {
        msgFinal += "Sanfona:     " + sanfMM + " mm (aberta: " + sanfAbertaMM + " mm)\n";
    } else {
        msgFinal += "Modelo:      Sem Sanfona\n";
    }
    
    msgFinal += "Face central: " + faceCentralMM + " mm\n" +
                "Versos (meia-frente):  " + meiaFrenteMM + " mm";
                
    alert(msgFinal);
}