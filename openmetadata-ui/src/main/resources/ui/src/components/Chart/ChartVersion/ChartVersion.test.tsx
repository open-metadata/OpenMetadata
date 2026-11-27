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
import { useParams } from 'react-router-dom';
import { EntityTabs } from '../../../enums/entity.enum';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { MOCK_CHART_DATA } from '../../../mocks/Chart.mock';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import ChartVersion, { ChartVersionProp } from './ChartVersion.component';

const mockNavigate = jest.fn();

// Chip styles are looked up through React Query; these tests do not cover
// chip styling and render without a QueryClientProvider.
jest.mock('../../../hooks/governance/domain/useDomainStyles', () => ({
  useDomainStyles: jest.fn().mockReturnValue(new Map()),
}));

jest.mock(
  '../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () => jest.fn().mockImplementation(() => <div>DataAssetsVersionHeader</div>)
);

jest.mock('../../common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(() => <div>TagsContainerV2</div>)
);

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockImplementation(() => <div>CustomPropertyTable</div>),
}));

jest.mock('../../common/EntityDescription/Description', () =>
  jest.fn().mockImplementation(() => <div>Description</div>)
);

jest.mock('../../Entity/EntityVersionTimeLine/EntityVersionTimeLine', () =>
  jest.fn().mockImplementation(() => <div>EntityVersionTimeLine</div>)
);

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({}),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useLocation: jest.fn().mockImplementation(() => ({ pathname: 'mockPath' })),
}));

jest.mock(
  '../../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn(),
      getEntityRuleValidation: jest.fn(),
    })),
  })
);

const chartVersionProps: ChartVersionProp = {
  version: '0.2',
  currentVersionData: MOCK_CHART_DATA,
  isVersionLoading: false,
  owners: [],
  domains: [],
  dataProducts: [],
  tier: {
    labelType: LabelType.Manual,
    source: TagSource.Classification,
    state: State.Confirmed,
    tagFQN: 'Tier.Tier1',
  },
  slashedChartName: [],
  versionList: { entityType: 'chart', versions: [] },
  backHandler: jest.fn(),
  versionHandler: jest.fn(),
  entityPermissions: ENTITY_PERMISSIONS,
};

describe('ChartVersion', () => {
  afterEach(() => {
    (useParams as jest.Mock).mockReturnValue({});
  });

  it('should navigate to the tab route on tab click', () => {
    render(<ChartVersion {...chartVersionProps} />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'label.custom-property-plural' })
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      '/chart/sample_superset.127/versions/0.2/custom_properties'
    );
  });

  it('should follow the tab route param when it changes without a remount', () => {
    (useParams as jest.Mock).mockReturnValue({
      tab: EntityTabs.CUSTOM_PROPERTIES,
    });
    const { rerender } = render(<ChartVersion {...chartVersionProps} />);

    expect(
      screen.getByRole('tab', { name: 'label.custom-property-plural' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('CustomPropertyTable')).toBeInTheDocument();

    (useParams as jest.Mock).mockReturnValue({});
    rerender(<ChartVersion {...chartVersionProps} />);

    expect(
      screen.getByRole('tab', { name: 'label.detail-plural' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.queryByText('CustomPropertyTable')).not.toBeInTheDocument();
  });
});
