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
         - label (string)    : rótulo visível acima do input
         - type (string)     : "number"
         - default (number)  : valor padrão
         - step (number)     : incremento/decremento (usado pelo spinner)
         - min  (number)     : valor mínimo (validação)
     - hostFunction (string) : nome da função ExtendScript a ser invocada
   ======================================================================= */

var STRUCTURES = [
    {
        id: "standup-pouch",
        name: "Stand-up Pouch",
        enabled: true,
        icon: "\uD83D\uDCE6",
        fields: [
            { id: "compMM",  label: "Comprimento Face (mm)",     type: "number", default: 260, step: 0.1, min: 0 },
            { id: "largMM",  label: "Largura/Altura (mm)",       type: "number", default: 160, step: 0.1, min: 0 },
            { id: "sanfMM",  label: "Sanfona Fundo (mm)",        type: "number", default: 40,  step: 0.1, min: 0 },
            { id: "abreMM",  label: "Distância Abre Fácil (mm)", type: "number", default: 20,  step: 0.1, min: 0 },
            { id: "ziperMM", label: "Distância Zíper (mm)",      type: "number", default: 25,  step: 0.1, min: 0 }
        ],
        hostFunction: "gerarStandupPouch"
    },
    {
        id: "4-soldas",
        name: "4 Soldas",
        enabled: false,
        icon: "\uD83D\uDCE6",
        fields: [],
        hostFunction: "gerar4Soldas"
    },
    {
        id: "dorso",
        name: "Dorso",
        enabled: false,
        icon: "\uD83D\uDCE6",
        fields: [],
        hostFunction: "gerarDorso"
    },
    {
        id: "nylon-poli-fundo",
        name: "Nylon Poli Solda Fundo",
        enabled: false,
        icon: "\uD83D\uDCE6",
        fields: [],
        hostFunction: "gerarNylonPoliFundo"
    },
    {
        id: "nylon-poli-lateral",
        name: "Nylon Poli Solda Lateral",
        enabled: false,
        icon: "\uD83D\uDCE6",
        fields: [],
        hostFunction: "gerarNylonPoliLateral"
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
        enabled: false,
        icon: "\uD83D\uDCE6",
        fields: [],
        hostFunction: "gerarPePe"
    }
];

/* Helpers de consulta */
function getStructureById(id) {
    for (var i = 0; i < STRUCTURES.length; i++) {
        if (STRUCTURES[i].id === id) return STRUCTURES[i];
    }
    return null;
}
