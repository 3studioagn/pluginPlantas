// ==========================================
// 4-SOLDAS.JSX — 4 Soldas (V1.1)
// Portado 1:1 de reference/4-Soldas_V2_0.JSX (desenhar4Soldas_Completo).
// Depende dos helpers globais de core.jsx (mm2pt, cmyk, drawRect, drawCotaH,
// drawCotaV, addText, applyArialBold, jsonOk, jsonErr).
//
// Por que existem helpers LOCAIS dentro de gerar4Soldas:
//   O V2.0 introduziu primitivos de desenho que ainda não existem em
//   core.jsx (retângulo apenas com stroke, cápsula preenchida, rounded
//   rect apenas com stroke) e estendeu o drawLine para respeitar
//   strokeWidth e aceitar array customizado de dashes. O drawLine global
//   de core.jsx, hoje, IGNORA strokeW (força 1) e SEMPRE aplica [5,5] no
//   dashed — comportamento divergente do V2.0. Para não impactar os outros
//   host scripts que já dependem do drawLine global, esses primitivos são
//   declarados localmente neste arquivo (escopo da função em ES3).
//
// Mudanças cirúrgicas em relação ao reference V2.0:
//   1. Declaração renomeada: desenhar4Soldas_Completo → gerar4Soldas.
//   2. Corpo envolto em try/catch com retorno via jsonOk/jsonErr.
//   3. alerts substituídos:
//        - Erro de utilFace ≤ 0 → jsonErr (sem documento).
//        - Aviso de "alturaSegura ≤ 0" → jsonOk com mensagem informativa
//          (o documento é criado normalmente; apenas as marcações de
//          Info. (apagar) são puladas, espelhando o reference).
//        - Sucesso final → jsonOk.
// ==========================================

