/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
$(document).ready(function() {

    $(".click-title").mouseenter( function(    e){
        e.preventDefault();
        this.style.cursor="pointer";
    });
    $(".click-title").mousedown( function(event){
        event.preventDefault();
    });

    // Ugly code while this script is shared among several pages
    try{
        refreshHitsPerSecond(true);
    } catch(e){}
    try{
        refreshResponseTimeOverTime(true);
    } catch(e){}
    try{
        refreshResponseTimePercentiles();
    } catch(e){}
    $(".portlet-header").css("cursor", "auto");
});

var percentileThreshold = 0;
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

// Fixes time stamps
function fixTimeStamps(series, offset){
    $.each(series, function(index, item) {
        $.each(item.data, function(index, coord) {
            coord[0] += offset;
        });
    });
}

// Check if the specified jquery object is a graph
function isGraph(object){
    return object.data('plot') !== undefined;
}

/**
 * Export graph to a PNG
 */
function exportToPNG(graphName, target) {
    var plot = $("#"+graphName).data('plot');
    var flotCanvas = plot.getCanvas();
    var image = flotCanvas.toDataURL();
    image = image.replace("image/png", "image/octet-stream");
    
    var downloadAttrSupported = ("download" in document.createElement("a"));
    if(downloadAttrSupported === true) {
        target.download = graphName + ".png";
        target.href = image;
    }
    else {
        document.location.href = image;
    }
    
}

// Override the specified graph options to fit the requirements of an overview
function prepareOverviewOptions(graphOptions){
    var overviewOptions = {
        series: {
            shadowSize: 0,
            lines: {
                lineWidth: 1
            },
            points: {
                // Show points on overview only when linked graph does not show
                // lines
                show: getProperty('series.lines.show', graphOptions) == false,
                radius : 1
            }
        },
        xaxis: {
            ticks: 2,
            axisLabel: null
        },
        yaxis: {
            ticks: 2,
            axisLabel: null
        },
        legend: {
            show: false,
            container: null
        },
        grid: {
            hoverable: false
        },
        tooltip: false
    };
    return $.extend(true, {}, graphOptions, overviewOptions);
}

// Force axes boundaries using graph extra options
function prepareOptions(options, data) {
    options.canvas = true;
    var extraOptions = data.extraOptions;
    if(extraOptions !== undefined){
        var xOffset = options.xaxis.mode === "time" ? 19800000 : 0;
        var yOffset = options.yaxis.mode === "time" ? 19800000 : 0;

        if(!isNaN(extraOptions.minX))
        	options.xaxis.min = parseFloat(extraOptions.minX) + xOffset;
        
        if(!isNaN(extraOptions.maxX))
        	options.xaxis.max = parseFloat(extraOptions.maxX) + xOffset;
        
        if(!isNaN(extraOptions.minY))
        	options.yaxis.min = parseFloat(extraOptions.minY) + yOffset;
        
        if(!isNaN(extraOptions.maxY))
        	options.yaxis.max = parseFloat(extraOptions.maxY) + yOffset;
    }
}

// Filter, mark series and sort data
function prepareSeries(data){
    var result = data.result;

    // Keep only series when needed
    if(seriesFilter && (!filtersOnlySampleSeries || result.supportsControllersDiscrimination)){
        // Insensitive case matching
        var regexp = new RegExp(seriesFilter, 'i');
        result.series = $.grep(result.series, function(series, index){
            return regexp.test(series.label);
        });
    }

    // Keep only controllers series when supported and needed
    if(result.supportsControllersDiscrimination && showControllersOnly){
        result.series = $.grep(result.series, function(series, index){
            return series.isController;
        });
    }

    // Sort data and mark series
    $.each(result.series, function(index, series) {
        series.data.sort(compareByXCoordinate);
        series.color = index;
    });
}

// Set the zoom on the specified plot object
function zoomPlot(plot, xmin, xmax, ymin, ymax){
    var axes = plot.getAxes();
    // Override axes min and max options
    $.extend(true, axes, {
        xaxis: {
            options : { min: xmin, max: xmax }
        },
        yaxis: {
            options : { min: ymin, max: ymax }
        }
    });

    // Redraw the plot
    plot.setupGrid();
    plot.draw();
}

// Prepares DOM items to add zoom function on the specified graph
function setGraphZoomable(graphSelector, overviewSelector){
    var graph = $(graphSelector);
    var overview = $(overviewSelector);

    // Ignore mouse down event
    graph.bind("mousedown", function() { return false; });
    overview.bind("mousedown", function() { return false; });

    // Zoom on selection
    graph.bind("plotselected", function (event, ranges) {
        // clamp the zooming to prevent infinite zoom
        if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
            ranges.xaxis.to = ranges.xaxis.from + 0.00001;
        }
        if (ranges.yaxis.to - ranges.yaxis.from < 0.00001) {
            ranges.yaxis.to = ranges.yaxis.from + 0.00001;
        }

        // Do the zooming
        var plot = graph.data('plot');
        zoomPlot(plot, ranges.xaxis.from, ranges.xaxis.to, ranges.yaxis.from, ranges.yaxis.to);
        plot.clearSelection();

        // Synchronize overview selection
        overview.data('plot').setSelection(ranges, true);
    });

    // Zoom linked graph on overview selection
    overview.bind("plotselected", function (event, ranges) {
        graph.data('plot').setSelection(ranges);
    });

    // Reset linked graph zoom when reseting overview selection
    overview.bind("plotunselected", function () {
        var overviewAxes = overview.data('plot').getAxes();
        zoomPlot(graph.data('plot'), overviewAxes.xaxis.min, overviewAxes.xaxis.max, overviewAxes.yaxis.min, overviewAxes.yaxis.max);
    });
}

