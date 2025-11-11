import { Genome } from '../lib/genome.js';
import { mutate, crossover } from '../lib/evolution.js';

/**
 * EvolutionEngine - Orchestrates genetic algorithm for shader evolution
 */
export class EvolutionEngine {
    constructor(testManager, simulationEngine, options = {}) {
        this.testManager = testManager;
        this.simulationEngine = simulationEngine;
        
        this.options = {
            populationSize: options.populationSize || 20,
            eliteSize: options.eliteSize || 2,
            mutationRate: options.mutationRate || 0.7,
            crossoverRate: options.crossoverRate || 0.3,
            maxGenerations: options.maxGenerations || 100
        };
        
        this.population = [];
        this.generation = 0;
        this.bestGenome = null;
        this.bestFitness = 0;
        this.bestPassedTests = 0;
        this.isRunning = false;
        this.cancelled = false;
        
        this.generationCallbacks = [];
        this.individualCallbacks = [];
    }
    
    /**
     * Initialize population with random genomes
     */
    #initializePopulation() {
        this.population = [];
        for (let i = 0; i < this.options.populationSize; i++) {
            this.population.push(new Genome());
        }
    }
    
    /**
     * Evaluate fitness of a genome
     */
    async #evaluateFitness(genome) {
        const glsl = genome.toGLSL();
        const tests = this.testManager.getTests();
        
        // Create a temporary engine with this shader
        const tempEngine = new this.simulationEngine.constructor(
            this.simulationEngine.cellTypeDefinition,
            glsl,
            this.simulationEngine.canvas
        );
        
        try {
            const results = tempEngine.runAllTests(tests);
            
            // Fitness = correct transitions + bonus for fully passing tests
            let fitness = results.correctTransitions;
            if (results.total > 0) {
                fitness += results.passed * (results.totalTransitions / results.total);
            }
            
            tempEngine.dispose();
            
            return {
                fitness,
                passed: results.passed,
                failed: results.failed,
                correctTransitions: results.correctTransitions,
                totalTransitions: results.totalTransitions
            };
        } catch (error) {
            tempEngine.dispose();
            return {
                fitness: 0,
                passed: 0,
                failed: tests.length,
                correctTransitions: 0,
                totalTransitions: tests.length * 10 // Estimate
            };
        }
    }
    
    /**
     * Evaluate entire population
     */
    async #evaluatePopulation() {
        const fitnesses = [];
        
        for (let i = 0; i < this.population.length; i++) {
            if (this.cancelled) {
                throw new Error('Evolution cancelled');
            }
            
            const genome = this.population[i];
            const result = await this.#evaluateFitness(genome);
            
            fitnesses.push({
                genome,
                ...result
            });
            
            // Update best if this is better
            if (result.fitness > this.bestFitness) {
                this.bestFitness = result.fitness;
                this.bestGenome = genome;
                this.bestPassedTests = result.passed;
            }
            
            // Notify individual evaluated
            this.#notifyIndividualCallbacks(result);
            
            // Yield to browser every few individuals
            if (i % 3 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        return fitnesses;
    }
    
    /**
     * Select parents using tournament selection
     */
    #selectParent(fitnesses) {
        const tournamentSize = 3;
        let best = fitnesses[Math.floor(Math.random() * fitnesses.length)];
        
        for (let i = 1; i < tournamentSize; i++) {
            const candidate = fitnesses[Math.floor(Math.random() * fitnesses.length)];
            if (candidate.fitness > best.fitness) {
                best = candidate;
            }
        }
        
        return best.genome;
    }
    
    /**
     * Create next generation
     */
    #createNextGeneration(fitnesses) {
        // Sort by fitness
        fitnesses.sort((a, b) => b.fitness - a.fitness);
        
        const newPopulation = [];
        
        // Keep elite
        for (let i = 0; i < this.options.eliteSize; i++) {
            newPopulation.push(fitnesses[i].genome);
        }
        
        // Create offspring
        while (newPopulation.length < this.options.populationSize) {
            if (Math.random() < this.options.crossoverRate) {
                // Crossover
                const parent1 = this.#selectParent(fitnesses);
                const parent2 = this.#selectParent(fitnesses);
                const offspring = crossover(parent1, parent2);
                newPopulation.push(offspring);
            } else {
                // Mutation
                const parent = this.#selectParent(fitnesses);
                const offspring = mutate(parent);
                newPopulation.push(offspring);
            }
        }
        
        this.population = newPopulation;
    }
    
    /**
     * Run evolution
     */
    async start() {
        this.isRunning = true;
        this.cancelled = false;
        this.generation = 0;
        this.bestFitness = 0;
        this.bestGenome = null;
        this.bestPassedTests = 0;
        
        try {
            // Initialize population
            this.#initializePopulation();
            
            // Evolution loop
            for (let gen = 0; gen < this.options.maxGenerations; gen++) {
                if (this.cancelled) {
                    break;
                }
                
                this.generation = gen + 1;
                
                // Evaluate population
                const fitnesses = await this.#evaluatePopulation();
                
                // Calculate average fitness
                const avgFitness = fitnesses.reduce((sum, f) => sum + f.fitness, 0) / fitnesses.length;
                
                // Notify generation complete
                this.#notifyGenerationCallbacks({
                    generation: this.generation,
                    bestFitness: this.bestFitness,
                    avgFitness,
                    bestGenome: this.bestGenome,
                    bestPassedTests: this.bestPassedTests
                });
                
                // Create next generation (unless this is the last)
                if (gen < this.options.maxGenerations - 1) {
                    this.#createNextGeneration(fitnesses);
                }
                
                // Yield to browser between generations
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
        } catch (error) {
            if (error.message !== 'Evolution cancelled') {
                console.error('Evolution error:', error);
                throw error;
            }
        } finally {
            this.isRunning = false;
        }
        
        return this.bestGenome;
    }
    
    /**
     * Stop evolution
     */
    stop() {
        this.cancelled = true;
    }
    
    /**
     * Get best genome
     */
    getBestGenome() {
        return this.bestGenome;
    }
    
    /**
     * Get best shader
     */
    getBestShader() {
        return this.bestGenome ? this.bestGenome.toGLSL() : null;
    }
    
    /**
     * Register callback for generation complete
     */
    onGenerationComplete(callback) {
        this.generationCallbacks.push(callback);
        return () => {
            const index = this.generationCallbacks.indexOf(callback);
            if (index > -1) {
                this.generationCallbacks.splice(index, 1);
            }
        };
    }
    
    /**
     * Register callback for individual evaluated
     */
    onIndividualEvaluated(callback) {
        this.individualCallbacks.push(callback);
        return () => {
            const index = this.individualCallbacks.indexOf(callback);
            if (index > -1) {
                this.individualCallbacks.splice(index, 1);
            }
        };
    }
    
    /**
     * Notify generation callbacks
     */
    #notifyGenerationCallbacks(data) {
        for (const callback of this.generationCallbacks) {
            callback(data);
        }
    }
    
    /**
     * Notify individual callbacks
     */
    #notifyIndividualCallbacks(data) {
        for (const callback of this.individualCallbacks) {
            callback(data);
        }
    }
    
    /**
     * Update options
     */
    updateOptions(options) {
        Object.assign(this.options, options);
    }
}

