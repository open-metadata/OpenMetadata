import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import LandingPage from './pages/LandingPage.component';
import ServicesPage from './pages/ServicesPage';
import AddServicePage from './pages/AddServicePage.component';
import IngestionOptionsPage from './pages/IngestionOptionsPage';
import AddIngestionPage from './pages/AddIngestionPage.component';
import DownloadYAML from './pages/DownloadPage';
import AntDConfigProvider from './context/AntDConfigProvider/AntDConfigProvider';
import { LogsPage, LogsPageWrapper } from './pages/LogsPage';

function App() {
  return (
    <AntDConfigProvider>
      <Router>
        <Switch>
          <Route path="/" component={LandingPage} exact />
          <Route path="/service" component={ServicesPage} />
          <Route path="/settings/services/databases" component={AddServicePage} />
          <Route path="/ingestion/:serviceCategory/:ingestionType" component={AddIngestionPage} />
          <Route path="/ingestion" component={IngestionOptionsPage} exact />
          <Route path="/download" component={DownloadYAML} exact />
          <Route path="/logs/start" component={LogsPageWrapper} exact />
          <Route path="/logs" component={LogsPageWrapper} exact />
        </Switch>
      </Router>
    </AntDConfigProvider>
  );
}

export default App;