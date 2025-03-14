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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Row, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TermBoost } from '../../../generated/configuration/searchSettings';
import TermBoostComponent from '../TermBoost/TermBoost';
import './term-boost-list.less';

interface TermBoostListProps {
  className?: string;
  termBoosts: TermBoost[];
  showNewTermBoost?: boolean;
  handleDeleteTermBoost: (value: string) => void;
  handleTermBoostChange: (termBoost: TermBoost) => void;
  handleAddNewTermBoost: () => void;
}

const TermBoostList = ({
  className,
  termBoosts,
  showNewTermBoost,
  handleDeleteTermBoost,
  handleTermBoostChange,
  handleAddNewTermBoost,
}: TermBoostListProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={classNames(
        className,
        'p-t-md d-flex items-center gap-2 flex-wrap term-boosts-container'
      )}>
      <div className="d-flex items-center gap-2 flex-wrap term-boosts-container">
        {termBoosts.map((termBoost) => (
          <TermBoostComponent
            key={termBoost.value || 'new'}
            termBoost={termBoost}
            onDeleteBoost={handleDeleteTermBoost}
            onTermBoostChange={handleTermBoostChange}
          />
        ))}
        {showNewTermBoost && (
          <TermBoostComponent
            showNewTermBoost
            termBoost={{ field: '', value: '', boost: 0 }}
            onDeleteBoost={() => handleDeleteTermBoost('')}
            onTermBoostChange={handleTermBoostChange}
          />
        )}
        <div className="add-term-boost-card">
          <Row className="p-box d-flex flex-column items-center justify-center gap-3">
            <Button
              className="add-term-boost-btn"
              data-testid="add-term-boost"
              icon={<PlusOutlined />}
              onClick={handleAddNewTermBoost}
            />
            <Typography.Text className="add-term-boost-label">
              {t('label.add-term-boost')}
            </Typography.Text>
          </Row>
        </div>
      </div>
    </div>
  );
};

export default TermBoostList;
