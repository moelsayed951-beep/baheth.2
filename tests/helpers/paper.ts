import type { FilterOptions, Paper } from '@/types';

export const paper = (over: Partial<Paper> = {}): Paper => ({
  id: Math.random().toString(36).slice(2), title: 'عنوان عام', authors: [{ name: 'A B' }], year: 2020, abstract: '',
  publicationType: 'journal_article', source: 'openalex', sources: ['openalex'], domain: 'all',
  isOpenAccess: false, citationCount: 0, sourceUrl: 'https://example.org/p', ...over
});

export const filters = (over: Partial<FilterOptions> = {}): FilterOptions => ({
  query: 'x', domain: 'all', departments: [], universities: [], typeFilter: 'all', isOpenAccessOnly: false, egyptOnly: false, ...over
});
