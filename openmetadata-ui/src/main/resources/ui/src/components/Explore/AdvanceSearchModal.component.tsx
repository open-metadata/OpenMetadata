import { Modal } from 'antd';
import React, { FunctionComponent, useState } from 'react';
import { JsonTree } from 'react-awesome-query-builder';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../enums/search.enum';
import AdvancedSearch from '../AdvancedSearch/AdvancedSearch.component';

interface Props {
  visible: boolean;
  onSubmit: (filter?: Record<string, unknown>) => void;
  onCancel: () => void;
  searchIndex: SearchIndex;
  onChangeJsonTree: (tree: JsonTree) => void;
  jsonTree?: JsonTree;
}

export const AdvancedSearchModal: FunctionComponent<Props> = ({
  visible,
  onSubmit,
  onCancel,
  searchIndex,
  onChangeJsonTree,
  jsonTree,
}: Props) => {
  const [queryFilter, setQueryFilter] = useState<
    Record<string, unknown> | undefined
  >();

  const { t } = useTranslation();

  return (
    <Modal
      destroyOnClose
      okText={t('label.submit')}
      title={t('label.advanced-search')}
      visible={visible}
      width={950}
      onCancel={onCancel}
      onOk={() => {
        onSubmit(queryFilter);
        onCancel();
      }}>
      <AdvancedSearch
        jsonTree={jsonTree}
        searchIndex={searchIndex}
        onChangeJsonTree={(nTree) => onChangeJsonTree(nTree)}
        onChangeQueryFilter={setQueryFilter}
      />
    </Modal>
  );
};
