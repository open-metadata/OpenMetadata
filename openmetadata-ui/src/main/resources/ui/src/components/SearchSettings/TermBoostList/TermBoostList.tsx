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
import classNames from 'classnames';
import { TermBoost } from '../../../generated/configuration/searchSettings';
import TermBoostComponent from '../TermBoost/TermBoost';
import './term-boost-list.less';

interface TermBoostListProps {
  className?: string;
  termBoostCardClassName?: string;
  termBoosts: TermBoost[];
  showNewTermBoost?: boolean;
  handleDeleteTermBoost: (value: string) => void;
  handleTermBoostChange: (termBoost: TermBoost) => void;
}

const TermBoostList = ({
  className,
  termBoostCardClassName,
  termBoosts,
  showNewTermBoost,
  handleDeleteTermBoost,
  handleTermBoostChange,
}: TermBoostListProps) => {
  return (
    <div
      className={classNames(
        className,
        'd-flex items-center gap-2 flex-wrap m-b-xs term-boosts-container'
      )}>
      {termBoosts.map((termBoost) => (
        <TermBoostComponent
          className={termBoostCardClassName}
          key={termBoost.value}
          termBoost={termBoost}
          onDeleteBoost={handleDeleteTermBoost}
          onTermBoostChange={handleTermBoostChange}
        />
      ))}
      {showNewTermBoost && (
        <TermBoostComponent
          showNewTermBoost
          className={termBoostCardClassName}
          termBoost={{ field: '', value: '', boost: 0 }}
          onDeleteBoost={() => handleDeleteTermBoost('')}
          onTermBoostChange={handleTermBoostChange}
        />
      )}
    </div>
  );
};

export default TermBoostList;
