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

export const CustomProperty: FC<Props> = ({
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
      d="M7.384 17.6c1.034-1.778 3.402-1.988 4.75-.629.301.304.452.456.586.474s.972-.463 1.27-.633c.303-.174 1.145-.657 1.198-.783.053-.127-.003-.342-.113-.772-.403-1.566.574-3.214 2.134-3.639.417-.114.626-.17.709-.28C18 11.23 18 10.275 18 9.925s0-1.306-.082-1.415c-.083-.108-.292-.165-.71-.279-1.56-.425-2.537-2.073-2.135-3.638.111-.431.166-.646.114-.773-.053-.126-.895-.609-1.198-.783-.298-.17-1.137-.651-1.27-.633-.134.018-.285.17-.586.474a3.02 3.02 0 0 1-4.267 0c-.301-.304-.452-.456-.586-.474s-.972.463-1.27.634c-.303.174-1.145.656-1.198.782-.053.127.003.342.113.773.403 1.565-.573 3.213-2.134 3.638-.417.114-.626.17-.709.28C2 8.617 2 9.573 2 9.923s0 1.306.082 1.415c.083.109.292.165.709.28l.015.003"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2.391 14.95c.864-.864 3.802-3.772 4.09-4.108.304-.355.057-.835.204-2.322.071-.72.226-1.259.67-1.66.527-.5.96-.5 2.447-.533 1.296.034 1.45-.11 1.584.226.096.24-.192.383-.537.767-.768.768-1.22 1.152-1.263 1.392-.312 1.055.917 1.68 1.59 1.007.253-.254 1.43-1.439 1.545-1.535.086-.077.293-.073.393.048.087.085.096.096.087.48-.01.355-.005.865-.004 1.391.001.682-.035 1.44-.323 1.823-.576.864-1.536.912-2.4.95-.816.048-1.488-.038-1.699.116-.173.086-1.085 1.046-2.189 2.15l-1.968 1.966c-1.632 1.296-3.427-.72-2.227-2.159"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CustomProperty.displayName = 'CustomProperty';
