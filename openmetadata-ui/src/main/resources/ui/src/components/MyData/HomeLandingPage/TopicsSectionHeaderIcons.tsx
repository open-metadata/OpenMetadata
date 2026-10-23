/*
 *  Copyright 2026 Collate.
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
import type { FC, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

// The design's glyphs, drawn on its 24 grid at its 2px stroke. Core's icons are
// normalised to a lighter 1.3 stroke, which reads too thin at these sizes.
const DesignIcon: FC<IconProps> = ({ children, ...props }) => (
  <svg
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    {...props}>
    {children}
  </svg>
);

export const ListViewIcon: FC<IconProps> = (props) => (
  <DesignIcon {...props}>
    <rect height="6" rx="2" width="15" x="4.5" y="4.5" />
    <rect height="6" rx="2" width="15" x="4.5" y="13.5" />
  </DesignIcon>
);

export const GridViewIcon: FC<IconProps> = (props) => (
  <DesignIcon {...props}>
    <rect height="15" rx="2" width="6" x="4.5" y="4.5" />
    <rect height="15" rx="2" width="6" x="13.5" y="4.5" />
  </DesignIcon>
);

export const CollapseAllIcon: FC<IconProps> = (props) => (
  <DesignIcon {...props}>
    <path d="m8.5 6.5 3.5-3.5 3.5 3.5M8.5 17.5l3.5 3.5 3.5-3.5" />
  </DesignIcon>
);
