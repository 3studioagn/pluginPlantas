// ==========================================
// TERMO-LATERAL.JSX — Termo Lateral v1.2
// Portado 1:1 de reference/Termo-Lateral_V1_0.jsx (desenharTermoLateral, linhas 181–354)
// Depende dos helpers definidos em core.jsx (mm2pt, cmyk, drawRect, drawLine,
// drawCotaH, addText, applyArialBold, jsonOk, jsonErr).
//
// Mudanças cirúrgicas em relação ao reference:
//   1. Declaração renomeada: desenharTermoLateral → gerarTermoLateral
//   2. UI/dialog do reference removidos (UI feita pelo painel).
//   3. Helpers duplicados removidos (mm2pt, cmyk, getArialBold, applyArialBold,
//      drawRect, drawLine, drawCotaH, addText) — todos disponíveis via core.jsx
//      com semântica idêntica para os parâmetros usados aqui.
//   4. drawCotaV definido como função LOCAL aninhada (shadow do global apenas
//      dentro de gerarTermoLateral). Motivo: o reference usa um drawCotaV com
//      um 9º parâmetro `textRight` (não suportado pelo core.jsx) que rotaciona
//      o texto -90° e o posiciona à direita do eixo (necessário para o Verso).
//      Manter local preserva 1:1 a posição das cotas verticais sem afetar
//      outras estruturas que dependem do drawCotaV global.
//   5. fmt também definido como função LOCAL aninhada (helper de formatação
//      PT-BR, exclusivo desta estrutura).
//   6. Corpo envolto em try/catch com retorno de string JSON.
//   7. alerts substituídos por retornos via jsonOk(mensagem) / jsonErr(erro)
//      (helpers de core.jsx — ExtendScript ES3 não possui JSON nativo).
//   8. Normalização de booleano para temVerso (ES3 — evalScript envia strings).
// Nada mais foi alterado (constantes, variáveis, ordem, agrupamentos, cores,
// posicionamento de cotas, dimensões do documento e da prancheta).
// ==========================================

function gerarTermoLateral(compMM, largMM, temVerso) {
    try {
        // Normaliza flag para booleano ExtendScript (ES3 — evalScript envia strings).
        temVerso = (temVerso === true || temVerso === "true");

        // -----------------------------------------------------------------
        // HELPERS LOCAIS — específicos do Termo Lateral.
        //   • drawCotaV: override do global de core.jsx para suportar textRight
        //     (rotação -90° + posicionamento à direita do eixo, usado no Verso).
        //   • fmt: formatação PT-BR (inteiro sem decimal, decimal com vírgula).
        // Mantidos 1:1 com o reference (linhas 89–119 e 137–140).
        // -----------------------------------------------------------------
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

        function fmt(n) {
            if (Math.abs(n - Math.round(n)) < 0.005) return String(Math.round(n));
            return (Math.round(n * 10) / 10).toString().replace('.', ',');
        }

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
            return jsonErr("Erro: dimensões insuficientes para as margens definidas.");
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
        return jsonOk("Termo Lateral v1.2 gerado com sucesso! ");
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
