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
import { act, fireEvent, screen } from '@testing-library/react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
} from '../../../../rest/ontologyAPI';
import {
  flushReactQuery,
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import OntologyStudioWorkspace from './OntologyStudioWorkspace';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'user-id' } }),
}));
jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({ useEntityPermissions: () => ({ canEditAll: true }) })
);
jest.mock('../../../../rest/ontologyAPI', () => ({
  listOntologyAxioms: jest.fn(),
  listOntologyConcepts: jest.fn(),
  listOntologyProperties: jest.fn(),
}));
jest.mock(
  '../OntologyAuthoringWorkspace/OntologyAuthoringWorkspace',
  () =>
    ({ definitionType = 'concept' }: { definitionType?: string }) =>
      <div data-testid={`authoring-${definitionType}`} />
);
jest.mock('../OntologyAxiomWorkspace/OntologyAxiomWorkspace', () => () => (
  <div data-testid="axiom-workspace" />
));
jest.mock('../OntologyCreateForm/OntologyCreateForm', () => () => (
  <div data-testid="settings-form" />
));
jest.mock('../OntologyGraphView/OntologyGraphView', () => () => (
  <div data-testid="graph-view" />
));
jest.mock('../../../OntologyExplorer/OntologyMemoryReviewPanel', () => () => (
  <div data-testid="review-panel" />
));

const mockConcepts = listOntologyConcepts as jest.Mock;
const mockProperties = listOntologyProperties as jest.Mock;
const mockAxioms = listOntologyAxioms as jest.Mock;

const ontology: Ontology = {
  id: 'ontology-id',
  name: 'pharmacy',
  displayName: 'Hospital Pharmacy',
  description: 'Prescriptions and medicines',
  fullyQualifiedName: 'pharmacy',
  iri: 'urn:pharmacy',
  namespace: 'urn:pharmacy#',
};

const renderDefinitions = () =>
  renderWithQueryClient(
    <OntologyStudioWorkspace
      canCreate
      mode="definitions"
      ontology={ontology}
      viewSurface="graph"
      onSaved={jest.fn()}
    />
  );

runQueryNotificationsSynchronously();

beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

describe('OntologyStudioWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConcepts.mockResolvedValue({ data: [], paging: { total: 6 } });
    mockProperties.mockResolvedValue({ data: [], paging: { total: 5 } });
    mockAxioms.mockResolvedValue({ data: [], paging: { total: 8 } });
  });

  it('keeps classic definitions tabs without a header or count requests', async () => {
    renderDefinitions();
    await flushReactQuery();

    expect(
      screen.getByRole('tab', { name: 'label.concept-plural' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Hospital Pharmacy')).not.toBeInTheDocument();
    expect(mockConcepts).not.toHaveBeenCalled();
  });

  describe('AI mode', () => {
    beforeEach(() => (useIsAiMode as jest.Mock).mockReturnValue(true));

    afterEach(() => (useIsAiMode as jest.Mock).mockReturnValue(false));

    it('shows the ontology header with the same tabs and no extra list requests', async () => {
      renderDefinitions();
      await flushReactQuery();

      expect(
        screen.getByRole('heading', { name: 'Hospital Pharmacy' })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Prescriptions and medicines')
      ).toBeInTheDocument();

      [
        'label.concept-plural',
        'label.property-plural',
        'label.constraint-plural',
        'label.setting-plural',
      ].forEach((name) =>
        expect(screen.getByRole('tab', { name })).toBeInTheDocument()
      );

      expect(mockConcepts).not.toHaveBeenCalled();
      expect(mockProperties).not.toHaveBeenCalled();
      expect(mockAxioms).not.toHaveBeenCalled();
    });

    it('switches between every definition panel', async () => {
      renderDefinitions();
      await flushReactQuery();

      expect(screen.getByTestId('authoring-concept')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('tab', { name: /label\.property-plural/ })
        );
      });

      expect(screen.getByTestId('authoring-property')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('tab', { name: /label\.constraint-plural/ })
        );
      });

      expect(screen.getByTestId('axiom-workspace')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('tab', { name: 'label.setting-plural' })
        );
      });

      expect(screen.getByTestId('settings-form')).toBeInTheDocument();
    });
  });
});
