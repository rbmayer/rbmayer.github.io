// get params from forms
function getParams() {
    var repeatRate = Number(document.getElementById('repeatRate').value)/100,
        creditScoreAcc = Number(document.getElementById('scoreAcc').value)/100,
        loanAmt = Number(document.getElementById('loanAmt').value), 
        intRate = Number(document.getElementById('intRate').value)/100, 
        cofRate = Number(document.getElementById('cofRate').value)/100, 
        initialCust = 1000,
        newCustRate = Number(document.getElementById('custRate').value)/100;
    return [repeatRate, creditScoreAcc, loanAmt, intRate, cofRate, initialCust, newCustRate];
}
// function to generate data from formulas and form inputs
function makeData(args) {
    "use strict";
    // helper functions
    // extend loan sequence by one period
    function add_seq(loans, seqRepayRate, repeatRate) {
        let seq = [],
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
    // sum array
    Array.prototype.sum2d = function() {
        let total = 0, row, n_rows;
        for(row=0, n_rows=this.length; row<n_rows; row++) {
            let element, n_cols=this[row].length;
            for (element=0; element<n_cols; element++) {
                total += this[row][element];
            }
        }
        return total;
    };
     // sum array by period. (ref. Stack Overflow http://tinyurl.com/gvoo37c)
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
    // input parameters
    var repeatRate = args[0],
        creditScoreAcc = args[1],
        loanAmt = args[2], 
        intRate = args[3], 
        cofRate = args[4], 
        initialCust = args[5],
        newCustRate = args[6];    
    var i, j,
        B = 0.995,
        A = Math.round(10000 * (creditScoreAcc - B))/10000,
        maxPeriodDisp = Number(document.getElementById('maxPeriod').value),
        maxPeriodCalc = maxPeriodDisp + 1,
        period = d3.range(1, +maxPeriodCalc + 2),
        seqRepayRate;
    // calculate sequence repayment rate
    seqRepayRate = period.map(function(d) {
            return Math.round(10000 * (A/d + B))/10000;
    });
    // calculate loans
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
    // calculate series
    var repaidAll=[],
        cofAll = [],
        defaultedAll = [],
        defaultedAllAmt = [],
        feesAll = [],
        grossProfitAll = [];
    for (i=0; i<maxPeriodCalc; i++) {
        let repayRate = seqRepayRate[i],
            loans_i = loansAll[i];
        // repaid loans
        repaidAll.push(loans_i.map(function(d) {return d * repayRate;}));
        // cost of funds
        cofAll.push(loans_i.map(function(d) {return d * loanAmt * cofRate;}));
    }    
    for (i=0; i<maxPeriodCalc; i++) {
        let loans_i = loansAll[i],
            repaidAll_i = repaidAll[i];
        // defaulted loans
        defaultedAll.push(_.zipWith(loans_i, repaidAll_i, function(a,b) { return a - b;}));
        // interest payments received
        feesAll.push(repaidAll_i.map(function(d) {return d * loanAmt * intRate;}));
    }
     for (i=0; i<maxPeriodCalc; i++) {
         let defaultedAll_i = defaultedAll[i];
         // defaulted loan amounts
         defaultedAllAmt.push(defaultedAll_i.map(function(d) {return d * loanAmt;}));
         grossProfitAll.push(_.zipWith(feesAll[i], defaultedAllAmt[i], cofAll[i],  function(a,b,c) { 
         return a - b - c ;}));
     }
           
     // new & repeat customer loan totals by period
     var oldCustTotalLoans, oldCustRepaidLoans, oldCustDefaultedLoans, newCustTotalLoans, newCustRepaidLoans, newCustDefaultedLoans, cumOldLoans, cumNewLoans;
     oldCustTotalLoans = period_totals(loansAll.slice(1));
     oldCustRepaidLoans = period_totals(repaidAll.slice(1));
     oldCustDefaultedLoans = period_totals(defaultedAll.slice(1));
     newCustTotalLoans = loansAll[0];
     newCustRepaidLoans = repaidAll[0];
     newCustDefaultedLoans = defaultedAll[0];
        // new & repeat customer repayment rates by period
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
     // new & repeat customer cumulative loan totals by period
     function cumulate(array, periods) {
         var result = [array[0]];
         for (i=1;i<periods;i++) {
             result.push(array[i] + result[i-1])
         }
         return result
     }
     oldCustRepaidLoans = cumulate(oldCustRepaidLoans, maxPeriodDisp);
     oldCustDefaultedLoans = cumulate(oldCustDefaultedLoans, maxPeriodDisp);
     newCustRepaidLoans = cumulate(newCustRepaidLoans, maxPeriodDisp);
     newCustDefaultedLoans = cumulate(newCustDefaultedLoans, maxPeriodDisp);
     cumOldLoans = oldCustRepaidLoans[oldCustRepaidLoans.length - 1] + oldCustDefaultedLoans[oldCustDefaultedLoans.length - 1];
     cumNewLoans = newCustRepaidLoans[newCustRepaidLoans.length - 1] + newCustDefaultedLoans[newCustDefaultedLoans.length - 1];
     // array totals by period
     var loans = period_totals(loansAll),
         repaid = period_totals(repaidAll),
         defaulted = period_totals(defaultedAll),
         grossProfit = period_totals(grossProfitAll),
         totalGrossProfit = d3.sum(grossProfit),
         totalLoans = d3.sum(loans.slice(0,maxPeriodDisp)),
         totalRepaid = d3.sum(repaid.slice(0,maxPeriodDisp)),
         totalDefaulted = d3.sum(defaulted.slice(0,maxPeriodDisp)),
         grossMargin = totalGrossProfit/totalLoans;
     var npl = totalDefaulted/totalLoans
     // sequences and customers
     var Seqs = closedSeqs(loansAll),
         closedSeq = Seqs[0],
         totalSeq = Seqs[1],
         SeqsRepaid = closedSeqs(repaidAll),
         seqRepaid = SeqsRepaid[0],
         totalCust = d3.sum(totalSeq),
         avgLoansPerCust = totalLoans/totalCust,
         avgInterest = intRate * avgLoansPerCust;
     // package results for use in plotCharts()
     var rates=[], loans=[], summary, old_pct_repaid;       
     // repayment rates
     for(i=0; i<maxPeriodDisp; i++) {
         rates.push({
                 period:period[i],
                 oldCustRepayRate: oldCustRepayRate[i],
                 newCustRepayRate: newCustRepayRate[i]
         });
         loans.push({
                 period: period[i],
                 status: "Repaid",
                 customer: "New customers",
                 loans: newCustRepaidLoans[i]
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
                 loans: oldCustRepaidLoans[i]
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
     return [rates, loans, summary];
}
    
// function to plot charts
function plotCycles(data) {
    "use strict";
    var rates = data[0],
        loans = data[1],
        summary = data[2];
    // Set margins
    var margin = {
        top: 70,
        right: 70, 
        bottom: 70, // increase bottom margin to fit axis title
        left: 60
    },
    chart_width = 500,
    chart_height = 425,
    width = chart_width - margin.left - margin.right,
    height = chart_height - margin.top - margin.bottom;
    // add svg
    var svg0 = dimple.newSvg(".chart1", chart_width, chart_height);
    // add chart
    var rateChart = new dimple.chart(svg0, rates);
    rateChart.setBounds(margin.left, margin.top, width, height);
    // palette source: http://www.colorhunter.com
    rateChart.defaultColors = [
        new dimple.color("#4D555D", "white", 1), // med. gray    
        new dimple.color("#BAA5CB", "white", 1), // lilac
    ];
    var x = rateChart.addCategoryAxis("x", "period");  
    var y1 = rateChart.addMeasureAxis("y", "loans");
    var y2 = rateChart.addMeasureAxis("y", "oldCustRepayRate");
    // define y2 axis lower bound
    var minY = Math.min(d3.min(rates, function(d) {return d.newCustRepayRate;}) - 0.05, 0.50);
    y2.overrideMin = minY;
    y2.overrideMax = 1;
    y2.tickFormat = "%";
    var y3 = rateChart.addMeasureAxis("y", "newCustRepayRate");
    y3.overrideMin = minY;
    y3.overrideMax = 1;
    y3.hidden = true;
    var s1 = rateChart.addSeries(["customer","status"], dimple.plot.bar, [x, y1]);
    s1.data = loans;
    s1.aggregate = dimple.aggregateMethod.sum;
    var s2 = rateChart.addSeries("Repeat customer repayment rate", dimple.plot.line, [x, y2]);
    s2.data = rates.slice(1);
    s2.lineMarkers = false;
    var s3 = rateChart.addSeries("New customer repayment rate", dimple.plot.line, [x, y3]);
    s3.data = rates;
    s3.lineMarkers = false;
    rateChart.assignColor("Repeat customer repayment rate", "black");
    rateChart.assignColor("New customer repayment rate", "#9D9969");
    rateChart.addLegend(75, 5, 100, 80, "left");
    rateChart.draw();
    x.titleShape.text("loan cycle");
    y1.titleShape.text("number of loans"); 
    y2.titleShape.remove();
}

// display summary results
function plotSummary(summary) {
    var svg2 = d3.select(".results")
            .append("svg")
            .attr("width", 300)
            .attr("height", 325);
    // add summary results heading
    svg2.append("text")
        .attr("x", 60)
        .attr("y", 40)
        .text("Performance after " + summary.maxPeriod + " loan cycles:")
        .attr("text-decoration", "underline")
    // add NPL as text
    svg2.append("text")
        .attr("class", "results")
        .attr("x", 60)
        .attr("y", 70)
        .text("Repayment rate: " + ((1-summary.npl)*100).toFixed(1) + "%")
    // add avg loans per user
    svg2.append("text")
        .attr("class", "results")
        .attr("x", 60)
        .attr("y", 100)    
        .text("Average sequence length: " + (summary.avgLoans).toFixed(1) + " loans")
    // add avg interest per user
    svg2.append("text")
        .attr("class", "results")
        .attr("x", 60)
        .attr("y", 130)    
        .text("Interest per customer: " + (100*summary.avgInt).toFixed(1) + "%")
    // add lender's gross margin
    svg2.append("text")
        .attr("class", "results")
        .attr("x", 60)
        .attr("y", 160)    
        .text("Lender's gross profit: " + (100*summary.grossMargin).toFixed(1) + "%");
}    

// create slopegraph with lender's reported NPL and midpoint of reported interest rates
function plotNpl(DOMtarget, npl, intRate, lender) {
    var inputs = [
        {"cat": "NPL", "rate": npl, "lender": lender},
        {"cat": "Interest rate", "rate": intRate, "lender": lender}
    ];
    // add NPL vs interest rate line chart
    var nwidth = 250,
        nheight,
        right = 140;
    if (lender === "Mkopo rahisi (Jul 2015)" || lender === "Jumo (Sep 2015)") { nheight = 70; }
    else { nheight = 55; }
    var svg3 = dimple.newSvg(DOMtarget, nwidth, nheight);
    var nplChart = new dimple.chart(svg3, inputs);
    nplChart.setBounds(0, 0, nwidth-right, nheight);
    var xn = nplChart.addCategoryAxis("x", "cat");
    xn.addOrderRule("cat", true);
    xn.hidden = true;
    var yn = nplChart.addMeasureAxis("y", "rate");
    if (lender === "This simulation") { 
        yn.overrideMax = d3.max([npl, intRate]) + .01;
        yn.overrideMin = d3.min([npl, intRate]) - .01;
    }
    else {
        yn.overrideMax = 0.17;
        yn.overrideMin = 0;
    }
    var simColor = (npl >= (intRate/(1+intRate)) ? "red" : "black");
    nplChart.assignColor(lender, simColor);
    yn.hidden = true;
    var sn = nplChart.addSeries("lender", dimple.plot.line);
    sn.lineMarkers = true;  
    sn.getTooltipText = function (e) {
        if (lender === "Mkopo rahisi (Jul 2015)" && e.cx === "Interest rate") {
            return [
                "Interest rates: 5-15%"];
        }
        else if (lender === "Branch (Dec 2015)" && e.cx === "Interest rate") {
            return [
            "Interest rates: 6-12%"];
        }
        else if (lender === "Jumo (Sep 2015)" && e.cx === "Interest rate") {
            return [
            "Interest rates: 10% and up"];
        } 
        else {
            return [                      
                e.cx + ": " + (e.cy*100).toFixed(1) + "%"];
        }
    };           
    if (lender === "This simulation") {
        svg3.append("text")
            .attr("x", 95)
            .attr("y", nheight/2)
            .text(lender)
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", "blue")
    }
    else {
        svg3.append("text")
            .attr("x", 95)
            .attr("y", nheight/2)
            .text(lender)
            .attr("font-size", "12px")
    }
    nplChart.draw(); 
}

// load default plots
var params = getParams();
var data = makeData(params);
plotSummary(data[2]);
plotCycles(data);
plotNpl(".npl1", data[2].npl, data[2].intRate, "This simulation");
plotNpl(".npl2", .016, .075, "M-Shwari (Sep 2015)");
plotNpl(".npl3", .04, .10, "Jumo (Sep 2015)");
plotNpl(".npl4", .05, .09, "Branch (Dec 2015)");
plotNpl(".npl5", .15, .10, "Mkopo rahisi (Jul 2015)");
// reload plots on button submit
d3.select("#btn")
    .on("click", function(d, i) {
            d3.selectAll("svg").remove();
            params = getParams();
            data = makeData(params);
            plotSummary(data[2]);
            plotCycles(data);
            plotNpl(".npl1", data[2].npl, data[2].intRate, "This simulation");
            plotNpl(".npl2", .016, .075, "M-Shwari (Sep 2015)");
            plotNpl(".npl3", .04, .10, "Jumo (Sep 2015)");
            plotNpl(".npl4", .05, .09, "Branch (Dec 2015)");
            plotNpl(".npl5", .15, .10, "Mkopo rahisi (Jul 2015)");
    });

