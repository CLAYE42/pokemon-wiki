// fetch = Function used for making HTTP requests to fetch resources.
//              (JSON style data, images, files)
//              Simplifies asynchronous data fetching in JavaScript and
//              used for interacting with APIs to retrieve and send
//              data asynchronously over the web.
//              fetch(url, {options})

// Artificial delay so the skeleton loader is visible (remove or reduce in production!)
const FAKE_LOADING_MS = 2000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchData() {

    const pokemonName = document.getElementById("pokemonName").value.toLowerCase().trim();

    if (!pokemonName) return;

    // UI refs
    const card         = document.getElementById("pokemonCard");
    const skeletonCard = document.getElementById("skeletonCard");
    const emptyState   = document.getElementById("emptyState");
    const errorState   = document.getElementById("errorState");

    // Reset UI — show skeleton, hide everything else
    card.style.display         = "none";
    errorState.style.display   = "none";
    emptyState.style.display   = "none";
    skeletonCard.style.display = "block";
    document.getElementById("movesPanel").style.display     = "none";
    document.getElementById("evoPanel").style.display       = "none";
    document.getElementById("locationsPanel").style.display = "none";
    document.getElementById("variantBadge").style.display   = "none";

    try {
        // Fire the real fetch and the artificial delay at the same time.
        // The card only shows once BOTH are done — so the skeleton always
        // displays for at least FAKE_LOADING_MS milliseconds.
        const [response] = await Promise.all([
            fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`),
            sleep(FAKE_LOADING_MS)
        ]);

        if (!response.ok) {
            throw new Error("Could not fetch resource");
        }

        const data = await response.json();

        // ---- Sprite ----
        const normalSprite = data.sprites.front_default;
        const shinySprite  = data.sprites.front_shiny;
        const imgElement   = document.getElementById("pokemonSprite");

        // Reset to normal sprite on each new search
        imgElement.src = normalSprite;
        setupShinyToggle(normalSprite, shinySprite, imgElement);

        // ---- Name & ID ----
        document.getElementById("pokemonNameDisplay").textContent = data.name.toUpperCase();
        document.getElementById("pokemonId").textContent = `#${String(data.id).padStart(3, "0")}`;

        // ---- Types ----
        const typeBadges = document.getElementById("typeBadges");
        typeBadges.innerHTML = "";
        const typeNames = data.types.map(t => t.type.name);
        data.types.forEach(t => {
            const badge = document.createElement("span");
            badge.className = `type-badge type-${t.type.name}`;
            badge.textContent = t.type.name;
            typeBadges.appendChild(badge);
        });

        // ---- Weaknesses ----
        buildWeaknesses(typeNames);

        // ---- Stats ----
        const statsMap = {
            "hp":              "statHP",
            "attack":          "statATK",
            "defense":         "statDEF",
            "speed":           "statSPD",
        };

        data.stats.forEach(s => {
            const id = statsMap[s.stat.name];
            if (!id) return;
            const row = document.getElementById(id);
            const bar = row.querySelector(".stat-bar");
            const val = row.querySelector(".stat-val");
            const pct = Math.min((s.base_stat / 255) * 100, 100);
            val.textContent = s.base_stat;
            // Slight delay so CSS transition plays
            setTimeout(() => { bar.style.width = pct + "%"; }, 50);
        });

        // ---- Meta ----
        document.getElementById("pokemonHeight").textContent = `${(data.height / 10).toFixed(1)}m`;
        document.getElementById("pokemonWeight").textContent = `${(data.weight / 10).toFixed(1)}kg`;
        document.getElementById("pokemonExp").textContent    = data.base_experience ?? "?";

        // ---- Abilities ----
        renderAbilities(data.abilities);

        // ---- Moves ----
        buildMovesPanel(data.moves);

        // ---- Evolution Chain ----
        buildEvoChain(data.species.url, data.name);

        // ---- Locations ----
        buildLocationsPanel(data.location_area_encounters);

        // Show card, hide skeleton
        skeletonCard.style.display = "none";
        card.style.display = "block";

    } catch (error) {
        console.error(error);
        skeletonCard.style.display = "none";
        document.getElementById("movesPanel").style.display     = "none";
        document.getElementById("evoPanel").style.display       = "none";
        document.getElementById("locationsPanel").style.display = "none";
        errorState.style.display = "flex";
    }
}

// ============================================================
//  TYPE WEAKNESSES
// ============================================================

// Cache: type name → damage_relations object
const typeCache = {};

async function buildWeaknesses(typeNames) {
    const section = document.getElementById("weaknessSection");
    const badgesEl = document.getElementById("weaknessBadges");

    // Show skeleton while fetching
    badgesEl.innerHTML = `
        <div class="skel" style="width:60px;height:22px;border-radius:20px"></div>
        <div class="skel" style="width:52px;height:22px;border-radius:20px"></div>
        <div class="skel" style="width:68px;height:22px;border-radius:20px"></div>`;

    try {
        // Fetch type data for each of the Pokémon's types in parallel
        await Promise.all(typeNames.map(async typeName => {
            if (typeCache[typeName]) return;
            const res  = await fetch(`https://pokeapi.co/api/v2/type/${typeName}`);
            const data = await res.json();
            typeCache[typeName] = data.damage_relations;
        }));

        // All 18 types to evaluate
        const allTypes = [
            "normal","fire","water","electric","grass","ice",
            "fighting","poison","ground","flying","psychic","bug",
            "rock","ghost","dragon","dark","steel","fairy"
        ];

        // Calculate the combined multiplier for each attacking type
        // Start at 1x, then multiply by each of the Pokémon's type relations
        const multipliers = {};
        allTypes.forEach(attacker => {
            let mult = 1;
            typeNames.forEach(defenderType => {
                const relations = typeCache[defenderType];
                if (relations.double_damage_from.some(t => t.name === attacker)) mult *= 2;
                if (relations.half_damage_from.some(t  => t.name === attacker)) mult *= 0.5;
                if (relations.no_damage_from.some(t    => t.name === attacker)) mult *= 0;
            });
            multipliers[attacker] = mult;
        });

        // Filter to only weaknesses (2x or 4x)
        const weaknesses = Object.entries(multipliers)
            .filter(([, mult]) => mult >= 2)
            .sort((a, b) => b[1] - a[1]); // 4x first, then 2x

        if (weaknesses.length === 0) {
            badgesEl.innerHTML = `<span style="font-family:var(--body-font);font-size:12px;color:var(--text-dim);font-style:italic">None</span>`;
            return;
        }

        badgesEl.innerHTML = "";
        weaknesses.forEach(([typeName, mult]) => {
            const badge = document.createElement("span");
            // Reuse existing type colour classes
            badge.className = `weakness-badge type-${typeName}${mult === 4 ? " weakness-4x" : ""}`;
            badge.innerHTML = `${typeName}<span class="weakness-mult">${mult}×</span>`;
            badgesEl.appendChild(badge);
        });

    } catch (err) {
        console.error("Weakness fetch error:", err);
        badgesEl.innerHTML = "";
        section.style.display = "none";
    }
}

// ============================================================
//  EVOLUTION CHAIN
// ============================================================

// ---- Tier 1: Regional variants with entirely different evolution chains ----
const REGIONAL_CHAINS = {
    // Alolan
    "rattata-alola":   [["rattata-alola"], ["raticate-alola"]],
    "raticate-alola":  [["rattata-alola"], ["raticate-alola"]],
    "meowth-alola":    [["meowth-alola"],  ["persian-alola"]],
    "persian-alola":   [["meowth-alola"],  ["persian-alola"]],
    "geodude-alola":   [["geodude-alola"], ["graveler-alola"], ["golem-alola"]],
    "graveler-alola":  [["geodude-alola"], ["graveler-alola"], ["golem-alola"]],
    "golem-alola":     [["geodude-alola"], ["graveler-alola"], ["golem-alola"]],
    "grimer-alola":    [["grimer-alola"],  ["muk-alola"]],
    "muk-alola":       [["grimer-alola"],  ["muk-alola"]],
    "vulpix-alola":    [["vulpix-alola"],  ["ninetales-alola"]],
    "ninetales-alola": [["vulpix-alola"],  ["ninetales-alola"]],
    "sandshrew-alola": [["sandshrew-alola"], ["sandslash-alola"]],
    "sandslash-alola": [["sandshrew-alola"], ["sandslash-alola"]],
    "diglett-alola":   [["diglett-alola"], ["dugtrio-alola"]],
    "dugtrio-alola":   [["diglett-alola"], ["dugtrio-alola"]],
    "exeggutor-alola": [["exeggcute"],     ["exeggutor-alola"]],
    "marowak-alola":   [["cubone"],        ["marowak-alola"]],
    // Galarian
    "meowth-galar":    [["meowth-galar"],  ["perrserker"]],
    "perrserker":      [["meowth-galar"],  ["perrserker"]],
    "ponyta-galar":    [["ponyta-galar"],  ["rapidash-galar"]],
    "rapidash-galar":  [["ponyta-galar"],  ["rapidash-galar"]],
    "slowpoke-galar":  [["slowpoke-galar"], ["slowbro-galar", "slowking-galar"]],
    "slowbro-galar":   [["slowpoke-galar"], ["slowbro-galar", "slowking-galar"]],
    "slowking-galar":  [["slowpoke-galar"], ["slowbro-galar", "slowking-galar"]],
    "farfetchd-galar": [["farfetchd-galar"], ["sirfetchd"]],
    "sirfetchd":       [["farfetchd-galar"], ["sirfetchd"]],
    "corsola-galar":   [["corsola-galar"], ["cursola"]],
    "cursola":         [["corsola-galar"], ["cursola"]],
    "yamask-galar":    [["yamask-galar"],  ["runerigus"]],
    "runerigus":       [["yamask-galar"],  ["runerigus"]],
    "darumaka-galar":  [["darumaka-galar"], ["darmanitan-galar"]],
    "darmanitan-galar":[["darumaka-galar"], ["darmanitan-galar"]],
    "zigzagoon-galar": [["zigzagoon-galar"], ["linoone-galar"], ["obstagoon"]],
    "linoone-galar":   [["zigzagoon-galar"], ["linoone-galar"], ["obstagoon"]],
    "obstagoon":       [["zigzagoon-galar"], ["linoone-galar"], ["obstagoon"]],
    "stunfisk-galar":  [["stunfisk-galar"]],
    // Hisuian — final stages that split from normal chain
    "typhlosion-hisui":  [["cyndaquil"], ["quilava"], ["typhlosion-hisui"]],
    "samurott-hisui":    [["oshawott"],  ["dewott"],  ["samurott-hisui"]],
    "decidueye-hisui":   [["rowlet"],    ["dartrix"],  ["decidueye-hisui"]],
    "lilligant-hisui":   [["petilil"],   ["lilligant-hisui"]],
    "voltorb-hisui":     [["voltorb-hisui"], ["electrode-hisui"]],
    "electrode-hisui":   [["voltorb-hisui"], ["electrode-hisui"]],
    "qwilfish-hisui":    [["qwilfish-hisui"], ["overqwil"]],
    "overqwil":          [["qwilfish-hisui"], ["overqwil"]],
    "sneasel-hisui":     [["sneasel-hisui"], ["sneasler"]],
    "sneasler":          [["sneasel-hisui"], ["sneasler"]],
    "braviary-hisui":    [["rufflet"], ["braviary-hisui"]],
    "sliggoo-hisui":     [["goomy"],   ["sliggoo-hisui"], ["goodra-hisui"]],
    "goodra-hisui":      [["goomy"],   ["sliggoo-hisui"], ["goodra-hisui"]],
    "avalugg-hisui":     [["bergmite"], ["avalugg-hisui"]],
    "zorua-hisui":       [["zorua-hisui"], ["zoroark-hisui"]],
    "zoroark-hisui":     [["zorua-hisui"], ["zoroark-hisui"]],
    // Paldean
    "wooper-paldea":     [["wooper-paldea"], ["clodsire"]],
    "clodsire":          [["wooper-paldea"], ["clodsire"]],
    "tauros-paldea-combat":  [["tauros-paldea-combat"]],
    "tauros-paldea-blaze":   [["tauros-paldea-blaze"]],
    "tauros-paldea-aqua":    [["tauros-paldea-aqua"]],
};

// Regional evolution conditions — HTML strings with item links where applicable
const REGIONAL_CONDITIONS = {
    "raticate-alola":   "Lv. 20 at night",
    "persian-alola":    "Lv. 28",
    "graveler-alola":   "Lv. 25",
    "golem-alola":      "trade",
    "muk-alola":        "Lv. 38",
    "ninetales-alola":  `use ${itemLink("ice-stone")}`,
    "sandslash-alola":  `use ${itemLink("ice-stone")}`,
    "dugtrio-alola":    "Lv. 26",
    "exeggutor-alola":  `use ${itemLink("leaf-stone")} (in Alola)`,
    "marowak-alola":    "Lv. 28 (in Alola)",
    "perrserker":       "Lv. 28",
    "rapidash-galar":   "Lv. 40",
    "slowbro-galar":    "use Shellder",
    "slowking-galar":   `trade holding ${itemLink("kings-rock")}`,
    "sirfetchd":        "3 critical hits in one battle",
    "cursola":          "Lv. 38",
    "runerigus":        "travel under Stone Gate with 49+ HP lost",
    "darmanitan-galar": `use ${itemLink("ice-stone")}`,
    "obstagoon":        "Lv. 35 at night",
    "linoone-galar":    "Lv. 20",
    "typhlosion-hisui": "Lv. 36 (Hisui)",
    "samurott-hisui":   "Lv. 36 (Hisui)",
    "decidueye-hisui":  "Lv. 34 (Hisui)",
    "lilligant-hisui":  `use ${itemLink("sun-stone")} (Hisui)`,
    "electrode-hisui":  `use ${itemLink("leaf-stone")}`,
    "overqwil":         "use Barb Barrage 20 times",
    "sneasler":         `use ${itemLink("razor-claw")} at day (Hisui)`,
    "braviary-hisui":   `use ${itemLink("shiny-stone")} (Hisui)`,
    "goodra-hisui":     "Lv. 80 in rain (Hisui)",
    "sliggoo-hisui":    "Lv. 40 (Hisui)",
    "avalugg-hisui":    "Lv. 37 (Hisui)",
    "zoroark-hisui":    "Lv. 30 (Hisui)",
    "clodsire":         "Lv. 20",
};

// ---- Tier 2: Mega / Gigantamax / other special forms — detect by suffix ----
const FORM_PATTERNS = [
    { pattern: /-mega-?[xy]?$/,   label: "Mega Evolution",   cls: "variant-mega"  },
    { pattern: /-gmax$/,          label: "Gigantamax Form",   cls: "variant-gmax"  },
    { pattern: /-primal$/,        label: "Primal Reversion",  cls: "variant-mega"  },
    { pattern: /-ultra$/,         label: "Ultra Burst",       cls: "variant-mega"  },
    { pattern: /-alola$/,         label: "Alolan Form",       cls: "variant-alola" },
    { pattern: /-galar$/,         label: "Galarian Form",     cls: "variant-galar" },
    { pattern: /-hisui$/,         label: "Hisuian Form",      cls: "variant-hisui" },
    { pattern: /-paldea/,         label: "Paldean Form",      cls: "variant-paldea"},
];

// ---- Tier 3: Hisuian final-stage variants (show base chain, badge the final node) ----
const HISUI_FINAL_FORMS = new Set([
    "typhlosion-hisui","samurott-hisui","decidueye-hisui",
    "lilligant-hisui","electrode-hisui","goodra-hisui",
    "avalugg-hisui","zoroark-hisui","braviary-hisui",
]);

function detectVariant(name) {
    for (const { pattern, label, cls } of FORM_PATTERNS) {
        if (pattern.test(name)) return { label, cls };
    }
    return null;
}

async function buildEvoChain(speciesUrl, currentName) {
    const panel  = document.getElementById("evoPanel");
    const bodyEl = document.getElementById("evoBody");
    const badge  = document.getElementById("variantBadge");

    // --- Show/hide variant badge on the card ---
    const variant = detectVariant(currentName);
    if (variant) {
        badge.textContent  = variant.label;
        badge.className    = `variant-badge ${variant.cls}`;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }

    // --- Tier 2: Mega / Gmax / Primal — no chain, just hide panel ---
    if (variant && (
        /-mega-?[xy]?$/.test(currentName) ||
        /-gmax$/.test(currentName)        ||
        /-primal$/.test(currentName)      ||
        /-ultra$/.test(currentName)
    )) {
        panel.style.display = "none";
        return;
    }

    // Show skeleton while loading
    panel.style.display = "block";
    bodyEl.innerHTML = `
        <div class="evo-node">
            <div class="skel skel-evo-sprite"></div>
            <div class="skel skel-evo-name"></div>
        </div>
        <div class="evo-arrow"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 8h8M9 5l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>
        <div class="evo-node">
            <div class="skel skel-evo-sprite"></div>
            <div class="skel skel-evo-name"></div>
        </div>`;

    try {
        // --- Tier 1: Regional chain lookup ---
        if (REGIONAL_CHAINS[currentName]) {
            const rawStages = REGIONAL_CHAINS[currentName];

            // Convert the flat string array into the same stage format renderEvoChain expects
            const stages = rawStages.map((stageNames, i) => {
                return stageNames.map(name => ({
                    name,
                    condition: i > 0 ? (REGIONAL_CONDITIONS[name] ?? "special") : null,
                }));
            });

            if (stages.length <= 1 && stages[0].length <= 1) {
                panel.style.display = "none";
                return;
            }
            renderEvoChain(stages, currentName, bodyEl);
            return;
        }

        // --- Tier 3 / standard: Fetch chain from API ---
        const speciesRes  = await fetch(speciesUrl);
        const speciesData = await speciesRes.json();
        const evoRes      = await fetch(speciesData.evolution_chain.url);
        const evoData     = await evoRes.json();
        const chain       = parseEvoChain(evoData.chain);

        if (chain.length === 1 && chain[0].length === 1) {
            panel.style.display = "none";
            return;
        }

        renderEvoChain(chain, currentName, bodyEl);

    } catch (err) {
        console.error("Evolution chain error:", err);
        panel.style.display = "none";
    }
}

// Recursively walks the chain tree.
// Returns an array of stages, where each stage is an array of Pokémon
// (most have 1 per stage, branching ones like Eevee have multiple in the last stage)
// e.g. Eevee: [ [{eevee}], [{vaporeon},{jolteon},{flareon},...] ]
// e.g. Charmander: [ [{charmander}], [{charmeleon}], [{charizard}] ]
function parseEvoChain(node, stages = [], stageIndex = 0) {
    if (!stages[stageIndex]) stages[stageIndex] = [];

    // Get the evolution condition from this node to the previous stage
    const detail = node.evolution_details?.[0] ?? null;
    const condition = detail ? getEvoCondition(detail) : null;

    stages[stageIndex].push({
        name:      node.species.name,
        condition, // how it evolved FROM the previous stage
    });

    if (node.evolves_to && node.evolves_to.length > 0) {
        node.evolves_to.forEach(next => parseEvoChain(next, stages, stageIndex + 1));
    }

    return stages;
}

// Converts the raw evolution_details object into a full readable HTML string
// Item names are wrapped in clickable item-link spans.
function getEvoCondition(detail) {
    const parts = [];
    const trigger = detail.trigger?.name;

    // -- Trigger --
    if (trigger === "trade")    parts.push("trade");
    if (trigger === "use-item" && detail.item) {
        parts.push(itemLink(detail.item.name));
        return parts.join("");
    }
    if (trigger === "shed")     parts.push("shed (empty slot + Poké Ball)");

    // -- Level --
    if (detail.min_level)       parts.push(`Lv. ${detail.min_level}`);

    // -- Held item --
    if (detail.held_item)       parts.push(`holding ${itemLink(detail.held_item.name)}`);

    // -- Time of day --
    if (detail.time_of_day === "day")   parts.push("during day");
    if (detail.time_of_day === "night") parts.push("at night");

    // -- Happiness / affection / beauty --
    if (detail.min_happiness)   parts.push(`friendship ${detail.min_happiness}+`);
    if (detail.min_affection)   parts.push(`affection ${detail.min_affection}+`);
    if (detail.min_beauty)      parts.push(`beauty ${detail.min_beauty}+`);

    // -- Known move or move type --
    if (detail.known_move)      parts.push(`know ${fmt(detail.known_move.name)}`);
    if (detail.known_move_type) parts.push(`know a ${detail.known_move_type.name}-type move`);

    // -- Gender specific --
    if (detail.gender === 1)    parts.push("(female only)");
    if (detail.gender === 2)    parts.push("(male only)");

    // -- Location --
    if (detail.location)        parts.push(`at ${fmt(detail.location.name)}`);

    // -- Rain / upside down / other triggers --
    if (detail.needs_overworld_rain)  parts.push("in rain");
    if (detail.turn_upside_down)      parts.push("turn console upside down");

    return parts.length > 0 ? parts.join(" and ") : "special";
}

// Helper: replace hyphens with spaces and capitalise first letter
function fmt(str) {
    if (!str) return "";
    const spaced = str.replace(/-/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Wraps an item name in a clickable span for the item modal
// apiName: hyphenated API name e.g. "fire-stone"
// label:   display text e.g. "Fire Stone" (defaults to fmt(apiName))
function itemLink(apiName, label) {
    const display = label ?? fmt(apiName);
    return `<span class="item-link" data-item="${apiName}">${display}</span>`;
}

// Gets sprite URL from the preloaded pokemonList by name
function getSpriteUrl(name) {
    const found = pokemonList.find(p => p.name === name);
    if (!found) return "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${found.id}.png`;
}

function renderEvoChain(stages, currentName, container) {
    container.innerHTML = "";

    const arrowSvg = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 9h12M11 5l4 4-4 4"
            stroke="rgba(255,255,255,0.3)" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;

    stages.forEach((stagePokemon, stageIndex) => {
        // Arrow + condition before every stage except the first
        if (stageIndex > 0) {
            const arrowEl = document.createElement("div");
            arrowEl.className = "evo-arrow";
            const condition = stagePokemon[0]?.condition ?? "";
            arrowEl.id = `evoArrow_${stageIndex}`;
            arrowEl.innerHTML = `
                ${arrowSvg}
                ${condition ? `<span class="evo-condition" id="evoCondition_${stageIndex}">${condition}</span>` : `<span class="evo-condition" id="evoCondition_${stageIndex}"></span>`}`;
            container.appendChild(arrowEl);
        }

        if (stagePokemon.length > 1) {
            const wrap = document.createElement("div");
            wrap.className = "evo-branch-wrap";

            const mainNode = makeEvoNode(stagePokemon[0], currentName);
            mainNode.id = `evoBranchNode_${stageIndex}`;
            wrap.appendChild(mainNode);

            const tabs = document.createElement("div");
            tabs.className = "evo-thumb-tabs";

            stagePokemon.forEach((poke, i) => {
                const thumb = document.createElement("button");
                thumb.className = "evo-thumb" + (i === 0 ? " active" : "");
                thumb.title = poke.name;
                thumb.innerHTML = `<img src="${getSpriteUrl(poke.name)}" alt="${poke.name}" />`;

                thumb.addEventListener("click", () => {
                    tabs.querySelectorAll(".evo-thumb").forEach(t => t.classList.remove("active"));
                    thumb.classList.add("active");

                    const newNode = makeEvoNode(poke, currentName);
                    newNode.id = `evoBranchNode_${stageIndex}`;
                    const old = document.getElementById(`evoBranchNode_${stageIndex}`);
                    old.replaceWith(newNode);

                    // Update condition — use innerHTML so item links render
                    const condEl = document.getElementById(`evoCondition_${stageIndex}`);
                    if (condEl) condEl.innerHTML = poke.condition ?? "";
                });

                tabs.appendChild(thumb);
            });

            wrap.appendChild(tabs);
            container.appendChild(wrap);
        } else {
            container.appendChild(makeEvoNode(stagePokemon[0], currentName));
        }
    });

    // Delegate item-link clicks within the evo chain
    container.addEventListener("click", (e) => {
        const link = e.target.closest(".item-link");
        if (link) {
            e.stopPropagation();
            openItemModal(link.dataset.item);
        }
    });
}

function makeEvoNode(poke, currentName) {
    const isCurrent = poke.name === currentName;
    const spriteUrl = getSpriteUrl(poke.name);

    const node = document.createElement("div");
    node.className = "evo-node" + (isCurrent ? " current" : "");
    node.title = poke.name;
    node.innerHTML = `
        <div class="evo-sprite-wrap">
            <img class="evo-sprite" src="${spriteUrl}" alt="${poke.name}"
                 onerror="this.style.opacity='0.2'"/>
        </div>
        <span class="evo-name">${poke.name}</span>`;

    // Clicking a non-current node searches for that Pokémon
    if (!isCurrent) {
        node.addEventListener("click", () => {
            document.getElementById("pokemonName").value = poke.name;
            fetchData();
        });
    }

    return node;
}

// ============================================================
//  LOCATIONS
// ============================================================

// Maps game version names from the API to a friendly display label
const VERSION_LABELS = {
    "red":                  "Red",
    "blue":                 "Blue",
    "yellow":               "Yellow",
    "gold":                 "Gold",
    "silver":               "Silver",
    "crystal":              "Crystal",
    "ruby":                 "Ruby",
    "sapphire":             "Sapphire",
    "emerald":              "Emerald",
    "firered":              "FireRed",
    "leafgreen":            "LeafGreen",
    "diamond":              "Diamond",
    "pearl":                "Pearl",
    "platinum":             "Platinum",
    "heartgold":            "HeartGold",
    "soulsilver":           "SoulSilver",
    "black":                "Black",
    "white":                "White",
    "black-2":              "Black 2",
    "white-2":              "White 2",
    "x":                    "X",
    "y":                    "Y",
    "omega-ruby":           "Omega Ruby",
    "alpha-sapphire":       "Alpha Sapphire",
    "sun":                  "Sun",
    "moon":                 "Moon",
    "ultra-sun":            "Ultra Sun",
    "ultra-moon":           "Ultra Moon",
    "lets-go-pikachu":      "Let's Go Pikachu",
    "lets-go-eevee":        "Let's Go Eevee",
    "sword":                "Sword",
    "shield":               "Shield",
    "brilliant-diamond":    "Brilliant Diamond",
    "shining-pearl":        "Shining Pearl",
    "legends-arceus":       "Legends: Arceus",
    "scarlet":              "Scarlet",
    "violet":               "Violet",
};

// Ordered list so game tabs appear chronologically
const VERSION_ORDER = Object.keys(VERSION_LABELS);

// Friendly method names
const METHOD_LABELS_LOC = {
    "walk":               "Walking",
    "old-rod":            "Old Rod",
    "good-rod":           "Good Rod",
    "super-rod":          "Super Rod",
    "surf":               "Surfing",
    "rock-smash":         "Rock Smash",
    "headbutt":           "Headbutt",
    "headbutt-dark":      "Headbutt (Dark)",
    "headbutt-normal":    "Headbutt",
    "gift":               "Gift",
    "gift-egg":           "Egg Gift",
    "only-one":           "One-time",
    "pokeflute":          "Poké Flute",
    "squirt-bottle":      "Squirt Bottle",
    "wailmer-pail":       "Wailmer Pail",
    "seaweed":            "Seaweed",
    "super-rod-spots":    "Super Rod",
    "grass-spots":        "Grass",
    "dark-grass":         "Dark Grass",
    "cave-spots":         "Cave",
    "bridge-office-workers": "Bridge",
    "visual":             "Visual",
};

async function buildLocationsPanel(encountersUrl) {
    const panel  = document.getElementById("locationsPanel");
    const tabsEl = document.getElementById("locationsGameTabs");
    const bodyEl = document.getElementById("locationsBody");

    // Show panel with skeleton immediately
    panel.style.display = "block";
    tabsEl.innerHTML    = "";
    bodyEl.innerHTML    = `
        <div style="display:flex;flex-direction:column;gap:10px;padding:4px 0">
            <div class="skel" style="width:70%;height:13px;border-radius:4px"></div>
            <div style="display:flex;gap:6px">
                <div class="skel" style="width:80px;height:20px;border-radius:6px"></div>
                <div class="skel" style="width:80px;height:20px;border-radius:6px"></div>
            </div>
            <div class="skel" style="width:55%;height:13px;border-radius:4px;margin-top:4px"></div>
            <div style="display:flex;gap:6px">
                <div class="skel" style="width:90px;height:20px;border-radius:6px"></div>
            </div>
        </div>`;

    try {
        const res  = await fetch(encountersUrl);
        const data = await res.json();

        if (!data || data.length === 0) {
            renderNotFound(tabsEl, bodyEl);
            return;
        }

        // Build structure: { versionName: [ { locationName, method, minLevel, maxLevel, chance } ] }
        const byVersion = {};

        data.forEach(areaEntry => {
            // Clean up location name: "kanto-route-1-area" → "Route 1"
            const rawName = areaEntry.location_area.name;
            const locationName = cleanLocationName(rawName);

            areaEntry.version_details.forEach(vd => {
                const version = vd.version.name;
                if (!byVersion[version]) byVersion[version] = [];

                vd.encounter_details.forEach(enc => {
                    const method   = METHOD_LABELS_LOC[enc.method.name] ?? fmt(enc.method.name);
                    const minLevel = enc.min_level;
                    const maxLevel = enc.max_level;
                    const chance   = enc.chance;

                    // Avoid exact duplicates
                    const exists = byVersion[version].some(e =>
                        e.locationName === locationName &&
                        e.method === method &&
                        e.minLevel === minLevel &&
                        e.maxLevel === maxLevel
                    );

                    if (!exists) {
                        byVersion[version].push({ locationName, method, minLevel, maxLevel, chance });
                    }
                });
            });
        });

        // Sort available versions chronologically
        const availableVersions = VERSION_ORDER.filter(v => byVersion[v]);

        if (availableVersions.length === 0) {
            renderNotFound(tabsEl, bodyEl);
            return;
        }

        // Build game tabs
        tabsEl.innerHTML = "";
        availableVersions.forEach((version, i) => {
            const tab = document.createElement("button");
            tab.className   = "game-tab" + (i === 0 ? " active" : "");
            tab.textContent = VERSION_LABELS[version] ?? version;
            tab.addEventListener("click", () => {
                tabsEl.querySelectorAll(".game-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                renderLocationList(byVersion[version], bodyEl);
            });
            tabsEl.appendChild(tab);
        });

        // Show first game by default
        renderLocationList(byVersion[availableVersions[0]], bodyEl);

    } catch (err) {
        console.error("Locations error:", err);
        renderNotFound(tabsEl, bodyEl);
    }
}

function renderLocationList(entries, container) {
    if (!entries || entries.length === 0) {
        container.innerHTML = `<p class="no-moves">No encounters found for this game.</p>`;
        return;
    }

    // Group by location name so we can show all methods per location together
    const grouped = {};
    entries.forEach(e => {
        if (!grouped[e.locationName]) grouped[e.locationName] = [];
        grouped[e.locationName].push(e);
    });

    const html = Object.entries(grouped).map(([locName, encounters]) => {
        const pills = encounters.map(enc => {
            const levelStr = enc.minLevel === enc.maxLevel
                ? `Lv. ${enc.minLevel}`
                : `Lv. ${enc.minLevel}–${enc.maxLevel}`;

            return `
                <div class="location-condition-pill">
                    <span class="loc-method">${enc.method}</span>
                    <span class="loc-divider"></span>
                    <span class="loc-levels">${levelStr}</span>
                    <span class="loc-divider"></span>
                    <span class="loc-chance">${enc.chance}%</span>
                </div>`;
        }).join("");

        return `
            <div class="location-entry">
                <div class="location-entry-name">${locName}</div>
                <div class="location-conditions">${pills}</div>
            </div>`;
    }).join("");

    container.innerHTML = html;

    // Delegate item-link clicks within the location list
    container.querySelectorAll(".item-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.stopPropagation();
            openItemModal(link.dataset.item);
        });
    });
}

function renderNotFound(tabsEl, bodyEl) {
    tabsEl.innerHTML = "";
    bodyEl.innerHTML = `
        <div class="location-not-found">
            <div class="location-not-found-icon">🌿</div>
            <p>NOT FOUND IN THE WILD</p>
            <span>This Pokémon cannot be encountered in the wild.<br>It must be obtained by other means.</span>
        </div>`;
}

// Cleans up raw location area names from the API
// e.g. "kanto-route-1-area"           → "Route 1"
//      "mt-moon-b1f"                  → "Mt Moon B1F"
//      "pokemon-tower-1f"             → "Pokémon Tower 1F"
//      "cerulean-cave-1f"             → "Cerulean Cave 1F"
//      "viridian-forest-area"         → "Viridian Forest"
//      "pallet-town-area"             → "Pallet Town"
function cleanLocationName(raw) {
    return raw
        // Strip region prefixes
        .replace(/^(kanto|johto|hoenn|sinnoh|unova|kalos|alola|galar|hisui|paldea)-/, "")
        // Strip trailing -area
        .replace(/-area$/, "")
        // Strip level suffixes like -level-50
        .replace(/-level-\d+$/, "")
        // Fix "pokemon" → "Pokémon"
        .replace(/\bpokemon\b/gi, "pokémon")
        // Split on hyphens and capitalise each word
        .split("-")
        .map(word => {
            // Keep floor/level labels uppercase: 1f, 2f, b1f, b2f
            if (/^b?\d+f$/i.test(word)) return word.toUpperCase();
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}

// ============================================================
//  MOVE TOOLTIP
// ============================================================

// Cache: apiName → { name, power, accuracy, pp, damageClass, effect, type }
// Note: moveTypeCache already stores the type, we extend with full details here
const moveDetailCache = {};

let activeTooltipBtn = null;

async function showMoveTooltip(apiName, btnEl) {
    const tooltip = document.getElementById("moveTooltip");
    const inner   = document.getElementById("moveTooltipInner");

    // If same button clicked again, close it
    if (activeTooltipBtn === btnEl && tooltip.classList.contains("visible")) {
        closeMoveTooltip();
        return;
    }
    activeTooltipBtn = btnEl;

    // Show skeleton immediately
    inner.innerHTML = `
        <div class="move-tooltip-skel">
            <div class="skel" style="width:100px;height:9px;border-radius:3px"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
                <div class="skel" style="height:36px;border-radius:6px"></div>
                <div class="skel" style="height:36px;border-radius:6px"></div>
                <div class="skel" style="height:36px;border-radius:6px"></div>
            </div>
            <div class="skel" style="width:100%;height:32px;border-radius:4px"></div>
        </div>`;

    positionTooltip(tooltip, btnEl);
    tooltip.classList.add("visible");

    // Fetch if not cached
    if (!moveDetailCache[apiName]) {
        try {
            const res  = await fetch(`https://pokeapi.co/api/v2/move/${apiName}`);
            const data = await res.json();

            const effectEntry = data.effect_entries.find(e => e.language.name === "en");
            let effect = effectEntry?.short_effect ?? "No description available.";
            // Replace $effect_chance placeholder if present
            if (data.effect_chance) {
                effect = effect.replace(/\$effect_chance/g, data.effect_chance);
            }

            moveDetailCache[apiName] = {
                name:        data.name,
                power:       data.power       ?? "—",
                accuracy:    data.accuracy    ?? "—",
                pp:          data.pp          ?? "—",
                damageClass: data.damage_class.name,
                type:        data.type.name,
                heldItem:    data.held_items?.[0]?.item?.name ?? null,
                effect,
            };

            // Also update the shared type cache
            moveTypeCache[apiName] = data.type.name;

        } catch {
            moveDetailCache[apiName] = {
                name: apiName, power: "—", accuracy: "—", pp: "—",
                damageClass: "status", type: "normal",
                effect: "Could not load move data."
            };
        }
    }

    // Only update if this tooltip is still the active one
    if (activeTooltipBtn !== btnEl) return;

    const m = moveDetailCache[apiName];
    const damageCls = `damage-${m.damageClass}`;
    const displayName = m.name.replace(/-/g, " ");

    inner.innerHTML = `
        <p class="move-tooltip-name">${displayName}</p>
        <div style="display:flex;gap:5px;align-items:center;margin-bottom:10px">
            <span class="move-tooltip-damage ${damageCls}">${m.damageClass.toUpperCase()}</span>
            <span class="type-badge type-${m.type}" style="font-size:6px;padding:2px 8px">${m.type}</span>
        </div>
        <div class="move-tooltip-stats">
            <div class="move-tooltip-stat">
                <span class="move-tooltip-stat-label">POWER</span>
                <span class="move-tooltip-stat-val">${m.power}</span>
            </div>
            <div class="move-tooltip-stat">
                <span class="move-tooltip-stat-label">ACC</span>
                <span class="move-tooltip-stat-val">${m.accuracy}</span>
            </div>
            <div class="move-tooltip-stat">
                <span class="move-tooltip-stat-label">PP</span>
                <span class="move-tooltip-stat-val">${m.pp}</span>
            </div>
        </div>
        ${m.heldItem ? `<p class="move-tooltip-held">Held item: ${itemLink(m.heldItem)}</p>` : ""}
        <p class="move-tooltip-desc">${m.effect}</p>
    `;

    // Delegate item-link clicks within the tooltip
    inner.querySelectorAll(".item-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.stopPropagation();
            closeMoveTooltip();
            openItemModal(link.dataset.item);
        });
    });

    // Re-position in case content changed size
    positionTooltip(tooltip, btnEl);
}

function positionTooltip(tooltip, anchorEl) {
    const rect    = anchorEl.getBoundingClientRect();
    const ttWidth = 230;
    const margin  = 8;

    let left = rect.left;
    let top  = rect.bottom + margin;

    // Prevent overflow off right edge
    if (left + ttWidth > window.innerWidth - margin) {
        left = window.innerWidth - ttWidth - margin;
    }

    // If not enough room below, flip above
    if (top + 180 > window.innerHeight) {
        top = rect.top - 180 - margin;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top  = `${top}px`;
}

function closeMoveTooltip() {
    document.getElementById("moveTooltip").classList.remove("visible");
    activeTooltipBtn = null;
}

// Close tooltip when clicking outside
document.addEventListener("click", (e) => {
    if (!e.target.closest(".move-tooltip") && !e.target.closest(".move-name-btn")) {
        closeMoveTooltip();
    }
});

// Close on Escape — handled by consolidated listener in type chart section

// ============================================================
//  ABILITIES
// ============================================================

// Cache: ability name → { effect, flavour }
const abilityCache = {};

function renderAbilities(abilitiesData) {
    const row = document.getElementById("abilitiesRow");
    row.innerHTML = "";

    abilitiesData.forEach(entry => {
        const name     = entry.ability.name;
        const isHidden = entry.is_hidden;

        const pill = document.createElement("button");
        pill.className = "ability-pill" + (isHidden ? " hidden-ability" : "");
        pill.innerHTML = `
            <span class="ability-pill-name">${name.replace(/-/g, " ")}</span>
            ${isHidden ? `<span class="ability-pill-hidden">HIDDEN</span>` : ""}
        `;

        pill.addEventListener("click", () => openAbilityModal(name, isHidden));
        row.appendChild(pill);
    });
}

async function openAbilityModal(name, isHidden) {
    const backdrop = document.getElementById("abilityBackdrop");
    const inner    = document.getElementById("abilityModalInner");

    // Show modal with skeleton while loading
    backdrop.classList.add("open");
    inner.innerHTML = `
        <div class="ability-modal-loading">
            <div class="skel" style="width:60px;height:8px;border-radius:4px"></div>
            <div class="skel" style="width:160px;height:14px;border-radius:4px"></div>
            <div class="skel" style="width:100%;height:60px;border-radius:8px"></div>
            <div class="skel" style="width:90%;height:36px;border-radius:8px"></div>
        </div>`;

    // Fetch if not cached
    if (!abilityCache[name]) {
        try {
            const res  = await fetch(`https://pokeapi.co/api/v2/ability/${name}`);
            const data = await res.json();

            // Short effect — English entry from effect_entries
            const effectEntry = data.effect_entries.find(e => e.language.name === "en");
            const effect = effectEntry?.short_effect ?? "No description available.";

            // Flavour text — most recent English entry
            const flavourEntries = data.flavor_text_entries.filter(e => e.language.name === "en");
            const flavour = flavourEntries.length > 0
                ? flavourEntries[flavourEntries.length - 1].flavor_text.replace(/\f/g, " ")
                : "";

            abilityCache[name] = { effect, flavour };
        } catch {
            abilityCache[name] = {
                effect: "Could not load ability data.",
                flavour: ""
            };
        }
    }

    // Check modal is still open (user may have closed it while fetching)
    if (!backdrop.classList.contains("open")) return;

    const { effect, flavour } = abilityCache[name];
    const displayName = name.replace(/-/g, " ");

    inner.innerHTML = `
        <p class="ability-modal-tag">${isHidden ? "Hidden Ability" : "Ability"}</p>
        <h2 class="ability-modal-name">${displayName}</h2>
        <p class="ability-modal-effect">${effect}</p>
        ${flavour ? `<p class="ability-modal-flavour">"${flavour}"</p>` : ""}
    `;
}

function closeAbilityModal() {
    document.getElementById("abilityBackdrop").classList.remove("open");
}

// Close on backdrop click or Escape key
document.getElementById("abilityBackdrop").addEventListener("click", (e) => {
    if (e.target === document.getElementById("abilityBackdrop")) closeAbilityModal();
});
document.getElementById("abilityModalClose").addEventListener("click", closeAbilityModal);

// ============================================================
//  SHINY TOGGLE
// ============================================================

function setupShinyToggle(normalSrc, shinySrc, imgEl) {
    const btn = document.getElementById("shinyToggle");

    // Reset button state for new Pokémon
    btn.classList.remove("active");

    // If no shiny sprite exists, hide the button
    if (!shinySrc) {
        btn.style.display = "none";
        return;
    }
    btn.style.display = "flex";

    // Remove old listener by cloning the button
    const freshBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(freshBtn, btn);

    let isShiny = false;

    freshBtn.addEventListener("click", () => {
        isShiny = !isShiny;
        freshBtn.classList.toggle("active", isShiny);

        // Swap sprite with a little pop animation
        imgEl.style.animation = "none";
        imgEl.offsetHeight;    // force reflow so animation restarts
        imgEl.src = isShiny ? shinySrc : normalSrc;
        imgEl.style.animation = "spritePop 0.35s ease, spriteFloat 3s ease-in-out 0.35s infinite";
    });
}

// ============================================================
//  MOVES PANEL
// ============================================================

// Cache: move name → type string  e.g. { "surf": "water", "flamethrower": "fire" }
const moveTypeCache = {};

// Maps version-group names from the API to a friendly Gen label
const VERSION_GROUP_TO_GEN = {
    "red-blue":                      "Gen I",
    "yellow":                        "Gen I",
    "gold-silver":                   "Gen II",
    "crystal":                       "Gen II",
    "ruby-sapphire":                 "Gen III",
    "emerald":                       "Gen III",
    "firered-leafgreen":             "Gen III",
    "diamond-pearl":                 "Gen IV",
    "platinum":                      "Gen IV",
    "heartgold-soulsilver":          "Gen IV",
    "black-white":                   "Gen V",
    "black-2-white-2":               "Gen V",
    "x-y":                           "Gen VI",
    "omega-ruby-alpha-sapphire":     "Gen VI",
    "sun-moon":                      "Gen VII",
    "ultra-sun-ultra-moon":          "Gen VII",
    "lets-go-pikachu-lets-go-eevee": "Gen VII",
    "sword-shield":                  "Gen VIII",
    "the-isle-of-armor":             "Gen VIII",
    "the-crown-tundra":              "Gen VIII",
    "scarlet-violet":                "Gen IX",
    "the-teal-mask":                 "Gen IX",
    "the-indigo-disk":               "Gen IX",
};

const GEN_ORDER = ["Gen I","Gen II","Gen III","Gen IV","Gen V","Gen VI","Gen VII","Gen VIII","Gen IX"];

const METHOD_CLASS = {
    "level-up": "method-level-up",
    "machine":  "method-machine",
    "egg":      "method-egg",
    "tutor":    "method-tutor",
};

const METHOD_LABEL = {
    "level-up": "LEVEL UP",
    "machine":  "TM / HM",
    "egg":      "EGG",
    "tutor":    "TUTOR",
};

// Holds the grouped move data for the current Pokémon so tab clicks can re-render
let currentByGen = {};

function buildMovesPanel(movesData) {
    const panel  = document.getElementById("movesPanel");
    const tabsEl = document.getElementById("movesFilterTabs");
    const bodyEl = document.getElementById("movesBody");

    // Clear cache between Pokémon searches so types always match
    currentByGen = {};

    // Group moves by gen — structure: { "Gen I": [ { name, apiName, method, level } ] }
    movesData.forEach(moveEntry => {
        const apiName  = moveEntry.move.name;                    // e.g. "hydro-pump"
        const moveName = apiName.replace(/-/g, " ");             // e.g. "hydro pump"

        moveEntry.version_group_details.forEach(vgd => {
            const gen = VERSION_GROUP_TO_GEN[vgd.version_group.name];
            if (!gen) return;

            if (!currentByGen[gen]) currentByGen[gen] = [];

            const method = vgd.move_learn_method.name;
            const level  = vgd.level_learned_at;
            const exists = currentByGen[gen].some(m => m.apiName === apiName && m.method === method);
            if (!exists) {
                currentByGen[gen].push({ name: moveName, apiName, method, level });
            }
        });
    });

    // Sort each gen: level-up by level first, then alphabetically
    Object.values(currentByGen).forEach(arr => {
        arr.sort((a, b) => {
            if (a.method === "level-up" && b.method !== "level-up") return -1;
            if (b.method === "level-up" && a.method !== "level-up") return  1;
            if (a.method === "level-up" && b.method === "level-up") return a.level - b.level;
            return a.name.localeCompare(b.name);
        });
    });

    const availableGens = GEN_ORDER.filter(g => currentByGen[g]);
    if (availableGens.length === 0) { panel.style.display = "none"; return; }

    // Build gen tabs — default to latest gen
    tabsEl.innerHTML = "";
    availableGens.forEach((gen, i) => {
        const tab = document.createElement("button");
        tab.className  = "gen-tab" + (i === availableGens.length - 1 ? " active" : "");
        tab.textContent = gen;
        tab.dataset.gen = gen;
        tab.addEventListener("click", () => {
            document.querySelectorAll(".gen-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            renderMovesTable(currentByGen[gen], bodyEl);
        });
        tabsEl.appendChild(tab);
    });

    const latestGen = availableGens[availableGens.length - 1];
    renderMovesTable(currentByGen[latestGen], bodyEl);
    panel.style.display = "block";
}

// Renders the table with skeleton type cells, then fetches types and fills them in
async function renderMovesTable(moves, container) {
    if (!moves || moves.length === 0) {
        container.innerHTML = `<p class="no-moves">No moves found for this generation.</p>`;
        return;
    }

    // Build the table immediately with skeleton placeholders for unknown types
    const rows = moves.map(m => {
        const cls   = METHOD_CLASS[m.method] ?? "method-tutor";
        const label = METHOD_LABEL[m.method] ?? m.method.toUpperCase();
        const METHOD_ICONS = {
            "machine": `<span class="move-method-icon" title="TM / HM">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Disc outer ring -->
                  <circle cx="8" cy="8" r="7" stroke="#4a90d9" stroke-width="1.2" fill="none"/>
                  <!-- Disc inner ring -->
                  <circle cx="8" cy="8" r="4.2" stroke="#4a90d9" stroke-width="0.8" fill="none" opacity="0.5"/>
                  <!-- Centre hole -->
                  <circle cx="8" cy="8" r="1.4" fill="#4a90d9"/>
                  <!-- Shine arc -->
                  <path d="M 3.5 5.5 A 5 5 0 0 1 8 3" stroke="rgba(255,255,255,0.4)" stroke-width="1" stroke-linecap="round" fill="none"/>
                </svg>
            </span>`,
            "egg": `<span class="move-method-icon" title="Egg Move">
                <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Egg shape -->
                  <path d="M 7 1 C 3 1 1 5 1 9 C 1 13 3.5 15 7 15 C 10.5 15 13 13 13 9 C 13 5 11 1 7 1 Z"
                        stroke="#f85888" stroke-width="1.2" fill="none"/>
                  <!-- Crack line -->
                  <path d="M 5.5 8 L 7 6.5 L 8.5 8 L 7 9.5" stroke="#f85888" stroke-width="0.9" stroke-linejoin="round" fill="none" opacity="0.7"/>
                </svg>
            </span>`,
            "tutor": `<span class="move-method-icon" title="Tutor Move">
                <svg width="13" height="16" viewBox="0 0 13 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Book body -->
                  <rect x="1" y="1" width="11" height="14" rx="1.5" stroke="#f7d02c" stroke-width="1.2" fill="none"/>
                  <!-- Spine line -->
                  <line x1="4" y1="1" x2="4" y2="15" stroke="#f7d02c" stroke-width="0.9" opacity="0.6"/>
                  <!-- Text lines -->
                  <line x1="6" y1="5"  x2="10.5" y2="5"  stroke="#f7d02c" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>
                  <line x1="6" y1="8"  x2="10.5" y2="8"  stroke="#f7d02c" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>
                  <line x1="6" y1="11" x2="9"    y2="11" stroke="#f7d02c" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>
                </svg>
            </span>`,
        };

        const lvl = m.method === "level-up"
            ? `<span class="move-level">${m.level > 0 ? `Lv.${m.level}` : "–"}</span>`
            : (METHOD_ICONS[m.method] ?? `<span class="move-level"></span>`);

        // If type already cached, render it; otherwise show a shimmer skeleton
        const typeBadge = moveTypeCache[m.apiName]
            ? `<span class="type-badge type-${moveTypeCache[m.apiName]}">${moveTypeCache[m.apiName]}</span>`
            : `<span class="skel skel-move-type" data-move="${m.apiName}"></span>`;

        return `
        <tr>
          <td>
            ${lvl}
            <span class="move-name-btn" data-apiname="${m.apiName}">${m.name}</span>
          </td>
          <td><span class="move-type-cell">${typeBadge}</span></td>
          <td><span class="learn-method ${cls}">${label}</span></td>
        </tr>`;
    }).join("");

    container.innerHTML = `
        <table class="moves-table">
          <thead>
            <tr>
              <th>Move</th>
              <th>Type</th>
              <th style="text-align:right">Method</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;

    // Delegate clicks on move names to show tooltip
    container.querySelectorAll(".move-name-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            showMoveTooltip(btn.dataset.apiname, btn);
        });
    });

    // Find which moves still need their type fetched (not in cache)
    const uncached = moves.filter(m => !moveTypeCache[m.apiName]);
    if (uncached.length === 0) return; // all cached — nothing to do

    // Fetch all uncached move types in parallel
    await Promise.all(uncached.map(async m => {
        try {
            const res  = await fetch(`https://pokeapi.co/api/v2/move/${m.apiName}`);
            const data = await res.json();
            moveTypeCache[m.apiName] = data.type.name;
        } catch {
            moveTypeCache[m.apiName] = "normal"; // fallback
        }
    }));

    // Replace skeleton cells with real type badges — only update cells still in the DOM
    uncached.forEach(m => {
        const skelEl = container.querySelector(`.skel-move-type[data-move="${m.apiName}"]`);
        if (!skelEl) return; // user may have switched tab — skip
        const type = moveTypeCache[m.apiName];
        const badge = document.createElement("span");
        badge.className   = `type-badge type-${type}`;
        badge.textContent = type;
        skelEl.replaceWith(badge);
    });
}

