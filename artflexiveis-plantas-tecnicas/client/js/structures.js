/* =======================================================================
   structures.js
   Registro central das estruturas de embalagem flexível suportadas pelo
   plugin. Para adicionar uma nova estrutura:
     1. Adicione um objeto ao array STRUCTURES abaixo.
     2. Crie o .jsx correspondente em host/ (implementando hostFunction).
     3. Carregue o .jsx no startup de main.js (loadHostScripts).

   Campos do objeto:
     - id (string)           : identificador único em kebab-case
     - name (string)         : rótulo visível na UI
     - enabled (bool)        : true = ativo; false = aparece com badge "Em breve"
     - icon (string)         : emoji ou caractere (pode ser SVG inline no futuro)
     - fields (array)        : parâmetros do formulário
         - id (string)       : chave usada ao invocar a hostFunction
         - label (string)    : rótulo visível à esquerda do input
         - type (string)     : "number" (input numérico — default)
                               "checkbox" (boolean standalone, sem input numérico)
                               "section"  (cabeçalho visual, não envia valor)
         - default            : valor padrão (number p/ "number", bool p/ "checkbox")
         - step (number)     : incremento/decremento (usado pelo spinner)
         - min  (number)     : valor mínimo (validação)
         - allowZero (bool)  : (opcional) quando true, valida com n >= 0 em
                               vez do padrão n > 0. Use para recuos,
                               distâncias e demais valores que podem ser 0.
         - allowNegative (bool) : (opcional) quando true, aceita valores
                               negativos (não aplica validação de sinal nem
                               usa atributo `min`). Use para deslocamentos
                               bidirecionais, como "Deslocamento de arte" do
                               Nylon Poli (-5 = arte menor que queijo).
         - toggle (object)   : (opcional) adiciona um checkbox inline à
                               esquerda do label, habilitando/desabilitando
                               o input. Campos:
                                 - id (string)      : id do boolean enviado ao host
                                 - default (bool)   : estado inicial do checkbox
                               Quando o checkbox está desmarcado, o número
                               é enviado mesmo assim (o host ignora via flag)
                               e a validação do campo é pulada.
         - visibleWhen (obj) : (opcional) mapa { otherFieldId: expectedValue }
                               — o campo só é mostrado/validado quando TODAS
                               as condições casam. Ex.: { hasQueijo: true }.
         - exclusiveWith     : (opcional, só em "checkbox") id de outro
                               checkbox mutuamente exclusivo — quando este
                               vira true, o outro é forçado a false.
         - lockedBy (obj)    : (opcional, só em "number") trava o input
                               quando outro checkbox está marcado:
                                 - field     (string) : id do checkbox
                                 - value     (bool)   : valor que ativa a trava
                                 - lockValue (number) : valor forçado no input
         - disabledWhenAny (obj) : (opcional, só em "number") mapa
                               { otherFieldId: expectedValue } — desabilita o
                               input quando QUALQUER condição casar
                               (semântica OR). Diferente de `lockedBy`: aceita
                               múltiplos gatilhos e NÃO força um valor; o
                               valor atual é preservado para reuso quando o
                               gatilho voltar a falso. O valor continua sendo
                               enviado ao host (campo permanece visível).
     - hostFunction (string) : nome da função ExtendScript a ser invocada
     - argOrder (array)      : (opcional) ordem explícita dos argumentos na
                               chamada ao host. Use quando algum field tiver
                               `toggle` e você quiser posicionar a flag em
                               local específico na assinatura, ou quando
                               houver campos "checkbox"/"section" que não
                               seguem a ordem natural. Se omitido, a ordem
                               é a dos fields (com a flag imediatamente
                               antes do seu campo, e ignorando "section").
   ======================================================================= */

