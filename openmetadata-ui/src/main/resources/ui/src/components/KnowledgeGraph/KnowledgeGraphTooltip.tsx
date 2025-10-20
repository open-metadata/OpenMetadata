/*
 *  Copyright 2024 Collate.
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

import {
  DashboardOutlined,
  DatabaseOutlined,
  FolderOutlined,
  ForkOutlined,
  TableOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';

interface TooltipData {
  id: string;
  label: string;
  type: string;
  group: string;
  description?: string;
  owner?: string;
  tags?: string[];
}

const getEntityIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'table':
      return <TableOutlined />;
    case 'database':
      return <DatabaseOutlined />;
    case 'schema':
      return <FolderOutlined />;
    case 'dashboard':
      return <DashboardOutlined />;
    case 'pipeline':
      return <ForkOutlined />;
    case 'user':
      return <UserOutlined />;
    case 'team':
      return <TeamOutlined />;
    default:
      return null;
  }
};

const getEntityColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'table':
      return 'success';
    case 'database':
      return 'blue';
    case 'schema':
      return 'orange';
    case 'dashboard':
      return 'magenta';
    case 'pipeline':
      return 'purple';
    case 'user':
      return 'cyan';
    case 'team':
      return 'geekblue';
    default:
      return 'default';
  }
};

export const createTooltipContent = (data: TooltipData): string => {
  const icon = getEntityIcon(data.type);
  const color = getEntityColor(data.type);

  let content = `
    <div style="min-width: 200px; max-width: 300px;">
      <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        ${
          icon
            ? `<span style="color: var(--ant-${color}-color);">${icon}</span>`
            : ''
        }
        <span>${data.label}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-size: 12px; color: #8c8c8c;">Type:</span>
        <span style="font-size: 12px; margin-left: 4px;">${data.type}</span>
      </div>
  `;

  if (data.description) {
    content += `
      <div style="margin-bottom: 8px;">
        <div style="font-size: 12px; color: #8c8c8c;">Description:</div>
        <div style="font-size: 12px; margin-top: 4px;">${data.description}</div>
      </div>
    `;
  }

  if (data.owner) {
    content += `
      <div style="margin-bottom: 8px;">
        <span style="font-size: 12px; color: #8c8c8c;">Owner:</span>
        <span style="font-size: 12px; margin-left: 4px;">${data.owner}</span>
      </div>
    `;
  }

  if (data.tags && data.tags.length > 0) {
    content += `
      <div>
        <div style="font-size: 12px; color: #8c8c8c; margin-bottom: 4px;">Tags:</div>
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          ${data.tags
            .map(
              (tag) =>
                `<span style="font-size: 11px; padding: 2px 8px; background: #f0f0f0; border-radius: 4px;">${tag}</span>`
            )
            .join('')}
        </div>
      </div>
    `;
  }

  content += '</div>';

  return content;
};