// ============================================================
//  MODE SWITCHING (Pokémon / Item)
// ============================================================

let currentMode = "pokemon";

function switchMode(mode) {
    currentMode = mode;
    document.getElementById("modePokemon").style.display  = mode === "pokemon" ? "block" : "none";
    document.getElementById("modeItem").style.display     = mode === "item"    ? "block" : "none";
    document.getElementById("tabPokemon").classList.toggle("active", mode === "pokemon");
    document.getElementById("tabItem").classList.toggle("active",    mode === "item");

    // Close any open tooltip/modal
    closeMoveTooltip();

    // Focus the relevant input
    setTimeout(() => {
        const inputId = mode === "pokemon" ? "pokemonName" : "itemName";
        document.getElementById(inputId)?.focus();
    }, 50);
}

// ============================================================
//  ITEM SEARCH
// ============================================================

let itemList = []; // loaded once on page startup: [{ name, url }]
const itemCache = {}; // apiName → full item data object

async function loadItemList() {
    try {
        const res  = await fetch("https://pokeapi.co/api/v2/item?limit=2000");
        const data = await res.json();
        itemList = data.results; // [{ name, url }]
    } catch (err) {
        console.error("Failed to load item list:", err);
    }
}

async function fetchItem(nameOverride) {
    const input    = document.getElementById("itemName");
    const rawName  = (nameOverride ?? input.value).toLowerCase().trim().replace(/\s+/g, "-");

    if (!rawName) return;

    const emptyEl   = document.getElementById("itemEmptyState");
    const skelEl    = document.getElementById("itemSkeletonCard");
    const cardEl    = document.getElementById("itemCard");
    const errorEl   = document.getElementById("itemErrorState");

    // Reset
    emptyEl.style.display = "none";
    cardEl.style.display  = "none";
    errorEl.style.display = "none";
    skelEl.style.display  = "block";

    try {
        const [res] = await Promise.all([
            fetch(`https://pokeapi.co/api/v2/item/${rawName}`),
            sleep(FAKE_LOADING_MS)
        ]);

        if (!res.ok) throw new Error("Item not found");
        const data = await res.json();
        itemCache[rawName] = data;

        renderItemCard(data);

    } catch (err) {
        console.error(err);
        skelEl.style.display  = "none";
        errorEl.style.display = "flex";
    }
}

