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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  AxiomType,
  ExpressionKind,
  Provenance,
} from '../../../../generated/api/data/createOntologyAxiom';
import {
  Code,
  Severity,
} from '../../../../generated/api/data/ontologyProfileReport';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  createOntologyAxiom,
  validateOntologyAxiom,
} from '../../../../rest/ontologyAPI';
import OntologyAxiomEditor from './OntologyAxiomEditor';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('../../../../rest/ontologyAPI', () => ({
  createOntologyAxiom: jest.fn(),
  validateOntologyAxiom: jest.fn(),
}));

const mockCreate = createOntologyAxiom as jest.MockedFunction<
  typeof createOntologyAxiom
>;
const mockValidate = validateOntologyAxiom as jest.MockedFunction<
  typeof validateOntologyAxiom
>;
const ONTOLOGY: Ontology = {
  description: 'Governed axiom',
  displayName: 'Governed glossary',
  fullyQualifiedName: 'GovernedGlossary',
  id: 'glossary-id',
  name: 'GovernedGlossary',
  iri: 'urn:governed',
  namespace: 'urn:governed:',
};

describe('OntologyAxiomEditor', () => {
  it('keeps the subject and condition when changing between class statement types', async () => {
    render(<OntologyAxiomEditor canEdit ontology={ONTOLOGY} />);
    fireEvent.change(screen.getByRole('textbox', { name: /label.subject/ }), {
      target: { value: 'urn:Customer' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: /label.concept-iri/ }),
      { target: { value: 'urn:Person' } }
    );
    fireEvent.click(screen.getAllByRole('button', { name: /label.type/ })[0]);
    fireEvent.click(
      await screen.findByRole('option', { name: 'label.equivalent-to' })
    );

    expect(screen.getByRole('textbox', { name: /label.subject/ })).toHaveValue(
      'urn:Customer'
    );
    expect(
      screen.getByRole('textbox', { name: /label.concept-iri/ })
    ).toHaveValue('urn:Person');
    expect(screen.getByTestId('ontology-axiom-help')).toHaveTextContent(
      'message.ontology-axiom-equivalent-class-help'
    );
  });

  it.each([false, true])(
    'explains the saved statement and shows its preview with AI mode %s',
    (isAiMode) => {
      (useIsAiMode as jest.Mock).mockReturnValue(isAiMode);
      render(<OntologyAxiomEditor canEdit ontology={ONTOLOGY} />);

      expect(screen.getByTestId('ontology-axiom-help')).toHaveTextContent(
        'message.ontology-axiom-subclass-of-help'
      );
      expect(screen.getByTestId('ontology-axiom-preview')).toBeVisible();

      (useIsAiMode as jest.Mock).mockReturnValue(false);
    }
  );

  it('creates only after the live OWL profile guard accepts the typed axiom', async () => {
    mockValidate.mockResolvedValue({ valid: true, violations: [] });
    mockCreate.mockResolvedValue({
      axiomType: AxiomType.SubclassOf,
      description: ONTOLOGY.description ?? '',
      displayName: ONTOLOGY.displayName ?? ONTOLOGY.name,
      expressions: [
        {
          classIri: 'https://example.test/Class',
          kind: ExpressionKind.NamedClass,
        },
      ],
      fullyQualifiedName: 'GovernedGlossary.axiom-GovernedGlossary',
      ontology: { id: ONTOLOGY.id, type: 'ontology' },
      id: 'axiom-id',
      name: 'axiom-GovernedGlossary',
      provenance: Provenance.Manual,
      subjectIri: 'https://example.test/Subject',
    });
    render(<OntologyAxiomEditor canEdit ontology={ONTOLOGY} />);

    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.display-name' }),
      { target: { value: 'Subclass' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.description' }),
      { target: { value: 'Customer is a party' } }
    );
    fireEvent.change(screen.getByRole('textbox', { name: /label.subject/ }), {
      target: { value: 'https://example.test/Subject' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: /label\.concept-iri/ }),
      { target: { value: 'https://example.test/Class' } }
    );
    fireEvent.click(screen.getByTestId('ontology-axiom-validate'));

    await screen.findByText('label.validation-passed');
    fireEvent.click(screen.getByTestId('ontology-axiom-submit'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        axiomType: AxiomType.SubclassOf,
        expressions: [
          {
            classIri: 'https://example.test/Class',
            kind: ExpressionKind.NamedClass,
          },
        ],
        ontology: ONTOLOGY.fullyQualifiedName,
        provenance: Provenance.Manual,
        subjectIri: 'https://example.test/Subject',
      })
    );
  });

  it('keeps the type, nested expression, preview, validation and save in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    mockValidate.mockResolvedValue({
      valid: false,
      violations: [
        {
          code: Code.InvalidAxiomShape,
          message: 'Subject must be absolute',
          path: 'subject',
          severity: Severity.Error,
        },
      ],
    });
    render(<OntologyAxiomEditor canEdit ontology={ONTOLOGY} />);

    expect(screen.getByTestId('ontology-axiom-panel')).toBeInTheDocument();
    expect(screen.getByText('label.new-entity')).toBeInTheDocument();
    expect(screen.getByTestId('ontology-expression-0')).toBeInTheDocument();
    expect(screen.getByTestId('ontology-axiom-submit')).toBeDisabled();

    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.display-name' }),
      { target: { value: 'Subclass' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.description' }),
      { target: { value: 'Customer is a party' } }
    );
    fireEvent.change(screen.getByRole('textbox', { name: /label.subject/ }), {
      target: { value: 'Subject' },
    });

    expect(screen.getByTestId('ontology-axiom-preview')).toHaveTextContent(
      'Subject label.subclass-of'
    );

    fireEvent.click(screen.getByTestId('ontology-axiom-validate'));

    expect(
      await screen.findByText('label.validation-failed')
    ).toBeInTheDocument();
    expect(screen.getByText('Subject must be absolute')).toBeInTheDocument();
    expect(mockValidate).toHaveBeenCalledWith(
      expect.objectContaining({ subjectIri: 'Subject' })
    );

    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });
});