function gerar4Soldas(compMM, largMM, sanfMM) {
    try {
        // ---------------------------------------
        // HELPERS LOCAIS (V2.0)
        // ---------------------------------------
        // Versão de drawLine que respeita strokeW e aceita dashed como
        // array (ex.: [4,3]). Quando dashed === true, mantém o padrão [5,5].
        function drawLineL(layer, x1, y1, x2, y2, color, strokeW, dashed) {
            var line = layer.pathItems.add();
            line.setEntirePath([[x1, y1], [x2, y2]]);
            line.filled = false;
            line.stroked = true;
            line.strokeColor = color;
            line.strokeWidth = strokeW || 1;
            if (dashed) {
                if (dashed === true) line.strokeDashes = [5, 5];
                else if (dashed.length !== undefined) line.strokeDashes = dashed;
            }
            return line;
        }
        // Retângulo sem preenchimento, apenas stroke (com dashes opcionais).
        function drawRectStroke(layer, top, left, w, h, color, strokeW, dashed) {
            var rect = layer.pathItems.rectangle(top, left, w, h);
            rect.filled = false;
            rect.stroked = true;
            rect.strokeColor = color;
            rect.strokeWidth = strokeW || 1;
            if (dashed) {
                if (dashed === true) rect.strokeDashes = [5, 5];
                else if (dashed.length !== undefined) rect.strokeDashes = dashed;
            }
            return rect;
        }
        // Cápsula preenchida (pill shape) — raio = altura/2 deixa os lados
        // completamente arredondados (legenda).
        function drawCapsuleFill(parent, top, left, w, h, color) {
            var rect = parent.pathItems.roundedRectangle(top, left, w, h, h / 2, h / 2, false);
            rect.filled = true;
            rect.stroked = false;
            rect.fillColor = color;
            return rect;
        }
        // Retângulo com cantos arredondados, apenas stroke (caixa externa
        // da legenda).
        function drawRoundedRectStroke(parent, top, left, w, h, hRadius, vRadius, color, strokeW) {
            var rect = parent.pathItems.roundedRectangle(top, left, w, h, hRadius, vRadius, false);
            rect.filled = false;
            rect.stroked = true;
            rect.strokeColor = color;
            rect.strokeWidth = strokeW || 0.5;
            return rect;
        }

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
        // 1. MATERIAL (path solto na camada V1)
        // =======================================
        var rectMaterial = drawRect(layerV1, yTopo, xPouchIni, totalPouchW - (cameron * 2) - (refile * 2), totalPouchH, corFundo);
        rectMaterial.name = "Material";

        // =======================================
        // 2. CAMERON (grupo)
        // =======================================
        var groupCameron = layerV1.groupItems.add(); groupCameron.name = "Cameron";
        var rc1 = groupCameron.pathItems.rectangle(yTopo, xCamEsq, cameron, totalPouchH);
        rc1.filled = true; rc1.stroked = false; rc1.fillColor = corPreto;
        var rc2 = groupCameron.pathItems.rectangle(yTopo, xRefDir, cameron, totalPouchH);
        rc2.filled = true; rc2.stroked = false; rc2.fillColor = corPreto;

        // =======================================
        // 3. COTAS (grupo) - inclui soldas verticais, linhas de faca e
        //                    labels SANFONA/FRENTE/SANFONA/VERSO
        // =======================================
        var groupAll = layerV1.groupItems.add(); groupAll.name = "Cotas";

        // ---------------------------------------
        // Labels de SOLDA do fundo (horizontal, dentro da faixa do fundo)
        // ---------------------------------------
        var yMeio = yTopo - (compPt / 2);
        addText(groupAll, "SOLDA", xFrenteIni + (utilFacePt / 2), yFundo + (soldaFundo / 2), 8, corCota, 0);  // centralizada com FRENTE
        addText(groupAll, "SOLDA", xVersoIni  + (utilFacePt / 2), yFundo + (soldaFundo / 2), 8, corCota, 0);  // centralizada com VERSO

        // ---------------------------------------
        // LINHAS DE FACA E DOBRA
        // ---------------------------------------
        drawLineL(groupAll, xPouchIni, yFundo, xPouchFim, yFundo, corFaca, 1, true);
        drawLineL(groupAll, xPouchIni, ySoldaFundo, xPouchFim, ySoldaFundo, corFaca, 1, true);

        // ---------------------------------------
        // FAIXAS DE SOLDAS VERTICAIS AGRUPADAS (7,5 mm cada)
        // ---------------------------------------

        // Grupo 1: Solda extremidade esquerda
        var groupSoldaEsq = groupAll.groupItems.add();
        drawLineL(groupSoldaEsq, xPouchIni, yTopo, xPouchIni, yFundo, corFaca, 1, true);
        drawLineL(groupSoldaEsq, xPouchIni + soldaLat, yTopo, xPouchIni + soldaLat, yFundo, corCota, 0.75, true);
        addText(groupSoldaEsq, "SOLDA", xPouchIni + mm2pt(3.75), yMeio, 8, corCota, 90);

        // Grupo 2: Solda extremidade direita
        var groupSoldaDir = groupAll.groupItems.add();
        drawLineL(groupSoldaDir, xPouchFim, yTopo, xPouchFim, yFundo, corFaca, 1, true);
        drawLineL(groupSoldaDir, xPouchFim - soldaLat, yTopo, xPouchFim - soldaLat, yFundo, corCota, 0.75, true);
        addText(groupSoldaDir, "SOLDA", xPouchFim - mm2pt(3.75), yMeio, 8, corCota, 90);

        // Grupo 3: Soldas início FRENTE (par de linhas + linha central + 2 labels)
        var groupSoldaIniFrente = groupAll.groupItems.add();
        drawLineL(groupSoldaIniFrente, xFrenteIni, yTopo, xFrenteIni, yFundo, corFaca, 1, true);
        drawLineL(groupSoldaIniFrente, xFrenteIni - soldaLat, yTopo, xFrenteIni - soldaLat, yFundo, corCota, 0.75, true);
        drawLineL(groupSoldaIniFrente, xFrenteIni + soldaLat, yTopo, xFrenteIni + soldaLat, yFundo, corCota, 0.75, true);
        addText(groupSoldaIniFrente, "SOLDA", xFrenteIni - mm2pt(3.75), yMeio, 8, corCota, 90);
        addText(groupSoldaIniFrente, "SOLDA", xFrenteIni + mm2pt(3.75), yMeio, 8, corCota, 90);

        // Grupo 4: Soldas final FRENTE (par de linhas + linha central + 2 labels)
        var groupSoldaFimFrente = groupAll.groupItems.add();
        drawLineL(groupSoldaFimFrente, xFrenteFim, yTopo, xFrenteFim, yFundo, corFaca, 1, true);
        drawLineL(groupSoldaFimFrente, xFrenteFim - soldaLat, yTopo, xFrenteFim - soldaLat, yFundo, corCota, 0.75, true);
        drawLineL(groupSoldaFimFrente, xFrenteFim + soldaLat, yTopo, xFrenteFim + soldaLat, yFundo, corCota, 0.75, true);
        addText(groupSoldaFimFrente, "SOLDA", xFrenteFim - mm2pt(3.75), yMeio, 8, corCota, 90);
        addText(groupSoldaFimFrente, "SOLDA", xFrenteFim + mm2pt(3.75), yMeio, 8, corCota, 90);

        // Grupo 5: Soldas início VERSO (par de linhas + linha central + 2 labels)
        var groupSoldaIniVerso = groupAll.groupItems.add();
        drawLineL(groupSoldaIniVerso, xVersoIni, yTopo, xVersoIni, yFundo, corFaca, 1, true);
        drawLineL(groupSoldaIniVerso, xVersoIni - soldaLat, yTopo, xVersoIni - soldaLat, yFundo, corCota, 0.75, true);
        drawLineL(groupSoldaIniVerso, xVersoIni + soldaLat, yTopo, xVersoIni + soldaLat, yFundo, corCota, 0.75, true);
        addText(groupSoldaIniVerso, "SOLDA", xVersoIni - mm2pt(3.75), yMeio, 8, corCota, 90);
        addText(groupSoldaIniVerso, "SOLDA", xVersoIni + mm2pt(3.75), yMeio, 8, corCota, 90);

        // ---------------------------------------
        // COTAS HORIZONTAIS (3 NÍVEIS)
        //   Nível 1 (mais alto): largura total no eixo X (2 x largMM)
        //   Nível 2: estrutura básica (sanfFaixa | utilFace | sanfFaixa | utilFace)
        //   Nível 3: refile/cameron nas extremidades
        // ---------------------------------------
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

        // ---------------------------------------
        // COTAS VERTICAIS
        //   - Comprimento total
        //   - Solda do fundo (15 mm)
        // ---------------------------------------
        var xCotaV2 = x0 - mm2pt(5);
        var xCotaV1 = xCotaV2 - mm2pt(9);

        drawCotaV(groupCotas, xCotaV1, yTopo,       yFundo,      compMM + " mm",       corCota);
        drawCotaV(groupCotas, xCotaV2, ySoldaFundo, yFundo,      "15 mm",              corCota, 8);

        // ---------------------------------------
        // LINHAS DE LIMITE DO MATERIAL (MAGENTA)
        // ---------------------------------------
        var yLimiteMaterial = yFundo - mm2pt(3);
        drawLineL(groupAll, xPouchIni, yLimiteMaterial, xPouchIni, yCota3, corMagenta, 0.75, true);
        drawLineL(groupAll, xPouchFim, yLimiteMaterial, xPouchFim, yCota3, corMagenta, 0.75, true);

        // ---------------------------------------
        // LABELS DAS ZONAS (SANFONA/FRENTE/SANFONA/VERSO)
        // Pertencem ao grupo Cotas, posicionados logo abaixo da linha da
        // cota de subdivisão (yCota2). Fonte 8pt, mesma cor das cotas.
        // ---------------------------------------
        var zonasLabels = [
            { ini: xPouchIni  + soldaLat, fim: xFrenteIni - soldaLat, nome: "SANFONA" },
            { ini: xFrenteIni + soldaLat, fim: xFrenteFim - soldaLat, nome: "FRENTE"  },
            { ini: xFrenteFim + soldaLat, fim: xVersoIni  - soldaLat, nome: "SANFONA" },
            { ini: xVersoIni  + soldaLat, fim: xPouchFim  - soldaLat, nome: "VERSO"   }
        ];
        var groupLabelsCotas = groupAll.groupItems.add();
        groupLabelsCotas.name = "Labels Zonas";
        var yLabel = yCota2 - mm2pt(3);  // 3 mm logo abaixo da linha da cota de subdivisão
        for (var L = 0; L < zonasLabels.length; L++) {
            var zL = zonasLabels[L];
            var xCentro = (zL.ini - soldaLat + zL.fim + soldaLat) / 2;
            addText(groupLabelsCotas, zL.nome, xCentro, yLabel, 8, corCota, 0);
        }

        // =======================================
        // 4. INFO. (APAGAR) — GRUPO criado por ÚLTIMO (fica no topo da camada)
        // =======================================
        var groupInfo = layerV1.groupItems.add();
        groupInfo.name = "Info. (apagar)";

        // Cores dos elementos
        var corSelagem = cmyk(0,  85, 90, 0);   // vermelho/laranja
        var corSegura  = cmyk(85, 0,  100, 0);  // verde
        var corDobra   = cmyk(75, 15, 0,  0);   // azul/ciano

        var dashesArea = [4, 3];
        var strokeArea = 1;  // mesma espessura das outras linhas tracejadas

        var areaSelagemH = mm2pt(30);
        var areaDobraH   = mm2pt((2 * sanfMM) + 15);
        var margemH      = mm2pt(5);
        var margemV      = mm2pt(5);

        var yLimiteSelagem = yTopo  - areaSelagemH;
        var yLimiteDobra   = yFundo + areaDobraH;
        var yTopoSegura    = yLimiteSelagem - margemV;
        var yFundoSegura   = yLimiteDobra   + margemV;
        var alturaSegura   = yTopoSegura - yFundoSegura;

        if (alturaSegura <= 0) {
            // O documento JÁ foi criado com sucesso — apenas as marcações
            // de Info. (apagar) não cabem. Espelha o reference V2.0
            // (alert + app.redraw + return) usando o canal jsonOk com
            // mensagem de aviso embutida (não há canal "warn" no protocolo).
            app.redraw();
            return jsonOk(
                "Atenção: o comprimento (" + compMM + " mm) é muito pequeno para comportar " +
                "Área de Selagem (30 mm), Área de Dobra (" + ((2 * sanfMM) + 15) + " mm) " +
                "e margens (10 mm). Soma mínima: " + (30 + (2 * sanfMM) + 15 + 10) + " mm. " +
                "As marcações de Info. (apagar) não foram desenhadas."
            );
        }

        // Definição das 4 zonas (limitadas pelas linhas EXTERNAS das soldas)
        var zonas = [
            { ini: xPouchIni  + soldaLat, fim: xFrenteIni - soldaLat, nome: "SANFONA" },
            { ini: xFrenteIni + soldaLat, fim: xFrenteFim - soldaLat, nome: "FRENTE"  },
            { ini: xFrenteFim + soldaLat, fim: xVersoIni  - soldaLat, nome: "SANFONA" },
            { ini: xVersoIni  + soldaLat, fim: xPouchFim  - soldaLat, nome: "VERSO"   }
        ];

        // -------- ÁREA DE SELAGEM (retângulos vermelhos) --------
        var groupSelagem = groupInfo.groupItems.add();
        groupSelagem.name = "Area de Selagem";
        for (var i = 0; i < zonas.length; i++) {
            var z = zonas[i];
            var x1 = z.ini + margemH;
            var x2 = z.fim - margemH;
            if (x2 - x1 > 0) {
                drawRectStroke(groupSelagem, yTopo, x1, x2 - x1, areaSelagemH, corSelagem, strokeArea, dashesArea);
            }
        }

        // -------- ÁREA DE DOBRA APÓS FORMATADO (retângulos azuis) --------
        var groupDobra = groupInfo.groupItems.add();
        groupDobra.name = "Area de Dobra apos Formatado";
        for (var j = 0; j < zonas.length; j++) {
            var zd = zonas[j];
            var xd1 = zd.ini + margemH;
            var xd2 = zd.fim - margemH;
            if (xd2 - xd1 > 0) {
                drawRectStroke(groupDobra, yLimiteDobra, xd1, xd2 - xd1, areaDobraH, corDobra, strokeArea, dashesArea);
            }
        }

        // -------- ÁREA SEGURA PARA TEXTOS (retângulos verdes) --------
        var groupSegura = groupInfo.groupItems.add();
        groupSegura.name = "Area Segura para Textos";
        for (var k = 0; k < zonas.length; k++) {
            var zs = zonas[k];
            var xs1 = zs.ini + margemH;
            var xs2 = zs.fim - margemH;
            if (xs2 - xs1 > 0) {
                drawRectStroke(groupSegura, yTopoSegura, xs1, xs2 - xs1, alturaSegura, corSegura, strokeArea, dashesArea);
            }
        }

        // -------- LEGENDA NO RODAPÉ --------
        // A caixa cobre toda a largura do material (xPouchIni a xPouchFim),
        // ficando centralizada na planta. O conteúdo é alinhado à esquerda
        // com padding interno.
        var groupLegenda = groupInfo.groupItems.add();
        groupLegenda.name = "Legenda";

        var capW         = mm2pt(14);             // largura da cápsula
        var capH         = mm2pt(5);              // altura da cápsula (raio = capH/2 = 2.5 mm → cápsula completa)
        var padInterno   = mm2pt(8);              // padding interno horizontal da caixa
        var padVert      = mm2pt(4);              // padding interno vertical
        var espQuadTexto = mm2pt(3);              // espaço entre cápsula e texto
        var espItens     = mm2pt(12);             // espaço entre um item e o próximo
        var fontLegenda  = 8;
        var raioCaixa    = mm2pt(3);              // raio dos cantos da caixa

        // Caixa externa: largura = largura do material útil, centralizada
        // (cobre de xPouchIni a xPouchFim).
        var caixaLeft    = xPouchIni;
        var caixaW       = xPouchFim - xPouchIni;
        var caixaH       = capH + (padVert * 2);
        // Topo da caixa: 10 mm abaixo do fundo do material
        var caixaTop     = yFundo - mm2pt(10);
        var caixaCentroY = caixaTop - (caixaH / 2);

        drawRoundedRectStroke(groupLegenda, caixaTop, caixaLeft, caixaW, caixaH, raioCaixa, raioCaixa, corCota, 0.5);

        // Conteúdo da legenda
        var itens = [
            { texto: "APAGAR",                                  cor: null       },
            { texto: "ÁREA SEGURA",                        cor: corSegura  },
            { texto: "ÁREA DE SELAGEM",                    cor: corSelagem },
            { texto: "ÁREA DE DOBRA APÓS FORMATADO",  cor: corDobra   }
        ];

        var corApagar = cmyk(0, 0, 0, 70);   // 70% de preto, só para o APAGAR

        var xAtual = caixaLeft + padInterno;

        for (var p = 0; p < itens.length; p++) {
            var it = itens[p];
            var sizeAtual, corAtual;
            if (it.cor) {
                // Item com cápsula: 8pt, cinza padrão (corCota)
                sizeAtual = fontLegenda;
                corAtual  = corCota;
                drawCapsuleFill(groupLegenda, caixaCentroY + (capH / 2), xAtual, capW, capH, it.cor);
                xAtual += capW + espQuadTexto;
            } else {
                // APAGAR: 10pt, 70% preto
                sizeAtual = 10;
                corAtual  = corApagar;
            }
            // Texto da legenda, centralizado verticalmente em caixaCentroY
            var tf = groupLegenda.textFrames.add();
            tf.contents = it.texto;
            tf.textRange.characterAttributes.size = sizeAtual;
            applyArialBold(tf);
            try { tf.textRange.characterAttributes.fillColor = corAtual; } catch(e) {}
            tf.top  = caixaCentroY + (tf.height / 2);
            tf.left = xAtual;
            xAtual += tf.width + espItens;
        }

        app.redraw();
        return jsonOk("4 Soldas gerado com sucesso!");
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
