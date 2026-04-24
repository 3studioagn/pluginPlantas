// ==========================================
// SCRIPT: Nylon Poli v2.25
// Laminado Nylon + Poliolefina — pouch plano com soldas laterais de 7,5 mm.
// Derivado do PE v1.0 (adiciona marcação de faca nas soldas).
// ==========================================

function mm2pt(mm) { return mm * 2.83465; }

// Formata número como string com vírgula decimal (padrão BR)
function fmt(n) { return String(n).replace('.', ','); }

// Formata número arredondado para 1 casa decimal
function fmt2(n) {
    var r = Math.round(n * 10) / 10;
    return String(r).replace('.', ',');
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
    return null; // fallback: usa fonte padrão
}

function applyArialBold(t) {
    var f = getArialBold();
    if (f) try { t.textRange.characterAttributes.textFont = f; } catch(e) {}
}

// --- FUNÇÕES DE DESENHO ---
function drawRect(layer, top, left, w, h, color) {
    var rect = layer.pathItems.rectangle(top, left, w, h);
    rect.filled = true;
    rect.stroked = false;
    rect.fillColor = color;
    return rect;
}

function drawLine(layer, x1, y1, x2, y2, color, strokeW, dashed) {
    var line = layer.pathItems.add();
    line.setEntirePath([[x1, y1], [x2, y2]]);
    line.filled = false;
    line.stroked = true;
    line.strokeColor = color;
    line.strokeWidth = 1;
    if (dashed) line.strokeDashes = [5, 5];
    return line;
}

// Retângulo tracejado (sem preenchimento) — usado na simulação do queijo.
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

// Elipse tracejada centrada em (cx, cy) com dimensões (w, h). Queijo redondo.
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

// Elipse preenchida centrada em (cx, cy). Usada para arte redonda.
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

// Fotocélula: marca de referência preta 100% para sensores fotoelétricos.
// (x, y) = canto superior esquerdo. (w, h) = dimensões em pt.
function _drawFotocelulaNP(group, x, y, w, h) {
    var corFoto = cmyk(0, 0, 0, 100);
    var rect = group.pathItems.rectangle(y, x, w, h);
    rect.filled = true;
    rect.stroked = false;
    rect.fillColor = corFoto;
    rect.name = "Fotocelula";
    return rect;
}

