import classNames from 'classnames';
import { isNil } from 'lodash';
import React, { FunctionComponent } from 'react';
import { useHistory } from 'react-router-dom';
import { ROUTES, TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { useAuth } from '../../hooks/authHooks';
import { Button } from '../buttons/Button/Button';
import GlossaryDataCard from '../common/glossary-data-card/GlossaryDataCard';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PageLayout from '../containers/PageLayout';
import { GlossaryProps } from './Glossary.interface';

const Glossary: FunctionComponent<GlossaryProps> = ({
  data = [],
  paging,
  onPageChange,
}: GlossaryProps) => {
  const { isAuthDisabled, isAdminUser } = useAuth();
  const history = useHistory();

  const onAddGlossary = () => {
    history.push(ROUTES.ADD_GLOSSARY);
  };

  const fetchLeftPanel = () => {
    return (
      <>
        <h6 className="tw-heading tw-text-base">Glossary</h6>
      </>
    );
  };

  const fetchRightPanel = () => {
    return (
      <>
        <div className="tw-mb-5 tw-mt-11">
          Lorem ipsum dolor, sit amet consectetur adipisicing elit. Illo,
          necessitatibus modi. Itaque ipsam animi id aperiam, esse saepe
          reiciendis tempora at aliquam dicta nihil est.
        </div>
        {/* {getDocButton('Webhooks Guide', '', 'webhook-doc')} */}
      </>
    );
  };

  return (
    <PageLayout leftPanel={fetchLeftPanel()} rightPanel={fetchRightPanel()}>
      <div>
        <div className="tw-flex tw-justify-end tw-items-center">
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-8 tw-rounded tw-mb-3', {
                'tw-opacity-40': !isAdminUser && !isAuthDisabled,
              })}
              data-testid="add-glossary-button"
              size="small"
              theme="primary"
              variant="contained"
              onClick={onAddGlossary}>
              Add Glossary
            </Button>
          </NonAdminAction>
        </div>
        {data.map((glossary, index) => (
          <div className="tw-mb-3" key={index}>
            <GlossaryDataCard
              description={glossary.description}
              name={glossary.name}
              owner={glossary.owner?.displayName || glossary.owner?.name}
            />
          </div>
        ))}
        {Boolean(!isNil(paging.after) || !isNil(paging.before)) && (
          <NextPrevious paging={paging} pagingHandler={onPageChange} />
        )}
      </div>
    </PageLayout>
  );
};

export default Glossary;
