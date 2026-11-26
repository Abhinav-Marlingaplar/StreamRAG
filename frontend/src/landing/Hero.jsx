import { useEffect, useState } from "react";
import { scenario } from "./content";
import { scrollToSection } from "./hooks";
import { Icon } from "./ui";

const DOMAIN_START = 0;
const DOMAIN_END = 75;
const AS_OF_MINUTE = 35;
const NOW_MINUTE = 72;
const axisTicks = [
	{ label: "10:00", minute: 0 },
	{ label: "10:15", minute: 15 },
	{ label: "10:30", minute: 30 },
	{ label: "10:45", minute: 45 },
	{ label: "11:00", minute: 60 },
	{ label: "now", minute: 75 },
];

const fraction = (minute) => (minute - DOMAIN_START) / (DOMAIN_END - DOMAIN_START);
const pct = (minute) => `${fraction(minute) * 100}%`;
const plot = (minute) => `calc(var(--tl-gutter) + (100% - var(--tl-gutter)) * ${fraction(minute)})`;
const pretty = (status) => status.replaceAll("_", " ");

function versionAt(events, minute) {
	let match = null;
	events.forEach((event, index) => {
		if (event.minute <= minute) match = { ...event, version: index + 1 };
	});
	return match;
}

function HeroTimeline({ reducedMotion }) {
	const total = scenario.events.length;
	const [phase, setPhase] = useState(reducedMotion ? total : 0);
	const [marker, setMarker] = useState("asof");

	useEffect(() => {
		if (reducedMotion) {
			setPhase(total);
			return undefined;
		}
		if (phase >= total) return undefined;
		const id = setTimeout(() => setPhase((value) => value + 1), phase === 0 ? 900 : 1300);
		return () => clearTimeout(id);
	}, [phase, reducedMotion, total]);

	useEffect(() => {
		if (reducedMotion || phase < total) return undefined;
		const id = setInterval(() => setMarker((value) => (value === "asof" ? "now" : "asof")), 3600);
		return () => clearInterval(id);
	}, [phase, reducedMotion, total]);

	const ingested = scenario.events.slice(0, phase);
	const current = versionAt(ingested, DOMAIN_END);
	const asOf = versionAt(ingested, AS_OF_MINUTE);
	const markerMinute = marker === "asof" ? AS_OF_MINUTE : NOW_MINUTE;
	const highlighted = marker === "asof" ? asOf : current;

	const queries = [
		{
			key: "now",
			question: `What is the status of ${scenario.entity} right now?`,
			answer: current,
			window: current ? `${current.time} → now` : "",
		},
		{
			key: "asof",
			question: `What was the status of ${scenario.entity} as of 10:35?`,
			answer: asOf,
			window: asOf
				? `${asOf.time} → ${ingested[asOf.version] ? ingested[asOf.version].time : "now"}`
				: "",
		},
	];

	return (
		<div
			className="lp-tl"
			data-hero
		>
			<div className="lp-tl-head">
				<div className="lp-tl-title">
					<span className="lp-tl-id">{scenario.entity}</span>
					<span className="lp-tl-service">{scenario.service}</span>
				</div>
				<div className="lp-tl-meta">
					<span className="lp-mono">topic · operations-events</span>
					<span className={`lp-live ${phase < total ? "is-streaming" : ""}`}>
						<i />
						{phase < total ? "streaming" : `${total} versions`}
					</span>
				</div>
			</div>

			<div className="lp-tl-body">
				<ol
					aria-label="Incoming events"
					className="lp-tl-stream"
				>
					{scenario.events.map((event, index) => (
						<li
							className={`lp-tl-event ${index < phase ? "is-in" : ""} ${index === phase - 1 ? "is-latest" : ""}`}
							key={event.id}
						>
							<span className="lp-tl-event-time">{event.time}</span>
							<div>
								<p className="lp-tl-event-type">{event.type}</p>
								<p className="lp-tl-event-status">{pretty(event.status)}</p>
							</div>
						</li>
					))}
				</ol>

				<div
					aria-label="Knowledge versions and validity windows"
					className="lp-tl-chart"
					role="img"
				>
					<div className="lp-tl-axis">
						{axisTicks.map((tick) => (
							<span
								key={tick.label}
								style={{ left: pct(tick.minute) }}
							>
								{tick.label}
							</span>
						))}
					</div>
					<div className="lp-tl-rows">
						{scenario.events.map((event, index) => {
							const next = scenario.events[index + 1];
							const isIn = index < phase;
							const isOpen = isIn && (!next || index + 1 >= phase);
							const end = isOpen || !next ? DOMAIN_END : next.minute;
							const isHit = highlighted && highlighted.version === index + 1;
							return (
								<div
									className="lp-tl-row"
									key={event.id}
								>
									<span className="lp-tl-v">v{index + 1}</span>
									<div className="lp-tl-track">
										<div
											className={`lp-tl-bar lp-tl-bar-${index} ${isIn ? "is-in" : ""} ${isOpen ? "is-open" : ""} ${isHit ? "is-hit" : ""}`}
											style={{
												left: pct(event.minute),
												width: `calc(${pct(end)} - ${pct(event.minute)})`,
											}}
										>
											<span>{pretty(event.status)}</span>
										</div>
									</div>
								</div>
							);
						})}
					</div>
					<div
						className={`lp-tl-marker ${marker === "asof" ? "is-asof" : "is-now"}`}
						style={{ left: plot(markerMinute) }}
					>
						<span>{marker === "asof" ? "as of 10:35" : "now"}</span>
					</div>
				</div>
			</div>

			<div className="lp-tl-queries">
				{queries.map((query) => (
					<div
						className={`lp-tl-query ${marker === query.key ? "is-active" : ""}`}
						key={query.key}
					>
						<p className="lp-tl-q">{query.question}</p>
						<p className="lp-tl-a">
							<Icon
								name="arrow-right"
								size={14}
							/>
							<strong>{query.answer ? pretty(query.answer.status) : "—"}</strong>
							{query.answer && (
								<span className="lp-mono">
									v{query.answer.version} · {query.window}
								</span>
							)}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}

export default function Hero({ reducedMotion }) {
	return (
		<section
			className="lp-hero"
			id="top"
		>
			<div className="lp-hero-glow" />
			<div className="lp-container lp-hero-inner">
				<p
					className="lp-pill"
					data-hero
				>
					<span className="lp-pill-dot" />
					Temporal RAG for incident operations
				</p>
				<h1
					className="lp-hero-title"
					data-hero
				>
					<span>Real-time intelligence.</span>
					<span className="lp-gradient-text">Real-world clarity.</span>
				</h1>
				<p
					className="lp-hero-lead"
					data-hero
				>
					StreamRAG transforms continuously evolving operational events into time-aware knowledge, helping teams
					understand what happened, what changed, and what is true now.
				</p>
				<div
					className="lp-hero-actions"
					data-hero
				>
					<a
						className="lp-btn lp-btn-primary lp-btn-lg"
						href="#architecture"
						onClick={(event) => {
							event.preventDefault();
							scrollToSection("architecture", reducedMotion);
						}}
					>
						Explore the architecture
						<Icon name="arrow-right" />
					</a>
					<a
						className="lp-btn lp-btn-ghost lp-btn-lg"
						href="#demo"
						onClick={(event) => {
							event.preventDefault();
							scrollToSection("demo", reducedMotion);
						}}
					>
						<Icon
							name="play"
							size={14}
						/>
						Watch the demo
					</a>
				</div>
				<p
					className="lp-hero-stack"
					data-hero
				>
					Kafka <i /> PostgreSQL <i /> pgvector <i /> FastAPI <i /> Sentence Transformers <i /> React
				</p>
			</div>

			<div className="lp-container lp-hero-visual">
				<HeroTimeline reducedMotion={reducedMotion} />
			</div>
		</section>
	);
}
