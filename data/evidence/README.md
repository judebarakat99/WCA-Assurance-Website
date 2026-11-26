# Demo evidence documents

`demo-documents/` holds fictional contractor documents (drawings, test reports,
a FIFA circular and a scanned site note) for demonstrating the Evidence page.
Drop them on the page: the agent reads each PDF in the browser
(`frontend/src/lib/intake`), matches it to requirements in the register, and
shows what confirming would record. Nothing is recorded until you confirm; then
the evidence joins the review queue, marked new.

`Scanned_Site_Note_0042.pdf` has no readable text, so the agent identifies it
from its file name only.
