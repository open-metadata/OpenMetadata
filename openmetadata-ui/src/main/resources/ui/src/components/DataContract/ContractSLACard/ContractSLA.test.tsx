/*
 *  Copyright 2025 Collate.
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
import {
  DataContract,
  MaxLatencyUnit,
  RefreshFrequencyUnit,
  RetentionUnit,
} from '../../../generated/entity/data/dataContract';
import { MOCK_DATA_CONTRACT } from '../../../mocks/DataContract.mock';
import { mockTableData } from '../../../mocks/TableVersion.mock';
import ContractSLA from './ContractSLA.component';

jest.mock('../../../utils/CommonUtils', () => ({
  Transi18next: ({ i18nKey, values }: any) => (
    <span>
      {i18nKey} - {values?.label}: {values?.data}
    </span>
  ),
}));

jest.mock('../../../assets/svg/ic-check-circle-2.svg', () => ({
  ReactComponent: () => <svg data-testid="check-icon" />,
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: mockTableData,
  })),
}));

describe('ContractSLA Component', () => {
  it('should render null when contract.sla is empty', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      sla: {},
    } as DataContract;

    const { container } = render(<ContractSLA contract={contract} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render null when contract.sla is undefined', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
    } as DataContract;

    const { container } = render(<ContractSLA contract={contract} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render SLA card with refresh frequency', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      id: MOCK_DATA_CONTRACT.id,
      entity: MOCK_DATA_CONTRACT.entity,
      sla: {
        refreshFrequency: {
          interval: 24,
          unit: RefreshFrequencyUnit.Hour,
        },
      },
    } as DataContract;

    render(<ContractSLA contract={contract} />);

    expect(screen.getByTestId('contract-sla-card')).toBeInTheDocument();
    expect(
      screen.getByText('label.service-level-agreement')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'message.freshness-sla-description - label.freshness: 24 hour'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('should render SLA card with availability time', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      sla: {
        availabilityTime: '09:00 UTC',
      },
    } as DataContract;

    render(<ContractSLA contract={contract} />);

    expect(screen.getByTestId('contract-sla-card')).toBeInTheDocument();
    expect(
      screen.getByText(
        'message.completeness-sla-description - label.completeness: 09:00 UTC'
      )
    ).toBeInTheDocument();
  });

  it('should render SLA card with max latency', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      id: MOCK_DATA_CONTRACT.id,
      entity: MOCK_DATA_CONTRACT.entity,
      sla: {
        maxLatency: {
          value: 5,
          unit: MaxLatencyUnit.Minute,
        },
      },
    } as DataContract;

    render(<ContractSLA contract={contract} />);

    expect(screen.getByTestId('contract-sla-card')).toBeInTheDocument();
    expect(
      screen.getByText(
        'message.latency-sla-description - label.latency: 5 minute'
      )
    ).toBeInTheDocument();
  });

  it('should render SLA card with retention', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      id: MOCK_DATA_CONTRACT.id,
      entity: MOCK_DATA_CONTRACT.entity,
      sla: {
        retention: {
          period: 30,
          unit: RetentionUnit.Day,
        },
      },
    } as DataContract;

    render(<ContractSLA contract={contract} />);

    expect(screen.getByTestId('contract-sla-card')).toBeInTheDocument();
    expect(
      screen.getByText(
        'message.retention-sla-description - label.retention: 30 day'
      )
    ).toBeInTheDocument();
  });

  it('should render all SLA items when all properties are present', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      id: MOCK_DATA_CONTRACT.id,
      entity: MOCK_DATA_CONTRACT.entity,
      sla: {
        refreshFrequency: {
          interval: 24,
          unit: RefreshFrequencyUnit.Hour,
        },
        availabilityTime: '09:00 UTC',
        maxLatency: {
          value: 5,
          unit: MaxLatencyUnit.Minute,
        },
        retention: {
          period: 30,
          unit: RetentionUnit.Day,
        },
      },
    } as DataContract;

    render(<ContractSLA contract={contract} />);

    expect(screen.getByTestId('contract-sla-card')).toBeInTheDocument();

    // Check all SLA items are rendered
    expect(
      screen.getByText(
        'message.freshness-sla-description - label.freshness: 24 hour'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'message.completeness-sla-description - label.completeness: 09:00 UTC'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'message.latency-sla-description - label.latency: 5 minute'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'message.retention-sla-description - label.retention: 30 day'
      )
    ).toBeInTheDocument();

    // Check that all check icons are rendered
    const checkIcons = screen.getAllByTestId('check-icon');

    expect(checkIcons).toHaveLength(4);
  });

  it('should render only provided SLA items', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      id: MOCK_DATA_CONTRACT.id,
      entity: MOCK_DATA_CONTRACT.entity,
      sla: {
        refreshFrequency: {
          interval: 12,
          unit: RefreshFrequencyUnit.Hour,
        },
        retention: {
          period: 7,
          unit: RetentionUnit.Day,
        },
      },
    } as DataContract;

    render(<ContractSLA contract={contract} />);

    expect(screen.getByTestId('contract-sla-card')).toBeInTheDocument();

    // Check only provided items are rendered
    expect(
      screen.getByText(
        'message.freshness-sla-description - label.freshness: 12 hour'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'message.retention-sla-description - label.retention: 7 day'
      )
    ).toBeInTheDocument();

    // Check that availability and latency are not rendered
    expect(
      screen.queryByText(/message.completeness-sla-description/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/message.latency-sla-description/)
    ).not.toBeInTheDocument();

    // Check correct number of check icons
    const checkIcons = screen.getAllByTestId('check-icon');

    expect(checkIcons).toHaveLength(2);
  });

  it('should handle uppercase units and convert them to lowercase', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      id: MOCK_DATA_CONTRACT.id,
      entity: MOCK_DATA_CONTRACT.entity,
      sla: {
        refreshFrequency: {
          interval: 1,
          unit: RefreshFrequencyUnit.Day,
        },
        maxLatency: {
          value: 10,
          unit: MaxLatencyUnit.Minute,
        },
      },
    } as DataContract;

    render(<ContractSLA contract={contract} />);

    expect(
      screen.getByText(
        'message.freshness-sla-description - label.freshness: 1 day'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'message.latency-sla-description - label.latency: 10 minute'
      )
    ).toBeInTheDocument();
  });

  it('should have correct CSS classes applied', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      id: MOCK_DATA_CONTRACT.id,
      entity: MOCK_DATA_CONTRACT.entity,
      sla: {
        refreshFrequency: {
          interval: 24,
          unit: RefreshFrequencyUnit.Hour,
        },
      },
    } as DataContract;

    const { container } = render(<ContractSLA contract={contract} />);

    expect(container.querySelector('.contract-card-items')).toBeInTheDocument();
    expect(
      container.querySelector('.contract-card-header-container')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.contract-card-header')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.contract-dash-separator')
    ).toBeInTheDocument();
    expect(container.querySelector('.sla-item-container')).toBeInTheDocument();
    expect(container.querySelector('.sla-item')).toBeInTheDocument();
    expect(container.querySelector('.sla-icon')).toBeInTheDocument();
    expect(container.querySelector('.sla-description')).toBeInTheDocument();
  });

  it('should render SLA items in the correct order', () => {
    const contract: DataContract = {
      fullyQualifiedName: 'test.contract',
      name: 'Test Contract',
      id: MOCK_DATA_CONTRACT.id,
      entity: MOCK_DATA_CONTRACT.entity,
      sla: {
        retention: {
          period: 30,
          unit: RetentionUnit.Day,
        },
        maxLatency: {
          value: 5,
          unit: MaxLatencyUnit.Minute,
        },
        availabilityTime: '09:00 UTC',
        refreshFrequency: {
          interval: 24,
          unit: RefreshFrequencyUnit.Hour,
        },
      },
    } as DataContract;

    const { container } = render(<ContractSLA contract={contract} />);

    const slaDescriptions = container.querySelectorAll('.sla-description');

    // Order should be: refreshFrequency, availabilityTime, maxLatency, retention
    expect(slaDescriptions[0]).toHaveTextContent(
      'message.freshness-sla-description'
    );
    expect(slaDescriptions[1]).toHaveTextContent(
      'message.completeness-sla-description'
    );
    expect(slaDescriptions[2]).toHaveTextContent(
      'message.latency-sla-description'
    );
    expect(slaDescriptions[3]).toHaveTextContent(
      'message.retention-sla-description'
    );
  });

  describe('Edge Cases', () => {
    it('should handle zero values correctly', () => {
      const contract: DataContract = {
        fullyQualifiedName: 'test.contract',
        name: 'Test Contract',
        id: MOCK_DATA_CONTRACT.id,
        entity: MOCK_DATA_CONTRACT.entity,
        sla: {
          refreshFrequency: {
            interval: 0,
            unit: RefreshFrequencyUnit.Hour,
          },
          maxLatency: {
            value: 0,
            unit: MaxLatencyUnit.Minute,
          },
        },
      } as DataContract;

      render(<ContractSLA contract={contract} />);

      expect(
        screen.getByText(
          'message.freshness-sla-description - label.freshness: 0 hour'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'message.latency-sla-description - label.latency: 0 minute'
        )
      ).toBeInTheDocument();
    });

    it('should handle empty string for availabilityTime', () => {
      const contract: DataContract = {
        fullyQualifiedName: 'test.contract',
        name: 'Test Contract',
        sla: {
          availabilityTime: '',
        },
      } as DataContract;

      const { container } = render(<ContractSLA contract={contract} />);

      // Should not render anything as availabilityTime is empty
      expect(container.firstChild).toBeNull();
    });

    it('should handle partial SLA objects with undefined properties', () => {
      const contract: DataContract = {
        fullyQualifiedName: 'test.contract',
        name: 'Test Contract',
        sla: {
          refreshFrequency: undefined,
          availabilityTime: '09:00 UTC',
          maxLatency: undefined,
          retention: undefined,
        },
      } as DataContract;

      render(<ContractSLA contract={contract} />);

      // Only availabilityTime should be rendered
      expect(screen.getByTestId('contract-sla-card')).toBeInTheDocument();
      expect(
        screen.getByText(
          'message.completeness-sla-description - label.completeness: 09:00 UTC'
        )
      ).toBeInTheDocument();

      // Check only one check icon is rendered
      const checkIcons = screen.getAllByTestId('check-icon');

      expect(checkIcons).toHaveLength(1);
    });
  });
});
