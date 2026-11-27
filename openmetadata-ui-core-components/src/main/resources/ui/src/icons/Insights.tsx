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

export const Insights: FC<Props> = ({
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
    <path
      d="M8.67 13.674s-.506-.92-1.202-1.593c-.696-.674-1.29-1.403-1.391-2.512-.11-1.192.224-2.014 1.075-2.88 1.533-1.56 4.16-1.56 5.692 0 .852.866 1.194 1.69 1.076 2.88-.112 1.12-.696 1.776-1.455 2.512-.76.735-1.075 1.593-1.075 1.593z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.094 8.457 8.949 9.974h2.06l-.915 1.328"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <rect
      height={2.58}
      rx={1.29}
      stroke="currentColor"
      strokeWidth={1.3}
      width={7.385}
      x={6.567}
      y={14.471}
    />
    <path
      d="m3.738 4.402.834.834m10.502 7.932.834.834"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <rect
      height={1.611}
      rx={0.805}
      stroke="currentColor"
      strokeWidth={1.3}
      width={3.769}
      x={8.299}
      y={17.041}
    />
    <path
      d="m15.04 3.6-.835.834m-8.762 9.533-.834.834"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.877 2.007a.648.648 0 0 1 1.295-.009l-.648.005zm1.303 1.142a.648.648 0 1 1-1.296.008l.648-.004zm-.656-1.146.648-.005.008 1.151-.648.004-.648.004-.007-1.15zm8.42 6.413a.648.648 0 0 1 .008 1.296l-.004-.648zM16.752 9.72a.648.648 0 1 1-.008-1.296l.004.648zm1.196-.656.004.648-1.2.008-.004-.648-.004-.648 1.2-.008zm-14.7.086a.648.648 0 1 1 .009 1.296L3.252 9.8zm-1.191 1.304a.648.648 0 0 1-.009-1.296l.004.648zm1.195-.655.005.647-1.2.008-.005-.648-.004-.648 1.2-.007z"
      fill="currentColor"
    />
  </svg>
);
Insights.displayName = 'Insights';
