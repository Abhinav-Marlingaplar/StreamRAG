import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchTimeline, queryIncident } from "../lib/api";

function extractEntityId(queryText) {
	const match = String(queryText || "").toUpperCase().match(/\bINC-\d+\b/);
	return match ? match[0] : "INC-3001";
}

export default function Intelligence() {
	const [searchParams] = useSearchParams();
	const [query, setQuery] = useState("What is the latest status of INC-3001?");
	const [asOf, setAsOf] = useState("");
	const [loadingQuery, setLoadingQuery] = useState(false);
	const [result, setResult] = useState(null);
	const [queryError, setQueryError] = useState("");

	const [timelineEntity, setTimelineEntity] = useState("INC-3001");
	const [timeline, setTimeline] = useState([]);
	const [loadingTimeline, setLoadingTimeline] = useState(false);
	const [timelineError, setTimelineError] = useState("");

	useEffect(() => {
		const incomingEntity = searchParams.get("entity");
		if (incomingEntity) {
			const normalized = incomingEntity.trim().toUpperCase();
			setTimelineEntity(normalized);
			loadTimeline(normalized);
		}
	}, [searchParams]);

	const payload = useMemo(
		() => ({
			query,
			as_of: asOf || null,
		}),
		[asOf, query]
	);

	const runQuery = async (event) => {
		event.preventDefault();
		setLoadingQuery(true);
		setQueryError("");
		try {
			const data = await queryIncident(payload);
			setResult(data);
			const inferredEntity = extractEntityId(query);
			setTimelineEntity(inferredEntity);
		} catch (err) {
			setQueryError(err.response?.data?.detail || "Unable to run query.");
		} finally {
			setLoadingQuery(false);
		}
	};

	const loadTimeline = async (entityId = timelineEntity) => {
		setLoadingTimeline(true);
		setTimelineError("");
		try {
			const data = await fetchTimeline(entityId.trim().toUpperCase());
			setTimeline(data);
		} catch (err) {
			setTimeline([]);
			setTimelineError(err.response?.data?.detail || "Unable to load timeline.");
		} finally {
			setLoadingTimeline(false);
		}
	};

	return (
		<div className="page-stack">
			<section className="page-header">
				<h1>Intelligence</h1>
				<p className="muted">Run temporal queries, inspect citations, and verify timeline evolution in one workspace.</p>
			</section>

			<section className="split-layout">
				<div className="surface stack-gap">
					<h2>Query workspace</h2>
					<form
						className="stack-gap"
						onSubmit={runQuery}
					>
						<label className="field-label">Query</label>
						<textarea
							className="input textarea"
							onChange={(e) => setQuery(e.target.value)}
							rows={5}
							value={query}
						/>
						<label className="field-label">As-of time (optional)</label>
						<input
							className="input"
							onChange={(e) => setAsOf(e.target.value)}
							placeholder="2026-11-20T09:10:00Z"
							type="text"
							value={asOf}
						/>
						<div className="row">
							<button
								className="btn btn-primary"
								disabled={loadingQuery}
								type="submit"
							>
								{loadingQuery ? "Running..." : "Run query"}
							</button>
							<button
								className="btn btn-ghost"
								onClick={() => {
									setQuery("What was the status of INC-3001 at 2026-11-20T09:10:00Z?");
									setAsOf("2026-11-20T09:10:00Z");
								}}
								type="button"
							>
								Historical example
							</button>
							<button
								className="btn btn-ghost"
								onClick={() => {
									setQuery("List the latest mitigation for INC-3008 and summarize impact.");
									setAsOf("");
								}}
								type="button"
							>
								Current-state example
							</button>
						</div>
					</form>

					{queryError && <p className="error-text">{queryError}</p>}

					{result && (
						<>
							<div className="answer-block">
								<h3>Generated answer</h3>
								<p>{result.answer}</p>
								<p className="caption">query_time_used: {result.query_time_used}</p>
							</div>
							<details className="meta-details">
								<summary>Retrieval metadata</summary>
								{result.retrieval_diagnostics ? (
									<div className="meta-grid">
										<p>Tier: {result.retrieval_diagnostics.selected_tier}</p>
										<p>Classification: {result.retrieval_diagnostics.query_classification}</p>
										<p>K: {result.retrieval_diagnostics.selected_k}</p>
										<p>α: {result.retrieval_diagnostics.selected_alpha}</p>
										<p>λ: {result.retrieval_diagnostics.lambda_per_minute}</p>
										<p>St/Sr/Sc: {result.retrieval_diagnostics.st} / {result.retrieval_diagnostics.sr} / {result.retrieval_diagnostics.sc}</p>
									</div>
								) : (
									<p className="caption">No retrieval diagnostics returned.</p>
								)}
							</details>
							<div className="stack-gap">
								<h3>Evidence citations</h3>
								{result.citations?.length ? (
									result.citations.map((citation) => (
										<article
											className="citation-line"
											key={citation.knowledge_version_id}
										>
											<p>{citation.content}</p>
											<p className="caption">
												#{citation.knowledge_version_id} · {citation.valid_from} → {citation.valid_to || "current"}
											</p>
											<p className="caption">
												semantic={citation.semantic_similarity} · recency={citation.recency_score} · tar={citation.tar_score}
											</p>
										</article>
									))
								) : (
									<p className="muted">No citations returned for this query.</p>
								)}
							</div>
						</>
					)}
				</div>

				<div className="surface stack-gap intelligence-timeline-pane">
					<div className="row-between">
						<h2>Timeline inspector</h2>
						<div className="row">
							<input
								className="input input-inline"
								onChange={(e) => setTimelineEntity(e.target.value)}
								placeholder="INC-3001"
								type="text"
								value={timelineEntity}
							/>
							<button
								className="btn btn-ghost"
								onClick={() => loadTimeline(timelineEntity)}
								type="button"
							>
								Load
							</button>
						</div>
					</div>

					{loadingTimeline && <p className="muted">Loading timeline...</p>}
					{timelineError && <p className="error-text">{timelineError}</p>}
					{!loadingTimeline && !timelineError && timeline.length === 0 && <p className="caption">No timeline loaded yet.</p>}

					<div className="timeline-list">
						{timeline.map((row) => (
							<article
								className={`timeline-row ${row.is_current ? "current" : ""}`}
								key={row.id}
							>
								<div>
									<p>
										<strong>{row.status}</strong> · v{row.version}
									</p>
									<p className="caption">
										{row.valid_from} → {row.valid_to || "current"}
									</p>
								</div>
								<p>{row.content}</p>
							</article>
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
