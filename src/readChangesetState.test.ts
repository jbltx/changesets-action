import type { Changeset } from "@changesets/types";
import writeChangeset from "@changesets/write";
import fixturez from "fixturez";
import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import readChangesetState from "./readChangesetState.ts";

let f = fixturez(import.meta.dirname);

const linkNodeModules = async (cwd: string) => {
  await fs.symlink(
    path.join(import.meta.dirname, "..", "node_modules"),
    path.join(cwd, "node_modules")
  );
};

const writeChangesets = (changesets: Changeset[], cwd: string) => {
  return Promise.all(changesets.map((commit) => writeChangeset(commit, cwd)));
};

beforeEach(() => {
  // Nothing to clear for now...
});

describe("readChangesetState", () => {
  it("filters out changesets that only affect ignored packages", async () => {
    let cwd = f.copy("ignored-package");
    await linkNodeModules(cwd);

    // Write a changeset that only affects an ignored package
    await writeChangesets(
      [
        {
          releases: [
            {
              name: "ignored-package-pkg-a",
              type: "minor",
            },
          ],
          summary: "Change to ignored package only",
        },
      ],
      cwd
    );

    let state = await readChangesetState(cwd);

    // The changeset should be filtered out
    expect(state.changesets).toHaveLength(0);
  });

  it("includes changesets that affect non-ignored packages", async () => {
    let cwd = f.copy("ignored-package");
    await linkNodeModules(cwd);

    // Write a changeset that affects a non-ignored package
    await writeChangesets(
      [
        {
          releases: [
            {
              name: "ignored-package-pkg-b",
              type: "minor",
            },
          ],
          summary: "Change to non-ignored package",
        },
      ],
      cwd
    );

    let state = await readChangesetState(cwd);

    // The changeset should be included
    expect(state.changesets).toHaveLength(1);
    expect(state.changesets[0].releases[0].name).toBe("ignored-package-pkg-b");
  });

  it("throws an error when a changeset affects both ignored and non-ignored packages", async () => {
    let cwd = f.copy("ignored-package");
    await linkNodeModules(cwd);

    // Write a changeset that affects both ignored and non-ignored packages
    await writeChangesets(
      [
        {
          releases: [
            {
              name: "ignored-package-pkg-a", // ignored
              type: "minor",
            },
            {
              name: "ignored-package-pkg-b", // not ignored
              type: "minor",
            },
          ],
          summary: "Change to both ignored and non-ignored packages",
        },
      ],
      cwd
    );

    // Should throw an error
    await expect(readChangesetState(cwd)).rejects.toThrow(
      /includes both ignored and non-ignored packages/
    );
  });

  it("handles multiple changesets correctly", async () => {
    let cwd = f.copy("ignored-package");
    await linkNodeModules(cwd);

    // Write multiple changesets
    await writeChangesets(
      [
        {
          releases: [
            {
              name: "ignored-package-pkg-a", // ignored
              type: "minor",
            },
          ],
          summary: "Change to ignored package",
        },
        {
          releases: [
            {
              name: "ignored-package-pkg-b", // not ignored
              type: "minor",
            },
          ],
          summary: "Change to non-ignored package",
        },
      ],
      cwd
    );

    let state = await readChangesetState(cwd);

    // Only the non-ignored changeset should be included
    expect(state.changesets).toHaveLength(1);
    expect(state.changesets[0].releases[0].name).toBe("ignored-package-pkg-b");
  });

  it("works with repositories that have no ignored packages", async () => {
    let cwd = f.copy("simple-project");
    await linkNodeModules(cwd);

    // Write a changeset
    await writeChangesets(
      [
        {
          releases: [
            {
              name: "simple-project-pkg-a",
              type: "minor",
            },
          ],
          summary: "Change to package A",
        },
      ],
      cwd
    );

    let state = await readChangesetState(cwd);

    // The changeset should be included (no packages are ignored)
    expect(state.changesets).toHaveLength(1);
    expect(state.changesets[0].releases[0].name).toBe("simple-project-pkg-a");
  });
});
