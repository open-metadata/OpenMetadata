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

import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import {
    buildTagLabelFromFqn,
    buildTagLabelFromResult,
    getTagDisplayLabel,
    getTagStyle,
    RawTagResult
} from './TagSelector.utils';

const makeResult = (overrides?: Partial<RawTagResult>): RawTagResult => ({
  label: 'fallback-label',
  value: 'Personal.Email',
  data: {},
  ...overrides,
});

describe('getTagDisplayLabel', () => {
  it('returns displayName when present', () => {
    const result = makeResult({
      data: { displayName: 'Email Tag', name: 'Email' },
    });

    expect(getTagDisplayLabel(result)).toBe('Email Tag');
  });

  it('falls back to name when displayName is absent', () => {
    const result = makeResult({ data: { name: 'Email' } });

    expect(getTagDisplayLabel(result)).toBe('Email');
  });

  it('falls back to result.label when both displayName and name are absent', () => {
    const result = makeResult({ data: {} });

    expect(getTagDisplayLabel(result)).toBe('fallback-label');
  });
});

describe('getTagStyle', () => {
  it('returns style object when present', () => {
    const style = { color: '#ff0000', iconURL: 'https://example.com/icon.svg' };
    const result = makeResult({ data: { style } });

    expect(getTagStyle(result)).toEqual(style);
  });

  it('returns undefined when style is absent', () => {
    const result = makeResult({ data: { name: 'Email' } });

    expect(getTagStyle(result)).toBeUndefined();
  });

  it('returns undefined when data is empty', () => {
    const result = makeResult({ data: {} });

    expect(getTagStyle(result)).toBeUndefined();
  });
});

describe('buildTagLabelFromResult', () => {
  it('builds a TagLabel with correct fixed fields', () => {
    const result = makeResult({
      value: 'Personal.Email',
      data: {
        name: 'Email',
        displayName: 'Email Tag',
        style: { color: '#f00' },
      },
    });
    const label = buildTagLabelFromResult(result);

    expect(label.tagFQN).toBe('Personal.Email');
    expect(label.source).toBe(TagSource.Classification);
    expect(label.labelType).toBe(LabelType.Manual);
    expect(label.state).toBe(State.Confirmed);
  });

  it('passes through name, displayName and style', () => {
    const style = { color: '#abc', iconURL: 'https://icon.url' };
    const result = makeResult({
      data: { name: 'Email', displayName: 'Email Tag', style },
    });
    const label = buildTagLabelFromResult(result);

    expect(label.name).toBe('Email');
    expect(label.displayName).toBe('Email Tag');
    expect(label.style).toEqual(style);
  });

  it('handles missing optional fields gracefully', () => {
    const result = makeResult({ data: {} });
    const label = buildTagLabelFromResult(result);

    expect(label.name).toBeUndefined();
    expect(label.displayName).toBeUndefined();
    expect(label.style).toBeUndefined();
  });
});

describe('buildTagLabelFromFqn', () => {
  it('produces a minimal TagLabel from just an FQN', () => {
    const label = buildTagLabelFromFqn('Personal.SSN');

    expect(label.tagFQN).toBe('Personal.SSN');
    expect(label.source).toBe(TagSource.Classification);
    expect(label.labelType).toBe(LabelType.Manual);
    expect(label.state).toBe(State.Confirmed);
  });
});
