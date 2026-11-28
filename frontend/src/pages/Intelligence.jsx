import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePipeline } from "../app/PipelineContext";
import { Icon } from "../app/icons";
import { Badge, Button, EmptyState, ErrorBanner, Skeleton } from "../app/ui";
import { fetchTimeline, queryIncident } from "../lib/api";
import { errorMessage, formatDuration, formatUtc, humanize, statusTone } from "../lib/format";

const ENTITY_RE = /\bINC-\d+\b/i;

const toAsOfIso = (value) => {
	if (!value) return null;
	return value.length === 16 ? `${value}:00Z` : `${value}Z`;
};

const fromIso = (iso) => new Date(iso).toISOString().slice(0, 16);

function buildSuggestions(events) {
	const persisted = events.filter((event) => event.ingested_at);
	if (!persisted.length) return [];
	const entityId = persisted[0].entity_id;
	const history = persisted
		.filter((event) => event.entity_id === entityId)
		.sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
	const suggestions = [
		{ label: `Current status of ${entityId}`, text: `What is the current status of ${entityId}?`, asOf: null },
		{ label: `Root cause & mitigation`, text: `What caused ${entityId} and how was it mitigated?`, asOf: null },
	];
	if (history.length >= 2) {
		const first = new Date(history[0].event_time).getTime();
		const second = new Date(history[1].event_time).getTime();
		const asOf = fromIso(first + Math.max(60000, Math.floor((second - first) / 2)));
		suggestions.push({
			label: `${entityId} as of ${asOf.slice(11)} UTC`,
			text: `What was the status of ${entityId} at that time?`,
			asOf,
		});
	}
	return suggestions;
}

function ScoreBar({ label, value, tone }) {
	const width = Math.max(0, Math.min(1, Number(value) || 0)) * 100;
	return (
		<div className="ap-score">
			<span>{label}</span>
			<div className="ap-score-bar">
				<i
					className={`is-${tone}`}
					style={{ width: `${width}%` }}
				/>
			</div>
			<strong>{value == null ? "—" : Number(value).toFixed(2)}</strong>
		</div>
	);
}

function Trace({ diagnostics, selected }) {
	if (!diagnostics) return null;
	const stages = [
		{ label: "Semantic candidates", value: diagnostics.candidate_count, note: "pgvector nearest versions" },
		{ label: "Causal filter", value: diagnostics.causal_candidate_count, note: "event_time ≤ query time" },
		{ label: "Dynamic gating", value: diagnostics.selected_tier, note: `Sc ${diagnostics.sc.toFixed(2)} · ${diagnostics.query_classification}` },
		{ label: "Evidence selected", value: selected, note: `K=${diagnostics.selected_k} · α=${diagnostics.selected_alpha}` },
	];
	return (
		<div className="ap-trace">
			<ol className="ap-trace-flow">
				{stages.map((stage) => (
					<li key={stage.label}>
						<span className="ap-trace-label">{stage.label}</span>
						<strong>{stage.value}</strong>
						<span className="ap-trace-note">{stage.note}</span>
					</li>
				))}
			</ol>
			<p className="ap-trace-foot">
				St {diagnostics.st.toFixed(2)} (urgency) · Sr {diagnostics.sr.toFixed(2)} (retrieval confidence) · γ {diagnostics.gamma} · λ{" "}
				{diagnostics.lambda_per_minute}/min
			</p>
		</div>
	);
}

function Timeline({ entity, onEntityChange, onLoad, rows, loading, error, cited, queryTime }) {
	const markerIndex = useMemo(() => {
		if (!queryTime) return -1;
		const limit = new Date(queryTime).getTime();
		return rows.filter((row) => new Date(row.valid_from).getTime() <= limit).length;
	}, [rows, queryTime]);

	return (
		<aside className="ap-panel ap-timeline">
			<div className="ap-panel-head">
				<div>
					<h2>Incident timeline</h2>
					<p>Every knowledge version, with its validity window.</p>
				</div>
			</div>
			<form
				className="ap-inline"
				onSubmit={(event) => {
					event.preventDefault();
					onLoad(entity);
				}}
			>
				<input
					aria-label="Incident ID"
					className="ap-input"
					onChange={(event) => onEntityChange(event.target.value)}
					placeholder="INC-1024"
					value={entity}
				/>
				<Button
					disabled={!ENTITY_RE.test(entity)}
					type="submit"
				>
					Load
				</Button>
			</form>
			<ErrorBanner message={error} />
			{loading ? (
				<Skeleton rows={4} />
			) : rows.length === 0 && !error ? (
				<p className="ap-hint">Mention an incident ID in your question, or load one here, to see how its state evolved.</p>
			) : (
				<ol className="ap-tl">
					{rows.map((row, index) => (
						<li key={row.id}>
							{index === markerIndex && (
								<div className="ap-tl-marker">
									<span>Query time · {formatUtc(queryTime)}</span>
								</div>
							)}
							<div className={`ap-tl-item ${cited.has(row.id) ? "is-cited" : ""} ${row.is_current ? "is-current" : ""}`}>
								<i className={`is-${statusTone(row.status)}`} />
								<div>
									<div className="ap-tl-head">
										<Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
										<span className="ap-muted">v{row.version}</span>
										{row.is_current && <Badge tone="green">current</Badge>}
										{cited.has(row.id) && <Badge tone="violet">cited</Badge>}
									</div>
									<p className="ap-tl-text">{row.content}</p>
									<p className="ap-tl-window">
										{formatUtc(row.valid_from)} → {row.valid_to ? formatUtc(row.valid_to) : "now"}
									</p>
								</div>
							</div>
						</li>
					))}
					{markerIndex === rows.length && rows.length > 0 && (
						<li>
							<div className="ap-tl-marker">
								<span>Query time · {formatUtc(queryTime)}</span>
							</div>
						</li>
					)}
				</ol>
			)}
		</aside>
	);
}

