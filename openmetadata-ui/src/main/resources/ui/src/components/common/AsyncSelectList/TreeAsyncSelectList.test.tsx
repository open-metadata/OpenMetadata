/*
 *  Copyright 2024 Collate.
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
import { act, render, screen } from '@testing-library/react';
import { TagSource } from '../../../generated/type/tagLabel';
import { SelectOption } from './AsyncSelectList.interface';
import TreeAsyncSelectList from './TreeAsyncSelectList';

const MOCK_GLOSSARY_TREE = [
  {
    id: 'glossary-1',
    value: 'Glossary',
    name: 'Glossary',
    title: 'Glossary',
    'data-testid': 'tag-Glossary',
    checkable: false,
    isLeaf: false,
    selectable: false,
  },
];

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossariesList: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'glossary-1',
        name: 'Glossary',
        fullyQualifiedName: 'Glossary',
      },
    ],
  }),
  getGlossaryTerms: jest.fn(),
  queryGlossaryTerms: jest.fn(),
  searchGlossaryTerms: jest.fn(),
}));

const mockConvertGlossaryTermsToTreeOptions = jest.fn();

jest.mock('../../../utils/GlossaryUtils', () => ({
  convertGlossaryTermsToTreeOptions: (...args) =>
    mockConvertGlossaryTermsToTreeOptions(...args),
}));

jest.mock('../../../utils/GlossaryPureUtils', () => ({
  ...jest.requireActual('../../../utils/GlossaryPureUtils'),
  filterTreeNodeOptions: jest.fn().mockImplementation((data) => data),
  findItemByFqn: jest.fn().mockReturnValue(null),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

jest.mock('../../../utils/TagsPureUtils', () => ({
  getTagDisplay: jest.fn().mockImplementation((value) => value),
}));

jest.mock('../../../utils/TagsUtils', () => ({
  tagRender: jest.fn().mockReturnValue(<span>tag</span>),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/StringUtils', () => ({
  escapeESReservedCharacters: jest.fn().mockImplementation((v) => v),
  getEncodedFqn: jest.fn().mockImplementation((v) => v),
}));

jest.mock('../../Tag/TagsV1/TagsV1.component', () =>
  jest.fn().mockReturnValue(<span>TagsV1</span>)
);

describe('TreeAsyncSelectList', () => {
  const onChange = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConvertGlossaryTermsToTreeOptions.mockReturnValue([]);
  });

  it('should render the component', async () => {
    await act(async () => {
      render(
        <TreeAsyncSelectList
          initialOptions={[]}
          isSubmitLoading={false}
          tagType={TagSource.Glossary}
          onCancel={onCancel}
          onChange={onChange}
        />
      );
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
  });

  it('should render in single-select mode without treeCheckable', async () => {
    await act(async () => {
      render(
        <TreeAsyncSelectList
          initialOptions={[]}
          isMultiSelect={false}
          isSubmitLoading={false}
          tagType={TagSource.Glossary}
          onCancel={onCancel}
          onChange={onChange}
        />
      );
    });

    const selector = screen.getByTestId('tag-selector');

    expect(selector).toBeInTheDocument();
  });

  it('should inject initial option into treeData when term is missing from tree', async () => {
    mockConvertGlossaryTermsToTreeOptions.mockImplementation(() => {
      return JSON.parse(JSON.stringify(MOCK_GLOSSARY_TREE));
    });

    const initialOptions: SelectOption[] = [
      {
        value: 'Glossary.term1',
        label: 'Glossary.term1',
        data: {
          tagFQN: 'Glossary.term1',
          name: 'term1',
          displayName: 'Term One',
        } as SelectOption['data'],
      },
    ];

    await act(async () => {
      render(
        <TreeAsyncSelectList
          initialOptions={initialOptions}
          isMultiSelect={false}
          isSubmitLoading={false}
          tagType={TagSource.Glossary}
          onCancel={onCancel}
          onChange={onChange}
        />
      );
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
    expect(mockConvertGlossaryTermsToTreeOptions).toHaveBeenCalled();
  });

  it('should not inject when term already exists in treeData', async () => {
    const treeWithTerm = [
      {
        ...MOCK_GLOSSARY_TREE[0],
        children: [
          {
            id: 'term-1',
            value: 'Glossary.term1',
            name: 'term1',
            title: 'term1',
            checkable: true,
            isLeaf: true,
            selectable: true,
          },
        ],
      },
    ];
    mockConvertGlossaryTermsToTreeOptions.mockReturnValue(treeWithTerm);

    const initialOptions: SelectOption[] = [
      {
        value: 'Glossary.term1',
        label: 'Glossary.term1',
        data: {
          tagFQN: 'Glossary.term1',
          name: 'term1',
        } as SelectOption['data'],
      },
    ];

    await act(async () => {
      render(
        <TreeAsyncSelectList
          initialOptions={initialOptions}
          isMultiSelect={false}
          isSubmitLoading={false}
          tagType={TagSource.Glossary}
          onCancel={onCancel}
          onChange={onChange}
        />
      );
    });

    expect(treeWithTerm[0].children).toHaveLength(1);
  });

  it('should normalize array value to scalar in single-select mode', async () => {
    mockConvertGlossaryTermsToTreeOptions.mockReturnValue(
      JSON.parse(JSON.stringify(MOCK_GLOSSARY_TREE))
    );

    const initialOptions: SelectOption[] = [
      {
        value: 'Glossary.term1',
        label: 'Glossary.term1',
        data: {
          tagFQN: 'Glossary.term1',
          name: 'term1',
          displayName: 'Term One',
        } as SelectOption['data'],
      },
    ];

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      render(
        <TreeAsyncSelectList
          initialOptions={initialOptions}
          isMultiSelect={false}
          isSubmitLoading={false}
          tagType={TagSource.Glossary}
          value={['Glossary.term1'] as unknown as string[]}
          onCancel={onCancel}
          onChange={onChange}
        />
      );
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();

    const treeSelectWarning = warnSpy.mock.calls.find((call) =>
      String(call[0]).includes(
        'value should not be array when TreeSelect is single mode'
      )
    );

    expect(treeSelectWarning).toBeUndefined();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should keep array value in multi-select mode', async () => {
    mockConvertGlossaryTermsToTreeOptions.mockReturnValue([]);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      render(
        <TreeAsyncSelectList
          initialOptions={[]}
          isSubmitLoading={false}
          tagType={TagSource.Glossary}
          value={['Glossary.term1', 'Glossary.term2']}
          onCancel={onCancel}
          onChange={onChange}
        />
      );
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it('should handle empty initialOptions without injecting', async () => {
    mockConvertGlossaryTermsToTreeOptions.mockReturnValue(
      JSON.parse(JSON.stringify(MOCK_GLOSSARY_TREE))
    );

    await act(async () => {
      render(
        <TreeAsyncSelectList
          initialOptions={[]}
          isMultiSelect={false}
          isSubmitLoading={false}
          tagType={TagSource.Glossary}
          onCancel={onCancel}
          onChange={onChange}
        />
      );
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
  });

  it('should skip injection when parent glossary is not found in tree', async () => {
    mockConvertGlossaryTermsToTreeOptions.mockReturnValue(
      JSON.parse(JSON.stringify(MOCK_GLOSSARY_TREE))
    );

    const initialOptions: SelectOption[] = [
      {
        value: 'UnknownGlossary.term1',
        label: 'UnknownGlossary.term1',
        data: {
          tagFQN: 'UnknownGlossary.term1',
          name: 'term1',
        } as SelectOption['data'],
      },
    ];

    await act(async () => {
      render(
        <TreeAsyncSelectList
          initialOptions={initialOptions}
          isMultiSelect={false}
          isSubmitLoading={false}
          tagType={TagSource.Glossary}
          onCancel={onCancel}
          onChange={onChange}
        />
      );
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
  });

  it('should skip injection for single-segment FQN values', async () => {
    mockConvertGlossaryTermsToTreeOptions.mockReturnValue(
      JSON.parse(JSON.stringify(MOCK_GLOSSARY_TREE))
    );

    const initialOptions: SelectOption[] = [
      {
        value: 'SingleSegment',
        label: 'SingleSegment',
      },
    ];

    await act(async () => {
      render(
        <TreeAsyncSelectList
          initialOptions={initialOptions}
          isMultiSelect={false}
          isSubmitLoading={false}
          tagType={TagSource.Glossary}
          onCancel={onCancel}
          onChange={onChange}
        />
      );
    });

    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
  });
});
