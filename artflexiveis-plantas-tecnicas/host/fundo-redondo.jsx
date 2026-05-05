// ==========================================
// FUNDO-REDONDO.JSX — Fundo Redondo v3.2 (port V2.0)
// Portado 1:1 de reference/Fundo-Redondo_V2_0.JSX (FR clássico + modo PE).
// Depende dos helpers definidos em core.jsx (mm2pt, cmyk, drawCotaH,
// drawCotaV, addText, applyArialBold, jsonOk, jsonErr).
//
// Mudanças em relação à V1.0 portada:
//   1. Modo PE (Pouch Envelope) — fundo com 2 cantos arredondados R=48,5mm
//      conectados por trecho reto. Em "Somente frente" desenha EM PÉ; em
//      "Frente+Verso" desenha DEITADO (faces espelhadas com fundos arredondados
//      voltados para o centro do layout).
//   2. Selagem agora é parâmetro do usuário (default 45 mm); antes fixa em 30 mm.
//   3. Deslocamento da arte (recuoMM) suporta NEGATIVOS quando há queijo sem
//      borda caída — semântica nova: positivo expande arte, negativo recua.
//      Verso = frente − 5 mm (antes era + 5 mm; foi um sign flip).
//   4. Validações revistas: arte ≤ largMM − 10 mm (5 mm de respiro lateral);
//      base da arte ≥ 5 mm da solda do fundo (queijo sem borda caída).
//   5. Cotas adaptativas: fonte 5 pt em faixas estreitas (< 15 mm) e
//      renderização condicional (margens com 0 mm são omitidas).
//   6. Cota vertical com leitura "top-down" (textoDireita) para o VERSO do
//      PE deitado, onde as cotas ficam à direita do layout.
//
// Mudanças cirúrgicas em relação ao reference:
//   - Removido o diálogo ScriptUI. A entrada pública é gerarFundoRedondo(...)
//     com assinatura plana (23 args), chamada via evalScript pelo painel.
//   - Helpers e constantes locais prefixados com `_fr` / `FR_` para evitar
//     conflito de escopo global entre scripts .jsx carregados via $.evalFile.
//   - Retornos: alerts substituídos por jsonOk/jsonErr (helpers de core.jsx —
//     ExtendScript ES3 não possui JSON nativo).
//   - Funções utilitárias do reference NUNCA invocadas (drawPESoldaEmPe,
//     drawPESoldaDeitado, drawCentroX) foram omitidas — PE não tem solda
//     física e a marca de registro não é desenhada na V2.0.
//
// Curva mestre, profundidades aparentes, grupos, cores, ordem de desenho,
// fotocélula, labels e texto permanecem 1:1 com a reference V2.0.
// ==========================================

// ============================================================
// CURVA MESTRE (extraída de Modelo_Final.pdf, peça máxima 460×370 mm)
// Coordenadas em mm ABSOLUTOS com origem no canto superior/inferior esquerdo.
// Curvas SIMÉTRICAS (pontas esq e dir batem nos extremos x=0 e x=370).
//   x: 0 (esquerda) a 370 (direita) em mm
//   y: profundidade em mm abaixo da linha dos cantos (positivo = mais fundo)
// ============================================================
var FR_MASTER_W_MM = 370.00;

// Curva MESTRE do TOPO (2 segmentos Bezier, simétricos)
var FR_MASTER_TOP_CURVE_MM = [
    [[  0.000,  0.000], [ 66.658, 35.905], [125.278, 53.702], [184.876, 53.295]],
    [[185.124, 53.295], [244.721, 53.702], [303.341, 35.905], [370.000,  0.000]]
];

// Curva MESTRE do FUNDO (4 segmentos Bezier, simétricos)
var FR_MASTER_BOTTOM_CURVE_MM = [
    [[  0.000,  0.000], [ 58.916, 31.839], [111.367, 49.121], [166.654, 53.532]],
    [[166.654, 53.532], [172.685, 53.904], [178.801, 54.062], [185.000, 54.015]],
    [[185.000, 54.015], [191.198, 54.062], [197.314, 53.904], [203.346, 53.532]],
    [[203.346, 53.532], [258.632, 49.121], [311.084, 31.839], [370.000,  0.000]]
];

// Limites do gabarito (maior peça possível)
var FR_MAX_W_MM = 370.0;
var FR_MAX_C_MM = 460.0;

// Densidade de amostragem da curva mestre
var FR_BEZIER_SEGMENTS = 40;

// ============================================================
// CONSTANTES DO MODO PE (Pouch Envelope)
// ------------------------------------------------------------
// No PE o contorno do material é diferente do FR clássico:
//   - TOPO: linha reta (sem curva)
//   - LATERAIS: linhas retas
//   - FUNDO: 2 cantos arredondados de raio FR_PE_RADIUS_MM ligados por
//            um trecho reto horizontal
//
// Em "Somente frente" a peça é desenhada EM PÉ (vertical).
// Em "Frente+Verso" a peça é desenhada DEITADA: duas faces espelhadas
// lado a lado, com os fundos arredondados voltados para o CENTRO do
// layout e os topos retos nas extremidades EXTERNAS.
//   FRENTE (bloco esquerdo) → fundo à DIREITA, topo à ESQUERDA
//   VERSO  (bloco direito)  → fundo à ESQUERDA, topo à DIREITA
//
// Não há simulação de linhas de solda no PE — os 5 mm da margem do fundo
// são apenas reserva geométrica respeitada pela arte.
// ============================================================
var FR_PE_RADIUS_MM       = 48.5;
var FR_KAPPA              = 0.5522847498;  // 4*(sqrt(2)-1)/3 — Bezier coef de arco 90°
var FR_PE_GAP_DEITADO_MM  = 0;             // gap entre frente e verso no layout deitado
var FR_PE_MARGEM_FUNDO_MM = 5;             // distância mínima do vale do fundo até a arte

// Caches (calculados uma vez por sessão de documento)
var _fr_topSamples = null;
var _fr_botSamples = null;
var _fr_maxTopMM   = null;
var _fr_maxBotMM   = null;

// --- Conversão pt↔mm (core.jsx fornece mm2pt; pt2mm é local) ---
function _fr_pt2mm(pt) { return pt / 2.83465; }

// --- Formatação BR (vírgula decimal) ---
function _fr_fmt(n) { return String(n).replace('.', ','); }

// Formata número com até 2 casas decimais e vírgula (cotas calculadas).
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

// Profundidade APARENTE do topo/fundo para uma peça de largura W
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

// --- Bezier cúbica + amostragem ---
function _fr_bezierAt(p0, cp1, cp2, p3, t) {
    var u = 1 - t;
    var x = u*u*u*p0[0] + 3*u*u*t*cp1[0] + 3*u*t*t*cp2[0] + t*t*t*p3[0];
    var y = u*u*u*p0[1] + 3*u*u*t*cp1[1] + 3*u*t*t*cp2[1] + t*t*t*p3[1];
    return [x, y];
}

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
// GEOMETRIA BEZIER: trim + subdivisão + paths com nós reais
// Usado para produzir curvas no Illustrator com POUCOS nós (versus
// polilinha densa). De Casteljau apara a curva mestre em x=[xL, xR].
// ============================================================

