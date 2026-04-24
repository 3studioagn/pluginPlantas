/* =======================================================================
   main.js
   Orquestração do painel:
     - Inicializa CSInterface
     - Carrega core.jsx + scripts das estruturas via $.evalFile
     - Renderiza a lista de estruturas (de structures.js)
     - Gera formulário dinâmico com base em structure.fields
     - Valida inputs e chama hostFunction via evalScript

   Tipos de campo suportados (ver structures.js para o schema completo):
     - "number"   : input numérico (com ou sem toggle-checkbox prefixado)
     - "checkbox" : boolean standalone (span full-width, sem input numérico)
     - "section"  : cabeçalho visual (span full-width, não envia valor)

   Recursos avançados (opt-in por campo/estrutura):
     - visibleWhen   : condicional entre campos
     - exclusiveWith : mutua exclusão entre dois checkboxes
     - lockedBy      : trava de um número por um checkbox externo
     - argOrder      : ordem explícita dos args na chamada do host

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
            p + "/host/dorso.jsx",
            p + "/host/pe-pe.jsx",
            p + "/host/fundo-redondo.jsx",
            p + "/host/nylon-poli.jsx",
            p + "/host/pe-pp.jsx"
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
            var wrap;
            if (f.type === "section") {
                wrap = renderSectionField(f);
            } else if (f.type === "checkbox") {
                wrap = renderCheckboxField(f);
            } else {
                wrap = renderNumberField(f);
            }
            elFieldsContainer.appendChild(wrap);
        }

        // Liga os toggles aos seus inputs (existente — field-with-toggle)
        wireToggleFields(structure);

        // Liga os checkboxes standalone (novo — exclusiveWith, visibleWhen, lockedBy)
        wireCheckboxFields(structure);

        // Primeira passada para aplicar visibilidade e travas
        recomputeFieldStates(structure);

        elBtnGenerate.disabled = false;
    }

    // ---------- Render: campo numérico (com ou sem toggle inline) ----------
    function renderNumberField(f) {
        var wrap = document.createElement("div");
        wrap.className = "field";
        if (f.toggle) wrap.className += " field-with-toggle";
        wrap.id = "fieldwrap-" + f.id;

        // Coluna 1: label (ou label-group com checkbox, se tiver toggle)
        var labelCell;
        if (f.toggle) {
            labelCell = document.createElement("span");
            labelCell.className = "field-label-group";

            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.id   = "toggle-" + f.toggle.id;
            cb.checked = !!f.toggle.default;
            cb.setAttribute("data-target", "field-" + f.id);

            var lbl = document.createElement("label");
            lbl.setAttribute("for", "field-" + f.id);
            lbl.textContent = f.label;

            labelCell.appendChild(cb);
            labelCell.appendChild(lbl);
        } else {
            labelCell = document.createElement("label");
            labelCell.setAttribute("for", "field-" + f.id);
            labelCell.textContent = f.label;
        }

        // Coluna 2: input numérico
        var inp = document.createElement("input");
        inp.type = f.type || "number";
        inp.id = "field-" + f.id;
        inp.name = f.id;
        inp.value = String(f.default);
        if (typeof f.step !== "undefined") inp.step = String(f.step);
        // allowNegative desliga o atributo min para que o input aceite valores < 0.
        if (typeof f.min  !== "undefined" && f.allowNegative !== true) {
            inp.min  = String(f.min);
        }
        inp.autocomplete = "off";

        wrap.appendChild(labelCell);
        wrap.appendChild(inp);
        return wrap;
    }

    // ---------- Render: checkbox standalone (span full-width) ----------
    function renderCheckboxField(f) {
        var wrap = document.createElement("div");
        wrap.className = "field field-checkbox";
        wrap.id = "fieldwrap-" + f.id;

        var lbl = document.createElement("label");
        lbl.className = "field-checkbox-label";
        lbl.setAttribute("for", "field-" + f.id);

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = "field-" + f.id;
        cb.name = f.id;
        cb.checked = !!f.default;

        var span = document.createElement("span");
        span.textContent = f.label;

        lbl.appendChild(cb);
        lbl.appendChild(span);
        wrap.appendChild(lbl);
        return wrap;
    }

    // ---------- Render: cabeçalho de seção (span full-width, sem valor) ----------
    function renderSectionField(f) {
        var wrap = document.createElement("div");
        wrap.className = "field field-section";
        wrap.id = "fieldwrap-" + f.id;

        var header = document.createElement("span");
        header.className = "field-section-header";
        header.textContent = f.label;

        wrap.appendChild(header);
        return wrap;
    }

    function wireToggleFields(structure) {
        for (var i = 0; i < structure.fields.length; i++) {
            var f = structure.fields[i];
            if (!f.toggle) continue;

            var cb  = document.getElementById("toggle-" + f.toggle.id);
            var inp = document.getElementById("field-"  + f.id);
            if (!cb || !inp) continue;

            (function (checkboxEl, numberEl) {
                function apply() {
                    numberEl.disabled = !checkboxEl.checked;
                }
                checkboxEl.addEventListener("change", apply);
                apply();
            })(cb, inp);
        }
    }

    // Liga os checkboxes standalone: exclusiveWith dispara desmarcação do par,
    // e qualquer mudança recomputa visibilidade/travas de toda a estrutura.
    function wireCheckboxFields(structure) {
        for (var i = 0; i < structure.fields.length; i++) {
            var f = structure.fields[i];
            if (f.type !== "checkbox") continue;

            var cb = document.getElementById("field-" + f.id);
            if (!cb) continue;

            (function (field, checkboxEl) {
                checkboxEl.addEventListener("change", function () {
                    if (checkboxEl.checked && field.exclusiveWith) {
                        var other = document.getElementById("field-" + field.exclusiveWith);
                        if (other && other.checked) {
                            other.checked = false;
                            // Re-dispara o change no par para cascata
                            var evt = document.createEvent("HTMLEvents");
                            evt.initEvent("change", false, true);
                            other.dispatchEvent(evt);
                        }
                    }
                    recomputeFieldStates(structure);
                });
            })(f, cb);
        }
    }

    // Avalia condição visibleWhen em cima de um snapshot de valores (state).
    // Compara valores com coerção apenas para booleanos (checkbox → bool).
    function evalVisibleWhen(field, state) {
        if (!field.visibleWhen) return true;
        for (var k in field.visibleWhen) {
            if (!field.visibleWhen.hasOwnProperty(k)) continue;
            var expected = field.visibleWhen[k];
            var actual = state[k];
            if (typeof expected === "boolean") actual = (actual === true);
            if (actual !== expected) return false;
        }
        return true;
    }

    // Após qualquer interação com checkbox (standalone ou exclusive), reavalia:
    //   1. Visibilidade dos campos (visibleWhen)
    //   2. Estado de trava dos números (lockedBy)
    function recomputeFieldStates(structure) {
        // 1. Snapshot dos valores atuais (checkboxes + números)
        var state = {};
        for (var i = 0; i < structure.fields.length; i++) {
            var f = structure.fields[i];
            if (f.type === "section") continue;
            var el = document.getElementById("field-" + f.id);
            if (!el) continue;
            state[f.id] = (f.type === "checkbox") ? !!el.checked : el.value;
        }

        // 2. Aplica visibleWhen em cada wrap
        for (var j = 0; j < structure.fields.length; j++) {
            var f2 = structure.fields[j];
            var visible = evalVisibleWhen(f2, state);
            var wrap = document.getElementById("fieldwrap-" + f2.id);
            if (wrap) wrap.style.display = visible ? "" : "none";
        }

        // 3. Aplica lockedBy nos números (desabilita + força lockValue)
        for (var k = 0; k < structure.fields.length; k++) {
            var f3 = structure.fields[k];
            if (!f3.lockedBy) continue;
            var parentVal = state[f3.lockedBy.field];
            var locked = (parentVal === f3.lockedBy.value);
            var inp = document.getElementById("field-" + f3.id);
            if (!inp) continue;
            inp.disabled = locked;
            if (locked) inp.value = String(f3.lockedBy.lockValue);
        }
    }

    /* ------------------------------------------------------------------
       Validação + submit
       ------------------------------------------------------------------ */
    function collectValues(structure) {
        var values = {};
        var errors = [];

        // Passe 1: coleta TODOS os booleanos (toggles e checkboxes standalone)
        // — precisamos deles para avaliar visibleWhen antes de validar números.
        for (var i = 0; i < structure.fields.length; i++) {
            var ft = structure.fields[i];
            if (ft.type === "section") continue;

            if (ft.toggle) {
                var cbT = document.getElementById("toggle-" + ft.toggle.id);
                values[ft.toggle.id] = cbT ? !!cbT.checked : !!ft.toggle.default;
            }
            if (ft.type === "checkbox") {
                var cbS = document.getElementById("field-" + ft.id);
                values[ft.id] = cbS ? !!cbS.checked : !!ft.default;
            }
        }

        // Passe 2: coleta os números, validando apenas quando visível E ativo.
        for (var j = 0; j < structure.fields.length; j++) {
            var f = structure.fields[j];
            if (f.type === "section") continue;
            if (f.type === "checkbox") continue; // já coletado

            var visible = evalVisibleWhen(f, values);
            var toggleActive = true;
            if (f.toggle) toggleActive = values[f.toggle.id] === true;

            var el = document.getElementById("field-" + f.id);
            if (!el) {
                if (toggleActive && visible) errors.push("Campo ausente: " + f.label);
                else values[f.id] = (typeof f.default === "number") ? f.default : 0;
                continue;
            }

            if (!visible) {
                // Invisível: não valida. Envia o valor do DOM (ou default) — o host
                // ignora via flag pai (hasQueijo, hasArte, etc.).
                var rawH = String(el.value || "").replace(",", ".").trim();
                var nH   = parseFloat(rawH);
                values[f.id] = isNaN(nH) ? ((typeof f.default === "number") ? f.default : 0) : nH;
                continue;
            }

            if (!toggleActive) {
                var rawIgnored = String(el.value || "").replace(",", ".").trim();
                var nIgnored   = parseFloat(rawIgnored);
                values[f.id] = isNaN(nIgnored) ? 0 : nIgnored;
                continue;
            }

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
            // Por padrão exigimos > 0; `allowZero: true` relaxa para >= 0.
            // `allowNegative: true` aceita qualquer sinal (usado no "Deslocamento
            // de arte" do Nylon Poli, que pode ser negativo).
            if (f.allowNegative === true) {
                // sem validação de sinal
            } else if (f.allowZero === true) {
                if (n < 0) { errors.push("\"" + f.label + "\" deve ser maior ou igual a zero."); continue; }
            } else {
                if (n <= 0) { errors.push("\"" + f.label + "\" deve ser maior que zero."); continue; }
            }
            values[f.id] = n;
        }
        return { values: values, errors: errors };
    }

    function validateStructureRules(structure, values) {
        // Regra específica do Stand-up Pouch:
        // posição do zíper não pode entrar na zona de sanfona
        // (só se aplica quando o zíper está habilitado).
        if (structure.id === "standup-pouch") {
            if (values.hasZiper === true) {
                var utilFrente = values.compMM - values.sanfMM;
                if (values.ziperMM >= utilFrente) {
                    return "A posição do zíper (" + values.ziperMM +
                           " mm) cruza a zona de sanfona (" + utilFrente +
                           " mm útil). Revise as dimensões.";
                }
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
        // Fundo Redondo: regras de limite (largMM/compMM) já são checadas no
        // host; aqui validamos apenas o que a UI pode antecipar sem repetir
        // a validação detalhada (queijo/arte — host faz).
        if (structure.id === "fundo-redondo") {
            if (values.largMM > 370) return "A largura máxima é 370 mm (limite do gabarito).";
            if (values.compMM > 460) return "O comprimento máximo é 460 mm (limite do gabarito).";
        }
        return null;
    }

    function buildHostCall(structure, values) {
        var args = [];
        if (structure.argOrder && structure.argOrder.length > 0) {
            // Ordem explícita: espelha a assinatura declarada no .jsx.
            for (var i = 0; i < structure.argOrder.length; i++) {
                var id = structure.argOrder[i];
                var v = values[id];
                if (typeof v === "boolean") args.push(v ? "true" : "false");
                else args.push(String(v));
            }
        } else {
            // Fallback legado (estruturas existentes): ordem dos fields, com
            // a flag do toggle emitida imediatamente antes do seu número.
            for (var j = 0; j < structure.fields.length; j++) {
                var f = structure.fields[j];
                if (f.type === "section") continue;
                if (f.toggle) {
                    var t = values[f.toggle.id];
                    args.push(t ? "true" : "false");
                }
                var vv = values[f.id];
                if (typeof vv === "boolean") {
                    args.push(vv ? "true" : "false");
                } else {
                    args.push(String(vv));
                }
            }
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
