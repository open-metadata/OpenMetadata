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
import { EditOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import React from 'react';
import './SectionWithEdit.less';

interface SectionWithEditProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  onEdit?: () => void;
  showEditButton?: boolean;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
}

const SectionWithEdit: React.FC<SectionWithEditProps> = ({
  title,
  children,
  onEdit,
  showEditButton = true,
  className = '',
  titleClassName = '',
  contentClassName = '',
}) => {
  return (
    <div className={`section-with-edit ${className}`}>
      <div className={`section-header ${titleClassName}`}>
        {typeof title === 'string' ? (
          <Typography.Text className="section-title">{title}</Typography.Text>
        ) : (
          title
        )}
        {showEditButton && onEdit && (
          <Button
            className="section-edit-button"
            icon={<EditOutlined />}
            size="small"
            type="text"
            onClick={onEdit}
          />
        )}
      </div>
      <div className={`section-content ${contentClassName}`}>{children}</div>
    </div>
  );
};

export default SectionWithEdit;
