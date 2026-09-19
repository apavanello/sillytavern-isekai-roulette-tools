# Isekai Roulette Tools — extensão do SillyTavern

Extensão que registra **4 tools de dados honestos** para o card
"Nya Lumenveil — Isekai Roulette (Veyrath)", replicando a Dice Roll Function
do ISEKAI ZERO com o *function calling* nativo do SillyTavern:

| Tool | O que faz |
|---|---|
| `roll_dice(sides, count)` | Rola dados de N lados (crítico no 20 / falha no 1) |
| `spin_unique_skill_tier` | Sorteia o tier da Habilidade Única (F→SSS+, ponderado) |
| `spin_race_rarity` | Sorteia a raridade da raça (Comum→Amaldiçoado, ponderado) |
| `spin_world_entry_difficulty` | Sorteia a dificuldade da entrada (F→SS+, ponderado) |

Os sorteios acontecem **no seu navegador** (`crypto.getRandomValues`, sem viés)
e o resultado volta para o modelo como retorno da tool — ele só narra. Cada
chamada aparece **visível no chat** como tool call (auditável).

## Instalação

1. Copie a pasta `st-extension-isekai-roulette` inteira para:
   ```
   SillyTavern/public/scripts/extensions/third-party/
   ```
2. Recarregue o SillyTavern (F5; se instalou com o server parado, suba de novo)
3. No console do navegador (F12) deve aparecer:
   `[Isekai Roulette Tools] 4 tools registradas...`
4. Na configuração da IA, deixe **Function Calling ativado** (o toggle que você
   já vê nas configs de prompt)
5. Importe o card **`00_Isekai_Roulette_System_tools.png`** (a variante que
   instrui o modelo a chamar as tools — não use a versão de macros junto,
   senão o modelo recebe duas instruções de rolagem)

## Requisitos

- SillyTavern com tool-calling nativo (você tem — o toggle aparece)
- API/modelo que aceite `tools`: GLM via endpoint OpenAI-compatível com
  function calling habilitado funciona; Claude/OpenAI/Gemini também
- Importante: no endpoint custom, ative a opção de repassar tools se houver

## Ajustar as odds

No topo do `index.js` tem os pesos "por 100" nas três tabelas
(`TIER_WEIGHTS`, `RARITY_WEIGHTS`, `ENTRY_WEIGHTS`). Edite, salve, F5.

## Se algo não funcionar

- **Tools não aparecem**: confira o console (F12) — se aparecer a mensagem de
  erro do ST sem suporte, atualize o SillyTavern
- **Modelo não chama as tools**: verifique se o card importado é o
  `_tools.png`; alguns modelos precisam do aviso explícito — escreva
  "puxa a alavanca (role com a tool)" no primeiro pull até ele pegar o hábito
- **Tool call aparece mas a resposta ignora o valor**: reforce no chat
  ("the dice are final") — é aderência do modelo, não da extensão
