/*
 *  Copyright 2025 Collate.
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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../generated/type/tagLabel';
import TagsContainerV2 from '../Tag/TagsContainerV2/TagsContainerV2';
import TagsInput from './TagsInput.component';

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="tags-container">Mocked TagsContainerV2</div>
    ));
});

describe('TagsInput Component', () => {
  const mockTags: TagLabel[] = [
    {
      tagFQN: 'test.tag1',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
    {
      tagFQN: 'test.tag2',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ];

  const mockOnTagsUpdate = jest.fn();

  it('renders without crashing', () => {
    render(
      <TagsInput editable tags={mockTags} onTagsUpdate={mockOnTagsUpdate} />,
      { wrapper: MemoryRouter }
    );

    expect(screen.getByTestId('tags-input-container')).toBeInTheDocument();
  });

  it('renders in version view mode', () => {
    render(
      <TagsInput
        editable
        isVersionView
        tags={mockTags}
        onTagsUpdate={mockOnTagsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.getByText('label.tag-plural')).toBeInTheDocument();
  });

  it('renders tags in version view mode', () => {
    render(
      <TagsInput
        editable
        isVersionView
        tags={mockTags}
        onTagsUpdate={mockOnTagsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    mockTags.forEach((tag) => {
      expect(screen.getByText(tag.tagFQN)).toBeInTheDocument();
    });
  });

  it('renders TagsContainerV2 when not in version view', () => {
    render(
      <TagsInput
        editable
        isVersionView={false}
        tags={mockTags}
        onTagsUpdate={mockOnTagsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    // Verify TagsContainerV2 is rendered
    expect(screen.getByTestId('tags-container')).toBeInTheDocument();
  });

  it('handles empty tags array', () => {
    render(<TagsInput editable tags={[]} onTagsUpdate={mockOnTagsUpdate} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('tags-input-container')).toBeInTheDocument();
  });

  it('disables tag editing when editable is false', () => {
    render(
      <TagsInput
        editable={false}
        tags={mockTags}
        onTagsUpdate={mockOnTagsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    expect(TagsContainerV2).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: false,
      }),
      {}
    );
  });

  it('handles undefined tags prop', () => {
    render(<TagsInput editable onTagsUpdate={mockOnTagsUpdate} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('tags-input-container')).toBeInTheDocument();
  });
});
