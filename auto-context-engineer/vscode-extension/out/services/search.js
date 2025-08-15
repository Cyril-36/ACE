"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
class SearchService {
    constructor(storageService) {
        this.storageService = storageService;
        this.searchIndex = new Map();
        this.isIndexBuilt = false;
    }
    async search(query) {
        if (!this.isIndexBuilt) {
            await this.buildSearchIndex();
        }
        const searchQuery = {
            query: query.toLowerCase(),
            sort: 'relevance',
            limit: 50
        };
        const results = [];
        // Search contexts
        const contexts = await this.storageService.getContexts();
        const contextResults = this.searchInContexts(contexts, searchQuery);
        results.push(...contextResults);
        // Search summaries
        const summaries = await this.storageService.getSummaries();
        const summaryResults = this.searchInSummaries(summaries, searchQuery);
        results.push(...summaryResults);
        // Sort and limit results
        return this.sortAndLimitResults(results, searchQuery);
    }
    async buildSearchIndex() {
        console.log('Building search index...');
        try {
            this.searchIndex.clear();
            // Index contexts
            const contexts = await this.storageService.getContexts();
            contexts.forEach(context => {
                this.indexContent(context.id, context.content);
                this.indexContent(context.id, context.metadata.fileName || '');
                context.metadata.tags.forEach(tag => {
                    this.indexContent(context.id, tag);
                });
            });
            // Index summaries
            const summaries = await this.storageService.getSummaries();
            summaries.forEach(summary => {
                this.indexContent(summary.id, summary.content);
            });
            this.isIndexBuilt = true;
            console.log('Search index built successfully');
        }
        catch (error) {
            console.error('Failed to build search index:', error);
        }
    }
    async rebuildIndex() {
        this.isIndexBuilt = false;
        await this.buildSearchIndex();
    }
    searchInContexts(contexts, query) {
        const results = [];
        const queryTerms = this.tokenize(query.query);
        contexts.forEach(context => {
            const score = this.calculateRelevanceScore(context.content, queryTerms);
            if (score > 0) {
                const snippet = this.generateSnippet(context.content, queryTerms);
                const highlightedTerms = this.findHighlightedTerms(context.content, queryTerms);
                results.push({
                    id: context.id,
                    type: 'context',
                    title: context.metadata.fileName || 'Untitled Context',
                    snippet,
                    content: context.content,
                    score,
                    timestamp: context.timestamp,
                    metadata: context.metadata,
                    highlightedTerms
                });
            }
        });
        return results;
    }
    searchInSummaries(summaries, query) {
        const results = [];
        const queryTerms = this.tokenize(query.query);
        summaries.forEach(summary => {
            const score = this.calculateRelevanceScore(summary.content, queryTerms);
            if (score > 0) {
                const snippet = this.generateSnippet(summary.content, queryTerms);
                const highlightedTerms = this.findHighlightedTerms(summary.content, queryTerms);
                results.push({
                    id: summary.id,
                    type: 'summary',
                    title: `Summary (${summary.contextIds.length} contexts)`,
                    snippet,
                    content: summary.content,
                    score,
                    timestamp: summary.timestamp,
                    metadata: summary.metadata,
                    highlightedTerms
                });
            }
        });
        return results;
    }
    calculateRelevanceScore(content, queryTerms) {
        const contentTokens = this.tokenize(content.toLowerCase());
        const contentSet = new Set(contentTokens);
        let score = 0;
        let totalMatches = 0;
        queryTerms.forEach(term => {
            if (contentSet.has(term)) {
                // Count occurrences of the term
                const occurrences = contentTokens.filter(token => token === term).length;
                score += occurrences;
                totalMatches++;
            }
        });
        if (totalMatches === 0) {
            return 0;
        }
        // Normalize score by content length and query coverage
        const lengthNormalization = Math.log(contentTokens.length + 1);
        const queryCoverage = totalMatches / queryTerms.length;
        return (score / lengthNormalization) * queryCoverage;
    }
    generateSnippet(content, queryTerms, maxLength = 200) {
        const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
        // Find the sentence with the most query term matches
        let bestSentence = '';
        let maxMatches = 0;
        sentences.forEach(sentence => {
            const sentenceTokens = this.tokenize(sentence.toLowerCase());
            const matches = queryTerms.filter(term => sentenceTokens.includes(term)).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                bestSentence = sentence;
            }
        });
        // Truncate if too long
        if (bestSentence.length > maxLength) {
            bestSentence = bestSentence.substring(0, maxLength - 3) + '...';
        }
        return bestSentence || content.substring(0, maxLength);
    }
    findHighlightedTerms(content, queryTerms) {
        const contentTokens = this.tokenize(content.toLowerCase());
        return queryTerms.filter(term => contentTokens.includes(term));
    }
    sortAndLimitResults(results, query) {
        // Sort by relevance score (descending)
        results.sort((a, b) => {
            if (query.sort === 'date') {
                return b.timestamp.getTime() - a.timestamp.getTime();
            }
            return b.score - a.score;
        });
        // Apply limit
        if (query.limit) {
            results.splice(query.limit);
        }
        return results;
    }
    indexContent(id, content) {
        const tokens = this.tokenize(content.toLowerCase());
        tokens.forEach(token => {
            if (!this.searchIndex.has(token)) {
                this.searchIndex.set(token, new Set());
            }
            this.searchIndex.get(token).add(id);
        });
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
    // Advanced search methods
    async searchByWorkspace(workspaceName) {
        const contexts = await this.storageService.getContexts();
        const filteredContexts = contexts.filter(c => c.metadata.workspaceName === workspaceName);
        return this.searchInContexts(filteredContexts, { query: '', sort: 'date' });
    }
    async searchByLanguage(language) {
        const contexts = await this.storageService.getContexts();
        const filteredContexts = contexts.filter(c => c.metadata.language === language);
        return this.searchInContexts(filteredContexts, { query: '', sort: 'date' });
    }
    async searchByTags(tags) {
        const contexts = await this.storageService.getContexts();
        const filteredContexts = contexts.filter(c => tags.some(tag => c.metadata.tags.includes(tag)));
        return this.searchInContexts(filteredContexts, { query: '', sort: 'date' });
    }
    async searchByDateRange(startDate, endDate) {
        const contexts = await this.storageService.getContexts();
        const filteredContexts = contexts.filter(c => c.timestamp >= startDate && c.timestamp <= endDate);
        const summaries = await this.storageService.getSummaries();
        const filteredSummaries = summaries.filter(s => s.timestamp >= startDate && s.timestamp <= endDate);
        const results = [];
        results.push(...this.searchInContexts(filteredContexts, { query: '', sort: 'date' }));
        results.push(...this.searchInSummaries(filteredSummaries, { query: '', sort: 'date' }));
        return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    // Get search suggestions
    async getSearchSuggestions(partialQuery) {
        if (!this.isIndexBuilt) {
            await this.buildSearchIndex();
        }
        const suggestions = [];
        const lowerQuery = partialQuery.toLowerCase();
        // Find matching terms in the index
        this.searchIndex.forEach((_, term) => {
            if (term.startsWith(lowerQuery) && term !== lowerQuery) {
                suggestions.push(term);
            }
        });
        // Sort by frequency (terms that appear in more documents first)
        suggestions.sort((a, b) => {
            const aCount = this.searchIndex.get(a)?.size || 0;
            const bCount = this.searchIndex.get(b)?.size || 0;
            return bCount - aCount;
        });
        return suggestions.slice(0, 10); // Return top 10 suggestions
    }
}
exports.SearchService = SearchService;
//# sourceMappingURL=search.js.map