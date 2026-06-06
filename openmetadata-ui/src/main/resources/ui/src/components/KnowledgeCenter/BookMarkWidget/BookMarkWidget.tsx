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
import { Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, map } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { ReactComponent as BookMarkIcon } from '../../../assets/svg/ic-bookmark.svg';
import ExpandableCard from '../../../components/common/ExpandableCard/ExpandableCard';
import Loader from '../../../components/common/Loader/Loader';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';
import { getUserById } from '../../../rest/userAPI';
import { t } from '../../../utils/i18next/LocalUtil';
import { getLink } from '../../../utils/KnowledgePageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const BookMarkWidget = ({
  refresh,
  handleRefreshBookMarkWidget,
}: {
  refresh: boolean;
  handleRefreshBookMarkWidget: (value: boolean) => void;
}) => {
  const { currentUser } = useApplicationStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<KnowledgePage[]>([]);

  const fetchBookMarks = async () => {
    if (!currentUser?.id) {
      return;
    }

    try {
      const userData = await getUserById(currentUser?.id, {
        fields: TabSpecificField.FOLLOWS,
      });
      const bookmarkData = (userData.follows ?? []).filter(
        (reference) => reference.type === EntityType.KNOWLEDGE_PAGE
      );
      setData(bookmarkData as unknown as KnowledgePage[]);
    } catch (error) {
      setData([]);
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      handleRefreshBookMarkWidget(false);
    }
  };

  const header = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        <BookMarkIcon height={16} width={16} />
        <Typography className="text-sm font-medium">
          {t('label.bookmark-plural')}
        </Typography>
      </div>
    );
  }, [t]);

  useEffect(() => {
    fetchBookMarks();
  }, [currentUser]);

  useEffect(() => {
    if (refresh) {
      fetchBookMarks();
    }
  }, [refresh]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      isExpandDisabled={isEmpty(data)}>
      {isEmpty(data) ? (
        t('message.not-bookmark-anything')
      ) : (
        <Space direction="vertical" size={8}>
          {map(data, (instance) => getLink(instance, 'bookmarked'))}
        </Space>
      )}
    </ExpandableCard>
  );
};

export default BookMarkWidget;
