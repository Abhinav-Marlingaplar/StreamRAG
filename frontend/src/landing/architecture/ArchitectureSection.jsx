import { useCallback, useEffect, useRef, useState } from "react";
import { githubUrl } from "../content";
import { useInView } from "../hooks";
import { Icon, SectionHeading } from "../ui";
import ArchitectureDiagram from "./ArchitectureDiagram";
import ArchitectureMobile from "./ArchitectureMobile";
import { FLOWS, flowRange, stages } from "./stages";

const STAGE_MS = 2400;
const TRAVEL = 0.62;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const scopes = [
	{ id: "all", label: "Full system" },
	{ id: "ingest", label: "Ingestion" },
	{ id: "query", label: "Query" },
];

export default function ArchitectureSection({ reducedMotion }) {
	const sectionRef = useRef(null);
	const diagramRef = useRef(null);
	const inView = useInView(diagramRef, { threshold: 0.3 });
	const [stage, setStage] = useState(0);
	const [playing, setPlaying] = useState(!reducedMotion);
	const [scope, setScope] = useState("all");
	const [oneShot, setOneShot] = useState(0);
	const [runKey, setRunKey] = useState(0);

	const paths = useRef({});
	const packetRef = useRef(null);
	const progress = useRef(0);
	const stageRef = useRef(0);
	const scopeRef = useRef("all");

	const registerPath = useCallback((id, node) => {
		if (node) paths.current[id] = node;
	}, []);

	const placePacket = useCallback((index, value) => {
		const packet = packetRef.current;
		if (!packet) return;
		const route = stages[index].edges;
		if (!route.length) {
			packet.style.opacity = "0";
			return;
		}
		const travel = Math.min(value / TRAVEL, 1);
		const scaled = travel * route.length;
		const segment = Math.min(Math.floor(scaled), route.length - 1);
		const local = ease(Math.min(scaled - segment, 1));
		const path = paths.current[route[segment]];
		if (!path) return;
		try {
			const length = path.getTotalLength();
			const point = path.getPointAtLength(local * length);
			packet.setAttribute("transform", `translate(${point.x} ${point.y})`);
			packet.style.opacity = travel >= 1 ? "0.35" : "1";
		} catch {
			packet.style.opacity = "0";
		}
	}, []);

	useEffect(() => {
		setPlaying(!reducedMotion);
	}, [reducedMotion]);

	useEffect(() => {
		stageRef.current = stage;
		placePacket(stage, progress.current);
	}, [stage, placePacket]);

	const running = !reducedMotion && inView && (playing || oneShot > 0);

	useEffect(() => {
		if (!running) return undefined;
		let frame = 0;
		let last = performance.now();
		const tick = (now) => {
			const delta = Math.min(now - last, 64);
			last = now;
			progress.current += delta / STAGE_MS;

			if (!playing) {
				if (progress.current >= TRAVEL) {
					progress.current = TRAVEL;
					placePacket(stageRef.current, progress.current);
					setOneShot(0);
					return;
				}
			} else if (progress.current >= 1) {
				const [start, end] = flowRange(scopeRef.current);
				const next = stageRef.current >= end ? start : stageRef.current + 1;
				progress.current = 0;
				stageRef.current = next;
				setStage(next);
			}
			placePacket(stageRef.current, progress.current);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [running, playing, placePacket]);

	const goTo = (index, { pause = false } = {}) => {
		progress.current = reducedMotion ? TRAVEL : 0;
		stageRef.current = index;
		setStage(index);
		setRunKey((key) => key + 1);
		if (pause) setPlaying(false);
		if ((pause || !playing) && !reducedMotion) setOneShot((value) => value + 1);
		if (reducedMotion) placePacket(index, TRAVEL);
	};

	const changeScope = (next) => {
		scopeRef.current = next;
		setScope(next);
		goTo(flowRange(next)[0]);
	};

	const [rangeStart, rangeEnd] = flowRange(scope);

	const step = (direction) => {
		const current = stageRef.current;
		let next = current + direction;
		if (next > rangeEnd) next = rangeStart;
		if (next < rangeStart) next = rangeEnd;
		goTo(next, { pause: true });
	};

	const select = (index) => {
		if (index < rangeStart || index > rangeEnd) {
			scopeRef.current = "all";
			setScope("all");
		}
		goTo(index, { pause: true });
	};

	const replay = () => {
		goTo(rangeStart);
		if (!reducedMotion) setPlaying(true);
	};

	const togglePlay = () => {
		if (reducedMotion) return;
		if (!playing && progress.current >= TRAVEL) progress.current = TRAVEL;
		setPlaying((value) => !value);
	};

	const current = stages[stage];
	const flowMeta = FLOWS[current.flow];
	const isAnimating = running && playing;

	return (
		<section
			className="lp-section lp-arch"
			id="architecture"
			ref={sectionRef}
		>
			<div className="lp-arch-backdrop" />
			<div className="lp-container lp-container-wide">
				<SectionHeading
					align="center"
					eyebrow="Architecture"
					lead="Two workflows meet at one source of truth. Events stream in and become versioned, embedded knowledge; questions flow out through causal, temporal-aware retrieval to an answer you can verify."
					title="From event stream to grounded answer."
				/>

				<div
					className="arch-shell"
					data-reveal
				>
					<div className="arch-toolbar">
						<div
							aria-label="Workflow"
							className="arch-scope"
							role="tablist"
						>
							{scopes.map((item) => (
								<button
									aria-selected={scope === item.id}
									className={`arch-scope-btn ${scope === item.id ? "is-active" : ""} is-${item.id}`}
									key={item.id}
									onClick={() => changeScope(item.id)}
									role="tab"
									type="button"
								>
									{item.id !== "all" && <i />}
									{item.label}
								</button>
							))}
						</div>
						<div className="arch-controls">
							<button
								aria-label="Previous step"
								className="arch-ctrl"
								onClick={() => step(-1)}
								type="button"
							>
								<Icon name="prev" />
							</button>
							<button
								aria-label={playing ? "Pause animation" : "Play animation"}
								className="arch-ctrl arch-ctrl-main"
								disabled={reducedMotion}
								onClick={togglePlay}
								type="button"
							>
								<Icon
									name={playing && !reducedMotion ? "pause" : "play"}
									size={14}
								/>
								<span>{playing && !reducedMotion ? "Pause" : "Play"}</span>
							</button>
							<button
								aria-label="Next step"
								className="arch-ctrl"
								onClick={() => step(1)}
								type="button"
							>
								<Icon name="next" />
							</button>
							<span className="arch-ctrl-sep" />
							<button
								aria-label="Replay from the start"
								className="arch-ctrl"
								onClick={replay}
								type="button"
							>
								<Icon name="replay" />
							</button>
						</div>
					</div>

					<div
						className={`arch-canvas ${isAnimating ? "is-animating" : ""}`}
						ref={diagramRef}
					>
						<ArchitectureDiagram
							onSelect={select}
							packetFlow={current.flow}
							packetRef={packetRef}
							registerPath={registerPath}
							stage={stage}
						/>
						<ArchitectureMobile
							onSelect={select}
							stage={stage}
						/>
					</div>

					<div className="arch-footer">
						<div
							aria-label="Workflow progress"
							className="arch-progress"
						>
							{stages.map((item, index) => {
								const inScope = index >= rangeStart && index <= rangeEnd;
								const state = index < stage ? "is-done" : index === stage ? "is-active" : "";
								return (
									<button
										aria-label={`Step ${index + 1}: ${item.title}`}
										className={`arch-seg is-${item.flow} ${state} ${inScope ? "" : "is-out"} ${index > 0 && stages[index - 1].flow !== item.flow ? "is-break" : ""}`}
										key={item.title}
										onClick={() => select(index)}
										type="button"
									>
										{index === stage && (
											<span
												className={`arch-seg-fill ${playing && !reducedMotion ? "" : "is-static"}`}
												key={runKey}
												style={{
													animationDuration: `${STAGE_MS}ms`,
													animationPlayState: isAnimating ? "running" : "paused",
												}}
											/>
										)}
									</button>
								);
							})}
						</div>

						<div
							aria-live="polite"
							className={`arch-inspector is-${current.flow}`}
						>
							<div className="arch-inspector-meta">
								<span className="arch-inspector-flow">
									<i />
									{flowMeta.label} · {flowMeta.name}
								</span>
								<span className="arch-inspector-count">
									Step {String(stage + 1).padStart(2, "0")} / {stages.length}
								</span>
							</div>
							<div
								className="arch-inspector-body"
								key={stage}
							>
								<h3>{current.title}</h3>
								<p>{current.body}</p>
							</div>
							<a
								className="arch-inspector-ref"
								href={`${githubUrl}/blob/main/${current.ref}`}
								rel="noreferrer"
								target="_blank"
							>
								<span>{current.ref}</span>
								<Icon
									name="arrow-up-right"
									size={14}
								/>
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
