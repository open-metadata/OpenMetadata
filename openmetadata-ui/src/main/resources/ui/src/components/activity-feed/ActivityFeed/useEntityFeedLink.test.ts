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
import { renderHook } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { useEntityFeedLink } from './useEntityFeedLink';

let mockRouteFqn = '';

// The route alone is mocked, so useFqn splits it as on the page.
jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: () => ({ fqn: mockRouteFqn }),
}));

const linkFor = (entityType: EntityType, fallbackFqn?: string) =>
  renderHook(() => useEntityFeedLink(entityType, fallbackFqn)).result.current;

describe('useEntityFeedLink', () => {
  beforeEach(() => {
    mockRouteFqn = 'drive.sales.q3.summary';
  });

  // A worksheet's FQN nests under its spreadsheet's: kept whole.
  it('links the entity the route names', () => {
    expect(linkFor(EntityType.WORKSHEET)).toBe(
      '<#E::worksheet::drive.sales.q3.summary>'
    );
  });

  // A column deep link names the table, then the column.
  it('links the table, not the column, on a column link', () => {
    mockRouteFqn = 'svc.db.schema.orders.customer_id';

    expect(linkFor(EntityType.TABLE)).toBe('<#E::table::svc.db.schema.orders>');
  });

  it('prefers the route over the fallback', () => {
    expect(linkFor(EntityType.DOMAIN, 'Other')).toBe(
      '<#E::domain::drive.sales.q3.summary>'
    );
  });

  it('falls back where the route names no entity', () => {
    mockRouteFqn = '';

    expect(linkFor(EntityType.DOMAIN, 'Finance')).toBe('<#E::domain::Finance>');
    expect(linkFor(EntityType.DOMAIN)).toBe('');
  });

  // A profile's tab is the user's own feed, not one about them.
  it('has no link for a user', () => {
    expect(linkFor(EntityType.USER)).toBe('');
  });
});
