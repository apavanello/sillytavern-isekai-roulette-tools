# Isekai Roulette Tools — extensão do SillyTavern (v1.1)

Extensão que registra **tools de dados honestos + o game engine** para o card
"Nya Lumenveil — Isekai Roulette (Veyrath) [Tools]", replicando o sistema de
Functions do ISEKAI ZERO com o *function calling* nativo do SillyTavern:

| Tool | O que retorna |
|---|---|
| `roll_dice(sides, count)` | Números de dados (crítico no 20 / falha no 1) |
| `spin_unique_skill_tier` | Tier sorteado **+ expectativa do tier + regras de design da Forja oficial** |
| `spin_race_rarity` | Raridade sorteada **+ regras da roleta + pool de raças oficial daquela banda** |
| `spin_world_entry_difficulty` | Dificuldade sorteada **+ regras + cenários elegíveis do catálogo oficial** |
| `get_starter_alignment_catalogue` | Catálogo oficial de Alinhamentos Iniciais (Etapa 3, escolha do jogador) |

**Arquitetura v1.1:** as tabelas do codex viajam DENTRO do retorno das tools
(arquivo `codex-data.js`, gerado do conteúdo oficial) — o lorebook do card fica
só com lore de mundo, sem palavras-chave genéricas ("tier", "Comum"...)
disparando contexto à toa. Bônus: o modelo recebe o capítulo certo na MESMA
geração do sorteio (o lorebook por chave só disparava na geração seguinte).

Os sorteios acontecem **no seu navegador** (`crypto.getRandomValues`, sem viés)
e cada chamada aparece **visível no chat** como tool call (auditável).

> `codex-data.js` é gerado por `build_extension.py` a partir do codex real —
> não edite à mão.

## Instalação

1. No ST: **Extensions → Install extension** → cole:
   `https://github.com/apavanello/sillytavern-isekai-roulette-tools`
2. Recarregue (F5) — console deve mostrar:
   `[Isekai Roulette Tools] 5 tools registradas...`
3. **Function Calling ativado** nas configs da IA
4. Importe o card **`00_Isekai_Roulette_System_tools.png`** (v1.1) e jogue com ele

Atualizando da v1.0: Extensions → Manage → Update nesta extensão, F5, e
reimporte o card tools (o lorebook mudou para o formato slim).

## Ajustar as odds

No topo do `index.js`: `TIER_WEIGHTS`, `RARITY_WEIGHTS`, `ENTRY_WEIGHTS`
(pesos "por 100"). Edite, F5 — a próxima rolagem já usa os pesos novos.

## Custo de tokens (resumo)

- Definições das tools: ~700 tokens em toda geração
- Cada spin devolve o capítulo (300–700 tokens) que fica no histórico —
  injetado UMA vez, com precisão, versus re-injeção por gatilho de palavra

## Troubleshooting

- **Tools não aparecem**: console F12; ST sem suporte = atualizar
- **Modelo não chama**: confira se o card é o `_tools.png`; nudgue
  "puxa a alavanca (role com a tool)" até pegar o hábito
- **SS em World Entry não tem cenário catalogado**: a tool devolve os de S
  como referência + nota para gerar equivalente — comportamento esperado
