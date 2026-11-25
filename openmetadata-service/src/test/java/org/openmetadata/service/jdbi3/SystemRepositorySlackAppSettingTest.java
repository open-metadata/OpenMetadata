package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.slackApp.SlackAppConfiguration;
import org.openmetadata.schema.utils.JsonUtils;

class SystemRepositorySlackAppSettingTest {

  @Test
  void storedSlackAppSettingKeepsItsSocketModeConnection() {
    SlackAppConfiguration submitted =
        JsonUtils.readValue(
            """
            {
              "clientId": "client",
              "clientSecret": "secret",
              "signingSecret": "signing",
              "connectionMode": "SocketMode",
              "appToken": "xapp-1-token"
            }
            """,
            SlackAppConfiguration.class);

    SlackAppConfiguration loaded =
        SystemRepository.decryptSlackAppSetting(SystemRepository.encryptSlackAppSetting(submitted));

    assertEquals("SocketMode", loaded.getConnectionMode().value());
    assertEquals("xapp-1-token", loaded.getAppToken());
  }

  @Test
  void slackAppSettingWithoutAConnectionModeUsesWebhook() {
    SlackAppConfiguration loaded =
        SystemRepository.decryptSlackAppSetting(
            "{\"clientId\":\"client\",\"clientSecret\":\"secret\",\"signingSecret\":\"signing\"}");

    assertEquals("Webhook", loaded.getConnectionMode().value());
  }
}
