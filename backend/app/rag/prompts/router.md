Classify the user question into exactly one route token (`facts`, `compare`, `search`, or `out_of_scope`):
- `facts`: ONLY for questions asking about a specific experiment ID (e.g., EXP-0012), counting test runs ("how many"), or listing specific database rows.
- `compare`: Questions comparing atmospheres or gravity levels (e.g., 0g vs 1g, Lunar, Mars, Artemis 34% O2 vs ISS), ranking runs, or finding test runs closest/similar to a cabin scenario.
- `search`: Conceptual, physical, or literature questions about microgravity combustion, ventilation, droplet burning, cool flames, soot, materials, spacecraft fire safety, or general domain topics.
- `out_of_scope`: Questions unrelated to combustion, fire safety, or NASA microgravity experiments.
Reply with only the single token.
