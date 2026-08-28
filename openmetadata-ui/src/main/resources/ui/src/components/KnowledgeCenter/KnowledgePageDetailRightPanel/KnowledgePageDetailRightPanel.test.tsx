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
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import KnowledgePageDetailRightPanel from './KnowledgePageDetailRightPanel';

// KnowledgePageDetailRightPanel.tsx had ZERO existing test coverage before this conversion
// (Task 8 Batch 2). This is a minimal permission-focused characterization suite covering the
// two real behavior changes the conversion introduces (see the source's inline comment):
// explicit-deny-wins on the tags `permission` prop (was raw `EditAll || EditTags`, now
// prioritized `canEditTags`), and uniform deleted-gating across every consumed flag (the old
// tags/related-assets reads never checked `deleted`; `hasDataProductsPermission` always did).

jest.mock('../../../components/Customization/GenericProvider/GenericContext');

jest.mock(
  '../../../components/DataProducts/DataProductsContainer/DataProductsContainer.component',
  () =>
    jest
      .fn()
      .mockImplementation(({ hasPermission }) => (
        <div
          data-has-permission={String(Boolean(hasPermission))}
          data-testid="data-products-container"
        />
      ))
);

jest.mock('../../../components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest
    .fn()
    .mockImplementation(({ permission, tagType }) => (
      <div
        data-permission={String(Boolean(permission))}
        data-testid={`tags-container-${tagType}`}
      />
    ))
);

jest.mock('../RelatedDataAssets/RelatedDataAssets', () =>
  jest
    .fn()
    .mockImplementation(({ hasPermission }) => (
      <div
        data-has-permission={String(Boolean(hasPermission))}
        data-testid="related-data-assets"
      />
    ))
);

jest.mock('../AttachmentWidget/AttachmentWidget', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../../components/DataAssets/ReviewerLabelV2/ReviewerLabelV2', () => ({
  ReviewerLabelV2: jest.fn().mockReturnValue(null),
}));

const mockUseGenericContext = useGenericContext as jest.Mock;

// The real caller (KnowledgePageDetailComponent.tsx) passes the identical `permissions`
// object to both GenericProvider (read here via context) and this component's own prop — so
// every render helper below mirrors that by feeding the same value to both, matching the old
// component's `genericPermissions` (context) + `permissions` (prop) dual-read exactly.
const setContext = (
  permissions: Partial<OperationPermission>,
  deleted = false
) => {
  mockUseGenericContext.mockReturnValue({
    entityRules: {},
    data: { deleted, domains: [], dataProducts: [] },
    onUpdate: jest.fn(),
    permissions,
  });
};

const defaultProps = {
  tags: [],
  updatePageTag: jest.fn(),
  handleRelatedEntitiesUpdate: jest.fn(),
};

const renderComponent = (
  permissions: Partial<OperationPermission>,
  deleted = false
) => {
  setContext(permissions, deleted);

  return render(
    <KnowledgePageDetailRightPanel
      {...defaultProps}
      permissions={permissions as OperationPermission}
    />
  );
};

describe('KnowledgePageDetailRightPanel permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants edit access when EditAll is true', () => {
    renderComponent({ EditAll: true, EditTags: true });

    expect(screen.getByTestId('data-products-container')).toHaveAttribute(
      'data-has-permission',
      'true'
    );
    expect(
      screen.getByTestId('tags-container-Classification')
    ).toHaveAttribute('data-permission', 'true');
    expect(screen.getByTestId('tags-container-Glossary')).toHaveAttribute(
      'data-permission',
      'true'
    );
    expect(screen.getByTestId('related-data-assets')).toHaveAttribute(
      'data-has-permission',
      'true'
    );
  });

  it('denies tags edit when EditTags is explicitly false even though EditAll is true (explicit-deny-wins, prioritized over the old raw OR)', () => {
    renderComponent({ EditAll: true, EditTags: false });

    expect(
      screen.getByTestId('tags-container-Classification')
    ).toHaveAttribute('data-permission', 'false');
    expect(screen.getByTestId('tags-container-Glossary')).toHaveAttribute(
      'data-permission',
      'false'
    );
  });

  it('denies every edit-gated affordance once the entity is deleted, even with EditAll granted', () => {
    renderComponent({ EditAll: true, EditTags: true }, true);

    expect(screen.getByTestId('data-products-container')).toHaveAttribute(
      'data-has-permission',
      'false'
    );
    expect(
      screen.getByTestId('tags-container-Classification')
    ).toHaveAttribute('data-permission', 'false');
    expect(screen.getByTestId('related-data-assets')).toHaveAttribute(
      'data-has-permission',
      'false'
    );
  });
});
