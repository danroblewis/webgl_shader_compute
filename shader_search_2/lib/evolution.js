/**
 * Genetic operators for evolving cellular automata rules
 */

import { Genome, Rule, CellType } from './genome.js';

const ALL_CELL_TYPES = [CellType.EMPTY, CellType.SAND, CellType.STONE];

/**
 * Mutation operators
 */

// Mutate a single cell in a pattern
function mutatePattern(genome, mutationRate = 0.1) {
    const newGenome = genome.clone();
    
    for (const cellType in newGenome.rules) {
        for (const rule of newGenome.rules[cellType]) {
            for (let i = 0; i < 9; i++) {
                if (i === 4) continue;  // Don't mutate center
                
                if (Math.random() < mutationRate) {
                    // Change to a random cell type or wildcard
                    const options = [...ALL_CELL_TYPES, CellType.ANY];
                    rule.pattern[i] = options[Math.floor(Math.random() * options.length)];
                }
            }
        }
    }
    
    return newGenome;
}

// Mutate what a rule becomes
function mutateOutcome(genome, mutationRate = 0.05) {
    const newGenome = genome.clone();
    
    for (const cellType in newGenome.rules) {
        for (const rule of newGenome.rules[cellType]) {
            if (Math.random() < mutationRate) {
                // Change to a random cell type
                rule.becomes = ALL_CELL_TYPES[Math.floor(Math.random() * ALL_CELL_TYPES.length)];
            }
        }
    }
    
    return newGenome;
}

// Add a new random rule
function mutateAddRule(genome, addRate = 0.05) {
    const newGenome = genome.clone();
    
    if (Math.random() < addRate) {
        // Pick a random cell type to add a rule for
        const cellType = ALL_CELL_TYPES[Math.floor(Math.random() * ALL_CELL_TYPES.length)];
        
        // Generate random pattern with some wildcards
        const pattern = new Array(9).fill(0).map((_, i) => {
            if (i === 4) return cellType;  // Center matches cell type
            return Math.random() < 0.5 ? CellType.ANY : 
                   ALL_CELL_TYPES[Math.floor(Math.random() * ALL_CELL_TYPES.length)];
        });
        
        // Random outcome
        const becomes = ALL_CELL_TYPES[Math.floor(Math.random() * ALL_CELL_TYPES.length)];
        
        const newRule = new Rule(pattern, becomes);
        
        // Insert at random position
        const rules = newGenome.rules[cellType];
        const insertPos = Math.floor(Math.random() * (rules.length + 1));
        rules.splice(insertPos, 0, newRule);
    }
    
    return newGenome;
}

// Remove a random rule
function mutateRemoveRule(genome, removeRate = 0.05) {
    const newGenome = genome.clone();
    
    if (Math.random() < removeRate) {
        // Pick a random cell type
        const cellType = ALL_CELL_TYPES[Math.floor(Math.random() * ALL_CELL_TYPES.length)];
        const rules = newGenome.rules[cellType];
        
        if (rules.length > 1) {  // Keep at least one rule
            const removeIdx = Math.floor(Math.random() * rules.length);
            rules.splice(removeIdx, 1);
        }
    }
    
    return newGenome;
}

// Reorder rules (changes priority)
function mutateReorderRules(genome, reorderRate = 0.1) {
    const newGenome = genome.clone();
    
    for (const cellType in newGenome.rules) {
        if (Math.random() < reorderRate) {
            const rules = newGenome.rules[cellType];
            if (rules.length > 1) {
                // Swap two random rules
                const i = Math.floor(Math.random() * rules.length);
                const j = Math.floor(Math.random() * rules.length);
                [rules[i], rules[j]] = [rules[j], rules[i]];
            }
        }
    }
    
    return newGenome;
}

// Apply all mutations
export function mutate(genome, config = {}) {
    const {
        patternRate = 0.1,
        outcomeRate = 0.05,
        addRate = 0.05,
        removeRate = 0.05,
        reorderRate = 0.1
    } = config;
    
    let mutated = genome;
    
    // Apply each mutation type probabilistically
    if (Math.random() < 0.8) mutated = mutatePattern(mutated, patternRate);
    if (Math.random() < 0.3) mutated = mutateOutcome(mutated, outcomeRate);
    if (Math.random() < 0.2) mutated = mutateAddRule(mutated, addRate);
    if (Math.random() < 0.2) mutated = mutateRemoveRule(mutated, removeRate);
    if (Math.random() < 0.3) mutated = mutateReorderRules(mutated, reorderRate);
    
    return mutated;
}

/**
 * Crossover: combine two parent genomes
 */
export function crossover(parent1, parent2) {
    const child = new Genome();
    
    // For each cell type, randomly pick rules from either parent
    for (const cellType of ALL_CELL_TYPES) {
        const rules1 = parent1.rules[cellType];
        const rules2 = parent2.rules[cellType];
        
        // Mix rules from both parents
        const allRules = [...rules1, ...rules2];
        
        // Take a random subset (50-100% of combined rules)
        const numRules = Math.floor(allRules.length * (0.5 + Math.random() * 0.5));
        const selectedIndices = new Set();
        
        while (selectedIndices.size < Math.min(numRules, allRules.length)) {
            selectedIndices.add(Math.floor(Math.random() * allRules.length));
        }
        
        child.rules[cellType] = Array.from(selectedIndices)
            .map(i => allRules[i].clone())
            .sort(() => Math.random() - 0.5);  // Shuffle
    }
    
    return child;
}

/**
 * Evaluate fitness by running tests
 * Returns: { passed: number, failed: number, fitness: number }
 */
export async function evaluateFitness(genome, testRunner) {
    const glsl = genome.toGLSL();
    
    // TODO: Run tests with this GLSL
    // For now, return dummy values
    return {
        passed: 0,
        failed: 0,
        fitness: 0
    };
}

