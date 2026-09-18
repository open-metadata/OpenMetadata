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
import { render, screen } from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { MOCK_DOMAIN } from '../../../mocks/Domains.mock';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { DomainTypeWidget } from './DomainTypeWidget';

// DomainTypeWidget has no prior test file (Task 8 Batch 1 — DomainDetails permission group).
// Characterization tests written directly against the converted (getDerivedPermissionFlags
// -based) component. See DomainExpertWidget.test.tsx's header comment for why these tests
// pass identically against the pre-conversion `permissions.EditAll` shape too: the raw ->
// canEditAll mapping is a pure value-preserving rename (EditAll-only, no prioritization
// semantics), so there is no behavior difference to catch — that equivalence, verified in
// task-8B1-report.md, is the point.

let mockContext: {
  data: typeof MOCK_DOMAIN;
  permissions: OperationPermission;
  onUpdate: jest.Mock;
  isVersionView: boolean;
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => mockContext,
}));

const setMockContext = (
  permissionOverrides: Partial<OperationPermission>,
  domainOverrides: Partial<typeof MOCK_DOMAIN> = {}
) => {
  mockContext = {
    data: { ...MOCK_DOMAIN, ...domainOverrides },
    permissions: permissionOverrides as OperationPermission,
    onUpdate: jest.fn(),
    isVersionView: false,
  };
};

describe('DomainTypeWidget permissions', () => {
  beforeEach(() => {
    setMockContext(ENTITY_PERMISSIONS);
  });

  it('shows the edit-domainType affordance when EditAll permission is granted', () => {
    setMockContext({ ...ENTITY_PERMISSIONS, EditAll: true });

    render(<DomainTypeWidget />);

    expect(screen.getByTestId('edit-domainType-button')).toBeInTheDocument();
  });

  it('hides the edit-domainType affordance when EditAll permission is denied', () => {
    setMockContext({ ...ENTITY_PERMISSIONS, EditAll: false });

    render(<DomainTypeWidget />);

    expect(
      screen.queryByTestId('edit-domainType-button')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('add-domainType-button')
    ).not.toBeInTheDocument();
  });

  it('shows the add-domainType affordance when EditAll is granted and no domainType is set', () => {
    setMockContext(
      { ...ENTITY_PERMISSIONS, EditAll: true },
      { domainType: undefined }
    );

    render(<DomainTypeWidget />);

    expect(screen.getByTestId('add-domainType-button')).toBeInTheDocument();
  });
});
