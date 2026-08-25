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

export const NoDimension: FC<Props> = ({
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M10 9.578c.417 0 .805-.167 1.58-.502l.56-.241c1.38-.595 2.07-.892 2.07-1.363 0-.47-.69-.768-2.07-1.362l-.56-.241c-.775-.335-1.163-.502-1.58-.502s-.806.167-1.581.502l-.56.24c-1.38.595-2.07.893-2.07 1.363 0 .471.69.768 2.07 1.363l.56.241c.775.335 1.163.502 1.58.502m0 0v5.052"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.21 7.473v5.052c0 .471-.69.768-2.07 1.363l-.56.241c-.775.334-1.163.502-1.58.502s-.806-.168-1.581-.502l-.56-.241c-1.38-.595-2.07-.892-2.07-1.363V7.473M7.595 2c-2.237.051-3.544.265-4.437 1.158S2.05 5.358 2 7.595M12.405 2c2.237.051 3.544.265 4.437 1.158S17.95 5.358 18 7.595M12.405 18c2.237-.051 3.544-.265 4.437-1.158s1.107-2.2 1.158-4.437M7.595 18c-2.237-.051-3.544-.265-4.437-1.158S2.05 14.642 2 12.405"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
NoDimension.displayName = 'NoDimension';