var STRUCTURES = [
    {
        id: "standup-pouch",
        name: "Stand-up Pouch",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            { id: "compMM",  label: "Comprimento (mm)", type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM",  label: "Largura (mm)",   type: "number", default: 160, step: 0.1, min: 0 },
            { id: "sanfMM",  label: "Sanfona (mm)",    type: "number", default: 40,  step: 0.1, min: 0, allowZero: true },
            { id: "abreMM",  label: "Abre Fácil (mm)",       type: "number", default: 20,  step: 0.1, min: 0, toggle: { id: "hasAbreFacil", default: true } },
            { id: "ziperMM", label: "Zíper (mm)",            type: "number", default: 25,  step: 0.1, min: 0, toggle: { id: "hasZiper",     default: true } }
        ],
        hostFunction: "gerarStandupPouch"
    },
    {
        id: "4-soldas",
        name: "4 Soldas",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            { id: "compMM", label: "Comprimento (mm)",      type: "number", default: 300, step: 0.1, min: 0 },
            { id: "largMM", label: "Largura (mm)",          type: "number", default: 175, step: 0.1, min: 0 },
            { id: "sanfMM", label: "Sanfona (mm)",  type: "number", default: 30,  step: 0.1, min: 0 }
        ],
        hostFunction: "gerar4Soldas"
    },
    {
        id: "dorso",
        name: "Dorso",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            { id: "compMM", label: "Comprimento (mm)",      type: "number", default: 230, step: 0.1, min: 0 },
            { id: "largMM", label: "Largura (mm)",          type: "number", default: 155, step: 0.1, min: 0 },
            // Sanfona opcional (toggle inline). Quando o checkbox estiver
            // desmarcado, o host recebe hasSanfona=false e ignora sanfMM,
            // tratando a estrutura como "Dorso sem Sanfona" (V2.0).
            { id: "sanfMM", label: "Sanfona (mm)",  type: "number", default: 20,  step: 0.1, min: 0,
              toggle: { id: "hasSanfona", default: false } }
        ],
        hostFunction: "gerarDorso"
    },
    {
        id: "nylon-poli",
        name: "Nylon Poli",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            // Bases (sempre visíveis)
            { id: "compMM",    label: "Comprimento (mm)",   type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM",    label: "Largura (mm)",     type: "number", default: 160, step: 0.1, min: 0 },
            // Selagem e Distância de Fundo são desabilitadas quando o usuário
            // optar por dimensionar pela arte ou pelo queijo — nesses modos
            // a peça é construída a partir do bloco escolhido e os valores
            // de selagem/fundo permanecem fixos no padrão da estrutura.
            { id: "selagemMM", label: "Área de Selagem (mm)",    type: "number", default: 45,  step: 0.1, min: 0, allowZero: true,
              disabledWhenAny: { hasArte: true, hasQueijo: true } },
            { id: "fundoMM",   label: "Distância de Fundo (mm)", type: "number", default: 10,  step: 0.1, min: 0, allowZero: true,
              disabledWhenAny: { hasArte: true, hasQueijo: true } },

            // "Somente frente" — gera 1 face (sem verso)
            { id: "somenteFrente", label: "Somente Frente", type: "checkbox", default: false },

            // "Solda Fundo" — inverte a orientação (solda no fundo em vez das laterais)
            { id: "soldaFundo",    label: "Solda Fundo",    type: "checkbox", default: false },

            // --- Bloco "Tamanho do queijo" (mutuamente exclusivo com arte) ---
            { id: "hasQueijo", label: "Tamanho do Queijo", type: "checkbox", default: false, exclusiveWith: "hasArte" },
            { id: "queijoRedondo", label: "Queijo Redondo", type: "checkbox", default: false,
              visibleWhen: { hasQueijo: true } },
            { id: "queijoDiam", label: "Diâmetro do Queijo (mm)", type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: true } },
            { id: "queijoComp", label: "Comprimento do Queijo (mm)", type: "number", default: 180, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: false } },
            { id: "queijoLarg", label: "Largura do Queijo (mm)", type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: false } },
            { id: "queijoAlt",  label: "Altura do Queijo (mm)",  type: "number", default: 60, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true } },
            // Deslocamento pode ser negativo (-5 = arte menor que queijo)
            { id: "recuoMM",    label: "Deslocamento de Arte (mm)", type: "number", default: 0, step: 0.1, allowNegative: true,
              visibleWhen: { hasQueijo: true },
              lockedBy: { field: "bordaCaida", value: true, lockValue: 5 } },
            { id: "bordaCaida", label: "Borda Caída", type: "checkbox", default: false,
              visibleWhen: { hasQueijo: true } },

            // --- Bloco "Tamanho da arte" (mutuamente exclusivo com queijo) ---
            { id: "hasArte", label: "Tamanho da Arte", type: "checkbox", default: false, exclusiveWith: "hasQueijo" },
            { id: "arteRedonda", label: "Arte Redonda", type: "checkbox", default: false,
              visibleWhen: { hasArte: true } },

            // Frente
            { id: "_secFrenteNP", label: "Frente", type: "section",
              visibleWhen: { hasArte: true } },
            { id: "arteDiamF", label: "Diâmetro (mm)", type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: true } },
            { id: "arteTamF",  label: "Comprimento (mm)", type: "number", default: 180, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: false } },
            { id: "arteLargF", label: "Largura (mm)",     type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: false } },
            { id: "arteFundoF", label: "Distância de Fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
              visibleWhen: { hasArte: true } },

            // Verso (escondido quando "Somente frente" marcado)
            { id: "_secVersoNP", label: "Verso", type: "section",
              visibleWhen: { hasArte: true, somenteFrente: false } },
            { id: "arteDiamV", label: "Diâmetro (mm)", type: "number", default: 110, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: true, somenteFrente: false } },
            { id: "arteTamV",  label: "Comprimento (mm)", type: "number", default: 170, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: false, somenteFrente: false } },
            { id: "arteLargV", label: "Largura (mm)",     type: "number", default: 110, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: false, somenteFrente: false } },
            { id: "arteFundoV", label: "Distância de Fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
              visibleWhen: { hasArte: true, somenteFrente: false } }
        ],
        hostFunction: "gerarNylonPoli",
        // Ordem explícita dos 24 argumentos enviados a gerarNylonPoli(...).
        // Espelha a assinatura declarada em host/nylon-poli.jsx.
        argOrder: [
            "compMM", "largMM", "selagemMM", "fundoMM", "somenteFrente", "soldaFundo",
            "hasQueijo", "queijoRedondo", "queijoComp", "queijoLarg", "queijoDiam", "queijoAlt", "bordaCaida",
            "recuoMM",
            "hasArte", "arteRedonda",
            "arteTamF", "arteLargF", "arteDiamF", "arteFundoF",
            "arteTamV", "arteLargV", "arteDiamV", "arteFundoV"
        ]
    },
    {
        id: "pe-pp",
        name: "PE/PP",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            // Bases (sempre visíveis)
            { id: "compMM",    label: "Comprimento (mm)",   type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM",    label: "Largura (mm)",     type: "number", default: 160, step: 0.1, min: 0 },
            // Selagem e Distância de Fundo são desabilitadas quando o usuário
            // optar por dimensionar pela arte — nesse modo a peça é construída
            // a partir do bloco da arte e os valores permanecem fixos no
            // padrão da estrutura.
            { id: "selagemMM", label: "Área de Selagem (mm)",    type: "number", default: 30,  step: 0.1, min: 0, allowZero: true,
              disabledWhenAny: { hasArte: true } },
            { id: "fundoMM",   label: "Distância de Fundo (mm)", type: "number", default: 10,  step: 0.1, min: 0, allowZero: true,
              disabledWhenAny: { hasArte: true } },

            // "Somente frente" — gera 1 face (sem verso)
            { id: "somenteFrente", label: "Somente Frente", type: "checkbox", default: false },

            // "Solda Fundo" — inverte a orientação (solda no fundo) e força frente única no host
            { id: "soldaFundo",    label: "Solda Fundo",    type: "checkbox", default: false },

            // Sanfona (toggle inline — valor só é usado quando o checkbox está marcado)
            { id: "sanfonaMM", label: "Sanfona (mm)", type: "number", default: 20, step: 0.1, min: 0,
              toggle: { id: "hasSanfona", default: false } },

            // --- Bloco "Tamanho da arte" (arte custom) ---
            { id: "hasArte", label: "Tamanho da Arte", type: "checkbox", default: false },

            // Frente
            { id: "_secFrentePP", label: "Frente", type: "section",
              visibleWhen: { hasArte: true } },
            { id: "arteTamF",  label: "Comprimento (mm)", type: "number", default: 180, step: 0.1, min: 0,
              visibleWhen: { hasArte: true } },
            { id: "arteLargF", label: "Largura (mm)",     type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasArte: true } },
            { id: "arteFundoF", label: "Distância de Fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
              visibleWhen: { hasArte: true } },

            // Verso (escondido quando "Somente frente" OU "Solda Fundo" marcados —
            // a lógica do reference força frente única em ambos os casos)
            { id: "_secVersoPP", label: "Verso", type: "section",
              visibleWhen: { hasArte: true, somenteFrente: false, soldaFundo: false } },
            { id: "arteTamV",  label: "Comprimento (mm)", type: "number", default: 170, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, somenteFrente: false, soldaFundo: false } },
            { id: "arteLargV", label: "Largura (mm)",     type: "number", default: 110, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, somenteFrente: false, soldaFundo: false } },
            { id: "arteFundoV", label: "Distância de Fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
              visibleWhen: { hasArte: true, somenteFrente: false, soldaFundo: false } }
        ],
        hostFunction: "gerarPePp",
        // Ordem explícita dos 15 argumentos enviados a gerarPePp(...).
        // Espelha a assinatura declarada em host/pe-pp.jsx.
        argOrder: [
            "compMM", "largMM", "selagemMM", "fundoMM", "somenteFrente", "soldaFundo",
            "hasSanfona", "sanfonaMM",
            "hasArte",
            "arteTamF", "arteLargF", "arteFundoF",
            "arteTamV", "arteLargV", "arteFundoV"
        ]
    },
    {
        id: "pe-pe",
        name: "PE + PE (Laminados)",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            { id: "compMM", label: "Comprimento (mm)", type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM", label: "Largura (mm)",   type: "number", default: 160, step: 0.1, min: 0 },
            // Sanfona opcional (toggle inline). Quando o checkbox estiver
            // desmarcado, o host recebe hasSanfona=false e ignora sanfonaMM,
            // gerando o pouch plano (V1.0). Quando marcado, adiciona 2 linhas
            // principais (\u00B1sanfonaMM do centro) + 4 K-seal (\u00B15mm de cada
            // principal) e cotas detalhadas \u2014 comportamento V2.0 do reference.
            { id: "sanfonaMM", label: "Sanfona (mm)", type: "number", default: 20, step: 0.1, min: 0,
              toggle: { id: "hasSanfona", default: false } }
        ],
        hostFunction: "gerarPePe",
        // Ordem expl\u00EDcita dos 4 argumentos enviados a gerarPePe(...).
        // Espelha a assinatura declarada em host/pe-pe.jsx.
        argOrder: ["compMM", "largMM", "hasSanfona", "sanfonaMM"]
    },
    {
        id: "box-pouch",
        name: "Box Pouch",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            { id: "compMM",  label: "Comprimento (mm)", type: "number", default: 225, step: 0.1, min: 0 },
            { id: "largMM",  label: "Largura (mm)",     type: "number", default: 195, step: 0.1, min: 0 },
            { id: "sanfMM",  label: "Sanfona (mm)",     type: "number", default: 40,  step: 0.1, min: 0 },
            // Z\u00EDper Mickey opcional (toggle inline). Quando o checkbox estiver
            // desmarcado, o host recebe hasZiper=false e ignora ziperMM.
            { id: "ziperMM", label: "Dist\u00E2ncia do z\u00EDper (mm)", type: "number", default: 20, step: 0.1, min: 0,
              toggle: { id: "hasZiper", default: false } }
        ],
        hostFunction: "gerarBoxPouch"
    },
    {
        id: "fundo-redondo",
        name: "Fundos Redondos",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            // Bases (sempre visíveis)
            { id: "compMM",    label: "Comprimento (mm)",     type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM",    label: "Largura (mm)",         type: "number", default: 160, step: 0.1, min: 0 },
            // Selagem agora é parâmetro do usuário (V2.0). V1.0 era fixa em 30mm.
            { id: "selagemMM", label: "Área de Selagem (mm)", type: "number", default: 45,  step: 0.1, min: 0, allowZero: true },

            // "Somente frente" — gera 1 face (sem verso). Em PE, ativa o layout EM PÉ.
            { id: "somenteFrente", label: "Somente Frente", type: "checkbox", default: false },

            // "PE" (Pouch Envelope) — fundo com 2 cantos arredondados R=48,5 mm
            // (sem solda física). Com "Somente frente": peça EM PÉ. Sem: frente+verso DEITADO.
            { id: "isPE", label: "PE", type: "checkbox", default: false },

            // --- Bloco "Tamanho do queijo" (mutuamente exclusivo com arte) ---
            { id: "hasQueijo", label: "Tamanho do Queijo", type: "checkbox", default: false, exclusiveWith: "hasArte" },
            { id: "queijoRedondo", label: "Queijo Redondo", type: "checkbox", default: false,
              visibleWhen: { hasQueijo: true } },
            { id: "queijoDiam", label: "Diâmetro do Queijo (mm)", type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: true } },
            { id: "queijoComp", label: "Comprimento do Queijo (mm)", type: "number", default: 140, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: false } },
            { id: "queijoLarg", label: "Largura do Queijo (mm)", type: "number", default: 80, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: false } },
            { id: "queijoAlt",  label: "Altura do Queijo (mm)",  type: "number", default: 50, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true } },
            // Deslocamento de arte (V2.0): semântica nova — positivo expande arte
            // (maior que queijo), negativo recua (menor). Verso = frente − 5 mm.
            // Travado em 5 mm quando borda caída.
            { id: "recuoMM",    label: "Deslocamento de Arte (mm)", type: "number", default: 0, step: 0.1, allowNegative: true,
              visibleWhen: { hasQueijo: true },
              lockedBy: { field: "bordaCaida", value: true, lockValue: 5 } },
            { id: "bordaCaida", label: "Borda Caída", type: "checkbox", default: false,
              visibleWhen: { hasQueijo: true } },

            // --- Bloco "Tamanho da arte" (mutuamente exclusivo com queijo) ---
            { id: "hasArte", label: "Tamanho da Arte", type: "checkbox", default: false, exclusiveWith: "hasQueijo" },
            { id: "arteRedonda", label: "Arte Redonda", type: "checkbox", default: false,
              visibleWhen: { hasArte: true } },

            // Frente
            { id: "_secFrente", label: "Frente", type: "section",
              visibleWhen: { hasArte: true } },
            { id: "arteDiamF", label: "Diâmetro (mm)", type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: true } },
            { id: "arteTamF",  label: "Tamanho (mm)",  type: "number", default: 180, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: false } },
            { id: "arteLargF", label: "Largura (mm)",  type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: false } },
            { id: "arteFundoF", label: "Distância de Fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
              visibleWhen: { hasArte: true } },

            // Verso (escondido quando "Somente frente" marcado)
            { id: "_secVerso", label: "Verso", type: "section",
              visibleWhen: { hasArte: true, somenteFrente: false } },
            { id: "arteDiamV", label: "Diâmetro (mm)", type: "number", default: 110, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: true, somenteFrente: false } },
            { id: "arteTamV",  label: "Tamanho (mm)",  type: "number", default: 170, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: false, somenteFrente: false } },
            { id: "arteLargV", label: "Largura (mm)",  type: "number", default: 110, step: 0.1, min: 0,
              visibleWhen: { hasArte: true, arteRedonda: false, somenteFrente: false } },
            { id: "arteFundoV", label: "Distância de Fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
              visibleWhen: { hasArte: true, somenteFrente: false } }
        ],
        hostFunction: "gerarFundoRedondo",
        // Ordem explícita dos 23 argumentos enviados a gerarFundoRedondo(...).
        // Espelha a assinatura declarada em host/fundo-redondo.jsx (V2.0:
        // adicionados `selagemMM` e `isPE` em relação à V1.0).
        argOrder: [
            "compMM", "largMM", "selagemMM", "somenteFrente", "isPE",
            "hasQueijo", "queijoRedondo", "queijoComp", "queijoLarg", "queijoDiam", "queijoAlt", "bordaCaida",
            "recuoMM",
            "hasArte", "arteRedonda",
            "arteTamF", "arteLargF", "arteDiamF", "arteFundoF",
            "arteTamV", "arteLargV", "arteDiamV", "arteFundoV"
        ]
    },
    {
        id: "sleeve-rotulo",
        name: "Sleeve e Rótulo",
        enabled: true,
        icon: "📦",
        fields: [
            // Bases (sempre visíveis)
            { id: "compMM", label: "Comprimento (mm)", type: "number", default: 100, step: 0.1, min: 0 },
            { id: "largMM", label: "Largura (mm)",     type: "number", default: 80,  step: 0.1, min: 0 },

            // Tipo de Material — radio-style: dois checkboxes mutuamente exclusivos.
            // Por padrão Sleeve fica marcado (espelha o default do reference).
            // Se o usuário desmarcar Sleeve sem marcar Rótulo, o host normaliza
            // para Rótulo (alternativo natural quando isSleeve=false).
            { id: "isSleeve", label: "Sleeve", type: "checkbox", default: true,  exclusiveWith: "isRotulo" },
            { id: "isRotulo", label: "Rótulo", type: "checkbox", default: false, exclusiveWith: "isSleeve" },

            // Pigmentação — só aplicável a Rótulo. Default: Natural (pigBranco=false).
            // Quando marcado: adiciona Fundo cinza, troca cor do Material para
            // branco e desenha as 2 fotocélulas K100 dentro do grupo Arte.
            { id: "pigBranco", label: "Pig. Branco", type: "checkbox", default: false,
              visibleWhen: { isRotulo: true } }
        ],
        hostFunction: "gerarSleeveRotulo",
        // Ordem explícita dos 4 argumentos enviados a gerarSleeveRotulo(...).
        // Espelha a assinatura declarada em host/sleeve-rotulo.jsx.
        // Obs.: isRotulo existe apenas como par UI do isSleeve (exclusiveWith)
        //       e não é enviado ao host — o host deriva tipo a partir de isSleeve.
        argOrder: ["compMM", "largMM", "isSleeve", "pigBranco"]
    },
    {
        id: "pouch-lateral",
        name: "Pouch Lateral",
        enabled: true,
        icon: "📦",
        fields: [
            // Layout horizontal — frente + verso, soldas horizontais fixas 7,5 mm
            // (topo + fundo). Cameron 3 mm + Refile 3 mm laterais (padrão stand-up).
            // Sem opções extras — o reference (Pouch-Lateral_V1_0.JSX) só pede comprimento e largura.
            { id: "compMM", label: "Comprimento (mm)", type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM", label: "Largura (mm)",   type: "number", default: 160, step: 0.1, min: 0 }
        ],
        hostFunction: "gerarPouchLateral"
    },
    {
        id: "termo-lateral",
        name: "Termo e Outros (Lateral)",
        enabled: true,
        icon: "📦",
        fields: [
            // Defaults espelham o dialog do reference (Termo-Lateral_V1_0.jsx):
            // compMM=270, largMM=160, temVerso=true ("Frente e Verso").
            // Quando temVerso=false, o host gera apenas a face FRENTE (sem gap nem verso).
            { id: "compMM",   label: "Comprimento (mm)", type: "number",   default: 270, step: 0.1, min: 0 },
            { id: "largMM",   label: "Largura (mm)",   type: "number",   default: 160, step: 0.1, min: 0 },
            { id: "temVerso", label: "Frente e Verso",         type: "checkbox", default: true }
        ],
        hostFunction: "gerarTermoLateral",
        // Ordem explícita dos 3 argumentos enviados a gerarTermoLateral(...).
        // Espelha a assinatura declarada em host/termo-lateral.jsx.
        argOrder: ["compMM", "largMM", "temVerso"]
    }
];

/* Helpers de consulta */
function getStructureById(id) {
    for (var i = 0; i < STRUCTURES.length; i++) {
        if (STRUCTURES[i].id === id) return STRUCTURES[i];
    }
    return null;
}
