package org.openmetadata.service.util.incidentSeverityClassifier;

import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.type.TagLabel;

@Slf4j
public class LogisticRegressionIncidentSeverityClassifier
    extends IncidentSeverityClassifierInterface {
  // coef. matrix represents the weights of the logistic regression model. It has shape
  // (n_feature, n_class) where n_features are respectively:
  //      - row 0: 'Tier' (1, 2, 3, 4, 5) for an asset
  //      - row 1: 'HasOwner' 1 if the asset has an owner, 0 otherwise
  //      - row 2: 'Followers' number of followers of the asset
  //      - row 3: 'Votes' number of + votes of the asset.
  // Coef. matrix was generated using synthetic data.
  static final double[][] coefMatrix = {
    new double[] {-39.7199427, -3.16664212, 7.52955733, 16.7600252, 18.5970022},
    new double[] {65.6563864, 9.33015912, -3.11353307, -13.7841793, -58.0888332},
    new double[] {0.0102508192, 0.00490356651, -0.00162766138, -0.00622724217, -0.0072994822},
    new double[] {0.0784018717, -0.01140259, -0.00911123152, -0.0237962385, -0.0340918118},
  };

  @Override
  public Severity classifyIncidentSeverity(EntityInterface entity) {
    double[] vectorX = getVectorX(entity);
    if (vectorX.length == 0) {
      return null;
    }
    try {
      double[] vectorZ = dotProduct(vectorX);
      double[] softmaxVector = softmax(vectorZ);
      int predictedClass = argmax(softmaxVector);
      switch (predictedClass) {
        case 0:
          return Severity.Severity1;
        case 1:
          return Severity.Severity2;
        case 2:
          return Severity.Severity3;
        case 3:
          return Severity.Severity4;
        case 4:
          return Severity.Severity5;
      }
    } catch (Exception e) {
      LOG.error("Error occurred while classifying incident severity", e);
    }
    return null;
  }

  private double[] dotProduct(double[] vectorX) {
    // compute the dot product of the input vector and the coef. matrix
    double[] result = new double[coefMatrix[0].length];
    for (int i = 0; i < coefMatrix.length; i++) {
      int sum = 0;
      for (int j = 0; j < vectorX.length; j++) {
        sum += vectorX[j] * coefMatrix[j][i];
      }
      result[i] = sum;
    }
    return result;
  }

  private double[] softmax(double[] vectorZ) {
    // compute the softmax of the z vector
    double expSum = Arrays.stream(vectorZ).map(Math::exp).sum();
    double[] softmax = new double[vectorZ.length];
    for (int i = 0; i < vectorZ.length; i++) {
      softmax[i] = Math.exp(vectorZ[i]) / expSum;
    }
    return softmax;
  }

  private int argmax(double[] softmaxVector) {
    // return the index of the max value in the softmax vector
    // (i.e. the predicted class)
    int maxIndex = 0;
    double argmax = 0;

    for (int i = 0; i < softmaxVector.length; i++) {
      if (softmaxVector[i] > argmax) {
        argmax = softmaxVector[i];
        maxIndex = i;
      }
    }
    return maxIndex;
  }

  private double[] getVectorX(EntityInterface entity) {
    // get the input vector for the logistic regression model
    double hasOwner = entity.getOwner() != null ? 1 : 0;
    double followers = entity.getFollowers() != null ? entity.getFollowers().size() : 0;
    double votes = entity.getVotes() != null ? entity.getVotes().getUpVotes() : 0;
    double tier = entity.getTags() != null ? getTier(entity.getTags()) : 0;
    if (tier == 0) {
      // if we don't have a tier set we can't run the classifier
      return new double[] {};
    }
    return new double[] {tier, hasOwner, followers, votes};
  }

  private double getTier(List<TagLabel> tags) {
    // get the tier of the asset

    for (TagLabel tag : tags) {
      if (tag.getName().contains("Tier")) {
        switch (tag.getName()) {
          case "Tier1":
            return 1;
          case "Tier2":
            return 2;
          case "Tier3":
            return 3;
          case "Tier4":
            return 4;
          case "Tier5":
            return 5;
        }
      }
    }
    return 0;
  }
}