var responseTimePercentilesInfos = {
        data: {"result": {"minY": 308.0, "minX": 0.0, "maxY": 788.0, "series": [{"data": [[0.0, 308.0], [0.1, 308.0], [0.2, 308.0], [0.3, 308.0], [0.4, 308.0], [0.5, 308.0], [0.6, 308.0], [0.7, 308.0], [0.8, 308.0], [0.9, 308.0], [1.0, 308.0], [1.1, 308.0], [1.2, 308.0], [1.3, 308.0], [1.4, 308.0], [1.5, 308.0], [1.6, 308.0], [1.7, 308.0], [1.8, 308.0], [1.9, 308.0], [2.0, 308.0], [2.1, 308.0], [2.2, 308.0], [2.3, 308.0], [2.4, 308.0], [2.5, 308.0], [2.6, 308.0], [2.7, 308.0], [2.8, 308.0], [2.9, 308.0], [3.0, 308.0], [3.1, 308.0], [3.2, 308.0], [3.3, 308.0], [3.4, 308.0], [3.5, 308.0], [3.6, 308.0], [3.7, 308.0], [3.8, 308.0], [3.9, 308.0], [4.0, 308.0], [4.1, 308.0], [4.2, 308.0], [4.3, 308.0], [4.4, 308.0], [4.5, 308.0], [4.6, 308.0], [4.7, 308.0], [4.8, 308.0], [4.9, 308.0], [5.0, 308.0], [5.1, 308.0], [5.2, 308.0], [5.3, 308.0], [5.4, 308.0], [5.5, 308.0], [5.6, 308.0], [5.7, 308.0], [5.8, 308.0], [5.9, 308.0], [6.0, 308.0], [6.1, 308.0], [6.2, 308.0], [6.3, 308.0], [6.4, 308.0], [6.5, 308.0], [6.6, 308.0], [6.7, 308.0], [6.8, 308.0], [6.9, 308.0], [7.0, 308.0], [7.1, 308.0], [7.2, 308.0], [7.3, 308.0], [7.4, 308.0], [7.5, 308.0], [7.6, 308.0], [7.7, 308.0], [7.8, 308.0], [7.9, 308.0], [8.0, 308.0], [8.1, 308.0], [8.2, 308.0], [8.3, 308.0], [8.4, 308.0], [8.5, 308.0], [8.6, 308.0], [8.7, 308.0], [8.8, 308.0], [8.9, 308.0], [9.0, 308.0], [9.1, 308.0], [9.2, 308.0], [9.3, 308.0], [9.4, 308.0], [9.5, 308.0], [9.6, 308.0], [9.7, 308.0], [9.8, 308.0], [9.9, 308.0], [10.0, 312.0], [10.1, 312.0], [10.2, 312.0], [10.3, 312.0], [10.4, 312.0], [10.5, 312.0], [10.6, 312.0], [10.7, 312.0], [10.8, 312.0], [10.9, 312.0], [11.0, 312.0], [11.1, 312.0], [11.2, 312.0], [11.3, 312.0], [11.4, 312.0], [11.5, 312.0], [11.6, 312.0], [11.7, 312.0], [11.8, 312.0], [11.9, 312.0], [12.0, 312.0], [12.1, 312.0], [12.2, 312.0], [12.3, 312.0], [12.4, 312.0], [12.5, 312.0], [12.6, 312.0], [12.7, 312.0], [12.8, 312.0], [12.9, 312.0], [13.0, 312.0], [13.1, 312.0], [13.2, 312.0], [13.3, 312.0], [13.4, 312.0], [13.5, 312.0], [13.6, 312.0], [13.7, 312.0], [13.8, 312.0], [13.9, 312.0], [14.0, 312.0], [14.1, 312.0], [14.2, 312.0], [14.3, 312.0], [14.4, 312.0], [14.5, 312.0], [14.6, 312.0], [14.7, 312.0], [14.8, 312.0], [14.9, 312.0], [15.0, 312.0], [15.1, 312.0], [15.2, 312.0], [15.3, 312.0], [15.4, 312.0], [15.5, 312.0], [15.6, 312.0], [15.7, 312.0], [15.8, 312.0], [15.9, 312.0], [16.0, 312.0], [16.1, 312.0], [16.2, 312.0], [16.3, 312.0], [16.4, 312.0], [16.5, 312.0], [16.6, 312.0], [16.7, 312.0], [16.8, 312.0], [16.9, 312.0], [17.0, 312.0], [17.1, 312.0], [17.2, 312.0], [17.3, 312.0], [17.4, 312.0], [17.5, 312.0], [17.6, 312.0], [17.7, 312.0], [17.8, 312.0], [17.9, 312.0], [18.0, 312.0], [18.1, 312.0], [18.2, 312.0], [18.3, 312.0], [18.4, 312.0], [18.5, 312.0], [18.6, 312.0], [18.7, 312.0], [18.8, 312.0], [18.9, 312.0], [19.0, 312.0], [19.1, 312.0], [19.2, 312.0], [19.3, 312.0], [19.4, 312.0], [19.5, 312.0], [19.6, 312.0], [19.7, 312.0], [19.8, 312.0], [19.9, 312.0], [20.0, 312.0], [20.1, 312.0], [20.2, 312.0], [20.3, 312.0], [20.4, 312.0], [20.5, 312.0], [20.6, 312.0], [20.7, 312.0], [20.8, 312.0], [20.9, 312.0], [21.0, 312.0], [21.1, 312.0], [21.2, 312.0], [21.3, 312.0], [21.4, 312.0], [21.5, 312.0], [21.6, 312.0], [21.7, 312.0], [21.8, 312.0], [21.9, 312.0], [22.0, 312.0], [22.1, 312.0], [22.2, 312.0], [22.3, 312.0], [22.4, 312.0], [22.5, 312.0], [22.6, 312.0], [22.7, 312.0], [22.8, 312.0], [22.9, 312.0], [23.0, 312.0], [23.1, 312.0], [23.2, 312.0], [23.3, 312.0], [23.4, 312.0], [23.5, 312.0], [23.6, 312.0], [23.7, 312.0], [23.8, 312.0], [23.9, 312.0], [24.0, 312.0], [24.1, 312.0], [24.2, 312.0], [24.3, 312.0], [24.4, 312.0], [24.5, 312.0], [24.6, 312.0], [24.7, 312.0], [24.8, 312.0], [24.9, 312.0], [25.0, 312.0], [25.1, 312.0], [25.2, 312.0], [25.3, 312.0], [25.4, 312.0], [25.5, 312.0], [25.6, 312.0], [25.7, 312.0], [25.8, 312.0], [25.9, 312.0], [26.0, 312.0], [26.1, 312.0], [26.2, 312.0], [26.3, 312.0], [26.4, 312.0], [26.5, 312.0], [26.6, 312.0], [26.7, 312.0], [26.8, 312.0], [26.9, 312.0], [27.0, 312.0], [27.1, 312.0], [27.2, 312.0], [27.3, 312.0], [27.4, 312.0], [27.5, 312.0], [27.6, 312.0], [27.7, 312.0], [27.8, 312.0], [27.9, 312.0], [28.0, 312.0], [28.1, 312.0], [28.2, 312.0], [28.3, 312.0], [28.4, 312.0], [28.5, 312.0], [28.6, 312.0], [28.7, 312.0], [28.8, 312.0], [28.9, 312.0], [29.0, 312.0], [29.1, 312.0], [29.2, 312.0], [29.3, 312.0], [29.4, 312.0], [29.5, 312.0], [29.6, 312.0], [29.7, 312.0], [29.8, 312.0], [29.9, 312.0], [30.0, 332.0], [30.1, 332.0], [30.2, 332.0], [30.3, 332.0], [30.4, 332.0], [30.5, 332.0], [30.6, 332.0], [30.7, 332.0], [30.8, 332.0], [30.9, 332.0], [31.0, 332.0], [31.1, 332.0], [31.2, 332.0], [31.3, 332.0], [31.4, 332.0], [31.5, 332.0], [31.6, 332.0], [31.7, 332.0], [31.8, 332.0], [31.9, 332.0], [32.0, 332.0], [32.1, 332.0], [32.2, 332.0], [32.3, 332.0], [32.4, 332.0], [32.5, 332.0], [32.6, 332.0], [32.7, 332.0], [32.8, 332.0], [32.9, 332.0], [33.0, 332.0], [33.1, 332.0], [33.2, 332.0], [33.3, 332.0], [33.4, 332.0], [33.5, 332.0], [33.6, 332.0], [33.7, 332.0], [33.8, 332.0], [33.9, 332.0], [34.0, 332.0], [34.1, 332.0], [34.2, 332.0], [34.3, 332.0], [34.4, 332.0], [34.5, 332.0], [34.6, 332.0], [34.7, 332.0], [34.8, 332.0], [34.9, 332.0], [35.0, 332.0], [35.1, 332.0], [35.2, 332.0], [35.3, 332.0], [35.4, 332.0], [35.5, 332.0], [35.6, 332.0], [35.7, 332.0], [35.8, 332.0], [35.9, 332.0], [36.0, 332.0], [36.1, 332.0], [36.2, 332.0], [36.3, 332.0], [36.4, 332.0], [36.5, 332.0], [36.6, 332.0], [36.7, 332.0], [36.8, 332.0], [36.9, 332.0], [37.0, 332.0], [37.1, 332.0], [37.2, 332.0], [37.3, 332.0], [37.4, 332.0], [37.5, 332.0], [37.6, 332.0], [37.7, 332.0], [37.8, 332.0], [37.9, 332.0], [38.0, 332.0], [38.1, 332.0], [38.2, 332.0], [38.3, 332.0], [38.4, 332.0], [38.5, 332.0], [38.6, 332.0], [38.7, 332.0], [38.8, 332.0], [38.9, 332.0], [39.0, 332.0], [39.1, 332.0], [39.2, 332.0], [39.3, 332.0], [39.4, 332.0], [39.5, 332.0], [39.6, 332.0], [39.7, 332.0], [39.8, 332.0], [39.9, 332.0], [40.0, 356.0], [40.1, 356.0], [40.2, 356.0], [40.3, 356.0], [40.4, 356.0], [40.5, 356.0], [40.6, 356.0], [40.7, 356.0], [40.8, 356.0], [40.9, 356.0], [41.0, 356.0], [41.1, 356.0], [41.2, 356.0], [41.3, 356.0], [41.4, 356.0], [41.5, 356.0], [41.6, 356.0], [41.7, 356.0], [41.8, 356.0], [41.9, 356.0], [42.0, 356.0], [42.1, 356.0], [42.2, 356.0], [42.3, 356.0], [42.4, 356.0], [42.5, 356.0], [42.6, 356.0], [42.7, 356.0], [42.8, 356.0], [42.9, 356.0], [43.0, 356.0], [43.1, 356.0], [43.2, 356.0], [43.3, 356.0], [43.4, 356.0], [43.5, 356.0], [43.6, 356.0], [43.7, 356.0], [43.8, 356.0], [43.9, 356.0], [44.0, 356.0], [44.1, 356.0], [44.2, 356.0], [44.3, 356.0], [44.4, 356.0], [44.5, 356.0], [44.6, 356.0], [44.7, 356.0], [44.8, 356.0], [44.9, 356.0], [45.0, 356.0], [45.1, 356.0], [45.2, 356.0], [45.3, 356.0], [45.4, 356.0], [45.5, 356.0], [45.6, 356.0], [45.7, 356.0], [45.8, 356.0], [45.9, 356.0], [46.0, 356.0], [46.1, 356.0], [46.2, 356.0], [46.3, 356.0], [46.4, 356.0], [46.5, 356.0], [46.6, 356.0], [46.7, 356.0], [46.8, 356.0], [46.9, 356.0], [47.0, 356.0], [47.1, 356.0], [47.2, 356.0], [47.3, 356.0], [47.4, 356.0], [47.5, 356.0], [47.6, 356.0], [47.7, 356.0], [47.8, 356.0], [47.9, 356.0], [48.0, 356.0], [48.1, 356.0], [48.2, 356.0], [48.3, 356.0], [48.4, 356.0], [48.5, 356.0], [48.6, 356.0], [48.7, 356.0], [48.8, 356.0], [48.9, 356.0], [49.0, 356.0], [49.1, 356.0], [49.2, 356.0], [49.3, 356.0], [49.4, 356.0], [49.5, 356.0], [49.6, 356.0], [49.7, 356.0], [49.8, 356.0], [49.9, 356.0], [50.0, 387.0], [50.1, 387.0], [50.2, 387.0], [50.3, 387.0], [50.4, 387.0], [50.5, 387.0], [50.6, 387.0], [50.7, 387.0], [50.8, 387.0], [50.9, 387.0], [51.0, 387.0], [51.1, 387.0], [51.2, 387.0], [51.3, 387.0], [51.4, 387.0], [51.5, 387.0], [51.6, 387.0], [51.7, 387.0], [51.8, 387.0], [51.9, 387.0], [52.0, 387.0], [52.1, 387.0], [52.2, 387.0], [52.3, 387.0], [52.4, 387.0], [52.5, 387.0], [52.6, 387.0], [52.7, 387.0], [52.8, 387.0], [52.9, 387.0], [53.0, 387.0], [53.1, 387.0], [53.2, 387.0], [53.3, 387.0], [53.4, 387.0], [53.5, 387.0], [53.6, 387.0], [53.7, 387.0], [53.8, 387.0], [53.9, 387.0], [54.0, 387.0], [54.1, 387.0], [54.2, 387.0], [54.3, 387.0], [54.4, 387.0], [54.5, 387.0], [54.6, 387.0], [54.7, 387.0], [54.8, 387.0], [54.9, 387.0], [55.0, 387.0], [55.1, 387.0], [55.2, 387.0], [55.3, 387.0], [55.4, 387.0], [55.5, 387.0], [55.6, 387.0], [55.7, 387.0], [55.8, 387.0], [55.9, 387.0], [56.0, 387.0], [56.1, 387.0], [56.2, 387.0], [56.3, 387.0], [56.4, 387.0], [56.5, 387.0], [56.6, 387.0], [56.7, 387.0], [56.8, 387.0], [56.9, 387.0], [57.0, 387.0], [57.1, 387.0], [57.2, 387.0], [57.3, 387.0], [57.4, 387.0], [57.5, 387.0], [57.6, 387.0], [57.7, 387.0], [57.8, 387.0], [57.9, 387.0], [58.0, 387.0], [58.1, 387.0], [58.2, 387.0], [58.3, 387.0], [58.4, 387.0], [58.5, 387.0], [58.6, 387.0], [58.7, 387.0], [58.8, 387.0], [58.9, 387.0], [59.0, 387.0], [59.1, 387.0], [59.2, 387.0], [59.3, 387.0], [59.4, 387.0], [59.5, 387.0], [59.6, 387.0], [59.7, 387.0], [59.8, 387.0], [59.9, 387.0], [60.0, 416.0], [60.1, 416.0], [60.2, 416.0], [60.3, 416.0], [60.4, 416.0], [60.5, 416.0], [60.6, 416.0], [60.7, 416.0], [60.8, 416.0], [60.9, 416.0], [61.0, 416.0], [61.1, 416.0], [61.2, 416.0], [61.3, 416.0], [61.4, 416.0], [61.5, 416.0], [61.6, 416.0], [61.7, 416.0], [61.8, 416.0], [61.9, 416.0], [62.0, 416.0], [62.1, 416.0], [62.2, 416.0], [62.3, 416.0], [62.4, 416.0], [62.5, 416.0], [62.6, 416.0], [62.7, 416.0], [62.8, 416.0], [62.9, 416.0], [63.0, 416.0], [63.1, 416.0], [63.2, 416.0], [63.3, 416.0], [63.4, 416.0], [63.5, 416.0], [63.6, 416.0], [63.7, 416.0], [63.8, 416.0], [63.9, 416.0], [64.0, 416.0], [64.1, 416.0], [64.2, 416.0], [64.3, 416.0], [64.4, 416.0], [64.5, 416.0], [64.6, 416.0], [64.7, 416.0], [64.8, 416.0], [64.9, 416.0], [65.0, 416.0], [65.1, 416.0], [65.2, 416.0], [65.3, 416.0], [65.4, 416.0], [65.5, 416.0], [65.6, 416.0], [65.7, 416.0], [65.8, 416.0], [65.9, 416.0], [66.0, 416.0], [66.1, 416.0], [66.2, 416.0], [66.3, 416.0], [66.4, 416.0], [66.5, 416.0], [66.6, 416.0], [66.7, 416.0], [66.8, 416.0], [66.9, 416.0], [67.0, 416.0], [67.1, 416.0], [67.2, 416.0], [67.3, 416.0], [67.4, 416.0], [67.5, 416.0], [67.6, 416.0], [67.7, 416.0], [67.8, 416.0], [67.9, 416.0], [68.0, 416.0], [68.1, 416.0], [68.2, 416.0], [68.3, 416.0], [68.4, 416.0], [68.5, 416.0], [68.6, 416.0], [68.7, 416.0], [68.8, 416.0], [68.9, 416.0], [69.0, 416.0], [69.1, 416.0], [69.2, 416.0], [69.3, 416.0], [69.4, 416.0], [69.5, 416.0], [69.6, 416.0], [69.7, 416.0], [69.8, 416.0], [69.9, 416.0], [70.0, 437.0], [70.1, 437.0], [70.2, 437.0], [70.3, 437.0], [70.4, 437.0], [70.5, 437.0], [70.6, 437.0], [70.7, 437.0], [70.8, 437.0], [70.9, 437.0], [71.0, 437.0], [71.1, 437.0], [71.2, 437.0], [71.3, 437.0], [71.4, 437.0], [71.5, 437.0], [71.6, 437.0], [71.7, 437.0], [71.8, 437.0], [71.9, 437.0], [72.0, 437.0], [72.1, 437.0], [72.2, 437.0], [72.3, 437.0], [72.4, 437.0], [72.5, 437.0], [72.6, 437.0], [72.7, 437.0], [72.8, 437.0], [72.9, 437.0], [73.0, 437.0], [73.1, 437.0], [73.2, 437.0], [73.3, 437.0], [73.4, 437.0], [73.5, 437.0], [73.6, 437.0], [73.7, 437.0], [73.8, 437.0], [73.9, 437.0], [74.0, 437.0], [74.1, 437.0], [74.2, 437.0], [74.3, 437.0], [74.4, 437.0], [74.5, 437.0], [74.6, 437.0], [74.7, 437.0], [74.8, 437.0], [74.9, 437.0], [75.0, 437.0], [75.1, 437.0], [75.2, 437.0], [75.3, 437.0], [75.4, 437.0], [75.5, 437.0], [75.6, 437.0], [75.7, 437.0], [75.8, 437.0], [75.9, 437.0], [76.0, 437.0], [76.1, 437.0], [76.2, 437.0], [76.3, 437.0], [76.4, 437.0], [76.5, 437.0], [76.6, 437.0], [76.7, 437.0], [76.8, 437.0], [76.9, 437.0], [77.0, 437.0], [77.1, 437.0], [77.2, 437.0], [77.3, 437.0], [77.4, 437.0], [77.5, 437.0], [77.6, 437.0], [77.7, 437.0], [77.8, 437.0], [77.9, 437.0], [78.0, 437.0], [78.1, 437.0], [78.2, 437.0], [78.3, 437.0], [78.4, 437.0], [78.5, 437.0], [78.6, 437.0], [78.7, 437.0], [78.8, 437.0], [78.9, 437.0], [79.0, 437.0], [79.1, 437.0], [79.2, 437.0], [79.3, 437.0], [79.4, 437.0], [79.5, 437.0], [79.6, 437.0], [79.7, 437.0], [79.8, 437.0], [79.9, 437.0], [80.0, 637.0], [80.1, 637.0], [80.2, 637.0], [80.3, 637.0], [80.4, 637.0], [80.5, 637.0], [80.6, 637.0], [80.7, 637.0], [80.8, 637.0], [80.9, 637.0], [81.0, 637.0], [81.1, 637.0], [81.2, 637.0], [81.3, 637.0], [81.4, 637.0], [81.5, 637.0], [81.6, 637.0], [81.7, 637.0], [81.8, 637.0], [81.9, 637.0], [82.0, 637.0], [82.1, 637.0], [82.2, 637.0], [82.3, 637.0], [82.4, 637.0], [82.5, 637.0], [82.6, 637.0], [82.7, 637.0], [82.8, 637.0], [82.9, 637.0], [83.0, 637.0], [83.1, 637.0], [83.2, 637.0], [83.3, 637.0], [83.4, 637.0], [83.5, 637.0], [83.6, 637.0], [83.7, 637.0], [83.8, 637.0], [83.9, 637.0], [84.0, 637.0], [84.1, 637.0], [84.2, 637.0], [84.3, 637.0], [84.4, 637.0], [84.5, 637.0], [84.6, 637.0], [84.7, 637.0], [84.8, 637.0], [84.9, 637.0], [85.0, 637.0], [85.1, 637.0], [85.2, 637.0], [85.3, 637.0], [85.4, 637.0], [85.5, 637.0], [85.6, 637.0], [85.7, 637.0], [85.8, 637.0], [85.9, 637.0], [86.0, 637.0], [86.1, 637.0], [86.2, 637.0], [86.3, 637.0], [86.4, 637.0], [86.5, 637.0], [86.6, 637.0], [86.7, 637.0], [86.8, 637.0], [86.9, 637.0], [87.0, 637.0], [87.1, 637.0], [87.2, 637.0], [87.3, 637.0], [87.4, 637.0], [87.5, 637.0], [87.6, 637.0], [87.7, 637.0], [87.8, 637.0], [87.9, 637.0], [88.0, 637.0], [88.1, 637.0], [88.2, 637.0], [88.3, 637.0], [88.4, 637.0], [88.5, 637.0], [88.6, 637.0], [88.7, 637.0], [88.8, 637.0], [88.9, 637.0], [89.0, 637.0], [89.1, 637.0], [89.2, 637.0], [89.3, 637.0], [89.4, 637.0], [89.5, 637.0], [89.6, 637.0], [89.7, 637.0], [89.8, 637.0], [89.9, 637.0], [90.0, 788.0], [90.1, 788.0], [90.2, 788.0], [90.3, 788.0], [90.4, 788.0], [90.5, 788.0], [90.6, 788.0], [90.7, 788.0], [90.8, 788.0], [90.9, 788.0], [91.0, 788.0], [91.1, 788.0], [91.2, 788.0], [91.3, 788.0], [91.4, 788.0], [91.5, 788.0], [91.6, 788.0], [91.7, 788.0], [91.8, 788.0], [91.9, 788.0], [92.0, 788.0], [92.1, 788.0], [92.2, 788.0], [92.3, 788.0], [92.4, 788.0], [92.5, 788.0], [92.6, 788.0], [92.7, 788.0], [92.8, 788.0], [92.9, 788.0], [93.0, 788.0], [93.1, 788.0], [93.2, 788.0], [93.3, 788.0], [93.4, 788.0], [93.5, 788.0], [93.6, 788.0], [93.7, 788.0], [93.8, 788.0], [93.9, 788.0], [94.0, 788.0], [94.1, 788.0], [94.2, 788.0], [94.3, 788.0], [94.4, 788.0], [94.5, 788.0], [94.6, 788.0], [94.7, 788.0], [94.8, 788.0], [94.9, 788.0], [95.0, 788.0], [95.1, 788.0], [95.2, 788.0], [95.3, 788.0], [95.4, 788.0], [95.5, 788.0], [95.6, 788.0], [95.7, 788.0], [95.8, 788.0], [95.9, 788.0], [96.0, 788.0], [96.1, 788.0], [96.2, 788.0], [96.3, 788.0], [96.4, 788.0], [96.5, 788.0], [96.6, 788.0], [96.7, 788.0], [96.8, 788.0], [96.9, 788.0], [97.0, 788.0], [97.1, 788.0], [97.2, 788.0], [97.3, 788.0], [97.4, 788.0], [97.5, 788.0], [97.6, 788.0], [97.7, 788.0], [97.8, 788.0], [97.9, 788.0], [98.0, 788.0], [98.1, 788.0], [98.2, 788.0], [98.3, 788.0], [98.4, 788.0], [98.5, 788.0], [98.6, 788.0], [98.7, 788.0], [98.8, 788.0], [98.9, 788.0], [99.0, 788.0], [99.1, 788.0], [99.2, 788.0], [99.3, 788.0], [99.4, 788.0], [99.5, 788.0], [99.6, 788.0], [99.7, 788.0], [99.8, 788.0], [99.9, 788.0]], "isOverall": false, "label": "Home Page", "isController": false}], "supportsControllersDiscrimination": true, "maxX": 100.0, "title": "Response Time Percentiles"}},
        getOptions: function() {
            return {
                series: {
                    points: { show: false }
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimePercentiles'
                },
                xaxis: {
                    tickDecimals: 1,
                    axisLabel: "Percentiles",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Percentile value in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : %x.2 percentile was %y ms"
                },
                selection: { mode: "xy" },
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimePercentiles"), function(series){
                series.curvedLines = {apply: true, tension: 1};
                series.threshold = {
                        below: percentileThreshold,
                        color: $("#slider-vertical").children("div").css("background-color")
                };
            });
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimesPercentiles"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimesPercentiles"), dataset, prepareOverviewOptions(options));
        }
};

