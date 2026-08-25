/*
 *  Copyright 2024 Collate.
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

import { TestSuite } from '../../../generated/tests/testSuite';
import { BundleSuiteFormData } from './BundleSuiteForm.interface';
import {
  buildBundlePipelinePayload,
  buildCreateTestSuite,
} from './transformBundleSuiteFormData';

const formData = (
  overrides: Partial<BundleSuiteFormData>
): BundleSuiteFormData => overrides as unknown as BundleSuiteFormData;

const testSuite = (overrides: Partial<TestSuite>): TestSuite =>
  overrides as unknown as TestSuite;

describe('buildCreateTestSuite', () => {
  it('builds CreateTestSuite with current user owner', () => {
    const r = buildCreateTestSuite(
      formData({ name: 'suite', description: 'd' }),
      'u1'
    );

    expect(r.name).toBe('suite');
    expect(r.owners).toEqual([{ id: 'u1', type: 'user' }]);
  });

  it('builds CreateTestSuite with empty owners when no userId', () => {
    const r = buildCreateTestSuite(formData({ name: 'suite' }));

    expect(r.name).toBe('suite');
    expect(r.owners).toEqual([]);
  });

  it('builds CreateTestSuite with description', () => {
    const r = buildCreateTestSuite(
      formData({ name: 'suite', description: 'my description' }),
      'u2'
    );

    expect(r.description).toBe('my description');
  });
});

describe('buildBundlePipelinePayload', () => {
  it('builds bundle pipeline payload with debug logger when enableDebugLog', () => {
    const p = buildBundlePipelinePayload(
      formData({
        pipelineName: 'p',
        cron: '0 0 * * *',
        enableDebugLog: true,
        raiseOnError: true,
      }),
      testSuite({ id: 's1', name: 'suite', fullyQualifiedName: 'suite.fqn' })
    );

    expect(p.loggerLevel).toBe('DEBUG');
    expect(p.service).toEqual({ id: 's1', type: 'testSuite' });
  });

  it('builds bundle pipeline payload with info logger when enableDebugLog is false', () => {
    const p = buildBundlePipelinePayload(
      formData({
        pipelineName: 'p',
        cron: '0 0 * * *',
        enableDebugLog: false,
        raiseOnError: false,
      }),
      testSuite({ id: 's2', name: 'suite2', fullyQualifiedName: 'suite2.fqn' })
    );

    expect(p.loggerLevel).toBe('INFO');
    expect(p.raiseOnError).toBe(false);
  });

  it('defaults raiseOnError to true when not provided', () => {
    const p = buildBundlePipelinePayload(
      formData({ pipelineName: 'p', cron: '0 0 * * *' }),
      testSuite({ id: 's3', name: 'suite3', fullyQualifiedName: 'suite3.fqn' })
    );

    expect(p.raiseOnError).toBe(true);
  });

  it('sets scheduleInterval from cron', () => {
    const p = buildBundlePipelinePayload(
      formData({ pipelineName: 'p', cron: '0 6 * * *' }),
      testSuite({ id: 's4', name: 'suite4', fullyQualifiedName: 'suite4.fqn' })
    );

    expect(p.airflowConfig.scheduleInterval).toBe('0 6 * * *');
  });

  it('sets sourceConfig type to TestSuite', () => {
    const p = buildBundlePipelinePayload(
      formData({ pipelineName: 'p', cron: '0 0 * * *' }),
      testSuite({ id: 's5', name: 'suite5', fullyQualifiedName: 'suite5.fqn' })
    );

    expect(p.sourceConfig.config).toEqual({ type: 'TestSuite' });
  });
});
