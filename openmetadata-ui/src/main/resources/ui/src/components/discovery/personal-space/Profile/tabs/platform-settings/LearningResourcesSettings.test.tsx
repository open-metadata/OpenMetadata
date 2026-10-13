/*
 *  Copyright 2023 Collate.
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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  createLearningResource,
  deleteLearningResource,
  getLearningResourceById,
  getLearningResourcesList,
  LearningResource,
  updateLearningResource,
} from '../../../../../../rest/learningResourceAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import {
  toLearningResourceFormValues,
  toLearningResourcePayload,
} from './LearningResourceSettings.utils';
import LearningResourceSettingsForm from './LearningResourceSettingsForm';
import LearningResourcesSettings from './LearningResourcesSettings';

// Stable identity: the reused list hook refetches whenever `t` changes, as
// the real i18next `t` never does.
const mockT = (key: string) => key;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

jest.mock('../../../../../../rest/learningResourceAPI', () => ({
  getLearningResourcesList: jest.fn(),
  getLearningResourceById: jest.fn(),
  createLearningResource: jest.fn(),
  updateLearningResource: jest.fn(),
  deleteLearningResource: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../../hooks/platform/usePersonaViewMode', () => ({
  usePersonaViewMode: () => 'Table',
}));

jest.mock(
  '../../../../../Learning/ResourcePlayer/ResourcePlayerModal.component',
  () => ({
    ResourcePlayerModal: () => <div data-testid="resource-player" />,
  })
);

const RESOURCE: LearningResource = {
  id: 'res-1',
  name: 'intro-video',
  displayName: 'Intro video',
  description: 'Getting started.',
  resourceType: 'Video',
  categories: ['Discovery'],
  difficulty: 'Intro',
  source: { url: 'https://youtube.com/watch?v=1', provider: 'YouTube' },
  estimatedDuration: 300,
  contexts: [{ pageId: 'glossary', componentId: 'header' }],
  status: 'Active',
  updatedAt: 1790000000000,
};

const onNavigate = jest.fn();
let headerActions: ReactNode;
const onSetHeaderActions = (actions: ReactNode) => {
  headerActions = actions;
};

const inputOf = (testId: string) =>
  screen.getByTestId(testId).querySelector('input, textarea') as Element;

describe('Learning resources settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLearningResourcesList as jest.Mock).mockResolvedValue({
      data: [RESOURCE],
      paging: { total: 1 },
    });
    (getLearningResourceById as jest.Mock).mockResolvedValue(RESOURCE);
    (createLearningResource as jest.Mock).mockResolvedValue({});
    (updateLearningResource as jest.Mock).mockResolvedValue({});
    (deleteLearningResource as jest.Mock).mockResolvedValue({});
  });

  it('round-trips a resource through the form values, keeping fields the form does not edit', () => {
    const payload = toLearningResourcePayload(
      toLearningResourceFormValues(RESOURCE),
      RESOURCE
    );

    expect(payload).toEqual({
      name: 'intro-video',
      description: 'Getting started.',
      resourceType: 'Video',
      categories: ['Discovery'],
      contexts: [{ pageId: 'glossary', componentId: 'header' }],
      difficulty: 'Intro',
      estimatedDuration: 300,
      source: { url: 'https://youtube.com/watch?v=1', provider: 'YouTube' },
      status: 'Active',
    });
  });

  it('lists resources and routes Add and Edit to the form', async () => {
    render(
      <MemoryRouter>
        <LearningResourcesSettings
          onNavigate={onNavigate}
          onSetHeaderActions={onSetHeaderActions}
        />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('intro-video')).toHaveTextContent(
      'Intro video'
    );

    render(<>{headerActions}</>);
    fireEvent.click(screen.getByTestId('create-resource'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'learning-resources',
      isEditing: true,
    });

    fireEvent.click(screen.getByTestId('edit-intro-video'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'learning-resources',
      isEditing: true,
      itemId: 'res-1',
    });
  });

  it('deletes a resource after confirmation', async () => {
    render(
      <MemoryRouter>
        <LearningResourcesSettings
          onNavigate={onNavigate}
          onSetHeaderActions={onSetHeaderActions}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('delete-intro-video'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('confirm-button'));
    });

    expect(deleteLearningResource).toHaveBeenCalled();
  });

  it('edit loads the resource, locks its name and saves an update', async () => {
    render(
      <LearningResourceSettingsForm
        itemId="res-1"
        showHint={false}
        onNavigate={onNavigate}
      />
    );
    await waitFor(() =>
      expect(inputOf('description-input')).toHaveValue('Getting started.')
    );

    expect(inputOf('name-input')).toBeDisabled();

    fireEvent.change(inputOf('description-input'), {
      target: { value: 'Updated.' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(updateLearningResource).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'intro-video',
        description: 'Updated.',
        contexts: [{ pageId: 'glossary', componentId: 'header' }],
      })
    );
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'learning-resources',
      isEditing: false,
    });
  });

  it('returns to the list when the resource to edit cannot be loaded', async () => {
    (getLearningResourceById as jest.Mock).mockRejectedValue(
      new Error('not found')
    );
    render(
      <LearningResourceSettingsForm
        itemId="deleted-id"
        showHint={false}
        onNavigate={onNavigate}
      />
    );

    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith({
        type: 'page',
        page: 'learning-resources',
        isEditing: false,
      })
    );

    expect(showErrorToast).toHaveBeenCalled();
  });

  it('add requires the mandatory fields and a valid source URL', async () => {
    render(
      <LearningResourceSettingsForm showHint={false} onNavigate={onNavigate} />
    );
    await screen.findByTestId('learning-resource-form');

    fireEvent.change(inputOf('source-url-input'), {
      target: { value: 'not a url' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(await screen.findByText('label.invalid-url')).toBeInTheDocument();
    // Name, description, type, categories and context (the URL is invalid, not empty).
    expect(screen.getAllByText('label.field-required')).toHaveLength(5);
    expect(createLearningResource).not.toHaveBeenCalled();
  });
});
