/*
 *  Copyright 2022 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jobs.reindexing;

import static org.openmetadata.schema.api.CreateEventPublisherJob.PublisherType.ELASTIC_SEARCH;

import java.io.IOException;
import java.lang.annotation.Annotation;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.CreateEventPublisherJob;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.service.resources.Reindex;
import org.openmetadata.service.util.ReIndexingHandler;

@Reindex
@Slf4j
public class ReindexingEvent implements ContainerResponseFilter {
  @Override
  public void filter(ContainerRequestContext containerRequestContext, ContainerResponseContext containerResponseContext)
      throws IOException {
    Reindex annotationFromResource = null;
    Annotation[] annotations = containerResponseContext.getEntityAnnotations();
    for (Annotation an : annotations) {
      if (an instanceof Reindex) {
        annotationFromResource = (Reindex) an;
        break;
      }
    }
    if (annotationFromResource != null && !CommonUtil.nullOrEmpty(annotationFromResource.entities())) {
      String jobName = annotationFromResource.jobName();
      Set<String> entityList = new HashSet<>(Arrays.asList(annotationFromResource.entities().split(",")));
      CreateEventPublisherJob jobRequest =
          new CreateEventPublisherJob()
              .withName(jobName)
              .withEntities(entityList)
              .withBatchSize(annotationFromResource.batchSize())
              .withRecreateIndex(annotationFromResource.recreateIndex())
              .withPublisherType(ELASTIC_SEARCH)
              .withRunMode(CreateEventPublisherJob.RunMode.BATCH)
              .withSearchIndexMappingLanguage(IndexMappingLanguage.EN);
      // TODO: Once automation bots are in place update here
      ReIndexingHandler.getInstance().createReindexingJob("system", jobRequest);
    } else {
      LOG.error("[ReindexAutomation] Reindexing invoked but with wrong info : {}", annotationFromResource);
    }
  }
}
