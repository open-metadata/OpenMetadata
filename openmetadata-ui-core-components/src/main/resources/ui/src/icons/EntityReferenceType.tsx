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

export const EntityReferenceType: FC<Props> = ({
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
    <circle
      cx={9.999}
      cy={9.999}
      r={2.218}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={9.999}
      cy={2.928}
      r={0.928}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path d="M10 7.623V5.238" stroke="currentColor" strokeWidth={1.3} />
    <circle
      cx={10.001}
      cy={17.072}
      r={0.928}
      stroke="currentColor"
      strokeWidth={1.3}
      transform="rotate(180 10.001 17.072)"
    />
    <path d="M10 12.377v2.385" stroke="currentColor" strokeWidth={1.3} />
    <circle
      cx={17.072}
      cy={9.999}
      r={0.928}
      stroke="currentColor"
      strokeWidth={1.3}
      transform="rotate(90 17.072 9.999)"
    />
    <path d="M12.377 10h2.385" stroke="currentColor" strokeWidth={1.3} />
    <circle
      cx={2.928}
      cy={10.001}
      r={0.928}
      stroke="currentColor"
      strokeWidth={1.3}
      transform="rotate(-90 2.928 10.001)"
    />
    <path d="M7.623 10H5.238" stroke="currentColor" strokeWidth={1.3} />
    <circle
      cx={15}
      cy={15}
      r={0.928}
      stroke="currentColor"
      strokeWidth={1.3}
      transform="rotate(135 15 15)"
    />
    <path
      d="m11.681 11.681 1.686 1.686"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={5}
      cy={5}
      r={0.928}
      stroke="currentColor"
      strokeWidth={1.3}
      transform="rotate(-45 5 5)"
    />
    <path
      d="M8.319 8.319 6.633 6.633"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={5}
      cy={15}
      r={0.928}
      stroke="currentColor"
      strokeWidth={1.3}
      transform="rotate(-135 5 15)"
    />
    <path
      d="m8.319 11.681-1.686 1.686"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={15}
      cy={5}
      r={0.928}
      stroke="currentColor"
      strokeWidth={1.3}
      transform="rotate(45 15 5)"
    />
    <path
      d="m11.681 8.319 1.686-1.686"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
EntityReferenceType.displayName = 'EntityReferenceType';
