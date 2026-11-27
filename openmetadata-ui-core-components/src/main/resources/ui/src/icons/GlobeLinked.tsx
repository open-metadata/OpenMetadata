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

export const GlobeLinked: FC<Props> = ({
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
    <circle
      cx={7.244}
      cy={7.138}
      r={5.138}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <ellipse
      cx={7.245}
      cy={7.138}
      rx={2.055}
      ry={5.138}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path d="M2.62 7.137h9.248" stroke="currentColor" strokeWidth={1.3} />
    <circle
      cx={15.344}
      cy={15.447}
      r={2.553}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.047 15.45h4.595m-2.335-2.2v4.46m-7.655-3.394v1.243c0 .561.462 1.012 1.022 1.003 1.006-.016 2.078-.022 1.923.02"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
GlobeLinked.displayName = 'GlobeLinked';
