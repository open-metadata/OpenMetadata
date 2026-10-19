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

export const Stars01: FC<Props> = ({
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
      d="m5.417 10.833.653 1.308c.222.442.333.663.48.855a2.5 2.5 0 0 0 .454.454c.192.148.413.258.855.479l1.308.654-1.307.654c-.442.221-.663.332-.855.479a2.5 2.5 0 0 0-.454.454c-.147.192-.258.413-.48.855l-.654 1.308-.653-1.307c-.222-.442-.332-.663-.48-.855a2.5 2.5 0 0 0-.454-.454c-.192-.147-.413-.258-.855-.479l-1.308-.655 1.308-.654c.442-.221.663-.332.855-.479a2.5 2.5 0 0 0 .454-.454c.148-.192.258-.413.48-.855zM12.5 1.667l.983 2.553c.235.612.353.917.535 1.174a2.5 2.5 0 0 0 .588.588c.258.183.563.3 1.174.535l2.553.983-2.553.983c-.612.235-.917.353-1.174.535a2.5 2.5 0 0 0-.588.588c-.183.258-.3.563-.535 1.174l-.983 2.553-.982-2.553c-.235-.612-.352-.917-.535-1.174a2.5 2.5 0 0 0-.588-.588c-.257-.183-.563-.3-1.174-.535L6.667 7.5l2.553-.982c.612-.235.917-.352 1.174-.535a2.5 2.5 0 0 0 .588-.588c.183-.257.3-.563.535-1.174z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Stars01.displayName = 'Stars01';
