import { Avatar } from 'antd';
import React, { useEffect, useState } from 'react';

const AppLogo = ({
  logo,
  appName,
}: {
  logo?: JSX.Element;
  appName: string;
}) => {
  const [appLogo, setAppLogo] = useState<JSX.Element | null>(null);

  useEffect(() => {
    if (!logo) {
      import(`../../../assets/svg/${appName}.svg`).then((data) => {
        const Icon = data.ReactComponent as React.ComponentType<
          JSX.IntrinsicElements['svg']
        >;
        setAppLogo(<Icon width={60} height={60} />);
      });
    } else {
      setAppLogo(logo);
    }
  }, [appName, logo]);

  return (
    <Avatar className="flex-center bg-white border" size={100} icon={appLogo} />
  );
};

export default AppLogo;
