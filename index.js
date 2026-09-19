/*
 * Isekai Roulette Tools — extensão do SillyTavern
 *
 * Registra tools de "dados honestos" para o card
 * "Nya Lumenveil — Isekai Roulette (Veyrath)".
 *
 * Os resultados são sorteados NO SEU NAVEGADOR (crypto.getRandomValues) e
 * devolvidos ao modelo — o AI só narra o que recebeu, igual à Dice Roll
 * Function do ISEKAI ZERO. Cada chamada aparece visível no chat.
 *
 * Requer: SillyTavern com suporte a Function Calling (tool-calling) e uma
 * API que repasse tools (OpenAI, Claude, Gemini, OpenAI-compatible etc.).
 */

// ====== ODDS (pesos "por 100" — edite à vontade) ======
const TIER_WEIGHTS = { 'F': 8, 'E': 14, 'D': 20, 'C': 18, 'B': 15, 'A': 10, 'S': 7, 'SS': 5, 'SSS': 2, 'SSS+': 1 };
const RARITY_WEIGHTS = { 'Comum': 34, 'Incomum': 27, 'Raro': 18, 'Muito Raro': 9, 'Abençoado': 5, 'Épico': 3, 'Lendário': 2, 'Mítico': 1, 'Amaldiçoado': 1 };
const ENTRY_WEIGHTS = { 'F': 10, 'E': 15, 'D': 20, 'C': 20, 'B': 15, 'A': 10, 'S': 6, 'SS': 3, 'SS+': 1 };

const DICE_INSTRUCTION = 'The dice are honest: this result was rolled by the client before you saw it. Announce the raw result BEFORE any flavor text. It is FINAL: never alter, ignore, soften or secretly reroll it.';

const PREFIX = '[ISEKAI ROULETTE] ';

/** Inteiro uniforme em [min, max] com RNG criptográfico e rejeição de viés. */
function randInt(min, max) {
    const range = max - min + 1;
    const limit = Math.floor(0x100000000 / range) * range;
    const buf = new Uint32Array(1);
    let x;
    do {
        crypto.getRandomValues(buf);
        x = buf[0];
    } while (x >= limit);
    return min + (x % range);
}

/** Sorteio ponderado: weights = { rotulo: peso_inteiro }. */
function weightedPick(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = randInt(1, total);
    for (const [key, w] of entries) {
        roll -= w;
        if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
}

async function setup() {
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx?.registerFunctionTool) {
        console.error('[Isekai Roulette Tools] SillyTavern sem suporte a function tools — atualize o ST (tool-calling).');
        toastr?.error?.('Isekai Roulette Tools: ST sem suporte a function tools.');
        return;
    }

    ctx.registerFunctionTool({
        name: 'roll_dice',
        displayName: 'Roll Dice',
        description:
            'Rolls honest dice with any number of sides (default d20). ' +
            'Call BEFORE narrating any uncertain action, or with sides=12 to pick a specific result inside a rolled band (catalogue scenario, race pick). ' +
            DICE_INSTRUCTION,
        parameters: {
            type: 'object',
            properties: {
                sides: { type: 'integer', description: 'Number of sides (2-100). Default 20.' },
                count: { type: 'integer', description: 'Number of dice (1-10). Default 1.' },
            },
            required: [],
        },
        action: async ({ sides = 20, count = 1 }) => {
            sides = Math.min(Math.max(Number(sides) || 20, 2), 100);
            count = Math.min(Math.max(Number(count) || 1, 1), 10);
            const rolls = Array.from({ length: count }, () => randInt(1, sides));
            const total = rolls.reduce((a, b) => a + b, 0);
            let crit = '';
            if (sides === 20 && count === 1) {
                if (rolls[0] === 20) crit = ' NATURAL 20 — critical success!';
                else if (rolls[0] === 1) crit = ' NATURAL 1 — critical failure!';
            }
            return `${PREFIX}${count}d${sides} → [${rolls.join(', ')}]${count > 1 ? ` (total ${total})` : ''}.${crit} ${DICE_INSTRUCTION}`;
        },
    });

    ctx.registerFunctionTool({
        name: 'spin_unique_skill_tier',
        displayName: 'Spin Unique Skill Tier',
        description:
            'Spins the Unique Skill Roulette tier, weighted F→SSS+. ' +
            'Call when the lever is pulled for Step 1 (Habilidade Única) or when the player rerolls it. ' +
            DICE_INSTRUCTION,
        parameters: { type: 'object', properties: {}, required: [] },
        action: async () => `${PREFIX}Unique Skill Tier: ${weightedPick(TIER_WEIGHTS)}. ${DICE_INSTRUCTION}`,
    });

    ctx.registerFunctionTool({
        name: 'spin_race_rarity',
        displayName: 'Spin Race Rarity',
        description:
            'Spins the Race Roulette rarity, weighted Comum→Mítico/Amaldiçoado. ' +
            'Call for Step 2 (Raça) or its reroll. The player may stay Human instead, skipping this roll. ' +
            DICE_INSTRUCTION,
        parameters: { type: 'object', properties: {}, required: [] },
        action: async () => `${PREFIX}Race Rarity: ${weightedPick(RARITY_WEIGHTS)}. ${DICE_INSTRUCTION}`,
    });

    ctx.registerFunctionTool({
        name: 'spin_world_entry_difficulty',
        displayName: 'Spin World Entry Difficulty',
        description:
            'Spins the World Entry Roulette difficulty, weighted F→SS+. ' +
            'Call for Step 4 (Entrada no Mundo) or its reroll. ' +
            DICE_INSTRUCTION,
        parameters: { type: 'object', properties: {}, required: [] },
        action: async () => `${PREFIX}World Entry Difficulty: ${weightedPick(ENTRY_WEIGHTS)}. ${DICE_INSTRUCTION}`,
    });

    console.log('[Isekai Roulette Tools] 4 tools registradas: roll_dice, spin_unique_skill_tier, spin_race_rarity, spin_world_entry_difficulty');
}

jQuery(async () => {
    await setup();
});
