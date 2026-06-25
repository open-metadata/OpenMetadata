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
import { OperationBadge, OperationSummary } from './OperationCell.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('OperationCell', () => {
  describe('OperationBadge', () => {
    it('should render the operation label', () => {
      render(<OperationBadge operation="CREATE" />);

      expect(screen.getByText('label.create')).toBeInTheDocument();
    });

    it('should render a rename hint when a renamed row creates a new entity', () => {
      render(
        <OperationBadge
          currentName="new_metric"
          operation="CREATE"
          originalName="old_metric"
        />
      );

      expect(screen.getByText('old_metric')).toBeInTheDocument();
      expect(screen.getByText('label.new-lowercase')).toBeInTheDocument();
    });

    it('should not render a rename hint for non-create operations', () => {
      render(
        <OperationBadge
          currentName="metric"
          operation="UPDATE"
          originalName="metric"
        />
      );

      expect(screen.queryByText('label.new-lowercase')).not.toBeInTheDocument();
    });
  });

  describe('OperationSummary', () => {
    it('should render a count for every operation by default', () => {
      render(
        <OperationSummary
          summary={{ CREATE: 3, UPDATE: 2, NO_CHANGE: 5, SKIP: 1 }}
        />
      );
      const summary = screen.getByTestId('bulk-edit-operation-summary');

      expect(summary).toBeInTheDocument();
      expect(summary).toHaveTextContent('label.create');
      expect(summary).toHaveTextContent('label.no-change');
    });

    it('should only render the provided operations', () => {
      render(
        <OperationSummary
          operations={['CREATE', 'UPDATE', 'SKIP']}
          summary={{ CREATE: 1, UPDATE: 1, NO_CHANGE: 0, SKIP: 1 }}
        />
      );

      expect(
        screen.getByTestId('bulk-edit-operation-summary')
      ).not.toHaveTextContent('label.no-change');
    });
  });
});
