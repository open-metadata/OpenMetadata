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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { EntityTags } from 'Models';
import { MemoryRouter } from 'react-router-dom';
import {
  LabelType,
  State,
  TagLabel,
  TagLabelMetadata,
  TagSource,
} from '../../../generated/type/tagLabel';
import TagsContainerV2 from './TagsContainerV2';

let capturedOnSubmit:
  | ((data: { value: string; data?: Partial<EntityTags> }[]) => Promise<void>)
  | undefined;

jest.mock('../TagsSelectForm/TagsSelectForm.component', () => {
  return jest.fn().mockImplementation((props) => {
    capturedOnSubmit = props.onSubmit;

    return <div data-testid="mock-tag-select-form">TagSelectForm</div>;
  });
});

jest.mock('../TagsViewer/TagsViewer', () =>
  jest.fn().mockImplementation(() => <div data-testid="tags-viewer" />)
);

jest.mock('../TagsV1/TagsV1.component', () =>
  jest.fn().mockImplementation(() => <div data-testid="tags-v1" />)
);

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  ...jest.requireActual('../../Customization/GenericProvider/GenericContext'),
  useGenericContext: () => ({
    onThreadLinkSelect: jest.fn(),
    activeTagDropdownKey: null,
    updateActiveTagDropdownKey: jest.fn(),
  }),
}));

jest.mock('../../Suggestions/SuggestionsProvider/SuggestionsProvider', () => ({
  useSuggestionsContext: () => ({ selectedUserSuggestions: undefined }),
}));

jest.mock('../../common/ExpandableCard/ExpandableCard', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="expandable-card">{children}</div>
    ))
);

jest.mock('../../Suggestions/SuggestionsAlert/SuggestionsAlert', () =>
  jest.fn().mockImplementation(() => <div data-testid="suggestions-alert" />)
);

const PERSONAL_DATA_FQN = 'PersonalData.Personal';
const PII_SENSITIVE_FQN = 'PII.Sensitive';
const TIER_GOLD_FQN = 'Tier.Tier1';

const APPLIED_AT_ISO = '2026-01-01T00:00:00Z';

const personalDataTag: EntityTags = {
  tagFQN: PERSONAL_DATA_FQN,
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
  appliedBy: 'admin',
  appliedAt: new Date(APPLIED_AT_ISO),
  description: 'Personal data',
};

const piiSensitiveTag: EntityTags = {
  tagFQN: PII_SENSITIVE_FQN,
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
  appliedBy: 'bot-classification',
  appliedAt: new Date(APPLIED_AT_ISO),
};

const renderTagsContainer = (props: {
  selectedTags: EntityTags[];
  onSelectionChange: jest.Mock;
}) => {
  capturedOnSubmit = undefined;

  return render(
    <MemoryRouter>
      <TagsContainerV2
        permission
        showInlineEditButton
        entityFqn="sample.db.schema.table"
        entityType="table"
        selectedTags={props.selectedTags}
        tagType={TagSource.Classification}
        onSelectionChange={props.onSelectionChange}
      />
    </MemoryRouter>
  );
};

const enterEditMode = async () => {
  const editButton = screen.getByTestId('edit-button');
  fireEvent.click(editButton);
  await screen.findByTestId('mock-tag-select-form');
};

describe('TagsContainerV2 handleSave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnSubmit = undefined;
  });

  it('preserves appliedBy and appliedAt on existing tag when a new tag is added', async () => {
    const onSelectionChange = jest.fn().mockResolvedValue(undefined);
    renderTagsContainer({
      selectedTags: [personalDataTag],
      onSelectionChange,
    });

    await enterEditMode();

    expect(capturedOnSubmit).toBeDefined();

    await act(async () => {
      await capturedOnSubmit?.([
        { value: PERSONAL_DATA_FQN, data: personalDataTag },
        {
          value: TIER_GOLD_FQN,
          data: { name: 'Tier1', tagFQN: TIER_GOLD_FQN },
        },
      ]);
    });

    expect(onSelectionChange).toHaveBeenCalledTimes(1);

    const emitted = onSelectionChange.mock.calls[0][0] as EntityTags[];

    const survived = emitted.find((t) => t.tagFQN === PERSONAL_DATA_FQN);

    expect(survived).toEqual(
      expect.objectContaining({
        tagFQN: PERSONAL_DATA_FQN,
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
        appliedBy: 'admin',
        appliedAt: personalDataTag.appliedAt,
        description: 'Personal data',
      })
    );
  });

  it('passes every TagLabel schema field through to onSelectionChange', async () => {
    const onSelectionChange = jest.fn().mockResolvedValue(undefined);
    // Seed with a different tag so the new selection genuinely changes the FQN list
    // and isn't short-circuited by the no-op guard inside handleSave.
    renderTagsContainer({
      selectedTags: [piiSensitiveTag],
      onSelectionChange,
    });

    await enterEditMode();

    expect(capturedOnSubmit).toBeDefined();

    const fullTag: Required<TagLabel> = {
      tagFQN: PERSONAL_DATA_FQN,
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
      name: 'Personal',
      displayName: 'Personal Data',
      description: 'Full TagLabel coverage fixture',
      style: { color: '#ABCDEF', iconURL: 'icon-url' },
      href: 'https://example.openmetadata/api/v1/tags/PersonalData.Personal',
      appliedBy: 'admin',
      appliedAt: new Date('2026-01-01T00:00:00Z'),
      metadata: {
        recognizer: {
          recognizerId: 'rec-1',
          recognizerName: 'pii-recognizer',
          score: 0.95,
        },
      } as TagLabelMetadata,
      reason: 'auto-classified',
    };

    await act(async () => {
      await capturedOnSubmit?.([{ value: fullTag.tagFQN, data: fullTag }]);
    });

    expect(onSelectionChange).toHaveBeenCalledTimes(1);

    const emitted = onSelectionChange.mock.calls[0][0] as TagLabel[];
    const survived = emitted.find((t) => t.tagFQN === PERSONAL_DATA_FQN);

    for (const key of Object.keys(fullTag) as (keyof TagLabel)[]) {
      expect(survived?.[key]).toEqual(fullTag[key]);
    }
  });

  it('add-one-remove-another in same save keeps surviving tag fields intact', async () => {
    const onSelectionChange = jest.fn().mockResolvedValue(undefined);
    renderTagsContainer({
      selectedTags: [personalDataTag, piiSensitiveTag],
      onSelectionChange,
    });

    await enterEditMode();

    expect(capturedOnSubmit).toBeDefined();

    await act(async () => {
      await capturedOnSubmit?.([
        { value: PERSONAL_DATA_FQN, data: personalDataTag },
        {
          value: TIER_GOLD_FQN,
          data: { name: 'Tier1', tagFQN: TIER_GOLD_FQN },
        },
      ]);
    });

    expect(onSelectionChange).toHaveBeenCalledTimes(1);

    const emitted = onSelectionChange.mock.calls[0][0] as EntityTags[];

    expect(emitted).toHaveLength(2);

    const survived = emitted.find((t) => t.tagFQN === PERSONAL_DATA_FQN);
    const added = emitted.find((t) => t.tagFQN === TIER_GOLD_FQN);

    expect(survived).toEqual(
      expect.objectContaining({
        appliedBy: 'admin',
        appliedAt: personalDataTag.appliedAt,
        description: 'Personal data',
      })
    );
    expect(added).toEqual(
      expect.objectContaining({
        tagFQN: TIER_GOLD_FQN,
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      })
    );
    expect(added?.appliedBy).toBeUndefined();
    expect(added?.appliedAt).toBeUndefined();
  });
});
