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

// The page modules the Classic tour's steps render, including the pages its
// routers load in turn (Settings › Services, Glossary, Context Center).
const CLASSIC_TOUR_PAGES: Array<() => Promise<unknown>> = [
  () => import('../../pages/MyDataPage/MyDataPage.component'),
  () => import('../../pages/ExplorePage/ExplorePageV1.component'),
  () => import('./SettingsRouter'),
  () => import('../../pages/ServicesPage/ServicesPage'),
  () => import('./GlossaryRouter/GlossaryRouter'),
  () => import('../../pages/Glossary/GlossaryPage/GlossaryPage.component'),
  () => import('../../pages/OntologyExplorerPage/OntologyExplorerPage'),
  () => import('../../pages/DataQuality/DataQualityPage'),
  () => import('../../pages/DataMarketplacePage/DataMarketplacePage.component'),
  () => import('./ContextCenterRouter/ContextCenterRouter'),
  () =>
    import(
      '../../pages/ContextCenterPage/ContextCenterDashboardPage/ContextCenterDashboardPage'
    ),
  () =>
    import(
      '../../pages/ContextCenterPage/ContextCenterMemoriesPage/ContextCenterMemoriesPage'
    ),
];

/**
 * Loads the code of the pages a product tour visits as the tour starts, so
 * each step's page renders at once instead of behind its route's loading
 * fallback. It lives with the routers because only they may import pages; a
 * distribution overrides it alongside `ProductTourClassBase` to load its own
 * tour's pages.
 */
class ProductTourPagesClassBase {
  public async preloadPages(_tourMode: string): Promise<void> {
    await Promise.all(CLASSIC_TOUR_PAGES.map((load) => load()));
  }
}

const productTourPagesClassBase = new ProductTourPagesClassBase();

export default productTourPagesClassBase;

export { ProductTourPagesClassBase };
