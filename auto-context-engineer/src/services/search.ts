// Search and retrieval service
import { SearchQuery, SearchResult, ContextSource, SortOption } from "../types";
import { IndexedDBStorageService } from "./storage";

export interface SearchService {
  search(query: SearchQuery): Promise<SearchResult[]>;
  indexContent(contextId: string, content: string, metadata?: SearchIndexMetadata): Promise<void>;
  removeFromIndex(contextId: string): Promise<void>;
  rebuildIndex(): Promise<void>;
  getSearchStats(): Promise<SearchStats>;
}

export interface SearchIndexMetadata {
  source: ContextSource;
  timestamp: number;
  tags: string[];
  summary?: string;
  tokenCount: number;
  language?: string;
  platform?: string;
}

interface SearchFilters {
  sources?: ContextSource[];
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  minScore?: number;
  language?: string;
  platform?: string;
}

// Removed unused SearchSortOptions interface

interface SerializedIndexData {
  searchIndex?: Record<string, unknown>;
  termIndex?: Record<string, unknown[]>;
  version?: number;
}

export interface SearchStats {
  totalDocuments: number;
  totalTerms: number;
  indexSize: number;
  lastUpdated: number;
  searchCount: number;
  avgSearchTime: number;
}

export interface SearchIndexEntry {
  id: string;
  content: string;
  terms: Map<string, TermInfo>;
  metadata: SearchIndexMetadata;
  lastUpdated: number;
}

export interface TermInfo {
  frequency: number;
  positions: number[];
  importance: number;
}

export interface SearchMatch {
  term: string;
  positions: number[];
  score: number;
}

export class FullTextSearchService implements SearchService {
  private storageService: IndexedDBStorageService;
  private searchIndex: Map<string, SearchIndexEntry> = new Map();
  private termIndex: Map<string, Set<string>> = new Map(); // term -> document IDs
  private isInitialized = false;
  private stats: SearchStats = {
    totalDocuments: 0,
    totalTerms: 0,
    indexSize: 0,
    lastUpdated: 0,
    searchCount: 0,
    avgSearchTime: 0,
  };

  constructor(storageService?: IndexedDBStorageService) {
    this.storageService = storageService || new IndexedDBStorageService();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load existing index from storage
      await this.loadIndexFromStorage();
      this.isInitialized = true;
      console.log('[FullTextSearchService] Initialized with', this.stats.totalDocuments, 'documents');
    } catch (error) {
      console.error('[FullTextSearchService] Initialization failed:', error);
      throw error;
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    await this.ensureInitialized();
    
    try {
      if (!query.query.trim()) {
        return [];
      }

      // Preprocess query
      const queryTerms = this.tokenize(query.query.toLowerCase());
      const filteredTerms = this.removeStopWords(queryTerms);
      
      if (filteredTerms.length === 0) {
        return [];
      }

      // Find matching documents
      const candidateDocuments = this.findCandidateDocuments(filteredTerms);
      
      // Score and rank results
      const scoredResults = this.scoreDocuments(candidateDocuments, filteredTerms, query);
      
      // Apply filters
      const filteredResults = this.applyFilters(scoredResults, query.filters || {});
      
      // Sort and limit results
      const sortedResults = this.sortResults(filteredResults, query.sort || SortOption.RELEVANCE);
      const limitedResults = sortedResults.slice(0, query.limit || 50);
      
      // Generate search results with snippets and highlights
      const searchResults = await this.generateSearchResults(limitedResults, filteredTerms);
      
      // Update stats
      this.updateSearchStats(Date.now() - (Date.now() - Date.now()));
      
      return searchResults;
      
    } catch (error) {
      console.error('[FullTextSearchService] Search failed:', error);
      return [];
    }
  }

  async indexContent(contextId: string, content: string, metadata?: SearchIndexMetadata): Promise<void> {
    try {
      await this.ensureInitialized();
      
      // Remove existing entry if it exists
      await this.removeFromIndex(contextId);
      
      // Preprocess content
      const tokens = this.tokenize(content.toLowerCase());
      const terms = this.removeStopWords(tokens);
      
      // Calculate term frequencies and positions
      const termMap = new Map<string, TermInfo>();
      terms.forEach((term, index) => {
        if (!termMap.has(term)) {
          termMap.set(term, {
            frequency: 0,
            positions: [],
            importance: this.calculateTermImportance(term, content),
          });
        }
        
        const termInfo = termMap.get(term)!;
        termInfo.frequency++;
        termInfo.positions.push(index);
      });
      
      // Create index entry
      const indexEntry: SearchIndexEntry = {
        id: contextId,
        content,
        terms: termMap,
        metadata: metadata || {
          source: ContextSource.MANUAL,
          timestamp: Date.now(),
          tags: [],
          tokenCount: tokens.length,
        },
        lastUpdated: Date.now(),
      };
      
      // Add to search index
      this.searchIndex.set(contextId, indexEntry);
      
      // Update term index
      termMap.forEach((_, term) => {
        if (!this.termIndex.has(term)) {
          this.termIndex.set(term, new Set());
        }
        this.termIndex.get(term)!.add(contextId);
      });
      
      // Update stats
      this.stats.totalDocuments = this.searchIndex.size;
      this.stats.totalTerms = this.termIndex.size;
      this.stats.lastUpdated = Date.now();
      
      // Persist to storage
      await this.saveIndexToStorage();
      
      console.log(`[FullTextSearchService] Indexed content: ${contextId}`);
      
    } catch (error) {
      console.error('[FullTextSearchService] Indexing failed:', error);
      throw error;
    }
  }

