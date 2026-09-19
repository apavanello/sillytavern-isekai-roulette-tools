/*
 * Isekai Roulette Tools v1.1 — extensão do SillyTavern
 *
 * Tools de "dados honestos" + game engine do card
 * "Nya Lumenveil — Isekai Roulette (Veyrath) [Tools]".
 *
 * Cada spin devolve, JUNTO do sorteio, o capítulo certo do codex oficial
 * (regras de design do tier / pool de raças da raridade / cenários elegíveis
 * da dificuldade). Assim o lorebook do card fica só com lore de mundo —
 * sem palavras-chave genéricas disparando contexto à toa.
 *
 * Sorteios rodam no navegador (crypto.getRandomValues, sem viés) e cada
 * chamada aparece visível no chat como tool call.
 *
 * Requer: SillyTavern com Function Calling + API que repasse tools.
 */

import { FORGE, RACE_RULES, RACE_POOLS, ENTRY_RULES, ENTRY_SCENARIOS, ALIGNMENT_CATALOGUE } from './codex-data.js';

// ====== ODDS (pesos "por 100" — edite à vontade) ======
const TIER_WEIGHTS = { 'F': 8, 'E': 14, 'D': 20, 'C': 18, 'B': 15, 'A': 10, 'S': 7, 'SS': 5, 'SSS': 2, 'SSS+': 1 };
const RARITY_WEIGHTS = { 'Comum': 34, 'Incomum': 27, 'Raro': 18, 'Muito Raro': 9, 'Abençoado': 5, 'Épico': 3, 'Lendário': 2, 'Mítico': 1, 'Amaldiçoado': 1 };
const ENTRY_WEIGHTS = { 'F': 10, 'E': 15, 'D': 20, 'C': 20, 'B': 15, 'A': 10, 'S': 6, 'SS': 3, 'SS+': 1 };

const FINAL = '(Sorteio honesto no cliente — FINAL: anuncie o resultado cru ANTES do flavor; nunca altere, ignore ou suavize.)';
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

/** Cenários elegíveis para uma dificuldade, com fallback para a vizinha. */
function eligibleScenarios(letter) {
    if (ENTRY_SCENARIOS[letter]?.length) return { list: ENTRY_SCENARIOS[letter], note: '' };
    // SS não tem cenário catalogado: usa S e deixa gerar acima se apropriado
    return { list: ENTRY_SCENARIOS['S'] || [], note: ' (nenhum cenário catalogado nesta dificuldade exata: use os de S como referência de tom ou gere um cenário equivalente pelas regras)' };
}

function setup() {
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx?.registerFunctionTool) {
        console.error('[Isekai Roulette Tools] SillyTavern sem suporte a function tools — atualize o ST (tool-calling).');
        return;
    }

    ctx.registerFunctionTool({
        name: 'roll_dice',
        displayName: 'Roll Dice',
        description:
            'Rolls honest dice with any number of sides (default d20). Call BEFORE narrating any uncertain action in Veyrath, or with sides=12 to pick between specific options. ' + FINAL,
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
            return `${PREFIX}${count}d${sides} → [${rolls.join(', ')}]${count > 1 ? ` (total ${total})` : ''}.${crit} ${FINAL}`;
        },
    });

    ctx.registerFunctionTool({
        name: 'spin_unique_skill_tier',
        displayName: 'Spin Unique Skill Tier',
        description: 'Spins the Unique Skill Roulette (Step 1) and returns the tier (F→SSS+, weighted) WITH its design expectations from the official forge. Call on lever pull or reroll.',
        parameters: { type: 'object', properties: {}, required: [] },
        action: async () => {
            const tier = weightedPick(TIER_WEIGHTS);
            const parts = [
                `${PREFIX}Unique Skill Tier: ${tier}. ${FINAL}`,
                ``,
                `EXPECTATIVA DO TIER ${tier}: ${FORGE.tiers[tier] || ''}`,
                `DESIGN CENTRAL: ${FORGE.design}`,
            ];
            if (['F', 'E', 'D'].includes(tier) && FORGE.low) {
                parts.push(`BOM DESIGN DE NÍVEL BAIXO (use um ou mais):\n${FORGE.low}`);
            }
            parts.push('Regras da forja: gere uma Perícia Única NOVA dentro deste tier — verbo concreto + alvo concreto + resultado concreto + custo/limite real. Famílias exemplo são inspiração, NUNCA menu; não role dado para escolher família.');
            return parts.join('\n');
        },
    });

    ctx.registerFunctionTool({
        name: 'spin_race_rarity',
        displayName: 'Spin Race Rarity',
        description: 'Spins the Race Roulette (Step 2) and returns the rarity (weighted) WITH the official race pool of that band. Call on Step 2 or its reroll. The player may stay Human instead (skips, no reroll spent).',
        parameters: { type: 'object', properties: {}, required: [] },
        action: async () => {
            const rarity = weightedPick(RARITY_WEIGHTS);
            const pool = RACE_POOLS[rarity] || '(pool não catalogado: gere uma raça que se encaixe na raridade, em Veyrath e nos mesmos padrões de equilíbrio)';
            return [
                `${PREFIX}Race Rarity: ${rarity}. ${FINAL}`,
                ``,
                `REGRAS DA ROLETA DE RAÇA:\n${RACE_RULES}`,
                ``,
                `CONJUNTO DE RAÇAS — ${rarity.toUpperCase()}:\n${pool}`,
            ].join('\n');
        },
    });

    ctx.registerFunctionTool({
        name: 'spin_world_entry_difficulty',
        displayName: 'Spin World Entry Difficulty',
        description: 'Spins the World Entry Roulette (Step 4) and returns the difficulty (F→SS+, weighted) WITH the eligible arrival scenarios from the official catalogue. Call on Step 4 or its reroll.',
        parameters: { type: 'object', properties: {}, required: [] },
        action: async () => {
            const letter = weightedPick(ENTRY_WEIGHTS);
            const { list, note } = eligibleScenarios(letter);
            const scen = list.map(s => `- ${s.name} / ${s.region}: ${s.desc}`).join('\n');
            return [
                `${PREFIX}World Entry Difficulty: ${letter}. ${FINAL}${note}`,
                ``,
                `REGRAS DA ENTRADA NO MUNDO:\n${ENTRY_RULES}`,
                ``,
                `CENÁRIOS ELEGÍVEIS (${letter}):\n${scen || '(gerar pela regra)'}`,
                ``,
                `Para escolher entre eles: role roll_dice(sides=12) e conte circularmente, ou escolha narrativamente o que melhor servir — depois narre a chegada.`,
            ].join('\n');
        },
    });

    ctx.registerFunctionTool({
        name: 'get_starter_alignment_catalogue',
        displayName: 'Get Starter Alignment Catalogue',
        description: 'Returns the official Starter Alignment catalogue (Step 3). The player CHOOSES an alignment — it is never randomly assigned unless explicitly requested. Call when Step 3 begins.',
        parameters: { type: 'object', properties: {}, required: [] },
        action: async () => `${PREFIX}Catálogo de Alinhamento Inicial (Etapa 3 — {{user}} ESCOLHE):\n\n${ALIGNMENT_CATALOGUE}`,
    });

    console.log('[Isekai Roulette Tools] 5 tools registradas: roll_dice, spin_unique_skill_tier, spin_race_rarity, spin_world_entry_difficulty, get_starter_alignment_catalogue');
}

jQuery(async () => {
    setup();
});
