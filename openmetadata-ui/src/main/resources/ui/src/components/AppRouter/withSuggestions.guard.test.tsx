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
import { Children, isValidElement, ReactElement, ReactNode } from 'react';
import ShallowRenderer from 'react-test-renderer/shallow';
import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  ROUTES,
} from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { useRequiredParams } from '../../utils/useRequiredParams';
import EntityDetailPage from '../discovery/entity/EntityDetailPage';
import SuggestionsProvider from '../Suggestions/SuggestionsProvider/SuggestionsProvider';
import EntityRouter from './EntityRouter';

/**
 * AI Automations create description suggestions on every data-asset type, not only tables.
 * A suggestion is fetched by SuggestionsProvider (keyed on the route FQN, entity-type agnostic)
 * and rendered by DataAssetsHeader and the shared EntityDescription component, both of which
 * already consume the context on every entity page.
 *
 * So the ONLY thing that decides whether a suggestion is visible is whether the page is wrapped
 * in SuggestionsProvider: useSuggestionsContext returns `{}` with no provider, so the consumers
 * silently render nothing rather than failing. Pages are wrapped where they are mounted, by the
 * classic EntityRouter and the AI-mode EntityDetailPage, so every type the entity-detail
 * registry serves gets the provider without the page opting in.
 *
 * Shallow rendering is deliberate: it executes the router and the HOC and nothing else, so no
 * lazy page module is ever loaded and no routing, permission or API mocks are needed.
 */
jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() =>
    jest.requireMock('../../utils/useRequiredParams').useRequiredParams()
  ),
}));

const shallowRender = (element: ReactElement): ReactElement => {
  const renderer = ShallowRenderer.createRenderer();
  renderer.render(element);

  // The @types for react-test-renderer/shallow type render() as void and getRenderOutput() as
  // the element, so the output has to come from the second call.
  return renderer.getRenderOutput() as ReactElement;
};

const findRouteElement = (
  node: ReactNode,
  path: string
): ReactElement | undefined => {
  for (const child of Children.toArray(node)) {
    if (
      !isValidElement<{
        path?: string;
        element?: ReactElement;
        children?: ReactNode;
      }>(child)
    ) {
      continue;
    }
    if (child.props.path === path) {
      return child.props.element;
    }
    const nested = findRouteElement(child.props.children, path);
    if (nested) {
      return nested;
    }
  }

  return undefined;
};

const servedEntityTypes = Object.values(EntityType).filter((entityType) =>
  Boolean(entityUtilClassBase.getEntityDetailComponent(entityType))
);

describe('entity pages are wrapped in SuggestionsProvider', () => {
  it('the registry serves the entity types suggestions are generated for', () => {
    expect(servedEntityTypes).toEqual(
      expect.arrayContaining([
        EntityType.TABLE,
        EntityType.MLMODEL,
        EntityType.TOPIC,
        EntityType.DASHBOARD,
        EntityType.CONTAINER,
        EntityType.SEARCH_INDEX,
        EntityType.API_ENDPOINT,
        EntityType.PIPELINE,
        EntityType.METRIC,
        EntityType.CHART,
        EntityType.DASHBOARD_DATA_MODEL,
        EntityType.API_COLLECTION,
        EntityType.DATABASE,
        EntityType.DATABASE_SCHEMA,
        EntityType.STORED_PROCEDURE,
        EntityType.DATA_PRODUCT,
        EntityType.DIRECTORY,
        EntityType.FILE,
        EntityType.SPREADSHEET,
        EntityType.WORKSHEET,
      ])
    );
  });

  it.each(servedEntityTypes)(
    'EntityRouter renders the %s page inside SuggestionsProvider',
    (entityType) => {
      (useRequiredParams as jest.Mock).mockReturnValue({ entityType });

      const routes = shallowRender(<EntityRouter />);
      const detailElement = findRouteElement(
        routes,
        ROUTES.ENTITY_DETAILS.replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, '')
      );

      expect(detailElement).toBeDefined();
      expect(shallowRender(detailElement as ReactElement).type).toBe(
        SuggestionsProvider
      );
    }
  );

  it.each(servedEntityTypes)(
    'the AI-mode EntityDetailPage renders the %s page inside SuggestionsProvider',
    (entityType) => {
      (useRequiredParams as jest.Mock).mockReturnValue({ entityType });

      const page = shallowRender(<EntityDetailPage />);

      expect(shallowRender(page).type).toBe(SuggestionsProvider);
    }
  );
});
