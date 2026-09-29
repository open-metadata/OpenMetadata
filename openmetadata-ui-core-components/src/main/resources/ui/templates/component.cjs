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
 * SVGR component template — generates each {IconName}.tsx file.
 * Mirrors the template used by @untitledui/icons.
 *
 * Custom icons never reference the color binding in JSX (they preserve
 * authored brand colors instead of a themeable stroke), so they destructure
 * it renamed to `_color` (`color: _color`) to satisfy eslint's
 * no-unused-vars ignore pattern while keeping `Props.color` as the one
 * declared property for both pipelines. Regular icons use the binding
 * directly (`stroke={color}`), so theirs stays a plain `color`.
 */
function createComponentTemplate(isCustom) {
  const colorParam = isCustom ? "color: _color = 'currentColor'" : "color = 'currentColor'";

  return ({ componentName, jsx }, { tpl }) => {
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
import type { SVGProps, FC } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const ${name}: FC<Props> = ({ size = 24, ${colorParam}, ...props }) => (
  ${jsx}
);
${name}.displayName = '${name}';
`;
  };
}

module.exports = createComponentTemplate;
