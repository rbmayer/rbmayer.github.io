// get params from forms
function getParams() {
    var repeatRate = Number(document.getElementById('repeatRate').value)/100,
        creditScoreAcc = Number(document.getElementById('scoreAcc').value)/100,
        loanAmt = 15, 
        intRate = Number(document.getElementById('intRate').value)/100, 
        cofRate = Number(document.getElementById('cofRate').value)/12/100, 
        initialCust = 1000,
        newCustRate = Number(document.getElementById('custRate').value)/100;
    return [repeatRate, creditScoreAcc, loanAmt, intRate, cofRate, initialCust, newCustRate];
}
// generate simulation data
function makeData(args) {
    "use strict";
    function add_seq(loans, seqRepayRate, repeatRate) {
        var seq = [],
            currPeriod = loans.length + 1,
            previousSeq = loans[loans.length-1],
            repayRate = seqRepayRate[loans.length-1];
        for (j=0; j<previousSeq.length; j++) {
            if (j < currPeriod-1) {
                seq.push(0);
            } 
            else
                seq.push(previousSeq[j-1]*repayRate*repeatRate);   
        }
        return seq;
    }
     // sum array by period
     function period_totals(array) {
         var result = array.map(function(row, j) {
                 return array.map(function(row) {
                         return row[j]; 
                 }).reduce(function(a, b) {
                     return a+b;
                 }, 0);
         });
         return result;
     }
     // tally loan sequences  
     function closedSeqs(array) {
         var open = [], curr = [], next = [], closedSeqs = [], totalSeqs = []; 
         // slice off open loan sequences in period 13
         for (i=1; i<maxPeriodCalc; i++) {
             open.push(array[i][maxPeriodDisp]);
         }
         // add indexed positions to curr and next arrays
         for (i=0; i<maxPeriodDisp; i++) {
            curr.push([0]); next.push([0]);
         }   
         // for each sequence length, sum the current and next no. of loans
         for (i=0;i<maxPeriodDisp;i++) {
            for (j=0;j<maxPeriodDisp; j++) {
                curr[i] = Number(curr[i]) + Number(array[i][j]); 
                next[i] = Number(next[i]) + Number(array[i+1][j+1]);
            }
         }
         closedSeqs.push(_.zipWith(curr, next, function(a,b) { return a - b;}));
         totalSeqs.push(_.zipWith(open, closedSeqs[0], function(a,b) { return a + b;}));
         return [closedSeqs[0], totalSeqs[0]];
     }
     // return cumulative totals
     function cumulate(array, periods) {
         var result = [array[0]];
         for (i=1;i<periods;i++) {
             result.push(array[i] + result[i-1])
         }
         return result
     }    
     // get input parameters
    var repeatRate = args[0],
        creditScoreAcc = args[1],
        loanAmt = args[2], 
        intRate = args[3], 
        cofRate = args[4], 
        initialCust = args[5],
        newCustRate = args[6];    
    // generate sequence repayment rates
    var i, j,
        B = 0.995,
        A = Math.round(10000 * (creditScoreAcc - B))/10000,
        maxPeriodDisp = Number(document.getElementById('maxPeriod').value),
        maxPeriodCalc = maxPeriodDisp + 1,
        period = d3.range(1, +maxPeriodCalc + 2),
        seqRepayRate;
    seqRepayRate = period.map(function(d) {
            return Math.round(10000 * (A/d + B))/10000;
    });
    // calculate loans by period & sequence length
    var firstLoans = [initialCust];
    for (i=1; i<maxPeriodCalc; i++) {           
        firstLoans.push(firstLoans[i-1]*(1 + newCustRate));
    }
    var secondLoans = [0];
    for (i=1; i<maxPeriodCalc; i++) {
        secondLoans.push(firstLoans[i-1]*creditScoreAcc*repeatRate);
    }
    var loansAll = [firstLoans, secondLoans];   

    for (i=2; i<maxPeriodCalc; i++) {
        var next_seq = add_seq(loansAll, seqRepayRate, repeatRate);
        loansAll.push(next_seq);
    }
    // derive remaining performance variables
    var repaidAll=[],
        cofAll = [],
        defaultedAll = [],
        defaultedAllAmt = [],
        feesAll = [],
        grossProfitAll = [],
        loanAmountsAll = [];
    for (i=0; i<maxPeriodCalc; i++) {
        var repayRate = seqRepayRate[i],
            loans_i = loansAll[i];
        // repaid loans
        repaidAll.push(loans_i.map(function(d) {return d * repayRate;}));
        // cost of funds
        cofAll.push(loans_i.map(function(d) {return d * loanAmt * cofRate;}));
        // earning assets
        loanAmountsAll.push(loans_i.map(function(d) {return d * loanAmt;}));
    }    
    for (i=0; i<maxPeriodCalc; i++) {
        var loans_i = loansAll[i],
            repaidAll_i = repaidAll[i];
        // defaulted loans
        defaultedAll.push(_.zipWith(loans_i, repaidAll_i, function(a,b) { return a - b;}));
        // interest payments received
        feesAll.push(repaidAll_i.map(function(d) {return d * loanAmt * intRate;}));
    }
     for (i=0; i<maxPeriodCalc; i++) {
         var defaultedAll_i = defaultedAll[i];
         // defaulted loan amounts
         defaultedAllAmt.push(defaultedAll_i.map(function(d) {return d * loanAmt;}));
         grossProfitAll.push(_.zipWith(feesAll[i], defaultedAllAmt[i], cofAll[i],  function(a,b,c) { 
         return a - b - c ;}));
     }          
     // total loans by period
     var loans = period_totals(loansAll),
         repaid = period_totals(repaidAll),
         defaulted = period_totals(defaultedAll),
         grossProfit = period_totals(grossProfitAll),
         totalGrossProfit = d3.sum(grossProfit),
         loanAmounts = period_totals(loanAmountsAll);
     // get grand totals
     var totalLoans = d3.sum(loans.slice(0,maxPeriodDisp)),
         totalRepaid = d3.sum(repaid.slice(0,maxPeriodDisp)),
         totalDefaulted = d3.sum(defaulted.slice(0,maxPeriodDisp)),
         avgTotalLoans = d3.mean(loanAmounts.slice(0,maxPeriodDisp)),
         grossMargin = totalGrossProfit/avgTotalLoans;
     // break out by new & repeat customers
     var oldCustTotalLoans, oldCustRepaidLoans, oldCustDefaultedLoans, newCustTotalLoans, newCustRepaidLoans, newCustDefaultedLoans;
     oldCustTotalLoans = period_totals(loansAll.slice(1));
     oldCustRepaidLoans = period_totals(repaidAll.slice(1));
     oldCustDefaultedLoans = period_totals(defaultedAll.slice(1));
     newCustTotalLoans = loansAll[0];
     newCustRepaidLoans = repaidAll[0];
     newCustDefaultedLoans = defaultedAll[0];
     // get repayment rates
     var oldCustRepayRate = [], oldCustDefaultRate = [], newCustRepayRate = [], newCustDefaultRate = [];
     for (i=0;i<maxPeriodDisp;i++) {
         if (i===0) {
             oldCustRepayRate.push(0);
             oldCustDefaultRate.push(0);
             newCustRepayRate.push(newCustRepaidLoans[i]/newCustTotalLoans[i]);
             newCustDefaultRate.push(newCustDefaultedLoans[i]/newCustTotalLoans[i]);
         }
         else {
             oldCustRepayRate.push(oldCustRepaidLoans[i]/oldCustTotalLoans[i]);
             oldCustDefaultRate.push(oldCustDefaultedLoans[i]/oldCustTotalLoans[i]);
             newCustRepayRate.push(newCustRepaidLoans[i]/newCustTotalLoans[i]);
             newCustDefaultRate.push(newCustDefaultedLoans[i]/newCustTotalLoans[i]);
         }
     }
     // get cumulative totals
     var oldCustRepaidLoansCm, oldCustDefaultedLoansCm, newCustRepaidLoansCm, newCustDefaultedLoansCm, cumOldLoans, cumNewLoans;
     oldCustRepaidLoansCm = cumulate(oldCustRepaidLoans, maxPeriodDisp);
     oldCustDefaultedLoansCm = cumulate(oldCustDefaultedLoans, maxPeriodDisp);
     newCustRepaidLoansCm = cumulate(newCustRepaidLoans, maxPeriodDisp);
     newCustDefaultedLoansCm = cumulate(newCustDefaultedLoans, maxPeriodDisp);
     cumOldLoans = oldCustRepaidLoans[oldCustRepaidLoans.length - 1] + oldCustDefaultedLoansCm[oldCustDefaultedLoansCm.length - 1];
     cumNewLoans = newCustRepaidLoansCm[newCustRepaidLoansCm.length - 1] + newCustDefaultedLoansCm[newCustDefaultedLoansCm.length - 1];
     var npl = totalDefaulted/totalLoans
     // total sequences and customers
     var Seqs = closedSeqs(loansAll),
         closedSeq = Seqs[0],
         totalSeq = Seqs[1],
         SeqsRepaid = closedSeqs(repaidAll),
         seqRepaid = SeqsRepaid[0],
         totalCust = d3.sum(totalSeq),
         avgLoansPerCust = totalLoans/totalCust,
         avgInterest = intRate * avgLoansPerCust;
     // package results for use in plotCharts()
     var loans=[], summary;       
     for(i=0; i<maxPeriodDisp; i++) {
         loans.push({
                 period: period[i],
                 status: "Repaid",
                 customer: "New customers",
                 loans: newCustRepaidLoans[i],
                 repayRate: newCustRepayRate[i]
         });
         loans.push({
                 period: period[i],
                 status: "Defaulted",
                 customer: "New customers",
                 loans: newCustDefaultedLoans[i]
         });
         loans.push({
                 period: period[i],
                 status: "Repaid",
                 customer: "Repeat customers",
                 loans: oldCustRepaidLoans[i],
                 repayRate: oldCustRepayRate[i]
         });
         loans.push({
                 period: period[i],
                 status: "Defaulted",
                 customer: "Repeat customers",
                 loans: oldCustDefaultedLoans[i]
         });
     }            
     summary = {  "npl": npl,
                  "maxPeriod": maxPeriodDisp,
                  "avgLoans": avgLoansPerCust,
                  "avgInt": avgInterest,
                  "grossMargin": grossMargin,
                  "intRate": intRate,
     };     
     return [loans, summary];
}
    
