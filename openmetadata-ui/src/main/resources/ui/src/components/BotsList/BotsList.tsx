/*
 *  Copyright 2021 Collate
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

import React, { FC, Fragment, HTMLAttributes } from 'react';
import { useHistory } from 'react-router-dom';
import { getBotsPath } from '../../constants/constants';
import { Bots } from '../../generated/entity/bots';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityName } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';

interface BotsListProp extends HTMLAttributes<HTMLDivElement> {
  bots: Array<Bots>;
}

const BotsList: FC<BotsListProp> = ({ bots }) => {
  const history = useHistory();

  const handleTitleClick = (botsName: string) => {
    const botsPath = getBotsPath(botsName);

    history.push(botsPath);
  };

  const BotCard = ({ bot }: { bot: Bots }) => {
    return (
      <div className="tw-bg-white tw-shadow tw-border tw-border-main tw-rounded tw-p-3">
        <div className="tw-flex">
          <SVGIcons alt="bot-profile" icon={Icons.BOT_PROFILE} />
          <span
            className="tw-ml-2 tw-self-center tw-cursor-pointer hover:tw-underline"
            data-testid="bot-displayname"
            onClick={() => handleTitleClick(bot.name || '')}>
            {getEntityName(bot as unknown as EntityReference)}
          </span>
        </div>
        <div className="tw-mt-2">
          {bot.description ? (
            <RichTextEditorPreviewer markdown={bot.description || ''} />
          ) : (
            <span className="tw-no-description tw-p-2 tw--ml-1.5">
              No description{' '}
            </span>
          )}
        </div>
      </div>
    );
  };

  const getListComponent = () => {
    if (!bots.length) {
      return <ErrorPlaceHolder>No bots are available</ErrorPlaceHolder>;
    } else {
      return (
        <Fragment>
          <TitleBreadcrumb
            className="tw-mb-2"
            titleLinks={[
              {
                name: 'Bots',
                url: '',
                activeTitle: true,
              },
            ]}
          />
          <div className="tw-grid xxl:tw-grid-cols-4 lg:tw-grid-cols-3 md:tw-grid-cols-2 tw-gap-4">
            {bots.map((bot, key) => (
              <BotCard bot={bot} key={key} />
            ))}
          </div>
        </Fragment>
      );
    }
  };

  return (
    <PageLayout classes="tw-h-full tw-p-4">{getListComponent()}</PageLayout>
  );
};

export default BotsList;
