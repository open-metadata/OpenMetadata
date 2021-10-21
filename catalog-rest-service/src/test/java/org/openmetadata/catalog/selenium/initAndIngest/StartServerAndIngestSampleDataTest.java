package org.openmetadata.catalog.selenium.initAndIngest;

import org.openmetadata.catalog.selenium.properties.Property;
import org.testng.annotations.Test;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.logging.Logger;

public class StartServerAndIngestSampleDataTest {

    public static final String PATH = Property.getInstance().getPath();
    private static final Logger LOG = Logger.getLogger(StartServerAndIngestSampleDataTest.class.getName());

    // RUN THIS TEST FIRST

    @Test
    public void initAndIngest() throws IOException {
        String[] runScript = {"bash", "-c", "cd " + '"' + PATH + '"' + "&& ./catalog-rest-service/src/test/java/org/openmetadata/catalog/selenium/script/initAndIngest.sh"};
        Process processRunScript = Runtime.getRuntime().exec(runScript);
        BufferedReader output = new BufferedReader(new InputStreamReader(processRunScript.getInputStream()));
        String log;
        while ((log=output.readLine()) != null) {
            System.out.println(log);
        }
        LOG.info("Server started and Ingested the data");
    }
}
