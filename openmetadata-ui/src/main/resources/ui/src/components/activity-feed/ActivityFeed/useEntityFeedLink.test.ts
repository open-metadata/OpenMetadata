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

// [type, route FQN, the FQN the link names]: one case per way a page's route
// can name its entity. A column, field or feature deep link appends the child
// to the entity's FQN; the link must name the entity, as its page does.
const ROUTE_CASES: [EntityType, string, string][] = [
  [EntityType.TABLE, 'svc.db.schema.orders', 'svc.db.schema.orders'],
  [
    EntityType.TABLE,
    'svc.db.schema.orders.customer_id',
    'svc.db.schema.orders',
  ],
  [
    EntityType.TABLE,
    'svc.db.schema.orders.address.city',
    'svc.db.schema.orders',
  ],
  [EntityType.STORED_PROCEDURE, 'svc.db.schema.load', 'svc.db.schema.load'],
  [EntityType.DATABASE, 'svc.db', 'svc.db'],
  [EntityType.DATABASE_SCHEMA, 'svc.db.schema', 'svc.db.schema'],
  [EntityType.TOPIC, 'kafka.orders.order_id', 'kafka.orders'],
  [EntityType.SEARCH_INDEX, 'es.orders_index.status', 'es.orders_index'],
  [EntityType.MLMODEL, 'ml.churn.tenure', 'ml.churn'],
  [EntityType.API_ENDPOINT, 'api.store.getOrder.id', 'api.store.getOrder'],
  [
    EntityType.DASHBOARD_DATA_MODEL,
    'bi.model.revenue.amount',
    'bi.model.revenue',
  ],
  [EntityType.DASHBOARD, 'bi.sales', 'bi.sales'],
  [EntityType.CHART, 'bi.sales_by_region', 'bi.sales_by_region'],
  [EntityType.PIPELINE, 'airflow.etl', 'airflow.etl'],
  [EntityType.METRIC, 'revenue', 'revenue'],
  [EntityType.API_COLLECTION, 'api.store', 'api.store'],
  // Variable depth: nested under a parent of the same kind, read whole.
  [EntityType.CONTAINER, 's3.raw.2026.october', 's3.raw.2026.october'],
  [EntityType.DIRECTORY, 'drive.finance.reports', 'drive.finance.reports'],
  [EntityType.FILE, 'drive.finance.q3.pdf', 'drive.finance.q3.pdf'],
  [EntityType.SPREADSHEET, 'drive.finance.budget', 'drive.finance.budget'],
  [
    EntityType.WORKSHEET,
    'drive.finance.budget.summary',
    'drive.finance.budget.summary',
  ],
  [EntityType.GLOSSARY, 'Business', 'Business'],
  [EntityType.GLOSSARY_TERM, 'Business.Revenue.Net', 'Business.Revenue.Net'],
  [EntityType.TAG, 'PII.Sensitive', 'PII.Sensitive'],
  [EntityType.DOMAIN, 'Finance.Payments', 'Finance.Payments'],
  [EntityType.DATA_PRODUCT, 'Finance.Ledger', 'Finance.Ledger'],
  [EntityType.KNOWLEDGE_PAGE, 'Onboarding', 'Onboarding'],
  // Quoted parts keep their dots: one part, not a column.
  [EntityType.TABLE, 'svc.db.schema."orders.v2"', 'svc.db.schema."orders.v2"'],
  [
    EntityType.TABLE,
    'svc.db.schema."orders.v2".id',
    'svc.db.schema."orders.v2"',
  ],
  [EntityType.GLOSSARY_TERM, '"PW%g.1"."PW.term%2"', '"PW%g.1"."PW.term%2"'],
];

describe('useEntityFeedLink', () => {
  it.each(ROUTE_CASES)(
    'links a %s by its own FQN for route "%s"',
    (entityType, routeFqn, entityFqn) => {
      mockRouteFqn = routeFqn;

      expect(linkFor(entityType)).toBe(`<#E::${entityType}::${entityFqn}>`);
    }
  );

  it('prefers the route over the fallback', () => {
    mockRouteFqn = 'Finance';

    expect(linkFor(EntityType.DOMAIN, 'Other')).toBe('<#E::domain::Finance>');
  });

  // A page whose route carries no FQN passes its entity's.
  it.each([EntityType.DOMAIN, EntityType.DATA_PRODUCT, EntityType.TABLE])(
    'falls back to the given FQN for a %s',
    (entityType) => {
      mockRouteFqn = '';

      expect(linkFor(entityType, 'Finance.Ledger')).toBe(
        `<#E::${entityType}::Finance.Ledger>`
      );
      expect(linkFor(entityType)).toBe('');
    }
  );

  // A profile's tab is the user's own feed, not one about them.
  it('has no link for a user', () => {
    mockRouteFqn = 'harsh.vador';

    expect(linkFor(EntityType.USER)).toBe('');
  });
});
