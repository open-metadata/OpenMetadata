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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import yaml from 'js-yaml';
import { CSMode } from '../../../enums/codemirror.enum';
import {
  DataContract,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import { Column } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/entity/type';
import { getUpdatedContractDetails } from '../../../utils/DataContract/DataContractUtils';
import ContractYaml from './ContractYaml.component';

jest.mock('js-yaml', () => ({
  dump: jest.fn(),
}));

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  getUpdatedContractDetails: jest.fn(),
}));

jest.mock('../../Database/SchemaEditor/SchemaEditor', () => {
  return function MockSchemaEditor({
    className,
    editorClass,
    mode,
    value,
  }: any) {
    return (
      <div className={className} data-testid="schema-editor">
        <div data-testid="editor-class">{editorClass}</div>
        <div data-testid="editor-mode">{mode?.name}</div>
        <div data-testid="editor-value">{value}</div>
      </div>
    );
  };
});

const mockContract: DataContract = {
  id: 'contract-1',
  name: 'Test Contract',
  description: 'Test Description',
  owners: [] as EntityReference[],
  schema: [
    { name: 'id', dataType: 'BIGINT' },
    { name: 'name', dataType: 'VARCHAR' },
  ] as Column[],
  qualityExpectations: [] as EntityReference[],
  semantics: [] as SemanticsRule[],
  entity: { id: 'table-1', type: 'TABLE' } as EntityReference,
};

const mockYamlOutput = `
id: contract-1
name: Test Contract
description: Test Description
schema:
  - name: id
    dataType: BIGINT
  - name: name
    dataType: VARCHAR
`;

const mockUpdatedContract = {
  ...mockContract,
  updatedField: 'updatedValue',
};

