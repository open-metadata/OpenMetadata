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
import { fireEvent, render, screen } from '@testing-library/react';
import { NodeViewProps } from '@tiptap/react';
import { MathEquationComponent } from './MathEquationComponent';

jest.mock('react-latex-next', () =>
  jest.fn().mockImplementation(({ children }) => <span>{children}</span>)
);

const updateAttributes = jest.fn();

const renderComponent = (isEditing: boolean) =>
  render(
    <MathEquationComponent
      {...({
        node: { attrs: { math_equation: 'x^2', isEditing } },
        updateAttributes,
        editor: { isEditable: true },
      } as unknown as NodeViewProps)}
    />
  );

describe('MathEquationComponent', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('saves the edited equation from the textarea', () => {
    renderComponent(true);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'y^2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    expect(updateAttributes).toHaveBeenCalledWith({
      math_equation: 'y^2',
      isEditing: false,
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('discards the edit on cancel', () => {
    renderComponent(true);

    fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));

    expect(updateAttributes).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('x^2')).toBeInTheDocument();
  });

  it('enters edit mode from the edit button', () => {
    renderComponent(false);

    fireEvent.click(screen.getByRole('button', { name: 'label.edit-entity' }));

    expect(screen.getByRole('textbox')).toHaveValue('x^2');
  });
});
