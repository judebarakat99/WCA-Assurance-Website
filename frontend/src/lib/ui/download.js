// Hands a file made in the browser to the person: a Blob (or text) saved under the given name.

/** Save data (a Blob, bytes or text) as a file named name. */
export function downloadFile(name, data, type = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
}