// function to plot charts
function plotCycles(data) {
    "use strict";
    d3.selectAll(".chart1").selectAll("svg").remove();
    var loans = data;
    // Set margins
    var margin = {
        top: 30,
        right: 10, 
        bottom: 20, 
        left: 60
    },
    chart_width = 450,
    chart_height = 250,
    width = chart_width - margin.left - margin.right,
    height = chart_height - margin.top - margin.bottom;
    // add svg
    var svg0 = dimple.newSvg(".chart1", chart_width, chart_height);
    // add chart
    var rateChart = new dimple.chart(svg0, loans);
    rateChart.setBounds(margin.left, margin.top, width, height);
    rateChart.defaultColors = [
        new dimple.color("#4D555D", "#4D555D", 1), // med. gray    
        new dimple.color("red", "red", 1), // red
    ];
    var x = rateChart.addCategoryAxis("x", ["customer", "period"]);  
    x.addGroupOrderRule("period");
    x.addOrderRule(["New customers", "Repeat customers"]);
    var y1 = rateChart.addMeasureAxis("y", "loans");
    var s1 = rateChart.addSeries(["customer", "status"], dimple.plot.bar, [x, y1]);
    s1.aggregate = dimple.aggregateMethod.sum;
    s1.barGap = 0.2;
    s1.getTooltipText = function(e) {
        return ["Loan cycle: " + e.xField[1],
            (e.aggField[1] === "Defaulted" && e.cx === "New customers") ? ("New customer default rate: " + d3.format(".1%")(e.yValue/e.cy)) : (e.aggField[1] === "Defaulted" && e.cx === "Repeat customers") ? ("Repeat customer default rate: " + d3.format(".1%")(e.yValue/e.cy)) : null ];
    }
    rateChart.addLegend(75, 5, 100, 80, "left");
//    rateChart.ease = "linear";
    rateChart.staggerDraw = true;
    rateChart.draw(500);
    x.titleShape.remove();
    y1.titleShape.text("number of loans"); 
}

