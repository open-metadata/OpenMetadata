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

import { FC, ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const Stroke: FC<IconProps & { children: ReactNode }> = ({
  children,
  ...rest
}) => (
  <svg
    fill="none"
    height={18}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
    width={18}
    {...rest}>
    {children}
  </svg>
);

// Icons.jsx:19
export const IcDb: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <ellipse cx={12} cy={5} rx={9} ry={3} />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
    <path d="M3 12a9 3 0 0 0 18 0" />
  </Stroke>
);

// Icons.jsx:35
export const IcZap: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Stroke>
);

// Icons.jsx:20
export const IcGrid: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <rect height={7} width={7} x={3} y={3} />
    <rect height={7} width={7} x={14} y={3} />
    <rect height={7} width={7} x={3} y={14} />
    <rect height={7} width={7} x={14} y={14} />
  </Stroke>
);

// Icons.jsx:12
export const IcLineage: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <circle cx={6} cy={6} r={3} />
    <circle cx={6} cy={18} r={3} />
    <circle cx={18} cy={12} r={3} />
    <line x1={9} x2={15} y1={6} y2={12} />
    <line x1={9} x2={15} y1={18} y2={12} />
  </Stroke>
);

// Icons.jsx:31
export const IcSparkle: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx={12} cy={12} r={3} />
  </Stroke>
);

// Icons.jsx:18
export const IcCode: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </Stroke>
);

// Icons.jsx:34
export const IcLayers: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Stroke>
);

// Icons.jsx:17
export const IcBook: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </Stroke>
);

// Icons.jsx:16
export const IcShield: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z" />
  </Stroke>
);

// Icons.jsx:21
export const IcPlus: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <line x1={12} x2={12} y1={5} y2={19} />
    <line x1={5} x2={19} y1={12} y2={12} />
  </Stroke>
);

// Icons.jsx:29
export const IcChevD: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <polyline points="6 9 12 15 18 9" />
  </Stroke>
);

// Icons.jsx:13
export const IcSearch: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <circle cx={11} cy={11} r={8} />
    <path d="m21 21-4.3-4.3" />
  </Stroke>
);

// Icons.jsx:23 — 3 stacked circles (vertical)
export const IcMore: FC<IconProps> = (p) => (
  <Stroke {...p}>
    <circle cx={12} cy={12} r={1} />
    <circle cx={12} cy={5} r={1} />
    <circle cx={12} cy={19} r={1} />
  </Stroke>
);

// agents.jsx:86 — filled metric icons
export const AssetIcon: FC = () => (
  <svg
    fill="none"
    height="15"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="15">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" />
    <path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" />
  </svg>
);

// agents.jsx:87
export const ErrIcon: FC = () => (
  <svg
    fill="none"
    height="15"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.9"
    viewBox="0 0 24 24"
    width="15">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

// agents.jsx:88
export const WarnIcon: FC = () => (
  <svg
    fill="none"
    height="15"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.9"
    viewBox="0 0 24 24"
    width="15">
    <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

// agents.jsx:89
export const ClockIcon: FC = () => (
  <svg
    fill="none"
    height="15"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="15">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

// agents.jsx:90
export const LogsIcon: FC = () => (
  <svg
    fill="none"
    height="15"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="15">
    <path d="M4 4h16v16H4z" opacity="0" />
    <line x1="8" x2="16" y1="8" y2="8" />
    <line x1="8" x2="16" y1="12" y2="12" />
    <line x1="8" x2="13" y1="16" y2="16" />
  </svg>
);

// agents.jsx:91
export const RunIcon: FC = () => (
  <svg
    fill="currentColor"
    height="14"
    stroke="none"
    viewBox="0 0 24 24"
    width="14">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z" />
  </svg>
);

// agents.jsx:92
export const QueryIcon: FC = () => (
  <svg
    fill="none"
    height="15"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="15">
    <polyline points="4 7 9 12 4 17" />
    <line x1="12" x2="20" y1="17" y2="17" />
  </svg>
);
