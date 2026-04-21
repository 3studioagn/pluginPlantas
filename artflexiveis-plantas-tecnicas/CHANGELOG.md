# Changelog

Todas as mudanças relevantes deste plugin serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/) e adota versionamento semântico.

---

## [1.3.1] — 2026-04-21

### Corrigido

- **Compatibilidade com Adobe Illustrator 2021+**: a extensão não aparecia no menu `Janela > Extensões` em versões do Illustrator anteriores à 2023 mesmo com `PlayerDebugMode` habilitado no registro. Causa: `ExtensionManifest Version="11.0"` declarava schema CEP 11, que hosts com CEP 10 (Illustrator 2021 de lançamento) não sabem parsear e por isso ignoravam a extensão silenciosamente.
  - `CSXS/manifest.xml`: `ExtensionManifest Version` rebaixado de `11.0` para `6.0` (schema estável desde CC 2014, retro-compatível com todos os CEPs mais novos).
  - `CSXS/manifest.xml`: faixa de host ajustada de `[22.0,99.9]` para `[25.0,99.9]` — alinha com o novo requisito mínimo (Illustrator 25.x = 2021).
  - README atualizado: requisito mínimo passa a ser "Illustrator 2021 (25.x) ou superior".

### Não alterado

- `client/js/lib/CSInterface.js` (v11.0.0) mantido — todas as APIs usadas pelo plugin (`new CSInterface()`, `getSystemPath(SystemPath.EXTENSION)`, `evalScript()`) existem desde CEP 4, então a lib roda em CEP 10+ sem ajuste.

---

## [1.3.0] — 2026-04-16

### Adicionado

- **Estrutura "Dorso com Sanfona" 100% funcional**, portada 1:1 do script original `reference/Dorso-com-Sanfona_V1_0.jsx`:
  - 3 parâmetros de entrada: Comprimento (default 230 mm), Largura (default 155 mm), Sanfona Lateral (default 20 mm).
  - Layout assimétrico com margens fixas: `[cameron 3][refile 3][MARGEM 30][meia-frente][sanfona aberta][face central][sanfona aberta][meia-frente][MARGEM 15][refile 3][cameron 3]`. Largura total = `2 × largMM`.
  - Cálculos internos: `faceCentralMM = largMM − 2×sanfMM − 15`; `sanfAbertaMM = 2 × sanfMM`; `meiaFrenteMM = (largMM − 2×sanfMM − 30) / 2`.
  - Retângulo "Material" (C15 M12 Y12 K0) cobrindo toda a largura útil.
  - Grupo "Cameron" com 2 retângulos pretos K100 nas extremidades.
  - **Grupo "Arte"** (novo — específico do Dorso):
    - Retângulo "Fotocélula" (15×10 mm, preto K100) no canto inferior esquerdo, 15 mm acima da base.
    - Retângulo "Arte" (magenta+amarelo `cmyk(0, 50, 100, 0)`) cobrindo do fim da Fotocélula até 3 mm além da extremidade direita, altura total do material.
  - Grupo "Cotas" (`groupAll`) com groupCotas interno contendo 13 cotas horizontais em 3 níveis (25/15/6 mm): nível 1 = largura total; nível 2 = margem-esq-dividida-em-2×15 + meia-frente-esq + sanfona-aberta + face-central + sanfona-aberta + meia-frente-dir + margem-dir (8 cotas); nível 3 = refile/cameron (4 cotas com labels verticais).
  - 1 cota vertical: comprimento total em `x0 − 14 mm`.
  - 2 linhas-limite magenta em `xPouchIni`/`xPouchFim` (de `yLimiteMaterial = yFundo − 3 mm` até `yCota3`).
  - Função interna `fmtMM(v)` preservada — formata valores em PT-BR (vírgula decimal quando há fração).
  - **Validação dupla**: `faceCentralMM > 0` (mensagem sobre largura) E `meiaFrenteMM > 0` (mensagem sobre meia-frente inválida), implementada no JS do painel (pré-evalScript) e no ExtendScript (defense-in-depth).
- Badge "Em breve" removido da entrada "Dorso" no seletor de estruturas.
- `host/dorso.jsx` carregado automaticamente no startup do painel (após `core.jsx`, `standup-pouch.jsx`, `4-soldas.jsx`).

