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
  within,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import {
  AxiomType,
  ExpressionKind,
  Provenance,
  RestrictionKind,
} from '../../../../generated/api/data/createOntologyAxiom';
import {
  Code,
  Severity,
} from '../../../../generated/api/data/ontologyProfileReport';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyAxiom } from '../../../../generated/entity/data/ontologyAxiom';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  createOntologyAxiom,
  validateOntologyAxiom,
} from '../../../../rest/ontologyAPI';
import OntologyAxiomEditor from './OntologyAxiomEditor';

jest.mock('react-i18next', () => {
  const english = jest.requireActual('../../../../locale/languages/en-us.json');
  const t = (key: string, options: Record<string, string> = {}) => {
    const [section, ...rest] = key.split('.');
    const text: string = english[section]?.[rest.join('.')] ?? key;

    return text.replace(/\{\{(\w+)\}\}/g, (_, name) => options[name] ?? '');
  };
  const translation = {
    i18n: { language: 'en-US', dir: () => 'ltr' },
    t,
  };

  return {
    ...jest.requireActual('react-i18next'),
    useTranslation: () => translation,
  };
});
jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('../../../../rest/ontologyAPI', () => ({
  createOntologyAxiom: jest.fn(),
  patchOntologyAxiom: jest.fn(),
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
const REFERENCES = {
  concepts: [
    { iri: 'urn:Patient', label: 'Patient' },
    { iri: 'urn:Person', label: 'Person' },
    { iri: 'urn:Medicine', label: 'Medicine' },
  ],
  properties: [
    { iri: 'urn:dateOfBirth', kind: Kind.Data, label: 'dateOfBirth' },
    { iri: 'urn:prescribedBy', kind: Kind.Object, label: 'prescribedBy' },
  ],
};
const VALID = { valid: true, violations: [] };

const pick = async (name: RegExp, text: string, option: RegExp) => {
  const input = screen.getByRole('combobox', { name });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
};

const choose = async (label: RegExp, option: string) => {
  fireEvent.click(screen.getAllByRole('button', { name: label })[0]);
  fireEvent.click(await screen.findByRole('option', { name: option }));
};

const preview = () => screen.getByTestId('ontology-axiom-preview');

const renderEditor = (
  props: Partial<Parameters<typeof OntologyAxiomEditor>[0]> = {}
) =>
  render(
    <OntologyAxiomEditor
      canEdit
      ontology={ONTOLOGY}
      references={REFERENCES}
      {...props}
    />
  );

const savedAxiom = (overrides: Partial<OntologyAxiom> = {}): OntologyAxiom => ({
  axiomType: AxiomType.SubclassOf,
  description: 'Patient must have exactly 1 dateOfBirth',
  displayName: 'Patient must have exactly 1 dateOfBirth',
  expressions: [
    {
      cardinality: 1,
      kind: ExpressionKind.Restriction,
      propertyIri: 'urn:dateOfBirth',
      restrictionKind: RestrictionKind.Exact,
    },
  ],
  fullyQualifiedName: 'GovernedGlossary.rule',
  id: 'axiom-id',
  name: 'rule',
  ontology: { id: ONTOLOGY.id, type: 'ontology' },
  provenance: Provenance.Manual,
  subjectIri: 'urn:Patient',
  version: 0.1,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockValidate.mockResolvedValue(VALID);
});

describe('OntologyAxiomEditor quick form', () => {
  it('writes Patient must have exactly 1 dateOfBirth and saves it without an IRI typed', async () => {
    mockCreate.mockResolvedValue(savedAxiom());
    renderEditor();

    await pick(/^Subject/, 'Pat', /Patient/);
    await pick(/^Property/, 'date', /dateOfBirth/);

    expect(preview()).toHaveTextContent(
      'Patient must have exactly 1 dateOfBirth'
    );

    await waitFor(() =>
      expect(screen.getByTestId('ontology-axiom-submit')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('ontology-axiom-submit'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));

    expect(mockCreate.mock.calls[0][0]).toEqual({
      axiomType: AxiomType.SubclassOf,
      description: 'Patient must have exactly 1 dateOfBirth',
      displayName: 'Patient must have exactly 1 dateOfBirth',
      expressions: [
        {
          cardinality: 1,
          kind: ExpressionKind.Restriction,
          propertyIri: 'urn:dateOfBirth',
          restrictionKind: RestrictionKind.Exact,
        },
      ],
      name: expect.stringMatching(
        /^patient-must-have-exactly-1-dateofbirth-[0-9a-f]{6}$/
      ),
      ontology: 'GovernedGlossary',
      provenance: Provenance.Manual,
      subjectIri: 'urn:Patient',
    });
  });

  it('changes the quantifier and count in the sentence and the saved cardinality', async () => {
    mockCreate.mockResolvedValue(savedAxiom());
    renderEditor();
    await pick(/^Subject/, 'Pat', /Patient/);
    await pick(/^Property/, 'date', /dateOfBirth/);
    await choose(/Quantity/, 'at most');
    fireEvent.change(screen.getByRole('spinbutton', { name: /Cardinality/ }), {
      target: { value: '3' },
    });

    expect(preview()).toHaveTextContent(
      'Patient must have at most 3 dateOfBirth'
    );

    await waitFor(() =>
      expect(screen.getByTestId('ontology-axiom-submit')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('ontology-axiom-submit'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));

    expect(mockCreate.mock.calls[0][0].expressions).toEqual([
      {
        cardinality: 3,
        kind: ExpressionKind.Restriction,
        propertyIri: 'urn:dateOfBirth',
        restrictionKind: RestrictionKind.Max,
      },
    ]);
  });

  it.each([
    [
      'can never also be',
      AxiomType.DisjointWith,
      'Medicine can never also be Person',
    ],
    [
      'is the same as',
      AxiomType.EquivalentClass,
      'Medicine is the same as Person',
    ],
  ])(
    'writes a %s rule as one named class and saves the matching axiom type',
    async (relation, axiomType, sentence) => {
      mockCreate.mockResolvedValue(savedAxiom({ axiomType }));
      renderEditor();
      await pick(/^Subject/, 'Medi', /Medicine/);
      await choose(/Rule/, relation);
      await pick(/^Concept/, 'Per', /Person/);

      expect(preview()).toHaveTextContent(sentence);

      await waitFor(() =>
        expect(screen.getByTestId('ontology-axiom-submit')).toBeEnabled()
      );
      fireEvent.click(screen.getByTestId('ontology-axiom-submit'));

      await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));

      expect(mockCreate.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          axiomType,
          displayName: sentence,
          expressions: [
            { classIri: 'urn:Person', kind: ExpressionKind.NamedClass },
          ],
          subjectIri: 'urn:Medicine',
        })
      );
    }
  );

  it.each([
    [
      'must have',
      'Every member of the subject must have this many values for the property',
    ],
    [
      'can never also be',
      'If anything is made both, validation reports a conflict.',
    ],
    ['is the same as', 'have exactly the same members'],
  ])('explains the %s rule under the form', async (relation, help) => {
    renderEditor();
    await choose(/Rule/, relation);

    expect(screen.getByTestId('ontology-rule-quick-help')).toHaveTextContent(
      help
    );
  });

  it('keeps a typed display name and description instead of the sentence', async () => {
    mockCreate.mockResolvedValue(savedAxiom());
    renderEditor();
    await pick(/^Subject/, 'Pat', /Patient/);
    await pick(/^Property/, 'date', /dateOfBirth/);
    fireEvent.change(
      screen.getByRole('textbox', { name: /Display Name \(Optional\)/ }),
      { target: { value: 'Birth date required' } }
    );
    await waitFor(() =>
      expect(screen.getByTestId('ontology-axiom-submit')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('ontology-axiom-submit'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));

    expect(mockCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        description: 'Patient must have exactly 1 dateOfBirth',
        displayName: 'Birth date required',
      })
    );
  });

  it('keeps Save disabled and shows no error while a field is still empty', async () => {
    renderEditor();
    await pick(/^Subject/, 'Pat', /Patient/);

    expect(screen.getByTestId('ontology-axiom-submit')).toBeDisabled();
    expect(mockValidate).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('ontology-axiom-profile')
    ).not.toBeInTheDocument();
  });
});

