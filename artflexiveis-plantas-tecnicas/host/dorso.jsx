// ==========================================
// DORSO.JSX — Pouch Dorso com Sanfona
// Portado 1:1 de reference/Dorso-com-Sanfona_V1_0.jsx (desenharPouchDorso_Completo, linhas 203–416)
// Depende dos helpers definidos em core.jsx (mm2pt, cmyk, drawRect, drawLine,
// drawCotaH, drawCotaV, addText, jsonOk, jsonErr).
//
// Mudanças cirúrgicas em relação ao original:
//   1. Declaração renomeada: desenharPouchDorso_Completo → gerarDorso
//   2. Corpo envolto em try/catch com retorno de string JSON
//   3. alerts substituídos por retornos via jsonOk(mensagem) / jsonErr(erro)
//      (helpers de core.jsx — ExtendScript ES3 não possui JSON nativo)
// Nada mais foi alterado (constantes, variáveis, ordem, agrupamentos, cores,
// incluindo dead code: DESLOC_MM, soldaLat, soldaFundo, ySoldaFundo, yMeio,
// xSanfEsqDobra, xSanfDirDobra, corFaca).
// ==========================================

function gerarDorso(compMM, largMM, sanfMM) {
    try {
        // ---------------------------------------
        // CONSTANTES DO PROCESSO (não mudam)
        // ---------------------------------------
        var MARGEM_ESQ_MM = 30;    // margem fixa à esquerda (cinza)
        var MARGEM_DIR_MM = 15;    // margem fixa à direita (cinza)
        var DESLOC_MM     = 7.5;   // deslocamento para a direita (= (30-15)/2)

        // ---------------------------------------
        // CÁLCULOS DA ESTRUTURA
        // ---------------------------------------
        // Face central = largMM − 2×sanfMM − 15
        // Sanfona aberta = 2 × sanfMM
        // Largura total material = 2 × largMM
        // Espaço útil entre margens cinzas = 2×largMM − 30 − 15
        // Meia-frente = (espaço útil − face central − 2×sanfona aberta) / 2

        var faceCentralMM  = largMM - (2 * sanfMM) - 15;
        var sanfAbertaMM   = 2 * sanfMM;
        var totalMM        = 2 * largMM;
        var espUtilMM      = totalMM - MARGEM_ESQ_MM - MARGEM_DIR_MM;
        var meiaFrenteMM   = (espUtilMM - faceCentralMM - (2 * sanfAbertaMM)) / 2;

        // Validação
        if (faceCentralMM <= 0) {
            return jsonErr("A largura (" + largMM + " mm) deve ser maior que 2×sanfona+15 (" + (2 * sanfMM + 15) + " mm).");
        }
        if (meiaFrenteMM <= 0) {
            return jsonErr("As medidas resultam em meia-frente inválida (" + meiaFrenteMM + " mm). Ajuste os valores.");
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
        var soldaLat   = mm2pt(7.5);            // soldas verticais laterais
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
        var corFaca    = cmyk(0, 0, 0, 60);
        var corCota    = cmyk(0, 0, 0, 60);
        var corMagenta = cmyk(0, 100, 0, 0);
        var corMagentaAmarelo = cmyk(0, 50, 100, 0);  // Magenta: 50, Amarelo: 100

        // Centraliza o conteúdo na prancheta
        var ab   = doc.artboards[0].artboardRect; // [left, top, right, bottom]
        var x0   = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
        var y0   = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

        // ---------------------------------------
        // EIXOS X (da esquerda para a direita)
        // Estrutura: [cameron][refile][MARGEM 30][meia-frente][sanf][face central][sanf][meia-frente][MARGEM 15][refile][cameron]
        // ---------------------------------------
        var xCamEsq        = x0;                                // início cameron esquerdo
        var xRefEsq        = xCamEsq       + cameron;           // fim cameron / início refile esquerdo
        var xPouchIni      = xRefEsq       + refile;            // início material útil

        var xMeiaFrenteEsq = xPouchIni     + margEsqPt;         // fim margem esq / início meia-frente esq
        var xSanfEsqIni    = xMeiaFrenteEsq + meiaFrentePt;     // fim meia-frente esq / início sanfona esq
        var xSanfEsqDobra  = xSanfEsqIni   + mm2pt(sanfMM);     // dobra central da sanfona esquerda
        var xFaceCenIni    = xSanfEsqIni   + sanfAbertaPt;      // fim sanfona esq / início face central
        var xFaceCenFim    = xFaceCenIni   + faceCentralPt;     // fim face central / início sanfona dir
        var xSanfDirDobra  = xFaceCenFim   + mm2pt(sanfMM);     // dobra central da sanfona direita
        var xSanfDirFim    = xFaceCenFim   + sanfAbertaPt;      // fim sanfona dir / início meia-frente dir
        var xMargDirIni    = xSanfDirFim   + meiaFrentePt;      // fim meia-frente dir / início margem dir

        var xPouchFim      = xMargDirIni   + margDirPt;         // fim material útil
        var xRefDir        = xPouchFim     + refile;
        var xCamDir        = xRefDir       + cameron;

        // ---------------------------------------
        // EIXOS Y
        // ---------------------------------------
        var yTopo       = y0;
        var yFundo      = yTopo - compPt;
        var ySoldaFundo = yFundo + soldaFundo;
        var yMeio       = yTopo - (compPt / 2);

        // =======================================
        // 1. BASE E CHAPADOS
        // =======================================

        // Material (base cinza) — solto na camada V1, criado primeiro (fica no fundo)
        var rectMaterial = drawRect(layerV1, yTopo, xPouchIni, totalPt, totalPouchH, corFundo);
        rectMaterial.name = "Material";

        // Camerons (preto, agrupados)
        var groupCameron = layerV1.groupItems.add(); groupCameron.name = "Cameron";
        var rc1 = groupCameron.pathItems.rectangle(yTopo, xCamEsq, cameron, totalPouchH);
        rc1.filled = true; rc1.stroked = false; rc1.fillColor = corPreto;
        var rc2 = groupCameron.pathItems.rectangle(yTopo, xRefDir, cameron, totalPouchH);
        rc2.filled = true; rc2.stroked = false; rc2.fillColor = corPreto;

        // Grupo "Arte" - contém fotocelula e área de arte
        var groupArte = layerV1.groupItems.add(); groupArte.name = "Arte";

        // Retângulo preto adicional (15x10 mm, 15 mm acima da base) - Fotocélula
        var rectAdicionalW = mm2pt(15);
        var rectAdicionalH = mm2pt(10);
        var rectAdicionalY = yFundo + mm2pt(15) + rectAdicionalH;  // 15 mm acima da base + altura do retângulo
        var rectAdicionalX = xPouchIni;  // alinhado à esquerda do material (início da base)
        var rectFotocelula = groupArte.pathItems.rectangle(rectAdicionalY, rectAdicionalX, rectAdicionalW, rectAdicionalH);
        rectFotocelula.filled = true; rectFotocelula.stroked = false; rectFotocelula.fillColor = corPreto;
        rectFotocelula.name = "Fotocélula";

        // Retângulo magenta-amarelo (da extremidade direita da fotocelula até 3mm além do material) - Arte
        var rectMagentaX1 = rectAdicionalX + rectAdicionalW;  // extremidade direita da fotocelula
        var rectMagentaX2 = xPouchFim + mm2pt(3);            // 3mm além da extremidade direita do material
        var rectMagentaW = rectMagentaX2 - rectMagentaX1;    // largura total
        var rectMagentaH = totalPouchH;                      // altura total do material
        var rectMagentaY = yTopo;                           // do topo
        var rectArte = groupArte.pathItems.rectangle(rectMagentaY, rectMagentaX1, rectMagentaW, rectMagentaH);
        rectArte.filled = true; rectArte.stroked = false; rectArte.fillColor = corMagentaAmarelo;
        rectArte.name = "Arte";

        // Grupo "Cotas" — criado por último (fica no topo)
        var groupAll = layerV1.groupItems.add(); groupAll.name = "Cotas";

        // ---------------------------------------
        // =======================================
        // 4. COTAS HORIZONTAIS (3 NÍVEIS)
        // =======================================
        // 4. COTAS HORIZONTAIS (3 NÍVEIS)
        // Nível 1 (mais alto): largura total (2 x largMM)
        // Nível 2: estrutura detalhada [30 | meia-frente | sanf | face central | sanf | meia-frente | 15]
        // Nível 3: refile/cameron nas extremidades
        // =======================================
        var yCota1 = yTopo + mm2pt(25);
        var yCota2 = yTopo + mm2pt(15);
        var yCota3 = yTopo + mm2pt(6);

        var groupCotas = groupAll.groupItems.add();

        // Nível 1 — total
        drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, totalMM + " mm", corCota);

        // Nível 2 — estrutura detalhada
        // Helper: formata número em PT-BR com vírgula quando tem decimal
        function fmtMM(v) {
            var r = Math.round(v * 100) / 100;
            if (r === Math.floor(r)) return r + " mm";
            return (r + "").replace(".", ",") + " mm";
        }

        // Dividir margem esquerda de 30 mm em duas de 15 mm
        var xMeioMargEsq = xPouchIni + mm2pt(15);  // ponto intermediário aos 15 mm
        drawCotaH(groupCotas, xPouchIni,     xMeioMargEsq,    yCota2, "15 mm", corCota);
        drawCotaH(groupCotas, xMeioMargEsq,  xMeiaFrenteEsq,  yCota2, "15 mm", corCota);
        drawCotaH(groupCotas, xMeiaFrenteEsq,   xSanfEsqIni,    yCota2, fmtMM(meiaFrenteMM),     corCota);
        drawCotaH(groupCotas, xSanfEsqIni,      xFaceCenIni,    yCota2, fmtMM(sanfAbertaMM),     corCota);
        drawCotaH(groupCotas, xFaceCenIni,      xFaceCenFim,    yCota2, fmtMM(faceCentralMM),    corCota);
        drawCotaH(groupCotas, xFaceCenFim,      xSanfDirFim,    yCota2, fmtMM(sanfAbertaMM),     corCota);
        drawCotaH(groupCotas, xSanfDirFim,      xMargDirIni,    yCota2, fmtMM(meiaFrenteMM),     corCota);
        drawCotaH(groupCotas, xMargDirIni,      xPouchFim,      yCota2, fmtMM(MARGEM_DIR_MM),    corCota);

        // Nível 3 — refile/cameron nas extremidades
        drawCotaH(groupCotas, xCamEsq, xRefEsq,   yCota3, "", corCota, 6, "3 mm CAMERON");
        drawCotaH(groupCotas, xRefEsq, xPouchIni, yCota3, "", corCota, 6, "3 mm REFILE");
        drawCotaH(groupCotas, xPouchFim, xRefDir, yCota3, "", corCota, 6, "3 mm REFILE");
        drawCotaH(groupCotas, xRefDir,   xCamDir, yCota3, "", corCota, 6, "3 mm CAMERON");

        // =======================================
        // 5. COTAS VERTICAIS
        // - Comprimento total
        // =======================================
        var xCotaV1 = x0 - mm2pt(14);

        drawCotaV(groupCotas, xCotaV1, yTopo, yFundo, compMM + " mm", corCota);

        // =======================================
        // 6. LINHAS DE LIMITE DO MATERIAL (MAGENTA)
        // =======================================
        var yLimiteMaterial = yFundo - mm2pt(3);
        drawLine(groupAll, xPouchIni, yLimiteMaterial, xPouchIni, yCota3, corMagenta, 0.75, true);
        drawLine(groupAll, xPouchFim, yLimiteMaterial, xPouchFim, yCota3, corMagenta, 0.75, true);

        app.redraw();
        return jsonOk("Dorso com Sanfona gerado com sucesso!");
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
