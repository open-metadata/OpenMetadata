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
import { act, fireEvent, screen } from '@testing-library/react';
import {
  Code,
  FindingSeverity,
  LogicalCheck as ValidationLogicalCheck,
  MemberKind,
  OntologyReleaseValidation as ValidationReport,
  ViolationSeverity,
} from '../../../../generated/api/data/ontologyReleaseValidation';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  EncodingVersion,
  EntityStatus,
  LogicalCheck,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import APIClient from '../../../../rest/axiosClient';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import OntologyReleaseValidation from './OntologyReleaseValidation';

jest.mock('../../../../rest/axiosClient', () => ({ get: jest.fn() }));
const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const ontology: Ontology = {
  id: 'owner',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
};
const release: OntologyRelease = {
  id: 'captured',
  name: 'release-5',
  fullyQualifiedName: 'Sales.release-5',
  ontology: { id: ontology.id, type: 'ontology' },
  releaseRevision: 5,
  semanticVersion: '1.5.0',
  entityStatus: EntityStatus.Approved,
  sourceWorkingRevision: 7,
  sealedAt: 1,
  sealedBy: 'author',
  memberCount: 1,
  totalBytes: 100,
  ontologyIri: 'urn:sales',
  versionIri: 'urn:sales:5',
  baseReleaseId: 'base',
  contentDigest: 'a'.repeat(64),
  logicalCheck: LogicalCheck.NotRun,
  encodingVersion: EncodingVersion.OntologyReleaseV1,
};
let report: ValidationReport;
runQueryNotificationsSynchronously();

beforeEach(() => {
  get.mockReset();
  report = {
    releaseId: release.id,
    contentDigest: release.contentDigest,
    baseReleaseId: release.baseReleaseId,
    logicalCheck: ValidationLogicalCheck.NotRun,
    valid: true,
    structure: {
      releaseId: release.id,
      contentDigest: release.contentDigest,
      valid: true,
      violationCount: 0,
      violations: [],
    },
    shacl: {
      findings: [
        {
          focusIri: 'urn:customer',
          shapeIri: 'urn:shape',
          message: 'Optional label is missing',
          severity: FindingSeverity.Warning,
        },
      ],
      violationCount: 0,
      warningCount: 1,
      truncated: false,
    },
    deprecationImpacts: [],
  };
  get.mockImplementation(async (url) => {
    if (url.endsWith('/validation')) {
      return { data: report };
    }
    if (url.endsWith('/structure')) {
      return { data: report.structure };
    }

    throw new Error('Unexpected validation request');
  });
});

const setup = async (selected: OntologyRelease | undefined = release) => {
  let mounted: ReturnType<typeof renderWithQueryClient> | undefined;
  await act(async () => {
    mounted = renderWithQueryClient(
      <OntologyReleaseValidation release={selected} />
    );
  });
  if (!mounted) {
    throw new Error('Validation did not render');
  }

  return mounted;
};

it('shows a SHACL warning separately from zero violations and never claims logical consistency', async () => {
  await setup();

  expect(screen.queryByText('Optional label is missing')).toBeVisible();
  expect(screen.getByTestId('ontology-shacl-counts')).toHaveTextContent(
    '0 label.violation-plural'
  );
  expect(screen.getByTestId('ontology-shacl-counts')).toHaveTextContent(
    '1 label.warning-plural'
  );
  expect(
    screen.getByText(/label.logical-consistency.*label.not-checked/)
  ).toBeVisible();
});

it('shows invalid structure and truncated SHACL findings without merging their counts', async () => {
  report.valid = false;
  report.structure = {
    ...report.structure,
    valid: false,
    violationCount: 2,
    violations: [
      {
        memberId: 'customer',
        memberKind: MemberKind.Concept,
        violation: {
          code: Code.SubclassCycle,
          message: 'Customer subclasses form a cycle',
          path: 'superClasses',
          severity: ViolationSeverity.Error,
        },
      },
    ],
  };
  report.shacl = {
    violationCount: 3,
    warningCount: 0,
    findings: [
      {
        focusIri: 'urn:customer',
        shapeIri: 'urn:required-name',
        message: 'Name is required',
        severity: FindingSeverity.Violation,
      },
    ],
    truncated: true,
  };
  await setup();

  expect(screen.queryByText('Customer subclasses form a cycle')).toBeVisible();
  expect(screen.getByText('Name is required')).toBeVisible();
  expect(screen.getByTestId('ontology-shacl-counts')).toHaveTextContent(
    '3 label.violation-plural'
  );
  expect(
    screen.getAllByText('message.ontology-findings-truncated')
  ).toHaveLength(2);
});