function _fr_lerp(a, b, t) {
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

function _fr_bezXAt(seg, t) {
    var u = 1 - t, u2 = u * u, t2 = t * t;
    return u2 * u * seg[0][0] + 3 * u2 * t * seg[1][0] + 3 * u * t2 * seg[2][0] + t2 * t * seg[3][0];
}

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

function _fr_revBez(seg) { return [seg[3], seg[2], seg[1], seg[0]]; }

function _fr_revBezChain(segs) {
    var out = [];
    for (var i = segs.length - 1; i >= 0; i--) out.push(_fr_revBez(segs[i]));
    return out;
}

// Transforma segmentos Bezier de coords MASTER mm para ILLUSTRATOR pt.
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

// Adiciona pontos Bezier a um pathItem.
function _fr_addBezSegsToPath(pathItem, segsPt) {
    if (segsPt.length === 0) return;
    function addPt(anchor, lDir, rDir) {
        var pp = pathItem.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
        pp.pointType = PointType.SMOOTH;
    }
    addPt(segsPt[0][0], segsPt[0][0], segsPt[0][1]);
    for (var i = 0; i < segsPt.length - 1; i++) {
        addPt(segsPt[i][3], segsPt[i][2], segsPt[i+1][1]);
    }
    var last = segsPt.length - 1;
    addPt(segsPt[last][3], segsPt[last][2], segsPt[last][3]);
}

// Curva Bezier aberta (open path).
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

// Contorno do material FR (path fechado preenchido) usando Bezier real.
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

// Retângulo tracejado (sem preenchimento). Coords (x1, x2, y1, y2).
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

// Elipse tracejada centrada em (cx, cy).
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

// Elipse preenchida centrada em (cx, cy).
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

// ============================================================
// HELPERS DO MODO PE (Pouch Envelope)
// Cantos arredondados com kappa = 4*(sqrt(2)-1)/3 — Bezier cúbica
// padrão para arco de 90°.
// ============================================================

// Raio efetivo (clamp): se a peça for pequena demais, reduz R para
// que os 2 arcos do fundo não se sobreponham.
function _fr_peRadiusEffMM(Wmm, Cmm) {
    var r = FR_PE_RADIUS_MM;
    if (r > Wmm / 2) r = Wmm / 2;
    if (r > Cmm)     r = Cmm;
    return r;
}

// Material PE EM PÉ: topo reto, lados retos, 2 cantos arredondados no fundo.
function _fr_drawPEMaterialEmPe(layer, xL, yTop, Wmm, Cmm, color) {
    var Wpt = mm2pt(Wmm);
    var Cpt = mm2pt(Cmm);
    var R_eff = _fr_peRadiusEffMM(Wmm, Cmm);
    var Rpt = mm2pt(R_eff);
    var kR = FR_KAPPA * Rpt;

    var xR = xL + Wpt;
    var yBot = yTop - Cpt;

    var p = layer.pathItems.add();
    function addPt(anchor, lDir, rDir) {
        var pp = p.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
    }

    // Sentido horário a partir do canto superior esquerdo:
    //   1) sup-esq reto  2) sup-dir reto
    //   3) início arco inf-dir  4) fim arco inf-dir (fundo reto)
    //   5) início arco inf-esq (fundo reto)  6) fim arco inf-esq
    addPt([xL, yTop],           [xL, yTop],            [xL, yTop]);
    addPt([xR, yTop],           [xR, yTop],            [xR, yTop]);
    addPt([xR, yBot + Rpt],     [xR, yBot + Rpt],      [xR, yBot + Rpt - kR]);
    addPt([xR - Rpt, yBot],     [xR - Rpt + kR, yBot], [xR - Rpt, yBot]);
    addPt([xL + Rpt, yBot],     [xL + Rpt, yBot],      [xL + Rpt - kR, yBot]);
    addPt([xL, yBot + Rpt],     [xL, yBot + Rpt - kR], [xL, yBot + Rpt]);

    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Material";
    return p;
}

// Material PE DEITADO (frente ou verso). isFrente=true → fundo arredondado
// à ESQUERDA, topo reto à DIREITA. isFrente=false → espelhado.
function _fr_drawPEMaterialDeitado(layer, xStart, yTop, Cmm, Wmm, isFrente, color) {
    var Cpt = mm2pt(Cmm);
    var Wpt = mm2pt(Wmm);
    var R_eff = _fr_peRadiusEffMM(Wmm, Cmm);
    var Rpt = mm2pt(R_eff);
    var kR = FR_KAPPA * Rpt;

    var xEnd = xStart + Cpt;
    var yBot = yTop - Wpt;

    var p = layer.pathItems.add();
    function addPt(anchor, lDir, rDir) {
        var pp = p.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
    }

    if (isFrente) {
        // FRENTE: fundo arredondado à ESQUERDA, topo reto à DIREITA
        addPt([xStart, yTop - Rpt],  [xStart, yTop - Rpt],       [xStart, yTop - Rpt + kR]);
        addPt([xStart + Rpt, yTop],  [xStart + Rpt - kR, yTop],  [xStart + Rpt, yTop]);
        addPt([xEnd, yTop],          [xEnd, yTop],               [xEnd, yTop]);
        addPt([xEnd, yBot],          [xEnd, yBot],               [xEnd, yBot]);
        addPt([xStart + Rpt, yBot],  [xStart + Rpt, yBot],       [xStart + Rpt - kR, yBot]);
        addPt([xStart, yBot + Rpt],  [xStart, yBot + Rpt - kR],  [xStart, yBot + Rpt]);
    } else {
        // VERSO: topo reto à ESQUERDA, fundo arredondado à DIREITA
        addPt([xStart, yTop],        [xStart, yTop],             [xStart, yTop]);
        addPt([xEnd - Rpt, yTop],    [xEnd - Rpt, yTop],         [xEnd - Rpt + kR, yTop]);
        addPt([xEnd, yTop - Rpt],    [xEnd, yTop - Rpt + kR],    [xEnd, yTop - Rpt]);
        addPt([xEnd, yBot + Rpt],    [xEnd, yBot + Rpt],         [xEnd, yBot + Rpt - kR]);
        addPt([xEnd - Rpt, yBot],    [xEnd - Rpt + kR, yBot],    [xEnd - Rpt, yBot]);
        addPt([xStart, yBot],        [xStart, yBot],             [xStart, yBot]);
    }

    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Material";
    return p;
}

// Arte PE EM PÉ com fundo arredondado (modo A e modos C/E borda caída).
// Topo reto, fundo com 2 arcos R_artemm conectados por trecho reto.
function _fr_drawPEArteEmPe(layer, xArteL, xArteR, yArteTop, yArteBot, R_artemm, color) {
    var R2mm = R_artemm;
    if (R2mm < 0) R2mm = 0;
    var halfWmm = _fr_pt2mm(xArteR - xArteL) / 2;
    var heightmm = _fr_pt2mm(yArteTop - yArteBot);
    if (R2mm > halfWmm) R2mm = halfWmm;
    if (R2mm > heightmm) R2mm = heightmm;

    var R2pt = mm2pt(R2mm);
    var kR2 = FR_KAPPA * R2pt;

    var xCL = xArteL + R2pt;
    var xCR = xArteR - R2pt;
    var yC  = yArteBot + R2pt;

    var p = layer.pathItems.add();
    function addPt(anchor, lDir, rDir) {
        var pp = p.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
    }

    addPt([xArteL, yArteTop], [xArteL, yArteTop],    [xArteL, yArteTop]);
    addPt([xArteR, yArteTop], [xArteR, yArteTop],    [xArteR, yArteTop]);
    addPt([xArteR, yC],       [xArteR, yC],          [xArteR, yC - kR2]);
    addPt([xCR, yArteBot],    [xCR + kR2, yArteBot], [xCR, yArteBot]);
    addPt([xCL, yArteBot],    [xCL, yArteBot],       [xCL - kR2, yArteBot]);
    addPt([xArteL, yC],       [xArteL, yC - kR2],    [xArteL, yC]);

    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Arte";
    return p;
}

// Arte PE DEITADA com fundo arredondado. isFrente=true → fundo à
// ESQUERDA (arcos em xArteIni). isFrente=false → fundo à DIREITA.
function _fr_drawPEArteDeitada(layer, xArteIni, xArteFim, yArteTop, yArteBot, R_artemm, isFrente, color) {
    var R2mm = R_artemm;
    if (R2mm < 0) R2mm = 0;
    var widthmm = _fr_pt2mm(xArteFim - xArteIni);
    var halfHmm = _fr_pt2mm(yArteTop - yArteBot) / 2;
    if (R2mm > widthmm) R2mm = widthmm;
    if (R2mm > halfHmm) R2mm = halfHmm;

    var R2pt = mm2pt(R2mm);
    var kR2 = FR_KAPPA * R2pt;

    var p = layer.pathItems.add();
    function addPt(anchor, lDir, rDir) {
        var pp = p.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
    }

    if (isFrente) {
        // Fundo arredondado à ESQUERDA (xArteIni)
        addPt([xArteIni, yArteTop - R2pt],  [xArteIni, yArteTop - R2pt],       [xArteIni, yArteTop - R2pt + kR2]);
        addPt([xArteIni + R2pt, yArteTop],  [xArteIni + R2pt - kR2, yArteTop], [xArteIni + R2pt, yArteTop]);
        addPt([xArteFim, yArteTop],         [xArteFim, yArteTop],              [xArteFim, yArteTop]);
        addPt([xArteFim, yArteBot],         [xArteFim, yArteBot],              [xArteFim, yArteBot]);
        addPt([xArteIni + R2pt, yArteBot],  [xArteIni + R2pt, yArteBot],       [xArteIni + R2pt - kR2, yArteBot]);
        addPt([xArteIni, yArteBot + R2pt],  [xArteIni, yArteBot + R2pt - kR2], [xArteIni, yArteBot + R2pt]);
    } else {
        // Fundo arredondado à DIREITA (xArteFim)
        addPt([xArteIni, yArteTop],         [xArteIni, yArteTop],              [xArteIni, yArteTop]);
        addPt([xArteFim - R2pt, yArteTop],  [xArteFim - R2pt, yArteTop],       [xArteFim - R2pt + kR2, yArteTop]);
        addPt([xArteFim, yArteTop - R2pt],  [xArteFim, yArteTop - R2pt + kR2], [xArteFim, yArteTop - R2pt]);
        addPt([xArteFim, yArteBot + R2pt],  [xArteFim, yArteBot + R2pt],       [xArteFim, yArteBot + R2pt - kR2]);
        addPt([xArteFim - R2pt, yArteBot],  [xArteFim - R2pt + kR2, yArteBot], [xArteFim - R2pt, yArteBot]);
        addPt([xArteIni, yArteBot],         [xArteIni, yArteBot],              [xArteIni, yArteBot]);
    }

    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Arte";
    return p;
}

// ============================================================
// COTA VERTICAL ESTENDIDA — suporte a leitura "top-down" (textoDireita)
// Necessária para o lado VERSO do PE deitado, onde as cotas ficam à
// DIREITA do layout. Para textoDireita=true o texto é rotacionado
// -90° (espelhado em relação ao padrão +90° do core.jsx) e posicionado
// à direita da linha de cota.
// Para os demais call-sites (FR clássico + PE em pé), seguimos usando
// o `drawCotaV` de core.jsx — assinatura idêntica nos primeiros 8 args.
// ============================================================
function _fr_drawCotaV(layer, x, y1, y2, textStr, color, fontSize, centered, textoDireita) {
    if (fontSize === undefined) fontSize = 12;
    if (centered === undefined) centered = false;
    if (textoDireita === undefined) textoDireita = false;
    var tickW = mm2pt(1);
    var group = layer.groupItems.add();

    var line = group.pathItems.add();
    line.setEntirePath([[x, y1], [x, y2]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;

    var b1 = group.pathItems.add();
    b1.setEntirePath([[x - tickW, y1], [x + tickW, y1]]);
    b1.filled = false; b1.stroked = true;
    b1.strokeColor = color; b1.strokeWidth = 1;

    var b2 = group.pathItems.add();
    b2.setEntirePath([[x - tickW, y2], [x + tickW, y2]]);
    b2.filled = false; b2.stroked = true;
    b2.strokeColor = color; b2.strokeWidth = 1;

    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        if (textoDireita) {
            t.rotate(-90);
        } else {
            t.rotate(90);
        }
        t.top  = (y1 + y2) / 2 + (t.height / 2);
        if (centered) {
            t.left = x - t.width / 2;
        } else if (textoDireita) {
            t.left = x + mm2pt(2);
        } else {
            t.left = x - mm2pt(2) - t.width;
        }
    }
}

// ============================================================
// VALIDAÇÃO (FR + PE) — retorna null em sucesso, string em falha
// ------------------------------------------------------------
//   compMM   = distância vale-a-vale (FR) ou topo→fundo (PE).
//   recuoMM  = deslocamento da arte (positivo = expande, negativo = recua).
//   Verso  = recuoMM − 5 (queijo sem borda caída) — semântica V2.0.
// ============================================================
function _fr_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    if (largMM > FR_MAX_W_MM) {
        return "a largura máxima é " + _fr_fmt(FR_MAX_W_MM) + " mm (limite do gabarito).";
    }
    if (compMM > FR_MAX_C_MM) {
        return "o comprimento máximo é " + _fr_fmt(FR_MAX_C_MM) + " mm (limite do gabarito).";
    }
    // Respiro mínimo de 5 mm de cada lado: largura da arte ≤ largMM − 10 mm.
    var maxLargArte = largMM - 10;

    if (queijoData && !queijoData.bordaCaida) {
        // Frente: arte = queijo + 2*recuoMM
        var lFrente = queijoData.larg + 2 * recuoMM;
        if (lFrente > maxLargArte + 0.01) {
            return "a arte da FRENTE tem largura " + _fr_fmt2(lFrente) +
                   " mm e fica a menos de 5 mm da borda lateral.\n" +
                   "Largura máxima: " + _fr_fmt2(maxLargArte) +
                   " mm (material: " + _fr_fmt(largMM) + " mm).";
        }
        // Verso: arte = queijo + 2*(recuoMM − 5)
        var lVerso = queijoData.larg + 2 * (recuoMM - 5);
        if (lVerso > maxLargArte + 0.01) {
            return "a arte do VERSO tem largura " + _fr_fmt2(lVerso) +
                   " mm e fica a menos de 5 mm da borda lateral.\n" +
                   "Largura máxima: " + _fr_fmt2(maxLargArte) + " mm.";
        }
        // Distância da base da arte à solda do fundo = alt/2 − recuoMM ≥ 5
        var distBaseArte = queijoData.alt / 2 - recuoMM;
        if (distBaseArte < 5 - 0.01) {
            var desloStr = (recuoMM >= 0 ? "+" : "") + _fr_fmt(recuoMM) + " mm";
            return "a base da arte fica a " + _fr_fmt2(distBaseArte) +
                   " mm da solda do fundo — é preciso pelo menos 5 mm.\n" +
                   "Aumente a altura do queijo ou reduza o deslocamento da arte.\n" +
                   "(Altura: " + _fr_fmt(queijoData.alt) + " mm, deslocamento: " + desloStr + ")";
        }
    } else if (arteData) {
        // Arte custom (sem queijo): valida cada lado (frente/verso)
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
            if (inf.largura > maxLargArte + 0.01) {
                return "a largura da arte (" + nm + ", " + _fr_fmt2(inf.largura) +
                       " mm) fica a menos de 5 mm da borda lateral.\n" +
                       "Largura máxima: " + _fr_fmt2(maxLargArte) +
                       " mm (material: " + _fr_fmt(largMM) + " mm).";
            }
            var espacoV_a = inf.tamanho + inf.distFundo;
            var espacoMaxV_a = compMM - 10 - 5;
            if (espacoV_a > espacoMaxV_a) {
                return "a arte (" + nm + ") não cabe na peça.\n" +
                       "Tamanho + distância de fundo = " + _fr_fmt2(espacoV_a) + " mm.\n" +
                       "Espaço máximo disponível = " + _fr_fmt2(espacoMaxV_a) + " mm.";
            }
        }
    } else {
        // Modo A (sem queijo nem arte) ou borda caída: arte segue curva padrão
        // com 5 mm respiro lateral; valida espaço vertical mínimo.
        var arteAlt = compMM - selagemMM - fundoMM - 10;  // 5 respiro + 5 solda = 10
        if (arteAlt < 5) {
            return "o comprimento é insuficiente.\n" +
                   "Mínimo necessário: selagem (" + _fr_fmt(selagemMM) +
                   ") + fundo (" + _fr_fmt(fundoMM) + ") + solda+respiro (10) + 5 de arte = " +
                   _fr_fmt2(selagemMM + fundoMM + 10 + 5) + " mm.";
        }
    }

    // Validações do queijo (se definido)
    if (queijoData) {
        if (queijoData.comp <= 0 || queijoData.larg <= 0 || queijoData.alt <= 0) {
            return "dimensões do queijo devem ser positivas.";
        }
        if (queijoData.larg > largMM) {
            return "a largura do queijo (" + _fr_fmt(queijoData.larg) +
                   " mm) é maior que a largura da peça (" + _fr_fmt(largMM) + " mm).";
        }
        var espacoV = queijoData.comp + queijoData.alt / 2;
        var espacoMaxV = compMM - 10 - 5;
        if (espacoV > espacoMaxV) {
            return "o queijo não cabe na peça.\n" +
                   "Espaço ocupado pelo queijo (comp + altura/2) = " + _fr_fmt2(espacoV) + " mm.\n" +
                   "Espaço máximo disponível = " + _fr_fmt2(espacoMaxV) + " mm.";
        }
    }
    return null;
}

