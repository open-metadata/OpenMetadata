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
import { Page, Route } from '@playwright/test';
import { SystemChartType } from '../../src/enums/DataInsight.enum';
import { ResourceEntity } from '../../src/enums/permissions.enum';
import { SearchIndex } from '../../src/enums/search.enum';
import { ServiceCategory } from '../../src/enums/service.enum';
import {
  Health,
  MetricObservability,
  ReasonCode,
} from '../../src/generated/api/data/metricObservability';
import { Operation } from '../../src/generated/entity/policies/policy';
import {
  AuthenticationMechanism,
  User,
} from '../../src/generated/entity/teams/user';
import { ValidationResponse } from '../../src/generated/system/validationResponse';
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
import { test } from '../support/fixtures/base';

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

const MISSING_READ_ANNOTATION = 'missing-visual-read-fixture';

// The latest-result endpoint and the final historical point describe the same
// measurement, so keep their values together rather than inventing a fallback.
const KPI_RESULT_VALUES: Record<string, number[]> = {
  visual_description_coverage: [55, 59, 63, 67, 71, 75, 79],
  visual_owner_coverage: [55, 56, 57, 58, 59, 60, 61],
  visual_completed_target: [80, 82, 84, 86, 88, 90, 92],
};

const failMissingVisualRead = async (route: Route) => {
  const path = decodeURIComponent(
    new URL(route.request().url()).pathname.replace('/api/v1/', '')
  );
  const message = `Missing visual read fixture: ${path}`;
  const annotations = test.info().annotations;
  // Components can swallow failed reads. Keep the first missing fixture on the
  // test itself, bounded to one diagnostic and independent of rendered toasts.
  if (!annotations.some(({ type }) => type === MISSING_READ_ANNOTATION)) {
    annotations.push({ type: MISSING_READ_ANNOTATION, description: message });
  }
  await route.fulfill({ status: 503, json: { message } });
};

export const assertVisualReadFixtures = () => {
  const missing = test
    .info()
    .annotations.find(({ type }) => type === MISSING_READ_ANNOTATION);
  if (missing) throw new Error(missing.description);
};

