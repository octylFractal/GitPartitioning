import {async, markdown} from "../page/tagged-templates";
import {branchGraph, GraphContent, renderPage} from "../page/util";
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
[Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) and
[Git V](https://mergebase.com/doing-git-wrong/2018/06/04/git-v-an-optimal-git-branching-model/).

# The New Management
## Ideology
The primary ideology of this new branch management system is to **avoid being locked in to any version**.
We should never delay bug-fixes because we have a feature in the same branch, and we should never postpone minor
features because we introduced breaking changes.

## Branches
There are 5 types of branches:
1. \`master\` The main branch. It contains bug-fixes merged from version branches, and features merged from feature
    branches.
2. \`version/M.m.X\` - Version branches that contains bug-fixes for the features in version \`M.m.0\`.
3. \`bugfix/*\` - Bug-fix branches. These are optional, but should be used for larger bug-fixes or things which need
    approval. They are targeted to the \`version/M.m.X\` branch, not the \`master\` branch.
4. \`feature/*\` - Feature branches. These are non-optional. They are targeted to the \`master\` branch, not the
    \`version/M.m.X\` branches.
5. Any other branch (such as one for GitHub issue templates, or README updates) should target \`master\`, as it is the
    *main* branch.

With this model, we can continue to release bug-fixes while still adding new features without much hassle.

### Published Branches
Only two types of branches are published to Maven, \`master\` and \`version/M.m.X\`. Developers can choose the
appropriate branch based on their work.

## Day-to-Day
If you've got a new bug-fix, it goes in the current \`version/M.m.X\` branch, or a new \`bugfix/*\` branch targeting the
version branch. If you've got a new feature, make a \`feature/*\` branch and PR it to \`master\`.

Besides the new rule for bug-fixes, not much changes here. If you need a bug-fix from a \`version/M.m.X\` branch, it may
be merged into \`master\` at any time for the price of one merge commit.

Any breaking changes should be avoided at all costs. If it is necessary to introduce breaking changes, or something has
been deprecated for over 6 months, a major version release may be triggered, but the actual breaking changes should
remain in a \`feature/*\` branch until we are ready to cut the release. Under no circumstances should a breaking change
remain in \`master\` for more than 24 hours without a major version release following it.

### With Regard To Minecraft Versions
For the purposes of this document, a new Minecraft release is usually considered to be a _bugfix_, unless it requires
us to introduce a new feature for some reason.

## Release Process

### Patch Version
Assuming we are currently working on \`7.2.P-SNAPSHOT\` / \`7.3.0-SNAPSHOT\` (\`Q\` is the next patch version):
1. A commit is made to \`version/7.2.X\` changing the version to \`7.2.P\`.
2. The commit is tagged with \`7.2.P\`.
3. A commit is made to \`version/7.2.X\` changing the version to \`7.2.Q-SNAPSHOT\`.

### Major/Minor Version
Assuming we are currently working on \`7.1.P-SNAPSHOT\` / \`7.2.0-SNAPSHOT\`:
1. If present, the \`version/7.1.X\` branch is merged into \`master\`.
2. A commit is made to \`master\` changing the version to \`7.2.0\`.
3. The commit is tagged with \`7.2.0\`.
4. A \`version/7.2.X\` branch is made from the tip of \`master\`.
5. A commit is made to \`version/7.2.X\` changing its version to \`7.2.1-SNAPSHOT\`
6. A commit is made to \`master\` changing its version to \`7.3.0-SNAPSHOT\`.

This process is the same for a major version, except that the version number changes in the major part for releasing.

### Beta and Release Candidate Versions
This is a special case, as we want to continue working in the same snapshot after these are dropped.
It is very similar to Major/Minor as they are always created for the \`master\` branch.

These versions should be formatted as \`M.m.P-tagN\`, where \`tag\` is either \`beta\` or \`rc\`, and \`N\` is at
least 1.

Assuming we are currently working on \`7.1.P-SNAPSHOT\` / \`7.2.0-SNAPSHOT\`, releasing \`7.2.0-rc1\`:
1. If present, the \`version/7.1.X\` branch is merged into \`master\`.
    - This is done to ensure bugs are not reported again.
2. A commit is made to \`master\` changing the version to \`7.2.0-rc1\`.
3. The commit is tagged with \`7.2.0-rc1\`.
6. A commit is made to \`master\` changing its version to \`7.2.0-SNAPSHOT\`.

### Example
A simple example including both normal processes.
${await branchGraph("release-process", "Release Process", releaseProcessGraph())}

### Important Note about Merging Version Branches
One important part of merging any \`version/M.m.X\` branch into \`master\`, is that care must be taken not to overwrite
\`master\`'s version with the version branch's version. This should result in a merge-conflict normally, just be sure to
pick \`master\` as the winner of the conflict in this case.

## EAQ (Expected-to-be Asked Questions)
- Won't merging \`version/M.m.X\` into \`master\` create a lot of merge commits?
	- Yes, but it is worth not being able to release crucial fixes to end users. If you have a better proposal on how we
could accomplish this, please write it up and present it.

(That's all the questions I expected!)
`;
}

function releaseProcessGraph(): GraphContent {
    const repo = new Repo();

    // Minor version process
    repo.commit("Initial commit");
    repo.commit("Version 7.2.0");

    repo.checkout("version/7.2.X", {createBranch: true});
    repo.commit("Bump to 7.2.1-SNAPSHOT for development");

    repo.checkout("master");

    repo.commit("Bump to 7.3.0-SNAPSHOT for development");

    // Show some separate work
    repo.checkout("feature/work-on-stuff", {createBranch: true});
    repo.commit("Add a feature!");

    repo.checkout("master");

    repo.merge("feature/work-on-stuff");

    repo.checkout("version/7.2.X");
    repo.commit("Fix a bug");

    // Patch version process
    repo.commit("Version 7.2.1");
    repo.commit("Bump to 7.2.2-SNAPSHOT for development");

    repo.checkout("master");
    repo.merge("version/7.2.X");

    return {
        repo,
        branch: "master",
    };
}
