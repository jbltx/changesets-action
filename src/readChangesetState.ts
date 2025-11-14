import type { PreState, NewChangeset } from "@changesets/types";
import { readPreState } from "@changesets/pre";
import readChangesets from "@changesets/read";
import { read as readConfig } from "@changesets/config";

export type ChangesetState = {
  preState: PreState | undefined;
  changesets: NewChangeset[];
};

export default async function readChangesetState(
  cwd: string = process.cwd()
): Promise<ChangesetState> {
  let preState = await readPreState(cwd);
  let changesets = await readChangesets(cwd);
  let config = await readConfig(cwd);

  // Filter out changesets based on ignored packages
  let filteredChangesets = changesets.filter((changeset) => {
    let packageNames = changeset.releases.map((release) => release.name);
    let ignoredPackageNames = packageNames.filter((name) =>
      config.ignore.includes(name)
    );

    // If all packages in the changeset are ignored, filter it out
    if (ignoredPackageNames.length === packageNames.length) {
      return false;
    }

    // If some (but not all) packages are ignored, throw an error
    if (ignoredPackageNames.length > 0) {
      throw new Error(
        `Changeset "${changeset.id}" includes both ignored and non-ignored packages. ` +
          `Ignored packages (${ignoredPackageNames.join(", ")}) should not have changesets associated with them. ` +
          `Please remove the changeset or adjust the ignore list.`
      );
    }

    return true;
  });

  if (preState !== undefined && preState.mode === "pre") {
    let changesetsToFilter = new Set(preState.changesets);

    return {
      preState,
      changesets: filteredChangesets.filter((x) => !changesetsToFilter.has(x.id)),
    };
  }

  return {
    preState: undefined,
    changesets: filteredChangesets,
  };
}
