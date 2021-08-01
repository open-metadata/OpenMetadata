import React from 'react';
import { RedocStandalone } from 'redoc';

const SwaggerPage = () => {
  // return (<RedocStandalone
  //   specUrl="https://raw.githubusercontent.com/deuex-solutions/redoc/master/demo/petstore.json"
  // />);
  return (
    <RedocStandalone
      options={{ enableConsole: true }}
      specUrl="./swagger.json"
    />
  );
};

export default SwaggerPage;
