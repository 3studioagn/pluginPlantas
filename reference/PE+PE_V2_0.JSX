// ==========================================
// SCRIPT: PE+PE v1.1
// Laminado simples (PE+PE ou PP+PP) — pouch plano sem sanfona,
// sem zíper, sem abre-fácil e sem soldas de 7,5 mm.
// Derivado do Stand-up Pouch v5.
// v1.1: opção "Sanfona" — simulada por linhas tracejadas internas
//       (2 principais a ±sanfonaMM do centro + 4 K-seal a ±5mm).
//       Cotas da sanfona no nível 3; cota K-seal de 10mm imediatamente
//       abaixo (entre o nível 3 e o material).
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

// Formata número em mm: inteiro exato sem decimal, outros com vírgula e 2 casas
function _fmtMM(v) {
    if (Math.abs(v - Math.round(v)) < 0.005) return String(Math.round(v));
    return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

// --- INTERFACE ---
var dlg = new Window("dialog", "Gerador: PE+PE");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group"); g1.add("statictext", undefined, "Comprimento Face (mm):");
var inputComp = g1.add("edittext", undefined, "260"); inputComp.characters = 5;

var g2 = dlg.add("group"); g2.add("statictext", undefined, "Largura/Altura (mm):");
var inputLarg = g2.add("edittext", undefined, "160"); inputLarg.characters = 5;

// --- Sanfona (toggle + campo) ---
var g3 = dlg.add("group"); g3.alignChildren = "right";
var inputSanfona = g3.add("checkbox", undefined, "Sanfona");
var g3b = dlg.add("group"); g3b.add("statictext", undefined, "Valor da sanfona (mm):");
var inputSanfonaVal = g3b.add("edittext", undefined, "20"); inputSanfonaVal.characters = 5;
inputSanfonaVal.enabled = false;

inputSanfona.onClick = function() {
    inputSanfonaVal.enabled = this.value;
};

var grupoBotoes = dlg.add("group"); grupoBotoes.alignment = "center";
grupoBotoes.add("button", undefined, "Cancelar", { name: "cancel" });
grupoBotoes.add("button", undefined, "Gerar Planta", { name: "ok" });

// --- EXECUÇÃO ---
if (dlg.show() == 1) {
    var c = parseFloat(inputComp.text.replace(',', '.'));
    var l = parseFloat(inputLarg.text.replace(',', '.'));
    var sanfonaMM = 0;
    var abortar = false;

    if (inputSanfona.value) {
        sanfonaMM = parseFloat(inputSanfonaVal.text.replace(',', '.'));
        if (isNaN(sanfonaMM) || sanfonaMM <= 0) {
            alert("Erro: valor da sanfona inválido.");
            abortar = true;
        }
    }

    if (abortar) {
        // erro já alertado
    } else if (isNaN(c) || isNaN(l)) {
        alert("Erro: Digite valores válidos.");
    } else {
        desenharPEPE_Completo(c, l, sanfonaMM);
    }
}

// --- LÓGICA PRINCIPAL ---
function desenharPEPE_Completo(compMM, largMM, sanfonaMM) {
    if (sanfonaMM === undefined) sanfonaMM = 0;
    var temSanfona = (sanfonaMM > 0);

    var compPt = mm2pt(compMM);
    var largPt = mm2pt(largMM);

    var refile  = mm2pt(3);
    var cameron = mm2pt(3);

    // Validação: sanfona + K-seal precisam caber dentro de cada face
    if (temSanfona && (sanfonaMM + 5) >= compMM) {
        alert("Erro: sanfona (" + sanfonaMM + "mm) + 5mm K-seal excedem o comprimento por face (" +
              compMM + "mm).");
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

    // --- EIXOS Y ---
    var yTopo  = y0;
    var yFundo = yTopo - largPt;

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

    // =======================================
    // 2. LINHA DE DOBRA CENTRAL
    // =======================================
    // Dobra central (espelho das duas faces)
    drawLine(groupAll, xCentro, yTopo, xCentro, yFundo, corFaca, 1, true);

    // =======================================
    // 2b. LINHAS DA SANFONA (se ativa)
    // Geometria Stand-up: 2 principais a ±sanfonaMM do centro (corFaca)
    // + 4 K-seal a ±5mm de cada principal (corCota, mais finas).
    // =======================================
    if (temSanfona) {
        var sanfPt = mm2pt(sanfonaMM);
        var xSanfE = xCentro - sanfPt;
        var xSanfD = xCentro + sanfPt;

        // Linhas principais da sanfona
        drawLine(groupAll, xSanfE, yTopo, xSanfE, yFundo, corFaca, 1, true);
        drawLine(groupAll, xSanfD, yTopo, xSanfD, yFundo, corFaca, 1, true);

        // Linhas K-seal (±5mm de cada linha principal)
        drawLine(groupAll, xSanfE - mm2pt(5), yTopo, xSanfE - mm2pt(5), yFundo, corCota, 0.75, true);
        drawLine(groupAll, xSanfE + mm2pt(5), yTopo, xSanfE + mm2pt(5), yFundo, corCota, 0.75, true);
        drawLine(groupAll, xSanfD - mm2pt(5), yTopo, xSanfD - mm2pt(5), yFundo, corCota, 0.75, true);
        drawLine(groupAll, xSanfD + mm2pt(5), yTopo, xSanfD + mm2pt(5), yFundo, corCota, 0.75, true);
    }

    // =======================================
    // 3. COTAS HORIZONTAIS (3 NÍVEIS)
    //    Nível 1: comprimento total (2 faces)
    //    Nível 2: comprimento por face
    //    Nível 3: refile, cameron e (se sanfona) faces + sanfona
    //    Nível K (só com sanfona): K-seal imediatamente abaixo do nível 3
    //    Obs: quando tem sanfona, os níveis 1-3 sobem 6mm para caber o nível K.
    // =======================================
    var yCota1 = yTopo + (temSanfona ? mm2pt(31) : mm2pt(25));
    var yCota2 = yTopo + (temSanfona ? mm2pt(21) : mm2pt(15));
    var yCota3 = yTopo + (temSanfona ? mm2pt(12) : mm2pt(6));

    var groupCotas = groupAll.groupItems.add();

    drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, (compMM * 2) + " mm", corCota);

    drawCotaH(groupCotas, xPouchIni, xCentro,   yCota2, compMM + " mm", corCota);
    drawCotaH(groupCotas, xCentro,   xPouchFim, yCota2, compMM + " mm", corCota);

    // Cotas das extremidades (cameron e refile) sempre aparecem
    drawCotaH(groupCotas, xCamEsq,   xRefEsq,   yCota3, "", corCota, 6, "3 mm CAMERON");
    drawCotaH(groupCotas, xRefEsq,   xPouchIni, yCota3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xPouchFim, xRefDir,   yCota3, "", corCota, 6, "3 mm REFILE");
    drawCotaH(groupCotas, xRefDir,   xCamDir,   yCota3, "", corCota, 6, "3 mm CAMERON");

    // Cotas da sanfona (no meio do nível 3) + K-seal (nível abaixo)
    if (temSanfona) {
        var sanfPtC   = mm2pt(sanfonaMM);
        var xSanfE_c  = xCentro - sanfPtC;
        var xSanfD_c  = xCentro + sanfPtC;
        var faceLadoMM = compMM - sanfonaMM;
        var _fontSanf = sanfonaMM < 15 ? 5 : 12;
        var _fontFace = faceLadoMM < 15 ? 5 : 12;

        drawCotaH(groupCotas, xPouchIni, xSanfE_c, yCota3, _fmtMM(faceLadoMM) + " mm", corCota, _fontFace);
        drawCotaH(groupCotas, xSanfE_c,  xCentro,  yCota3, _fmtMM(sanfonaMM)  + " mm", corCota, _fontSanf);
        drawCotaH(groupCotas, xCentro,   xSanfD_c, yCota3, _fmtMM(sanfonaMM)  + " mm", corCota, _fontSanf);
        drawCotaH(groupCotas, xSanfD_c,  xPouchFim, yCota3, _fmtMM(faceLadoMM) + " mm", corCota, _fontFace);

        // Nível K-seal — 10mm em cada faixa (±5mm de cada linha principal)
        var yCotaKseal = yTopo + mm2pt(4);
        drawCotaH(groupCotas, xSanfE_c - mm2pt(5), xSanfE_c + mm2pt(5), yCotaKseal, "10 mm", corCota, 5);
        drawCotaH(groupCotas, xSanfD_c - mm2pt(5), xSanfD_c + mm2pt(5), yCotaKseal, "10 mm", corCota, 5);
    }

    // =======================================
    // 4. COTA VERTICAL (largura total)
    // =======================================
    var xCotaV1 = x0 - mm2pt(14);
    drawCotaV(groupCotas, xCotaV1, yTopo, yFundo, largMM + " mm", corCota);

    // =======================================
    // 5. LINHAS DE LIMITE DO MATERIAL (MAGENTA)
    // =======================================
    var yLimiteMaterial = yFundo - mm2pt(3);
    drawLine(groupAll, xPouchIni, yLimiteMaterial, xPouchIni, yCota3, corMagenta, 0.75, true);
    drawLine(groupAll, xPouchFim, yLimiteMaterial, xPouchFim, yCota3, corMagenta, 0.75, true);

    app.redraw();
    alert("PE+PE v1.1 gerado com sucesso!");
}