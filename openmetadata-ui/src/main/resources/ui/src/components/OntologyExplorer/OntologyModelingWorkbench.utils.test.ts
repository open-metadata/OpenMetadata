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

import { AxiomType } from '../../generated/api/data/createOntologyAxiom';
import { PatternType } from '../../generated/api/data/instantiateOntologyPattern';
import {
  buildOntologyAxiomRequest,
  buildOntologyPatternRequest,
  EMPTY_AXIOM_FORM,
  EMPTY_PATTERN_FORM,
} from './OntologyModelingWorkbench.utils';

describe('OntologyModelingWorkbench utilities', () => {
  it('builds the closed measured-KPI request without unrelated pattern payloads', () => {
    const request = buildOntologyPatternRequest('glossary-id', {
      ...EMPTY_PATTERN_FORM,
      changeSetDescription: ' Review KPI ',
      changeSetName: ' measured-kpi ',
      dimension: term('Dimension'),
      kpi: term('Revenue'),
      metric: term('Amount'),
      patternType: PatternType.MeasuredKpi,
    });

    expect(request).toEqual(
      expect.objectContaining({
        changeSetDescription: 'Review KPI',
        changeSetName: 'measured-kpi',
        glossaryId: 'glossary-id',
        measuredKpi: {
          dimension: term('Dimension'),
          kpi: term('Revenue'),
          metric: term('Amount'),
        },
      })
    );
    expect(request.productHierarchy).toBeUndefined();
    expect(request.regulatoryControl).toBeUndefined();
  });

  it('builds a typed Draft axiom and omits empty optional values', () => {
    const request = buildOntologyAxiomRequest('governed', {
      ...EMPTY_AXIOM_FORM,
      axiomType: AxiomType.SubclassOf,
      description: ' Classification ',
      displayName: 'Customer class',
      name: 'customer-classification',
      subjectIri: 'https://example.org/Customer',
      targetIri: ' https://example.org/Party ',
    });

    expect(request).toEqual(
      expect.objectContaining({
        description: 'Classification',
        glossary: 'governed',
        subjectIri: 'https://example.org/Customer',
        targetIri: 'https://example.org/Party',
      })
    );
    expect(request.expressions).toBeUndefined();
    expect(request.literal).toBeUndefined();
    expect(request.propertyIri).toBeUndefined();
  });
});

const term = (name: string) => ({
  description: `${name} description`,
  displayName: name,
  name,
});
