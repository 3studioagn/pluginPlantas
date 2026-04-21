# ARTFLEXÍVEIS - Plantas Técnicas

Adobe CEP Extension para Adobe Illustrator que gera plantas técnicas de embalagens flexíveis. Painel dockável acessível via **Janela > Extensões > ARTFLEXÍVEIS - Plantas Técnicas**.

## Versão

**v1.0.0** — Primeira release funcional. Apenas **Stand-up Pouch** está habilitado; as demais 8 estruturas aparecem na UI com badge "Em breve".

## Requisitos

- Adobe Illustrator 2021 (25.x) ou superior
- Windows 10/11 ou macOS 11+
- Fonte Arial Bold instalada (recomendado; fallback automático se ausente)

## Estruturas suportadas

| # | Estrutura | Status |
|---|---|---|
| 1 | Stand-up Pouch | Ativo |
| 2 | 4 Soldas | Em breve |
| 3 | Dorso | Em breve |
| 4 | Nylon Poli Solda Fundo | Em breve |
| 5 | Nylon Poli Solda Lateral | Em breve |
| 6 | Coex | Em breve |
| 7 | Termo | Em breve |
| 8 | PE/PP | Em breve |
| 9 | PE + PE | Em breve |

---

## Instalação

### 1. Habilitar execução de extensões não assinadas

A extensão não está assinada com certificado Adobe (distribuição dev/teste local), então é necessário habilitar o modo debug do CEP **uma única vez** por máquina.

#### Windows

Abra `regedit.exe` e crie (ou edite) as chaves abaixo, definindo o valor `PlayerDebugMode` como string `"1"`:

```
HKEY_CURRENT_USER\Software\Adobe\CSXS.10 → PlayerDebugMode = "1"
HKEY_CURRENT_USER\Software\Adobe\CSXS.11 → PlayerDebugMode = "1"
HKEY_CURRENT_USER\Software\Adobe\CSXS.12 → PlayerDebugMode = "1"
```

Ou via PowerShell (um comando por versão do CSXS):

```powershell
New-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.10" -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force
New-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force
New-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.12" -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force
```

Se qualquer chave `Software\Adobe\CSXS.XX` não existir ainda, crie-a antes:

```powershell
New-Item -Path "HKCU:\Software\Adobe\CSXS.11" -Force
```

Reinicie o Illustrator após.

#### macOS

Abra o Terminal e execute:

