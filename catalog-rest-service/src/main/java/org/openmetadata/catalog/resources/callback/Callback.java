/*
 *  Copyright 2021 Collate
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

package org.openmetadata.catalog.resources.callback;

import io.swagger.annotations.Api;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import org.openmetadata.catalog.resources.Collection;
import org.pac4j.jax.rs.annotations.Pac4JCallback;
import org.pac4j.jax.rs.annotations.Pac4JSecurity;

@Path("/v1/callback")
@Api(value = "Callback API for SSO")
@Collection(name = "callback")
@Pac4JSecurity(ignore = true)
public class Callback {
  @POST
  @Pac4JCallback(skipResponse = true, multiProfile = false, renewSession = false)
  public void callbackPost() {
    // nothing to do here, pac4j handles everything
    // note that in jax-rs, you can't have two different http method on the
    // same resource method hence the duplication
  }

  @GET
  @Pac4JCallback(skipResponse = true, multiProfile = false, renewSession = false)
  public void callbackGet() {
    // nothing to do here, pac4j handles everything
    // note that in jax-rs, you can't have two different http method on the
    // same resource method hence the duplication
  }
}
