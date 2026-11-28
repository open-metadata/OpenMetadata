/*
 *  Copyright 2023 Collate.
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
import {
  PLACEHOLDER_ACTION,
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_TAB,
  PLACEHOLDER_SETTING_CATEGORY,
  ROUTES,
} from '../constants/constants';
import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import {
  getAddIngestionPath,
  getAddPolicyRulePath,
  getAddQueryPath,
  getAddServicePath,
  getAppInstallPath,
  getApplicationDetailsPath,
  getBotsPagePath,
  getBotsPath,
  getChartDetailsPath,
  getClassificationDetailsPath,
  getClassificationTagPath,
  getClassificationVersionsPath,
  getCreateUserPath,
  getCustomizePagePath,
  getDataProductDetailsPath,
  getDataQualityPagePath,
  getDomainDetailsPath,
  getDomainPath,
  getDomainVersionsPath,
  getEditConnectionPath,
  getEditIngestionPath,
  getEditPolicyRulePath,
  getEditWebhookPath,
  getEntityDetailsPath,
  getExplorePath,
  getExploreTabPath,
  getGlossaryPath,
  getGlossaryTermDetailsPath,
  getGlossaryTermsVersionsPath,
  getGlossaryVersionsPath,
  getKpiPath,
  getMarketPlaceAppDetailsPath,
  getNotificationAlertDetailsPath,
  getNotificationAlertsEditPath,
  getObservabilityAlertDetailsPath,
  getObservabilityAlertsEditPath,
  getPath,
  getPathByServiceFQN,
  getPersonaDetailsPath,
  getPolicyWithFqnPath,
  getQueryPath,
  getRoleWithFqnPath,
  getServiceDetailsPath,
  getServiceVersionPath,
  getSettingCategoryPath,
  getSettingPath,
  getSettingPathRelative,
  getSettingsPathWithFqn,
  getTagPath,
  getTagsDetailsPath,
  getTeamsWithFqnPath,
  getTestCaseDetailPagePath,
  getTestCaseDimensionsDetailPagePath,
  getTestCaseVersionPath,
  getTestSuiteIngestionPath,
  getTestSuitePath,
  getUsersPagePath,
  getVersionPath,
  inPageSearchOptions,
  isInPageSearchAllowed,
  isLandingPagePath,
} from './RouterUtils';

describe('Global Setting routes', () => {
  describe('getSettingPath', () => {
    it('should return default path when category and tab are undefined', () => {
      const path = getSettingPath();

      expect(path).toEqual(ROUTES.SETTINGS);
    });

    it('should return default path when category is undefined', () => {
      const tab = 'exampleTab';
      const path = getSettingPath(undefined, tab);

      expect(path).toEqual(ROUTES.SETTINGS);
    });

    it('should return path with category if tab is undefined', () => {
      const category = 'exampleCategory';
      const path = getSettingPath(category);

      const expectedPath = ROUTES.SETTINGS_WITH_CATEGORY.replace(
        PLACEHOLDER_SETTING_CATEGORY,
        category
      );

      expect(path).toEqual(expectedPath);
    });

    it('should return path with category and tab when withFqn is false', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const path = getSettingPath(category, tab);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      ).replace(PLACEHOLDER_SETTING_CATEGORY, category);

      expect(path).toEqual(expectedPath);
    });

    it('should return path with category, tab, and action when withFqn and withAction are true', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const withFqn = true;
      const withAction = true;
      const path = getSettingPath(category, tab, withFqn, withAction);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB_FQN_ACTION.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      ).replace(PLACEHOLDER_SETTING_CATEGORY, category);

      expect(path).toEqual(expectedPath);
    });

    it('should return path with category and tab when withFqn is true and withAction is false', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const withFqn = true;
      const withAction = false;
      const path = getSettingPath(category, tab, withFqn, withAction);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB_FQN.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      ).replace(PLACEHOLDER_SETTING_CATEGORY, category);

      expect(path).toEqual(expectedPath);
    });
  });

  describe('getSettingsPathWithFqn', () => {
    it('should return path with category, tab, and fqn when action is undefined', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const fqn = 'exampleFqn';
      const path = getSettingsPathWithFqn(category, tab, fqn);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB_FQN.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      )
        .replace(PLACEHOLDER_SETTING_CATEGORY, category)
        .replace(PLACEHOLDER_ROUTE_FQN, fqn);

      expect(path).toEqual(expectedPath);
    });

    it('should return path with category, tab, fqn, and action when action is defined', () => {
      const category = 'exampleCategory';
      const tab = 'exampleTab';
      const fqn = 'exampleFqn';
      const action = 'exampleAction';
      const path = getSettingsPathWithFqn(category, tab, fqn, action);
      const expectedPath = ROUTES.SETTINGS_WITH_TAB_FQN_ACTION.replace(
        PLACEHOLDER_ROUTE_TAB,
        tab
      )
        .replace(PLACEHOLDER_SETTING_CATEGORY, category)
        .replace(PLACEHOLDER_ROUTE_FQN, fqn)
        .replace(PLACEHOLDER_ACTION, action);

      expect(path).toEqual(expectedPath);
    });
  });
});

describe('getExploreTabPath', () => {
  it('should build the Explore path for the given tab', () => {
    const path = getExploreTabPath('tables');

    expect(path).toEqual(
      ROUTES.EXPLORE_WITH_TAB.replace(PLACEHOLDER_ROUTE_TAB, 'tables')
    );
  });

  it('should fall back to an empty tab segment when tab is undefined', () => {
    const path = getExploreTabPath();

    expect(path).toEqual(
      ROUTES.EXPLORE_WITH_TAB.replace(PLACEHOLDER_ROUTE_TAB, '')
    );
  });

  it('should not depend on the current window location', () => {
    // Regression guard: this pathname must be derivable purely from the
    // `tab` argument, independent of `window.location`, so callers merging
    // it into a `navigate({ pathname, search })` call can't be affected by
    // stale router location state. Changing the current URL between the two
    // calls must not change the result.
    const before = getExploreTabPath('dashboards');

    const originalPath = window.location.pathname;
    window.history.pushState({}, '', '/some/unrelated/page');

    const after = getExploreTabPath('dashboards');

    window.history.pushState({}, '', originalPath);

    expect(after).toEqual(before);
  });
});

describe('getExplorePath', () => {
  it('should build the pathname from getExploreTabPath', () => {
    const path = getExplorePath({ tab: 'topics' });

    expect(path.startsWith(getExploreTabPath('topics'))).toBe(true);
  });
});

describe('isLandingPagePath', () => {
  it('should treat both landing page paths as the landing page', () => {
    expect(isLandingPagePath(ROUTES.HOME)).toBe(true);
    expect(isLandingPagePath(ROUTES.MY_DATA)).toBe(true);
  });

  it('should not match any other route', () => {
    expect(isLandingPagePath(ROUTES.EXPLORE)).toBe(false);
    expect(isLandingPagePath('/my-data-quality')).toBe(false);
    expect(isLandingPagePath('/table/sample_data.ecommerce_db')).toBe(false);
  });
});

describe('Tag and Classification routes', () => {
  it('getTagsDetailsPath encodes classification FQNs with :, /, ?, #, %, and $& patterns', () => {
    expect(getTagsDetailsPath('Gov/Domain:1#2?v=3%ok$&.Child:Tag')).toBe(
      '/tags/Gov%2FDomain%3A1%232%3Fv%3D3%25ok%24%26'
    );
    expect(getTagsDetailsPath('Gov/Domain:1#2?v=3%ok')).toBe(
      '/tags/Gov%2FDomain%3A1%232%3Fv%3D3%25ok'
    );
  });

  it('getTagPath returns base /tags when fqn is omitted and encodes fqn when provided', () => {
    expect(getTagPath()).toBe(ROUTES.TAGS);
    expect(getTagPath('Gov/Domain:1#2?v=3%ok$&')).toBe(
      '/tags/Gov%2FDomain%3A1%232%3Fv%3D3%25ok%24%26'
    );
  });

  it('getClassificationDetailsPath and getClassificationVersionsPath encode special characters', () => {
    const fqn = 'Gov/Domain:1#2?v=3%ok$&';

    expect(getClassificationDetailsPath(fqn)).toBe(
      '/tags/Gov%2FDomain%3A1%232%3Fv%3D3%25ok%24%26'
    );
    expect(getClassificationVersionsPath(fqn, '0.2')).toBe(
      '/tags/Gov%2FDomain%3A1%232%3Fv%3D3%25ok%24%26/versions/0.2'
    );
  });

  it('getClassificationTagPath encodes tag FQNs across default, tab, and subTab variants', () => {
    const tagFqn = 'Gov/Domain:1.PII/Email#1?v=2%ok$&';
    const encoded = 'Gov%2FDomain%3A1.PII%2FEmail%231%3Fv%3D2%25ok%24%26';

    expect(getClassificationTagPath(tagFqn)).toBe(`/tag/${encoded}`);
    expect(getClassificationTagPath(tagFqn, 'assets')).toBe(
      `/tag/${encoded}/assets`
    );
    expect(getClassificationTagPath(tagFqn, 'activity_feed', 'tasks')).toBe(
      `/tag/${encoded}/activity_feed/tasks`
    );
  });
});

describe('Entity, service, governance, and observability route builders', () => {
  it('encodes FQN segments across service, ingestion, domain, data product, and glossary routes', () => {
    expect(isInPageSearchAllowed('/database/sample_db')).toBe(true);
    expect(isInPageSearchAllowed('/explore')).toBe(false);
    expect(inPageSearchOptions('/database/sample_db')).toHaveLength(1);
    expect(inPageSearchOptions('/explore')).toEqual([]);

    expect(getAddServicePath('databaseServices')).toBe(
      '/databaseServices/add-service'
    );
    expect(getEditConnectionPath('databaseServices', 'svc/1:a')).toBe(
      '/service/databaseServices/svc%2F1%3Aa/connection/edit-connection'
    );
    expect(getPathByServiceFQN('databaseServices', 'svc/1:a')).toBe(
      '/service/databaseServices/svc%2F1%3Aa/connection'
    );
    expect(getAddIngestionPath('databaseServices', 'svc/1', 'metadata')).toBe(
      '/service/databaseServices/svc%2F1/add-ingestion/metadata'
    );
    expect(
      getEditIngestionPath('databaseServices', 'svc/1', 'svc/1.pipe', 'lineage')
    ).toBe(
      '/service/databaseServices/svc%2F1/edit-ingestion/svc%2F1.pipe/lineage'
    );

    expect(getDomainPath()).toBe('/domain');
    expect(getDomainPath('Eng/Data:1')).toBe('/domain/Eng%2FData%3A1');
    expect(getDomainDetailsPath('Eng/Data:1')).toBe('/domain/Eng%2FData%3A1');
    expect(getDomainDetailsPath('Eng/Data:1', 'assets')).toBe(
      '/domain/Eng%2FData%3A1/assets'
    );
    expect(
      getDomainDetailsPath('Eng/Data:1', EntityTabs.ACTIVITY_FEED, 'tasks')
    ).toBe('/domain/Eng%2FData%3A1/activity_feed/tasks');

    expect(getDataProductDetailsPath('Eng.Prod/1')).toBe(
      '/dataProduct/Eng.Prod%2F1'
    );
    expect(getDataProductDetailsPath('Eng.Prod/1', 'assets')).toBe(
      '/dataProduct/Eng.Prod%2F1/assets'
    );
    expect(
      getDataProductDetailsPath('Eng.Prod/1', EntityTabs.ACTIVITY_FEED)
    ).toBe('/dataProduct/Eng.Prod%2F1/activity_feed/all');

    expect(getGlossaryPath()).toBe('/glossary');
    expect(getGlossaryPath('Biz/Terms:1')).toBe('/glossary/Biz%2FTerms%3A1');
    expect(getGlossaryTermDetailsPath('Biz.Term/1')).toBe(
      '/glossary/Biz.Term%2F1'
    );
    expect(getGlossaryTermDetailsPath('Biz.Term/1', 'assets')).toBe(
      '/glossary/Biz.Term%2F1/assets'
    );
    expect(
      getGlossaryTermDetailsPath('Biz.Term/1', EntityTabs.ACTIVITY_FEED)
    ).toBe('/glossary/Biz.Term%2F1/activity_feed/all');
  });

  it('builds settings, access-control, alert, quality, and entity version paths with encoded FQNs', () => {
    expect(getApplicationDetailsPath('Search/App')).toBe(
      '/settings/apps/Search%2FApp'
    );
    expect(getMarketPlaceAppDetailsPath('Search/App')).toBe(
      '/marketplace/apps/Search%2FApp'
    );
    expect(getAppInstallPath('Search/App')).toBe(
      '/marketplace/apps/Search%2FApp/install'
    );
    expect(getSettingPathRelative('members', 'teams')).toBe('/members/teams');
    expect(getSettingCategoryPath('members')).toBe('/members/:tab');

    expect(getTeamsWithFqnPath('Team/A:1')).toBe(
      '/settings/members/teams/Team%2FA%3A1'
    );
    expect(getTeamsWithFqnPath('Team/A:1', { activeTab: 'sql studio' })).toBe(
      '/settings/members/teams/Team%2FA%3A1?activeTab=sql%20studio'
    );
    expect(getRoleWithFqnPath('Data/Steward')).toBe(
      '/settings/access/roles/Data%2FSteward'
    );
    expect(getPolicyWithFqnPath('Org/Policy')).toBe(
      '/settings/access/policies/Org%2FPolicy'
    );
    expect(getPath(GlobalSettingOptions.TEAMS)).toBe('/settings/access/teams');
    expect(getPath(GlobalSettingOptions.USERS)).toBe('/settings/access/users');
    expect(getPath(GlobalSettingOptions.ROLES)).toBe('/settings/access/roles');
    expect(getPath(GlobalSettingOptions.POLICIES)).toBe(
      '/settings/access/policies'
    );
    expect(getPath('unknown')).toBe('/settings');

    expect(getAddPolicyRulePath('Org/Policy')).toBe(
      '/settings/access/policies/Org%2FPolicy/add-rule'
    );
    expect(getEditPolicyRulePath('Org/Policy', 'Rule:1/A')).toBe(
      '/settings/access/policies/Org%2FPolicy/edit-rule/Rule%3A1%2FA'
    );
    expect(getChartDetailsPath('svc.chart/1')).toBe('/chart/svc.chart%2F1');
    expect(getChartDetailsPath('svc.chart/1', 'lineage')).toBe(
      '/chart/svc.chart%2F1/lineage'
    );

    expect(getTestSuitePath('suite/1')).toBe('/test-suites/suite%2F1');
    expect(getTestSuiteIngestionPath('suite/1')).toBe(
      '/test-suites/suite%2F1/add-ingestion'
    );
    expect(getTestSuiteIngestionPath('suite/1', 'suite/1.ing')).toBe(
      '/test-suites/suite%2F1/edit-ingestion/suite%2F1.ing'
    );
    expect(getQueryPath('svc.db.tbl', 'q-1')).toBe(
      '/query-view/svc.db.tbl/q-1'
    );
    expect(getAddQueryPath('svc.db.tbl')).toBe('/query/svc.db.tbl/add-query');

    expect(getDomainVersionsPath('Eng/1', '0.2')).toBe(
      '/domain/Eng%2F1/versions/0.2'
    );
    expect(getGlossaryVersionsPath('g-id', '0.3')).toBe(
      '/glossary/g-id/versions/0.3'
    );
    expect(getGlossaryTermsVersionsPath('gt-id', '0.4')).toBe(
      '/glossary-term/gt-id/versions/0.4'
    );
    expect(getGlossaryTermsVersionsPath('gt-id', '0.4', 'assets')).toBe(
      '/glossary-term/gt-id/versions/0.4/assets'
    );

    type DqTab = Parameters<typeof getDataQualityPagePath>[0];

    expect(getDataQualityPagePath()).toBe('/data-quality');
    expect(getDataQualityPagePath('test-cases' as DqTab)).toBe(
      '/data-quality/test-cases'
    );
    expect(getDataQualityPagePath('test-cases' as DqTab, 'tables')).toBe(
      '/data-quality/test-cases/tables'
    );

    expect(getTestCaseDetailPagePath('tc/1')).toContain('/test-case/tc%2F1/');
    expect(getTestCaseVersionPath('tc/1', '0.1')).toBe(
      '/test-case/tc%2F1/versions/0.1'
    );
    expect(getTestCaseVersionPath('tc/1', '0.1', 'results')).toBe(
      '/test-case/tc%2F1/versions/0.1/results'
    );
    expect(getTestCaseDimensionsDetailPagePath('tc/1', 'region=US')).toContain(
      '/test-case/tc%2F1/dimensions/region=US/'
    );

    expect(getServiceVersionPath('databaseServices', 'svc/1', '0.2')).toBe(
      '/service/databaseServices/svc%2F1/versions/0.2'
    );
    expect(getPersonaDetailsPath('Data/Engineer')).toBe(
      '/settings/persona/Data%2FEngineer'
    );
    expect(getObservabilityAlertsEditPath('alert/1')).toBe(
      '/observability/alerts/edit/alert%2F1'
    );
    expect(getNotificationAlertsEditPath('notif/1')).toBe(
      '/settings/notifications/edit-notification/notif%2F1'
    );
    expect(getObservabilityAlertDetailsPath('alert/1')).toContain(
      '/observability/alert/alert%2F1/'
    );
    expect(getNotificationAlertDetailsPath('notif/1')).toContain(
      '/settings/notifications/alerts/notif%2F1/'
    );

    expect(getVersionPath('table', 'svc.db.sch.tbl/1', '0.2')).toBe(
      '/table/svc.db.sch.tbl%2F1/versions/0.2'
    );
    expect(getVersionPath('table', 'svc.db.sch.tbl/1', '0.2', 'schema')).toBe(
      '/table/svc.db.sch.tbl%2F1/versions/0.2/schema'
    );
    expect(getServiceDetailsPath('svc/1', 'databaseServices')).toBe(
      '/service/databaseServices/svc%2F1'
    );
    expect(
      getServiceDetailsPath('svc/1', 'databaseServices', 'databases', 'all')
    ).toBe('/service/databaseServices/svc%2F1/databases/all');

    expect(getEntityDetailsPath(EntityType.TABLE, 'svc.db.sch.tbl/1')).toBe(
      '/table/svc.db.sch.tbl%2F1'
    );
    expect(
      getEntityDetailsPath(
        EntityType.TABLE,
        'svc.db.sch.tbl/1',
        EntityTabs.ACTIVITY_FEED
      )
    ).toBe('/table/svc.db.sch.tbl%2F1/activity_feed/all');

    expect(getEditWebhookPath('hook/1')).toBe('/webhook/hook%2F1');
    expect(getBotsPath('ingestion/bot')).toBe('/bots/ingestion%2Fbot');
    expect(getCreateUserPath(false)).toBe('/create-user');
    expect(getCreateUserPath(true)).toBe('/create-user/bot');
    expect(getUsersPagePath()).toBe('/settings/members/users');
    expect(getUsersPagePath(true)).toBe('/settings/members/admins');
    expect(getBotsPagePath()).toBe('/settings/bots');
    expect(getKpiPath('kpi/1')).toBe('/data-insights/kpi/edit-kpi/kpi%2F1');
    expect(getCustomizePagePath('persona/1', 'Table')).toBe(
      '/customize-page/persona%2F1/Table'
    );
  });
});