function renderItemCard(data) {
    const skelEl = document.getElementById("itemSkeletonCard");
    const cardEl = document.getElementById("itemCard");

    // Sprite
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${data.name}.png`;
    document.getElementById("itemSprite").src = spriteUrl;

    // Name
    document.getElementById("itemNameDisplay").textContent = fmt(data.name);

    // Category
    document.getElementById("itemCategory").textContent = fmt(data.category?.name ?? "item");

    // Attribute badges (e.g. holdable, consumable)
    const attribEl = document.getElementById("itemAttributeBadges");
    attribEl.innerHTML = "";
    (data.attributes ?? []).slice(0, 3).forEach(attr => {
        const badge = document.createElement("span");
        badge.className   = "type-badge type-normal";
        badge.textContent = fmt(attr.name);
        badge.style.cssText = "background:rgba(255,255,255,0.06);color:var(--text-dim);border:1px solid rgba(255,255,255,0.1);font-size:6px;padding:3px 8px";
        attribEl.appendChild(badge);
    });

    // Fling power
    const flingRow = document.getElementById("itemFlingRow");
    if (data.fling_power) {
        document.getElementById("itemFlingPower").textContent = data.fling_power;
        flingRow.style.display = "flex";
    } else {
        flingRow.style.display = "none";
    }

    // Effect
    const effectEntry = (data.effect_entries ?? []).find(e => e.language.name === "en");
    const effect = effectEntry?.short_effect ?? effectEntry?.effect ?? "No effect description available.";
    document.getElementById("itemEffectBox").textContent = effect;

    // Flavour text — latest English entry
    const flavourEntries = (data.flavor_text_entries ?? []).filter(e => e.language.name === "en");
    const flavour = flavourEntries.length > 0
        ? flavourEntries[flavourEntries.length - 1].text.replace(/\f/g, " ")
        : "";
    const flavourEl = document.getElementById("itemFlavour");
    flavourEl.textContent = flavour ? `"${flavour}"` : "";
    flavourEl.style.display = flavour ? "block" : "none";

    skelEl.style.display = "none";
    cardEl.style.display = "block";
}

// ============================================================
//  ITEM MODAL (opened from links within Pokémon view)
// ============================================================

const itemModalCache = {};

async function openItemModal(apiName) {
    const backdrop = document.getElementById("itemModalBackdrop");
    const inner    = document.getElementById("itemModalInner");

    backdrop.classList.add("open");
    inner.innerHTML = `
        <div class="ability-modal-loading">
            <div class="skel" style="width:60px;height:8px;border-radius:3px"></div>
            <div class="skel" style="width:80px;height:80px;border-radius:50%;margin:0 auto"></div>
            <div class="skel" style="width:160px;height:14px;border-radius:4px"></div>
            <div class="skel" style="width:100%;height:60px;border-radius:8px"></div>
        </div>`;

    if (!itemModalCache[apiName]) {
        try {
            const res  = await fetch(`https://pokeapi.co/api/v2/item/${apiName}`);
            const data = await res.json();
            const effectEntry   = (data.effect_entries ?? []).find(e => e.language.name === "en");
            const effect        = effectEntry?.short_effect ?? "No description available.";
            const flavourEntries = (data.flavor_text_entries ?? []).filter(e => e.language.name === "en");
            const flavour       = flavourEntries.length > 0
                ? flavourEntries[flavourEntries.length - 1].text.replace(/\f/g, " ")
                : "";
            itemModalCache[apiName] = { name: data.name, category: data.category?.name, effect, flavour };
        } catch {
            itemModalCache[apiName] = { name: apiName, category: "", effect: "Could not load item data.", flavour: "" };
        }
    }

    if (!backdrop.classList.contains("open")) return;

    const item        = itemModalCache[apiName];
    const spriteUrl   = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.name}.png`;
    const displayName = fmt(item.name);

    inner.innerHTML = `
        <p class="ability-modal-tag">${item.category ? fmt(item.category) : "Item"}</p>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
            <img src="${spriteUrl}" alt="${displayName}"
                 style="width:48px;height:48px;image-rendering:pixelated;
                        filter:drop-shadow(0 2px 8px rgba(0,0,0,0.5))"
                 onerror="this.style.display='none'"/>
            <h2 class="ability-modal-name" style="margin-bottom:0">${displayName}</h2>
        </div>
        <p class="ability-modal-effect">${item.effect}</p>
        ${item.flavour ? `<p class="ability-modal-flavour">"${item.flavour}"</p>` : ""}
    `;
}

function closeItemModal() {
    document.getElementById("itemModalBackdrop").classList.remove("open");
}

document.getElementById("itemModalBackdrop").addEventListener("click", (e) => {
    if (e.target === document.getElementById("itemModalBackdrop")) closeItemModal();
});
document.getElementById("itemModalClose").addEventListener("click", closeItemModal);

// ============================================================
//  ITEM AUTOCOMPLETE
// ============================================================

function setupItemAutocomplete() {
    const input  = document.getElementById("itemName");
    const listEl = document.getElementById("itemAutocompleteList");
    let highlighted = -1;

    function closeDropdown() {
        listEl.classList.remove("open");
        listEl.innerHTML = "";
        highlighted = -1;
    }

    function openDropdown(matches) {
        highlighted = -1;
        listEl.innerHTML = "";

        matches.forEach(item => {
            const li = document.createElement("li");
            li.className = "autocomplete-item";
            const typed     = input.value.toLowerCase();
            const matchPart = item.name.slice(0, typed.length);
            const restPart  = item.name.slice(typed.length);
            const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.name}.png`;
            li.innerHTML = `
                <img class="autocomplete-item-sprite" src="${spriteUrl}"
                     alt="${item.name}" onerror="this.style.visibility='hidden'"/>
                <span class="autocomplete-name">
                    <mark>${matchPart}</mark>${restPart.replace(/-/g, " ")}
                </span>`;
            li.addEventListener("mousedown", (e) => {
                e.preventDefault();
                input.value = item.name;
                closeDropdown();
                fetchItem(item.name);
            });
            listEl.appendChild(li);
        });

        listEl.classList.add("open");
    }

    input.addEventListener("input", () => {
        const query = input.value.toLowerCase().trim();
        if (query.length < 2) { closeDropdown(); return; }

        const matches = itemList
            .filter(i => i.name.startsWith(query))
            .slice(0, 6);

        if (matches.length === 0) { closeDropdown(); return; }
        openDropdown(matches);
    });

    input.addEventListener("keydown", (e) => {
        const items = listEl.querySelectorAll(".autocomplete-item");
        if (e.key === "ArrowDown") {
            e.preventDefault();
            highlighted = Math.min(highlighted + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle("highlighted", i === highlighted));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            highlighted = Math.max(highlighted - 1, -1);
            items.forEach((el, i) => el.classList.toggle("highlighted", i === highlighted));
        } else if (e.key === "Enter") {
            if (highlighted >= 0 && items[highlighted]) {
                const name = items[highlighted].querySelector(".autocomplete-name").textContent.replace(/\s+/g, "-").toLowerCase();
                input.value = name;
                closeDropdown();
                fetchItem(name);
            } else {
                closeDropdown();
                fetchItem();
            }
        } else if (e.key === "Escape") {
            closeDropdown();
        }
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest("#modeItem .search-box-wrap")) closeDropdown();
    });
}

