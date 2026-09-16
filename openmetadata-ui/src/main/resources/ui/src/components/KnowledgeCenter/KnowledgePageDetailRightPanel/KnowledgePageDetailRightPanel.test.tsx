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
import { render } from '@testing-library/react';
import { EntityTags } from 'Models';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import KnowledgePageDetailRightPanel from './KnowledgePageDetailRightPanel';

jest.mock('@openmetadata/ui-core-components', () => {
  const Card: React.FC<{ children: React.ReactNode }> & {
    Content: React.FC<{ children: React.ReactNode }>;
  } = Object.assign(
    ({ children }: { children: React.ReactNode }) => (
      <div data-testid="card">{children}</div>
    ),
    {
      Content: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="card-content">{children}</div>
      ),
    }
  );

  return { Card };
});

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(),
}));

jest.mock('../../DataAssets/ReviewerLabelV2/ReviewerLabelV2', () => ({
  ReviewerLabelV2: () => <div data-testid="reviewer-label" />,
}));

jest.mock(
  '../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => <div data-testid="data-products-container" />),
  })
);

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () => ({
  __esModule: true,
  default: () => <div data-testid="tags-container" />,
}));

jest.mock('../AttachmentWidget/AttachmentWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="attachment-widget" />,
}));

jest.mock('../RelatedDataAssets/RelatedDataAssets', () => ({
  __esModule: true,
  default: () => <div data-testid="related-data-assets" />,
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const baseGenericContext = {
  data: {
    id: 'kp-1',
    fullyQualifiedName: 'kp.fqn',
    domains: [],
    dataProducts: [],
    deleted: false,
  },
  onUpdate: jest.fn(),
  permissions: { EditAll: true },
  entityRules: {
    canAddMultipleDataProducts: true,
    requireDomainForDataProduct: false,
  },
  isRulesLoaded: true,
};

const defaultProps = {
  permissions: { EditAll: true, EditTags: true } as OperationPermission,
  tags: [] as EntityTags[],
  updatePageTag: jest.fn(),
  handleRelatedEntitiesUpdate: jest.fn(),
};

describe('KnowledgePageDetailRightPanel', () => {
  const getDataProductsContainerMock = () =>
    jest.requireMock(
      '../../DataProducts/DataProductsContainer/DataProductsContainer.component'
    ).default as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (useGenericContext as jest.Mock).mockReturnValue(baseGenericContext);
  });

  it('renders the data products container', () => {
    render(<KnowledgePageDetailRightPanel {...defaultProps} />);

    expect(getDataProductsContainerMock()).toHaveBeenCalled();
  });

  it('holds single-select (multiple=false) while entity rules are loading', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      ...baseGenericContext,
      entityRules: {
        canAddMultipleDataProducts: true,
        requireDomainForDataProduct: false,
      },
      isRulesLoaded: false,
    });

    render(<KnowledgePageDetailRightPanel {...defaultProps} />);

    expect(getDataProductsContainerMock().mock.calls.at(-1)?.[0]).toMatchObject(
      { multiple: false }
    );
  });

  it('enables multiple select when rules are loaded and multi-product rule is not enabled', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      ...baseGenericContext,
      entityRules: {
        canAddMultipleDataProducts: true,
        requireDomainForDataProduct: false,
      },
      isRulesLoaded: true,
    });

    render(<KnowledgePageDetailRightPanel {...defaultProps} />);

    expect(getDataProductsContainerMock().mock.calls.at(-1)?.[0]).toMatchObject(
      { multiple: true }
    );
  });

  it('keeps single select when rules are loaded and multi-product rule is enabled', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      ...baseGenericContext,
      entityRules: {
        canAddMultipleDataProducts: false,
        requireDomainForDataProduct: false,
      },
      isRulesLoaded: true,
    });

    render(<KnowledgePageDetailRightPanel {...defaultProps} />);

    expect(getDataProductsContainerMock().mock.calls.at(-1)?.[0]).toMatchObject(
      { multiple: false }
    );
  });
});
