// get params from forms
function getParams() {
    var repeatRate = Number(document.getElementById('repeatRate').value)/100,
        creditScoreAcc = Number(document.getElementById('scoreAcc').value)/100,
        loanAmt = Number(document.getElementById('loanAmt').value), 
        intRate = Number(document.getElementById('intRate').value)/100, 
        cofRate = Number(document.getElementById('cofRate').value)/100, 
        initialCust = 10000,
        newCustRate = Number(document.getElementById('custRate').value)/100;
    return [repeatRate, creditScoreAcc, loanAmt, intRate, cofRate, initialCust, newCustRate];
}
// function to generate data from formulas and form inputs
function makeData(args) {
    "use strict";
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
     // array sum
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
     // totals by period. code obtained from Stack Overflow http://tinyurl.com/gvoo37c
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
     // transpose array
     function transpose(array) {
         let newArray = [];
         for (i=0; i<array.length; i++) {
             newArray.push([]);
         };
         for (i=0; i<array.length; i++) {
             for(let j=0; j<array.length; j++) {
                 newArray[j].push(array[i][j]);
             };
         };
         return newArray;
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
     // new & repeat customer loan totals by period
     var oldCustTotalLoans, oldCustRepaidLoans, oldCustDefaultedLoans, newCustRepaidLoans, newCustDefaultedLoans, cumOldLoans, cumNewLoans;
     oldCustTotalLoans = period_totals(loansAll.slice(1));
     oldCustRepaidLoans = period_totals(repaidAll.slice(1));
     oldCustDefaultedLoans = period_totals(defaultedAll.slice(1));
     newCustRepaidLoans = repaidAll[0];
     newCustDefaultedLoans = defaultedAll[0];
        // new & repeat customer repayment rates by period
     var oldCustRepayRate = [], oldCustDefaultRate = [], newCustRepayRate = [], newCustDefaultRate = [];
     for (i=0;i<maxPeriodDisp;i++) {
         oldCustRepayRate.push(oldCustRepaidLoans[i]/oldCustTotalLoans[i]);
         oldCustDefaultRate.push(oldCustDefaultedLoans[i]/oldCustTotalLoans[i]);
         newCustRepayRate.push(newCustRepaidLoans[i]/newCustTotalLoans[i]);
         newCustDefaultRate.push(newCustDefaultedLoans[i]/newCustTotalLoans[i]);
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
     // package results for use in index.js
     var loans=[], summary, old_pct_repaid;       
     // repayment rates
     for(i=0; i<maxPeriodDisp; i++) {
         loans.push({
                 period: period[i],
                 status: "repaid",
                 customer: "New customers",
                 loans: newCustRepaidLoans[i]
                 rate: newCustRepayRate[i]
         });
         loans.push({
                 period: period[i],
                 status: "defaulted",
                 customer: "New customers",
                 loans: newCustDefaultedLoans[i]
                 rate: newCustDefaultRate[i]
         });
         loans.push({
                 period: period[i],
                 status: "repaid",
                 customer: "Repeat customers",
                 loans: oldCustRepaidLoans[i]
                 rate: oldCustRepayRate[i]
         });
         loans.push({
                 period: period[i],
                 status: "defaulted",
                 customer: "Repeat customers",
                 loans: oldCustDefaultedLoans[i]
                 rate: oldCustDefaultRate
         });
     }            
     summary = {  "npl": npl,
                  "maxPeriod": maxPeriodDisp,
                  "avgLoans": avgLoansPerCust,
                  "avgInt": avgInterest,
                  "totalGrossProfit": totalGrossProfit,
                  "grossMargin": grossMargin,
                  "intRate": intRate,
                  "cumOldLoans": cumOldLoans,
                  "cumNewLoans": cumNewLoans
     };     
     return [loans, summary];
}
    
// function to plot charts
function plotCycles(data) {
    "use strict";
    var loans = data[0],
        summary = data[1];
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
    var rateChart = new dimple.chart(svg0, loans);
    rateChart.setBounds(margin.left, margin.top, width, height);
    var x = rateChart.addCategoryAxis("x", ["customer", "period"]);  
    x.addGroupOrderRule("period");
    x.addOrderRule(["New customers", "Repeat customers"]);
    var y1 = rateChart.addMeasureAxis("y", "loans");
    var s1 = rateChart.addSeries("status", dimple.plot.bar, [x, y1]);
    s1.aggregate = dimple.aggregateMethod.avg;
/*    s1.getTooltipText = function (e) {
        if (e.aggField[0] === "Loans") {
            return [
                "Loan cycle: " + e.cx,
                "Loan repayment rate: " + (e.cy*100).toFixed(1) + "%"];
        }
        else if ((e.aggField[0] === "Sequences") && (e.cx === 1)) {
            return [
                "Sequence length: " + e.cx + " loan",
            "Repayment rate: " + (e.cy*100).toFixed(1) + "%"];
        }
        else {
            return [
                "Sequence length: " + e.cx + " loans",
            "Repayment rate: " + (e.cy*100).toFixed(1) + "%"];
        }
    };    */
    rateChart.addLegend(350, 35, 100, 80, "left");
    rateChart.draw();
    x.titleShape.remove();
    y1.titleShape.text("Loans (cumulative)"); 
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
plotSummary(data[1]);
plotCycles(data);
plotNpl(".npl1", data[1].npl, data[1].intRate, "This simulation");
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
            plotSummary(data[1]);
            plotCycles(data);
            plotNpl(".npl1", data[1].npl, data[1].intRate, "This simulation");
            plotNpl(".npl2", .016, .075, "M-Shwari (Sep 2015)");
            plotNpl(".npl3", .04, .10, "Jumo (Sep 2015)");
            plotNpl(".npl4", .05, .09, "Branch (Dec 2015)");
            plotNpl(".npl5", .15, .10, "Mkopo rahisi (Jul 2015)");
    });

