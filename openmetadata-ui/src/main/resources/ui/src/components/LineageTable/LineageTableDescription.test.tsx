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
import { MemoryRouter } from 'react-router-dom';
import { useIsTextClamped } from '../../hooks/useIsTextClamped';
import LineageTableDescription from './LineageTableDescription';

// jsdom does no layout, so whether the clamp cuts the text is supplied here.
jest.mock('../../hooks/useIsTextClamped', () => ({
  useIsTextClamped: jest.fn(),
}));

const renderCell = (isClamped: boolean) => {
  (useIsTextClamped as jest.Mock).mockReturnValue({
    ref: { current: null },
    isClamped,
  });

  render(
    <MemoryRouter>
      <LineageTableDescription
        description="Stores core profile and contact information"
        entityPath="/table/sample.db.schema.customer"
      />
    </MemoryRouter>
  );
};

describe('LineageTableDescription', () => {
  it('links to the asset page when the description is clamped', () => {
    renderCell(true);

    expect(screen.getByTestId('impact-description')).toHaveTextContent(
      'Stores core profile and contact information'
    );
    expect(screen.getByTestId('impact-description-view-more')).toHaveAttribute(
      'href',
      '/table/sample.db.schema.customer'
    );
  });

  it('shows no link when the description fits', () => {
    renderCell(false);

    expect(
      screen.queryByTestId('impact-description-view-more')
    ).not.toBeInTheDocument();
  });
});
