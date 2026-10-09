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

import { fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { EntityType } from '../../../../../../../enums/entity.enum';
import { Document } from '../../../../../../../generated/entity/docStore/document';
import { Persona } from '../../../../../../../generated/entity/teams/persona';
import { useCustomizeStore } from '../../../../../../../pages/CustomizablePage/CustomizeStore';
import { getDocumentByFQN } from '../../../../../../../rest/DocStoreAPI';
import { getPersonaByName } from '../../../../../../../rest/PersonaAPI';
import { docStoreQueryKey } from '../../../../../../../rest/queries/docStoreQuery';
import { renderWithQueryClient } from '../../../../../../../test/unit/test-utils';
import { showErrorToast } from '../../../../../../../utils/ToastUtils';
import { CustomizeEditorProps } from './customizeEditor.types';
import PersonaCustomizeView from './PersonaCustomizeView';

const mockOnSave = jest.fn();
const mockOnReset = jest.fn();

const mockPersona: Persona = {
  id: 'persona-id',
  name: 'dataSteward',
  displayName: 'Data Steward',
  fullyQualifiedName: 'dataSteward',
} as Persona;

const mockDocument: Document = {
  id: 'doc-id',
  name: 'dataSteward-dataSteward',
  fullyQualifiedName: 'persona.dataSteward',
  entityType: EntityType.PAGE,
  data: { pages: [], navigation: null },
} as Document;

jest.mock('../../../../../../../rest/PersonaAPI', () => ({
  getPersonaByName: jest.fn(),
}));

jest.mock('../../../../../../../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest.fn(),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const MockEditor = ({
  canSave = true,
  document,
  onActionsChange,
  onDocumentSaved,
  testId,
}: CustomizeEditorProps & { canSave?: boolean; testId: string }) => {
  useEffect(() => {
    onActionsChange({
      canSave,
      onReset: mockOnReset,
      onSave: mockOnSave,
    });
  }, [canSave, onActionsChange]);

  return (
    <div data-testid={testId}>
      {document.fullyQualifiedName}
      <button
        aria-label="save document"
        data-testid={`${testId}-saved`}
        onClick={() => onDocumentSaved({ ...document, id: 'saved-doc-id' })}
      />
    </div>
  );
};

jest.mock('./NavigationEditor', () => (props: CustomizeEditorProps) => (
  <MockEditor {...props} testId="navigation-editor" />
));

jest.mock('./AppLayoutEditor', () => (props: CustomizeEditorProps) => (
  <MockEditor {...props} canSave={false} testId="app-layout-editor" />
));

jest.mock('./AiSidebarEditor', () => (props: CustomizeEditorProps) => (
  <MockEditor {...props} testId="ai-sidebar-editor" />
));

jest.mock('./MarketplaceEditor', () => (props: CustomizeEditorProps) => (
  <MockEditor {...props} testId="marketplace-editor" />
));

jest.mock('./LandingPageEditor', () => (props: CustomizeEditorProps) => (
  <MockEditor {...props} testId="landing-page-editor" />
));

jest.mock('./EntityCustomizeOverlay', () =>
  jest.fn(({ entityType }: { entityType: string }) => (
    <div data-testid="entity-customize-overlay">{entityType}</div>
  ))
);

const renderView = (category: string) => {
  const props = {
    category,
    onBack: jest.fn(),
    onRename: jest.fn(),
    personaFqn: 'dataSteward',
  };

  const { queryClient } = renderWithQueryClient(
    <PersonaCustomizeView
      category={props.category}
      personaFqn={props.personaFqn}
      onBack={props.onBack}
      onRename={props.onRename}
    />
  );

  return { ...props, queryClient };
};

