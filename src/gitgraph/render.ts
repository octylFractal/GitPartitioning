import {Canvas, CanvasRenderingContext2D} from "canvas";
import {BranchRef, Commit, CommitHash, Ref, Repo} from "./repo";
import {fillPath, strokePath} from "../renderHelper";
import {error, setAll} from "../utils";
import chroma from "chroma-js";

const FONT = "14px monospace";

export function renderGitGraph(canvas: Canvas, repo: Repo, from: Ref): void {
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
    const circleDiameter = 15;
    render({
        data,
        ctx,
        circleDiameter,
        spacing: circleDiameter * 1.3,
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
    spacing: number;
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
            from: parent.hash,
            to: commitRef.hash,
        });

        if (seen.has(parent.hash)) {
            // skip this
            continue;
        }
        seen.add(parent.hash);

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

function render(context: RenderContext): void {
    const {data, ctx, circleDiameter, spacing, depthMult, maxTimestamp, maxDepth, branchColor} = context;
    for (const link of data.links) {
        const fromCommit = data.commits.get(link.from) || error("No `from` link");
        const toCommit = data.commits.get(link.to) || error("No `to` link");
        linkCommits(context, fromCommit, toCommit);
    }
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
    const {ctx, branchColor} = context;

    // if linking same depth:
    // - just draw A to B in their color
    // else:
    // - FROM = A
    // - if TS difference > 1:
    //   - draw from A until (B.ts - 1) in current branch,
    //     current branch color
    //   - FROM = b.ts - 1
    // - draw FROM to B
    //   - color is determined by the deepest branch

    ctx.lineCap = "round";
    const fromTs = from.commit.timestamp;
    const toTs = to.commit.timestamp;
    if (from.depth === to.depth) {
        drawLink(context, from.depth, fromTs, to.depth, toTs, branchColor(from.branch));
    } else {
        let fromY = fromTs;
        if (Math.abs(fromTs - toTs) > 1) {
            drawLink(context, from.depth, fromTs, from.depth, toTs - 1, branchColor(from.branch));
            fromY = toTs - 1;
        }
        const deepest = from.depth > to.depth ? from : to;
        drawLink(context, from.depth, fromY, to.depth, toTs, branchColor(deepest.branch));
    }
}

function drawLink(context: RenderContext,
                  fromX: number, fromY: number,
                  toX: number, toY: number,
                  color: string): void {
    const {ctx, circleDiameter, spacing, depthMult, maxTimestamp} = context;
    ctx.strokeStyle = color;
    ctx.lineWidth = circleDiameter / 5;
    strokePath(ctx, () => {
        ctx.moveTo(
            fromX * depthMult,
            (maxTimestamp - fromY) * spacing,
        );
        ctx.lineTo(
            toX * depthMult,
            (maxTimestamp - toY) * spacing,
        );
    });
    // fill it in by stroking smaller
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = circleDiameter / 10;
    ctx.stroke();
}
