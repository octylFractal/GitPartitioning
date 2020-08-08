import {createHash} from "crypto";
import {error} from "../utils";

export type CommitHash = string;

export interface Ref {
    resolve(): CommitRef;

    tryResolve(): CommitRef | undefined;

    /**
     * Describe this in a short format for display.
     */
    describe(): string;
}

/**
 * Note: this interface does not include a hash, use {@link #hashCommit}.
 */
export interface Commit {
    readonly description: string;
    /**
     * A fake timestamp. Can be used for ordering purposes.
     */
    readonly timestamp: number;
    readonly parents: readonly CommitRef[];
}

export class CommitRef implements Ref {
    static fromCommit(commit: Commit): CommitRef {
        return new CommitRef(hashCommit(commit));
    }

    constructor(
        readonly hash: CommitHash
    ) {
    }

    resolve(): CommitRef {
        return this;
    }

    tryResolve(): CommitRef {
        return this;
    }

    describe(): string {
        return this.hash.substring(0, 7);
    }
}

export class BranchRef implements Ref {
    constructor(
        private readonly repo: Repo,
        readonly name: string,
    ) {
    }

    resolve(): CommitRef {
        return this.repo.resolveBranch(this.name);
    }

    tryResolve(): CommitRef | undefined {
        return this.repo.tryResolveBranch(this.name);
    }

    describe(): string {
        return this.name;
    }
}

export function hashCommit(commit: Commit): CommitHash {
    return createHash("sha256").update(JSON.stringify(commit)).digest("hex");
}

export interface CheckoutOptions {
    createBranch?: boolean,
}

export class Repo {

    private commitTimestamp = 0;
    private readonly commits: Map<CommitHash, Commit> = new Map();
    private readonly internalBranches: Map<string, Ref> = new Map();
    private readonly branchIndexes: string[] = [];
    private internalCurrentHead: Ref = new BranchRef(this, "master");

    resolveBranch(name: string): CommitRef {
        return this.tryResolveBranch(name) || error(`Unknown branch ${name}`);
    }

    tryResolveBranch(name: string): CommitRef | undefined {
        return this.internalBranches.get(name)?.tryResolve();
    }

    branchIndex(name: string | undefined): number {
        return typeof name === "undefined" ? 0 : this.branchIndexes.indexOf(name) + 1;
    }

    resolveCommit(ref: CommitRef): Commit {
        return this.commits.get(ref.hash) || error(`Unknown commit ${ref.hash}`);
    }

    get currentHead(): Ref {
        return this.internalCurrentHead;
    }

    set currentHead(head: Ref) {
        this.internalCurrentHead = head;
    }

    asBranchTip(ref: Ref): BranchRef | undefined {
        if (ref instanceof BranchRef) {
            return ref;
        }
        const refHash = ref.resolve().hash;
        return Array.from(this.internalBranches.entries())
            .filter(([, v]) => v.resolve().hash === refHash)
            .map(([k]) => new BranchRef(this, k))[0];
    }

    commit(description: string): CommitRef {
        return this.createCommit(
            description,
            [this.currentHead.tryResolve()]
                .filter((x): x is CommitRef => typeof x !== "undefined"),
        );
    }

    private createCommit(description: string, parents: readonly CommitRef[]): CommitRef {
        const commit = {
            description,
            timestamp: this.commitTimestamp++,
            parents,
        };
        const ref = CommitRef.fromCommit(commit);
        this.commits.set(ref.resolve().hash, commit);
        const head = this.currentHead;
        if (head instanceof BranchRef) {
            if (this.branchIndex(head.name) === -1) {
                this.branchIndexes.push(head.name);
            }
            this.internalBranches.set(head.name, ref);
        } else {
            this.currentHead = ref;
        }
        return ref;
    }

    checkout(ref: Ref | string, options: CheckoutOptions = {}): void {
        if (typeof ref === "string") {
            ref = new BranchRef(this, ref);
        }
        if (ref instanceof BranchRef) {
            if (!this.internalBranches.has(ref.name)) {
                if (options.createBranch) {
                    this.branchIndexes.push(ref.name);
                    this.internalBranches.set(ref.name, this.currentHead);
                } else {
                    throw new Error(`No branch with name ${ref.name}`);
                }
            }
        }
        this.currentHead = ref;
    }

    merge(ref: Ref | string): void {
        if (typeof ref === "string") {
            ref = new BranchRef(this, ref);
        }
        const currentHead = this.currentHead.resolve();
        if (typeof currentHead === "undefined") {
            throw new Error("Merging into a non-existent HEAD!");
        }
        const refHash = ref.resolve();
        if (typeof refHash === "undefined") {
            throw new Error("Merging from a non-existent ref!");
        }
        this.createCommit(`Merge ${ref.describe()} into ${this.currentHead.describe()}`, [
            currentHead, refHash,
        ]);
    }

    withHead(ref: Ref | string, block: (repo: Repo) => void): void {
        const old = this.currentHead;
        this.checkout(ref);
        block(this);
        this.checkout(old);
    }

}
