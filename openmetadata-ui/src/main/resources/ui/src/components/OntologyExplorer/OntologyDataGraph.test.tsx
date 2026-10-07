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

jest.mock('@antv/g', () => ({
  Circle: class {},
  Group: class {},
  Image: class {},
  Line: class {},
  Rect: class {},
  Text: class {},
}));

jest.mock('@antv/g6', () => ({
  Circle: class {},
  ExtensionCategory: { COMBO: 'combo', EDGE: 'edge', NODE: 'node' },
  Line: class {},
  Polyline: class {},
  Quadratic: class {},
  Rect: class {},
  RectCombo: class {},
  idOf: (value: unknown) => value,
  register: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import { PaletteKey } from '../../generated/entity/data/relationshipType';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import OntologyDataGraph from './OntologyDataGraph';
import { RELATION_META } from './OntologyExplorer.constants';

it('keeps the built-in relation token on Data mode edges, arrows, and badges', () => {
  render(
    <OntologyDataGraph
      data={{
        nodes: [
          {
            id: 'customer',
            label: 'Customer',
            type: 'glossaryTerm',
            assetCount: 1,
          },
          {
            id: 'account',
            label: 'Account',
            type: 'glossaryTerm',
            assetCount: 1,
          },
        ],
        edges: [
          {
            from: 'customer',
            to: 'account',
            label: 'synonym',
            relationType: 'synonym',
          },
        ],
      }}
      glossaryColorMap={{}}
      hasMoreTerms={false}
      isLoadingMoreTerms={false}
      relationTypes={[
        createRelationshipTypeMock({
          name: 'synonym',
          paletteKey: PaletteKey.Blue,
          systemDefined: true,
        }),
      ]}
      onLoadMore={jest.fn()}
      onLoadMoreTerms={jest.fn()}
      onPaneClick={jest.fn()}
      onSelectNode={jest.fn()}
    />
  );
  const color = RELATION_META.synonym.color;

  expect(screen.getByTestId('ontology-data-semantic-edge')).toHaveAttribute(
    'stroke',
    color
  );
  expect(screen.getByTestId('ontology-data-edge-arrow')).toHaveAttribute(
    'fill',
    color
  );
  expect(screen.getByTestId('ontology-data-semantic-edge-label')).toHaveStyle({
    color,
    borderColor: color,
  });
});
