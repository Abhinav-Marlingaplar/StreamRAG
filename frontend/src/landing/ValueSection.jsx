import { SectionHeading } from "./ui";

const capabilities = [
	{
		index: "01",
		title: "Continuous event ingestion",
		body: "Every incident event travels through Kafka to a dedicated worker that validates the payload, skips duplicates by event ID, and commits offsets only after the event is processed.",
		spec: ["operations-events topic", "aiokafka worker", "idempotent"],
		visual: "stream",
	},
	{
		index: "02",
		title: "Temporal knowledge preservation",
		body: "Updates never overwrite history. Each event becomes a new knowledge version with a validity window, the previous version is closed, and late-arriving events slot into the past without rewriting it.",
		spec: ["valid_from → valid_to", "raw_events log", "versioned"],
		visual: "versions",
	},
	{
		index: "03",
		title: "Evidence-grounded answers",
		body: "Retrieval is causal — nothing after the query time is eligible. Candidates are re-ranked by Temporal-Aware Retrieval, and every answer ships with its citations, scores, and validity windows.",
		spec: ["pgvector", "TAR + dynamic gating", "citations"],
		visual: "ranking",
	},
];

function CapabilityVisual({ type }) {
	if (type === "stream") {
		return (
			<div
				aria-hidden
				className="lp-cap-visual lp-cap-stream"
			>
				{Array.from({ length: 3 }).map((_, lane) => (
					<div
						className="lp-cap-lane"
						key={lane}
					>
						{Array.from({ length: 9 }).map((__, cell) => (
							<i
								key={cell}
								style={{ animationDelay: `${(cell * 0.35 + lane * 0.6).toFixed(2)}s` }}
							/>
						))}
					</div>
				))}
			</div>
		);
	}
	if (type === "versions") {
		return (
			<div
				aria-hidden
				className="lp-cap-visual lp-cap-versions"
			>
				{[
					[0, 27],
					[27, 47],
					[47, 67],
					[67, 100],
				].map(([start, end], index) => (
					<div
						className="lp-cap-version"
						key={start}
					>
						<span>v{index + 1}</span>
						<div>
							<i
								className={index === 3 ? "is-open" : ""}
								style={{ left: `${start}%`, width: `${end - start}%` }}
							/>
						</div>
					</div>
				))}
			</div>
		);
	}
	return (
		<div
			aria-hidden
			className="lp-cap-visual lp-cap-ranking"
		>
			{[92, 74, 61, 43, 28].map((width, index) => (
				<div
					className={`lp-cap-rank ${index === 0 ? "is-top" : ""}`}
					key={width}
				>
					<span>{index + 1}</span>
					<i style={{ width: `${width}%` }} />
				</div>
			))}
		</div>
	);
}

export default function ValueSection() {
	return (
		<section
			className="lp-section lp-value"
			id="product"
		>
			<div className="lp-container">
				<div className="lp-problem">
					<SectionHeading
						eyebrow="Why StreamRAG"
						lead="Incident updates are written about the same outage, in nearly the same words. “Investigating”, “root cause identified”, and “resolved” all look alike to a similarity search — so retrieval that ignores time can confidently return a state that stopped being true an hour ago."
						title="Similarity alone can't tell you what's true now."
					/>

					<div
						className="lp-compare"
						data-reveal
					>
						<div className="lp-compare-query">
							<span className="lp-mono">query</span>
							<p>Is INC-1024 still being investigated?</p>
						</div>
						<div className="lp-compare-grid">
							<div className="lp-compare-col is-stale">
								<p className="lp-compare-label">Similarity-only retrieval</p>
								<div className="lp-compare-hit">
									<div className="lp-compare-hit-head">
										<span className="lp-mono">v1 · 10:10</span>
										<span className="lp-tag lp-tag-warn">superseded at 10:30</span>
									</div>
									<p className="lp-compare-status">investigating</p>
									<p className="lp-compare-text">Elevated API error rate detected for checkout service.</p>
								</div>
								<p className="lp-compare-caption">The closest wording wins — even after the incident has moved on.</p>
							</div>
							<div className="lp-compare-col is-fresh">
								<p className="lp-compare-label">StreamRAG · temporal-aware</p>
								<div className="lp-compare-hit">
									<div className="lp-compare-hit-head">
										<span className="lp-mono">v4 · 11:00 → now</span>
										<span className="lp-tag lp-tag-ok">valid at query time</span>
									</div>
									<p className="lp-compare-status">resolved</p>
									<p className="lp-compare-text">Pool settings tuned and alert thresholds adjusted.</p>
								</div>
								<p className="lp-compare-caption">
									Nothing after the query time is eligible; meaning and recency are ranked together.
								</p>
							</div>
						</div>
					</div>
				</div>

				<div className="lp-caps">
					<p
						className="lp-caps-kicker"
						data-reveal
					>
						One pipeline, three engineering commitments
					</p>
					<div
						className="lp-caps-grid"
						data-reveal-group
					>
						{capabilities.map((capability) => (
							<article
								className={`lp-cap lp-cap-${capability.visual}`}
								data-reveal-item
								key={capability.index}
							>
								<CapabilityVisual type={capability.visual} />
								<p className="lp-cap-index">{capability.index}</p>
								<h3>{capability.title}</h3>
								<p className="lp-cap-body">{capability.body}</p>
								<ul className="lp-cap-spec">
									{capability.spec.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
