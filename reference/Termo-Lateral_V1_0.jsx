// ==========================================
// SCRIPT: Termo Lateral v1.2
//
// Layout: FRENTE (esq) ←40 mm gap→ VERSO (dir)  [quando ambas marcadas]
// Cada face: comprimento (H) × largura (V)
//
// Soldas horizontais: começam 5 mm após a borda do material, 5 mm de largura.
//   Linha outer: material + 5 mm
//   Linha inner: material + 10 mm
//
// Arte padrão (máximo):
//   H: 5 mm do fundo | arte | 55 mm da boca (selagem)
//   V: 10 mm (off+solda) + 5 mm respiro | arte | 5 mm respiro + 10 mm (solda+off)
//
// Fotocélula (só FRENTE): 40 × 5 mm, 10 mm do topo, 10 mm da boca
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
    var grp = layer.groupItems.add();
    function seg(ax1, ay1, ax2, ay2) {
        var p = grp.pathItems.add();
        p.setEntirePath([[ax1,ay1],[ax2,ay2]]);
        p.filled=false; p.stroked=true; p.strokeColor=color; p.strokeWidth=1;
    }
    seg(x1, y, x2, y);
    seg(x1, y+tickH, x1, y-tickH);
    seg(x2, y+tickH, x2, y-tickH);
    if (textStr !== "") {
        var t = grp.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.top  = y + mm2pt(2) + t.height;
        t.left = x1 + (x2-x1)/2 - t.width/2;
    }
    if (verticalLabel !== undefined && verticalLabel !== "") {
        var vt = grp.textFrames.add();
        vt.contents = verticalLabel;
        vt.textRange.characterAttributes.size = fontSize;
        applyArialBold(vt);
        try { vt.textRange.characterAttributes.fillColor = color; } catch(e) {}
        vt.rotate(90);
        vt.top  = y + mm2pt(5) + vt.height;
        vt.left = x1 + (x2-x1)/2 - vt.width/2;
    }
}

function drawCotaV(layer, x, y1, y2, textStr, color, fontSize, centered, textRight) {
    if (fontSize  === undefined) fontSize  = 12;
    if (centered  === undefined) centered  = false;
    if (textRight === undefined) textRight = false;
    var tickW = mm2pt(1);
    var grp = layer.groupItems.add();
    function seg(ax1, ay1, ax2, ay2) {
        var p = grp.pathItems.add();
        p.setEntirePath([[ax1,ay1],[ax2,ay2]]);
        p.filled=false; p.stroked=true; p.strokeColor=color; p.strokeWidth=1;
    }
    seg(x, y1, x, y2);
    seg(x-tickW, y1, x+tickW, y1);
    seg(x-tickW, y2, x+tickW, y2);
    if (textStr !== "") {
        var t = grp.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.rotate(textRight ? -90 : 90);
        t.top  = (y1+y2)/2 + t.height/2;
        if (textRight) {
            t.left = x + mm2pt(2);
        } else if (centered) {
            t.left = x - t.width/2;
        } else {
            t.left = x - mm2pt(2) - t.width;
        }
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
        t.left = x - t.width/2;
    } else {
        t.top  = y + t.height/2;
        t.left = x - t.width/2;
    }
}

function fmt(n) {
    if (Math.abs(n - Math.round(n)) < 0.005) return String(Math.round(n));
    return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

// ============================================================
//  INTERFACE
// ============================================================
var dlg = new Window("dialog", "Gerador: Termo Lateral v1.2");
dlg.orientation   = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group");
g1.add("statictext", undefined, "Comprimento Face (mm):");
var inputComp = g1.add("edittext", undefined, "270"); inputComp.characters = 6;

var g2 = dlg.add("group");
g2.add("statictext", undefined, "Largura/Altura (mm):");
var inputLarg = g2.add("edittext", undefined, "160"); inputLarg.characters = 6;

var gFV = dlg.add("group"); gFV.alignChildren = "right";
var inputVerso = gFV.add("checkbox", undefined, "Frente e Verso");
inputVerso.value = true;

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
        desenharTermoLateral(c, l, inputVerso.value);
    }
}

