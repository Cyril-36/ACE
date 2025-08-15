"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummarizationService = void 0;
class SummarizationService {
    constructor() {
        this.TEXTRANK_DAMPING = 0.85;
        this.TEXTRANK_ITERATIONS = 100;
        this.TEXTRANK_THRESHOLD = 0.0001;
    }
    async summarizeContexts(contexts) {
        if (contexts.length === 0) {
            throw new Error('No contexts provided for summarization');
        }
        const startTime = Date.now();
        // Combine all context content
        const combinedContent = contexts.map(c => c.content).join('\n\n');
        const originalTokens = this.estimateTokenCount(combinedContent);
        // Perform summarization using TextRank
        const summary = await this.textRankSummarization(combinedContent);
        const summaryTokens = this.estimateTokenCount(summary);
        const processingTime = Date.now() - startTime;
        const compressionRatio = summaryTokens / originalTokens;
        // Calculate quality metrics
        const quality = this.calculateQuality(combinedContent, summary);
        // Extract metadata from contexts
        const metadata = this.extractMetadata(contexts, originalTokens, summaryTokens, processingTime);
        return {
            id: this.generateSummaryId(),
            contextIds: contexts.map(c => c.id),
            content: summary,
            timestamp: new Date(),
            algorithm: 'textrank',
            quality,
            compressionRatio,
            metadata
        };
    }
    async summarizeText(text) {
        return await this.textRankSummarization(text);
    }
    async textRankSummarization(text) {
        // Split text into sentences
        const sentences = this.splitIntoSentences(text);
        if (sentences.length <= 3) {
            return text; // Too short to summarize
        }
        // Calculate sentence similarities
        const similarityMatrix = this.calculateSimilarityMatrix(sentences);
        // Apply TextRank algorithm
        const scores = this.textRank(similarityMatrix);
        // Select top sentences (aim for 30% of original)
        const summaryLength = Math.max(2, Math.floor(sentences.length * 0.3));
        const topSentences = this.selectTopSentences(sentences, scores, summaryLength);
        return topSentences.join(' ');
    }
    splitIntoSentences(text) {
        // Simple sentence splitting (can be improved with more sophisticated NLP)
        return text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 10); // Filter out very short sentences
    }
    calculateSimilarityMatrix(sentences) {
        const matrix = [];
        for (let i = 0; i < sentences.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < sentences.length; j++) {
                if (i === j) {
                    matrix[i][j] = 0;
                }
                else {
                    matrix[i][j] = this.calculateSentenceSimilarity(sentences[i], sentences[j]);
                }
            }
        }
        return matrix;
    }
    calculateSentenceSimilarity(sentence1, sentence2) {
        const words1 = this.tokenize(sentence1.toLowerCase());
        const words2 = this.tokenize(sentence2.toLowerCase());
        // Jaccard similarity
        const intersection = words1.filter(word => words2.includes(word));
        const unionSet = new Set([...words1, ...words2]);
        const union = Array.from(unionSet);
        return intersection.length / union.length;
    }
    tokenize(text) {
        return text
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2)
            .filter(word => !this.isStopWord(word));
    }
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
            'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
            'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
        ]);
        return stopWords.has(word.toLowerCase());
    }
    textRank(similarityMatrix) {
        const n = similarityMatrix.length;
        let scores = new Array(n).fill(1.0);
        for (let iteration = 0; iteration < this.TEXTRANK_ITERATIONS; iteration++) {
            const newScores = new Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (i !== j && similarityMatrix[i][j] > 0) {
                        const linkSum = similarityMatrix[j].reduce((sum, val) => sum + val, 0);
                        if (linkSum > 0) {
                            newScores[i] += (similarityMatrix[i][j] / linkSum) * scores[j];
                        }
                    }
                }
                newScores[i] = (1 - this.TEXTRANK_DAMPING) + this.TEXTRANK_DAMPING * newScores[i];
            }
            // Check for convergence
            const diff = scores.reduce((sum, score, i) => sum + Math.abs(score - newScores[i]), 0);
            scores = newScores;
            if (diff < this.TEXTRANK_THRESHOLD) {
                break;
            }
        }
        return scores;
    }
    selectTopSentences(sentences, scores, count) {
        const sentenceScores = sentences.map((sentence, index) => ({
            sentence,
            score: scores[index],
            index
        }));
        // Sort by score (descending) and select top sentences
        const topSentences = sentenceScores
            .sort((a, b) => b.score - a.score)
            .slice(0, count)
            .sort((a, b) => a.index - b.index) // Restore original order
            .map(item => item.sentence);
        return topSentences;
    }
    calculateQuality(originalText, summary) {
        // Simple quality metrics (can be improved with more sophisticated analysis)
        const originalWords = this.tokenize(originalText);
        const summaryWords = this.tokenize(summary);
        // Relevance: how many important words from original are in summary
        const importantWords = this.extractKeywords(originalText, 20);
        const relevantWords = summaryWords.filter(word => importantWords.includes(word));
        const relevance = relevantWords.length / Math.min(importantWords.length, 20);
        // Completeness: coverage of main topics
        const completeness = Math.min(1.0, summaryWords.length / (originalWords.length * 0.3));
        // Coherence: simple readability measure
        const coherence = this.calculateCoherence(summary);
        const overall = (relevance + completeness + coherence) / 3;
        return {
            coherence,
            relevance,
            completeness,
            overall
        };
    }
    extractKeywords(text, count) {
        const words = this.tokenize(text);
        const wordFreq = {};
        // Count word frequencies
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
        // Sort by frequency and return top keywords
        return Object.entries(wordFreq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, count)
            .map(([word]) => word);
    }
    calculateCoherence(text) {
        const sentences = this.splitIntoSentences(text);
        if (sentences.length <= 1)
            return 1.0;
        let coherenceSum = 0;
        for (let i = 1; i < sentences.length; i++) {
            coherenceSum += this.calculateSentenceSimilarity(sentences[i - 1], sentences[i]);
        }
        return coherenceSum / (sentences.length - 1);
    }
    extractMetadata(contexts, originalTokens, summaryTokens, processingTime) {
        // Extract common metadata from contexts
        const languageSet = new Set(contexts.map(c => c.metadata.language).filter(Boolean));
        const languages = Array.from(languageSet);
        const workspaceSet = new Set(contexts.map(c => c.metadata.workspaceName).filter(Boolean));
        const workspaces = Array.from(workspaceSet);
        return {
            originalTokens,
            summaryTokens,
            processingTime,
            workspaceName: workspaces.length === 1 ? workspaces[0] : undefined,
            language: languages.length === 1 ? languages[0] : undefined
        };
    }
    estimateTokenCount(text) {
        // Simple token estimation (roughly 4 characters per token)
        return Math.ceil(text.length / 4);
    }
    generateSummaryId() {
        return `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.SummarizationService = SummarizationService;
//# sourceMappingURL=summarization.js.map