describe('OntologyAxiomEditor server reasons', () => {
  it('shows the 400 reason next to the subject field when the pasted address is rejected', async () => {
    mockValidate.mockRejectedValue({
      response: {
        data: { code: 400, message: 'subjectIri must be an absolute IRI' },
        status: 400,
      },
    } as AxiosError);
    renderEditor();
    fireEvent.change(screen.getByRole('combobox', { name: /^Subject/ }), {
      target: { value: 'not an iri' },
    });
    await pick(/^Property/, 'date', /dateOfBirth/);

    expect(
      await screen.findByText('subjectIri must be an absolute IRI')
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Subject/ })).toBeInvalid();
    expect(screen.getByTestId('ontology-axiom-submit')).toBeDisabled();
  });

  it('shows a violation next to the property it names and leaves unrelated ones in the summary', async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      violations: [
        {
          code: Code.UndeclaredProperty,
          message: 'The property is not declared in this ontology',
          path: '/expressions/0/propertyIri',
          severity: Severity.Error,
        },
        {
          code: Code.InvalidAxiomShape,
          message: 'The statement is not valid OWL',
          path: '/axiomType',
          severity: Severity.Error,
        },
      ],
    });
    renderEditor();
    await pick(/^Subject/, 'Pat', /Patient/);
    await pick(/^Property/, 'date', /dateOfBirth/);

    const field = await screen.findByText(
      'The property is not declared in this ontology'
    );

    expect(field.closest('[data-testid="ontology-axiom-profile"]')).toBeNull();
    expect(
      within(screen.getByTestId('ontology-axiom-profile')).getByText(
        'The statement is not valid OWL'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('ontology-axiom-submit')).toBeDisabled();
  });

  it('lets a clash warning through and lists it, because the server saves with a warning', async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      violations: [
        {
          code: Code.DisjointClash,
          conceptIds: ['a', 'b'],
          message: 'Dog is disjoint with its ancestor Animal',
          path: '/expressions',
          severity: Severity.Warning,
        },
      ],
    });
    renderEditor();
    await pick(/^Subject/, 'Medi', /Medicine/);
    await choose(/Rule/, 'can never also be');
    await pick(/^Concept/, 'Per', /Person/);

    expect(
      await screen.findByText('Dog is disjoint with its ancestor Animal')
    ).toBeInTheDocument();
    expect(screen.getByTestId('ontology-axiom-submit')).toBeEnabled();
  });
});

