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
import { fireEvent, render, screen } from '@testing-library/react';
import SectionWithEdit from './SectionWithEdit';

// Mock i18n Typography usage is internal to antd; we don't need a full mock of antd
// Mock SVG icon used by the button to avoid SVG import issues
jest.mock('../../../assets/svg/edit.svg', () => ({
  ReactComponent: () => <div data-testid="edit-icon">E</div>,
}));

describe('SectionWithEdit', () => {
  it('renders string title inside Typography and children', () => {
    const { container } = render(
      <SectionWithEdit title="My Title">Content</SectionWithEdit>
    );

    expect(container.querySelector('.section-with-edit')).toBeInTheDocument();
    expect(container.querySelector('.section-header')).toBeInTheDocument();
    expect(container.querySelector('.section-content')).toBeInTheDocument();

    const titleEl = container.querySelector('.section-title');

    expect(titleEl).toBeInTheDocument();
    expect(titleEl).toHaveTextContent('My Title');

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders node title as-is without Typography', () => {
    const node = <h3 data-testid="custom-title">Node Title</h3>;
    const { container } = render(
      <SectionWithEdit title={node}>Content</SectionWithEdit>
    );

    expect(screen.getByTestId('custom-title')).toBeInTheDocument();
    expect(container.querySelector('.section-title')).toBeNull();
  });

  it('shows edit button when showEditButton is true and onEdit provided', () => {
    const onEdit = jest.fn();

    render(
      <SectionWithEdit showEditButton title="Title" onEdit={onEdit}>
        Content
      </SectionWithEdit>
    );

    const button = screen.getByTestId('edit-button');

    expect(button).toBeInTheDocument();
    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();

    fireEvent.click(button);

    expect(onEdit).toHaveBeenCalled();
  });

  it('hides edit button when showEditButton is false', () => {
    render(
      <SectionWithEdit showEditButton={false} title="Title">
        Content
      </SectionWithEdit>
    );

    expect(screen.queryByTestId('edit-button')).toBeNull();
  });

  it('hides edit button when onEdit is not provided', () => {
    render(<SectionWithEdit title="Title">Content</SectionWithEdit>);

    expect(screen.queryByTestId('edit-button')).toBeNull();
  });

  it('applies custom class names to wrapper, header and content', () => {
    const { container } = render(
      <SectionWithEdit
        className="wrap"
        contentClassName="cnt"
        title="Title"
        titleClassName="hdr">
        Content
      </SectionWithEdit>
    );

    expect(container.querySelector('.section-with-edit')).toHaveClass('wrap');
    expect(container.querySelector('.section-header')).toHaveClass('hdr');
    expect(container.querySelector('.section-content')).toHaveClass('cnt');
  });
});
