/*
 *  Copyright 2021 Collate
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

import Fqn from './Fqn';

describe('Test FQN', () => {
  it('should build and split', () => {
    class FQNTest {
      constructor(parts, fqn) {
        this.parts = parts;
        this.fqn = fqn;
      }
      validate(actualParts, actualFQN) {
        expect(this.fqn).toStrictEqual(actualFQN);
        expect(this.parts.length).toStrictEqual(actualParts.length);

        for (let i = 0; i < this.parts.length; i++) {
          /* eslint-disable jest/no-conditional-expect */
          if (this.parts[i].includes('.')) {
            expect(Fqn.quoteName(this.parts[i])).toStrictEqual(actualParts[i]);
          } else {
            expect(this.parts[i]).toStrictEqual(actualParts[i]);
          }
          /* eslint-enable jest/no-conditional-expect */
        }
      }
    }

    const xs = [
      new FQNTest(['a', 'b', 'c', 'd'], 'a.b.c.d'),
      new FQNTest(['a.1', 'b', 'c', 'd'], '"a.1".b.c.d'),
      new FQNTest(['a', 'b.2', 'c', 'd'], 'a."b.2".c.d'),
      new FQNTest(['a', 'b', 'c.3', 'd'], 'a.b."c.3".d'),
      new FQNTest(['a', 'b', 'c', 'd.4'], 'a.b.c."d.4"'),
      new FQNTest(['a.1', 'b.2', 'c', 'd'], '"a.1"."b.2".c.d'),
      new FQNTest(['a.1', 'b.2', 'c.3', 'd'], '"a.1"."b.2"."c.3".d'),
      new FQNTest(['a.1', 'b.2', 'c.3', 'd.4'], '"a.1"."b.2"."c.3"."d.4"'),
    ];
    for (const x of xs) {
      const actualParts = Fqn.split(x.fqn);
      const actualFqn = Fqn.build(...x.parts);
      x.validate(actualParts, actualFqn);
    }
  });

  it('should quote names', () => {
    expect('a').toStrictEqual(Fqn.quoteName('a')); // Unquoted name remains unquoted
    expect('"a.b"').toStrictEqual(Fqn.quoteName('a.b')); // Add quotes when "." exists in the name
    expect('"a.b"').toStrictEqual(Fqn.quoteName('"a.b"')); // Leave existing valid quotes
    expect('a').toStrictEqual(Fqn.quoteName('"a"')); // Remove quotes when not needed

    expect(() => Fqn.quoteName('"a')).toThrow('Invalid name "a'); // Error when ending quote is missing
    expect(() => Fqn.quoteName('a"')).toThrow('Invalid name a"'); // Error when beginning quote is missing
    expect(() => Fqn.quoteName('a"b')).toThrow('Invalid name a"b'); // Error when invalid quote is present in the middle of the string
  });
});
