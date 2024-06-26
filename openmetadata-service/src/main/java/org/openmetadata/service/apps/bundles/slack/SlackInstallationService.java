package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.bolt.Initializer;
import com.slack.api.bolt.model.Bot;
import com.slack.api.bolt.model.Installer;
import com.slack.api.bolt.service.InstallationService;

public class SlackInstallationService implements InstallationService {

    @Override
    public boolean isHistoricalDataEnabled() {
        return false;
    }

    @Override
    public void setHistoricalDataEnabled(boolean b) {

    }

    @Override
    public void saveInstallerAndBot(Installer installer) throws Exception {

    }

    @Override
    public void deleteBot(Bot bot) throws Exception {

    }

    @Override
    public void deleteInstaller(Installer installer) throws Exception {

    }

    @Override
    public Bot findBot(String s, String s1) {
        return null;
    }

    @Override
    public Installer findInstaller(String s, String s1, String s2) {
        return null;
    }

    @Override
    public Initializer initializer() {
        return InstallationService.super.initializer();
    }
}