// --- FUNÇÕES DE TEXTO E COTAS ---
function drawCotaH(layer, x1, x2, y, textStr, color, fontSize, verticalLabel) {
    if (fontSize === undefined) fontSize = 12;
    var tickH = mm2pt(1);
    var group = layer.groupItems.add();

    // Linha principal
    var line = group.pathItems.add();
    line.setEntirePath([[x1, y], [x2, y]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;

    // Barra perpendicular esquerda
    var b1 = group.pathItems.add();
    b1.setEntirePath([[x1, y + tickH], [x1, y - tickH]]);
    b1.filled = false; b1.stroked = true;
    b1.strokeColor = color; b1.strokeWidth = 1;

    // Barra perpendicular direita
    var b2 = group.pathItems.add();
    b2.setEntirePath([[x2, y + tickH], [x2, y - tickH]]);
    b2.filled = false; b2.stroked = true;
    b2.strokeColor = color; b2.strokeWidth = 1;

    // Texto horizontal centralizado (acima da linha)
    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.top  = y + mm2pt(2) + t.height;
        t.left = x1 + ((x2 - x1) / 2) - (t.width / 2);
    }

    // Texto vertical rotacionado 90° (para labels de faixas estreitas)
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

function drawCotaV(layer, x, y1, y2, textStr, color, fontSize, centered, textRight) {
    if (fontSize === undefined) fontSize = 12;
    if (centered === undefined) centered = false;
    if (textRight === undefined) textRight = false;
    var tickW = mm2pt(1);
    var group = layer.groupItems.add();

    // Linha principal
    var line = group.pathItems.add();
    line.setEntirePath([[x, y1], [x, y2]]);
    line.filled = false; line.stroked = true;
    line.strokeColor = color; line.strokeWidth = 1;

    // Barra perpendicular superior
    var b1 = group.pathItems.add();
    b1.setEntirePath([[x - tickW, y1], [x + tickW, y1]]);
    b1.filled = false; b1.stroked = true;
    b1.strokeColor = color; b1.strokeWidth = 1;

    // Barra perpendicular inferior
    var b2 = group.pathItems.add();
    b2.setEntirePath([[x - tickW, y2], [x + tickW, y2]]);
    b2.filled = false; b2.stroked = true;
    b2.strokeColor = color; b2.strokeWidth = 1;

    // Texto rotacionado 90° (frente) ou -90° (verso, textRight)
    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.rotate(textRight ? -90 : 90);
        t.top  = (y1 + y2) / 2 + (t.height / 2);
        if (textRight) {
            t.left = x + mm2pt(2);
        } else if (centered) {
            t.left = x - t.width / 2;
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

// --- HELPER: desenha a arte dentro de uma ÁREA ÚTIL retangular ---
// Encapsula a lógica dos modos:
//   - Default: arte retangular preenchendo a área
//   - Queijo sem borda caída: queijo tracejado em Cotas + arte (retang./elíptica) com recuo dentro
//   - Queijo com borda caída: arte preenchendo a área + queijo tracejado em Cotas overlay
//   - Arte custom: arte (retang./elíptica) com dimensões do usuário
// Argumentos:
//   groupArte, groupCotas: destinos da arte e das linhas tracejadas
//   areaLeft, areaTop: canto superior-esquerdo da área (areaTop = Y mais alto, Y-up)
//   areaW, areaH: dimensões da área (pt)
//   corCyan, corMagenta: cores
//   nomeGrupo: "Frente" ou "Verso" (para escolher dados arte per-face e direção do "fundo")
//   queijoData, arteData: configurações (null se modo default)
//   recuoMM: recuo desta face (5 na frente, 10 no verso normalmente)
//   deitado: se true, simulação do queijo e arte gira 90° (uso no layout horizontal duplo,
//     onde a peça impressa está deitada e o produto montado está em pé)
// Retorna {arteLeft, arteRight, arteTop, arteBot, arteWidthMM} para eventuais cotas.
// --- VALIDAÇÃO: arte deve ter pelo menos 5mm de respiro das soldas ---
// Semântica: recuoMM positivo = arte EXPANDE (maior que queijo por lado)
//            recuoMM negativo = arte RECUA (menor que queijo por lado)
// - Solda lateral (normal): solda 7,5mm + 5mm respiro = 12,5mm de margem mínima cada lado
// - Solda fundo: lateral 5mm + 5mm respiro = 10mm cada lado
// - Solda fundo + queijo: base da arte = alt/2 − recuoMM acima da solda (>= 5mm)
// Retorna string de erro ou null.
function _validarArteNP(largMM, soldaFundo, recuoMM, queijoData, arteData, fundoMM) {
    var margTotal = soldaFundo ? 10 : 12.5;  // solda + 5mm respiro mínimo
    var maxLargPermitida = largMM - 2 * margTotal;
    var nomeSolda = soldaFundo ? "lateral de 5mm" : "solda lateral de 7,5mm";

    // Largura lateral da arte (dimensão "largura" no produto montado)
    function _larguraArte(face) {
        if (arteData) {
            var aInfo = (face === "verso" && arteData.verso) ? arteData.verso : arteData.frente;
            return aInfo.largura;
        }
        if (queijoData && !queijoData.bordaCaida) {
            // Nova semântica: recuoMM positivo = arte expande; verso tem recuoMM - 5
            var rFace = (face === "verso") ? (recuoMM - 5) : recuoMM;
            return queijoData.larg + 2 * rFace;
        }
        return null;  // default ou borda caída: arte preenche área útil — aceito
    }

    var faces = ["frente"];
    if (arteData && arteData.verso) faces.push("verso");
    else if (queijoData) faces.push("verso");

    for (var i = 0; i < faces.length; i++) {
        var lA = _larguraArte(faces[i]);
        if (lA === null) continue;
        if (lA > maxLargPermitida + 0.01) {
            var respiroAtual = (largMM - lA) / 2 - (soldaFundo ? 5 : 7.5);
            return "A arte (" + faces[i] + ") tem largura " + fmt2(lA) +
                   "mm e fica a apenas " + fmt2(respiroAtual) + "mm da " + nomeSolda +
                   ".\nÉ preciso pelo menos 5mm de respiro.\n" +
                   "Largura máxima permitida: " + fmt2(maxLargPermitida) +
                   "mm (largura do material: " + largMM + "mm).";
        }
    }

    // Solda fundo: queijo em pé — base da arte = alt/2 − recuoMM acima da solda
    if (soldaFundo && queijoData && !queijoData.bordaCaida) {
        var distBaseArte = queijoData.alt / 2 - recuoMM;
        if (distBaseArte < 5 - 0.01) {
            var desloStr = (recuoMM >= 0 ? "+" : "") + recuoMM + "mm";
            return "Em solda fundo, a base da arte fica a " + fmt2(distBaseArte) +
                   "mm da solda do fundo — é preciso pelo menos 5mm.\n" +
                   "Aumente a altura do queijo ou reduza o deslocamento da arte.\n" +
                   "(Altura atual: " + queijoData.alt + "mm, deslocamento: " + desloStr + ")";
        }
    }

    return null;
}

function _drawArteNP(groupArte, groupCotas, areaLeft, areaTop, areaW, areaH,
                     corCyan, corMagenta, nomeGrupo, queijoData, arteData, recuoMM, deitado) {
    deitado = !!deitado;
    var areaRight = areaLeft + areaW;
    var areaBot   = areaTop  - areaH;
    var areaCx    = (areaLeft + areaRight) / 2;
    var areaCy    = (areaTop  + areaBot)  / 2;
    var isFrente  = (nomeGrupo === "Frente");
    var res = {};

    function _fillRect(top, left, w, h) {
        var r = groupArte.pathItems.rectangle(top, left, w, h);
        r.filled = true; r.stroked = false; r.fillColor = corCyan;
        r.name = "Arte";
    }

    if (arteData) {
        // ---- MODO ARTE CUSTOM ----
        // Em pé: largura horizontal, tamanho vertical, distFundo = distância vertical (base da área até base da arte)
        // Deitado: tamanho horizontal, largura vertical, distFundo = distância horizontal
        //          (borda interna — junto à dobra central — até a borda interna da arte)
        //          Frente: borda interna = direita; Verso: borda interna = esquerda.
        var aInfo = isFrente ? arteData.frente : (arteData.verso || arteData.frente);
        var aW = mm2pt(deitado ? aInfo.tamanho : aInfo.largura);
        var aH = mm2pt(deitado ? aInfo.largura : aInfo.tamanho);
        var aLeft, aRight, aTop, aBot;
        if (deitado) {
            // Centralizado vertical, posicionado horizontal por distFundo (a partir da borda interna)
            aTop  = areaCy + aH / 2;
            aBot  = aTop - aH;
            if (isFrente) {
                aRight = areaRight - mm2pt(aInfo.distFundo);
                aLeft  = aRight - aW;
            } else {
                aLeft  = areaLeft + mm2pt(aInfo.distFundo);
                aRight = aLeft + aW;
            }
        } else {
            // Centralizado horizontal, posicionado vertical por distFundo (a partir da borda inferior)
            aLeft = areaCx - aW / 2;
            aBot  = areaBot + mm2pt(aInfo.distFundo);
            aTop  = aBot + aH;
            aRight = aLeft + aW;
        }
        var aCx = (aLeft + aRight) / 2;
        var aCy = (aTop + aBot) / 2;
        if (arteData.redonda) {
            _drawFilledEllipse(groupArte, aCx, aCy, aW, aH, corCyan, "Arte");
        } else {
            _fillRect(aTop, aLeft, aW, aH);
        }
        res = { arteLeft: aLeft, arteRight: aRight, arteTop: aTop, arteBot: aBot,
                arteWidthMM: deitado ? aInfo.tamanho : aInfo.largura };
    } else if (queijoData) {
        // ---- MODO QUEIJO ----
        // Em pé: queijo larg horizontal, comp vertical (orientação do produto em pé)
        // Deitado: queijo gira 90° (comp horizontal, larg vertical)
        // A altura do queijo (eixo Z, profundidade) é dividida por 2 para determinar
        // onde a simulação começa: alt/2 acima da base (em pé) ou alt/2 da borda interna (deitado).
        var qW = mm2pt(deitado ? queijoData.comp : queijoData.larg);
        var qH = mm2pt(deitado ? queijoData.larg : queijoData.comp);
        var altOffsetPt = mm2pt(queijoData.alt / 2);
        var qLeft, qRight, qTop, qBot;
        if (deitado) {
            // Centralizado vertical; alt/2 da borda interna (junto à dobra central)
            qTop = areaCy + qH / 2;
            qBot = qTop - qH;
            if (isFrente) {
                qRight = areaRight - altOffsetPt;
                qLeft  = qRight - qW;
            } else {
                qLeft  = areaLeft + altOffsetPt;
                qRight = qLeft + qW;
            }
        } else {
            // Em pé: centralizado horizontal; base a alt/2 acima da base da área
            qLeft  = areaCx - qW / 2;
            qRight = qLeft + qW;
            qBot   = areaBot + altOffsetPt;
            qTop   = qBot + qH;
        }
        var qCx = (qLeft + qRight) / 2;
        var qCy = (qTop  + qBot)  / 2;

        // Queijo tracejado magenta vai em groupCotas (linha de referência)
        if (queijoData.redondo) {
            _drawDashedEllipse(groupCotas, qCx, qCy, qW, qH, corMagenta, "Queijo");
        } else {
            _drawDashedRect(groupCotas, qLeft, qRight, qBot, qTop, corMagenta, "Queijo");
        }

        if (queijoData.bordaCaida) {
            _fillRect(areaTop, areaLeft, areaW, areaH);
            res = { arteLeft: areaLeft, arteRight: areaRight, arteTop: areaTop, arteBot: areaBot,
                    arteWidthMM: areaW / 2.83465 };
        } else {
            // Nova semântica: recuoMM positivo = arte EXPANDE (maior que queijo)
            //                 recuoMM negativo = arte RECUA (menor que queijo)
            var offPt = mm2pt(recuoMM);
            var aW2 = qW + 2 * offPt;
            var aH2 = qH + 2 * offPt;
            var aLeft2 = qLeft - offPt;
            var aTop2  = qTop  + offPt;
            if (queijoData.redondo) {
                _drawFilledEllipse(groupArte, qCx, qCy, aW2, aH2, corCyan, "Arte");
            } else {
                _fillRect(aTop2, aLeft2, aW2, aH2);
            }
            res = { arteLeft: aLeft2, arteRight: aLeft2 + aW2, arteTop: aTop2, arteBot: aTop2 - aH2,
                    arteWidthMM: (deitado ? queijoData.comp : queijoData.larg) + 2 * recuoMM };
        }
    } else {
        // ---- MODO DEFAULT: arte preenche a área ----
        _fillRect(areaTop, areaLeft, areaW, areaH);
        res = { arteLeft: areaLeft, arteRight: areaRight, arteTop: areaTop, arteBot: areaBot,
                arteWidthMM: areaW / 2.83465 };
    }

    return res;
}

// --- INTERFACE ---
var dlg = new Window("dialog", "Gerador: Nylon Poli v2.25");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group"); g1.add("statictext", undefined, "Comprimento Face (mm):");
var inputComp = g1.add("edittext", undefined, "260"); inputComp.characters = 5;

var g2 = dlg.add("group"); g2.add("statictext", undefined, "Largura/Altura (mm):");
var inputLarg = g2.add("edittext", undefined, "160"); inputLarg.characters = 5;

var g3 = dlg.add("group"); g3.add("statictext", undefined, "Área de Selagem (mm):");
var inputSelagem = g3.add("edittext", undefined, "45"); inputSelagem.characters = 5;

var g4 = dlg.add("group"); g4.add("statictext", undefined, "Distância de Fundo (mm):");
var inputFundo = g4.add("edittext", undefined, "10"); inputFundo.characters = 5;

var g5 = dlg.add("group"); g5.alignChildren = "right";
var inputFrente = g5.add("checkbox", undefined, "Somente frente");

var g6 = dlg.add("group"); g6.alignChildren = "right";
var inputSoldaFundo = g6.add("checkbox", undefined, "Solda Fundo");

// --- Tamanho do queijo (toggle + painel) — mutuamente exclusivo com arte custom ---
var gQueijoChk = dlg.add("group"); gQueijoChk.alignChildren = "right";
var inputQueijo = gQueijoChk.add("checkbox", undefined, "Tamanho do queijo");

var panelQueijo = dlg.add("panel", undefined, "Dimensões do queijo");
panelQueijo.orientation = "column"; panelQueijo.alignChildren = "right";
panelQueijo.margins = 12; panelQueijo.visible = false;

var gqDiam = panelQueijo.add("group"); gqDiam.add("statictext", undefined, "Diâmetro (mm):");
var inputQDiam = gqDiam.add("edittext", undefined, "120"); inputQDiam.characters = 5;
gqDiam.visible = false;

var gq1 = panelQueijo.add("group"); gq1.add("statictext", undefined, "Comprimento (mm):");
var inputQComp = gq1.add("edittext", undefined, "180"); inputQComp.characters = 5;

var gq2 = panelQueijo.add("group"); gq2.add("statictext", undefined, "Largura (mm):");
var inputQLarg = gq2.add("edittext", undefined, "120"); inputQLarg.characters = 5;

var gq3 = panelQueijo.add("group"); gq3.add("statictext", undefined, "Altura (mm):");
var inputQAlt = gq3.add("edittext", undefined, "60"); inputQAlt.characters = 5;

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
        inputArte.value = false;
        inputARedonda.value = false;
        panelArte.visible = false;
    }
    panelQueijo.visible = this.value;
    gBorda.visible = this.value;
    // Distância de Fundo principal fica anulada em queijo/arte
    inputFundo.enabled = !this.value && !inputArte.value;
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
        inputQueijo.value = false;
        panelQueijo.visible = false;
        gBorda.visible = false;
        inputBorda.value = false;
        inputQRedondo.value = false;
        gqDiam.visible = false; gq1.visible = true; gq2.visible = true;
    } else {
        inputARedonda.value = false;
    }
    panelArte.visible = this.value;
    inputFundo.enabled = !this.value && !inputQueijo.value;
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
    _updateArteVisibility();
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputBorda.onClick = function() {
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
    var f = parseFloat(inputFundo.text.replace(',', '.'));
    var r = _parseDeslo(inputRecuo.text);
    var sf = inputSoldaFundo.value;
    var queijoData = null;
    var arteData   = null;
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
        if (inputBorda.value) r = 5;
        // Em modo queijo sem borda caída: selagem e fundo zerados (arte segue queijo + recuo)
        // Em modo queijo + borda caída: arte preenche área útil, usa selagem do input (45mm padrão)
        f = inputBorda.value ? 5 : 0;
        s = inputBorda.value ? parseFloat(inputSelagem.text.replace(',', '.')) : 0;
        if (isNaN(s)) s = 45;
    } else if (inputArte.value) {
        var redonda = inputARedonda.value;
        var atF, alF, atV, alV;
        if (redonda) {
            atF = parseFloat(inputADiamF.text.replace(',', '.')); alF = atF;
            atV = parseFloat(inputADiamV.text.replace(',', '.')); alV = atV;
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
            // Em arte mode, a distância de fundo principal é anulada — cada face usa a sua.
            f = 0;
            s = 0;
        }
    }
    if (isNaN(c) || isNaN(l) || isNaN(s) || isNaN(f) || isNaN(r)) {
        alert("Erro: Digite valores válidos.");
    } else if (inputFrente.value) {
        desenharNP_Frente(c, l, s, f, sf, r, queijoData, arteData);
    } else {
        desenharNP_Completo(c, l, s, f, sf, r, queijoData, arteData);
    }
}

// --- LÓGICA PRINCIPAL ---
function desenharNP_Completo(compMM, largMM, selagemMM, fundoMM, soldaFundo, recuoMM, queijoData, arteData) {
    if (soldaFundo) {
        return desenharNP_DuploSF(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData);
    }
    var compPt     = mm2pt(compMM);
    var largPt     = mm2pt(largMM);
    var selagemPt  = mm2pt(selagemMM);
    var fundoPt    = mm2pt(fundoMM);
    var soldaLat   = mm2pt(7.5);                // faixa de solda (topo e fundo)
    var margemArte = mm2pt(5);                  // respiro entre solda e arte
    var margemVert = soldaLat + margemArte;     // 12,5 mm — do topo/fundo até o início da arte

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);

    var totalPouchW = compPt * 2;
    var totalPouchH = largPt;

    // Validação: área útil de cada face precisa sobrar
    var cyanW = compPt - selagemPt - fundoPt;
    var cyanH = largPt - (margemVert * 2);
    if (cyanW <= 0 || cyanH <= 0) {
        alert("Erro: os valores de selagem/fundo excedem o material.");
        return;
    }

    // Validação: arte não invade margens de segurança (horizontal duplo é sempre solda lateral)
    var _err = _validarArteNP(largMM, false, recuoMM, queijoData, arteData, fundoMM);
    if (_err) { alert(_err); return; }

    var docW = totalPouchW + (marginX * 2);
    var docH = totalPouchH + (marginY * 2);

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;

    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var corFundo = cmyk(15, 12, 12, 0);
    var corFaca  = cmyk(0, 0, 0, 60);
    var corCota  = cmyk(0, 0, 0, 60);
    var corCyan  = cmyk(70, 10, 16, 0);
    var corMagenta = cmyk(0, 100, 0, 0);

    // Centraliza o conteúdo na prancheta
    var ab = doc.artboards[0].artboardRect; // [left, top, right, bottom]
    var x0 = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // --- EIXOS X ---
    var xPouchIni = x0;
    var xCentro   = xPouchIni + compPt;
    var xPouchFim = xCentro   + compPt;

    // --- EIXOS Y ---
    var yTopo  = y0;
    var yFundo = yTopo - largPt;

    // =======================================
    // 1. GRUPOS TOP-LEVEL (ordem de criação = z-order de baixo pra cima)
    // =======================================
    var groupMaterial   = layerV1.groupItems.add(); groupMaterial.name   = "Material";
    var groupArte       = layerV1.groupItems.add(); groupArte.name       = "Arte";
    var groupCotas      = layerV1.groupItems.add(); groupCotas.name      = "Cotas";

    // Material (base cinza, único cobrindo as duas faces + dobra)
    var rectMaterial = drawRect(groupMaterial, yTopo, xPouchIni, totalPouchW, totalPouchH, corFundo);
    rectMaterial.name = "Material";

    // =======================================
    // 2. ÁREAS ÚTEIS (CYAN) — uma por face
    // =======================================
    var cyanTop = yTopo - margemVert;

    // Face esquerda (Frente): selagem na borda externa esquerda, fundo no centro
    var cyanEsqLeft = xPouchIni + selagemPt;
    var resF = _drawArteNP(groupArte, groupCotas, cyanEsqLeft, cyanTop, cyanW, cyanH,
                           corCyan, corMagenta, "Frente", queijoData, arteData, recuoMM, true);

    // Face direita (Verso): fundo no centro, selagem na borda externa direita
    var cyanDirLeft = xCentro + fundoPt;
    var versoRecuo = (queijoData && !queijoData.bordaCaida) ? recuoMM - 5 : recuoMM;
    var resV = _drawArteNP(groupArte, groupCotas, cyanDirLeft, cyanTop, cyanW, cyanH,
                           corCyan, corMagenta, "Verso", queijoData, arteData, versoRecuo, true);

    // Fotocélula DEITADA na frente (40W × 5H), 5mm da extremidade esquerda
    // + 5mm acima da solda lateral inferior (lado de baixo)
    var ySoldaFundo_foto = yFundo + soldaLat;  // limite interno da solda inferior
    _drawFotocelulaNP(groupArte,
        xPouchIni + mm2pt(5),                  // 5mm da extremidade esquerda
        ySoldaFundo_foto + mm2pt(10),          // top: 5mm após solda + 5mm de altura
        mm2pt(40),
        mm2pt(5)
    );

    // =======================================
    // 2. LINHAS DE FACA (BORDAS, SOLDAS LATERAIS, DOBRA CENTRAL)
    // =======================================
    var ySoldaTopo  = yTopo - soldaLat;
    var ySoldaFundo = yFundo + soldaLat;

    // Labels "SOLDA" centralizados em cada quadrante (padrão stand-up)
    var meiaFacePt = compPt / 2;
    addText(groupCotas, "SOLDA", xPouchIni + meiaFacePt, yTopo  - mm2pt(3.75), 8, corCota, 0);
    addText(groupCotas, "SOLDA", xCentro   + meiaFacePt, yTopo  - mm2pt(3.75), 8, corCota, 0);
    addText(groupCotas, "SOLDA", xPouchIni + meiaFacePt, yFundo + mm2pt(3.75), 8, corCota, 0);
    addText(groupCotas, "SOLDA", xCentro   + meiaFacePt, yFundo + mm2pt(3.75), 8, corCota, 0);

    // Bordas do material
    drawLine(groupCotas, xPouchIni, yTopo,  xPouchFim, yTopo,  corFaca, 1, true);
    drawLine(groupCotas, xPouchIni, yFundo, xPouchFim, yFundo, corFaca, 1, true);

    // Limites da solda lateral
    drawLine(groupCotas, xPouchIni, ySoldaTopo,  xPouchFim, ySoldaTopo,  corFaca, 1, true);
    drawLine(groupCotas, xPouchIni, ySoldaFundo, xPouchFim, ySoldaFundo, corFaca, 1, true);

    // Dobra central
    drawLine(groupCotas, xCentro, yTopo, xCentro, yFundo, corFaca, 1, true);

    // =======================================
    // 3. COTAS HORIZONTAIS
    //    Nível 1: comprimento total (2 faces)
    //    Nível 2: comprimento por face
    //    Nível 3: faixas dentro de cada face — refletem a arte real em queijo/arte
    // =======================================
    var yCota1 = yTopo + mm2pt(25);
    var yCota2 = yTopo + mm2pt(15);
    var yCota3 = yTopo + mm2pt(6);

    drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, fmt(compMM * 2) + " mm", corCota);

    drawCotaH(groupCotas, xPouchIni, xCentro,   yCota2, fmt(compMM) + " mm", corCota);
    drawCotaH(groupCotas, xCentro,   xPouchFim, yCota2, fmt(compMM) + " mm", corCota);

    var modoCustom = (queijoData || arteData);

    if (modoCustom) {
        // Frente: selagem / margem-esq / arte-frente / margem-dir / fundo
        var arteLF_h = resF.arteLeft, arteRF_h = resF.arteRight;
        var arteWF_h = resF.arteWidthMM;
        var margEsqMM_F = (arteLF_h - (xPouchIni + selagemPt)) / 2.83465;
        var margDirMM_F = ((xCentro - fundoPt) - arteRF_h) / 2.83465;

        // Verso: análogo
        var arteLV_h = resV.arteLeft, arteRV_h = resV.arteRight;
        var arteWV_h = resV.arteWidthMM;
        var margEsqMM_V = (arteLV_h - (xCentro + fundoPt)) / 2.83465;
        var margDirMM_V = ((xPouchFim - selagemPt) - arteRV_h) / 2.83465;

        // Distâncias de fundo: margDirMM_F (frente) e margEsqMM_V (verso) — fonte 5pt se < 15
        var _fontDirF = margDirMM_F < 15 ? 5 : 12;
        var _fontEsqV = margEsqMM_V < 15 ? 5 : 12;
        var _ffH = fundoMM < 15 ? 5 : 12;

        if (selagemMM > 0) {
            drawCotaH(groupCotas, xPouchIni,             xPouchIni + selagemPt, yCota3, fmt(selagemMM)   + " mm", corCota);
        }
        if (margEsqMM_F > 0.01) {
            drawCotaH(groupCotas, xPouchIni + selagemPt, arteLF_h,              yCota3, fmt2(margEsqMM_F) + " mm", corCota);
        }
        drawCotaH(groupCotas, arteLF_h,              arteRF_h,              yCota3, fmt2(arteWF_h)    + " mm", corCota);
        if (margDirMM_F > 0.01) {
            drawCotaH(groupCotas, arteRF_h,              xCentro - fundoPt,     yCota3, fmt2(margDirMM_F) + " mm", corCota, _fontDirF);
        }
        if (fundoMM > 0) {
            drawCotaH(groupCotas, xCentro - fundoPt, xCentro,                yCota3, fmt(fundoMM) + " mm", corCota, _ffH);
            drawCotaH(groupCotas, xCentro,           xCentro + fundoPt,      yCota3, fmt(fundoMM) + " mm", corCota, _ffH);
        }
        if (margEsqMM_V > 0.01) {
            drawCotaH(groupCotas, xCentro + fundoPt,     arteLV_h,              yCota3, fmt2(margEsqMM_V) + " mm", corCota, _fontEsqV);
        }
        drawCotaH(groupCotas, arteLV_h,              arteRV_h,              yCota3, fmt2(arteWV_h)    + " mm", corCota);
        if (margDirMM_V > 0.01) {
            drawCotaH(groupCotas, arteRV_h,              xPouchFim - selagemPt, yCota3, fmt2(margDirMM_V) + " mm", corCota);
        }
        if (selagemMM > 0) {
            drawCotaH(groupCotas, xPouchFim - selagemPt, xPouchFim,             yCota3, fmt(selagemMM)    + " mm", corCota);
        }
    } else {
        var arteFaceMM = compMM - selagemMM - fundoMM;
        var _ffHd = fundoMM < 15 ? 5 : 12;
        drawCotaH(groupCotas, xPouchIni,              xPouchIni + selagemPt, yCota3, fmt(selagemMM)  + " mm", corCota);
        drawCotaH(groupCotas, xPouchIni + selagemPt,  xCentro - fundoPt,     yCota3, fmt(arteFaceMM) + " mm", corCota);
        if (fundoMM > 0) {
            drawCotaH(groupCotas, xCentro - fundoPt, xCentro,           yCota3, fmt(fundoMM) + " mm", corCota, _ffHd);
            drawCotaH(groupCotas, xCentro,           xCentro + fundoPt, yCota3, fmt(fundoMM) + " mm", corCota, _ffHd);
        }
        drawCotaH(groupCotas, xCentro + fundoPt,      xPouchFim - selagemPt, yCota3, fmt(arteFaceMM) + " mm", corCota);
        drawCotaH(groupCotas, xPouchFim - selagemPt,  xPouchFim,             yCota3, fmt(selagemMM)  + " mm", corCota);
    }

    // =======================================
    // 4. COTAS VERTICAIS — FRENTE (à esquerda)
    //    Eixo externo: largura total (largMM)
    //    Eixo interno: 7,5 (solda) / 5 (respiro) / arte / 5 (respiro) / 7,5 (solda)
    //    Em modo queijo/arte: cota refletindo a arte real da face
    // =======================================
    var xCotaV1 = x0 - mm2pt(14);
    var xCotaV2 = x0 - mm2pt(5);

    drawCotaV(groupCotas, xCotaV1, yTopo, yFundo, fmt(largMM) + " mm", corCota);

    if (modoCustom) {
        var arteTF_v = resF.arteTop, arteBF_v = resF.arteBot;
        var arteHF_v = (arteTF_v - arteBF_v) / 2.83465;
        var distTopoSoldaArteMM = (ySoldaTopo - arteTF_v) / 2.83465;
        var distArteSoldaFundoMM = (arteBF_v - ySoldaFundo) / 2.83465;

        drawCotaV(groupCotas, xCotaV2, yTopo,      ySoldaTopo,  "7,5 mm",                       corCota, 5);
        if (distTopoSoldaArteMM > 0.5) {
            drawCotaV(groupCotas, xCotaV2, ySoldaTopo, arteTF_v, fmt2(distTopoSoldaArteMM) + " mm", corCota, 5);
        }
        drawCotaV(groupCotas, xCotaV2, arteTF_v,   arteBF_v,    fmt2(arteHF_v) + " mm",         corCota);
        if (distArteSoldaFundoMM > 0.5) {
            var _ffSfF = distArteSoldaFundoMM < 15 ? 5 : 12;
            drawCotaV(groupCotas, xCotaV2, arteBF_v, ySoldaFundo, fmt2(distArteSoldaFundoMM) + " mm", corCota, _ffSfF);
        }
        drawCotaV(groupCotas, xCotaV2, ySoldaFundo, yFundo,     "7,5 mm",                       corCota, 5);
    } else {
        var yArteTopo  = yTopo - margemVert;
        var yArteFundo = yFundo + margemVert;
        drawCotaV(groupCotas, xCotaV2, yTopo,        ySoldaTopo,  "7,5 mm",                   corCota, 5);
        drawCotaV(groupCotas, xCotaV2, ySoldaTopo,   yArteTopo,   "5 mm",                     corCota, 5);
        drawCotaV(groupCotas, xCotaV2, yArteTopo,    yArteFundo,  fmt(largMM - 25) + " mm",   corCota);
        drawCotaV(groupCotas, xCotaV2, yArteFundo,   ySoldaFundo, "5 mm",                     corCota, 5);
        drawCotaV(groupCotas, xCotaV2, ySoldaFundo,  yFundo,      "7,5 mm",                   corCota, 5);
    }

    // =======================================
    // 5. COTAS VERTICAIS — VERSO (à direita, espelhadas)
    //    textRight=true para que o texto fique do lado direito da linha (entre material e cota)
    // =======================================
    var xCotaV1_v = xPouchFim + mm2pt(14);
    var xCotaV2_v = xPouchFim + mm2pt(5);

    drawCotaV(groupCotas, xCotaV1_v, yTopo, yFundo, fmt(largMM) + " mm", corCota, undefined, undefined, true);

    if (modoCustom) {
        var arteTV_v = resV.arteTop, arteBV_v = resV.arteBot;
        var arteHV_v = (arteTV_v - arteBV_v) / 2.83465;
        var distTopoSoldaArteV_MM = (ySoldaTopo - arteTV_v) / 2.83465;
        var distArteSoldaFundoV_MM = (arteBV_v - ySoldaFundo) / 2.83465;

        drawCotaV(groupCotas, xCotaV2_v, yTopo,      ySoldaTopo,  "7,5 mm",                       corCota, 5, undefined, true);
        if (distTopoSoldaArteV_MM > 0.5) {
            drawCotaV(groupCotas, xCotaV2_v, ySoldaTopo, arteTV_v, fmt2(distTopoSoldaArteV_MM) + " mm", corCota, 5, undefined, true);
        }
        drawCotaV(groupCotas, xCotaV2_v, arteTV_v,   arteBV_v,    fmt2(arteHV_v) + " mm",         corCota, undefined, undefined, true);
        if (distArteSoldaFundoV_MM > 0.5) {
            var _ffSfV = distArteSoldaFundoV_MM < 15 ? 5 : 12;
            drawCotaV(groupCotas, xCotaV2_v, arteBV_v, ySoldaFundo, fmt2(distArteSoldaFundoV_MM) + " mm", corCota, _ffSfV, undefined, true);
        }
        drawCotaV(groupCotas, xCotaV2_v, ySoldaFundo, yFundo,     "7,5 mm",                       corCota, 5, undefined, true);
    } else {
        var yArteTopo_v  = yTopo - margemVert;
        var yArteFundo_v = yFundo + margemVert;
        drawCotaV(groupCotas, xCotaV2_v, yTopo,        ySoldaTopo,  "7,5 mm",                   corCota, 5, undefined, true);
        drawCotaV(groupCotas, xCotaV2_v, ySoldaTopo,   yArteTopo_v, "5 mm",                     corCota, 5, undefined, true);
        drawCotaV(groupCotas, xCotaV2_v, yArteTopo_v,  yArteFundo_v, fmt(largMM - 25) + " mm",  corCota, undefined, undefined, true);
        drawCotaV(groupCotas, xCotaV2_v, yArteFundo_v, ySoldaFundo, "5 mm",                     corCota, 5, undefined, true);
        drawCotaV(groupCotas, xCotaV2_v, ySoldaFundo,  yFundo,      "7,5 mm",                   corCota, 5, undefined, true);
    }

    app.redraw();
    alert("Nylon Poli v2.25 gerado com sucesso!");
}

