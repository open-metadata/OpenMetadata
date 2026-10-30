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
import { Page } from '@playwright/test';
import { ResourceEntity } from '../../src/enums/permissions.enum';
import { Operation } from '../../src/generated/entity/policies/policy';
import activity from '../fixtures/visual/activity.json';
import customProperties from '../fixtures/visual/custom-properties.json';
import entities from '../fixtures/visual/entities.json';
import incidents from '../fixtures/visual/incidents.json';
import ontologyPacks from '../fixtures/visual/ontology-packs.json';
import personalTokens from '../fixtures/visual/personal-tokens.json';
import resources from '../fixtures/visual/resources.json';
import systemSettings from '../fixtures/visual/system-settings.json';
import workflowInstanceStates from '../fixtures/visual/workflow-instance-states.json';
import workflowInstances from '../fixtures/visual/workflow-instances.json';
import workflowTriggerFields from '../fixtures/visual/workflow-trigger-fields.json';

interface FixtureEntity extends Record<string, unknown> {
  id: string;
  name: string;
  displayName: string;
  fullyQualifiedName: string;
}

export interface VisualEntity {
  type: string;
  collection: string;
  route: string;
  entity: FixtureEntity;
}

export const VISUAL_ENTITIES: VisualEntity[] = entities;
export type VisualDataState =
  | 'populated'
  | 'empty'
  | 'read-only'
  | 'error'
  | 'long-content'
  | 'deleted'
  | 'forbidden'
  | 'expired-token'
  | 'custom-properties'
  | 'custom-properties-empty'
  | 'custom-properties-read-only';

const pageOf = (data: unknown[]) => ({
  data,
  paging: { total: data.length },
});

/** Public configuration is independent of the data service used by a test run. */
export const installVisualBootstrap = async (
  page: Page,
  appMode: 'ai' | 'classic' = 'ai'
) => {
  // Live feed subscriptions can refresh a captured page with unrelated shared
  // catalog events even when every HTTP read is deterministic.
  await page.routeWebSocket('**/api/v1/push/**', async (socket) => {
    await socket.close({ code: 1000, reason: 'Visual data is isolated.' });
  });
  await page.route('**/api/v1/users/*/preferences**', (route) =>
    route.fulfill({
      json: {
        userId: '00000000-0000-4000-8000-000000000999',
        preferences: [{ type: 'appMode', config: { value: appMode } }],
      },
    })
  );
  await page.route('**/api/v1/system/**', async (route) => {
    const url = new URL(route.request().url());
    const key = url.pathname.split('/').pop() ?? '';
    if (route.request().method() !== 'GET') {
      await route.fulfill({
        status: 503,
        json: { message: 'The visual fixture service is unavailable.' },
      });

      return;
    }
    if (url.pathname.includes('/settings/entityRulesSettings/')) {
      await route.fulfill({
        json: systemSettings.entityRulesSettings.entitySemantics
          .filter(
            (rule) => rule.enabled && !rule.ignoredEntities?.includes(key)
          )
          .map((rule) => ({
            ...rule,
            ignoredEntities: rule.ignoredEntities ?? [],
          })),
      });

      return;
    }
    const settings: Record<string, unknown> = systemSettings;
    const configuration: Record<string, unknown> = {
      version: { version: '2.0.0-SNAPSHOT' },
      auth: {
        provider: 'basic',
        providerName: 'OpenMetadata',
        clientType: 'public',
        responseType: 'id_token',
        publicKeyUrls: [],
        jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
        enableSelfSignup: true,
        enableAutoRedirect: false,
      },
      authorizer: {
        adminPrincipals: ['admin'],
        adminEmails: [],
        allowedEmailDomains: ['all'],
        allowedEmailRegistrationDomains: ['all'],
        principalDomain: 'open-metadata.org',
        allowedDomains: ['all'],
        useRolesFromProvider: false,
      },
      rdf: { rdfEnabled: true, basePath: '/rdf', aiEnabled: false },
      customUiThemePreference: {},
    };
    await route.fulfill({
      json: url.pathname.includes('/settings/')
        ? {
            config_type: key,
            config_value: settings[key] ?? configuration[key] ?? {},
          }
        : configuration[key] ?? settings[key] ?? {},
    });
  });
};

/**
 * Isolate visual data at the HTTP boundary. Shared seeding accumulates random
 * entities and counts; masking their entire rows would hide the UI under test.
 * These responses use the repository's public sample data and never write to
 * the server, so parallel themes and overlay tests cannot change each other.
 */
