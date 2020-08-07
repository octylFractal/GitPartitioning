#!/usr/bin/env node
import * as fs from "fs/promises";
import {createCanvas} from "canvas";
import {renderGitGraph} from "./gitgraph/render";
import {BranchRef, Repo} from "./gitgraph/repo";

async function main(): Promise<void> {
    const repo = new Repo();

    repo.commit("Initial commit");

    repo.checkout("develop", {createBranch: true});
    repo.commit("Add TypeScript");

    repo.checkout("a-feature", {createBranch: true});
    repo.commit("Make it work");
    repo.commit("Make it right");

    repo.withHead("develop", () => {
        repo.commit("Another developer's work");
    });

    repo.merge("master");

    repo.commit("Make it fast");

    repo.checkout("develop");
    repo.commit("A");
    repo.commit("B");
    repo.commit("C");
    repo.merge("a-feature");
    repo.commit("Prepare v1");

    repo.checkout("master");
    repo.merge("develop");

    const canvas = createCanvas(1280, 720, 'svg');

    renderGitGraph(canvas, repo, new BranchRef(repo, "master"));

    await fs.writeFile("./test.svg", canvas.toBuffer());
}

main().catch(err => console.error(err));