// ============================================================
// FACE FR CLÁSSICO (topo + fundo curvos, solda Bezier)
// ------------------------------------------------------------
//   Modos:
//     (A) Sem queijo                            → arte com topo E fundo CURVOS
//     (B) Queijo retangular, sem borda caída    → arte RETANGULAR, recuoMM em volta do queijo
//     (C) Queijo retangular + borda caída       → arte curva (= A) + retângulo do queijo em Cotas
//     (D) Queijo REDONDO, sem borda caída       → arte ELÍPTICA, recuoMM em volta do queijo
//     (E) Queijo REDONDO + borda caída          → arte curva (= A) + elipse do queijo em Cotas
//     (F/G) Arte custom (sem queijo)            → arte retangular ou elíptica, dimensões livres
// ============================================================
function _fr_desenharFace(topMaterial, topArte, topCotas, xStart, yStart, largMM, compMM, selagemMM, fundoMM, recuoMM, nomeGrupo, queijoData, arteData) {
    var largPt    = mm2pt(largMM);
    var compPt    = mm2pt(compMM);
    var selagemPt = mm2pt(selagemMM);
    var margemLat = mm2pt(recuoMM);
    var isFrente  = (nomeGrupo === "Frente");

    var dTopoPt   = mm2pt(_fr_getDepthTopMM(largMM));
    var dFundoPt  = mm2pt(_fr_getDepthBotMM(largMM));

    var corFundo   = cmyk(15, 12, 12, 0);
    var corFaca    = cmyk(0, 0, 0, 60);
    var corCota    = cmyk(0, 0, 0, 60);
    var corCyan    = cmyk(70, 10, 16, 0);
    var corMagenta = cmyk(0, 100, 0, 0);
    var corPreto   = cmyk(0, 0, 0, 100);

    var xMatIni = xStart;
    var xMatFim = xStart + largPt;
    var yTopo          = yStart;                  // cantos superiores (Y máximo da peça)
    var yTopoCentro    = yTopo - dTopoPt;         // vale superior
    var yFundoExtremo  = yTopoCentro - compPt;    // vale inferior
    var yCantosFundo   = yFundoExtremo + dFundoPt;// cantos inferiores (fim da lateral reta)

    // Linhas de referência no CENTRO (cotas + queijo)
    var yLinhaBaixoSoldaCentro = yFundoExtremo + mm2pt(5);
    var yLinhaTopoSoldaCentro  = yFundoExtremo + mm2pt(10);

    var groupMaterial = topMaterial.groupItems.add(); if (nomeGrupo) groupMaterial.name = nomeGrupo;
    var groupArte     = topArte.groupItems.add();     if (nomeGrupo) groupArte.name     = nomeGrupo;
    var groupCotas    = topCotas.groupItems.add();    if (nomeGrupo) groupCotas.name    = nomeGrupo;

    // 1. MATERIAL (contorno curvo preenchido)
    _fr_drawMaterial(groupMaterial, xMatIni, yTopo, largMM, compMM, corFundo);

    // Limites master da ARTE quando curva (recuoMM cada lado)
    var masterXL_piece = (FR_MASTER_W_MM - largMM) / 2;
    var masterXR_piece = (FR_MASTER_W_MM + largMM) / 2;
    var arteXL_master = masterXL_piece + recuoMM;
    var arteXR_master = masterXR_piece - recuoMM;
    var topCornerY_piece = (_fr_interpY(_fr_getTopSamples(), masterXL_piece) + _fr_interpY(_fr_getTopSamples(), masterXR_piece)) / 2;
    var botCornerY_piece = (_fr_interpY(_fr_getBotSamples(), masterXL_piece) + _fr_interpY(_fr_getBotSamples(), masterXR_piece)) / 2;

    // Variáveis dependentes do modo (necessárias para as cotas)
    var yArteTopCentro, yArteBotCentro;
    var arteLeftCota, arteRightCota, arteWidthMM;
    var distFundoEfetivoMM, arteAltEfetivaMM, selagemEfetivaMM;

    function _queijoBBox() {
        var xC = xMatIni + largPt / 2;
        var qB = yLinhaTopoSoldaCentro + mm2pt(queijoData.alt / 2);
        var qT = qB + mm2pt(queijoData.comp);
        var qL = xC - mm2pt(queijoData.larg / 2);
        var qR = xC + mm2pt(queijoData.larg / 2);
        return { left: qL, right: qR, bot: qB, top: qT, cx: xC, cy: (qB + qT) / 2 };
    }

    if (arteData) {
        // --- MODO F/G: ARTE CUSTOM (sem queijo) ---
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
        arteLeftCota   = arteL;
        arteRightCota  = arteR;
        arteWidthMM    = aInfo.largura;
        distFundoEfetivoMM = aFundo;
        arteAltEfetivaMM   = aInfo.tamanho;
        selagemEfetivaMM   = compMM - 10 - aFundo - aInfo.tamanho;
    } else if (queijoData && !queijoData.bordaCaida) {
        // --- MODO B/D: QUEIJO sem borda caída — recuoMM POSITIVO expande ---
        var bbox = _queijoBBox();
        var offPt = mm2pt(recuoMM);

        if (queijoData.redondo) {
            // MODO D: queijo + arte como ELIPSES
            _fr_drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                                  bbox.right - bbox.left, bbox.top - bbox.bot,
                                  corMagenta, "Queijo");
            _fr_drawFilledEllipse(groupArte, bbox.cx, bbox.cy,
                                  bbox.right - bbox.left + 2 * offPt,
                                  bbox.top - bbox.bot + 2 * offPt,
                                  corCyan, "Arte");
        } else {
            // MODO B: queijo + arte como RETÂNGULOS
            _fr_drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
            var arteLeft  = bbox.left  - offPt;
            var arteRight = bbox.right + offPt;
            var arteBot2  = bbox.bot   - offPt;
            var arteTop2  = bbox.top   + offPt;
            var arteShape2 = groupArte.pathItems.rectangle(arteTop2, arteLeft, arteRight - arteLeft, arteTop2 - arteBot2);
            arteShape2.filled = true; arteShape2.stroked = false; arteShape2.fillColor = corCyan;
            arteShape2.name = "Arte";
        }

        yArteBotCentro = bbox.bot - offPt;
        yArteTopCentro = bbox.top + offPt;
        arteLeftCota   = bbox.left - offPt;
        arteRightCota  = bbox.right + offPt;
        arteWidthMM    = queijoData.larg + 2 * recuoMM;
        distFundoEfetivoMM = queijoData.alt / 2 - recuoMM;
        arteAltEfetivaMM   = queijoData.comp + 2 * recuoMM;
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
        arteLeftCota   = xMatIni + margemLat;
        arteRightCota  = xMatFim - margemLat;
        arteWidthMM    = largMM - 2 * recuoMM;
        distFundoEfetivoMM = fundoMM;
        arteAltEfetivaMM   = compMM - selagemMM - 10 - fundoMM;
        selagemEfetivaMM   = selagemMM;

        // Modo C/E: borda caída + queijo em Cotas (retângulo ou elipse tracejada)
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

    // 2b. FOTOCÉLULA (40 × 5 mm, 100% preto, somente FRENTE)
    if (isFrente) {
        var fotoW = mm2pt(40), fotoH = mm2pt(5);
        var fotoTop  = yTopoCentro - mm2pt(5);
        var fotoLeft = xMatIni + mm2pt(5);
        var fotocel = groupArte.pathItems.rectangle(fotoTop, fotoLeft, fotoW, fotoH);
        fotocel.filled = true; fotocel.stroked = false;
        fotocel.fillColor = corPreto;
        fotocel.name = "Fotocélula";
    }

    // 3. LINHAS DE FACA DA SOLDA CURVA (Bezier real)
    var matBotSegsMM = _fr_trimBezChain(FR_MASTER_BOTTOM_CURVE_MM, masterXL_piece, masterXR_piece);
    var solda5SegsPt  = _fr_transformSegsToPt(matBotSegsMM, xMatIni, masterXL_piece, yCantosFundo, botCornerY_piece, +mm2pt(5));
    var solda10SegsPt = _fr_transformSegsToPt(matBotSegsMM, xMatIni, masterXL_piece, yCantosFundo, botCornerY_piece, +mm2pt(10));
    _fr_drawBezierOpen(groupCotas, solda5SegsPt,  corFaca, true);
    _fr_drawBezierOpen(groupCotas, solda10SegsPt, corFaca, true);

    addText(groupCotas, "SOLDA", xMatIni + largPt / 2, yFundoExtremo + mm2pt(7.5), 8, corCota, 0);

    // 4. COTAS HORIZONTAIS (acima do topo)
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);
    var margemLateralMM = (largMM - arteWidthMM) / 2;
    // Fonte 5pt em faixas estreitas (< 15 mm) ou em borda caída
    var _latFontSize = (margemLateralMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;

    drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, _fr_fmt(largMM) + " mm", corCota);
    if (margemLateralMM > 0.01) {
        drawCotaH(groupCotas, xMatIni, arteLeftCota, yCota2, _fr_fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    }
    drawCotaH(groupCotas, arteLeftCota, arteRightCota, yCota2, _fr_fmt2(arteWidthMM) + " mm", corCota);
    if (margemLateralMM > 0.01) {
        drawCotaH(groupCotas, arteRightCota, xMatFim, yCota2, _fr_fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    }

    // 5. COTAS VERTICAIS (à esquerda)
    var xCotaV1 = xMatIni - mm2pt(14);
    var xCotaV2 = xMatIni - mm2pt(5);

    drawCotaV(groupCotas, xCotaV1, yTopoCentro, yFundoExtremo, _fr_fmt(compMM) + " mm", corCota);

    drawCotaV(groupCotas, xCotaV2, yFundoExtremo,             yLinhaBaixoSoldaCentro, "5 mm", corCota, 5);
    drawCotaV(groupCotas, xCotaV2, yLinhaBaixoSoldaCentro,    yLinhaTopoSoldaCentro,  "5 mm", corCota, 5);
    if (distFundoEfetivoMM > 0.01) {
        var _dfFontSize = (distFundoEfetivoMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;
        drawCotaV(groupCotas, xCotaV2, yLinhaTopoSoldaCentro, yArteBotCentro,
                  _fr_fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
    }
    drawCotaV(groupCotas, xCotaV2, yArteBotCentro, yArteTopCentro,
              _fr_fmt2(arteAltEfetivaMM) + " mm", corCota);
    if (selagemEfetivaMM > 0.01) {
        var _selFontSize = (selagemEfetivaMM < 15) ? 5 : 12;
        drawCotaV(groupCotas, xCotaV2, yArteTopCentro, yTopoCentro,
                  _fr_fmt2(selagemEfetivaMM) + " mm", corCota, _selFontSize);
    }
}

// ============================================================
// FACE PE EM PÉ (Pouch Envelope vertical)
// Topo reto, lados retos, fundo com 2 cantos arredondados R=48,5 mm.
// Sem simulação de solda (área do fundo é apenas reserva geométrica).
// ============================================================
function _fr_desenharFacePE_EmPe(topMaterial, topArte, topCotas, xStart, yStart, largMM, compMM, selagemMM, fundoMM, recuoMM, nomeGrupo, queijoData, arteData) {
    var largPt    = mm2pt(largMM);
    var compPt    = mm2pt(compMM);
    var selagemPt = mm2pt(selagemMM);
    var margemLat = mm2pt(recuoMM);
    var isFrente  = (nomeGrupo === "Frente");

    var R_eff = _fr_peRadiusEffMM(largMM, compMM);

    var corFundo   = cmyk(15, 12, 12, 0);
    var corCota    = cmyk(0, 0, 0, 60);
    var corCyan    = cmyk(70, 10, 16, 0);
    var corMagenta = cmyk(0, 100, 0, 0);
    var corPreto   = cmyk(0, 0, 0, 100);

    var xMatIni = xStart;
    var xMatFim = xStart + largPt;
    var yTopo   = yStart;               // topo reto
    var yBot    = yTopo - compPt;       // vale do fundo (trecho reto entre os 2 arcos)

    // Linha de referência: margem mínima do fundo (5 mm acima do vale)
    var yLinhaMargemFundo = yBot + mm2pt(FR_PE_MARGEM_FUNDO_MM);

    var groupMaterial = topMaterial.groupItems.add(); if (nomeGrupo) groupMaterial.name = nomeGrupo;
    var groupArte     = topArte.groupItems.add();     if (nomeGrupo) groupArte.name     = nomeGrupo;
    var groupCotas    = topCotas.groupItems.add();    if (nomeGrupo) groupCotas.name    = nomeGrupo;

    // 1. MATERIAL
    _fr_drawPEMaterialEmPe(groupMaterial, xMatIni, yTopo, largMM, compMM, corFundo);

    // 2. ARTE + (opcional) QUEIJO
    var yArteTopCentro, yArteBotCentro;
    var arteLeftCota, arteRightCota, arteWidthMM;
    var distFundoEfetivoMM, arteAltEfetivaMM, selagemEfetivaMM;

    function _queijoBBoxPE() {
        var xC = xMatIni + largPt / 2;
        // Base do queijo a alt/2 diretamente do vale do fundo arredondado
        var qB = yBot + mm2pt(queijoData.alt / 2);
        var qT = qB + mm2pt(queijoData.comp);
        var qL = xC - mm2pt(queijoData.larg / 2);
        var qR = xC + mm2pt(queijoData.larg / 2);
        return { left: qL, right: qR, bot: qB, top: qT, cx: xC, cy: (qB + qT) / 2 };
    }

    if (arteData) {
        // Modo F/G: arte custom centrada
        var aInfo = isFrente ? arteData.frente : (arteData.verso || arteData.frente);
        var aFundo = aInfo.distFundo;
        var xCentro = xMatIni + largPt / 2;
        var arteBot = yLinhaMargemFundo + mm2pt(aFundo);
        var arteTop = arteBot + mm2pt(aInfo.tamanho);
        var arteL = xCentro - mm2pt(aInfo.largura / 2);
        var arteR = xCentro + mm2pt(aInfo.largura / 2);

        if (arteData.redonda) {
            _fr_drawFilledEllipse(groupArte, xCentro, (arteBot + arteTop) / 2,
                                  arteR - arteL, arteTop - arteBot, corCyan, "Arte");
        } else {
            var arteShapeF = groupArte.pathItems.rectangle(arteTop, arteL, arteR - arteL, arteTop - arteBot);
            arteShapeF.filled = true; arteShapeF.stroked = false; arteShapeF.fillColor = corCyan;
            arteShapeF.name = "Arte";
        }
        yArteBotCentro = arteBot;
        yArteTopCentro = arteTop;
        arteLeftCota   = arteL;
        arteRightCota  = arteR;
        arteWidthMM    = aInfo.largura;
        distFundoEfetivoMM = aFundo;
        arteAltEfetivaMM   = aInfo.tamanho;
        selagemEfetivaMM   = compMM - FR_PE_MARGEM_FUNDO_MM - aFundo - aInfo.tamanho;
    } else if (queijoData && !queijoData.bordaCaida) {
        // Modo B/D: arte centrada no queijo
        var bbox = _queijoBBoxPE();
        var offPt = mm2pt(recuoMM);
        if (queijoData.redondo) {
            _fr_drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                                  bbox.right - bbox.left, bbox.top - bbox.bot,
                                  corMagenta, "Queijo");
            _fr_drawFilledEllipse(groupArte, bbox.cx, bbox.cy,
                                  bbox.right - bbox.left + 2 * offPt,
                                  bbox.top - bbox.bot + 2 * offPt,
                                  corCyan, "Arte");
        } else {
            _fr_drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
            var arteL2 = bbox.left  - offPt;
            var arteR2 = bbox.right + offPt;
            var arteB2 = bbox.bot   - offPt;
            var arteT2 = bbox.top   + offPt;
            var arteShape2 = groupArte.pathItems.rectangle(arteT2, arteL2, arteR2 - arteL2, arteT2 - arteB2);
            arteShape2.filled = true; arteShape2.stroked = false; arteShape2.fillColor = corCyan;
            arteShape2.name = "Arte";
        }
        yArteBotCentro = bbox.bot - offPt;
        yArteTopCentro = bbox.top + offPt;
        arteLeftCota   = bbox.left - offPt;
        arteRightCota  = bbox.right + offPt;
        arteWidthMM    = queijoData.larg + 2 * recuoMM;
        distFundoEfetivoMM = queijoData.alt / 2 - recuoMM;
        arteAltEfetivaMM   = queijoData.comp + 2 * recuoMM;
        selagemEfetivaMM   = compMM - FR_PE_MARGEM_FUNDO_MM - distFundoEfetivoMM - arteAltEfetivaMM;
    } else {
        // Modo A, C ou E: arte com fundo arredondado (R_arte = R_eff − recuo)
        var xArteL = xMatIni + margemLat;
        var xArteR = xMatFim - margemLat;
        var yArteTop = yTopo - selagemPt;
        var yArteBot = yBot + mm2pt(FR_PE_MARGEM_FUNDO_MM + fundoMM);
        var R_arte = R_eff - recuoMM;
        _fr_drawPEArteEmPe(groupArte, xArteL, xArteR, yArteTop, yArteBot, R_arte, corCyan);

        yArteBotCentro = yArteBot;
        yArteTopCentro = yArteTop;
        arteLeftCota   = xArteL;
        arteRightCota  = xArteR;
        arteWidthMM    = largMM - 2 * recuoMM;
        distFundoEfetivoMM = fundoMM;
        arteAltEfetivaMM   = compMM - selagemMM - FR_PE_MARGEM_FUNDO_MM - fundoMM;
        selagemEfetivaMM   = selagemMM;

        // Modo C/E: queijo tracejado sobre a arte
        if (queijoData && queijoData.bordaCaida) {
            var bbox2 = _queijoBBoxPE();
            if (queijoData.redondo) {
                _fr_drawDashedEllipse(groupCotas, bbox2.cx, bbox2.cy,
                                      bbox2.right - bbox2.left, bbox2.top - bbox2.bot,
                                      corMagenta, "Queijo");
            } else {
                _fr_drawDashedRect(groupCotas, bbox2.left, bbox2.right, bbox2.bot, bbox2.top, corMagenta, "Queijo");
            }
        }
    }

    // 2b. FOTOCÉLULA (5 × 20 mm vertical, somente FRENTE)
    if (isFrente) {
        var fotoW = mm2pt(5), fotoH = mm2pt(20);
        var fotoTop  = yTopo - mm2pt(5);
        var fotoLeft = xMatIni + mm2pt(5);
        var fotocel = groupArte.pathItems.rectangle(fotoTop, fotoLeft, fotoW, fotoH);
        fotocel.filled = true; fotocel.stroked = false;
        fotocel.fillColor = corPreto;
        fotocel.name = "Fotocélula";
    }

    // 3. (sem simulação de solda no PE — área do fundo é apenas reserva geométrica)

    // 4. COTAS HORIZONTAIS (acima do topo)
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);
    var margemLateralMM = (largMM - arteWidthMM) / 2;
    var _latFontSize = (margemLateralMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;

    drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, _fr_fmt(largMM) + " mm", corCota);
    if (margemLateralMM > 0.01) {
        drawCotaH(groupCotas, xMatIni, arteLeftCota, yCota2, _fr_fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    }
    drawCotaH(groupCotas, arteLeftCota, arteRightCota, yCota2, _fr_fmt2(arteWidthMM) + " mm", corCota);
    if (margemLateralMM > 0.01) {
        drawCotaH(groupCotas, arteRightCota, xMatFim, yCota2, _fr_fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    }

    // 5. COTAS VERTICAIS (à esquerda)
    var xCotaV1 = xMatIni - mm2pt(14);
    var xCotaV2 = xMatIni - mm2pt(5);

    drawCotaV(groupCotas, xCotaV1, yTopo, yBot, _fr_fmt(compMM) + " mm", corCota);

    // Em modo queijo SEM borda caída (B/D), o queijo é posicionado a alt/2
    // diretamente do vale do fundo, então a cota de 5 mm de margem não se aplica;
    // a cota de distFundoEfetivoMM passa a medir do vale direto até a arte.
    var _pe_temQueijoSemBorda = (queijoData && !queijoData.bordaCaida);
    if (!_pe_temQueijoSemBorda) {
        drawCotaV(groupCotas, xCotaV2, yBot, yLinhaMargemFundo,
                  _fr_fmt(FR_PE_MARGEM_FUNDO_MM) + " mm", corCota, 5);
    }
    if (distFundoEfetivoMM > 0.01) {
        var _dfFontSize = (distFundoEfetivoMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;
        var _yBaseDistFundo = _pe_temQueijoSemBorda ? yBot : yLinhaMargemFundo;
        drawCotaV(groupCotas, xCotaV2, _yBaseDistFundo, yArteBotCentro,
                  _fr_fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
    }
    drawCotaV(groupCotas, xCotaV2, yArteBotCentro, yArteTopCentro,
              _fr_fmt2(arteAltEfetivaMM) + " mm", corCota);
    if (selagemEfetivaMM > 0.01) {
        var _selFontSize = (selagemEfetivaMM < 15) ? 5 : 12;
        drawCotaV(groupCotas, xCotaV2, yArteTopCentro, yTopo,
                  _fr_fmt2(selagemEfetivaMM) + " mm", corCota, _selFontSize);
    }
}

// ============================================================
// FACE PE DEITADA (frente OU verso, espelhada)
// 90° em relação à em pé: compMM vai na horizontal, largMM na vertical.
// Frente e verso são ESPELHADAS com os fundos arredondados voltados para
// o centro do layout:
//   FRENTE (isFrente=true)  → fundo à DIREITA, topo à ESQUERDA
//   VERSO  (isFrente=false) → fundo à ESQUERDA, topo à DIREITA
// Cotas verticais SEMPRE no lado externo (lado do topo reto).
// Fotocélula apenas na frente.
// ============================================================
function _fr_desenharFacePE_Deitada(topMaterial, topArte, topCotas, xStart, yStart, largMM, compMM, selagemMM, fundoMM, recuoMM, nomeGrupo, queijoData, arteData, isFrente) {
    var compPt    = mm2pt(compMM);
    var largPt    = mm2pt(largMM);
    var selagemPt = mm2pt(selagemMM);
    var margemLat = mm2pt(recuoMM);

    var R_eff = _fr_peRadiusEffMM(largMM, compMM);

    var corFundo   = cmyk(15, 12, 12, 0);
    var corCota    = cmyk(0, 0, 0, 60);
    var corCyan    = cmyk(70, 10, 16, 0);
    var corMagenta = cmyk(0, 100, 0, 0);
    var corPreto   = cmyk(0, 0, 0, 100);

    var xMatIni = xStart;
    var xMatFim = xStart + compPt;
    var yTopo   = yStart;
    var yBot    = yTopo - largPt;
    var yCentro = (yTopo + yBot) / 2;

    // FRENTE (esquerda do layout) → fundo à direita; VERSO (direita) → fundo à esquerda
    var fundoAEsquerda = !isFrente;

    // Linha de referência: margem mínima do fundo (do lado do fundo arredondado)
    var xLinhaMargemFundo = fundoAEsquerda ? (xMatIni + mm2pt(FR_PE_MARGEM_FUNDO_MM))
                                           : (xMatFim - mm2pt(FR_PE_MARGEM_FUNDO_MM));

    var groupMaterial = topMaterial.groupItems.add(); if (nomeGrupo) groupMaterial.name = nomeGrupo;
    var groupArte     = topArte.groupItems.add();     if (nomeGrupo) groupArte.name     = nomeGrupo;
    var groupCotas    = topCotas.groupItems.add();    if (nomeGrupo) groupCotas.name    = nomeGrupo;

    // 1. MATERIAL
    _fr_drawPEMaterialDeitado(groupMaterial, xMatIni, yTopo, compMM, largMM, fundoAEsquerda, corFundo);

    // 2. ARTE + (opcional) QUEIJO
    var xArteIni, xArteFim, yArteTopLocal, yArteBotLocal;
    var arteLargVertMM;   // dimensão vertical da arte (= largura original em pé)
    var arteLargHorizMM;  // dimensão horizontal da arte (= comp útil)
    var distFundoEfetivoMM, selagemEfetivaMM;

    function _queijoBBoxPEDeitado() {
        // No deitado: queijoData.larg → vertical; queijoData.comp → horizontal
        var yQB = yCentro - mm2pt(queijoData.larg / 2);
        var yQT = yCentro + mm2pt(queijoData.larg / 2);
        var xQIni, xQFim;
        if (fundoAEsquerda) {
            xQIni = xMatIni + mm2pt(queijoData.alt / 2);
            xQFim = xQIni + mm2pt(queijoData.comp);
        } else {
            xQFim = xMatFim - mm2pt(queijoData.alt / 2);
            xQIni = xQFim - mm2pt(queijoData.comp);
        }
        return { left: xQIni, right: xQFim, bot: yQB, top: yQT, cx: (xQIni + xQFim) / 2, cy: yCentro };
    }

    if (arteData) {
        // Modo F/G: arte custom centrada
        var aInfo = isFrente ? arteData.frente : (arteData.verso || arteData.frente);
        var aFundo = aInfo.distFundo;
        var halfVert = mm2pt(aInfo.largura / 2);
        var arteT = yCentro + halfVert;
        var arteB = yCentro - halfVert;
        // Arte posicionada a partir da margem do fundo arredondado
        var arteL, arteR;
        if (fundoAEsquerda) {
            arteL = xLinhaMargemFundo + mm2pt(aFundo);
            arteR = arteL + mm2pt(aInfo.tamanho);
        } else {
            arteR = xLinhaMargemFundo - mm2pt(aFundo);
            arteL = arteR - mm2pt(aInfo.tamanho);
        }
        if (arteData.redonda) {
            _fr_drawFilledEllipse(groupArte, (arteL + arteR) / 2, yCentro,
                                  arteR - arteL, arteT - arteB, corCyan, "Arte");
        } else {
            var arteShapeCustom = groupArte.pathItems.rectangle(arteT, arteL, arteR - arteL, arteT - arteB);
            arteShapeCustom.filled = true; arteShapeCustom.stroked = false; arteShapeCustom.fillColor = corCyan;
            arteShapeCustom.name = "Arte";
        }
        xArteIni = arteL;
        xArteFim = arteR;
        yArteTopLocal = arteT;
        yArteBotLocal = arteB;
        arteLargVertMM   = aInfo.largura;
        arteLargHorizMM  = aInfo.tamanho;
        distFundoEfetivoMM = aFundo;
        selagemEfetivaMM   = compMM - FR_PE_MARGEM_FUNDO_MM - aFundo - aInfo.tamanho;
    } else if (queijoData && !queijoData.bordaCaida) {
        // Modo B/D: arte centrada no queijo
        var bbox = _queijoBBoxPEDeitado();
        var offPt = mm2pt(recuoMM);
        if (queijoData.redondo) {
            _fr_drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                                  bbox.right - bbox.left, bbox.top - bbox.bot,
                                  corMagenta, "Queijo");
            _fr_drawFilledEllipse(groupArte, bbox.cx, bbox.cy,
                                  bbox.right - bbox.left + 2 * offPt,
                                  bbox.top - bbox.bot + 2 * offPt,
                                  corCyan, "Arte");
        } else {
            _fr_drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
            var arteLq = bbox.left  - offPt;
            var arteRq = bbox.right + offPt;
            var arteBq = bbox.bot   - offPt;
            var arteTq = bbox.top   + offPt;
            var arteShapeQ = groupArte.pathItems.rectangle(arteTq, arteLq, arteRq - arteLq, arteTq - arteBq);
            arteShapeQ.filled = true; arteShapeQ.stroked = false; arteShapeQ.fillColor = corCyan;
            arteShapeQ.name = "Arte";
        }
        xArteIni = bbox.left  - offPt;
        xArteFim = bbox.right + offPt;
        yArteTopLocal = bbox.top + offPt;
        yArteBotLocal = bbox.bot - offPt;
        arteLargVertMM   = queijoData.larg + 2 * recuoMM;
        arteLargHorizMM  = queijoData.comp + 2 * recuoMM;
        distFundoEfetivoMM = queijoData.alt / 2 - recuoMM;
        selagemEfetivaMM   = compMM - FR_PE_MARGEM_FUNDO_MM - distFundoEfetivoMM - arteLargHorizMM;
    } else {
        // Modo A, C, E: arte com fundo arredondado (R_arte = R_eff − recuo)
        yArteTopLocal = yTopo - margemLat;
        yArteBotLocal = yBot + margemLat;
        if (fundoAEsquerda) {
            xArteIni = xLinhaMargemFundo + mm2pt(fundoMM);
            xArteFim = xMatFim - selagemPt;
        } else {
            xArteFim = xLinhaMargemFundo - mm2pt(fundoMM);
            xArteIni = xMatIni + selagemPt;
        }
        var R_arte = R_eff - recuoMM;
        _fr_drawPEArteDeitada(groupArte, xArteIni, xArteFim, yArteTopLocal, yArteBotLocal,
                              R_arte, fundoAEsquerda, corCyan);
        arteLargVertMM   = largMM - 2 * recuoMM;
        arteLargHorizMM  = compMM - selagemMM - FR_PE_MARGEM_FUNDO_MM - fundoMM;
        distFundoEfetivoMM = fundoMM;
        selagemEfetivaMM   = selagemMM;

        // Modo C/E: queijo tracejado sobre a arte
        if (queijoData && queijoData.bordaCaida) {
            var bbox3 = _queijoBBoxPEDeitado();
            if (queijoData.redondo) {
                _fr_drawDashedEllipse(groupCotas, bbox3.cx, bbox3.cy,
                                      bbox3.right - bbox3.left, bbox3.top - bbox3.bot,
                                      corMagenta, "Queijo");
            } else {
                _fr_drawDashedRect(groupCotas, bbox3.left, bbox3.right, bbox3.bot, bbox3.top, corMagenta, "Queijo");
            }
        }
    }

    // 2b. FOTOCÉLULA DEITADA (20 × 5 mm horizontal, somente FRENTE,
    //     5 mm da borda do topo reto + 5 mm acima do fundo da face)
    if (isFrente) {
        var fotoW = mm2pt(20), fotoH = mm2pt(5);
        // Topo reto fica à direita (frente) → foto à direita: 5 borda + 20 largura = 25 do xMatFim
        // Topo reto à esquerda (verso) → foto à esquerda: 5 do xMatIni
        var fotoLeft = fundoAEsquerda ? (xMatFim - mm2pt(25)) : (xMatIni + mm2pt(5));
        var fotoTop  = yBot + mm2pt(10);
        var fotocel = groupArte.pathItems.rectangle(fotoTop, fotoLeft, fotoW, fotoH);
        fotocel.filled = true; fotocel.stroked = false;
        fotocel.fillColor = corPreto;
        fotocel.name = "Fotocélula";
    }

    // 3. (sem simulação de solda no PE)

    // 4. COTAS HORIZONTAIS (acima do topo) — medidas do COMPRIMENTO
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);
    drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, _fr_fmt(compMM) + " mm", corCota);

    var _dfFontSize = (distFundoEfetivoMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;
    var _selFontSize = (selagemEfetivaMM < 15) ? 5 : 12;
    var _pe_temQueijoSemBorda = (queijoData && !queijoData.bordaCaida);

    if (fundoAEsquerda) {
        // VERSO: [margem][fundoMM][arte][selagemMM] — fundo à esquerda, selagem à direita
        if (!_pe_temQueijoSemBorda) {
            drawCotaH(groupCotas, xMatIni, xLinhaMargemFundo, yCota2,
                      _fr_fmt(FR_PE_MARGEM_FUNDO_MM) + " mm", corCota, 5);
        }
        if (distFundoEfetivoMM > 0.01) {
            var _xBaseDistFundo = _pe_temQueijoSemBorda ? xMatIni : xLinhaMargemFundo;
            drawCotaH(groupCotas, _xBaseDistFundo, xArteIni, yCota2,
                      _fr_fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
        }
        drawCotaH(groupCotas, xArteIni, xArteFim, yCota2, _fr_fmt2(arteLargHorizMM) + " mm", corCota);
        if (selagemEfetivaMM > 0.01) {
            drawCotaH(groupCotas, xArteFim, xMatFim, yCota2,
                      _fr_fmt2(selagemEfetivaMM) + " mm", corCota, _selFontSize);
        }
    } else {
        // FRENTE: [selagemMM][arte][fundoMM][margem] — selagem à esquerda, fundo à direita
        if (selagemEfetivaMM > 0.01) {
            drawCotaH(groupCotas, xMatIni, xArteIni, yCota2,
                      _fr_fmt2(selagemEfetivaMM) + " mm", corCota, _selFontSize);
        }
        drawCotaH(groupCotas, xArteIni, xArteFim, yCota2, _fr_fmt2(arteLargHorizMM) + " mm", corCota);
        if (distFundoEfetivoMM > 0.01) {
            var _xEndDistFundo = _pe_temQueijoSemBorda ? xMatFim : xLinhaMargemFundo;
            drawCotaH(groupCotas, xArteFim, _xEndDistFundo, yCota2,
                      _fr_fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
        }
        if (!_pe_temQueijoSemBorda) {
            drawCotaH(groupCotas, xLinhaMargemFundo, xMatFim, yCota2,
                      _fr_fmt(FR_PE_MARGEM_FUNDO_MM) + " mm", corCota, 5);
        }
    }

    // 5. COTAS VERTICAIS (medidas da LARGURA) — SEMPRE no lado EXTERNO (do topo reto)
    var xCotaV1, xCotaV2;
    if (fundoAEsquerda) {
        // Verso: cotas à DIREITA (lado externo)
        xCotaV1 = xMatFim + mm2pt(14);
        xCotaV2 = xMatFim + mm2pt(5);
    } else {
        // Frente: cotas à ESQUERDA (lado externo)
        xCotaV1 = xMatIni - mm2pt(14);
        xCotaV2 = xMatIni - mm2pt(5);
    }
    // textoDireita=true para o VERSO (cotas à direita, leitura top-down)
    _fr_drawCotaV(groupCotas, xCotaV1, yTopo, yBot,
                  _fr_fmt(largMM) + " mm", corCota, 12, false, fundoAEsquerda);

    var margemLateralMM = (largMM - arteLargVertMM) / 2;
    if (margemLateralMM > 0.01) {
        var _latFontSize2 = (margemLateralMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;
        _fr_drawCotaV(groupCotas, xCotaV2, yTopo, yArteTopLocal,
                      _fr_fmt2(margemLateralMM) + " mm", corCota, _latFontSize2, false, fundoAEsquerda);
        _fr_drawCotaV(groupCotas, xCotaV2, yArteTopLocal, yArteBotLocal,
                      _fr_fmt2(arteLargVertMM) + " mm", corCota, 12, false, fundoAEsquerda);
        _fr_drawCotaV(groupCotas, xCotaV2, yArteBotLocal, yBot,
                      _fr_fmt2(margemLateralMM) + " mm", corCota, _latFontSize2, false, fundoAEsquerda);
    } else {
        _fr_drawCotaV(groupCotas, xCotaV2, yArteTopLocal, yArteBotLocal,
                      _fr_fmt2(arteLargVertMM) + " mm", corCota, 12, false, fundoAEsquerda);
    }
}

// ============================================================
// ENTRY POINTS — FR clássico
// ============================================================
function _fr_gerarDuplo(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt   = mm2pt(largMM);
    var compPt   = mm2pt(compMM);
    var dTopoPt  = mm2pt(_fr_getDepthTopMM(largMM));
    var gapFaces = mm2pt(40);

    var err = _fr_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData);
    if (err) return jsonErr(err);

    var marginX = mm2pt(60), marginY = mm2pt(80);
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

    var topMaterial = layerV1.groupItems.add(); topMaterial.name = "Material";
    var topArte     = layerV1.groupItems.add(); topArte.name     = "Arte";
    var topCotas    = layerV1.groupItems.add(); topCotas.name    = "Cotas";

    // Verso: queijo SEM borda caída usa `recuoMM − 5` (semântica V2.0:
    // positivo expande, e o verso é -5 em relação à frente). Em borda
    // caída ou arte custom, usa o mesmo recuoMM da frente.
    var versoRecuoMM = (queijoData && !queijoData.bordaCaida) ? recuoMM - 5 : recuoMM;
    _fr_desenharFace(topMaterial, topArte, topCotas, x0, y0,
                     largMM, compMM, selagemMM, fundoMM, recuoMM, "Frente", queijoData, arteData);
    _fr_desenharFace(topMaterial, topArte, topCotas, x0 + largPt + gapFaces, y0,
                     largMM, compMM, selagemMM, fundoMM, versoRecuoMM, "Verso", queijoData, arteData);

    app.redraw();
    return jsonOk("Fundo Redondo gerado com sucesso!");
}

function _fr_gerarFrente(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt  = mm2pt(largMM);
    var compPt  = mm2pt(compMM);
    var dTopoPt = mm2pt(_fr_getDepthTopMM(largMM));

    var err = _fr_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData);
    if (err) return jsonErr(err);

    var marginX = mm2pt(60), marginY = mm2pt(80);
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
    return jsonOk("Fundo Redondo gerado com sucesso!");
}

// ============================================================
// ENTRY POINTS — Modo PE
// ============================================================
function _fr_gerarPE_Frente(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt = mm2pt(largMM);
    var compPt = mm2pt(compMM);

    var err = _fr_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData);
    if (err) return jsonErr(err);

    var marginX = mm2pt(60), marginY = mm2pt(80);
    var docW = largPt + marginX * 2;
    var docH = compPt + marginY * 2;

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;
    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - largPt) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - compPt) / 2;

    var topMaterial = layerV1.groupItems.add(); topMaterial.name = "Material";
    var topArte     = layerV1.groupItems.add(); topArte.name     = "Arte";
    var topCotas    = layerV1.groupItems.add(); topCotas.name    = "Cotas";

    _fr_desenharFacePE_EmPe(topMaterial, topArte, topCotas, x0, y0,
                            largMM, compMM, selagemMM, fundoMM, recuoMM,
                            "Frente", queijoData, arteData);

    app.redraw();
    return jsonOk("Fundo Redondo PE (somente frente, em pé) gerado com sucesso!");
}

function _fr_gerarPE_Duplo(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var compPt = mm2pt(compMM);
    var largPt = mm2pt(largMM);
    var gapPt  = mm2pt(FR_PE_GAP_DEITADO_MM);

    var err = _fr_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData);
    if (err) return jsonErr(err);

    var marginX = mm2pt(60), marginY = mm2pt(80);
    var totalW = compPt * 2 + gapPt;
    var totalH = largPt;
    var docW = totalW + marginX * 2;
    var docH = totalH + marginY * 2;

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;
    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - totalW) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalH) / 2;

    var topMaterial = layerV1.groupItems.add(); topMaterial.name = "Material";
    var topArte     = layerV1.groupItems.add(); topArte.name     = "Arte";
    var topCotas    = layerV1.groupItems.add(); topCotas.name    = "Cotas";

    // FRENTE à esquerda (topo reto à direita, fundo arredondado à esquerda)
    _fr_desenharFacePE_Deitada(topMaterial, topArte, topCotas, x0, y0,
                               largMM, compMM, selagemMM, fundoMM, recuoMM,
                               "Frente", queijoData, arteData, true);

    // VERSO à direita — queijo SEM borda caída usa `recuoMM − 5`
    var versoRecuoMM = (queijoData && !queijoData.bordaCaida) ? recuoMM - 5 : recuoMM;
    _fr_desenharFacePE_Deitada(topMaterial, topArte, topCotas, x0 + compPt + gapPt, y0,
                               largMM, compMM, selagemMM, fundoMM, versoRecuoMM,
                               "Verso", queijoData, arteData, false);

    // Cota TOTAL (frente + verso) acima das cotas individuais
    var corCotaTotal = cmyk(0, 0, 0, 60);
    var yCotaTotal = y0 + mm2pt(24);
    var totalCompMM = compMM * 2 + FR_PE_GAP_DEITADO_MM;
    drawCotaH(topCotas, x0, x0 + totalW, yCotaTotal, _fr_fmt(totalCompMM) + " mm", corCotaTotal);

    app.redraw();
    return jsonOk("Fundo Redondo PE (frente + verso, deitado) gerado com sucesso!");
}

