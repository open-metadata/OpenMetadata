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
import { Bucket } from 'Models';

describe('Type Imports Integration', () => {
  it('should properly use Bucket type from Models', () => {
    // Test that the Bucket type is properly imported and can be used
    const testBucket: Bucket = {
      key: 'test_key',
      doc_count: 5,
      label: 'Test Label',
      // Test additional properties for dynamic ES aggregations
      'top_hits#top': {
        hits: {
          hits: [
            {
              _source: {
                displayName: 'Test Display Name',
                fullyQualifiedName: 'test.fqn',
              },
            },
          ],
        },
      },
    };

    expect(testBucket.key).toBe('test_key');
    expect(testBucket.doc_count).toBe(5);
    expect(testBucket.label).toBe('Test Label');
    expect(testBucket['top_hits#top']).toBeDefined();
  });

  it('should allow dynamic properties on Bucket type for ES aggregations', () => {
    const bucketWithDynamicProperties: Bucket = {
      key: 'dynamic_test',
      doc_count: 10,
      // These should be allowed due to the [key: string]: unknown index signature
      'sterms#aggregation': { some: 'data' },
      'cardinality#count': { value: 15 },
      customProperty: 'custom value',
    };

    expect(bucketWithDynamicProperties.key).toBe('dynamic_test');
    expect(bucketWithDynamicProperties.doc_count).toBe(10);
    expect(bucketWithDynamicProperties['sterms#aggregation']).toEqual({
      some: 'data',
    });
    expect(bucketWithDynamicProperties['cardinality#count']).toEqual({
      value: 15,
    });
    expect(bucketWithDynamicProperties.customProperty).toBe('custom value');
  });

  it('should support arrays of Bucket types', () => {
    const buckets: Bucket[] = [
      { key: 'bucket1', doc_count: 1 },
      { key: 'bucket2', doc_count: 2, label: 'Bucket Two' },
      {
        key: 'bucket3',
        doc_count: 3,
        'additional#property': { data: 'test' },
      },
    ];

    expect(buckets).toHaveLength(3);
    expect(buckets[0].key).toBe('bucket1');
    expect(buckets[1].label).toBe('Bucket Two');
    expect(buckets[2]['additional#property']).toEqual({ data: 'test' });
  });

  it('should maintain type safety while allowing flexibility', () => {
    const createBucket = (
      key: string,
      count: number,
      additionalProps?: Record<string, unknown>
    ): Bucket => {
      return {
        key,
        doc_count: count,
        ...additionalProps,
      };
    };

    const testBucket = createBucket('created_bucket', 42, {
      'custom#aggregation': { value: 'custom' },
      metadata: { source: 'elasticsearch' },
    });

    expect(testBucket.key).toBe('created_bucket');
    expect(testBucket.doc_count).toBe(42);
    expect(testBucket['custom#aggregation']).toEqual({ value: 'custom' });
    expect(testBucket.metadata).toEqual({ source: 'elasticsearch' });
  });
});
