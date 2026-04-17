/* =======================================================================
   main.js
   Orquestração do painel:
     - Inicializa CSInterface
     - Carrega core.jsx + standup-pouch.jsx + 4-soldas.jsx via $.evalFile
     - Renderiza a lista de estruturas (de structures.js)
     - Gera formulário dinâmico com base em structure.fields
     - Valida inputs e chama hostFunction via evalScript

   Design fixo (dark) seguindo o frame Figma 1:55.
   ======================================================================= */

(function () {
    "use strict";

    var cs = new CSInterface();
    var selectedStructureId = null;

    /* ------------------------------------------------------------------
       Elementos DOM
       ------------------------------------------------------------------ */
    var elStructureList   = document.getElementById("structure-list");
    var elFieldsContainer = document.getElementById("fields-container");
    var elBtnGenerate     = document.getElementById("btn-generate");
    var elStatusArea      = document.getElementById("status-area");
    var elForm            = document.getElementById("structure-form");

    /* ------------------------------------------------------------------
       Carregamento dos scripts ExtendScript
       ------------------------------------------------------------------ */
    function loadHostScripts() {
        var extPath = cs.getSystemPath(SystemPath.EXTENSION);
        // Normaliza para forward slashes (ExtendScript aceita em ambos OS)
        var p = extPath.replace(/\\/g, "/");
        var scripts = [
            p + "/host/core.jsx",
            p + "/host/standup-pouch.jsx",
            p + "/host/4-soldas.jsx",
            p + "/host/dorso.jsx"
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

            var name = document.createElement("span");
            name.className = "structure-name";
            name.textContent = s.name;
            li.appendChild(name);

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
        // Regra específica do 4 Soldas:
        // largura precisa ser maior que 2x a sanfona lateral (senão utilFace <= 0).
        if (structure.id === "4-soldas") {
            var utilFace = values.largMM - (2 * values.sanfMM);
            if (utilFace <= 0) {
                return "A largura (" + values.largMM +
                       " mm) deve ser maior que 2x a sanfona (" +
                       (2 * values.sanfMM) + " mm).";
            }
        }
        // Regras específicas do Dorso com Sanfona:
        //   1. faceCentralMM = largMM − 2×sanfMM − 15 deve ser > 0
        //   2. meiaFrenteMM = (largMM − 2×sanfMM − 30) / 2 deve ser > 0
        if (structure.id === "dorso") {
            var faceCentralMM = values.largMM - (2 * values.sanfMM) - 15;
            if (faceCentralMM <= 0) {
                return "A largura (" + values.largMM +
                       " mm) deve ser maior que 2×sanfona+15 (" +
                       (2 * values.sanfMM + 15) + " mm).";
            }
            var meiaFrenteMM = (values.largMM - 2 * values.sanfMM - 30) / 2;
            if (meiaFrenteMM <= 0) {
                return "As medidas resultam em meia-frente inválida (" +
                       meiaFrenteMM + " mm). Ajuste os valores.";
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
        renderStructureList();
        loadHostScripts();

        elForm.addEventListener("submit", onSubmit);

        // Pré-seleciona Stand-up Pouch (1ª estrutura ativa)
        selectStructure("standup-pouch");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
