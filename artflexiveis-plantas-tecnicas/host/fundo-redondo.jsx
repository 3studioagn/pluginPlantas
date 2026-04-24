// ==========================================
// FUNDO-REDONDO.JSX — Fundo Redondo v2.3
// Portado 1:1 de reference/Fundo-Redondo_V1_0.JSX (desenharFR_Duplo,
// desenharFR_Frente, _desenharFaceFR, _validarFace, drawMaterial e toda a
// matemática Bezier da curva MESTRE extraída de Modelo_Final.pdf).
// Depende dos helpers definidos em core.jsx (mm2pt, cmyk, drawRect, drawLine,
// drawCotaH, drawCotaV, addText, applyArialBold, jsonOk, jsonErr).
//
// Mudanças cirúrgicas em relação ao original:
//   1. Removido o diálogo ScriptUI. A entrada pública é a função
//      gerarFundoRedondo(...) com assinatura plana (21 parâmetros), chamada
//      diretamente pelo painel (client/js/main.js via evalScript).
//   2. Helpers e constantes locais prefixados com `_fr` / `FR_` para evitar
//      conflito de escopo global entre scripts .jsx carregados via $.evalFile.
//   3. Retornos: alerts substituídos por jsonOk/jsonErr (helpers de core.jsx —
//      ExtendScript ES3 não possui JSON nativo).
// Nada mais foi alterado: curva mestre, profundidades aparentes, grupos,
// cores, cotas, ordem de desenho, fotocélula, labels e texto permanecem 1:1.
// ==========================================

// ============================================================
// CURVA MESTRE (extraída de Modelo_Final.pdf, peça máxima 460×370mm)
// Coordenadas em mm ABSOLUTOS com origem no canto superior/inferior esquerdo.
// Percorrida da ESQUERDA para a DIREITA em ambos os casos.
// Curvas são SIMÉTRICAS (pontas esq e dir batem nos extremos x=0 e x=370).
//   x: 0 (esquerda) a 370 (direita) em mm
//   y: profundidade em mm abaixo da linha dos cantos (positivo = mais fundo)
// ============================================================
var FR_MASTER_W_MM = 370.00;

// Curva MESTRE do TOPO (2 segmentos Bezier, simétricos)
// y=0 quando a curva toca a linha dos cantos superiores
var FR_MASTER_TOP_CURVE_MM = [
    [[  0.000,  0.000], [ 66.658, 35.905], [125.278, 53.702], [184.876, 53.295]],
    [[185.124, 53.295], [244.721, 53.702], [303.341, 35.905], [370.000,  0.000]]
];

// Curva MESTRE do FUNDO (4 segmentos Bezier, simétricos)
// y=0 quando a curva toca a linha dos cantos inferiores
var FR_MASTER_BOTTOM_CURVE_MM = [
    [[  0.000,  0.000], [ 58.916, 31.839], [111.367, 49.121], [166.654, 53.532]],
    [[166.654, 53.532], [172.685, 53.904], [178.801, 54.062], [185.000, 54.015]],
    [[185.000, 54.015], [191.198, 54.062], [197.314, 53.904], [203.346, 53.532]],
    [[203.346, 53.532], [258.632, 49.121], [311.084, 31.839], [370.000,  0.000]]
];

// Limites do gabarito (maior peça possível)
var FR_MAX_W_MM = 370.0;
var FR_MAX_C_MM = 460.0;  // comprimento máximo (vale-a-vale)

// Densidade de amostragem da curva mestre (mais = mais suave e preciso)
// (Valor efetivo do script original: 40; mantido aqui para preservar geometria.)
var FR_BEZIER_SEGMENTS = 40;

// Caches (calculados uma vez por sessão de documento)
var _fr_topSamples = null;
var _fr_botSamples = null;
var _fr_maxTopMM = null;
var _fr_maxBotMM = null;

// --- Formatação BR (vírgula decimal) ---
function _fr_fmt(n) { return String(n).replace('.', ','); }

// Formata número com até 2 casas decimais e vírgula (para cotas calculadas).
// Inteiros saem sem vírgula; decimais com 2 casas sempre.
function _fr_fmt2(n) {
    var r = Math.round(n * 100) / 100;
    if (r === Math.round(r)) return String(Math.round(r));
    var s = String(r);
    var parts = s.split('.');
    if (parts[1].length === 1) parts[1] += '0';
    return parts.join(',');
}

// --- Amostragem / interpolação da curva mestre ---
function _fr_getTopSamples() {
    if (_fr_topSamples === null) {
        _fr_topSamples = _fr_bezierChainPoints(FR_MASTER_TOP_CURVE_MM, FR_BEZIER_SEGMENTS);
    }
    return _fr_topSamples;
}
function _fr_getBotSamples() {
    if (_fr_botSamples === null) {
        _fr_botSamples = _fr_bezierChainPoints(FR_MASTER_BOTTOM_CURVE_MM, FR_BEZIER_SEGMENTS);
    }
    return _fr_botSamples;
}

function _fr_computeMax(samples) {
    var m = 0;
    for (var i = 0; i < samples.length; i++) {
        if (samples[i][1] > m) m = samples[i][1];
    }
    return m;
}
function _fr_getMaxTopMM() {
    if (_fr_maxTopMM === null) _fr_maxTopMM = _fr_computeMax(_fr_getTopSamples());
    return _fr_maxTopMM;
}
function _fr_getMaxBotMM() {
    if (_fr_maxBotMM === null) _fr_maxBotMM = _fr_computeMax(_fr_getBotSamples());
    return _fr_maxBotMM;
}