### Reutilizado

- Nenhum helper novo em `core.jsx` — a implementação do Dorso usa apenas `mm2pt`, `cmyk`, `drawRect`, `drawLine`, `drawCotaH`, `drawCotaV`, `addText`, `getArialBold`, `applyArialBold`, `jsonOk`, `jsonErr` (todos já presentes desde v1.0.0/v1.1.0).

---

## [1.2.0] — 2026-04-16

### Alterado

- **Nome do plugin renomeado para "3Plan"**:
  - `CSXS/manifest.xml`: `<ExtensionBundleName>` e `<Menu>` atualizados (o plugin agora aparece em **Janela > Extensões > 3Plan**).
  - `client/index.html`: `<title>` atualizado.
  - Logo SVG em `client/assets/logo.svg` mantém o desenho da marca 3Studio (o nome do produto "3Plan" convive com a marca do estúdio).
- **Interface redesenhada** seguindo o frame Figma (file `FBOMWt4ZD8WLgS3RyrhYpf`, node `1:55`):
  - Header com logo (placeholder SVG `95×20`) à esquerda e título "Gerar planta" (decorativo) à direita.
  - Divisor horizontal `#d9d9d9` abaixo do header.
  - Label "Selecione a estrutura:" (Inter 13pt).
  - Box da lista de estruturas com fundo `#2c2c2c`, `border-radius: 19px`.
  - Cards de estrutura `272×35`, fundo `#404040`, `border-radius: 10px`, Inter 14pt.
  - Estruturas desabilitadas com `opacity: 0.4`, `cursor: not-allowed`, e badge "Em breve" com fundo translúcido.
  - Inputs do formulário `104×35`, fundo `#3a3a3a`, `border-radius: 10px`, texto centralizado.
  - Botão "GERAR PLANTA" full-width, estilo consistente com os cards.
  - Scrollbar customizada (trilho `#353535`, knob `#404040`, 6px).
  - Tipografia **Inter** carregada via Google Fonts com fallback para system-ui.
  - Dimensões do painel (manifest): Size `363×620`, MinSize `320×520`, MaxSize `500×900`.
- **Alinhamento dos inputs**: o container `.fields-container` agora usa `display: grid` com `grid-template-columns: 1fr 104px`, e os wrappers `.field` usam `display: contents` — assim labels e inputs participam do mesmo grid, mantendo os inputs alinhados na mesma coluna independentemente da largura do label (antes, com `flex: space-between`, labels de tamanhos diferentes causavam desalinhamento horizontal dos inputs).

### Adicionado

