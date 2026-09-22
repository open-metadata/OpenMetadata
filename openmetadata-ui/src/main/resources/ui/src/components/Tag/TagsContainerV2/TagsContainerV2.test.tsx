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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { EntityTags } from 'Models';
import { MemoryRouter } from 'react-router-dom';
import {
    LabelType,
    State,
    TagLabel,
    TagLabelMetadata,
    TagSource
} from '../../../generated/type/tagLabel';
import { ClassificationTagPickerProps } from '../../common/ClassificationTagPicker/ClassificationTagPicker';
import { GlossaryTermPickerProps } from '../../common/GlossaryTermPicker/GlossaryTermPicker';
import TagsContainerV2 from './TagsContainerV2';

const TRIGGER_STATE = {
  isOpen: false,
  toggle: jest.fn(),
  open: jest.fn(),
  close: jest.fn(),
  selectedCount: 0,
};

let capturedClassificationProps: ClassificationTagPickerProps | undefined;

jest.mock(
  '../../common/ClassificationTagPicker/ClassificationTagPicker',
  () => {
    return jest
      .fn()
      .mockImplementation((props: ClassificationTagPickerProps) => {
        capturedClassificationProps = props;

        return (
          <div data-testid="mock-classification-picker">
            {props.renderTrigger?.(TRIGGER_STATE)}
          </div>
        );
      });
  }
);

let capturedGlossaryProps: GlossaryTermPickerProps | undefined;

jest.mock('../../common/GlossaryTermPicker/GlossaryTermPicker', () => {
  return jest.fn().mockImplementation((props: GlossaryTermPickerProps) => {
    capturedGlossaryProps = props;

    return (
      <div data-testid="mock-glossary-picker">
        {props.renderTrigger?.(TRIGGER_STATE)}
      </div>
    );
  });
});

// Renders a portaled link alongside its normal output, standing in for the "+n more" popover:
// the Popover mounts overlay content in `document.body`, so it is a React-tree descendant whose
// clicks bubble through the container while being a DOM sibling of it.
jest.mock('../TagsViewer/TagsViewer', () => {
  const { createPortal } = jest.requireActual('react-dom');

  return jest.fn().mockImplementation(() => (
    <div data-testid="tags-viewer">
      {createPortal(
        <a data-testid="portaled-tag-link" href="/tag/PII">
          PII
        </a>,
        document.body
      )}
    </div>
  ));
});

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

