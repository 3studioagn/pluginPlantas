// ==========================================
// SCRIPT: Rótulo e Sleeve v1.4
//
// Eixos:
//   Horizontal = largura × 2 [+ 12 mm para sleeve]
//   Vertical   = comprimento
//
// Estrutura de camadas / grupos:
//   [Rótulo Pig. Branco]  Camada "Fundo"  ← 20% K, +2 mm em todos os lados
//   Camada "V1"
//     Material   (pathItem)
//     Arte       (group)  ← contém cyan + fotocélulas (quando Pig. Branco)
//     Cotas      (group)
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
        if (fonts[i].family === "Arial" && fonts[i].style === "Bold") {
            _arialBold = fonts[i]; return fonts[i];
        }
    }
    return null;
}
function applyArialBold(t) {
    var f = getArialBold();
    if (f) try { t.textRange.characterAttributes.textFont = f; } catch(e) {}
}

function drawCotaH(g, x1, x2, y, txt, clr, fs) {
    if (fs === undefined) fs = 12;
    var tick = mm2pt(1);
    var grp  = g.groupItems.add();
    function seg(ax1, ay1, ax2, ay2) {
        var p = grp.pathItems.add();
        p.setEntirePath([[ax1,ay1],[ax2,ay2]]);
        p.filled=false; p.stroked=true; p.strokeColor=clr; p.strokeWidth=1;
    }
    seg(x1, y, x2, y);
    seg(x1, y+tick, x1, y-tick);
    seg(x2, y+tick, x2, y-tick);
    if (txt !== "") {
        var t = grp.textFrames.add();
        t.contents = txt;
        t.textRange.characterAttributes.size = fs;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = clr; } catch(e) {}
        t.top  = y + mm2pt(2) + t.height;
        t.left = x1 + (x2-x1)/2 - t.width/2;
    }
}

function drawCotaV(g, x, y1, y2, txt, clr, fs) {
    if (fs === undefined) fs = 12;
    var tick = mm2pt(1);
    var grp  = g.groupItems.add();
    function seg(ax1, ay1, ax2, ay2) {
        var p = grp.pathItems.add();
        p.setEntirePath([[ax1,ay1],[ax2,ay2]]);
        p.filled=false; p.stroked=true; p.strokeColor=clr; p.strokeWidth=1;
    }
    seg(x, y1, x, y2);
    seg(x-tick, y1, x+tick, y1);
    seg(x-tick, y2, x+tick, y2);
    if (txt !== "") {
        var t = grp.textFrames.add();
        t.contents = txt;
        t.textRange.characterAttributes.size = fs;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = clr; } catch(e) {}
        t.rotate(90);
        t.top  = (y1+y2)/2 + t.height/2;
        t.left = x - mm2pt(2) - t.width;
    }
}

function _fmtMM(v) {
    if (Math.abs(v - Math.round(v)) < 0.005) return String(Math.round(v));
    return (Math.round(v*100)/100).toString().replace('.', ',');
}

// ============================================================
//  INTERFACE
// ============================================================
var dlg = new Window("dialog", "Gerador: Rótulo e Sleeve v1.4");
dlg.orientation   = "column";
dlg.alignChildren = "right";

var gComp = dlg.add("group");
gComp.add("statictext", undefined, "Comprimento (mm):");
var inComp = gComp.add("edittext", undefined, "100");
inComp.characters = 7;

var gLarg = dlg.add("group");
gLarg.add("statictext", undefined, "Largura (mm):");
var inLarg = gLarg.add("edittext", undefined, "80");
inLarg.characters = 7;

var pTipo = dlg.add("panel", undefined, "Tipo de Material");
pTipo.orientation="row"; pTipo.alignChildren="left"; pTipo.margins=[10,15,10,10];
var rbSleeve = pTipo.add("radiobutton", undefined, "Sleeve");
var rbRotulo = pTipo.add("radiobutton", undefined, "Rótulo");
rbSleeve.value = true;

