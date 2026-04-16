# Changelog

Todas as mudanças relevantes deste plugin serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/) e adota versionamento semântico.

---

## [1.0.0] — 2026-04-16

### Adicionado

- **CEP Extension dockável** para Adobe Illustrator 2024/2025 (CEP 11.0, HostList ILST 28.0–99.9).
- Painel HTML5 + CSS3 + JavaScript (vanilla, sem frameworks) com:
  - Header fixo com identidade ARTFLEXÍVEIS.
  - Seletor de estruturas com 9 itens (scrollável).
  - Formulário gerado dinamicamente a partir do array `fields` de `structures.js`.
  - Botão "GERAR PLANTA" full-width.
  - Área de status (sucesso, erro, aviso) abaixo do botão.
- **Tema adaptativo** sincronizado com `CSInterface.getHostEnvironment().appSkinInfo` — painel responde a troca de tema do Illustrator em tempo real via listener `com.adobe.csxs.events.ThemeColorChanged`.
- Suporte a separador decimal **vírgula** ou **ponto** nos inputs.
- **Validação pré-evalScript** no JS do painel:
  - Campos vazios, NaN ou ≤ 0 bloqueiam a geração.
  - Regra do Stand-up Pouch: `ziperMM ≥ compMM − sanfMM` é rejeitada antes de invocar o host.
- **Validação defense-in-depth** no ExtendScript (mesmo check do zíper) — retorna JSON de erro se violada.
- **Stand-up Pouch 100% funcional**, portado 1:1 do script original `reference/Stand-Up_V1_0.jsx`:
  - Layer única "V1" (layer default removida)
  - Retângulo "Material" (C15 M12 Y12 K0) criado primeiro — fica no fundo.
  - Grupo "Cameron" com 2 retângulos pretos K100.
  - Grupo "Cotas" (groupAll) com 4 textos SOLDA (Arial Bold 8pt), 7 linhas de faca/dobra (K60, tracejadas), 2 grupos de abre-fácil (cada um com 1 linha + 2 notches triangulares de 3.5 mm), 2 grupos de zíper (cada um com 1 retângulo externo tracejado 12 mm e 1 retângulo interno arredondado de 4 mm / raio 1.5 mm), 4 linhas K-Seal a ±5 mm das dobras de sanfona, e 2 linhas-limite de material (magenta M100).
  - Grupo interno de cotas (dentro de "Cotas") com 18 cotas horizontais em 5 níveis (45/35/25/15/6 mm) e 4 cotas verticais.
  - Labels verticais para as cotas de CAMERON (3 mm) e REFILE (3 mm) nas extremidades do nível 4.
- 8 estruturas adicionais listadas no painel com badge **"Em breve"** (4 Soldas, Dorso, Nylon Poli Solda Fundo, Nylon Poli Solda Lateral, Coex, Termo, PE/PP, PE + PE) — não clicáveis, opacidade reduzida.
- `.debug` configurado para porta **8088** (DevTools via `http://localhost:8088`).
- **README.md** completo: instalação passo-a-passo (Windows/macOS), habilitação CSXS.10/11/12, uso do painel, troubleshooting e guia de extensibilidade em 3 passos para adicionar novas estruturas.
- **host/_template.jsx** como ponto de partida para novas estruturas.
- Helpers `jsonOk(mensagem)` e `jsonErr(erro)` em `core.jsx` para gerar strings JSON de resposta no ExtendScript (runtime ES3 não possui `JSON` nativo — `JSON.stringify` indefinido). Inclui `escapeJsonString` com escape de `\`, `"`, `\n`, `\r`, `\t`, `\b`, `\f` e caracteres de controle < 0x20.

### Dependências

- `client/js/lib/CSInterface.js` v11.0.0 (cópia oficial do repositório `Adobe-CEP/CEP-Resources`).

---

## Notas para v1.1

Pontos identificados durante a portabilidade da v1.0.0 que foram **propositalmente preservados** em respeito à paridade 1:1 com o script original, e que podem ser revisitados em uma futura versão:

1. **Parâmetro `strokeW` ignorado em `drawLine`, `drawDashedRect` e `drawDashedRoundedRect`**. O argumento é recebido mas a largura do traço é hardcoded em 1 pt dentro das funções. Como resultado, os valores `0.75` passados nas linhas K-Seal e limite-material, e nos retângulos do zíper, são efetivamente ignorados. Se houver desejo de que K-Seal e limite-material saiam com 0.75 pt (diferenciando-se das linhas de faca em 1 pt), basta passar a usar o parâmetro dentro das funções em `core.jsx`.

2. **Mensagem da validação do zíper com valor hardcoded "25 mm"**. No script original (linha 247):
   ```javascript
   alert("Atenção: a posição do zíper (" + 25 + " mm) cruza a zona de sanfona ...");
   ```
   O valor `25` está literal em vez de usar `ziperMM`. Preservado como está em `standup-pouch.jsx` — mas a validação do JS do painel (pré-evalScript) já usa a variável correta, então o usuário final **não vê** a mensagem bugada na prática (o JS intercepta antes).

3. **`xCotaV2` igual a `xCotaV3`** (ambos `x0 − 5 mm`). No original, duas cotas verticais são desenhadas no mesmo X, com sobreposição visual. Preservado. Se desejado, `xCotaV2` poderia ser movido para, por exemplo, `x0 − mm2pt(9)` para afastar visualmente da cota V3.

4. **`app.redraw()` permanece dentro de `gerarStandupPouch`**. O documento recém-criado já é visível; o redraw é uma garantia extra. Sem efeito colateral observável; pode ser removido se desejado.

5. **Nenhum `document.activeView.zoom` definido**. O documento gerado abre no zoom padrão do Illustrator (geralmente 100%). Se desejado, pode-se adicionar `app.activeDocument.views[0].zoom = <fator>` antes do redraw.

6. **Estruturas desabilitadas**: implementar progressivamente 4 Soldas, Dorso, Nylon Poli (fundo/lateral), Coex, Termo, PE/PP, PE+PE — seguindo o guia de 3 passos do README.

Nada disso é bug crítico; são ajustes cosméticos/arquiteturais que podem ser avaliados caso a caso com o time de produção.