// Interpolação linear em amostras ordenadas por x (ascendente)
function _fr_interpY(samples, xTarget) {
    if (xTarget <= samples[0][0]) return samples[0][1];
    if (xTarget >= samples[samples.length - 1][0]) return samples[samples.length - 1][1];
    for (var i = 0; i < samples.length - 1; i++) {
        var x1 = samples[i][0], x2 = samples[i + 1][0];
        if (x1 <= xTarget && xTarget <= x2) {
            if (x2 - x1 < 1e-9) return samples[i][1];
            var t = (xTarget - x1) / (x2 - x1);
            return samples[i][1] + t * (samples[i + 1][1] - samples[i][1]);
        }
    }
    return samples[samples.length - 1][1];
}

// Profundidade APARENTE da curva do topo/fundo para uma peça de largura W
// (= distância do canto ao vale da curva)
function _fr_getDepthTopMM(widthMM) {
    if (widthMM > FR_MASTER_W_MM) widthMM = FR_MASTER_W_MM;
    var xL = (FR_MASTER_W_MM - widthMM) / 2;
    var xR = (FR_MASTER_W_MM + widthMM) / 2;
    var cornerY = (_fr_interpY(_fr_getTopSamples(), xL) + _fr_interpY(_fr_getTopSamples(), xR)) / 2;
    return _fr_getMaxTopMM() - cornerY;
}
function _fr_getDepthBotMM(widthMM) {
    if (widthMM > FR_MASTER_W_MM) widthMM = FR_MASTER_W_MM;
    var xL = (FR_MASTER_W_MM - widthMM) / 2;
    var xR = (FR_MASTER_W_MM + widthMM) / 2;
    var cornerY = (_fr_interpY(_fr_getBotSamples(), xL) + _fr_interpY(_fr_getBotSamples(), xR)) / 2;
    return _fr_getMaxBotMM() - cornerY;
}

// --- FUNÇÕES BEZIER / GEOMETRIA DO POUCH ---
// Avalia um ponto de uma curva Bezier cúbica em t ∈ [0, 1]
function _fr_bezierAt(p0, cp1, cp2, p3, t) {
    var u = 1 - t;
    var x = u*u*u*p0[0] + 3*u*u*t*cp1[0] + 3*u*t*t*cp2[0] + t*t*t*p3[0];
    var y = u*u*u*p0[1] + 3*u*u*t*cp1[1] + 3*u*t*t*cp2[1] + t*t*t*p3[1];
    return [x, y];
}

// Gera pontos de uma sequência de curvas Bezier.
// Cada segmento é [P0, CP1, CP2, P3] em coordenadas normalizadas.
// O ponto final de um segmento coincide com o inicial do próximo — por isso
// pulamos o índice 0 a partir do segundo segmento, evitando duplicatas.
function _fr_bezierChainPoints(curves, segments) {
    var pts = [];
    for (var i = 0; i < curves.length; i++) {
        var seg = curves[i];
        var start = (i === 0) ? 0 : 1;
        for (var j = start; j <= segments; j++) {
            var t = j / segments;
            pts.push(_fr_bezierAt(seg[0], seg[1], seg[2], seg[3], t));
        }
    }
    return pts;
}

// ============================================================
// GEOMETRIA BEZIER: trim + subdivisão + construção de paths com nós reais
// Usado para produzir curvas no Illustrator com POUCOS nós (ao invés de
// polilinha densa com muitos pontos). Os segmentos Bezier da curva mestre
// são aparados em x=[xL, xR] via De Casteljau, depois transladados para
// coordenadas do Illustrator.
// ============================================================