var pPig = dlg.add("panel", undefined, "Pigmentação");
pPig.orientation="row"; pPig.alignChildren="left"; pPig.margins=[10,15,10,10];
var rbNatural = pPig.add("radiobutton", undefined, "Natural");
var rbBranco  = pPig.add("radiobutton", undefined, "Pig. Branco");
rbNatural.value = true;
pPig.visible   = false;

var gBtn = dlg.add("group");
gBtn.alignment = "center";
gBtn.add("button", undefined, "Cancelar",     { name:"cancel" });
gBtn.add("button", undefined, "Gerar Planta", { name:"ok"     });

rbSleeve.onClick = function() {
    pPig.visible = false;
    dlg.layout.layout(true); dlg.layout.resize();
};
rbRotulo.onClick = function() {
    pPig.visible = true;
    dlg.layout.layout(true); dlg.layout.resize();
};

// ============================================================
//  EXECUÇÃO
// ============================================================
if (dlg.show() === 1) {
    var compMM = parseFloat(inComp.text.replace(',','.'));
    var largMM = parseFloat(inLarg.text.replace(',','.'));
    if (isNaN(compMM) || isNaN(largMM) || compMM <= 0 || largMM <= 0) {
        alert("Erro: insira valores válidos para comprimento e largura.");
    } else {
        var tipo = rbSleeve.value ? "sleeve" : "rotulo";
        var pig  = (tipo === "rotulo" && rbBranco.value) ? "branco" : "natural";
        gerarPlanta(compMM, largMM, tipo, pig);
    }
}

