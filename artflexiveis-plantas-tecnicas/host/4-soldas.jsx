// ==========================================
// 4-SOLDAS.JSX — 4 Soldas
// Portado 1:1 de reference/4-Soldas _V1_0.JSX (desenhar4Soldas_Completo, linhas 186–411)
// Depende dos helpers definidos em core.jsx (mm2pt, cmyk, drawRect, drawLine,
// drawCotaH, drawCotaV, addText, jsonOk, jsonErr).
//
// Mudanças cirúrgicas em relação ao original:
//   1. Declaração renomeada: desenhar4Soldas_Completo → gerar4Soldas
//   2. Corpo envolto em try/catch com retorno de string JSON
//   3. alerts substituídos por retornos via jsonOk(mensagem) / jsonErr(erro)
//      (helpers de core.jsx — ExtendScript ES3 não possui JSON nativo)
// Nada mais foi alterado (constantes, variáveis, ordem, agrupamentos, cores,
// incluindo xSanfEsqDobra/xSanfCenDobra que são declarados e nunca usados).
// ==========================================

function gerar4Soldas(compMM, largMM, sanfMM) {
    try {
        // ---------------------------------------
        // PARÂMETROS BASE
        // ---------------------------------------
        // Largura útil de FRENTE/VERSO (sem a sanfona):
        //   utilFace = largMM - (2 * sanfMM)
        // Faixa de sanfona total (lateral) = 2 * sanfMM
        // ---------------------------------------
        var utilFace = largMM - (2 * sanfMM);

        if (utilFace <= 0) {
            return jsonErr("A largura (" + largMM + " mm) deve ser maior que 2x a sanfona (" + (2 * sanfMM) + " mm).");
        }

        var compPt     = mm2pt(compMM);
        var largPt     = mm2pt(largMM);
        var sanfPt     = mm2pt(sanfMM);
        var utilFacePt = mm2pt(utilFace);
        var sanfFaixa  = sanfPt * 2;            // faixa total de sanfona (60 mm no exemplo)

        var refile     = mm2pt(3);              // refile lateral (extremidades)
        var cameron    = mm2pt(3);              // cameron lateral (extremidades)
        var soldaLat   = mm2pt(7.5);            // 4 soldas verticais (laterais e centrais)
        var soldaFundo = mm2pt(15);             // solda do fundo (apenas no fundo)

        // ---------------------------------------
        // DIMENSÕES TOTAIS DO MATERIAL
        // ---------------------------------------
        // Largura total no eixo X (linha de impressão):
        //   FRENTE (utilFace) + sanfona total (2*sanf) + VERSO (utilFace) + sanfona total (2*sanf) = 2*largMM
        // Mas o material útil para impressão é apenas o "tubo" central (sem refile/cameron das laterais).
        //
        // No 4 soldas, as 4 faixas de "SOLDA" verticais marcadas no PDF são as zonas onde
        // ocorrem as soldas laterais da máquina. Elas estão dentro das próprias faces:
        //   - 1 solda na extremidade esquerda (lateral esquerda)
        //   - 1 solda no centro do material (entre frente e verso)
        //   - 1 solda na divisa de sanfonas (entre face e sanfona)
        //   - cada face tem soldas em ambos os lados das suas dobras de sanfona
        //
        // Layout horizontal (do PDF):
        //   [REFILE 3][CAMERON 3] | [SANF 30][SANF 30] | [FRENTE 115] | [SANF 30][SANF 30] | [VERSO 115] | [CAMERON 3][REFILE 3]
        //   onde a faixa de sanfona = 2x30 = 60 mm
        // ---------------------------------------

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

        // Centraliza o conteúdo na prancheta
        var ab   = doc.artboards[0].artboardRect; // [left, top, right, bottom]
        var x0   = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
        var y0   = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

        // ---------------------------------------
        // EIXOS X (da esquerda para a direita)
        // ---------------------------------------
        var xCamEsq    = x0;                              // início cameron esquerdo
        var xRefEsq    = xCamEsq    + cameron;            // fim cameron / início refile esquerdo
        var xPouchIni  = xRefEsq    + refile;             // início material útil = início sanfona esquerda

        // Sanfona esquerda (faixa = 2 * sanfMM)
        var xSanfEsqDobra = xPouchIni + sanfPt;           // dobra central da sanfona esquerda
        var xFrenteIni    = xPouchIni + sanfFaixa;        // início FRENTE (fim sanfona esquerda)
        var xFrenteFim    = xFrenteIni + utilFacePt;      // fim FRENTE = início sanfona central

        // Sanfona central (entre frente e verso)
        var xSanfCenDobra = xFrenteFim + sanfPt;          // dobra central da sanfona central
        var xVersoIni     = xFrenteFim + sanfFaixa;       // início VERSO (fim sanfona central)
        var xVersoFim     = xVersoIni + utilFacePt;       // fim VERSO = fim material útil = xPouchFim

        var xPouchFim  = xVersoFim;
        var xRefDir    = xPouchFim  + refile;
        var xCamDir    = xRefDir    + cameron;

        // ---------------------------------------
        // EIXOS Y
        // ---------------------------------------
        var yTopo       = y0;
        var yFundo      = yTopo - compPt;
        var ySoldaFundo = yFundo + soldaFundo;            // limite superior da solda do fundo

        // =======================================
        // 1. BASE E CHAPADOS
        // =======================================

        // Material (base cinza) — solto na camada V1, criado primeiro (fica no fundo)
        var rectMaterial = drawRect(layerV1, yTopo, xPouchIni, totalPouchW - (cameron * 2) - (refile * 2), totalPouchH, corFundo);
        rectMaterial.name = "Material";

        // Camerons (preto, agrupados) — grupo "Cameron", criado segundo
        var groupCameron = layerV1.groupItems.add(); groupCameron.name = "Cameron";
        var rc1 = groupCameron.pathItems.rectangle(yTopo, xCamEsq, cameron, totalPouchH);
        rc1.filled = true; rc1.stroked = false; rc1.fillColor = corPreto;
        var rc2 = groupCameron.pathItems.rectangle(yTopo, xRefDir, cameron, totalPouchH);
        rc2.filled = true; rc2.stroked = false; rc2.fillColor = corPreto;

        // Grupo "Cotas" — criado por último (fica no topo)
        var groupAll = layerV1.groupItems.add(); groupAll.name = "Cotas";

        // ---------------------------------------
        // Labels de SOLDA do fundo (horizontal, dentro da faixa do fundo)
        // ---------------------------------------
        var yMeio = yTopo - (compPt / 2);
        addText(groupAll, "SOLDA", xFrenteIni + (utilFacePt / 2), yFundo + (soldaFundo / 2), 8, corCota, 0);  // centralizada com FRENTE
        addText(groupAll, "SOLDA", xVersoIni  + (utilFacePt / 2), yFundo + (soldaFundo / 2), 8, corCota, 0);  // centralizada com VERSO

        // =======================================
        // 2. LINHAS DE FACA E DOBRA
        // =======================================
        // Limite inferior do material (faca)
        drawLine(groupAll, xPouchIni, yFundo, xPouchFim, yFundo, corFaca, 1, true);

        // Limite da solda do fundo (linha horizontal)
        drawLine(groupAll, xPouchIni, ySoldaFundo, xPouchFim, ySoldaFundo, corFaca, 1, true);

        // =======================================
        // 3. LIMITES ZONA K-SEAL - REMOVIDO
        // (as linhas ±5 mm das dobras centrais foram removidas)
        // =======================================

        // =======================================
        // 3b. FAIXAS DE SOLDAS VERTICAIS AGRUPADAS (7,5 mm cada)
        // Cada par de linhas tracejadas + linha central + label "SOLDA" em um grupo
        // =======================================

        // Grupo 1: Solda extremidade esquerda
        var groupSoldaEsq = groupAll.groupItems.add();
        drawLine(groupSoldaEsq, xPouchIni, yTopo, xPouchIni, yFundo, corFaca, 1, true);                    // linha da extremidade
        drawLine(groupSoldaEsq, xPouchIni + soldaLat, yTopo, xPouchIni + soldaLat, yFundo, corCota, 0.75, true);  // linha +7,5
        addText(groupSoldaEsq, "SOLDA", xPouchIni + mm2pt(3.75), yMeio, 8, corCota, 90);

        // Grupo 2: Solda extremidade direita
        var groupSoldaDir = groupAll.groupItems.add();
        drawLine(groupSoldaDir, xPouchFim, yTopo, xPouchFim, yFundo, corFaca, 1, true);                    // linha da extremidade
        drawLine(groupSoldaDir, xPouchFim - soldaLat, yTopo, xPouchFim - soldaLat, yFundo, corCota, 0.75, true);  // linha -7,5
        addText(groupSoldaDir, "SOLDA", xPouchFim - mm2pt(3.75), yMeio, 8, corCota, 90);

        // Grupo 3: Soldas início FRENTE (par de linhas + linha central + 2 labels)
        var groupSoldaIniFrente = groupAll.groupItems.add();
        drawLine(groupSoldaIniFrente, xFrenteIni, yTopo, xFrenteIni, yFundo, corFaca, 1, true);                    // linha central
        drawLine(groupSoldaIniFrente, xFrenteIni - soldaLat, yTopo, xFrenteIni - soldaLat, yFundo, corCota, 0.75, true);  // linha -7,5
        drawLine(groupSoldaIniFrente, xFrenteIni + soldaLat, yTopo, xFrenteIni + soldaLat, yFundo, corCota, 0.75, true);  // linha +7,5
        addText(groupSoldaIniFrente, "SOLDA", xFrenteIni - mm2pt(3.75), yMeio, 8, corCota, 90);
        addText(groupSoldaIniFrente, "SOLDA", xFrenteIni + mm2pt(3.75), yMeio, 8, corCota, 90);

        // Grupo 4: Soldas final FRENTE (par de linhas + linha central + 2 labels)
        var groupSoldaFimFrente = groupAll.groupItems.add();
        drawLine(groupSoldaFimFrente, xFrenteFim, yTopo, xFrenteFim, yFundo, corFaca, 1, true);                    // linha central
        drawLine(groupSoldaFimFrente, xFrenteFim - soldaLat, yTopo, xFrenteFim - soldaLat, yFundo, corCota, 0.75, true);  // linha -7,5
        drawLine(groupSoldaFimFrente, xFrenteFim + soldaLat, yTopo, xFrenteFim + soldaLat, yFundo, corCota, 0.75, true);  // linha +7,5
        addText(groupSoldaFimFrente, "SOLDA", xFrenteFim - mm2pt(3.75), yMeio, 8, corCota, 90);
        addText(groupSoldaFimFrente, "SOLDA", xFrenteFim + mm2pt(3.75), yMeio, 8, corCota, 90);

        // Grupo 5: Soldas início VERSO (par de linhas + linha central + 2 labels)
        var groupSoldaIniVerso = groupAll.groupItems.add();
        drawLine(groupSoldaIniVerso, xVersoIni, yTopo, xVersoIni, yFundo, corFaca, 1, true);                    // linha central
        drawLine(groupSoldaIniVerso, xVersoIni - soldaLat, yTopo, xVersoIni - soldaLat, yFundo, corCota, 0.75, true);   // linha -7,5
        drawLine(groupSoldaIniVerso, xVersoIni + soldaLat, yTopo, xVersoIni + soldaLat, yFundo, corCota, 0.75, true);   // linha +7,5
        addText(groupSoldaIniVerso, "SOLDA", xVersoIni - mm2pt(3.75), yMeio, 8, corCota, 90);
        addText(groupSoldaIniVerso, "SOLDA", xVersoIni + mm2pt(3.75), yMeio, 8, corCota, 90);

        // =======================================
        // 4. COTAS HORIZONTAIS (3 NÍVEIS)
        // Nível 1 (mais alto): largura total no eixo X (2 x largMM)
        // Nível 2: estrutura básica (sanfFaixa | utilFace | sanfFaixa | utilFace)
        // Nível 3: refile/cameron nas extremidades
        // =======================================
        var yCota1 = yTopo + mm2pt(25);
        var yCota2 = yTopo + mm2pt(15);
        var yCota3 = yTopo + mm2pt(6);

        var groupCotas = groupAll.groupItems.add();

        // Nível 1 — total
        drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, (largMM * 2) + " mm", corCota);

        // Nível 2 — estrutura básica: sanfFaixa | utilFace | sanfFaixa | utilFace
        drawCotaH(groupCotas, xPouchIni,  xFrenteIni, yCota2, (sanfMM * 2) + " mm", corCota);
        drawCotaH(groupCotas, xFrenteIni, xFrenteFim, yCota2, utilFace + " mm", corCota);
        drawCotaH(groupCotas, xFrenteFim, xVersoIni,  yCota2, (sanfMM * 2) + " mm", corCota);
        drawCotaH(groupCotas, xVersoIni,  xVersoFim,  yCota2, utilFace + " mm", corCota);

        // Nível 3 — refile/cameron nas extremidades
        drawCotaH(groupCotas, xCamEsq, xRefEsq,   yCota3, "", corCota, 6, "3 mm CAMERON");
        drawCotaH(groupCotas, xRefEsq, xPouchIni, yCota3, "", corCota, 6, "3 mm REFILE");
        drawCotaH(groupCotas, xPouchFim, xRefDir, yCota3, "", corCota, 6, "3 mm REFILE");
        drawCotaH(groupCotas, xRefDir,   xCamDir, yCota3, "", corCota, 6, "3 mm CAMERON");

        // =======================================
        // 5. COTAS VERTICAIS
        // - Comprimento total
        // - Solda do fundo (15 mm)
        // =======================================
        var xCotaV2 = x0 - mm2pt(5);
        var xCotaV1 = xCotaV2 - mm2pt(9);

        drawCotaV(groupCotas, xCotaV1, yTopo,       yFundo,      compMM + " mm",       corCota);
        drawCotaV(groupCotas, xCotaV2, ySoldaFundo, yFundo,      "15 mm",              corCota, 8);

        // =======================================
        // 6. LINHAS DE LIMITE DO MATERIAL (MAGENTA)
        // =======================================
        var yLimiteMaterial = yFundo - mm2pt(3);
        drawLine(groupAll, xPouchIni, yLimiteMaterial, xPouchIni, yCota3, corMagenta, 0.75, true);
        drawLine(groupAll, xPouchFim, yLimiteMaterial, xPouchFim, yCota3, corMagenta, 0.75, true);

        app.redraw();
        return jsonOk("4 Soldas gerado com sucesso!");
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
