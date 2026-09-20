/*
 * Isekai Roulette Tools v1.2 — extensão do SillyTavern
 *
 * Tools de "dados honestos" + game engine + PAINEL DE EDIÇÃO para o card
 * "Nya Lumenveil — Isekai Roulette (Veyrath) [Tools]".
 *
 * - Cada spin devolve o sorteio + o capítulo certo do codex (forja/pool/cenários)
 * - Painel em Extensions: edite raças, tiers, cenários, regras, alinhamento
 *   e as ODDS direto na interface — salvo nas settings do ST (sem tocar em código)
 * - Sorteios no navegador (crypto.getRandomValues) e auditáveis no chat
 *
 * Requer: SillyTavern com Function Calling + API que repasse tools.
 */

import { FORGE, RACE_RULES, RACE_POOLS, ENTRY_RULES, ENTRY_SCENARIOS, ALIGNMENT_CATALOGUE } from './codex-data.js';

// ====== ODDS padrão (editáveis pelo painel; pesos "por 100") ======
let TIER_WEIGHTS = { 'F': 8, 'E': 14, 'D': 20, 'C': 18, 'B': 15, 'A': 10, 'S': 7, 'SS': 5, 'SSS': 2, 'SSS+': 1 };
let RARITY_WEIGHTS = { 'Comum': 34, 'Incomum': 27, 'Raro': 18, 'Muito Raro': 9, 'Abençoado': 5, 'Épico': 3, 'Lendário': 2, 'Mítico': 1, 'Amaldiçoado': 1 };
let ENTRY_WEIGHTS = { 'F': 10, 'E': 15, 'D': 20, 'C': 20, 'B': 15, 'A': 10, 'S': 6, 'SS': 3, 'SS+': 1 };

const FINAL = '(Sorteio honesto no cliente — FINAL: anuncie o resultado cru ANTES do flavor; nunca altere, ignore ou suavize.)';
const PREFIX = '[ISEKAI ROULETTE] ';

const TIERS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+'];
const RARITIES = ['Comum', 'Incomum', 'Raro', 'Muito Raro', 'Abençoado', 'Épico', 'Lendário', 'Mítico', 'Amaldiçoado'];
const LETTERS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SS+'];

// ================================================================ RNG
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

// ================================================================ dados efetivos (defaults + overrides do painel)
let DATA = null;

function parseScenarios(text) {
    const out = [];
    let cur = null;
    for (const line of String(text).split('\n')) {
        const m = line.trim().match(/^(.+?)\s*\/\s*(.+?)\s*\/\s*(F|E|D|C|B|A|SSS\+|SS\+|SS|S)\s*$/);
        if (m) {
            if (cur) out.push(cur);
            cur = { name: m[1].trim(), region: m[2].trim(), desc: '' };
        } else if (cur && line.trim()) {
            cur.desc = (cur.desc ? cur.desc + ' ' : '') + line.trim();
        }
    }
    if (cur) out.push(cur);
    return out;
}

