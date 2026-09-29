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
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import OntologyTermEditor from './OntologyTermEditor';

jest.mock('./OntologyDeleteImpactPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="delete-impact-panel" />,
}));

jest.mock('./OntologyNodeRelationsContent', () => ({
  OntologyNodeRelationsContent: ({ isEditMode }: { isEditMode: boolean }) => (
    <div data-editable={String(isEditMode)} data-testid="relations-content" />
  ),
}));

const SOURCE_ID = '00000000-0000-0000-0000-000000000101';
const TARGET_ID = '00000000-0000-0000-0000-000000000102';
const nodes = [
  { id: SOURCE_ID, label: 'Source', type: 'glossaryTerm' },
  { id: TARGET_ID, label: 'Target', type: 'glossaryTerm' },
];
const relationshipType = createRelationshipTypeMock();

describe('OntologyTermEditor', () => {
  it('prevents every mutation when the edit lease is not owned', () => {
    render(
      <OntologyTermEditor
        edges={[]}
        isEditable={false}
        nodes={nodes}
        relationTypes={[relationshipType]}
        selectedNode={nodes[0]}
        onCreateRelation={jest.fn()}
        onDeleteTerm={jest.fn()}
        onSelectNode={jest.fn()}
      />
    );

    expect(
      screen.getByTestId(`term-editor-relation-${relationshipType.name}`)
    ).toBeDisabled();
    expect(screen.getByTestId('term-editor-add-relationship')).toBeDisabled();
    expect(screen.getByTestId('relations-content')).toHaveAttribute(
      'data-editable',
      'false'
    );
    expect(screen.queryByTestId('delete-impact-panel')).not.toBeInTheDocument();
  });

  it('allows relation authoring and delete impact after acquiring the lease', async () => {
    const onCreateRelation = jest.fn().mockResolvedValue(undefined);
    render(
      <OntologyTermEditor
        isEditable
        edges={[]}
        nodes={nodes}
        relationTypes={[relationshipType]}
        selectedNode={nodes[0]}
        onCreateRelation={onCreateRelation}
        onDeleteTerm={jest.fn()}
        onSelectNode={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('term-editor-add-relationship'));

    await waitFor(() =>
      expect(onCreateRelation).toHaveBeenCalledWith(
        SOURCE_ID,
        TARGET_ID,
        relationshipType.name
      )
    );

    expect(screen.getByTestId('relations-content')).toHaveAttribute(
      'data-editable',
      'true'
    );
    expect(screen.getByTestId('delete-impact-panel')).toBeVisible();
  });
});
