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

import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Agent, AgentStatus } from '../AgentsPage.interface';
import {
  ALL_AGENT_PERMISSIONS,
  canRunAgent,
  formatEtaLong,
  formatEtaShort,
  getEtaInfo,
} from './agents.utils';

const baseAgent: Agent = {
  id: 'agent-1',
  fqn: 'service.agent-1',
  pipelineType: PipelineType.Metadata,
  name: 'Metadata Agent',
  type: 'Metadata',
  unit: 'assets',
  verb: 'ingested',
  status: 'success',
  pct: 100,
  eta: 0,
  assets: 100,
  target: 100,
  errors: 0,
  warnings: 0,
  recentRuns: [],
};

const agentWithStatus = (status: AgentStatus): Agent => ({
  ...baseAgent,
  status,
});

describe('canRunAgent', () => {
  it.each<AgentStatus>(['success', 'failed', 'none'])(
    'should allow running a %s agent with trigger permission',
    (status) => {
      expect(canRunAgent(agentWithStatus(status), ALL_AGENT_PERMISSIONS)).toBe(
        true
      );
    }
  );

  it.each<AgentStatus>(['running', 'queued'])(
    'should block running a %s agent so a duplicate run is not queued',
    (status) => {
      expect(canRunAgent(agentWithStatus(status), ALL_AGENT_PERMISSIONS)).toBe(
        false
      );
    }
  );

  it('should block running without trigger permission', () => {
    expect(
      canRunAgent(baseAgent, { trigger: false, edit: true, delete: true })
    ).toBe(false);
  });

  it('should block running while permissions are unresolved', () => {
    expect(canRunAgent(baseAgent)).toBe(false);
  });

  it('should block running a paused agent', () => {
    expect(
      canRunAgent({ ...baseAgent, enabled: false }, ALL_AGENT_PERMISSIONS)
    ).toBe(false);
  });

  it('should allow running when the enabled flag is absent, since it defaults to true', () => {
    expect(canRunAgent(baseAgent, ALL_AGENT_PERMISSIONS)).toBe(true);
  });
});

// `t` is stubbed to echo the key plus its interpolation so assertions show which key was chosen and
// what was passed into it — the ETA bug was a formatting choice, not a missing translation.
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as never;

describe('getEtaInfo', () => {
  it('should report idle when there is no eta', () => {
    expect(getEtaInfo(null)).toEqual({ state: 'idle' });
  });

  it.each([0, -5])('should report wrapping up for %s seconds', (seconds) => {
    expect(getEtaInfo(seconds)).toEqual({ state: 'wrapping' });
  });

  it.each([1, 45, 59])(
    'should keep %s seconds in the seconds state',
    (seconds) => {
      expect(getEtaInfo(seconds)).toEqual({ state: 'seconds', value: seconds });
    }
  );

  it('should roll a long eta up into hours and minutes', () => {
    // The reported bug: 63660s used to render as "~1061 min left".
    expect(getEtaInfo(63660)).toEqual({
      state: 'duration',
      duration: '17h 41m',
    });
  });

  it.each([
    [60, '1m'],
    [90, '1m 30s'],
    [3600, '1h'],
    [3660, '1h 1m'],
    [86400, '1d'],
    [90061, '1d 1h'],
  ])('should format %s seconds as %s', (seconds, expected) => {
    expect(getEtaInfo(seconds).duration).toBe(expected);
  });

  it('should cap the duration at two units so it stays glanceable', () => {
    // 1d 1h 1m 1s truncated to the two largest units.
    expect(getEtaInfo(90061).duration).toBe('1d 1h');
  });
});

describe('formatEtaLong', () => {
  it('should render an em dash when idle', () => {
    expect(formatEtaLong(getEtaInfo(null), t)).toBe('—');
  });

  it('should render the wrapping up label', () => {
    expect(formatEtaLong(getEtaInfo(0), t)).toBe('label.wrapping-up');
  });

  it('should keep the pluralised seconds copy', () => {
    expect(formatEtaLong(getEtaInfo(45), t)).toBe(
      'message.seconds-left:{"count":45}'
    );
  });

  it('should pass the formatted duration through the duration-left copy', () => {
    expect(formatEtaLong(getEtaInfo(63660), t)).toBe(
      'message.duration-left:{"duration":"17h 41m"}'
    );
  });
});

describe('formatEtaShort', () => {
  it('should render an em dash when idle', () => {
    expect(formatEtaShort(getEtaInfo(null), t)).toBe('—');
  });

  it('should keep the pluralised seconds copy', () => {
    expect(formatEtaShort(getEtaInfo(45), t)).toBe(
      'message.seconds-short:{"count":45}'
    );
  });

  it('should render the bare duration, which already carries its own units', () => {
    expect(formatEtaShort(getEtaInfo(63660), t)).toBe('17h 41m');
  });
});
