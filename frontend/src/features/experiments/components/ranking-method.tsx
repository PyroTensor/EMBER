/** Plain-language guide to the fixed scoring rules in scenario_ranker.py. */
export function RankingMethod() {
  return (
    <div className="space-y-3 px-5 py-4 text-sm">
      <p className="text-fg">
        These runs are most relevant to your selected conditions. The score is a
        weighted comparison, not a predicted safety outcome.
      </p>
      <details className="group text-muted">
        <summary className="text-accent focus-visible:outline-accent cursor-pointer rounded-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
          How are the scores calculated?
        </summary>
        <div className="mt-3 space-y-3 text-xs leading-relaxed">
          <p>
            Each component scores from 0 to 100. The total is the weighted
            average: (similarity × its weight + completeness × its weight +
            criticality × its weight) ÷ the sum of the weights. The weights
            shown on this page are their shares of that sum.
          </p>
          <dl className="space-y-3">
            <div>
              <dt className="text-fg font-semibold">Similarity</dt>
              <dd>
                Compares the run with the selected scenario using oxygen,
                pressure, flow, and gravity. The numeric differences are scaled
                and combined: difference² is the weighted average of squared
                gaps after dividing oxygen by 25 percentage points, pressure by
                61.3 kPa, flow by 50 cm/s, and gravity by 1 g. Oxygen and
                gravity have weight 1; pressure and flow have weight 0.7.
                Similarity = 100 × exp(−8 × difference²) × material match ×
                diluent match × 0.85 per missing numeric field. A material match
                is 1 (otherwise 0.6); a diluent match is 1 (otherwise 0.9).
              </dd>
            </div>
            <div>
              <dt className="text-fg font-semibold">Completeness</dt>
              <dd>
                70 × (recorded optional outcomes ÷ 4) + 30 × (number of extra
                telemetry fields, capped at 6, ÷ 6). The optional outcomes are
                spread or burn rate, peak radiative flux, limiting oxygen index,
                and burn duration. This measures how much data is present, not
                its measurement quality.
              </dd>
            </div>
            <div>
              <dt className="text-fg font-semibold">Criticality</dt>
              <dd>
                60 × observed combustion-regime severity + 25 × peak radiative
                flux scaled to 10 kW/m² + 15 × the run&apos;s oxygen margin
                above its limiting oxygen index, scaled to 10 percentage points.
                Severity is 1 for sustained burn, 0.85 for cool flame, 0.4 for
                self-extinguished, and 0.1 for no ignition. Flux and oxygen
                margin are capped between 0 and 1; missing values contribute
                zero. This describes the observed run, not the predicted risk in
                the selected scenario.
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </div>
  );
}
