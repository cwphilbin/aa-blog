Approved monthly-content baseline

The eleven approved assets are retained byte-for-byte, except the explicitly approved fresh HTML files 5, 6 and 10. Their desktop/mobile screenshots match the review originals. Desktop review files remain untouched.

manifest.json records SHA-256 hashes, exact 93536/90004 inputs, prompt/model versions, the user approval, and the comparison policy. video-evidence contains the approved native scene PNGs and actual render receipts. The four already-fresh comparison renders passed every 1fps SSIM sample at or above 0.99; audio, scene PNGs, captions/narration and Remotion props match exactly. Only generated bundle path comments and their derived app hash are ignored for file 9. All other HTML/metadata bytes must match.

Every repository deploy entrypoint runs content_gate.py. It requires the four pushed, clean sibling checkouts, real offline inputs, versioned prompts/models, and fresh candidate rendering. Install the video repo requirements-review.txt and its locked Node dependencies, plus the blog Node dependencies and Chrome. Missing prerequisites or any mismatch blocks deployment. There is no approve, refresh-baseline, or bypass command. Only explicit user approval of new review files permits a new baseline.

AI provider IDs/settings are pinned in the versioned files. Haiku 5.5 omits unsupported temperature with explicit user approval. Sonar sends temperature 0. Inworld sends 0, which its API treats as native default 1; existing measured Alex/Ashley audio is retained. Neither approved report contained county news, so no news example was invented. Render checks reuse the exact approved AI outputs/audio rather than requesting new stochastic provider output.