it('does not show an old validation result after the draft changes', async () => {
  let resolve!: (report: { valid: boolean; violations: [] }) => void;
  mockValidate.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    })
  );
  render(<OntologyAxiomEditor canEdit ontology={ONTOLOGY} />);
  fireEvent.change(
    screen.getByRole('textbox', { name: 'label.display-name' }),
    { target: { value: 'Subclass' } }
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'label.description' }), {
    target: { value: 'Customer is a person' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /label.subject/ }), {
    target: { value: 'urn:Customer' },
  });
  fireEvent.click(screen.getByTestId('ontology-axiom-validate'));
  fireEvent.change(screen.getByRole('textbox', { name: /label.subject/ }), {
    target: { value: '' },
  });
  await act(async () => resolve({ valid: true, violations: [] }));

  expect(screen.queryByText('label.validation-passed')).not.toBeInTheDocument();
  expect(screen.getByTestId('ontology-axiom-submit')).toBeDisabled();
});

it('offers data properties for data facts and preserves empty literal values', async () => {
  mockValidate.mockResolvedValue({ valid: true, violations: [] });
  render(
    <OntologyAxiomEditor
      canEdit
      ontology={ONTOLOGY}
      references={{
        concepts: [],
        properties: [
          { iri: 'urn:code', label: 'Code', kind: Kind.Data },
          { iri: 'urn:knows', label: 'Knows', kind: Kind.Object },
        ],
      }}
    />
  );
  fireEvent.click(screen.getAllByRole('button', { name: /label.type/ })[0]);
  fireEvent.click(
    await screen.findByRole('option', {
      name: 'label.ontology-data-property-fact',
    })
  );
  const property = screen.getByRole('combobox', { name: /label.property/ });
  fireEvent.focus(property);
  fireEvent.keyDown(property, { key: 'ArrowDown' });

  expect(
    await screen.findByRole('option', { name: /Code/ })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('option', { name: /Knows/ })
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('option', { name: /Code/ }));

  expect(
    screen.getByRole('textbox', { name: /label.value/ })
  ).not.toBeRequired();
});