// display results
function plotSummary(summary) {
    d3.selectAll(".results").selectAll("text").remove();
    // show gross margin in lg button
    var text1 = d3.select(".gross-margin")
         .append("text")
         .text((100*summary.grossMargin).toFixed(1) + "%");
    var text2 = d3.select("#table-header")
            .append("text")
            .text("Performance after " + summary.maxPeriod + " loan cycles");
    var text3 = d3.select("#repay-rate")
        .append("text")
        .text(((1-summary.npl)*100).toFixed(1) + "%");
    var text4 = d3.select("#npl")
        .append("text")
        .text(((summary.npl)*100).toFixed(1) + "%");
    var text5 = d3.select("#seq-len")
        .append("text")
        .text((summary.avgLoans).toFixed(1) + " loans");
    var text6 = d3.select("#int-per-cust")
        .append("text")
        .text((100*summary.avgInt).toFixed(1) + "%");
}    

function reloadPlots() {
    d3.selectAll(".chart1").selectAll("svg").remove();
    d3.selectAll(".results").selectAll("text").remove();
    params = getParams();
    data = makeData(params);
    plotCycles(data[0]);
    plotSummary(data[1]);            
    }
    
function reloadSummary() {
    d3.selectAll(".results").selectAll("text").remove();
    params = getParams();
    data = makeData(params);
    plotSummary(data[1]); 
}
    
