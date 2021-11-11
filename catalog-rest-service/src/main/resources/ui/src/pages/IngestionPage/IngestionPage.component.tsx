import React, { useEffect, useState } from 'react';
import Ingestion from '../../components/Ingestion/Ingestion.component';
import Loader from '../../components/Loader/Loader';

const IngestionPage = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return <>{isLoading ? <Loader /> : <Ingestion />}</>;
};

export default IngestionPage;
