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
            { id: "compMM",  label: "Comprimento Face (mm)", type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM",  label: "Largura/Altura (mm)",   type: "number", default: 160, step: 0.1, min: 0 },
            { id: "sanfMM",  label: "Sanfona Fundo (mm)",    type: "number", default: 40,  step: 0.1, min: 0 },
            { id: "abreMM",  label: "Abre fácil (mm)",       type: "number", default: 20,  step: 0.1, min: 0, toggle: { id: "hasAbreFacil", default: true } },
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
            { id: "sanfMM", label: "Sanfona Lateral (mm)",  type: "number", default: 30,  step: 0.1, min: 0 }
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
            { id: "sanfMM", label: "Sanfona Lateral (mm)",  type: "number", default: 20,  step: 0.1, min: 0 }
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
            { id: "compMM",    label: "Comprimento Face (mm)",   type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM",    label: "Largura/Altura (mm)",     type: "number", default: 160, step: 0.1, min: 0 },
            { id: "selagemMM", label: "Área de Selagem (mm)",    type: "number", default: 45,  step: 0.1, min: 0, allowZero: true },
            { id: "fundoMM",   label: "Distância de Fundo (mm)", type: "number", default: 10,  step: 0.1, min: 0, allowZero: true },

            // "Somente frente" — gera 1 face (sem verso)
            { id: "somenteFrente", label: "Somente frente", type: "checkbox", default: false },

            // "Solda Fundo" — inverte a orientação (solda no fundo em vez das laterais)
            { id: "soldaFundo",    label: "Solda Fundo",    type: "checkbox", default: false },

            // --- Bloco "Tamanho do queijo" (mutuamente exclusivo com arte) ---
            { id: "hasQueijo", label: "Tamanho do queijo", type: "checkbox", default: false, exclusiveWith: "hasArte" },
            { id: "queijoRedondo", label: "Queijo redondo", type: "checkbox", default: false,
              visibleWhen: { hasQueijo: true } },
            { id: "queijoDiam", label: "Diâmetro do queijo (mm)", type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: true } },
            { id: "queijoComp", label: "Comprimento do queijo (mm)", type: "number", default: 180, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: false } },
            { id: "queijoLarg", label: "Largura do queijo (mm)", type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: false } },
            { id: "queijoAlt",  label: "Altura do queijo (mm)",  type: "number", default: 60, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true } },
            // Deslocamento pode ser negativo (-5 = arte menor que queijo)
            { id: "recuoMM",    label: "Deslocamento de arte (mm)", type: "number", default: 0, step: 0.1, allowNegative: true,
              visibleWhen: { hasQueijo: true },
              lockedBy: { field: "bordaCaida", value: true, lockValue: 5 } },
            { id: "bordaCaida", label: "Borda caída", type: "checkbox", default: false,
              visibleWhen: { hasQueijo: true } },

            // --- Bloco "Tamanho da arte" (mutuamente exclusivo com queijo) ---
            { id: "hasArte", label: "Tamanho da arte", type: "checkbox", default: false, exclusiveWith: "hasQueijo" },
            { id: "arteRedonda", label: "Arte redonda", type: "checkbox", default: false,
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
            { id: "arteFundoF", label: "Distância de fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
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
            { id: "arteFundoV", label: "Distância de fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
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
        id: "coex",
        name: "Coex",
        enabled: false,
        icon: "\uD83D\uDCE6",
        fields: [],
        hostFunction: "gerarCoex"
    },
    {
        id: "termo",
        name: "Termo",
        enabled: false,
        icon: "\uD83D\uDCE6",
        fields: [],
        hostFunction: "gerarTermo"
    },
    {
        id: "pe-pp",
        name: "PE/PP",
        enabled: false,
        icon: "\uD83D\uDCE6",
        fields: [],
        hostFunction: "gerarPePp"
    },
    {
        id: "pe-pe",
        name: "PE + PE",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            { id: "compMM", label: "Comprimento Face (mm)", type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM", label: "Largura/Altura (mm)",   type: "number", default: 160, step: 0.1, min: 0 }
        ],
        hostFunction: "gerarPePe"
    },
    {
        id: "fundo-redondo",
        name: "Fundo Redondo",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            // Bases (sempre visíveis)
            { id: "compMM", label: "Comprimento (mm)", type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM", label: "Largura (mm)",     type: "number", default: 160, step: 0.1, min: 0 },

            // "Somente frente" — gera 1 face (sem verso)
            { id: "somenteFrente", label: "Somente frente", type: "checkbox", default: false },

            // --- Bloco "Tamanho do queijo" (mutuamente exclusivo com arte) ---
            { id: "hasQueijo", label: "Tamanho do queijo", type: "checkbox", default: false, exclusiveWith: "hasArte" },
            { id: "queijoRedondo", label: "Queijo redondo", type: "checkbox", default: false,
              visibleWhen: { hasQueijo: true } },
            { id: "queijoDiam", label: "Diâmetro do queijo (mm)", type: "number", default: 120, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: true } },
            { id: "queijoComp", label: "Comprimento do queijo (mm)", type: "number", default: 140, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: false } },
            { id: "queijoLarg", label: "Largura do queijo (mm)", type: "number", default: 80, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true, queijoRedondo: false } },
            { id: "queijoAlt",  label: "Altura do queijo (mm)",  type: "number", default: 50, step: 0.1, min: 0,
              visibleWhen: { hasQueijo: true } },
            { id: "recuoMM",    label: "Recuo da arte (mm)", type: "number", default: 5, step: 0.1, min: 0, allowZero: true,
              visibleWhen: { hasQueijo: true },
              lockedBy: { field: "bordaCaida", value: true, lockValue: 5 } },
            { id: "bordaCaida", label: "Borda caída", type: "checkbox", default: false,
              visibleWhen: { hasQueijo: true } },

            // --- Bloco "Tamanho da arte" (mutuamente exclusivo com queijo) ---
            { id: "hasArte", label: "Tamanho da arte", type: "checkbox", default: false, exclusiveWith: "hasQueijo" },
            { id: "arteRedonda", label: "Arte redonda", type: "checkbox", default: false,
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
            { id: "arteFundoF", label: "Distância de fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
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
            { id: "arteFundoV", label: "Distância de fundo (mm)", type: "number", default: 10, step: 0.1, min: 0, allowZero: true,
              visibleWhen: { hasArte: true, somenteFrente: false } }
        ],
        hostFunction: "gerarFundoRedondo",
        // Ordem explícita dos 21 argumentos enviados a gerarFundoRedondo(...).
        // Espelha a assinatura declarada em host/fundo-redondo.jsx.
        argOrder: [
            "compMM", "largMM", "somenteFrente",
            "hasQueijo", "queijoRedondo", "queijoComp", "queijoLarg", "queijoDiam", "queijoAlt", "bordaCaida",
            "recuoMM",
            "hasArte", "arteRedonda",
            "arteTamF", "arteLargF", "arteDiamF", "arteFundoF",
            "arteTamV", "arteLargV", "arteDiamV", "arteFundoV"
        ]
    }
];

/* Helpers de consulta */
function getStructureById(id) {
    for (var i = 0; i < STRUCTURES.length; i++) {
        if (STRUCTURES[i].id === id) return STRUCTURES[i];
    }
    return null;
}
