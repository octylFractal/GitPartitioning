#!/usr/bin/env node
import * as fs from "fs/promises";
import {registerFont} from "canvas";

const FILES = [
    "index",
];

async function main(): Promise<void> {
    const unlinks: Promise<void>[] = [];
    const directory = "./docs/img";
    for (const path of await fs.readdir(directory)) {
        unlinks.push(fs.unlink(`${directory}/${path}`));
    }
    await Promise.all(unlinks);
    registerFont("./src/ttf/JetBrainsMono-Regular.ttf", {
        family: "JetBrains Mono",
    });
    const renderings = new Map<string, Promise<void>>();
    for (const file of FILES) {
        console.log(`Rendering ${file}...`);
        renderings.set(file, renderToHtmlFile(file));
    }
    for (const [file, rendering] of renderings) {
        await rendering;
        console.log(`Finished rendering ${file}.`);
    }
}

interface ModuleWithContent {
    readonly CONTENT: Promise<string> | string;
}

async function renderToHtmlFile(file: string): Promise<void> {
    const content: string | undefined = await (import(`./docs/${file}`).then((x: ModuleWithContent) => x.CONTENT));
    if (typeof content === "undefined") {
        throw new Error(`No CONTENT variable exported from ${file}`);
    }
    await fs.writeFile(`./docs/${file}.html`, content);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
