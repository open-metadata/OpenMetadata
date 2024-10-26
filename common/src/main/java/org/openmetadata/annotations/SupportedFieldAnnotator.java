package org.openmetadata.annotations;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.codemodel.JAnnotationUse;
import com.sun.codemodel.JFieldVar;
import org.jsonschema2pojo.AbstractAnnotator;
import org.jsonschema2pojo.GenerationConfig;
import org.jsonschema2pojo.util.NameHelper;

public class SupportedFieldAnnotator extends AbstractAnnotator {

  public SupportedFieldAnnotator(GenerationConfig generationConfig) {
    super(generationConfig);
  }

  @Override
  public void propertyField(
      JFieldVar field,
      com.sun.codemodel.JDefinedClass clazz,
      String propertyName,
      JsonNode propertyNode) {

    super.propertyField(field, clazz, propertyName, propertyNode);

    JsonNode supportedFieldNode = propertyNode.get("javaAnnotation");
    if (supportedFieldNode != null) {
      String annotationText = supportedFieldNode.asText();
      String nameParam = propertyName;
      String fetchMethodParam = "fetchAndSet" + NameHelper.capitalize(propertyName);


      JAnnotationUse annotation = field.annotate(clazz.owner().ref("your.package.SupportedField"));
      annotation.param("name", nameParam);
      annotation.param("fetchMethod", fetchMethodParam);
    }
  }
}
