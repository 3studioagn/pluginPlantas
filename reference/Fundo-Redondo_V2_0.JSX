// ==========================================
// SCRIPT: Fundo Redondo v3.2
// Gera planta de embalagem flexível com topo e fundo em curva, a partir de
// curvaturas Bezier extraídas do gabarito MÁXIMO (Modelo_Final.pdf, 460×370mm).
//
// FILOSOFIA DA CURVATURA: uma única CURVA MESTRE em mm absolutos cobre o
// tamanho máximo (370mm × 460mm). Para peças menores, a curva é APARADA —
// pega-se o recorte central de largura W dos 370mm da curva mestre. Os
// cantos da peça menor pousam EM CIMA da curva mestre, não na borda dela.
//
// Consequências:
//   - Peça 370×460: enxerga a curva INTEIRA (prof ~54mm)
//   - Peça 160×260: enxerga apenas os 160mm centrais (prof aparente ~11mm)
//   - Peça 120×170: enxerga apenas os 120mm centrais (prof aparente ~6mm)
//   - Peça 50×100: enxerga apenas os 50mm centrais (prof aparente ~1mm)
//
// Interpretação de parâmetros:
//   Comprimento = distância entre o PONTO MAIS BAIXO DO TOPO (vale superior)
//                 e o PONTO MAIS BAIXO DO FUNDO (vale inferior).
//   Distância de Fundo = da LINHA SUPERIOR DA SOLDA até o início da ARTE.
// ==========================================

function mm2pt(mm) { return mm * 2.83465; }
function pt2mm(pt) { return pt / 2.83465; }

// Formata número como string com vírgula decimal (padrão BR)
function fmt(n) { return String(n).replace('.', ','); }

// Formata número com até 2 casas decimais e vírgula (para cotas calculadas).
// Se o número for inteiro (ex.: 210), retorna "210" (sem vírgula nem zeros).
// Se tiver decimais significativos (ex.: 198.98), retorna "198,98".
function fmt2(n) {
    var r = Math.round(n * 100) / 100;
    // Inteiro: sem vírgula
    if (r === Math.round(r)) return String(Math.round(r));
    // Decimal: 2 casas com vírgula
    var s = String(r);
    var parts = s.split('.');
    if (parts[1].length === 1) parts[1] += '0';
    return parts.join(',');
}

// Parse do deslocamento da arte:
//   "5"    → +5 mm  (arte 5mm MAIOR que o queijo, por lado)
//   "-5"   → -5 mm  (arte 5mm MENOR que o queijo, por lado)
//   "0"    → arte do tamanho exato do queijo
//   "+10"  → +10 mm (prefixo "+" opcional em positivos)
// Aceita vírgula como decimal e espaço entre sinal e número.
function _parseDeslo(txt) {
    var t = String(txt).replace(',', '.').replace(/\s+/g, '');
    if (t.charAt(0) === '+') t = t.substring(1);
    return parseFloat(t);
}

function cmyk(c, m, y, k) {
    var col = new CMYKColor();
    col.cyan = c; col.magenta = m; col.yellow = y; col.black = k;
    return col;
}

// Encontra Arial Bold iterando pelos fontes disponíveis
var _arialBold = null;
function getArialBold() {
    if (_arialBold) return _arialBold;
    var fonts = app.textFonts;
    for (var i = 0; i < fonts.length; i++) {
        var f = fonts[i];
        if (f.family === "Arial" && f.style === "Bold") {
            _arialBold = f;
            return f;
        }
    }
    return null;
}

function applyArialBold(t) {
    var f = getArialBold();
    if (f) try { t.textRange.characterAttributes.textFont = f; } catch(e) {}
}

// ============================================================
// CURVA MESTRE (extraída de Modelo_Final.pdf, peça máxima 460×370mm)
// Coordenadas em mm ABSOLUTOS com origem no canto superior/inferior esquerdo.
// Percorrida da ESQUERDA para a DIREITA em ambos os casos.
// Curvas agora são SIMÉTRICAS (pontas esq e dir batem nos extremos x=0 e x=370).
//   x: 0 (esquerda) a 370 (direita) em mm
//   y: profundidade em mm abaixo da linha dos cantos (positivo = mais fundo)
// ============================================================
var MASTER_W_MM = 370.00;

// Curva MESTRE do TOPO (2 segmentos Bezier, simétricos)
// y=0 quando a curva toca a linha dos cantos superiores
var MASTER_TOP_CURVE_MM = [
    [[  0.000,  0.000], [ 66.658, 35.905], [125.278, 53.702], [184.876, 53.295]],
    [[185.124, 53.295], [244.721, 53.702], [303.341, 35.905], [370.000,  0.000]]
];

// Curva MESTRE do FUNDO (4 segmentos Bezier, simétricos)
// y=0 quando a curva toca a linha dos cantos inferiores
var MASTER_BOTTOM_CURVE_MM = [
    [[  0.000,  0.000], [ 58.916, 31.839], [111.367, 49.121], [166.654, 53.532]],
    [[166.654, 53.532], [172.685, 53.904], [178.801, 54.062], [185.000, 54.015]],
    [[185.000, 54.015], [191.198, 54.062], [197.314, 53.904], [203.346, 53.532]],
    [[203.346, 53.532], [258.632, 49.121], [311.084, 31.839], [370.000,  0.000]]
];

// Limites do gabarito (maior peça possível)
var MAX_W_MM = 370.0;
var MAX_C_MM = 460.0;  // comprimento máximo (vale-a-vale)

// ============================================================
// CONSTANTES DO MODO PE (Pouch Envelope)
// ------------------------------------------------------------
// No PE o contorno do material é diferente do Fundo Redondo:
//   - TOPO: linha reta (sem curva)
//   - LATERAIS: linhas retas
//   - FUNDO: dois cantos arredondados com raio fixo PE_RADIUS_MM,
//            conectados por um trecho reto horizontal
//
// Em modo "Somente frente" a peça é desenhada EM PÉ (vertical).
// Em modo Frente+Verso a peça é desenhada DEITADA: duas faces
// ESPELHADAS lado a lado, com os FUNDOS ARREDONDADOS voltados
// para o CENTRO (encostando-se perto do × de registro) e os
// TOPOS RETOS nas extremidades EXTERNAS do layout.
//   FRENTE (bloco esquerdo) → fundo à DIREITA, topo à ESQUERDA
//   VERSO  (bloco direito)  → fundo à ESQUERDA, topo à DIREITA
//
// Não há simulação das linhas de solda no PE — os 10mm do
// "fundo" são apenas uma reserva geométrica respeitada pela arte.
// ============================================================
var PE_RADIUS_MM = 48.5;
// Kappa = 4*(sqrt(2)-1)/3 — coeficiente padrão para aproximar
// um arco de 90° por uma curva Bezier cúbica. Distância de cada
// endpoint do arco até seu control point = kappa * raio.
var _KAPPA = 0.5522847498;
// Gap entre frente e verso no layout DEITADO. Zero = os trechos retos dos
// fundos arredondados se encostam no centro do layout, deixando o × bem na
// junção entre as duas peças.
var PE_GAP_DEITADO_MM = 0;
// Distância MÍNIMA entre o vale do fundo arredondado e o início da arte.
// Antes era 10mm (herança do FR com solda 5+5); no PE não há solda, então
// a arte pode se aproximar até 5mm do contorno do material.
var PE_MARGEM_FUNDO_MM = 5;

// Densidade de amostragem da curva mestre (mais = mais suave e preciso)
var BEZIER_SEGMENTS = 80;

// Caches (calculados uma vez)
var _topSamples = null;
var _botSamples = null;
var _maxTopMM = null;
var _maxBotMM = null;

function _getTopSamples() {
    if (_topSamples === null) {
        _topSamples = bezierChainPoints(MASTER_TOP_CURVE_MM, BEZIER_SEGMENTS);
    }
    return _topSamples;
}
function _getBotSamples() {
    if (_botSamples === null) {
        _botSamples = bezierChainPoints(MASTER_BOTTOM_CURVE_MM, BEZIER_SEGMENTS);
    }
    return _botSamples;
}

function _computeMax(samples) {
    var m = 0;
    for (var i = 0; i < samples.length; i++) {
        if (samples[i][1] > m) m = samples[i][1];
    }
    return m;
}
function _getMaxTopMM() {
    if (_maxTopMM === null) _maxTopMM = _computeMax(_getTopSamples());
    return _maxTopMM;
}
function _getMaxBotMM() {
    if (_maxBotMM === null) _maxBotMM = _computeMax(_getBotSamples());
    return _maxBotMM;
}