it('shows current bound assets, subclasses and domain/range properties for deprecated definitions', async () => {
  report.deprecationImpacts = [
    {
      definition: { id: 'customer', type: 'ontologyConcept', name: 'Customer' },
      boundAssetCount: 3,
      boundAssets: [{ id: 'orders', type: 'table', name: 'Orders' }],
      subclasses: [
        { id: 'vip', type: 'ontologyConcept', name: 'VIP customer' },
      ],
      domainProperties: [
        { id: 'owns', type: 'ontologyProperty', name: 'Owns account' },
      ],
      rangeProperties: [
        { id: 'serves', type: 'ontologyProperty', name: 'Serves customer' },
      ],
    },
  ];
  await setup();
  for (const name of [
    'Orders',
    'VIP customer',
    'Owns account',
    'Serves customer',
  ]) {
    expect(screen.queryByText(name)).toBeVisible();
  }

  expect(
    screen.getByTestId('ontology-impact-count-customer')
  ).toHaveTextContent('3');
  expect(
    screen.queryByText('message.ontology-no-deprecation-impact')
  ).not.toBeInTheDocument();
});

it.each([403, 404])(
  'shows unavailable rather than zero impact for a denied validation response: %s',
  async (status) => {
    get.mockRejectedValue({ isAxiosError: true, response: { status } });
    await setup();

    expect(
      screen.queryByText('message.ontology-validation-unavailable')
    ).toBeVisible();
    expect(
      screen.queryByText('message.ontology-no-deprecation-impact')
    ).not.toBeInTheDocument();

    get.mockResolvedValue({ data: report });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
    });

    expect(
      screen.getByText('message.ontology-no-deprecation-impact')
    ).toBeVisible();
  }
);

it.each([
  'releaseId',
  'contentDigest',
  'baseReleaseId',
  'structureReleaseId',
  'structureDigest',
])('rejects a validation identity mismatch: %s', async (field) => {
  if (
    field === 'releaseId' ||
    field === 'contentDigest' ||
    field === 'baseReleaseId'
  ) {
    report = { ...report, [field]: 'wrong' };
  }
  if (field === 'structureReleaseId') {
    report.structure.releaseId = 'wrong';
  }
  if (field === 'structureDigest') {
    report.structure.contentDigest = 'wrong';
  }
  await setup();

  expect(
    screen.queryByText('message.ontology-validation-unavailable')
  ).toBeVisible();
  expect(
    screen.queryByText('Optional label is missing')
  ).not.toBeInTheDocument();
});

it('recomputes current binding impact when the same immutable release is reopened', async () => {
  const mounted = await setup();

  expect(
    screen.queryByText('message.ontology-no-deprecation-impact')
  ).toBeVisible();

  mounted.unmount();
  report.deprecationImpacts = [
    {
      definition: { id: 'customer', type: 'ontologyConcept', name: 'Customer' },
      boundAssetCount: 1,
      boundAssets: [
        { id: 'orders', type: 'table', name: 'Orders after refresh' },
      ],
      subclasses: [],
      domainProperties: [],
      rangeProperties: [],
    },
  ];
  await setup();

  expect(screen.getByText('Orders after refresh')).toBeVisible();
});

it('does not transfer a late previous-release result to a new selected release', async () => {
  let finishPrevious: ((value: { data: ValidationReport }) => void) | undefined;
  get.mockImplementation(async (url) => {
    if (url.includes('/captured/')) {
      return new Promise((resolve) => {
        finishPrevious = resolve;
      });
    }

    return {
      data: {
        ...report,
        releaseId: 'new',
        contentDigest: 'b'.repeat(64),
        structure: {
          ...report.structure,
          releaseId: 'new',
          contentDigest: 'b'.repeat(64),
        },
        shacl: { ...report.shacl, findings: [], warningCount: 0 },
      },
    };
  });
  const mounted = await setup();
  await act(async () => {
    mounted.rerender(
      <OntologyReleaseValidation
        release={{ ...release, id: 'new', contentDigest: 'b'.repeat(64) }}
      />
    );
  });
  await act(async () => {
    finishPrevious?.({ data: report });
  });

  expect(
    screen.queryByText('Optional label is missing')
  ).not.toBeInTheDocument();
  expect(screen.queryByTestId('ontology-shacl-counts')).toHaveTextContent(
    '0 label.warning-plural'
  );
});
