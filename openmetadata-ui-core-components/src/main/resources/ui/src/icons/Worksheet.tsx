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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const Worksheet: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M6.979 11.473h1.6m3.2 0h1.6m-6.4 3.2h1.6m3.2 0h1.6M10.98 2.271v.4c0 2.263 0 3.394.702 4.097.703.703 1.835.703 4.097.703h.4m.4 1.326v2.674c0 3.017 0 4.526-.937 5.463s-2.446.937-5.463.937-4.525 0-5.462-.937c-.938-.937-.938-2.446-.938-5.463V7.836c0-2.596 0-3.894.71-4.773a3.2 3.2 0 0 1 .482-.483c.879-.709 2.177-.709 4.773-.709.564 0 .847 0 1.105.091a2 2 0 0 1 .158.066c.247.118.447.317.845.716l3.79 3.79c.463.462.694.694.816.988.121.294.121.62.121 1.275"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Worksheet.displayName = 'Worksheet';
