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

import { fireEvent, render, screen } from '@testing-library/react';
import PaginationComponent from './PaginationComponent';

describe('PaginationComponent', () => {
  it('hides a single page by default', () => {
    render(<PaginationComponent pageSize={10} total={10} />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('converts records into pages and preserves the callback page size', () => {
    const onChange = jest.fn();
    render(
      <PaginationComponent
        current={1}
        pageSize={10}
        total={25}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('next'));

    expect(onChange).toHaveBeenCalledWith(2, 10);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('keeps uncontrolled navigation state', () => {
    render(<PaginationComponent defaultPageSize={10} total={30} />);

    fireEvent.click(screen.getByTestId('next'));

    expect(screen.getByRole('textbox', { name: /current page/i })).toHaveValue(
      '2'
    );
  });
});
