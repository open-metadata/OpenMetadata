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
    formatOnlineStatus,
    getCsvFileSizeLabel,
    getCsvRowCount,
    hashSubPathToView,
    viewToSubPath
} from './Members.utils';

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}${JSON.stringify(params)}` : key;

describe('hash <-> view round-trip', () => {
  it('encodes and decodes a team fqn containing special characters', () => {
    const fqn = 'PW%data_consumer_team-131661dd';
    const subPath = viewToSubPath({ type: 'team-detail', fqn, name: fqn });

    expect(subPath).toBe(`teams/${encodeURIComponent(fqn)}`);
    expect(hashSubPathToView(subPath as string)).toEqual({
      type: 'team-detail',
      fqn,
      name: fqn,
    });
  });

  it('round-trips a dotted team fqn', () => {
    const fqn = 'Engineering.Data.Platform';
    const view = hashSubPathToView(
      viewToSubPath({ type: 'team-detail', fqn, name: fqn }) as string
    );

    expect(view).toEqual({ type: 'team-detail', fqn, name: fqn });
  });

  it('maps teams/add to the add view (not a team named "add")', () => {
    expect(hashSubPathToView('teams/add')).toEqual({ type: 'teams-add' });
  });

  it('round-trips a team import view', () => {
    const fqn = 'Engineering.Data';
    const view = {
      type: 'teams-import' as const,
      fqn,
      importType: 'teams' as const,
    };
    const subPath = viewToSubPath(view);

    expect(subPath).toBe(`teams/${encodeURIComponent(fqn)}/import-team`);
    expect(hashSubPathToView(subPath as string)).toEqual(view);
  });

  it('round-trips a user import view', () => {
    const fqn = 'Organization';
    const view = {
      type: 'teams-import' as const,
      fqn,
      importType: 'users' as const,
    };
    const subPath = viewToSubPath(view);

    expect(subPath).toBe(`teams/${encodeURIComponent(fqn)}/import-user`);
    expect(hashSubPathToView(subPath as string)).toEqual(view);
  });
});

describe('getCsvRowCount', () => {
  it('counts data rows excluding the header and blank lines', () => {
    expect(getCsvRowCount('name,email\na,a@x.com\nb,b@x.com')).toBe(2);
    expect(getCsvRowCount('name,email\na,a@x.com\n\n')).toBe(1);
    expect(getCsvRowCount('name,email')).toBe(0);
    expect(getCsvRowCount('')).toBe(0);
  });
});

describe('getCsvFileSizeLabel', () => {
  it('formats byte sizes into B/KB/MB', () => {
    expect(getCsvFileSizeLabel(0)).toBe('0 B');
    expect(getCsvFileSizeLabel(512)).toBe('512 B');
    expect(getCsvFileSizeLabel(1024)).toBe('1.0 KB');
    expect(getCsvFileSizeLabel(1024 * 1024 * 2)).toBe('2.0 MB');
  });
});

describe('formatOnlineStatus', () => {
  it('returns "never" for undefined activityTime', () => {
    const result = formatOnlineStatus(undefined, t);

    expect(result.label).toBe('label.never');
    expect(result.colorClass).toBe('tw:text-tertiary');
  });

  it('returns "online now" for activity less than 5 minutes ago', () => {
    const result = formatOnlineStatus(Date.now() - 60000, t);

    expect(result.label).toBe('label.online-now');
    expect(result.colorClass).toBe('tw:text-success-primary');
  });

  it('returns minutes ago for activity between 5 and 60 minutes ago', () => {
    const result = formatOnlineStatus(Date.now() - 30 * 60000, t);

    expect(result.label).toContain('label.n-minutes-ago');
    expect(result.colorClass).toBe('tw:text-success-primary');
  });

  it('returns hours ago for activity between 1 and 24 hours ago', () => {
    const result = formatOnlineStatus(Date.now() - 3 * 3600000, t);

    expect(result.label).toContain('label.n-hours-ago');
    expect(result.colorClass).toBe('tw:text-warning-primary');
  });

  it('returns days ago for activity more than 24 hours ago', () => {
    const result = formatOnlineStatus(Date.now() - 3 * 86400000, t);

    expect(result.label).toContain('label.n-days-ago');
    expect(result.colorClass).toBe('tw:text-error-primary');
  });
});