// Interpolação linear entre dois pontos 2D
function _fr_lerp(a, b, t) {
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

// Avalia a coord X de uma Bezier cúbica em t
function _fr_bezXAt(seg, t) {
    var u = 1 - t, u2 = u * u, t2 = t * t;
    return u2 * u * seg[0][0] + 3 * u2 * t * seg[1][0] + 3 * u * t2 * seg[2][0] + t2 * t * seg[3][0];
}

// Subdivisão De Casteljau: retorna [parte_esquerda, parte_direita]
function _fr_subdivBez(seg, t) {
    var p0 = seg[0], p1 = seg[1], p2 = seg[2], p3 = seg[3];
    var q0 = _fr_lerp(p0, p1, t);
    var q1 = _fr_lerp(p1, p2, t);
    var q2 = _fr_lerp(p2, p3, t);
    var r0 = _fr_lerp(q0, q1, t);
    var r1 = _fr_lerp(q1, q2, t);
    var s  = _fr_lerp(r0, r1, t);
    return [[p0, q0, r0, s], [s, r1, q2, p3]];
}

// Encontra t tal que x(t) = targetX (busca binária; assume x monotônico)
function _fr_findTForX(seg, targetX) {
    if (targetX <= seg[0][0]) return 0;
    if (targetX >= seg[3][0]) return 1;
    var lo = 0, hi = 1;
    for (var i = 0; i < 60; i++) {
        var mid = (lo + hi) / 2;
        var x = _fr_bezXAt(seg, mid);
        if (Math.abs(x - targetX) < 1e-6) return mid;
        if (x < targetX) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

// Apara uma cadeia de segmentos Bezier ao intervalo x=[xL, xR].
function _fr_trimBezChain(masterSegs, xL_mm, xR_mm) {
    var out = [];
    for (var i = 0; i < masterSegs.length; i++) {
        var seg = masterSegs[i];
        var sX0 = seg[0][0], sX3 = seg[3][0];
        if (sX3 <= xL_mm + 1e-6 || sX0 >= xR_mm - 1e-6) continue;

        var cur = seg;
        if (sX0 < xL_mm) {
            cur = _fr_subdivBez(cur, _fr_findTForX(cur, xL_mm))[1];
        }
        if (cur[3][0] > xR_mm) {
            cur = _fr_subdivBez(cur, _fr_findTForX(cur, xR_mm))[0];
        }
        out.push(cur);
    }
    return out;
}

// Inverte um segmento Bezier (troca direção da curva)
function _fr_revBez(seg) { return [seg[3], seg[2], seg[1], seg[0]]; }

// Inverte a ordem de uma cadeia de segmentos Bezier (e inverte cada um)
function _fr_revBezChain(segs) {
    var out = [];
    for (var i = segs.length - 1; i >= 0; i--) out.push(_fr_revBez(segs[i]));
    return out;
}

// Transforma segmentos Bezier de coords MASTER mm para coords ILLUSTRATOR pt.
// xStartPt     = Illustrator x correspondente a master x = masterOriginXMM
// masterOriginXMM = valor de master x no canto esquerdo da peça
// yBase        = Illustrator y onde master y = cornerY (yTop ou yCantosBot)
// cornerY      = master y no canto da peça (profundidade relativa)
// offsetSignedPt = offset em pts aplicado ao Y (negativo para cima no Illustrator);
//                  para TOPO usar -yOffsetPt (offset pra dentro = baixo no Illustrator)
//                  para FUNDO usar +yOffsetPt (offset pra dentro = cima no Illustrator)
function _fr_transformSegsToPt(segs, xStartPt, masterOriginXMM, yBase, cornerY, offsetSignedPt) {
    if (!offsetSignedPt) offsetSignedPt = 0;
    var out = [];
    for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        var t = [];
        for (var j = 0; j < 4; j++) {
            var p = seg[j];
            var px = xStartPt + mm2pt(p[0] - masterOriginXMM);
            var py = yBase - mm2pt(p[1] - cornerY) + offsetSignedPt;
            t.push([px, py]);
        }
        out.push(t);
    }
    return out;
}

// Adiciona pontos Bezier a um pathItem a partir de uma cadeia de segmentos.
// segsPt: array de [[p0, cp1, cp2, p3], ...] em coords Illustrator (pontos).
function _fr_addBezSegsToPath(pathItem, segsPt) {
    if (segsPt.length === 0) return;
    function addPt(anchor, lDir, rDir) {
        var pp = pathItem.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
        pp.pointType = PointType.SMOOTH;
    }
    // Primeiro ponto: anchor = seg[0].p0; leftDir = anchor; rightDir = seg[0].cp1
    addPt(segsPt[0][0], segsPt[0][0], segsPt[0][1]);
    // Pontos intermediários (junções entre segmentos)
    for (var i = 0; i < segsPt.length - 1; i++) {
        addPt(segsPt[i][3], segsPt[i][2], segsPt[i+1][1]);
    }
    // Último ponto: anchor = seg[last].p3; leftDir = seg[last].cp2; rightDir = anchor
    var last = segsPt.length - 1;
    addPt(segsPt[last][3], segsPt[last][2], segsPt[last][3]);
}

// Desenha uma curva Bezier aberta (open path) em um layer ou grupo.
function _fr_drawBezierOpen(layer, segsPt, strokeColor, dashed) {
    var p = layer.pathItems.add();
    _fr_addBezSegsToPath(p, segsPt);
    p.closed = false;
    p.filled = false;
    p.stroked = true;
    p.strokeColor = strokeColor;
    p.strokeWidth = 1;
    if (dashed) p.strokeDashes = [5, 5];
    return p;
}

// Desenha o contorno do material como path fechado preenchido, usando Bezier real.
// Wmm = largura (mm), Cmm = comprimento vale-a-vale (mm).
// yTop = Y dos cantos superiores.
function _fr_drawMaterial(layer, xL, yTop, Wmm, Cmm, color) {
    if (Wmm > FR_MASTER_W_MM) Wmm = FR_MASTER_W_MM;
    var Cpt = mm2pt(Cmm);
    var dTopoPt  = mm2pt(_fr_getDepthTopMM(Wmm));
    var dFundoPt = mm2pt(_fr_getDepthBotMM(Wmm));

    var yTopoCentro   = yTop - dTopoPt;
    var yFundoExtremo = yTopoCentro - Cpt;
    var yCantosFundo  = yFundoExtremo + dFundoPt;

    var masterXL = (FR_MASTER_W_MM - Wmm) / 2;
    var masterXR = (FR_MASTER_W_MM + Wmm) / 2;

    var topCornerY = (_fr_interpY(_fr_getTopSamples(), masterXL) + _fr_interpY(_fr_getTopSamples(), masterXR)) / 2;
    var botCornerY = (_fr_interpY(_fr_getBotSamples(), masterXL) + _fr_interpY(_fr_getBotSamples(), masterXR)) / 2;

    var topSegsMM = _fr_trimBezChain(FR_MASTER_TOP_CURVE_MM,    masterXL, masterXR);
    var botSegsMM = _fr_trimBezChain(FR_MASTER_BOTTOM_CURVE_MM, masterXL, masterXR);

    var topSegsPt = _fr_transformSegsToPt(topSegsMM, xL, masterXL, yTop,          topCornerY, 0);
    var botSegsPt = _fr_transformSegsToPt(botSegsMM, xL, masterXL, yCantosFundo,  botCornerY, 0);
    var botSegsPtRL = _fr_revBezChain(botSegsPt);

    var p = layer.pathItems.add();
    _fr_addBezSegsToPath(p, topSegsPt);
    _fr_addBezSegsToPath(p, botSegsPtRL);
    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Material";
    return p;
}

// Desenha um retângulo com stroke tracejado (sem preenchimento). Usado para
// a simulação do queijo. (Assinatura local — não confundir com drawDashedRect
// de core.jsx, que usa top/left/w/h.)
function _fr_drawDashedRect(layer, x1, x2, y1, y2, color, name) {
    var rect = layer.pathItems.add();
    rect.setEntirePath([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
    rect.closed = true;
    rect.filled = false;
    rect.stroked = true;
    rect.strokeColor = color;
    rect.strokeWidth = 1;
    rect.strokeDashes = [5, 5];
    if (name) rect.name = name;
    return rect;
}

// Desenha uma elipse tracejada (sem preenchimento) centrada em (cx, cy) com
// dimensões totais (w, h). Usado para a simulação do queijo redondo.
function _fr_drawDashedEllipse(layer, cx, cy, w, h, color, name) {
    var top = cy + h / 2;
    var left = cx - w / 2;
    var el = layer.pathItems.ellipse(top, left, w, h);
    el.filled = false;
    el.stroked = true;
    el.strokeColor = color;
    el.strokeWidth = 1;
    el.strokeDashes = [5, 5];
    if (name) el.name = name;
    return el;
}

// Desenha uma elipse preenchida centrada em (cx, cy) com dimensões (w, h).
// Usada para a arte redonda (dentro do queijo redondo).
function _fr_drawFilledEllipse(layer, cx, cy, w, h, color, name) {
    var top = cy + h / 2;
    var left = cx - w / 2;
    var el = layer.pathItems.ellipse(top, left, w, h);
    el.filled = true;
    el.fillColor = color;
    el.stroked = false;
    if (name) el.name = name;
    return el;
}

// --- VALIDAÇÃO ---
// compMM  = distância vale-a-vale (topo ao fundo).
// recuoMM = recuo lateral da arte na frente. Verso = recuoMM + 5 (só em modo
//           queijo sem borda). Retorna null em sucesso, string de erro em falha.
function _fr_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    if (largMM > FR_MAX_W_MM) {
        return "a largura máxima é " + _fr_fmt(FR_MAX_W_MM) + " mm (limite do gabarito).";
    }
    if (compMM > FR_MAX_C_MM) {
        return "o comprimento máximo é " + _fr_fmt(FR_MAX_C_MM) + " mm (limite do gabarito).";
    }
    if (recuoMM < 0) {
        return "o recuo da arte deve ser maior ou igual a 0.";
    }
    var recuoMaxMM = recuoMM + 5;
    if (largMM - 2 * recuoMaxMM <= 0) {
        return "recuo da arte muito grande para a largura.\n" +
               "Na frente: recuo = " + _fr_fmt(recuoMM) + " mm (arte = " + _fr_fmt2(largMM - 2 * recuoMM) + " mm).\n" +
               "No verso: recuo = " + _fr_fmt(recuoMaxMM) + " mm → arte = " + _fr_fmt2(largMM - 2 * recuoMaxMM) + " mm.";
    }
    // arte mínima só é checada quando NÃO há queijo nem arte custom (modo A usa selagem+fundo fixos)
    if (!queijoData && !arteData) {
        var arteAlt = compMM - selagemMM - fundoMM - 10;  // 5 respiro + 5 solda = 10
        if (arteAlt < 5) {
            return "o comprimento é insuficiente.\n" +
                   "Mínimo necessário: selagem (" + _fr_fmt(selagemMM) +
                   ") + fundo (" + _fr_fmt(fundoMM) + ") + solda+respiro (10) + 5 de arte = " +
                   _fr_fmt2(selagemMM + fundoMM + 10 + 5) + " mm.";
        }
    }

    // Validação específica da ARTE CUSTOM (frente e verso, se houver)
    if (arteData) {
        var lados = [];
        lados.push({ nome: "frente", info: arteData.frente });
        if (arteData.verso) lados.push({ nome: "verso", info: arteData.verso });
        for (var li = 0; li < lados.length; li++) {
            var nm = lados[li].nome, inf = lados[li].info;
            if (inf.tamanho <= 0 || inf.largura <= 0) {
                return "dimensões da arte (" + nm + ") devem ser positivas.";
            }
            if (inf.distFundo < 0) {
                return "a distância de fundo da arte (" + nm + ") deve ser ≥ 0.";
            }
            if (inf.largura > largMM) {
                return "a largura da arte (" + nm + ", " + _fr_fmt(inf.largura) +
                       " mm) é maior que a largura da peça (" + _fr_fmt(largMM) + " mm).";
            }
            var espacoV_a = inf.tamanho + inf.distFundo;
            var espacoMaxV_a = compMM - 10 - 5;
            if (espacoV_a > espacoMaxV_a) {
                return "a arte (" + nm + ") não cabe na peça.\n" +
                       "Tamanho + distância de fundo = " + _fr_fmt2(espacoV_a) + " mm.\n" +
                       "Espaço máximo disponível = " + _fr_fmt2(espacoMaxV_a) + " mm.";
            }
        }
    }

    // Validação específica do queijo (se definido)
    if (queijoData) {
        if (queijoData.comp <= 0 || queijoData.larg <= 0 || queijoData.alt <= 0) {
            return "dimensões do queijo devem ser positivas.";
        }
        if (queijoData.larg > largMM) {
            return "a largura do queijo (" + _fr_fmt(queijoData.larg) +
                   " mm) é maior que a largura da peça (" + _fr_fmt(largMM) + " mm).";
        }
        // Altura do queijo vertical ocupada no design (comprimento + metade da altura)
        var espacoV = queijoData.comp + queijoData.alt / 2;
        var espacoMaxV = compMM - 10 - 5;  // compMM - solda (5+5) - pelo menos 5mm de selagem
        if (espacoV > espacoMaxV) {
            return "o queijo não cabe na peça.\n" +
                   "Espaço ocupado pelo queijo (comp + altura/2) = " + _fr_fmt2(espacoV) + " mm.\n" +
                   "Espaço máximo disponível = " + _fr_fmt2(espacoMaxV) + " mm.";
        }
        if (!queijoData.bordaCaida) {
            var minDim = recuoMaxMM * 2;
            if (queijoData.larg <= minDim) {
                return "largura do queijo deve ser > " + _fr_fmt(minDim) + " mm (arte do verso = queijo − " + _fr_fmt(minDim) + ").";
            }
            if (queijoData.comp <= minDim) {
                return "comprimento do queijo deve ser > " + _fr_fmt(minDim) + " mm (arte do verso = queijo − " + _fr_fmt(minDim) + ").";
            }
        }
    }
    return null;
}

// --- HELPER: desenha UMA face completa (material + arte + fotocélula + solda + cotas) ---
function _fr_desenharFace(topMaterial, topArte, topCotas, xStart, yStart, largMM, compMM, selagemMM, fundoMM, recuoMM, nomeGrupo, queijoData, arteData) {
    var largPt    = mm2pt(largMM);
    var compPt    = mm2pt(compMM);
    var selagemPt = mm2pt(selagemMM);
    var margemLat = mm2pt(recuoMM);
    var isFrente  = (nomeGrupo === "Frente");

    // Profundidades aparentes variam com a largura (recorte central da mestre)
    var dTopoMM   = _fr_getDepthTopMM(largMM);
    var dFundoMM  = _fr_getDepthBotMM(largMM);
    var dTopoPt   = mm2pt(dTopoMM);
    var dFundoPt  = mm2pt(dFundoMM);

    var corFundo   = cmyk(15, 12, 12, 0);
    var corFaca    = cmyk(0, 0, 0, 60);
    var corCota    = cmyk(0, 0, 0, 60);
    var corCyan    = cmyk(70, 10, 16, 0);
    var corMagenta = cmyk(0, 100, 0, 0);
    var corPreto   = cmyk(0, 0, 0, 100);

    var xMatIni = xStart;
    var xMatFim = xStart + largPt;
    var yTopo          = yStart;                               // cantos superiores (Y máximo da peça)
    var yTopoCentro    = yTopo - dTopoPt;                      // vale superior
    var yFundoExtremo  = yTopoCentro - compPt;                 // vale inferior
    var yCantosFundo   = yFundoExtremo + dFundoPt;             // cantos inferiores (fim da lateral reta)

    // Linhas de referência no CENTRO da peça (usadas para cotas e queijo)
    var yLinhaBaixoSoldaCentro = yFundoExtremo + mm2pt(5);
    var yLinhaTopoSoldaCentro  = yFundoExtremo + mm2pt(10);

    // Sub-grupos desta face dentro de cada grupo top-level
    var groupMaterial = topMaterial.groupItems.add(); if (nomeGrupo) groupMaterial.name = nomeGrupo;
    var groupArte     = topArte.groupItems.add();     if (nomeGrupo) groupArte.name     = nomeGrupo;
    var groupCotas    = topCotas.groupItems.add();    if (nomeGrupo) groupCotas.name    = nomeGrupo;

    // ------------------------------------------------------------------
    // 1. MATERIAL (contorno curvo preenchido) — recorte central da mestre
    // ------------------------------------------------------------------
    _fr_drawMaterial(groupMaterial, xMatIni, yTopo, largMM, compMM, corFundo);

    // ------------------------------------------------------------------
    // 2. ARTE + (opcional) SIMULAÇÃO DO QUEIJO
    //
    // Modos:
    //   (A) Sem queijo                            → arte com topo E fundo CURVOS, recuo lateral = recuoMM
    //   (B) Queijo retangular, sem borda caída    → arte RETANGULAR, recuoMM dentro do queijo
    //   (C) Queijo retangular + borda caída       → arte curva (= A) + retângulo do queijo em Cotas
    //   (D) Queijo REDONDO, sem borda caída       → arte ELÍPTICA, recuoMM dentro do queijo
    //   (E) Queijo REDONDO + borda caída          → arte curva (= A) + elipse do queijo em Cotas
    //   (F/G) Arte custom (sem queijo)            → arte retangular ou elíptica, dimensões livres
    // ------------------------------------------------------------------

    // Limites master da ARTE quando curva (material encolhido recuoMM cada lado)
    var masterXL_piece = (FR_MASTER_W_MM - largMM) / 2;
    var masterXR_piece = (FR_MASTER_W_MM + largMM) / 2;
    var arteXL_master = masterXL_piece + recuoMM;
    var arteXR_master = masterXR_piece - recuoMM;
    var topCornerY_piece = (_fr_interpY(_fr_getTopSamples(), masterXL_piece) + _fr_interpY(_fr_getTopSamples(), masterXR_piece)) / 2;
    var botCornerY_piece = (_fr_interpY(_fr_getBotSamples(), masterXL_piece) + _fr_interpY(_fr_getBotSamples(), masterXR_piece)) / 2;

    var yArteTopCentro, yArteBotCentro;
    var arteLeftCota, arteRightCota, arteWidthMM;
    var distFundoEfetivoMM, arteAltEfetivaMM, selagemEfetivaMM;

    // Helper local: coords do retângulo/elipse do queijo
    function _queijoBBox() {
        var xC = xMatIni + largPt / 2;
        var qB = yLinhaTopoSoldaCentro + mm2pt(queijoData.alt / 2);
        var qT = qB + mm2pt(queijoData.comp);
        var qL = xC - mm2pt(queijoData.larg / 2);
        var qR = xC + mm2pt(queijoData.larg / 2);
        return { left: qL, right: qR, bot: qB, top: qT, cx: xC, cy: (qB + qT) / 2 };
    }

    if (arteData) {
        // --- MODO F/G: ARTE CUSTOM (sem queijo, sem linha magenta) ---
        var aInfo = isFrente ? arteData.frente : (arteData.verso || arteData.frente);
        var aFundo = aInfo.distFundo;
        var xCentro = xMatIni + largPt / 2;
        var arteBot = yLinhaTopoSoldaCentro + mm2pt(aFundo);
        var arteTop = arteBot + mm2pt(aInfo.tamanho);
        var arteL = xCentro - mm2pt(aInfo.largura / 2);
        var arteR = xCentro + mm2pt(aInfo.largura / 2);

        if (arteData.redonda) {
            _fr_drawFilledEllipse(groupArte, xCentro, (arteBot + arteTop) / 2,
                                  arteR - arteL, arteTop - arteBot, corCyan, "Arte");
        } else {
            var arteShape = groupArte.pathItems.rectangle(arteTop, arteL, arteR - arteL, arteTop - arteBot);
            arteShape.filled = true; arteShape.stroked = false; arteShape.fillColor = corCyan;
            arteShape.name = "Arte";
        }

        yArteBotCentro = arteBot;
        yArteTopCentro = arteTop;
        arteLeftCota  = arteL;
        arteRightCota = arteR;
        arteWidthMM   = aInfo.largura;
        distFundoEfetivoMM = aFundo;
        arteAltEfetivaMM   = aInfo.tamanho;
        selagemEfetivaMM   = compMM - 10 - aFundo - aInfo.tamanho;
    } else if (queijoData && !queijoData.bordaCaida) {
        var bbox = _queijoBBox();
        var offPt = mm2pt(recuoMM);

        if (queijoData.redondo) {
            // --- MODO D: QUEIJO (em Cotas) e ARTE (em Arte) como ELIPSES ---
            _fr_drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                                  bbox.right - bbox.left, bbox.top - bbox.bot,
                                  corMagenta, "Queijo");
            _fr_drawFilledEllipse(groupArte, bbox.cx, bbox.cy,
                                  bbox.right - bbox.left - 2 * offPt,
                                  bbox.top - bbox.bot - 2 * offPt,
                                  corCyan, "Arte");
        } else {
            // --- MODO B: QUEIJO (em Cotas) e ARTE (em Arte) como RETÂNGULOS ---
            _fr_drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
            var arteLeft = bbox.left + offPt;
            var arteRight = bbox.right - offPt;
            var arteBot2 = bbox.bot + offPt;
            var arteTop2 = bbox.top - offPt;
            var arteShape2 = groupArte.pathItems.rectangle(arteTop2, arteLeft, arteRight - arteLeft, arteTop2 - arteBot2);
            arteShape2.filled = true; arteShape2.stroked = false; arteShape2.fillColor = corCyan;
            arteShape2.name = "Arte";
        }

        yArteBotCentro = bbox.bot + offPt;
        yArteTopCentro = bbox.top - offPt;
        arteLeftCota  = bbox.left + offPt;
        arteRightCota = bbox.right - offPt;
        arteWidthMM   = queijoData.larg - 2 * recuoMM;
        distFundoEfetivoMM = queijoData.alt / 2 + recuoMM;
        arteAltEfetivaMM   = queijoData.comp - 2 * recuoMM;
        selagemEfetivaMM   = compMM - 10 - distFundoEfetivoMM - arteAltEfetivaMM;
    } else {
        // --- MODO A, C ou E: ARTE CURVA (padrão) ---
        var arteTopSegsMM = _fr_trimBezChain(FR_MASTER_TOP_CURVE_MM,    arteXL_master, arteXR_master);
        var arteBotSegsMM = _fr_trimBezChain(FR_MASTER_BOTTOM_CURVE_MM, arteXL_master, arteXR_master);
        var arteTopSegsPt = _fr_transformSegsToPt(arteTopSegsMM, xMatIni, masterXL_piece, yTopo,         topCornerY_piece, -mm2pt(selagemMM));
        var arteBotSegsPt = _fr_transformSegsToPt(arteBotSegsMM, xMatIni, masterXL_piece, yCantosFundo,  botCornerY_piece, +mm2pt(10 + fundoMM));
        var arteBotSegsPtRL = _fr_revBezChain(arteBotSegsPt);

        var arteShape3 = groupArte.pathItems.add();
        _fr_addBezSegsToPath(arteShape3, arteTopSegsPt);
        _fr_addBezSegsToPath(arteShape3, arteBotSegsPtRL);
        arteShape3.closed = true;
        arteShape3.filled = true; arteShape3.stroked = false;
        arteShape3.fillColor = corCyan;
        arteShape3.name = "Arte";

        yArteBotCentro = yFundoExtremo + mm2pt(10 + fundoMM);
        yArteTopCentro = yTopoCentro - selagemPt;
        arteLeftCota  = xMatIni + margemLat;
        arteRightCota = xMatFim - margemLat;
        arteWidthMM   = largMM - 2 * recuoMM;
        distFundoEfetivoMM = fundoMM;
        arteAltEfetivaMM   = compMM - selagemMM - 10 - fundoMM;
        selagemEfetivaMM   = selagemMM;

        // Modo C ou E: borda caída + queijo em Cotas (retângulo ou elipse tracejada)
        if (queijoData && queijoData.bordaCaida) {
            var bbox2 = _queijoBBox();
            if (queijoData.redondo) {
                _fr_drawDashedEllipse(groupCotas, bbox2.cx, bbox2.cy,
                                      bbox2.right - bbox2.left, bbox2.top - bbox2.bot,
                                      corMagenta, "Queijo");
            } else {
                _fr_drawDashedRect(groupCotas, bbox2.left, bbox2.right, bbox2.bot, bbox2.top, corMagenta, "Queijo");
            }
        }
    }

    // ------------------------------------------------------------------
    // 2b. FOTOCÉLULA padrão (40 × 5 mm, 100% preto)
    //     Posição: 5mm da lateral ESQUERDA e 5mm abaixo do vale do topo.
    //     SOMENTE NA FRENTE.
    // ------------------------------------------------------------------
    if (isFrente) {
        var fotoW = mm2pt(40), fotoH = mm2pt(5);
        var fotoTop  = yTopoCentro - mm2pt(5);
        var fotoLeft = xMatIni + mm2pt(5);
        var fotocel = groupArte.pathItems.rectangle(fotoTop, fotoLeft, fotoW, fotoH);
        fotocel.filled = true; fotocel.stroked = false;
        fotocel.fillColor = corPreto;
        fotocel.name = "Fotocélula";
    }

    // ------------------------------------------------------------------
    // 3. LINHAS DE FACA DA SOLDA CURVA (dentro de Cotas — Bezier real)
    // ------------------------------------------------------------------
    var matBotSegsMM = _fr_trimBezChain(FR_MASTER_BOTTOM_CURVE_MM, masterXL_piece, masterXR_piece);
    var solda5SegsPt  = _fr_transformSegsToPt(matBotSegsMM, xMatIni, masterXL_piece, yCantosFundo, botCornerY_piece, +mm2pt(5));
    var solda10SegsPt = _fr_transformSegsToPt(matBotSegsMM, xMatIni, masterXL_piece, yCantosFundo, botCornerY_piece, +mm2pt(10));
    _fr_drawBezierOpen(groupCotas, solda5SegsPt,  corFaca, true);
    _fr_drawBezierOpen(groupCotas, solda10SegsPt, corFaca, true);

    addText(groupCotas, "SOLDA", xMatIni + largPt / 2, yFundoExtremo + mm2pt(7.5), 8, corCota, 0);

    // ------------------------------------------------------------------
    // 4. COTAS HORIZONTAIS (acima do topo)
    // ------------------------------------------------------------------
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);
    var margemLateralMM = (largMM - arteWidthMM) / 2;

    var _latFontSize = (queijoData && queijoData.bordaCaida) ? 5 : 12;

    drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, _fr_fmt(largMM) + " mm", corCota);
    drawCotaH(groupCotas, xMatIni,        arteLeftCota,  yCota2, _fr_fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    drawCotaH(groupCotas, arteLeftCota,   arteRightCota, yCota2, _fr_fmt2(arteWidthMM)     + " mm", corCota);
    drawCotaH(groupCotas, arteRightCota,  xMatFim,       yCota2, _fr_fmt2(margemLateralMM) + " mm", corCota, _latFontSize);

    // ------------------------------------------------------------------
    // 5. COTAS VERTICAIS (à esquerda) — valores seguem a geometria real
    // ------------------------------------------------------------------
    var xCotaV1 = xMatIni - mm2pt(14);
    var xCotaV2 = xMatIni - mm2pt(5);

    drawCotaV(groupCotas, xCotaV1, yTopoCentro, yFundoExtremo, _fr_fmt(compMM) + " mm", corCota);

    drawCotaV(groupCotas, xCotaV2, yFundoExtremo,             yLinhaBaixoSoldaCentro, "5 mm", corCota, 5);
    drawCotaV(groupCotas, xCotaV2, yLinhaBaixoSoldaCentro,    yLinhaTopoSoldaCentro,  "5 mm", corCota, 5);
    if (distFundoEfetivoMM > 0) {
        var _dfFontSize = (queijoData && queijoData.bordaCaida) ? 5 : 12;
        drawCotaV(groupCotas, xCotaV2, yLinhaTopoSoldaCentro, yArteBotCentro,
                  _fr_fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
    }
    drawCotaV(groupCotas, xCotaV2, yArteBotCentro, yArteTopCentro,
              _fr_fmt2(arteAltEfetivaMM) + " mm", corCota);
    drawCotaV(groupCotas, xCotaV2, yArteTopCentro, yTopoCentro,
              _fr_fmt2(selagemEfetivaMM) + " mm", corCota);
}

// --- LÓGICA: FRENTE + VERSO (duas faces lado a lado) ---
// recuoMM = recuo lateral/arte da frente em mm. Verso usa recuoMM + 5
// (exceto em borda caída e arte custom, que reutilizam o mesmo).
function _fr_gerarDuplo(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt = mm2pt(largMM);
    var compPt = mm2pt(compMM);
    var dTopoPt = mm2pt(_fr_getDepthTopMM(largMM));
    var gapFaces = mm2pt(40);

    var err = _fr_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData);
    if (err) return jsonErr(err);

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
    var totalPouchW = (largPt * 2) + gapFaces;
    var totalPouchH = dTopoPt + compPt;
    var docW = totalPouchW + (marginX * 2);
    var docH = totalPouchH + (marginY * 2);

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;
    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // UM grupo top-level por categoria, compartilhado entre frente e verso
    var topMaterial = layerV1.groupItems.add(); topMaterial.name = "Material";
    var topArte     = layerV1.groupItems.add(); topArte.name     = "Arte";
    var topCotas    = layerV1.groupItems.add(); topCotas.name    = "Cotas";

    // Verso: no modo queijo sem borda caída usa recuoMM+5; em borda caída ou arte custom, usa o mesmo da frente.
    var versoRecuoMM = (queijoData && !queijoData.bordaCaida) ? recuoMM + 5 : recuoMM;
    _fr_desenharFace(topMaterial, topArte, topCotas, x0, y0,
                     largMM, compMM, selagemMM, fundoMM, recuoMM, "Frente", queijoData, arteData);
    _fr_desenharFace(topMaterial, topArte, topCotas, x0 + largPt + gapFaces, y0,
                     largMM, compMM, selagemMM, fundoMM, versoRecuoMM, "Verso", queijoData, arteData);

    app.redraw();
    return jsonOk("Fundo Redondo (frente + verso) gerado com sucesso!");
}

// --- LÓGICA: SOMENTE FRENTE ---
function _fr_gerarFrente(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt = mm2pt(largMM);
    var compPt = mm2pt(compMM);
    var dTopoPt = mm2pt(_fr_getDepthTopMM(largMM));

    var err = _fr_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData);
    if (err) return jsonErr(err);

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
    var totalH = dTopoPt + compPt;
    var docW = largPt + (marginX * 2);
    var docH = totalH + (marginY * 2);

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;
    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - largPt) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalH) / 2;

    var topMaterial = layerV1.groupItems.add(); topMaterial.name = "Material";
    var topArte     = layerV1.groupItems.add(); topArte.name     = "Arte";
    var topCotas    = layerV1.groupItems.add(); topCotas.name    = "Cotas";

    _fr_desenharFace(topMaterial, topArte, topCotas, x0, y0,
                     largMM, compMM, selagemMM, fundoMM, recuoMM, "Frente", queijoData, arteData);

    app.redraw();
    return jsonOk("Fundo Redondo (somente frente) gerado com sucesso!");
}