// Response times percentiles
function refreshResponseTimePercentiles() {
    var infos = responseTimePercentilesInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimesPercentiles"))){
        infos.createGraph();
    } else {
        var choiceContainer = $("#choicesResponseTimePercentiles");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimesPercentiles", "#overviewResponseTimesPercentiles");
        $('#bodyResponseTimePercentiles .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var responseTimeDistributionInfos = {
        data: {"result": {"minY": 2.0, "minX": 0.0, "maxY": 8.0, "series": [{"data": [[0.0, 8.0], [500.0, 2.0]], "isOverall": false, "label": "Home Page", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 500, "maxX": 500.0, "title": "Response Time Distribution"}},
        getOptions: function() {
            var granularity = this.data.result.granularity;
            return {
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimeDistribution'
                },
                xaxis:{
                    axisLabel: "Response times in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of responses",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                bars : {
                    show: true,
                    barWidth: this.data.result.granularity
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: function(label, xval, yval, flotItem){
                        return yval + " responses for " + label + " were between " + xval + " and " + (xval + granularity) + " ms";
                    }
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimeDistribution"), prepareData(data.result.series, $("#choicesResponseTimeDistribution")), options);
        }

};

// Response time distribution
function refreshResponseTimeDistribution() {
    var infos = responseTimeDistributionInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimeDistribution"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesResponseTimeDistribution");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        $('#footerResponseTimeDistribution .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var activeThreadsOverTimeInfos = {
        data: {"result": {"minY": 2.9, "minX": 1.4707254E12, "maxY": 2.9, "series": [{"data": [[1.4707254E12, 2.9]], "isOverall": false, "label": "Aip Visitors", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.4707254E12, "title": "Active Threads Over Time"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of active threads",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 6,
                    show: true,
                    container: '#legendActiveThreadsOverTime'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                selection: {
                    mode: 'xy'
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : At %x there were %y active threads"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesActiveThreadsOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotActiveThreadsOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewActiveThreadsOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Active Threads Over Time
function refreshActiveThreadsOverTime(fixTimestamps) {
    var infos = activeThreadsOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 19800000);
    }
    if(isGraph($("#flotActiveThreadsOverTime"))) {
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesActiveThreadsOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotActiveThreadsOverTime", "#overviewActiveThreadsOverTime");
        $('#footerActiveThreadsOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var timeVsThreadsInfos = {
        data: {"result": {"minY": 332.0, "minX": 1.0, "maxY": 620.6666666666666, "series": [{"data": [[2.0, 335.0], [1.0, 332.0], [5.0, 620.6666666666666], [3.0, 416.0]], "isOverall": false, "label": "Home Page", "isController": false}, {"data": [[2.9, 428.5]], "isOverall": false, "label": "Home Page-Aggregated", "isController": false}], "supportsControllersDiscrimination": true, "maxX": 5.0, "title": "Time VS Threads"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    axisLabel: "Number of active threads",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average response times in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: { noColumns: 2,show: true, container: '#legendTimeVsThreads' },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s: At %x.2 active threads, Average response time was %y.2 ms"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesTimeVsThreads"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotTimesVsThreads"), dataset, options);
            // setup overview
            $.plot($("#overviewTimesVsThreads"), dataset, prepareOverviewOptions(options));
        }
};

// Time vs threads
function refreshTimeVsThreads(){
    var infos = timeVsThreadsInfos;
    prepareSeries(infos.data);
    if(isGraph($("#flotTimesVsThreads"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesTimeVsThreads");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotTimesVsThreads", "#overviewTimesVsThreads");
        $('#footerTimeVsThreads .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var bytesThroughputOverTimeInfos = {
        data : {"result": {"minY": 0.0, "minX": 1.4707254E12, "maxY": 131.83333333333334, "series": [{"data": [[1.4707254E12, 0.0]], "isOverall": false, "label": "Bytes received per second", "isController": false}, {"data": [[1.4707254E12, 131.83333333333334]], "isOverall": false, "label": "Bytes sent per second", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.4707254E12, "title": "Bytes Throughput Over Time"}},
        getOptions : function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity) ,
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Bytes/sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendBytesThroughputOverTime'
                },
                selection: {
                    mode: "xy"
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y"
                }
            };
        },
        createGraph : function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesBytesThroughputOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotBytesThroughputOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewBytesThroughputOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Bytes throughput Over Time
function refreshBytesThroughputOverTime(fixTimestamps) {
    var infos = bytesThroughputOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 19800000);
    }
    if(isGraph($("#flotBytesThroughputOverTime"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesBytesThroughputOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotBytesThroughputOverTime", "#overviewBytesThroughputOverTime");
        $('#footerBytesThroughputOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var responseTimesOverTimeInfos = {
        data: {"result": {"minY": 428.5, "minX": 1.4707254E12, "maxY": 428.5, "series": [{"data": [[1.4707254E12, 428.5]], "isOverall": false, "label": "Home Page", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.4707254E12, "title": "Response Time Over Time"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average response time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average response time was %y ms"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Response Times Over Time
function refreshResponseTimeOverTime(fixTimestamps) {
    var infos = responseTimesOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 19800000);
    }
    if(isGraph($("#flotResponseTimesOverTime"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesResponseTimesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimesOverTime", "#overviewResponseTimesOverTime");
        $('#footerResponseTimesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var latenciesOverTimeInfos = {
        data: {"result": {"minY": 428.5, "minX": 1.4707254E12, "maxY": 428.5, "series": [{"data": [[1.4707254E12, 428.5]], "isOverall": false, "label": "Home Page", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.4707254E12, "title": "Latencies Over Time"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average Response latencies in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendLatenciesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average latency was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesLatenciesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotLatenciesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewLatenciesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Latencies Over Time
function refreshLatenciesOverTime(fixTimestamps) {
    var infos = latenciesOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 19800000);
    }
    if(isGraph($("#flotLatenciesOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesLatenciesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotLatenciesOverTime", "#overviewLatenciesOverTime");
        $('#footerLatenciesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var responseTimeVsRequestInfos = {
    data: {"result": {"minY": 371.5, "minX": 10.0, "maxY": 371.5, "series": [{"data": [[10.0, 371.5]], "isOverall": false, "label": "Failures", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 10.0, "title": "Response Time Vs Request"}},
    getOptions: function() {
        return {
            series: {
                lines: {
                    show: false
                },
                points: {
                    show: true
                }
            },
            xaxis: {
                axisLabel: "Global number of requests per second",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            yaxis: {
                axisLabel: "Median Response Time (ms)",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            legend: {
                noColumns: 2,
                show: true,
                container: '#legendResponseTimeVsRequest'
            },
            selection: {
                mode: 'xy'
            },
            grid: {
                hoverable: true // IMPORTANT! this is needed for tooltip to work
            },
            tooltip: true,
            tooltipOpts: {
                content: "%s : Median response time at %x req/s was %y ms"
            }
        };
    },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesResponseTimeVsRequest"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotResponseTimeVsRequest"), dataset, options);
        // setup overview
        $.plot($("#overviewResponseTimeVsRequest"), dataset, prepareOverviewOptions(options));

    }
};

// Response Time vs Request
function refreshResponseTimeVsRequest() {
    var infos = responseTimeVsRequestInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimeVsRequest"))){
        infos.create();
    }else{
        var choiceContainer = $("#choicesResponseTimeVsRequest");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimeVsRequest", "#overviewResponseTimeVsRequest");
        $('#footerResponseRimeVsRequest .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var latenciesVsRequestInfos = {
    data: {"result": {"minY": 371.5, "minX": 10.0, "maxY": 371.5, "series": [{"data": [[10.0, 371.5]], "isOverall": false, "label": "Failures", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 10.0, "title": "Latencies Vs Request"}},
    getOptions: function() {
        return{
            series: {
                lines: {
                    show: false
                },
                points: {
                    show: true
                }
            },
            xaxis: {
                axisLabel: "Global number of requests per second",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            yaxis: {
                axisLabel: "Median Latency (ms)",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            legend: { noColumns: 2,show: true, container: '#legendLatencyVsRequest' },
            selection: {
                mode: 'xy'
            },
            grid: {
                hoverable: true // IMPORTANT! this is needed for tooltip to work
            },
            tooltip: true,
            tooltipOpts: {
                content: "%s : Median response time at %x req/s was %y ms"
            }
        };
    },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesLatencyVsRequest"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotLatenciesVsRequest"), dataset, options);
        // setup overview
        $.plot($("#overviewLatenciesVsRequest"), dataset, prepareOverviewOptions(options));
    }
};

// Latencies vs Request
function refreshLatenciesVsRequest() {
        var infos = latenciesVsRequestInfos;
        prepareSeries(infos.data);
        if(isGraph($("#flotLatenciesVsRequest"))){
            infos.createGraph();
        }else{
            var choiceContainer = $("#choicesLatencyVsRequest");
            createLegend(choiceContainer, infos);
            infos.createGraph();
            setGraphZoomable("#flotLatenciesVsRequest", "#overviewLatenciesVsRequest");
            $('#footerLatenciesVsRequest .legendColorBox > div').each(function(i){
                $(this).clone().prependTo(choiceContainer.find("li").eq(i));
            });
        }
};

var hitsPerSecondInfos = {
        data: {"result": {"minY": 0.16666666666666666, "minX": 1.4707254E12, "maxY": 0.16666666666666666, "series": [{"data": [[1.4707254E12, 0.16666666666666666]], "isOverall": false, "label": "hitsPerSecond", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.4707254E12, "title": "Hits Per Second"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of hits / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendHitsPerSecond"
                },
                selection: {
                    mode : 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y.2 hits/sec"
                }
            };
        },
        createGraph: function createGraph() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesHitsPerSecond"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotHitsPerSecond"), dataset, options);
            // setup overview
            $.plot($("#overviewHitsPerSecond"), dataset, prepareOverviewOptions(options));
        }
};

// Hits per second
function refreshHitsPerSecond(fixTimestamps) {
    var infos = hitsPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 19800000);
    }
    if (isGraph($("#flotHitsPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesHitsPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotHitsPerSecond", "#overviewHitsPerSecond");
        $('#footerHitsPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var codesPerSecondInfos = {
        data: {"result": {"minY": 0.16666666666666666, "minX": 1.4707254E12, "maxY": 0.16666666666666666, "series": [{"data": [[1.4707254E12, 0.16666666666666666]], "isOverall": false, "label": "401", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.4707254E12, "title": "Codes Per Second"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of responses/sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendCodesPerSecond"
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "Number of Response Codes %s at %x was %y.2 responses / sec"
                }
            };
        },
    createGraph: function() {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesCodesPerSecond"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotCodesPerSecond"), dataset, options);
        // setup overview
        $.plot($("#overviewCodesPerSecond"), dataset, prepareOverviewOptions(options));
    }
};

// Codes per second
function refreshCodesPerSecond(fixTimestamps) {
    var infos = codesPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 19800000);
    }
    if(isGraph($("#flotCodesPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesCodesPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotCodesPerSecond", "#overviewCodesPerSecond");
        $('#footerCodesPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var transactionsPerSecondInfos = {
        data: {"result": {"minY": 0.16666666666666666, "minX": 1.4707254E12, "maxY": 0.16666666666666666, "series": [{"data": [[1.4707254E12, 0.16666666666666666]], "isOverall": false, "label": "Home Page-failure", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.4707254E12, "title": "Transactions Per Second"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of transactions / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendTransactionsPerSecond"
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y transactions / sec"
                }
            };
        },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesTransactionsPerSecond"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotTransactionsPerSecond"), dataset, options);
        // setup overview
        $.plot($("#overviewTransactionsPerSecond"), dataset, prepareOverviewOptions(options));
    }
};

// Transactions per second
function refreshTransactionsPerSecond(fixTimestamps) {
    var infos = transactionsPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 19800000);
    }
    if(isGraph($("#flotTransactionsPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesTransactionsPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotTransactionsPerSecond", "#overviewTransactionsPerSecond");
        $('#footerTransactionsPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

// Collapse the graph matching the specified DOM element depending the collapsed
// status
function collapse(elem, collapsed){
    if(collapsed){
        $(elem).parent().find(".fa-chevron-up").removeClass("fa-chevron-up").addClass("fa-chevron-down");
    } else {
        $(elem).parent().find(".fa-chevron-down").removeClass("fa-chevron-down").addClass("fa-chevron-up");
        if (elem.id == "bodyBytesThroughputOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshBytesThroughputOverTime(true);
            }
            document.location.href="#responseTimesOverTime";
        } else if (elem.id == "bodyLantenciesOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshLatenciesOverTime(true);
            }
            document.location.href="#latenciesOverTime";
        } else if (elem.id == "bodyResponseTimeDistribution") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimeDistribution();
            }
            document.location.href="#responseTimeDistribution" ;
        } else if (elem.id == "bodyActiveThreadsOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshActiveThreadsOverTime(true);
            }
            document.location.href="#activeThreadsOverTime";
        } else if (elem.id == "bodyTimeVsThreads") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshTimeVsThreads();
            }
            document.location.href="#timeVsThreads" ;
        } else if (elem.id == "bodyCodesPerSecond") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshCodesPerSecond(true);
            }
            document.location.href="#codesPerSecond";
        } else if (elem.id == "bodyTransactionsPerSecond") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshTransactionsPerSecond(true);
            }
            document.location.href="#transactionsPerSecond";
        } else if (elem.id == "bodyResponseTimeVsRequest") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimeVsRequest();
            }
            document.location.href="#responseTimeVsRequest";
        } else if (elem.id == "bodyLatenciesVsRequest") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshLatenciesVsRequest();
            }
            document.location.href="#latencyVsRequest";
        }
    }
}

// Collapse
$(function() {
        $('.collapse').on('shown.bs.collapse', function(){
            collapse(this, false);
        }).on('hidden.bs.collapse', function(){
            collapse(this, true);
        });
});

$(function() {
    $(".glyphicon").mousedown( function(event){
        var tmp = $('.in:not(ul)');
        tmp.parent().parent().parent().find(".fa-chevron-up").removeClass("fa-chevron-down").addClass("fa-chevron-down");
        tmp.removeClass("in");
        tmp.addClass("out");
    });
});

/*
 * Activates or deactivates all series of the specified graph (represented by id parameter)
 * depending on checked argument.
 */
function toggleAll(id, checked){
    var placeholder = document.getElementById(id);

    var cases = $(placeholder).find(':checkbox');
    cases.prop('checked', checked);
    $(cases).parent().children().children().toggleClass("legend-disabled", !checked);

    var choiceContainer;
    if ( id == "choicesBytesThroughputOverTime"){
        choiceContainer = $("#choicesBytesThroughputOverTime");
        refreshBytesThroughputOverTime(false);
    } else if(id == "choicesResponseTimesOverTime"){
        choiceContainer = $("#choicesResponseTimesOverTime");
        refreshResponseTimeOverTime(false);
    } else if ( id == "choicesLatenciesOverTime"){
        choiceContainer = $("#choicesLatenciesOverTime");
        refreshLatenciesOverTime(false);
    } else if ( id == "choicesResponseTimePercentiles"){
        choiceContainer = $("#choicesResponseTimePercentiles");
        refreshResponseTimePercentiles();
    } else if(id == "choicesActiveThreadsOverTime"){
        choiceContainer = $("#choicesActiveThreadsOverTime");
        refreshActiveThreadsOverTime(false);
    } else if ( id == "choicesTimeVsThreads"){
        choiceContainer = $("#choicesTimeVsThreads");
        refreshTimeVsThreads();
    } else if ( id == "choicesResponseTimeDistribution"){
        choiceContainer = $("#choicesResponseTimeDistribution");
        refreshResponseTimeDistribution();
    } else if ( id == "choicesHitsPerSecond"){
        choiceContainer = $("#choicesHitsPerSecond");
        refreshHitsPerSecond(false);
    } else if(id == "choicesCodesPerSecond"){
        choiceContainer = $("#choicesCodesPerSecond");
        refreshCodesPerSecond(false);
    } else if ( id == "choicesTransactionsPerSecond"){
        choiceContainer = $("#choicesTransactionsPerSecond");
        refreshTransactionsPerSecond(false);
    } else if ( id == "choicesResponseTimeVsRequest"){
        choiceContainer = $("#choicesResponseTimeVsRequest");
        refreshResponseTimeVsRequest();
    } else if ( id == "choicesLatencyVsRequest"){
        choiceContainer = $("#choicesLatencyVsRequest");
        refreshLatenciesVsRequest();
    }
    var color = checked ? "black" : "#818181";
    choiceContainer.find("label").each(function(){
        this.style.color = color;
    });
}

// Unchecks all boxes for "Hide all samples" functionality
function uncheckAll(id){
    toggleAll(id, false);
}

// Checks all boxes for "Show all samples" functionality
function checkAll(id){
    toggleAll(id, true);
}

// Prepares data to be consumed by plot plugins
function prepareData(series, choiceContainer, customizeSeries){
    var datasets = [];

    // Add only selected series to the data set
    choiceContainer.find("input:checked").each(function (index, item) {
        var key = $(item).attr("name");
        var i = 0;
        var size = series.length;
        while(i < size && series[i].label != key)
            i++;
        if(i < size){
            var currentSeries = series[i];
            datasets.push(currentSeries);
            if(customizeSeries)
                customizeSeries(currentSeries);
        }
    });
    return datasets;
}

// create slider
$(function() {
    $( "#slider-vertical" ).slider({
      orientation: "vertical",
      range: "min",
      min: responseTimePercentilesInfos.data.result.minY,
      max: responseTimePercentilesInfos.data.result.maxY,
      value: 0,
      stop: function(event, ui ) {
       percentileThreshold= ui.value;
       refreshResponseTimePercentiles();
       $("#amount").val(percentileThreshold);
      }
    });
    $("#amount" ).val( $( "#slider-vertical" ).slider( "value" ) );
    $("#slider-vertical").children("div").css("background-color","purple");
    $("#amount" ).css("color", $("#slider-vertical").children("div").css("background-color"));
    $("#slider-vertical").children("div").css("opacity","0.3");
});

/*
 * Ignore case comparator
 */
function sortAlphaCaseless(a,b){
    return a.toLowerCase() > b.toLowerCase() ? 1 : -1;
};

/*
 * Creates a legend in the specified element with graph information
 */
function createLegend(choiceContainer, infos) {
    // Sort series by name
    var keys = [];
    $.each(infos.data.result.series, function(index, series){
        keys.push(series.label);
    });
    keys.sort(sortAlphaCaseless);

    // Create list of series with support of activation/deactivation
    $.each(keys, function(index, key) {
        var id = choiceContainer.attr('id') + index;
        $('<li />')
            .append($('<input id="' + id + '" name="' + key + '" type="checkbox" checked="checked" hidden />'))
            .append($('<label />', { 'text': key , 'for': id }))
            .appendTo(choiceContainer);
    });
    choiceContainer.find("label").click( function(){
        if (this.style.color !== "rgb(129, 129, 129)" ){
            this.style.color="#818181";
        }else {
            this.style.color="black";
        }
        $(this).parent().children().children().toggleClass("legend-disabled");
    });
    choiceContainer.find("label").mousedown( function(event){
        event.preventDefault();
    });
    choiceContainer.find("label").mouseenter(function(){
        this.style.cursor="pointer";
    });

    // Recreate graphe on series activation toggle
    choiceContainer.find("input").click(function(){
        infos.createGraph();
    });
}
