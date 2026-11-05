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

import {
  App,
  ScheduleType,
} from '../../../../../../generated/entity/applications/app';
import { ScheduleTimeline } from '../../../../../../generated/entity/applications/createAppRequest';
import {
  AppMarketPlaceDefinition,
  AppType,
} from '../../../../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import {
  buildCreateAppRequest,
  canRunNow,
  getAppResources,
  getConfigTabKind,
  getInstallBlockedReason,
  getInstallSteps,
  getRuntimeDisabledReasonKey,
  hashSubPathToView,
  isAppUnavailable,
  viewToSubPath,
} from './Applications.utils';

const configurableApp = {
  name: 'SearchIndexingApplication',
  appConfiguration: { batchSize: 10 },
  allowConfiguration: true,
} as App;

describe('Applications.utils', () => {
  it('round-trips every view through the hash sub path', () => {
    const views = [
      { type: 'list' },
      { type: 'marketplace' },
      { type: 'marketplace-detail', fqn: 'Data Insights' },
      { type: 'install', fqn: 'RdfIndexApp' },
      { type: 'detail', fqn: 'SearchIndexingApplication' },
    ] as const;

    views.forEach((view) => {
      expect(hashSubPathToView(viewToSubPath(view) ?? '')).toEqual(view);
    });
  });

  it('skips install steps the app does not need', () => {
    expect(
      getInstallSteps({
        allowConfiguration: true,
        scheduleType: ScheduleType.Scheduled,
      })
    ).toEqual(['details', 'configure', 'schedule']);
    expect(
      getInstallSteps({
        allowConfiguration: false,
        scheduleType: ScheduleType.NoSchedule,
      })
    ).toEqual(['details']);
  });

  it('allows run now only for manual schedule types', () => {
    expect(canRunNow({ scheduleType: ScheduleType.ScheduledOrManual })).toBe(
      true
    );
    expect(canRunNow({ scheduleType: ScheduleType.OnlyManual })).toBe(true);
    expect(canRunNow({ scheduleType: ScheduleType.Scheduled })).toBe(false);
    expect(canRunNow({ scheduleType: ScheduleType.Live })).toBe(false);
  });

  it('treats deleted and runtime-disabled apps as unavailable', () => {
    expect(isAppUnavailable({ deleted: true })).toBe(true);
    expect(isAppUnavailable({ enabled: false, deleted: false })).toBe(true);
    expect(isAppUnavailable({ enabled: true, deleted: false })).toBe(false);
  });

  it('explains why a runtime-disabled app is unavailable', () => {
    expect(
      getRuntimeDisabledReasonKey({
        name: 'CacheWarmupApplication',
        enabled: false,
      })
    ).toBe('message.cache-service-not-configured-message');
    expect(getRuntimeDisabledReasonKey({ name: 'Other', enabled: false })).toBe(
      'message.application-disabled-message'
    );
    expect(
      getRuntimeDisabledReasonKey({
        name: 'Other',
        enabled: false,
        deleted: true,
      })
    ).toBeUndefined();
  });

  it('blocks install for installed, paid and unconfigured cache apps', () => {
    expect(getInstallBlockedReason({ name: 'A' }, true)).toBe(
      'message.app-already-installed'
    );
    expect(getInstallBlockedReason({ name: 'A', enabled: false }, false)).toBe(
      'message.paid-addon-description'
    );
    expect(
      getInstallBlockedReason(
        { name: 'CacheWarmupApplication', enabled: false },
        false
      )
    ).toBe('message.cache-service-not-configured-message');
    expect(getInstallBlockedReason({ name: 'A' }, false)).toBeUndefined();
  });

  it('picks the configuration form for the app', () => {
    expect(getConfigTabKind(configurableApp, false, true)).toBe('app');
    expect(getConfigTabKind(configurableApp, false, false)).toBeUndefined();
    expect(
      getConfigTabKind({ ...configurableApp, enabled: false }, true, true)
    ).toBeUndefined();
    expect(
      getConfigTabKind(
        { ...configurableApp, name: 'McpApplication' },
        true,
        true
      )
    ).toBe('mcp');
    expect(
      getConfigTabKind(
        { ...configurableApp, name: 'McpApplication' },
        false,
        true
      )
    ).toBeUndefined();
  });

  it('lists only the resources the app defines', () => {
    expect(
      getAppResources({
        supportEmail: 'help@x.io',
        privacyPolicyUrl: 'https://x.io/privacy',
      }).map(({ id, href }) => [id, href])
    ).toEqual([
      ['app-support-email', 'mailto:help@x.io'],
      ['privacy-policy', 'https://x.io/privacy'],
    ]);
  });

  it('builds the install request with schedule and runner rules', () => {
    const app = {
      name: 'ExternalApp',
      appType: AppType.External,
      supportsIngestionRunner: false,
      appConfiguration: { a: 1 },
    } as unknown as AppMarketPlaceDefinition;
    const runner = { id: 'r1', type: 'ingestionRunner' };

    expect(buildCreateAppRequest({ app, cron: '0 0 * * *' })).toMatchObject({
      name: 'ExternalApp',
      appConfiguration: { a: 1 },
      appSchedule: {
        scheduleTimeline: ScheduleTimeline.Custom,
        cronExpression: '0 0 * * *',
      },
    });
    expect(buildCreateAppRequest({ app, cron: '' }).appSchedule).toEqual({
      scheduleTimeline: ScheduleTimeline.None,
    });
    expect(buildCreateAppRequest({ app }).appSchedule).toBeUndefined();
    expect(
      buildCreateAppRequest({ app, ingestionRunner: runner }).ingestionRunner
    ).toBeUndefined();
    expect(
      buildCreateAppRequest({
        app: { ...app, supportsIngestionRunner: true },
        ingestionRunner: runner,
      }).ingestionRunner
    ).toEqual(runner);
  });
});
