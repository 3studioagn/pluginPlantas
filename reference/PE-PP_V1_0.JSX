// ==========================================
// SCRIPT: PE v2.2
// Filme simples (PE ou PP) — somente material + dobra central + cotas.
// Derivado do PE+PE v1.0, sem cameron, sem refile e sem limites magenta.
// v1.1-v2.0: arte custom + sanfona + cotas (ver históricos).
// v2.1: labels concatenados nas cotas.
// v2.2: - Sf + sanfona SEM arte custom: arte cyan e cota ÁREA IMPRESSA
//         voltam ao padrão (até 5mm das laterais, largMM-10).
//       - Sf + sanfona COM arte custom: 4 níveis de cotas são gerados
//         normalmente (ÁREA IMPRESSA cota a arte custom real).
// ==========================================

function mm2pt(mm) { return mm * 2.83465; }

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

    // Texto rotacionado 90°
    if (textStr !== "") {
        var t = group.textFrames.add();
        t.contents = textStr;
        t.textRange.characterAttributes.size = fontSize;
        applyArialBold(t);
        try { t.textRange.characterAttributes.fillColor = color; } catch(e) {}
        t.rotate(90);
        t.top  = (y1 + y2) / 2 + (t.height / 2);
        if (centered) {
            t.left = x - t.width / 2;
        } else if (textRight) {
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
var dlg = new Window("dialog", "Gerador: PE");
dlg.orientation = "column";
dlg.alignChildren = "right";

var g1 = dlg.add("group"); g1.add("statictext", undefined, "Comprimento Face (mm):");
var inputComp = g1.add("edittext", undefined, "260"); inputComp.characters = 5;

var g2 = dlg.add("group"); g2.add("statictext", undefined, "Largura/Altura (mm):");
var inputLarg = g2.add("edittext", undefined, "160"); inputLarg.characters = 5;

var g3 = dlg.add("group"); g3.add("statictext", undefined, "Área de Selagem (mm):");
var inputSelagem = g3.add("edittext", undefined, "30"); inputSelagem.characters = 5;

var g4 = dlg.add("group"); g4.add("statictext", undefined, "Distância de Fundo (mm):");
var inputFundo = g4.add("edittext", undefined, "10"); inputFundo.characters = 5;

var g5 = dlg.add("group"); g5.alignChildren = "right";
var inputFrente = g5.add("checkbox", undefined, "Somente frente");

var g6 = dlg.add("group"); g6.alignChildren = "right";
var inputSoldaFundo = g6.add("checkbox", undefined, "Solda Fundo");

// --- Sanfona (toggle + campo) ---
var g7 = dlg.add("group"); g7.alignChildren = "right";
var inputSanfona = g7.add("checkbox", undefined, "Sanfona");
var g7b = dlg.add("group"); g7b.add("statictext", undefined, "Valor da sanfona (mm):");
var inputSanfonaVal = g7b.add("edittext", undefined, "20"); inputSanfonaVal.characters = 5;
inputSanfonaVal.enabled = false;

// Habilita/desabilita o input "Distância de Fundo" conforme combinação
// de modo arte + sanfona + solda fundo.
// - Modo arte sempre anula fundo (definido por distFundo da arte)
// - Sanfona em solda lateral (sem sf) anula fundo (duplo: cotas viram sanfona;
//   frente única: fundo fixado em 5mm internamente)
// - Sanfona + solda fundo: fundo continua perguntado normalmente
function _updateFundoEnabled() {
    var modoArte = inputArte.value;
    var sanfonaLateral = inputSanfona.value && !inputSoldaFundo.value;
    inputFundo.enabled = !modoArte && !sanfonaLateral;
}

inputSanfona.onClick = function() {
    inputSanfonaVal.enabled = this.value;
    _updateFundoEnabled();
};

// Solda Fundo exige modo Somente Frente — marca e trava automaticamente
inputSoldaFundo.onClick = function () {
    if (this.value) {
        inputFrente.value = true;
        inputFrente.enabled = false;
    } else {
        inputFrente.enabled = true;
    }
    _updateArteVisibility();
    _updateFundoEnabled();
};

// --- Tamanho da arte (toggle + painel) ---
var gArteChk = dlg.add("group"); gArteChk.alignChildren = "right";
var inputArte = gArteChk.add("checkbox", undefined, "Tamanho da arte");

var panelArte = dlg.add("panel", undefined, "Dimensões da arte");
panelArte.orientation = "column"; panelArte.alignChildren = "right";
panelArte.margins = 12; panelArte.visible = false;

var gLabelF = panelArte.add("group"); gLabelF.alignChildren = "left";
var lblF = gLabelF.add("statictext", undefined, "Frente:");
try { lblF.graphics.font = ScriptUI.newFont(lblF.graphics.font.name, "BOLD", lblF.graphics.font.size); } catch(e) {}

var ga1F = panelArte.add("group"); ga1F.add("statictext", undefined, "Comprimento (mm):");
var inputATamF = ga1F.add("edittext", undefined, "180"); inputATamF.characters = 5;

var ga2F = panelArte.add("group"); ga2F.add("statictext", undefined, "Largura (mm):");
var inputALargF = ga2F.add("edittext", undefined, "120"); inputALargF.characters = 5;

var gaFundoF = panelArte.add("group"); gaFundoF.add("statictext", undefined, "Distância de fundo (mm):");
var inputAFundoF = gaFundoF.add("edittext", undefined, "10"); inputAFundoF.characters = 5;

var gLabelV = panelArte.add("group"); gLabelV.alignChildren = "left";
var lblV = gLabelV.add("statictext", undefined, "Verso:");
try { lblV.graphics.font = ScriptUI.newFont(lblV.graphics.font.name, "BOLD", lblV.graphics.font.size); } catch(e) {}

var ga1V = panelArte.add("group"); ga1V.add("statictext", undefined, "Comprimento (mm):");
var inputATamV = ga1V.add("edittext", undefined, "170"); inputATamV.characters = 5;

var ga2V = panelArte.add("group"); ga2V.add("statictext", undefined, "Largura (mm):");
var inputALargV = ga2V.add("edittext", undefined, "110"); inputALargV.characters = 5;

var gaFundoV = panelArte.add("group"); gaFundoV.add("statictext", undefined, "Distância de fundo (mm):");
var inputAFundoV = gaFundoV.add("edittext", undefined, "10"); inputAFundoV.characters = 5;

function _updateArteVisibility() {
    if (!panelArte.visible) return;
    var soFrente = inputFrente.value || inputSoldaFundo.value;
    gLabelV.visible  = !soFrente;
    ga1V.visible     = !soFrente;
    ga2V.visible     = !soFrente;
    gaFundoV.visible = !soFrente;
}

inputArte.onClick = function() {
    panelArte.visible = this.value;
    // Em modo arte: selagem e distância de fundo principais ficam anuladas.
    // Cada face usa sua própria distância, e a área útil ocupa a face inteira
    // (menos o respiro fixo de 5mm em cada borda).
    inputSelagem.enabled = !this.value;
    _updateFundoEnabled();
    _updateArteVisibility();
    dlg.layout.layout(true);
    dlg.layout.resize();
};

inputFrente.onClick = function() {
    _updateArteVisibility();
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
    var sf = inputSoldaFundo.value;
    var arteData = null;
    var abortar = false;

    // Sanfona: 0 = desligada; >0 = valor em mm
    var sanfonaMM = 0;
    if (inputSanfona.value) {
        sanfonaMM = parseFloat(inputSanfonaVal.text.replace(',', '.'));
        if (isNaN(sanfonaMM) || sanfonaMM <= 0) {
            alert("Erro: valor da sanfona inválido.");
            abortar = true;
        }
    }

    if (inputArte.value && !abortar) {
        var atF = parseFloat(inputATamF.text.replace(',', '.'));
        var alF = parseFloat(inputALargF.text.replace(',', '.'));
        var dfF = parseFloat(inputAFundoF.text.replace(',', '.'));
        var atV = parseFloat(inputATamV.text.replace(',', '.'));
        var alV = parseFloat(inputALargV.text.replace(',', '.'));
        var dfV = parseFloat(inputAFundoV.text.replace(',', '.'));
        var soFrente = inputFrente.value || sf;
        var frenteOk = !isNaN(atF) && !isNaN(alF) && !isNaN(dfF);
        var versoOk  = soFrente || (!isNaN(atV) && !isNaN(alV) && !isNaN(dfV));
        if (!frenteOk || !versoOk) {
            alert("Erro: Digite valores válidos para a arte.");
            abortar = true;
        } else {
            arteData = {
                frente: { tamanho: atF, largura: alF, distFundo: dfF },
                verso:  soFrente ? null : { tamanho: atV, largura: alV, distFundo: dfV }
            };
            // Em modo arte, selagem e distância de fundo principais ficam anuladas:
            // a área útil ocupa a face inteira (menos 5mm de respiro).
            f = 0;
            s = 0;
        }
    }

    if (abortar) {
        // Erro já alertado, não prossegue.
    } else if (isNaN(c) || isNaN(l) || isNaN(s) || isNaN(f)) {
        alert("Erro: Digite valores válidos.");
    } else {
        // Regra v1.4: sanfona em solda lateral (sem sf) anula a distância de fundo.
        // - Duplo (frente+verso): f = 0 (cotas viram sanfona, arte única)
        // - Frente única sem sf: f = 5 fixo (arte começa 5mm da base)
        var frenteOuSF = inputFrente.value || sf;
        if (sanfonaMM > 0 && !sf) {
            if (frenteOuSF) {
                // frente única sem sf + sanfona: fundo fixo em 5mm
                f = 5;
            } else {
                // duplo + sanfona: fundo zerado
                f = 0;
            }
        }

        if (frenteOuSF) {
            // Solda fundo força o modo frente (não há PE com solda fundo frente e verso)
            desenharPE_Frente(c, l, s, f, sf, arteData, sanfonaMM);
        } else {
            desenharPE_Completo(c, l, s, f, arteData, sanfonaMM);
        }
    }
}

// --- HELPERS DE VALIDAÇÃO E FORMATAÇÃO (modo arte custom) ---
function _fmtMM(v) {
    // Se for inteiro exato, mostra sem decimal; senão até 2 decimais com vírgula.
    if (Math.abs(v - Math.round(v)) < 0.005) return String(Math.round(v));
    return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

// Valida arte custom no pouch duplo horizontal (deitado).
// Em cada face: aW <= compMM - distFundo (não pode invadir nem ultrapassar a face)
//               aH <= largMM - 10 (respiro de 5mm topo e base)
function _validarArteCustomDuplo(compMM, largMM, arteData) {
    var maxAlt = largMM - 10; // respiro de 5mm topo e base
    function _check(nome, info) {
        if (info.tamanho <= 0 || info.largura <= 0 || info.distFundo < 0) {
            return "Erro: dimensões da arte (" + nome + ") devem ser positivas.";
        }
        if (info.largura > maxAlt + 0.01) {
            return "Erro: a largura da arte (" + nome + ") excede a altura útil da face.\n" +
                   "Largura = " + info.largura + " mm; máximo permitido = " + maxAlt + " mm " +
                   "(largura do material - 10mm de respiro).";
        }
        if (info.tamanho + info.distFundo > compMM + 0.01) {
            return "Erro: comprimento + distância de fundo da arte (" + nome + ") excedem a face.\n" +
                   "Tamanho + distância = " + (info.tamanho + info.distFundo) +
                   " mm; máximo = " + compMM + " mm (comprimento por face).";
        }
        return null;
    }
    var e = _check("Frente", arteData.frente); if (e) return e;
    if (arteData.verso) { e = _check("Verso", arteData.verso); if (e) return e; }
    return null;
}

// Valida arte custom na frente única vertical (em pé).
// aW (largura) <= largMM - 10 (respiro lateral 5mm cada lado)
// aH (tamanho) + distFundo <= compMM (sem sf) ou compMM - 10 (com sf, após os 10mm de solda fundo)
function _validarArteCustomFrente(compMM, largMM, soldaFundo, arteData) {
    var info = arteData.frente;
    if (info.tamanho <= 0 || info.largura <= 0 || info.distFundo < 0) {
        return "Erro: dimensões da arte devem ser positivas.";
    }
    var maxLarg = largMM - 10;
    if (info.largura > maxLarg + 0.01) {
        return "Erro: a largura da arte excede a largura útil do material.\n" +
               "Largura = " + info.largura + " mm; máximo = " + maxLarg + " mm " +
               "(largura - 10mm de respiro lateral).";
    }
    var maxV = soldaFundo ? (compMM - 10) : compMM;
    if (info.tamanho + info.distFundo > maxV + 0.01) {
        return "Erro: comprimento + distância de fundo excedem a altura útil.\n" +
               "Tamanho + distância = " + (info.tamanho + info.distFundo) +
               " mm; máximo = " + maxV + " mm" +
               (soldaFundo ? " (comprimento - 10mm de solda fundo)." : ".");
    }
    return null;
}

// --- LÓGICA PRINCIPAL ---
function desenharPE_Completo(compMM, largMM, selagemMM, fundoMM, arteData, sanfonaMM) {
    var compPt     = mm2pt(compMM);
    var largPt     = mm2pt(largMM);
    var selagemPt  = mm2pt(selagemMM);
    var fundoPt    = mm2pt(fundoMM);
    var margemVert = mm2pt(5); // 5 mm topo + 5 mm base = 10 mm descontados no eixo Y
    var modoCustom = !!arteData;
    var temSanfona = (sanfonaMM && sanfonaMM > 0);

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);

    var totalPouchW = compPt * 2;
    var totalPouchH = largPt;

    // Validação: área útil de cada face precisa sobrar
    var cyanW = compPt - selagemPt - fundoPt;
    var cyanH = largPt - mm2pt(10);
    if (cyanW <= 0 || cyanH <= 0) {
        alert("Erro: os valores de selagem/fundo excedem o material.");
        return;
    }

    // Validação da arte custom: tem que caber dentro da face sem invadir o respiro
    // vertical (5mm topo/base) nem ultrapassar as bordas horizontais da face.
    if (modoCustom) {
        var _err = _validarArteCustomDuplo(compMM, largMM, arteData);
        if (_err) { alert(_err); return; }
    }

    // Validação da sanfona (duplo): as linhas a ±sanfonaMM e ±5mm adicionais precisam
    // caber dentro de cada face. Cada face tem compMM; a sanfona + K-seal consome
    // (sanfonaMM + 5) mm a partir do centro em direção a cada borda externa.
    if (temSanfona && (sanfonaMM + 5) >= compMM) {
        alert("Erro: sanfona (" + sanfonaMM + "mm) + 5mm K-seal excedem o comprimento por face (" +
              compMM + "mm).");
        return;
    }

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
    // 1. BASE (MATERIAL)
    // =======================================

    // Material (base cinza) — solto na camada V1
    var rectMaterial = drawRect(layerV1, yTopo, xPouchIni, totalPouchW, totalPouchH, corFundo);
    rectMaterial.name = "Material";

    // =======================================
    // 2. ÁREAS ÚTEIS (CYAN) — uma por face
    // Em modo default: selagem (externa) + arte + fundo (interna, junto ao centro)
    // Em modo arte custom: arte com dimensões e posição informadas pelo usuário.
    //                      selagem e fundo já vieram zeradas — a face inteira é a área.
    // =======================================
    var cyanTop = yTopo - margemVert;

    var groupCyan = layerV1.groupItems.add(); groupCyan.name = "Arte";

    // Coordenadas da arte (Frente) — úteis tanto no modo default quanto custom.
    var arteF_Left, arteF_Right, arteF_Top, arteF_Bot, arteF_WMM, arteF_HMM;
    var arteV_Left, arteV_Right, arteV_Top, arteV_Bot, arteV_WMM, arteV_HMM;

    if (modoCustom) {
        // Arte Frente: centralizada verticalmente na face; horizontalmente posicionada
        //              por distFundo (espaço entre a borda interna=centro e a borda direita da arte).
        var aInfoF = arteData.frente;
        var aWF = mm2pt(aInfoF.tamanho);   // horizontal (deitado)
        var aHF = mm2pt(aInfoF.largura);   // vertical (deitado)
        var areaCy_F = (yTopo + yFundo) / 2;
        arteF_Top   = areaCy_F + aHF / 2;
        arteF_Bot   = arteF_Top - aHF;
        arteF_Right = xCentro - mm2pt(aInfoF.distFundo);
        arteF_Left  = arteF_Right - aWF;
        arteF_WMM   = aInfoF.tamanho;
        arteF_HMM   = aInfoF.largura;

        var rectArteF = groupCyan.pathItems.rectangle(arteF_Top, arteF_Left, aWF, aHF);
        rectArteF.filled = true; rectArteF.stroked = false; rectArteF.fillColor = corCyan;
        rectArteF.name = "Arte";

        // Arte Verso: espelhada — distFundo é o espaço entre o centro e a borda esquerda da arte.
        var aInfoV = arteData.verso || arteData.frente;
        var aWV = mm2pt(aInfoV.tamanho);
        var aHV = mm2pt(aInfoV.largura);
        arteV_Top   = areaCy_F + aHV / 2;
        arteV_Bot   = arteV_Top - aHV;
        arteV_Left  = xCentro + mm2pt(aInfoV.distFundo);
        arteV_Right = arteV_Left + aWV;
        arteV_WMM   = aInfoV.tamanho;
        arteV_HMM   = aInfoV.largura;

        var rectArteV = groupCyan.pathItems.rectangle(arteV_Top, arteV_Left, aWV, aHV);
        rectArteV.filled = true; rectArteV.stroked = false; rectArteV.fillColor = corCyan;
        rectArteV.name = "Arte";
    } else if (temSanfona) {
        // Default + sanfona: arte única atravessando a dobra central (sem divisão por fundo).
        // fundoMM já veio como 0 da execução — a área cobre de xPouchIni+selagem até xPouchFim-selagem.
        var cyanUnicoLeft = xPouchIni + selagemPt;
        var cyanUnicoW    = totalPouchW - 2 * selagemPt;
        var rectCyanUnico = groupCyan.pathItems.rectangle(cyanTop, cyanUnicoLeft, cyanUnicoW, cyanH);
        rectCyanUnico.filled = true; rectCyanUnico.stroked = false; rectCyanUnico.fillColor = corCyan;
        rectCyanUnico.name = "Arte";
    } else {
        // Face esquerda (default)
        var cyanEsqLeft = xPouchIni + selagemPt;
        var rectCyanEsq = groupCyan.pathItems.rectangle(cyanTop, cyanEsqLeft, cyanW, cyanH);
        rectCyanEsq.filled = true; rectCyanEsq.stroked = false; rectCyanEsq.fillColor = corCyan;

        // Face direita (default)
        var cyanDirLeft = xCentro + fundoPt;
        var rectCyanDir = groupCyan.pathItems.rectangle(cyanTop, cyanDirLeft, cyanW, cyanH);
        rectCyanDir.filled = true; rectCyanDir.stroked = false; rectCyanDir.fillColor = corCyan;
    }

    // Grupo "Cotas" — criado por último (fica no topo)
    var groupAll = layerV1.groupItems.add(); groupAll.name = "Cotas";

    // =======================================
    // 2b. LINHA DE DOBRA CENTRAL
    // =======================================
    drawLine(groupAll, xCentro, yTopo, xCentro, yFundo, corFaca, 1, true);

    // =======================================
    // 2c. LINHAS DA SANFONA (se ativa)
    // Duplo sem solda fundo: geometria igual ao Stand-up —
    //   2 linhas principais da sanfona a ±sanfonaMM do centro (corFaca, tracejadas)
    //   4 linhas K-seal a ±5mm de cada linha principal (corCota, mais finas)
    // Label textual com o valor da sanfona abaixo do material.
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
    // 3. COTAS HORIZONTAIS
    //    Nível 1: comprimento total (2 faces)
    //    Nível 2: comprimento por face
    //    Nível 3 (default): selagem / arte / fundo / fundo / arte / selagem
    //    Nível 3 (modoCustom): margEsqF / arteF / distFundoF | distFundoV / arteV / margDirV
    //    Nível K (apenas com sanfona): K-seal, imediatamente abaixo de yCota3
    // =======================================
    var yCota1 = yTopo + mm2pt(31);
    var yCota2 = yTopo + mm2pt(21);
    var yCota3 = yTopo + mm2pt(12);

    var groupCotas = groupAll.groupItems.add();

    drawCotaH(groupCotas, xPouchIni, xPouchFim, yCota1, (compMM * 2) + " mm", corCota);

    drawCotaH(groupCotas, xPouchIni, xCentro,   yCota2, compMM + " mm", corCota);
    drawCotaH(groupCotas, xCentro,   xPouchFim, yCota2, compMM + " mm", corCota);

    if (modoCustom) {
        var margEsqF_MM = (arteF_Left  - xPouchIni) / 2.83465;
        var margDirF_MM = (xCentro     - arteF_Right) / 2.83465; // = distFundo Frente
        var margEsqV_MM = (arteV_Left  - xCentro)     / 2.83465; // = distFundo Verso
        var margDirV_MM = (xPouchFim   - arteV_Right) / 2.83465;

        var _fontEsqF = margEsqF_MM < 15 ? 5 : 12;
        var _fontDirF = margDirF_MM < 15 ? 5 : 12;
        var _fontEsqV = margEsqV_MM < 15 ? 5 : 12;
        var _fontDirV = margDirV_MM < 15 ? 5 : 12;

        if (margEsqF_MM > 0.01) {
            drawCotaH(groupCotas, xPouchIni, arteF_Left, yCota3, _fmtMM(margEsqF_MM) + " mm", corCota, _fontEsqF);
        }
        drawCotaH(groupCotas, arteF_Left, arteF_Right, yCota3, _fmtMM(arteF_WMM) + " mm", corCota);
        if (margDirF_MM > 0.01) {
            drawCotaH(groupCotas, arteF_Right, xCentro, yCota3, _fmtMM(margDirF_MM) + " mm", corCota, _fontDirF);
        }
        if (margEsqV_MM > 0.01) {
            drawCotaH(groupCotas, xCentro, arteV_Left, yCota3, _fmtMM(margEsqV_MM) + " mm", corCota, _fontEsqV);
        }
        drawCotaH(groupCotas, arteV_Left, arteV_Right, yCota3, _fmtMM(arteV_WMM) + " mm", corCota);
        if (margDirV_MM > 0.01) {
            drawCotaH(groupCotas, arteV_Right, xPouchFim, yCota3, _fmtMM(margDirV_MM) + " mm", corCota, _fontDirV);
        }
    } else if (temSanfona) {
        // Default + sanfona: arte única dividida pela faixa de sanfona.
        // Segmentos: selagem | arte_esq | sanfona | sanfona | arte_dir | selagem
        // (arte_esq/dir são as metades da arte separadas pelas linhas principais da sanfona)
        var arteLadoMM = compMM - selagemMM - sanfonaMM;
        var _fontSanf  = sanfonaMM < 15 ? 5 : 12;
        drawCotaH(groupCotas, xPouchIni,                    xPouchIni + selagemPt,   yCota3, selagemMM  + " mm", corCota);
        drawCotaH(groupCotas, xPouchIni + selagemPt,        xCentro - mm2pt(sanfonaMM), yCota3, _fmtMM(arteLadoMM) + " mm", corCota);
        drawCotaH(groupCotas, xCentro - mm2pt(sanfonaMM),   xCentro,                 yCota3, _fmtMM(sanfonaMM) + " mm", corCota, _fontSanf);
        drawCotaH(groupCotas, xCentro,                      xCentro + mm2pt(sanfonaMM), yCota3, _fmtMM(sanfonaMM) + " mm", corCota, _fontSanf);
        drawCotaH(groupCotas, xCentro + mm2pt(sanfonaMM),   xPouchFim - selagemPt,   yCota3, _fmtMM(arteLadoMM) + " mm", corCota);
        drawCotaH(groupCotas, xPouchFim - selagemPt,        xPouchFim,               yCota3, selagemMM  + " mm", corCota);
    } else {
        var arteFaceMM = compMM - selagemMM - fundoMM;
        drawCotaH(groupCotas, xPouchIni,              xPouchIni + selagemPt, yCota3, selagemMM  + " mm", corCota);
        drawCotaH(groupCotas, xPouchIni + selagemPt,  xCentro - fundoPt,     yCota3, arteFaceMM + " mm", corCota);
        if (fundoMM > 0) {
            drawCotaH(groupCotas, xCentro - fundoPt, xCentro,           yCota3, fundoMM + " mm", corCota, 5);
            drawCotaH(groupCotas, xCentro,           xCentro + fundoPt, yCota3, fundoMM + " mm", corCota, 5);
        }
        drawCotaH(groupCotas, xCentro + fundoPt,      xPouchFim - selagemPt, yCota3, arteFaceMM + " mm", corCota);
        drawCotaH(groupCotas, xPouchFim - selagemPt,  xPouchFim,             yCota3, selagemMM  + " mm", corCota);
    }

    // =======================================
    // 4. COTAS VERTICAIS
    //    Eixo externo: largura total (largMM)
    //    Eixo interno (default): 5 mm topo / altura da arte / 5 mm base
    //    Eixo interno (modoCustom): margTopo / alturaArteF / margBase (referente à Frente)
    // =======================================
    var xCotaV1 = x0 - mm2pt(14);
    var xCotaV2 = x0 - mm2pt(5);

    drawCotaV(groupCotas, xCotaV1, yTopo, yFundo, largMM + " mm", corCota);

    if (modoCustom) {
        var margTopoF_MM = (yTopo - arteF_Top) / 2.83465;
        var margBaseF_MM = (arteF_Bot - yFundo) / 2.83465;
        var _fontTopoF = margTopoF_MM < 15 ? 5 : 12;
        var _fontBaseF = margBaseF_MM < 15 ? 5 : 12;
        if (margTopoF_MM > 0.5) {
            drawCotaV(groupCotas, xCotaV2, yTopo, arteF_Top, _fmtMM(margTopoF_MM) + " mm", corCota, _fontTopoF);
        }
        drawCotaV(groupCotas, xCotaV2, arteF_Top, arteF_Bot, _fmtMM(arteF_HMM) + " mm", corCota);
        if (margBaseF_MM > 0.5) {
            drawCotaV(groupCotas, xCotaV2, arteF_Bot, yFundo, _fmtMM(margBaseF_MM) + " mm", corCota, _fontBaseF);
        }
    } else {
        var yArteTopo = yTopo - margemVert;
        var yArteFundo = yFundo + margemVert;
        drawCotaV(groupCotas, xCotaV2, yTopo,       yArteTopo,  "5 mm",                corCota, 5);
        drawCotaV(groupCotas, xCotaV2, yArteTopo,   yArteFundo, (largMM - 10) + " mm", corCota);
        drawCotaV(groupCotas, xCotaV2, yArteFundo,  yFundo,     "5 mm",                corCota, 5);
    }

    // =======================================
    // 5. COTAS K-SEAL DA SANFONA (duplo + sanfona)
    // Posicionadas em um nível IMEDIATAMENTE ABAIXO da cota de sanfona
    // (entre yCota3 e o topo do material), do mesmo lado que as demais cotas.
    // Uma cota de 10mm em cada faixa K-seal (entre xSanfE ± 5 e xSanfD ± 5).
    // =======================================
    if (temSanfona) {
        var yCotaKseal = yTopo + mm2pt(4);
        var xSanfE_k = xCentro - mm2pt(sanfonaMM);
        var xSanfD_k = xCentro + mm2pt(sanfonaMM);
        drawCotaH(groupCotas, xSanfE_k - mm2pt(5), xSanfE_k + mm2pt(5), yCotaKseal, "10 mm", corCota, 5);
        drawCotaH(groupCotas, xSanfD_k - mm2pt(5), xSanfD_k + mm2pt(5), yCotaKseal, "10 mm", corCota, 5);
    }

    app.redraw();
    alert("PE v2.2 gerado com sucesso!");
}

// --- LÓGICA FRENTE ÚNICA (VERTICAL) ---
function desenharPE_Frente(compMM, largMM, selagemMM, fundoMM, soldaFundo, arteData, sanfonaMM) {
    var compPt    = mm2pt(compMM);
    var largPt    = mm2pt(largMM);
    var selagemPt = mm2pt(selagemMM);
    var fundoPt   = mm2pt(fundoMM);
    var margemLat = mm2pt(5); // 5 mm em cada lateral horizontal = 10 mm descontados no eixo X
    var modoCustom = !!arteData;
    var temSanfona = (sanfonaMM && sanfonaMM > 0);

    var marginX = mm2pt(60);
    var marginY = mm2pt(80);

    // Orientação vertical: largura horizontal, comprimento vertical
    var totalPouchW = largPt;
    var totalPouchH = compPt;

    // Validação: área útil precisa sobrar
    var cyanW = largPt - mm2pt(10);
    var cyanH = soldaFundo ? (compPt - selagemPt - mm2pt(10) - fundoPt)
                           : (compPt - selagemPt - fundoPt);
    if (cyanW <= 0 || cyanH <= 0) {
        alert("Erro: os valores de selagem/fundo excedem o material.");
        return;
    }

    // Validação da arte custom
    if (modoCustom) {
        var _err = _validarArteCustomFrente(compMM, largMM, soldaFundo, arteData);
        if (_err) { alert(_err); return; }
    }

    // Validação da sanfona
    if (temSanfona) {
        if (soldaFundo) {
            // sanfona lateral: linha a sanfonaMM da borda; precisa caber em cada lateral sem se cruzar
            if (sanfonaMM * 2 >= largMM) {
                alert("Erro: sanfona muito grande para esta largura.\n" +
                      "Sanfona = " + sanfonaMM + " mm × 2 lados = " + (sanfonaMM * 2) + " mm; " +
                      "largura = " + largMM + " mm.");
                return;
            }
        } else {
            // sanfona horizontal na parte inferior: linha principal em yFundo+sanfonaMM,
            // K-seal superior em yFundo + sanfonaMM + 5. Precisa caber abaixo da selagem do topo.
            if (sanfonaMM + 5 >= compMM - selagemMM) {
                alert("Erro: sanfona (" + sanfonaMM + "mm) + 5mm K-seal invadem a selagem do topo.\n" +
                      "Altura útil = " + (compMM - selagemMM) + "mm.");
                return;
            }
        }
    }

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

    // Centraliza o conteúdo na prancheta
    var ab = doc.artboards[0].artboardRect;
    var x0 = ab[0] + (ab[2] - ab[0] - totalPouchW) / 2;
    var y0 = ab[1] - (ab[1] - ab[3] - totalPouchH) / 2;

    // --- EIXOS X ---
    var xMatIni = x0;
    var xMatFim = x0 + largPt;

    // --- EIXOS Y ---
    var yTopo  = y0;
    var yFundo = yTopo - compPt;

    // =======================================
    // 1. BASE (MATERIAL)
    // =======================================
    var rectMaterial = drawRect(layerV1, yTopo, xMatIni, largPt, compPt, corFundo);
    rectMaterial.name = "Material";

    // =======================================
    // 2. ÁREA DE ARTE (CYAN)
    // Default: retângulo entre margens laterais + selagem topo + (solda)fundo base
    // Custom : arte com dimensões e posição informadas pelo usuário
    //          centralizada horizontalmente, base a distFundo da borda inferior útil
    // =======================================
    var groupCyan = layerV1.groupItems.add(); groupCyan.name = "Arte";

    // Coordenadas da arte (para uso nas cotas)
    var arteLeft, arteRight, arteTop, arteBot, arteLargMM, arteTamMM;

    if (modoCustom) {
        var aInfo = arteData.frente;
        var aW = mm2pt(aInfo.largura);  // horizontal (em pé)
        var aH = mm2pt(aInfo.tamanho);  // vertical (em pé)
        var aCx = xMatIni + largPt / 2;
        arteLeft  = aCx - aW / 2;
        arteRight = arteLeft + aW;
        // Base da área útil: yFundo (sem solda fundo) ou yFundo+10 (com solda fundo)
        var baseAreaY = soldaFundo ? (yFundo + mm2pt(10)) : yFundo;
        arteBot = baseAreaY + mm2pt(aInfo.distFundo);
        arteTop = arteBot + aH;
        arteLargMM = aInfo.largura;
        arteTamMM  = aInfo.tamanho;

        var rectArte = groupCyan.pathItems.rectangle(arteTop, arteLeft, aW, aH);
        rectArte.filled = true; rectArte.stroked = false; rectArte.fillColor = corCyan;
        rectArte.name = "Arte";
    } else {
        // Default: arte cyan vai até 5mm das laterais (respiro fixo),
        // mesmo quando tem sanfona + solda fundo — o usuário pode querer a arte
        // atravessando a faixa da sanfona. Para limitar à área entre sanfonas,
        // usar o modo "Tamanho da arte".
        var cyanLeft = xMatIni + margemLat;
        var cyanTop  = yTopo - selagemPt;
        var rectCyan = groupCyan.pathItems.rectangle(cyanTop, cyanLeft, cyanW, cyanH);
        rectCyan.filled = true; rectCyan.stroked = false; rectCyan.fillColor = corCyan;
    }

    // Grupo "Cotas"
    var groupAll = layerV1.groupItems.add(); groupAll.name = "Cotas";
    var groupCotas = groupAll.groupItems.add();

    // =======================================
    // 3. SOLDA DE FUNDO (se ativa)
    // Faixa de 5 mm deslocada 5 mm da base — linhas de faca + label SOLDA
    // =======================================
    if (soldaFundo) {
        var ySoldaFundoInf = yFundo + mm2pt(5);
        var ySoldaFundoSup = yFundo + mm2pt(10);

        addText(groupAll, "SOLDA", xMatIni + largPt / 2, yFundo + mm2pt(7.5), 8, corCota, 0);

        drawLine(groupAll, xMatIni, ySoldaFundoInf, xMatFim, ySoldaFundoInf, corFaca, 1, true);
        drawLine(groupAll, xMatIni, ySoldaFundoSup, xMatFim, ySoldaFundoSup, corFaca, 1, true);
    }

    // =======================================
    // 3b. LINHAS DA SANFONA (se ativa)
    // Sem solda fundo: sanfona HORIZONTAL na parte inferior do material —
    //   1 linha principal em yFundo + sanfonaMM (corFaca)
    //   2 linhas K-seal a ±5mm da principal (corCota, mais finas)
    // Com solda fundo: 2 linhas verticais laterais a sanfonaMM da borda (corFaca), sem K-seal.
    // =======================================
    if (temSanfona) {
        if (soldaFundo) {
            var xSanfE_sf = xMatIni + mm2pt(sanfonaMM);
            var xSanfD_sf = xMatFim - mm2pt(sanfonaMM);
            drawLine(groupAll, xSanfE_sf, yTopo, xSanfE_sf, yFundo, corFaca, 1, true);
            drawLine(groupAll, xSanfD_sf, yTopo, xSanfD_sf, yFundo, corFaca, 1, true);
        } else {
            var ySanfPrincipal = yFundo + mm2pt(sanfonaMM);
            // Linha principal horizontal da sanfona
            drawLine(groupAll, xMatIni, ySanfPrincipal, xMatFim, ySanfPrincipal, corFaca, 1, true);
            // Linhas K-seal a ±5mm da principal
            drawLine(groupAll, xMatIni, ySanfPrincipal - mm2pt(5), xMatFim, ySanfPrincipal - mm2pt(5), corCota, 0.75, true);
            drawLine(groupAll, xMatIni, ySanfPrincipal + mm2pt(5), xMatFim, ySanfPrincipal + mm2pt(5), corCota, 0.75, true);
        }
    }

    // =======================================
    // 4. COTAS HORIZONTAIS
    //    Nível 1: largura total
    //    Nível 2 (default): 5 mm + (largMM-10) + 5 mm
    //    Nível 2 (modoCustom): margEsq + arteLargura + margDir
    // =======================================
    var yCota1 = yTopo + mm2pt(15);
    var yCota2 = yTopo + mm2pt(6);

    if (temSanfona && soldaFundo) {
        // Frente única com sf + sanfona: 4 níveis de cotas com labels.
        // Gera SEMPRE (com ou sem arte custom). No modo custom, a cota
        // ÁREA IMPRESSA cota a arte custom real; no default, cota o
        // retângulo cyan padrão (até 5mm das laterais).
        var ySanfL1 = yTopo + mm2pt(6);   // nível 1 — sanfona
        var yAreaL2 = yTopo + mm2pt(18);  // nível 2 — área impressa
        var yFechL3 = yTopo + mm2pt(30);  // nível 3 — embalagem fechada
        var yAbL4   = yTopo + mm2pt(42);  // nível 4 — embalagem aberta

        var _fontSanfH = sanfonaMM < 15 ? 5 : 12;
        var abertaMM   = largMM + 2 * sanfonaMM;

        // Determina a área impressa (depende do modo)
        var areaLeft_H, areaRight_H, areaLargMM_H;
        if (modoCustom) {
            areaLeft_H   = arteLeft;
            areaRight_H  = arteRight;
            areaLargMM_H = arteLargMM;
        } else {
            // Default: arte até 5mm das laterais (mesmo retângulo do cyan)
            areaLeft_H   = xMatIni + margemLat;
            areaRight_H  = xMatFim - margemLat;
            areaLargMM_H = largMM - 10;
        }

        // Nível 1 — SANFONA (2 cotas, uma em cada lateral) — label abaixo da linha
        drawCotaH(groupCotas, xMatIni,                      xMatIni + mm2pt(sanfonaMM), ySanfL1,
                  _fmtMM(sanfonaMM) + " mm", corCota, _fontSanfH);
        addText(groupCotas, "SANFONA",
                xMatIni + mm2pt(sanfonaMM) / 2, ySanfL1 - mm2pt(3), 6, corCota, 0);
        drawCotaH(groupCotas, xMatFim - mm2pt(sanfonaMM),   xMatFim,                    ySanfL1,
                  _fmtMM(sanfonaMM) + " mm", corCota, _fontSanfH);
        addText(groupCotas, "SANFONA",
                xMatFim - mm2pt(sanfonaMM) / 2, ySanfL1 - mm2pt(3), 6, corCota, 0);

        // Nível 2 — ÁREA IMPRESSA
        drawCotaH(groupCotas, areaLeft_H, areaRight_H, yAreaL2,
                  "ÁREA IMPRESSA " + _fmtMM(areaLargMM_H) + " mm", corCota);

        // Nível 3 — EMBALAGEM FECHADA (largura total do material)
        drawCotaH(groupCotas, xMatIni, xMatFim, yFechL3,
                  "EMBALAGEM FECHADA " + _fmtMM(largMM) + " mm", corCota);

        // Nível 4 — EMBALAGEM ABERTA (cota simbólica: linha igual à fechada,
        // número = largMM + 2×sanfonaMM)
        drawCotaH(groupCotas, xMatIni, xMatFim, yAbL4,
                  "EMBALAGEM ABERTA " + _fmtMM(abertaMM) + " mm", corCota);
    } else {
        // Comportamento padrão: nível 1 = largura total, nível 2 = segmentos
        drawCotaH(groupCotas, xMatIni, xMatFim, yCota1, largMM + " mm", corCota);

        if (modoCustom) {
            var margEsqMM = (arteLeft - xMatIni) / 2.83465;
            var margDirMM = (xMatFim - arteRight) / 2.83465;
            var _fontEsq = margEsqMM < 15 ? 5 : 12;
            var _fontDir = margDirMM < 15 ? 5 : 12;
            if (margEsqMM > 0.01) {
                drawCotaH(groupCotas, xMatIni, arteLeft, yCota2, _fmtMM(margEsqMM) + " mm", corCota, _fontEsq);
            }
            drawCotaH(groupCotas, arteLeft, arteRight, yCota2, _fmtMM(arteLargMM) + " mm", corCota);
            if (margDirMM > 0.01) {
                drawCotaH(groupCotas, arteRight, xMatFim, yCota2, _fmtMM(margDirMM) + " mm", corCota, _fontDir);
            }
        } else {
            drawCotaH(groupCotas, xMatIni,              xMatIni + margemLat, yCota2, "5 mm",              corCota, 5);
            drawCotaH(groupCotas, xMatIni + margemLat,  xMatFim - margemLat, yCota2, (largMM - 10) + " mm", corCota);
            drawCotaH(groupCotas, xMatFim - margemLat,  xMatFim,             yCota2, "5 mm",              corCota, 5);
        }
    }

    // =======================================
    // 5. COTAS VERTICAIS (2 EIXOS)
    //    Eixo externo: comprimento total
    //    Eixo interno (default, sem solda fundo): selagem + arte + fundo
    //    Eixo interno (default, com solda fundo): selagem + arte + fundo + 5 + 5
    //    Eixo interno (modoCustom, sem solda fundo): margTopo + arteAlt + distFundo
    //    Eixo interno (modoCustom, com solda fundo): margTopo + arteAlt + distFundo + 5 + 5
    // =======================================
    var xCotaV1 = xMatIni - mm2pt(14);
    var xCotaV2 = xMatIni - mm2pt(5);

    drawCotaV(groupCotas, xCotaV1, yTopo, yFundo, compMM + " mm", corCota);

    if (modoCustom) {
        var margTopoMM = (yTopo - arteTop) / 2.83465;
        var distFundoMM = arteData.frente.distFundo;
        var _fontTopo = margTopoMM < 15 ? 5 : 12;
        var _fontDf   = distFundoMM < 15 ? 5 : 12;

        if (margTopoMM > 0.5) {
            drawCotaV(groupCotas, xCotaV2, yTopo, arteTop, _fmtMM(margTopoMM) + " mm", corCota, _fontTopo);
        }
        drawCotaV(groupCotas, xCotaV2, arteTop, arteBot, _fmtMM(arteTamMM) + " mm", corCota);

        if (soldaFundo) {
            var ySfSup = yFundo + mm2pt(10);
            var ySfInf = yFundo + mm2pt(5);
            if (distFundoMM > 0.01) {
                drawCotaV(groupCotas, xCotaV2, arteBot, ySfSup, _fmtMM(distFundoMM) + " mm", corCota, _fontDf);
            }
            drawCotaV(groupCotas, xCotaV2, ySfSup, ySfInf, "5 mm", corCota, 5);
            drawCotaV(groupCotas, xCotaV2, ySfInf, yFundo, "5 mm", corCota, 5);
        } else {
            if (distFundoMM > 0.01) {
                drawCotaV(groupCotas, xCotaV2, arteBot, yFundo, _fmtMM(distFundoMM) + " mm", corCota, _fontDf);
            }
        }
    } else {
        var yArteTopo = yTopo - selagemPt;

        if (soldaFundo) {
            var ySoldaFundoSup_ = yFundo + mm2pt(10);
            var ySoldaFundoInf_ = yFundo + mm2pt(5);
            var yArteFundo = ySoldaFundoSup_ + fundoPt;
            var arteAltMM = compMM - selagemMM - 10 - fundoMM;

            drawCotaV(groupCotas, xCotaV2, yTopo,             yArteTopo,       selagemMM + " mm", corCota);
            drawCotaV(groupCotas, xCotaV2, yArteTopo,         yArteFundo,      arteAltMM + " mm", corCota);
            if (fundoMM > 0) {
                drawCotaV(groupCotas, xCotaV2, yArteFundo,    ySoldaFundoSup_, fundoMM + " mm",   corCota, 5);
            }
            drawCotaV(groupCotas, xCotaV2, ySoldaFundoSup_,   ySoldaFundoInf_, "5 mm",            corCota, 5);
            drawCotaV(groupCotas, xCotaV2, ySoldaFundoInf_,   yFundo,          "5 mm",            corCota, 5);
        } else {
            var yArteFundo2 = yFundo + fundoPt;
            var arteAltMM2  = compMM - selagemMM - fundoMM;

            drawCotaV(groupCotas, xCotaV2, yTopo,      yArteTopo,   selagemMM + " mm", corCota);
            drawCotaV(groupCotas, xCotaV2, yArteTopo,  yArteFundo2, arteAltMM2 + " mm", corCota);
            if (fundoMM > 0) {
                drawCotaV(groupCotas, xCotaV2, yArteFundo2, yFundo, fundoMM + " mm", corCota, 5);
            }
        }
    }

    // =======================================
    // 6. COTAS DA SANFONA (frente única sem sf)
    // Do MESMO LADO que as cotas verticais principais (esquerda do material).
    // Cota sanfona entre yFundo e a linha principal (yFundo + sanfonaMM).
    // Cota K-seal de 10mm (±5mm da linha principal), em eixo mais externo.
    // =======================================
    if (temSanfona && !soldaFundo) {
        var ySanfPrincipal_c = yFundo + mm2pt(sanfonaMM);

        var xCotaSanf = xMatIni - mm2pt(23);
        var _fontSanfV = sanfonaMM < 15 ? 5 : 12;
        drawCotaV(groupCotas, xCotaSanf, yFundo, ySanfPrincipal_c,
                  _fmtMM(sanfonaMM) + " mm", corCota, _fontSanfV);

        // K-seal: 10mm (entre ySanfPrincipal - 5 e ySanfPrincipal + 5)
        var xCotaKseal = xMatIni - mm2pt(32);
        drawCotaV(groupCotas, xCotaKseal,
                  ySanfPrincipal_c - mm2pt(5), ySanfPrincipal_c + mm2pt(5),
                  "10 mm", corCota, 5);
    }

    app.redraw();
    alert("PE v2.2 (somente frente) gerado com sucesso!");
}