// ============================================================
//  DESENHO
// ============================================================
function gerarPlanta(compMM, largMM, tipo, pig) {

    // Dimensões
    var matLargMM, mE, mD, mT, mB;
    if (tipo === "sleeve") {
        matLargMM = largMM * 2 + 12;
        mE=2; mD=7; mT=2; mB=2;
    } else {
        matLargMM = largMM * 2;
        mE=7; mD=7; mT=4; mB=4;
    }

    var arteLargMM = matLargMM - mE - mD;
    var arteCompMM = compMM    - mT - mB;

    if (arteLargMM <= 0 || arteCompMM <= 0) {
        alert("Erro: margens excedem as dimensões do material."); return;
    }

    var COR_MAT  = (pig === "branco") ? cmyk(0,0,0,0) : cmyk(15,12,12,0);
    var COR_ARTE = cmyk(70,10,16,0);
    var COR_COTA = cmyk(0,0,0,60);
    var COR_FOTO = cmyk(0,0,0,100);
    var COR_FUNDO = cmyk(0,0,0,20);

    var matW = mm2pt(matLargMM);
    var matH = mm2pt(compMM);
    var mrgX = mm2pt(60);
    var mrgY = mm2pt(55);

    // ----------------------------------------------------------
    // Documento — camada única V1
    // Ordem de adição dentro de V1 (primeiro = mais abaixo):
    //   Fundo (só rótulo branco) → Material → Arte → Cotas
    // ----------------------------------------------------------
    var doc = app.documents.add(DocumentColorSpace.CMYK,
                                matW + mrgX * 2,
                                matH + mrgY * 2);

    var defBlue = doc.layers[0].color;
    var lay     = doc.layers.add();
    lay.name    = "V1";
    lay.color   = defBlue;
    doc.layers[doc.layers.length - 1].remove();

    // ----------------------------------------------------------
    // Posicionamento central na prancheta
    // ----------------------------------------------------------
    var ab = doc.artboards[0].artboardRect;
    var xL = ab[0] + (ab[2]-ab[0]-matW) / 2;
    var xR = xL + matW;
    var yT = ab[1] - (ab[1]-ab[3]-matH) / 2;
    var yB = yT - matH;

    // ----------------------------------------------------------
    // 0. FUNDO  (rótulo branco — adicionado primeiro = abaixo de tudo)
    //    Cinza 20% K, 2 mm além do material em todos os lados
    // ----------------------------------------------------------
    if (tipo === "rotulo" && pig === "branco") {
        var rFundo = lay.pathItems.rectangle(
            yT + mm2pt(2),
            xL - mm2pt(2),
            matW + mm2pt(4),
            matH + mm2pt(4)
        );
        rFundo.name      = "Fundo";
        rFundo.filled    = true;
        rFundo.fillColor = COR_FUNDO;
        rFundo.stroked   = false;
    }

    // 1. MATERIAL
    var rMat = lay.pathItems.rectangle(yT, xL, matW, matH);
    rMat.name      = "Material";
    rMat.filled    = true;
    rMat.fillColor = COR_MAT;
    rMat.stroked   = false;

    // 2. GRUPO ARTE
    //    Contém: retângulo cyan + fotocélulas (quando Pig. Branco)
    var grpArte = lay.groupItems.add();
    grpArte.name = "Arte";

    // Área impressa (cyan)
    var aL = xL + mm2pt(mE);
    var aR = xR - mm2pt(mD);
    var aT = yT - mm2pt(mT);
    var aB = yB + mm2pt(mB);

    var rArte = grpArte.pathItems.rectangle(aT, aL, aR-aL, aT-aB);
    rArte.name      = "Área Impressa";
    rArte.filled    = true;
    rArte.fillColor = COR_ARTE;
    rArte.stroked   = false;

    // Fotocélulas dentro do grupo Arte (somente Pig. Branco)
    if (pig === "branco") {
        // Superior: canto superior esquerdo
        var fSup = grpArte.pathItems.rectangle(yT, xL, mm2pt(10), mm2pt(4));
        fSup.name      = "Fotocélula Sup";
        fSup.filled    = true;
        fSup.fillColor = COR_FOTO;
        fSup.stroked   = false;

        // Inferior: canto inferior esquerdo
        var fInf = grpArte.pathItems.rectangle(yB + mm2pt(4), xL, mm2pt(10), mm2pt(4));
        fInf.name      = "Fotocélula Inf";
        fInf.filled    = true;
        fInf.fillColor = COR_FOTO;
        fInf.stroked   = false;
    }

    // 3. GRUPO COTAS (direto na camada)
    var grpCotas = lay.groupItems.add();
    grpCotas.name = "Cotas";

    // Horizontais — largura do material
    var yH1 = yT + mm2pt(20);
    var yH2 = yT + mm2pt(8);
    var fsE = (mE < 15) ? 6 : 12;
    var fsD = (mD < 15) ? 6 : 12;

    drawCotaH(grpCotas, xL, xR, yH1, _fmtMM(matLargMM)  + " mm", COR_COTA);
    drawCotaH(grpCotas, xL, aL, yH2, _fmtMM(mE)         + " mm", COR_COTA, fsE);
    drawCotaH(grpCotas, aL, aR, yH2, _fmtMM(arteLargMM) + " mm", COR_COTA);
    drawCotaH(grpCotas, aR, xR, yH2, _fmtMM(mD)         + " mm", COR_COTA, fsD);

    // Verticais — comprimento do material
    var xV1 = xL - mm2pt(17);
    var xV2 = xL - mm2pt(8);
    var fsT = (mT < 15) ? 6 : 12;
    var fsB = (mB < 15) ? 6 : 12;

    drawCotaV(grpCotas, xV1, yT, yB, _fmtMM(compMM)     + " mm", COR_COTA);
    drawCotaV(grpCotas, xV2, yT, aT, _fmtMM(mT)         + " mm", COR_COTA, fsT);
    drawCotaV(grpCotas, xV2, aT, aB, _fmtMM(arteCompMM) + " mm", COR_COTA);
    drawCotaV(grpCotas, xV2, aB, yB, _fmtMM(mB)         + " mm", COR_COTA, fsB);

    app.redraw();
    alert(((tipo==="sleeve")?"SLEEVE":"RÓTULO") + " gerado com sucesso!\n\n" +
          "Material : " + _fmtMM(matLargMM) + " × " + _fmtMM(compMM) + " mm\n" +
          "Arte     : " + _fmtMM(arteLargMM) + " × " + _fmtMM(arteCompMM) + " mm");
}