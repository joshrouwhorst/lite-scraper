const phantom = require('phantom');
const fs = require('fs');
const { qbp } = require('qbp');
var winston = require('winston');
var chalk = require('chalk');

function Scraper(options) {
    var _this = this;
    var now = new Date();
    var pages = {};

    var opts = {
        url: null, // Topmost URL of the page you'd like to scrape.
        statusInterval: null, // How often do you want to get updates on status. Default is `null` and no status updates.
        statusFunction: null, // Function to call with status updates. If you supply a statusInterval and no statusFunction, we'll use the package's default status function.
        beforeCollectionFunction: null, // Async function to call before we collect the page. Gets passed the Phantom page object and the webpage object.
        onCollectionFunction: null, // Async function to call once we've collected the page, gets passed the Phantom page object as a parameter.
        evaluateFunction: null, // Function to get evaluted in the scope of the page.
        afterEvaluateFunction: null, // Async function to get called after the evaluateFunction, gets passed the results of the evaluateFunction.
        onCompleteFunction: null, // Function to get called when all urls have been processed.
        resourceRequestedFunction: null, // Async function that gets called with the webpage requests a resource.
        resourceRecievedFunction: null, // Async function that gets called when the webpage recieves a resource.
        reportLocation: null, // If you want to output a status report to a file, specify the directory for its output.
        reportFileName: `report-${now.getTime()}.txt`,
        jsonLocation: null, // If you want to output results to a JSON file, specify the directory for its output.
        jsonFileName: `json-${now.getTime()}.json`,
        logLocation: null, // If you want to have a log file, specify the directory for its output.
        logFileName: `log-${now.getTime()}.log`,
        directoryLocation: null, // Specify a directory to write files to.
        threads: 1, // How many pages you want to process concurrently.
        evaluateDelay: 0, // Allows JavaScript to run on the page before running the evaluate function.
        singlePage: false, // Only run for the URL provided. Don't continue scraping. Good for debugging.
    };

    var startTime = null;
    var instance = null;
    var urlQueue = null;
    var jsonObject = [];
    var silentLogger = winston.createLogger({ silent: true }); // Suppress output from the scraped page. Eventually add option to capture this if desired.
    
    setOptions();
    setupDirectories();

    var logger = null;
    if (opts.logLocation) {
        logger = winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            transports: [
                new winston.transports.File({ filename: `${opts.logLocation}/${opts.logFileName}` })
            ]
        });
    }

    async function start() {
        _this.status = 'running';
        startTime = new Date();

        instance = await phantom.create([], {
            logger: silentLogger
        });

        pages[opts.url.href] = new PageRecord(opts.url);
    
        urlQueue = new qbp({
            name: 'UrlQueue',
            items: [opts.url],
            threads: opts.threads,
            progress: status,
            progressInterval: opts.statusInterval,
            empty: end,
            process: processPage,
            async: true,
        });
    }

    async function createPage() {
        return instance.createPage();
    }

    async function openPage(page, url) {
        var pageRecord = pages[url.href];

        if (opts.beforeCollectionFunction) {
            await opts.beforeCollectionFunction(page, pageRecord);
        }

        if (opts.resourceRequestedFunction) {
            page.onResourceRequested((requestData, networkRequest) => { opts.resourceRequestedFunction(page, pageRecord, requestData, networkRequest); });
        }

        if (opts.resourceRecievedFunction) {
            page.onResourceRecieved((responseData) => { opts.resourceRecievedFunction(page, pageRecord, responseData); });
        }

        return page.open(url.href);
    }

    async function handlePage(page, url) {
        var pageRecord = pages[url.href];
        return new Promise((resolve) => {
            // Allow the page's javascript to run for the specified amount of time before starting.
            setTimeout(async () => {
                if (_this.status === 'stopped') {
                    resolve();
                    return;
                }

                if (!opts.singlePage) {
                    // Find links to scrape
                    var links = await page.evaluate(evaluate);
                    for (var i = 0; i < links.length; i++) {
                        addLink(links[i]);
                    }
                }

                // Pass the functionality to the user's code.
                var evalResults = null;
                if (opts.onCollectionFunction) await opts.onCollectionFunction(page, pageRecord);
                if (opts.evaluateFunction) evalResults = await page.evaluate(opts.evaluateFunction);
                if (opts.afterEvaluateFunction) await opts.afterEvaluateFunction(evalResults, pageRecord);

                page.close();
                resolve();
            }, opts.evaluateDelay);
        });
    }

    async function processPage(url, queue) {
        try {
            var page = await createPage();
            await openPage(page, url);
            await handlePage(page, url);
        }
        catch (err) {
            console.error(`lite-scraper: Error while processing ${url.href}.`);
            console.error(err.message);
        }
    }

    async function saveFile(url) {
        // TODO: Take url, download it and save it to the directoryLocation provided
    }

    function setOptions() {
        for (var opt in options) {
            opts[opt] = options[opt];
        }

        if (!opts.url) {
            throw new Error('`url` is a required option for Scraper.');
        }
        else {
            opts.url = getUrl(opts.url);
        }

        if (!opts.statusFunction) {
            opts.statusInterval = null;
        }
    }

    function evaluate() {
        var links = document.querySelectorAll('a');
        var hrefs = [];
    
        for (var i = 0; i < links.length; i++) {
            hrefs.push(links[i].href);
        }
    
        return hrefs;
    }

    function addLink(url) {
        if (!url.trim()) return null;
    
        if (url.indexOf('javascript:') === 0) {
            // Skip javascript: links
            return null;
        }
    
        url = getUrl(url);
    
        if (url.host !== opts.url.host && url.href.indexOf('/') !== 0) {
            // Skip external pages
            return null;
        }
    
        if (url.protocol === 'mailto:') {
            // Skip mailto: links
            return null;
        }
    
        if (!pages[url.href]) {
            pages[url.href] = new PageRecord(url);
            urlQueue.add(url);
            return url;
        }
    
        return null;
    }

    function status(prog) {
        var report;

        if (opts.statusFunction) report = opts.statusFunction(prog);
        else report = defaultStatus(prog);

        if (report && opts.reportLocation) {
            try {
                fs.writeFile(`${opts.reportLocation}/${opts.reportFileName}`, report, (err) => {
                    if (err) {
                        console.error(`lite-scraper: Problem writing to report file ${opts.reportLocation}/${opts.reportFileName}`);
                        console.error(err.message);
                    }
                });
            }
            catch (e) {
                console.error(`lite-scraper: Problem writing to report file ${opts.reportLocation}/${opts.reportFileName}`);
                console.error(e.message);
            }
        }
    }

    function defaultStatus(prog) {
        var now = new Date();
        var minutes = Math.ceil(prog.secondsRemaining / 60);

        console.log(chalk.yellow.bold('\n*** STATUS UPDATE ***\n'));

        var report = `Start Time: ${startTime}\n`;
        report += `Current Time: ${now}\n`;
        report += `Threads: ${prog.threads}\n`;
        report += `Pages to Crawl: ${prog.queued}\n`;
        report += `Pages Crawled: ${prog.complete}\n`;
        report += `Estimated Minutes Left: ${minutes}\n`;
    
        console.log(chalk.yellow(report));
    
        console.log(chalk.yellow.bold('*** END STATUS ***\n'));

        return report;
    }

    function addJsonRecord(json) {
        jsonObject.push(json);

        if (opts.jsonLocation) {
            fs.writeFileSync(`${opts.jsonLocation}/${opts.jsonFileName}`, JSON.stringify(jsonObject, null, 4));
        }
    }

    function setupDirectories() {
        if (opts.logLocation && !fs.existsSync(opts.logLocation)) {
            fs.mkdirSync(opts.logLocation);
        }

        if (opts.reportLocation && !fs.existsSync(opts.reportLocation)) {
            fs.mkdirSync(opts.reportLocation);
        }

        if (opts.jsonLocation && !fs.existsSync(opts.jsonLocation)) {
            fs.mkdirSync(opts.jsonLocation);
        }

        if (opts.directoryLocation && !fs.existsSync(opts.directoryLocation)) {
            fs.mkdirSync(opts.directoryLocation);
        }
    }

    function getPageRecord(url) {
        if (pages[url]) return pages[url];
        else return null;
    }

    function getUrl(url) {
        // Don't want to have to deal with www.google.com not
        // being equal to google.com.
        if (url.indexOf('www.') > -1) {
            url = url.replace('www.', '');
        }
    
        if (url.indexOf('/') === 0) {
            // Setup internal links get parsed by URL object.
            url = `${opts.url.href}${url}`;
            url = url.replace('//', '/');
        }
    
        if (url.indexOf('https://') <= -1 && url.indexOf('http://') <= -1) {
            url = `http://${url}`;
        }
        
        return new URL(url);
    }

    function end() {
        _this.status = 'complete';
        instance.exit();
        if (opts.onCompleteFunction) opts.onCompleteFunction();
    }

    function pause() {
        _this.status = 'paused';
        if (urlQueue) urlQueue.pause();
    }

    function resume() {
        _this.status = 'running';
        if (urlQueue) urlQueue.resume();
    }

    function stop() {
        _this.status = 'stopped';
        if (urlQueue) urlQueue.empty();
    }

    this.addJsonRecord = addJsonRecord;
    this.getPageRecord = getPageRecord;
    this.start = start;
    this.pause = pause;
    this.resume = resume;
    this.stop = stop;
    this.logger = logger;
}

function PageRecord(url) {
    this.url = url;
}

module.exports = Scraper;