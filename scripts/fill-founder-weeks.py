#!/usr/bin/env python3
"""Fill the twelve-week chart from docs/founder-weeks.json.

Create the JSON by running this in the SQL Editor and pasting completion_pct
values (oldest → newest, last 12 weeks) as a JSON array:

  select date_trunc('week', i.date)::date as week,
         round(100.0 * count(*) filter (where i.status = 'completed')
               / nullif(count(*), 0), 1) as completion_pct
  from daily_schedule_instances i
  where i.user_id = 'd8c23a37-229f-4204-bf45-1c58684d385d'
    and i.date < current_date
    and i.status not in ('removed','rescheduled')
  group by 1 order by 1;

Example: [42.1, 38.0, ..., 79.5]
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEEKS = ROOT / "docs" / "founder-weeks.json"
HTML = ROOT / "docs" / "index.html"


def chart_html(pcts: list[float]) -> str:
    series = pcts[-12:]
    n = len(series)
    mx = max(max(series), 1.0)
    W, H, pad_t, pad_b, gap = 640, 140, 18, 28, 6
    bar_w = (W - gap * (n - 1)) / n
    rects = []
    for i, p in enumerate(series):
        h = max(4.0, (H - pad_t - pad_b) * (p / mx))
        x = i * (bar_w + gap)
        y = H - pad_b - h
        rects.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{h:.1f}" '
            f'rx="3" fill="currentColor" opacity="0.85"><title>{p:.0f}%</title></rect>'
        )
    first, last = series[0], series[-1]
    n_weeks = len(series)
    week_word = "week" if n_weeks == 1 else "weeks"
    # Muted label ink — matches --muted on the page; not currentColor (bars).
    label_fill = "#6B655B"  # --muted
    labels = (
        f'<text x="0" y="{H - 6}" font-size="13" fill="{label_fill}"'
        f' font-variant-numeric="tabular-nums">{first:.0f}%</text>'
        f'<text x="{W}" y="{H - 6}" font-size="13" fill="{label_fill}"'
        f' text-anchor="end" font-variant-numeric="tabular-nums">{last:.0f}%</text>'
    )
    svg = (
        f'<svg class="chart" viewBox="0 0 {W} {H}" width="100%" height="{H}" '
        f'role="img" aria-label="Weekly completion from {first:.0f} percent to '
        f'{last:.0f} percent over {n_weeks} {week_word}" '
        f'xmlns="http://www.w3.org/2000/svg">'
        f'{"".join(rects)}{labels}</svg>'
    )
    # Headline keeps the brief's "Twelve weeks" frame when we have ~12;
    # otherwise state the real count so we never invent a bar.
    if n_weeks == 12:
        headline = f"Twelve weeks. {first:.0f}% to {last:.0f}%."
    else:
        headline = f"{n_weeks} weeks. {first:.0f}% to {last:.0f}%."
    return f"""<!-- ================= PROOF: TWELVE WEEKS ================= -->
<section class="trend">
  <div class="wrap">
    <h2>{headline}</h2>
    <p class="lede">Nothing was added. The schedule got less wrong about me.</p>
    {svg}
  </div>
</section>

<hr class="rule">

"""


def main() -> None:
    if not WEEKS.exists():
        raise SystemExit(f"Missing {WEEKS} — paste the SQL completion_pct array first.")
    pcts = json.loads(WEEKS.read_text())
    if not isinstance(pcts, list) or len(pcts) < 8:
        raise SystemExit("founder-weeks.json must be a JSON array of at least 8 numbers")
    pcts = [float(x) for x in pcts]
    html = HTML.read_text()
    pat = re.compile(
        r"<!-- ================= PROOF: TWELVE WEEKS ================= -->.*?<hr class=\"rule\">\n\n",
        re.S,
    )
    if not pat.search(html):
        raise SystemExit("Could not find TWELVE WEEKS section in docs/index.html")
    HTML.write_text(pat.sub(chart_html(pcts), html, count=1))
    series = pcts[-12:]
    print(f"Wrote chart: {series[0]:.0f}% → {series[-1]:.0f}% ({len(series)} weeks)")


if __name__ == "__main__":
    main()