// load default plots
reloadPlots()

function makeSelectorData(lower, upper, step) {
    var data1 = [],
        inc = lower,
        rangeX2 = (upper-lower)/step;
    for (i=0;i<=rangeX2;i++) {
        data1.push({"xVal": inc, "yVal": 1});
        inc = inc + step;
    }
    return [data1, {"lower": lower, "upper": upper}];
}
// make range selector data
dataIntRate = makeSelectorData(0, 0.20, 0.005);
dataScoreAcc = makeSelectorData(0.70, 1.00, 0.005);
dataRepeatRate = makeSelectorData(0, 1.00, 0.01);
dataCustRate = makeSelectorData(-0.25, 0.15, 0.01);
dataCofRate = makeSelectorData(0, 0.08, 0.0025);
dataMaxPeriod = makeSelectorData(3, 24, 1);

function makeSelector(data, svgClass, inputClass, everyNth) {
    var chartData = data[0],
        range = data[1],
        svg1Width = 150,
        svg1Height = 40,
        margin = {top: 5, bottom: 18, right: 15, left: 5},
        selectorWidth = svg1Width - margin.left - margin.right,
        selectorHeight = svg1Height - margin.top - margin.bottom;
    // Fill the SVG background (http://dimplejs.org/advanced_examples_viewer.html?id=advanced_custom_styling)
    var svg1 = dimple.newSvg(svgClass, svg1Width, svg1Height);
    svg1.append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", selectorWidth)
      .attr("height", selectorHeight)
      .style("fill", "#cccccc");
    var selector = new dimple.chart(svg1, chartData);
    selector.setBounds(margin.left, margin.top, selectorWidth, selectorHeight);
    selector.defaultColors = [ new dimple.color("#cccccc", "#cccccc", 1) ]; // med. gray
    var x = selector.addCategoryAxis("x", "xVal");
    x.overrideMin = (inputClass === "maxPeriod") ?  range.lower : 100*range.lower;
    x.overrideMax = (inputClass === "maxPeriod") ?  range.upper : 100*range.upper;
    x.showGridlines = false;
    x.tickFormat = (inputClass === "maxPeriod") ? "0f" : "%";
    var y = selector.addMeasureAxis("y", "yVal");
    y.hidden = true;
    var s = selector.addSeries("xVal", dimple.plot.bar);
    s.aggregate = dimple.aggregateMethod.avg;
    // override standard hover behavior
    s.addEventHandler("mouseover", function (e) {});
    // on click insert x-value into form
    s.addEventHandler("click", function (e) {
        s.shapes.style("fill", "#cccccc").style("stroke", "#cccccc");
        var recte = e.selectedShape[0];    
        d3.selectAll(recte).style("fill", "#2FA15A").style("stroke", "#2FA15A");
        var input = document.getElementById(inputClass);
        input.value = inputClass === "maxPeriod" ? e.seriesValue : d3.format(".1f")(100*e.seriesValue);
        (inputClass === "intRate" || inputClass === "cofRate") ? reloadSummary() : reloadPlots();        
    });
    selector.draw();
    x.titleShape.remove();
    // relabel x axis. from http://stackoverflow.com/questions/23305230/how-do-you-reduce-the-number-of-y-axis-ticks-in-dimple-js/23318244#23318244
    if (x.shapes.length > 0) {
        x.shapes.selectAll("text").attr("transform", "rotate(0)").attr("transform", "translate(-6,0)");
        var del = 0;
        x.shapes.selectAll("text").each(function (d) {
                // Remove all but every Nth label
                if (del % everyNth !== 0) {
                    $(this).remove();
                } 
            del += 1;
            });
        };
    // remove all tick marks
    x.shapes.selectAll("line").remove();
    return s;
}
// enable event handlers outside selector setup function
sIntRate = makeSelector(dataIntRate, ".selector-intRate", "intRate", 10);
sScoreAcc = makeSelector(dataScoreAcc, ".selector-scoreAcc", "scoreAcc", 20);
sRepeatRate = makeSelector(dataRepeatRate, ".selector-repeatRate", "repeatRate", 20);
sCustRate = makeSelector(dataCustRate, ".selector-custRate", "custRate", 10);
sCofRate = makeSelector(dataCofRate, ".selector-cofRate", "cofRate", 10);
sMaxPeriod = makeSelector(dataMaxPeriod, ".selector-maxPeriod", "maxPeriod", 3);

// reload plots on input field enter
$("#intRate").keypress(function(e) {
        if(e.which === 13) {reloadSummary();}
});
$("#scoreAcc").keypress(function(e) {
        if(e.which === 13) {reloadPlots();}
});
$("#repeatRate").keypress(function(e) {
        if(e.which === 13) {reloadPlots();}
});
$("#custRate").keypress(function(e) {
        if(e.which === 13) {reloadPlots();}
});
$("#cofRate").keypress(function(e) {
        if(e.which === 13) {reloadSummary();}
});
$("#maxPeriod").keypress(function(e) {
        if(e.which === 13) {reloadPlots();}
});

// make main results columns same height
// http://stackoverflow.com/questions/23287206/same-height-column-bootstrap-3-row-responsive
$( document ).ready(function() {
    var heights = $(".top").map(function() {
        return $(this).height();
    }).get(),
    maxHeight = Math.max.apply(null, heights);
    $(".top").height(maxHeight);
});
