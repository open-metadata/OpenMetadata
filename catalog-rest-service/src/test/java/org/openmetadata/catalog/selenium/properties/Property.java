package org.openmetadata.catalog.selenium.properties;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.Properties;

public class Property {

    private static String PATH;
    private static Integer waitTime;
    private static String URL;
    private static final Object lock = new Object();
    private static Property instance;
    String pathToOpenMetadata = "pathToOpenMetadata";
    String openMetadataUrl = "openMetadataUrl";
    String openMetadataWaitTime = "waitTime";

    public static Property getInstance() {
        if (instance == null) {
            synchronized (lock) {
                instance = new Property();
                instance.loadData();
            }
        }
        return instance;
    }

    private void loadData() {
        Properties properties = new Properties();
        try {
            properties.load(new FileInputStream("selenium.properties"));
        } catch (IOException ignored) {
        }
        PATH = properties.getProperty(pathToOpenMetadata);
        URL = properties.getProperty(openMetadataUrl);
        waitTime = Integer.parseInt(properties.getProperty(openMetadataWaitTime));
    }

    public static String getPath() {
        return PATH;
    }

    public static String getURL() {
        return URL;
    }

    public static Integer getSleepTime() {
        return waitTime;
    }
}
