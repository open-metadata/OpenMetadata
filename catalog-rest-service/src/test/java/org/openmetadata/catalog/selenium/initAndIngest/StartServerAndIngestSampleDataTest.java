/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.selenium.initAndIngest;

import org.testng.annotations.Test;

import java.io.File;
import java.io.IOException;
import java.util.logging.Logger;

public class StartServerAndIngestSampleDataTest {

    private static final Logger LOG = Logger.getLogger(StartServerAndIngestSampleDataTest.class.getName());

    // RUN THIS TEST FIRST

    @Test
    public void initAndIngestTest() throws IOException, InterruptedException {
        File scriptDir = new File("../bin/initAndIngest.sh");
        String absolutePath = scriptDir.getAbsolutePath();
        String[] runScript = {"sh", absolutePath};
        Process processRunScript = Runtime.getRuntime().exec(runScript);
        processRunScript.waitFor();
        LOG.info("Server started and Ingested the data");
    }
}
