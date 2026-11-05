// React can include image URLs in HTTP Link preload headers, which require
// ASCII-safe values even when the original public asset has an Arabic filename.
export function publicAssetUrl(path,basePath=''){
 return encodeURI(`${basePath}${path}`);
}
