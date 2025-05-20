import React from 'react';
import { useTranslation } from 'react-i18next';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { useFqn } from '../../hooks/useFqn';
const TestCaseVersionPage = () => {
  const { t } = useTranslation();
  const { fqn: testCaseFQN } = useFqn();

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-version-detail-plural', {
        // entity: getEntityName(currentVersionData),
      })}>
      <div>TestCaseVersionPage</div>
    </PageLayoutV1>
  );
};

export default TestCaseVersionPage;
