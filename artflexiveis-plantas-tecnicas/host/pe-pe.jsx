// ==========================================
// PE-PE.JSX — PE+PE (laminado simples)
// Portado 1:1 de reference/PE+PE_V1_0.JSX (desenharPEPE_Completo, linhas 184–291)
// Depende dos helpers definidos em core.jsx (mm2pt, cmyk, drawRect, drawLine,
// drawCotaH, drawCotaV, addText, jsonOk, jsonErr).
//
// Mudanças cirúrgicas em relação ao original:
//   1. Declaração renomeada: desenharPEPE_Completo → gerarPePe
//   2. Corpo envolto em try/catch com retorno de string JSON
//   3. alerts substituídos por retornos via jsonOk(mensagem) / jsonErr(erro)
//      (helpers de core.jsx — ExtendScript ES3 não possui JSON nativo)
// Nada mais foi alterado (constantes, variáveis, ordem, agrupamentos, cores).
// ==========================================

function gerarPePe(compMM, largMM) {
    try {
        var compPt = mm2pt(compMM);
        var largPt = mm2pt(largMM);

        var refile  = mm2pt(3);
        var cameron = mm2pt(3);

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
        // 3. COTAS HORIZONTAIS (3 NÍVEIS)
        //    Nível 1: comprimento total (2 faces)
        //    Nível 2: comprimento por face
        //    Nível 3: refile e cameron nas 4 extremidades
        // =======================================
        var yCota1 = yTopo + mm2pt(25);
        var yCota2 = yTopo + mm2pt(15);
        var yCota3 = yTopo + mm2pt(6);

        var groupCotas = groupAll.groupItems.add();

        drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, (compMM * 2) + " mm", corCota);

        drawCotaH(groupCotas, xPouchIni, xCentro,   yCota2, compMM + " mm", corCota);
        drawCotaH(groupCotas, xCentro,   xPouchFim, yCota2, compMM + " mm", corCota);

        drawCotaH(groupCotas, xCamEsq,   xRefEsq,   yCota3, "", corCota, 6, "3 mm CAMERON");
        drawCotaH(groupCotas, xRefEsq,   xPouchIni, yCota3, "", corCota, 6, "3 mm REFILE");
        drawCotaH(groupCotas, xPouchFim, xRefDir,   yCota3, "", corCota, 6, "3 mm REFILE");
        drawCotaH(groupCotas, xRefDir,   xCamDir,   yCota3, "", corCota, 6, "3 mm CAMERON");

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
        return jsonOk("PE+PE gerado com sucesso!");
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
