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

export const Map01: FC<Props> = ({
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
      d="M6.8 3.074V14.85m5.6 1.624V5.104M2 13.094V7.112c0-.976 0-1.465.239-1.857.239-.393.67-.611 1.53-1.048l.376-.19C5.451 3.353 6.104 3.021 6.81 3c.705-.021 1.376.27 2.718.855l1.611.7c.622.271.933.406 1.261.406s.64-.135 1.26-.405l.995-.433c1.51-.657 2.266-.986 2.806-.625C18 3.86 18 4.695 18 6.363v6.345c0 1.039 0 1.558-.264 1.965-.265.406-.735.611-1.675 1.02l-1.14.496c-1.243.54-1.864.811-2.521.811s-1.278-.27-2.521-.811l-1.96-.853c-.554-.24-.83-.36-1.124-.373-.293-.012-.579.084-1.15.277l-.486.165c-1.442.488-2.162.732-2.66.367S2 14.636 2 13.094"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Map01.displayName = 'Map01';