// --- LÓGICA FRENTE ÚNICA (VERTICAL) ---
function desenharNP_Frente(compMM, largMM, selagemMM, fundoMM, soldaFundo, recuoMM, queijoData, arteData) {
    var largPt    = mm2pt(largMM);
    var compPt    = mm2pt(compMM);
    var selagemPt = mm2pt(selagemMM);
    var fundoPt   = mm2pt(fundoMM);
    var margemLat = soldaFundo ? mm2pt(5) : mm2pt(12.5);

    // Validação
    var cyanW = largPt - (margemLat * 2);
    var cyanH = soldaFundo ? (compPt - selagemPt - mm2pt(10) - fundoPt)
                           : (compPt - selagemPt - fundoPt);
    if (cyanW <= 0 || cyanH <= 0) {
        alert("Erro: os valores de selagem/fundo excedem o material.");
        return;
    }

    // Validação: arte não invade margens de segurança
    var _err = _validarArteNP(largMM, soldaFundo, recuoMM, queijoData, arteData, fundoMM);
    if (_err) { alert(_err); return; }

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
    var totalPouchW = largPt;
    var totalPouchH = compPt;
    var docW = totalPouchW + (marginX * 2);
    var docH = totalPouchH + (marginY * 2);

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;
    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // Grupos top-level (ordem de criação = z-order de baixo pra cima)
    var groupMaterial   = layerV1.groupItems.add(); groupMaterial.name   = "Material";
    var groupArte       = layerV1.groupItems.add(); groupArte.name       = "Arte";
    var groupCotas      = layerV1.groupItems.add(); groupCotas.name      = "Cotas";

    _desenharFaceNP_V(groupMaterial, groupArte, groupCotas,
                      x0, y0, largMM, compMM, selagemMM, fundoMM, soldaFundo,
                      recuoMM, "Frente", queijoData, arteData);

    app.redraw();
    alert("Nylon Poli v2.25 (somente frente) gerado com sucesso!");
}