export default function Intelligence() {
	const [searchParams] = useSearchParams();
	const { events } = usePipeline();
	const [query, setQuery] = useState("");
	const [historical, setHistorical] = useState(false);
	const [asOf, setAsOf] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState(null);
	const [elapsed, setElapsed] = useState(null);

	const [entity, setEntity] = useState("");
	const [timeline, setTimeline] = useState([]);
	const [timelineLoading, setTimelineLoading] = useState(false);
	const [timelineError, setTimelineError] = useState("");
	const requestId = useRef(0);

	const suggestions = useMemo(() => buildSuggestions(events), [events]);

	const loadTimeline = useCallback(async (value) => {
		const id = String(value || "").trim().toUpperCase();
		if (!ENTITY_RE.test(id)) return;
		setEntity(id);
		setTimelineLoading(true);
		setTimelineError("");
		try {
			setTimeline(await fetchTimeline(id));
		} catch (err) {
			setTimeline([]);
			setTimelineError(errorMessage(err, "Unable to load timeline."));
		} finally {
			setTimelineLoading(false);
		}
	}, []);

	useEffect(() => {
		const incoming = searchParams.get("entity");
		if (incoming) loadTimeline(incoming);
	}, [searchParams, loadTimeline]);

	const run = async (text = query, asOfValue = historical ? asOf : "") => {
		const trimmed = text.trim();
		if (!trimmed || loading) return;
		const current = ++requestId.current;
		setLoading(true);
		setError("");
		setResult(null);
		const started = performance.now();
		try {
			const data = await queryIncident({ query: trimmed, as_of: toAsOfIso(asOfValue) });
			if (current !== requestId.current) return;
			setElapsed(performance.now() - started);
			setResult({ ...data, asked: trimmed, historical: Boolean(asOfValue) });
			const mentioned = trimmed.match(ENTITY_RE);
			if (mentioned) loadTimeline(mentioned[0]);
		} catch (err) {
			if (current !== requestId.current) return;
			setError(errorMessage(err, "Unable to run query."));
		} finally {
			if (current === requestId.current) setLoading(false);
		}
	};

	const applySuggestion = (suggestion) => {
		setQuery(suggestion.text);
		setHistorical(Boolean(suggestion.asOf));
		setAsOf(suggestion.asOf || "");
		run(suggestion.text, suggestion.asOf || "");
	};

	const cited = useMemo(() => new Set((result?.citations || []).map((item) => item.knowledge_version_id)), [result]);
	const generationFailed = result?.answer?.startsWith("Generation unavailable");
	const noEvidence = result && result.citations.length === 0;

	return (
		<div className="ap-page">
			<header className="ap-page-head">
				<div>
					<h1>Intelligence</h1>
					<p>Ask what is true now — or what was true at any point in an incident's history.</p>
				</div>
			</header>

			<div className="ap-intel">
				<div className="ap-intel-main">
					<form
						className="ap-composer"
						onSubmit={(event) => {
							event.preventDefault();
							run();
						}}
					>
						<textarea
							aria-label="Question"
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => {
								if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
									event.preventDefault();
									run();
								}
							}}
							placeholder="Ask about an incident, e.g. “What is the current status of INC-1024?”"
							rows={3}
							value={query}
						/>
						<div className="ap-composer-bar">
							<div className="ap-composer-time">
								<div
									aria-label="Time context"
									className="ap-segment is-small"
									role="group"
								>
									<button
										aria-pressed={!historical}
										className={!historical ? "is-active" : ""}
										onClick={() => setHistorical(false)}
										type="button"
									>
										Now
									</button>
									<button
										aria-pressed={historical}
										className={historical ? "is-active" : ""}
										onClick={() => setHistorical(true)}
										type="button"
									>
										As of…
									</button>
								</div>
								{historical && (
									<label className="ap-asof">
										<input
											aria-label="As-of time (UTC)"
											className="ap-input"
											onChange={(event) => setAsOf(event.target.value)}
											type="datetime-local"
											value={asOf}
										/>
										<span>UTC</span>
									</label>
								)}
							</div>
							<Button
								disabled={loading || !query.trim() || (historical && !asOf)}
								icon="send"
								type="submit"
								variant="primary"
							>
								{loading ? "Retrieving…" : "Ask"}
							</Button>
						</div>
					</form>

					{suggestions.length > 0 && (
						<div className="ap-suggest">
							<span>Try</span>
							{suggestions.map((suggestion) => (
								<button
									key={suggestion.label}
									onClick={() => applySuggestion(suggestion)}
									type="button"
								>
									{suggestion.label}
								</button>
							))}
						</div>
					)}

					<ErrorBanner
						message={error}
						onRetry={() => run()}
					/>

					{loading && (
						<div className="ap-answer is-loading">
							<p className="ap-eyebrow">Retrieving evidence…</p>
							<Skeleton rows={3} />
						</div>
					)}

					{!loading && !result && !error && (
						<EmptyState
							icon="intelligence"
							title="Ask your first question"
						>
							{suggestions.length
								? "Pick a suggestion above — generated from the incidents currently in your system — or write your own."
								: "No incidents have been ingested yet. Publish some events from the Simulator, then come back to query them."}
						</EmptyState>
					)}

					{result && (
						<>
							<section className={`ap-answer ${generationFailed ? "is-warn" : ""}`}>
								<div className="ap-answer-meta">
									<Badge tone={result.historical ? "amber" : "green"}>
										{result.historical ? "Historical" : "Current state"}
									</Badge>
									<span className="ap-muted">as of {formatUtc(result.query_time_used)}</span>
									{result.retrieval_diagnostics && (
										<Badge
											mono
											tone="violet"
										>
											tier {result.retrieval_diagnostics.selected_tier}
										</Badge>
									)}
									{elapsed != null && <span className="ap-muted ap-meta-right">{formatDuration(elapsed)}</span>}
								</div>
								{generationFailed ? (
									<>
										<p className="ap-answer-text is-muted">Answer generation is unavailable.</p>
										<p className="ap-note">
											{result.answer.replace(/ Showing evidence-based citations only\.$/, "")} The retrieved evidence is
											shown below.
										</p>
									</>
								) : (
									<p className="ap-answer-text">{result.answer}</p>
								)}
							</section>

							<section className="ap-section">
								<div className="ap-section-head">
									<h2>Supporting evidence</h2>
									<span className="ap-muted">{result.citations.length} cited</span>
								</div>
								{noEvidence ? (
									<EmptyState
										icon="search"
										title="No evidence was retrieved"
									>
										Nothing in the knowledge base matched at that point in time. Check the incident ID and the as-of time.
									</EmptyState>
								) : (
									<ol className="ap-evidence">
										{result.citations.map((citation, index) => (
											<li
												className="ap-evidence-item"
												key={citation.knowledge_version_id}
											>
												<span className="ap-rank">{index + 1}</span>
												<div className="ap-evidence-body">
													<p>{citation.content}</p>
													<p className="ap-evidence-window">
														Version #{citation.knowledge_version_id} · valid {formatUtc(citation.valid_from)} →{" "}
														{citation.valid_to ? formatUtc(citation.valid_to) : "now"}
														{citation.delta_minutes != null && ` · ${citation.delta_minutes} min before query time`}
													</p>
												</div>
												<div className="ap-scores">
													<ScoreBar
														label="Semantic"
														tone="blue"
														value={citation.semantic_similarity}
													/>
													<ScoreBar
														label="Recency"
														tone="amber"
														value={citation.recency_score}
													/>
													<ScoreBar
														label="TAR"
														tone="violet"
														value={citation.tar_score}
													/>
												</div>
											</li>
										))}
									</ol>
								)}
							</section>

							{result.retrieval_diagnostics && (
								<section className="ap-section">
									<div className="ap-section-head">
										<h2>How it was retrieved</h2>
									</div>
									<Trace
										diagnostics={result.retrieval_diagnostics}
										selected={result.citations.length}
									/>
								</section>
							)}
						</>
					)}
				</div>

				<Timeline
					cited={cited}
					entity={entity}
					error={timelineError}
					loading={timelineLoading}
					onEntityChange={setEntity}
					onLoad={loadTimeline}
					queryTime={result && ENTITY_RE.test(result.asked) ? result.query_time_used : null}
					rows={timeline}
				/>
			</div>
		</div>
	);
}
