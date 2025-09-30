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
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  ContractSecurity,
  Policy,
  RowFilter,
} from '../../../generated/entity/data/dataContract';
import { DataType, Table } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import ContractSecurityCard from './ContractSecurityCard.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(),
}));

const mockTableData: Partial<Table> = {
  columns: [
    {
      name: 'customer_id',
      displayName: 'Customer ID',
      fullyQualifiedName: 'table.customer_id',
      dataType: DataType.Binary,
      dataTypeDisplay: 'binary',
    },
    {
      name: 'customer_name',
      displayName: 'Customer Name',
      fullyQualifiedName: 'table.customer_name',
      dataType: DataType.Varchar,
      dataTypeDisplay: 'varchar',
    },
    {
      name: 'account_balance',
      displayName: 'Account Balance',
      fullyQualifiedName: 'table.account_balance',
      dataType: DataType.Decimal,
      dataTypeDisplay: 'decimal',
    },
  ],
};

const mockRowFilter1: RowFilter = {
  columnName: 'table.customer_id',
  values: ['123', '456', '789'],
};

const mockRowFilter2: RowFilter = {
  columnName: 'table.account_balance',
  values: ['1000', '5000'],
};

const mockPolicy1: Policy = {
  accessPolicy: 'Read Only',
  identities: ['user1@example.com', 'user2@example.com'],
  rowFilters: [mockRowFilter1],
};

const mockPolicy2: Policy = {
  accessPolicy: 'Full Access',
  identities: ['admin@example.com'],
  rowFilters: [mockRowFilter2],
};

const mockSecurityWithPolicies: ContractSecurity = {
  dataClassification: 'PII,Sensitive',
  policies: [mockPolicy1, mockPolicy2],
};

const mockSecurityWithoutPolicies: ContractSecurity = {
  dataClassification: 'Public',
  policies: [],
};

