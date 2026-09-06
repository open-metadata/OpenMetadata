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
import { act, render, screen, waitFor } from '@testing-library/react';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import TagSelectForm from '../../Tag/TagsSelectForm/TagsSelectForm.component';
import { SelectOption } from './AsyncSelectList.interface';

jest.mock('lodash', () => {
  const actual = jest.requireActual('lodash');

  actual.debounce = jest.fn((fn) => fn);

  return actual;
});

jest.mock('../../../rest/glossaryAPI', () => {
  const root = {
    id: 'glossary-1',
    name: 'Glossary',
    fullyQualifiedName: 'Glossary',
    mutuallyExclusive: false,
  };
  const term = {
    id: 'term-1',
    name: 'term1',
    displayName: 'Term 1',
    fullyQualifiedName: 'Glossary.term1',
  };

  return {
    getGlossariesList: jest.fn().mockResolvedValue({
      data: [root],
    }),
    queryGlossaryTerms: jest.fn().mockResolvedValue([
      {
        ...root,
        children: [term],
      },
    ]),
    searchGlossaryTerms: jest.fn().mockResolvedValue([]),
  };
});

// Faithful reimplementation of convertGlossaryTermsToTreeOptions so the test
// exercises the real TreeAsyncSelectList injection logic without loading the
// real GlossaryUtils module (whose module-level lazy() imports hang the jsdom
// renderer). Matches the real node shape: value=fullyQualifiedName,
// title=displayName||name, checkable/selectable/isLeaf flipped at level>0.
jest.mock('../../../utils/GlossaryUtils', () => {
  type MockNode = {
    id?: string;
    fullyQualifiedName?: string;
    name?: string;
    displayName?: string;
    mutuallyExclusive?: boolean;
    style?: { color?: string };
    children?: MockNode[];
  };
  const getEntityName = (entity: { name?: string; displayName?: string }) =>
    entity?.displayName || entity?.name || '';

  const convertGlossaryTermsToTreeOptions = (
    options: MockNode[] = [],
    level = 0,
    allowParentSelection = false,
    parentMutuallyExclusive = false
  ): Record<string, unknown>[] =>
    options.map((option) => {
      const hasChildren =
        'children' in option &&
        Array.isArray(option.children) &&
        option.children.length > 0;
      const isGlossaryTerm = level !== 0;

      return {
        id: option.id,
        value: option.fullyQualifiedName,
        name: option.name,
        title: getEntityName(option),
        'data-testid': `tag-${option.fullyQualifiedName}`,
        checkable: allowParentSelection || isGlossaryTerm,
        isLeaf: isGlossaryTerm ? !hasChildren : false,
        selectable: allowParentSelection || isGlossaryTerm,
        isParentMutuallyExclusive: parentMutuallyExclusive,
        children: hasChildren
          ? convertGlossaryTermsToTreeOptions(
              option.children as MockNode[],
              level + 1,
              allowParentSelection,
              option.mutuallyExclusive === true
            )
          : false,
      };
    });

  return {
    convertGlossaryTermsToTreeOptions,
    buildTree: jest.fn(),
    findGlossaryTermByFqn: jest.fn(),
    filterTreeNodeOptions: jest.fn((data: unknown) => data),
  };
});

// Keep TagsV1 light in jsdom but preserve the `data-testid` it receives via
// tagProps so the multi-select chip can still be located.
jest.mock('../../Tag/TagsV1/TagsV1.component', () => ({
  __esModule: true,
  default: ({
    tag,
    tagProps,
  }: {
    tag?: { tagFQN?: string; displayName?: string; name?: string };
    tagProps?: Record<string, unknown>;
  }) => (
    <span
      data-testid={
        (tagProps?.['data-testid'] as string | undefined) ??
        `tagsv1-${tag?.tagFQN}`
      }>
      {tag?.displayName || tag?.name}
    </span>
  ),
}));

const tagData: SelectOption[] = [
  {
    label: 'Glossary.term1',
    value: 'Glossary.term1',
    data: {
      tagFQN: 'Glossary.term1',
      name: 'term1',
      displayName: 'Term 1',
      source: TagSource.Glossary,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  },
];

const renderForm = (props: Record<string, unknown>) =>
  render(
    <TagSelectForm
      defaultValue={['Glossary.term1']}
      placeholder="Select glossary term"
      tagData={tagData}
      tagType={TagSource.Glossary}
      onCancel={jest.fn()}
      onSubmit={jest.fn()}
      {...props}
    />
  );

describe('TagSelectForm single/multi-select glossary regression', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const arrayValueWarnings = () =>
    consoleErrorSpy.mock.calls.filter(
      (args) =>
        typeof args[0] === 'string' &&
        args[0].includes('should not be array when')
    );

  it('single-select: renders the friendly display name with no array-value warning and survives the async glossary recompute', async () => {
    await act(async () => {
      renderForm({ multiSelect: false });
    });

    // After getGlossariesList resolves, treeData recomputes and the assigned
    // leaf is re-injected under its parent glossary, so the SingleSelector
    // resolves the friendly title (displayName) rather than the raw FQN.
    await waitFor(() => {
      const item = document.querySelector('.ant-select-selection-item');

      expect(item?.textContent).toBe('Term 1');
    });

    const selectionItem = document.querySelector('.ant-select-selection-item');

    expect(selectionItem?.textContent).not.toBe('Glossary.term1');
    expect(arrayValueWarnings()).toHaveLength(0);
  });

  it('single-select with no assigned term: renders without a value and without the array-value warning', async () => {
    await act(async () => {
      renderForm({
        multiSelect: false,
        defaultValue: [],
        tagData: [],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
    });

    expect(document.querySelector('.ant-select-selection-item')).toBeNull();
    expect(arrayValueWarnings()).toHaveLength(0);
  });

  it('multi-select: still renders the assigned term as a chip via customTagRender (no regression)', async () => {
    await act(async () => {
      renderForm({ multiSelect: true });
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('selected-tag-Glossary.term1')
      ).toBeInTheDocument();
    });

    expect(arrayValueWarnings()).toHaveLength(0);
  });
});
