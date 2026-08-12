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
import { Language } from '../../../../generated/entity/data/metric';
import ExpressionCodeCell from './ExpressionCodeCell.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../Database/SchemaEditor/SchemaEditor', () => ({
  __esModule: true,
  default: jest.fn(({ value, onChange, mode }) => (
    <textarea
      data-mode={mode?.name}
      data-testid="schema-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )),
}));

describe('ExpressionCodeCell', () => {
  const baseProps = {
    value: 'SELECT 1',
    language: Language.SQL,
    onCommit: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render a tab for every expression language', () => {
    render(<ExpressionCodeCell {...baseProps} />);

    [
      Language.SQL,
      Language.Python,
      Language.JavaScript,
      Language.Java,
      Language.External,
    ].forEach((lang) => {
      expect(
        screen.getByTestId(`code-lang-${lang.toLowerCase()}`)
      ).toBeInTheDocument();
    });
  });

  it('should highlight with the language-mapped CodeMirror mode', () => {
    render(<ExpressionCodeCell {...baseProps} />);

    expect(screen.getByTestId('schema-editor')).toHaveAttribute(
      'data-mode',
      'sql'
    );
  });

  it('should commit the code and active language on save', () => {
    const onCommit = jest.fn();
    render(<ExpressionCodeCell {...baseProps} onCommit={onCommit} />);

    fireEvent.click(screen.getByTestId('code-editor-save'));

    expect(onCommit).toHaveBeenCalledWith('SELECT 1', Language.SQL);
  });

  it('should switch language via tabs (updates mode + committed language)', () => {
    const onCommit = jest.fn();
    render(<ExpressionCodeCell {...baseProps} onCommit={onCommit} />);

    fireEvent.click(screen.getByTestId('code-lang-python'));

    expect(screen.getByTestId('schema-editor')).toHaveAttribute(
      'data-mode',
      'python'
    );

    fireEvent.click(screen.getByTestId('code-editor-save'));

    expect(onCommit).toHaveBeenCalledWith('SELECT 1', Language.Python);
  });

  it('should cancel without committing', () => {
    const onCancel = jest.fn();
    const onCommit = jest.fn();
    render(
      <ExpressionCodeCell
        {...baseProps}
        onCancel={onCancel}
        onCommit={onCommit}
      />
    );

    fireEvent.click(screen.getByTestId('code-editor-cancel'));

    expect(onCancel).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