// ============================================================
//  TYPE CHART MODAL
// ============================================================

// Complete hardcoded type chart — no extra fetches needed.
// Structure: type → { weak: [], strong: [] }
// weak   = types this type takes 2x damage FROM (attacking types that are super effective)
// strong = types this type deals 2x damage TO (defending types it's super effective against)
const TYPE_CHART = {
    normal:   { weak: ["fighting"],                                         strong: [] },
    fire:     { weak: ["water","ground","rock"],                            strong: ["grass","ice","bug","steel"] },
    water:    { weak: ["electric","grass"],                                 strong: ["fire","ground","rock"] },
    electric: { weak: ["ground"],                                           strong: ["water","flying"] },
    grass:    { weak: ["fire","ice","poison","flying","bug"],               strong: ["water","ground","rock"] },
    ice:      { weak: ["fire","fighting","rock","steel"],                   strong: ["grass","ground","flying","dragon"] },
    fighting: { weak: ["flying","psychic","fairy"],                        strong: ["normal","ice","rock","dark","steel"] },
    poison:   { weak: ["ground","psychic"],                                 strong: ["grass","fairy"] },
    ground:   { weak: ["water","grass","ice"],                              strong: ["fire","electric","poison","rock","steel"] },
    flying:   { weak: ["electric","ice","rock"],                            strong: ["grass","fighting","bug"] },
    psychic:  { weak: ["bug","ghost","dark"],                               strong: ["fighting","poison"] },
    bug:      { weak: ["fire","flying","rock"],                             strong: ["grass","psychic","dark"] },
    rock:     { weak: ["water","grass","fighting","ground","steel"],        strong: ["fire","ice","flying","bug"] },
    ghost:    { weak: ["ghost","dark"],                                     strong: ["psychic","ghost"] },
    dragon:   { weak: ["ice","dragon","fairy"],                             strong: ["dragon"] },
    dark:     { weak: ["fighting","bug","fairy"],                           strong: ["psychic","ghost"] },
    steel:    { weak: ["fire","fighting","ground"],                         strong: ["ice","rock","fairy"] },
    fairy:    { weak: ["poison","steel"],                                   strong: ["fighting","dragon","dark"] },
};