describe('ContractSecurityCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useGenericContext as jest.Mock).mockReturnValue({
      data: mockTableData,
    });
    (getEntityName as jest.Mock).mockImplementation(
      (entity) => entity.displayName || entity.name
    );
  });

  it('should render without crashing when security is undefined', () => {
    render(<ContractSecurityCard />);

    expect(screen.getByText('label.classification')).toBeInTheDocument();
    expect(screen.getByText('label.policy-plural')).toBeInTheDocument();
  });

  it('should render classification tags when dataClassification is provided', () => {
    render(<ContractSecurityCard security={mockSecurityWithPolicies} />);

    expect(screen.getByText('PII')).toBeInTheDocument();
    expect(screen.getByText('Sensitive')).toBeInTheDocument();
  });

  it('should split classification by comma and render multiple tags', () => {
    const security: ContractSecurity = {
      dataClassification: 'PII,Sensitive,Financial',
      policies: [],
    };

    render(<ContractSecurityCard security={security} />);

    expect(screen.getByText('PII')).toBeInTheDocument();
    expect(screen.getByText('Sensitive')).toBeInTheDocument();
    expect(screen.getByText('Financial')).toBeInTheDocument();
  });

  it('should render policies with access policy and identities', () => {
    render(<ContractSecurityCard security={mockSecurityWithPolicies} />);

    expect(screen.getByText(/Read Only/)).toBeInTheDocument();
    expect(screen.getByText(/Full Access/)).toBeInTheDocument();
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('should render NO_DATA_PLACEHOLDER when access policy is undefined', () => {
    const policyWithoutAccessPolicy: Policy = {
      identities: ['user@example.com'],
      rowFilters: [],
    };
    const security: ContractSecurity = {
      dataClassification: 'Public',
      policies: [policyWithoutAccessPolicy],
    };

    render(<ContractSecurityCard security={security} />);

    expect(screen.getByText(NO_DATA_PLACEHOLDER)).toBeInTheDocument();
  });

  it('should render row filters with column names from tableColumnNameMap', () => {
    render(<ContractSecurityCard security={mockSecurityWithPolicies} />);

    expect(screen.getByText(/Customer ID =/)).toBeInTheDocument();
    expect(screen.getByText(/Account Balance =/)).toBeInTheDocument();
  });

  it('should render row filter values correctly', () => {
    render(<ContractSecurityCard security={mockSecurityWithPolicies} />);

    expect(screen.getByText(/123/)).toBeInTheDocument();
    expect(screen.getByText(/456/)).toBeInTheDocument();
    expect(screen.getByText(/789/)).toBeInTheDocument();
    expect(screen.getByText(/1000/)).toBeInTheDocument();
    expect(screen.getByText(/5000/)).toBeInTheDocument();
  });

  it('should render commas between row filter values except for the last one', () => {
    const { container } = render(
      <ContractSecurityCard security={mockSecurityWithPolicies} />
    );

    const rowFilterValues = container.querySelectorAll('.row-filter-value');

    expect(rowFilterValues[0].textContent).toBe('123,');
    expect(rowFilterValues[1].textContent).toBe('456,');
    expect(rowFilterValues[2].textContent).toBe('789null');
    expect(rowFilterValues[3].textContent).toBe('1000,');
    expect(rowFilterValues[4].textContent).toBe('5000null');
  });

  it('should use column name directly when not found in tableColumnNameMap', () => {
    const policyWithUnknownColumn: Policy = {
      accessPolicy: 'Read',
      identities: ['user@example.com'],
      rowFilters: [
        {
          columnName: 'unknown.column',
          values: ['value1'],
        },
      ],
    };
    const security: ContractSecurity = {
      dataClassification: 'Public',
      policies: [policyWithUnknownColumn],
    };

    render(<ContractSecurityCard security={security} />);

    expect(screen.getByText(/unknown.column =/)).toBeInTheDocument();
  });

  it('should render identities label for each policy', () => {
    render(<ContractSecurityCard security={mockSecurityWithPolicies} />);

    const identitiesLabels = screen.getAllByText('label.identities');

    expect(identitiesLabels).toHaveLength(2);
  });

  it('should render row filters label for each policy', () => {
    render(<ContractSecurityCard security={mockSecurityWithPolicies} />);

    const rowFiltersLabels = screen.getAllByText('label.row-filter-plural');

    expect(rowFiltersLabels).toHaveLength(2);
  });

  it('should render empty state when no policies are provided', () => {
    render(<ContractSecurityCard security={mockSecurityWithoutPolicies} />);

    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.queryByText(/label.access-policy:/)).not.toBeInTheDocument();
  });

  it('should handle empty identities array in policy', () => {
    const policyWithoutIdentities: Policy = {
      accessPolicy: 'Read',
      identities: [],
      rowFilters: [],
    };
    const security: ContractSecurity = {
      dataClassification: 'Public',
      policies: [policyWithoutIdentities],
    };

    render(<ContractSecurityCard security={security} />);

    expect(screen.getByText(/Read/)).toBeInTheDocument();
    expect(screen.getByText('label.identities')).toBeInTheDocument();
  });

  it('should handle empty rowFilters array in policy', () => {
    const policyWithoutRowFilters: Policy = {
      accessPolicy: 'Read',
      identities: ['user@example.com'],
      rowFilters: [],
    };
    const security: ContractSecurity = {
      dataClassification: 'Public',
      policies: [policyWithoutRowFilters],
    };

    render(<ContractSecurityCard security={security} />);

    expect(screen.getByText('label.row-filter-plural')).toBeInTheDocument();
    expect(screen.queryByText(/=/)).not.toBeInTheDocument();
  });

  it('should handle table data without columns', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { columns: [] },
    });

    render(<ContractSecurityCard security={mockSecurityWithPolicies} />);

    expect(screen.getByText(/table.customer_id =/)).toBeInTheDocument();
  });

  it('should throw error when table data is undefined', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: undefined,
    });

    expect(() => {
      render(<ContractSecurityCard security={mockSecurityWithPolicies} />);
    }).toThrow("Cannot read properties of undefined (reading 'columns')");
  });

  it('should apply correct CSS classes', () => {
    const { container } = render(
      <ContractSecurityCard security={mockSecurityWithPolicies} />
    );

    expect(
      container.querySelector('.contract-security-component-container')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.contract-security-classification-container')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.contract-security-policy-card')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.contract-dash-separator')
    ).toBeInTheDocument();
  });

  it('should render classification tags with pink color', () => {
    const { container } = render(
      <ContractSecurityCard security={mockSecurityWithPolicies} />
    );

    const classificationTags = container.querySelectorAll(
      '.contract-security-classification-container .ant-tag-pink'
    );

    expect(classificationTags).toHaveLength(2);
  });

  it('should handle columns without fullyQualifiedName', () => {
    const tableDataWithoutFQN: Partial<Table> = {
      columns: [
        {
          name: 'customer_id',
          displayName: 'Customer ID',
          dataType: DataType.Int,
          dataTypeDisplay: 'int',
        },
      ],
    };

    (useGenericContext as jest.Mock).mockReturnValue({
      data: tableDataWithoutFQN,
    });

    render(<ContractSecurityCard security={mockSecurityWithPolicies} />);

    expect(screen.getByText(/table.customer_id =/)).toBeInTheDocument();
  });

  it('should handle row filters without values', () => {
    const policyWithEmptyValues: Policy = {
      accessPolicy: 'Read',
      identities: ['user@example.com'],
      rowFilters: [
        {
          columnName: 'table.customer_id',
          values: [],
        },
      ],
    };
    const security: ContractSecurity = {
      dataClassification: 'Public',
      policies: [policyWithEmptyValues],
    };

    render(<ContractSecurityCard security={security} />);

    expect(screen.getByText(/Customer ID =/)).toBeInTheDocument();
  });

  it('should handle row filters with undefined values', () => {
    const policyWithUndefinedValues: Policy = {
      accessPolicy: 'Read',
      identities: ['user@example.com'],
      rowFilters: [
        {
          columnName: 'table.customer_id',
          values: undefined,
        },
      ],
    };
    const security: ContractSecurity = {
      dataClassification: 'Public',
      policies: [policyWithUndefinedValues],
    };

    render(<ContractSecurityCard security={security} />);

    expect(screen.getByText(/Customer ID =/)).toBeInTheDocument();
  });
});