describe('ContractYaml', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUpdatedContractDetails as jest.Mock).mockReturnValue(
      mockUpdatedContract
    );
    (yaml.dump as jest.Mock).mockReturnValue(mockYamlOutput);
  });

  describe('Basic Rendering', () => {
    it('should render the component with schema editor', () => {
      render(<ContractYaml contract={mockContract} />);

      expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
    });

    it('should render with correct container class', () => {
      const { container } = render(<ContractYaml contract={mockContract} />);

      expect(
        container.querySelector('.contract-yaml-container')
      ).toBeInTheDocument();
    });

    it('should pass correct props to SchemaEditor', () => {
      render(<ContractYaml contract={mockContract} />);

      expect(screen.getByTestId('schema-editor')).toHaveClass(
        'contract-yaml-schema-editor'
      );
      expect(screen.getByTestId('editor-class')).toHaveTextContent(
        'custom-entity-schema'
      );
      expect(screen.getByTestId('editor-mode')).toHaveTextContent(CSMode.YAML);
    });
  });

  describe('Data Processing', () => {
    it('should call getUpdatedContractDetails with contract', () => {
      render(<ContractYaml contract={mockContract} />);

      expect(getUpdatedContractDetails).toHaveBeenCalledWith(
        mockContract,
        mockContract
      );
    });

    it('should call yaml.dump with updated contract details', () => {
      render(<ContractYaml contract={mockContract} />);

      expect(yaml.dump).toHaveBeenCalledWith(mockUpdatedContract);
    });

    it('should display the YAML output in schema editor', () => {
      render(<ContractYaml contract={mockContract} />);

      const actualText = screen
        .getByTestId('editor-value')
        .textContent?.replace(/\s+/g, ' ')
        .trim();
      const expectedText = mockYamlOutput.replace(/\s+/g, ' ').trim();

      expect(actualText).toBe(expectedText);
    });
  });

  describe('Memoization', () => {
    it('should memoize YAML output based on contract', () => {
      const { rerender } = render(<ContractYaml contract={mockContract} />);

      expect(yaml.dump).toHaveBeenCalledTimes(1);

      // Re-render with same contract
      rerender(<ContractYaml contract={mockContract} />);

      expect(yaml.dump).toHaveBeenCalledTimes(1); // Should not call again due to memoization
    });

    it('should recompute YAML when contract changes', () => {
      const { rerender } = render(<ContractYaml contract={mockContract} />);

      expect(yaml.dump).toHaveBeenCalledTimes(1);

      const updatedContract = { ...mockContract, name: 'Updated Contract' };
      rerender(<ContractYaml contract={updatedContract} />);

      expect(yaml.dump).toHaveBeenCalledTimes(2);
    });
  });

  describe('Schema Editor Configuration', () => {
    it('should configure schema editor with YAML mode', () => {
      render(<ContractYaml contract={mockContract} />);

      expect(screen.getByTestId('editor-mode')).toHaveTextContent(CSMode.YAML);
    });

    it('should apply correct CSS classes to schema editor', () => {
      render(<ContractYaml contract={mockContract} />);

      const editor = screen.getByTestId('schema-editor');

      expect(editor).toHaveClass('contract-yaml-schema-editor');
    });

    it('should set correct editor class', () => {
      render(<ContractYaml contract={mockContract} />);

      expect(screen.getByTestId('editor-class')).toHaveTextContent(
        'custom-entity-schema'
      );
    });
  });

  describe('Contract Data Handling', () => {
    it('should handle contract with all properties', () => {
      const fullContract: DataContract = {
        id: 'full-contract',
        name: 'Full Contract',
        description: 'Full Description',
        owners: [
          { id: 'user-1', name: 'User 1', type: 'user' },
        ] as EntityReference[],
        schema: [
          { name: 'id', dataType: 'BIGINT' },
          { name: 'name', dataType: 'VARCHAR' },
          { name: 'email', dataType: 'VARCHAR' },
        ] as Column[],
        qualityExpectations: [
          { id: 'test-1', name: 'Test 1', type: 'test' },
        ] as EntityReference[],
        semantics: [
          {
            name: 'Semantic Rule',
            rule: 'test rule',
            description: 'Test desc',
            enabled: true,
          },
        ] as SemanticsRule[],
        entity: { id: 'table-1', type: 'TABLE' } as EntityReference,
      };

      render(<ContractYaml contract={fullContract} />);

      expect(getUpdatedContractDetails).toHaveBeenCalledWith(
        fullContract,
        fullContract
      );
    });

    it('should handle contract with minimal properties', () => {
      const minimalContract: DataContract = {
        id: 'minimal-contract',
        name: 'Minimal Contract',
        entity: { id: 'table-1', type: 'TABLE' } as EntityReference,
      };

      render(<ContractYaml contract={minimalContract} />);

      expect(getUpdatedContractDetails).toHaveBeenCalledWith(
        minimalContract,
        minimalContract
      );
    });
  });

  describe('YAML Formatting', () => {
    it('should handle complex contract structures', () => {
      const complexContract: DataContract = {
        id: 'complex-contract',
        name: 'Complex Contract',
        description: 'Complex Description',
        schema: [
          {
            name: 'address',
            dataType: 'STRUCT',
            children: [
              { name: 'street', dataType: 'VARCHAR' },
              { name: 'city', dataType: 'VARCHAR' },
            ],
          },
        ] as Column[],
        semantics: [
          {
            name: 'Complex Rule',
            rule: '{"and": [{"=": [{"var": "column1"}, "value1"]}]}',
            enabled: true,
            description: 'Complex description',
          },
        ] as SemanticsRule[],
        entity: { id: 'table-1', type: 'TABLE' } as EntityReference,
      };

      render(<ContractYaml contract={complexContract} />);

      expect(getUpdatedContractDetails).toHaveBeenCalledWith(
        complexContract,
        complexContract
      );
      expect(yaml.dump).toHaveBeenCalledWith(mockUpdatedContract);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in getUpdatedContractDetails gracefully', () => {
      (getUpdatedContractDetails as jest.Mock).mockImplementation(() => {
        throw new Error('Processing error');
      });

      expect(() => {
        render(<ContractYaml contract={mockContract} />);
      }).toThrow('Processing error');
    });

    it('should handle errors in yaml.dump gracefully', () => {
      (yaml.dump as jest.Mock).mockImplementation(() => {
        throw new Error('YAML error');
      });

      expect(() => {
        render(<ContractYaml contract={mockContract} />);
      }).toThrow('YAML error');
    });

    it('should handle undefined contract gracefully', () => {
      expect(() => {
        render(
          <ContractYaml contract={undefined as unknown as DataContract} />
        );
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should only recompute YAML when contract reference changes', () => {
      const { rerender } = render(<ContractYaml contract={mockContract} />);

      expect(yaml.dump).toHaveBeenCalledTimes(1);

      // Same contract reference
      rerender(<ContractYaml contract={mockContract} />);

      expect(yaml.dump).toHaveBeenCalledTimes(1);

      // Different contract reference but same content
      rerender(<ContractYaml contract={{ ...mockContract }} />);

      expect(yaml.dump).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration', () => {
    it('should integrate properly with contract utils', () => {
      render(<ContractYaml contract={mockContract} />);

      expect(getUpdatedContractDetails).toHaveBeenCalledWith(
        mockContract,
        mockContract
      );
    });

    it('should integrate properly with js-yaml library', () => {
      render(<ContractYaml contract={mockContract} />);

      expect(yaml.dump).toHaveBeenCalledWith(mockUpdatedContract);
    });

    it('should integrate properly with SchemaEditor component', () => {
      render(<ContractYaml contract={mockContract} />);

      const editor = screen.getByTestId('schema-editor');

      expect(editor).toBeInTheDocument();

      const actualText = screen
        .getByTestId('editor-value')
        .textContent?.replace(/\s+/g, ' ')
        .trim();
      const expectedText = mockYamlOutput.replace(/\s+/g, ' ').trim();

      expect(actualText).toBe(expectedText);
    });
  });
});
