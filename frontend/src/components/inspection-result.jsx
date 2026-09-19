export function AnalysisResult({ result }) {
  if (!result) return null;
  return <section>
    <h2>AI result</h2>
    <p>Inspection: {result.inspection_id}</p>
    <p>Model: {result.model}</p>
    <pre>{JSON.stringify(result.analysis, null, 2)}</pre>
  </section>;
}
