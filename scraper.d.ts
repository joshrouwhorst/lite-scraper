declare namespace scraper {
    export class scraper {
        constructor (options: any);
        addJsonRecord(record: any): void;
        start(): void;
        resume(): void;
        pause(): void;
        stop(): void;
        logger: any;
    }
}

declare module "lite-scraper" {
    export = scraper;
}