  async removeFromIndex(contextId: string): Promise<void> {
    try {
      const existingEntry = this.searchIndex.get(contextId);
      if (!existingEntry) return;
      
      // Remove from term index
      existingEntry.terms.forEach((_, term) => {
        const documentSet = this.termIndex.get(term);
        if (documentSet) {
          documentSet.delete(contextId);
          if (documentSet.size === 0) {
            this.termIndex.delete(term);
          }
        }
      });
      
      // Remove from search index
      this.searchIndex.delete(contextId);
      
      // Update stats
      this.stats.totalDocuments = this.searchIndex.size;
      this.stats.totalTerms = this.termIndex.size;
      this.stats.lastUpdated = Date.now();
      
      // Persist to storage
      await this.saveIndexToStorage();
      
      console.log(`[FullTextSearchService] Removed from index: ${contextId}`);
      
    } catch (error) {
      console.error('[FullTextSearchService] Remove from index failed:', error);
      throw error;
    }
  }

  async rebuildIndex(): Promise<void> {
    try {
      console.log('[FullTextSearchService] Rebuilding search index...');
      
      // Clear existing index
      this.searchIndex.clear();
      this.termIndex.clear();
      
      // Get all contexts and summaries from storage
      const contexts = await this.storageService.getAllContexts();
      const summaries = await this.storageService.getAllSummaries();
      
      // Index all contexts
      for (const context of contexts) {
        const metadata: SearchIndexMetadata = {
          source: context.source,
          timestamp: typeof context.timestamp === 'number' ? context.timestamp : context.timestamp.getTime(),
          tags: context.metadata.tags || [],
          tokenCount: context.metadata.tokenCount,
          language: context.metadata.language,
          platform: context.metadata.chatPlatform,
        };
        
        await this.indexContent(context.id, context.content, metadata);
      }
      
      // Index all summaries
      for (const summary of summaries) {
        const metadata: SearchIndexMetadata = {
          source: ContextSource.MANUAL, // Summaries don't have a direct source
          timestamp: typeof summary.timestamp === 'number' ? summary.timestamp : summary.timestamp.getTime(),
          tags: ['summary'],
          summary: summary.content,
          tokenCount: summary.summaryLength,
        };
        
        await this.indexContent(summary.id, summary.content, metadata);
      }
      
      console.log(`[FullTextSearchService] Index rebuilt with ${this.stats.totalDocuments} documents`);
      
    } catch (error) {
      console.error('[FullTextSearchService] Index rebuild failed:', error);
      throw error;
    }
  }

  async getSearchStats(): Promise<SearchStats> {
    await this.ensureInitialized();
    return { ...this.stats };
  }

  // Private helper methods
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private findCandidateDocuments(queryTerms: string[]): Map<string, SearchMatch[]> {
    const candidates = new Map<string, SearchMatch[]>();
    
    queryTerms.forEach(term => {
      const documentIds = this.termIndex.get(term);
      if (documentIds) {
        documentIds.forEach(docId => {
          const indexEntry = this.searchIndex.get(docId);
          if (indexEntry && indexEntry.terms.has(term)) {
            const termInfo = indexEntry.terms.get(term)!;
            const match: SearchMatch = {
              term,
              positions: termInfo.positions,
              score: termInfo.frequency * termInfo.importance,
            };
            
            if (!candidates.has(docId)) {
              candidates.set(docId, []);
            }
            candidates.get(docId)!.push(match);
          }
        });
      }
    });
    
    return candidates;
  }

