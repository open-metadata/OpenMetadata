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
import { Skeleton, Space } from 'antd';
import './LineageSkeleton.less';

/**
 * In-canvas placeholder for the {@link Lineage} React Flow graph while node data is loading.
 *
 * The original loader was a centered spinner inside a `loading-card` div — visually correct but
 * gives no hint of the upcoming content. This skeleton sketches a row of node-shaped cards
 * connected by a thin line so the user perceives "graph is coming" rather than "loading".
 *
 * Styling lives in {@link LineageSkeleton.less} so we can reference design tokens
 * (`--ant-color-border-secondary`, `--ant-color-bg-container`) and stay consistent with the
 * rest of the codebase's Less-based theming.
 */
export const LineageSkeleton = () => {
  return (
    <div className="loading-card lineage-skeleton">
      <Space align="center" size={24}>
        {[0, 1, 2].map((i) => (
          <div className="lineage-skeleton-node" key={i}>
            <Skeleton
              active
              paragraph={{ rows: 1, width: ['80%'] }}
              title={{ width: '60%' }}
            />
          </div>
        ))}
      </Space>
    </div>
  );
};

export default LineageSkeleton;
