import {Canvas, CanvasRenderingContext2D} from "canvas";
import {BranchRef, Commit, CommitHash, Ref, Repo} from "./repo";
import {fillPath, strokePath} from "../renderHelper";
import {error, setAll} from "../utils";
import chroma from "chroma-js";

interface PrepareContext {
    seen: Set<CommitHash>;
    branchDepth: number;
    branch: string | undefined;
}

export class Renderer {
    constructor(
        private readonly canvas: Canvas,
        private readonly repo: Repo,
        private readonly font: string,
    ) {
    }

    render(from: Ref): void {
        const data = this.prepareRender(true, from, {
            seen: new Set(),
            branchDepth: 0,
            branch: from instanceof BranchRef ? from.name : undefined,
        });
        const maxTimestamp = this.repo.resolveCommit(from.resolve()).timestamp;
        const maxDepth = Math.max(...Array.from(data.commits.values())
            .map(c => c.depth));
        const ctx = this.canvas.getContext("2d");
        ctx.font = this.font;
        const maxTextSize = Math.max(...Array.from(data.commits.values())
            .map(c => ctx.measureText(c.fullText).width));
        this.canvas.width = 40 + (maxDepth + 1) * 20 + maxTextSize;
        this.canvas.height = 40 + maxTimestamp * (20 * 1.25);
        ctx.translate(20, 20);
        new RenderHelper(
            this.font,
            data,
            ctx,
            15,
            20,
            maxTimestamp,
            maxDepth,
        ).render();
    }

    private prepareRender(head: boolean, ref: Ref, context: PrepareContext): RenderingData {
        const {seen, branchDepth, branch} = context;
        const commits = new Map<CommitHash, CommitRendering>();
        const links: LinkRendering[] = [];
        const commitRef = ref.resolve();
        const commit = this.repo.resolveCommit(commitRef);
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

            const parentBranch = parentDepthOffset === 0 ? branch : this.repo.asBranchTip(parent)?.name;
            const parentData = this.prepareRender(false, parent, {
                ...context,
                branchDepth: parentDepth,
                branch: parentBranch,
            });
            setAll(commits, parentData.commits);
            links.push(...parentData.links);
        }

        let parenText = head ? "HEAD" : "";
        const asBranchTip = this.repo.asBranchTip(ref);
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

class RenderHelper {
    private readonly branches: (string | undefined)[];
    private readonly colors = chroma.brewer.Pastel1;
    constructor(
        private readonly font: string,
       private readonly data: RenderingData,
       private readonly  ctx: CanvasRenderingContext2D,
       private readonly   circleDiameter: number,
       private readonly  depthMult: number,
       private readonly    maxTimestamp: number,
       private readonly   maxDepth: number,
    ) {
        this.branches = [...new Set([...data.commits.values()].map(x => x.branch))];
    }

    get spacing(): number {
        return this.circleDiameter * 1.3;
    }

    private branchColor(branch: string | undefined): string {
        return chroma(this.colors[this.branches.indexOf(branch) % this.colors.length]).darken().css();
    }

    render(): void {
        for (const link of this.data.links) {
            const fromCommit = this.data.commits.get(link.from) || error("No `from` link");
            const toCommit = this.data.commits.get(link.to) || error("No `to` link");
            this.linkCommits(fromCommit, toCommit);
        }
        for (const commit of this.data.commits.values()) {
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = this.branchColor(commit.branch);
            this.ctx.fillStyle = "#fefde7";
            const x = commit.depth * this.depthMult;
            const y = (this.maxTimestamp - commit.commit.timestamp) * this.spacing;
            const lineWidth = this.circleDiameter / 7;
            fillPath(this.ctx, () => {
                this.ctx.arc(
                    x,
                    y,
                    this.circleDiameter / 2 - lineWidth,
                    0,
                    360,
                );
            });
            this.ctx.lineWidth = lineWidth;
            this.ctx.stroke();

            this.ctx.save();

            this.ctx.lineWidth = 2;
            this.ctx.lineJoin = "round";
            this.ctx.font = this.font;
            this.ctx.textBaseline = "middle";
            this.ctx.strokeStyle = "black";
            this.ctx.strokeText(
                commit.fullText,
                (this.maxDepth + 1) * this.depthMult,
                y
            );
            this.ctx.fillStyle = this.branchColor(commit.branch);
            this.ctx.fillText(
                commit.fullText,
                (this.maxDepth + 1) * this.depthMult,
                y
            );

            this.ctx.restore();
        }
    }

    private linkCommits(from: CommitRendering, to: CommitRendering): void {
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

        this.ctx.lineCap = "round";
        const fromTs = from.commit.timestamp;
        const toTs = to.commit.timestamp;
        if (from.depth === to.depth) {
            this.drawLink(from.depth, fromTs, to.depth, toTs, this.branchColor(from.branch));
        } else {
            let fromY = fromTs;
            if (Math.abs(fromTs - toTs) > 1) {
                this.drawLink(from.depth, fromTs, from.depth, toTs - 1, this.branchColor(from.branch));
                fromY = toTs - 1;
            }
            const deepest = from.depth > to.depth ? from : to;
            this.drawLink(from.depth, fromY, to.depth, toTs, this.branchColor(deepest.branch));
        }
    }

    private drawLink(fromX: number, fromY: number,
                      toX: number, toY: number,
                      color: string): void {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = this.circleDiameter / 5;
        strokePath(this.ctx, () => {
            this.ctx.moveTo(
                fromX * this.depthMult,
                (this.maxTimestamp - fromY) * this.spacing,
            );
            this.ctx.lineTo(
                toX * this.depthMult,
                (this.maxTimestamp - toY) * this.spacing,
            );
        });
        // fill it in by stroking smaller
        this.ctx.strokeStyle = "#333333";
        this.ctx.lineWidth = this.circleDiameter / 10;
        this.ctx.stroke();
    }
}
