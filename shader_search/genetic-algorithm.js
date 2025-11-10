/**
 * Genetic Algorithm for evolving cellular automata GLSL shaders
 */

import { createSeedGenome } from './genome.js';
import { mutate, crossover } from './evolution.js';
import { TestRunner } from './test-runner.js';

export class GeneticAlgorithm {
    constructor(config = {}) {
        this.populationSize = config.populationSize || 20;
        this.eliteSize = config.eliteSize || 2;
        this.mutationRate = config.mutationRate || 0.7;
        this.crossoverRate = config.crossoverRate || 0.3;
        this.maxGenerations = config.maxGenerations || 100;
        
        this.population = [];
        this.generation = 0;
        this.bestGenome = null;
        this.bestFitness = -Infinity;
        this.bestPassedTests = 0; // Track passed tests for best individual
        this.testRunner = null;
        this.cancelled = false;
        
        // Callbacks for UI updates
        this.onGenerationComplete = null;
        this.onIndividualEvaluated = null;
    }
    
    stop() {
        this.cancelled = true;
    }
    
    async initialize() {
        // Use the global test runner instance that was initialized by test-runner.js
        // This runner already has all tests loaded
        this.testRunner = window.testRunnerInstance;
        
        if (!this.testRunner || !this.testRunner.tests || this.testRunner.tests.length === 0) {
            throw new Error('Test runner not found or no tests loaded. Make sure test-runner.js has loaded.');
        }
        
        console.log(`Test runner ready with ${this.testRunner.tests.length} tests`);
        
        // Create initial population
        console.log('Creating initial population...');
        this.population = [];
        for (let i = 0; i < this.populationSize; i++) {
            const genome = createSeedGenome();
            // Apply some random mutations to diversify initial population
            const mutated = i === 0 ? genome : mutate(genome);
            this.population.push({
                genome: mutated,
                fitness: null
            });
        }
        
        console.log(`Population initialized with ${this.populationSize} individuals`);
    }
    
    async evaluateFitness(individual) {
        const glsl = individual.genome.toGLSL();
        
        // Run tests in fast mode
        const results = await this.testRunner.runAllWithGLSL(glsl);
        
        // Calculate fitness with partial credit
        // - 1 point for each correct state transition
        // - Bonus points (equal to test's transition count) for passing entire test
        let fitness = results.correctTransitions;
        
        // Add bonus for complete test passes
        // Each passed test gets bonus points equal to its frame count
        // This encourages completing tests while still rewarding partial progress
        fitness += results.passed * (results.totalTransitions / results.total);
        
        individual.fitness = fitness;
        
        // Update best
        if (fitness > this.bestFitness) {
            this.bestFitness = fitness;
            this.bestGenome = individual.genome.clone();
            this.bestPassedTests = results.passed;
            const percentage = ((results.correctTransitions / results.totalTransitions) * 100).toFixed(1);
            console.log(`🎉 New best! Generation ${this.generation}, Fitness: ${fitness.toFixed(1)} (${results.passed}/${results.total} tests, ${percentage}% transitions)`);
        }
        
        return { 
            fitness, 
            passed: results.passed, 
            total: results.total,
            correctTransitions: results.correctTransitions,
            totalTransitions: results.totalTransitions
        };
    }
    
    async evaluatePopulation() {
        console.log(`Evaluating generation ${this.generation}...`);
        
        for (let i = 0; i < this.population.length; i++) {
            // Check for cancellation
            if (this.cancelled) {
                throw new Error('Evolution cancelled by user');
            }
            
            const individual = this.population[i];
            const result = await this.evaluateFitness(individual);
            
            if (this.onIndividualEvaluated) {
                this.onIndividualEvaluated({
                    generation: this.generation,
                    index: i,
                    total: this.population.length,
                    fitness: result.fitness,
                    passed: result.passed,
                    testTotal: result.total
                });
            }
            
            // Yield to browser every individual to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Sort by fitness (descending)
        this.population.sort((a, b) => b.fitness - a.fitness);
    }
    
    selectParents() {
        // Tournament selection
        const tournamentSize = 3;
        const parent1Idx = this.tournament(tournamentSize);
        const parent2Idx = this.tournament(tournamentSize);
        
        return [
            this.population[parent1Idx],
            this.population[parent2Idx]
        ];
    }
    
    tournament(size) {
        let best = Math.floor(Math.random() * this.population.length);
        let bestFitness = this.population[best].fitness;
        
        for (let i = 1; i < size; i++) {
            const idx = Math.floor(Math.random() * this.population.length);
            const fitness = this.population[idx].fitness;
            if (fitness > bestFitness) {
                best = idx;
                bestFitness = fitness;
            }
        }
        
        return best;
    }
    
    createNextGeneration() {
        const nextGen = [];
        
        // Elitism: keep best individuals
        for (let i = 0; i < this.eliteSize; i++) {
            nextGen.push({
                genome: this.population[i].genome.clone(),
                fitness: null  // Will re-evaluate
            });
        }
        
        // Fill rest with offspring
        while (nextGen.length < this.populationSize) {
            const [parent1, parent2] = this.selectParents();
            
            let child;
            if (Math.random() < this.crossoverRate) {
                // Crossover
                child = crossover(parent1.genome, parent2.genome);
            } else {
                // Clone one parent
                child = Math.random() < 0.5 ? parent1.genome.clone() : parent2.genome.clone();
            }
            
            // Mutate
            if (Math.random() < this.mutationRate) {
                child = mutate(child);
            }
            
            nextGen.push({
                genome: child,
                fitness: null
            });
        }
        
        this.population = nextGen;
        this.generation++;
    }
    
    async run() {
        this.cancelled = false; // Reset cancellation flag
        await this.initialize();
        
        for (let gen = 0; gen < this.maxGenerations; gen++) {
            await this.evaluatePopulation();
            
            // Check for perfect solution
            if (this.bestFitness === this.testRunner.tests.length) {
                console.log(`🏆 Perfect solution found in generation ${this.generation}!`);
                break;
            }
            
            if (this.onGenerationComplete) {
                this.onGenerationComplete({
                    generation: this.generation,
                    bestFitness: this.bestFitness,
                    bestPassedTests: this.bestPassedTests,
                    avgFitness: this.population.reduce((sum, ind) => sum + ind.fitness, 0) / this.population.length,
                    population: this.population.map(ind => ind.fitness)
                });
            }
            
            this.createNextGeneration();
            
            // Yield to browser between generations to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        console.log(`\n=== Evolution Complete ===`);
        console.log(`Best fitness: ${this.bestFitness}/${this.testRunner.tests.length}`);
        console.log(`Final generation: ${this.generation}`);
        
        return {
            bestGenome: this.bestGenome,
            bestFitness: this.bestFitness,
            generation: this.generation
        };
    }
}