```bash
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

Reinicie o Illustrator após.

### 2. Copiar a pasta da extensão

Copie a pasta `artflexiveis-plantas-tecnicas/` inteira para a pasta de extensões CEP:

#### Windows

```
%APPDATA%\Adobe\CEP\extensions\
```

Caminho completo (normalmente):

```
C:\Users\<SEU_USUARIO>\AppData\Roaming\Adobe\CEP\extensions\artflexiveis-plantas-tecnicas\
```

Alternativa com todos os usuários:

```
C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\
```

#### macOS

```
~/Library/Application Support/Adobe/CEP/extensions/
```

Caminho completo:

```
~/Library/Application Support/Adobe/CEP/extensions/artflexiveis-plantas-tecnicas/
```

Alternativa com todos os usuários:

```
/Library/Application Support/Adobe/CEP/extensions/
```

### 3. Abrir o painel no Illustrator

1. Abra o Adobe Illustrator.
2. Menu: **Janela > Extensões > ARTFLEXÍVEIS - Plantas Técnicas**.
3. O painel surge dockável na lateral — é possível arrastar para encaixar/flutuar.

---

## Uso

1. Com o painel aberto, selecione **Stand-up Pouch** na lista de estruturas (as demais estão desabilitadas na v1.0.0).
2. Ajuste os 5 parâmetros (valores em mm, aceita vírgula ou ponto como separador decimal):
   - **Comprimento Face** (default 260 mm)
   - **Largura/Altura** (default 160 mm)
   - **Sanfona Fundo** (default 40 mm)
   - **Distância Abre Fácil** (default 20 mm)
   - **Distância Zíper** (default 25 mm)
3. Clique em **GERAR PLANTA**. Um novo documento CMYK é criado com toda a planta técnica desenhada, centralizada.

### Validações automáticas

- Qualquer campo vazio, não numérico ou ≤ 0 bloqueia a geração e exibe erro no painel.
- Se a posição do zíper ≥ (comprimento − sanfona), a geração é bloqueada (zíper cruzaria a zona de sanfona).

### Estrutura do documento gerado

- Document color space: CMYK
- Tamanho: `(compMM*2 + 12) + 120` mm × `largMM + 160` mm
- Única layer chamada **V1**
- Objetos nomeados:
  - `Material` — retângulo cinza da base (C15 M12 Y12 K0)
  - Grupo `Cameron` — 2 retângulos pretos K100 nas laterais
  - Grupo `Cotas` — contém todos os textos, linhas de faca, abre-fácil, zíper, K-Seal, cotas e linhas-limite magenta

---

## Debug

O arquivo `.debug` expõe a porta **8088** para inspeção via Chromium DevTools:

1. Com o painel aberto no Illustrator, navegue em qualquer Chromium-based browser para:
   ```
   http://localhost:8088
   ```
2. Clique no inspector disponível para abrir o DevTools (console, DOM, network).
3. No console do DevTools você pode:
   - Inspecionar eventos do `CSInterface`
   - Chamar `cs.evalScript("$.writeln('hello')", function(r){console.log(r)})` para testar ExtendScript
   - Rerolar tema manualmente: `document.documentElement.style.setProperty('--bg','#ff0')`

Caso a porta 8088 conflite com outro serviço, edite `.debug` e escolha outra porta livre (entre 1024 e 65535).

### Logs do ExtendScript

`$.writeln(...)` imprime no console do ExtendScript Toolkit / ExtendScript Debugger (VSCode). Para mensagens rápidas, você pode abrir o Illustrator com a variável de ambiente `EXTENDSCRIPT_CONSOLE` definida.

---

## Como adicionar uma nova estrutura (guia para dev)

Três passos, totalmente não-invasivos:

### Passo 1 — Criar o script ExtendScript

Duplique `host/_template.jsx` como, por exemplo, `host/4-soldas.jsx`. Renomeie `gerar[NomeDaEstrutura]` para `gerar4Soldas` e implemente a lógica de desenho dentro do `try` usando os helpers disponíveis em `core.jsx` (`mm2pt`, `cmyk`, `drawRect`, `drawLine`, `drawNotch`, `drawCotaH`, `drawCotaV`, `drawDashedRect`, `drawDashedRoundedRect`, `addText`).

A função DEVE retornar uma string JSON via os helpers `jsonOk(mensagem)` e `jsonErr(erro)`, também disponíveis em `core.jsx`:

```javascript
return jsonOk("4 Soldas gerado com sucesso!");
// ou, em caso de erro de validação:
return jsonErr("Mensagem do erro");
```

> **Atenção**: não use `JSON.stringify` diretamente no ExtendScript — o runtime ExtendScript (ECMAScript 3) **não possui o objeto `JSON` nativamente**. Os helpers `jsonOk`/`jsonErr` em `core.jsx` geram a string JSON manualmente com escape apropriado de caracteres especiais.

### Passo 2 — Atualizar `client/js/structures.js`

Localize a entrada `"4-soldas"` e troque `enabled: false` por `enabled: true`, adicionando os campos esperados:

```javascript
{
    id: "4-soldas",
    name: "4 Soldas",
    enabled: true,
    icon: "\uD83D\uDCE6",
    fields: [
        { id: "compMM", label: "Comprimento (mm)", type: "number", default: 200, step: 0.1, min: 0 },
        { id: "largMM", label: "Largura (mm)",     type: "number", default: 120, step: 0.1, min: 0 }
    ],
    hostFunction: "gerar4Soldas"
}
```

### Passo 3 — Carregar o novo `.jsx` no painel

Em `client/js/main.js`, dentro de `loadHostScripts()`, adicione o caminho:

```javascript
var scripts = [
    p + "/host/core.jsx",
    p + "/host/standup-pouch.jsx",
    p + "/host/4-soldas.jsx"     // ← nova linha
];
```

Pronto. Recarregue a extensão (Janela > Extensões > ARTFLEXÍVEIS > fechar e abrir de novo) e a nova estrutura aparece clicável, com o formulário gerado dinamicamente a partir dos `fields`.

**Nota**: se a nova estrutura tiver regras de validação cruzada entre campos (como a validação `ziperMM ≥ compMM − sanfMM` do Stand-up Pouch), adicione-a em `main.js → validateStructureRules(structure, values)` no ramo correspondente ao `id`.

---

## Estrutura de arquivos

```
artflexiveis-plantas-tecnicas/
├── CSXS/
│   └── manifest.xml                  Declaração da extensão (manifest schema 6, Panel, ILST 25-99)
├── client/
│   ├── index.html                    DOM mínimo; formulário gerado via JS
│   ├── css/
│   │   └── style.css                 Tema adaptativo (CSS variables)
│   ├── js/
│   │   ├── main.js                   Orquestração, tema, validação, evalScript
│   │   ├── structures.js             Registro central das 9 estruturas
│   │   └── lib/
│   │       └── CSInterface.js        v11.0.0 (Adobe-CEP oficial)
│   └── assets/
│       └── icon.png                  Placeholder opcional (não usado no manifest)
├── host/
│   ├── core.jsx                      Helpers 1:1 do script original
│   ├── standup-pouch.jsx             gerarStandupPouch (desenharSUP_Completo)
│   └── _template.jsx                 Stub para futuras estruturas
├── .debug                            Porta 8088 para DevTools
├── README.md                         (este arquivo)
└── CHANGELOG.md                      Histórico de versões
```

---

## Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| Painel não aparece no menu | `PlayerDebugMode` não setado ou Illustrator não reiniciado | Rever passo 1 da instalação, reiniciar IA |
| Painel abre branco/vazio | CSInterface.js não encontrado ou manifest incorreto | Abrir `http://localhost:8088` e inspecionar o console |
| "Sem resposta do Illustrator" ao clicar Gerar | `core.jsx` ou `standup-pouch.jsx` não carregou | Verificar no DevTools se `$.evalFile` retornou erro; checar path da extensão |
| Planta sai com fonte serifada | Arial Bold não instalada | Instalar a fonte ou aceitar fallback silencioso |
| Campos viram "NaN" ao digitar | Separador decimal inválido | O plugin aceita vírgula e ponto — verificar conteúdo colado |
| Erro "EvalScript error" no status | Exceção no ExtendScript | Reabrir em `http://localhost:8088` → Network → ver o response do evalScript |

---

## Licenciamento

CSInterface.js é distribuído pela Adobe sob licença própria (ver cabeçalho do arquivo em `client/js/lib/CSInterface.js`). O código do plugin é proprietário ARTFLEXÍVEIS.
