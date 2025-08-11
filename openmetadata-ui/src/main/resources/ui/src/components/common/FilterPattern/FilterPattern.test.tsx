/*
 *  Copyright 2022 Collate.
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

import { findByTestId, render } from '@testing-library/react';
import { FilterPatternEnum } from '../../../enums/filterPattern.enum';
import FilterPattern from './FilterPattern';
import { FilterPatternProps } from './filterPattern.interface';

const mockFilterPatternProps: FilterPatternProps = {
  checked: true,
  handleChecked: jest.fn(),
  includePattern: undefined,
  excludePattern: undefined,
  type: FilterPatternEnum.TABLE,
  getExcludeValue: jest.fn(),
  getIncludeValue: jest.fn(),
};

describe('Test FilterPattern component', () => {
  it('FilterPattern component should render', async () => {
    const { container } = render(<FilterPattern {...mockFilterPatternProps} />);

    const filterPatternContainer = await findByTestId(
      container,
      'filter-pattern-container'
    );
    const fieldContainer = await findByTestId(container, 'field-container');
    const checkbox = await findByTestId(
      container,
      `${mockFilterPatternProps.type}-filter-pattern-checkbox`
    );
    const includeFilterInput = await findByTestId(
      container,
      'filter-pattern-includes-table'
    );
    const excludeFilterInput = await findByTestId(
      container,
      'filter-pattern-excludes-table'
    );

    expect(filterPatternContainer).toBeInTheDocument();
    expect(checkbox).toBeInTheDocument();
    expect(fieldContainer).toBeInTheDocument();
    expect(includeFilterInput).toBeInTheDocument();
    expect(excludeFilterInput).toBeInTheDocument();
  });

  it('FilterPattern component should render with filter pattern description', async () => {
    const { container } = render(<FilterPattern {...mockFilterPatternProps} />);

    const filterPatternContainer = await findByTestId(
      container,
      'filter-pattern-container'
    );
    const fieldContainer = await findByTestId(container, 'field-container');
    const checkbox = await findByTestId(
      container,
      `${mockFilterPatternProps.type}-filter-pattern-checkbox`
    );

    const includeFilterInput = await findByTestId(
      container,
      'filter-pattern-includes-table'
    );
    const excludeFilterInput = await findByTestId(
      container,
      'filter-pattern-excludes-table'
    );

    expect(filterPatternContainer).toBeInTheDocument();
    expect(checkbox).toBeInTheDocument();
    expect(fieldContainer).toBeInTheDocument();
    expect(includeFilterInput).toBeInTheDocument();
    expect(excludeFilterInput).toBeInTheDocument();
  });
});
