/** Local public assets need the same build-time prefix as Next's JS/CSS. */
export function publicAsset(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}