describe('OntologyAxiomEditor quick and advanced forms', () => {
  it('converts a quick rule to advanced and back without losing the rule', async () => {
    renderEditor();
    await pick(/^Subject/, 'Pat', /Patient/);
    await pick(/^Property/, 'date', /dateOfBirth/);

    fireEvent.click(screen.getByTestId('ontology-axiom-mode-advanced'));

    expect(screen.getByTestId('ontology-expression-0')).toBeInTheDocument();
    expect(
      (screen.getByRole('textbox', { name: /Rule name/ }) as HTMLInputElement)
        .value
    ).toMatch(/^patient-must-have-exactly-1-dateofbirth-[0-9a-f]{6}$/);
    expect(preview()).toHaveTextContent(
      'Patient must have exactly 1 dateOfBirth'
    );

    fireEvent.click(screen.getByTestId('ontology-axiom-mode-quick'));

    expect(
      screen.queryByTestId('ontology-axiom-quick-lossy')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Subject/ })).toHaveValue(
      'Patient'
    );
    expect(screen.getByRole('combobox', { name: /^Property/ })).toHaveValue(
      'dateOfBirth'
    );
  });

  it('stays advanced and says why when the rule is a fact about an individual', async () => {
    renderEditor();
    await pick(/^Subject/, 'Pat', /Patient/);
    fireEvent.click(screen.getByTestId('ontology-axiom-mode-advanced'));
    await choose(/Type/, 'Class membership');
    fireEvent.click(screen.getByTestId('ontology-axiom-mode-quick'));

    expect(screen.getByTestId('ontology-axiom-quick-lossy')).toHaveTextContent(
      'This rule states a fact about an individual, which the quick form cannot show. The advanced form stays.'
    );
    expect(screen.queryByTestId('ontology-rule-quick')).not.toBeInTheDocument();
  });

  it('stays advanced and says why when the condition uses options the quick form lacks', async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('ontology-axiom-mode-advanced'));
    await choose(/Cardinality = Constraint Type/, 'At least one');
    fireEvent.click(screen.getByTestId('ontology-axiom-mode-quick'));

    expect(screen.getByTestId('ontology-axiom-quick-lossy')).toHaveTextContent(
      'This condition uses options the quick form cannot show, so converting would lose them. The advanced form stays.'
    );
  });

  it('opens a saved cardinality rule in the quick form with its values', () => {
    renderEditor({ axiom: savedAxiom() });

    expect(screen.getByRole('combobox', { name: /^Subject/ })).toHaveValue(
      'Patient'
    );
    expect(screen.getByRole('combobox', { name: /^Property/ })).toHaveValue(
      'dateOfBirth'
    );
    expect(preview()).toHaveTextContent(
      'Patient must have exactly 1 dateOfBirth'
    );
  });

  it('opens a rule with a nested condition in the advanced form and explains why', () => {
    renderEditor({
      axiom: savedAxiom({
        expressions: [
          {
            kind: ExpressionKind.Intersection,
            operands: [
              { classIri: 'urn:Person', kind: ExpressionKind.NamedClass },
              {
                kind: ExpressionKind.Restriction,
                propertyIri: 'urn:prescribedBy',
                restrictionKind: RestrictionKind.Some,
                filler: {
                  classIri: 'urn:Medicine',
                  kind: ExpressionKind.NamedClass,
                },
              },
            ],
          },
        ],
      }),
    });

    expect(screen.getByTestId('ontology-expression-0')).toBeInTheDocument();
    expect(screen.getByTestId('ontology-axiom-quick-lossy')).toBeVisible();
    expect(screen.getByRole('textbox', { name: /Rule name/ })).toBeDisabled();
  });

  it('reads a condition tree three levels deep as one sentence with each level shown', async () => {
    const tree = {
      kind: ExpressionKind.Intersection,
      operands: [
        { classIri: 'urn:Person', kind: ExpressionKind.NamedClass },
        {
          kind: ExpressionKind.Union,
          operands: [
            {
              filler: {
                classIri: 'urn:Medicine',
                kind: ExpressionKind.NamedClass,
              },
              kind: ExpressionKind.Restriction,
              propertyIri: 'urn:prescribedBy',
              restrictionKind: RestrictionKind.Some,
            },
            { classIri: 'urn:Patient', kind: ExpressionKind.NamedClass },
          ],
        },
      ],
    };
    mockCreate.mockResolvedValue(savedAxiom());
    renderEditor({
      axiom: savedAxiom({ expressions: [tree], subjectIri: 'urn:Medicine' }),
    });

    expect(preview()).toHaveTextContent(
      'Medicine Subclass of (Person and (prescribedBy At least one Medicine or Patient))'
    );
    expect(screen.getByTestId('ontology-expression-3')).toBeInTheDocument();
  });

  it('shows the statement help for each kind in the advanced form', async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('ontology-axiom-mode-advanced'));
    await choose(/Type/, 'Disjoint with');

    expect(screen.getByTestId('ontology-axiom-help')).toHaveTextContent(
      'If anything is made both, validation reports a conflict.'
    );
  });

  it.each([false, true])(
    'renders the quick form and its preview with AI mode %s',
    (isAiMode) => {
      (useIsAiMode as jest.Mock).mockReturnValue(isAiMode);
      renderEditor();

      expect(screen.getByTestId('ontology-axiom-panel')).toBeVisible();
      expect(screen.getByTestId('ontology-rule-quick')).toBeVisible();
      expect(preview()).toBeVisible();

      (useIsAiMode as jest.Mock).mockReturnValue(false);
    }
  );

  it('does not show an old validation result after the draft changes', async () => {
    let resolve!: (report: { valid: boolean; violations: [] }) => void;
    mockValidate.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    renderEditor();
    await pick(/^Subject/, 'Pat', /Patient/);
    await pick(/^Property/, 'date', /dateOfBirth/);
    fireEvent.click(screen.getByTestId('ontology-axiom-validate'));
    await pick(/^Property/, 'presc', /prescribedBy/);
    await act(async () => resolve({ valid: true, violations: [] }));

    expect(screen.queryByText('Validation passed')).not.toBeInTheDocument();
  });
});

