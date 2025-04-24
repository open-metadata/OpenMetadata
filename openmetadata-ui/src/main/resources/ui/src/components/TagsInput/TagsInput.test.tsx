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
import { MemoryRouter } from 'react-router-dom';
import { LabelType, State, TagSource } from '../../generated/type/tagLabel';
import TagsInput from './TagsInput.component';

const mockOnTagsUpdate = jest.fn();

const tags = [
  {
    tagFQN: 'tag1',
    displayName: 'Tag 1',
    labelType: LabelType.Automated,
    source: TagSource.Classification,
    state: State.Confirmed,
  },
  {
    tagFQN: 'tag2',
    displayName: 'Tag 2',
    description: 'This is a sample tag description.',
    labelType: LabelType.Derived,
    source: TagSource.Glossary,
    state: State.Suggested,
  },
];

describe('TagsInput', () => {
  it('should render TagsInput along with tagsViewer in version view', async () => {
    await act(async () => {
      render(
        <TagsInput
          isVersionView
          editable={false}
          tags={tags}
          onTagsUpdate={mockOnTagsUpdate}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(
      await screen.findByTestId('tags-input-container')
    ).toBeInTheDocument();
    expect(await screen.findByText('label.tag-plural')).toBeInTheDocument();
    expect(await screen.findByText('Tag 1')).toBeInTheDocument();
    expect(await screen.findByText('Tag 2')).toBeInTheDocument();
  });

  it('should render tags container when not in in version view', async () => {
    await act(async () => {
      render(
        <TagsInput
          editable={false}
          tags={tags}
          onTagsUpdate={mockOnTagsUpdate}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(
      await screen.findByTestId('tags-input-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('tags-container')).toBeInTheDocument();

    expect(await screen.findByText('label.tag-plural')).toBeInTheDocument();
    expect(await screen.findByText('Tag 1')).toBeInTheDocument();
  });

  it('should render edit button when no editable', async () => {
    await act(async () => {
      render(
        <TagsInput editable tags={tags} onTagsUpdate={mockOnTagsUpdate} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(await screen.findByTestId('edit-button')).toBeInTheDocument();
  });

  it('should not render edit button when no editable', async () => {
    await act(async () => {
      render(
        <TagsInput
          editable={false}
          tags={tags}
          onTagsUpdate={mockOnTagsUpdate}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(await screen.queryByTestId('edit-button')).not.toBeInTheDocument();
  });

  it('should not render tags if tags is empty', async () => {
    await act(async () => {
      render(
        <TagsInput
          editable={false}
          tags={[]}
          onTagsUpdate={mockOnTagsUpdate}
        />,
        {
          wrapper: MemoryRouter,
        }
      );

      expect(await screen.findByTestId('tags-container')).toBeInTheDocument();
      expect(await screen.findByTestId('entity-tags')).toBeInTheDocument();
      expect(await screen.findByText('--')).toBeInTheDocument();
    });
  });

  it('should render add tags if tags is empty and has permission', async () => {
    await act(async () => {
      render(<TagsInput editable tags={[]} onTagsUpdate={mockOnTagsUpdate} />, {
        wrapper: MemoryRouter,
      });

      expect(await screen.findByTestId('entity-tags')).toBeInTheDocument();
      expect(await screen.findByTestId('add-tag')).toBeInTheDocument();
    });
  });
});
