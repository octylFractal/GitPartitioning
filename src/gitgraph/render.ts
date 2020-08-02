import {Canvas, CanvasRenderingContext2D} from "canvas";
import {BranchRef, Commit, CommitHash, Ref, Repo} from "./repo";
import {fillPath, strokePath} from "../renderHelper";
import {error, setAll} from "../utils";
import chroma from "chroma-js";

const FONT = "14px monospace";

export async function renderGitGraph(canvas: Canvas, repo: Repo, from: Ref): Promise<void> {
    const data = prepareRender(true, from, {
        repo,
        seen: new Set(),
        branchDepth: 0,
        branch: from instanceof BranchRef ? from.name : undefined,
    });
    const maxTimestamp = repo.resolveCommit(from.resolve()).timestamp;
    const maxDepth = Math.max(...Array.from(data.commits.values())
        .map(c => c.depth));
    const ctx = canvas.getContext("2d");
    ctx.font = FONT;
    const maxTextSize = Math.max(...Array.from(data.commits.values())
        .map(c => ctx.measureText(c.fullText).width));
    canvas.width = 40 + (maxDepth + 1) * 20 + maxTextSize;
    canvas.height = 40 + maxTimestamp * (20 * 1.25);
    ctx.translate(20, 20);
    const branches = Array.from(new Set(Array.from(data.commits.values()).map(x => x.branch)));
    const colors = chroma.brewer.Pastel1;
    render({
        data,
        ctx,
        circleDiameter: 20,
        depthMult: 20,
        maxTimestamp,
        maxDepth,
        branchColor(branch: string | undefined): string {
            return chroma(colors[branches.indexOf(branch) % colors.length]).darken().css();
        }
    });
}

interface PrepareContext {
    repo: Repo;
    seen: Set<CommitHash>;
    branchDepth: number;
    branch: string | undefined;
}

interface RenderContext {
    data: RenderingData;
    ctx: CanvasRenderingContext2D;
    circleDiameter: number;
    depthMult: number;
    maxTimestamp: number;
    maxDepth: number;
    branchColor(branch: string | undefined): string;
}

interface LinkRendering {
    from: CommitHash;
    to: CommitHash;
}

interface CommitRendering {
    commit: Commit;
    depth: number;
    branch: string | undefined;
    fullText: string;
}

class RenderingData {
    constructor(
        readonly commits: Map<CommitHash, CommitRendering>,
        readonly links: LinkRendering[],
    ) {
    }
}

function prepareRender(head: boolean, ref: Ref, context: PrepareContext): RenderingData {
    const {repo, seen, branchDepth, branch} = context;
    const commits = new Map<CommitHash, CommitRendering>();
    const links: LinkRendering[] = [];
    const commitRef = ref.resolve();
    const commit = repo.resolveCommit(commitRef);
    for (const [parentDepthOffset, parent] of commit.parents.entries()) {
        const parentDepth = branchDepth + parentDepthOffset;
        links.push({
            from: commitRef.hash,
            to: parent.hash,
        });

        if (seen.has(parent.hash)) {
            // skip this
            continue;
        }
        seen.add(parent.hash);

        // draw the actual commit later
        const parentBranch = parentDepthOffset === 0 ? branch : repo.asBranchTip(parent)?.name;
        const parentData = prepareRender(false, parent, {
            ...context,
            branchDepth: parentDepth,
            branch: parentBranch,
        });
        setAll(commits, parentData.commits);
        links.push(...parentData.links);
    }

    let parenText = head ? "HEAD" : "";
    const asBranchTip = repo.asBranchTip(ref);
    if (typeof asBranchTip !== "undefined") {
        if (head) {
            if (ref instanceof BranchRef) {
                parenText += ` -> ${asBranchTip.name}`;
            } else {
                parenText += `, ${asBranchTip.name}`;
            }
        } else {
            parenText = asBranchTip.name;
        }
    }
    const fullText = commit.description + (parenText ? ` (${parenText})` : "");

    commits.set(commitRef.hash, {
        commit,
        depth: branchDepth,
        branch,
        fullText,
    });

    return new RenderingData(commits, links);
}

function calculateSpacing(context: RenderContext): number {
    return context.circleDiameter * 1.25;
}

function render(context: RenderContext): void {
    const {data, ctx, circleDiameter, depthMult, maxTimestamp, maxDepth, branchColor} = context;
    for (const link of data.links) {
        const fromCommit = data.commits.get(link.from) || error("No `from` link");
        const toCommit = data.commits.get(link.to) || error("No `to` link");
        linkCommits(context, fromCommit, toCommit);
    }
    const spacing = calculateSpacing(context);
    for (const commit of data.commits.values()) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = branchColor(commit.branch);
        ctx.fillStyle = "#fefde7";
        const x = commit.depth * depthMult;
        const y = (maxTimestamp - commit.commit.timestamp) * spacing;
        const lineWidth = circleDiameter / 7;
        fillPath(ctx, () => {
            ctx.arc(
                x,
                y,
                circleDiameter / 2 - lineWidth,
                0,
                360,
            );
        });
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        ctx.save();

        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.font = FONT;
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "black";
        ctx.strokeText(
            commit.fullText,
            (maxDepth + 1) * depthMult,
            y
        );
        ctx.fillStyle = branchColor(commit.branch);
        ctx.fillText(
            commit.fullText,
            (maxDepth + 1) * depthMult,
            y
        );

        ctx.restore();
    }
}

function linkCommits(context: RenderContext,
                     from: CommitRendering,
                     to: CommitRendering): void {
    const {ctx, circleDiameter, depthMult, maxTimestamp, branchColor} = context;
    const spacing = calculateSpacing(context);
    ctx.strokeStyle = branchColor(resolveBranch(from, to));
    ctx.lineWidth = circleDiameter / 5;
    strokePath(ctx, () => {
        ctx.moveTo(
            from.depth * depthMult,
            (maxTimestamp - from.commit.timestamp) * spacing
        );
        ctx.lineTo(
            to.depth * depthMult,
            (maxTimestamp - to.commit.timestamp) * spacing
        );
    });
    // fill it in by stroking smaller
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = circleDiameter / 10;
    ctx.stroke();
}

function resolveBranch(from: CommitRendering, to: CommitRendering): string | undefined {
    if (from.depth >= to.depth) {
        // same branch OR merge
        return from.branch;
    } else {
        // split
        return to.branch;
    }
}
