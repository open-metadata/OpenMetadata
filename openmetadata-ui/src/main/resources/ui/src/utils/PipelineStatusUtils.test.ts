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
import { StatusType } from '../generated/entity/data/pipeline';
import { getPipelineStatusClass } from './PipelineStatusUtils';

describe('PipelineStatusUtils', () => {
  describe('getPipelineStatusClass', () => {
    it('returns green for Successful status', () => {
      expect(getPipelineStatusClass(StatusType.Successful)).toBe('green');
      expect(getPipelineStatusClass('Successful')).toBe('green');
    });

    it('returns red for Failed status', () => {
      expect(getPipelineStatusClass(StatusType.Failed)).toBe('red');
      expect(getPipelineStatusClass('Failed')).toBe('red');
    });

    it('returns amber for Pending status', () => {
      expect(getPipelineStatusClass(StatusType.Pending)).toBe('amber');
      expect(getPipelineStatusClass('Pending')).toBe('amber');
    });

    it('returns amber for Skipped status', () => {
      expect(getPipelineStatusClass(StatusType.Skipped)).toBe('amber');
      expect(getPipelineStatusClass('Skipped')).toBe('amber');
    });

    it('returns empty string for undefined status', () => {
      expect(getPipelineStatusClass(undefined)).toBe('');
    });

    it('returns empty string for unknown status', () => {
      expect(getPipelineStatusClass('Unknown' as StatusType)).toBe('');
    });

    it('returns empty string for empty string status', () => {
      expect(getPipelineStatusClass('')).toBe('');
    });
  });
});
