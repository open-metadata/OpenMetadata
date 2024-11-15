import { computeTotalPages } from './PaginationUtils';

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

describe('computeTotalPages', () => {
  it('should return 1 when total items are less than or equal to page size', () => {
    expect(computeTotalPages(10, 5)).toBe(1);
    expect(computeTotalPages(10, 10)).toBe(1);
  });

  it('should return correct number of pages when total items are greater than page size', () => {
    expect(computeTotalPages(10, 15)).toBe(2);
    expect(computeTotalPages(10, 25)).toBe(3);
  });

  it('should return 0 when total items are 0', () => {
    expect(computeTotalPages(10, 0)).toBe(0);
  });

  it('should handle edge cases with page size of 1', () => {
    expect(computeTotalPages(1, 5)).toBe(5);
    expect(computeTotalPages(1, 0)).toBe(0);
  });

  it('should handle large numbers correctly', () => {
    expect(computeTotalPages(1000, 1000000)).toBe(1000);
  });

  it('should handle page size greater than total items', () => {
    expect(computeTotalPages(20, 10)).toBe(1);
  });
});
