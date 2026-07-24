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
import OntologyExpressionEditor from './OntologyExpressionEditor';

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
});
