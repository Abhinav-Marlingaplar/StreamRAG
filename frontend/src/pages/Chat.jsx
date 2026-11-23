import { useMemo, useState } from "react";
import { queryIncident } from "../lib/api";

export default function Chat() {
	const [query, setQuery] = useState("What is the current status of INC-1024?");
	const [asOf, setAsOf] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState(null);

	const payload = useMemo(
		() => ({
			query,
			as_of: asOf || null,
		}),
		[query, asOf]
	);

	const onSubmit = async (event) => {
		event.preventDefault();
		setLoading(true);
		setError("");
		try {
			const data = await queryIncident(payload);
			setResult(data);
		} catch (err) {
			setError(err.response?.data?.detail || "Unable to run query. Check backend and token.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="page-stack">
			<section className="page-header">
				<h1>Query Workspace</h1>
				<p className="muted">
					Run current-state or historical as-of queries. Every response should include evidence-backed citations.
				</p>
			</section>

			<section className="feature-grid-2">
				<form
					className="panel stack"
					onSubmit={onSubmit}
				>
					<h2>Ask StreamRAG</h2>
					<label className="field-label">Query</label>
					<textarea
						className="input textarea"
						onChange={(e) => setQuery(e.target.value)}
						rows={5}
						value={query}
					/>
					<label className="field-label">As-of timestamp (optional)</label>
					<input
						className="input"
						onChange={(e) => setAsOf(e.target.value)}
						placeholder="2026-09-26T10:30:00Z"
						type="text"
						value={asOf}
					/>
					<div className="row">
						<button
							className="btn btn-primary"
							disabled={loading}
							type="submit"
						>
							{loading ? "Running..." : "Run query"}
						</button>
						<button
							className="btn btn-ghost"
							onClick={() => {
								setQuery("What was the status of INC-1024 at 10:30?");
								setAsOf("");
							}}
							type="button"
						>
							Load historical example
						</button>
					</div>
					{error && <p className="error-text">{error}</p>}
				</form>

				<section className="panel stack">
					<h2>Generated answer</h2>
					{result ? (
						<>
							<div className="response-block">
								<p>{result.answer}</p>
							</div>
							<p className="caption">Query time used: {result.query_time_used}</p>
							{result.retrieval_diagnostics && (
								<div className="citation-card">
									<p>
										<strong>Retrieval tier:</strong> {result.retrieval_diagnostics.selected_tier}
									</p>
									<p className="caption">
										class={result.retrieval_diagnostics.query_classification} · K={result.retrieval_diagnostics.selected_k} · α=
										{result.retrieval_diagnostics.selected_alpha} · λ=
										{result.retrieval_diagnostics.lambda_per_minute}
									</p>
									<p className="caption">
										St={result.retrieval_diagnostics.st} · Sr={result.retrieval_diagnostics.sr} · Sc=
										{result.retrieval_diagnostics.sc}
									</p>
								</div>
							)}
							<h3>Citations</h3>
							<div className="stack">
								{result.citations?.length ? (
									result.citations.map((citation) => (
										<article
											className="citation-card"
											key={citation.knowledge_version_id}
										>
											<p>{citation.content}</p>
											<p className="caption">
												#{citation.knowledge_version_id} · {citation.valid_from} → {citation.valid_to || "current"}
											</p>
											{citation.tar_score !== undefined && citation.tar_score !== null && (
												<p className="caption">
													semantic={citation.semantic_similarity} · recency={citation.recency_score} · tar=
													{citation.tar_score} · Δt={citation.delta_minutes}m
												</p>
											)}
										</article>
									))
								) : (
									<p className="muted">No citations returned.</p>
								)}
							</div>
						</>
					) : (
						<p className="muted">No answer yet. Submit a query to render evidence and response.</p>
					)}
				</section>
			</section>
		</div>
	);
}
