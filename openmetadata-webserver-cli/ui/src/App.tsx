import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import axios from 'axios';
import LandingPage from './pages/LandingPage.component';
import ServicesPage from './pages/ServicesPage';
import AddServicePage from './pages/AddServicePage.component';
import IngestionWorkflowForm from './components/Settings/Services/Ingestion/IngestionWorkflowForm/IngestionWorkflowForm';
import IngestionOptionsPage from './pages/IngestionOptionsPage';
import AddIngestionPage from './pages/AddIngestionPage.component';
import DownloadYAML from './pages/DownloadPage';

axios.defaults.baseURL = 'http://localhost:8001/';

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={LandingPage} exact />
        <Route path="/service" component={ServicesPage} />
        <Route path="/settings/services/databases" component={AddServicePage} />
        <Route path="/ingestion/:serviceCategory/:ingestionType" component={AddIngestionPage} />
        <Route path="/ingestion" component={IngestionOptionsPage} exact />
        <Route path="/download" component={DownloadYAML} exact />
      </Switch>
    </Router>
  );
}

export default App;