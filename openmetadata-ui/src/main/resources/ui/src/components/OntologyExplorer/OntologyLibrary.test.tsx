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
  OntologyPackManifest,
} from '../../generated/api/data/ontologyPackManifest';
import { installOntologyPack, listOntologyPacks } from '../../rest/ontologyAPI';
import OntologyLibrary from './OntologyLibrary';

jest.mock('../../rest/ontologyAPI', () => ({
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

const FHIR_PACK: OntologyPackManifest = {
  abbreviation: 'FHIR',
  bundled: true,
  description: 'Healthcare concepts',
  id: 'fhir',
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
  name: 'ISA-95',
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

  it('restores an installed version from glossary provenance', async () => {
    render(
      <OntologyLibrary
        installedPacks={[
          {
            installedAt: 1,
            installedBy: 'admin',
            license: 'CC0-1.0',
            licenseUrl: FHIR_PACK.licenseUrl,
            modules: [
              {
                moduleId: 'core',
                sha256: 'a'.repeat(64),
              },
            ],
            packId: FHIR_PACK.id,
            sourceUrl: FHIR_PACK.sourceUrl,
            version: FHIR_PACK.version,
          },
        ]}
      />
    );

    expect(await screen.findByTestId('ontology-pack-fhir')).toHaveTextContent(
      'label.installed'
    );
    expect(
      screen.getByTestId('ontology-library-installed-count')
    ).toHaveTextContent('1 label.installed-lowercase');
  });

  it('closes from the library header and Escape key', async () => {
    const onClose = jest.fn();
    render(<OntologyLibrary onClose={onClose} />);

    await screen.findByTestId('ontology-pack-fhir');
    fireEvent.click(screen.getByTestId('ontology-library-close'));
    fireEvent.keyDown(document, { key: 'Escape' });

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