// --- LÓGICA DUPLA FACE COM SOLDA FUNDO (FRENTE + VERSO VERTICAL) ---
function desenharNP_DuploSF(compMM, largMM, selagemMM, fundoMM, recuoMM, queijoData, arteData) {
    var largPt    = mm2pt(largMM);
    var compPt    = mm2pt(compMM);
    var selagemPt = mm2pt(selagemMM);
    var fundoPt   = mm2pt(fundoMM);
    var margemLat = mm2pt(5);
    var gapFaces  = mm2pt(40);

    // Validação
    var cyanW = largPt - (margemLat * 2);
    var cyanH = compPt - selagemPt - mm2pt(10) - fundoPt;
    if (cyanW <= 0 || cyanH <= 0) {
        alert("Erro: os valores de selagem/fundo excedem o material.");
        return;
    }

    // Validação: arte não invade margens de segurança (DuploSF é sempre solda fundo)
    var _err = _validarArteNP(largMM, true, recuoMM, queijoData, arteData, fundoMM);
    if (_err) { alert(_err); return; }

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);
    var totalPouchW = (largPt * 2) + gapFaces;
    var totalPouchH = compPt;
    var docW = totalPouchW + (marginX * 2);
    var docH = totalPouchH + (marginY * 2);

    var doc = app.documents.add(DocumentColorSpace.CMYK, docW, docH);
    var defaultBlue = doc.layers[0].color;
    var layerV1 = doc.layers.add(); layerV1.name = "V1"; layerV1.color = defaultBlue;
    doc.layers[doc.layers.length - 1].remove();

    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // Grupos top-level (ordem de criação = z-order de baixo pra cima)
    var groupMaterial   = layerV1.groupItems.add(); groupMaterial.name   = "Material";
    var groupArte       = layerV1.groupItems.add(); groupArte.name       = "Arte";
    var groupCotas      = layerV1.groupItems.add(); groupCotas.name      = "Cotas";

    // Verso recua 5mm a mais por lado que a frente em queijo sem borda caída
    var versoRecuo = (queijoData && !queijoData.bordaCaida) ? recuoMM - 5 : recuoMM;

    _desenharFaceNP_V(groupMaterial, groupArte, groupCotas,
                      x0, y0, largMM, compMM, selagemMM, fundoMM, true,
                      recuoMM, "Frente", queijoData, arteData);
    _desenharFaceNP_V(groupMaterial, groupArte, groupCotas,
                      x0 + largPt + gapFaces, y0, largMM, compMM, selagemMM, fundoMM, true,
                      versoRecuo, "Verso", queijoData, arteData);

    app.redraw();
    alert("Nylon Poli v2.25 (frente + verso, solda fundo) gerado com sucesso!");
}