// ==========================================
// ENTRADA PÚBLICA — chamada por client/js/main.js via evalScript
// Assinatura plana (21 args) para compatibilidade com o mecanismo de
// buildHostCall. A ordem segue `argOrder` declarado em structures.js.
// ==========================================
function gerarFundoRedondo(
    compMM, largMM, somenteFrente,
    hasQueijo, queijoRedondo, queijoComp, queijoLarg, queijoDiam, queijoAlt, bordaCaida,
    recuoMM,
    hasArte, arteRedonda,
    arteTamF, arteLargF, arteDiamF, arteFundoF,
    arteTamV, arteLargV, arteDiamV, arteFundoV
) {
    try {
        // Normaliza flags para booleanos ExtendScript (ES3 — evalScript envia strings).
        somenteFrente = (somenteFrente === true || somenteFrente === "true");
        hasQueijo     = (hasQueijo     === true || hasQueijo     === "true");
        queijoRedondo = (queijoRedondo === true || queijoRedondo === "true");
        bordaCaida    = (bordaCaida    === true || bordaCaida    === "true");
        hasArte       = (hasArte       === true || hasArte       === "true");
        arteRedonda   = (arteRedonda   === true || arteRedonda   === "true");

        // Exclusividade mútua (defensivo): se por algum motivo ambos chegarem true,
        // o queijo tem precedência (comportamento da UI original).
        if (hasQueijo) hasArte = false;

        // Constrói queijoData conforme o script original (Comp/Larg ou Diâmetro)
        var queijoData = null;
        if (hasQueijo) {
            var qc, ql;
            if (queijoRedondo) {
                qc = queijoDiam; ql = queijoDiam;
            } else {
                qc = queijoComp; ql = queijoLarg;
            }
            if (isNaN(qc) || isNaN(ql) || isNaN(queijoAlt)) {
                return jsonErr("Digite valores válidos para o queijo.");
            }
            queijoData = {
                comp: qc, larg: ql, alt: queijoAlt,
                bordaCaida: bordaCaida,
                redondo: queijoRedondo
            };
        }

        // Constrói arteData conforme o script original (Tam/Larg ou Diâmetro,
        // com subestrutura frente/verso — verso=null se "Somente frente").
        var arteData = null;
        if (hasArte) {
            var atF, alF, atV, alV;
            if (arteRedonda) {
                atF = arteDiamF; alF = arteDiamF;
                atV = arteDiamV; alV = arteDiamV;
            } else {
                atF = arteTamF; alF = arteLargF;
                atV = arteTamV; alV = arteLargV;
            }
            var frenteOk = !isNaN(atF) && !isNaN(alF) && !isNaN(arteFundoF);
            var versoOk  = somenteFrente || (!isNaN(atV) && !isNaN(alV) && !isNaN(arteFundoV));
            if (!frenteOk || !versoOk) {
                return jsonErr("Digite valores válidos para a arte.");
            }
            arteData = {
                redonda: arteRedonda,
                frente: { tamanho: atF, largura: alF, distFundo: arteFundoF },
                verso:  somenteFrente ? null : { tamanho: atV, largura: alV, distFundo: arteFundoV }
            };
        }

        // Parâmetros fixos do original:
        //   selagem = 30 mm (campo removido da UI já no reference)
        //   fundo   = 10 mm (modo A, sem queijo/arte); 0 mm (queijo s/ borda);
        //             5 mm (queijo c/ borda caída); 10 mm para arte custom
        //             (não afetado: modo F/G usa distFundo por face).
        //   recuo   = argumento do usuário; fixado em 5 se borda caída.
        var selagemMM = 30;
        var fundoMM;
        var effectiveRecuoMM = recuoMM;
        if (hasQueijo) {
            fundoMM = bordaCaida ? 5 : 0;
            if (bordaCaida) effectiveRecuoMM = 5;
        } else {
            fundoMM = 10;
        }

        if (isNaN(compMM) || isNaN(largMM) || isNaN(selagemMM) || isNaN(fundoMM) || isNaN(effectiveRecuoMM)) {
            return jsonErr("Digite valores válidos.");
        }

        if (somenteFrente) {
            return _fr_gerarFrente(compMM, largMM, selagemMM, fundoMM, effectiveRecuoMM, queijoData, arteData);
        } else {
            return _fr_gerarDuplo(compMM, largMM, selagemMM, fundoMM, effectiveRecuoMM, queijoData, arteData);
        }
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
