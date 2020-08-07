import {async, markdown} from "../page/tagged-templates";
import {GraphContent, renderPage} from "../page/util";
import {Repo} from "../gitgraph/repo";

export const CONTENT = async`
<div class="container-md">
    <div class="jumbotron m-3">
        <h1 class="display-4">Git Partitioning</h1>
        <p class="lead">
        ${markdown({inline: true})`An alternative \`git\` management scheme.`}
        </p>
    </div>
    ${mainContent()}
</div>
`.then(renderPage);

async function mainContent(): Promise<string> {
    // language=Markdown
    return markdown`
# Introduction
While developing WorldEdit after 7.1.0, we quickly ran into a problem where the non-finalized features on the 
\`master\` branch prevented us from releasing very important bug-fixes that are also on \`master\`.
We should really have been able to put out a 7.1.1, 7.1.2, etc. to provide easier access to these small but
necessary fixes, such as UTF-8 for localization and biome math.

To alleviate this issue, I propose a new system of branch management for WorldEdit. This derives from
[Git Flow](https://nvie.com/posts/a-successful-git-branching-model/).

# The New Management
## Ideology
The primary ideology of this new branch management system is to **avoid being locked in to any version**.
We should never delay bug-fixes because we have a feature in the same branch, and we should never postpone minor
features because we introduced breaking changes.

## Branches
There are 6 types of branches:
1. \`master\` The main branch. It contains bug-fixes merged from \`release\`, and features merged from feature branches.
2. \`release\` - The secondary branch. It contains tagged release commits, and then _only_ bug-fixes. No feature
    branches are merged (directly) into \`release\`.
3. \`version/M.m.P\` - A temporary version branch that contains the bug-fixes being prepared for the next \`release\`.
4. \`bugfix/*\` - Bug-fix branches. These are optional, but should be used for larger bug-fixes or things which need
    approval. They are targeted to the \`version/M.m.P\` branch, not the \`master\` or \`release\` branches.
5. \`feature/*\` - Feature branches. These are non-optional. They are targeted to the \`master\` branch, not the
    \`release\` branch.
6. Any other branch (such as one for GitHub issue templates, or README updates) should target \`master\`, as it is the
    *main* branch.

With this model, we can continue to release bug-fixes while still adding new features without much hassle.

### Published Branches
Only two branches are published to Maven, \`master\` and \`release\`. Even though the bug-fixes go into a
    \`version/M.m.P\` branch, since they are also included in \`master\` there is no need to push a release to maven
    including these fixes. If a developer needs them for work, they should use \`master\`, or wait for a fresh
    \`release\`.

## Day-to-Day
If you've got a new bug-fix, it goes in the current \`version/M.m.P\` branch, or a new \`bugfix/*\` branch targeting the
version branch. If you've got a new feature, make a \`feature/*\` branch and PR it to \`master\`.

Besides the new rule for bug-fixes, not much changes here. If you need a bug-fix from a \`version/M.m.P\` branch, it may
be merged into \`master\` at any time for the price of one merge commit. Generally this shouldn't be needed, as big
bug-fixes will warrant triggering the *Patch Version Release Process* described below, which also merges the version
branch into \`master\`.

Any breaking changes should be avoided at all costs. If it is necessary to introduce breaking changes, or something has
been deprecated for over 6 months, a major version release may be triggered, but the actual breaking changes should
remain in a \`feature/*\` branch until we are ready to cut the release. Under no circumstances should a breaking change
remain in \`master\` for more than 24 hours without a major version release following it.

## Release Process
### Major/Minor Version
Assuming we are currently working on \`7.1.P-SNAPSHOT\` / \`7.2.0-SNAPSHOT\`:
1. If present, any \`version/7.1.P\` branches are merged into \`master\` and removed.
2. \`master\` is merged into \`release\`.
3. A commit is made to \`release\` changing the version to \`7.2.0\`.
4. A \`version/7.2.1\` branch is made from the tip of \`release\`.
5. A commit is made to \`version/7.2.1\` changing its version to \`7.2.1-SNAPSHOT\`
6. A commit is made to \`master\` changing its version to \`7.3.0-SNAPSHOT\`.

This process is the same for a major version, except that the version number changes in the major part for releasing.

### Patch Version
Assuming we are currently working on \`7.2.P-SNAPSHOT\` / \`7.3.0-SNAPSHOT\` (\`Q\` is the next patch version):
1. \`version/7.2.P\` is merged into \`release\` and \`master\`, then removed.
2. A commit is made to \`release\` changing the version to \`7.2.P\`.
3. A \`version/7.2.Q\` branch is made from the tip of \`release\`.
4. A commit is made to \`version/7.2.Q\` changing its version to \`7.2.Q-SNAPSHOT\`.

### Important Note about Merging Version Branches
One important part of merging any \`version/M.m.P\` branch into \`master\`, is that care must be taken not to overwrite
\`master\`'s version with the version branch's version. This should result in a merge-conflict normally, just be sure to
pick \`master\` as the winner of the conflict in this case.

## EAQ (Expected-to-be Asked Questions)
- Won't merging \`version/M.m.P\` into \`master\` create a lot of merge commits?
\t- Yes, but it is worth not being able to release crucial fixes to end users. If you have a better proposal on how we
could accomplish this, please write it up and present it.

(That's all the questions I expected!)
`;
}

function mainGraph(): GraphContent {
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

    return {
        repo,
        branch: "master",
    };
}
