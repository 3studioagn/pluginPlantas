// ==========================================
// SLEEVE-ROTULO.JSX — Sleeve e Rótulo v1.4
// Portado 1:1 de reference/Sleeve-e-Rótulo_V1_0.jsx (gerarPlanta, linhas 154–296)
// Depende dos helpers definidos em core.jsx (mm2pt, cmyk, drawCotaH, drawCotaV,
// applyArialBold, jsonOk, jsonErr).
//
// Mudanças cirúrgicas em relação ao reference:
//   1. Declaração renomeada: gerarPlanta → gerarSleeveRotulo
//   2. Assinatura plana com booleanos (espelha os checkboxes do painel —
//      isSleeve substitui o radio "Sleeve|Rótulo"; pigBranco substitui o
//      radio "Natural|Pig. Branco"). Internamente continuamos usando as
//      strings "sleeve"/"rotulo" e "natural"/"branco" do reference.
//   3. UI/dialog do reference removidos (UI feita pelo painel).
//   4. Helpers duplicados removidos (mm2pt, cmyk, getArialBold, applyArialBold,
//      drawCotaH, drawCotaV) — todos disponíveis via core.jsx com semântica
//      idêntica para os parâmetros usados aqui. _fmtMM permanece como helper
//      local prefixado (_sr_fmtMM) para evitar conflito de escopo global.
//   5. Corpo envolto em try/catch com retorno de string JSON.
//   6. alerts substituídos por retornos via jsonOk(mensagem) / jsonErr(erro)
//      (helpers de core.jsx — ExtendScript ES3 não possui JSON nativo).
// Nada mais foi alterado (constantes, variáveis, ordem, agrupamentos, cores,
// posicionamento de cotas, dimensões do documento e da prancheta).
// ==========================================

// Formata número em PT-BR: inteiro sem decimal, decimal com vírgula.
function _sr_fmtMM(v) {
    if (Math.abs(v - Math.round(v)) < 0.005) return String(Math.round(v));
    return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

function gerarSleeveRotulo(compMM, largMM, isSleeve, pigBranco) {
    try {
        // Normaliza flags para booleanos ExtendScript (ES3 — evalScript envia strings).
        isSleeve  = (isSleeve  === true || isSleeve  === "true");
        pigBranco = (pigBranco === true || pigBranco === "true");

        // Mapeia para as strings usadas pelo reference (1:1 com o original).
        // tipo === "rotulo" quando isSleeve=false (Rótulo é o "alternativo" do Sleeve).
        // pig  === "branco" só quando Rótulo + checkbox de Pig. Branco marcado.
        var tipo = isSleeve ? "sleeve" : "rotulo";
        var pig  = (tipo === "rotulo" && pigBranco) ? "branco" : "natural";

        // Dimensões
        var matLargMM, mE, mD, mT, mB;
        if (tipo === "sleeve") {
            matLargMM = largMM * 2 + 12;
            mE = 2; mD = 7; mT = 2; mB = 2;
        } else {
            matLargMM = largMM * 2;
            mE = 7; mD = 7; mT = 4; mB = 4;
        }

        var arteLargMM = matLargMM - mE - mD;
        var arteCompMM = compMM    - mT - mB;

        if (arteLargMM <= 0 || arteCompMM <= 0) {
            return jsonErr("Erro: margens excedem as dimensões do material.");
        }

        var COR_MAT   = (pig === "branco") ? cmyk(0, 0, 0, 0) : cmyk(15, 12, 12, 0);
        var COR_ARTE  = cmyk(70, 10, 16, 0);
        var COR_COTA  = cmyk(0, 0, 0, 60);
        var COR_FOTO  = cmyk(0, 0, 0, 100);
        var COR_FUNDO = cmyk(0, 0, 0, 20);

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
        var xL = ab[0] + (ab[2] - ab[0] - matW) / 2;
        var xR = xL + matW;
        var yT = ab[1] - (ab[1] - ab[3] - matH) / 2;
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

        var rArte = grpArte.pathItems.rectangle(aT, aL, aR - aL, aT - aB);
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

        drawCotaH(grpCotas, xL, xR, yH1, _sr_fmtMM(matLargMM)  + " mm", COR_COTA);
        drawCotaH(grpCotas, xL, aL, yH2, _sr_fmtMM(mE)         + " mm", COR_COTA, fsE);
        drawCotaH(grpCotas, aL, aR, yH2, _sr_fmtMM(arteLargMM) + " mm", COR_COTA);
        drawCotaH(grpCotas, aR, xR, yH2, _sr_fmtMM(mD)         + " mm", COR_COTA, fsD);

        // Verticais — comprimento do material
        var xV1 = xL - mm2pt(17);
        var xV2 = xL - mm2pt(8);
        var fsT = (mT < 15) ? 6 : 12;
        var fsB = (mB < 15) ? 6 : 12;

        drawCotaV(grpCotas, xV1, yT, yB, _sr_fmtMM(compMM)     + " mm", COR_COTA);
        drawCotaV(grpCotas, xV2, yT, aT, _sr_fmtMM(mT)         + " mm", COR_COTA, fsT);
        drawCotaV(grpCotas, xV2, aT, aB, _sr_fmtMM(arteCompMM) + " mm", COR_COTA);
        drawCotaV(grpCotas, xV2, aB, yB, _sr_fmtMM(mB)         + " mm", COR_COTA, fsB);

        app.redraw();

        var titulo = (tipo === "sleeve") ? "SLEEVE" : "RÓTULO";
        var msg = titulo + " gerado com sucesso! " +
                  "Material: " + _sr_fmtMM(matLargMM)  + " × " + _sr_fmtMM(compMM)     + " mm; " +
                  "Arte: "     + _sr_fmtMM(arteLargMM) + " × " + _sr_fmtMM(arteCompMM) + " mm";
        if (tipo === "rotulo" && pig === "branco") msg += " (Pig. Branco)";
        return jsonOk(msg);
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
