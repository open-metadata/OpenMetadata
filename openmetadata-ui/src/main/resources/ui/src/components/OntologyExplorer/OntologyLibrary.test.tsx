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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  Format,
  Industry,
  Layer,
  OntologyPackManifest,
} from '../../generated/api/data/ontologyPackManifest';
import {
  getOntologyPackSample,
  installOntologyPack,
  listOntologyPacks,
} from '../../rest/ontologyAPI';
import OntologyLibrary from './OntologyLibrary';

jest.mock('../../rest/ontologyAPI', () => ({
  getOntologyPackSample: jest.fn(),
  installOntologyPack: jest.fn(),
  listOntologyPacks: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockListPacks = listOntologyPacks as jest.MockedFunction<
  typeof listOntologyPacks
>;
const mockInstallPack = installOntologyPack as jest.MockedFunction<
  typeof installOntologyPack
>;
const mockSample = getOntologyPackSample as jest.MockedFunction<
  typeof getOntologyPackSample
>;

const FHIR_PACK: OntologyPackManifest = {
  abbreviation: 'FHIR',
  bundled: true,
  description: 'Healthcare concepts',
  id: 'fhir',
  industry: Industry.Healthcare,
  layer: Layer.L2,
  license: 'CC0-1.0',
  licenseUrl: 'https://example.com/license',
  modules: [
    {
      conceptCount: 2,
      dependencies: [],
      description: 'Core concepts',
      format: Format.Turtle,
      id: 'core',
      name: 'Core',
      relationshipCount: 1,
      selectedByDefault: true,
    },
    {
      conceptCount: 3,
      dependencies: ['core'],
      description: 'Clinical concepts',
      format: Format.Turtle,
      id: 'clinical',
      name: 'Clinical',
      relationshipCount: 2,
      selectedByDefault: false,
    },
  ],
  name: 'FHIR Reference',
  sourceUrl: 'https://example.com/fhir',
  standard: 'FHIR R5',
  version: '5.0.0',
};

const EXTERNAL_PACK: OntologyPackManifest = {
  ...FHIR_PACK,
  abbreviation: 'ISA',
  bundled: false,
  id: 'isa-95',
  industry: Industry.Manufacturing,
  name: 'ISA-95',
};
const FIBO_PACK: OntologyPackManifest = {
  ...FHIR_PACK,
  abbreviation: 'FIBO',
  description: 'A compact starter subset of financial concepts',
  id: 'fibo',
  industry: Industry.Finance,
  name: 'FIBO Starter',
  standard: 'Financial Industry Business Ontology',
};
const UNKNOWN_PACK: OntologyPackManifest = {
  ...FHIR_PACK,
  abbreviation: 'NEW',
  id: 'new-pack',
  name: 'New standard pack',
  standard: 'New standard',
};

const installResult = (dryRun: boolean) => ({
  conceptCount: 5,
  dryRun,
  importResults: [],
  moduleIds: ['core', 'clinical'],
  packId: 'fhir',
  relationshipCount: 3,
  targetGlossaryName: 'FHIR Reference',
  version: '5.0.0',
});

describe('OntologyLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListPacks.mockResolvedValue({ packs: [FHIR_PACK, EXTERNAL_PACK] });
    mockSample.mockResolvedValue({
      packId: 'fhir',
      version: '5.0.0',
      moduleIds: ['core'],
      conceptCount: 2,
      relationCount: 1,
      concepts: [],
      relations: [],
    });
  });

  it('renders bundled and catalogue-only standards distinctly', async () => {
    render(<OntologyLibrary />);

    expect(await screen.findByTestId('ontology-pack-fhir')).toBeVisible();
    expect(screen.getByTestId('ontology-pack-isa-95')).toBeVisible();
    expect(screen.getByTestId('ontology-pack-details-fhir')).toBeEnabled();
    expect(screen.getByTestId('ontology-pack-source-isa-95')).toHaveAttribute(
      'href',
      EXTERNAL_PACK.sourceUrl
    );
  });

  it('orders available standards, filters by domain, and keeps manifest facts visible', async () => {
    mockListPacks.mockResolvedValue({
      packs: [UNKNOWN_PACK, EXTERNAL_PACK, FHIR_PACK, FIBO_PACK],
    });
    render(<OntologyLibrary />);

    await screen.findByTestId('ontology-pack-fibo');

    expect(
      screen
        .getAllByTestId(/^ontology-pack-(fibo|fhir|isa-95|new-pack)$/)
        .map((card) => card.getAttribute('data-testid'))
    ).toEqual([
      'ontology-pack-fibo',
      'ontology-pack-fhir',
      'ontology-pack-isa-95',
      'ontology-pack-new-pack',
    ]);
    expect(screen.getByTestId('ontology-pack-fibo')).toHaveTextContent(
      'label.ontology-library-financial-services'
    );
    expect(screen.getByTestId('ontology-pack-fibo')).toHaveTextContent(
      FIBO_PACK.description
    );
    expect(screen.getByTestId('ontology-pack-fibo')).toHaveTextContent(
      FIBO_PACK.standard
    );
    expect(screen.getByTestId('ontology-pack-fibo')).toHaveTextContent(
      '5 label.concept-plural · 3 label.relation-plural'
    );
    expect(screen.getByTestId('ontology-pack-new-pack')).toHaveTextContent(
      UNKNOWN_PACK.name
    );
    expect(
      screen.getByTestId('ontology-pack-abbreviation-new-pack')
    ).toHaveTextContent(UNKNOWN_PACK.abbreviation);

    fireEvent.click(screen.getByTestId('ontology-library-filter-healthcare'));

    expect(screen.getByTestId('ontology-pack-fhir')).toBeVisible();
    expect(screen.queryByTestId('ontology-pack-fibo')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-pack-isa-95')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-library-filter-finance'));

    expect(screen.getByTestId('ontology-pack-fibo')).toBeVisible();
    expect(screen.queryByTestId('ontology-pack-fhir')).not.toBeInTheDocument();
  });

  it('shows the vocabulary catalogue without glossary installation metadata', async () => {
    render(<OntologyLibrary />);

    expect(await screen.findByTestId('ontology-pack-fhir')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-library-installed-count')
    ).not.toBeInTheDocument();
  });

  it('closes from the library header and Escape key', async () => {
    const onClose = jest.fn();
    render(<OntologyLibrary onClose={onClose} />);

    await screen.findByTestId('ontology-pack-fhir');
    fireEvent.click(screen.getByTestId('ontology-library-close'));
    fireEvent.keyDown(screen.getByTestId('ontology-library'), {
      key: 'Escape',
    });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('updates dependency-aware module counts in the pack detail', async () => {
    render(<OntologyLibrary canInstall />);

    fireEvent.click(await screen.findByTestId('ontology-pack-details-fhir'));

    expect(screen.getByTestId('ontology-module-core')).toHaveAttribute(
      'data-selected',
      'true'
    );
    expect(screen.getByTestId('ontology-pack-concept-count')).toHaveTextContent(
      '2'
    );

    fireEvent.click(screen.getByTestId('ontology-module-clinical'));

    expect(screen.getByTestId('ontology-pack-concept-count')).toHaveTextContent(
      '5'
    );
    expect(
      screen.getByTestId('ontology-pack-relationship-count')
    ).toHaveTextContent('3');
  });

  it('requires a successful dry run before installation and opens the graph', async () => {
    const onOpenGlossary = jest.fn();
    mockInstallPack
      .mockResolvedValueOnce(installResult(true))
      .mockResolvedValueOnce(installResult(false));
    render(<OntologyLibrary canInstall onOpenGlossary={onOpenGlossary} />);

    fireEvent.click(await screen.findByTestId('ontology-pack-details-fhir'));
    fireEvent.click(screen.getByTestId('ontology-module-clinical'));
    fireEvent.change(screen.getByTestId('ontology-pack-target-glossary'), {
      target: { value: 'FHIR Reference' },
    });

    expect(screen.getByTestId('ontology-pack-install')).toBeDisabled();

    fireEvent.click(screen.getByTestId('ontology-pack-dry-run'));

    await waitFor(() =>
      expect(mockInstallPack).toHaveBeenNthCalledWith(1, 'fhir', {
        dryRun: true,
        moduleIds: ['core', 'clinical'],
        targetGlossaryName: 'FHIR Reference',
      })
    );

    expect(screen.getByTestId('ontology-pack-install')).toBeEnabled();

    fireEvent.click(screen.getByTestId('ontology-pack-install'));
    await screen.findByTestId('ontology-pack-open-graph');
    fireEvent.click(screen.getByTestId('ontology-pack-open-graph'));

    expect(mockInstallPack).toHaveBeenNthCalledWith(2, 'fhir', {
      dryRun: false,
      moduleIds: ['core', 'clinical'],
      targetGlossaryName: 'FHIR Reference',
    });
    expect(onOpenGlossary).toHaveBeenCalledWith('FHIR Reference');
  });

  it('keeps catalogue details visible without exposing install actions', async () => {
    render(<OntologyLibrary canInstall={false} />);

    fireEvent.click(await screen.findByTestId('ontology-pack-details-fhir'));

    expect(screen.getByText('message.no-permission-for-action')).toBeVisible();
    expect(screen.getByTestId('ontology-module-core')).toHaveAttribute(
      'data-disabled',
      'true'
    );
    expect(
      screen.queryByTestId('ontology-pack-target-glossary')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-pack-install')
    ).not.toBeInTheDocument();
    expect(mockInstallPack).not.toHaveBeenCalled();
  });
});
