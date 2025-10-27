/*
 *  Copyright 2025 OpenMetadata
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

package org.openmetadata.service.exception;

/**
 * Exception thrown when ThirdEye service operations fail.
 * 
 * This exception wraps various types of failures that can occur
 * when communicating with the ThirdEye Python service.
 */
public class ThirdEyeServiceException extends RuntimeException {
  
  public ThirdEyeServiceException(String message) {
    super(message);
  }
  
  public ThirdEyeServiceException(String message, Throwable cause) {
    super(message, cause);
  }
  
  public ThirdEyeServiceException(Throwable cause) {
    super(cause);
  }
}