function parseKits(text) {
    const kits = [];
    let cur = null;
    for (const line of String(text).split('\n')) {
        const m = line.match(/^##\s+(.+?)\s*$/);
        if (m) {
            if (cur) kits.push(cur);
            cur = { name: m[1].trim(), content: '' };
        } else if (cur) {
            cur.content += (cur.content ? '\n' : '') + line;
        }
    }
    if (cur) kits.push(cur);
    return kits.filter(k => k.name);
}

function buildData(o) {
    const ov = o || {};
    const pools = { ...RACE_POOLS };
    for (const r of RARITIES) if (ov[`pool:${r}`] != null) pools[r] = ov[`pool:${r}`];
    const tiers = { ...FORGE.tiers };
    for (const t of TIERS) if (ov[`tier:${t}`] != null) tiers[t] = ov[`tier:${t}`];
    const scenarios = {};
    const scenariosRaw = {};
    for (const L of Object.keys(ENTRY_SCENARIOS)) scenarios[L] = ENTRY_SCENARIOS[L].slice();
    for (const L of LETTERS) if (ov[`scen:${L}`] != null) {
        scenariosRaw[L] = ov[`scen:${L}`];
        scenarios[L] = parseScenarios(ov[`scen:${L}`]);
    }
    return {
        pools,
        tiers,
        scenarios,
        scenariosRaw,
        rulesRace: ov['rules:race'] ?? RACE_RULES,
        rulesEntry: ov['rules:entry'] ?? ENTRY_RULES,
        alignment: ov['alignment'] ?? ALIGNMENT_CATALOGUE,
        forgeDesign: ov['forge:design'] ?? FORGE.design,
        forgeLow: ov['forge:low'] ?? FORGE.low,
    };
}

function effectiveContent(key) {
    const d = DATA;
    if (key.startsWith('pool:')) return d.pools[key.slice(5)] ?? '';
    if (key.startsWith('tier:')) return d.tiers[key.slice(5)] ?? '';
    if (key.startsWith('scen:')) {
        const L = key.slice(5);
        // fallback: se o override não parseou em nada, mostra o texto cru — nunca sumir
        if (DATA.scenariosRaw?.[L] != null && !(DATA.scenarios[L] || []).length) return DATA.scenariosRaw[L];
        return (d.scenarios[L] || []).map(s => `${s.name} / ${s.region} / ${L}\n${s.desc}`).join('\n\n');
    }
    if (key === 'rules:race') return d.rulesRace;
    if (key === 'rules:entry') return d.rulesEntry;
    if (key === 'alignment') return d.alignment;
    if (key === 'forge:design') return d.forgeDesign;
    if (key === 'forge:low') return d.forgeLow;
    return '';
}

// ================================================================ categorias do painel
function categoryList() {
    const groups = [];
    groups.push({ label: 'Raças — conjuntos por raridade', items: RARITIES.map(r => ({ key: `pool:${r}`, label: r })) });
    groups.push({ label: 'Forja — expectativa por tier', items: TIERS.map(t => ({ key: `tier:${t}`, label: t })) });
    groups.push({ label: 'Forja — regras gerais', items: [
        { key: 'forge:design', label: 'Design central' },
        { key: 'forge:low', label: 'Bom design de nível baixo' },
    ] });
    groups.push({ label: 'Cenários de entrada por dificuldade', items: LETTERS.map(L => ({ key: `scen:${L}`, label: L })) });
    groups.push({ label: 'Regras', items: [
        { key: 'rules:race', label: 'Roleta de Raça' },
        { key: 'rules:entry', label: 'Entrada no Mundo' },
    ] });
    groups.push({ label: 'Etapa 3', items: [{ key: 'alignment', label: 'Catálogo de Alinhamentos' }] });
    return groups;
}

// ================================================================ painel (settings UI)
function initSettingsUI(settings, save) {
    const html = `
    <div class="isekai-roulette-tools">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Isekai Roulette Tools</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label><small>Categoria (fixas) — edite os itens:</small></label>
                <select id="isekai_category" class="text_pole"></select>
                <div><small id="isekai_status" style="opacity:.7"></small></div>
                <textarea id="isekai_content" rows="14" class="text_pole textarea_compact" style="width:100%; font-size:12px; white-space:pre;"></textarea>
                <div class="flex1 flexGap5">
                    <div id="isekai_save" class="menu_button menu_button_wide" title="Salva o texto deste item (override)">💾 Salvar item</div>
                    <div id="isekai_reset" class="menu_button menu_button_wide" title="Volta este item ao padrão do codex">↩ Restaurar item</div>
                </div>
                <hr>
                <label><small>Odds (pesos por 100) — formato <code>F:8, E:14, ...</code></small></label>
                <div class="flexGap5 flexWrap">
                    <div style="flex:1"><small>Tier</small><textarea id="isekai_w_tier" rows="2" class="text_pole textarea_compact" style="width:100%; font-size:11px;"></textarea></div>
                    <div style="flex:1"><small>Raridade</small><textarea id="isekai_w_rarity" rows="2" class="text_pole textarea_compact" style="width:100%; font-size:11px;"></textarea></div>
                    <div style="flex:1"><small>Entrada</small><textarea id="isekai_w_entry" rows="2" class="text_pole textarea_compact" style="width:100%; font-size:11px;"></textarea></div>
                </div>
                <div id="isekai_save_w" class="menu_button menu_button_wide">💾 Salvar odds</div>
                <hr>
                <small>Edições valem a partir da próxima rolagem (sem reload). Cenários: uma linha <code>NOME / REGIÃO / LETRA</code> seguida da descrição; múltiplos separados por linha em branco.</small>
            </div>
        </div>
    </div>`;
    $('#extensions_settings2').append(html);

    const $sel = $('#isekai_category');
    for (const g of categoryList()) {
        const og = $('<optgroup>').attr('label', g.label);
        for (const it of g.items) og.append($('<option>').val(it.key).text(it.label));
        $sel.append(og);
    }

    const $txt = $('#isekai_content');
    const $st = $('#isekai_status');

    function refresh() {
        const key = $sel.val();
        $txt.val(effectiveContent(key));
        $st.text(settings.overrides?.[key] != null ? '● editado (override ativo)' : 'padrão do codex');
    }
    $sel.on('change', refresh);

    $('#isekai_save').on('click', () => {
        const key = $sel.val();
        settings.overrides = settings.overrides || {};
        settings.overrides[key] = $txt.val();
        save();
        DATA = buildData(settings.overrides);
        refresh();
        toastr.success(`Item "${key}" salvo — vale na próxima rolagem.`);
    });

    $('#isekai_reset').on('click', () => {
        const key = $sel.val();
        if (settings.overrides) delete settings.overrides[key];
        save();
        DATA = buildData(settings.overrides);
        refresh();
        toastr.info(`Item "${key}" restaurado ao padrão.`);
    });

    const serialize = w => Object.entries(w).map(([k, v]) => `${k}:${v}`).join(', ');
    $('#isekai_w_tier').val(serialize(TIER_WEIGHTS));
    $('#isekai_w_rarity').val(serialize(RARITY_WEIGHTS));
    $('#isekai_w_entry').val(serialize(ENTRY_WEIGHTS));

    function parseWeights(text, allowed) {
        const out = {};
        for (const part of String(text).split(/[,\n]/)) {
            const m = part.trim().match(/^(.+?)\s*[:=]\s*(\d+)\s*$/);
            if (!m) continue;
            const name = m[1].trim();
            if (allowed.includes(name)) out[name] = parseInt(m[2], 10);
        }
        return out;
    }

    $('#isekai_save_w').on('click', () => {
        const t = parseWeights($('#isekai_w_tier').val(), TIERS);
        const r = parseWeights($('#isekai_w_rarity').val(), RARITIES);
        const e = parseWeights($('#isekai_w_entry').val(), LETTERS);
        if (Object.keys(t).length < 2 || Object.keys(r).length < 2 || Object.keys(e).length < 2) {
            toastr.warning('Odds inválidas: use o formato "F:8, E:14, ..." com pelo menos 2 entradas válidas por linha.');
            return;
        }
        TIER_WEIGHTS = t; RARITY_WEIGHTS = r; ENTRY_WEIGHTS = e;
        settings.weights = { tier: t, rarity: r, entry: e };
        save();
        toastr.success('Odds salvas — valem na próxima rolagem.');
    });

    // carrega odds salvas
    if (settings.weights) {
        if (settings.weights.tier) TIER_WEIGHTS = settings.weights.tier;
        if (settings.weights.rarity) RARITY_WEIGHTS = settings.weights.rarity;
        if (settings.weights.entry) ENTRY_WEIGHTS = settings.weights.entry;
    }

    refresh();
}

// ================================================================ tools
function registerTools(ctx) {
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
                `EXPECTATIVA DO TIER ${tier}: ${DATA.tiers[tier] || ''}`,
                `DESIGN CENTRAL: ${DATA.forgeDesign}`,
            ];
            if (['F', 'E', 'D'].includes(tier) && DATA.forgeLow) {
                parts.push(`BOM DESIGN DE NÍVEL BAIXO (use um ou mais):\n${DATA.forgeLow}`);
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
            const pool = DATA.pools[rarity] || '(pool não catalogado: gere uma raça que se encaixe na raridade, em Veyrath e nos mesmos padrões de equilíbrio)';
            return [
                `${PREFIX}Race Rarity: ${rarity}. ${FINAL}`,
                ``,
                `REGRAS DA ROLETA DE RAÇA:\n${DATA.rulesRace}`,
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
            const list = DATA.scenarios[letter];
            const note = (list && list.length) ? '' : ' (nenhum cenário catalogado nesta dificuldade exata: use os de S como referência de tom ou gere um cenário equivalente pelas regras)';
            const scen = (list && list.length ? list : (DATA.scenarios['S'] || [])).map(s => `- ${s.name} / ${s.region}: ${s.desc}`).join('\n');
            return [
                `${PREFIX}World Entry Difficulty: ${letter}. ${FINAL}${note}`,
                ``,
                `REGRAS DA ENTRADA NO MUNDO:\n${DATA.rulesEntry}`,
                ``,
                `CENÁRIOS ELEGÍVEIS (${letter}):\n${scen || '(gerar pela regra)'}`,
                ``,
                `Para escolher entre eles: role roll_dice(sides=12) e conte circularmente, ou escolha narrativamente o que melhor servir — depois narre a chegada.`,
            ].join('\n');
        },
    });

    ctx.registerFunctionTool({
        name: 'spin_starter_alignment',
        displayName: 'Spin Starter Alignment',
        description: 'Uniformly rolls ONE Starter Alignment kit (Step 3): each of the N kits has exactly 1/N chance, no rarity weighting. Returns the rolled kit with its official package. Call on Step 3 or its reroll.',
        parameters: { type: 'object', properties: {}, required: [] },
        action: async () => {
            const kits = parseKits(DATA.alignment);
            if (!kits.length) return `${PREFIX}Starter Alignment: (catálogo vazio — gere um pacote iniciante equivalente). ${FINAL}`;
            const kit = kits[randInt(1, kits.length) - 1];
            return [
                `${PREFIX}Starter Alignment: ${kit.name} (sorteio uniforme 1/${kits.length}). ${FINAL}`,
                ``,
                `REGRAS: Alinhamentos Iniciais são pacotes para iniciantes — NÃO são classes verdadeiras: não aumentam Nível, não modificam atributos básicos, não garantem maestria e não bloqueiam crescimento futuro. Neste setup o Alinhamento é SORTEADO; reroll gasta 1 das 3 Rolagens Compartilhadas.`,
                ``,
                `KIT SORTEADO — ${kit.name}:\n${kit.content.trim()}`,
            ].join('\n');
        },
    });

    console.log('[Isekai Roulette Tools] 5 tools registradas + painel de edição ativo');
}

// ================================================================ bootstrap
jQuery(async () => {
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx?.registerFunctionTool) {
        console.error('[Isekai Roulette Tools] SillyTavern sem suporte a function tools — atualize o ST (tool-calling).');
        return;
    }
    const settings = ctx.extensionSettings['isekaiRouletteTools'] ??= {};
    DATA = buildData(settings.overrides);
    initSettingsUI(settings, () => ctx.saveSettingsDebounced());
    registerTools(ctx);
});
