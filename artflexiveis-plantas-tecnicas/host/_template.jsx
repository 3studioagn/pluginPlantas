// ==========================================
// _TEMPLATE.JSX — Template para futuras estruturas
// ==========================================
// Para implementar uma nova estrutura:
//   1. Copie este arquivo como host/<nome-kebab>.jsx
//   2. Renomeie a função e implemente a lógica usando os helpers de core.jsx
//      (mm2pt, cmyk, drawRect, drawDashedRect, drawDashedRoundedRect,
//       drawLine, drawNotch, drawCotaH, drawCotaV, addText)
//   3. Em client/js/structures.js, mude enabled: true na entrada correspondente
//      e adicione os campos esperados.
//   4. Em client/js/main.js (loadHostScripts), adicione o caminho do novo
//      .jsx na lista de scripts carregados.
//
// Convenção de retorno (OBRIGATÓRIA): toda função pública deve retornar
// uma string JSON com o formato:
//     { ok: true,  mensagem: "..." }   // em caso de sucesso
//     { ok: false, erro: "..." }       // em caso de falha
//
// Use os helpers jsonOk(mensagem) e jsonErr(erro) definidos em core.jsx.
// ATENÇÃO: não use JSON.stringify diretamente — ExtendScript (ES3) não
// possui o objeto JSON nativo.
// ==========================================

function gerar[NomeDaEstrutura](/* parâmetros */) {
    try {
        // TODO: implementar a lógica de desenho aqui.
        // Use os helpers de core.jsx (já carregados no escopo global).
        return jsonErr("Estrutura ainda não implementada.");
    } catch (e) {
        return jsonErr((e && e.message) ? e.message : String(e));
    }
}
