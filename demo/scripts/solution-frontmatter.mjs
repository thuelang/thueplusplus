/** Slug of a solution title. Mirrors metrics/versions.py slugify. */

export class SolutionFrontmatterError extends Error {}

export function slugify(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new SolutionFrontmatterError(`title ${JSON.stringify(title)} has an empty slug`)
  return slug
}
