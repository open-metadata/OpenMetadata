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

export const DataProductFilled: FC<Props> = ({
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
      d="M6.44 8.744c.336.167.749.347 1.221.55l.56.241c.51.22.904.392 1.279.48v3.86a16 16 0 0 1-.824-.337l-.56-.241c-.709-.306-1.176-.508-1.474-.688a1 1 0 0 1-.203-.147zm7.12 3.718a1 1 0 0 1-.203.147c-.298.18-.765.383-1.474.688l-.56.241a16 16 0 0 1-.823.337v-3.86c.374-.088.77-.26 1.278-.48l.56-.241c.472-.204.886-.383 1.223-.55zM10 5.867c.29 0 .57.11 1.383.461l.56.241c.704.304 1.183.511 1.492.697q.083.051.137.09a1 1 0 0 0-.011.123v.117a2 2 0 0 1-.126.083c-.31.185-.788.393-1.493.697l-.56.241c-.813.35-1.092.461-1.382.461s-.57-.11-1.384-.46l-.56-.242c-.704-.304-1.183-.512-1.492-.697a2 2 0 0 1-.125-.082v-.118a1 1 0 0 0-.013-.123q.054-.039.138-.09c.31-.186.788-.393 1.493-.697l.56-.24C9.43 5.976 9.71 5.866 10 5.866"
      fill="currentColor"
    />
    <path
      d="M7.595 2c-2.237.051-3.544.265-4.437 1.158S2.05 5.358 2 7.595M12.405 2c2.237.051 3.544.265 4.437 1.158S17.95 5.358 18 7.595M12.405 18c2.237-.051 3.544-.265 4.437-1.158s1.107-2.2 1.158-4.437M7.595 18c-2.237-.051-3.544-.265-4.437-1.158S2.05 14.642 2 12.405"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataProductFilled.displayName = 'DataProductFilled';
