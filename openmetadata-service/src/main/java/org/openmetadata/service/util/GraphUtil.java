package org.openmetadata.service.util;

import static com.googlecode.charts4j.Color.ALICEBLUE;
import static com.googlecode.charts4j.Color.BLUEVIOLET;
import static com.googlecode.charts4j.Color.GRAY;
import static com.googlecode.charts4j.Color.GREENYELLOW;
import static com.googlecode.charts4j.Color.LAVENDER;
import static com.googlecode.charts4j.Color.LIMEGREEN;
import static com.googlecode.charts4j.Color.MAGENTA;
import static com.googlecode.charts4j.Color.MEDIUMSPRINGGREEN;
import static com.googlecode.charts4j.Color.ORANGE;
import static com.googlecode.charts4j.Color.RED;

import com.googlecode.charts4j.AxisLabels;
import com.googlecode.charts4j.AxisLabelsFactory;
import com.googlecode.charts4j.AxisStyle;
import com.googlecode.charts4j.AxisTextAlignment;
import com.googlecode.charts4j.BarChart;
import com.googlecode.charts4j.BarChartPlot;
import com.googlecode.charts4j.Color;
import com.googlecode.charts4j.Data;
import com.googlecode.charts4j.Fill;
import com.googlecode.charts4j.Fills;
import com.googlecode.charts4j.GCharts;
import com.googlecode.charts4j.Plots;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithDescriptionByType;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithOwnerByType;

@Slf4j
public class GraphUtil {

  public static String buildDescriptionImageUrl(
      Map<String, List<PercentageOfEntitiesWithDescriptionByType>> data, List<String> entityTypes) {
    // Defining data plots.
    List<BarChartPlot> entitiesPlot = new ArrayList<>();
    List<String> dates = new ArrayList<>();
    for (String entityType : entityTypes) {
      List<Double> plotData = new ArrayList<>();
      for (Map.Entry<String, List<PercentageOfEntitiesWithDescriptionByType>> e : data.entrySet()) {
        if (!dates.contains(e.getKey())) {
          dates.add(e.getKey());
        }
        for (PercentageOfEntitiesWithDescriptionByType entity : e.getValue()) {
          if (entity.getEntityType().equals(entityType)) {
            plotData.add(entity.getCompletedDescriptionFraction() * 10);
          }
        }
      }
      BarChartPlot barChartPlot;
      switch (plotData.size()) {
        case 1:
          barChartPlot =
              Plots.newBarChartPlot(
                  Data.newData(
                      0.00001, 0.00001, 0.00001, 0.00001, plotData.get(0), 0.00001, 0.00001, 0.00001, 0.00001));
          break;
        case 2:
          barChartPlot =
              Plots.newBarChartPlot(
                  Data.newData(
                      0.00001, 0.00001, 0.00001, plotData.get(0), 0.00001, plotData.get(1), 0.00001, 0.00001, 0.00001));
          break;
        case 3:
          barChartPlot =
              Plots.newBarChartPlot(
                  Data.newData(
                      0.00001,
                      0.00001,
                      plotData.get(0),
                      0.00001,
                      plotData.get(1),
                      0.00001,
                      plotData.get(2),
                      0.00001,
                      0.00001));
          break;
        default:
          barChartPlot = Plots.newBarChartPlot(Data.newData(plotData));
      }
      barChartPlot.setLegend(entityType);
      barChartPlot.setColor(entityColor(entityType));
      entitiesPlot.add(barChartPlot);
    }
    // Instantiating chart./
    BarChart chart = GCharts.newBarChart(entitiesPlot);
    chart.setTitle("Total Percentage of Entities With Description");
    chartSettings(chart, dates);
    return chart.toURLString();
  }

  public static String buildOwnerImageUrl(
      Map<String, List<PercentageOfEntitiesWithOwnerByType>> data, List<String> entityTypes) {
    List<BarChartPlot> entitiesPlot = new ArrayList<>();
    List<String> dates = new ArrayList<>();
    for (String entityType : entityTypes) {
      List<Double> plotData = new ArrayList<>();
      for (Map.Entry<String, List<PercentageOfEntitiesWithOwnerByType>> e : data.entrySet()) {
        if (!dates.contains(e.getKey())) {
          dates.add(e.getKey());
        }
        for (PercentageOfEntitiesWithOwnerByType entity : e.getValue()) {
          if (entity.getEntityType().equals(entityType)) {
            plotData.add(entity.getHasOwnerFraction() * 10);
          }
        }
      }
      BarChartPlot barChartPlot = Plots.newBarChartPlot(Data.newData(plotData));
      barChartPlot.setLegend(entityType);
      barChartPlot.setColor(entityColor(entityType));
      entitiesPlot.add(barChartPlot);
    }
    // Instantiating chart./
    BarChart chart = GCharts.newBarChart(entitiesPlot);
    chart.setTitle("Total Percentage of Entities With Owner");
    chartSettings(chart, dates);
    return chart.toURLString();
  }

  private static void chartSettings(BarChart chart, List<String> dates) {
    // Defining axis info and styles
    AxisStyle axisStyle = AxisStyle.newAxisStyle(Color.BLACK, 13, AxisTextAlignment.CENTER);
    AxisLabels score = AxisLabelsFactory.newAxisLabels("Total %", 50.0);
    score.setAxisStyle(axisStyle);
    AxisLabels year = AxisLabelsFactory.newAxisLabels("Date", 50.0);
    year.setAxisStyle(axisStyle);
    // Adding axis info to chart.
    switch (dates.size()) {
      case 1:
        chart.addXAxisLabels(AxisLabelsFactory.newAxisLabels("", "", "", "", dates.get(0), "", "", "", ""));
        break;
      case 2:
        chart.addXAxisLabels(AxisLabelsFactory.newAxisLabels("", "", "", dates.get(0), "", dates.get(1), "", "", ""));
        break;
      case 3:
        chart.addXAxisLabels(
            AxisLabelsFactory.newAxisLabels("", "", dates.get(0), "", dates.get(1), "", dates.get(2), "", ""));
        break;
      default:
        chart.addXAxisLabels(AxisLabelsFactory.newAxisLabels(dates));
        break;
    }
    chart.addYAxisLabels(AxisLabelsFactory.newNumericRangeAxisLabels(0, 1000));

    chart.addYAxisLabels(score);
    chart.addXAxisLabels(year);

    chart.setSize(600, 500);
    chart.setBarWidth(20);
    chart.setSpaceWithinGroupsOfBars(20);
    chart.setDataStacked(true);

    chart.setBackgroundFill(Fills.newSolidFill(ALICEBLUE));
    Fill fill = Fills.newSolidFill(LAVENDER);
    chart.setAreaFill(fill);
  }

  private static Color entityColor(String entityType) {
    Map<String, Color> entityColorMap = new HashMap<>();
    entityColorMap.put("Chart", RED);
    entityColorMap.put("Dashboard", BLUEVIOLET);
    entityColorMap.put("Database", GREENYELLOW);
    entityColorMap.put("DatabaseSchema", MEDIUMSPRINGGREEN);
    entityColorMap.put("MlModel", MAGENTA);
    entityColorMap.put("Pipeline", GRAY);
    entityColorMap.put("Table", LIMEGREEN);
    entityColorMap.put("Topic", ORANGE);
    return entityColorMap.get(entityType);
  }
}
