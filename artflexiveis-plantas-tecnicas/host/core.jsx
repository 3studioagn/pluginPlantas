// ==========================================
// CORE.JSX — Helpers compartilhados
// Portado 1:1 de reference/Stand-Up_V1_0.jsx (linhas 5–189)
// Escopo: global (funções disponíveis após $.evalFile)
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

// Retângulo tracejado sem preenchimento (cantos retos)
function drawDashedRect(layer, top, left, w, h, color, strokeW) {
    var rect = layer.pathItems.rectangle(top, left, w, h);
    rect.filled = false;
    rect.stroked = true;
    rect.strokeColor = color;
    rect.strokeWidth = 1;
    rect.strokeDashes = [5, 5];
    return rect;
}

// Retângulo tracejado sem preenchimento (cantos arredondados)
function drawDashedRoundedRect(layer, top, left, w, h, rx, ry, color, strokeW) {
    var rect = layer.pathItems.roundedRectangle(top, left, w, h, rx, ry);
    rect.filled = false;
    rect.stroked = true;
    rect.strokeColor = color;
    rect.strokeWidth = 1;
    rect.strokeDashes = [5, 5];
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


function drawNotch(layer, x, y, size, color, isTop) {
    var notch = layer.pathItems.add();
    var halfSize = size / 2;
    if (isTop) {
        notch.setEntirePath([[x - halfSize, y], [x + halfSize, y], [x, y - size]]);
    } else {
        notch.setEntirePath([[x - halfSize, y], [x + halfSize, y], [x, y + size]]);
    }
    notch.closed = true;
    notch.filled = true;
    notch.stroked = false;
    notch.fillColor = color;
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

function drawCotaV(layer, x, y1, y2, textStr, color, fontSize, centered) {
    if (fontSize === undefined) fontSize = 12;
    if (centered === undefined) centered = false;
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
        t.left = centered ? (x - t.width / 2) : (x - mm2pt(2) - t.width);
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

// --- SERIALIZAÇÃO DE RESPOSTA PARA O PAINEL ---
// ExtendScript (ECMAScript 3) não possui o objeto JSON nativo. Os helpers
// abaixo geram strings JSON válidas sem dependência externa. Usamos apenas
// o formato { ok: true, mensagem: "..." } ou { ok: false, erro: "..." }.
function escapeJsonString(s) {
    if (s === null || typeof s === "undefined") return "";
    s = String(s);
    var out = "";
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        var code = s.charCodeAt(i);
        if (c === "\\") { out += "\\\\"; }
        else if (c === "\"") { out += "\\\""; }
        else if (c === "\n") { out += "\\n"; }
        else if (c === "\r") { out += "\\r"; }
        else if (c === "\t") { out += "\\t"; }
        else if (c === "\b") { out += "\\b"; }
        else if (c === "\f") { out += "\\f"; }
        else if (code < 0x20) {
            var hex = code.toString(16);
            out += "\\u" + ("0000" + hex).slice(-4);
        } else {
            out += c;
        }
    }
    return out;
}

function jsonOk(mensagem) {
    return "{\"ok\":true,\"mensagem\":\"" + escapeJsonString(mensagem) + "\"}";
}

function jsonErr(erro) {
    return "{\"ok\":false,\"erro\":\"" + escapeJsonString(erro) + "\"}";
}
