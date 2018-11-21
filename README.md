# Lite Scraper

[![npm version](https://badge.fury.io/js/lite-scraper.svg)](https://badge.fury.io/js/lite-scraper)

Have thousands of items you need to loop through performing asynchronous tasks such as database or server calls? Trying to find a way to easily limit the concurrent number of calls and keep them all straight? Wishing you had a tool to queue, batch, and process all these items? This package may be right for you!

## Contents
* [Usage](#usage)
* [Full Options Example](#full-options-example)
* [Minimal Example](#minimal-example)
* [Advanced Example](#advanced-example)
* [Alternate Example](#alternate-example)
* [Creating a Queue](#creating-a-queue)
* [Adding Items](#adding-items)
* [Emptying Items](#emptying-items)
* [Pausing](#pausing)
* [Async Processing](#async-processing)
* [Progress Updates](#progress-updates)

## Usage
To install run `npm install lite-scraper`.

If you're not using Typescript, you'll probably want to use require.

`const Scraper = require('lite-scraper');`

Using TypeScript? You should be able to import the project easily.

`import { Scraper } from 'lite-scraper';`.

## Full Options Example
```js
const Scraper = require('lite-scraper');

var now = new Date();
var scraper = new Scraper({
        url: 'google.com', // Topmost URL of the page you'd like to scrape.
        statusInterval: 10000, // Default `null` - How often do you want to get updates on status. `null` will not run any status updates.
        statusFunction: status, // Default `null` - Function to call with status updates. If you supply a statusInterval and no statusFunction, we'll use the package's default status function.
        beforeCollectionFunction: beforeCollection, // Default `null` - Async function to call before we collect the page. Gets passed the Phantom page object and the webpage object.
        onCollectionFunction: onCollection, // Default `null` - Async function to call once we've collected the page, gets passed the Phantom page object as a parameter.
        evaluateFunction: evaluate, // Default `null` - Function to get evaluted in the scope of the page.
        afterEvaluateFunction: afterEvaluate, // Default `null` - Async function to get called after the evaluateFunction, gets passed the results of the evaluateFunction.
        onCompleteFunction: complete, // Default `null` - Function to get called when all urls have been processed.
        resourceRequestedFunction: resourceRequested, // Default `null` - Async function that gets called with the webpage requests a resource.
        resourceRecievedFunction: resourceRecieved, // Default `null` - Async function that gets called when the webpage recieves a resource.
        reportLocation: `${process.cwd()}/reports`, // Default `null` - If you want to output a status report to a file, specify the directory for its output. Leave `null` for no report files.
        reportFileName: `report-${now.getTime()}.txt`, // Default `report-${now.getTime()}.txt` - The name of the report file.
        jsonLocation: `${process.cwd()}/json`, // Default `null` - If you want to output results to a JSON file, specify the directory for its output. Leave `null` for no JSON files.
        jsonFileName: `json-${now.getTime()}.json`, // Default `json-${now.getTime()}.json` - The name of the JSON file.
        logLocation: `${process.cwd()}/logs`, // Default `null` - If you want to have a log file, specify the directory for its output. Leave `null` for no log files.
        logFileName: `log-${now.getTime()}.log`, // Default `log-${now.getTime()}.log` - The name of the log file.
        directoryLocation: `${process.cwd()}/files`, // Default `null` - Specify a directory to write files to.
        threads: 10, // Default `1` - How many pages you want to process concurrently.
        evaluateDelay: 2000, // Default `0` - Milliseconds to wait after the page loads before processing it. Allows JavaScript to run on the page before running the evaluate function.
        singlePage: false, // Default `false` - If `true` this will only run for the URL provided and won't continue scraping. Good for debugging how your code works for a specific page.
});

function start() {
    scraper.start();
}

function status(progress) {
    console.log('Percent Complete: ' + progress.percent);
    console.log('Pages Scraped: ' + progress.complete);
    console.log('Pages Found: ' + progress.total);
    console.log('Pages To Scrape: ' + progress.queued);
    console.log('Threads: ' + progress.threads);
    console.log('Pages Scraped Per Second: ' + progress.itemsPerSecond);
    console.log('Estimated Seconds Remaining: ' + progress.secondsRemaining);
}

async function beforeCollection(page, pageRecord) {
    page.clearCookies();
    scraper.logger.info(pageRecord.url.href);
}

async function onCollection(page, pageRecord) {
    pageRecord.cookies = await page.cookies();
}

async function evaluate() {
    return document.querySelectorAll('img');
}

async function afterEvaluate(evaluateResult, pageRecord) {
    pageRecord.images = [];

    if (evaluateResult) {
        for (var i = 0; i < evaluateResult.length; i++) {
            pageRecord.images.push(evaluateResult[i].src);
        }
    }

    scraper.addJsonRecord(pageRecord);
}

async function resourceRequested() {
    
}

async function resourceRecieved() {

}

function complete () {

}

```