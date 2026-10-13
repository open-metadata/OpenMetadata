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

export const EyeFilled: FC<Props> = ({
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
      d="M17.635 9.238c.243.341.365.512.365.764 0 .253-.122.423-.365.764-1.093 1.533-3.884 4.836-7.635 4.836S3.458 12.3 2.365 10.766c-.243-.34-.365-.511-.365-.764 0-.252.122-.423.365-.764C3.458 7.706 6.249 4.402 10 4.402s6.542 3.304 7.635 4.836"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.402 10.006a2.4 2.4 0 1 0-4.8 0 2.4 2.4 0 0 0 4.8 0"
      stroke="white"
      strokeWidth={1.3}
    />
  </svg>
);
EyeFilled.displayName = 'EyeFilled';
