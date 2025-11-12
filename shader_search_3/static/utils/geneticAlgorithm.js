/**
 * Genetic Algorithm for evolving cellular automata rule sets
 * 
 * This module implements:
 * - Population management
 * - Rule set mutation
 * - Crossover (breeding)
 * - Fitness evaluation
 * - Selection and evolution
 */

/**
 * Deep clone a rule set
 */
function cloneRuleSet(ruleSet) {
  const cloned = {}
  for (const [cellType, rules] of Object.entries(ruleSet)) {
    cloned[cellType] = rules.map(rule => ({
      pattern: [...rule.pattern],
      becomes: rule.becomes
    }))
  }
  return cloned
}

/**
 * Mutate a rule set
 * @param {Object} ruleSet - The rule set to mutate
 * @param {number} mutationRate - Probability of mutation (0-1)
 * @param {Array<string>} availableCellTypes - List of available cell type names
 * @returns {Object} - A new mutated rule set
 */
export function mutateRuleSet(ruleSet, mutationRate = 0.1, availableCellTypes = ['EMPTY', 'SAND', 'WATER', 'STONE']) {
  const mutated = cloneRuleSet(ruleSet)
  
  for (const cellType of availableCellTypes) {
    if (!mutated[cellType]) {
      mutated[cellType] = []
    }
    
    const rules = mutated[cellType]
    
    // Mutate existing rules
    for (let i = 0; i < rules.length; i++) {
      if (Math.random() < mutationRate) {
        const rule = rules[i]
        
        // Random mutation type
        const mutationType = Math.random()
        
        if (mutationType < 0.3) {
          // Mutate pattern: change a random position to a random cell type or wildcard
          const patternIdx = Math.floor(Math.random() * 9)
          if (Math.random() < 0.5) {
            rule.pattern[patternIdx] = '*'
          } else {
            rule.pattern[patternIdx] = availableCellTypes[Math.floor(Math.random() * availableCellTypes.length)]
          }
        } else if (mutationType < 0.6) {
          // Mutate becomes: change what the cell becomes
          rule.becomes = availableCellTypes[Math.floor(Math.random() * availableCellTypes.length)]
        } else if (mutationType < 0.8) {
          // Mutate center cell (index 4) to match the cell type key
          rule.pattern[4] = cellType
        } else {
          // Remove this rule
          rules.splice(i, 1)
          i--
        }
      }
    }
    
    // Add new random rule with some probability
    if (Math.random() < mutationRate * 0.5) {
      const pattern = Array(9).fill('*')
      pattern[4] = cellType // Center must match current cell type
      
      // Randomly set some neighbors
      for (let i = 0; i < 9; i++) {
        if (i !== 4 && Math.random() < 0.3) {
          pattern[i] = availableCellTypes[Math.floor(Math.random() * availableCellTypes.length)]
        }
      }
      
      rules.push({
        pattern: pattern,
        becomes: availableCellTypes[Math.floor(Math.random() * availableCellTypes.length)]
      })
    }
  }
  
  return mutated
}

/**
 * Crossover two rule sets to create offspring
 * @param {Object} parent1 - First parent rule set
 * @param {Object} parent2 - Second parent rule set
 * @param {Array<string>} availableCellTypes - List of available cell type names
 * @returns {Object} - A new rule set combining traits from both parents
 */
export function crossoverRuleSets(parent1, parent2, availableCellTypes = ['EMPTY', 'SAND', 'WATER', 'STONE']) {
  const offspring = {}
  
  for (const cellType of availableCellTypes) {
    const rules1 = parent1[cellType] || []
    const rules2 = parent2[cellType] || []
    
    // Combine rules from both parents
    const combinedRules = []
    
    // Take some rules from parent1
    for (const rule of rules1) {
      if (Math.random() < 0.5) {
        combinedRules.push({
          pattern: [...rule.pattern],
          becomes: rule.becomes
        })
      }
    }
    
    // Take some rules from parent2
    for (const rule of rules2) {
      if (Math.random() < 0.5) {
        combinedRules.push({
          pattern: [...rule.pattern],
          becomes: rule.becomes
        })
      }
    }
    
    // If no rules were selected, take at least one from each parent
    if (combinedRules.length === 0) {
      if (rules1.length > 0) {
        const rule = rules1[0]
        combinedRules.push({
          pattern: [...rule.pattern],
          becomes: rule.becomes
        })
      }
      if (rules2.length > 0) {
        const rule = rules2[0]
        combinedRules.push({
          pattern: [...rule.pattern],
          becomes: rule.becomes
        })
      }
    }
    
    offspring[cellType] = combinedRules
  }
  
  return offspring
}

/**
 * Select parents using tournament selection
 * @param {Array} population - Array of { ruleSet, fitness } objects
 * @param {number} tournamentSize - Number of individuals to compete in each tournament
 * @returns {Object} - Selected parent rule set
 */
export function tournamentSelect(population, tournamentSize = 3) {
  const tournament = []
  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length)
    tournament.push(population[idx])
  }
  
  // Return the best individual from the tournament
  tournament.sort((a, b) => (b.fitness || 0) - (a.fitness || 0))
  return tournament[0].ruleSet
}