- **Ícones do plugin** (5 PNGs `23×23` em `client/assets/icons/`, para os 5 estados declarados no manifest via `<Icons>`):
  - `icon-normal.png` — "3" em cinza escuro (#1A1A1A) para tema claro
  - `icon-rollover.png` — "3" em azul Adobe (#1473E6) no hover do tema claro
  - `icon-disabled.png` — "3" em cinza médio (#8A8A8A)
  - `icon-dark-normal.png` — "3" em off-white (#F0F0F0) para tema escuro
  - `icon-dark-rollover.png` — "3" em azul (#2680EB) no hover do tema escuro
  - Fonte renderizada: Segoe UI Bold (fallback Arial Bold). Ícones gerados via Python Pillow 12.2.0.
- **Placeholder SVG da logo** (`client/assets/logo.svg`) — `95×20` com texto de fallback; posteriormente substituído pelo arquivo definitivo da marca 3Studio enviado pelo usuário.

### Removido

- **Lógica de tema dinâmico** em `main.js` (funções `applyTheme`, `rgbStr`, `shade`, `clamp` e listener `com.adobe.csxs.events.ThemeColorChanged`) — o design agora é fixo escuro conforme o Figma. O arquivo caiu de 395 → 289 linhas.
- Variáveis CSS de tema dinâmico substituídas por cores fixas extraídas dos tokens do Figma.
- Ícone emoji (`📦`) dos cards da lista de estruturas — o novo design usa apenas o nome.

---

## [1.1.0] — 2026-04-16

### Adicionado

- **Estrutura "4 Soldas" 100% funcional**, portada 1:1 do script original `reference/4-Soldas _V1_0.JSX`:
  - 3 parâmetros de entrada: Comprimento (default 300 mm), Largura (default 175 mm), Sanfona Lateral (default 30 mm).
  - Layer única "V1", retângulo "Material" (C15 M12 Y12 K0) cobrindo toda a faixa útil (frente + verso + 2 sanfonas laterais), grupo "Cameron" com 2 retângulos pretos K100 nas extremidades.
  - Grupo "Cotas" (`groupAll`) contendo: 2 labels "SOLDA" horizontais dentro da faixa da solda-fundo (15 mm), 2 linhas horizontais K60 (limite inferior do material + limite superior da solda do fundo), e 5 sub-grupos de soldas verticais:
    - Grupo 1 (extremidade esquerda): 2 linhas + 1 label "SOLDA" rot=90
    - Grupo 2 (extremidade direita): 2 linhas + 1 label rot=90
    - Grupo 3 (início FRENTE): 3 linhas (central + ±7,5 mm) + 2 labels rot=90
    - Grupo 4 (fim FRENTE): 3 linhas + 2 labels
    - Grupo 5 (início VERSO): 3 linhas + 2 labels
  - 9 cotas horizontais em 3 níveis (25/15/6 mm acima de yTopo): nível 1 = largura total (2×largMM); nível 2 = sanfFaixa/utilFace/sanfFaixa/utilFace; nível 3 = refile/cameron (3 mm) com labels verticais.
  - 2 cotas verticais: comprimento total e solda-fundo (15 mm), com cotaV1 a 14 mm e cotaV2 a 5 mm à esquerda de `x0`.
  - 2 linhas-limite magenta em `xPouchIni`/`xPouchFim` (de `yLimiteMaterial = yFundo − 3 mm` até `yCota3`).
  - **Validação**: `largMM > 2 × sanfMM` (caso contrário `utilFace ≤ 0`), implementada tanto no JS do painel (pré-evalScript) quanto no ExtendScript (defense-in-depth).
- Badge "Em breve" removido da entrada "4 Soldas" no seletor de estruturas.
- `host/4-soldas.jsx` carregado automaticamente no startup do painel (após `core.jsx` e `standup-pouch.jsx`).

### Reutilizado

- Nenhum helper novo em `core.jsx` — a implementação de 4 Soldas usa apenas `mm2pt`, `cmyk`, `drawRect`, `drawLine`, `drawCotaH`, `drawCotaV`, `addText`, `getArialBold`, `applyArialBold`, `jsonOk`, `jsonErr` (todos já presentes desde a v1.0.0).

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

6. **Estruturas desabilitadas**: implementar progressivamente Nylon Poli (fundo/lateral), Coex, Termo, PE/PP, PE+PE — seguindo o guia de 3 passos do README. (4 Soldas foi implementada na v1.1.0, Dorso com Sanfona na v1.3.0.)

7. **Dead code em `gerar4Soldas`**: as variáveis `xSanfEsqDobra` e `xSanfCenDobra` são declaradas (linhas 95 e 99 do `host/4-soldas.jsx`) mas nunca usadas no restante do corpo. Preservadas em nome da paridade 1:1 com o script original. Podem ser removidas sem efeito funcional.

8. **Dead code em `gerarDorso`**: 8 variáveis/constantes são declaradas mas nunca usadas no corpo da função: `DESLOC_MM` (linha 25), `soldaLat` (linha 61), `soldaFundo` (linha 62, usado apenas por `ySoldaFundo` que também é dead), `ySoldaFundo` (linha 116), `yMeio` (linha 117), `xSanfEsqDobra` (linha 100), `xSanfDirDobra` (linha 103) e `corFaca` (linha 80). Todas preservadas por paridade 1:1; podem ser removidas sem efeito funcional. A primeira das duas validações do Dorso (`faceCentralMM > 0`) é logicamente redundante em relação à segunda (`meiaFrenteMM > 0` ⟺ `largMM > 2·sanfMM + 30` ⊂ `largMM > 2·sanfMM + 15`), mas preservada por paridade com o original.

Nada disso é bug crítico; são ajustes cosméticos/arquiteturais que podem ser avaliados caso a caso com o time de produção.