const ALL_TYPES = Object.keys(TYPE_CHART);

let typeChartBuilt = false;

function openTypeChart() {
    const backdrop = document.getElementById("typeChartBackdrop");
    backdrop.classList.add("open");
    if (!typeChartBuilt) {
        buildTypeChart();
        typeChartBuilt = true;
    }
}

function closeTypeChart() {
    document.getElementById("typeChartBackdrop").classList.remove("open");
}

function buildTypeChart() {
    const body = document.getElementById("typeChartBody");
    body.innerHTML = "";

    ALL_TYPES.forEach(type => {
        const { weak, strong } = TYPE_CHART[type];

        const weakBadges = weak.length > 0
            ? weak.map(t => `<span class="tc-badge type-${t}">${t}</span>`).join("")
            : `<span class="tc-none">none</span>`;

        const strongBadges = strong.length > 0
            ? strong.map(t => `<span class="tc-badge type-${t}">${t}</span>`).join("")
            : `<span class="tc-none">none</span>`;

        const row = document.createElement("div");
        row.className = "tc-row";
        row.innerHTML = `
            <span class="type-badge type-${type} tc-type-badge">${type}</span>
            <div class="tc-section">
                <span class="tc-section-label tc-weak-label">WEAK TO</span>
                <div class="tc-badges">${weakBadges}</div>
            </div>
            <div class="tc-section">
                <span class="tc-section-label tc-strong-label">STRONG VS</span>
                <div class="tc-badges">${strongBadges}</div>
            </div>`;

        body.appendChild(row);
    });
}

