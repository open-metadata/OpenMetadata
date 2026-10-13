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
import { ReactElement } from 'react';
import ShallowRenderer from 'react-test-renderer/shallow';
import SuggestionsProvider from '../Suggestions/SuggestionsProvider/SuggestionsProvider';

/**
 * AI Automations create description suggestions on every data-asset type, not only tables.
 * A suggestion is fetched by SuggestionsProvider (keyed on the route FQN, entity-type agnostic)
 * and rendered by DataAssetsHeader and the shared EntityDescription component, both of which
 * already consume the context on every entity page.
 *
 * So the ONLY thing that decides whether a suggestion is visible is whether the page is wrapped
 * in SuggestionsProvider. It was wrapped on TableDetailsPageV1 and nowhere else, which meant an
 * automation could create a perfectly valid suggestion on an ML model, topic, dashboard,
 * container, search index, API endpoint or pipeline and no user could ever see or accept it:
 * useSuggestionsContext returns `{}` with no provider, so the consumers silently render nothing
 * rather than failing.
 *
 * Shallow rendering is deliberate: it executes the HOC and nothing else, so this asserts the
 * provider really is the outermost element of each page without dragging in the routing,
 * permission and API mocks a full page render needs.
 */
const renderShallow = (Component: React.ComponentType): ReactElement => {
  const renderer = ShallowRenderer.createRenderer();
  renderer.render(<Component />);

  // The @types for react-test-renderer/shallow type render() as void and getRenderOutput() as
  // the element, so the output has to come from the second call.
  return renderer.getRenderOutput() as ReactElement;
};

describe('entity pages are wrapped in SuggestionsProvider', () => {
  // Every entity type the generalized AI Automations can run over, plus the page that owns it.
  // Adding a type to the automations means adding it here, and the import will fail loudly if
  // the page moves.
  const pages: [string, () => Promise<{ default: React.ComponentType }>][] = [
    [
      'table',
      () => import('../../pages/TableDetailsPageV1/TableDetailsPageV1'),
    ],
    ['mlmodel', () => import('../../pages/MlModelPage/MlModelPage.component')],
    [
      'topic',
      () => import('../../pages/TopicDetails/TopicDetailsPage.component'),
    ],
    [
      'dashboard',
      () =>
        import(
          '../../pages/DashboardDetailsPage/DashboardDetailsPage.component'
        ),
    ],
    ['container', () => import('../../pages/ContainerPage/ContainerPage')],
    [
      'searchIndex',
      () => import('../../pages/SearchIndexDetailsPage/SearchIndexDetailsPage'),
    ],
    [
      'apiEndpoint',
      () => import('../../pages/APIEndpointPage/APIEndpointPage'),
    ],
    [
      'pipeline',
      () => import('../../pages/PipelineDetails/PipelineDetailsPage.component'),
    ],
  ];

  it.each(pages)(
    'the %s page renders SuggestionsProvider as its outermost element',
    async (_entityType, importPage) => {
      const { default: Page } = await importPage();

      const output = renderShallow(Page);

      expect(output.type).toBe(SuggestionsProvider);
    }
  );
});
