/**
 * Site-wide constants. The repository URL powers the "edit this lesson"
 * links; update it here if the repo moves.
 */
import { lessonDiskPath } from "./curriculum";

export const GITHUB_REPO_URL =
  "https://github.com/rosicrucian-dev/agelesswisdom";

export function lessonEditUrl(sectionId: string, lessonId: string): string {
  let { dir, file } = lessonDiskPath(sectionId, lessonId);
  return `${GITHUB_REPO_URL}/blob/main/content/lessons/en/${dir}/${file}.mdx`;
}
