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
import { monospaceParameterNames } from './FormHintDocUtils';

describe('monospaceParameterNames', () => {
  it('renders a parameter name as code', () => {
    expect(
      monospaceParameterNames(
        '- **Threshold** (NUMBER, Optional) - Number to compare against'
      )
    ).toBe('- `Threshold` (NUMBER, Optional) - Number to compare against');
  });

  it('keeps a parameter name whose own text contains brackets intact', () => {
    expect(
      monospaceParameterNames(
        '- **Longitude Column Name (X)** (STRING, Required) - Name of the column'
      )
    ).toBe(
      '- `Longitude Column Name (X)` (STRING, Required) - Name of the column'
    );
  });

  it('converts a long parameter name — length must not gate the transform', () => {
    expect(
      monospaceParameterNames(
        '- **Radius (in meters) from the expected location** (FLOAT, Required) - How far'
      )
    ).toBe(
      '- `Radius (in meters) from the expected location` (FLOAT, Required) - How far'
    );
  });

  it('converts a parameter whose type has no comma', () => {
    // 20 parameters in the docs are spelled `(INT)` rather than
    // `(NUMBER, Optional)`; requiring the comma silently left them bold.
    expect(
      monospaceParameterNames(
        '- **Min** (INT) - The minimum acceptable average value for this column'
      )
    ).toBe(
      '- `Min` (INT) - The minimum acceptable average value for this column'
    );
  });

  it('leaves descriptive bullets alone even when they look name-like', () => {
    const prose =
      '- **Track quality trends**: Monitor how data quality varies across categories';

    expect(monospaceParameterNames(prose)).toBe(prose);
  });

  it('leaves a sentence lead-in alone', () => {
    const prose =
      '- **Analyze data quality across different segments**: Test results are computed separately';

    expect(monospaceParameterNames(prose)).toBe(prose);
  });

  it('leaves bold prose outside a list alone', () => {
    const prose = '**Important Notes**:\nThe selected column cannot be used';

    expect(monospaceParameterNames(prose)).toBe(prose);
  });

  it('converts every parameter in a list while leaving the heading alone', () => {
    const input = [
      '**Parameters**:',
      '- **Min** (NUMBER, Optional) - The minimum value',
      '- **Max** (NUMBER, Optional) - The maximum value',
    ].join('\n');

    expect(monospaceParameterNames(input)).toBe(
      [
        '**Parameters**:',
        '- `Min` (NUMBER, Optional) - The minimum value',
        '- `Max` (NUMBER, Optional) - The maximum value',
      ].join('\n')
    );
  });

  it('does not convert a bullet whose parenthetical is not a type', () => {
    const prose = '- **Some Label** (see the guide) - not a parameter';

    expect(monospaceParameterNames(prose)).toBe(prose);
  });

  it('returns an empty string unchanged', () => {
    expect(monospaceParameterNames('')).toBe('');
  });
});
