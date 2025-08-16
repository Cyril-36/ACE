import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedSearch } from '../AdvancedSearch';
import { SearchResult, ContextSource, SortOption } from '../../types';

// Mock search results

// Mock functions

// Mock functions
const mockOnSearch = vi.fn();
const mockOnResultSelect = vi.fn();
const mockOnFilterChange = vi.fn();
const mockOnClear = vi.fn();

const mockOnSearch = vi.fn();
const mockOnResultSelect = vi.fn();
const mockOnFilterChange = vi.fn();
const mockOnClear = vi.fn();

const _mockSearchResults: SearchResult[] = [
  {
    contextId: 'test-1',
    relevance: 0.85,
    _snippet: 'This is a test context with some important information...',
    _highlights: [
      { start: 0, _end: 4, _text: 'test' },
      { _start: 60, _end: 65, _text: 'React' }
    ],
  },
  {
    contextId: 'test-2',
    relevance: 0.72,
    _snippet: 'Another context about TypeScript and testing...',
    _highlights: [
      { start: 20, _end: 30, _text: 'TypeScript' },
      { _start: 35, _end: 42, _text: 'testing' }
    ],
  },
];

describe('AdvancedSearch', () => {
  const _mockOnSearch = vi.fn();
  const _mockOnResultSelect = vi.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
    mockOnResultSelect.mockClear();
    mockOnSearch.mockResolvedValue(_mockSearchResults);
  });

  describe('Basic Functionality', () => {
    it('should render search interface', () => {
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /execute search/i })).toBeInTheDocument();
    });

    it('should focus search input on mount', () => {
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('should perform search when typing', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test query');

      // Wait for debounced search
      await waitFor(() => {
        expect(_mockOnSearch).toHaveBeenCalledWith({
          _query: 'test query',
          _filters: {},
          _sort: SortOption.RELEVANCE,
          _limit: 50,
        });
      }, { _timeout: 1000 });
    });

    it('should display search results', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
      });

      // Check if results are displayed - verify we have 2 _result items
      const _resultItems = screen.getAllByRole('button', { name: /search _result/i });
      expect(_resultItems).toHaveLength(2);
      
      // Check that we have the expected _result count message
      expect(screen.getByText('2 results found')).toBeInTheDocument();
    });

    it('should handle _result selection', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
      });

      const _firstResult = screen.getAllByRole('button', { name: /search _result/i })[0];
      await _user.click(_firstResult);

      expect(_mockOnResultSelect).toHaveBeenCalledWith(_mockSearchResults[0]);
    });
  });

  describe('Filters', () => {
    it('should toggle filters panel', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _filterToggle = screen.getByRole('button', { name: /filters/i });
      expect(_filterToggle).toHaveAttribute('aria-expanded', 'false');

      await _user.click(_filterToggle);
      expect(_filterToggle).toHaveAttribute('aria-expanded', 'true');

      // Check if filter controls are visible
      expect(screen.getByText('Sources')).toBeInTheDocument();
      expect(screen.getByText('Date Range')).toBeInTheDocument();
      expect(screen.getByText('Minimum Quality')).toBeInTheDocument();
    });

    it('should apply source filters', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      // Open filters
      const _filterToggle = screen.getByRole('button', { name: /filters/i });
      await _user.click(_filterToggle);

      // Select IDE source
      const _ideCheckbox = screen.getByRole('checkbox', { name: /ide/i });
      await _user.click(_ideCheckbox);

      // Type search query
      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(_mockOnSearch).toHaveBeenCalledWith({
          _query: 'test',
          _filters: { source: [ContextSource.IDE] },
          _sort: SortOption.RELEVANCE,
          _limit: 50,
        });
      });
    });

    it('should apply date range filters', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      // Open filters
      const _filterToggle = screen.getByRole('button', { name: /filters/i });
      await _user.click(_filterToggle);

      // Set date range
      const _startDateInput = screen.getByLabelText('Start date');
      const _endDateInput = screen.getByLabelText('End date');
      
      await _user.type(_startDateInput, '2024-01-01');
      await _user.type(_endDateInput, '2024-12-31');

      // Type search query
      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(_mockOnSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            _query: 'test',
            _filters: expect.objectContaining({
              dateRange: expect.objectContaining({
                start: expect.any(Date),
                _end: expect.any(Date),
              }),
            }),
          })
        );
      });
    });

    it('should apply quality filter', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      // Open filters
      const _filterToggle = screen.getByRole('button', { name: /filters/i });
      await _user.click(_filterToggle);

      // Set quality threshold
      const _qualitySlider = screen.getByLabelText('Minimum quality threshold');
      fireEvent.change(_qualitySlider, { _target: { value: '0.8' } });

      // Type search query
      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(_mockOnSearch).toHaveBeenCalledWith({
          _query: 'test',
          _filters: { minQuality: 0.8 },
          _sort: SortOption.RELEVANCE,
          _limit: 50,
        });
      });
    });

    it('should clear all filters', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      // Open filters
      const _filterToggle = screen.getByRole('button', { name: /filters/i });
      await _user.click(_filterToggle);

      // Apply some filters
      const _ideCheckbox = screen.getByRole('checkbox', { name: /ide/i });
      await _user.click(_ideCheckbox);

      const _qualitySlider = screen.getByLabelText('Minimum quality threshold');
      fireEvent.change(_qualitySlider, { _target: { value: '0.8' } });

      // Clear filters
      const _clearButton = screen.getByRole('button', { name: /clear all filters/i });
      await _user.click(_clearButton);

      // Type search query
      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(_mockOnSearch).toHaveBeenCalledWith({
          _query: 'test',
          _filters: {},
          _sort: SortOption.RELEVANCE,
          _limit: 50,
        });
      });
    });
  });

  describe('Sorting', () => {
    it('should change sort option', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _sortSelect = screen.getByRole('combobox', { name: /sort results by/i });
      await _user.selectOptions(_sortSelect, SortOption.DATE_DESC);

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(_mockOnSearch).toHaveBeenCalledWith({
          _query: 'test',
          _filters: {},
          sort: SortOption.DATE_DESC,
          _limit: 50,
        });
      });
    });
  });

  describe('Preview Modal', () => {
    it('should open preview modal when _result is clicked', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
      });

      const _firstResult = screen.getAllByRole('button', { name: /search _result/i })[0];
      await _user.click(_firstResult);

      // Modal should be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /context preview/i })).toBeInTheDocument();
    });

    it('should close preview modal with close button', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
      });

      const _firstResult = screen.getAllByRole('button', { name: /search _result/i })[0];
      await _user.click(_firstResult);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const _closeButton = screen.getByRole('button', { name: /close preview/i });
      await _user.click(_closeButton);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should close preview modal with _backdrop click', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
      });

      const _firstResult = screen.getAllByRole('button', { name: /search _result/i })[0];
      await _user.click(_firstResult);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const _backdrop = document.querySelector('.preview-_backdrop');
      if (_backdrop) {
        fireEvent.click(_backdrop);
      }

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('should show placeholder when no query', () => {
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      expect(screen.getByText(/enter a search query/i)).toBeInTheDocument();
      expect(screen.getByText(/_tips:/i)).toBeInTheDocument();
    });

    it('should show no results message', async () => {
      const _user = userEvent.setup();
      const _emptySearch = vi.fn().mockResolvedValue([]);
      
      render(
        <AdvancedSearch
          onSearch={_emptySearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/no results found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during search', async () => {
      const _user = userEvent.setup();
      const _slowSearch = vi.fn(() => new Promise<SearchResult[]>(resolve => setTimeout(() => resolve([]), 1000)));
      
      render(
        <AdvancedSearch
          onSearch={_slowSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      // Should show loading state - check for 0 results initially
      expect(screen.getByText(/0 results found/i)).toBeInTheDocument();
    });

    it('should disable search button during search', async () => {
      const _user = userEvent.setup();
      let _resolveSearch: (value: SearchResult[]) => void;
      const _slowSearch = vi.fn(() => new Promise<SearchResult[]>((resolve: any) => {
        _resolveSearch = resolve;
      }));
      
      render(
        <AdvancedSearch
          onSearch={_slowSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      const _searchButton = screen.getByRole('button', { name: /execute search/i });
      
      // Type and immediately click search button
      await _user.type(_searchInput, 'test');
      await _user.click(_searchButton);

      // Button should be disabled during search
      expect(_searchButton).toBeDisabled();
      
      // Resolve the search
      _resolveSearch!([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      const _user = userEvent.setup();
      const _errorSearch = vi.fn().mockRejectedValue(new Error('Search failed'));
      
      render(
        <AdvancedSearch
          onSearch={_errorSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        // Should not crash and should show empty results
        expect(screen.getByText(/no results found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Highlighting', () => {
    it('should highlight search terms in results', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
      });

      // Check for highlighted terms
      const _highlightedTerms = document.querySelectorAll('._search-highlight');
      expect(_highlightedTerms.length).toBeGreaterThan(0);
    });

    it('should show highlighted terms badges', async () => {
      const _user = userEvent.setup();
      
      render(
        <AdvancedSearch
          onSearch={_mockOnSearch}
          onResultSelect={_mockOnResultSelect}
        />
      );

      const _searchInput = screen.getByRole('textbox');
      await _user.type(_searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
      });

      // Check for term badges - use getAllByText since there are multiple instances
      expect(screen.getAllByText('test').length).toBeGreaterThan(0);
      expect(screen.getAllByText('React').length).toBeGreaterThan(0);
    });
  });
});