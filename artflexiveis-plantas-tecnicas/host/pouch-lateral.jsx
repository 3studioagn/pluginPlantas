// ==========================================
// POUCH-LATERAL.JSX — Pouch Lateral v1.0
// Portado 1:1 de reference/Pouch-Lateral_V1_0.JSX (desenharPouchLateral, linhas 169–310)
// Depende dos helpers definidos em core.jsx (mm2pt, cmyk, drawRect, drawLine,
// drawCotaH, drawCotaV, addText, applyArialBold, jsonOk, jsonErr).
//
// Mudanças cirúrgicas em relação ao reference:
//   1. Declaração renomeada: desenharPouchLateral → gerarPouchLateral
//   2. UI/dialog do reference removidos (UI feita pelo painel).
//   3. Helpers duplicados removidos (mm2pt, cmyk, getArialBold, applyArialBold,
//      drawRect, drawLine, drawCotaH, drawCotaV, addText) — todos disponíveis
//      via core.jsx com semântica idêntica para os parâmetros usados aqui.
//   4. Corpo envolto em try/catch com retorno de string JSON.
//   5. alerts substituídos por retornos via jsonOk(mensagem) / jsonErr(erro)
//      (helpers de core.jsx — ExtendScript ES3 não possui JSON nativo).
// Nada mais foi alterado (constantes, variáveis, ordem, agrupamentos, cores,
// posicionamento de cotas, dimensões do documento e da prancheta).
// ==========================================

function gerarPouchLateral(compMM, largMM) {
    try {
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
            return jsonErr("Erro: a largura informada é insuficiente para as soldas (mínimo " +
                           (7.5 * 2 + 5 * 2 + 1) + " mm).");
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
        return jsonOk("Pouch Lateral v1.0 gerado com sucesso! " +
                      "Material: " + (compMM * 2) + " × " + largMM + " mm; " +
                      "Arte: " + compMM + " × " + (largMM - 25) + " mm (por face)");
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