describe('OntologyAxiomEditor advanced assertions', () => {
  it('offers data properties for data facts and preserves empty literal values', async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('ontology-axiom-mode-advanced'));
    await choose(/Type/, 'Data property fact');
    const property = screen.getByRole('combobox', { name: /^Property/ });
    fireEvent.focus(property);
    fireEvent.keyDown(property, { key: 'ArrowDown' });

    expect(
      await screen.findByRole('option', { name: /dateOfBirth/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /prescribedBy/ })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /dateOfBirth/ }));

    expect(screen.getByRole('textbox', { name: /^Value/ })).not.toBeRequired();
  });
});

describe('OntologyAxiomEditor footer', () => {
  it('keeps Save disabled on a validated saved rule until it is edited', async () => {
    renderEditor({ axiom: savedAxiom() });
    fireEvent.click(screen.getByTestId('ontology-axiom-validate'));

    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-axiom-footer-status')
      ).toHaveTextContent('Validation Passed')
    );

    expect(screen.getByTestId('ontology-axiom-submit')).toBeDisabled();
  });

  it('closes the drawer on Cancel while the rule is unchanged', () => {
    const onCancel = jest.fn();
    renderEditor({ axiom: savedAxiom(), onCancel });
    const cancel = screen.getByTestId('ontology-axiom-footer-cancel');

    expect(cancel).toBeEnabled();

    fireEvent.click(cancel);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
