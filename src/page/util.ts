import markdownIt from "markdown-it";
import {POSTFIX, PREFIX} from "./shared-content";
import {outdent} from "outdent";
import {BranchRef, Repo} from "../gitgraph/repo";
import {Renderer} from "../gitgraph/render";
import {Canvas, createCanvas} from "canvas";
import fs from "fs/promises";

const renderer = markdownIt({
    html: true,
});

export interface MarkdownOptions {
    readonly inline?: boolean;
}

export function renderMarkdown(markdown: string, options: MarkdownOptions = {}): string {
    return options.inline ? renderer.renderInline(markdown) : renderer.render(markdown);
}

export function renderPage(content: string): string {
    return PREFIX + content + POSTFIX;
}

export interface GraphContent {
    readonly repo: Repo;
    readonly branch: string;
}

const PT_TO_PX = 4 / 3;

export async function branchGraph(id: string, alt: string, graph: GraphContent): Promise<string> {
    const {canvas, path} = await renderGraphToFile(id, graph);
    return outdent`
            <img
                alt="${alt}"
                src="./${path}"
                width="${canvas.width * PT_TO_PX}"
                height="${canvas.height * PT_TO_PX}"
                class="rounded mx-auto d-block bg-dark"/>`;
}

interface RenderedGraphContent {
    readonly canvas: Canvas;
    readonly path: string;
}

async function renderGraphToFile(id: string, graph: GraphContent): Promise<RenderedGraphContent> {
    const canvas = createCanvas(1280, 720, 'svg');

    new Renderer(canvas, graph.repo, '16px "JetBrains Mono"').render(new BranchRef(graph.repo, graph.branch));

    const path = "img/test.svg";
    await fs.writeFile(`./docs/${path}`, canvas.toBuffer());

    return {
        canvas,
        path,
    };
}