jest.mock('../../common/WidgetCard/WidgetCard', () =>
  jest.fn().mockImplementation(({ children, dataTestId, headerExtra }) => (
    <div data-testid={dataTestId}>
      {headerExtra}
      {children}
    </div>
  ))
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
  capturedClassificationProps = undefined;

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

const renderTagsContainerInsideClickableParent = (props: {
  selectedTags: EntityTags[];
  onSelectionChange: jest.Mock;
  onParentClick: jest.Mock;
  isGlossaryType?: boolean;
  newLook?: boolean;
}) => {
  capturedClassificationProps = undefined;

  return render(
    <MemoryRouter>
      <div
        data-testid="clickable-parent"
        role="presentation"
        onClick={props.onParentClick}>
        <TagsContainerV2
          permission
          showInlineEditButton
          entityFqn="sample.db.schema.table"
          entityType="table"
          newLook={props.newLook ?? false}
          selectedTags={props.selectedTags}
          tagType={
            props.isGlossaryType ? TagSource.Glossary : TagSource.Classification
          }
          onSelectionChange={props.onSelectionChange}
        />
      </div>
    </MemoryRouter>
  );
};

const emitClassificationChange = (tags: TagLabel[]) => {
  const onChange = capturedClassificationProps?.onChange;

  if (!onChange) {
    throw new Error('ClassificationTagPicker was never rendered');
  }

  return onChange(tags);
};

describe('TagsContainerV2 handleClassificationTagsChange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedClassificationProps = undefined;
  });

  it('preserves appliedBy and appliedAt on existing tag when a new tag is added', async () => {
    const onSelectionChange = jest.fn().mockResolvedValue(undefined);
    renderTagsContainer({
      selectedTags: [personalDataTag],
      onSelectionChange,
    });

    expect(capturedClassificationProps).toBeDefined();

    await act(async () => {
      await emitClassificationChange([
        personalDataTag,
        {
          tagFQN: TIER_GOLD_FQN,
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          name: 'Tier1',
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
    renderTagsContainer({
      selectedTags: [piiSensitiveTag],
      onSelectionChange,
    });

    expect(capturedClassificationProps).toBeDefined();

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
      await emitClassificationChange([fullTag]);
    });

    expect(onSelectionChange).toHaveBeenCalledTimes(1);

    const emitted = onSelectionChange.mock.calls[0][0] as TagLabel[];
    const survived = emitted.find((t) => t.tagFQN === PERSONAL_DATA_FQN);

    for (const key of Object.keys(fullTag) as (keyof TagLabel)[]) {
      expect(survived?.[key]).toEqual(fullTag[key]);
    }
  });

  it('preserves style: null without converting it to an empty object', async () => {
    const tagWithNullStyle: EntityTags = {
      tagFQN: PERSONAL_DATA_FQN,
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
      style: null as unknown as EntityTags['style'],
      appliedBy: 'admin',
      appliedAt: new Date(APPLIED_AT_ISO),
    };

    const onSelectionChange = jest.fn().mockResolvedValue(undefined);
    renderTagsContainer({
      selectedTags: [piiSensitiveTag],
      onSelectionChange,
    });

    expect(capturedClassificationProps).toBeDefined();

    await act(async () => {
      await emitClassificationChange([tagWithNullStyle]);
    });

    expect(onSelectionChange).toHaveBeenCalledTimes(1);

    const emitted = onSelectionChange.mock.calls[0][0] as TagLabel[];
    const tag = emitted.find((t) => t.tagFQN === PERSONAL_DATA_FQN);

    expect(tag?.style).toBeNull();
  });

  it('add-one-remove-another in same save keeps surviving tag fields intact', async () => {
    const onSelectionChange = jest.fn().mockResolvedValue(undefined);
    renderTagsContainer({
      selectedTags: [personalDataTag, piiSensitiveTag],
      onSelectionChange,
    });

    expect(capturedClassificationProps).toBeDefined();

    await act(async () => {
      await emitClassificationChange([
        personalDataTag,
        {
          tagFQN: TIER_GOLD_FQN,
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
          name: 'Tier1',
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

describe('TagsContainerV2 click propagation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedClassificationProps = undefined;
  });

  // These two used to assert the opposite. Swallowing every click in the container also swallowed
  // the ones on its padding and on the gaps between chips, so on a clickable row or card the whole
  // tags column became a dead zone and the surface read as broken. Only the inner controls — the
  // tag links, the add/edit buttons, "+n more" — keep their clicks now.
  it('bubbles a click on the container itself to a clickable ancestor', () => {
    const onParentClick = jest.fn();
    renderTagsContainerInsideClickableParent({
      selectedTags: [personalDataTag],
      onSelectionChange: jest.fn().mockResolvedValue(undefined),
      onParentClick,
    });

    fireEvent.click(screen.getByTestId('tags-container'));

    expect(onParentClick).toHaveBeenCalledTimes(1);
  });

  it('bubbles a click on the glossary container itself to a clickable ancestor', () => {
    const onParentClick = jest.fn();
    renderTagsContainerInsideClickableParent({
      selectedTags: [],
      onSelectionChange: jest.fn().mockResolvedValue(undefined),
      onParentClick,
      isGlossaryType: true,
    });

    fireEvent.click(screen.getByTestId('glossary-container'));

    expect(onParentClick).toHaveBeenCalledTimes(1);
  });

  // The guard runs on the container, but the popover's content lives in `document.body`. A DOM
  // containment check treats it as foreign and lets the click through to the card behind it.
  it('keeps a click on portaled popover content from reaching the ancestor', () => {
    const onParentClick = jest.fn();
    renderTagsContainerInsideClickableParent({
      selectedTags: [personalDataTag],
      onSelectionChange: jest.fn().mockResolvedValue(undefined),
      onParentClick,
    });

    fireEvent.click(screen.getByTestId('portaled-tag-link'));

    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('keeps inner controls working while blocking propagation to the ancestor', () => {
    const onParentClick = jest.fn();
    renderTagsContainerInsideClickableParent({
      selectedTags: [personalDataTag],
      onSelectionChange: jest.fn().mockResolvedValue(undefined),
      onParentClick,
    });

    // The picker is already rendered with the trigger button inside; clicking
    // the button opens the popover without propagating to the ancestor.
    const picker = screen.getByTestId('mock-classification-picker');
    fireEvent.click(within(picker).getByTestId('edit-button'));

    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('still reaches the ancestor when the click originates outside the container', () => {
    const onParentClick = jest.fn();
    renderTagsContainerInsideClickableParent({
      selectedTags: [personalDataTag],
      onSelectionChange: jest.fn().mockResolvedValue(undefined),
      onParentClick,
    });

    fireEvent.click(screen.getByTestId('clickable-parent'));

    expect(onParentClick).toHaveBeenCalledTimes(1);
  });

  it('does not bubble newLook widget content clicks to a clickable ancestor', () => {
    const onParentClick = jest.fn();
    renderTagsContainerInsideClickableParent({
      newLook: true,
      selectedTags: [personalDataTag],
      onSelectionChange: jest.fn().mockResolvedValue(undefined),
      onParentClick,
    });

    fireEvent.click(screen.getByTestId('entity-tags'));

    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('does not bubble newLook glossary widget content clicks to a clickable ancestor', () => {
    const onParentClick = jest.fn();
    renderTagsContainerInsideClickableParent({
      newLook: true,
      isGlossaryType: true,
      selectedTags: [personalDataTag],
      onSelectionChange: jest.fn().mockResolvedValue(undefined),
      onParentClick,
    });

    fireEvent.click(screen.getByTestId('entity-tags'));

    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('keeps newLook inner controls working while blocking propagation to the ancestor', () => {
    const onParentClick = jest.fn();
    renderTagsContainerInsideClickableParent({
      newLook: true,
      selectedTags: [personalDataTag],
      onSelectionChange: jest.fn().mockResolvedValue(undefined),
      onParentClick,
    });

    const picker = screen.getByTestId('mock-classification-picker');
    fireEvent.click(within(picker).getByTestId('edit-button'));

    expect(onParentClick).not.toHaveBeenCalled();
  });
});

const GLOSSARY_MRR_FQN = 'Finance.MRR';
const GLOSSARY_ARR_FQN = 'Finance.ARR';

const mrrTerm: EntityTags = {
  tagFQN: GLOSSARY_MRR_FQN,
  source: TagSource.Glossary,
  labelType: LabelType.Automated,
  state: State.Suggested,
  appliedBy: 'bot-glossary',
  appliedAt: new Date(APPLIED_AT_ISO),
};

// A term freshly picked from the glossary listing: no server-managed fields.
const arrTerm = {
  tagFQN: GLOSSARY_ARR_FQN,
  source: TagSource.Glossary,
} as TagLabel;

const emitGlossaryChange = (terms: TagLabel[]) => {
  const onChange = capturedGlossaryProps?.onChange;

  if (!onChange) {
    throw new Error('GlossaryTermPicker was never rendered');
  }

  return onChange(terms);
};

const renderGlossaryContainer = (props: {
  selectedTags: EntityTags[];
  onSelectionChange: jest.Mock;
  newLook?: boolean;
}) => {
  capturedGlossaryProps = undefined;

  return render(
    <MemoryRouter>
      <TagsContainerV2
        permission
        showInlineEditButton
        entityFqn="sample.db.schema.table"
        entityType="table"
        newLook={props.newLook ?? true}
        selectedTags={props.selectedTags}
        tagType={TagSource.Glossary}
        onSelectionChange={props.onSelectionChange}
      />
    </MemoryRouter>
  );
};

describe('TagsContainerV2 glossary picker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedGlossaryProps = undefined;
  });

  it('anchors the picker to the add/edit icon rather than swapping the body', () => {
    renderGlossaryContainer({
      selectedTags: [mrrTerm],
      onSelectionChange: jest.fn(),
    });

    const picker = screen.getByTestId('mock-glossary-picker');

    // The icon is the picker's trigger, and the body still shows the terms.
    expect(within(picker).getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('tags-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-classification-picker')).toBeNull();
  });

  it('commits on Apply rather than per toggle', () => {
    renderGlossaryContainer({
      selectedTags: [mrrTerm],
      onSelectionChange: jest.fn(),
    });

    expect(capturedGlossaryProps?.commitMode).toBe('staged');
  });

  it('opens the popover when the icon is clicked', () => {
    renderGlossaryContainer({
      selectedTags: [mrrTerm],
      onSelectionChange: jest.fn(),
    });

    expect(capturedGlossaryProps?.isOpen).toBe(false);

    const picker = screen.getByTestId('mock-glossary-picker');
    fireEvent.click(within(picker).getByTestId('edit-button'));

    expect(capturedGlossaryProps?.isOpen).toBe(true);
  });

  it('seeds the picker with only the glossary labels', () => {
    renderGlossaryContainer({
      selectedTags: [mrrTerm, piiSensitiveTag],
      onSelectionChange: jest.fn(),
    });

    expect(capturedGlossaryProps?.value).toEqual([mrrTerm]);
  });

  it('keeps classification tags when glossary terms are saved', async () => {
    const onSelectionChange = jest.fn().mockResolvedValue(undefined);
    renderGlossaryContainer({
      selectedTags: [mrrTerm, piiSensitiveTag],
      onSelectionChange,
    });

    await act(async () => {
      await emitGlossaryChange([arrTerm]);
    });

    expect(onSelectionChange).toHaveBeenCalledWith([
      expect.objectContaining({
        tagFQN: GLOSSARY_ARR_FQN,
        source: TagSource.Glossary,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      }),
      piiSensitiveTag,
    ]);
  });

  it('preserves server-managed fields on a term that survives the save', async () => {
    const onSelectionChange = jest.fn().mockResolvedValue(undefined);
    renderGlossaryContainer({
      selectedTags: [mrrTerm],
      onSelectionChange,
    });

    // GlossaryTermPicker hands back the applied label untouched.
    await act(async () => {
      await emitGlossaryChange([mrrTerm, arrTerm]);
    });

    expect(onSelectionChange).toHaveBeenCalledWith([
      expect.objectContaining({
        tagFQN: GLOSSARY_MRR_FQN,
        appliedBy: 'bot-glossary',
        appliedAt: new Date(APPLIED_AT_ISO),
        labelType: LabelType.Automated,
        state: State.Suggested,
      }),
      expect.objectContaining({ tagFQN: GLOSSARY_ARR_FQN }),
    ]);
  });

  it('skips the save when the selection is unchanged', async () => {
    const onSelectionChange = jest.fn().mockResolvedValue(undefined);
    renderGlossaryContainer({
      selectedTags: [mrrTerm],
      onSelectionChange,
    });

    await act(async () => {
      await emitGlossaryChange([mrrTerm]);
    });

    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
