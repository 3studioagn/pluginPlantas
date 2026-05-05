// ==========================================
// PE-PE.JSX — PE+PE (laminado simples) v2.0
// Portado 1:1 de reference/PE+PE_V2_0.JSX (desenharPEPE_Completo, linhas 218–379)
// Depende dos helpers definidos em core.jsx (mm2pt, cmyk, drawRect, drawLine,
// drawCotaH, drawCotaV, addText, jsonOk, jsonErr).
//
// Mudanças cirúrgicas em relação ao reference:
//   1. Declaração renomeada: desenharPEPE_Completo → gerarPePe
//   2. Assinatura plana com flag hasSanfona (padrão do painel — espelha o
//      checkbox "Sanfona" da UI). Quando hasSanfona=false, sanfonaMM é
//      forçado a 0 internamente — reproduz o comportamento do reference V2
//      (sanfonaMM=0 ⇒ temSanfona=false, geometria de pouch plano sem sanfona).
//   3. Corpo envolto em try/catch com retorno de string JSON
//   4. alerts substituídos por retornos via jsonOk(mensagem) / jsonErr(erro)
//      (helpers de core.jsx — ExtendScript ES3 não possui JSON nativo)
// Nada mais foi alterado (constantes, variáveis, ordem, agrupamentos, cores,
// posições de cota, fontes adaptativas).
// ==========================================

function gerarPePe(compMM, largMM, hasSanfona, sanfonaMM) {
    try {
        // Normaliza flag para booleano ExtendScript (ES3 — evalScript envia strings).
        hasSanfona = (hasSanfona === true || hasSanfona === "true");

        // Sanfona: 0 = desligada; >0 = valor em mm. Espelha a semântica do
        // reference V2.0 (sanfonaMM=0 ⇒ temSanfona=false).
        if (!hasSanfona) {
            sanfonaMM = 0;
        } else if (isNaN(sanfonaMM) || sanfonaMM <= 0) {
            return jsonErr("Valor da sanfona inválido.");
        }

        var temSanfona = (sanfonaMM > 0);

        var compPt = mm2pt(compMM);
        var largPt = mm2pt(largMM);

        var refile  = mm2pt(3);
        var cameron = mm2pt(3);

        // Validação: sanfona + K-seal precisam caber dentro de cada face
        if (temSanfona && (sanfonaMM + 5) >= compMM) {
            return jsonErr("Sanfona (" + sanfonaMM + "mm) + 5mm K-seal excedem o comprimento por face (" +
                  compMM + "mm).");
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

            drawCotaH(groupCotas, xPouchIni, xSanfE_c, yCota3, _pe_fmtMM(faceLadoMM) + " mm", corCota, _fontFace);
            drawCotaH(groupCotas, xSanfE_c,  xCentro,  yCota3, _pe_fmtMM(sanfonaMM)  + " mm", corCota, _fontSanf);
            drawCotaH(groupCotas, xCentro,   xSanfD_c, yCota3, _pe_fmtMM(sanfonaMM)  + " mm", corCota, _fontSanf);
            drawCotaH(groupCotas, xSanfD_c,  xPouchFim, yCota3, _pe_fmtMM(faceLadoMM) + " mm", corCota, _fontFace);

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
        return jsonOk("PE+PE gerado com sucesso!");
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}

// Formata número em mm: inteiro exato sem decimal, outros com vírgula e 2 casas.
// Portado 1:1 do reference V2 (linhas 162–165, lá chamado _fmtMM). Prefixado
// como _pe_fmtMM para evitar conflito no escopo global do ExtendScript
// (padrão também usado em pe-pp.jsx → _pp_fmtMM e sleeve-rotulo.jsx → _sr_fmtMM).
function _pe_fmtMM(v) {
    if (Math.abs(v - Math.round(v)) < 0.005) return String(Math.round(v));
    return (Math.round(v * 100) / 100).toString().replace('.', ',');
}
