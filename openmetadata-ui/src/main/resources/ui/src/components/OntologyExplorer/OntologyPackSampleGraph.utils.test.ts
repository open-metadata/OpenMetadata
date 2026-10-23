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

import type { OntologyPackSample } from '../../generated/api/data/ontologyPackSample';
import { layoutOntologyPackSample } from './OntologyPackSampleGraph.utils';

const SAMPLE: OntologyPackSample = {
  packId: 'fibo',
  version: '1',
  moduleIds: ['foundations'],
  conceptCount: 3,
  relationCount: 2,
  concepts: [
    { iri: 'urn:child-b', label: 'Child B' },
    { iri: 'urn:root', label: 'Root' },
    { iri: 'urn:child-a', label: 'Child A' },
  ],
  relations: [
    {
      sourceIri: 'urn:child-b',
      targetIri: 'urn:root',
      propertyIri: 'urn:broader',
      label: 'broader',
    },
    {
      sourceIri: 'urn:child-a',
      targetIri: 'urn:root',
      propertyIri: 'urn:broader',
      label: 'broader',
    },
  ],
};

describe('layoutOntologyPackSample', () => {
  it('places broader concepts above children and draws curved edges', () => {
    const layout = layoutOntologyPackSample(SAMPLE);
    const root = layout.nodes.find((node) => node.iri === 'urn:root');
    const children = layout.nodes.filter((node) => node.iri !== 'urn:root');

    expect(root?.y).toBe(36);
    expect(children.map((node) => node.label)).toEqual(['Child A', 'Child B']);
    expect(children.every((node) => node.y > (root?.y ?? 0))).toBe(true);
    expect(layout.edges).toHaveLength(2);
    expect(layout.edges.every((edge) => edge.path.includes(' C '))).toBe(true);
    expect(layoutOntologyPackSample(SAMPLE)).toEqual(layout);
  });

  it('places a cycle without looping', () => {
    const cycle: OntologyPackSample = {
      ...SAMPLE,
      concepts: SAMPLE.concepts.slice(0, 2),
      relations: [
        {
          sourceIri: 'urn:child-b',
          targetIri: 'urn:root',
          propertyIri: 'urn:broader',
          label: 'broader',
        },
        {
          sourceIri: 'urn:root',
          targetIri: 'urn:child-b',
          propertyIri: 'urn:broader',
          label: 'broader',
        },
      ],
    };

    expect(layoutOntologyPackSample(cycle).nodes).toHaveLength(2);
  });
});
