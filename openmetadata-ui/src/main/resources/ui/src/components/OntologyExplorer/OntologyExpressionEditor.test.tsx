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
import { ExpressionKind } from '../../generated/api/data/createOntologyAxiom';
import { useIsAiMode } from '../../hooks/useAppMode';
import OntologyExpressionEditor, {
  defaultExpression,
  getExpressionRenderKey,
} from './OntologyExpressionEditor';

jest.mock('../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

describe('OntologyExpressionEditor', () => {
  it('normalizes named individuals in an OWL enumeration', () => {
    const onChange = jest.fn();
    render(
      <OntologyExpressionEditor
        expression={{ individualIris: [], kind: ExpressionKind.OneOf }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://example.test/one, https://example.test/two' },
    });

    expect(onChange).toHaveBeenCalledWith({
      individualIris: ['https://example.test/one', 'https://example.test/two'],
      kind: ExpressionKind.OneOf,
    });
  });

  it('adds a typed operand to a recursive boolean expression', () => {
    const onChange = jest.fn();
    render(
      <OntologyExpressionEditor
        expression={{ kind: ExpressionKind.Intersection, operands: [] }}
        onChange={onChange}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'label.add label.constraint',
      })
    );

    expect(onChange).toHaveBeenCalledWith({
      kind: ExpressionKind.Intersection,
      operands: [{ classIri: '', kind: ExpressionKind.NamedClass }],
    });
  });

  it('keeps render identity across edits without serializing it', () => {
    const expression = defaultExpression(ExpressionKind.NamedClass);
    const renderKey = getExpressionRenderKey(expression);
    const onChange = jest.fn();
    render(
      <OntologyExpressionEditor expression={expression} onChange={onChange} />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://example.test/Customer' },
    });

    const updatedExpression = onChange.mock.calls[0][0];

    expect(updatedExpression).toEqual({
      classIri: 'https://example.test/Customer',
      kind: ExpressionKind.NamedClass,
    });
    expect(getExpressionRenderKey(updatedExpression)).toBe(renderKey);
    expect(JSON.stringify(updatedExpression)).not.toContain(renderKey);
  });

  it('keeps nested operands, add and remove working in AI mode', () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const onChange = jest.fn();
    const onRemove = jest.fn();
    render(
      <OntologyExpressionEditor
        expression={{
          kind: ExpressionKind.Union,
          operands: [{ classIri: '', kind: ExpressionKind.NamedClass }],
        }}
        onChange={onChange}
        onRemove={onRemove}
      />
    );

    expect(screen.getByTestId('ontology-expression-0')).toBeInTheDocument();
    expect(screen.getByTestId('ontology-expression-1')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'label.add label.constraint' })
    );

    expect(onChange).toHaveBeenCalledWith({
      kind: ExpressionKind.Union,
      operands: [
        { classIri: '', kind: ExpressionKind.NamedClass },
        { classIri: '', kind: ExpressionKind.NamedClass },
      ],
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'label.remove' })[0]);

    expect(onRemove).toHaveBeenCalled();

    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });
});
