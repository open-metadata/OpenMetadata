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

export const ActivityAssetDeleted: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <g stroke="currentColor">
      <path d="m9.75 2.75-.31 5.013c-.079 1.28-.118 1.92-.44 2.381a2 2 0 0 1-.6.564C7.921 11 7.28 11 5.996 11s-1.927 0-2.406-.292a2 2 0 0 1-.6-.565c-.322-.462-.36-1.103-.438-2.385L2.25 2.75" />
      <path d="M1.5 2.75h9m-2.472 0-.341-.704c-.227-.468-.34-.702-.536-.848a1 1 0 0 0-.137-.086C6.797 1 6.537 1 6.017 1c-.533 0-.799 0-1.02.117a1 1 0 0 0-.138.09c-.198.151-.309.394-.53.879l-.302.664m.723 5.5v-3m2.5 3v-3" />
    </g>
  </svg>
);
ActivityAssetDeleted.displayName = 'ActivityAssetDeleted';
