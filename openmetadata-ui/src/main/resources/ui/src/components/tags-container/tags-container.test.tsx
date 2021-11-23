import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import TagsContainer from './tags-container';

const tagList = ['tag 1', 'tag 2', 'tag 3'];
const onCancel = jest.fn();
const onSelectionChange = jest.fn();

describe('Test TagsContainer Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <TagsContainer
        editable
        selectedTags={[]}
        tagList={tagList}
        onCancel={onCancel}
        onSelectionChange={onSelectionChange}
      />
    );
    const TagContainer = getByTestId(container, 'tag-conatiner');

    expect(TagContainer).toBeInTheDocument();
  });

  it('should have two buttons', () => {
    const { container } = render(
      <TagsContainer
        editable
        selectedTags={[]}
        tagList={tagList}
        onCancel={onCancel}
        onSelectionChange={onSelectionChange}
      />
    );
    const buttons = getByTestId(container, 'buttons');

    expect(buttons.childElementCount).toBe(2);
  });
});