/**
 * Genetic Algorithm class
 */
export class GeneticAlgorithm {
  constructor(options = {}) {
    this.populationSize = options.populationSize || 20
    this.mutationRate = options.mutationRate || 0.1
    this.crossoverRate = options.crossoverRate || 0.7
    this.elitismCount = options.elitismCount || 2 // Keep best N individuals
    this.tournamentSize = options.tournamentSize || 3
    
    this.population = []
    this.generation = 0
    this.bestFitness = 0
    this.bestIndividual = null
    this.fitnessHistory = []
    this.timingStats = null // Aggregated timing statistics
    
    this.availableCellTypes = options.availableCellTypes || ['EMPTY', 'SAND', 'WATER', 'STONE']
  }
  
  /**
   * Initialize population from a seed rule set
   * @param {Object} seedRuleSet - Starting rule set to base population on
   */
  initialize(seedRuleSet) {
    this.population = []
    
    // First individual is the seed (unchanged)
    this.population.push({
      ruleSet: cloneRuleSet(seedRuleSet),
      fitness: null
    })
    
    // Rest are mutations of the seed
    for (let i = 1; i < this.populationSize; i++) {
      this.population.push({
        ruleSet: mutateRuleSet(seedRuleSet, this.mutationRate * 2, this.availableCellTypes),
        fitness: null
      })
    }
    
    this.generation = 0
  }
  
  /**
   * Evaluate fitness for all individuals in the population
   * @param {Function} fitnessFunction - Async function that takes a ruleSet and returns { fitness, timings }
   */
  async evaluateFitness(fitnessFunction) {
    const allTimings = []
    const evaluations = await Promise.all(
      this.population.map(async (individual) => {
        if (individual.fitness === null) {
          const result = await fitnessFunction(individual.ruleSet)
          // Handle both old format (number) and new format (object with fitness and timings)
          if (typeof result === 'object' && result !== null && 'fitness' in result) {
            individual.fitness = result.fitness
            if (result.timings) {
              allTimings.push(result.timings)
            }
          } else {
            individual.fitness = result
          }
        }
        return individual
      })
    )
    
    // Calculate aggregated timing statistics
    if (allTimings.length > 0) {
      const timingKeys = Object.keys(allTimings[0])
      this.timingStats = {}
      for (const key of timingKeys) {
        const values = allTimings.map(t => t[key] || 0)
        this.timingStats[key] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          total: values.reduce((sum, v) => sum + v, 0)
        }
      }
    }
    
    // Sort by fitness (descending)
    this.population = evaluations.sort((a, b) => (b.fitness || 0) - (a.fitness || 0))
    
    // Update best
    if (this.population[0].fitness > this.bestFitness) {
      this.bestFitness = this.population[0].fitness
      this.bestIndividual = cloneRuleSet(this.population[0].ruleSet)
    }
    
    // Track fitness history
    this.fitnessHistory.push({
      generation: this.generation,
      best: this.population[0].fitness,
      average: this.population.reduce((sum, ind) => sum + (ind.fitness || 0), 0) / this.population.length,
      worst: this.population[this.population.length - 1].fitness
    })
  }
  
  /**
   * Create next generation
   */
  evolve() {
    const newPopulation = []
    
    // Elitism: keep best individuals
    for (let i = 0; i < this.elitismCount && i < this.population.length; i++) {
      newPopulation.push({
        ruleSet: cloneRuleSet(this.population[i].ruleSet),
        fitness: this.population[i].fitness
      })
    }
    
    // Fill rest of population with crossover and mutation
    while (newPopulation.length < this.populationSize) {
      let offspring
      
      if (Math.random() < this.crossoverRate && this.population.length >= 2) {
        // Crossover
        const parent1 = tournamentSelect(this.population, this.tournamentSize)
        const parent2 = tournamentSelect(this.population, this.tournamentSize)
        offspring = crossoverRuleSets(parent1, parent2, this.availableCellTypes)
      } else {
        // Clone and mutate
        const parent = tournamentSelect(this.population, this.tournamentSize)
        offspring = cloneRuleSet(parent)
      }
      
      // Mutate offspring
      offspring = mutateRuleSet(offspring, this.mutationRate, this.availableCellTypes)
      
      newPopulation.push({
        ruleSet: offspring,
        fitness: null // Will be evaluated next
      })
    }
    
    this.population = newPopulation
    this.generation++
  }
  
  /**
   * Get statistics about current population
   */
  getStats() {
    const fitnesses = this.population.map(ind => ind.fitness || 0)
    return {
      generation: this.generation,
      bestFitness: Math.max(...fitnesses),
      averageFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      worstFitness: Math.min(...fitnesses),
      bestOverallFitness: this.bestFitness,
      fitnessHistory: this.fitnessHistory,
      timingStats: this.timingStats
    }
  }
  
  /**
   * Get the best rule set found so far
   */
  getBestRuleSet() {
    return this.bestIndividual ? cloneRuleSet(this.bestIndividual) : null
  }
}

