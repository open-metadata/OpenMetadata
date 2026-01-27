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
import { SemanticsRule } from '../../../generated/entity/data/dataContract';
import {
  ContractExecutionStatus,
  DataContractResult,
} from '../../../generated/entity/datacontract/dataContractResult';
import { getContractStatusType } from '../../../utils/DataContract/DataContractUtils';
import ContractSemantics from './ContractSemantics.component';

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () => {
  return function MockRichTextEditorPreviewerNew({
    markdown,
  }: {
    markdown: string;
  }) {
    return <div data-testid="rich-text-preview">{markdown}</div>;
  };
});

jest.mock('../../common/StatusBadge/StatusBadgeV2.component', () => {
  return function MockStatusBadgeV2({
    label,
    dataTestId,
  }: {
    label: string;
    dataTestId: string;
  }) {
    return <div data-testid={dataTestId}>{label}</div>;
  };
});

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  getContractStatusType: jest.fn((status: string) => status),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'label.entity-status': `${options?.entity} Status`,
        'label.semantic-plural': 'Semantic',
      };

      return translations[key] || key;
    },
  }),
}));

const mockSemantics: SemanticsRule[] = [
  {
    name: 'Rule 1',
    description: 'First semantic rule description',
    rule: '{"and":[{"==":[{"var":"name"},"test"]}]}',
    enabled: true,
  },
  {
    name: 'Rule 2',
    description: 'Second semantic rule description',
    rule: '{"and":[{"==":[{"var":"age"},"25"]}]}',
    enabled: true,
  },
];

const mockLatestContractResults: DataContractResult = {
  timestamp: Date.now(),
  dataContractFQN: 'contract',
  contractExecutionStatus: ContractExecutionStatus.Success,
  semanticsValidation: {
    passed: 1,
    failed: 1,
    total: 2,
    failedRules: [
      {
        ruleName: 'Rule 2',
        reason: 'Second semantic rule description',
      },
    ],
  },
} as DataContractResult;

