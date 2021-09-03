import React from 'react';
import SVGIcons from '../../../utils/SvgUtils';
import NonAdminAction from '../non-admin-action/NonAdminAction';
type Tab = {
  name: string;
  icon: {
    alt: string;
    name: string;
    title: string;
  };
  isProtected: boolean;
  protectedState?: boolean;
  position: number;
};
type Props = {
  activeTab: number;
  setActiveTab: (value: number) => void;
  tabs: Array<Tab>;
};
const TabsPane = ({ activeTab, setActiveTab, tabs }: Props) => {
  const getTabClasses = (tab: number, activeTab: number) => {
    return 'tw-gh-tabs' + (activeTab === tab ? ' active' : '');
  };

  return (
    <div className="tw-bg-transparent tw--mx-4">
      <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4">
        {tabs.map((tab) =>
          tab.isProtected ? (
            <NonAdminAction
              isOwner={tab.protectedState}
              key={tab.position}
              title="You need to be owner to perform this action">
              <button
                className={getTabClasses(tab.position, activeTab)}
                data-testid="tab"
                onClick={() => setActiveTab(tab.position)}>
                <SVGIcons
                  alt={tab.icon.alt}
                  icon={tab.icon.name}
                  title={tab.icon.title}
                />{' '}
                {tab.name}
              </button>
            </NonAdminAction>
          ) : (
            <button
              className={getTabClasses(tab.position, activeTab)}
              data-testid="tab"
              key={tab.position}
              onClick={() => setActiveTab(tab.position)}>
              <SVGIcons
                alt={tab.icon.alt}
                icon={tab.icon.name}
                title={tab.icon.title}
              />{' '}
              {tab.name}
            </button>
          )
        )}
      </nav>
    </div>
  );
};

export default TabsPane;
