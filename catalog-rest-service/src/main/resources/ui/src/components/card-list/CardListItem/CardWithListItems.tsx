/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import { Props } from './CardWithListItems.interface';
import { cardStyle } from './CardWithListItems.style';

const CardListItem: FunctionComponent<Props> = ({
  card,
  isActive,
  onSelect,
}: Props) => {
  return (
    <div
      className={classNames(
        cardStyle.base,
        isActive ? cardStyle.active : cardStyle.default
      )}
      onClick={() => onSelect(card.id)}>
      <div
        className={classNames(
          cardStyle.header.base,
          isActive ? cardStyle.header.active : cardStyle.header.default
        )}>
        <div className="tw-flex tw-flex-col">
          <h4 className={cardStyle.header.title}>{card.title}</h4>
          <p className={cardStyle.header.description}>
            {card.description.replaceAll('*', '')}
          </p>
        </div>
        <div>
          {isActive && <i className="fas fa-check-circle tw-text-h2" />}
        </div>
      </div>
      <div
        className={classNames(
          cardStyle.body.base,
          isActive ? cardStyle.body.active : cardStyle.body.default
        )}>
        <RichTextEditorPreviewer markdown={card.data} />
      </div>
    </div>
  );
};

export default CardListItem;
