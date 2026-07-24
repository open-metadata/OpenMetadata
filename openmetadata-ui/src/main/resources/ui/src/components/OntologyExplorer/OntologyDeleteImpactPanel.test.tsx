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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Operation } from '../../generated/api/data/ontologyImpactReport';
import {
  deleteGlossaryTermWithImpact,
  previewGlossaryTermDeleteImpact,
} from '../../rest/ontologyAPI';
import OntologyDeleteImpactPanel from './OntologyDeleteImpactPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  deleteGlossaryTermWithImpact: jest.fn(),
  previewGlossaryTermDeleteImpact: jest.fn(),
}));

const mockDelete = deleteGlossaryTermWithImpact as jest.MockedFunction<
  typeof deleteGlossaryTermWithImpact
>;
const mockPreview = previewGlossaryTermDeleteImpact as jest.MockedFunction<
  typeof previewGlossaryTermDeleteImpact
>;

const TERM_ID = '00000000-0000-0000-0000-000000000101';
const CHILD_ID = '00000000-0000-0000-0000-000000000102';

describe('OntologyDeleteImpactPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPreview.mockResolvedValue({
      baseVersion: 1,
      boundAssetCount: 2,
      boundAssets: [],
      boundAssetsTruncated: true,
      children: [{ id: CHILD_ID, name: 'Child', type: 'glossaryTerm' }],
      conceptMappings: [],
      expiresAt: 120_000,
      generatedAt: 1,
      impactToken: 'fresh-impact-token',
      operation: Operation.Delete,
      relationships: [],
      resource: { id: TERM_ID, name: 'Parent', type: 'glossaryTerm' },
      shaclRecheckRequired: true,
    });
    mockDelete.mockResolvedValue({
      cascaded: true,
      hardDeleted: false,
      reassignedChildren: 0,
      resource: { id: TERM_ID, name: 'Parent', type: 'glossaryTerm' },
    });
  });

  it('requires an explicit child decision before token-protected deletion', async () => {
    const onDeleted = jest.fn();
    render(
      <OntologyDeleteImpactPanel
        node={{ id: TERM_ID, label: 'Parent', type: 'glossaryTerm' }}
        nodes={[
          { id: TERM_ID, label: 'Parent', type: 'glossaryTerm' },
          { id: CHILD_ID, label: 'Child', type: 'glossaryTerm' },
        ]}
        onDeleted={onDeleted}
      />
    );

    fireEvent.click(screen.getByTestId('delete-impact-preview'));

    await waitFor(() => expect(mockPreview).toHaveBeenCalledWith(TERM_ID));

    expect(screen.getByTestId('delete-impact-confirm')).toBeDisabled();

    fireEvent.click(screen.getByTestId('delete-impact-cascade'));

    expect(screen.getByTestId('delete-impact-confirm')).toBeEnabled();

    fireEvent.click(screen.getByTestId('delete-impact-confirm'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));

    expect(mockDelete).toHaveBeenCalledWith(TERM_ID, {
      cascadeConfirmed: true,
      hardDelete: false,
      impactToken: 'fresh-impact-token',
      reassignChildrenTo: undefined,
    });
  });
});