export const installVisualData = async (
  page: Page,
  state: VisualDataState = 'populated',
  appMode: 'ai' | 'classic' = 'ai'
) => {
  await installVisualBootstrap(page, appMode);
  const hasCustomProperties = state.startsWith('custom-properties');
  const isReadOnly =
    state === 'read-only' || state === 'custom-properties-read-only';
  const fixtureResources: Record<string, FixtureEntity[]> = {
    ...resources,
  };
  const visualEntities = VISUAL_ENTITIES.map((item) => ({
    ...item,
    entity: {
      ...item.entity,
      // The default catalog retains the undefined-property empty state.
      ...(hasCustomProperties && item.type === 'table'
        ? {
            extension:
              state === 'custom-properties-empty'
                ? {}
                : customProperties.extension,
          }
        : {}),
      ...(state === 'deleted' ? { deleted: true } : {}),
      ...(state === 'long-content'
        ? {
            displayName: `${item.entity.displayName} — Finance reporting metadata with a deliberately long title that must remain readable in headers, tables, and dialogs`,
            description:
              'Finance reporting fields describe the daily revenue calculations, ownership, freshness checks, and approved usage for cross-team reporting. '
                .repeat(3)
                .trim(),
          }
        : {}),
    },
  }));
  for (const { collection, entity } of visualEntities) {
    fixtureResources[collection] = [
      ...(fixtureResources[collection] ?? []),
      entity,
    ];
  }
  // Nested collections (apps/marketplace, Drive assets) must win over their parent.
  const collections = Object.keys(fixtureResources).sort(
    (left, right) => right.length - left.length
  );
  const permissionFor = (resource: string) => ({
    resource,
    permissions: Object.values(Operation).map((operation) => ({
      operation,
      access:
        state === 'forbidden' || (isReadOnly && !operation.startsWith('View'))
          ? 'deny'
          : 'allow',
    })),
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname.replace('/api/v1/', ''));
    const parts = path.split('/');

    if (
      parts[0] === 'system' ||
      /^users\/[^/]+\/preferences(?:\/|$)/.test(path)
    ) {
      await route.fallback();

      return;
    }

    // A few rendering APIs use POST for reads. All other submissions fail
    // locally, including endpoints handled before the generic entity router.
    const isolatedPosts = [
      'analytics/web/events/collect',
      'contextCenter/pages',
      'dataQuality/testSuites/dataQualityReport/batch',
      'events/subscriptions/capabilities',
      'search/aggregate',
    ];
    if (
      request.method() !== 'GET' &&
      !(
        path === 'analytics/web/events/collect' && request.method() === 'PUT'
      ) &&
      !(request.method() === 'POST' && isolatedPosts.includes(path))
    ) {
      await route.fulfill({
        status: 503,
        json: { message: 'The visual fixture service is unavailable.' },
      });

      return;
    }

    if (
      path === 'users/loggedInUser' ||
      path === 'users/name/admin' ||
      path === 'users/00000000-0000-4000-8000-000000000999'
    ) {
      // Visual rendering must not depend on live account data or user-repository
      // availability. Authentication itself remains covered by the setup tests.
      await route.fulfill({
        json: {
          id: '00000000-0000-4000-8000-000000000999',
          name: 'admin',
          fullyQualifiedName: 'admin',
          email: 'admin@open-metadata.org',
          isAdmin: !isReadOnly && state !== 'forbidden',
          isBot: false,
          displayName: 'Administrator',
          description: 'Metadata catalog administrator.',
          profile: {},
          follows: [],
          domains: [],
          personas: [],
          teams: [fixtureResources.teams[0]],
          roles: [],
          inheritedRoles: [],
          inheritedPersonas: [],
          isEmailVerified: true,
          deleted: false,
          version: 1,
          createdAt: 1768471200000,
          updatedAt: 1768471200000,
          updatedBy: 'admin',
          lastActivityTime: 1768471200000,
          lastLoginTime: 1768471200000,
        },
      });

      return;
    }

    if (request.method() === 'GET' && path.startsWith('lineage/')) {
      const assets = VISUAL_ENTITIES.filter(({ type }) =>
        ['table', 'pipeline', 'dashboard'].includes(type)
      );
      const focusFqn =
        url.searchParams.get('focusFqn') ?? url.searchParams.get('fqn');
      const focus = VISUAL_ENTITIES.find(
        ({ entity }) => entity.fullyQualifiedName === focusFqn
      );
      const nodes =
        focus && !assets.includes(focus) ? [focus, ...assets] : assets;
      const reference = ({ type, entity }: VisualEntity) => ({
        ...entity,
        type,
        entityType: type,
      });
      const edges = nodes.slice(1).map((item, index) => ({
        fromEntity: reference(nodes[index]),
        toEntity: reference(item),
        description: 'Curated finance transformation.',
        source: 'Manual',
        sqlQuery: 'SELECT order_id, revenue FROM orders',
      }));
      const paging = {
        downstreamDepthInfo: [],
        upstreamDepthInfo: [],
        maxDownstreamDepth: 1,
        maxUpstreamDepth: 1,
        totalDownstreamEntities: nodes.length - 1,
        totalUpstreamEntities: 0,
      };
      if (path === 'lineage/getPaginationInfo') {
        await route.fulfill({ json: paging });
      } else if (path === 'lineage/scene') {
        const band = url.searchParams.get('band') ?? 'ASSET';
        await route.fulfill({
          json: {
            band,
            lens: url.searchParams.get('lens') ?? 'TABLE',
            breadcrumb: [],
            focusFqn,
            focusEntityType: focus?.type ?? 'table',
            nodes: nodes.map((item) => ({
              ...reference(item),
              band,
              label: item.entity.displayName,
              levelKind: item.type,
              sourceEntity: reference(item),
              isFocus: item === focus,
            })),
            edges: edges.map((edge, index) => ({
              id: `edge-${index}`,
              from: edge.fromEntity.id,
              to: edge.toEntity.id,
              band,
              weight: 1,
            })),
          },
        });
      } else if (path.startsWith('lineage/getLineageEdge/')) {
        await route.fulfill({ json: { edge: edges[0] } });
      } else {
        await route.fulfill({
          json: {
            nodes: Object.fromEntries(
              nodes.map((item, index) => [
                item.entity.id,
                {
                  entity: reference(item),
                  paging: {
                    entityDownstreamCount: index < nodes.length - 1 ? 1 : 0,
                    entityUpstreamCount: index ? 1 : 0,
                  },
                  nodeDepth: index,
                },
              ])
            ),
            upstreamEdges: {},
            downstreamEdges: Object.fromEntries(
              edges.map((edge, index) => [`edge-${index}`, edge])
            ),
            paginationInfo: paging,
          },
        });
      }

      return;
    }

    if (parts[0] === 'permissions' && parts[1] !== 'debug') {
      await route.fulfill({
        json: parts[1]
          ? permissionFor(parts[1])
          : pageOf(Object.values(ResourceEntity).map(permissionFor)),
      });

      return;
    }

    if (/^ontologies\/[^/]+\/state$/.test(path)) {
      await route.fulfill({
        json: {
          ontologyId: parts[1],
          workingRevision: 1,
          activationRevision: 0,
          lastReleaseRevision: 0,
        },
      });

      return;
    }
    if (/^ontologies\/[^/]+\/working\/diff$/.test(path)) {
      await route.fulfill({
        json: {
          data: [],
          paging: { total: 0 },
          state: {
            ontologyId: parts[1],
            workingRevision: 1,
            activationRevision: 0,
            lastReleaseRevision: 0,
          },
          added: 0,
          modified: 0,
          deleted: 0,
        },
      });

      return;
    }

    if (path === 'learning/resources' || path === 'conversations') {
      await route.fulfill({ json: pageOf([]) });

      return;
    }
    if (path.startsWith('attachments/fqn/')) {
      await route.fulfill({ json: [] });

      return;
    }
    if (path === 'metadata/types/fields/workflowTriggerFields') {
      await route.fulfill({ json: workflowTriggerFields });

      return;
    }
    if (path === 'limits/config') {
      await route.fulfill({
        json: {
          enable: false,
          limits: {
            config: {
              version: '1',
              plan: 'OSS',
              installationType: 'local',
              deployment: 'local',
              companyName: 'OpenMetadata',
              domain: 'open-metadata.org',
              instances: 1,
              featureLimits: [],
            },
          },
        },
      });

      return;
    }
    if (path === 'services/overview') {
      if (state === 'error') {
        await route.fulfill({
          status: 503,
          json: { message: 'Unable to load the visual catalog.' },
        });

        return;
      }
      // The overview deliberately excludes connection configuration. Keep its
      // summary DTO separate from the complete service detail fixtures.
      const services = Object.entries(fixtureResources)
        .filter(
          ([key]) =>
            key.startsWith('services/') && !key.endsWith('ingestionPipelines')
        )
        .flatMap(([key, items]) =>
          items.map((item) => ({
            id: item.id,
            name: item.name,
            displayName: item.displayName,
            fullyQualifiedName: item.fullyQualifiedName,
            description: item.description,
            serviceType: item.serviceType,
            entityType: key.slice('services/'.length).replace(/s$/, ''),
            owners: item.owners,
            tags: item.tags,
            updatedAt: item.updatedAt,
            deleted: false,
            health: 'success',
          }))
        );
      const values = (key: string) =>
        [...url.searchParams.entries()]
          .filter(([name]) => name === key || name === `${key}[]`)
          .flatMap(([, value]) => value.split(','));
      const universe =
        state === 'empty'
          ? []
          : services.filter(
              (item) =>
                (!values('entityType').length ||
                  values('entityType').includes(item.entityType)) &&
                `${item.name} ${item.displayName}`
                  .toLowerCase()
                  .includes((url.searchParams.get('q') ?? '').toLowerCase())
            );
      const data = universe
        .filter(
          (item) =>
            (!values('listEntityType').length ||
              values('listEntityType').includes(item.entityType)) &&
            (!values('serviceType').length ||
              values('serviceType').includes(String(item.serviceType))) &&
            (!values('health').length || values('health').includes(item.health))
        )
        .sort((left, right) => left.name.localeCompare(right.name));
      const types = [...new Set(services.map((item) => item.entityType))];
      const counts = Object.fromEntries(
        types.map((type) => [
          type,
          universe.filter((item) => item.entityType === type).length,
        ])
      );
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      const limit = Math.max(1, Number(url.searchParams.get('limit')) || 25);
      await route.fulfill({
        json: {
          counts,
          total: universe.length,
          serviceTypeCounts: Object.fromEntries(
            types.map((type) => [
              type,
              Object.fromEntries(
                universe
                  .filter((item) => item.entityType === type)
                  .map((item) => [String(item.serviceType), 1])
              ),
            ])
          ),
          healthCounts: Object.fromEntries(
            types.map((type) => [type, { success: counts[type] }])
          ),
          data: data.slice(offset, offset + limit),
          paging: { total: data.length, offset, limit },
        },
      });

      return;
    }
    if (path === 'governance/intakeForms' || path === 'taskFormSchemas') {
      await route.fulfill({ json: pageOf([]) });

      return;
    }
    if (path.startsWith('governance/intakeForms/entityType/')) {
      await route.fulfill({
        status: 404,
        json: { message: 'No intake form is configured for this entity type.' },
      });

      return;
    }
    if (path === 'search/entityTypes') {
      await route.fulfill({ json: VISUAL_ENTITIES.map(({ type }) => type) });

      return;
    }
    if (
      path === 'events/subscriptions/capabilities' &&
      request.method() === 'POST'
    ) {
      // Capabilities use POST to inspect a selection; no subscription is saved.
      const body = request.postDataJSON() as {
        alertType: string;
        sources?: string[];
      };
      await route.fulfill({
        json: {
          alertType: body.alertType,
          sources: ['table', 'dashboard', 'pipeline', 'metric'].map((name) => ({
            name,
            kind: 'entity',
            canJoin: true,
            selected: body.sources?.includes(name) ?? false,
          })),
          filters: [],
          triggers: [],
          recipientCategories: [
            'Users',
            'Teams',
            'Owners',
            'Admins',
            'External',
          ],
        },
      });

      return;
    }
    if (path === 'metadata/types/workflows/approvalEnforcedEntityTypes') {
      await route.fulfill({ json: [] });

      return;
    }
    if (path === 'glossaryTerms/relationTypes/usage') {
      await route.fulfill({ json: [] });

      return;
    }
    if (path === 'users/security/token') {
      await route.fulfill({
        json: {
          data:
            state === 'empty'
              ? []
              : personalTokens.map((token) => ({
                  ...token,
                  ...(state === 'expired-token'
                    ? { expiryDate: 1767225600000 }
                    : {}),
                })),
        },
      });

      return;
    }
    if (path === 'users/generateRandomPwd') {
      // This value is only displayed by the isolated create-user form.
      await route.fulfill({ json: 'example-only-000' });

      return;
    }
    if (path === 'users/online') {
      await route.fulfill({
        json: pageOf(fixtureResources.users.filter((user) => !user.isBot)),
      });

      return;
    }
    if (path === 'permissions/debug/me') {
      await route.fulfill({
        json: {
          user: {
            id: '00000000-0000-4000-8000-000000000999',
            type: 'user',
            name: 'admin',
            displayName: 'Administrator',
          },
          directRoles: [],
          teamPermissions: [],
          inheritedPermissions: [],
          summary: {
            totalRoles: 0,
            totalPolicies: 0,
            totalRules: 0,
            directRoles: 0,
            inheritedRoles: 0,
            teamCount: 0,
            maxHierarchyDepth: 0,
            isAdmin: true,
            isBot: false,
          },
        },
      });

      return;
    }
    if (path === 'rdf/queries/saved') {
      await route.fulfill({ json: { queries: [] } });

      return;
    }
    if (path === 'rdf/queries/templates') {
      await route.fulfill({ json: systemSettings.sparqlQuerySettings });

      return;
    }
    if (path.startsWith('analytics/dataInsights/system/charts/')) {
      const results = Array.from({ length: 7 }, (_, index) => ({
        day: 1767873600000 + index * 86400000,
        count: 12 + index * 3,
        group: 'table',
        term: 'table',
        metric: 'count',
      }));
      const names = [...url.searchParams.entries()]
        .filter(([key]) => /^chartNames(?:\[\d*\])?$/.test(key))
        .flatMap(([, value]) => value.split(','));
      await route.fulfill({
        json: path.endsWith('/listChartData')
          ? Object.fromEntries(names.map((name) => [name, { results }]))
          : { results },
      });

      return;
    }
    if (path === 'rdf/status') {
      await route.fulfill({ json: { enabled: true, aiEnabled: false } });

      return;
    }
    if (path === 'apps/installed') {
      await route.fulfill({ json: fixtureResources.apps });

      return;
    }
    if (path === 'dataContracts/entity') {
      const contract = fixtureResources.dataContracts.find(
        (item) =>
          (item.entity as FixtureEntity).id === url.searchParams.get('entityId')
      );
      await route.fulfill({
        status: contract ? 200 : 404,
        json: contract ?? {
          code: 404,
          message: 'No contract exists for this entity.',
        },
      });

      return;
    }
    if (path === 'contextCenter/pages/search/hierarchy') {
      await route.fulfill({
        json: { ...pageOf(fixtureResources['contextCenter/pages']), total: 1 },
      });

      return;
    }
    if (path === 'contextCenter/pages' && request.method() === 'POST') {
      await route.fulfill({ json: fixtureResources['contextCenter/pages'][0] });

      return;
    }
    if (path === 'services/ingestionPipelines/status') {
      await route.fulfill({
        json: { code: 200, reason: 'healthy', platform: 'airflow' },
      });

      return;
    }
    if (
      state === 'error' &&
      path.startsWith('dataQuality/testCases/testCaseIncidentStatus')
    ) {
      await route.fulfill({
        status: 503,
        json: { message: 'Unable to load incidents. Please try again.' },
      });

      return;
    }
    if (
      path === 'dataQuality/testCases/testCaseIncidentStatus/incidentGroups'
    ) {
      const groupBy = url.searchParams.get('groupBy') ?? 'table';
      const reference =
        groupBy === 'owner'
          ? (fixtureResources.tasks[0].createdBy as FixtureEntity)
          : groupBy === 'testDefinition'
          ? (fixtureResources['dataQuality/testCases'][1]
              .testDefinition as FixtureEntity)
          : undefined;
      const groups = incidents.groups.map((group) => ({
        ...group,
        groupBy,
        ...(reference
          ? {
              id: reference.id,
              name: reference.name,
              displayName: reference.displayName,
              fullyQualifiedName: reference.fullyQualifiedName,
            }
          : {}),
      }));
      await route.fulfill({ json: pageOf(state === 'empty' ? [] : groups) });

      return;
    }
    if (path === 'dataQuality/testCases/testCaseIncidentStatus') {
      await route.fulfill({
        json: pageOf(state === 'empty' ? [] : incidents.statuses),
      });

      return;
    }
    if (path.includes('testCaseIncidentStatus/stateId/')) {
      await route.fulfill({
        json: pageOf(state === 'empty' ? [] : incidents.statuses),
      });

      return;
    }
    if (path === 'docStore') {
      const prefix = url.searchParams.get('fqnPrefix') ?? '';
      await route.fulfill({
        json: pageOf(
          fixtureResources.documents.filter((document) =>
            document.fullyQualifiedName.startsWith(prefix)
          )
        ),
      });

      return;
    }
    if (path.startsWith('docStore/name/')) {
      // Unsaved persona layouts use a 404 to select the product's defaults.
      const document = fixtureResources.documents.find(
        (item) =>
          item.fullyQualifiedName === path.slice('docStore/name/'.length)
      );
      await route.fulfill({
        status: document ? 200 : 404,
        json: document ?? { code: 404, message: 'No saved persona layout.' },
      });

      return;
    }
    if (path === 'kpi') {
      await route.fulfill({
        json: pageOf(state === 'empty' ? [] : fixtureResources.kpis),
      });

      return;
    }
    if (/^kpi\/[^/]+\/kpiResult$/.test(path)) {
      const end = Date.parse('2026-01-15T10:00:00.000Z');
      const values = path.includes('visual_owner_coverage')
        ? [55, 56, 57, 58, 59, 60, 61]
        : path.includes('visual_completed_target')
        ? [60, 62, 64, 66, 68, 70, 72]
        : [55, 59, 63, 67, 71, 75, 79];
      await route.fulfill({
        json: {
          results:
            state === 'empty'
              ? []
              : values.map((count, index) => ({
                  count,
                  day: end - (values.length - index - 1) * 86_400_000,
                })),
        },
      });

      return;
    }
    if (
      path === 'tasks' ||
      path === 'tasks/visible' ||
      path === 'tasks/assigned'
    ) {
      const data =
        state === 'empty'
          ? []
          : fixtureResources.tasks.filter((item) =>
              ['category', 'type', 'status'].every(
                (key) =>
                  !url.searchParams.get(key) ||
                  (url.searchParams.get(key) ?? '')
                    .split(',')
                    .includes(String(item[key]))
              )
            );
      await route.fulfill({ json: pageOf(data) });

      return;
    }
    if (
      path === 'activity' ||
      /^activity\/(my-feed|following|mentions|entity|user)(\/|$)/.test(path)
    ) {
      await route.fulfill({ json: pageOf(state === 'empty' ? [] : activity) });

      return;
    }
    if (
      path === 'announcements' ||
      (path.startsWith('activity/') && !path.startsWith('activity/entity/'))
    ) {
      await route.fulfill({ json: path === 'activity/count' ? 0 : pageOf([]) });

      return;
    }
    if (path === 'metadata/types/customProperties') {
      await route.fulfill({ json: {} });

      return;
    }
    if (path === 'analytics/web/events/collect') {
      await route.fulfill({ status: 204 });

      return;
    }
    if (path.startsWith('changeSummary/')) {
      await route.fulfill({ json: pageOf([]) });

      return;
    }

    if (path === 'dataQuality/testSuites/dataQualityReport') {
      if (url.searchParams.get('index') === 'testCaseResolutionStatus') {
        await route.fulfill({
          json: {
            metadata: { keys: [], dimensions: [], metrics: ['stateId'] },
            data: [
              {
                stateId:
                  state === 'empty' ||
                  (url.searchParams.get('q') ?? '').includes('Resolved')
                    ? '0'
                    : '1',
              },
            ],
          },
        });

        return;
      }
      await route.fulfill({
        json: {
          metadata: {
            keys: ['testCaseStatus'],
            dimensions: [],
            metrics: ['count'],
          },
          data: [
            {
              testCaseStatus: 'Success',
              count: '1',
              originEntityFQN: '1',
              fullyQualifiedName: '25',
            },
            {
              testCaseStatus: 'Failed',
              count: '1',
              originEntityFQN: '1',
              fullyQualifiedName: '25',
            },
          ],
        },
      });

      return;
    }
    if (
      path === 'dataQuality/testSuites/dataQualityReport/batch' &&
      request.method() === 'POST'
    ) {
      // Reporting uses POST for a read-only batch. Keep it isolated while
      // allowing the quality dashboard to load without a submission error.
      const body = request.postDataJSON() as {
        requests: Array<{
          key: string;
          aggregationQuery?: string;
          index?: string;
          q?: string;
        }>;
      };
      await route.fulfill({
        json: {
          results: body.requests.map(
            ({ key, aggregationQuery = '', index, q = '' }) => {
              let data: Record<string, string | number>[] = [];
              if (index === 'testCaseResolutionStatus') {
                data = Array.from({ length: 7 }, (_, day) => ({
                  timestamp: 1767952800000 + day * 86400000,
                  stateId:
                    state === 'empty' || q.includes('Resolved') || day < 6
                      ? 0
                      : 1,
                  'metrics.value': state === 'empty' ? 0 : 3600000,
                }));
              } else if (
                aggregationQuery.includes('aggType=cardinality') &&
                !aggregationQuery.includes('date_histogram')
              ) {
                // Scalar coverage and histogram cardinality have different row
                // shapes. Returning a coverage row to a chart renders NaN.
                data = [
                  {
                    originEntityFQN: state === 'empty' ? '0' : '1',
                    fullyQualifiedName: state === 'empty' ? '0' : '25',
                  },
                ];
              }

              return {
                key,
                report: {
                  metadata: { keys: [], dimensions: [], metrics: [] },
                  data,
                },
              };
            }
          ),
        },
      });

      return;
    }
    if (path === 'search/aggregate') {
      const field =
        request.method() === 'POST'
          ? (request.postDataJSON() as { fieldName: string }).fieldName
          : url.searchParams.get('field') ?? '';
      const values: Record<string, string[]> = {
        'entityType.keyword': ['table', 'dashboard', 'pipeline', 'metric'],
        'domains.displayName.keyword': ['Finance'],
        'dataProducts.displayName.keyword': ['Finance reporting'],
        ownerDisplayName: ['Analytics', 'Visual Steward'],
        'tags.tagFQN': [
          'VisualClassification.Confidential',
          'VisualGlossary.Revenue',
        ],
        'tier.tagFQN': ['Tier.Tier1', 'Tier.Tier2'],
        'certification.tagLabel.tagFQN': [
          'Certification.Gold',
          'Certification.Silver',
        ],
        'service.displayName.keyword': ['Visual Warehouse', 'Visual Dashboard'],
        serviceType: ['Mysql', 'Looker', 'Airflow'],
      };
      const buckets = (state === 'empty' ? [] : values[field] ?? []).map(
        (key) => ({ key, doc_count: 2 })
      );
      await route.fulfill({
        json: {
          aggregations: {
            [field]: { buckets },
            [`sterms#${field}`]: { buckets },
          },
          hits: { hits: [], total: { value: 0, relation: 'eq' } },
        },
      });

      return;
    }
    if (path === 'ontologyPacks') {
      await route.fulfill({ json: { packs: ontologyPacks } });

      return;
    }

    if (path === 'search/query') {
      if (state === 'error') {
        await route.fulfill({
          status: 503,
          json: { message: 'Unable to load the catalog. Please try again.' },
        });

        return;
      }
      const index = url.searchParams.get('index') ?? 'all';
      const resourceTypes: Record<string, string> = {
        users: 'user',
        teams: 'team',
        domains: 'domain',
        dataProducts: 'dataProduct',
        glossaries: 'glossary',
        glossaryTerms: 'glossaryTerm',
      };
      // Incident pickers use a dedicated index outside the discovery corpus.
      if (index.toLowerCase().includes('testcase'))
        resourceTypes['dataQuality/testCases'] = 'testCase';
      const candidates = [
        ...VISUAL_ENTITIES,
        ...Object.entries(resourceTypes).flatMap(([collection, type]) =>
          (fixtureResources[collection] ?? []).map((entity) => ({
            type,
            entity,
          }))
        ),
      ];
      const query = (url.searchParams.get('q') ?? '*').toLowerCase();
      const matching =
        state === 'empty'
          ? []
          : candidates.filter(
              ({ type, entity }, position, items) =>
                items.findIndex((item) => item.entity.id === entity.id) ===
                  position &&
                (['all', 'dataAsset'].includes(index) ||
                  index.toLowerCase().includes(type.toLowerCase())) &&
                (query === '*' ||
                  query === '' ||
                  `${entity.name} ${entity.displayName}`
                    .toLowerCase()
                    .includes(query.replaceAll('*', '')))
            );
      const hits = matching.map(({ type, entity }) => ({
        _id: entity.id,
        _index: `${type}_search_index`,
        _source: { ...entity, entityType: type },
      }));
      await route.fulfill({
        json: {
          hits: { hits, total: { value: hits.length, relation: 'eq' } },
          aggregations: {},
          took: 1,
        },
      });

      return;
    }

    if (path === 'feed' || path.startsWith('activity/entity/')) {
      await route.fulfill({ json: pageOf([]) });

      return;
    }
    if (path === 'feed/count') {
      await route.fulfill({ json: { data: [] } });

      return;
    }
    if (path === 'tasks/count') {
      const total = state === 'empty' ? 0 : fixtureResources.tasks.length;
      await route.fulfill({
        json: {
          open: total,
          inProgress: 0,
          approved: 0,
          granted: 0,
          completed: 0,
          total,
        },
      });

      return;
    }
    if (path === 'governance/workflowInstances') {
      // Entity history and the global execution list share this endpoint.
      const workflowName = url.searchParams.get('workflowDefinitionName');
      const definitionId = url.searchParams.get('workflowDefinitionId');
      const entityLink = url.searchParams.get('entityLink');
      const instances = workflowInstances.filter((instance) => {
        const definition = resources['governance/workflowDefinitions'].find(
          (workflow) => workflow.id === instance.workflowDefinitionId
        );

        return (
          (!workflowName || definition?.name === workflowName) &&
          (!definitionId || instance.workflowDefinitionId === definitionId) &&
          (!entityLink || instance.variables.relatedEntity === entityLink)
        );
      });
      await route.fulfill({
        json: pageOf(state === 'empty' ? [] : instances),
      });

      return;
    }

    if (path.startsWith('governance/workflowInstanceStates/')) {
      const [, , workflowName, instanceId] = path.split('/');
      const definition = resources['governance/workflowDefinitions'].find(
        (workflow) => workflow.name === workflowName
      );
      await route.fulfill({
        json: pageOf(
          state === 'empty'
            ? []
            : workflowInstanceStates.filter(
                (stage) =>
                  stage.workflowDefinitionId === definition?.id &&
                  stage.workflowInstanceId === instanceId
              )
        ),
      });

      return;
    }

    if (
      path.startsWith('metadata/types/') &&
      path.endsWith('/customProperties')
    ) {
      await route.fulfill({ json: [] });

      return;
    }
    if (
      path.startsWith('types/name/') ||
      path.startsWith('metadata/types/name/')
    ) {
      const name = parts[parts.length - 1];
      const field = customProperties.fieldTypes.find(
        (type) => type.name === name
      );
      await route.fulfill({
        json: field ?? {
          id: '00000000-0000-4000-8000-000000000001',
          name,
          fullyQualifiedName: name,
          category: 'entity',
          schema: '{"type":"object"}',
          customProperties:
            hasCustomProperties && name === 'table'
              ? customProperties.properties
              : [],
        },
      });

      return;
    }
    if (path === 'metadata/types') {
      if (url.searchParams.get('category') === 'field') {
        await route.fulfill({ json: pageOf(customProperties.fieldTypes) });

        return;
      }
      const names = VISUAL_ENTITIES.map(({ type }) => type);
      await route.fulfill({
        json: pageOf(
          names.map((name, index) => ({
            id: `00000000-0000-4000-8000-${String(index + 1).padStart(
              12,
              '0'
            )}`,
            name,
            displayName: name,
            category: url.searchParams.get('category') ?? 'entity',
            schema: '{"type":"string"}',
            customProperties: [],
          }))
        ),
      });

      return;
    }

    const collection = collections.find(
      (key) => path === key || path.startsWith(`${key}/`)
    );
    if (!collection) {
      await route.fulfill({
        status: 503,
        json: {
          message:
            request.method() === 'GET'
              ? `Missing visual read fixture: ${path}`
              : 'The visual fixture service is unavailable.',
        },
      });

      return;
    }

    const parent = url.searchParams.get('parent');
    const data: FixtureEntity[] =
      collection === 'tags' && ['Tier', 'Certification'].includes(parent ?? '')
        ? (parent === 'Tier'
            ? ['Tier1', 'Tier2', 'Tier3']
            : ['Gold', 'Silver', 'Bronze']
          ).map((name, index) => ({
            id: `00000000-0000-4000-8000-${String(100 + index).padStart(
              12,
              '0'
            )}`,
            name,
            displayName: name,
            fullyQualifiedName: `${parent}.${name}`,
            description: `The ${name} ${parent?.toLowerCase()} level.`,
            provider: 'system',
            deleted: false,
            version: 1.0,
          }))
        : fixtureResources[collection];
    const suffix = path.slice(collection.length).replace(/^\//, '');
    const selected = data.find(
      ({ id, name, fullyQualifiedName }) =>
        suffix === id ||
        suffix.startsWith(`${id}/`) ||
        suffix === `name/${fullyQualifiedName}` ||
        suffix.startsWith(`name/${fullyQualifiedName}/`) ||
        suffix === `name/${name}`
    );
    // Authentication is outside the catalog fixture, including error scenarios.
    if (collection === 'users' && suffix && !selected) {
      await route.fulfill({
        status: 404,
        json: { code: 404, message: 'User not found in the visual catalog.' },
      });

      return;
    }
    if (state === 'error') {
      await route.fulfill({
        status: 503,
        json: { message: 'Unable to load the catalog. Please try again.' },
      });

      return;
    }

    if (collection === 'metrics' && suffix === 'hierarchy') {
      await route.fulfill({
        json: pageOf(
          state === 'empty'
            ? []
            : data.map((metric) => ({ kind: 'metric', metric }))
        ),
      });

      return;
    }
    if (
      !suffix ||
      suffix === 'hierarchy' ||
      (collection.startsWith('dataQuality/') && suffix === 'search/list')
    ) {
      const alertType = url.searchParams.get('alertType');
      const rows =
        collection === 'events/subscriptions' && alertType
          ? data.filter((subscription) => subscription.alertType === alertType)
          : data;
      await route.fulfill({ json: pageOf(state === 'empty' ? [] : rows) });

      return;
    }

    if (selected) {
      const childPath = suffix.startsWith(`${selected.id}/`)
        ? suffix.slice(selected.id.length + 1)
        : suffix.startsWith(`name/${selected.fullyQualifiedName}/`)
        ? suffix.slice(`name/${selected.fullyQualifiedName}/`.length)
        : '';
      if (collection === 'dataProducts' && childPath === 'portsView') {
        await route.fulfill({
          json: { inputPorts: pageOf([]), outputPorts: pageOf([]) },
        });

        return;
      }
      if (
        collection === 'dataQuality/testSuites' &&
        childPath === 'testCases'
      ) {
        await route.fulfill({
          json: pageOf(fixtureResources['dataQuality/testCases']),
        });

        return;
      }
      if (collection === 'metrics' && childPath === 'hierarchy') {
        await route.fulfill({
          json: {
            ancestors: [],
            children: [],
            childrenPaging: { total: 0, offset: 0, limit: 25 },
            siblings: [selected],
            siblingPaging: { total: 1, offset: 0, limit: 25 },
            current: selected,
          },
        });

        return;
      }
      if (childPath === 'columns') {
        await route.fulfill({
          json: pageOf(
            state === 'empty' ? [] : ((selected.columns ?? []) as unknown[])
          ),
        });

        return;
      }
      if (childPath === 'sampleData') {
        await route.fulfill({ json: selected });

        return;
      }
      if (childPath.startsWith('versions/')) {
        await route.fulfill({
          json: { ...selected, version: Number(childPath.split('/')[1]) },
        });

        return;
      }
      if (childPath === 'versions') {
        await route.fulfill({
          json: {
            entityType: collection,
            versions: [JSON.stringify(selected)],
          },
        });
      } else if (childPath) {
        await route.fulfill({ json: pageOf([]) });
      } else {
        await route.fulfill({ json: selected });
      }

      return;
    }
    // Missing fixture users must not leak into the live user directory.
    if (collection === 'users') {
      await route.fulfill({
        status: 404,
        json: { code: 404, message: 'User not found in the visual catalog.' },
      });

      return;
    }
    await route.fulfill({
      status: suffix.startsWith('name/') ? 404 : 200,
      json: suffix.startsWith('name/')
        ? { message: 'Entity not found in the visual catalog.' }
        : pageOf([]),
    });
  });
};