describe('PersonaCustomizeView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCustomizeStore.setState({
      currentPage: null,
      currentPageType: null,
      document: null,
    });
    (getPersonaByName as jest.Mock).mockResolvedValue(mockPersona);
    (getDocumentByFQN as jest.Mock).mockResolvedValue(mockDocument);
  });

  it('loads the persona and its page-layout document', async () => {
    const { onRename } = renderView('navigation');

    expect(await screen.findByTestId('navigation-editor')).toHaveTextContent(
      'persona.dataSteward'
    );
    expect(getPersonaByName).toHaveBeenCalledWith('dataSteward');
    expect(getDocumentByFQN).toHaveBeenCalledWith('persona.dataSteward');
    expect(onRename).toHaveBeenCalledWith('Data Steward');
    expect(useCustomizeStore.getState().document?.id).toBe('doc-id');
  });

  it('falls back to an empty document when the layout does not exist', async () => {
    (getDocumentByFQN as jest.Mock).mockRejectedValue({
      response: { status: 404 },
    });

    renderView('navigation');

    expect(await screen.findByTestId('navigation-editor')).toHaveTextContent(
      'persona.dataSteward'
    );

    const storedDoc = useCustomizeStore.getState().document;

    expect(storedDoc?.id).toBeUndefined();
    expect(storedDoc?.name).toBe('dataSteward-dataSteward');
    expect(storedDoc?.data).toEqual({ navigation: null, pages: [] });
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('shows an error and the empty placeholder when the document fails to load', async () => {
    const error = { response: { status: 500 } };
    (getDocumentByFQN as jest.Mock).mockRejectedValue(error);

    renderView('navigation');

    expect(
      await screen.findByTestId('persona-customize-empty')
    ).toBeInTheDocument();
    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(screen.queryByTestId('navigation-editor')).not.toBeInTheDocument();
  });

  it('shows an error when the persona fails to load', async () => {
    const error = new Error('boom');
    (getPersonaByName as jest.Mock).mockRejectedValue(error);

    renderView('navigation');

    expect(
      await screen.findByTestId('persona-customize-empty')
    ).toBeInTheDocument();
    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(getDocumentByFQN).not.toHaveBeenCalled();
  });

  it('renders only the entity overlay for entity categories', async () => {
    renderView('data-assets/Table');

    expect(
      await screen.findByTestId('entity-customize-overlay')
    ).toHaveTextContent('Table');
    expect(
      screen.queryByTestId('persona-customize-view')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('persona-customize-footer')
    ).not.toBeInTheDocument();
  });

  it.each([
    ['navigation', 'navigation-editor'],
    ['app-layout', 'app-layout-editor'],
    ['askCollateSidebar', 'ai-sidebar-editor'],
    ['DataMarketplace', 'marketplace-editor'],
  ])(
    'renders the %s panel editor with the footer',
    async (category, editorTestId) => {
      renderView(category);

      expect(await screen.findByTestId(editorTestId)).toBeInTheDocument();
      expect(
        screen.getByTestId('persona-customize-footer')
      ).toBeInTheDocument();
    }
  );

  it('wires the footer buttons to the editor actions', async () => {
    const { onBack } = renderView('navigation');

    await screen.findByTestId('navigation-editor');

    expect(screen.getByTestId('customize-save')).toBeEnabled();

    fireEvent.click(screen.getByTestId('customize-save'));
    fireEvent.click(screen.getByTestId('customize-reset'));
    fireEvent.click(screen.getByTestId('customize-cancel'));

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnReset).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('disables save when the editor reports nothing to save', async () => {
    renderView('app-layout');

    await screen.findByTestId('app-layout-editor');

    expect(screen.getByTestId('customize-save')).toBeDisabled();
    expect(screen.getByTestId('customize-reset')).toBeEnabled();
  });

  it.each(['homepage', 'LandingPage'])(
    'renders the %s editor without the footer',
    async (category) => {
      renderView(category);

      expect(
        await screen.findByTestId('landing-page-editor')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('persona-customize-footer')
      ).not.toBeInTheDocument();
    }
  );

  it('refreshes the shared doc-store query cache when an editor saves', async () => {
    const { queryClient } = renderView('navigation');

    fireEvent.click(await screen.findByTestId('navigation-editor-saved'));

    expect(
      queryClient.getQueryData(docStoreQueryKey('persona.dataSteward'))
    ).toEqual(expect.objectContaining({ id: 'saved-doc-id' }));
  });

  it('renders the empty placeholder for an unknown category', async () => {
    renderView('unknown');

    expect(
      await screen.findByTestId('persona-customize-empty')
    ).toBeInTheDocument();
    expect(screen.getByTestId('customize-save')).toBeDisabled();
    expect(screen.getByTestId('customize-reset')).toBeDisabled();
  });
});