/** Public configuration is independent of the data service used by a test run. */
export const installVisualBootstrap = async (
  page: Page,
  appMode: 'ai' | 'classic' = 'ai'
) => {
  // Public authentication uses bootstrap without catalog data. Its unexpected
  // reads must be reported too, rather than falling through to the real server.
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'GET') {
      await failMissingVisualRead(route);
    } else {
      await route.fulfill({
        status: 503,
        json: { message: 'The visual fixture service is unavailable.' },
      });
    }
  });
  // Live feed subscriptions can refresh a captured page with unrelated shared
  // catalog events even when every HTTP read is deterministic.
  await page.routeWebSocket('**/api/v1/push/**', async (socket) => {
    await socket.close({ code: 1000, reason: 'Visual data is isolated.' });
  });
  await page.route('**/api/v1/users/*/preferences**', async (route) => {
    if (
      !/^\/api\/v1\/users\/[^/]+\/preferences$/.test(
        new URL(route.request().url()).pathname
      )
    ) {
      await failMissingVisualRead(route);

      return;
    }
    await route.fulfill({
      json: {
        userId: '00000000-0000-4000-8000-000000000999',
        preferences: [{ type: 'appMode', config: { value: appMode } }],
      },
    });
  });
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
    if (url.pathname === '/api/v1/system/search/nlq') {
      await route.fulfill({ json: false });

      return;
    }
    if (url.pathname === '/api/v1/system/mcp/config') {
      // No stored setting exists in this catalog; the MCP form uses its schema defaults.
      await route.fulfill({
        status: 404,
        json: { message: 'MCP configuration is not stored.' },
      });

      return;
    }
    if (url.pathname === '/api/v1/system/status') {
      await route.fulfill({
        json: {
          database: {
            passed: true,
            description: 'Database connectivity',
            message: 'Database connection is healthy.',
          },
          migrations: {
            passed: true,
            description: 'Database migrations',
            message: 'Database migrations are current.',
          },
          searchInstance: {
            passed: true,
            description: 'Search connectivity',
            message: 'Search connection is healthy.',
          },
          pipelineServiceClient: {
            passed: true,
            description: 'Pipeline service connectivity',
            message: 'Pipeline service connection is healthy.',
          },
        } satisfies ValidationResponse,
      });

      return;
    }
    if (
      /^\/api\/v1\/system\/settings\/entityRulesSettings\/[^/]+$/.test(
        url.pathname
      )
    ) {
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
      // These pages intentionally exercise their unsaved/default form values.
      // New setting types need an explicit fixture instead of an implicit {}.
      emailConfiguration: {},
      loginConfiguration: {},
      loginConfig: {},
      profilerConfiguration: {},
      lineageSettings: {},
      openMetadataBaseUrlConfiguration: {},
      glossarySettings: {},
      glossaryTermRelationSettings: {},
      workflowSettings: {},
    };
    if (url.pathname === '/api/v1/system/security/config') {
      await route.fulfill({
        json: {
          authenticationConfiguration: configuration.auth,
          authorizerConfiguration: configuration.authorizer,
        },
      });

      return;
    }
    if (url.pathname === '/api/v1/system/settings/source') {
      await route.fulfill({ json: { settings: [] } });

      return;
    }
    if (
      !/^\/api\/v1\/system\/(?:config\/|settings\/)?[^/]+$/.test(
        url.pathname
      ) ||
      ![...Object.keys(settings), ...Object.keys(configuration)].includes(key)
    ) {
      await failMissingVisualRead(route);

      return;
    }
    await route.fulfill({
      json: url.pathname.includes('/settings/')
        ? {
            config_type: key,
            config_value: settings[key] ?? configuration[key],
          }
        : configuration[key] ?? settings[key],
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
    kpi: resources.kpis,
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
  // Seed-data keys are not additional REST namespaces. In particular, document
  // layouts use docStore and KPI entities use kpi, not their internal aliases.
  const collections = Object.keys(fixtureResources)
    .filter((key) => !['documents', 'kpis'].includes(key))
    .sort((left, right) => right.length - left.length);
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

    // Reports use POST for reads, and local page creation opens an editor from
    // fixture data. Telemetry is discarded; other writes fail before routing.
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

    // Bot detail lookups need the service account, while the user-list fixture
    // represents human accounts and must not acquire an extra bot row.
    const botUser = fixtureResources.bots
      .map((bot) => bot.botUser as FixtureEntity)
      .find(({ id, fullyQualifiedName }) =>
        [
          `users/${id}`,
          `users/name/${fullyQualifiedName}`,
          `users/auth-mechanism/${id}`,
        ].includes(path)
      );
    if (botUser) {
      if (path === `users/auth-mechanism/${botUser.id}`) {
        // An unconfigured mechanism is a valid DTO, distinct from a failed read.
        await route.fulfill({
          json: {} satisfies AuthenticationMechanism,
        });
      } else {
        await route.fulfill({
          json: {
            id: botUser.id,
            name: botUser.name,
            fullyQualifiedName: botUser.fullyQualifiedName,
            displayName: botUser.displayName,
            email: `${botUser.name}@open-metadata.org`,
            isBot: true,
            isAdmin: false,
            roles: [],
            inheritedRoles: [],
            teams: [],
            profile: {},
            deleted: false,
          } satisfies User,
        });
      }

      return;
    }

    if (request.method() === 'GET' && path.startsWith('lineage/')) {
      if (
        ![
          'lineage/getPaginationInfo',
          'lineage/scene',
          'lineage/getLineage',
          'lineage/getLineage/upstream',
          'lineage/getLineage/downstream',
        ].includes(path) &&
        !/^lineage\/getLineageEdge\/[^/]+\/[^/]+$/.test(path)
      ) {
        await failMissingVisualRead(route);

        return;
      }
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
      if (
        (parts.length > 3 && !(parts.length === 4 && parts[2] === 'name')) ||
        (parts[1] &&
          !Object.values(ResourceEntity).includes(parts[1] as ResourceEntity))
      ) {
        await failMissingVisualRead(route);

        return;
      }
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
    if (/^attachments\/fqn\/[^/]+\/(?:Inline|External)$/.test(path)) {
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
    if (path === 'pipelines/summary') {
      const impactedAssets = VISUAL_ENTITIES.filter(({ type }) =>
        ['table', 'dashboard'].includes(type)
      ).map(({ entity }) => entity.fullyQualifiedName);
      await route.fulfill({
        json: pageOf(
          state === 'empty'
            ? []
            : fixtureResources.pipelines.map((pipeline) => ({
                pipelineId: pipeline.id,
                pipelineName: pipeline.displayName,
                pipelineFqn: pipeline.fullyQualifiedName,
                serviceType: pipeline.serviceType,
                scheduleInterval: pipeline.scheduleInterval,
                lastRunStatus: 'Successful',
                lastRunTime: 1768467600000,
                impactedAssets,
                impactedAssetsCount: impactedAssets.length,
              }))
        ),
      });

      return;
    }
    if (path === 'policies/resources') {
      await route.fulfill({
        json: pageOf(
          Object.values(ResourceEntity).map((name) => ({
            name,
            // The wildcard is valid for every resource; unrelated operations
            // would create impossible policy choices for that resource.
            operations: [Operation.All],
          }))
        ),
      });

      return;
    }
    if (path === 'policies/functions') {
      await route.fulfill({
        json: pageOf([
          {
            name: 'isOwner',
            description: 'True when the current user owns the resource.',
            input: '',
            examples: ['isOwner()'],
            parameterInputType: 'NotRequired',
          },
        ]),
      });

      return;
    }
    const assetCountCollection =
      /^(teams|domains|dataProducts|glossaryTerms)\/assets\/counts$/.exec(
        path
      )?.[1];
    if (assetCountCollection) {
      const parentFqn = url.searchParams.get('parent');
      await route.fulfill({
        // These APIs return FQN-keyed maps; a paginated list silently renders
        // every badge as zero even when the catalog contains matching assets.
        json: Object.fromEntries(
          fixtureResources[assetCountCollection]
            .filter(
              (item) =>
                !parentFqn ||
                assetCountCollection !== 'glossaryTerms' ||
                item.fullyQualifiedName.startsWith(`${parentFqn}.`)
            )
            .map((item) => [
              item.fullyQualifiedName,
              state === 'empty'
                ? 0
                : VISUAL_ENTITIES.filter(({ entity }) => {
                    if (assetCountCollection === 'glossaryTerms') {
                      return (
                        entity.tags as
                          | { source: string; tagFQN: string }[]
                          | undefined
                      )?.some(
                        (tag) =>
                          tag.source === 'Glossary' &&
                          tag.tagFQN === item.fullyQualifiedName
                      );
                    }
                    const key =
                      assetCountCollection === 'teams'
                        ? 'owners'
                        : assetCountCollection;

                    return (entity[key] as FixtureEntity[] | undefined)?.some(
                      ({ id }) => id === item.id
                    );
                  }).length,
            ])
        ),
      });

      return;
    }
    if (path === 'domains/hierarchy') {
      const parentFqn = url.searchParams.get('directChildrenOf');
      const rows =
        state === 'empty'
          ? []
          : fixtureResources.domains.filter((domain) => {
              const parent = domain.parent as FixtureEntity | undefined;

              return parentFqn
                ? parent?.fullyQualifiedName === parentFqn
                : !parent;
            });
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      const limit = Math.max(1, Number(url.searchParams.get('limit')) || 15);
      await route.fulfill({
        json: {
          data: rows.slice(offset, offset + limit),
          paging: { total: rows.length },
        },
      });

      return;
    }
    if (path === 'governance/intakeForms' || path === 'taskFormSchemas') {
      await route.fulfill({ json: pageOf([]) });

      return;
    }
    if (/^governance\/intakeForms\/entityType\/[^/]+$/.test(path)) {
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
    if (path === 'personas/aiContext/status') {
      await route.fulfill({
        json: pageOf(
          state === 'empty'
            ? []
            : fixtureResources.personas.map(({ id }) => ({
                personaId: id,
                cacheState: 'STALE',
                entitiesIncluded: 0,
                tokensEst: 0,
              }))
        ),
      });

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
    if (
      path === 'analytics/dataInsights/system/charts/listChartData' ||
      /^analytics\/dataInsights\/system\/charts\/name\/[^/]+\/data$/.test(path)
    ) {
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
      const requestedNames = path.endsWith('/listChartData')
        ? names
        : [parts[5]];
      if (
        requestedNames.some(
          (name) =>
            !Object.values(SystemChartType).includes(name as SystemChartType)
        )
      ) {
        await failMissingVisualRead(route);

        return;
      }
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
    if (path === 'services/ingestionPipelines/ip') {
      // Connector forms display this value, so use a documentation-only address
      // instead of querying the shared ingestion service's actual host.
      await route.fulfill({ json: { ip: '192.0.2.10' } });

      return;
    }
    if (
      state === 'error' &&
      ([
        'dataQuality/testCases/testCaseIncidentStatus',
        'dataQuality/testCases/testCaseIncidentStatus/incidentGroups',
        'dataQuality/testCases/testCaseIncidentStatus/search/list',
      ].includes(path) ||
        /^dataQuality\/testCases\/testCaseIncidentStatus\/stateId\/[^/]+$/.test(
          path
        ))
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
    if (
      path === 'dataQuality/testCases/testCaseIncidentStatus' ||
      path === 'dataQuality/testCases/testCaseIncidentStatus/search/list'
    ) {
      await route.fulfill({
        json: pageOf(state === 'empty' ? [] : incidents.statuses),
      });

      return;
    }
    if (
      /^dataQuality\/testCases\/testCaseIncidentStatus\/stateId\/[^/]+$/.test(
        path
      )
    ) {
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
    if (/^docStore\/name\/[^/]+$/.test(path)) {
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
      const kpi = fixtureResources.kpis.find(
        ({ fullyQualifiedName }) => fullyQualifiedName === parts[1]
      );
      const values = kpi && KPI_RESULT_VALUES[kpi.name];
      if (!values) {
        await failMissingVisualRead(route);

        return;
      }
      const end = Date.parse('2026-01-15T10:00:00.000Z');
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
    if (/^kpi\/[^/]+\/latestKpiResult$/.test(path)) {
      const kpi = fixtureResources.kpis.find(
        ({ fullyQualifiedName }) => fullyQualifiedName === parts[1]
      );
      const values = kpi && KPI_RESULT_VALUES[kpi.name];
      if (!kpi || !values) {
        await failMissingVisualRead(route);

        return;
      }
      const value = values[values.length - 1];
      await route.fulfill({
        json: {
          kpiFqn: kpi.fullyQualifiedName,
          timestamp: 1768471200000,
          targetResult: [
            {
              name: 'coverage',
              value: String(value),
              targetMet: value >= Number(kpi.targetValue),
            },
          ],
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
      /^activity\/(my-feed|following|mentions)$/.test(path) ||
      /^activity\/entity\/[^/]+\/(?:name\/)?[^/]+$/.test(path) ||
      /^activity\/user\/[^/]+$/.test(path)
    ) {
      await route.fulfill({ json: pageOf(state === 'empty' ? [] : activity) });

      return;
    }
    if (
      path === 'announcements' ||
      path === 'activity/count' ||
      path === 'activity/about' ||
      /^activity\/[^/]+\/replies$/.test(path)
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
    if (/^changeSummary\/[^/]+\/(?:name\/)?[^/]+$/.test(path)) {
      await route.fulfill({ json: { changeSummary: {}, totalEntries: 0 } });

      return;
    }

    if (path === 'dataQuality/testSuites/executionSummary') {
      const suiteId = url.searchParams.get('testSuiteId');
      const cases =
        state === 'empty'
          ? []
          : fixtureResources['dataQuality/testCases'].filter(
              (item) =>
                !suiteId || (item.testSuite as FixtureEntity).id === suiteId
            );
      const statuses = cases.map(
        (item) =>
          (item.testCaseResult as { testCaseStatus?: string })?.testCaseStatus
      );
      await route.fulfill({
        json: {
          total: cases.length,
          success: statuses.filter((status) => status === 'Success').length,
          failed: statuses.filter((status) => status === 'Failed').length,
          aborted: statuses.filter((status) => status === 'Aborted').length,
          queued: statuses.filter((status) => !status || status === 'Queued')
            .length,
          columnTestSummary: [],
        },
      });

      return;
    }
    if (
      [
        'dataQuality/dimensions/testCaseCounts',
        'dataQuality/dimensions/testDefinitionCounts',
      ].includes(path)
    ) {
      const definitions = fixtureResources['dataQuality/testDefinitions'];
      const countedDefinitions = path.endsWith('/testDefinitionCounts')
        ? definitions
        : fixtureResources['dataQuality/testCases'].map((item) =>
            definitions.find(
              ({ id }) => id === (item.testDefinition as FixtureEntity).id
            )
          );
      await route.fulfill({
        json: Object.fromEntries(
          fixtureResources['dataQuality/dimensions'].map((dimension) => [
            dimension.name,
            state === 'empty'
              ? 0
              : countedDefinitions.filter(
                  (definition) =>
                    definition?.dataQualityDimension === dimension.name
                ).length,
          ])
        ),
      });

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
      const indexes = (url.searchParams.get('index') ?? SearchIndex.ALL).split(
        ','
      );
      if (
        !indexes.every((index) =>
          Object.values(SearchIndex).includes(index as SearchIndex)
        )
      ) {
        await failMissingVisualRead(route);

        return;
      }
      if (state === 'error') {
        await route.fulfill({
          status: 503,
          json: { message: 'Unable to load the catalog. Please try again.' },
        });

        return;
      }
      const resourceTypes: Record<string, string> = {
        users: 'user',
        teams: 'team',
        domains: 'domain',
        dataProducts: 'dataProduct',
        glossaries: 'glossary',
        glossaryTerms: 'glossaryTerm',
      };
      // Incident pickers use a dedicated index outside the discovery corpus.
      if (indexes.includes(SearchIndex.TEST_CASE))
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
      // Backend catalog aliases exclude owner-picker accounts. dataAsset also
      // excludes governance containers, as defined by indexMapping.json.
      const nonCatalogTypes: string[] = [
        ResourceEntity.USER,
        ResourceEntity.TEAM,
      ];
      const nonAssetTypes: string[] = [
        ...nonCatalogTypes,
        ResourceEntity.DOMAIN,
        ResourceEntity.GLOSSARY,
        ResourceEntity.CLASSIFICATION,
      ];
      const query = (url.searchParams.get('q') ?? '*').toLowerCase();
      const matching =
        state === 'empty'
          ? []
          : candidates.filter(
              ({ type, entity }, position, items) =>
                items.findIndex((item) => item.entity.id === entity.id) ===
                  position &&
                // Index names overlap (glossary/glossaryTerm, for example).
                // Substring matching silently inserts the wrong entity class.
                indexes.some((index) => {
                  if (index === SearchIndex.ALL) {
                    return !nonCatalogTypes.includes(type);
                  }
                  if (index === SearchIndex.DATA_ASSET) {
                    return !nonAssetTypes.includes(type);
                  }

                  return index === type;
                }) &&
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

    if (path === 'feed') {
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
    if (path === 'limits/features/user') {
      // OSS has no configured user quota; an empty status list is its unlimited contract.
      await route.fulfill({ json: { featureLimitStatuses: [] } });

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

    if (/^governance\/workflowInstanceStates\/[^/]+\/[^/]+$/.test(path)) {
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

    if (/^metadata\/types\/(?:name\/)?[^/]+\/customProperties$/.test(path)) {
      const key = parts[parts.length - 2];
      const typeNames = [
        ...Object.values(ResourceEntity),
        ...customProperties.fieldTypes.map(({ name }) => name),
      ];
      const typeIds = VISUAL_ENTITIES.map(
        (_, index) =>
          `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
      );
      if (
        !typeNames.includes(key) &&
        !typeIds.includes(key) &&
        !customProperties.fieldTypes.some(({ id }) => id === key)
      ) {
        await failMissingVisualRead(route);

        return;
      }
      await route.fulfill({ json: [] });

      return;
    }
    if (/^(?:metadata\/)?types\/name\/[^/]+$/.test(path)) {
      const name = parts[parts.length - 1];
      const field = customProperties.fieldTypes.find(
        (type) => type.name === name
      );
      if (
        !field &&
        !Object.values(ResourceEntity).includes(name as ResourceEntity)
      ) {
        await failMissingVisualRead(route);

        return;
      }
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

    const systemProfileRead = /^tables\/([^/]+)\/systemProfile$/.exec(path);
    if (systemProfileRead) {
      const table = fixtureResources.tables.find(
        ({ fullyQualifiedName }) => fullyQualifiedName === systemProfileRead[1]
      );
      if (!table) {
        await failMissingVisualRead(route);

        return;
      }
      // The fixture table has no ingestion-produced system profile history.
      await route.fulfill({ json: pageOf([]) });

      return;
    }
    const tableProfileRead =
      /^tables\/([^/]+)\/tableProfile(?:\/(latest))?$/.exec(path);
    if (tableProfileRead) {
      const table = fixtureResources.tables.find(
        ({ fullyQualifiedName }) => fullyQualifiedName === tableProfileRead[1]
      );
      if (!table) {
        await failMissingVisualRead(route);

        return;
      }
      // The profiler returns a Table DTO, including schema, before a profile
      // has been collected; an empty paginated list is not that contract.
      await route.fulfill({ json: tableProfileRead[2] ? table : pageOf([]) });

      return;
    }
    const pipelineHistory =
      /^(pipelines|services\/ingestionPipelines)\/([^/]+)\/(status|pipelineStatus)$/.exec(
        path
      );
    if (
      pipelineHistory &&
      pipelineHistory[3] ===
        (pipelineHistory[1] === 'pipelines' ? 'status' : 'pipelineStatus')
    ) {
      const pipeline = fixtureResources[pipelineHistory[1]].find(
        ({ fullyQualifiedName }) => fullyQualifiedName === pipelineHistory[2]
      );
      if (!pipeline) {
        await failMissingVisualRead(route);

        return;
      }
      const runs =
        pipelineHistory[1] === 'pipelines' && state !== 'empty'
          ? [
              {
                timestamp: 1768467600000,
                endTime: 1768467660000,
                executionStatus: 'Successful',
                taskStatus: (pipeline.tasks as { name: string }[]).map(
                  ({ name }) => ({
                    name,
                    executionStatus: 'Successful',
                    startTime: 1768467600000,
                    endTime: 1768467660000,
                  })
                ),
              },
            ]
          : [];
      await route.fulfill({ json: pageOf(runs) });

      return;
    }
    const draftServiceRead =
      /^services\/([^/]+)\/name\/visual_connection$/.exec(path);
    if (
      draftServiceRead &&
      Object.values(ServiceCategory).includes(
        draftServiceRead[1] as ServiceCategory
      )
    ) {
      // Drafts also use categories with no existing service, such as metadata.
      // Only this absent name is available; unknown identities still block capture.
      await route.fulfill({
        status: 404,
        json: { message: 'The draft service does not exist.' },
      });

      return;
    }
    const collection = collections.find(
      (key) => path === key || path.startsWith(`${key}/`)
    );
    if (!collection) {
      await failMissingVisualRead(route);

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
    if (
      collection === 'apps' &&
      !selected &&
      fixtureResources['apps/marketplace'].some(
        ({ fullyQualifiedName }) => suffix === `name/${fullyQualifiedName}`
      )
    ) {
      // Marketplace definitions can exist without an installed app. The detail
      // page uses this exact presence check to choose its installation form.
      await route.fulfill({
        status: 404,
        json: { message: 'The application is not installed.' },
      });

      return;
    }
    const childPath = selected
      ? suffix.startsWith(`${selected.id}/`)
        ? suffix.slice(selected.id.length + 1)
        : suffix.startsWith(`name/${selected.fullyQualifiedName}/`)
        ? suffix.slice(`name/${selected.fullyQualifiedName}/`.length)
        : ''
      : '';
    const isListRead =
      !suffix ||
      (collection === 'teams' && suffix === 'hierarchy') ||
      (collection === 'roles' && suffix === 'search') ||
      (collection.startsWith('dataQuality/') && suffix === 'search/list');
    const isMetricHierarchy =
      collection === 'metrics' && suffix === 'hierarchy';
    // Otherwise a typo such as user/columns looks like a valid empty table.
    const isColumnRead =
      childPath === 'columns' &&
      ['tables', 'dashboard/datamodels'].includes(collection);
    const isSampleRead =
      childPath === 'sampleData' &&
      ['tables', 'topics', 'searchIndexes', 'containers'].includes(collection);
    const isVersionRead =
      (childPath === 'versions' ||
        /^versions\/\d+(?:\.\d+)?$/.test(childPath)) &&
      Number.isFinite(selected?.version);
    const isMetricObservability =
      collection === 'metrics' && suffix === `${selected?.id}/observability`;
    const isOntologyReleases =
      collection === 'ontologies' && suffix === `${selected?.id}/releases`;
    const isOutputPorts =
      collection === 'dataProducts' &&
      suffix === `name/${selected?.fullyQualifiedName}/outputPorts`;
    // Validate the route before the deliberate failure state; otherwise an
    // unmodeled child read can masquerade as the expected error feedback.
    if (
      (!selected && !isListRead && !isMetricHierarchy) ||
      (childPath &&
        !isColumnRead &&
        !isSampleRead &&
        !isVersionRead &&
        !isMetricObservability &&
        !isOntologyReleases &&
        !isOutputPorts &&
        !(collection === 'dataProducts' && childPath === 'portsView') &&
        !(
          collection === 'dataQuality/testSuites' && childPath === 'testCases'
        ) &&
        !(collection === 'metrics' && childPath === 'hierarchy') &&
        !(collection === 'personas' && childPath === 'aiContext') &&
        !(collection === 'apps' && childPath === 'status') &&
        !(collection === 'tables' && childPath === 'tableProfilerConfig') &&
        !(
          collection === 'containers' &&
          ['children', 'ancestors'].includes(childPath)
        ) &&
        !(collection === 'metrics' && childPath === 'assets'))
    ) {
      await failMissingVisualRead(route);

      return;
    }
    if (state === 'error') {
      await route.fulfill({
        status: 503,
        json: { message: 'Unable to load the catalog. Please try again.' },
      });

      return;
    }

    if (isMetricHierarchy) {
      await route.fulfill({
        json: pageOf(
          state === 'empty'
            ? []
            : data.map((metric) => ({ kind: 'metric', metric }))
        ),
      });

      return;
    }
    if (isListRead) {
      const alertType = url.searchParams.get('alertType');
      const rows =
        collection === 'events/subscriptions' && alertType
          ? data.filter((subscription) => subscription.alertType === alertType)
          : collection === 'roles' && suffix === 'search'
          ? data.filter(({ name, displayName }) =>
              `${name} ${displayName}`
                .toLowerCase()
                .includes(
                  (url.searchParams.get('q') ?? '').trim().toLowerCase()
                )
            )
          : data;
      await route.fulfill({ json: pageOf(state === 'empty' ? [] : rows) });

      return;
    }

    if (selected) {
      if (isMetricObservability) {
        // No assets are bound to this metric. Its health is unknown, not a
        // fabricated zero score or a paginated empty response.
        await route.fulfill({
          json: {
            health: Health.Unknown,
            reasonCode: ReasonCode.NoLinkedAssets,
            metric: {
              id: selected.id,
              name: selected.name,
              fullyQualifiedName: selected.fullyQualifiedName,
              type: 'metric',
            },
            upstreamAssetCount: 0,
            evaluatedAssetCount: 0,
            assets: [],
            linkedAssets: [],
            dimensions: [],
            incidents: [],
            tests: [],
          } satisfies MetricObservability,
        });

        return;
      }
      if (isOntologyReleases || isOutputPorts) {
        // This ontology is unpublished and the product declares no output ports.
        await route.fulfill({ json: pageOf([]) });

        return;
      }
      if (collection === 'containers' && childPath === 'ancestors') {
        // The fixture is a root bucket, so it has no container breadcrumb ancestors.
        await route.fulfill({ json: [] });

        return;
      }
      if (collection === 'tables' && childPath === 'tableProfilerConfig') {
        await route.fulfill({ json: selected });

        return;
      }
      if (
        (collection === 'containers' && childPath === 'children') ||
        (collection === 'metrics' && childPath === 'assets')
      ) {
        // The bucket has no nested containers and the metric has no asset bindings.
        await route.fulfill({ json: pageOf([]) });

        return;
      }
      if (collection === 'apps' && childPath === 'status') {
        // Installed applications have no execution history in this catalog.
        await route.fulfill({ json: pageOf([]) });

        return;
      }
      if (collection === 'personas' && childPath === 'aiContext') {
        await route.fulfill({
          json: { enabled: false, rules: [], cacheState: 'STALE' },
        });

        return;
      }
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
      if (/^versions\/\d+(?:\.\d+)?$/.test(childPath)) {
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
        await failMissingVisualRead(route);
      } else {
        await route.fulfill({ json: selected });
      }

      return;
    }
    await failMissingVisualRead(route);
  });
};