// ============================================================
//  DESENHO
// ============================================================
function desenharTermoLateral(compMM, largMM, temVerso) {

    // ---- Constantes ----
    var soldaOffMM = 5;    // offset da borda até o início da solda
    var soldaMM    = 5;    // largura da faixa de solda
    var gapMM      = 40;   // distância entre faces (só quando temVerso)

    // Margens de arte
    var mFundoMM = 5;      // lado FUNDO (esquerdo)
    var mBocaMM  = 55;     // lado BOCA / área de selagem (direito)
    var mSoldaMM = 5;      // respiro interno após a linha inner da solda

    var compPt = mm2pt(compMM);
    var largPt = mm2pt(largMM);
    var gapPt  = mm2pt(gapMM);

    // Arte calculada
    var arteWMM = compMM - mFundoMM - mBocaMM;
    var arteHMM = largMM - (soldaOffMM + soldaMM + mSoldaMM) * 2;

    if (arteWMM <= 0 || arteHMM <= 0) {
        alert("Erro: dimensões insuficientes para as margens definidas."); return;
    }

    // ---- Cores ----
    var corMat  = cmyk(15, 12, 12, 0);
    var corCyan = cmyk(70, 10, 16, 0);
    var corFaca = cmyk(0, 0, 0, 60);
    var corCota = cmyk(0, 0, 0, 60);
    var corFoto = cmyk(0, 0, 0, 100);

    // ---- Dimensão total do conteúdo ----
    var totalW = temVerso ? (compPt * 2 + gapPt) : compPt;
    var totalH = largPt;

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
    var docW    = totalW + marginX * 2;
    var docH    = totalH + marginY * 2;

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defBlue = doc.layers[0].color;
    var lay = doc.layers.add(); lay.name = "V1"; lay.color = defBlue;
    doc.layers[doc.layers.length - 1].remove();

    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - totalW) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalH) / 2;

    // ---- Eixos X ----
    var xFL = x0;
    var xFR = xFL + compPt;
    var xVL = xFR + gapPt;
    var xVR = xVL + compPt;

    // ---- Eixos Y (comuns às duas faces) ----
    var yT   = y0;
    var ySTO = yT - mm2pt(soldaOffMM);               // outer solda topo
    var ySTI = yT - mm2pt(soldaOffMM + soldaMM);     // inner  solda topo
    var yB   = yT - largPt;
    var ySBO = yB + mm2pt(soldaOffMM);               // outer solda base
    var ySBI = yB + mm2pt(soldaOffMM + soldaMM);     // inner  solda base

    // ---- Eixos arte ----
    var aT  = ySTI - mm2pt(mSoldaMM);
    var aB  = ySBI + mm2pt(mSoldaMM);
    var aFL = xFL  + mm2pt(mFundoMM);
    var aFR = xFR  - mm2pt(mBocaMM);
    var aVL = xVL  + mm2pt(mBocaMM);    // Verso invertido: boca (55 mm) à esquerda
    var aVR = xVR  - mm2pt(mFundoMM);   // Verso invertido: fundo (5 mm) à direita

    // ============================================================
    // 1. MATERIAL
    // ============================================================
    var grpMat = lay.groupItems.add(); grpMat.name = "Material";
    var rF = drawRect(grpMat, yT, xFL, compPt, largPt, corMat); rF.name = "Frente";
    if (temVerso) {
        var rV = drawRect(grpMat, yT, xVL, compPt, largPt, corMat); rV.name = "Verso";
    }

    // ============================================================
    // 2. ARTE  (cyan)
    // ============================================================
    var grpArte = lay.groupItems.add(); grpArte.name = "Arte";

    var rAF = grpArte.pathItems.rectangle(aT, aFL, aFR-aFL, aT-aB);
    rAF.filled=true; rAF.fillColor=corCyan; rAF.stroked=false; rAF.name="Arte Frente";

    if (temVerso) {
        var rAV = grpArte.pathItems.rectangle(aT, aVL, aVR-aVL, aT-aB);
        rAV.filled=true; rAV.fillColor=corCyan; rAV.stroked=false; rAV.name="Arte Verso";
    }

    // Fotocélula — só FRENTE: 40 × 5 mm, 10 mm após a linha inner da solda, 10 mm da boca
    var rFoto = grpArte.pathItems.rectangle(
        ySTI - mm2pt(10),
        xFR  - mm2pt(10) - mm2pt(40),
        mm2pt(40), mm2pt(5)
    );
    rFoto.filled=true; rFoto.fillColor=corFoto; rFoto.stroked=false; rFoto.name="Fotocélula";

    // ============================================================
    // 3. COTAS
    // ============================================================
    var grpAll   = lay.groupItems.add(); grpAll.name = "Cotas";
    var grpCotas = grpAll.groupItems.add(); grpCotas.name = "Cotas";

    // ---- Helper: desenha todas as marcas de uma face ----
    function _desenharFace(xL, xR, aL, aR, isVerso) {
        var meiaPt = (xR - xL) / 2;
        // Margens de cada lado conforme orientação
        var mLMM = isVerso ? mBocaMM  : mFundoMM;
        var mRMM = isVerso ? mFundoMM : mBocaMM;

        // Labels SOLDA (centrados entre as duas linhas de solda)
        addText(grpAll, "SOLDA", xL + meiaPt, (ySTO+ySTI)/2, 8, corCota, 0);
        addText(grpAll, "SOLDA", xL + meiaPt, (ySBO+ySBI)/2, 8, corCota, 0);

        // Linhas de solda: outer e inner (sem bordas do material)
        drawLine(grpAll, xL, ySTO, xR, ySTO, corFaca, 1, true);
        drawLine(grpAll, xL, ySTI, xR, ySTI, corFaca, 1, true);
        drawLine(grpAll, xL, ySBO, xR, ySBO, corFaca, 1, true);
        drawLine(grpAll, xL, ySBI, xR, ySBI, corFaca, 1, true);

        // Cotas H
        var yCota1 = yT + mm2pt(15);
        var yCota2 = yT + mm2pt(6);
        drawCotaH(grpCotas, xL,  xR,  yCota1, fmt(compMM) + " mm", corCota);
        drawCotaH(grpCotas, xL,  aL,  yCota2, fmt(mLMM)   + " mm", corCota, 5);
        drawCotaH(grpCotas, aL,  aR,  yCota2, fmt(arteWMM)+ " mm", corCota);
        drawCotaH(grpCotas, aR,  xR,  yCota2, fmt(mRMM)   + " mm", corCota, 8);

        // Cotas V — 2 Níveis Consolidados (o 3º eixo foi removido)
        var xV1, xV2, tR;
        if (isVerso) {
            xV1 = xR + mm2pt(14); xV2 = xR + mm2pt(5); tR = true;
        } else {
            xV1 = xL - mm2pt(14); xV2 = xL - mm2pt(5); tR = false;
        }

        // V1: altura total
        drawCotaV(grpCotas, xV1, yT, yB, fmt(largMM) + " mm", corCota, undefined, undefined, tR);

        // V2: Eixo unificado e detalhado de ponta a ponta
        // Off (5mm) e Solda (5mm)
        drawCotaV(grpCotas, xV2, yT,   ySTO, fmt(soldaOffMM) + " mm", corCota, 5, undefined, tR);
        drawCotaV(grpCotas, xV2, ySTO, ySTI, fmt(soldaMM)    + " mm", corCota, 5, undefined, tR);
        
        // Área Central: a cota fechada de 140 mm dá espaço ao seu detalhamento exato:
        // Respiro Superior (5 mm) | Arte (130 mm) | Respiro Inferior (5 mm)
        drawCotaV(grpCotas, xV2, ySTI, aT,   fmt(mSoldaMM)   + " mm", corCota, 5, undefined, tR);
        drawCotaV(grpCotas, xV2, aT,   aB,   fmt(arteHMM)    + " mm", corCota, undefined, undefined, tR);
        drawCotaV(grpCotas, xV2, aB,   ySBI, fmt(mSoldaMM)   + " mm", corCota, 5, undefined, tR);

        // Solda (5mm) e Off (5mm)
        drawCotaV(grpCotas, xV2, ySBI, ySBO, fmt(soldaMM)    + " mm", corCota, 5, undefined, tR);
        drawCotaV(grpCotas, xV2, ySBO, yB,   fmt(soldaOffMM) + " mm", corCota, 5, undefined, tR);
    }

    _desenharFace(xFL, xFR, aFL, aFR, false);   // Frente

    if (temVerso) {
        // Cota do gap entre as faces
        var yCotaGap = yT + mm2pt(15);
        drawCotaH(grpCotas, xFR, xVL, yCotaGap, fmt(gapMM) + " mm", corCota);

        _desenharFace(xVL, xVR, aVL, aVR, true);  // Verso
    }

    app.redraw();
    alert("Termo Lateral v1.2 gerado com sucesso!\n\n" +
          "Material : " + fmt(compMM) + " × " + fmt(largMM) + " mm\n" +
          "Arte     : " + fmt(arteWMM) + " × " + fmt(arteHMM) + " mm");
}