// --- HELPER: desenha UMA face vertical completa (material + arte + soldas + cotas) ---
// Recebe os 3 grupos top-level (groupMaterial, groupArte, groupCotas) e adiciona seus
// elementos diretamente neles, sem criar subgrupo por face. A fotocélula vai dentro de groupArte.
// (xStart, yStart) = canto superior esquerdo do material
// soldaFundo = true -> solda no fundo e sem soldas laterais (margem 5 mm)
// soldaFundo = false -> soldas laterais 7,5 mm + respiro 5 mm (margem 12,5 mm)
// recuoMM = recuo da arte dentro do queijo (5 frente / 10 verso normalmente)
// nomeGrupo = "Frente" ou "Verso" (decide se desenha fotocélula)
function _desenharFaceNP_V(groupMaterial, groupArte, groupCotas,
                           xStart, yStart, largMM, compMM, selagemMM, fundoMM, soldaFundo,
                           recuoMM, nomeGrupo, queijoData, arteData) {
    var largPt    = mm2pt(largMM);
    var compPt    = mm2pt(compMM);
    var selagemPt = mm2pt(selagemMM);
    var fundoPt   = mm2pt(fundoMM);
    var soldaLat  = mm2pt(7.5);
    var margemArte = mm2pt(5);
    var margemLat = soldaFundo ? mm2pt(5) : (soldaLat + margemArte);

    var corFundo = cmyk(15, 12, 12, 0);
    var corFaca  = cmyk(0, 0, 0, 60);
    var corCota  = cmyk(0, 0, 0, 60);
    var corCyan  = cmyk(70, 10, 16, 0);
    var corMagenta = cmyk(0, 100, 0, 0);

    var xMatIni = xStart;
    var xMatFim = xStart + largPt;
    var yTopo   = yStart;
    var yFundo  = yStart - compPt;

    // Material
    var rectMaterial = drawRect(groupMaterial, yTopo, xMatIni, largPt, compPt, corFundo);
    rectMaterial.name = "Material " + (nomeGrupo || "");

    // Área útil
    var cyanLeft = xMatIni + margemLat;
    var cyanTop  = yTopo - selagemPt;
    var cyanW    = largPt - (margemLat * 2);
    var cyanH    = soldaFundo ? (compPt - selagemPt - mm2pt(10) - fundoPt)
                              : (compPt - selagemPt - fundoPt);

    // Fotocélula — só na FRENTE
    if (nomeGrupo === "Frente") {
        if (soldaFundo) {
            // Solda fundo: fotocélula DEITADA (40W × 5H), 5mm da lateral + 5mm do topo
            _drawFotocelulaNP(groupArte,
                xMatIni + mm2pt(5),
                yTopo - mm2pt(5),
                mm2pt(40),
                mm2pt(5)
            );
        } else {
            // Normal (com soldas laterais 7.5mm — peça em pé): fotocélula EM PÉ (5W × 40H),
            // 5mm depois da solda lateral + 5mm do topo
            _drawFotocelulaNP(groupArte,
                xMatIni + soldaLat + mm2pt(5),
                yTopo - mm2pt(5),
                mm2pt(5),
                mm2pt(40)
            );
        }
    }

    // Arte (retangular/elíptica) via helper central
    var resArte = _drawArteNP(groupArte, groupCotas, cyanLeft, cyanTop, cyanW, cyanH,
                              corCyan, corMagenta, nomeGrupo, queijoData, arteData, recuoMM);

    // --- LINHAS DE FACA E LABELS SOLDA ---
    if (soldaFundo) {
        var ySoldaFundoInf = yFundo + mm2pt(5);
        var ySoldaFundoSup = yFundo + mm2pt(10);
        addText(groupCotas, "SOLDA", xMatIni + largPt / 2, yFundo + mm2pt(7.5), 8, corCota, 0);
        drawLine(groupCotas, xMatIni, ySoldaFundoInf, xMatFim, ySoldaFundoInf, corFaca, 1, true);
        drawLine(groupCotas, xMatIni, ySoldaFundoSup, xMatFim, ySoldaFundoSup, corFaca, 1, true);
    } else {
        var xSoldaEsq = xMatIni + soldaLat;
        var xSoldaDir = xMatFim - soldaLat;
        var meiaComPt = compPt / 2;
        addText(groupCotas, "SOLDA", xMatIni + mm2pt(3.75), yTopo - meiaComPt, 8, corCota, 90);
        addText(groupCotas, "SOLDA", xMatFim - mm2pt(3.75), yTopo - meiaComPt, 8, corCota, 90);
        drawLine(groupCotas, xMatIni, yTopo, xMatIni, yFundo, corFaca, 1, true);
        drawLine(groupCotas, xMatFim, yTopo, xMatFim, yFundo, corFaca, 1, true);
        drawLine(groupCotas, xSoldaEsq, yTopo, xSoldaEsq, yFundo, corFaca, 1, true);
        drawLine(groupCotas, xSoldaDir, yTopo, xSoldaDir, yFundo, corFaca, 1, true);
    }

    // --- COTAS HORIZONTAIS ---
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);

    drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, fmt(largMM) + " mm", corCota);

    var modoCustom = (queijoData || arteData);

    if (modoCustom) {
        // Cota o retângulo azul real: margem_esq / arte / margem_dir
        var arteL_h = resArte.arteLeft;
        var arteR_h = resArte.arteRight;
        var arteW_h = resArte.arteWidthMM;
        var margEsqMM_h = (arteL_h - xMatIni) / 2.83465;
        var margDirMM_h = (xMatFim - arteR_h) / 2.83465;

        if (margEsqMM_h > 0.01) {
            drawCotaH(groupCotas, xMatIni, arteL_h, yCota2, fmt2(margEsqMM_h) + " mm", corCota);
        }
        drawCotaH(groupCotas, arteL_h, arteR_h, yCota2, fmt2(arteW_h) + " mm", corCota);
        if (margDirMM_h > 0.01) {
            drawCotaH(groupCotas, arteR_h, xMatFim, yCota2, fmt2(margDirMM_h) + " mm", corCota);
        }
    } else if (soldaFundo) {
        drawCotaH(groupCotas, xMatIni,               xMatIni + margemLat, yCota2, "5 mm",                    corCota, 5);
        drawCotaH(groupCotas, xMatIni + margemLat,   xMatFim - margemLat, yCota2, fmt(largMM - 10) + " mm",  corCota);
        drawCotaH(groupCotas, xMatFim - margemLat,   xMatFim,             yCota2, "5 mm",                    corCota, 5);
    } else {
        var xSoldaEsq2 = xMatIni + soldaLat;
        var xSoldaDir2 = xMatFim - soldaLat;
        drawCotaH(groupCotas, xMatIni,               xSoldaEsq2,          yCota2, "7,5 mm",                  corCota, 5);
        drawCotaH(groupCotas, xSoldaEsq2,            xMatIni + margemLat, yCota2, "5 mm",                    corCota, 5);
        drawCotaH(groupCotas, xMatIni + margemLat,   xMatFim - margemLat, yCota2, fmt(largMM - 25) + " mm",  corCota);
        drawCotaH(groupCotas, xMatFim - margemLat,   xSoldaDir2,          yCota2, "5 mm",                    corCota, 5);
        drawCotaH(groupCotas, xSoldaDir2,            xMatFim,             yCota2, "7,5 mm",                  corCota, 5);
    }

    // --- COTAS VERTICAIS ---
    var xCotaV1 = xMatIni - mm2pt(14);
    var xCotaV2 = xMatIni - mm2pt(5);

    drawCotaV(groupCotas, xCotaV1, yTopo, yFundo, fmt(compMM) + " mm", corCota);

    if (modoCustom) {
        // Cota o retângulo azul real
        var arteT_v = resArte.arteTop;
        var arteB_v = resArte.arteBot;
        var arteH_v = (arteT_v - arteB_v) / 2.83465;
        var margTopoMM_v = (yTopo - arteT_v) / 2.83465;

        if (margTopoMM_v > 0.5) {
            drawCotaV(groupCotas, xCotaV2, yTopo, arteT_v, fmt2(margTopoMM_v) + " mm", corCota);
        }
        drawCotaV(groupCotas, xCotaV2, arteT_v, arteB_v, fmt2(arteH_v) + " mm", corCota);

        if (soldaFundo) {
            var ySoldaFundoSup_v = yFundo + mm2pt(10);
            var ySoldaFundoInf_v = yFundo + mm2pt(5);
            var distFundoMM_v = (arteB_v - ySoldaFundoSup_v) / 2.83465;
            if (distFundoMM_v > 0.5) {
                var _ffSfVc = distFundoMM_v < 15 ? 5 : 12;
                drawCotaV(groupCotas, xCotaV2, arteB_v, ySoldaFundoSup_v, fmt2(distFundoMM_v) + " mm", corCota, _ffSfVc);
            }
            drawCotaV(groupCotas, xCotaV2, ySoldaFundoSup_v, ySoldaFundoInf_v, "5 mm", corCota, 5);
            drawCotaV(groupCotas, xCotaV2, ySoldaFundoInf_v, yFundo,           "5 mm", corCota, 5);
        } else {
            var distFundoMM2_v = (arteB_v - yFundo) / 2.83465;
            if (distFundoMM2_v > 0.5) {
                var _ffVc = distFundoMM2_v < 15 ? 5 : 12;
                drawCotaV(groupCotas, xCotaV2, arteB_v, yFundo, fmt2(distFundoMM2_v) + " mm", corCota, _ffVc);
            }
        }
    } else {
        var yArteTopo = yTopo - selagemPt;
        if (soldaFundo) {
            var ySoldaFundoSup = yFundo + mm2pt(10);
            var ySoldaFundoInf = yFundo + mm2pt(5);
            var yArteFundo = ySoldaFundoSup + fundoPt;
            var arteAltMM = compMM - selagemMM - 10 - fundoMM;
            drawCotaV(groupCotas, xCotaV2, yTopo,            yArteTopo,       fmt(selagemMM) + " mm", corCota);
            drawCotaV(groupCotas, xCotaV2, yArteTopo,        yArteFundo,      fmt(arteAltMM) + " mm", corCota);
            if (fundoMM > 0) {
                var _ffSfNc = fundoMM < 15 ? 5 : 12;
                drawCotaV(groupCotas, xCotaV2, yArteFundo,   ySoldaFundoSup,  fmt(fundoMM) + " mm",   corCota, _ffSfNc);
            }
            drawCotaV(groupCotas, xCotaV2, ySoldaFundoSup,   ySoldaFundoInf,  "5 mm",                 corCota, 5);
            drawCotaV(groupCotas, xCotaV2, ySoldaFundoInf,   yFundo,          "5 mm",                 corCota, 5);
        } else {
            var yArteFundo2 = yFundo + fundoPt;
            var arteAltMM2  = compMM - selagemMM - fundoMM;
            drawCotaV(groupCotas, xCotaV2, yTopo,       yArteTopo,   fmt(selagemMM) + " mm", corCota);
            drawCotaV(groupCotas, xCotaV2, yArteTopo,   yArteFundo2, fmt(arteAltMM2) + " mm", corCota);
            if (fundoMM > 0) {
                var _ffV = fundoMM < 15 ? 5 : 12;
                drawCotaV(groupCotas, xCotaV2, yArteFundo2, yFundo,  fmt(fundoMM) + " mm",   corCota, _ffV);
            }
        }
    }
}