// ==========================================
// ENTRADA PÚBLICA — chamada por client/js/main.js via evalScript
// Assinatura plana (23 args). A ordem segue `argOrder` em structures.js.
// ==========================================
function gerarFundoRedondo(
    compMM, largMM, selagemMM, somenteFrente, isPE,
    hasQueijo, queijoRedondo, queijoComp, queijoLarg, queijoDiam, queijoAlt, bordaCaida,
    recuoMM,
    hasArte, arteRedonda,
    arteTamF, arteLargF, arteDiamF, arteFundoF,
    arteTamV, arteLargV, arteDiamV, arteFundoV
) {
    try {
        // Normaliza flags para booleanos ExtendScript (ES3 — evalScript envia strings).
        somenteFrente = (somenteFrente === true || somenteFrente === "true");
        isPE          = (isPE          === true || isPE          === "true");
        hasQueijo     = (hasQueijo     === true || hasQueijo     === "true");
        queijoRedondo = (queijoRedondo === true || queijoRedondo === "true");
        bordaCaida    = (bordaCaida    === true || bordaCaida    === "true");
        hasArte       = (hasArte       === true || hasArte       === "true");
        arteRedonda   = (arteRedonda   === true || arteRedonda   === "true");

        // Exclusividade mútua (defensivo): queijo tem precedência sobre arte.
        if (hasQueijo) hasArte = false;

        // Constrói queijoData (Comp/Larg ou Diâmetro)
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

        // Constrói arteData (Tam/Larg ou Diâmetro, com subestrutura frente/verso)
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

        // Resolve parâmetros derivados (espelha a lógica do reference V2.0):
        //   - selagemMM: vem do usuário (default 45 quando inválido)
        //   - fundoMM:   10 (FR mode A) | 0 (PE) | 0 (queijo s/ borda) | 5 (queijo c/ borda)
        //   - recuoMM:   user input em queijo s/ borda; 5 nos demais modos
        if (isNaN(selagemMM)) selagemMM = 45;

        var fundoMM = isPE ? 0 : 10;
        var effectiveRecuoMM = recuoMM;
        if (hasQueijo) {
            fundoMM = bordaCaida ? 5 : 0;
            if (bordaCaida) effectiveRecuoMM = 5;
        }
        // Em modo A (sem queijo/arte), borda caída ou arte custom, o
        // "Deslocamento" do input não se aplica — arte usa recuo fixo de 5 mm
        // (respiro lateral mínimo da curva ou do arco PE).
        if (!hasQueijo || bordaCaida) {
            effectiveRecuoMM = 5;
        }

        if (isNaN(compMM) || isNaN(largMM) || isNaN(selagemMM) || isNaN(fundoMM) || isNaN(effectiveRecuoMM)) {
            return jsonErr("Digite valores válidos.");
        }

        // Roteamento: PE × FR, somente frente × frente+verso
        if (isPE) {
            if (somenteFrente) {
                return _fr_gerarPE_Frente(compMM, largMM, selagemMM, fundoMM, effectiveRecuoMM, queijoData, arteData);
            } else {
                return _fr_gerarPE_Duplo(compMM, largMM, selagemMM, fundoMM, effectiveRecuoMM, queijoData, arteData);
            }
        } else {
            if (somenteFrente) {
                return _fr_gerarFrente(compMM, largMM, selagemMM, fundoMM, effectiveRecuoMM, queijoData, arteData);
            } else {
                return _fr_gerarDuplo(compMM, largMM, selagemMM, fundoMM, effectiveRecuoMM, queijoData, arteData);
            }
        }
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
