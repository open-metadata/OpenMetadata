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

export const NavigationPointer01: FC<Props> = ({
  size = 24,
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M3.413 10.745c-.595-.232-.893-.348-.98-.515a.5.5 0 0 1 0-.461c.087-.167.385-.283.98-.515L20.3 2.664c.537-.21.806-.315.978-.258a.5.5 0 0 1 .316.316c.057.172-.048.44-.258.977l-6.59 16.888c-.232.595-.348.893-.515.98a.5.5 0 0 1-.462 0c-.167-.088-.282-.385-.514-.98l-2.628-6.759a1 1 0 0 0-.107-.232.5.5 0 0 0-.116-.117 1 1 0 0 0-.232-.106z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
NavigationPointer01.displayName = 'NavigationPointer01';