  private scoreDocuments(
    candidates: Map<string, SearchMatch[]>, 
    queryTerms: string[], 
    _query: SearchQuery
  ): Array<{ docId: string; score: number; matches: SearchMatch[] }> {
    const results: Array<{ docId: string; score: number; matches: SearchMatch[] }> = [];
    
    candidates.forEach((matches, docId) => {
      const indexEntry = this.searchIndex.get(docId);
      if (!indexEntry) return;
      
      // Calculate relevance score
      let score = 0;
      
      // Term frequency score
      const tfScore = matches.reduce((sum, match) => sum + match.score, 0);
      
      // Document frequency score (inverse)
      const dfScore = matches.reduce((sum, match) => {
        const docCount = this.termIndex.get(match.term)?.size || 1;
        return sum + Math.log(this.stats.totalDocuments / docCount);
      }, 0);
      
      // Query coverage score
      const coverageScore = matches.length / queryTerms.length;
      
      // Recency score
      const recencyScore = this.calculateRecencyScore(indexEntry.metadata.timestamp);
      
      // Combine scores
      score = (tfScore * 0.4) + (dfScore * 0.3) + (coverageScore * 0.2) + (recencyScore * 0.1);
      
      results.push({ docId, score, matches });
    });
    
    return results;
  }

  private applyFilters(
    results: Array<{ docId: string; score: number; matches: SearchMatch[] }>,
    filters: SearchFilters
  ): Array<{ docId: string; score: number; matches: SearchMatch[] }> {
    if (!filters) return results;
    
    return results.filter(result => {
      const indexEntry = this.searchIndex.get(result.docId);
      if (!indexEntry) return false;
      
      // Source filter
      if (filters.sources && filters.sources.length > 0) {
        if (!filters.sources.includes(indexEntry.metadata.source)) {
          return false;
        }
      }
      
      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag => 
          indexEntry.metadata.tags.includes(tag)
        );
        if (!hasMatchingTag) return false;
      }
      
      // Date range filter
      if (filters.dateRange) {
        const timestamp = indexEntry.metadata.timestamp;
        if (timestamp < filters.dateRange.start.getTime() || 
            timestamp > filters.dateRange.end.getTime()) {
          return false;
        }
      }
      
      // Score filter
      if (filters.minScore && result.score < filters.minScore) {
        return false;
      }
      
      // Language filter
      if (filters.language && indexEntry.metadata.language !== filters.language) {
        return false;
      }
      
      // Platform filter
      if (filters.platform && indexEntry.metadata.platform !== filters.platform) {
        return false;
      }
      
      return true;
    });
  }

  private sortResults(
    results: Array<{ docId: string; score: number; matches: SearchMatch[] }>,
    sortBy: string | { field: string; direction?: 'asc' | 'desc' }
  ): Array<{ docId: string; score: number; matches: SearchMatch[] }> {
    const sortOption = typeof sortBy === 'string' ? sortBy : sortBy?.field || 'relevance';

    switch (sortOption) {
      case 'date_desc':
        return results.sort((a, b) => {
          const aEntry = this.searchIndex.get(a.docId);
          const bEntry = this.searchIndex.get(b.docId);
          return (bEntry?.metadata.timestamp || 0) - (aEntry?.metadata.timestamp || 0);
        });

      case 'date_asc':
        return results.sort((a, b) => {
          const aEntry = this.searchIndex.get(a.docId);
          const bEntry = this.searchIndex.get(b.docId);
          return (aEntry?.metadata.timestamp || 0) - (bEntry?.metadata.timestamp || 0);
        });

      case 'quality':
      case 'score':
        return results.sort((a, b) => b.score - a.score);

      case 'relevance':
      default:
        return results.sort((a, b) => b.score - a.score);
    }
  }

  private async generateSearchResults(
    results: Array<{ docId: string; score: number; matches: SearchMatch[] }>,
    queryTerms: string[]
  ): Promise<SearchResult[]> {
    const searchResults: SearchResult[] = [];
    
    for (const result of results) {
      const indexEntry = this.searchIndex.get(result.docId);
      if (!indexEntry) continue;
      
      // Get full context from storage
      const context = await this.storageService.getContext(result.docId);
      if (!context) continue;
      
      // Generate snippet with highlights
      const snippet = this.generateSnippet(indexEntry.content, result.matches, queryTerms);
      const highlights = this.generateHighlights(result.matches, queryTerms);
      
      searchResults.push({
        contextId: context.id,
        relevance: result.score,
        snippet,
        highlights: highlights.map((term) => ({
          start: 0,
          end: term.length,
          text: term
        })),
      });
    }
    
    return searchResults;
  }

  private generateSnippet(content: string, matches: SearchMatch[], _queryTerms: string[]): string {
    const maxSnippetLength = 200;
    const contextWindow = 50; // Characters around match
    
    if (matches.length === 0) {
      return content.substring(0, maxSnippetLength) + (content.length > maxSnippetLength ? '...' : '');
    }
    
    // Find the best position for snippet (highest scoring match)
    const bestMatch = matches.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    // Find character position of the best match
    const words = content.split(/\s+/);
    let charPosition = 0;
    for (let i = 0; i < bestMatch.positions[0] && i < words.length; i++) {
      charPosition += words[i].length + 1; // +1 for space
    }
    
    // Extract snippet around the match
    const start = Math.max(0, charPosition - contextWindow);
    const end = Math.min(content.length, charPosition + contextWindow);
    
    let snippet = content.substring(start, end);
    
    // Add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }

  private generateHighlights(matches: SearchMatch[], queryTerms: string[]): string[] {
    const highlights = new Set<string>();
    
    matches.forEach(match => {
      highlights.add(match.term);
    });
    
    queryTerms.forEach(term => {
      highlights.add(term);
    });
    
    return Array.from(highlights);
  }

  private calculateTermImportance(term: string, content: string): number {
    // Simple importance calculation based on term characteristics
    let importance = 1.0;
    
    // Longer terms are generally more important
    if (term.length > 6) importance += 0.2;
    if (term.length > 10) importance += 0.3;
    
    // Terms that appear in title-like positions (beginning of content)
    if (content.toLowerCase().indexOf(term) < 100) {
      importance += 0.3;
    }
    
    // Technical terms (contain numbers, underscores, etc.)
    if (/[0-9_-]/.test(term)) {
      importance += 0.2;
    }
    
    return importance;
  }

  private calculateRecencyScore(timestamp: number): number {
    const now = Date.now();
    const daysSinceCreation = (now - timestamp) / (1000 * 60 * 60 * 24);
    
    // Exponential decay: newer content gets higher scores
    return Math.exp(-daysSinceCreation / 30); // 30-day half-life
  }

  private updateSearchStats(searchTime: number): void {
    this.stats.searchCount++;
    this.stats.avgSearchTime = 
      (this.stats.avgSearchTime * (this.stats.searchCount - 1) + searchTime) / 
      this.stats.searchCount;
  }

  private async loadIndexFromStorage(): Promise<void> {
    try {
      const indexData = await this.storageService.retrieve('search_index');
      const statsData = await this.storageService.retrieve('search_stats');
      
      if (indexData && typeof indexData === 'object') {
        // Reconstruct search index
        Object.entries((indexData as SerializedIndexData).searchIndex || {}).forEach(([docId, entry]: [string, unknown]) => {
          if (entry && typeof entry === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entryObj = entry as any;
            const indexEntry: SearchIndexEntry = {
              ...entryObj,
              terms: new Map(Object.entries(entryObj.terms || {})),
            };
            this.searchIndex.set(docId, indexEntry);
          }
        });
        
        // Reconstruct term index
        Object.entries((indexData as SerializedIndexData).termIndex || {}).forEach(([term, docIds]: [string, unknown]) => {
          if (Array.isArray(docIds)) {
            this.termIndex.set(term, new Set(docIds.filter(id => typeof id === 'string')));
          }
        });
      }
      
      if (statsData) {
        this.stats = { ...this.stats, ...statsData };
      }
      
    } catch (error) {
      console.warn('[FullTextSearchService] Failed to load index from storage:', error);
      // Continue with empty index
    }
  }

  private async saveIndexToStorage(): Promise<void> {
    try {
      // Convert Maps to serializable objects
      const searchIndexObj: Record<string, unknown> = {};
      this.searchIndex.forEach((entry, docId) => {
        searchIndexObj[docId] = {
          ...entry,
          terms: Object.fromEntries(entry.terms),
        };
      });
      
      const termIndexObj: Record<string, string[]> = {};
      this.termIndex.forEach((docIds, term) => {
        termIndexObj[term] = Array.from(docIds);
      });
      
      const indexData = {
        searchIndex: searchIndexObj,
        termIndex: termIndexObj,
      };
      
      await this.storageService.store('search_index', indexData);
      await this.storageService.store('search_stats', this.stats);
      
      this.stats.indexSize = JSON.stringify(indexData).length;
      
    } catch (error) {
      console.error('[FullTextSearchService] Failed to save index to storage:', error);
    }
  }

  // Simple tokenization
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  // Remove common stop words
  private removeStopWords(tokens: string[]): string[] {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'would', 'you', 'your', 'have', 'had',
      'this', 'these', 'they', 'were', 'been', 'their', 'said', 'each',
      'which', 'she', 'do', 'how', 'if', 'we', 'when', 'where', 'who',
      'why', 'what', 'can', 'could', 'should', 'would', 'may', 'might',
      'must', 'shall', 'will', 'am', 'are', 'is', 'was', 'were', 'be',
      'being', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'get',
      'got', 'go', 'goes', 'went', 'come', 'came', 'take', 'took', 'make',
      'made', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'say',
    ]);
    
    return tokens.filter(token => !stopWords.has(token) && token.length > 2);
  }
}
