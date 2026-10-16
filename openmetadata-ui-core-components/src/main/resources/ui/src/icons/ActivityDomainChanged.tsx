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

export const ActivityDomainChanged: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M16.918 9.28a7.28 7.28 0 1 0-7.28 7.279"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.546 9.28c0-4.02-1.303-7.28-2.912-7.28S6.723 5.26 6.723 9.28s1.303 7.279 2.911 7.279M2.36 9.281h14.558m-2.272 7.435a2.14 2.14 0 1 0 0-4.282m1.859 3.203 1.138.65m-1.138-2.774 1.138-.65m-2.997 3.852a2.14 2.14 0 1 1 0-4.281m0 0v-1.285m-1.86 4.488-1.138.65m1.139-2.774-1.139-.65m2.998 3.852V18"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityDomainChanged.displayName = 'ActivityDomainChanged';