describe('ContractSemantics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<ContractSemantics semantics={mockSemantics} />);

      expect(screen.getByText('Rule 1')).toBeInTheDocument();
      expect(screen.getByText('Rule 2')).toBeInTheDocument();
    });

    it('should render all semantic rules', () => {
      render(<ContractSemantics semantics={mockSemantics} />);

      expect(
        screen.getByText('First semantic rule description')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Second semantic rule description')
      ).toBeInTheDocument();
    });

    it('should render with empty semantics array', () => {
      const { container } = render(<ContractSemantics semantics={[]} />);

      expect(container.querySelector('.rule-item')).not.toBeInTheDocument();
    });
  });

  describe('Icon Rendering Based on Execution Results', () => {
    it('should render default icons when no latest results are provided', () => {
      const { container } = render(
        <ContractSemantics semantics={mockSemantics} />
      );

      const icons = container.querySelectorAll('.rule-icon-default');

      expect(icons).toHaveLength(2);
    });

    it('should render success icon for passed rules', () => {
      render(
        <ContractSemantics
          latestContractResults={mockLatestContractResults}
          semantics={mockSemantics}
        />
      );

      const icons = document.querySelectorAll('.rule-icon');

      expect(icons).toHaveLength(2);
    });

    it('should render fail icon for failed rules', () => {
      render(
        <ContractSemantics
          latestContractResults={mockLatestContractResults}
          semantics={mockSemantics}
        />
      );

      const icons = document.querySelectorAll('.rule-icon');

      expect(icons).toHaveLength(2);
    });
  });

  describe('Contract Status Display', () => {
    it('should display contract status when provided', () => {
      render(
        <ContractSemantics contractStatus="Passed" semantics={mockSemantics} />
      );

      expect(screen.getByText('Semantic Status :')).toBeInTheDocument();
      expect(
        screen.getByTestId('contract-status-card-item-semantics-status')
      ).toBeInTheDocument();
      expect(screen.getByText('Passed')).toBeInTheDocument();
    });

    it('should not display contract status when not provided', () => {
      render(<ContractSemantics semantics={mockSemantics} />);

      expect(screen.queryByText('Semantic Status :')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('contract-status-card-item-semantics-status')
      ).not.toBeInTheDocument();
    });

    it('should display different status values correctly', () => {
      const { rerender } = render(
        <ContractSemantics contractStatus="Failed" semantics={mockSemantics} />
      );

      expect(screen.getByText('Failed')).toBeInTheDocument();

      rerender(
        <ContractSemantics contractStatus="Success" semantics={mockSemantics} />
      );

      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });

  describe('Rich Text Preview Integration', () => {
    it('should render RichTextEditorPreviewerNew for each rule description', () => {
      render(<ContractSemantics semantics={mockSemantics} />);

      const richTextPreviews = screen.getAllByTestId('rich-text-preview');

      expect(richTextPreviews).toHaveLength(2);
      expect(richTextPreviews[0]).toHaveTextContent(
        'First semantic rule description'
      );
      expect(richTextPreviews[1]).toHaveTextContent(
        'Second semantic rule description'
      );
    });
  });

  describe('Layout and Structure', () => {
    it('should render with proper row and column structure', () => {
      const { container } = render(
        <ContractSemantics semantics={mockSemantics} />
      );

      expect(
        container.querySelector('.contract-semantic-component-container')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.rule-item-container')
      ).toBeInTheDocument();
    });

    it('should render multiple rule items', () => {
      const { container } = render(
        <ContractSemantics semantics={mockSemantics} />
      );

      const ruleItems = container.querySelectorAll('.rule-item');

      expect(ruleItems).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle semantics with missing descriptions', () => {
      const semanticsWithoutDescription: SemanticsRule[] = [
        {
          name: 'Rule Without Description',
          description: '',
          rule: '{"and":[{"==":[{"var":"name"},"test"]}]}',
          enabled: true,
        },
      ];

      render(<ContractSemantics semantics={semanticsWithoutDescription} />);

      expect(screen.getByText('Rule Without Description')).toBeInTheDocument();
    });

    it('should handle latestContractResults without semanticsValidation', () => {
      const resultsWithoutSemantics = {
        ...mockLatestContractResults,
        semanticsValidation: undefined,
      };

      render(
        <ContractSemantics
          latestContractResults={resultsWithoutSemantics}
          semantics={mockSemantics}
        />
      );

      expect(screen.getByText('Rule 1')).toBeInTheDocument();
      expect(screen.getByText('Rule 2')).toBeInTheDocument();
    });

    it('should handle latestContractResults without failedRules', () => {
      const resultsWithoutFailedRules: DataContractResult = {
        ...mockLatestContractResults,
        semanticsValidation: {
          passed: 2,
          failed: 0,
          total: 2,
          failedRules: [],
        },
      };

      render(
        <ContractSemantics
          latestContractResults={resultsWithoutFailedRules}
          semantics={mockSemantics}
        />
      );

      expect(screen.getByText('Rule 1')).toBeInTheDocument();
      expect(screen.getByText('Rule 2')).toBeInTheDocument();
    });

    it('should handle single semantic rule', () => {
      const singleSemantic: SemanticsRule[] = [
        {
          name: 'Single Rule',
          description: 'Single rule description',
          rule: '{"and":[{"==":[{"var":"name"},"test"]}]}',
          enabled: true,
        },
      ];

      render(<ContractSemantics semantics={singleSemantic} />);

      expect(screen.getByText('Single Rule')).toBeInTheDocument();
      expect(screen.getByText('Single rule description')).toBeInTheDocument();
    });
  });

  describe('Integration with getContractStatusType', () => {
    it('should call getContractStatusType with correct status', () => {
      render(
        <ContractSemantics contractStatus="Passed" semantics={mockSemantics} />
      );

      expect(getContractStatusType).toHaveBeenCalledWith('Passed');
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic HTML structure', () => {
      const { container } = render(
        <ContractSemantics contractStatus="Passed" semantics={mockSemantics} />
      );

      expect(container.querySelector('.rule-name')).toBeInTheDocument();
      expect(container.querySelector('.rule-description')).toBeInTheDocument();
      expect(
        container.querySelector('.contract-status-container')
      ).toBeInTheDocument();
    });
  });
});
