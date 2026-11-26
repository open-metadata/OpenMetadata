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

export const SortKeyOff: FC<Props> = ({
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
      cx={4.642}
      cy={16.33}
      r={1.685}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={10.322}
      cy={16.33}
      r={1.685}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={16.004}
      cy={16.33}
      r={1.685}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.455 14.674v-3.807M4.64 14.673V12.77m.048 0h11.225"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.317 7.424c.075.842.024 1.767-.083 2.36l-.016.066c-.177.605-.484 1.068-.979 1.35-.461.262-.999.314-1.513.314-.596 0-2.82.017-3.37-.03a2.14 2.14 0 0 1-1.316-.607l1.447-.687c.519.039 2.586.024 3.239.024.459 0 .713-.055.87-.145.122-.069.255-.199.363-.55a8.3 8.3 0 0 0 .089-1.493zM8.21 3.14c1.118-1.668 3.517-1.46 4.371.2.221.431.274.909.286 1.298.005.166.002.33 0 .48q.183.054.374.16c.314.18.58.458.775.848l-1.175.558a.65.65 0 0 0-.246-.278.76.76 0 0 0-.385-.083h-.036c-.562-.032-2.665-.041-3.68 0h-.026c-.35 0-.46.094-.503.137-.07.071-.118.176-.193.393-.098.361-.212 1.251-.094 2.28l-1.234.585c-.228-1.373-.084-2.642.08-3.228l.01-.034c.07-.204.195-.592.502-.905q.307-.316.772-.445a8 8 0 0 1 .01-.58c.024-.421.101-.953.392-1.386m3.215.796c-.405-.787-1.573-.911-2.136-.072-.09.134-.153.373-.174.738a6 6 0 0 0-.008.405 78 78 0 0 1 2.458-.003c.002-.111.006-.22.002-.325a2.3 2.3 0 0 0-.085-.602z"
      fill="currentColor"
    />
    <path
      d="m2.313 10.996 14.841-7.042m-1.152 10.719V12.77"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SortKeyOff.displayName = 'SortKeyOff';