// Interpolação linear em amostras ordenadas por x (ascendente)
function _interpY(samples, xTarget) {
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
function getDepthTopMM(widthMM) {
    if (widthMM > MASTER_W_MM) widthMM = MASTER_W_MM;
    var xL = (MASTER_W_MM - widthMM) / 2;
    var xR = (MASTER_W_MM + widthMM) / 2;
    var cornerY = (_interpY(_getTopSamples(), xL) + _interpY(_getTopSamples(), xR)) / 2;
    return _getMaxTopMM() - cornerY;
}
function getDepthBotMM(widthMM) {
    if (widthMM > MASTER_W_MM) widthMM = MASTER_W_MM;
    var xL = (MASTER_W_MM - widthMM) / 2;
    var xR = (MASTER_W_MM + widthMM) / 2;
    var cornerY = (_interpY(_getBotSamples(), xL) + _interpY(_getBotSamples(), xR)) / 2;
    return _getMaxBotMM() - cornerY;
}

// Quantos sub-pontos por segmento Bezier (maior = mais suave)
var BEZIER_SEGMENTS = 40;

// --- FUNÇÕES DE DESENHO BÁSICAS ---
function drawRect(layer, top, left, w, h, color) {
    var rect = layer.pathItems.rectangle(top, left, w, h);
    rect.filled = true; rect.stroked = false; rect.fillColor = color;
    return rect;
}

function drawLine(layer, x1, y1, x2, y2, color, strokeW, dashed) {
    var line = layer.pathItems.add();
    line.setEntirePath([[x1, y1], [x2, y2]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;
    if (dashed) line.strokeDashes = [5, 5];
    return line;
}

function drawPolyline(layer, pts, color, dashed) {
    var line = layer.pathItems.add();
    line.setEntirePath(pts);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;
    line.closed = false;
    if (dashed) line.strokeDashes = [5, 5];
    return line;
}

// --- FUNÇÕES BEZIER / GEOMETRIA DO POUCH ---
// Avalia um ponto de uma curva Bezier cúbica em t ∈ [0, 1]
function bezierAt(p0, cp1, cp2, p3, t) {
    var u = 1 - t;
    var x = u*u*u*p0[0] + 3*u*u*t*cp1[0] + 3*u*t*t*cp2[0] + t*t*t*p3[0];
    var y = u*u*u*p0[1] + 3*u*u*t*cp1[1] + 3*u*t*t*cp2[1] + t*t*t*p3[1];
    return [x, y];
}

// Gera pontos de uma sequência de curvas Bezier.
// Cada segmento é [P0, CP1, CP2, P3] em coordenadas normalizadas.
// O ponto final de um segmento coincide com o inicial do próximo — por isso
// pulamos o índice 0 a partir do segundo segmento, evitando duplicatas.
function bezierChainPoints(curves, segments) {
    var pts = [];
    for (var i = 0; i < curves.length; i++) {
        var seg = curves[i];
        var start = (i === 0) ? 0 : 1;
        for (var j = start; j <= segments; j++) {
            var t = j / segments;
            pts.push(bezierAt(seg[0], seg[1], seg[2], seg[3], t));
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
function _lerp(a, b, t) {
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

// Avalia a coord X de uma Bezier cúbica em t
function _bezXAt(seg, t) {
    var u = 1 - t, u2 = u * u, t2 = t * t;
    return u2 * u * seg[0][0] + 3 * u2 * t * seg[1][0] + 3 * u * t2 * seg[2][0] + t2 * t * seg[3][0];
}

// Subdivisão De Casteljau: retorna [parte_esquerda, parte_direita]
function _subdivBez(seg, t) {
    var p0 = seg[0], p1 = seg[1], p2 = seg[2], p3 = seg[3];
    var q0 = _lerp(p0, p1, t);
    var q1 = _lerp(p1, p2, t);
    var q2 = _lerp(p2, p3, t);
    var r0 = _lerp(q0, q1, t);
    var r1 = _lerp(q1, q2, t);
    var s  = _lerp(r0, r1, t);
    return [[p0, q0, r0, s], [s, r1, q2, p3]];
}

// Encontra t tal que x(t) = targetX (busca binária; assume x monotônico)
function _findTForX(seg, targetX) {
    if (targetX <= seg[0][0]) return 0;
    if (targetX >= seg[3][0]) return 1;
    var lo = 0, hi = 1;
    for (var i = 0; i < 60; i++) {
        var mid = (lo + hi) / 2;
        var x = _bezXAt(seg, mid);
        if (Math.abs(x - targetX) < 1e-6) return mid;
        if (x < targetX) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

// Apara uma cadeia de segmentos Bezier ao intervalo x=[xL, xR]. Retorna
// nova cadeia de segmentos cobrindo exatamente esse intervalo.
function _trimBezChain(masterSegs, xL_mm, xR_mm) {
    var out = [];
    for (var i = 0; i < masterSegs.length; i++) {
        var seg = masterSegs[i];
        var sX0 = seg[0][0], sX3 = seg[3][0];
        if (sX3 <= xL_mm + 1e-6 || sX0 >= xR_mm - 1e-6) continue;

        var cur = seg;
        if (sX0 < xL_mm) {
            cur = _subdivBez(cur, _findTForX(cur, xL_mm))[1];
        }
        if (cur[3][0] > xR_mm) {
            cur = _subdivBez(cur, _findTForX(cur, xR_mm))[0];
        }
        out.push(cur);
    }
    return out;
}

// Inverte um segmento Bezier (troca direção da curva)
function _revBez(seg) { return [seg[3], seg[2], seg[1], seg[0]]; }

// Inverte a ordem de uma cadeia de segmentos Bezier (e inverte cada um)
function _revBezChain(segs) {
    var out = [];
    for (var i = segs.length - 1; i >= 0; i--) out.push(_revBez(segs[i]));
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
function _transformSegsToPt(segs, xStartPt, masterOriginXMM, yBase, cornerY, offsetSignedPt) {
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
// closed: se true, não fecha os endpoints com leftDir/rightDir internos
//         (usado quando o path continua com outra cadeia de segmentos);
//         se false (cadeia aberta), endpoints têm dir=anchor (sem tangente).
// continuesFrom: se true, o primeiro ponto tem leftDir = cp2 do último seg
//                anterior (permitindo que duas cadeias se conectem com tangente).
//                Normalmente false para material/arte (cantos são corners).
function _addBezSegsToPath(pathItem, segsPt) {
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
// Usa os segmentos Bezier diretamente como nós do path.
function drawBezierOpen(layer, segsPt, strokeColor, dashed) {
    var p = layer.pathItems.add();
    _addBezSegsToPath(p, segsPt);
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
function drawMaterial(layer, xL, yTop, Wmm, Cmm, color) {
    if (Wmm > MASTER_W_MM) Wmm = MASTER_W_MM;
    var Cpt = mm2pt(Cmm);
    var dTopoPt  = mm2pt(getDepthTopMM(Wmm));
    var dFundoPt = mm2pt(getDepthBotMM(Wmm));

    var yTopoCentro   = yTop - dTopoPt;
    var yFundoExtremo = yTopoCentro - Cpt;
    var yCantosFundo  = yFundoExtremo + dFundoPt;

    var masterXL = (MASTER_W_MM - Wmm) / 2;
    var masterXR = (MASTER_W_MM + Wmm) / 2;

    var topCornerY = (_interpY(_getTopSamples(), masterXL) + _interpY(_getTopSamples(), masterXR)) / 2;
    var botCornerY = (_interpY(_getBotSamples(), masterXL) + _interpY(_getBotSamples(), masterXR)) / 2;

    var topSegsMM = _trimBezChain(MASTER_TOP_CURVE_MM,    masterXL, masterXR);
    var botSegsMM = _trimBezChain(MASTER_BOTTOM_CURVE_MM, masterXL, masterXR);

    var topSegsPt = _transformSegsToPt(topSegsMM, xL, masterXL, yTop,          topCornerY, 0);
    var botSegsPt = _transformSegsToPt(botSegsMM, xL, masterXL, yCantosFundo,  botCornerY, 0);
    var botSegsPtRL = _revBezChain(botSegsPt);

    var p = layer.pathItems.add();
    _addBezSegsToPath(p, topSegsPt);
    _addBezSegsToPath(p, botSegsPtRL);
    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Material";
    return p;
}

// ============================================================
// FUNÇÕES DE DESENHO DO MODO PE (Pouch Envelope)
// Todas as funções recebem coordenadas Illustrator em pontos.
// Raio do canto inferior é adaptado se R > min(W, C)/2 via clamp.
// ============================================================

// Raio efetivo em mm (clamp). Se a peça for pequena demais, reduz R
// para que os 2 arcos não se sobreponham e caibam na altura.
function _peRadiusEffMM(Wmm, Cmm) {
    var r = PE_RADIUS_MM;
    if (r > Wmm / 2) r = Wmm / 2;
    if (r > Cmm)     r = Cmm;
    return r;
}

// Desenha o MATERIAL do PE em orientação EM PÉ:
//   Topo reto (horizontal) em yTop, fundo em yBot = yTop - Cpt,
//   lateral esquerda em xL, direita em xR = xL + Wpt.
//   Cantos inferiores arredondados com raio R_eff.
function drawPEMaterialEmPe(layer, xL, yTop, Wmm, Cmm, color) {
    var Wpt = mm2pt(Wmm);
    var Cpt = mm2pt(Cmm);
    var R_eff = _peRadiusEffMM(Wmm, Cmm);
    var Rpt = mm2pt(R_eff);
    var kR = _KAPPA * Rpt;

    var xR = xL + Wpt;
    var yBot = yTop - Cpt;

    var p = layer.pathItems.add();
    function addPt(anchor, lDir, rDir) {
        var pp = p.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
    }

    // Percurso (sentido horário a partir do canto superior-esquerdo):
    // 1) canto sup-esq reto    2) canto sup-dir reto
    // 3) início do arco inf-dir (no lado direito, em yBot+R)
    // 4) fim do arco inf-dir (no fundo reto, em xR-R)
    // 5) início do arco inf-esq (no fundo reto, em xL+R)
    // 6) fim do arco inf-esq (no lado esquerdo, em yBot+R)
    addPt([xL, yTop],           [xL, yTop],           [xL, yTop]);
    addPt([xR, yTop],           [xR, yTop],           [xR, yTop]);
    addPt([xR, yBot + Rpt],     [xR, yBot + Rpt],     [xR, yBot + Rpt - kR]);
    addPt([xR - Rpt, yBot],     [xR - Rpt + kR, yBot],[xR - Rpt, yBot]);
    addPt([xL + Rpt, yBot],     [xL + Rpt, yBot],     [xL + Rpt - kR, yBot]);
    addPt([xL, yBot + Rpt],     [xL, yBot + Rpt - kR],[xL, yBot + Rpt]);

    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Material";
    return p;
}

// Desenha o MATERIAL do PE em orientação DEITADA (frente ou verso).
//   No deitado, Cmm vai na horizontal (comprimento original) e Wmm
//   na vertical (largura original). isFrente = true → topo reto à
//   DIREITA (face fica à esquerda do layout, fundo arredondado à esquerda).
//   isFrente = false (verso) → topo reto à ESQUERDA, fundo arredondado à direita.
function drawPEMaterialDeitado(layer, xStart, yTop, Cmm, Wmm, isFrente, color) {
    var Cpt = mm2pt(Cmm);
    var Wpt = mm2pt(Wmm);
    var R_eff = _peRadiusEffMM(Wmm, Cmm);
    var Rpt = mm2pt(R_eff);
    var kR = _KAPPA * Rpt;

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
        // FRENTE DEITADA: fundo arredondado à ESQUERDA, topo reto à DIREITA
        // Percurso horário começando no canto sup-esq arredondado:
        //   (xStart, yTop-R) → arco sup-esq → (xStart+R, yTop)
        //   → topo → (xEnd, yTop) → lateral direita (topo reto) → (xEnd, yBot)
        //   → fundo → (xStart+R, yBot) → arco inf-esq → (xStart, yBot+R)
        //   → lateral esquerda (fundo original arredondado via linha reta entre arcos) → fecha
        addPt([xStart, yTop - Rpt],  [xStart, yTop - Rpt],       [xStart, yTop - Rpt + kR]);
        addPt([xStart + Rpt, yTop],  [xStart + Rpt - kR, yTop],  [xStart + Rpt, yTop]);
        addPt([xEnd, yTop],          [xEnd, yTop],               [xEnd, yTop]);
        addPt([xEnd, yBot],          [xEnd, yBot],               [xEnd, yBot]);
        addPt([xStart + Rpt, yBot],  [xStart + Rpt, yBot],       [xStart + Rpt - kR, yBot]);
        addPt([xStart, yBot + Rpt],  [xStart, yBot + Rpt - kR],  [xStart, yBot + Rpt]);
    } else {
        // VERSO DEITADO: topo reto à ESQUERDA, fundo arredondado à DIREITA
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

// Desenha LINHA DE SOLDA do PE (tracejada, aberta), paralela ao contorno
// do fundo, recuada `offsetMM` para dentro.
//
// No PE EM PÉ: linha vai da lateral esquerda à direita, com arcos de raio
// R_eff - offsetMM nos cantos inferiores e trecho reto horizontal no meio.
function drawPESoldaEmPe(layer, xL, xR, yBot, R_effmm, offsetMM, color) {
    var Rpt  = mm2pt(R_effmm);
    var R2pt = mm2pt(R_effmm - offsetMM);
    var offPt = mm2pt(offsetMM);
    var kR2 = _KAPPA * R2pt;

    var xCL = xL + Rpt;   // centro X do canto inferior-esquerdo
    var xCR = xR - Rpt;   // centro X do canto inferior-direito
    var yC  = yBot + Rpt; // centro Y de ambos os cantos

    var p = layer.pathItems.add();
    function addPt(anchor, lDir, rDir) {
        var pp = p.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
    }

    // A. Início na lateral esquerda (xL + offPt, yC)
    // B. Topo do arco esquerdo (xCL, yBot + offPt)
    // C. Topo do arco direito (xCR, yBot + offPt) — ligado a B por reta
    // D. Fim na lateral direita (xR - offPt, yC)
    addPt([xL + offPt, yC],      [xL + offPt, yC],        [xL + offPt, yC - kR2]);
    addPt([xCL, yBot + offPt],   [xCL - kR2, yBot + offPt], [xCL, yBot + offPt]);
    addPt([xCR, yBot + offPt],   [xCR, yBot + offPt],     [xCR + kR2, yBot + offPt]);
    addPt([xR - offPt, yC],      [xR - offPt, yC - kR2],  [xR - offPt, yC]);

    p.closed = false;
    p.filled = false;
    p.stroked = true;
    p.strokeColor = color;
    p.strokeWidth = 1;
    p.strokeDashes = [5, 5];
    return p;
}

// Desenha LINHA DE SOLDA do PE DEITADO (frente ou verso).
// No deitado, a "solda" fica do lado do FUNDO arredondado.
//   isFrente = true  → arcos à esquerda (xStart); linha sai do topo e fundo
//   isFrente = false → arcos à direita  (xEnd);   linha sai do topo e fundo
function drawPESoldaDeitado(layer, xStart, yTop, Cmm, Wmm, R_effmm, offsetMM, isFrente, color) {
    var Cpt = mm2pt(Cmm);
    var Wpt = mm2pt(Wmm);
    var Rpt  = mm2pt(R_effmm);
    var R2pt = mm2pt(R_effmm - offsetMM);
    var offPt = mm2pt(offsetMM);
    var kR2 = _KAPPA * R2pt;

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
        // Arcos à esquerda (xStart). Linha vai do lado superior (topo da face)
        // ao lado inferior (fundo da face), passando pelos 2 arcos + reta.
        // Centros dos arcos:
        //   canto sup-esq: (xStart + Rpt, yTop - Rpt)
        //   canto inf-esq: (xStart + Rpt, yBot + Rpt)
        // A. Topo da face, perto do arco sup-esq: (xStart + offPt, yTop - Rpt) — wait
        // Melhor pensar: a solda é recuo do contorno. Os pontos onde a linha
        // encosta nas laterais retas (topo e fundo da face deitada):
        //   topo: (xStart + Rpt, yTop - offPt)  ← reta paralela ao topo
        //   fundo: (xStart + Rpt, yBot + offPt)
        // E o ponto extremo à esquerda (no "vale" do arredondamento):
        //   (xStart + offPt, (yTop + yBot)/2)  quando deitado,
        //   mas na verdade é (xStart + offPt, yTop - Rpt) e (xStart + offPt, yBot + Rpt)
        //   ligados por reta vertical entre eles.
        //
        // Percurso da linha:
        //   A. (xStart + Rpt, yTop - offPt)  ← encontro com topo reto
        //   B. arco sup-esq (R - off) → (xStart + offPt, yTop - Rpt)
        //   C. reta vertical → (xStart + offPt, yBot + Rpt)
        //   D. arco inf-esq (R - off) → (xStart + Rpt, yBot + offPt)
        //   E. ponto final
        var xCsup = xStart + Rpt;
        var yCsup = yTop - Rpt;
        var xCinf = xStart + Rpt;
        var yCinf = yBot + Rpt;
        addPt([xStart + Rpt, yTop - offPt],  [xStart + Rpt, yTop - offPt],       [xStart + Rpt - kR2, yTop - offPt]);
        addPt([xStart + offPt, yTop - Rpt],  [xStart + offPt, yTop - Rpt + kR2], [xStart + offPt, yTop - Rpt]);
        addPt([xStart + offPt, yBot + Rpt],  [xStart + offPt, yBot + Rpt],       [xStart + offPt, yBot + Rpt - kR2]);
        addPt([xStart + Rpt, yBot + offPt],  [xStart + Rpt - kR2, yBot + offPt], [xStart + Rpt, yBot + offPt]);
    } else {
        // Arcos à direita (xEnd)
        addPt([xEnd - Rpt, yTop - offPt],    [xEnd - Rpt, yTop - offPt],        [xEnd - Rpt + kR2, yTop - offPt]);
        addPt([xEnd - offPt, yTop - Rpt],    [xEnd - offPt, yTop - Rpt + kR2],  [xEnd - offPt, yTop - Rpt]);
        addPt([xEnd - offPt, yBot + Rpt],    [xEnd - offPt, yBot + Rpt],        [xEnd - offPt, yBot + Rpt - kR2]);
        addPt([xEnd - Rpt, yBot + offPt],    [xEnd - Rpt + kR2, yBot + offPt],  [xEnd - Rpt, yBot + offPt]);
    }

    p.closed = false;
    p.filled = false;
    p.stroked = true;
    p.strokeColor = color;
    p.strokeWidth = 1;
    p.strokeDashes = [5, 5];
    return p;
}

// Desenha a ARTE do PE com fundo arredondado (modo A e modos C/E com
// borda caída). Topo reto em yArteTop, fundo reto em yArteBot (trecho reto
// central do fundo da arte), cantos inferiores com raio R_artemm (que é
// tipicamente R_material - recuoLateralMM).
// PE EM PÉ.
function drawPEArteEmPe(layer, xArteL, xArteR, yArteTop, yArteBot, R_artemm, color) {
    var R2mm = R_artemm;
    if (R2mm < 0) R2mm = 0;
    // Clamp para caber na arte
    var halfWmm = pt2mm(xArteR - xArteL) / 2;
    var heightmm = pt2mm(yArteTop - yArteBot);
    if (R2mm > halfWmm) R2mm = halfWmm;
    if (R2mm > heightmm) R2mm = heightmm;

    var R2pt = mm2pt(R2mm);
    var kR2 = _KAPPA * R2pt;

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

    addPt([xArteL, yArteTop], [xArteL, yArteTop],   [xArteL, yArteTop]);
    addPt([xArteR, yArteTop], [xArteR, yArteTop],   [xArteR, yArteTop]);
    addPt([xArteR, yC],       [xArteR, yC],         [xArteR, yC - kR2]);
    addPt([xCR, yArteBot],    [xCR + kR2, yArteBot],[xCR, yArteBot]);
    addPt([xCL, yArteBot],    [xCL, yArteBot],      [xCL - kR2, yArteBot]);
    addPt([xArteL, yC],       [xArteL, yC - kR2],   [xArteL, yC]);

    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Arte";
    return p;
}

// Desenha a ARTE do PE DEITADA com fundo arredondado (modo A e modos C/E).
// xArteIni = x esquerdo da arte, xArteFim = x direito. yArteTop/yArteBot
// definem a caixa vertical. R_artemm é o raio dos 2 cantos que ficam do
// lado do FUNDO arredondado.
// isFrente = true → fundo arredondado à ESQUERDA (arcos em xArteIni)
// isFrente = false → fundo arredondado à DIREITA (arcos em xArteFim)
function drawPEArteDeitada(layer, xArteIni, xArteFim, yArteTop, yArteBot, R_artemm, isFrente, color) {
    var R2mm = R_artemm;
    if (R2mm < 0) R2mm = 0;
    var widthmm = pt2mm(xArteFim - xArteIni);
    var halfHmm = pt2mm(yArteTop - yArteBot) / 2;
    if (R2mm > widthmm) R2mm = widthmm;
    if (R2mm > halfHmm) R2mm = halfHmm;

    var R2pt = mm2pt(R2mm);
    var kR2 = _KAPPA * R2pt;

    var p = layer.pathItems.add();
    function addPt(anchor, lDir, rDir) {
        var pp = p.pathPoints.add();
        pp.anchor = anchor;
        pp.leftDirection = lDir;
        pp.rightDirection = rDir;
    }

    if (isFrente) {
        // Fundo arredondado à ESQUERDA (xArteIni) — 2 arcos em (xArteIni + R2pt, yArteTop - R2pt) e (xArteIni + R2pt, yArteBot + R2pt)
        addPt([xArteIni, yArteTop - R2pt],          [xArteIni, yArteTop - R2pt],                [xArteIni, yArteTop - R2pt + kR2]);
        addPt([xArteIni + R2pt, yArteTop],          [xArteIni + R2pt - kR2, yArteTop],          [xArteIni + R2pt, yArteTop]);
        addPt([xArteFim, yArteTop],                 [xArteFim, yArteTop],                       [xArteFim, yArteTop]);
        addPt([xArteFim, yArteBot],                 [xArteFim, yArteBot],                       [xArteFim, yArteBot]);
        addPt([xArteIni + R2pt, yArteBot],          [xArteIni + R2pt, yArteBot],                [xArteIni + R2pt - kR2, yArteBot]);
        addPt([xArteIni, yArteBot + R2pt],          [xArteIni, yArteBot + R2pt - kR2],          [xArteIni, yArteBot + R2pt]);
    } else {
        addPt([xArteIni, yArteTop],                 [xArteIni, yArteTop],                       [xArteIni, yArteTop]);
        addPt([xArteFim - R2pt, yArteTop],          [xArteFim - R2pt, yArteTop],                [xArteFim - R2pt + kR2, yArteTop]);
        addPt([xArteFim, yArteTop - R2pt],          [xArteFim, yArteTop - R2pt + kR2],          [xArteFim, yArteTop - R2pt]);
        addPt([xArteFim, yArteBot + R2pt],          [xArteFim, yArteBot + R2pt],                [xArteFim, yArteBot + R2pt - kR2]);
        addPt([xArteFim - R2pt, yArteBot],          [xArteFim - R2pt + kR2, yArteBot],          [xArteFim - R2pt, yArteBot]);
        addPt([xArteIni, yArteBot],                 [xArteIni, yArteBot],                       [xArteIni, yArteBot]);
    }

    p.closed = true;
    p.filled = true; p.stroked = false;
    p.fillColor = color;
    p.name = "Arte";
    return p;
}

// Desenha um "×" pequeno (cruz diagonal) centrado em (cx, cy), usado como
// marca de registro entre frente e verso no PE DEITADO.
function drawCentroX(layer, cx, cy, sizeMM, color) {
    var s = mm2pt(sizeMM) / 2;
    var g = layer.groupItems.add();
    g.name = "RegistroCentro";
    var l1 = g.pathItems.add();
    l1.setEntirePath([[cx - s, cy - s], [cx + s, cy + s]]);
    l1.filled = false; l1.stroked = true;
    l1.strokeColor = color; l1.strokeWidth = 1;
    var l2 = g.pathItems.add();
    l2.setEntirePath([[cx - s, cy + s], [cx + s, cy - s]]);
    l2.filled = false; l2.stroked = true;
    l2.strokeColor = color; l2.strokeWidth = 1;
    return g;
}

// --- FUNÇÕES DE COTAS ---
function drawCotaH(layer, x1, x2, y, textStr, color, fontSize, verticalLabel) {
    if (fontSize === undefined) fontSize = 12;
    var tickH = mm2pt(1);
    var group = layer.groupItems.add();

    var line = group.pathItems.add();
    line.setEntirePath([[x1, y], [x2, y]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;

    var b1 = group.pathItems.add();
    b1.setEntirePath([[x1, y + tickH], [x1, y - tickH]]);
    b1.filled = false; b1.stroked = true;
    b1.strokeColor = color; b1.strokeWidth = 1;

    var b2 = group.pathItems.add();
    b2.setEntirePath([[x2, y + tickH], [x2, y - tickH]]);
    b2.filled = false; b2.stroked = true;
    b2.strokeColor = color; b2.strokeWidth = 1;

    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.top  = y + mm2pt(2) + t.height;
        t.left = x1 + ((x2 - x1) / 2) - (t.width / 2);
    }

    if (verticalLabel !== undefined && verticalLabel !== "") {
        var vt = group.textFrames.add();
        vt.contents = verticalLabel;
        vt.textRange.characterAttributes.size = fontSize;
        applyArialBold(vt);
        try { vt.textRange.characterAttributes.fillColor = color; } catch(e) {}
        vt.rotate(90);
        vt.top  = y + mm2pt(5) + vt.height;
        vt.left = x1 + ((x2 - x1) / 2) - (vt.width / 2);
    }
}

function drawCotaV(layer, x, y1, y2, textStr, color, fontSize, centered, textoDireita) {
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
        // textoDireita = true → texto do lado direito da linha E rotacionado -90°
        // (leitura top-down, espelhada em 180° em relação ao padrão bottom-up).
        // Usado no VERSO do PE deitado.
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

function addText(layer, txt, x, y, size, color, rot) {
    var t = layer.textFrames.add();
    t.contents = txt;
    t.textRange.characterAttributes.size = size;
    applyArialBold(t);
    try { t.textRange.characterAttributes.fillColor = color; } catch (e) {}
    if (rot) {
        t.rotate(rot);
        t.top  = y + t.height;
        t.left = x - (t.width / 2);
    } else {
        t.top  = y + (t.height / 2);
        t.left = x - (t.width  / 2);
    }
}

// --- INTERFACE ---
var dlg = new Window("dialog", "Gerador: Fundo Redondo v3.2");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group"); g1.add("statictext", undefined, "Comprimento (mm):");
var inputComp = g1.add("edittext", undefined, "260"); inputComp.characters = 5;

var g2 = dlg.add("group"); g2.add("statictext", undefined, "Largura (mm):");
var inputLarg = g2.add("edittext", undefined, "160"); inputLarg.characters = 5;

var gSel = dlg.add("group"); gSel.add("statictext", undefined, "Área de Selagem (mm):");
var inputSelagem = gSel.add("edittext", undefined, "45"); inputSelagem.characters = 5;

// --- PE (Pouch Envelope) ---
// Marcado: fundo vira 2 cantos arredondados R=48,5mm (topo reto).
// Com "Somente frente" → peça EM PÉ. Sem → frente+verso DEITADO.
var gPE = dlg.add("group"); gPE.alignChildren = "right";
var inputPE = gPE.add("checkbox", undefined, "PE");

var g5 = dlg.add("group"); g5.alignChildren = "right";
var inputFrente = g5.add("checkbox", undefined, "Somente frente");

// --- Tamanho do queijo (toggle + painel) ---
var gQueijoChk = dlg.add("group"); gQueijoChk.alignChildren = "right";
var inputQueijo = gQueijoChk.add("checkbox", undefined, "Tamanho do queijo");

var panelQueijo = dlg.add("panel", undefined, "Dimensões do queijo");
panelQueijo.orientation = "column"; panelQueijo.alignChildren = "right";
panelQueijo.margins = 12; panelQueijo.visible = false;

var gqDiam = panelQueijo.add("group"); gqDiam.add("statictext", undefined, "Diâmetro (mm):");
var inputQDiam = gqDiam.add("edittext", undefined, "120"); inputQDiam.characters = 5;
gqDiam.visible = false;  // só aparece quando "Queijo redondo" está marcado

var gq1 = panelQueijo.add("group"); gq1.add("statictext", undefined, "Comprimento (mm):");
var inputQComp = gq1.add("edittext", undefined, "140"); inputQComp.characters = 5;

var gq2 = panelQueijo.add("group"); gq2.add("statictext", undefined, "Largura (mm):");
var inputQLarg = gq2.add("edittext", undefined, "80"); inputQLarg.characters = 5;

var gq3 = panelQueijo.add("group"); gq3.add("statictext", undefined, "Altura (mm):");
var inputQAlt = gq3.add("edittext", undefined, "50"); inputQAlt.characters = 5;

var gq4 = panelQueijo.add("group"); gq4.add("statictext", undefined, "Deslocamento de arte (mm):");
var inputRecuo = gq4.add("edittext", undefined, "0"); inputRecuo.characters = 5;

var gqRedondo = panelQueijo.add("group"); gqRedondo.alignChildren = "right";
var inputQRedondo = gqRedondo.add("checkbox", undefined, "Queijo redondo");

// --- Tamanho da arte (toggle + painel) — mutuamente exclusivo com queijo ---
var gArteChk = dlg.add("group"); gArteChk.alignChildren = "right";
var inputArte = gArteChk.add("checkbox", undefined, "Tamanho da arte");

var panelArte = dlg.add("panel", undefined, "Dimensões da arte");
panelArte.orientation = "column"; panelArte.alignChildren = "right";
panelArte.margins = 12; panelArte.visible = false;

// --- FRENTE ---
var gLabelF = panelArte.add("group"); gLabelF.alignChildren = "left";
var lblF = gLabelF.add("statictext", undefined, "Frente:");
try { lblF.graphics.font = ScriptUI.newFont(lblF.graphics.font.name, "BOLD", lblF.graphics.font.size); } catch(e) {}

var gaDiamF = panelArte.add("group"); gaDiamF.add("statictext", undefined, "Diâmetro (mm):");
var inputADiamF = gaDiamF.add("edittext", undefined, "120"); inputADiamF.characters = 5;
gaDiamF.visible = false;

var ga1F = panelArte.add("group"); ga1F.add("statictext", undefined, "Comprimento (mm):");
var inputATamF = ga1F.add("edittext", undefined, "180"); inputATamF.characters = 5;

var ga2F = panelArte.add("group"); ga2F.add("statictext", undefined, "Largura (mm):");
var inputALargF = ga2F.add("edittext", undefined, "120"); inputALargF.characters = 5;

var gaFundoF = panelArte.add("group"); gaFundoF.add("statictext", undefined, "Distância de fundo (mm):");
var inputAFundoF = gaFundoF.add("edittext", undefined, "10"); inputAFundoF.characters = 5;

// --- VERSO (escondido quando "Somente frente" marcado) ---
var gLabelV = panelArte.add("group"); gLabelV.alignChildren = "left";
var lblV = gLabelV.add("statictext", undefined, "Verso:");
try { lblV.graphics.font = ScriptUI.newFont(lblV.graphics.font.name, "BOLD", lblV.graphics.font.size); } catch(e) {}

var gaDiamV = panelArte.add("group"); gaDiamV.add("statictext", undefined, "Diâmetro (mm):");
var inputADiamV = gaDiamV.add("edittext", undefined, "110"); inputADiamV.characters = 5;
gaDiamV.visible = false;

var ga1V = panelArte.add("group"); ga1V.add("statictext", undefined, "Comprimento (mm):");
var inputATamV = ga1V.add("edittext", undefined, "170"); inputATamV.characters = 5;

var ga2V = panelArte.add("group"); ga2V.add("statictext", undefined, "Largura (mm):");
var inputALargV = ga2V.add("edittext", undefined, "110"); inputALargV.characters = 5;

var gaFundoV = panelArte.add("group"); gaFundoV.add("statictext", undefined, "Distância de fundo (mm):");
var inputAFundoV = gaFundoV.add("edittext", undefined, "10"); inputAFundoV.characters = 5;

var gaRedonda = panelArte.add("group"); gaRedonda.alignChildren = "right";
var inputARedonda = gaRedonda.add("checkbox", undefined, "Arte redonda");

// --- Borda caída (visível apenas quando queijo está marcado) ---
var gBorda = dlg.add("group"); gBorda.alignChildren = "right"; gBorda.visible = false;
var inputBorda = gBorda.add("checkbox", undefined, "Borda caída");

inputQueijo.onClick = function() {
    if (this.value) {
        // Exclusão mútua: desmarca "Tamanho da arte" e esconde painel da arte
        inputArte.value = false;
        inputARedonda.value = false;
        panelArte.visible = false;
    }
    panelQueijo.visible = this.value;
    gBorda.visible = this.value;
    // Área de selagem desabilitada quando queijo/arte marcado
    inputSelagem.enabled = !this.value && !inputArte.value;
    if (!this.value) {
        inputBorda.value = false;
        inputQRedondo.value = false;
        inputRecuo.enabled = true;
        gqDiam.visible = false;
        gq1.visible = true;
        gq2.visible = true;
    }
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputQRedondo.onClick = function() {
    // Queijo redondo: perguntar só Diâmetro (esconde Comp/Larg)
    gqDiam.visible = this.value;
    gq1.visible = !this.value;
    gq2.visible = !this.value;
    dlg.layout.layout(true);
    dlg.layout.resize();
};

function _updateArteVisibility() {
    if (!panelArte.visible) return;
    var redonda  = inputARedonda.value;
    var soFrente = inputFrente.value;

    gaDiamF.visible = redonda;
    ga1F.visible    = !redonda;
    ga2F.visible    = !redonda;

    gLabelV.visible = !soFrente;
    gaDiamV.visible = redonda && !soFrente;
    ga1V.visible    = !redonda && !soFrente;
    ga2V.visible    = !redonda && !soFrente;
    gaFundoV.visible = !soFrente;
}

inputArte.onClick = function() {
    if (this.value) {
        // Exclusão mútua: desmarca "Tamanho do queijo"
        inputQueijo.value = false;
        panelQueijo.visible = false;
        gBorda.visible = false;
        inputBorda.value = false;
        inputQRedondo.value = false;
        inputRecuo.enabled = true;
        gqDiam.visible = false; gq1.visible = true; gq2.visible = true;
    } else {
        inputARedonda.value = false;
    }
    panelArte.visible = this.value;
    // Área de selagem desabilitada quando queijo/arte marcado
    inputSelagem.enabled = !this.value && !inputQueijo.value;
    _updateArteVisibility();
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputARedonda.onClick = function() {
    _updateArteVisibility();
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputFrente.onClick = function() {
    // Reflete em panelArte se estiver visível: esconde subseção Verso quando só frente
    _updateArteVisibility();
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputBorda.onClick = function() {
    // Borda caída fixa recuo em 5mm (tanto frente quanto verso) — desabilita o input
    inputRecuo.enabled = !this.value;
    // Em borda caída, área de selagem padrão = 45mm
    if (this.value) {
        inputSelagem.text = "45";
    }
};

var grupoBotoes = dlg.add("group"); grupoBotoes.alignment = "center";
grupoBotoes.add("button", undefined, "Cancelar", { name: "cancel" });
grupoBotoes.add("button", undefined, "Gerar Planta", { name: "ok" });

// --- EXECUÇÃO ---
if (dlg.show() == 1) {
    var c = parseFloat(inputComp.text.replace(',', '.'));
    var l = parseFloat(inputLarg.text.replace(',', '.'));
    var s = parseFloat(inputSelagem.text.replace(',', '.'));
    if (isNaN(s)) s = 45;
    var f = 10; // distância de fundo padrão (modo A); sobrescrita em queijo/arte
    // No PE não há solda física, então a arte pode ir até a margem mínima
    // (PE_MARGEM_FUNDO_MM = 5mm) do vale do fundo arredondado. Default f=0 aqui.
    if (inputPE.value) f = 0;
    var r = _parseDeslo(inputRecuo.text);
    var queijoData = null;
    var arteData = null;
    if (inputQueijo.value) {
        var qa = parseFloat(inputQAlt.text.replace(',', '.'));
        var qc, ql;
        if (inputQRedondo.value) {
            var qd = parseFloat(inputQDiam.text.replace(',', '.'));
            qc = qd; ql = qd;
        } else {
            qc = parseFloat(inputQComp.text.replace(',', '.'));
            ql = parseFloat(inputQLarg.text.replace(',', '.'));
        }
        if (isNaN(qc) || isNaN(ql) || isNaN(qa)) {
            alert("Erro: Digite valores válidos para o queijo.");
        } else {
            queijoData = {
                comp: qc, larg: ql, alt: qa,
                bordaCaida: inputBorda.value,
                redondo: inputQRedondo.value
            };
        }
        f = inputBorda.value ? 5 : 0;
        if (inputBorda.value) r = 5;
    } else if (inputArte.value) {
        var redonda = inputARedonda.value;
        var atF, alF, atV, alV;
        if (redonda) {
            atF = parseFloat(inputADiamF.text.replace(',', '.'));
            alF = atF;
            atV = parseFloat(inputADiamV.text.replace(',', '.'));
            alV = atV;
        } else {
            atF = parseFloat(inputATamF.text.replace(',', '.'));
            alF = parseFloat(inputALargF.text.replace(',', '.'));
            atV = parseFloat(inputATamV.text.replace(',', '.'));
            alV = parseFloat(inputALargV.text.replace(',', '.'));
        }
        var dfF = parseFloat(inputAFundoF.text.replace(',', '.'));
        var dfV = parseFloat(inputAFundoV.text.replace(',', '.'));
        var soFrente = inputFrente.value;
        var frenteOk = !isNaN(atF) && !isNaN(alF) && !isNaN(dfF);
        var versoOk  = soFrente || (!isNaN(atV) && !isNaN(alV) && !isNaN(dfV));
        if (!frenteOk || !versoOk) {
            alert("Erro: Digite valores válidos para a arte.");
        } else {
            arteData = {
                redonda: redonda,
                frente: { tamanho: atF, largura: alF, distFundo: dfF },
                verso:  soFrente ? null : { tamanho: atV, largura: alV, distFundo: dfV }
            };
        }
    }
    // Em modo A (sem queijo/arte), borda caída ou arte custom, o "Deslocamento"
    // do input não se aplica — arte usa recuo fixo de 5mm (respiro da curva).
    if (!queijoData || queijoData.bordaCaida) {
        r = 5;
    }
    if (isNaN(c) || isNaN(l) || isNaN(s) || isNaN(f) || isNaN(r)) {
        alert("Erro: Digite valores válidos.");
    } else if (inputPE.value) {
        // Modo PE (pouch envelope)
        if (inputFrente.value) {
            desenharPE_Frente(c, l, s, f, r, queijoData, arteData);
        } else {
            desenharPE_Duplo(c, l, s, f, r, queijoData, arteData);
        }
    } else if (inputFrente.value) {
        desenharFR_Frente(c, l, s, f, r, queijoData, arteData);
    } else {
        desenharFR_Duplo(c, l, s, f, r, queijoData, arteData);
    }
}

// --- LÓGICA: FRENTE + VERSO (duas faces lado a lado) ---
// recuoMM = recuo lateral/arte da frente em mm. Verso usa recuoMM + 5.
function desenharFR_Duplo(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt = mm2pt(largMM);
    var compPt = mm2pt(compMM);
    var dTopoPt = mm2pt(getDepthTopMM(largMM));
    var dFundoPt = mm2pt(getDepthBotMM(largMM));
    var gapFaces = mm2pt(40);

    if (!_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData)) return;

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
    var versoRecuoMM = (queijoData && !queijoData.bordaCaida) ? recuoMM - 5 : recuoMM;
    _desenharFaceFR(topMaterial, topArte, topCotas, x0, y0,
                    largMM, compMM, selagemMM, fundoMM, recuoMM, "Frente", queijoData, arteData);
    _desenharFaceFR(topMaterial, topArte, topCotas, x0 + largPt + gapFaces, y0,
                    largMM, compMM, selagemMM, fundoMM, versoRecuoMM, "Verso", queijoData, arteData);

    app.redraw();
    alert("Fundo Redondo v3.2 (frente + verso) gerado com sucesso!");
}

// --- LÓGICA: SOMENTE FRENTE ---
function desenharFR_Frente(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt = mm2pt(largMM);
    var compPt = mm2pt(compMM);
    var dTopoPt = mm2pt(getDepthTopMM(largMM));

    if (!_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData)) return;

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

    _desenharFaceFR(topMaterial, topArte, topCotas, x0, y0,
                    largMM, compMM, selagemMM, fundoMM, recuoMM, "Frente", queijoData, arteData);

    app.redraw();
    alert("Fundo Redondo v3.2 (somente frente) gerado com sucesso!");
}

// --- VALIDAÇÃO ---
// compMM = distância vale-a-vale (topo ao fundo).
// recuoMM = recuo lateral da arte na frente. Verso = recuoMM + 5 (só em modo queijo sem borda).
// Limites: largura ≤ 370mm e comprimento ≤ 460mm (tamanho do gabarito máximo).
function _validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    if (largMM > MAX_W_MM) {
        alert("Erro: a largura máxima é " + fmt(MAX_W_MM) + " mm (limite do gabarito).");
        return false;
    }
    if (compMM > MAX_C_MM) {
        alert("Erro: o comprimento máximo é " + fmt(MAX_C_MM) + " mm (limite do gabarito).");
        return false;
    }
    // Em modos sem queijo/arte ou com borda caída, recuoMM é forçado a 5 no parsing.
    // Em modo queijo sem borda caída: nova semântica (positivo = expandir, negativo = recuar)
    // Validação de respiro 5mm da lateral: arte <= largMM - 10mm (5mm de cada lado)
    var maxLargArte = largMM - 10;

    if (queijoData && !queijoData.bordaCaida) {
        // Frente: arte = queijo + 2*recuoMM
        var lFrente = queijoData.larg + 2 * recuoMM;
        if (lFrente > maxLargArte + 0.01) {
            alert("Erro: a arte da FRENTE tem largura " + fmt2(lFrente) +
                  "mm e fica a menos de 5mm da borda lateral.\n" +
                  "Largura máxima: " + fmt2(maxLargArte) + "mm (material: " + largMM + "mm).");
            return false;
        }
        // Verso: arte = queijo + 2*(recuoMM - 5)
        var lVerso = queijoData.larg + 2 * (recuoMM - 5);
        if (lVerso > maxLargArte + 0.01) {
            alert("Erro: a arte do VERSO tem largura " + fmt2(lVerso) +
                  "mm e fica a menos de 5mm da borda lateral.\n" +
                  "Largura máxima: " + fmt2(maxLargArte) + "mm.");
            return false;
        }
        // Distância da base da arte à solda = alt/2 - recuoMM, precisa ser >= 5
        var distBaseArte = queijoData.alt / 2 - recuoMM;
        if (distBaseArte < 5 - 0.01) {
            var desloStr = (recuoMM >= 0 ? "+" : "") + recuoMM + "mm";
            alert("Erro: a base da arte fica a " + fmt2(distBaseArte) +
                  "mm da solda do fundo — é preciso pelo menos 5mm.\n" +
                  "Aumente a altura do queijo ou reduza o deslocamento da arte.\n" +
                  "(Altura: " + queijoData.alt + "mm, deslocamento: " + desloStr + ")");
            return false;
        }
    } else if (arteData) {
        // Arte custom: validar largura <= largMM - 10
        var lados = [];
        lados.push({ nome: "frente", info: arteData.frente });
        if (arteData.verso) lados.push({ nome: "verso", info: arteData.verso });
        for (var li = 0; li < lados.length; li++) {
            var nm = lados[li].nome, inf = lados[li].info;
            if (inf.tamanho <= 0 || inf.largura <= 0) {
                alert("Erro: dimensões da arte (" + nm + ") devem ser positivas.");
                return false;
            }
            if (inf.distFundo < 0) {
                alert("Erro: a distância de fundo da arte (" + nm + ") deve ser ≥ 0.");
                return false;
            }
            if (inf.largura > maxLargArte + 0.01) {
                alert("Erro: a largura da arte (" + nm + ", " + fmt2(inf.largura) +
                      "mm) fica a menos de 5mm da borda lateral.\n" +
                      "Largura máxima: " + fmt2(maxLargArte) + "mm (material: " + largMM + "mm).");
                return false;
            }
            var espacoV_a = inf.tamanho + inf.distFundo;
            var espacoMaxV_a = compMM - 10 - 5;
            if (espacoV_a > espacoMaxV_a) {
                alert("Erro: a arte (" + nm + ") não cabe na peça.\n" +
                      "Tamanho + distância de fundo = " + fmt2(espacoV_a) + " mm.\n" +
                      "Espaço máximo disponível = " + fmt2(espacoMaxV_a) + " mm.");
                return false;
            }
        }
    } else {
        // Modo A ou borda caída: arte segue curva padrão com 5mm respiro lateral
        var arteAlt = compMM - selagemMM - fundoMM - 10;  // 5 respiro + 5 solda = 10
        if (arteAlt < 5) {
            alert("Erro: o comprimento é insuficiente.\n" +
                  "Mínimo necessário: selagem (" + fmt(selagemMM) +
                  ") + fundo (" + fmt(fundoMM) + ") + solda+respiro (10) + 5 de arte = " +
                  fmt2(selagemMM + fundoMM + 10 + 5) + " mm.");
            return false;
        }
    }

    // Validação específica do queijo (se definido)
    if (queijoData) {
        if (queijoData.comp <= 0 || queijoData.larg <= 0 || queijoData.alt <= 0) {
            alert("Erro: dimensões do queijo devem ser positivas.");
            return false;
        }
        if (queijoData.larg > largMM) {
            alert("Erro: a largura do queijo (" + fmt(queijoData.larg) +
                  " mm) é maior que a largura da peça (" + fmt(largMM) + " mm).");
            return false;
        }
        var espacoV = queijoData.comp + queijoData.alt / 2;
        var espacoMaxV = compMM - 10 - 5;
        if (espacoV > espacoMaxV) {
            alert("Erro: o queijo não cabe na peça.\n" +
                  "Espaço ocupado pelo queijo (comp + altura/2) = " + fmt2(espacoV) + " mm.\n" +
                  "Espaço máximo disponível = " + fmt2(espacoMaxV) + " mm.");
            return false;
        }
    }
    return true;
}

// --- HELPER: desenha UMA face completa (material + arte + fotocélula + solda + cotas) ---
// Recebe os 3 grupos top-level (Material, Arte, Cotas) já criados — adiciona
// sub-grupos nomeados com `nomeGrupo` ("Frente" / "Verso") dentro de cada um.
// recuoMM = recuo lateral da arte (e offset da arte ao queijo em modos B/D).
// (xStart, yStart) = canto superior ESQUERDO do bounding-box da peça.
// yStart corresponde ao Y dos CANTOS SUPERIORES (ponto mais alto do material).
// compMM = distância do ponto mais baixo do topo ao ponto mais baixo do fundo.
function _desenharFaceFR(topMaterial, topArte, topCotas, xStart, yStart, largMM, compMM, selagemMM, fundoMM, recuoMM, nomeGrupo, queijoData, arteData) {
    var largPt    = mm2pt(largMM);
    var compPt    = mm2pt(compMM);
    var selagemPt = mm2pt(selagemMM);
    var fundoPt   = mm2pt(fundoMM);
    var margemLat = mm2pt(recuoMM);
    var isFrente  = (nomeGrupo === "Frente");

    // Profundidades aparentes variam com a largura (recorte central da mestre)
    var dTopoMM   = getDepthTopMM(largMM);
    var dFundoMM  = getDepthBotMM(largMM);
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
    drawMaterial(groupMaterial, xMatIni, yTopo, largMM, compMM, corFundo);

    // ------------------------------------------------------------------
    // 2. ARTE + (opcional) SIMULAÇÃO DO QUEIJO
    //
    // Modos:
    //   (A) Sem queijo                            → arte com topo E fundo CURVOS, recuo lateral = recuoMM
    //   (B) Queijo retangular, sem borda caída    → arte RETANGULAR, recuoMM dentro do queijo
    //   (C) Queijo retangular + borda caída       → arte curva (= A) + retângulo do queijo em Cotas
    //   (D) Queijo REDONDO, sem borda caída       → arte ELÍPTICA, recuoMM dentro do queijo
    //   (E) Queijo REDONDO + borda caída          → arte curva (= A) + elipse do queijo em Cotas
    //
    // Em todos os modos com queijo: desenha o queijo em MAGENTA TRACEJADO
    // dentro do grupo COTAS (linhas de referência, não fazem parte da arte).
    // ------------------------------------------------------------------

    // Limites master da ARTE quando curva (material encolhido recuoMM cada lado)
    var masterXL_piece = (MASTER_W_MM - largMM) / 2;
    var masterXR_piece = (MASTER_W_MM + largMM) / 2;
    var arteXL_master = masterXL_piece + recuoMM;
    var arteXR_master = masterXR_piece - recuoMM;
    var topCornerY_piece = (_interpY(_getTopSamples(), masterXL_piece) + _interpY(_getTopSamples(), masterXR_piece)) / 2;
    var botCornerY_piece = (_interpY(_getBotSamples(), masterXL_piece) + _interpY(_getBotSamples(), masterXR_piece)) / 2;

    // Variáveis que dependem do modo — precisam ser acessíveis para as cotas
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
        // Seleciona dimensões da face correta. Se verso não definido (Somente frente), reutiliza frente.
        var aInfo = isFrente ? arteData.frente : (arteData.verso || arteData.frente);
        var aFundo = aInfo.distFundo;  // distância de fundo desta face
        var xCentro = xMatIni + largPt / 2;
        var arteBot = yLinhaTopoSoldaCentro + mm2pt(aFundo);
        var arteTop = arteBot + mm2pt(aInfo.tamanho);
        var arteL = xCentro - mm2pt(aInfo.largura / 2);
        var arteR = xCentro + mm2pt(aInfo.largura / 2);

        if (arteData.redonda) {
            _drawFilledEllipse(groupArte, xCentro, (arteBot + arteTop) / 2,
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
        // Nova semântica: recuoMM positivo = arte EXPANDE (maior que queijo)
        //                 recuoMM negativo = arte RECUA (menor que queijo)
        var offPt = mm2pt(recuoMM);

        if (queijoData.redondo) {
            // --- MODO D: QUEIJO (em Cotas) e ARTE (em Arte) como ELIPSES ---
            _drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                               bbox.right - bbox.left, bbox.top - bbox.bot,
                               corMagenta, "Queijo");
            _drawFilledEllipse(groupArte, bbox.cx, bbox.cy,
                               bbox.right - bbox.left + 2 * offPt,
                               bbox.top - bbox.bot + 2 * offPt,
                               corCyan, "Arte");
        } else {
            // --- MODO B: QUEIJO (em Cotas) e ARTE (em Arte) como RETÂNGULOS ---
            _drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
            var arteLeft = bbox.left - offPt;
            var arteRight = bbox.right + offPt;
            var arteBot = bbox.bot - offPt;
            var arteTop = bbox.top + offPt;
            var arteShape = groupArte.pathItems.rectangle(arteTop, arteLeft, arteRight - arteLeft, arteTop - arteBot);
            arteShape.filled = true; arteShape.stroked = false; arteShape.fillColor = corCyan;
            arteShape.name = "Arte";
        }

        yArteBotCentro = bbox.bot - offPt;
        yArteTopCentro = bbox.top + offPt;
        arteLeftCota  = bbox.left - offPt;
        arteRightCota = bbox.right + offPt;
        arteWidthMM   = queijoData.larg + 2 * recuoMM;
        distFundoEfetivoMM = queijoData.alt / 2 - recuoMM;
        arteAltEfetivaMM   = queijoData.comp + 2 * recuoMM;
        selagemEfetivaMM   = compMM - 10 - distFundoEfetivoMM - arteAltEfetivaMM;
    } else {
        // --- MODO A, C ou E: ARTE CURVA (padrão) ---
        var arteTopSegsMM = _trimBezChain(MASTER_TOP_CURVE_MM,    arteXL_master, arteXR_master);
        var arteBotSegsMM = _trimBezChain(MASTER_BOTTOM_CURVE_MM, arteXL_master, arteXR_master);
        var arteTopSegsPt = _transformSegsToPt(arteTopSegsMM, xMatIni, masterXL_piece, yTopo,         topCornerY_piece, -mm2pt(selagemMM));
        var arteBotSegsPt = _transformSegsToPt(arteBotSegsMM, xMatIni, masterXL_piece, yCantosFundo,  botCornerY_piece, +mm2pt(10 + fundoMM));
        var arteBotSegsPtRL = _revBezChain(arteBotSegsPt);

        var arteShape = groupArte.pathItems.add();
        _addBezSegsToPath(arteShape, arteTopSegsPt);
        _addBezSegsToPath(arteShape, arteBotSegsPtRL);
        arteShape.closed = true;
        arteShape.filled = true; arteShape.stroked = false;
        arteShape.fillColor = corCyan;
        arteShape.name = "Arte";

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
            var bbox = _queijoBBox();
            if (queijoData.redondo) {
                _drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                                   bbox.right - bbox.left, bbox.top - bbox.bot,
                                   corMagenta, "Queijo");
            } else {
                _drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
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
        var fotoLeft = xMatIni + mm2pt(5);  // canto esquerdo a 5mm da borda
        var fotocel = groupArte.pathItems.rectangle(fotoTop, fotoLeft, fotoW, fotoH);
        fotocel.filled = true; fotocel.stroked = false;
        fotocel.fillColor = corPreto;
        fotocel.name = "Fotocélula";
    }

    // ------------------------------------------------------------------
    // 3. LINHAS DE FACA DA SOLDA CURVA (dentro de Cotas — Bezier real)
    // ------------------------------------------------------------------
    var matBotSegsMM = _trimBezChain(MASTER_BOTTOM_CURVE_MM, masterXL_piece, masterXR_piece);
    var solda5SegsPt  = _transformSegsToPt(matBotSegsMM, xMatIni, masterXL_piece, yCantosFundo, botCornerY_piece, +mm2pt(5));
    var solda10SegsPt = _transformSegsToPt(matBotSegsMM, xMatIni, masterXL_piece, yCantosFundo, botCornerY_piece, +mm2pt(10));
    drawBezierOpen(groupCotas, solda5SegsPt,  corFaca, true);
    drawBezierOpen(groupCotas, solda10SegsPt, corFaca, true);

    // Label "SOLDA" centrado na faixa da solda (7.5mm acima do ponto mais baixo)
    addText(groupCotas, "SOLDA", xMatIni + largPt / 2, yFundoExtremo + mm2pt(7.5), 8, corCota, 0);

    // ------------------------------------------------------------------
    // 4. COTAS HORIZONTAIS (acima do topo)
    //    - Externa: largura total do material (sempre)
    //    - 3 internas: margem esq / largura da ARTE / margem dir
    //      As margens e a largura da arte se ajustam ao modo (sem queijo,
    //      com queijo retangular/redondo, com/sem borda caída).
    // ------------------------------------------------------------------
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);
    var margemLateralMM = (largMM - arteWidthMM) / 2;

    // Fonte 5pt quando margem lateral < 15mm (apertado) ou em borda caída
    var _latFontSize = (margemLateralMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;

    drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, fmt(largMM) + " mm", corCota);
    if (margemLateralMM > 0.01) {
        drawCotaH(groupCotas, xMatIni,        arteLeftCota,  yCota2, fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    }
    drawCotaH(groupCotas, arteLeftCota,   arteRightCota, yCota2, fmt2(arteWidthMM)     + " mm", corCota);
    if (margemLateralMM > 0.01) {
        drawCotaH(groupCotas, arteRightCota,  xMatFim,       yCota2, fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    }

    // ------------------------------------------------------------------
    // 5. COTAS VERTICAIS (à esquerda) — valores seguem a geometria real
    // ------------------------------------------------------------------
    var xCotaV1 = xMatIni - mm2pt(14);
    var xCotaV2 = xMatIni - mm2pt(5);

    // Cota principal (externa): Comprimento total
    drawCotaV(groupCotas, xCotaV1, yTopoCentro, yFundoExtremo, fmt(compMM) + " mm", corCota);

    // Cotas internas (xCotaV2), de baixo para cima, medidas no centro
    drawCotaV(groupCotas, xCotaV2, yFundoExtremo,             yLinhaBaixoSoldaCentro, "5 mm", corCota, 5);
    drawCotaV(groupCotas, xCotaV2, yLinhaBaixoSoldaCentro,    yLinhaTopoSoldaCentro,  "5 mm", corCota, 5);
    if (distFundoEfetivoMM > 0.01) {
        // Fonte 5pt quando distância < 15mm ou em borda caída
        var _dfFontSize = (distFundoEfetivoMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;
        drawCotaV(groupCotas, xCotaV2, yLinhaTopoSoldaCentro, yArteBotCentro,
                  fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
    }
    drawCotaV(groupCotas, xCotaV2, yArteBotCentro, yArteTopCentro,
              fmt2(arteAltEfetivaMM) + " mm", corCota);
    if (selagemEfetivaMM > 0.01) {
        var _selFontSize = (selagemEfetivaMM < 15) ? 5 : 12;
        drawCotaV(groupCotas, xCotaV2, yArteTopCentro, yTopoCentro,
                  fmt2(selagemEfetivaMM) + " mm", corCota, _selFontSize);
    }
}

// Desenha um retângulo com stroke tracejado (sem preenchimento). Usado para a simulação do queijo.
function _drawDashedRect(layer, x1, x2, y1, y2, color, name) {
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
// No sistema Y-up do Illustrator, "top" da bounding-box é cy + h/2.
function _drawDashedEllipse(layer, cx, cy, w, h, color, name) {
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
function _drawFilledEllipse(layer, cx, cy, w, h, color, name) {
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
// MODO PE (POUCH ENVELOPE) — FUNÇÕES ORQUESTRADORAS
// ============================================================

// --- ENTRY POINT: PE + Somente Frente (peça EM PÉ) ---
function desenharPE_Frente(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt = mm2pt(largMM);
    var compPt = mm2pt(compMM);

    if (!_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData)) return;

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
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

    _desenharFacePE_EmPe(topMaterial, topArte, topCotas, x0, y0,
                         largMM, compMM, selagemMM, fundoMM, recuoMM,
                         "Frente", queijoData, arteData);

    app.redraw();
    alert("PE (somente frente, em pé) gerado com sucesso!");
}

// --- ENTRY POINT: PE com Frente+Verso (peça DEITADA) ---
function desenharPE_Duplo(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var compPt = mm2pt(compMM);
    var largPt = mm2pt(largMM);
    var gapPt  = mm2pt(PE_GAP_DEITADO_MM);

    if (!_validarFace(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData)) return;

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
    var totalW = compPt * 2 + gapPt;   // 2 faces deitadas + gap central
    var totalH = largPt;                // altura da face (= largura original)
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
    _desenharFacePE_Deitada(topMaterial, topArte, topCotas, x0, y0,
                            largMM, compMM, selagemMM, fundoMM, recuoMM,
                            "Frente", queijoData, arteData, true);

    // VERSO à direita — no modo queijo SEM borda caída, a arte do verso é 5mm
    // menor em cada lado (recuoMM - 5). Nos outros modos usa o mesmo recuo.
    var versoRecuoMM = (queijoData && !queijoData.bordaCaida) ? recuoMM - 5 : recuoMM;
    _desenharFacePE_Deitada(topMaterial, topArte, topCotas, x0 + compPt + gapPt, y0,
                            largMM, compMM, selagemMM, fundoMM, versoRecuoMM,
                            "Verso", queijoData, arteData, false);

    // Cota TOTAL (frente + verso) — acima de todas as cotas individuais
    var corCotaTotal = cmyk(0, 0, 0, 60);
    var yCotaTotal = y0 + mm2pt(24);
    var totalCompMM = compMM * 2 + PE_GAP_DEITADO_MM;
    drawCotaH(topCotas, x0, x0 + totalW, yCotaTotal, fmt(totalCompMM) + " mm", corCotaTotal);

    app.redraw();
    alert("PE (frente + verso, deitado) gerado com sucesso!");
}

// ============================================================
// MODO PE — HELPER: FACE EM PÉ (somente frente)
// ============================================================
// Desenha uma face PE em orientação vertical (topo reto em cima,
// fundo arredondado embaixo). Estrutura paralela a _desenharFaceFR.
function _desenharFacePE_EmPe(topMaterial, topArte, topCotas, xStart, yStart,
                              largMM, compMM, selagemMM, fundoMM, recuoMM,
                              nomeGrupo, queijoData, arteData) {
    var largPt    = mm2pt(largMM);
    var compPt    = mm2pt(compMM);
    var selagemPt = mm2pt(selagemMM);
    var margemLat = mm2pt(recuoMM);
    var isFrente  = (nomeGrupo === "Frente");

    var R_eff = _peRadiusEffMM(largMM, compMM);

    var corFundo   = cmyk(15, 12, 12, 0);
    var corFaca    = cmyk(0, 0, 0, 60);
    var corCota    = cmyk(0, 0, 0, 60);
    var corCyan    = cmyk(70, 10, 16, 0);
    var corMagenta = cmyk(0, 100, 0, 0);
    var corPreto   = cmyk(0, 0, 0, 100);

    var xMatIni = xStart;
    var xMatFim = xStart + largPt;
    var yTopo   = yStart;               // topo reto
    var yBot    = yTopo - compPt;       // vale do fundo (trecho reto entre os arcos)

    // Linha de referência: margem mínima do fundo onde a arte pode começar
    // (PE_MARGEM_FUNDO_MM mm do vale do fundo arredondado).
    var yLinhaMargemFundo = yBot + mm2pt(PE_MARGEM_FUNDO_MM);

    var groupMaterial = topMaterial.groupItems.add(); if (nomeGrupo) groupMaterial.name = nomeGrupo;
    var groupArte     = topArte.groupItems.add();     if (nomeGrupo) groupArte.name     = nomeGrupo;
    var groupCotas    = topCotas.groupItems.add();    if (nomeGrupo) groupCotas.name    = nomeGrupo;

    // 1. MATERIAL
    drawPEMaterialEmPe(groupMaterial, xMatIni, yTopo, largMM, compMM, corFundo);

    // 2. ARTE + (opcional) QUEIJO
    var yArteTopCentro, yArteBotCentro;
    var arteLeftCota, arteRightCota, arteWidthMM;
    var distFundoEfetivoMM, arteAltEfetivaMM, selagemEfetivaMM;

    function _queijoBBoxPE() {
        var xC = xMatIni + largPt / 2;
        // Base do queijo posicionada a queijoData.alt/2 diretamente do vale do fundo
        var qB = yBot + mm2pt(queijoData.alt / 2);
        var qT = qB + mm2pt(queijoData.comp);
        var qL = xC - mm2pt(queijoData.larg / 2);
        var qR = xC + mm2pt(queijoData.larg / 2);
        return { left: qL, right: qR, bot: qB, top: qT, cx: xC, cy: (qB + qT) / 2 };
    }

    if (arteData) {
        // Modo F/G: arte custom retangular/elíptica (centrada)
        var aInfo = isFrente ? arteData.frente : (arteData.verso || arteData.frente);
        var aFundo = aInfo.distFundo;
        var xCentro = xMatIni + largPt / 2;
        var arteBot = yLinhaMargemFundo + mm2pt(aFundo);
        var arteTop = arteBot + mm2pt(aInfo.tamanho);
        var arteL = xCentro - mm2pt(aInfo.largura / 2);
        var arteR = xCentro + mm2pt(aInfo.largura / 2);

        if (arteData.redonda) {
            _drawFilledEllipse(groupArte, xCentro, (arteBot + arteTop) / 2,
                               arteR - arteL, arteTop - arteBot, corCyan, "Arte");
        } else {
            var arteShape = groupArte.pathItems.rectangle(arteTop, arteL, arteR - arteL, arteTop - arteBot);
            arteShape.filled = true; arteShape.stroked = false; arteShape.fillColor = corCyan;
            arteShape.name = "Arte";
        }
        yArteBotCentro = arteBot;
        yArteTopCentro = arteTop;
        arteLeftCota = arteL;
        arteRightCota = arteR;
        arteWidthMM = aInfo.largura;
        distFundoEfetivoMM = aFundo;
        arteAltEfetivaMM   = aInfo.tamanho;
        selagemEfetivaMM   = compMM - PE_MARGEM_FUNDO_MM - aFundo - aInfo.tamanho;
    } else if (queijoData && !queijoData.bordaCaida) {
        // Modo B/D: arte centrada no queijo (retângulo ou elipse)
        var bbox = _queijoBBoxPE();
        var offPt = mm2pt(recuoMM);
        if (queijoData.redondo) {
            _drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                               bbox.right - bbox.left, bbox.top - bbox.bot,
                               corMagenta, "Queijo");
            _drawFilledEllipse(groupArte, bbox.cx, bbox.cy,
                               bbox.right - bbox.left + 2 * offPt,
                               bbox.top - bbox.bot + 2 * offPt,
                               corCyan, "Arte");
        } else {
            _drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
            var arteL2 = bbox.left - offPt;
            var arteR2 = bbox.right + offPt;
            var arteB2 = bbox.bot - offPt;
            var arteT2 = bbox.top + offPt;
            var arteShape2 = groupArte.pathItems.rectangle(arteT2, arteL2, arteR2 - arteL2, arteT2 - arteB2);
            arteShape2.filled = true; arteShape2.stroked = false; arteShape2.fillColor = corCyan;
            arteShape2.name = "Arte";
        }
        yArteBotCentro = bbox.bot - offPt;
        yArteTopCentro = bbox.top + offPt;
        arteLeftCota = bbox.left - offPt;
        arteRightCota = bbox.right + offPt;
        arteWidthMM = queijoData.larg + 2 * recuoMM;
        distFundoEfetivoMM = queijoData.alt / 2 - recuoMM;
        arteAltEfetivaMM   = queijoData.comp + 2 * recuoMM;
        selagemEfetivaMM   = compMM - PE_MARGEM_FUNDO_MM - distFundoEfetivoMM - arteAltEfetivaMM;
    } else {
        // Modo A, C, E: arte com fundo arredondado (topo reto, fundo R_arte = R_eff - recuo)
        var xArteL = xMatIni + margemLat;
        var xArteR = xMatFim - margemLat;
        var yArteTop = yTopo - selagemPt;
        var yArteBot = yBot + mm2pt(PE_MARGEM_FUNDO_MM + fundoMM);
        var R_arte = R_eff - recuoMM;
        drawPEArteEmPe(groupArte, xArteL, xArteR, yArteTop, yArteBot, R_arte, corCyan);

        yArteBotCentro = yArteBot;
        yArteTopCentro = yArteTop;
        arteLeftCota = xArteL;
        arteRightCota = xArteR;
        arteWidthMM = largMM - 2 * recuoMM;
        distFundoEfetivoMM = fundoMM;
        arteAltEfetivaMM   = compMM - selagemMM - PE_MARGEM_FUNDO_MM - fundoMM;
        selagemEfetivaMM   = selagemMM;

        // Modo C/E: queijo tracejado sobre a arte
        if (queijoData && queijoData.bordaCaida) {
            var bbox2 = _queijoBBoxPE();
            if (queijoData.redondo) {
                _drawDashedEllipse(groupCotas, bbox2.cx, bbox2.cy,
                                   bbox2.right - bbox2.left, bbox2.top - bbox2.bot,
                                   corMagenta, "Queijo");
            } else {
                _drawDashedRect(groupCotas, bbox2.left, bbox2.right, bbox2.bot, bbox2.top, corMagenta, "Queijo");
            }
        }
    }

    // 2b. FOTOCÉLULA (somente frente)
    // 2b. FOTOCÉLULA (somente na frente, 5×20mm vertical)
    if (isFrente) {
        var fotoW = mm2pt(5), fotoH = mm2pt(20);
        var fotoTop  = yTopo - mm2pt(5);
        var fotoLeft = xMatIni + mm2pt(5);
        var fotocel = groupArte.pathItems.rectangle(fotoTop, fotoLeft, fotoW, fotoH);
        fotocel.filled = true; fotocel.stroked = false;
        fotocel.fillColor = corPreto;
        fotocel.name = "Fotocélula";
    }

    // 3. (Sem simulação de solda no PE — área do fundo é apenas reserva geométrica)

    // 4. COTAS HORIZONTAIS (acima do topo)
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);
    var margemLateralMM = (largMM - arteWidthMM) / 2;
    var _latFontSize = (margemLateralMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;

    drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, fmt(largMM) + " mm", corCota);
    if (margemLateralMM > 0.01) {
        drawCotaH(groupCotas, xMatIni, arteLeftCota, yCota2, fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    }
    drawCotaH(groupCotas, arteLeftCota, arteRightCota, yCota2, fmt2(arteWidthMM) + " mm", corCota);
    if (margemLateralMM > 0.01) {
        drawCotaH(groupCotas, arteRightCota, xMatFim, yCota2, fmt2(margemLateralMM) + " mm", corCota, _latFontSize);
    }

    // 5. COTAS VERTICAIS (à esquerda)
    var xCotaV1 = xMatIni - mm2pt(14);
    var xCotaV2 = xMatIni - mm2pt(5);

    drawCotaV(groupCotas, xCotaV1, yTopo, yBot, fmt(compMM) + " mm", corCota);
    // Em modo queijo SEM borda caída (B/D), o queijo é posicionado a alt/2
    // diretamente do vale do fundo, então a cota de 5mm de margem não se aplica.
    // A cota de distFundoEfetivoMM passa a medir do vale direto até a arte.
    var _pe_temQueijoSemBorda = (queijoData && !queijoData.bordaCaida);
    if (!_pe_temQueijoSemBorda) {
        // Margem mínima do fundo (distância do vale do fundo arredondado até a linha de referência)
        drawCotaV(groupCotas, xCotaV2, yBot, yLinhaMargemFundo, fmt(PE_MARGEM_FUNDO_MM) + " mm", corCota, 5);
    }
    if (distFundoEfetivoMM > 0.01) {
        var _dfFontSize = (distFundoEfetivoMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;
        var _yBaseDistFundo = _pe_temQueijoSemBorda ? yBot : yLinhaMargemFundo;
        drawCotaV(groupCotas, xCotaV2, _yBaseDistFundo, yArteBotCentro,
                  fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
    }
    drawCotaV(groupCotas, xCotaV2, yArteBotCentro, yArteTopCentro,
              fmt2(arteAltEfetivaMM) + " mm", corCota);
    if (selagemEfetivaMM > 0.01) {
        var _selFontSize = (selagemEfetivaMM < 15) ? 5 : 12;
        drawCotaV(groupCotas, xCotaV2, yArteTopCentro, yTopo,
                  fmt2(selagemEfetivaMM) + " mm", corCota, _selFontSize);
    }
}

// ============================================================
// MODO PE — HELPER: FACE DEITADA (frente + verso)
// ============================================================
// Faces DEITADAS (90° em relação à em pé) — compMM vai na
// horizontal, largMM na vertical. Frente e verso são ESPELHADAS
// com os fundos arredondados voltados para o centro do layout:
//   FRENTE (isFrente=true)  → fundo à DIREITA, topo à ESQUERDA
//   VERSO  (isFrente=false) → fundo à ESQUERDA, topo à DIREITA
// Fotocélula desenhada apenas na frente.
function _desenharFacePE_Deitada(topMaterial, topArte, topCotas, xStart, yStart,
                                 largMM, compMM, selagemMM, fundoMM, recuoMM,
                                 nomeGrupo, queijoData, arteData, isFrente) {
    var compPt    = mm2pt(compMM);
    var largPt    = mm2pt(largMM);
    var selagemPt = mm2pt(selagemMM);
    var margemLat = mm2pt(recuoMM);

    var R_eff = _peRadiusEffMM(largMM, compMM);

    var corFundo   = cmyk(15, 12, 12, 0);
    var corFaca    = cmyk(0, 0, 0, 60);
    var corCota    = cmyk(0, 0, 0, 60);
    var corCyan    = cmyk(70, 10, 16, 0);
    var corMagenta = cmyk(0, 100, 0, 0);
    var corPreto   = cmyk(0, 0, 0, 100);

    var xMatIni = xStart;
    var xMatFim = xStart + compPt;
    var yTopo   = yStart;
    var yBot    = yTopo - largPt;
    var yCentro = (yTopo + yBot) / 2;

    // As duas faces são ESPELHADAS com os fundos arredondados voltados para o
    // CENTRO do layout (encostando-se perto do × de registro) e os topos retos
    // nas extremidades EXTERNAS do layout.
    //   FRENTE (bloco esquerdo) → fundo à DIREITA, topo à ESQUERDA
    //   VERSO  (bloco direito)  → fundo à ESQUERDA, topo à DIREITA
    var fundoAEsquerda = !isFrente;

    // Linha de referência: margem mínima do fundo (PE_MARGEM_FUNDO_MM do vale
    // do fundo arredondado, do lado onde fica o fundo da face).
    var xLinhaMargemFundo = fundoAEsquerda ? (xMatIni + mm2pt(PE_MARGEM_FUNDO_MM))
                                           : (xMatFim - mm2pt(PE_MARGEM_FUNDO_MM));

    var groupMaterial = topMaterial.groupItems.add(); if (nomeGrupo) groupMaterial.name = nomeGrupo;
    var groupArte     = topArte.groupItems.add();     if (nomeGrupo) groupArte.name     = nomeGrupo;
    var groupCotas    = topCotas.groupItems.add();    if (nomeGrupo) groupCotas.name    = nomeGrupo;

    // 1. MATERIAL (fundo arredondado à esquerda ou à direita, conforme fundoAEsquerda)
    drawPEMaterialDeitado(groupMaterial, xMatIni, yTopo, compMM, largMM, fundoAEsquerda, corFundo);

    // 2. ARTE + (opcional) QUEIJO
    var xArteIni, xArteFim, yArteTopLocal, yArteBotLocal;
    var arteLargVertMM;   // dimensão vertical da arte (no deitado) = largura original no em pé
    var arteLargHorizMM;  // dimensão horizontal da arte (no deitado) = comp útil = tamanho original
    var distFundoEfetivoMM, selagemEfetivaMM;

    function _queijoBBoxPEDeitado() {
        // No deitado, queijoData.larg (horizontal em pé) → vertical; queijoData.comp → horizontal
        var yQB = yCentro - mm2pt(queijoData.larg / 2);
        var yQT = yCentro + mm2pt(queijoData.larg / 2);
        // Queijo posicionado a queijoData.alt/2 diretamente do vale do fundo arredondado
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
        // Arte posicionada a partir da margem interna (10mm do fundo) em direção ao interior
        var arteL, arteR;
        if (fundoAEsquerda) {
            arteL = xLinhaMargemFundo + mm2pt(aFundo);
            arteR = arteL + mm2pt(aInfo.tamanho);
        } else {
            arteR = xLinhaMargemFundo - mm2pt(aFundo);
            arteL = arteR - mm2pt(aInfo.tamanho);
        }
        if (arteData.redonda) {
            _drawFilledEllipse(groupArte, (arteL + arteR) / 2, yCentro,
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
        arteLargVertMM  = aInfo.largura;
        arteLargHorizMM = aInfo.tamanho;
        distFundoEfetivoMM = aFundo;
        selagemEfetivaMM   = compMM - PE_MARGEM_FUNDO_MM - aFundo - aInfo.tamanho;
    } else if (queijoData && !queijoData.bordaCaida) {
        // Modo B/D: arte centrada no queijo
        var bbox = _queijoBBoxPEDeitado();
        var offPt = mm2pt(recuoMM);
        if (queijoData.redondo) {
            _drawDashedEllipse(groupCotas, bbox.cx, bbox.cy,
                               bbox.right - bbox.left, bbox.top - bbox.bot,
                               corMagenta, "Queijo");
            _drawFilledEllipse(groupArte, bbox.cx, bbox.cy,
                               bbox.right - bbox.left + 2 * offPt,
                               bbox.top - bbox.bot + 2 * offPt,
                               corCyan, "Arte");
        } else {
            _drawDashedRect(groupCotas, bbox.left, bbox.right, bbox.bot, bbox.top, corMagenta, "Queijo");
            var arteLq = bbox.left - offPt;
            var arteRq = bbox.right + offPt;
            var arteBq = bbox.bot - offPt;
            var arteTq = bbox.top + offPt;
            var arteShapeQ = groupArte.pathItems.rectangle(arteTq, arteLq, arteRq - arteLq, arteTq - arteBq);
            arteShapeQ.filled = true; arteShapeQ.stroked = false; arteShapeQ.fillColor = corCyan;
            arteShapeQ.name = "Arte";
        }
        xArteIni = bbox.left - offPt;
        xArteFim = bbox.right + offPt;
        yArteTopLocal = bbox.top + offPt;
        yArteBotLocal = bbox.bot - offPt;
        arteLargVertMM  = queijoData.larg + 2 * recuoMM;
        arteLargHorizMM = queijoData.comp + 2 * recuoMM;
        distFundoEfetivoMM = queijoData.alt / 2 - recuoMM;
        selagemEfetivaMM   = compMM - PE_MARGEM_FUNDO_MM - distFundoEfetivoMM - arteLargHorizMM;
    } else {
        // Modo A, C, E: arte com fundo arredondado (R_arte = R_eff - recuo)
        yArteTopLocal = yTopo - margemLat;
        yArteBotLocal = yBot + margemLat;
        // Arte posicionada conforme orientação: selagem ao lado do topo reto,
        // fundo arredondado da arte ao lado do fundo do material
        if (fundoAEsquerda) {
            xArteIni = xLinhaMargemFundo + mm2pt(fundoMM);
            xArteFim = xMatFim - selagemPt;
        } else {
            xArteFim = xLinhaMargemFundo - mm2pt(fundoMM);
            xArteIni = xMatIni + selagemPt;
        }
        var R_arte = R_eff - recuoMM;
        drawPEArteDeitada(groupArte, xArteIni, xArteFim, yArteTopLocal, yArteBotLocal,
                          R_arte, fundoAEsquerda, corCyan);
        arteLargVertMM  = largMM - 2 * recuoMM;
        arteLargHorizMM = compMM - selagemMM - PE_MARGEM_FUNDO_MM - fundoMM;
        distFundoEfetivoMM = fundoMM;
        selagemEfetivaMM   = selagemMM;

        // Modo C/E: queijo tracejado sobre a arte
        if (queijoData && queijoData.bordaCaida) {
            var bbox3 = _queijoBBoxPEDeitado();
            if (queijoData.redondo) {
                _drawDashedEllipse(groupCotas, bbox3.cx, bbox3.cy,
                                   bbox3.right - bbox3.left, bbox3.top - bbox3.bot,
                                   corMagenta, "Queijo");
            } else {
                _drawDashedRect(groupCotas, bbox3.left, bbox3.right, bbox3.bot, bbox3.top, corMagenta, "Queijo");
            }
        }
    }

    // 2b. FOTOCÉLULA DEITADA (somente na frente, 20×5mm horizontal, parte baixa)
    //     Fica junto à extremidade do topo reto (lado externo do layout),
    //     próxima ao fundo da face deitada.
    if (isFrente) {
        var fotoW = mm2pt(20), fotoH = mm2pt(5);
        // 5mm da borda do topo reto (lado externo); 5mm acima do fundo da face
        var fotoLeft = fundoAEsquerda ? (xMatFim - mm2pt(25))   // topo à direita → foto à direita (5 borda + 20 largura)
                                       : (xMatIni + mm2pt(5));  // topo à esquerda → foto à esquerda
        var fotoTop  = yBot + mm2pt(10);  // borda superior = yBot + 10 (5mm do fundo + 5mm de altura)
        var fotocel = groupArte.pathItems.rectangle(fotoTop, fotoLeft, fotoW, fotoH);
        fotocel.filled = true; fotocel.stroked = false;
        fotocel.fillColor = corPreto;
        fotocel.name = "Fotocélula";
    }

    // 3. (Sem simulação de solda no PE — área do fundo é apenas reserva geométrica)

    // 4. COTAS HORIZONTAIS (acima do topo) — medidas do COMPRIMENTO
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);
    drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, fmt(compMM) + " mm", corCota);

    var _dfFontSize = (distFundoEfetivoMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;
    var _selFontSize = (selagemEfetivaMM < 15) ? 5 : 12;
    // Em modo queijo SEM borda caída (B/D), a cota de 5mm de margem não se aplica
    var _pe_temQueijoSemBorda = (queijoData && !queijoData.bordaCaida);

    if (fundoAEsquerda) {
        // Verso: [margem][fundoMM][arte][selagemMM] — fundo à esquerda, selagem à direita
        if (!_pe_temQueijoSemBorda) {
            drawCotaH(groupCotas, xMatIni, xLinhaMargemFundo, yCota2, fmt(PE_MARGEM_FUNDO_MM) + " mm", corCota, 5);
        }
        if (distFundoEfetivoMM > 0.01) {
            var _xBaseDistFundo = _pe_temQueijoSemBorda ? xMatIni : xLinhaMargemFundo;
            drawCotaH(groupCotas, _xBaseDistFundo, xArteIni, yCota2,
                      fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
        }
        drawCotaH(groupCotas, xArteIni, xArteFim, yCota2, fmt2(arteLargHorizMM) + " mm", corCota);
        if (selagemEfetivaMM > 0.01) {
            drawCotaH(groupCotas, xArteFim, xMatFim, yCota2, fmt2(selagemEfetivaMM) + " mm", corCota, _selFontSize);
        }
    } else {
        // Frente: [selagemMM][arte][fundoMM][margem] — selagem à esquerda, fundo à direita
        if (selagemEfetivaMM > 0.01) {
            drawCotaH(groupCotas, xMatIni, xArteIni, yCota2, fmt2(selagemEfetivaMM) + " mm", corCota, _selFontSize);
        }
        drawCotaH(groupCotas, xArteIni, xArteFim, yCota2, fmt2(arteLargHorizMM) + " mm", corCota);
        if (distFundoEfetivoMM > 0.01) {
            var _xEndDistFundo = _pe_temQueijoSemBorda ? xMatFim : xLinhaMargemFundo;
            drawCotaH(groupCotas, xArteFim, _xEndDistFundo, yCota2,
                      fmt2(distFundoEfetivoMM) + " mm", corCota, _dfFontSize);
        }
        if (!_pe_temQueijoSemBorda) {
            drawCotaH(groupCotas, xLinhaMargemFundo, xMatFim, yCota2, fmt(PE_MARGEM_FUNDO_MM) + " mm", corCota, 5);
        }
    }

    // 5. COTAS VERTICAIS (medidas da LARGURA) — à esquerda da frente, à direita
    //    do verso, SEMPRE na extremidade EXTERNA do layout (lado do topo reto).
    //    Evita cotas no centro do layout (entre as duas peças).
    var xCotaV1, xCotaV2;
    if (fundoAEsquerda) {
        // Verso: cotas à DIREITA (lado do topo reto = lado externo do layout)
        xCotaV1 = xMatFim + mm2pt(14);
        xCotaV2 = xMatFim + mm2pt(5);
    } else {
        // Frente: cotas à ESQUERDA (lado do topo reto = lado externo do layout)
        xCotaV1 = xMatIni - mm2pt(14);
        xCotaV2 = xMatIni - mm2pt(5);
    }
    drawCotaV(groupCotas, xCotaV1, yTopo, yBot, fmt(largMM) + " mm", corCota, 12, false, fundoAEsquerda);

    var margemLateralMM = (largMM - arteLargVertMM) / 2;
    if (margemLateralMM > 0.01) {
        var _latFontSize2 = (margemLateralMM < 15 || (queijoData && queijoData.bordaCaida)) ? 5 : 12;
        drawCotaV(groupCotas, xCotaV2, yTopo, yArteTopLocal,
                  fmt2(margemLateralMM) + " mm", corCota, _latFontSize2, false, fundoAEsquerda);
        drawCotaV(groupCotas, xCotaV2, yArteTopLocal, yArteBotLocal,
                  fmt2(arteLargVertMM) + " mm", corCota, 12, false, fundoAEsquerda);
        drawCotaV(groupCotas, xCotaV2, yArteBotLocal, yBot,
                  fmt2(margemLateralMM) + " mm", corCota, _latFontSize2, false, fundoAEsquerda);
    } else {
        drawCotaV(groupCotas, xCotaV2, yArteTopLocal, yArteBotLocal,
                  fmt2(arteLargVertMM) + " mm", corCota, 12, false, fundoAEsquerda);
    }
}