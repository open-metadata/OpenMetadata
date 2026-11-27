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
import { EntityType } from '../enums/entity.enum';
import { getEntityDetailComponent } from './EntityDetailComponentUtils';

jest.mock(
  '../components/Entity/EntityDetailsPageSkeleton/EntityDetailsPageSkeleton',
  () => jest.fn(() => <p>testEntitySkeleton</p>)
);

jest.mock('../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn(() => <p>testSpinner</p>),
}));

jest.mock('../pages/TableDetailsPageV1/TableDetailsPageV1', () => ({
  __esModule: true,
  default: () => <p>testTablePage</p>,
}));

describe('getEntityDetailComponent', () => {
  it('shows the entity-page skeleton, not a spinner, while the page chunk loads', async () => {
    const TablePage = getEntityDetailComponent(EntityType.TABLE);

    expect(TablePage).not.toBeNull();

    if (TablePage) {
      render(<TablePage />);
    }

    // lazy() suspends on the first render even when the module is already available.
    expect(screen.getByText('testEntitySkeleton')).toBeInTheDocument();
    expect(screen.queryByText('testSpinner')).not.toBeInTheDocument();
    expect(await screen.findByText('testTablePage')).toBeInTheDocument();
  });

  it('returns null for an entity type without a detail page', () => {
    expect(getEntityDetailComponent('unknownEntity')).toBeNull();
  });
});
