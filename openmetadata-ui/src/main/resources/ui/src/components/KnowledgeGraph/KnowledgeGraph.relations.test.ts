/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  classifyMergedRelation,
  classifyRelation,
  getRelationStyle,
  humanizeRelationLabel,
  normalizeRelationKey,
  RELATION_CATEGORIES,
} from './KnowledgeGraph.relations';

describe('KnowledgeGraph.relations', () => {
  describe('normalizeRelationKey', () => {
    it('strips an RDF namespace prefix', () => {
      expect(normalizeRelationKey('om:hasColumn')).toBe('hascolumn');
      expect(normalizeRelationKey('http://example.org/ns#hasColumn')).toBe(
        'hascolumn'
      );
    });

    it('collapses case and separators to one key', () => {
      expect(normalizeRelationKey('HAS_COLUMN')).toBe('hascolumn');
      expect(normalizeRelationKey('has column')).toBe('hascolumn');
      expect(normalizeRelationKey('hasColumn')).toBe('hascolumn');
    });
  });

  describe('classifyRelation', () => {
    it.each([
      ['downstream', 'lineage'],
      ['hasLineage', 'lineage'],
      ['dependsOn', 'lineage'],
      ['hasColumn', 'structure'],
      ['belongsToSchema', 'structure'],
      ['ownedBy', 'ownership'],
      ['steward', 'ownership'],
      ['partOfDomain', 'governance'],
      ['hasTag', 'governance'],
      ['mappedTo', 'ontology'],
      ['broader', 'ontology'],
      ['hasTestCase', 'quality'],
    ])('classifies %s as %s', (predicate, expected) => {
      expect(classifyRelation(predicate, 'table', 'table')).toBe(expected);
    });

    it('is insensitive to predicate spelling', () => {
      expect(classifyRelation('OWNED_BY', 'table', 'user')).toBe(
        classifyRelation('ownedBy', 'table', 'user')
      );
    });

    it('falls back to ontology for an unknown predicate touching a glossary term', () => {
      expect(
        classifyRelation('regulates', 'glossaryTerm', 'glossaryTerm')
      ).toBe('ontology');
    });

    it('falls back to ownership for an unknown predicate touching a user or team', () => {
      expect(classifyRelation('championedBy', 'table', 'user')).toBe(
        'ownership'
      );
      expect(classifyRelation('championedBy', 'team', 'table')).toBe(
        'ownership'
      );
    });

    it('falls back to governance for an unknown predicate touching a domain', () => {
      expect(classifyRelation('curatedBy', 'table', 'domain')).toBe(
        'governance'
      );
    });

    it('falls back to structure when nothing else applies', () => {
      expect(classifyRelation('somePredicate', 'table', 'table')).toBe(
        'structure'
      );
    });

    it('prefers a known predicate over the endpoint heuristic', () => {
      // Both endpoints are people, but `mappedTo` is unambiguously ontological.
      expect(classifyRelation('mappedTo', 'user', 'team')).toBe('ontology');
    });

    it('tolerates missing endpoint types', () => {
      expect(classifyRelation('downstream')).toBe('lineage');
      expect(classifyRelation('unknownPredicate')).toBe('structure');
    });

    it('lets the endpoints decide for container-ish predicates', () => {
      // `Contains` means structure between a schema and a table but quality
      // between a table and its test suite.
      expect(classifyRelation('Contains', 'databaseSchema', 'table')).toBe(
        'structure'
      );
      expect(classifyRelation('Contains', 'table', 'testSuite')).toBe(
        'quality'
      );
      expect(classifyRelation('Has', 'domain', 'table')).toBe('governance');
    });

    // The predicate vocabulary the RDF endpoint actually emits for a table,
    // captured from a live /rdf/graph/explore response.
    it.each([
      ['Contains', 'databaseSchema', 'table', 'structure'],
      ['Contains', 'table', 'testSuite', 'quality'],
      ['Has', 'domain', 'table', 'governance'],
      ['Downstream', 'table', 'table', 'lineage'],
      ['Upstream', 'table', 'table', 'lineage'],
      ['Was Attributed To', 'table', 'user', 'ownership'],
      ['Belongs To Database', 'table', 'database', 'structure'],
      ['Belongs To Schema', 'table', 'databaseSchema', 'structure'],
      ['Belongs To Service', 'table', 'databaseService', 'structure'],
      ['Domains', 'table', 'domain', 'governance'],
      ['Has Column', 'table', 'column', 'structure'],
      ['Has Glossary Term', 'table', 'glossaryTerm', 'ontology'],
      ['Has Owner', 'table', 'user', 'ownership'],
      ['Has Tag', 'table', 'tag', 'governance'],
      ['Has Tier', 'table', 'tag', 'governance'],
    ])(
      'classifies the live predicate %s (%s -> %s) as %s',
      (label, source, target, expected) => {
        expect(classifyRelation(label, source, target)).toBe(expected);
      }
    );
  });

  describe('classifyMergedRelation', () => {
    it('returns the single family when the merged predicates agree', () => {
      expect(
        classifyMergedRelation(['Upstream', 'Downstream'], 'table', 'table')
      ).toBe('lineage');
    });

    it('prefers the more specific family when the predicates disagree', () => {
      // A glossary term arrives as both `Has Glossary Term` (ontology) and
      // `Has Tag` (governance); the edge should read as the business mapping.
      expect(
        classifyMergedRelation(
          ['Has Tag', 'Has Glossary Term'],
          'table',
          'glossaryTerm'
        )
      ).toBe('ontology');
    });

    it('does not depend on the order the server returned the predicates', () => {
      const forwards = classifyMergedRelation(
        ['Has Tag', 'Has Glossary Term'],
        'table',
        'glossaryTerm'
      );
      const backwards = classifyMergedRelation(
        ['Has Glossary Term', 'Has Tag'],
        'table',
        'glossaryTerm'
      );

      expect(forwards).toBe(backwards);
    });

    it('falls back to structure for an empty label list', () => {
      expect(classifyMergedRelation([], 'table', 'table')).toBe('structure');
    });
  });

  describe('getRelationStyle', () => {
    it('gives every category a colour, a label key and a dash pattern', () => {
      RELATION_CATEGORIES.forEach((category) => {
        const style = getRelationStyle(category);

        expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(style.labelKey).toMatch(/^label\./);
        expect(Array.isArray(style.lineDash)).toBe(true);
      });
    });

    it('draws lineage solid and every other family dashed', () => {
      expect(getRelationStyle('lineage').lineDash).toEqual([]);

      RELATION_CATEGORIES.filter((category) => category !== 'lineage').forEach(
        (category) => {
          expect(getRelationStyle(category).lineDash.length).toBeGreaterThan(0);
        }
      );
    });

    it('gives every family a distinct colour', () => {
      const colors = RELATION_CATEGORIES.map(
        (category) => getRelationStyle(category).color
      );

      expect(new Set(colors).size).toBe(RELATION_CATEGORIES.length);
    });

    it('gives every family a distinct dash pattern', () => {
      const dashes = RELATION_CATEGORIES.map((category) =>
        getRelationStyle(category).lineDash.join(',')
      );

      expect(new Set(dashes).size).toBe(RELATION_CATEGORIES.length);
    });
  });

  describe('humanizeRelationLabel', () => {
    it('turns a camelCase predicate into a phrase', () => {
      expect(humanizeRelationLabel('hasColumn')).toBe('Has column');
    });

    it('turns a snake_case predicate into a phrase', () => {
      expect(humanizeRelationLabel('OWNED_BY')).toBe('Owned by');
    });

    it('drops a namespace prefix', () => {
      expect(humanizeRelationLabel('om:isRelatedTo')).toBe('Is related to');
    });

    it('returns the original string when nothing is left to humanize', () => {
      expect(humanizeRelationLabel('###')).toBe('###');
    });
  });
});