// Wire up FAB and close handlers
document.getElementById("typeChartFab").addEventListener("click", openTypeChart);
document.getElementById("typeChartClose").addEventListener("click", closeTypeChart);
document.getElementById("typeChartBackdrop").addEventListener("click", (e) => {
    if (e.target === document.getElementById("typeChartBackdrop")) closeTypeChart();
});

// Add to existing Escape handler
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeMoveTooltip();
        closeAbilityModal();
        closeTypeChart();
    }
});

// ============================================================
//  STARTUP
// ============================================================

loadItemList();
setupItemAutocomplete();

// Full Pokémon list loaded once on page startup
// Each entry: { name: "bulbasaur", id: 1 }
let pokemonList = [];

async function loadPokemonList() {
    try {
        const res  = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1500");
        const data = await res.json();

        // Extract name + ID (ID is the number at the end of the resource URL)
        pokemonList = data.results.map(p => {
            const parts = p.url.split("/").filter(Boolean);
            const id    = parseInt(parts[parts.length - 1], 10);
            return { name: p.name, id };
        });
    } catch (err) {
        console.error("Failed to load Pokémon list:", err);
    }
}

function setupAutocomplete() {
    const input   = document.getElementById("pokemonName");
    const listEl  = document.getElementById("autocompleteList");
    let highlighted = -1; // index of keyboard-highlighted item

    function closeDropdown() {
        listEl.classList.remove("open");
        listEl.innerHTML = "";
        highlighted = -1;
    }

    function openDropdown(matches) {
        highlighted = -1;
        listEl.innerHTML = "";

        matches.forEach((pokemon, i) => {
            const li = document.createElement("li");
            li.className = "autocomplete-item";

            // Highlight the matching prefix in yellow
            const typed     = input.value.toLowerCase();
            const matchPart = pokemon.name.slice(0, typed.length);
            const restPart  = pokemon.name.slice(typed.length);

            li.innerHTML = `
                <span class="autocomplete-num">#${String(pokemon.id).padStart(3, "0")}</span>
                <span class="autocomplete-name"><mark>${matchPart}</mark>${restPart}</span>
            `;

            li.addEventListener("mousedown", (e) => {
                // mousedown fires before blur — prevent input losing focus prematurely
                e.preventDefault();
                input.value = pokemon.name;
                closeDropdown();
                fetchData();
            });

            listEl.appendChild(li);
        });

        listEl.classList.add("open");
    }

    // Filter and show suggestions on input
    input.addEventListener("input", () => {
        const query = input.value.toLowerCase().trim();

        if (query.length < 2) { closeDropdown(); return; }

        const matches = pokemonList
            .filter(p => p.name.startsWith(query))
            .sort((a, b) => a.id - b.id)
            .slice(0, 6);

        if (matches.length === 0) { closeDropdown(); return; }

        openDropdown(matches);
    });

    // Keyboard navigation
    input.addEventListener("keydown", (e) => {
        const items = listEl.querySelectorAll(".autocomplete-item");

        if (e.key === "ArrowDown") {
            e.preventDefault();
            highlighted = Math.min(highlighted + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle("highlighted", i === highlighted));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            highlighted = Math.max(highlighted - 1, -1);
            items.forEach((el, i) => el.classList.toggle("highlighted", i === highlighted));
        } else if (e.key === "Enter") {
            if (highlighted >= 0 && items[highlighted]) {
                const name = items[highlighted].querySelector(".autocomplete-name").textContent;
                input.value = name;
                closeDropdown();
                fetchData();
            } else {
                closeDropdown();
                fetchData();
            }
        } else if (e.key === "Escape") {
            closeDropdown();
        }
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-box-wrap")) closeDropdown();
    });
}

// Kick everything off on page load
loadPokemonList();
setupAutocomplete();

// Random Pokémon button — picks any of the 1010 main-series Pokémon
document.getElementById("randomBtn").addEventListener("click", () => {
    const randomId = Math.floor(Math.random() * 1010) + 1;
    // Find the name from the preloaded list once available, else fall back to ID
    const found = pokemonList.find(p => p.id === randomId);
    const nameOrId = found ? found.name : String(randomId);
    document.getElementById("pokemonName").value = nameOrId;
    fetchData();
});