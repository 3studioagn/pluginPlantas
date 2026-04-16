/* =======================================================================
   main.js
   Orquestração do painel:
     - Inicializa CSInterface
     - Carrega core.jsx + standup-pouch.jsx via $.evalFile
     - Sincroniza o tema do Illustrator (claro/escuro)
     - Renderiza a lista de estruturas (de structures.js)
     - Gera formulário dinâmico com base em structure.fields
     - Valida inputs e chama hostFunction via evalScript
   ======================================================================= */

(function () {
    "use strict";

    var cs = new CSInterface();
    var selectedStructureId = null;

    /* ------------------------------------------------------------------
       Elementos DOM
       ------------------------------------------------------------------ */
    var elStructureList     = document.getElementById("structure-list");
    var elFieldsContainer   = document.getElementById("fields-container");
    var elBtnGenerate       = document.getElementById("btn-generate");
    var elStatusArea        = document.getElementById("status-area");
    var elForm              = document.getElementById("structure-form");

    /* ------------------------------------------------------------------
       Tema — sincroniza CSS variables com o skin do Illustrator
       ------------------------------------------------------------------ */
    function applyTheme() {
        var skin;
        try {
            skin = cs.getHostEnvironment().appSkinInfo;
        } catch (e) {
            return; // fallback CSS já está aplicado
        }
        if (!skin) return;

        var pbc = skin.panelBackgroundColor && skin.panelBackgroundColor.color;
        if (!pbc) return;

        var r = Math.round(pbc.red);
        var g = Math.round(pbc.green);
        var b = Math.round(pbc.blue);

        // Luminância relativa (Rec. 709)
        var lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        var isLight = lum > 0.5;

        var root = document.documentElement;
        var bg = rgbStr(r, g, b);

        if (isLight) {
            root.style.setProperty("--bg",              bg);
            root.style.setProperty("--bg-elevated",     shade(r, g, b, -0.05));
            root.style.setProperty("--text",            "#1a1a1a");
            root.style.setProperty("--text-muted",      "#6b6b6b");
            root.style.setProperty("--border",          shade(r, g, b, -0.15));
            root.style.setProperty("--input-bg",        "#ffffff");
            root.style.setProperty("--input-border",    shade(r, g, b, -0.2));
            root.style.setProperty("--input-text",      "#1a1a1a");
            root.style.setProperty("--input-focus",     "#1473e6");
            root.style.setProperty("--btn-bg",          "#1473e6");
            root.style.setProperty("--btn-bg-hover",    "#2680eb");
            root.style.setProperty("--btn-bg-active",   "#0d66d0");
            root.style.setProperty("--btn-text",        "#ffffff");
            root.style.setProperty("--btn-disabled-bg",   shade(r, g, b, -0.1));
            root.style.setProperty("--btn-disabled-text", "#8a8a8a");
            root.style.setProperty("--accent",          "#1473e6");
            root.style.setProperty("--error-bg",        "#fde7e7");
            root.style.setProperty("--error-text",      "#c62828");
            root.style.setProperty("--success-bg",      "#e7f6e7");
            root.style.setProperty("--success-text",    "#2e7d32");
            root.style.setProperty("--warn-bg",         "#fff4e0");
            root.style.setProperty("--warn-text",       "#b26a00");
            root.style.setProperty("--badge-bg",        shade(r, g, b, -0.15));
            root.style.setProperty("--badge-text",      "#4a4a4a");
        } else {
            root.style.setProperty("--bg",              bg);
            root.style.setProperty("--bg-elevated",     shade(r, g, b, 0.08));
            root.style.setProperty("--text",            "#f0f0f0");
            root.style.setProperty("--text-muted",      "#a0a0a0");
            root.style.setProperty("--border",          shade(r, g, b, 0.18));
            root.style.setProperty("--input-bg",        shade(r, g, b, -0.15));
            root.style.setProperty("--input-border",    shade(r, g, b, 0.18));
            root.style.setProperty("--input-text",      "#f0f0f0");
            root.style.setProperty("--input-focus",     "#2680eb");
            root.style.setProperty("--btn-bg",          "#2680eb");
            root.style.setProperty("--btn-bg-hover",    "#378ef0");
            root.style.setProperty("--btn-bg-active",   "#1473e6");
            root.style.setProperty("--btn-text",        "#ffffff");
            root.style.setProperty("--btn-disabled-bg",   shade(r, g, b, 0.12));
            root.style.setProperty("--btn-disabled-text", "#808080");
            root.style.setProperty("--accent",          "#2680eb");
            root.style.setProperty("--error-bg",        "#4d1c1c");
            root.style.setProperty("--error-text",      "#ff6b6b");
            root.style.setProperty("--success-bg",      "#1c3d1c");
            root.style.setProperty("--success-text",    "#6bc76b");
            root.style.setProperty("--warn-bg",         "#4d3d1c");
            root.style.setProperty("--warn-text",       "#e6b800");
            root.style.setProperty("--badge-bg",        shade(r, g, b, 0.18));
            root.style.setProperty("--badge-text",      "#d0d0d0");
        }
    }

    function rgbStr(r, g, b) { return "rgb(" + r + "," + g + "," + b + ")"; }

    function shade(r, g, b, amount) {
        // amount em [-1..1]: negativo escurece, positivo clareia
        var f = amount < 0 ? 0 : 255;
        var p = amount < 0 ? -amount : amount;
        var nr = Math.round((f - r) * p + r);
        var ng = Math.round((f - g) * p + g);
        var nb = Math.round((f - b) * p + b);
        return rgbStr(clamp(nr), clamp(ng), clamp(nb));
    }
    function clamp(v) { return Math.max(0, Math.min(255, v)); }

    /* ------------------------------------------------------------------
       Carregamento dos scripts ExtendScript
       ------------------------------------------------------------------ */
    function loadHostScripts() {
        var extPath = cs.getSystemPath(SystemPath.EXTENSION);
        // Normaliza para forward slashes (ExtendScript aceita em ambos OS)
        var p = extPath.replace(/\\/g, "/");
        var scripts = [
            p + "/host/core.jsx",
            p + "/host/standup-pouch.jsx"
        ];
        // Carrega sequencialmente — core.jsx primeiro (define helpers globais)
        (function loadNext(i) {
            if (i >= scripts.length) return;
            var call = '$.evalFile("' + scripts[i] + '")';
            cs.evalScript(call, function (/* result */) {
                loadNext(i + 1);
            });
        })(0);
    }

    /* ------------------------------------------------------------------
       Render da lista de estruturas
       ------------------------------------------------------------------ */
    function renderStructureList() {
        elStructureList.innerHTML = "";
        for (var i = 0; i < STRUCTURES.length; i++) {
            var s = STRUCTURES[i];
            var li = document.createElement("li");
            li.className = "structure-item" + (s.enabled ? "" : " disabled");
            li.setAttribute("data-id", s.id);

            var left = document.createElement("div");
            left.className = "structure-left";

            var icon = document.createElement("span");
            icon.className = "structure-icon";
            icon.textContent = s.icon;

            var name = document.createElement("span");
            name.className = "structure-name";
            name.textContent = s.name;

            left.appendChild(icon);
            left.appendChild(name);
            li.appendChild(left);

            if (!s.enabled) {
                var badge = document.createElement("span");
                badge.className = "structure-badge";
                badge.textContent = "Em breve";
                li.appendChild(badge);
            }

            if (s.enabled) {
                li.addEventListener("click", onStructureClick);
            }

            elStructureList.appendChild(li);
        }
    }

    function onStructureClick(ev) {
        var id = ev.currentTarget.getAttribute("data-id");
        selectStructure(id);
    }

    function selectStructure(id) {
        var s = getStructureById(id);
        if (!s || !s.enabled) return;
        selectedStructureId = id;

        // Marca visualmente selecionado
        var items = elStructureList.querySelectorAll(".structure-item");
        for (var i = 0; i < items.length; i++) {
            items[i].classList.remove("selected");
            if (items[i].getAttribute("data-id") === id) {
                items[i].classList.add("selected");
            }
        }

        renderForm(s);
        clearStatus();
    }

    /* ------------------------------------------------------------------
       Render do formulário dinâmico
       ------------------------------------------------------------------ */
    function renderForm(structure) {
        elFieldsContainer.innerHTML = "";
        for (var i = 0; i < structure.fields.length; i++) {
            var f = structure.fields[i];

            var wrap = document.createElement("div");
            wrap.className = "field";

            var lbl = document.createElement("label");
            lbl.setAttribute("for", "field-" + f.id);
            lbl.textContent = f.label;

            var inp = document.createElement("input");
            inp.type = f.type || "number";
            inp.id = "field-" + f.id;
            inp.name = f.id;
            inp.value = String(f.default);
            if (typeof f.step !== "undefined") inp.step = String(f.step);
            if (typeof f.min  !== "undefined") inp.min  = String(f.min);
            inp.autocomplete = "off";

            wrap.appendChild(lbl);
            wrap.appendChild(inp);
            elFieldsContainer.appendChild(wrap);
        }
        elBtnGenerate.disabled = false;
    }

    /* ------------------------------------------------------------------
       Validação + submit
       ------------------------------------------------------------------ */
    function collectValues(structure) {
        var values = {};
        var errors = [];

        for (var i = 0; i < structure.fields.length; i++) {
            var f = structure.fields[i];
            var el = document.getElementById("field-" + f.id);
            if (!el) { errors.push("Campo ausente: " + f.label); continue; }

            var raw = String(el.value || "").replace(",", ".").trim();
            if (raw === "") {
                errors.push("\"" + f.label + "\" está vazio.");
                continue;
            }
            var n = parseFloat(raw);
            if (isNaN(n)) {
                errors.push("\"" + f.label + "\" não é um número válido.");
                continue;
            }
            if (n <= 0) {
                errors.push("\"" + f.label + "\" deve ser maior que zero.");
                continue;
            }
            values[f.id] = n;
        }
        return { values: values, errors: errors };
    }

    function validateStructureRules(structure, values) {
        // Regra específica do Stand-up Pouch:
        // posição do zíper não pode entrar na zona de sanfona.
        if (structure.id === "standup-pouch") {
            var utilFrente = values.compMM - values.sanfMM;
            if (values.ziperMM >= utilFrente) {
                return "A posição do zíper (" + values.ziperMM +
                       " mm) cruza a zona de sanfona (" + utilFrente +
                       " mm útil). Revise as dimensões.";
            }
        }
        return null;
    }

    function buildHostCall(structure, values) {
        var args = [];
        for (var i = 0; i < structure.fields.length; i++) {
            var f = structure.fields[i];
            args.push(String(values[f.id]));
        }
        return structure.hostFunction + "(" + args.join(", ") + ")";
    }

    function onSubmit(ev) {
        ev.preventDefault();
        if (!selectedStructureId) return;

        var structure = getStructureById(selectedStructureId);
        if (!structure || !structure.enabled) return;

        var collected = collectValues(structure);
        if (collected.errors.length > 0) {
            showStatus("error", collected.errors.join(" "));
            return;
        }

        var ruleErr = validateStructureRules(structure, collected.values);
        if (ruleErr) {
            showStatus("warn", ruleErr);
            return;
        }

        showStatus("info", "Gerando planta…");
        elBtnGenerate.disabled = true;

        var call = buildHostCall(structure, collected.values);
        cs.evalScript(call, function (result) {
            elBtnGenerate.disabled = false;
            handleHostResult(result);
        });
    }

    function handleHostResult(result) {
        if (typeof result === "undefined" || result === null || result === "" || result === "undefined") {
            showStatus("error", "Sem resposta do Illustrator. Verifique se o host script foi carregado.");
            return;
        }
        if (result.indexOf("EvalScript error") !== -1) {
            showStatus("error", "Erro no ExtendScript: " + result);
            return;
        }
        var parsed;
        try { parsed = JSON.parse(result); }
        catch (e) {
            showStatus("error", "Resposta inesperada: " + result);
            return;
        }
        if (parsed.ok) {
            showStatus("success", parsed.mensagem || "Planta gerada com sucesso.");
        } else {
            showStatus("error", parsed.erro || "Falha ao gerar planta.");
        }
    }

    /* ------------------------------------------------------------------
       Status area
       ------------------------------------------------------------------ */
    function showStatus(kind, msg) {
        elStatusArea.innerHTML = "";
        var div = document.createElement("div");
        div.className = "status-message " + (kind === "info" ? "warn" : kind);
        var icon = document.createElement("span");
        icon.className = "status-icon";
        icon.textContent = kind === "success" ? "\u2705"
                         : kind === "error"   ? "\u26D4"
                         : kind === "warn"    ? "\u26A0"
                         : "\u2139";
        var txt = document.createElement("span");
        txt.textContent = msg;
        div.appendChild(icon);
        div.appendChild(txt);
        elStatusArea.appendChild(div);
    }
    function clearStatus() { elStatusArea.innerHTML = ""; }

    /* ------------------------------------------------------------------
       Bootstrap
       ------------------------------------------------------------------ */
    function init() {
        applyTheme();

        // Listener de troca de tema do Illustrator
        cs.addEventListener("com.adobe.csxs.events.ThemeColorChanged", applyTheme);

        renderStructureList();
        loadHostScripts();

        elForm.addEventListener("submit", onSubmit);

        // Pré-seleciona Stand-up Pouch (única estrutura ativa na v1.0.0)
        selectStructure("standup-pouch");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
