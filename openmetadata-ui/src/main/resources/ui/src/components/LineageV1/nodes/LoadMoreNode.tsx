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

import { Button } from 'antd';
import { memo, useCallback, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeProps } from 'reactflow';
import './nodes.less';

interface LoadMoreNodeData {
  node: {
    pagination_data: {
      index: number;
      count: number;
      parentId: string;
    };
    direction: string;
  };
  onLoadMore?: () => void;
}

const LoadMoreNode = memo<NodeProps<LoadMoreNodeData>>(
  ({ data }) => {
    const { t } = useTranslation();
    const [isPending, startTransition] = useTransition();

    const handleClick = useCallback(() => {
      if (data.onLoadMore) {
        // Use React 18's startTransition for non-urgent updates
        startTransition(() => {
          data.onLoadMore?.();
        });
      }
    }, [data.onLoadMore]);

    const count = data.node?.pagination_data?.count || 0;

    return (
      <div
        className="lineage-node-v1 load-more-node"
        data-testid="load-more-node">
        <Button
          className="load-more-button"
          loading={isPending}
          size="small"
          type="dashed"
          onClick={handleClick}>
          {t('label.load-entity', {
            entity: t('label.more-lowercase'),
            count,
          })}
        </Button>
      </div>
    );
  },
  // Custom comparison to prevent re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.data.node?.pagination_data?.count ===
        nextProps.data.node?.pagination_data?.count &&
      prevProps.data.node?.pagination_data?.index ===
        nextProps.data.node?.pagination_data?.index
    );
  }
);

LoadMoreNode.displayName = 'LoadMoreNode';

export default LoadMoreNode;
