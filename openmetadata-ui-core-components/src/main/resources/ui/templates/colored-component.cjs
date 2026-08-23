/*
 *  Copyright 2025 Collate.
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

/**
 * SVGR template for colored/gradient icons.
 * Unlike the standard template, this one:
 * - Has no `color` prop (colored icons use fixed brand colors from the SVG)
 * - Does NOT inject stroke/fill/strokeWidth at the SVG root (preserves original colors)
 */
const template = ({ componentName, jsx }, { tpl }) => {
  const name = componentName.replace(/^Svg/, '');

  return tpl`/*
 *  Copyright 2025 Collate.
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

import * as React from 'react';
import type {SVGProps, FC} from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  size?: number;
}

export const ${name}: FC<Props> = ({ size = 24, ...props }) => (
  ${jsx}
);
${name}.displayName = '${name}';`;
};

module.exports = template;
